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

export async function getAccounts() {
  const result = await apiFetch("/accounts");

  const accounts = result?.data || result;

  return Array.isArray(accounts)
    ? accounts.map(normalizeAccount)
    : [];
}

export async function getAccount(accountId) {
  const result = await apiFetch(`/accounts/${accountId}`);

  return normalizeAccount(result?.data || result);
}

export async function createAccount(data) {
  const result = await apiFetch("/accounts", {
    method: "POST",
    body: JSON.stringify({
      name: data.name,
      account_type: data.type,
      balance: Number(data.balance ?? 0),
      is_default: Boolean(data.isDefault),
    }),
  });

  return {
    success: true,
    data: normalizeAccount(result?.data || result),
  };
}

export async function updateAccount(accountId, data) {
  const result = await apiFetch(`/accounts/${accountId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });

  return normalizeAccount(result?.data || result);
}

export async function updateDefaultAccount(accountId) {
  const result = await apiFetch(`/accounts/${accountId}`, {
    method: "PUT",
    body: JSON.stringify({
      is_default: true,
    }),
  });

  return {
    success: true,
    data: normalizeAccount(result?.data || result),
  };
}

export async function deleteAccount(accountId) {
  return apiFetch(`/accounts/${accountId}`, {
    method: "DELETE",
  });
}