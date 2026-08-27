use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Serialize)]
pub struct DashboardAccount {
    pub id: Uuid,
    pub name: String,
    pub account_type: String,
    pub balance: Decimal,
    pub is_default: bool,
}

#[derive(Debug, Serialize)]
pub struct DashboardTransaction {
    pub id: Uuid,
    pub transaction_type: String,
    pub amount: Decimal,
    pub description: Option<String>,
    pub date: DateTime<Utc>,
    pub category: String,
}

#[derive(Debug, Serialize)]
pub struct DashboardResponse {
    pub total_balance: Decimal,
    pub total_income: Decimal,
    pub total_expenses: Decimal,
    pub net_savings: Decimal,
    pub budget: Option<Decimal>,
    pub accounts: Vec<DashboardAccount>,
    pub recent_transactions: Vec<DashboardTransaction>,
}