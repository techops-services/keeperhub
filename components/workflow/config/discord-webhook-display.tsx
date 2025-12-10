"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api-client";
import { findActionById } from "@/plugins";

type DiscordWebhookDisplayProps = {
  actionType: string | undefined;
  integrationId: string | undefined;
};

export function DiscordWebhookDisplay({
  actionType,
  integrationId,
}: DiscordWebhookDisplayProps) {
  const [discordIntegrationConfig, setDiscordIntegrationConfig] =
    useState<Record<string, unknown> | null>(null);

  // Fetch Discord integration config when integration ID changes
  useEffect(() => {
    const action = actionType ? findActionById(actionType) : undefined;

    if (action?.integration === "discord" && integrationId) {
      api.integration
        .get(integrationId)
        .then((integration) => {
          setDiscordIntegrationConfig(integration.config);
        })
        .catch((error) => {
          console.error("Failed to fetch Discord integration config:", error);
        });
    } else {
      setDiscordIntegrationConfig(null);
    }
  }, [actionType, integrationId]);

  // Only show for Discord actions with a selected integration
  const action = actionType ? findActionById(actionType) : undefined;
  if (
    action?.integration !== "discord" ||
    !integrationId ||
    !discordIntegrationConfig
  ) {
    return null;
  }

  const webhookUrl = discordIntegrationConfig.webhookUrl as string | undefined;

  if (!webhookUrl) {
    return null;
  }

  return (
    <div className="space-y-1.5 pt-2">
      <Label className="text-muted-foreground text-xs">
        Webhook URL (from integration)
      </Label>
      <div className="rounded-md border bg-muted/50 px-3 py-2">
        <p className="break-all font-mono text-muted-foreground text-xs">
          {webhookUrl}
        </p>
      </div>
    </div>
  );
}
