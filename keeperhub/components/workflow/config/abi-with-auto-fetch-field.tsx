"use client";

import { ethers } from "ethers";
import { ExternalLink, Info } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChainResponse } from "@/app/api/chains/route";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { TemplateBadgeTextarea } from "@/components/ui/template-badge-textarea";
import type { ActionConfigFieldBase } from "@/plugins";

function DiamondUnsupportedAlert() {
  return (
    <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
      <Info className="h-4 w-4 text-amber-600 dark:text-amber-400" />
      <AlertTitle className="text-amber-900 dark:text-amber-100">
        Diamond Proxy Contract Detected
      </AlertTitle>
      <AlertDescription className="text-amber-800 dark:text-amber-200">
        <p className="text-sm">
          Diamond proxy contracts (EIP-2535) are not currently supported. Please
          use a regular contract or proxy contract instead.
        </p>
      </AlertDescription>
    </Alert>
  );
}

type ProxyContractAlertProps = {
  implementationAddress: string;
  network: string;
  proxyWarning: string | null;
  useProxyAbi: boolean;
  isLoading: boolean;
  chains: ChainResponse[];
  onToggleProxyAbi: (useProxy: boolean) => void;
};

function ProxyContractAlert({
  implementationAddress,
  network,
  proxyWarning,
  useProxyAbi,
  isLoading,
  chains,
  onToggleProxyAbi,
}: ProxyContractAlertProps) {
  const explorerUrl = useMemo(() => {
    if (!(network && implementationAddress) || chains.length === 0) {
      return null;
    }

    const chainIdNum =
      typeof network === "string" ? Number.parseInt(network, 10) : network;

    if (Number.isNaN(chainIdNum)) {
      return null;
    }

    const chain = chains.find((c) => c.chainId === chainIdNum);
    if (
      chain?.explorerUrl &&
      chain?.explorerAddressPath &&
      implementationAddress
    ) {
      const path = chain.explorerAddressPath.replace(
        "{address}",
        implementationAddress
      );
      return `${chain.explorerUrl}${path}`;
    }

    return null;
  }, [network, implementationAddress, chains]);

  return (
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
            {explorerUrl && (
              <a
                className="ml-1.5 inline-flex items-center text-blue-700 underline hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-200"
                href={explorerUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </p>
          {proxyWarning && (
            <p className="text-amber-700 dark:text-amber-300">{proxyWarning}</p>
          )}
          <div className="flex items-center gap-2">
            <Button
              className="h-auto p-0 text-blue-700 underline dark:text-blue-300"
              disabled={isLoading}
              onClick={() => onToggleProxyAbi(!useProxyAbi)}
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
  );
}

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
  // Diamond contract state
  const [isDiamond, setIsDiamond] = useState(false);
  const [chains, setChains] = useState<ChainResponse[]>([]);

  const contractAddress = (config[contractAddressField] as string) || "";
  const network = (config[networkField] as string) || "";

  // Fetch chains once on mount
  useEffect(() => {
    async function fetchChains() {
      try {
        const response = await fetch("/api/chains");
        const data = (await response.json()) as ChainResponse[];
        setChains(data);
      } catch (err) {
        console.error("Failed to fetch chains:", err);
      }
    }

    fetchChains();
  }, []);

  // Sync ABI when toggle state changes for regular proxies
  // Use a ref to track the last synced toggle state to avoid infinite loops
  const lastUseProxyAbiRef = useRef<boolean | null>(null);

  // Track last fetched (contract, network) so we only auto-fetch when they change
  const lastFetchedRef = useRef<{
    contractAddress: string;
    network: string;
  } | null>(null);
  const currentTargetRef = useRef<{ contractAddress: string; network: string }>(
    {
      contractAddress: "",
      network: "",
    }
  );
  const performAbiFetchRef = useRef<(() => Promise<void>) | null>(null);

  const abiToString = useCallback((abi: string | null): string | null => {
    if (!abi) {
      return null;
    }
    return typeof abi === "string" ? abi : JSON.stringify(abi);
  }, []);

  const getAbiForToggle = useCallback((): string | null => {
    if (useProxyAbi) {
      return abiToString(proxyAbi);
    }
    return abiToString(implementationAbi);
  }, [useProxyAbi, proxyAbi, implementationAbi, abiToString]);

  useEffect(() => {
    if (!isProxy || isDiamond || !implementationAddress) {
      return;
    }

    // Only sync if the toggle state actually changed
    if (lastUseProxyAbiRef.current === useProxyAbi) {
      return;
    }

    lastUseProxyAbiRef.current = useProxyAbi;

    const abiString = getAbiForToggle();
    if (abiString) {
      onChange(abiString);
    }
  }, [
    useProxyAbi,
    isProxy,
    isDiamond,
    implementationAddress,
    onChange,
    getAbiForToggle,
  ]);

  // Validate contract address
  const isValidAddress = useMemo(() => {
    if (!contractAddress || contractAddress.trim() === "") {
      return false;
    }
    try {
      return ethers.isAddress(contractAddress);
    } catch {
      return false;
    }
  }, [contractAddress]);

  const resetProxyState = useCallback(() => {
    setIsProxy(false);
    setImplementationAddress(null);
    setProxyAddress(null);
    setUseProxyAbi(false);
    setProxyWarning(null);
    setProxyAbi(null);
    setImplementationAbi(null);
    setIsDiamond(false);
  }, []);

  const handleDiamondContract = useCallback(() => {
    setIsDiamond(true);
  }, []);

  const handleProxyContract = useCallback(
    (data: {
      implementationAddress: string;
      proxyAddress?: string;
      abi: string;
      proxyAbi?: string;
      warning?: string;
    }) => {
      setIsProxy(true);
      setImplementationAddress(data.implementationAddress);
      setProxyAddress(data.proxyAddress || contractAddress);
      setImplementationAbi(data.abi);
      setProxyAbi(data.proxyAbi || null);
      setProxyWarning(data.warning || null);

      // Always use implementation ABI by default when proxy is detected
      setUseProxyAbi(false);
      onChange(data.abi);
    },
    [contractAddress, onChange]
  );

  const performAbiFetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    resetProxyState();

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
        isDiamond?: boolean;
        implementationAddress?: string;
        proxyAddress?: string;
        proxyAbi?: string;
        warning?: string;
        error?: string;
      };

      if (data.isDiamond) {
        handleDiamondContract();
        return;
      }

      if (!(response.ok && data.success && data.abi)) {
        const errorMessage = data.error || "Failed to fetch ABI from Etherscan";
        throw new Error(errorMessage);
      }

      if (data.isProxy && data.implementationAddress) {
        handleProxyContract({
          implementationAddress: data.implementationAddress,
          proxyAddress: data.proxyAddress,
          abi: data.abi,
          proxyAbi: data.proxyAbi,
          warning: data.warning,
        });
      } else {
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
  }, [
    contractAddress,
    network,
    onChange,
    resetProxyState,
    handleDiamondContract,
    handleProxyContract,
  ]);

  const handleFetchAbi = useCallback(async () => {
    if (!(isValidAddress && network)) {
      setError("Please enter a valid contract address and select a network");
      return;
    }
    await performAbiFetch();
  }, [isValidAddress, network, performAbiFetch]);

  // Auto-fetch ABI when contract address or network changes (debounced, once per pair)
  // stored performAbiFetch in a ref to avoid stale function references
  performAbiFetchRef.current = performAbiFetch;
  useEffect(() => {
    const TIMEOUT_BEFORE_FETCH_DELAY = 600;

    if (!(isValidAddress && network) || useManualAbi) {
      return;
    }

    currentTargetRef.current = { contractAddress, network };
    const last = lastFetchedRef.current;

    if (
      last?.contractAddress === contractAddress &&
      last?.network === network
    ) {
      return;
    }
    const timeoutId = setTimeout(() => {
      lastFetchedRef.current = { ...currentTargetRef.current };
      const fn = performAbiFetchRef.current;
      if (fn) {
        fn().catch((err: unknown) => {
          const message =
            err instanceof Error ? err.message : "Failed to fetch ABI";
          setError(message);
        });
      }
    }, TIMEOUT_BEFORE_FETCH_DELAY);
    return () => {
      clearTimeout(timeoutId);
    };
  }, [contractAddress, network, isValidAddress, useManualAbi]);

  const fetchProxyAbi = useCallback(async (): Promise<string> => {
    if (!proxyAddress) {
      throw new Error("Proxy address not available");
    }

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
      proxyAbi?: string;
      error?: string;
    };

    if (!(response.ok && data.success)) {
      throw new Error(data.error || "Failed to fetch proxy ABI");
    }

    const abiToUse = data.proxyAbi || data.abi;
    if (!abiToUse) {
      throw new Error("No ABI returned from API");
    }

    return abiToUse;
  }, [proxyAddress, network]);

  const handleToggleProxyAbi = async (useProxy: boolean) => {
    setUseProxyAbi(useProxy);

    if (!useProxy || proxyAbi || !proxyAddress) {
      return;
    }

    setIsLoading(true);
    try {
      const abi = await fetchProxyAbi();
      setProxyAbi(abi);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch proxy ABI";
      console.error("[Proxy UI] Error:", errorMessage);
      setError(errorMessage);
      setUseProxyAbi(false);
    } finally {
      setIsLoading(false);
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

      {isDiamond && <DiamondUnsupportedAlert />}

      {isProxy && !isDiamond && implementationAddress && (
        <ProxyContractAlert
          chains={chains}
          implementationAddress={implementationAddress}
          isLoading={isLoading}
          network={network}
          onToggleProxyAbi={handleToggleProxyAbi}
          proxyWarning={proxyWarning}
          useProxyAbi={useProxyAbi}
        />
      )}

      <TemplateBadgeTextarea
        disabled={disabled || isLoading || !useManualAbi}
        id={field.key}
        key={`${field.key}-${value?.length || 0}-${useProxyAbi ? "proxy" : "impl"}`}
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
          {(() => {
            if (!(isValidAddress && network)) {
              return "Enter a contract address and select a network to fetch the ABI";
            }
            if (isLoading) {
              return "Fetching ABI from Etherscan...";
            }
            return "Click the button above to fetch the ABI from Etherscan";
          })()}
        </p>
      )}
    </div>
  );
}
