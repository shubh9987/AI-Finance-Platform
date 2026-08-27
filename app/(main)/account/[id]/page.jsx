import React, { Suspense } from "react";
import { getAccount } from "@/lib/api/accounts";
import { getTransactions } from "@/lib/api/transactions";
import { BarLoader } from "react-spinners";
import { TransactionTable } from "../_components/transaction-table";
import { notFound } from "next/navigation";
import { AccountChart } from "../_components/account-chart";

export default async function AccountPage({ params }) {
  const { id } = await params;

  const account = await getAccount(id);
  const allTransactions = await getTransactions();

  if (!account) {
    notFound();
  }

  const transactions = Array.isArray(allTransactions)
    ? allTransactions.filter(
        (transaction) =>
          transaction.account_id === id ||
          transaction.accountId === id
      )
    : [];

  const accountType =
    account.type ??
    account.account_type ??
    account.accountType ??
    "CURRENT";

  return (
    <div className="space-y-8 px-5">
      <div className="flex gap-4 items-end justify-between">
        <div>
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight gradient-title capitalize">
            {account.name}
          </h1>

          <p className="text-muted-foreground">
            {accountType.charAt(0) +
              accountType.slice(1).toLowerCase()}{" "}
            Account
          </p>
        </div>

        <div className="text-right pb-2">
          <div className="text-xl sm:text-2xl font-bold">
            ${Number(account.balance ?? 0).toFixed(2)}
          </div>

          <p className="text-sm text-muted-foreground">
            {transactions.length} Transactions
          </p>
        </div>
      </div>

      <Suspense
        fallback={
          <BarLoader
            className="mt-4"
            width="100%"
            color="#9333ea"
          />
        }
      >
        <AccountChart transactions={transactions} />
      </Suspense>

      <Suspense
        fallback={
          <BarLoader
            className="mt-4"
            width="100%"
            color="#9333ea"
          />
        }
      >
        <TransactionTable transactions={transactions} />
      </Suspense>
    </div>
  );
}