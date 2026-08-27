"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "./client";

function normalizeBudget(budget) {
  if (!budget) return null;

  return {
    ...budget,
    id: budget.id,
    amount: Number(budget.amount ?? 0),

    last_alert_sent:
      budget.last_alert_sent ??
      budget.lastAlertSent ??
      null,

    lastAlertSent:
      budget.lastAlertSent ??
      budget.last_alert_sent ??
      null,
  };
}

export async function getCurrentBudget() {
  const budget = await apiFetch("/budget");

  if (!budget) {
    return {
      budget: null,
      currentExpenses: 0,
    };
  }

  return {
    budget: normalizeBudget(budget?.data || budget),
    currentExpenses: 0,
  };
}

export async function updateBudget(amount) {
  try {
    const numericAmount = Number(amount);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      throw new Error("Invalid budget amount");
    }

    let budget;

    try {
      budget = await apiFetch("/budget", {
        method: "PUT",
        body: JSON.stringify({
          amount: numericAmount,
        }),
      });
    } catch (error) {
      if (error?.message === "Resource not found") {
        budget = await apiFetch("/budget", {
          method: "POST",
          body: JSON.stringify({
            amount: numericAmount,
          }),
        });
      } else {
        throw error;
      }
    }

    revalidatePath("/dashboard");

    return {
      success: true,
      data: normalizeBudget(budget?.data || budget),
    };
  } catch (error) {
    console.error("Error updating budget:", error);

    return {
      success: false,
      error:
        error?.message ||
        "Failed to update budget",
    };
  }
}

export async function deleteBudget() {
  try {
    await apiFetch("/budget", {
      method: "DELETE",
    });

    revalidatePath("/dashboard");

    return {
      success: true,
    };
  } catch (error) {
    console.error("Error deleting budget:", error);

    return {
      success: false,
      error:
        error?.message ||
        "Failed to delete budget",
    };
  }
}