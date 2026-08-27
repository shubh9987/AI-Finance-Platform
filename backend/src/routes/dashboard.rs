use axum::{
    routing::get,
    Router,
};

use crate::{
    controllers::dashboard::get_dashboard,
    state::AppState,
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", get(get_dashboard))
}