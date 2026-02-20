"use client";

import { ArrowLeft, Box, ExternalLink } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getChainName, getExplorerUrl } from "@/keeperhub/lib/chain-utils";
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

  const firstContract = Object.values(protocol.contracts)[0];
  const firstChainEntry = firstContract
    ? Object.entries(firstContract.addresses)[0]
    : undefined;
  const explorerUrl =
    firstChainEntry?.[0] && firstChainEntry[1]
      ? getExplorerUrl(firstChainEntry[0], firstChainEntry[1])
      : null;

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
          {protocol.icon ? (
            <Image
              alt={protocol.name}
              className="rounded"
              height={32}
              src={protocol.icon}
              width={32}
            />
          ) : (
            <Box className="size-5 text-[#09fd67]" />
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-xl">{protocol.name}</h2>
            {explorerUrl && (
              <a
                className="text-muted-foreground hover:text-foreground transition-colors"
                href={explorerUrl}
                rel="noopener noreferrer"
                target="_blank"
                title="View on explorer"
              >
                <ExternalLink className="size-4" />
              </a>
            )}
          </div>
          <p className="mt-1 text-muted-foreground text-sm">
            {protocol.description.replace(/ -- /g, ". ")}
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
                {action.inputs.length > 0 ? (
                  <p className="mt-1 text-muted-foreground text-xs">
                    Inputs:{" "}
                    {action.inputs
                      .map((inp) => `${inp.name} (${inp.type})`)
                      .join(", ")}
                  </p>
                ) : (
                  <p className="mt-1 text-muted-foreground text-xs">
                    No inputs required
                  </p>
                )}
                {action.outputs && action.outputs.length > 0 && (
                  <p className="mt-0.5 text-muted-foreground text-xs">
                    Outputs:{" "}
                    {action.outputs
                      .map((out) => `${out.name} (${out.type})`)
                      .join(", ")}
                  </p>
                )}
                {(!action.outputs || action.outputs.length === 0) &&
                  action.type === "read" && (
                    <p className="mt-0.5 text-muted-foreground text-xs">
                      Returns: success status
                    </p>
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
