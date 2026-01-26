"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowDownCircle, ArrowUpCircle, Gift, Settings } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { api, type CreditTransaction } from "@/lib/api-client";

function getTransactionIcon(type: CreditTransaction["type"]) {
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

function getTransactionLabel(type: CreditTransaction["type"]) {
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

function formatDate(date: string) {
  return new Date(date).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BillingHistoryPage() {
  const activeMember = useActiveMember();
  const organizationId = activeMember?.member?.organizationId;

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

  return (
    <div className="container pointer-events-auto mx-auto max-w-7xl space-y-8 p-6">
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

      {/* Transactions Table */}
      <Card>
        <div className="p-6">
          <h2 className="mb-4 font-semibold text-xl">All Transactions</h2>
          {(() => {
            if (isLoading) {
              return (
                <div className="py-12 text-center text-muted-foreground">
                  Loading transactions...
                </div>
              );
            }

            if (transactions.length === 0) {
              return (
                <div className="py-12 text-center text-muted-foreground">
                  No transactions yet
                </div>
              );
            }

            return (
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
                    {transactions.map((tx) => (
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
                          {tx.note || tx.workflowId || "-"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          <span
                            className={
                              tx.amount > 0 ? "text-green-600" : "text-red-600"
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
                              {tx.txHash.slice(0, 6)}...{tx.txHash.slice(-4)}
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
            );
          })()}
        </div>
      </Card>

      {/* Additional Info */}
      {transactions.some((tx) => tx.paymentToken) && (
        <Card className="p-6">
          <h3 className="mb-4 font-semibold text-lg">Payment Details</h3>
          <div className="space-y-2 text-sm">
            {transactions
              .filter((tx) => tx.paymentToken && tx.type === "deposit")
              .slice(0, 5)
              .map((tx) => (
                <div
                  className="flex items-center justify-between border-b py-2 last:border-0"
                  key={tx.id}
                >
                  <div className="flex items-center gap-2">
                    <ArrowDownCircle className="size-4 text-green-500" />
                    <span className="text-muted-foreground">
                      {formatDate(tx.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 font-mono text-xs">
                    {tx.paymentAmount && tx.paymentToken && (
                      <span>
                        {(Number(tx.paymentAmount) / 1e18).toFixed(6)}{" "}
                        {tx.paymentToken}
                      </span>
                    )}
                    {tx.usdValue && (
                      <span className="text-muted-foreground">
                        ≈ ${(Number(tx.usdValue) / 1e6).toFixed(2)}
                      </span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}
