"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Gift,
  Search,
  Settings,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CHAIN_CONFIG } from "@/keeperhub/lib/billing/contracts";
import { useActiveMember } from "@/keeperhub/lib/hooks/use-organization";
import { usePagination } from "@/keeperhub/lib/hooks/use-pagination";
import { api, type CreditTransaction } from "@/lib/api-client";

// -- Constants --

const ITEMS_PER_PAGE = 20;

const TOKEN_COLORS: Record<string, string> = {
  ETH: "#627eea",
  USDC: "#2775ca",
  USDT: "#26a17b",
  USDS: "#f5ac37",
} as const;

const WORKFLOW_COLORS = [
  "#8884d8",
  "#82ca9d",
  "#ffc658",
  "#ff7c7c",
  "#8dd1e1",
  "#a4de6c",
  "#d0ed57",
  "#ffa07a",
] as const;

type TransactionType = CreditTransaction["type"];

const TYPE_OPTIONS: { value: "all" | TransactionType; label: string }[] = [
  { value: "all", label: "All Types" },
  { value: "deposit", label: "Credit Purchase" },
  { value: "workflow_run", label: "Workflow Execution" },
  { value: "bonus", label: "Bonus Credits" },
  { value: "adjustment", label: "Manual Adjustment" },
] as const;

// -- Helper functions --

function getTransactionIcon(type: TransactionType): React.ReactNode {
  switch (type) {
    case "deposit":
      return <ArrowDownCircle className="size-4 text-green-500" />;
    case "workflow_run":
      return <ArrowUpCircle className="size-4 text-orange-500" />;
    case "bonus":
      return <Gift className="size-4 text-blue-500" />;
    case "adjustment":
      return <Settings className="size-4 text-gray-500" />;
    default:
      return <Settings className="size-4 text-gray-500" />;
  }
}

function getTransactionLabel(type: TransactionType): string {
  switch (type) {
    case "deposit":
      return "Credit Purchase";
    case "workflow_run":
      return "Workflow Execution";
    case "bonus":
      return "Bonus Credits";
    case "adjustment":
      return "Manual Adjustment";
    default:
      return "Transaction";
  }
}

function formatDate(date: string): string {
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// -- Sub-components --

type TopUpChartData = { name: string; value: number };
type SpenderChartData = {
  name: string;
  value: number;
  workflowId: string;
};

function TopUpTypesChart({ data }: { data: TopUpChartData[] }) {
  if (data.length === 0) {
    return null;
  }

  return (
    <Card className="p-6">
      <h3 className="mb-4 font-semibold text-lg">Top-Up by Token</h3>
      <ResponsiveContainer height={250} width="100%">
        <PieChart>
          <Pie
            cx="50%"
            cy="50%"
            data={data}
            dataKey="value"
            label={({ name, percent }: { name?: string; percent?: number }) =>
              `${name ?? ""} (${((percent ?? 0) * 100).toFixed(0)}%)`
            }
            nameKey="name"
            outerRadius={80}
          >
            {data.map((entry) => (
              <Cell
                fill={TOKEN_COLORS[entry.name] ?? "#8884d8"}
                key={entry.name}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number | undefined) => [
              `${(value ?? 0).toLocaleString()} credits`,
              "Amount",
            ]}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}

function WorkflowSpendersChart({ data }: { data: SpenderChartData[] }) {
  if (data.length === 0) {
    return null;
  }

  return (
    <Card className="p-6">
      <h3 className="mb-4 font-semibold text-lg">Spending by Workflow</h3>
      <ResponsiveContainer height={250} width="100%">
        <PieChart>
          <Pie
            cx="50%"
            cy="50%"
            data={data}
            dataKey="value"
            label={({ name, percent }: { name?: string; percent?: number }) => {
              const label = name ?? "";
              return `${label.length > 15 ? `${label.slice(0, 15)}...` : label} (${((percent ?? 0) * 100).toFixed(0)}%)`;
            }}
            nameKey="name"
            outerRadius={80}
          >
            {data.map((entry, index) => (
              <Cell
                fill={WORKFLOW_COLORS[index % WORKFLOW_COLORS.length]}
                key={entry.workflowId}
              />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!(active && payload?.[0])) {
                return null;
              }
              const item = payload[0].payload as SpenderChartData;
              return (
                <div className="rounded-md border bg-background p-2 shadow-sm">
                  <Link
                    className="font-medium text-primary text-sm hover:underline"
                    href={`/workflow/${item.workflowId}`}
                  >
                    {item.name}
                  </Link>
                  <p className="text-muted-foreground text-xs">
                    {item.value.toLocaleString()} credits
                  </p>
                </div>
              );
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}

function DatePickerButton({
  date,
  onSelect,
  onClear,
  placeholder,
}: {
  date: Date | undefined;
  onSelect: (date: Date | undefined) => void;
  onClear: () => void;
  placeholder: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          className="w-[160px] justify-start gap-2 text-left font-normal text-sm data-[empty=true]:text-muted-foreground"
          data-empty={!date}
          variant="outline"
        >
          <CalendarIcon className="size-3.5" />
          {date ? format(date, "MMM d, yyyy") : placeholder}
          {date && (
            <span
              className="ml-auto text-muted-foreground hover:text-foreground cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onClear();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  e.preventDefault();
                  onClear();
                }
              }}
              role="button"
              tabIndex={0}
            >
              <X className="size-3" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar mode="single" onSelect={onSelect} selected={date} />
      </PopoverContent>
    </Popover>
  );
}

function PaginationControls({
  currentPage,
  totalPages,
  canGoPrevious,
  canGoNext,
  goToPreviousPage,
  goToNextPage,
  goToPage,
  showingFrom,
  showingTo,
  totalItems,
  pageNumbers,
}: {
  currentPage: number;
  totalPages: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  goToPreviousPage: () => void;
  goToNextPage: () => void;
  goToPage: (page: number) => void;
  showingFrom: number;
  showingTo: number;
  totalItems: number;
  pageNumbers: (number | string)[];
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="flex items-center justify-between border-t px-2 pt-4">
      <p className="text-muted-foreground text-sm">
        Showing {showingFrom}-{showingTo} of {totalItems}
      </p>
      <nav className="flex items-center gap-1">
        <Button
          className="size-8"
          disabled={!canGoPrevious}
          onClick={goToPreviousPage}
          size="icon"
          variant="outline"
        >
          <ChevronLeft className="size-4" />
        </Button>
        {pageNumbers.map((page) => {
          if (typeof page === "string") {
            return (
              <span className="px-1 text-muted-foreground text-sm" key={page}>
                ...
              </span>
            );
          }
          return (
            <Button
              className="size-8 text-xs"
              key={page}
              onClick={() => goToPage(page)}
              size="icon"
              variant={page === currentPage ? "default" : "outline"}
            >
              {page}
            </Button>
          );
        })}
        <Button
          className="size-8"
          disabled={!canGoNext}
          onClick={goToNextPage}
          size="icon"
          variant="outline"
        >
          <ChevronRight className="size-4" />
        </Button>
      </nav>
    </div>
  );
}

// -- Description cell with workflow link --

function TransactionDescription({ tx }: { tx: CreditTransaction }) {
  if (tx.workflowName && tx.workflowId) {
    return (
      <Link
        className="text-primary hover:underline"
        href={`/workflow/${tx.workflowId}`}
      >
        {tx.workflowName}
      </Link>
    );
  }

  if (tx.note) {
    return <span>{tx.note}</span>;
  }

  return <span className="text-muted-foreground">-</span>;
}

// -- Main page component --

export default function BillingHistoryPage() {
  const activeMember = useActiveMember();
  const organizationId = activeMember?.member?.organizationId;

  // Filter state
  const [typeFilter, setTypeFilter] = useState<"all" | TransactionType>("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [searchQuery, setSearchQuery] = useState("");

  // Data queries
  const { data: balance } = useQuery({
    queryKey: ["billing-balance", organizationId],
    queryFn: () => {
      if (!organizationId) {
        throw new Error("No organization ID");
      }
      return api.billing.getBalance(organizationId);
    },
    enabled: !!organizationId,
  });

  const { data: historyData, isLoading } = useQuery({
    queryKey: ["billing-history", organizationId],
    queryFn: () => {
      if (!organizationId) {
        throw new Error("No organization ID");
      }
      return api.billing.getHistory(organizationId);
    },
    enabled: !!organizationId,
  });

  const transactions = historyData?.transactions ?? [];

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    let filtered = transactions;

    if (typeFilter !== "all") {
      filtered = filtered.filter((tx) => tx.type === typeFilter);
    }

    if (dateFrom) {
      filtered = filtered.filter((tx) => new Date(tx.createdAt) >= dateFrom);
    }

    if (dateTo) {
      const endOfDay = new Date(dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      filtered = filtered.filter((tx) => new Date(tx.createdAt) <= endOfDay);
    }

    if (searchQuery) {
      const lower = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (tx) =>
          tx.note?.toLowerCase().includes(lower) ||
          tx.workflowName?.toLowerCase().includes(lower)
      );
    }

    return filtered;
  }, [transactions, typeFilter, dateFrom, dateTo, searchQuery]);

  // Pagination
  const pagination = usePagination(filteredTransactions, {
    defaultItemsPerPage: ITEMS_PER_PAGE,
  });

  // Chart data: top-up types
  const topUpData = useMemo((): TopUpChartData[] => {
    const deposits = transactions.filter(
      (tx) => tx.type === "deposit" && tx.paymentToken
    );
    const grouped = new Map<string, number>();
    for (const tx of deposits) {
      const token = tx.paymentToken as string;
      grouped.set(token, (grouped.get(token) ?? 0) + tx.amount);
    }
    return Array.from(grouped.entries()).map(([name, value]) => ({
      name,
      value,
    }));
  }, [transactions]);

  // Chart data: workflow spenders
  const spenderData = useMemo((): SpenderChartData[] => {
    const runs = transactions.filter(
      (tx) => tx.type === "workflow_run" && tx.workflowId
    );
    const grouped = new Map<
      string,
      { name: string; value: number; workflowId: string }
    >();
    for (const tx of runs) {
      const id = tx.workflowId as string;
      const existing = grouped.get(id);
      const absAmount = Math.abs(tx.amount);
      if (existing) {
        existing.value += absAmount;
      } else {
        grouped.set(id, {
          name: tx.workflowName ?? id,
          value: absAmount,
          workflowId: id,
        });
      }
    }
    return Array.from(grouped.values());
  }, [transactions]);

  const hasFiltersActive =
    typeFilter !== "all" || !!dateFrom || !!dateTo || !!searchQuery;

  return (
    <div className="pointer-events-auto h-screen overflow-y-auto">
      <div className="container mx-auto max-w-7xl space-y-8 p-6 pt-24 pb-16">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="font-bold text-4xl tracking-tight">
              Transaction History
            </h1>
            <p className="text-lg text-muted-foreground">
              View all your credit transactions
            </p>
          </div>
          <Button asChild>
            <Link href="/billing">Buy Credits</Link>
          </Button>
        </div>

        {/* Current Balance */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="mb-1 text-muted-foreground text-sm">
                Current Balance
              </p>
              <p className="font-bold text-4xl">
                {balance?.creditBalance?.toLocaleString() ?? 0}
              </p>
              <p className="mt-1 text-muted-foreground text-sm">credits</p>
            </div>
          </div>
        </Card>

        {/* Pie Charts */}
        {(topUpData.length > 0 || spenderData.length > 0) && (
          <div className="grid gap-6 md:grid-cols-2">
            <TopUpTypesChart data={topUpData} />
            <WorkflowSpendersChart data={spenderData} />
          </div>
        )}

        {/* Transactions Table */}
        <Card>
          <div className="p-6">
            <h2 className="mb-4 font-semibold text-xl">All Transactions</h2>

            {/* Filters */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Select
                onValueChange={(v) =>
                  setTypeFilter(v as "all" | TransactionType)
                }
                value={typeFilter}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <DatePickerButton
                date={dateFrom}
                onClear={() => setDateFrom(undefined)}
                onSelect={setDateFrom}
                placeholder="From date"
              />

              <DatePickerButton
                date={dateTo}
                onClear={() => setDateTo(undefined)}
                onSelect={setDateTo}
                placeholder="To date"
              />

              <div className="relative">
                <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="w-[200px] pl-8 text-sm"
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search description..."
                  value={searchQuery}
                />
              </div>

              {hasFiltersActive && (
                <Button
                  onClick={() => {
                    setTypeFilter("all");
                    setDateFrom(undefined);
                    setDateTo(undefined);
                    setSearchQuery("");
                  }}
                  size="sm"
                  variant="ghost"
                >
                  Clear filters
                </Button>
              )}
            </div>

            {/* Table */}
            {(() => {
              if (isLoading) {
                return (
                  <div className="py-12 text-center text-muted-foreground">
                    Loading transactions...
                  </div>
                );
              }

              if (filteredTransactions.length === 0) {
                return (
                  <div className="py-12 text-center text-muted-foreground">
                    {hasFiltersActive
                      ? "No transactions match your filters"
                      : "No transactions yet"}
                  </div>
                );
              }

              return (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead className="text-right">Balance</TableHead>
                          <TableHead>Transaction</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagination.paginatedItems.map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell className="whitespace-nowrap">
                              {formatDate(tx.createdAt)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {getTransactionIcon(tx.type)}
                                <span className="font-medium">
                                  {getTransactionLabel(tx.type)}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="max-w-xs truncate">
                              <TransactionDescription tx={tx} />
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              <span
                                className={
                                  tx.amount > 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }
                              >
                                {tx.amount > 0 ? "+" : ""}
                                {tx.amount.toLocaleString()}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {tx.balanceAfter.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              {tx.txHash ? (
                                <a
                                  className="font-mono text-primary text-sm hover:underline"
                                  href={`${
                                    CHAIN_CONFIG.chainId === 1
                                      ? "https://etherscan.io"
                                      : "https://sepolia.etherscan.io"
                                  }/tx/${tx.txHash}`}
                                  rel="noopener noreferrer"
                                  target="_blank"
                                >
                                  {tx.txHash.slice(0, 6)}...
                                  {tx.txHash.slice(-4)}
                                </a>
                              ) : (
                                <span className="text-muted-foreground text-sm">
                                  -
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <PaginationControls
                    canGoNext={pagination.canGoNext}
                    canGoPrevious={pagination.canGoPrevious}
                    currentPage={pagination.currentPage}
                    goToNextPage={pagination.goToNextPage}
                    goToPage={pagination.goToPage}
                    goToPreviousPage={pagination.goToPreviousPage}
                    pageNumbers={pagination.pageNumbers}
                    showingFrom={pagination.showingFrom}
                    showingTo={pagination.showingTo}
                    totalItems={pagination.totalItems}
                    totalPages={pagination.totalPages}
                  />
                </>
              );
            })()}
          </div>
        </Card>
      </div>
    </div>
  );
}
