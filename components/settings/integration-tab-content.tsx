import { Button } from "@/components/ui/button";

type IntegrationTabContentProps = {
  children: React.ReactNode;
  hasKey?: boolean;
  saving: boolean;
  onSave: () => void;
  onRemove: () => void;
  onTestConnection?: () => void;
  onImport?: () => void;
  testing?: boolean;
};

export function IntegrationTabContent({
  children,
  hasKey,
  saving,
  onSave,
  onRemove,
  onTestConnection,
  onImport,
  testing = false,
}: IntegrationTabContentProps) {
  return (
    <>
      {children}
      <div className="mt-4 flex justify-between gap-2">
        <div className="flex gap-2">
          {onImport && (
            <Button disabled={saving} onClick={onImport} variant="outline">
              Import
            </Button>
          )}
          {onTestConnection && (
            <Button
              disabled={saving || testing}
              onClick={onTestConnection}
              variant="outline"
            >
              {testing ? "Testing..." : "Test Connection"}
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          {hasKey && (
            <Button disabled={saving} onClick={onRemove} variant="outline">
              Remove
            </Button>
          )}
          <Button disabled={saving} onClick={onSave}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </>
  );
}
