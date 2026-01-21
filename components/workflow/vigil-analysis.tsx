// start custom keeperhub code //
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { VigilAnalysis, VigilSeverity } from "@/lib/vigil-schema";

type VigilAnalysisProps = {
  analysis: VigilAnalysis | null;
};

function getSeverityColor(severity: VigilSeverity): string {
  switch (severity) {
    case "Critical":
      return "bg-red-500/20 text-red-600 border-red-500/50 dark:text-red-400";
    case "High":
      return "bg-orange-500/20 text-orange-600 border-orange-500/50 dark:text-orange-400";
    case "Medium":
      return "bg-yellow-500/20 text-yellow-600 border-yellow-500/50 dark:text-yellow-400";
    case "Low":
      return "bg-blue-500/20 text-blue-600 border-blue-500/50 dark:text-blue-400";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function VigilAnalysis({ analysis }: VigilAnalysisProps) {
  if (!analysis) {
    return (
      <div className="rounded-lg border bg-muted/30 p-4 text-center text-muted-foreground text-sm">
        No analysis available
      </div>
    );
  }

  if (analysis.status !== "success" || !analysis.report) {
    return (
      <div className="space-y-2">
        <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
          <div className="font-medium text-yellow-600 dark:text-yellow-400">
            Analysis Status: {analysis.status}
          </div>
          {analysis.summary && (
            <div className="mt-1 text-muted-foreground text-sm">
              {analysis.summary}
            </div>
          )}
          {analysis.error && (
            <div className="mt-2 text-muted-foreground text-sm">
              Error: {analysis.error}
            </div>
          )}
        </div>
      </div>
    );
  }

  const { report } = analysis;

  return (
    <div className="space-y-4">
      {/* Severity Badge */}
      <div>
        <h4 className="mb-2 font-semibold text-sm">Severity</h4>
        <Badge className={getSeverityColor(report.severity)} variant="outline">
          {report.severity}
        </Badge>
      </div>

      {/* Summary */}
      <div>
        <h4 className="mb-2 font-semibold text-sm">Summary</h4>
        <p className="text-muted-foreground text-sm">{report.summary}</p>
      </div>

      {/* Diagnosis */}
      <div>
        <h4 className="mb-2 font-semibold text-sm">Diagnosis</h4>
        <p className="whitespace-pre-wrap text-muted-foreground text-sm">
          {report.diagnosis}
        </p>
      </div>

      {/* Suggested Fix */}
      <div>
        <h4 className="mb-2 font-semibold text-sm">Suggested Fix</h4>
        <p className="whitespace-pre-wrap text-muted-foreground text-sm">
          {report.suggested_fix}
        </p>
      </div>

      {/* Additional Context */}
      {report.additional_context &&
        Object.keys(report.additional_context).length > 0 && (
          <div>
            <Collapsible>
              <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-left hover:bg-muted/50">
                <span className="font-semibold text-sm">
                  Additional Context
                </span>
                <ChevronDown className="size-4 transition-transform duration-200 data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <pre className="overflow-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs">
                  {JSON.stringify(report.additional_context, null, 2)}
                </pre>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

      {/* Metadata */}
      <div className="border-t pt-2">
        <div className="flex items-center justify-between text-muted-foreground text-xs">
          <span>Analyzed: {new Date(analysis.timestamp).toLocaleString()}</span>
          {analysis.model && <span>Model: {analysis.model}</span>}
        </div>
      </div>
    </div>
  );
}
// end keeperhub code //
