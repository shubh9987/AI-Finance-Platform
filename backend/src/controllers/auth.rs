use axum::{
    extract::State,
    http::{
        header,
        HeaderValue,
        StatusCode,
    },
    response::IntoResponse,
    Json,
};

use argon2::{
    password_hash::{
        rand_core::OsRng,
        PasswordHash,
        PasswordHasher,
        PasswordVerifier,
        SaltString,
    },
    Argon2,
};

use jsonwebtoken::{
    encode,
    EncodingKey,
    Header,
};

use serde::Serialize;
use uuid::Uuid;

use crate::{
    models::user::User,
    schemas::auth::{
        AuthResponse,
        LoginRequest,
        RegisterRequest,
    },
    state::AppState,
};

#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub message: String,
}

#[derive(Debug, Serialize)]
struct Claims {
    sub: String,
    exp: usize,
}

// ============================================================
// REGISTER
// ============================================================

pub async fn register(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {

    // --------------------------------------------------------
    // Validate email
    // --------------------------------------------------------

    if payload.email.trim().is_empty() {
        return Err(error_response(
            StatusCode::BAD_REQUEST,
            "Email is required",
        ));
    }

    // --------------------------------------------------------
    // Validate password
    // --------------------------------------------------------

    if payload.password.len() < 8 {
        return Err(error_response(
            StatusCode::BAD_REQUEST,
            "Password must be at least 8 characters",
        ));
    }

    // --------------------------------------------------------
    // Check whether user already exists
    // --------------------------------------------------------

    let existing_user = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM users WHERE email = $1",
    )
    .bind(&payload.email)
    .fetch_optional(&state.db)
    .await
    .map_err(|err| {
        tracing::error!("Database error while checking user: {}", err);

        error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Database error",
        )
    })?;

    if existing_user.is_some() {
        return Err(error_response(
            StatusCode::CONFLICT,
            "Email already registered",
        ));
    }

    // --------------------------------------------------------
    // Generate password salt
    // --------------------------------------------------------

    let salt = SaltString::generate(&mut OsRng);

    // --------------------------------------------------------
    // Hash password using Argon2
    // --------------------------------------------------------

    let password_hash = Argon2::default()
        .hash_password(
            payload.password.as_bytes(),
            &salt,
        )
        .map_err(|err| {
            tracing::error!("Failed to hash password: {}", err);

            error_response(
                StatusCode::INTERNAL_SERVER_ERROR,
                "Failed to hash password",
            )
        })?
        .to_string();

    // --------------------------------------------------------
    // Create user
    // --------------------------------------------------------

    let user = sqlx::query_as::<_, User>(
        r#"
        INSERT INTO users (
            email,
            password_hash,
            name
        )
        VALUES ($1, $2, $3)
        RETURNING
            id,
            email,
            password_hash,
            name,
            image_url,
            created_at,
            updated_at
        "#,
    )
    .bind(&payload.email)
    .bind(&password_hash)
    .bind(&payload.name)
    .fetch_one(&state.db)
    .await
    .map_err(|err| {
        tracing::error!("Failed to create user: {}", err);

        error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to create user",
        )
    })?;

    // --------------------------------------------------------
    // Generate JWT
    // --------------------------------------------------------

    let token = create_token(
        user.id,
        &state.config.jwt_secret,
    )?;

    // --------------------------------------------------------
    // Create authentication response
    // --------------------------------------------------------

    let response = Json(AuthResponse {
        token: token.clone(),
        user_id: user.id,
        email: user.email,
        name: user.name,
    });

    // --------------------------------------------------------
    // Set JWT as HttpOnly cookie
    // --------------------------------------------------------

    let cookie = format!(
        "auth_token={}; HttpOnly; Path=/; SameSite=Lax; Max-Age={}",
        token,
        60 * 60 * 24 * 7
    );

    let mut response = response.into_response();

    response.headers_mut().insert(
        header::SET_COOKIE,
        HeaderValue::from_str(&cookie)
            .map_err(|err| {
                tracing::error!(
                    "Failed to create authentication cookie: {}",
                    err
                );

                error_response(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Failed to create authentication cookie",
                )
            })?,
    );

    Ok(response)
}

// ============================================================
// LOGIN
// ============================================================

pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<impl IntoResponse, (StatusCode, Json<ErrorResponse>)> {

    // --------------------------------------------------------
    // Find user by email
    // --------------------------------------------------------

    let user = sqlx::query_as::<_, User>(
        r#"
        SELECT
            id,
            email,
            password_hash,
            name,
            image_url,
            created_at,
            updated_at
        FROM users
        WHERE email = $1
        "#,
    )
    .bind(&payload.email)
    .fetch_optional(&state.db)
    .await
    .map_err(|err| {
        tracing::error!("Database error while finding user: {}", err);

        error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Database error",
        )
    })?
    .ok_or_else(|| {
        error_response(
            StatusCode::UNAUTHORIZED,
            "Invalid email or password",
        )
    })?;

    // --------------------------------------------------------
    // Parse stored password hash
    // --------------------------------------------------------

    let parsed_hash = PasswordHash::new(
        &user.password_hash,
    )
    .map_err(|err| {
        tracing::error!(
            "Invalid stored password hash: {}",
            err
        );

        error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Invalid stored password hash",
        )
    })?;

    // --------------------------------------------------------
    // Verify password
    // --------------------------------------------------------

    Argon2::default()
        .verify_password(
            payload.password.as_bytes(),
            &parsed_hash,
        )
        .map_err(|err| {
            tracing::warn!(
                "Password verification failed: {}",
                err
            );

            error_response(
                StatusCode::UNAUTHORIZED,
                "Invalid email or password",
            )
        })?;

    // --------------------------------------------------------
    // Generate JWT
    // --------------------------------------------------------

    let token = create_token(
        user.id,
        &state.config.jwt_secret,
    )?;

    // --------------------------------------------------------
    // Create authentication response
    // --------------------------------------------------------

    let response = Json(AuthResponse {
        token: token.clone(),
        user_id: user.id,
        email: user.email,
        name: user.name,
    });

    // --------------------------------------------------------
    // Set JWT as HttpOnly cookie
    // --------------------------------------------------------

    let cookie = format!(
        "auth_token={}; HttpOnly; Path=/; SameSite=Lax; Max-Age={}",
        token,
        60 * 60 * 24 * 7
    );

    let mut response = response.into_response();

    response.headers_mut().insert(
        header::SET_COOKIE,
        HeaderValue::from_str(&cookie)
            .map_err(|err| {
                tracing::error!(
                    "Failed to create authentication cookie: {}",
                    err
                );

                error_response(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "Failed to create authentication cookie",
                )
            })?,
    );

    Ok(response)
}

// ============================================================
// CREATE JWT
// ============================================================

fn create_token(
    user_id: Uuid,
    secret: &str,
) -> Result<String, (StatusCode, Json<ErrorResponse>)> {

    // Token expires in 7 days
    let expiration = chrono::Utc::now()
        .checked_add_signed(
            chrono::Duration::days(7),
        )
        .unwrap()
        .timestamp() as usize;

    let claims = Claims {
        sub: user_id.to_string(),
        exp: expiration,
    };

    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(
            secret.as_bytes(),
        ),
    )
    .map_err(|err| {
        tracing::error!(
            "Failed to generate JWT: {}",
            err
        );

        error_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to generate token",
        )
    })
}

// ============================================================
// ERROR HELPER
// ============================================================

fn error_response(
    status: StatusCode,
    message: &str,
) -> (StatusCode, Json<ErrorResponse>) {

    (
        status,
        Json(ErrorResponse {
            message: message.to_string(),
        }),
    )
}
