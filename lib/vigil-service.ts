/**
 * Vigil Service - AI-powered analysis of workflow execution failures
 *
 * Connects to LLM API server to analyze failed workflow executions
 * and provide structured insights about what went wrong.
 */

import type { KeeperErrorReport, VigilAnalysis } from "./vigil-schema";
import { keeperErrorReportSchema } from "./vigil-schema";

type ExecutionData = {
  executionId: string;
  workflowId: string;
  status: string;
  error?: string | null;
  input?: Record<string, unknown> | null;
  output?: unknown;
  executionLogs?: Array<{
    nodeId: string;
    nodeName: string;
    nodeType: string;
    status: string;
    error?: string | null;
    input?: unknown;
    output?: unknown;
  }>;
  startedAt: Date;
  completedAt?: Date | null;
  duration?: string | null;
};

/**
 * Build analysis prompt from execution data
 */
function _buildAnalysisPrompt(executionData: ExecutionData): string {
  const {
    executionId,
    workflowId,
    status,
    error,
    input,
    output,
    executionLogs,
    startedAt,
    completedAt,
    duration,
  } = executionData;

  const errorMessages: string[] = [];
  if (error) {
    errorMessages.push(`Main error: ${error}`);
  }

  const failedLogs =
    executionLogs?.filter((log) => log.status === "error") || [];
  for (const log of failedLogs) {
    if (log.error) {
      errorMessages.push(`Node ${log.nodeName} (${log.nodeId}): ${log.error}`);
    }
  }

  const prompt = `Analyze this workflow execution failure to understand what went wrong and how to fix it.

Execution Details:
- Execution ID: ${executionId}
- Workflow ID: ${workflowId}
- Status: ${status}
- Started: ${startedAt.toISOString()}
- Completed: ${completedAt?.toISOString() || "N/A"}
- Duration: ${duration || "N/A"}

Errors:
${errorMessages.length > 0 ? errorMessages.join("\n") : "No explicit error messages found"}

Execution Logs:
${
  executionLogs && executionLogs.length > 0
    ? JSON.stringify(
        executionLogs.map((log) => ({
          node: log.nodeName,
          type: log.nodeType,
          status: log.status,
          error: log.error,
        })),
        null,
        2
      )
    : "No execution logs available"
}

Input Data:
${input ? JSON.stringify(input, null, 2) : "No input data"}

Output Data:
${output ? JSON.stringify(output, null, 2) : "No output data"}

Timestamp: ${new Date().toISOString()}

Provide analysis covering:
1. What caused this workflow execution to fail
2. Whether this is a systemic or isolated issue
3. Immediate remediation steps
4. Long-term prevention strategies
5. Impact assessment and urgency level

Focus on actionable insights that can help debug and improve workflow reliability.`;

  return prompt;
}

/**
 * Make AI request to LLM API with structured output
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Complex retry logic and error handling required
async function _makeVigilRequest(
  prompt: string
): Promise<VigilAnalysis | null> {
  const apiUrl =
    process.env.VIGIL_API_URL || "http://localhost:1234/v1/chat/completions";
  const model = process.env.VIGIL_API_MODEL || "openai/gpt-oss-20b";
  const timeout = Number.parseInt(process.env.VIGIL_TIMEOUT || "120", 10);
  const enabled = process.env.VIGIL_ENABLED !== "false";

  if (!enabled) {
    console.log("[VIGIL] Vigil analysis is disabled");
    return null;
  }

  try {
    const apiKey = process.env.VIGIL_API_KEY?.trim();
    const hasApiKey = Boolean(apiKey && apiKey.length > 0);

    console.log(`[VIGIL] Making AI request to: ${apiUrl}`);
    console.log(`[VIGIL] Model: ${model}`);
    console.log(
      `[VIGIL] API key present: ${hasApiKey ? "yes" : "no"} (length: ${apiKey?.length || 0})`
    );
    console.log(
      `[VIGIL] Request payload size: ${JSON.stringify({ prompt }).length}`
    );

    // Retry logic with exponential backoff
    const maxRetries = 3;
    const baseDelay = 2000; // 2 seconds

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = baseDelay * 2 ** (attempt - 1);
          console.log(
            `[VIGIL] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms delay`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout * 1000);

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };

        if (apiKey) {
          headers.Authorization = `Bearer ${apiKey}`;
          console.log("[VIGIL] Authorization header added");
          console.log("[VIGIL] API key is: ", apiKey);
        } else {
          console.warn(
            "[VIGIL] No API key found in VIGIL_API_KEY environment variable. Request will likely fail."
          );
        }

        console.log(
          `[VIGIL] Request headers: ${Object.keys(headers).join(", ")}`
        );

        const response = await fetch(apiUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            stream: false,
            max_completion_tokens: 14_000,
            // Use structured output with JSON schema
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "keeper_error_report",
                strict: true,
                schema: keeperErrorReportSchema,
              },
            },
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        console.log(`[VIGIL] AI response status: ${response.status}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `[VIGIL] AI API error: ${response.status} - ${errorText}`
          );
          if (attempt === maxRetries - 1) {
            return {
              analyzed: true,
              status: "api_error",
              error: `API returned ${response.status}`,
              summary: "Failed to get AI analysis due to API error",
              timestamp: new Date().toISOString(),
            };
          }
          continue;
        }

        const responseData = await response.json();

        // Extract structured response
        if (responseData.choices && responseData.choices.length > 0) {
          const choice = responseData.choices[0];
          const message = choice.message;

          // Parse the structured JSON response
          let report: KeeperErrorReport;
          try {
            const content = message.content;
            if (typeof content === "string") {
              report = JSON.parse(content) as KeeperErrorReport;
            } else {
              report = content as KeeperErrorReport;
            }
          } catch (parseError) {
            console.error(
              "[VIGIL] Failed to parse structured response:",
              parseError
            );
            if (attempt === maxRetries - 1) {
              return {
                analyzed: true,
                status: "error",
                error: "Failed to parse AI response",
                summary: "AI analysis could not be parsed",
                timestamp: new Date().toISOString(),
              };
            }
            continue;
          }

          console.log("[VIGIL] Analysis completed successfully");

          return {
            analyzed: true,
            status: "success",
            report,
            summary: report.summary,
            timestamp: new Date().toISOString(),
            model: responseData.model || model,
            api_status: response.status,
            analysis_type: "workflow_failure",
          };
        }
        console.error("[VIGIL] No choices found in response");
        if (attempt === maxRetries - 1) {
          return {
            analyzed: true,
            status: "analysis_failed",
            error: "No choices in AI response",
            summary: "AI analysis returned no results",
            timestamp: new Date().toISOString(),
          };
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          console.error("[VIGIL] Request timeout");
          if (attempt === maxRetries - 1) {
            return {
              analyzed: true,
              status: "request_failed",
              error: "Request timeout",
              summary: "AI analysis request timed out",
              timestamp: new Date().toISOString(),
            };
          }
          continue;
        }

        if (error instanceof Error) {
          console.error(
            `[VIGIL] Request failed on attempt ${attempt + 1}:`,
            error.message
          );
          if (attempt === maxRetries - 1) {
            return {
              analyzed: true,
              status: "request_failed",
              error: error.message,
              summary: "Failed to connect to AI analysis service",
              timestamp: new Date().toISOString(),
            };
          }
          continue;
        }

        throw error;
      }
    }

    return {
      analyzed: true,
      status: "analysis_failed",
      error: "Max retries exceeded",
      summary: "AI analysis failed after multiple attempts",
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[VIGIL] AI analysis error:", error);
    return {
      analyzed: true,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      summary: "Internal error during AI analysis",
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Analyze workflow execution failure
 *
 * @param executionData - Execution data including error, logs, etc.
 * @returns VigilAnalysis result or null if analysis is disabled/failed
 */
export async function analyzeWorkflowFailure(
  executionData: ExecutionData
): Promise<VigilAnalysis | null> {
  console.log("[VIGIL] Starting workflow failure analysis");
  console.log(`[VIGIL] Execution ID: ${executionData.executionId}`);

  // Only analyze failed executions
  if (executionData.status !== "error") {
    console.log("[VIGIL] Execution did not fail, skipping analysis");
    return null;
  }

  try {
    const prompt = _buildAnalysisPrompt(executionData);
    const result = await _makeVigilRequest(prompt);

    if (result) {
      console.log(
        `[VIGIL] Analysis completed: ${result.status}, summary: ${result.summary}`
      );
    } else {
      console.log("[VIGIL] Analysis returned null");
    }

    return result;
  } catch (error) {
    console.error("[VIGIL] Workflow failure analysis error:", error);
    return {
      analyzed: false,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
      summary: "Internal error during workflow failure analysis",
      timestamp: new Date().toISOString(),
    };
  }
}
