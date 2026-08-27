use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension,
    Json,
};
use rust_decimal::Decimal;
use uuid::Uuid;

use crate::{
    models::transaction::Transaction,
    schemas::transaction::{
        CreateTransactionRequest,
        TransactionResponse,
        UpdateTransactionRequest,
    },
    state::AppState,
};

// ============================================================
// HELPERS
// ============================================================

/// Returns the balance effect of a transaction.
///
/// INCOME  -> +amount
/// EXPENSE -> -amount
fn balance_change(transaction_type: &str, amount: Decimal) -> Decimal {
    match transaction_type {
        "INCOME" => amount,
        "EXPENSE" => -amount,
        _ => Decimal::ZERO,
    }
}

/// Calculate the next recurring date.
fn calculate_next_recurring_date(
    is_recurring: bool,
    interval: Option<&str>,
    date: chrono::DateTime<chrono::Utc>,
) -> Option<chrono::DateTime<chrono::Utc>> {
    if !is_recurring {
        return None;
    }

    match interval {
        Some("DAILY") => Some(date + chrono::Duration::days(1)),

        Some("WEEKLY") => Some(date + chrono::Duration::weeks(1)),

        Some("MONTHLY") => Some(date + chrono::Duration::days(30)),

        Some("YEARLY") => Some(date + chrono::Duration::days(365)),

        _ => None,
    }
}

/// Convert database Transaction into API response.
fn transaction_response(transaction: Transaction) -> TransactionResponse {
    TransactionResponse {
        id: transaction.id,

        transaction_type: transaction.transaction_type,

        amount: transaction.amount,

        description: transaction.description,

        date: transaction.date,

        category: transaction.category,

        account_id: transaction.account_id,

        is_recurring: transaction.is_recurring,

        recurring_interval: transaction.recurring_interval,

        next_recurring_date: transaction.next_recurring_date,

        receipt_url: transaction.receipt_url,

        last_processed: transaction.last_processed,

        status: transaction.status,
    }
}

// ============================================================
// CREATE TRANSACTION
// ============================================================

pub async fn create_transaction(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
    Json(payload): Json<CreateTransactionRequest>,
) -> Result<Json<TransactionResponse>, StatusCode> {
    // --------------------------------------------------------
    // Recurring values
    // --------------------------------------------------------

    let is_recurring = payload.is_recurring.unwrap_or(false);

    if is_recurring && payload.recurring_interval.is_none() {
        tracing::warn!(
            "Recurring transaction created without recurring interval"
        );

        return Err(StatusCode::BAD_REQUEST);
    }

    let next_recurring_date = calculate_next_recurring_date(
        is_recurring,
        payload.recurring_interval.as_deref(),
        payload.date,
    );

    // --------------------------------------------------------
    // Start DB transaction
    // --------------------------------------------------------

    let mut db_transaction = state
        .db
        .begin()
        .await
        .map_err(|error| {
            tracing::error!(
                "Failed to start DB transaction: {}",
                error
            );

            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // --------------------------------------------------------
    // Verify account belongs to current user
    // --------------------------------------------------------

    let account_exists: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1
            FROM accounts
            WHERE id = $1
              AND user_id = $2
        )
        "#,
    )
    .bind(payload.account_id)
    .bind(user_id)
    .fetch_one(&mut *db_transaction)
    .await
    .map_err(|error| {
        tracing::error!(
            "Failed to verify account: {}",
            error
        );

        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if !account_exists {
        return Err(StatusCode::NOT_FOUND);
    }

    // --------------------------------------------------------
    // Calculate balance change
    // --------------------------------------------------------

    let change = balance_change(
        &payload.transaction_type,
        payload.amount,
    );

    // --------------------------------------------------------
    // Create transaction
    // --------------------------------------------------------

    let transaction = sqlx::query_as::<_, Transaction>(
        r#"
        INSERT INTO transactions (
            type,
            amount,
            description,
            date,
            category,
            account_id,
            is_recurring,
            recurring_interval,
            next_recurring_date,
            user_id
        )
        VALUES (
            $1::transaction_type,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8::recurring_interval,
            $9,
            $10
        )
        RETURNING
            id,
            type::text AS transaction_type,
            amount,
            description,
            date,
            category,
            receipt_url,
            is_recurring,
            recurring_interval::text AS recurring_interval,
            next_recurring_date,
            last_processed,
            status::text AS status,
            user_id,
            account_id,
            created_at,
            updated_at
        "#,
    )
    .bind(&payload.transaction_type)
    .bind(payload.amount)
    .bind(&payload.description)
    .bind(payload.date)
    .bind(&payload.category)
    .bind(payload.account_id)
    .bind(is_recurring)
    .bind(&payload.recurring_interval)
    .bind(next_recurring_date)
    .bind(user_id)
    .fetch_one(&mut *db_transaction)
    .await
    .map_err(|error| {
        tracing::error!(
            "Failed to create transaction: {}",
            error
        );

        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // --------------------------------------------------------
    // Update account balance
    // --------------------------------------------------------

    sqlx::query(
        r#"
        UPDATE accounts
        SET
            balance = balance + $1,
            updated_at = NOW()
        WHERE id = $2
          AND user_id = $3
        "#,
    )
    .bind(change)
    .bind(payload.account_id)
    .bind(user_id)
    .execute(&mut *db_transaction)
    .await
    .map_err(|error| {
        tracing::error!(
            "Failed to update account balance: {}",
            error
        );

        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // --------------------------------------------------------
    // Commit
    // --------------------------------------------------------

    db_transaction
        .commit()
        .await
        .map_err(|error| {
            tracing::error!(
                "Failed to commit transaction: {}",
                error
            );

            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(transaction_response(transaction)))
}

// ============================================================
// GET ALL TRANSACTIONS
// ============================================================

pub async fn get_transactions(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
) -> Result<Json<Vec<TransactionResponse>>, StatusCode> {
    let transactions = sqlx::query_as::<_, Transaction>(
        r#"
        SELECT
            id,
            type::text AS transaction_type,
            amount,
            description,
            date,
            category,
            receipt_url,
            is_recurring,
            recurring_interval::text AS recurring_interval,
            next_recurring_date,
            last_processed,
            status::text AS status,
            user_id,
            account_id,
            created_at,
            updated_at
        FROM transactions
        WHERE user_id = $1
        ORDER BY date DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await
    .map_err(|error| {
        tracing::error!(
            "Failed to fetch transactions: {}",
            error
        );

        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let response = transactions
        .into_iter()
        .map(transaction_response)
        .collect();

    Ok(Json(response))
}

// ============================================================
// GET SINGLE TRANSACTION
// ============================================================

pub async fn get_transaction(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
    Path(id): Path<Uuid>,
) -> Result<Json<TransactionResponse>, StatusCode> {
    let transaction = sqlx::query_as::<_, Transaction>(
        r#"
        SELECT
            id,
            type::text AS transaction_type,
            amount,
            description,
            date,
            category,
            receipt_url,
            is_recurring,
            recurring_interval::text AS recurring_interval,
            next_recurring_date,
            last_processed,
            status::text AS status,
            user_id,
            account_id,
            created_at,
            updated_at
        FROM transactions
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
            "Failed to fetch transaction: {}",
            error
        );

        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(transaction_response(transaction)))
}

// ============================================================
// UPDATE TRANSACTION
// ============================================================

pub async fn update_transaction(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateTransactionRequest>,
) -> Result<Json<TransactionResponse>, StatusCode> {
    // --------------------------------------------------------
    // Start DB transaction
    // --------------------------------------------------------

    let mut db_transaction = state
        .db
        .begin()
        .await
        .map_err(|error| {
            tracing::error!(
                "Failed to start DB transaction: {}",
                error
            );

            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // --------------------------------------------------------
    // Get existing transaction
    // --------------------------------------------------------

    let old_transaction = sqlx::query_as::<_, Transaction>(
        r#"
        SELECT
            id,
            type::text AS transaction_type,
            amount,
            description,
            date,
            category,
            receipt_url,
            is_recurring,
            recurring_interval::text AS recurring_interval,
            next_recurring_date,
            last_processed,
            status::text AS status,
            user_id,
            account_id,
            created_at,
            updated_at
        FROM transactions
        WHERE id = $1
          AND user_id = $2
        FOR UPDATE
        "#,
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&mut *db_transaction)
    .await
    .map_err(|error| {
        tracing::error!(
            "Failed to fetch old transaction: {}",
            error
        );

        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    // --------------------------------------------------------
    // Determine new values
    // --------------------------------------------------------

    let new_type = payload
        .transaction_type
        .clone()
        .unwrap_or_else(|| {
            old_transaction.transaction_type.clone()
        });

    let new_amount = payload
        .amount
        .unwrap_or(old_transaction.amount);

    let new_account_id = payload
        .account_id
        .unwrap_or(old_transaction.account_id);

    let new_date = payload
        .date
        .unwrap_or(old_transaction.date);

    // --------------------------------------------------------
    // Determine recurring values
    // --------------------------------------------------------

    let new_is_recurring = payload
        .is_recurring
        .unwrap_or(old_transaction.is_recurring);

    let new_recurring_interval = if payload.is_recurring == Some(false) {
        None
    } else if payload.recurring_interval.is_some() {
        payload.recurring_interval.clone()
    } else {
        old_transaction.recurring_interval.clone()
    };

    // --------------------------------------------------------
    // Validate recurring transaction
    // --------------------------------------------------------

    if new_is_recurring && new_recurring_interval.is_none() {
        tracing::warn!(
            "Recurring transaction requires recurring interval"
        );

        return Err(StatusCode::BAD_REQUEST);
    }

    // --------------------------------------------------------
    // Calculate next recurring date
    // --------------------------------------------------------

    let new_next_recurring_date =
        calculate_next_recurring_date(
            new_is_recurring,
            new_recurring_interval.as_deref(),
            new_date,
        );

    // --------------------------------------------------------
    // Verify account belongs to user
    // --------------------------------------------------------

    let account_exists: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
            SELECT 1
            FROM accounts
            WHERE id = $1
              AND user_id = $2
        )
        "#,
    )
    .bind(new_account_id)
    .bind(user_id)
    .fetch_one(&mut *db_transaction)
    .await
    .map_err(|error| {
        tracing::error!(
            "Failed to verify account: {}",
            error
        );

        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if !account_exists {
        return Err(StatusCode::NOT_FOUND);
    }

    // --------------------------------------------------------
    // Reverse OLD account balance
    // --------------------------------------------------------

    let old_change = balance_change(
        &old_transaction.transaction_type,
        old_transaction.amount,
    );

    sqlx::query(
        r#"
        UPDATE accounts
        SET
            balance = balance - $1,
            updated_at = NOW()
        WHERE id = $2
          AND user_id = $3
        "#,
    )
    .bind(old_change)
    .bind(old_transaction.account_id)
    .bind(user_id)
    .execute(&mut *db_transaction)
    .await
    .map_err(|error| {
        tracing::error!(
            "Failed to reverse old account balance: {}",
            error
        );

        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // --------------------------------------------------------
    // Update transaction
    // --------------------------------------------------------

    let transaction = sqlx::query_as::<_, Transaction>(
        r#"
        UPDATE transactions
        SET
            type = $1::transaction_type,
            amount = $2,
            description = COALESCE($3, description),
            date = $4,
            category = COALESCE($5, category),
            account_id = $6,
            is_recurring = $7,
            recurring_interval = $8::recurring_interval,
            next_recurring_date = $9,
            updated_at = NOW()
        WHERE id = $10
          AND user_id = $11
        RETURNING
            id,
            type::text AS transaction_type,
            amount,
            description,
            date,
            category,
            receipt_url,
            is_recurring,
            recurring_interval::text AS recurring_interval,
            next_recurring_date,
            last_processed,
            status::text AS status,
            user_id,
            account_id,
            created_at,
            updated_at
        "#,
    )
    .bind(&new_type)
    .bind(new_amount)
    .bind(&payload.description)
    .bind(new_date)
    .bind(&payload.category)
    .bind(new_account_id)
    .bind(new_is_recurring)
    .bind(&new_recurring_interval)
    .bind(new_next_recurring_date)
    .bind(id)
    .bind(user_id)
    .fetch_one(&mut *db_transaction)
    .await
    .map_err(|error| {
        tracing::error!(
            "Failed to update transaction: {}",
            error
        );

        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // --------------------------------------------------------
    // Apply NEW account balance
    // --------------------------------------------------------

    let new_change = balance_change(
        &new_type,
        new_amount,
    );

    sqlx::query(
        r#"
        UPDATE accounts
        SET
            balance = balance + $1,
            updated_at = NOW()
        WHERE id = $2
          AND user_id = $3
        "#,
    )
    .bind(new_change)
    .bind(new_account_id)
    .bind(user_id)
    .execute(&mut *db_transaction)
    .await
    .map_err(|error| {
        tracing::error!(
            "Failed to apply new account balance: {}",
            error
        );

        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // --------------------------------------------------------
    // Commit
    // --------------------------------------------------------

    db_transaction
        .commit()
        .await
        .map_err(|error| {
            tracing::error!(
                "Failed to commit transaction: {}",
                error
            );

            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(transaction_response(transaction)))
}

// ============================================================
// DELETE TRANSACTION
// ============================================================

pub async fn delete_transaction(
    State(state): State<AppState>,
    Extension(user_id): Extension<Uuid>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let mut db_transaction = state
        .db
        .begin()
        .await
        .map_err(|error| {
            tracing::error!(
                "Failed to start DB transaction: {}",
                error
            );

            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    // --------------------------------------------------------
    // Get transaction
    // --------------------------------------------------------

    let transaction = sqlx::query_as::<_, Transaction>(
        r#"
        SELECT
            id,
            type::text AS transaction_type,
            amount,
            description,
            date,
            category,
            receipt_url,
            is_recurring,
            recurring_interval::text AS recurring_interval,
            next_recurring_date,
            last_processed,
            status::text AS status,
            user_id,
            account_id,
            created_at,
            updated_at
        FROM transactions
        WHERE id = $1
          AND user_id = $2
        FOR UPDATE
        "#,
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&mut *db_transaction)
    .await
    .map_err(|error| {
        tracing::error!(
            "Failed to fetch transaction for deletion: {}",
            error
        );

        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    // --------------------------------------------------------
    // Reverse account balance
    // --------------------------------------------------------

    let change = balance_change(
        &transaction.transaction_type,
        transaction.amount,
    );

    sqlx::query(
        r#"
        UPDATE accounts
        SET
            balance = balance - $1,
            updated_at = NOW()
        WHERE id = $2
          AND user_id = $3
        "#,
    )
    .bind(change)
    .bind(transaction.account_id)
    .bind(user_id)
    .execute(&mut *db_transaction)
    .await
    .map_err(|error| {
        tracing::error!(
            "Failed to reverse account balance: {}",
            error
        );

        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // --------------------------------------------------------
    // Delete transaction
    // --------------------------------------------------------

    sqlx::query(
        r#"
        DELETE FROM transactions
        WHERE id = $1
          AND user_id = $2
        "#,
    )
    .bind(id)
    .bind(user_id)
    .execute(&mut *db_transaction)
    .await
    .map_err(|error| {
        tracing::error!(
            "Failed to delete transaction: {}",
            error
        );

        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    // --------------------------------------------------------
    // Commit
    // --------------------------------------------------------

    db_transaction
        .commit()
        .await
        .map_err(|error| {
            tracing::error!(
                "Failed to commit transaction deletion: {}",
                error
            );

            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(StatusCode::NO_CONTENT)
}