use axum::{
    routing::post,
    Router,
};

use crate::{
    controllers::auth::{
        login,
        register,
    },
    state::AppState,
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/register", post(register))
        .route("/login", post(login))
}