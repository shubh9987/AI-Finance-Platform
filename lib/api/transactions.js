import { apiFetch } from "./client";

// ============================================================
// NORMALIZE TRANSACTION
// ============================================================

function normalizeTransaction(transaction) {
  if (!transaction) return null;

  return {
    ...transaction,

    id: transaction.id,

    // --------------------------------------------------------
    // Type
    // --------------------------------------------------------

    type:
      transaction.type ??
      transaction.transaction_type ??
      transaction.transactionType ??
      null,

    transaction_type:
      transaction.transaction_type ??
      transaction.type ??
      transaction.transactionType ??
      null,

    // --------------------------------------------------------
    // Amount
    // --------------------------------------------------------

    amount: Number(transaction.amount ?? 0),

    // --------------------------------------------------------
    // Basic fields
    // --------------------------------------------------------

    description: transaction.description ?? "",

    category: transaction.category ?? "",

    date: transaction.date ?? null,

    // --------------------------------------------------------
    // Account
    // --------------------------------------------------------

    accountId:
      transaction.accountId ??
      transaction.account_id ??
      null,

    account_id:
      transaction.account_id ??
      transaction.accountId ??
      null,

    // --------------------------------------------------------
    // Recurring
    // --------------------------------------------------------

    isRecurring:
      transaction.isRecurring ??
      transaction.is_recurring ??
      false,

    is_recurring:
      transaction.is_recurring ??
      transaction.isRecurring ??
      false,

    recurringInterval:
      transaction.recurringInterval ??
      transaction.recurring_interval ??
      null,

    recurring_interval:
      transaction.recurring_interval ??
      transaction.recurringInterval ??
      null,

    nextRecurringDate:
      transaction.nextRecurringDate ??
      transaction.next_recurring_date ??
      null,

    next_recurring_date:
      transaction.next_recurring_date ??
      transaction.nextRecurringDate ??
      null,

    // --------------------------------------------------------
    // Receipt
    // --------------------------------------------------------

    receiptUrl:
      transaction.receiptUrl ??
      transaction.receipt_url ??
      null,

    receipt_url:
      transaction.receipt_url ??
      transaction.receiptUrl ??
      null,

    // --------------------------------------------------------
    // Processing
    // --------------------------------------------------------

    lastProcessed:
      transaction.lastProcessed ??
      transaction.last_processed ??
      null,

    last_processed:
      transaction.last_processed ??
      transaction.lastProcessed ??
      null,

    // --------------------------------------------------------
    // Status
    // --------------------------------------------------------

    status:
      transaction.status ??
      "COMPLETED",
  };
}

// ============================================================
// GET ALL TRANSACTIONS
// ============================================================

export async function getTransactions() {
  const result = await apiFetch("/transactions");

  const transactions = result?.data ?? result;

  return Array.isArray(transactions)
    ? transactions.map(normalizeTransaction)
    : [];
}

// ============================================================
// GET ONE TRANSACTION
// ============================================================

export async function getTransaction(id) {
  const result = await apiFetch(
    `/transactions/${id}`
  );

  return normalizeTransaction(
    result?.data ?? result
  );
}

// ============================================================
// CREATE TRANSACTION
// ============================================================

export async function createTransaction(data) {
  const result = await apiFetch(
    "/transactions",
    {
      method: "POST",

      body: JSON.stringify({
        transaction_type:
          data.transaction_type ??
          data.type,

        amount: Number(data.amount),

        description:
          data.description ?? null,

        date: new Date(
          data.date
        ).toISOString(),

        category:
          data.category,

        account_id:
          data.account_id ??
          data.accountId,

        is_recurring:
          data.is_recurring ??
          data.isRecurring ??
          false,

        recurring_interval:
          data.recurring_interval ??
          data.recurringInterval ??
          null,
      }),
    }
  );

  return normalizeTransaction(
    result?.data ?? result
  );
}

// ============================================================
// UPDATE TRANSACTION
// ============================================================

export async function updateTransaction(
  id,
  data
) {
  // ----------------------------------------------------------
  // Build update payload
  // ----------------------------------------------------------
  //
  // IMPORTANT:
  // Do NOT automatically set is_recurring to false when the
  // property is missing.
  //
  // The form sends:
  //
  // isRecurring: true
  // recurringInterval: "WEEKLY"
  //
  // which becomes:
  //
  // is_recurring: true
  // recurring_interval: "WEEKLY"
  //
  // ----------------------------------------------------------

  const payload = {
    transaction_type:
      data.transaction_type ??
      data.type,

    amount:
      data.amount !== undefined
        ? Number(data.amount)
        : undefined,

    description:
      data.description ?? null,

    date:
      data.date
        ? new Date(
            data.date
          ).toISOString()
        : undefined,

    category:
      data.category,

    account_id:
      data.account_id ??
      data.accountId,

    // --------------------------------------------------------
    // RECURRING FIELDS
    // --------------------------------------------------------

    is_recurring:
      data.is_recurring ??
      data.isRecurring,

    recurring_interval:
      data.recurring_interval ??
      data.recurringInterval ??
      null,
  };

  const result = await apiFetch(
    `/transactions/${id}`,
    {
      method: "PUT",

      body: JSON.stringify(payload),
    }
  );

  return normalizeTransaction(
    result?.data ?? result
  );
}

// ============================================================
// DELETE TRANSACTION
// ============================================================

export async function deleteTransaction(id) {
  return apiFetch(
    `/transactions/${id}`,
    {
      method: "DELETE",
    }
  );
}

// ============================================================
// BULK DELETE
// ============================================================

export async function bulkDeleteTransactions(
  transactionIds
) {
  if (!Array.isArray(transactionIds)) {
    throw new Error(
      "transactionIds must be an array"
    );
  }

  await Promise.all(
    transactionIds.map((id) =>
      deleteTransaction(id)
    )
  );

  return {
    success: true,
  };
}