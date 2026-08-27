use axum::{
    routing::post,
    Router,
};

use crate::{
    controllers::budget::{
        create_budget,
        delete_budget,
        get_budget,
        update_budget,
    },
    state::AppState,
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/",
            post(create_budget)
                .get(get_budget)
                .put(update_budget)
                .delete(delete_budget),
        )
}