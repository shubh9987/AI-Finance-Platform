use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct CreateBudgetRequest {
    pub amount: Decimal,
}

#[derive(Debug, Deserialize)]
pub struct UpdateBudgetRequest {
    pub amount: Decimal,
}

#[derive(Debug, Serialize)]
pub struct BudgetResponse {
    pub id: Uuid,
    pub amount: Decimal,
    pub last_alert_sent: Option<chrono::DateTime<chrono::Utc>>,
}