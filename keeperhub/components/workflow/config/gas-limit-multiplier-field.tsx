"use client";

import { Input } from "@/components/ui/input";
import {
  getChainDisplayName,
  getChainGasDefaults,
} from "@/keeperhub/lib/web3/gas-defaults";
import type { ActionConfigFieldBase } from "@/plugins";

type GasLimitMultiplierFieldProps = {
  field: ActionConfigFieldBase;
  value: string;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  config: Record<string, unknown>;
};

export function GasLimitMultiplierField({
  field,
  value,
  onChange,
  disabled,
  config,
}: GasLimitMultiplierFieldProps) {
  const networkField = field.networkField ?? "network";
  const chainIdRaw = config[networkField];
  const chainId = chainIdRaw ? Number(chainIdRaw) : undefined;

  const defaults =
    chainId && !Number.isNaN(chainId)
      ? getChainGasDefaults(chainId)
      : undefined;
  const chainName =
    chainId && !Number.isNaN(chainId)
      ? getChainDisplayName(chainId)
      : undefined;

  const defaultMultiplier = defaults?.multiplier ?? 2.0;
  const displayName = chainName ?? "selected chain";

  const placeholder = `Auto (${defaultMultiplier}x for ${displayName})`;

  const hasValue = value !== "" && value !== undefined;

  return (
    <div className="space-y-1">
      <Input
        disabled={disabled}
        id={field.key}
        max={field.max ?? 10}
        min={field.min ?? 1}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        step={field.step ?? 0.01}
        type="number"
        value={value}
      />
      <p className="text-muted-foreground text-xs">
        {hasValue
          ? `Custom: ${value}x (chain default: ${defaultMultiplier}x)`
          : `Using chain default: ${defaultMultiplier}x`}
      </p>
      <p className="text-muted-foreground/70 text-xs">
        Applied to the network gas estimate at execution time to set the
        transaction gas limit.
      </p>
    </div>
  );
}
