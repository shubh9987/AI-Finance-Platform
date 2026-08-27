use axum::{
    routing::{delete, get, post, put},
    Router,
};

use crate::{
    controllers::transactions::{
        create_transaction,
        delete_transaction,
        get_transaction,
        get_transactions,
        update_transaction,
    },
    state::AppState,
};

pub fn routes() -> Router<AppState> {
    Router::new()
        .route("/", post(create_transaction).get(get_transactions))
        .route(
            "/{id}",
            get(get_transaction)
                .put(update_transaction)
                .delete(delete_transaction),
        )
}