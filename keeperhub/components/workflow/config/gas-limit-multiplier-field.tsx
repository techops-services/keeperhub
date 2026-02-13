"use client";

import { AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  type GasLimitConfig,
  getChainDisplayName,
  getChainGasDefaults,
  parseGasLimitConfig,
} from "@/keeperhub/lib/web3/gas-defaults";
import type { ActionConfigFieldBase } from "@/plugins";

type GasLimitMultiplierFieldProps = {
  field: ActionConfigFieldBase;
  value: string;
  onChange: (value: unknown) => void;
  disabled?: boolean;
  config: Record<string, unknown>;
};

type GasEstimateState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; estimatedGas: string }
  | { status: "error"; message: string };

const DEBOUNCE_MS = 500;
const TEMPLATE_REF_PATTERN = /\{\{.*?\}\}/;

function hasTemplateRefs(config: Record<string, unknown>): boolean {
  return Object.values(config).some(
    (v) => typeof v === "string" && TEMPLATE_REF_PATTERN.test(v)
  );
}

function formatGasNumber(value: string): string {
  const num = Number(value);
  if (Number.isNaN(num)) {
    return value;
  }
  return num.toLocaleString();
}

function serializeConfig(config: GasLimitConfig): string {
  return JSON.stringify(config);
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: React component with conditional rendering for multiple UI states
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
  const actionSlug = field.actionSlug;

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

  // Parse the current value to determine mode
  const parsed = useMemo(() => parseGasLimitConfig(value), [value]);
  const mode = parsed?.mode ?? "multiplier";
  const inputValue = parsed?.value ?? "";

  const [estimate, setEstimate] = useState<GasEstimateState>({
    status: "idle",
  });
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Determine if we have enough config to estimate
  const canEstimate = useMemo(() => {
    if (!(chainId && actionSlug)) {
      return false;
    }
    if (hasTemplateRefs(config)) {
      return false;
    }

    switch (actionSlug) {
      case "transfer-funds":
        return Boolean(config.recipientAddress);
      case "transfer-token":
        return Boolean(config.recipientAddress && config.tokenConfig);
      case "write-contract":
        return Boolean(
          config.contractAddress && config.abi && config.abiFunction
        );
      default:
        return false;
    }
  }, [chainId, actionSlug, config]);

  // Fetch gas estimate with debounce
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: fetch with validation, error handling, and abort support
  const fetchEstimate = useCallback(async () => {
    if (!(canEstimate && chainId && actionSlug)) {
      setEstimate({ status: "idle" });
      return;
    }

    // Abort previous request
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    setEstimate({ status: "loading" });

    try {
      const response = await fetch("/api/gas/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chainId,
          actionSlug,
          config: {
            contractAddress: config.contractAddress,
            abi: config.abi,
            abiFunction: config.abiFunction,
            functionArgs: config.functionArgs,
            recipientAddress: config.recipientAddress,
            amount: config.amount,
            tokenConfig: config.tokenConfig,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        setEstimate({
          status: "error",
          message: data.error ?? "Failed to estimate gas",
        });
        return;
      }

      const data = (await response.json()) as {
        estimatedGas: string;
        chainDefaults: { multiplier: number; conservative: number };
      };

      setEstimate({ status: "success", estimatedGas: data.estimatedGas });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return; // Ignore aborted requests
      }
      setEstimate({
        status: "error",
        message:
          error instanceof Error ? error.message : "Failed to estimate gas",
      });
    }
  }, [canEstimate, chainId, actionSlug, config]);

  // Debounced effect for fetching estimate
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      fetchEstimate().catch(() => {
        // Errors handled inside fetchEstimate via setEstimate
      });
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [fetchEstimate]);

  // Cleanup abort controller on unmount
  useEffect(
    () => () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    },
    []
  );

  const handleModeChange = (newMode: "multiplier" | "maxGasLimit") => {
    if (newMode === mode) {
      return;
    }
    // Reset value when switching modes
    onChange(serializeConfig({ mode: newMode, value: "" }));
  };

  const handleValueChange = (newValue: string) => {
    if (mode === "multiplier" && newValue === "") {
      // Empty multiplier = use chain default, store empty string for backward compat
      onChange("");
      return;
    }
    onChange(serializeConfig({ mode, value: newValue }));
  };

  // Calculated gas limit display (multiplier mode)
  const calculatedGasLimit = useMemo(() => {
    if (mode !== "multiplier" || estimate.status !== "success") {
      return;
    }
    const multiplier = inputValue
      ? Number.parseFloat(inputValue)
      : defaultMultiplier;
    if (Number.isNaN(multiplier)) {
      return;
    }
    const estimated = Number(estimate.estimatedGas);
    return Math.ceil(estimated * multiplier);
  }, [mode, estimate, inputValue, defaultMultiplier]);

  // Warnings for max gas limit mode
  const maxGasWarning = useMemo(() => {
    if (
      mode !== "maxGasLimit" ||
      estimate.status !== "success" ||
      !inputValue
    ) {
      return;
    }
    const limit = Number(inputValue);
    const estimated = Number(estimate.estimatedGas);
    if (Number.isNaN(limit) || Number.isNaN(estimated) || estimated === 0) {
      return;
    }
    if (limit < estimated) {
      return {
        level: "error" as const,
        message:
          "Gas limit is below the estimate \u2014 transaction will likely fail",
      };
    }
    if (limit < estimated * 1.2) {
      return {
        level: "warning" as const,
        message:
          "Gas limit is close to the estimate \u2014 consider adding headroom",
      };
    }
    return;
  }, [mode, estimate, inputValue]);

  return (
    <div className="space-y-2">
      {/* Mode toggle */}
      <div className="flex gap-1 rounded-md border p-0.5">
        <Button
          className="h-7 flex-1 text-xs"
          disabled={disabled}
          onClick={() => handleModeChange("multiplier")}
          size="sm"
          type="button"
          variant={mode === "multiplier" ? "secondary" : "ghost"}
        >
          Multiplier
        </Button>
        <Button
          className="h-7 flex-1 text-xs"
          disabled={disabled}
          onClick={() => handleModeChange("maxGasLimit")}
          size="sm"
          type="button"
          variant={mode === "maxGasLimit" ? "secondary" : "ghost"}
        >
          Max Gas Limit
        </Button>
      </div>

      {/* Input field */}
      {mode === "multiplier" ? (
        <Input
          disabled={disabled}
          id={field.key}
          max={field.max ?? 10}
          min={field.min ?? 1}
          onChange={(e) => handleValueChange(e.target.value)}
          placeholder={`Auto (${defaultMultiplier}x for ${displayName})`}
          step={field.step ?? 0.01}
          type="number"
          value={inputValue}
        />
      ) : (
        <Input
          disabled={disabled}
          id={field.key}
          min={0}
          onChange={(e) => handleValueChange(e.target.value)}
          placeholder="e.g. 500000"
          step={1}
          type="number"
          value={inputValue}
        />
      )}

      {/* Gas estimate display */}
      <div className="space-y-1">
        {estimate.status === "loading" && (
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Spinner className="size-3" />
            Estimating gas...
          </div>
        )}
        {estimate.status === "success" && (
          <p className="text-muted-foreground text-xs">
            Estimated gas: {formatGasNumber(estimate.estimatedGas)}
          </p>
        )}
        {estimate.status === "error" && (
          <p className="text-muted-foreground text-xs">{estimate.message}</p>
        )}
        {estimate.status === "idle" &&
          canEstimate === false &&
          chainId &&
          actionSlug && (
            <p className="text-muted-foreground/70 text-xs">
              {hasTemplateRefs(config)
                ? "Cannot estimate with template references"
                : "Configure required fields to see gas estimate"}
            </p>
          )}

        {/* Calculated result (multiplier mode) */}
        {mode === "multiplier" &&
          calculatedGasLimit !== undefined &&
          estimate.status === "success" && (
            <p className="text-muted-foreground text-xs">
              {formatGasNumber(estimate.estimatedGas)} x{" "}
              {inputValue || defaultMultiplier}x ={" "}
              {calculatedGasLimit.toLocaleString()} gas limit
            </p>
          )}

        {/* Helper text (multiplier mode) */}
        {mode === "multiplier" && (
          <p className="text-muted-foreground/70 text-xs">
            {inputValue
              ? `Custom: ${inputValue}x (chain default: ${defaultMultiplier}x)`
              : `Using chain default: ${defaultMultiplier}x`}
          </p>
        )}

        {/* Warnings (max gas limit mode) */}
        {maxGasWarning && (
          <div
            className={`flex items-start gap-1.5 text-xs ${
              maxGasWarning.level === "error"
                ? "text-destructive"
                : "text-yellow-600 dark:text-yellow-500"
            }`}
          >
            <AlertTriangle className="mt-0.5 size-3 shrink-0" />
            {maxGasWarning.message}
          </div>
        )}
      </div>
    </div>
  );
}
