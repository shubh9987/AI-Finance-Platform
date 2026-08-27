use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension,
    Json,
};

use uuid::Uuid;

use crate::{
    models::account::Account,
    schemas::account::{
        AccountResponse,
        CreateAccountRequest,
        UpdateAccountRequest,
    },
    state::AppState,
};

// ============================================================
// CREATE ACCOUNT
// ============================================================

pub async fn create_account(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
    Json(payload): Json<CreateAccountRequest>,
) -> Result<Json<AccountResponse>, StatusCode> {
    let balance = payload.balance.unwrap_or_default();
    let requested_default = payload.is_default.unwrap_or(false);

    // Check whether the user already has an account.
    let account_count: i64 = sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM accounts
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|error| {
        tracing::error!("COUNT ACCOUNTS ERROR: {:?}", error);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // First account should always become default.
    let is_default = requested_default || account_count == 0;

    // If this account is going to be default,
    // unset the existing default account first.
    if is_default {
        sqlx::query(
            r#"
            UPDATE accounts
            SET
                is_default = false,
                updated_at = NOW()
            WHERE user_id = $1
              AND is_default = true
            "#,
        )
        .bind(user_id)
        .execute(&state.db)
        .await
        .map_err(|error| {
            tracing::error!(
                "RESET DEFAULT ACCOUNT ERROR: {:?}",
                error
            );
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    }

    let account = sqlx::query_as::<_, Account>(
        r#"
        INSERT INTO accounts (
            name,
            type,
            balance,
            is_default,
            user_id
        )
        VALUES (
            $1,
            $2::account_type,
            $3::numeric,
            $4,
            $5
        )
        RETURNING
            id,
            name,
            type::text AS account_type,
            balance,
            is_default,
            user_id,
            created_at,
            updated_at
        "#,
    )
    .bind(&payload.name)
    .bind(&payload.account_type)
    .bind(balance)
    .bind(is_default)
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|error| {
        tracing::error!("CREATE ACCOUNT ERROR: {:?}", error);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(AccountResponse {
        id: account.id,
        name: account.name,
        account_type: account.account_type,
        balance: account.balance,
        is_default: account.is_default,
    }))
}

// ============================================================
// GET ALL ACCOUNTS
// ============================================================

pub async fn get_accounts(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
) -> Result<Json<Vec<AccountResponse>>, StatusCode> {
    let accounts = sqlx::query_as::<_, Account>(
        r#"
        SELECT
            id,
            name,
            type::text AS account_type,
            balance,
            is_default,
            user_id,
            created_at,
            updated_at
        FROM accounts
        WHERE user_id = $1
        ORDER BY is_default DESC, created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await
    .map_err(|error| {
        tracing::error!("GET ACCOUNTS ERROR: {:?}", error);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let response = accounts
        .into_iter()
        .map(|account| AccountResponse {
            id: account.id,
            name: account.name,
            account_type: account.account_type,
            balance: account.balance,
            is_default: account.is_default,
        })
        .collect();

    Ok(Json(response))
}

// ============================================================
// GET SINGLE ACCOUNT
// ============================================================

pub async fn get_account(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
    Path(id): Path<Uuid>,
) -> Result<Json<AccountResponse>, StatusCode> {
    let account = sqlx::query_as::<_, Account>(
        r#"
        SELECT
            id,
            name,
            type::text AS account_type,
            balance,
            is_default,
            user_id,
            created_at,
            updated_at
        FROM accounts
        WHERE id = $1
          AND user_id = $2
        "#,
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|error| {
        tracing::error!("GET ACCOUNT ERROR: {:?}", error);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(AccountResponse {
        id: account.id,
        name: account.name,
        account_type: account.account_type,
        balance: account.balance,
        is_default: account.is_default,
    }))
}

// ============================================================
// UPDATE ACCOUNT
// ============================================================

pub async fn update_account(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateAccountRequest>,
) -> Result<Json<AccountResponse>, StatusCode> {
    // If explicitly setting this account as default,
    // unset all other defaults first.
    if payload.is_default == Some(true) {
        sqlx::query(
            r#"
            UPDATE accounts
            SET
                is_default = false,
                updated_at = NOW()
            WHERE user_id = $1
              AND id != $2
              AND is_default = true
            "#,
        )
        .bind(user_id)
        .bind(id)
        .execute(&state.db)
        .await
        .map_err(|error| {
            tracing::error!(
                "RESET DEFAULT ACCOUNT ERROR: {:?}",
                error
            );
            StatusCode::INTERNAL_SERVER_ERROR
        })?;
    }

    // Do not allow removing the default status if
    // this is currently the user's default account.
    if payload.is_default == Some(false) {
        let current_is_default: Option<bool> = sqlx::query_scalar(
            r#"
            SELECT is_default
            FROM accounts
            WHERE id = $1
              AND user_id = $2
            "#,
        )
        .bind(id)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|error| {
            tracing::error!(
                "CHECK DEFAULT ACCOUNT ERROR: {:?}",
                error
            );
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

        if current_is_default == Some(true) {
            return Err(StatusCode::BAD_REQUEST);
        }
    }

    let account = sqlx::query_as::<_, Account>(
        r#"
        UPDATE accounts
        SET
            name = COALESCE($1, name),
            type = COALESCE($2::account_type, type),
            balance = COALESCE($3::numeric, balance),
            is_default = COALESCE($4, is_default),
            updated_at = NOW()
        WHERE id = $5
          AND user_id = $6
        RETURNING
            id,
            name,
            type::text AS account_type,
            balance,
            is_default,
            user_id,
            created_at,
            updated_at
        "#,
    )
    .bind(&payload.name)
    .bind(&payload.account_type)
    .bind(&payload.balance)
    .bind(&payload.is_default)
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|error| {
        tracing::error!("UPDATE ACCOUNT ERROR: {:?}", error);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(AccountResponse {
        id: account.id,
        name: account.name,
        account_type: account.account_type,
        balance: account.balance,
        is_default: account.is_default,
    }))
}

// ============================================================
// DELETE ACCOUNT
// ============================================================

pub async fn delete_account(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let result = sqlx::query(
        r#"
        DELETE FROM accounts
        WHERE id = $1
          AND user_id = $2
        "#,
    )
    .bind(id)
    .bind(user_id)
    .execute(&state.db)
    .await
    .map_err(|error| {
        tracing::error!("DELETE ACCOUNT ERROR: {:?}", error);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}