use axum::{
    extract::State,
    http::StatusCode,
    Extension,
    Json,
};
use uuid::Uuid;

use crate::{
    models::budget::Budget,
    schemas::budget::{
        BudgetResponse,
        CreateBudgetRequest,
        UpdateBudgetRequest,
    },
    state::AppState,
};

pub async fn create_budget(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
    Json(payload): Json<CreateBudgetRequest>,
) -> Result<Json<BudgetResponse>, StatusCode> {
    let budget = sqlx::query_as::<_, Budget>(
        r#"
        INSERT INTO budgets (
            amount,
            user_id
        )
        VALUES ($1, $2)
        RETURNING
            id,
            amount,
            last_alert_sent,
            user_id,
            created_at,
            updated_at
        "#,
    )
    .bind(payload.amount)
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|error| {
        tracing::error!("Failed to create budget: {}", error);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(BudgetResponse {
        id: budget.id,
        amount: budget.amount,
        last_alert_sent: budget.last_alert_sent,
    }))
}

pub async fn get_budget(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
) -> Result<Json<BudgetResponse>, StatusCode> {
    let budget = sqlx::query_as::<_, Budget>(
        r#"
        SELECT
            id,
            amount,
            last_alert_sent,
            user_id,
            created_at,
            updated_at
        FROM budgets
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|error| {
        tracing::error!("Failed to fetch budget: {}", error);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(BudgetResponse {
        id: budget.id,
        amount: budget.amount,
        last_alert_sent: budget.last_alert_sent,
    }))
}

pub async fn update_budget(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
    Json(payload): Json<UpdateBudgetRequest>,
) -> Result<Json<BudgetResponse>, StatusCode> {
    let budget = sqlx::query_as::<_, Budget>(
        r#"
        UPDATE budgets
        SET
            amount = $1,
            updated_at = NOW()
        WHERE user_id = $2
        RETURNING
            id,
            amount,
            last_alert_sent,
            user_id,
            created_at,
            updated_at
        "#,
    )
    .bind(payload.amount)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|error| {
        tracing::error!("Failed to update budget: {}", error);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(BudgetResponse {
        id: budget.id,
        amount: budget.amount,
        last_alert_sent: budget.last_alert_sent,
    }))
}

pub async fn delete_budget(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let result = sqlx::query(
        r#"
        DELETE FROM budgets
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .execute(&state.db)
    .await
    .map_err(|error| {
        tracing::error!("Failed to delete budget: {}", error);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}