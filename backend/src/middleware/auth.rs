use axum::{
    extract::{Request, State},
    http::{header, StatusCode},
    middleware::Next,
    response::Response,
};

use jsonwebtoken::{
    decode,
    DecodingKey,
    Validation,
};

use serde::Deserialize;
use uuid::Uuid;

use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
}

pub async fn require_auth(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let token = extract_token(&request)
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let token_data = decode::<Claims>(
        &token,
        &DecodingKey::from_secret(
            state.config.jwt_secret.as_bytes(),
        ),
        &Validation::default(),
    )
    .map_err(|_| StatusCode::UNAUTHORIZED)?;

    let user_id = Uuid::parse_str(&token_data.claims.sub)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    request.extensions_mut().insert(user_id);

    Ok(next.run(request).await)
}

fn extract_token(request: &Request) -> Option<String> {
    // --------------------------------------------------------
    // 1. Try Authorization: Bearer <token>
    // --------------------------------------------------------

    if let Some(value) = request.headers().get(header::AUTHORIZATION) {
        if let Ok(value) = value.to_str() {
            if let Some(token) = value.strip_prefix("Bearer ") {
                return Some(token.to_string());
            }
        }
    }

    // --------------------------------------------------------
    // 2. Try auth_token cookie
    // --------------------------------------------------------

    if let Some(cookie_header) = request.headers().get(header::COOKIE) {
        if let Ok(cookie_header) = cookie_header.to_str() {
            for cookie in cookie_header.split(';') {
                let cookie = cookie.trim();

                if let Some(token) = cookie.strip_prefix("auth_token=") {
                    return Some(token.to_string());
                }
            }
        }
    }

    None
}
