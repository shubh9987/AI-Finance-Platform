"use client";

import {
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useEffect } from "react";
import useFetch from "@/hooks/use-fetch";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { updateAccount } from "@/lib/api/accounts";
import { toast } from "sonner";

export function AccountCard({ account }) {
  const {
    name,
    balance,
    id,
    isDefault,
  } = account;

  // Support both frontend and Rust backend field names.
  const accountType =
    account.type ??
    account.account_type ??
    account.accountType ??
    "CURRENT";

  const {
    loading: updateDefaultLoading,
    fn: updateDefaultFn,
    data: updatedAccount,
    error,
  } = useFetch((accountId) =>
    updateAccount(accountId, {
      is_default: true,
    })
  );

  const handleDefaultChange = async (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (isDefault) {
      toast.warning("You need at least 1 default account");
      return;
    }

    await updateDefaultFn(id);
  };

  useEffect(() => {
    if (updatedAccount) {
      toast.success("Default account updated successfully");
    }
  }, [updatedAccount]);

  useEffect(() => {
    if (error) {
      toast.error(
        error.message || "Failed to update default account"
      );
    }
  }, [error]);

  return (
    <Card className="hover:shadow-md transition-shadow group relative">
      <Link href={`/account/${id}`}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium capitalize">
            {name}
          </CardTitle>

          <Switch
            checked={Boolean(isDefault)}
            onClick={handleDefaultChange}
            disabled={updateDefaultLoading}
          />
        </CardHeader>

        <CardContent>
          <div className="text-2xl font-bold">
            ${Number(balance ?? 0).toFixed(2)}
          </div>

          <p className="text-xs text-muted-foreground">
            {accountType.charAt(0) +
              accountType.slice(1).toLowerCase()}{" "}
            Account
          </p>
        </CardContent>

        <CardFooter className="flex justify-between text-sm text-muted-foreground">
          <div className="flex items-center">
            <ArrowUpRight className="mr-1 h-4 w-4 text-green-500" />
            Income
          </div>

          <div className="flex items-center">
            <ArrowDownRight className="mr-1 h-4 w-4 text-red-500" />
            Expense
          </div>
        </CardFooter>
      </Link>
    </Card>
  );
}