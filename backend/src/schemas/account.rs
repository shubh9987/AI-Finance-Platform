use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct CreateAccountRequest {
    pub name: String,
    pub account_type: String,
    pub balance: Option<Decimal>,
    pub is_default: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateAccountRequest {
    pub name: Option<String>,
    pub account_type: Option<String>,
    pub balance: Option<Decimal>,
    pub is_default: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct AccountResponse {
    pub id: uuid::Uuid,
    pub name: String,
    pub account_type: String,
    pub balance: Decimal,
    pub is_default: bool,
}