"use client";

import { ArrowLeft, Box } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getChainName } from "@/keeperhub/lib/chain-utils";
import type { ProtocolDefinition } from "@/keeperhub/lib/protocol-registry";

type ProtocolDetailProps = {
  protocol: ProtocolDefinition;
  onBack: () => void;
};

function ActionTypeBadge({
  type,
}: {
  type: "read" | "write";
}): React.ReactElement {
  if (type === "read") {
    return (
      <span className="rounded-full bg-muted px-2 py-0.5 font-medium text-[10px] text-muted-foreground uppercase tracking-wider">
        READ
      </span>
    );
  }

  return (
    <span className="rounded-full bg-[#09fd671a] px-2 py-0.5 font-medium text-[#09fd67] text-[10px] uppercase tracking-wider">
      WRITE
    </span>
  );
}

function ActionChainBadges({
  addresses,
}: {
  addresses: Record<string, string>;
}): React.ReactElement {
  const chains = Object.keys(addresses);

  return (
    <div className="flex flex-wrap gap-1">
      {chains.map((chain) => (
        <span
          className="rounded-full bg-[#09fd671a] px-2 py-0.5 font-medium text-[#09fd67] text-[10px]"
          key={chain}
        >
          {getChainName(chain)}
        </span>
      ))}
    </div>
  );
}

function collectAllChains(
  contracts: ProtocolDefinition["contracts"]
): string[] {
  const chainSet = new Set<string>();
  for (const contract of Object.values(contracts)) {
    for (const chain of Object.keys(contract.addresses)) {
      chainSet.add(chain);
    }
  }
  return Array.from(chainSet);
}

export function ProtocolDetail({
  protocol,
  onBack,
}: ProtocolDetailProps): React.ReactElement {
  const router = useRouter();
  const allChains = collectAllChains(protocol.contracts);

  return (
    <div>
      <Button
        className="mb-6 text-muted-foreground hover:text-foreground"
        onClick={onBack}
        variant="ghost"
      >
        <ArrowLeft className="mr-2 size-4" />
        Back to Protocols
      </Button>

      <div className="flex items-start gap-4">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-[#2a3342]">
          <Box className="size-5 text-[#09fd67]" />
        </div>
        <div>
          <h2 className="font-bold text-xl">{protocol.name}</h2>
          <p className="mt-1 text-muted-foreground text-sm">
            {protocol.description}
          </p>
          <div className="mt-3 flex flex-wrap gap-1">
            {allChains.map((chain) => (
              <span
                className="rounded-full bg-[#09fd671a] px-2 py-0.5 font-medium text-[#09fd67] text-[10px]"
                key={chain}
              >
                {getChainName(chain)}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="my-6 border-t border-border/30" />

      <h3 className="mb-4 font-semibold text-base">
        Actions ({protocol.actions.length})
      </h3>

      <div>
        {protocol.actions.map((action, index) => {
          const contract = protocol.contracts[action.contract];
          const isLast = index === protocol.actions.length - 1;

          return (
            <div
              className={`flex items-center justify-between px-4 py-4 transition-colors hover:bg-muted/50 ${isLast ? "" : "border-b border-border/30"}`}
              key={action.slug}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{action.label}</span>
                  <ActionTypeBadge type={action.type} />
                </div>
                <p className="mt-0.5 text-muted-foreground text-xs">
                  {action.description}
                </p>
                {contract && (
                  <div className="mt-2">
                    <ActionChainBadges addresses={contract.addresses} />
                  </div>
                )}
              </div>
              <Button
                className="ml-4 shrink-0"
                onClick={() => router.push("/")}
                size="sm"
                variant="outline"
              >
                Use in Workflow
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
