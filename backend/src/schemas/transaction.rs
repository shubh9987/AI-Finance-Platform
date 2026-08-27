use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

// ============================================================
// CREATE TRANSACTION
// ============================================================

#[derive(Debug, Deserialize)]
pub struct CreateTransactionRequest {
    pub transaction_type: String,
    pub amount: Decimal,
    pub description: Option<String>,
    pub date: DateTime<Utc>,
    pub category: String,
    pub account_id: Uuid,

    pub is_recurring: Option<bool>,
    pub recurring_interval: Option<String>,
}

// ============================================================
// UPDATE TRANSACTION
// ============================================================

#[derive(Debug, Deserialize)]
pub struct UpdateTransactionRequest {
    pub transaction_type: Option<String>,
    pub amount: Option<Decimal>,
    pub description: Option<String>,
    pub date: Option<DateTime<Utc>>,
    pub category: Option<String>,
    pub account_id: Option<Uuid>,

    // Recurring fields
    pub is_recurring: Option<bool>,
    pub recurring_interval: Option<String>,
}

// ============================================================
// TRANSACTION RESPONSE
// ============================================================

#[derive(Debug, Serialize)]
pub struct TransactionResponse {
    pub id: Uuid,

    pub transaction_type: String,
    pub amount: Decimal,
    pub description: Option<String>,
    pub date: DateTime<Utc>,
    pub category: String,
    pub account_id: Uuid,

    // Recurring
    pub is_recurring: bool,
    pub recurring_interval: Option<String>,
    pub next_recurring_date: Option<DateTime<Utc>>,

    // Additional transaction information
    pub receipt_url: Option<String>,
    pub last_processed: Option<DateTime<Utc>>,
    pub status: String,
}