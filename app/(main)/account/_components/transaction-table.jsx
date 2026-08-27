"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Trash,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Clock,
} from "lucide-react";
import { format, isValid } from "date-fns";
import { toast } from "sonner";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Input } from "@/components/ui/input";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { categoryColors } from "@/data/categories";

import {
  bulkDeleteTransactions,
} from "@/lib/api/transactions";

import useFetch from "@/hooks/use-fetch";
import { BarLoader } from "react-spinners";
import { useRouter } from "next/navigation";

const ITEMS_PER_PAGE = 10;

const RECURRING_INTERVALS = {
  DAILY: "Daily",
  WEEKLY: "Weekly",
  MONTHLY: "Monthly",
  YEARLY: "Yearly",
};

export function TransactionTable({ transactions = [] }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [sortConfig, setSortConfig] = useState({
    field: "date",
    direction: "desc",
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [recurringFilter, setRecurringFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const router = useRouter();

  /*
   * Normalize Rust snake_case -> frontend camelCase.
   * This makes the component work regardless of whether
   * the API layer already normalized the response.
   */
  const normalizedTransactions = useMemo(() => {
    return (Array.isArray(transactions) ? transactions : []).map(
      (transaction) => ({
        ...transaction,

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

        amount: Number(transaction.amount ?? 0),

        accountId:
          transaction.accountId ??
          transaction.account_id ??
          null,

        account_id:
          transaction.account_id ??
          transaction.accountId ??
          null,

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
      })
    );
  }, [transactions]);

  /*
   * Filter + sort
   */
  const filteredAndSortedTransactions = useMemo(() => {
    let result = [...normalizedTransactions];

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();

      result = result.filter((transaction) =>
        transaction.description
          ?.toLowerCase()
          .includes(searchLower)
      );
    }

    if (typeFilter) {
      result = result.filter(
        (transaction) => transaction.type === typeFilter
      );
    }

    if (recurringFilter) {
      result = result.filter((transaction) => {
        if (recurringFilter === "recurring") {
          return transaction.isRecurring;
        }

        return !transaction.isRecurring;
      });
    }

    result.sort((a, b) => {
      let comparison = 0;

      switch (sortConfig.field) {
        case "date":
          comparison =
            new Date(a.date).getTime() -
            new Date(b.date).getTime();
          break;

        case "amount":
          comparison = a.amount - b.amount;
          break;

        case "category":
          comparison = (a.category ?? "").localeCompare(
            b.category ?? ""
          );
          break;

        default:
          comparison = 0;
      }

      return sortConfig.direction === "asc"
        ? comparison
        : -comparison;
    });

    return result;
  }, [
    normalizedTransactions,
    searchTerm,
    typeFilter,
    recurringFilter,
    sortConfig,
  ]);

  /*
   * Pagination
   */
  const totalPages = Math.ceil(
    filteredAndSortedTransactions.length /
      ITEMS_PER_PAGE
  );

  const paginatedTransactions = useMemo(() => {
    const startIndex =
      (currentPage - 1) * ITEMS_PER_PAGE;

    return filteredAndSortedTransactions.slice(
      startIndex,
      startIndex + ITEMS_PER_PAGE
    );
  }, [
    filteredAndSortedTransactions,
    currentPage,
  ]);

  /*
   * Sorting
   */
  const handleSort = (field) => {
    setSortConfig((current) => ({
      field,
      direction:
        current.field === field &&
        current.direction === "asc"
          ? "desc"
          : "asc",
    }));
  };

  /*
   * Selection
   */
  const handleSelect = (id) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedIds((current) =>
      current.length === paginatedTransactions.length
        ? []
        : paginatedTransactions.map((t) => t.id)
    );
  };

  /*
   * Delete
   */
  const {
    loading: deleteLoading,
    fn: deleteFn,
    data: deleted,
  } = useFetch(bulkDeleteTransactions);

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    if (
      !window.confirm(
        `Are you sure you want to delete ${selectedIds.length} transactions?`
      )
    ) {
      return;
    }

    await deleteFn(selectedIds);
  };

  useEffect(() => {
    if (deleted && !deleteLoading) {
      toast.success(
        "Transactions deleted successfully"
      );

      setSelectedIds([]);
      router.refresh();
    }
  }, [deleted, deleteLoading, router]);

  /*
   * Filters
   */
  const handleClearFilters = () => {
    setSearchTerm("");
    setTypeFilter("");
    setRecurringFilter("");
    setCurrentPage(1);
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    setSelectedIds([]);
  };

  /*
   * Safe date formatter
   */
  const formatTransactionDate = (date) => {
    if (!date) return "N/A";

    const parsedDate = new Date(date);

    if (!isValid(parsedDate)) {
      return "N/A";
    }

    return format(parsedDate, "PPP");
  };

  return (
    <div className="space-y-4">

      {deleteLoading && (
        <BarLoader
          className="mt-4"
          width={"100%"}
          color="#9333ea"
        />
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">

        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />

          <Input
            placeholder="Search transactions..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-8"
          />
        </div>

        <div className="flex gap-2">

          <Select
            value={typeFilter}
            onValueChange={(value) => {
              setTypeFilter(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="INCOME">
                Income
              </SelectItem>

              <SelectItem value="EXPENSE">
                Expense
              </SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={recurringFilter}
            onValueChange={(value) => {
              setRecurringFilter(value);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue placeholder="All Transactions" />
            </SelectTrigger>

            <SelectContent>
              <SelectItem value="recurring">
                Recurring Only
              </SelectItem>

              <SelectItem value="non-recurring">
                Non-recurring Only
              </SelectItem>
            </SelectContent>
          </Select>

          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={deleteLoading}
              >
                <Trash className="h-4 w-4 mr-2" />
                Delete Selected ({selectedIds.length})
              </Button>
            </div>
          )}

          {(searchTerm ||
            typeFilter ||
            recurringFilter) && (
            <Button
              variant="outline"
              size="icon"
              onClick={handleClearFilters}
              title="Clear filters"
            >
              <X className="h-4 w-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>

          <TableHeader>
            <TableRow>

              <TableHead className="w-[50px]">
                <Checkbox
                  checked={
                    selectedIds.length ===
                      paginatedTransactions.length &&
                    paginatedTransactions.length > 0
                  }
                  onCheckedChange={handleSelectAll}
                />
              </TableHead>

              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort("date")}
              >
                <div className="flex items-center">
                  Date

                  {sortConfig.field === "date" &&
                    (sortConfig.direction === "asc" ? (
                      <ChevronUp className="ml-1 h-4 w-4" />
                    ) : (
                      <ChevronDown className="ml-1 h-4 w-4" />
                    ))}
                </div>
              </TableHead>

              <TableHead>
                Description
              </TableHead>

              <TableHead
                className="cursor-pointer"
                onClick={() => handleSort("category")}
              >
                <div className="flex items-center">
                  Category

                  {sortConfig.field === "category" &&
                    (sortConfig.direction === "asc" ? (
                      <ChevronUp className="ml-1 h-4 w-4" />
                    ) : (
                      <ChevronDown className="ml-1 h-4 w-4" />
                    ))}
                </div>
              </TableHead>

              <TableHead
                className="cursor-pointer text-right"
                onClick={() => handleSort("amount")}
              >
                <div className="flex items-center justify-end">
                  Amount

                  {sortConfig.field === "amount" &&
                    (sortConfig.direction === "asc" ? (
                      <ChevronUp className="ml-1 h-4 w-4" />
                    ) : (
                      <ChevronDown className="ml-1 h-4 w-4" />
                    ))}
                </div>
              </TableHead>

              <TableHead>
                Recurring
              </TableHead>

              <TableHead className="w-[50px]" />

            </TableRow>
          </TableHeader>

          <TableBody>

            {paginatedTransactions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground"
                >
                  No transactions found
                </TableCell>
              </TableRow>
            ) : (

              paginatedTransactions.map(
                (transaction) => {

                  const recurring =
                    Boolean(
                      transaction.isRecurring
                    );

                  const nextRecurringDate =
                    transaction.nextRecurringDate;

                  const recurringInterval =
                    transaction.recurringInterval;

                  return (
                    <TableRow
                      key={transaction.id}
                    >

                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(
                            transaction.id
                          )}
                          onCheckedChange={() =>
                            handleSelect(
                              transaction.id
                            )
                          }
                        />
                      </TableCell>

                      <TableCell>
                        {transaction.date
                          ? format(
                              new Date(
                                transaction.date
                              ),
                              "PP"
                            )
                          : "N/A"}
                      </TableCell>

                      <TableCell>
                        {transaction.description ||
                          "—"}
                      </TableCell>

                      <TableCell className="capitalize">

                        <span
                          style={{
                            background:
                              categoryColors[
                                transaction.category
                              ] || "#64748b",
                          }}
                          className="px-2 py-1 rounded text-white text-sm"
                        >
                          {transaction.category ||
                            "Uncategorized"}
                        </span>

                      </TableCell>

                      <TableCell
                        className={cn(
                          "text-right font-medium",
                          transaction.type ===
                            "EXPENSE"
                            ? "text-red-500"
                            : "text-green-500"
                        )}
                      >
                        {transaction.type ===
                        "EXPENSE"
                          ? "-"
                          : "+"}
                        $
                        {Number(
                          transaction.amount ?? 0
                        ).toFixed(2)}
                      </TableCell>

                      <TableCell>

                        {recurring ? (
                          <TooltipProvider>

                            <Tooltip>

                              <TooltipTrigger asChild>
                                <Badge
                                  variant="secondary"
                                  className="gap-1 bg-purple-100 text-purple-700 hover:bg-purple-200"
                                >
                                  <RefreshCw className="h-3 w-3" />

                                  {RECURRING_INTERVALS[
                                    recurringInterval
                                  ] ||
                                    recurringInterval ||
                                    "Recurring"}
                                </Badge>
                              </TooltipTrigger>

                              <TooltipContent>

                                <div className="text-sm">

                                  <div className="font-medium">
                                    Next Date:
                                  </div>

                                  <div>
                                    {nextRecurringDate
                                      ? formatTransactionDate(
                                          nextRecurringDate
                                        )
                                      : "N/A"}
                                  </div>

                                </div>

                              </TooltipContent>

                            </Tooltip>

                          </TooltipProvider>
                        ) : (

                          <Badge
                            variant="outline"
                            className="gap-1"
                          >
                            <Clock className="h-3 w-3" />
                            One-time
                          </Badge>

                        )}

                      </TableCell>

                      <TableCell>

                        <DropdownMenu>

                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              className="h-8 w-8 p-0"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>

                          <DropdownMenuContent align="end">

                            <DropdownMenuItem
                              onClick={() =>
                                router.push(
                                  `/transaction/create?edit=${transaction.id}`
                                )
                              }
                            >
                              Edit
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() =>
                                deleteFn([
                                  transaction.id,
                                ])
                              }
                            >
                              Delete
                            </DropdownMenuItem>

                          </DropdownMenuContent>

                        </DropdownMenu>

                      </TableCell>

                    </TableRow>
                  );
                }
              )
            )}

          </TableBody>

        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">

          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              handlePageChange(
                currentPage - 1
              )
            }
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>

          <span className="text-sm">
            Page {currentPage} of {totalPages}
          </span>

          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              handlePageChange(
                currentPage + 1
              )
            }
            disabled={
              currentPage === totalPages
            }
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

        </div>
      )}

    </div>
  );
}