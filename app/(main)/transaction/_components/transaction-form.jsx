"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import useFetch from "@/hooks/use-fetch";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

import {
Select,
SelectContent,
SelectItem,
SelectTrigger,
SelectValue,
} from "@/components/ui/select";

import {
Popover,
PopoverContent,
PopoverTrigger,
} from "@/components/ui/popover";

import { Calendar } from "@/components/ui/calendar";
import { CreateAccountDrawer } from "@/components/create-account-drawer";
import { cn } from "@/lib/utils";

import {
createTransaction,
updateTransaction,
} from "@/lib/api/transactions";

import { transactionSchema } from "@/app/lib/schema";
import { ReceiptScanner } from "./recipt-scanner";

export function AddTransactionForm({
accounts = [],
categories = [],
editMode = false,
initialData = null,
}) {
const router = useRouter();
const searchParams = useSearchParams();

const editId = searchParams.get("edit");

// ============================================================
// FORM
// ============================================================

const {
register,
handleSubmit,
formState: { errors },
watch,
setValue,
getValues,
} = useForm({
resolver: zodResolver(transactionSchema),


defaultValues:
  editMode && initialData
    ? {
        type:
          initialData.type ??
          initialData.transaction_type ??
          "EXPENSE",

        amount:
          initialData.amount?.toString() ?? "",

        description:
          initialData.description ?? "",

        accountId:
          initialData.accountId ??
          initialData.account_id ??
          "",

        category:
          initialData.category ?? "",

        date: initialData.date
          ? new Date(initialData.date)
          : new Date(),

        isRecurring:
          initialData.isRecurring ??
          initialData.is_recurring ??
          false,

        recurringInterval:
          initialData.recurringInterval ??
          initialData.recurring_interval ??
          null,
      }
    : {
        type: "EXPENSE",

        amount: "",

        description: "",

        accountId:
          accounts.find(
            (account) =>
              account.isDefault ??
              account.is_default
          )?.id ?? "",

        category: "",

        date: new Date(),

        isRecurring: false,

        recurringInterval: null,
      },


});

// ============================================================
// API
// ============================================================

const {
loading: transactionLoading,
fn: transactionFn,
data: transactionResult,
} = useFetch(
editMode
? updateTransaction
: createTransaction
);

// ============================================================
// WATCH VALUES
// ============================================================

const type = watch("type");
const accountId = watch("accountId");
const category = watch("category");
const isRecurring = watch("isRecurring");
const recurringInterval = watch(
"recurringInterval"
);
const date = watch("date");

// ============================================================
// CATEGORIES
// ============================================================

const filteredCategories =
categories.filter(
(categoryItem) =>
categoryItem.type === type
);

// ============================================================
// SUBMIT
// ============================================================

const onSubmit = (data) => {
console.log(
"TRANSACTION FORM SUBMITTED:",
data
);


const formData = {
  ...data,

  amount: parseFloat(data.amount),

  isRecurring:
    data.isRecurring ?? false,

  // IMPORTANT:
  // When recurring is OFF, send null.
  // When recurring is ON, send selected interval.
  recurringInterval:
    data.isRecurring
      ? data.recurringInterval
      : null,
};

console.log(
  "TRANSACTION FORM DATA:",
  formData
);

if (editMode) {
  if (!editId) {
    toast.error(
      "Transaction ID is missing"
    );
    return;
  }

  transactionFn(
    editId,
    formData
  );
} else {
  transactionFn(formData);
}


};

// ============================================================
// VALIDATION ERROR
// ============================================================

const onInvalid = (validationErrors) => {
console.error(
"TRANSACTION FORM VALIDATION ERRORS:",
JSON.stringify(
validationErrors,
null,
2
)
);


console.error(
  "TRANSACTION FORM VALUES:",
  getValues()
);

const firstError =
  Object.values(validationErrors)[0];

if (firstError?.message) {
  toast.error(
    firstError.message
  );
} else {
  toast.error(
    "Please check the required fields"
  );
}


};

// ============================================================
// REDIRECT AFTER CREATE / UPDATE
// ============================================================

useEffect(() => {
if (
!transactionResult ||
transactionLoading
) {
return;
}


console.log(
  "TRANSACTION API RESULT:",
  transactionResult
);

toast.success(
  editMode
    ? "Transaction updated successfully"
    : "Transaction created successfully"
);

const returnedAccountId =
  transactionResult.accountId ??
  transactionResult.account_id;

if (returnedAccountId) {
  router.push(
    `/account/${returnedAccountId}`
  );

  router.refresh();
} else {
  console.error(
    "Transaction response does not contain account ID:",
    transactionResult
  );

  router.push("/dashboard");
  router.refresh();
}

}, [
transactionResult,
transactionLoading,
editMode,
router,
]);

// ============================================================
// RECEIPT SCANNER
// ============================================================

const handleScanComplete = (
scannedData
) => {
if (!scannedData) {
return;
}

if (
  scannedData.amount !== undefined
) {
  setValue(
    "amount",
    scannedData.amount.toString(),
    {
      shouldValidate: true,
      shouldDirty: true,
    }
  );
}

if (scannedData.date) {
  setValue(
    "date",
    new Date(scannedData.date),
    {
      shouldValidate: true,
      shouldDirty: true,
    }
  );
}

if (scannedData.description) {
  setValue(
    "description",
    scannedData.description,
    {
      shouldValidate: true,
      shouldDirty: true,
    }
  );
}

if (scannedData.category) {
  setValue(
    "category",
    scannedData.category,
    {
      shouldValidate: true,
      shouldDirty: true,
    }
  );
}

toast.success(
  "Receipt scanned successfully"
);


};

// ============================================================
// UI
// ============================================================

return (
<form
onSubmit={handleSubmit(
onSubmit,
onInvalid
)}
className="w-full min-w-0 space-y-6"
>
{/* ======================================================
RECEIPT SCANNER
======================================================= */}

  {!editMode && (
    <ReceiptScanner
      onScanComplete={
        handleScanComplete
      }
    />
  )}

  {/* ======================================================
      TYPE
  ======================================================= */}

  <div className="space-y-2">
    <label className="text-sm font-medium">
      Type
    </label>

    <Select
      value={type || "EXPENSE"}
      onValueChange={(value) =>
        setValue(
          "type",
          value,
          {
            shouldValidate: true,
            shouldDirty: true,
          }
        )
      }
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select type" />
      </SelectTrigger>

      <SelectContent>
        <SelectItem value="EXPENSE">
          Expense
        </SelectItem>

        <SelectItem value="INCOME">
          Income
        </SelectItem>
      </SelectContent>
    </Select>

    {errors.type && (
      <p className="text-sm text-red-500">
        {errors.type.message}
      </p>
    )}
  </div>

  {/* ======================================================
      AMOUNT + ACCOUNT
  ======================================================= */}

  <div className="grid min-w-0 gap-6 md:grid-cols-2">
    {/* AMOUNT */}

    <div className="min-w-0 space-y-2">
      <label className="text-sm font-medium">
        Amount
      </label>

      <Input
        type="number"
        step="0.01"
        placeholder="0.00"
        className="w-full"
        {...register("amount")}
      />

      {errors.amount && (
        <p className="text-sm text-red-500">
          {errors.amount.message}
        </p>
      )}
    </div>

    {/* ACCOUNT */}

    <div className="min-w-0 space-y-2">
      <label className="text-sm font-medium">
        Account
      </label>

      <Select
        value={accountId || ""}
        onValueChange={(value) =>
          setValue(
            "accountId",
            value,
            {
              shouldValidate: true,
              shouldDirty: true,
            }
          )
        }
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select account" />
        </SelectTrigger>

        <SelectContent>
          {accounts.map(
            (account) => (
              <SelectItem
                key={account.id}
                value={account.id}
              >
                {account.name} ($
                {Number(
                  account.balance ?? 0
                ).toFixed(2)}
                )
              </SelectItem>
            )
          )}

          <CreateAccountDrawer>
            <Button
              variant="ghost"
              type="button"
              className="relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
            >
              Create Account
            </Button>
          </CreateAccountDrawer>
        </SelectContent>
      </Select>

      {errors.accountId && (
        <p className="text-sm text-red-500">
          {errors.accountId.message}
        </p>
      )}
    </div>
  </div>

  {/* ======================================================
      CATEGORY
  ======================================================= */}

  <div className="space-y-2">
    <label className="text-sm font-medium">
      Category
    </label>

    <Select
      value={category || ""}
      onValueChange={(value) =>
        setValue(
          "category",
          value,
          {
            shouldValidate: true,
            shouldDirty: true,
          }
        )
      }
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select category" />
      </SelectTrigger>

      <SelectContent>
        {filteredCategories.map(
          (categoryItem) => (
            <SelectItem
              key={categoryItem.id}
              value={categoryItem.id}
            >
              {categoryItem.name}
            </SelectItem>
          )
        )}
      </SelectContent>
    </Select>

    {errors.category && (
      <p className="text-sm text-red-500">
        {errors.category.message}
      </p>
    )}
  </div>

  {/* ======================================================
      DATE
  ======================================================= */}

  <div className="space-y-2">
    <label className="text-sm font-medium">
      Date
    </label>

    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full pl-3 text-left font-normal",
            !date &&
              "text-muted-foreground"
          )}
        >
          {date ? (
            format(
              date,
              "PPP"
            )
          ) : (
            <span>
              Pick a date
            </span>
          )}

          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="w-auto p-0"
        align="start"
      >
        <Calendar
          mode="single"
          selected={date}
          onSelect={(selectedDate) =>
            setValue(
              "date",
              selectedDate,
              {
                shouldValidate: true,
                shouldDirty: true,
              }
            )
          }
          disabled={(calendarDate) =>
            calendarDate >
              new Date() ||
            calendarDate <
              new Date(
                "1900-01-01"
              )
          }
          initialFocus
        />
      </PopoverContent>
    </Popover>

    {errors.date && (
      <p className="text-sm text-red-500">
        {errors.date.message}
      </p>
    )}
  </div>

  {/* ======================================================
      DESCRIPTION
  ======================================================= */}

  <div className="space-y-2">
    <label className="text-sm font-medium">
      Description
    </label>

    <Input
      className="w-full"
      placeholder="Enter description"
      {...register(
        "description"
      )}
    />

    {errors.description && (
      <p className="text-sm text-red-500">
        {
          errors
            .description
            .message
        }
      </p>
    )}
  </div>

  {/* ======================================================
      RECURRING TRANSACTION
  ======================================================= */}

  <div className="flex w-full flex-row items-center justify-between gap-4 rounded-lg border p-4">
    <div className="min-w-0 space-y-0.5">
      <label className="text-base font-medium">
        Recurring Transaction
      </label>

      <div className="text-sm text-muted-foreground">
        Set up a recurring schedule for this transaction
      </div>
    </div>

    <Switch
      checked={isRecurring}
      onCheckedChange={(checked) => {
        setValue(
          "isRecurring",
          checked,
          {
            shouldValidate: true,
            shouldDirty: true,
          }
        );

        // When recurring is disabled,
        // clear the interval to null.
        if (!checked) {
          setValue(
            "recurringInterval",
            null,
            {
              shouldValidate: true,
              shouldDirty: true,
            }
          );
        }
      }}
    />
  </div>

  {/* ======================================================
      RECURRING INTERVAL
  ======================================================= */}

  {isRecurring && (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        Recurring Interval
      </label>

      <Select
        value={
          recurringInterval || ""
        }
        onValueChange={(value) =>
          setValue(
            "recurringInterval",
            value,
            {
              shouldValidate: true,
              shouldDirty: true,
            }
          )
        }
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select interval" />
        </SelectTrigger>

        <SelectContent>
          <SelectItem value="DAILY">
            Daily
          </SelectItem>

          <SelectItem value="WEEKLY">
            Weekly
          </SelectItem>

          <SelectItem value="MONTHLY">
            Monthly
          </SelectItem>

          <SelectItem value="YEARLY">
            Yearly
          </SelectItem>
        </SelectContent>
      </Select>

      {errors.recurringInterval && (
        <p className="text-sm text-red-500">
          {
            errors
              .recurringInterval
              .message
          }
        </p>
      )}
    </div>
  )}

  {/* ======================================================
      ACTIONS
  ======================================================= */}

  <div className="grid w-full min-w-0 grid-cols-2 gap-4">
    <Button
      type="button"
      variant="outline"
      className="w-full min-w-0"
      disabled={transactionLoading}
      onClick={() =>
        router.back()
      }
    >
      Cancel
    </Button>

    <Button
      type="submit"
      className="w-full min-w-0"
      disabled={transactionLoading}
    >
      {transactionLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 shrink-0 animate-spin" />

          <span className="truncate">
            {editMode
              ? "Updating..."
              : "Creating..."}
          </span>
        </>
      ) : (
        <span className="truncate">
          {editMode
            ? "Update Transaction"
            : "Create Transaction"}
        </span>
      )}
    </Button>
  </div>
</form>

);
}
