import { Button } from "@/components/ui/button";
import { CopyFromWorkflowSelect } from "./copy-from-workflow-select";

type IntegrationTabContentProps = {
  children: React.ReactNode;
  hasKey?: boolean;
  saving: boolean;
  onSave: () => void;
  onRemove: () => void;
  workflowId: string | null;
  onCopyIntegrations: (integrations: {
    resendApiKey: string | null;
    resendFromEmail: string | null;
    linearApiKey: string | null;
    slackApiKey: string | null;
    aiGatewayApiKey: string | null;
    databaseUrl: string | null;
  }) => void;
};

export function IntegrationTabContent({
  children,
  hasKey,
  saving,
  onSave,
  onRemove,
  workflowId,
  onCopyIntegrations,
}: IntegrationTabContentProps) {
  return (
    <>
      <CopyFromWorkflowSelect
        currentWorkflowId={workflowId}
        onCopyIntegrations={onCopyIntegrations}
      />
      {children}
      <div className="mt-4 flex justify-end gap-2">
        {hasKey && (
          <Button disabled={saving} onClick={onRemove} variant="outline">
            Remove
          </Button>
        )}
        <Button disabled={saving} onClick={onSave}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </>
  );
}
