export const dynamic = "force-dynamic";

import { AccountCard } from "./_components/account-card";
import { CreateAccountDrawer } from "@/components/create-account-drawer";
import { BudgetProgress } from "./_components/budget-progress";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { DashboardOverview } from "./_components/transaction-overview";

import { cookies } from "next/headers";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export async function getDashboard() {
  const cookieStore = await cookies();

  const authToken = cookieStore.get("auth_token")?.value;

  if (!authToken) {
    throw new Error("Unauthorized. Please log in again.");
  }

  const response = await fetch(`${API_URL}/dashboard`, {
    method: "GET",
    headers: {
      Cookie: `auth_token=${authToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Unauthorized. Please log in again.");
    }

    const errorText = await response.text();

    throw new Error(
      `Dashboard API error (${response.status}): ${errorText}`
    );
  }

  return response.json();
}


export default async function DashboardPage() {
  let dashboard;

  try {
    dashboard = await getDashboard();
  } catch (error) {
    console.error("Dashboard API error:", error);

    return (
      <div className="space-y-8">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <h2 className="text-lg font-semibold">
                Unable to load dashboard
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                {error instanceof Error
                  ? error.message
                  : "Something went wrong while loading your dashboard."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ----------------------------------------------------------
  // Data returned by Rust
  // ----------------------------------------------------------

  const accounts = dashboard.accounts || [];
  const transactions = dashboard.recent_transactions || [];

  // ----------------------------------------------------------
  // Convert Rust snake_case fields to the camelCase shape
  // expected by Antonio's existing React components.
  // ----------------------------------------------------------

  const normalizedAccounts = accounts.map((account) => ({
    ...account,
    accountType: account.account_type,
    isDefault: account.is_default,
  }));

  const normalizedTransactions = transactions.map((transaction) => ({
    ...transaction,
    transactionType: transaction.transaction_type,
  }));

  // ----------------------------------------------------------
  // Default account
  // ----------------------------------------------------------

  const defaultAccount = normalizedAccounts.find(
    (account) => account.isDefault
  );

  // ----------------------------------------------------------
  // Budget
  // ----------------------------------------------------------

  const budgetData = dashboard.budget
    ? {
        budget: {
          amount: Number(dashboard.budget),
        },
        currentExpenses: Number(dashboard.total_expenses || 0),
      }
    : null;

  return (
    <div className="space-y-8">
      {/* Budget Progress */}
      <BudgetProgress
        initialBudget={budgetData?.budget}
        currentExpenses={budgetData?.currentExpenses || 0}
      />

      {/* Dashboard Overview */}
      <DashboardOverview
        accounts={normalizedAccounts}
        transactions={normalizedTransactions}
      />

      {/* Accounts Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <CreateAccountDrawer>
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-dashed">
            <CardContent className="flex flex-col items-center justify-center text-muted-foreground h-full pt-5">
              <Plus className="h-10 w-10 mb-2" />

              <p className="text-sm font-medium">
                Add New Account
              </p>
            </CardContent>
          </Card>
        </CreateAccountDrawer>

        {normalizedAccounts.length > 0 &&
          normalizedAccounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
            />
          ))}
      </div>
    </div>
  );
}
