"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, History, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CHAIN_CONFIG } from "@/keeperhub/lib/billing/contracts";
import { useActiveMember } from "@/keeperhub/lib/hooks/use-organization";
import { api } from "@/lib/api-client";

const CREDIT_PACKAGES = [
  {
    id: "starter",
    name: "Starter",
    usd: 25,
    credits: 2500,
    bonus: 0,
    popular: false,
  },
  {
    id: "pro",
    name: "Pro",
    usd: 100,
    credits: 11_000,
    bonus: 10,
    popular: true,
  },
  {
    id: "business",
    name: "Business",
    usd: 500,
    credits: 60_000,
    bonus: 20,
    popular: false,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    usd: 1000,
    credits: 120_000,
    bonus: 20,
    popular: false,
  },
];

export default function BillingPage() {
  const router = useRouter();
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
    refetchInterval: 5000, // Refetch every 5 seconds
    refetchIntervalInBackground: true, // Continue refetching even when tab is not active
  });

  const handleSelectPackage = (usdAmount: number) => {
    router.push(`/billing/checkout?amount=${usdAmount}`);
  };

  return (
    <div className="container pointer-events-auto mx-auto max-w-7xl space-y-8 p-6 pt-24">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="font-bold text-4xl tracking-tight">Billing</h1>
        <p className="text-lg text-muted-foreground">
          Purchase credits to power your workflows
        </p>
      </div>

      {/* Current Balance */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10 p-8">
        <div className="flex items-center justify-between">
          <div>
            <p className="mb-1 text-muted-foreground text-sm">
              Current Balance
            </p>
            <p className="font-bold text-5xl">
              {balance?.creditBalance?.toLocaleString() ?? 0}
            </p>
            <p className="mt-2 text-muted-foreground text-sm">credits</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/billing/history">
              <History className="mr-2 size-4" />
              View History
            </Link>
          </Button>
        </div>
      </Card>

      {/* Credit Packages */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-2xl">Credit Packages</h2>
          <p className="text-muted-foreground text-sm">
            Pay with ETH on{" "}
            {CHAIN_CONFIG.chainId === 1 ? "Ethereum" : "Sepolia"}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {CREDIT_PACKAGES.map((pkg) => (
            <Card
              className={`relative p-6 transition-all hover:shadow-lg ${
                pkg.popular
                  ? "scale-105 border-primary shadow-md"
                  : "hover:border-primary/50"
              }`}
              key={pkg.id}
            >
              {pkg.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 font-semibold text-primary-foreground text-xs">
                  Most Popular
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <h3 className="font-bold text-xl">{pkg.name}</h3>
                  <div className="mt-2">
                    <span className="font-bold text-4xl">${pkg.usd}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-baseline gap-1">
                    <span className="font-semibold text-2xl">
                      {pkg.credits.toLocaleString()}
                    </span>
                    <span className="text-muted-foreground text-sm">
                      credits
                    </span>
                  </div>
                  {pkg.bonus > 0 && (
                    <div className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2 py-1 font-medium text-green-600 text-xs dark:text-green-400">
                      <Sparkles className="size-3" />+{pkg.bonus}% bonus
                    </div>
                  )}
                </div>

                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Check className="size-4 shrink-0 text-primary" />
                    <span>Run unlimited workflows</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 shrink-0 text-primary" />
                    <span>Full transaction history</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="size-4 shrink-0 text-primary" />
                    <span>Priority support</span>
                  </li>
                </ul>

                <Button
                  className="w-full"
                  onClick={() => handleSelectPackage(pkg.usd)}
                  variant={pkg.popular ? "default" : "outline"}
                >
                  Buy Now
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* How it works */}
      <Card className="p-6">
        <h3 className="mb-4 font-semibold text-lg">How it works</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
              1
            </div>
            <h4 className="font-medium">Select a package</h4>
            <p className="text-muted-foreground text-sm">
              Choose the credit package that fits your needs
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
              2
            </div>
            <h4 className="font-medium">Pay with crypto</h4>
            <p className="text-muted-foreground text-sm">
              Connect your wallet and complete payment with ETH or stablecoins
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
              3
            </div>
            <h4 className="font-medium">Start building</h4>
            <p className="text-muted-foreground text-sm">
              Credits are instantly added to your account
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
