"use client";

import { ethers } from "ethers";
import { Info } from "lucide-react";
import React, { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { TemplateBadgeTextarea } from "@/components/ui/template-badge-textarea";
import type { ActionConfigFieldBase } from "@/plugins";

type FieldProps = {
  field: ActionConfigFieldBase;
  value: string;
  onChange: (value: unknown) => void;
  disabled?: boolean;
};

type AbiWithAutoFetchProps = FieldProps & {
  contractAddressField?: string;
  networkField?: string;
  config: Record<string, unknown>;
};

export function AbiWithAutoFetchField({
  field,
  value,
  onChange,
  disabled,
  contractAddressField = "contractAddress",
  networkField = "network",
  config,
}: AbiWithAutoFetchProps) {
  const [useManualAbi, setUseManualAbi] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProxy, setIsProxy] = useState(false);
  const [implementationAddress, setImplementationAddress] = useState<
    string | null
  >(null);
  const [proxyAddress, setProxyAddress] = useState<string | null>(null);
  const [useProxyAbi, setUseProxyAbi] = useState(false);
  const [proxyWarning, setProxyWarning] = useState<string | null>(null);
  const [proxyAbi, setProxyAbi] = useState<string | null>(null);
  const [implementationAbi, setImplementationAbi] = useState<string | null>(
    null
  );

  const contractAddress = (config[contractAddressField] as string) || "";
  const network = (config[networkField] as string) || "";

  // Validate contract address
  const isValidAddress = React.useMemo(() => {
    if (!contractAddress || contractAddress.trim() === "") {
      return false;
    }
    try {
      return ethers.isAddress(contractAddress);
    } catch {
      return false;
    }
  }, [contractAddress]);

  const handleFetchAbi = async () => {
    if (!(isValidAddress && network)) {
      setError("Please enter a valid contract address and select a network");
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsProxy(false);
    setImplementationAddress(null);
    setProxyAddress(null);
    setUseProxyAbi(false);
    setProxyWarning(null);
    setProxyAbi(null);
    setImplementationAbi(null);

    try {
      const response = await fetch("/api/web3/fetch-abi", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contractAddress,
          network,
        }),
      });

      const data = (await response.json()) as {
        success?: boolean;
        abi?: string;
        isProxy?: boolean;
        implementationAddress?: string;
        proxyAddress?: string;
        warning?: string;
        error?: string;
      };

      if (!(response.ok && data.success && data.abi)) {
        const errorMessage = data.error || "Failed to fetch ABI from Etherscan";
        throw new Error(errorMessage);
      }

      // Handle proxy detection
      if (data.isProxy && data.implementationAddress) {
        setIsProxy(true);
        setImplementationAddress(data.implementationAddress);
        setProxyAddress(data.proxyAddress || contractAddress);
        setImplementationAbi(data.abi);
        setProxyWarning(data.warning || null);

        // If we have a warning (e.g., unverified implementation), we're using proxy ABI
        if (data.warning) {
          setProxyAbi(data.abi);
          setUseProxyAbi(true);
        } else {
          // Default to implementation ABI for proxies
          onChange(data.abi);
        }
      } else {
        // Not a proxy, use the ABI directly
        onChange(data.abi);
      }

      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch ABI";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleProxyAbi = async (useProxy: boolean) => {
    setUseProxyAbi(useProxy);

    if (useProxy) {
      // User wants to use proxy ABI
      if (proxyAbi) {
        // We already have it
        onChange(proxyAbi);
      } else if (proxyAddress) {
        // Need to fetch proxy ABI
        setIsLoading(true);
        try {
          const response = await fetch("/api/web3/fetch-abi", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contractAddress: proxyAddress,
              network,
            }),
          });

          const data = (await response.json()) as {
            success?: boolean;
            abi?: string;
            error?: string;
          };

          if (response.ok && data.success && data.abi) {
            setProxyAbi(data.abi);
            onChange(data.abi);
          } else {
            throw new Error(data.error || "Failed to fetch proxy ABI");
          }
        } catch (err) {
          const errorMessage =
            err instanceof Error ? err.message : "Failed to fetch proxy ABI";
          setError(errorMessage);
        } finally {
          setIsLoading(false);
        }
      }
    } else {
      // User wants to use implementation ABI
      if (implementationAbi) {
        onChange(implementationAbi);
      }
    }
  };

  const handleManualToggle = (checked: boolean) => {
    setUseManualAbi(checked);
    setError(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button
          disabled={
            disabled || isLoading || !isValidAddress || !network || useManualAbi
          }
          onClick={handleFetchAbi}
          size="sm"
          type="button"
          variant="outline"
        >
          {isLoading ? (
            <>
              <Spinner className="mr-2" />
              Fetching...
            </>
          ) : (
            "Fetch ABI from Etherscan"
          )}
        </Button>
        <div className="flex items-center gap-2">
          <Checkbox
            checked={useManualAbi}
            disabled={disabled}
            id={`${field.key}-manual`}
            onCheckedChange={handleManualToggle}
          />
          <Label
            className="cursor-pointer font-normal text-sm"
            htmlFor={`${field.key}-manual`}
          >
            Use manual ABI
          </Label>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-destructive text-sm">
          {error}
        </div>
      )}

      {isProxy && implementationAddress && (
        <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-blue-900 dark:text-blue-100">
            Proxy Contract Detected
          </AlertTitle>
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            <div className="mt-1 space-y-2">
              <p>
                Using implementation ABI from{" "}
                <code className="rounded bg-blue-100 px-1 py-0.5 text-xs dark:bg-blue-900">
                  {`${implementationAddress.slice(0, 6)}...${implementationAddress.slice(-4)}`}
                </code>
              </p>
              {proxyWarning && (
                <p className="text-amber-700 dark:text-amber-300">
                  {proxyWarning}
                </p>
              )}
              <div className="flex items-center gap-2">
                <Button
                  className="h-auto p-0 text-blue-700 underline dark:text-blue-300"
                  disabled={isLoading}
                  onClick={() => handleToggleProxyAbi(!useProxyAbi)}
                  size="sm"
                  variant="link"
                >
                  {useProxyAbi
                    ? "Use implementation ABI instead"
                    : "Use proxy ABI instead"}
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      <TemplateBadgeTextarea
        disabled={disabled || isLoading || !useManualAbi}
        id={field.key}
        onChange={(val) => {
          onChange(val);
          setError(null);
        }}
        placeholder={
          useManualAbi
            ? "Paste contract ABI JSON here"
            : "Click 'Fetch ABI from Etherscan' or enable 'Use manual ABI' to enter manually"
        }
        rows={field.rows || 6}
        value={value}
      />

      {!(useManualAbi || error) && (
        <p className="text-muted-foreground text-xs">
          {isValidAddress && network
            ? "Click the button above to fetch the ABI from Etherscan"
            : "Enter a contract address and select a network to fetch the ABI"}
        </p>
      )}
    </div>
  );
}
