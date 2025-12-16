"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { Loader2, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  aiGatewayStatusAtom,
  aiGatewayTeamsAtom,
  aiGatewayTeamsLoadingAtom,
} from "@/lib/ai-gateway/state";
import { api } from "@/lib/api-client";
import { Overlay } from "./overlay";
import { useOverlay } from "./overlay-provider";
import type { OverlayAction } from "./types";

type AiGatewayConsentOverlayProps = {
  overlayId: string;
  /** Callback when consent is given, receives the integration ID */
  onConsent?: (integrationId: string) => void;
  /** Callback when user chooses manual entry instead */
  onManualEntry?: () => void;
  /** Callback when user declines */
  onDecline?: () => void;
};

/**
 * AI Gateway consent overlay.
 * Opens when user needs to connect their Vercel AI Gateway credits.
 *
 * @example
 * ```tsx
 * const { push } = useOverlay();
 *
 * push(AiGatewayConsentOverlay, {
 *   onConsent: (integrationId) => {
 *     // Handle successful consent
 *   },
 *   onManualEntry: () => {
 *     // Open manual entry overlay
 *   },
 * });
 * ```
 */
export function AiGatewayConsentOverlay({
  overlayId,
  onConsent,
  onManualEntry,
  onDecline,
}: AiGatewayConsentOverlayProps) {
  const { pop } = useOverlay();
  const setStatus = useSetAtom(aiGatewayStatusAtom);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");

  // Use pre-loaded teams from state
  const teams = useAtomValue(aiGatewayTeamsAtom);
  const teamsLoading = useAtomValue(aiGatewayTeamsLoadingAtom);

  // Auto-select first team when teams are loaded
  useEffect(() => {
    if (teams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams, selectedTeamId]);

  const completeConsent = useCallback(
    (integrationId: string) => {
      setLoading(false);
      onConsent?.(integrationId);
      pop();
    },
    [onConsent, pop]
  );

  const handleConsent = useCallback(async () => {
    if (!selectedTeamId) {
      setError("Please select a team");
      return;
    }

    const selectedTeam = teams.find((t) => t.id === selectedTeamId);
    const teamName = selectedTeam?.name || "AI Gateway";

    setLoading(true);
    setError(null);

    try {
      const result = await api.aiGateway.consent(selectedTeamId, teamName);

      if (!result.success) {
        throw new Error(result.error || "Failed to set up AI Gateway");
      }

      const integrationId = result.managedIntegrationId || "";

      // Update status atom
      setStatus((prev) =>
        prev
          ? {
              ...prev,
              hasManagedKey: result.hasManagedKey,
              managedIntegrationId: integrationId,
            }
          : null
      );

      // For managed connections, skip testing - the key was just created by Vercel
      // and is definitely valid. Testing would require decryption which adds complexity.
      completeConsent(integrationId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "An error occurred");
      setLoading(false);
    }
  }, [selectedTeamId, teams, setStatus, completeConsent]);

  const handleDecline = useCallback(() => {
    onDecline?.();
    pop();
  }, [onDecline, pop]);

  const handleManualEntry = useCallback(() => {
    // Don't pop - let onManualEntry push the manual connection overlay on top
    // This allows the user to navigate back to this overlay if needed
    onManualEntry?.();
  }, [onManualEntry]);

  const actions: OverlayAction[] = [
    ...(onManualEntry
      ? [
          {
            label: "Enter manually",
            variant: "ghost" as const,
            onClick: handleManualEntry,
            disabled: loading,
          },
        ]
      : []),
    {
      label: "Cancel",
      variant: "outline" as const,
      onClick: handleDecline,
      disabled: loading,
    },
    {
      label: loading ? "Setting up..." : "Agree & Connect",
      variant: "default" as const,
      onClick: handleConsent,
      disabled:
        loading || (teamsLoading && teams.length === 0) || !selectedTeamId,
      loading,
    },
  ];

  return (
    <Overlay
      actions={actions}
      description="Connect your Vercel account to use your own AI Gateway balance"
      overlayId={overlayId}
      title="Use Your AI Gateway Credits"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="size-5 text-primary" />
          </div>
          <p className="pt-2 text-muted-foreground text-sm">
            This will create an API key on your Vercel account that uses your AI
            Gateway credits for AI operations in workflows.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="team-select">Vercel Team</Label>
          {teamsLoading && teams.length === 0 ? (
            <div className="flex h-10 items-center gap-2 rounded-md border px-3 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" />
              Loading teams...
            </div>
          ) : (
            <Select
              disabled={loading}
              onValueChange={setSelectedTeamId}
              value={selectedTeamId}
            >
              <SelectTrigger id="team-select">
                <SelectValue placeholder="Select a team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((team, index) => (
                  <div key={team.id}>
                    <SelectItem value={team.id}>
                      <div className="flex items-center gap-2">
                        {team.avatar ? (
                          // biome-ignore lint/correctness/useImageSize: Avatar has fixed size
                          // biome-ignore lint/performance/noImgElement: External Vercel avatar
                          <img
                            alt=""
                            className="size-4 rounded-full bg-white"
                            src={team.avatar}
                          />
                        ) : (
                          <div className="size-4 rounded-full bg-white" />
                        )}
                        <span>{team.name}</span>
                        {team.isPersonal && (
                          <span className="text-muted-foreground text-xs">
                            (Personal)
                          </span>
                        )}
                      </div>
                    </SelectItem>
                    {team.isPersonal && index < teams.length - 1 && (
                      <SelectSeparator />
                    )}
                  </div>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-md border border-red-500/30 bg-red-500/10 p-3">
            <X className="mt-0.5 size-4 shrink-0 text-red-500" />
            <p className="text-red-700 text-sm dark:text-red-400">{error}</p>
          </div>
        )}
      </div>
    </Overlay>
  );
}
