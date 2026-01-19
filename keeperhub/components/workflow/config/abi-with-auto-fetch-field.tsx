"use client";

import { ethers } from "ethers";
import { Info } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { TemplateBadgeTextarea } from "@/components/ui/template-badge-textarea";
import type { ActionConfigFieldBase } from "@/plugins";

type DiamondProxyAlertProps = {
  facets: Array<{ address: string; name: string | null; abi?: string }>;
  selectedFacetAddress: string | "proxy" | "direct";
  diamondDirectAbi: string | null;
  isLoading: boolean;
  proxyWarning: string | null;
  onFacetSelection: (selection: string) => void;
};

function DiamondProxyAlert({
  facets,
  selectedFacetAddress,
  diamondDirectAbi,
  isLoading,
  proxyWarning,
  onFacetSelection,
}: DiamondProxyAlertProps) {
  return (
    <Alert className="border-purple-200 bg-purple-50 dark:border-purple-800 dark:bg-purple-950">
      <Info className="h-4 w-4 text-purple-600 dark:text-purple-400" />
      <AlertTitle className="text-purple-900 dark:text-purple-100">
        Diamond Proxy Contract Detected
      </AlertTitle>
      <AlertDescription className="text-purple-800 dark:text-purple-200">
        <div className="mt-1 space-y-2">
          <div className="space-y-2">
            <div>
              <Label className="font-medium text-xs">
                Select Contract/Facet:
              </Label>
              <Select
                disabled={isLoading}
                onValueChange={onFacetSelection}
                value={selectedFacetAddress}
              >
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder="Select contract or facet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="proxy">
                    Diamond Proxy (All Facets - {facets.length} facet
                    {facets.length !== 1 ? "s" : ""})
                  </SelectItem>
                  {diamondDirectAbi && (
                    <SelectItem value="direct">
                      Direct Contract (Diamond's own ABI)
                    </SelectItem>
                  )}
                  {facets.map((facet) => {
                    const displayName = facet.name
                      ? `${facet.name} (${facet.address.slice(0, 6)}...${facet.address.slice(-4)})`
                      : `${facet.address.slice(0, 6)}...${facet.address.slice(-4)}`;
                    return (
                      <SelectItem
                        disabled={!facet.abi}
                        key={facet.address}
                        value={facet.address}
                      >
                        {displayName}
                        {!facet.abi && " (ABI unavailable)"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            {proxyWarning && (
              <p className="text-amber-700 text-xs dark:text-amber-300">
                {proxyWarning}
              </p>
            )}
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
  const [diamondProxyAbi, setDiamondProxyAbi] = useState<string | null>(null);
  const [diamondDirectAbi, setDiamondDirectAbi] = useState<string | null>(null);
  const [facets, setFacets] = useState<
    Array<{ address: string; name: string | null; abi?: string }>
  >([]);
  const [selectedFacetAddress, setSelectedFacetAddress] = useState<
    string | "proxy" | "direct"
  >("proxy"); // "proxy" = combined, "direct" = Diamond's own, or facet address
  const lastFetchedRef = useRef<string>("");
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const contractAddress = (config[contractAddressField] as string) || "";
  const network = (config[networkField] as string) || "";

  // Debug: Log when value prop changes
  useEffect(() => {
    console.log("[ABI Field] Value prop changed:", {
      valueLength: value?.length || 0,
      isProxy,
      useProxyAbi,
      isDiamond,
      selectedFacetAddress,
    });
  }, [value, isProxy, useProxyAbi, isDiamond, selectedFacetAddress]);

  // Sync ABI when toggle state changes for regular proxies
  // Use a ref to track the last synced toggle state to avoid infinite loops
  const lastUseProxyAbiRef = React.useRef<boolean | null>(null);

  useEffect(() => {
    if (isProxy && !isDiamond && implementationAddress) {
      // Only sync if the toggle state actually changed
      if (lastUseProxyAbiRef.current !== useProxyAbi) {
        lastUseProxyAbiRef.current = useProxyAbi;

        if (useProxyAbi && proxyAbi) {
          const abiString =
            typeof proxyAbi === "string" ? proxyAbi : JSON.stringify(proxyAbi);

          console.log("[Proxy UI] useEffect: Calling onChange with proxy ABI");
          // This forces the parent to update its config state
          onChange(abiString);
        } else if (!useProxyAbi && implementationAbi) {
          const abiString =
            typeof implementationAbi === "string"
              ? implementationAbi
              : JSON.stringify(implementationAbi);

          onChange(abiString);
        }
      }
    }
  }, [
    useProxyAbi,
    proxyAbi,
    implementationAbi,
    isProxy,
    isDiamond,
    implementationAddress,
    onChange,
    value,
  ]);

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

  const performAbiFetch = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setIsProxy(false);
    setImplementationAddress(null);
    setProxyAddress(null);
    setUseProxyAbi(false);
    setProxyWarning(null);
    setProxyAbi(null);
    setImplementationAbi(null);
    setIsDiamond(false);
    setDiamondProxyAbi(null);
    setDiamondDirectAbi(null);
    setFacets([]);
    setSelectedFacetAddress("proxy");

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
        facets?: Array<{ address: string; name: string | null; abi?: string }>;
        diamondProxyAbi?: string;
        diamondDirectAbi?: string;
        warning?: string;
        error?: string;
      };

      if (!(response.ok && data.success && data.abi)) {
        const errorMessage = data.error || "Failed to fetch ABI from Etherscan";
        throw new Error(errorMessage);
      }

      // Handle Diamond contract detection (check before regular proxy)
      if (data.isDiamond && data.diamondProxyAbi) {
        setIsDiamond(true);
        setIsProxy(true);
        setDiamondProxyAbi(data.diamondProxyAbi);
        setDiamondDirectAbi(data.diamondDirectAbi || null);
        const facetsData = data.facets || [];
        setFacets(facetsData);
        setProxyAddress(data.proxyAddress || contractAddress);
        setProxyWarning(data.warning || null);
        setSelectedFacetAddress("proxy");

        // Use diamondProxyAbi explicitly to ensure we're using the combined ABI
        onChange(data.diamondProxyAbi);
      } else if (data.isProxy && data.implementationAddress) {
        setIsProxy(true);
        setImplementationAddress(data.implementationAddress);
        setProxyAddress(data.proxyAddress || contractAddress);
        setImplementationAbi(data.abi);
        setProxyAbi(data.proxyAbi || null);
        setProxyWarning(data.warning || null);

        // If we have a warning (e.g., unverified implementation), we're using proxy ABI
        if (data.warning) {
          setUseProxyAbi(true);
          onChange(data.proxyAbi || data.abi);
        } else {
          setUseProxyAbi(false);
          onChange(data.abi);
        }
      } else {
        // Not a proxy, use the ABI directly
        onChange(data.abi);
      }

      setError(null);
      const fetchKey = `${contractAddress.toLowerCase()}-${network}`;
      lastFetchedRef.current = fetchKey;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch ABI";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [contractAddress, network, onChange]);

  const handleFetchAbi = useCallback(
    async (skipValidation = false) => {
      if (!(skipValidation || (isValidAddress && network))) {
        setError("Please enter a valid contract address and select a network");
        return;
      }

      // Create a unique key for this fetch request
      const fetchKey = `${contractAddress.toLowerCase()}-${network}`;

      if (lastFetchedRef.current === fetchKey) {
        return;
      }

      await performAbiFetch();
    },
    [contractAddress, network, isValidAddress, performAbiFetch]
  );

  const handleButtonClick = () => {
    handleFetchAbi(false);
  };

  const handleFacetSelection = (selection: string) => {
    setSelectedFacetAddress(selection);

    if (selection === "proxy") {
      // User wants to use Diamond Proxy mode (combined facets)
      if (diamondProxyAbi) {
        console.log(
          "[Diamond UI] Switching to Diamond Proxy mode (combined facets)"
        );
        onChange(diamondProxyAbi);
      } else {
        console.error("[Diamond UI] Diamond Proxy ABI not available!");
      }
    } else if (selection === "direct") {
      // User wants to use Direct Contract mode (Diamond's own ABI)
      if (diamondDirectAbi) {
        console.log(
          "[Diamond UI] Switching to Direct Contract mode (Diamond's own ABI)"
        );
        onChange(diamondDirectAbi);
      } else {
        setError(
          "Diamond contract's own ABI is not available (contract may not be verified). Using Diamond Proxy mode."
        );
        setSelectedFacetAddress("proxy");
        if (diamondProxyAbi) {
          onChange(diamondProxyAbi);
        }
      }
    } else {
      // User selected a specific facet
      const selectedFacet = facets.find((f) => f.address === selection);
      console.log("[Diamond UI] Facet selection:", {
        selection,
        foundFacet: !!selectedFacet,
        facetName: selectedFacet?.name,
        hasAbi: !!selectedFacet?.abi,
        abiLength: selectedFacet?.abi?.length || 0,
        allFacets: facets.map((f) => ({
          address: f.address,
          name: f.name,
          hasAbi: !!f.abi,
        })),
      });

      if (selectedFacet?.abi) {
        console.log(
          `[Diamond UI] Switching to facet: ${selectedFacet.name || selection}, ABI length: ${selectedFacet.abi.length}`
        );
        // Parse and log function count
        try {
          const parsedAbi = JSON.parse(selectedFacet.abi) as unknown[];
          const functionCount = parsedAbi.filter(
            (item) => (item as { type?: string }).type === "function"
          ).length;
          console.log(
            `[Diamond UI] Facet ABI contains ${functionCount} functions`
          );
        } catch (e) {
          console.error("[Diamond UI] Failed to parse facet ABI:", e);
        }
        onChange(selectedFacet.abi);
      } else {
        const errorMsg = `ABI for selected facet ${selectedFacet?.name || selection} is not available.`;
        console.error("[Diamond UI]", errorMsg);
        setError(errorMsg);
        // Fall back to proxy mode
        setSelectedFacetAddress("proxy");
        if (diamondProxyAbi) {
          onChange(diamondProxyAbi);
        }
      }
    }
  };

  const handleToggleProxyAbi = async (useProxy: boolean) => {
    console.log("[Proxy UI] Toggle clicked, useProxy:", useProxy);
    console.log("[Proxy UI] Current state:", {
      proxyAbi: proxyAbi ? `Length: ${proxyAbi.length}` : "null",
      implementationAbi: implementationAbi
        ? `Length: ${implementationAbi.length}`
        : "null",
      useProxyAbi,
    });

    setUseProxyAbi(useProxy);
    // Don't call onChange here - let the useEffect handle it
    // This ensures the state update happens first, then the useEffect triggers
    // However, if we need to fetch the proxy ABI, we still need to do that
    if (useProxy && !proxyAbi && proxyAddress) {
      // Need to fetch proxy ABI - but skip proxy detection to get the actual proxy ABI
      setIsLoading(true);
      try {
        console.log("[Proxy UI] Fetching proxy ABI directly...");
        // Fetch directly without proxy detection by calling getsourcecode
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

        if (response.ok && data.success) {
          // Use proxyAbi if available, otherwise use abi (which might be implementation)
          const abiToUse = data.proxyAbi || data.abi;
          if (abiToUse) {
            setProxyAbi(abiToUse);
            console.log("[Proxy UI] Fetched and set proxy ABI");
            // The useEffect will handle calling onChange
          } else {
            throw new Error("No ABI returned from API");
          }
        } else {
          throw new Error(data.error || "Failed to fetch proxy ABI");
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to fetch proxy ABI";
        console.error("[Proxy UI] Error:", errorMessage);
        setError(errorMessage);
        // Revert toggle on error
        setUseProxyAbi(false);
      } finally {
        setIsLoading(false);
      }
    }
  };

  // Auto-fetch ABI when contract address and network are valid
  useEffect(() => {
    // Clear any pending timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    // Don't auto-fetch if:
    // - Manual mode is enabled
    // - Already loading
    // - Invalid address or missing network
    // - Already fetched for this combination
    if (
      useManualAbi ||
      isLoading ||
      !isValidAddress ||
      !network ||
      lastFetchedRef.current === `${contractAddress.toLowerCase()}-${network}`
    ) {
      return;
    }

    // Debounce the fetch to avoid too many requests while typing
    fetchTimeoutRef.current = setTimeout(() => {
      handleFetchAbi(true);
    }, 500);

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [
    contractAddress,
    network,
    isValidAddress,
    useManualAbi,
    isLoading,
    handleFetchAbi,
  ]);

  // Reset last fetched ref when contract address or network changes significantly
  useEffect(() => {
    const currentKey = `${contractAddress.toLowerCase()}-${network}`;
    if (
      lastFetchedRef.current &&
      lastFetchedRef.current !== currentKey &&
      value
    ) {
      lastFetchedRef.current = "";
    }
  }, [contractAddress, network, value]);

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
          onClick={handleButtonClick}
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

      {isDiamond && diamondProxyAbi && (
        <DiamondProxyAlert
          diamondDirectAbi={diamondDirectAbi}
          facets={facets}
          isLoading={isLoading}
          onFacetSelection={handleFacetSelection}
          proxyWarning={proxyWarning}
          selectedFacetAddress={selectedFacetAddress}
        />
      )}

      {isProxy && !isDiamond && implementationAddress && (
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
        key={`${field.key}-${value?.length || 0}-${useProxyAbi ? "proxy" : "impl"}-${selectedFacetAddress}`}
        onChange={(val) => {
          console.log(
            "[ABI Field] Textarea onChange called with length:",
            val?.toString().length || 0
          );
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
            return "ABI will be fetched automatically, or click the button above to fetch manually";
          })()}
        </p>
      )}
    </div>
  );
}
