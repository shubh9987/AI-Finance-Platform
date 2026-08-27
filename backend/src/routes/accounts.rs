use axum::{
    routing::{get, post},
    Router,
};

use crate::{
    controllers::accounts::{
        create_account,
        delete_account,
        get_account,
        get_accounts,
        update_account,
    },
    state::AppState,
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route(
            "/",
            post(create_account)
                .get(get_accounts),
        )
        .route(
            "/{id}",
            get(get_account)
                .put(update_account)
                .delete(delete_account),
        )
}