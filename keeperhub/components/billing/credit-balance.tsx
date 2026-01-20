"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api-client";
import { BuyCreditsDialog } from "./buy-credits-dialog";

type CreditBalanceProps = {
  organizationId: string;
};

export function CreditBalance({ organizationId }: CreditBalanceProps) {
  const [showBuyDialog, setShowBuyDialog] = useState(false);

  const {
    data: balance,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["billing-balance", organizationId],
    queryFn: () => api.billing.getBalance(organizationId),
    enabled: !!organizationId,
  });

  if (isLoading) {
    return <div className="text-muted-foreground text-sm">Loading...</div>;
  }

  return (
    <>
      <div className="flex items-center gap-4">
        <div className="flex flex-col">
          <span className="text-muted-foreground text-sm">Credits</span>
          <span className="font-bold text-2xl">
            {balance?.creditBalance?.toLocaleString() ?? 0}
          </span>
        </div>
        <Button onClick={() => setShowBuyDialog(true)} size="sm">
          Buy Credits
        </Button>
      </div>

      <BuyCreditsDialog
        onOpenChange={setShowBuyDialog}
        onSuccess={() => refetch()}
        open={showBuyDialog}
        organizationId={organizationId}
      />
    </>
  );
}
