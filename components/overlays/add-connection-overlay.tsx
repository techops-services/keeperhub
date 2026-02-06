"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { Search } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { AuthDialog } from "@/components/auth/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { IntegrationIcon } from "@/components/ui/integration-icon";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  aiGatewayStatusAtom,
  aiGatewayTeamsAtom,
  aiGatewayTeamsLoadingAtom,
} from "@/lib/ai-gateway/state";
import { api } from "@/lib/api-client";
// start keeperhub
import { useSession } from "@/lib/auth-client";
import { getCustomIntegrationFormHandler } from "@/lib/extension-registry";
import { integrationsAtom } from "@/lib/integrations-store";
// end keeperhub
import type { IntegrationType } from "@/lib/types/integration";
import {
  getIntegration,
  getIntegrationLabels,
  getSortedIntegrationTypes,
} from "@/plugins";
import { getIntegrationDescriptions } from "@/plugins/registry";
import { AiGatewayConsentOverlay } from "./ai-gateway-consent-overlay";
import { ConfirmOverlay } from "./confirm-overlay";
import { Overlay } from "./overlay";
import { OverlayFooter } from "./overlay-footer";
import { useOverlay } from "./overlay-provider";

// System integrations that don't have plugins
const SYSTEM_INTEGRATION_TYPES: IntegrationType[] = ["database"];
const SYSTEM_INTEGRATION_LABELS: Record<string, string> = {
  database: "Database",
};
const SYSTEM_INTEGRATION_DESCRIPTIONS: Record<string, string> = {
  database: "Connect to PostgreSQL databases",
};

// Get all integration types (plugins + system)
const getIntegrationTypes = (): IntegrationType[] => [
  ...getSortedIntegrationTypes(),
  ...SYSTEM_INTEGRATION_TYPES,
];

// Get label for any integration type
const getLabel = (type: IntegrationType): string =>
  getIntegrationLabels()[type] || SYSTEM_INTEGRATION_LABELS[type] || type;

// Get description for any integration type
const getDescription = (type: IntegrationType): string =>
  getIntegrationDescriptions()[type] ||
  SYSTEM_INTEGRATION_DESCRIPTIONS[type] ||
  "";

type AddConnectionOverlayProps = {
  overlayId: string;
  onSuccess?: (integrationId: string) => void;
};

/**
 * Overlay for selecting a connection type to add
 */
export function AddConnectionOverlay({
  overlayId,
  onSuccess,
}: AddConnectionOverlayProps) {
  const { push, closeAll } = useOverlay();
  const [searchQuery, setSearchQuery] = useState("");
  const isMobile = useIsMobile();

  // AI Gateway state
  const aiGatewayStatus = useAtomValue(aiGatewayStatusAtom);
  const setAiGatewayStatus = useSetAtom(aiGatewayStatusAtom);
  const setTeams = useSetAtom(aiGatewayTeamsAtom);
  const setTeamsLoading = useSetAtom(aiGatewayTeamsLoadingAtom);

  const shouldUseManagedKeys =
    aiGatewayStatus?.enabled && aiGatewayStatus?.isVercelUser;

  // start keeperhub - filter out singleConnection types that already exist
  const existingIntegrations = useAtomValue(integrationsAtom);
  const existingIntegrationTypes = useMemo(
    () => new Set(existingIntegrations.map((i) => i.type)),
    [existingIntegrations]
  );
  // end keeperhub

  const integrationTypes = getIntegrationTypes();

  const filteredTypes = useMemo(() => {
    if (!searchQuery.trim()) {
      return integrationTypes;
    }
    const query = searchQuery.toLowerCase();
    return integrationTypes.filter((type) =>
      getLabel(type).toLowerCase().includes(query)
    );
  }, [integrationTypes, searchQuery]);

  // start keeperhub - check if a singleConnection type is already configured
  const isAlreadyConfigured = (type: IntegrationType) => {
    const plugin = getIntegration(type);
    return plugin?.singleConnection && existingIntegrationTypes.has(type);
  };

  // Check if integration doesn't require credentials (e.g., webhook)
  const noCredentialsRequired = (type: IntegrationType) => {
    const plugin = getIntegration(type);
    return plugin?.requiresCredentials === false;
  };
  // end keeperhub

  const showConsentModalWithCallbacks = useCallback(() => {
    push(AiGatewayConsentOverlay, {
      onConsent: (integrationId: string) => {
        onSuccess?.(integrationId);
        closeAll();
      },
    });
  }, [push, closeAll, onSuccess]);

  const handleSelectType = (type: IntegrationType) => {
    // If selecting AI Gateway and managed keys are available, show consent modal
    if (type === "ai-gateway" && shouldUseManagedKeys) {
      showConsentModalWithCallbacks();
      return;
    }

    // If AI Gateway but need to fetch status first
    if (type === "ai-gateway" && aiGatewayStatus === null) {
      api.aiGateway.getStatus().then((status) => {
        setAiGatewayStatus(status);
        if (status?.enabled && status?.isVercelUser) {
          setTeamsLoading(true);
          api.aiGateway
            .getTeams()
            .then((response) => {
              setTeams(response.teams);
            })
            .finally(() => {
              setTeamsLoading(false);
              showConsentModalWithCallbacks();
            });
        } else {
          push(ConfigureConnectionOverlay, { type, onSuccess });
        }
      });
      return;
    }

    // Push to configure overlay
    push(ConfigureConnectionOverlay, { type, onSuccess });
  };

  return (
    <Overlay overlayId={overlayId} title="Add Connection">
      <p className="-mt-2 mb-4 text-muted-foreground text-sm">
        Select a service to connect
      </p>

      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus={!isMobile}
            className="pl-9"
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search services..."
            value={searchQuery}
          />
        </div>
        <div className="max-h-[300px] space-y-1 overflow-y-auto">
          {filteredTypes.length === 0 ? (
            <p className="py-4 text-center text-muted-foreground text-sm">
              No services found
            </p>
          ) : (
            filteredTypes.map((type) => {
              const description = getDescription(type);
              // start keeperhub - grey out singleConnection types that are already configured
              // or integrations that don't require credentials
              const configured = isAlreadyConfigured(type);
              const noCredentials = noCredentialsRequired(type);
              const isDisabled = configured || noCredentials;
              // end keeperhub
              return (
                <button
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    isDisabled
                      ? "cursor-not-allowed opacity-50"
                      : "hover:bg-muted/50"
                  }`}
                  disabled={isDisabled}
                  key={type}
                  onClick={() => handleSelectType(type)}
                  type="button"
                >
                  <IntegrationIcon
                    className="size-5 shrink-0"
                    integration={type === "ai-gateway" ? "vercel" : type}
                  />
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{getLabel(type)}</span>
                    {configured && (
                      <span className="ml-1 text-muted-foreground text-xs">
                        (Configured)
                      </span>
                    )}
                    {noCredentials && !configured && (
                      <span className="ml-1 text-muted-foreground text-xs">
                        (Not required)
                      </span>
                    )}
                    {description && (
                      <span className="text-muted-foreground text-xs">
                        {" "}
                        - {description}
                      </span>
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </Overlay>
  );
}

type ConfigureConnectionOverlayProps = {
  overlayId: string;
  type: IntegrationType;
  onSuccess?: (integrationId: string) => void;
};

/**
 * Secret field component for password inputs
 */
function SecretField({
  fieldId,
  label,
  configKey,
  placeholder,
  helpText,
  helpLink,
  value,
  onChange,
}: {
  fieldId: string;
  label: string;
  configKey: string;
  placeholder?: string;
  helpText?: string;
  helpLink?: { url: string; text: string };
  value: string;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={fieldId}>{label}</Label>
      <Input
        className="flex-1"
        id={fieldId}
        onChange={(e) => onChange(configKey, e.target.value)}
        placeholder={placeholder}
        type="password"
        value={value}
      />
      {(helpText || helpLink) && (
        <p className="text-muted-foreground text-xs">
          {helpText}
          {helpLink && (
            <a
              className="underline hover:text-foreground"
              href={helpLink.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              {helpLink.text}
            </a>
          )}
        </p>
      )}
    </div>
  );
}

/**
 * Overlay for configuring a new connection
 */
export function ConfigureConnectionOverlay({
  overlayId,
  type,
  onSuccess,
}: ConfigureConnectionOverlayProps) {
  const { push, closeAll } = useOverlay();
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [_testResult, setTestResult] = useState<{
    status: "success" | "error";
    message: string;
  } | null>(null);
  const [name, setName] = useState("");
  const [config, setConfig] = useState<Record<string, string>>({});
  // start keeperhub - derive anonymous state from session reactively
  const { data: session } = useSession();
  const isAnonymous =
    type === "web3" &&
    (!session?.user ||
      session.user.name === "Anonymous" ||
      session.user.email?.includes("@http://") ||
      session.user.email?.includes("@https://") ||
      session.user.email?.startsWith("temp-"));
  // end keeperhub

  const updateConfig = (key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const doSave = async () => {
    try {
      setSaving(true);
      const newIntegration = await api.integration.create({
        name: name.trim(),
        type,
        config,
      });
      toast.success("Connection created");
      onSuccess?.(newIntegration.id);
      closeAll();
    } catch (error) {
      console.error("Failed to save integration:", error);
      toast.error("Failed to save connection");
    } finally {
      setSaving(false);
    }
  };

  const hasValidDatabaseConfig = (cfg: Record<string, string>) => {
    const { url, host, username, password, database } = cfg;
    const hasUrl = typeof url === "string" && url.trim() !== "";
    const hasParts =
      typeof host === "string" &&
      host.trim() !== "" &&
      typeof username === "string" &&
      username.trim() !== "" &&
      typeof password === "string" &&
      typeof database === "string" &&
      database.trim() !== "";
    return hasUrl || hasParts;
  };

  const showSaveAnywayConfirm = (message: string) => {
    push(ConfirmOverlay, {
      title: "Connection Test Failed",
      message: `${message}\n\nDo you want to save anyway?`,
      confirmLabel: "Save Anyway",
      onConfirm: async () => {
        await doSave();
      },
    });
  };

  const validateAndRunSave = async () => {
    const result = await api.integration.testCredentials({ type, config });
    if (result.status === "error") {
      setSaving(false);
      showSaveAnywayConfirm(result.message);
      return;
    }
    await doSave();
  };

  const handleSave = async () => {
    if (saving) {
      return;
    }
    const hasConfig =
      type === "database"
        ? hasValidDatabaseConfig(config)
        : Object.values(config).some((v) => v && v.length > 0);
    if (!hasConfig) {
      toast.error(
        type === "database"
          ? "Enter either a connection string or the connection details below."
          : "Please enter credentials"
      );
      return;
    }

    setSaving(true);
    setTestResult(null);
    try {
      await validateAndRunSave();
    } catch (error) {
      setSaving(false);
      const message =
        error instanceof Error ? error.message : "Failed to test connection";
      showSaveAnywayConfirm(message);
    }
  };

  const getTestConfigError = (): string | null => {
    const hasConfig =
      type === "database"
        ? hasValidDatabaseConfig(config)
        : Object.values(config).some((v) => v && v.length > 0);
    if (!hasConfig) {
      return type === "database"
        ? "Enter either a connection string or the connection details below."
        : "Please enter credentials first";
    }
    return null;
  };

  const handleTest = async () => {
    if (testing) {
      return;
    }
    const err = getTestConfigError();
    if (err) {
      toast.error(err);
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.integration.testCredentials({ type, config });
      setTestResult(result);
      if (result.status === "success") {
        toast.success(result.message || "Connection successful");
      } else {
        toast.error(result.message || "Connection failed");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Connection test failed";
      setTestResult({ status: "error", message });
      toast.error(message);
    } finally {
      setTesting(false);
    }
  };

  // Get plugin form fields
  const plugin = getIntegration(type);
  const formFields = plugin?.formFields;

  // Render config fields
  const renderConfigFields = () => {
    // start keeperhub - check for custom form handlers (e.g., web3 wallet)
    const customHandler = getCustomIntegrationFormHandler(type);
    if (customHandler) {
      return customHandler({
        integrationType: type,
        isEditMode: false,
        config,
        updateConfig,
        onSuccess,
        closeAll,
      });
    }
    // end keeperhub

    if (type === "database") {
      return (
        <div className="space-y-4">
          <p className="text-muted-foreground text-xs">
            Enter either a connection string or the connection details below.
          </p>
          <SecretField
            configKey="url"
            fieldId="db-url"
            helpText="Connection string: postgresql://user:password@host:port/database (passwords with @ are supported)"
            label="Connection string"
            onChange={updateConfig}
            placeholder="postgresql://user:password@host:port/database"
            value={config.url || ""}
          />
          <div className="border-t pt-3 font-medium text-muted-foreground text-xs">
            Or use connection details
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="db-host">Host</Label>
              <Input
                id="db-host"
                onChange={(e) => updateConfig("host", e.target.value)}
                placeholder="e.g. db.example.com or your-provider.supabase.co"
                value={config.host || ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="db-port">Port</Label>
              <Input
                id="db-port"
                onChange={(e) => updateConfig("port", e.target.value)}
                placeholder="5432"
                value={config.port || ""}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="db-username">Username</Label>
              <Input
                id="db-username"
                onChange={(e) => updateConfig("username", e.target.value)}
                placeholder="postgres"
                value={config.username || ""}
              />
            </div>
            <div className="space-y-2">
              <SecretField
                configKey="password"
                fieldId="db-password"
                label="Password"
                onChange={updateConfig}
                placeholder=""
                value={config.password || ""}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="db-database">Database name</Label>
            <Input
              id="db-database"
              onChange={(e) => updateConfig("database", e.target.value)}
              placeholder="postgres"
              value={config.database || ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="database-ssl-mode">SSL mode</Label>
            <Select
              onValueChange={(value: string) => updateConfig("sslMode", value)}
              value={(config.sslMode as string) || "auto"}
            >
              <SelectTrigger id="database-ssl-mode">
                <SelectValue placeholder="SSL mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">
                  Auto (use SSL for remote hosts)
                </SelectItem>
                <SelectItem value="require">Require</SelectItem>
                <SelectItem value="prefer">Prefer</SelectItem>
                <SelectItem value="disable">Disable</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
              Use Require for cloud providers (e.g. Supabase). Auto enables SSL
              for remote hosts. For Supabase, use the connection pooler host if
              your environment cannot resolve IPv6; the pooler uses IPv4.
            </p>
          </div>
        </div>
      );
    }

    if (!formFields) {
      return null;
    }

    return formFields.map((field) => {
      if (field.type === "password") {
        return (
          <SecretField
            configKey={field.configKey}
            fieldId={field.id}
            helpLink={field.helpLink}
            helpText={field.helpText}
            key={field.id}
            label={field.label}
            onChange={updateConfig}
            placeholder={field.placeholder}
            value={config[field.configKey] || ""}
          />
        );
      }

      return (
        <div className="space-y-2" key={field.id}>
          <Label htmlFor={field.id}>{field.label}</Label>
          <Input
            id={field.id}
            onChange={(e) => updateConfig(field.configKey, e.target.value)}
            placeholder={field.placeholder}
            type={field.type}
            value={config[field.configKey] || ""}
          />
          {(field.helpText || field.helpLink) && (
            <p className="text-muted-foreground text-xs">
              {field.helpText}
              {field.helpLink && (
                <a
                  className="underline hover:text-foreground"
                  href={field.helpLink.url}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  {field.helpLink.text}
                </a>
              )}
            </p>
          )}
        </div>
      );
    });
  };

  // start keeperhub - for web3 + anonymous, show Sign In button with AuthDialog
  const showSignInButton = type === "web3" && isAnonymous;
  // Web3 uses custom form handler with its own Create Wallet button
  const hideOverlayActions = type === "web3";
  // end keeperhub

  return (
    <Overlay
      actions={
        hideOverlayActions
          ? undefined
          : [
              {
                label: "Test",
                variant: "outline",
                onClick: handleTest,
                loading: testing,
                disabled: saving,
              },
              { label: "Create", onClick: handleSave, loading: saving },
            ]
      }
      overlayId={overlayId}
      title={`Add ${getLabel(type)}`}
    >
      <p className="-mt-2 mb-4 text-muted-foreground text-sm">
        Enter your credentials
      </p>

      <div className="space-y-4">
        {renderConfigFields()}

        <div className="space-y-2">
          <Label htmlFor="name">Label (Optional)</Label>
          <Input
            id="name"
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Production, Personal, Work"
            value={name}
          />
        </div>
      </div>

      {/* start keeperhub - Sign In button for anonymous web3 users */}
      {showSignInButton && (
        <OverlayFooter>
          <AuthDialog>
            <Button>Sign In</Button>
          </AuthDialog>
        </OverlayFooter>
      )}
      {/* end keeperhub */}
    </Overlay>
  );
}
