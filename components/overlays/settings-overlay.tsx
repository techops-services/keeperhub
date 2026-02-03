"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AccountSettings } from "@/components/settings/account-settings";
import { Spinner } from "@/components/ui/spinner";
// start custom keeperhub code //
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChangePasswordSection } from "@/keeperhub/components/settings/change-password-section";
import { DeactivateAccountSection } from "@/keeperhub/components/settings/delete-account-section";
// end keeperhub code //
import { api } from "@/lib/api-client";
import { Overlay } from "./overlay";
import { useOverlay } from "./overlay-provider";

type SettingsOverlayProps = {
  overlayId: string;
};

export function SettingsOverlay({ overlayId }: SettingsOverlayProps) {
  const { closeAll } = useOverlay();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Account state
  const [accountName, setAccountName] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  // start custom keeperhub code //
  const [providerId, setProviderId] = useState<string | null>(null);
  // end keeperhub code //

  const loadAccount = useCallback(async () => {
    try {
      const data = await api.user.get();
      setAccountName(data.name || "");
      setAccountEmail(data.email || "");
      // start custom keeperhub code //
      setProviderId(data.providerId ?? null);
      // end keeperhub code //
    } catch (error) {
      console.error("Failed to load account:", error);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      await loadAccount();
    } finally {
      setLoading(false);
    }
  }, [loadAccount]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const saveAccount = async () => {
    try {
      setSaving(true);
      await api.user.update({ name: accountName, email: accountEmail });
      await loadAccount();
      toast.success("Settings saved");
      closeAll();
    } catch (error) {
      console.error("Failed to save account:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Overlay
      actions={[
        { label: "Cancel", variant: "outline", onClick: closeAll },
        {
          label: "Save",
          onClick: saveAccount,
          loading: saving,
          disabled: loading,
        },
      ]}
      overlayId={overlayId}
      title="Settings"
    >
      <p className="-mt-2 mb-4 text-muted-foreground text-sm">
        Update your personal information
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Spinner />
        </div>
      ) : (
        // start custom keeperhub code //
        <Tabs className="w-full" defaultValue="account">
          <TabsList className="mb-4 w-full">
            <TabsTrigger value="account">Account</TabsTrigger>
            <TabsTrigger value="security">Security</TabsTrigger>
            <TabsTrigger value="danger">Danger Zone</TabsTrigger>
          </TabsList>

          <TabsContent value="account">
            <AccountSettings
              accountEmail={accountEmail}
              accountName={accountName}
              onEmailChange={setAccountEmail}
              onNameChange={setAccountName}
            />
          </TabsContent>

          <TabsContent value="security">
            <ChangePasswordSection providerId={providerId} />
          </TabsContent>

          <TabsContent value="danger">
            <DeactivateAccountSection />
          </TabsContent>
        </Tabs>
        // end keeperhub code //
      )}
    </Overlay>
  );
}
