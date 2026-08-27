"use server";

import { apiFetch } from "./client";

function normalizeAccount(account) {
  if (!account) return null;

  return {
    ...account,

    type:
      account.type ??
      account.account_type ??
      account.accountType ??
      null,

    account_type:
      account.account_type ??
      account.type ??
      account.accountType ??
      null,

    isDefault:
      account.isDefault ??
      account.is_default ??
      false,

    is_default:
      account.is_default ??
      account.isDefault ??
      false,

    balance: Number(account.balance ?? 0),
  };
}

function normalizeTransaction(transaction) {
  if (!transaction) return null;

  return {
    ...transaction,

    type:
      transaction.type ??
      transaction.transaction_type ??
      transaction.transactionType ??
      null,

    accountId:
      transaction.accountId ??
      transaction.account_id ??
      null,

    amount: Number(transaction.amount ?? 0),
  };
}

export async function getDashboard() {
  const dashboard = await apiFetch("/dashboard");

  return {
    totalBalance: Number(
      dashboard?.total_balance ?? 0
    ),

    totalIncome: Number(
      dashboard?.total_income ?? 0
    ),

    totalExpenses: Number(
      dashboard?.total_expenses ?? 0
    ),

    netSavings: Number(
      dashboard?.net_savings ?? 0
    ),

    budget: dashboard?.budget ?? null,

    accounts: Array.isArray(dashboard?.accounts)
      ? dashboard.accounts.map(normalizeAccount)
      : [],

    transactions: Array.isArray(
      dashboard?.recent_transactions
    )
      ? dashboard.recent_transactions.map(
          normalizeTransaction
        )
      : [],
  };
}

export async function getUserAccounts() {
  const dashboard = await getDashboard();

  return dashboard.accounts;
}

export async function getDashboardData() {
  const dashboard = await getDashboard();

  return dashboard.transactions;
}