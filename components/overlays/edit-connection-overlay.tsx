"use client";

import { Check, Pencil, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { api, type Integration } from "@/lib/api-client";
import { hasValidDatabaseConfig } from "@/lib/db/connection-utils";
// start keeperhub
import { getCustomIntegrationFormHandler } from "@/lib/extension-registry";
import type { IntegrationConfig } from "@/lib/types/integration";
import { getIntegration, getIntegrationLabels } from "@/plugins";
// end keeperhub
import { ConfirmOverlay } from "./confirm-overlay";
import { Overlay } from "./overlay";
import { useOverlay } from "./overlay-provider";

const SYSTEM_INTEGRATION_LABELS: Record<string, string> = {
  database: "Database",
};

const getLabel = (type: string): string => {
  const labels = getIntegrationLabels() as Record<string, string>;
  return labels[type] || SYSTEM_INTEGRATION_LABELS[type] || type;
};

function normalizeConfig(c: IntegrationConfig): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(c)) {
    const v = c[key];
    out[key] = v === undefined || v === null ? "" : String(v);
  }
  return out;
}

type IntegrationWithOptionalConfig = Integration & {
  config?: IntegrationConfig;
};

type EditConnectionOverlayProps = {
  overlayId: string;
  integration: Integration;
  onSuccess?: () => void;
  onDelete?: () => void;
};

/**
 * Secret field with "Configured" state for edit mode
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
  const [isEditing, setIsEditing] = useState(false);
  const isMobile = useIsMobile();
  const hasNewValue = value.length > 0;

  // Show "Configured" state until user clicks Change
  if (!(isEditing || hasNewValue)) {
    return (
      <div className="space-y-2">
        <Label htmlFor={fieldId}>{label}</Label>
        <div className="flex items-center gap-2">
          <div className="flex h-9 flex-1 items-center gap-2 rounded-md border bg-muted/30 px-3">
            <Check className="size-4 text-green-600" />
            <span className="text-muted-foreground text-sm">Configured</span>
          </div>
          <Button
            onClick={() => setIsEditing(true)}
            type="button"
            variant="outline"
          >
            <Pencil className="mr-1.5 size-3" />
            Change
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={fieldId}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          autoFocus={isEditing && !isMobile}
          className="flex-1"
          id={fieldId}
          onChange={(e) => onChange(configKey, e.target.value)}
          placeholder={placeholder}
          type="password"
          value={value}
        />
        {(isEditing || hasNewValue) && (
          <Button
            onClick={() => {
              onChange(configKey, "");
              setIsEditing(false);
            }}
            size="icon"
            type="button"
            variant="ghost"
          >
            <X className="size-4" />
          </Button>
        )}
      </div>
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
 * Overlay for editing an existing connection
 */
export function EditConnectionOverlay({
  overlayId,
  integration,
  onSuccess,
  onDelete,
}: EditConnectionOverlayProps) {
  const { push, closeAll } = useOverlay();
  const integrationWithConfig = integration as IntegrationWithOptionalConfig;
  const hasConfigFromProps =
    integrationWithConfig.config != null &&
    typeof integrationWithConfig.config === "object" &&
    !Array.isArray(integrationWithConfig.config);
  const [loading, setLoading] = useState(!hasConfigFromProps);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [name, setName] = useState(integration.name);
  const [config, setConfig] = useState<Record<string, string>>(() => {
    if (hasConfigFromProps && integrationWithConfig.config) {
      return normalizeConfig(integrationWithConfig.config);
    }
    return {};
  });

  useEffect(() => {
    if (hasConfigFromProps && integrationWithConfig.config) {
      setName(integration.name);
      setConfig(normalizeConfig(integrationWithConfig.config));
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api.integration
      .get(integration.id)
      .then((full) => {
        if (cancelled) {
          return;
        }
        setName(full.name);
        setConfig(normalizeConfig(full.config));
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setLoading(false);
        toast.error("Failed to load connection");
      });
    return () => {
      cancelled = true;
    };
  }, [
    integration.id,
    integration.name,
    hasConfigFromProps,
    integrationWithConfig.config,
  ]);

  const updateConfig = (key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const doSave = async () => {
    try {
      setSaving(true);
      const hasNewConfig = Object.values(config).some((v) => v && v.length > 0);
      await api.integration.update(integration.id, {
        name: name.trim(),
        ...(hasNewConfig ? { config } : {}),
      });
      toast.success("Connection updated");
      onSuccess?.();
      closeAll();
    } catch {
      toast.error("Failed to update connection");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (saving) {
      return;
    }
    const hasNewConfig = Object.values(config).some((v) => v && v.length > 0);

    if (!hasNewConfig) {
      await doSave();
      return;
    }

    if (integration.type === "database" && !hasValidDatabaseConfig(config)) {
      toast.error(
        "Enter either a connection string or the connection details below."
      );
      return;
    }

    setSaving(true);
    try {
      const result = await api.integration.testCredentials({
        type: integration.type,
        config,
      });

      if (result.status === "error") {
        setSaving(false);
        push(ConfirmOverlay, {
          title: "Connection Test Failed",
          message: `The test failed: ${result.message}\n\nDo you want to save anyway?`,
          confirmLabel: "Save Anyway",
          onConfirm: async () => {
            await doSave();
          },
        });
        return;
      }

      await doSave();
    } catch (error) {
      setSaving(false);
      const message =
        error instanceof Error ? error.message : "Failed to test connection";
      push(ConfirmOverlay, {
        title: "Connection Test Failed",
        message: `${message}\n\nDo you want to save anyway?`,
        confirmLabel: "Save Anyway",
        onConfirm: async () => {
          await doSave();
        },
      });
    }
  };

  const runConnectionTest = (): Promise<{
    status: "success" | "error";
    message: string;
  }> => {
    const hasNewConfig = Object.values(config).some((v) => v && v.length > 0);
    if (hasNewConfig) {
      return api.integration.testCredentials({
        type: integration.type,
        config,
      });
    }
    return api.integration.testConnection(integration.id);
  };

  const handleTest = async () => {
    if (testing) {
      return;
    }
    const hasNewConfig = Object.values(config).some((v) => v && v.length > 0);
    if (
      hasNewConfig &&
      integration.type === "database" &&
      !hasValidDatabaseConfig(config)
    ) {
      toast.error(
        "Enter either a connection string or the connection details below."
      );
      return;
    }

    setTesting(true);
    try {
      const result = await runConnectionTest();
      if (result.status === "success") {
        toast.success(result.message || "Connection successful");
      } else {
        toast.error(result.message || "Connection failed");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Connection test failed";
      toast.error(message);
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = () => {
    push(DeleteConnectionOverlay, {
      integration,
      onSuccess: () => {
        onDelete?.();
        closeAll();
      },
    });
  };

  // Get plugin form fields
  const plugin = getIntegration(integration.type);
  const formFields = plugin?.formFields;

  // Render config fields
  const renderConfigFields = () => {
    // start keeperhub - check for custom form handlers (e.g., web3 wallet display)
    const customHandler = getCustomIntegrationFormHandler(integration.type);
    if (customHandler) {
      return customHandler({
        integrationType: integration.type,
        isEditMode: true,
        config,
        updateConfig,
      });
    }
    // end keeperhub

    if (integration.type === "database") {
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

  return (
    <Overlay
      actions={[
        {
          label: "Delete",
          variant: "ghost",
          onClick: handleDelete,
          disabled: loading || saving || testing,
        },
        {
          label: "Test",
          variant: "outline",
          onClick: handleTest,
          loading: testing,
          disabled: loading || saving,
        },
        {
          label: "Update",
          onClick: handleSave,
          loading: saving,
          disabled: loading,
        },
      ]}
      overlayId={overlayId}
      title={`Edit ${getLabel(integration.type)}`}
    >
      <p className="-mt-2 mb-4 text-muted-foreground text-sm">
        Update your connection credentials
      </p>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-muted-foreground">
          <div className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <span className="text-sm">Loading connection...</span>
        </div>
      ) : (
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
      )}
    </Overlay>
  );
}

type DeleteConnectionOverlayProps = {
  overlayId: string;
  integration: Integration;
  onSuccess?: () => void;
};

/**
 * Overlay for deleting a connection with optional key revocation
 */
export function DeleteConnectionOverlay({
  overlayId,
  integration,
  onSuccess,
}: DeleteConnectionOverlayProps) {
  const { pop } = useOverlay();
  const [deleting, setDeleting] = useState(false);
  const [revokeKey, setRevokeKey] = useState(true);

  const handleDelete = async () => {
    if (deleting) {
      return;
    }
    setDeleting(true);
    try {
      if (integration.isManaged && revokeKey) {
        await api.aiGateway.revokeConsent();
      } else {
        await api.integration.delete(integration.id);
      }
      toast.success("Connection deleted");
      onSuccess?.();
    } catch (_error) {
      toast.error("Failed to delete connection");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Overlay
      actions={[
        { label: "Cancel", variant: "outline", onClick: pop },
        {
          label: "Delete",
          variant: "destructive",
          onClick: handleDelete,
          loading: deleting,
        },
      ]}
      overlayId={overlayId}
      title="Delete Connection"
    >
      <p className="text-muted-foreground text-sm">
        Are you sure you want to delete this connection? Workflows using it will
        fail until a new one is configured.
      </p>

      {integration.isManaged && (
        <div className="mt-4 flex items-center gap-2">
          <Checkbox
            checked={revokeKey}
            id="revoke-key"
            onCheckedChange={(checked: boolean) => setRevokeKey(checked)}
          />
          <Label className="cursor-pointer font-normal" htmlFor="revoke-key">
            Revoke API key from Vercel
          </Label>
        </div>
      )}
    </Overlay>
  );
}
