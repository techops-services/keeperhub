"use client";

import { Loader2, Plus, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  CustomToken,
  SupportedToken,
  TokenFieldValue,
} from "@/keeperhub/lib/wallet/types";
import type { ActionConfigFieldBase } from "@/plugins/registry";

type TokenSelectFieldProps = {
  field: ActionConfigFieldBase;
  config: Record<string, unknown>;
  onUpdateConfig: (key: string, value: unknown) => void;
  disabled?: boolean;
  networkField?: string;
};

/**
 * Token Select Field
 *
 * Provides a toggle between:
 * - Supported Tokens: Multi-select dropdown of system-wide stablecoins
 * - Custom Token: Text input for any ERC20 token address(es)
 *
 * The field stores a JSON object with the mode and selected values.
 */
export function TokenSelectField({
  field,
  config,
  onUpdateConfig,
  disabled,
  networkField = "network",
}: TokenSelectFieldProps) {
  const [tokens, setTokens] = useState<SupportedToken[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevNetworkRef = useRef<string | undefined>(undefined);
  const [customInputValue, setCustomInputValue] = useState("");
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Parse current value
  const currentValue = parseTokenValue(config[field.key] as string | undefined);
  const networkValue = config[networkField] as string | undefined;

  // Reset token selection when network changes
  useEffect(() => {
    if (
      prevNetworkRef.current !== undefined &&
      prevNetworkRef.current !== networkValue
    ) {
      // Network changed - reset the selection
      const resetValue: TokenFieldValue = {
        mode: currentValue.mode,
        supportedTokenIds: [],
        customTokens: [],
      };
      onUpdateConfig(field.key, JSON.stringify(resetValue));
      setValidationError(null);
    }
    prevNetworkRef.current = networkValue;
  }, [networkValue, currentValue.mode, field.key, onUpdateConfig]);

  // Fetch supported tokens for the selected chain
  useEffect(() => {
    if (!networkValue) {
      setTokens([]);
      return;
    }

    const fetchTokens = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/supported-tokens?network=${encodeURIComponent(networkValue)}`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch supported tokens");
        }
        const data = await response.json();
        setTokens(data.tokens || []);
      } catch (err) {
        console.error("[TokenSelectField] Error fetching tokens:", err);
        setError("Failed to load supported tokens");
        setTokens([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTokens();
  }, [networkValue]);

  // Handle mode toggle
  const handleModeChange = (useCustom: boolean) => {
    const newValue: TokenFieldValue = {
      mode: useCustom ? "custom" : "supported",
      supportedTokenIds: currentValue.supportedTokenIds,
      customTokens: currentValue.customTokens,
    };
    onUpdateConfig(field.key, JSON.stringify(newValue));
    setValidationError(null);
  };

  // Handle supported token selection
  const handleTokenSelect = (tokenId: string) => {
    // Toggle: if already selected, remove; otherwise, add
    const currentIds = currentValue.supportedTokenIds;
    const newIds = currentIds.includes(tokenId)
      ? currentIds.filter((id) => id !== tokenId)
      : [...currentIds, tokenId];

    const newValue: TokenFieldValue = {
      ...currentValue,
      supportedTokenIds: newIds,
    };
    onUpdateConfig(field.key, JSON.stringify(newValue));
  };

  // Add custom token - validate and fetch symbol
  const handleAddCustomToken = async () => {
    const trimmed = customInputValue.trim();
    if (!(trimmed && networkValue)) {
      return;
    }

    // Avoid duplicates
    if (
      currentValue.customTokens.some(
        (t) => t.address.toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      setCustomInputValue("");
      setValidationError(null);
      return;
    }

    setValidating(true);
    setValidationError(null);

    try {
      const response = await fetch(
        `/api/validate-token?address=${encodeURIComponent(trimmed)}&network=${encodeURIComponent(networkValue)}`
      );
      const data = await response.json();

      if (!data.valid) {
        setValidationError(data.error || "Invalid token");
        setValidating(false);
        return;
      }

      // Add the validated token
      const newValue: TokenFieldValue = {
        ...currentValue,
        customTokens: [
          ...currentValue.customTokens,
          { address: data.token.address, symbol: data.token.symbol },
        ],
      };
      onUpdateConfig(field.key, JSON.stringify(newValue));
      setCustomInputValue("");
      setValidationError(null);
    } catch (err) {
      console.error("[TokenSelectField] Error validating token:", err);
      setValidationError("Failed to validate token");
    } finally {
      setValidating(false);
    }
  };

  // Remove a custom token
  const handleRemoveCustomToken = (address: string) => {
    const newTokens = currentValue.customTokens.filter(
      (t) => t.address.toLowerCase() !== address.toLowerCase()
    );
    const newValue: TokenFieldValue = {
      ...currentValue,
      customTokens: newTokens,
    };
    onUpdateConfig(field.key, JSON.stringify(newValue));
  };

  const isCustomMode = currentValue.mode === "custom";

  // Check if we have any selected tokens
  const hasSelectedTokens =
    currentValue.supportedTokenIds.length > 0 ||
    currentValue.customTokens.length > 0;

  // Render supported tokens section based on state
  const renderSupportedTokensSection = () => {
    if (!networkValue) {
      return (
        <div className="rounded-md border border-dashed p-3 text-center text-muted-foreground text-sm">
          Select a network first to see available tokens
        </div>
      );
    }
    if (loading) {
      return (
        <div className="rounded-md border border-dashed p-3 text-center text-muted-foreground text-sm">
          Loading supported tokens...
        </div>
      );
    }
    if (error) {
      return (
        <div className="rounded-md border border-dashed p-3 text-center text-red-500 text-sm">
          {error}
        </div>
      );
    }
    if (tokens.length === 0) {
      return (
        <div className="rounded-md border border-dashed p-3 text-center text-muted-foreground text-sm">
          No supported tokens for this network
        </div>
      );
    }
    return (
      <Select disabled={disabled} onValueChange={handleTokenSelect} value="">
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select supported tokens..." />
        </SelectTrigger>
        <SelectContent>
          {tokens.map((token) => {
            const isSelected = currentValue.supportedTokenIds.includes(
              token.id
            );
            return (
              <SelectItem key={token.id} value={token.id}>
                <div className="flex items-center gap-2">
                  {token.logoUrl && (
                    <Image
                      alt={token.symbol}
                      className="h-4 w-4 rounded-full"
                      height={16}
                      src={token.logoUrl}
                      width={16}
                    />
                  )}
                  <span>
                    {token.symbol} - {token.name}
                  </span>
                  {isSelected && <span className="text-primary">✓</span>}
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    );
  };

  return (
    <div className="space-y-3">
      {/* Mode Toggle */}
      <div className="space-y-2">
        <Label className="text-muted-foreground text-xs">Token Mode</Label>
        <Select
          disabled={disabled}
          onValueChange={(value) => handleModeChange(value === "custom")}
          value={currentValue.mode}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="supported">Stablecoins</SelectItem>
            <SelectItem value="custom">Import Token Address</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Supported Tokens Multi-Select */}
      {!isCustomMode && (
        <div className="space-y-2">{renderSupportedTokensSection()}</div>
      )}

      {/* Custom Token Address Input */}
      {isCustomMode && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              className={`flex-1 ${validationError ? "border-red-500" : ""}`}
              disabled={disabled || validating}
              id={`${field.key}-custom`}
              onChange={(e) => {
                setCustomInputValue(e.target.value);
                setValidationError(null);
              }}
              placeholder="0x... (ERC20 token contract address)"
              value={customInputValue}
            />
            <Button
              className="shrink-0"
              disabled={
                disabled ||
                !customInputValue.trim() ||
                validating ||
                !networkValue
              }
              onClick={handleAddCustomToken}
              size="sm"
              type="button"
              variant="outline"
            >
              {validating ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-1 h-4 w-4" />
              )}
              {validating ? "Validating..." : "Add"}
            </Button>
          </div>
          {validationError && (
            <p className="text-red-500 text-xs">{validationError}</p>
          )}
          {!networkValue && isCustomMode && (
            <p className="text-muted-foreground text-xs">
              Select a network first to add custom tokens
            </p>
          )}
        </div>
      )}

      {/* All Selected Tokens - Always visible */}
      {hasSelectedTokens && (
        <div className="space-y-1">
          <Label className="text-muted-foreground text-xs">
            Selected Tokens
          </Label>
          <div className="flex flex-wrap gap-1">
            {/* Supported token badges */}
            {currentValue.supportedTokenIds.map((tokenId) => {
              const token = tokens.find((t) => t.id === tokenId);
              if (!token) {
                return null;
              }
              return (
                <button
                  className="flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-blue-700 text-xs hover:bg-blue-500/20 dark:text-blue-400"
                  disabled={disabled}
                  key={`supported-${tokenId}`}
                  onClick={() => handleTokenSelect(tokenId)}
                  type="button"
                >
                  {token.symbol}
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              );
            })}
            {/* Imported (custom) token badges */}
            {currentValue.customTokens.map((customToken) => (
              <button
                className="flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-orange-700 text-xs hover:bg-orange-500/20 dark:text-orange-400"
                disabled={disabled}
                key={`custom-${customToken.address}`}
                onClick={() => handleRemoveCustomToken(customToken.address)}
                type="button"
              >
                {customToken.symbol}{" "}
                <span className="text-orange-500/70">(imported)</span>
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Value Parsing Utilities
// ============================================================================

function parseTokenValue(value: string | undefined): TokenFieldValue {
  if (!value) {
    return {
      mode: "supported",
      supportedTokenIds: [],
      customTokens: [],
    };
  }

  try {
    const parsed = JSON.parse(value);

    // Parse custom tokens - support multiple formats for backwards compatibility
    let customTokens: CustomToken[] = [];
    if (Array.isArray(parsed.customTokens)) {
      customTokens = parsed.customTokens;
    } else if (Array.isArray(parsed.customTokenAddresses)) {
      // Legacy: convert addresses to tokens with unknown symbol
      customTokens = parsed.customTokenAddresses
        .filter((a: string) => a && a.trim() !== "")
        .map((address: string) => ({ address, symbol: "???" }));
    } else if (parsed.customTokenAddress) {
      // Legacy: single address
      customTokens = [{ address: parsed.customTokenAddress, symbol: "???" }];
    }

    return {
      mode: parsed.mode || "supported",
      supportedTokenIds: Array.isArray(parsed.supportedTokenIds)
        ? parsed.supportedTokenIds
        : [],
      customTokens,
    };
  } catch {
    // Legacy support: if value is just a string (old format), treat as custom
    return {
      mode: "custom",
      supportedTokenIds: [],
      customTokens: [{ address: value, symbol: "???" }],
    };
  }
}

/**
 * Extract token addresses from the field value for step execution
 * Returns an array of ALL token addresses (both supported and custom)
 */
export function extractTokenAddresses(
  value: string | undefined,
  supportedTokens: SupportedToken[]
): string[] {
  const parsed = parseTokenValue(value);

  // Get supported token addresses
  const supportedAddresses = parsed.supportedTokenIds
    .map((id) => supportedTokens.find((t) => t.id === id)?.tokenAddress)
    .filter((addr): addr is string => Boolean(addr));

  // Get custom token addresses
  const customAddresses = parsed.customTokens.map((t) => t.address);

  // Return all unique addresses
  return [...new Set([...supportedAddresses, ...customAddresses])];
}
