use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Transaction {
    pub id: Uuid,
    pub transaction_type: String,
    pub amount: Decimal,
    pub description: Option<String>,
    pub date: DateTime<Utc>,
    pub category: String,
    pub receipt_url: Option<String>,
    pub is_recurring: bool,
    pub recurring_interval: Option<String>,
    pub next_recurring_date: Option<DateTime<Utc>>,
    pub last_processed: Option<DateTime<Utc>>,
    pub status: String,
    pub user_id: Uuid,
    pub account_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}