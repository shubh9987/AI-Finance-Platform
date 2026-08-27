use axum::{
    extract::State,
    http::StatusCode,
    Extension,
    Json,
};
use rust_decimal::Decimal;
use sqlx::Row;
use uuid::Uuid;

use crate::{
    models::dashboard::{
        DashboardAccount,
        DashboardResponse,
        DashboardTransaction,
    },
    state::AppState,
};

pub async fn get_dashboard(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
) -> Result<Json<DashboardResponse>, StatusCode> {

    // ============================================
    // 1. TOTAL BALANCE
    // ============================================

    let total_balance: Decimal = sqlx::query_scalar(
        r#"
        SELECT COALESCE(SUM(balance), 0)
        FROM accounts
        WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|error| {
        tracing::error!("Failed to calculate total balance: {}", error);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // ============================================
    // 2. TOTAL INCOME
    // ============================================

    let total_income: Decimal = sqlx::query_scalar(
        r#"
        SELECT COALESCE(SUM(amount), 0)
        FROM transactions
        WHERE user_id = $1
          AND type = 'INCOME'
        "#,
    )
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|error| {
        tracing::error!("Failed to calculate total income: {}", error);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // ============================================
    // 3. TOTAL EXPENSES
    // ============================================

    let total_expenses: Decimal = sqlx::query_scalar(
        r#"
        SELECT COALESCE(SUM(amount), 0)
        FROM transactions
        WHERE user_id = $1
          AND type = 'EXPENSE'
        "#,
    )
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    .map_err(|error| {
        tracing::error!("Failed to calculate total expenses: {}", error);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // ============================================
    // 4. NET SAVINGS
    // ============================================

    let net_savings = total_income - total_expenses;

    // ============================================
    // 5. USER BUDGET
    // ============================================

    let budget: Option<Decimal> = sqlx::query_scalar(
        r#"
        SELECT amount
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
    })?;

    // ============================================
    // 6. ACCOUNTS
    // ============================================

    let account_rows = sqlx::query(
        r#"
        SELECT
            id,
            name,
            type::text AS account_type,
            balance,
            is_default
        FROM accounts
        WHERE user_id = $1
        ORDER BY is_default DESC, created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await
    .map_err(|error| {
        tracing::error!("Failed to fetch dashboard accounts: {}", error);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let accounts = account_rows
        .into_iter()
        .map(|row| DashboardAccount {
            id: row.get("id"),
            name: row.get("name"),
            account_type: row.get("account_type"),
            balance: row.get("balance"),
            is_default: row.get("is_default"),
        })
        .collect();

    // ============================================
    // 7. RECENT TRANSACTIONS
    // ============================================

    let transaction_rows = sqlx::query(
        r#"
        SELECT
            id,
            type::text AS transaction_type,
            amount,
            description,
            date,
            category
        FROM transactions
        WHERE user_id = $1
        ORDER BY date DESC
        LIMIT 10
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await
    .map_err(|error| {
        tracing::error!(
            "Failed to fetch recent transactions: {}",
            error
        );
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let recent_transactions = transaction_rows
        .into_iter()
        .map(|row| DashboardTransaction {
            id: row.get("id"),
            transaction_type: row.get("transaction_type"),
            amount: row.get("amount"),
            description: row.get("description"),
            date: row.get("date"),
            category: row.get("category"),
        })
        .collect();

    // ============================================
    // 8. RESPONSE
    // ============================================

    Ok(Json(DashboardResponse {
        total_balance,
        total_income,
        total_expenses,
        net_savings,
        budget,
        accounts,
        recent_transactions,
    }))
}