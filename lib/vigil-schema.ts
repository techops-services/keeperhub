/**
 * Vigil Analysis Schema and Types
 *
 * Defines the structure for Vigil AI analysis of workflow execution failures.
 * This matches the KeeperErrorReport schema used by LM Studio for structured output.
 */

export type VigilSeverity = "Critical" | "High" | "Medium" | "Low";

export type GasEstimate = {
  initial: number;
  final_attempted: number;
};

export type AdditionalContext = {
  error_details?: string;
  gas_estimate?: GasEstimate;
  attempts_made?: number;
  condition_matched?: boolean;
  notifications_sent?: boolean;
};

export type KeeperErrorReport = {
  summary: string;
  diagnosis: string;
  suggested_fix: string;
  severity: VigilSeverity;
  additional_context: AdditionalContext;
};

export type VigilAnalysis = {
  analyzed: boolean;
  status:
    | "success"
    | "api_error"
    | "request_failed"
    | "error"
    | "analysis_failed";
  report?: KeeperErrorReport;
  summary: string;
  timestamp: string;
  model?: string;
  api_status?: number;
  error?: string;
  analysis_type?: "workflow_failure";
};

/**
 * JSON Schema for LM Studio structured output
 * This is used in the response_format parameter
 */
export const keeperErrorReportSchema = {
  type: "object",
  required: [
    "summary",
    "diagnosis",
    "suggested_fix",
    "severity",
    "additional_context",
  ],
  additionalProperties: false,
  properties: {
    summary: {
      type: "string",
      description:
        "Brief summary describing the failure, similar to having a title for the run, so 12 words or less is preferred.",
    },
    diagnosis: {
      type: "string",
      description: "Detailed explanation of what went wrong",
    },
    suggested_fix: {
      type: "string",
      description: "Recommended solution",
    },
    severity: {
      type: "string",
      enum: ["Critical", "High", "Medium", "Low"],
      description: "Impact level of the failure",
    },
    additional_context: {
      type: "object",
      required: [
        "error_details",
        "gas_estimate",
        "attempts_made",
        "condition_matched",
        "notifications_sent",
      ],
      additionalProperties: false,
      properties: {
        error_details: {
          type: "string",
          description:
            "If the step that failed involved a blockchain transaction, raw error message from the blockchain",
        },
        gas_estimate: {
          type: "object",
          required: ["initial", "final_attempted"],
          additionalProperties: false,
          properties: {
            initial: {
              type: "integer",
              minimum: 0,
              description:
                "If the step that failed involved a blockchain transaction, initial gas estimate for it",
            },
            final_attempted: {
              type: "integer",
              minimum: 0,
              description:
                "If the step that failed involved a blockchain transaction, final gas amount that was used in an attempt to get the transaction through",
            },
          },
        },
        attempts_made: {
          type: "integer",
          minimum: 0,
          description:
            "If the step that failed involved a blockchain transaction, how many attempts were made to try to send it out before failing",
        },
        condition_matched: {
          type: "boolean",
          description:
            "Whether the condition defined by the step that failed was met or not",
        },
        notifications_sent: {
          type: "boolean",
          description:
            "Whether alerts were dispatched to notify about this failure",
        },
      },
    },
  },
} as const;
