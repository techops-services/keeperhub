import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ErrorCategory,
  logAuthError,
  logConfigurationError,
  logDatabaseError,
  logExternalServiceError,
  logInfrastructureError,
  logNetworkError,
  logSystemError,
  logTransactionError,
  logUserError,
  logValidationError,
  logWorkflowEngineError,
} from "@/keeperhub/lib/logging";
import {
  LabelKeys,
  MetricNames,
  type MetricsCollector,
  resetMetricsCollector,
  setMetricsCollector,
} from "@/keeperhub/lib/metrics";

describe("Unified Logging Helpers", () => {
  let mockCollector: MetricsCollector;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    resetMetricsCollector();

    // Create mock collector
    mockCollector = {
      recordLatency: vi.fn(),
      incrementCounter: vi.fn(),
      recordError: vi.fn(),
      setGauge: vi.fn(),
    };
    setMetricsCollector(mockCollector);

    // Spy on console methods
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
      // noop - suppress console output
    });
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {
      // noop - suppress console output
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    resetMetricsCollector();
  });

  describe("logUserError", () => {
    it("should log as warning and emit metric", () => {
      logUserError(
        ErrorCategory.VALIDATION,
        "[Test] Invalid input",
        "details",
        { foo: "bar" }
      );

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[Test] Invalid input",
        "details"
      );
      expect(consoleErrorSpy).not.toHaveBeenCalled();

      expect(mockCollector.recordError).toHaveBeenCalledWith(
        MetricNames.USER_VALIDATION_ERRORS,
        { message: "[Test] Invalid input" },
        expect.objectContaining({
          [LabelKeys.ERROR_CATEGORY]: ErrorCategory.VALIDATION,
          [LabelKeys.ERROR_CONTEXT]: "Test",
          [LabelKeys.IS_USER_ERROR]: "true",
          foo: "bar",
        })
      );
    });

    it("should handle Error objects", () => {
      const error = new Error("Test error");
      logUserError(ErrorCategory.VALIDATION, "[Context] Error occurred", error);

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[Context] Error occurred",
        error
      );
      expect(mockCollector.recordError).toHaveBeenCalledWith(
        MetricNames.USER_VALIDATION_ERRORS,
        error,
        expect.objectContaining({
          [LabelKeys.ERROR_CATEGORY]: ErrorCategory.VALIDATION,
          [LabelKeys.ERROR_CONTEXT]: "Context",
          [LabelKeys.IS_USER_ERROR]: "true",
        })
      );
    });

    it("should handle undefined error details", () => {
      logUserError(ErrorCategory.VALIDATION, "[Test] Simple warning");

      expect(consoleWarnSpy).toHaveBeenCalledWith("[Test] Simple warning", "");
      expect(mockCollector.recordError).toHaveBeenCalledWith(
        MetricNames.USER_VALIDATION_ERRORS,
        { message: "[Test] Simple warning" },
        expect.objectContaining({
          [LabelKeys.IS_USER_ERROR]: "true",
        })
      );
    });

    it("should extract context from message prefix", () => {
      logUserError(ErrorCategory.VALIDATION, "[Discord Bot] Invalid token");

      expect(mockCollector.recordError).toHaveBeenCalledWith(
        MetricNames.USER_VALIDATION_ERRORS,
        expect.anything(),
        expect.objectContaining({
          [LabelKeys.ERROR_CONTEXT]: "Discord Bot",
        })
      );
    });

    it("should use Unknown context when prefix is missing", () => {
      logUserError(ErrorCategory.VALIDATION, "No prefix message");

      expect(mockCollector.recordError).toHaveBeenCalledWith(
        MetricNames.USER_VALIDATION_ERRORS,
        expect.anything(),
        expect.objectContaining({
          [LabelKeys.ERROR_CONTEXT]: "Unknown",
        })
      );
    });

    it("should map to correct metric for each user error category", () => {
      const categories = [
        {
          category: ErrorCategory.VALIDATION,
          metric: MetricNames.USER_VALIDATION_ERRORS,
        },
        {
          category: ErrorCategory.CONFIGURATION,
          metric: MetricNames.USER_CONFIGURATION_ERRORS,
        },
        {
          category: ErrorCategory.EXTERNAL_SERVICE,
          metric: MetricNames.EXTERNAL_SERVICE_ERRORS,
        },
        {
          category: ErrorCategory.NETWORK_RPC,
          metric: MetricNames.NETWORK_RPC_ERRORS,
        },
        {
          category: ErrorCategory.TRANSACTION,
          metric: MetricNames.TRANSACTION_BLOCKCHAIN_ERRORS,
        },
      ];

      for (const { category, metric } of categories) {
        vi.clearAllMocks();
        logUserError(category, "[Test] Error", "details");

        expect(mockCollector.recordError).toHaveBeenCalledWith(
          metric,
          expect.anything(),
          expect.anything()
        );
      }
    });
  });

  describe("logSystemError", () => {
    it("should log as error and emit metric", () => {
      const error = new Error("System failure");
      logSystemError(ErrorCategory.DATABASE, "[DB] Connection failed", error, {
        table: "workflows",
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[DB] Connection failed",
        error
      );
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      expect(mockCollector.recordError).toHaveBeenCalledWith(
        MetricNames.SYSTEM_DATABASE_ERRORS,
        error,
        expect.objectContaining({
          [LabelKeys.ERROR_CATEGORY]: ErrorCategory.DATABASE,
          [LabelKeys.ERROR_CONTEXT]: "DB",
          [LabelKeys.IS_USER_ERROR]: "false",
          table: "workflows",
        })
      );
    });

    it("should convert non-Error objects to string", () => {
      logSystemError(ErrorCategory.DATABASE, "[DB] Error", "string error");

      expect(mockCollector.recordError).toHaveBeenCalledWith(
        MetricNames.SYSTEM_DATABASE_ERRORS,
        { message: "string error" },
        expect.anything()
      );
    });

    it("should map to correct metric for each system error category", () => {
      const categories = [
        {
          category: ErrorCategory.DATABASE,
          metric: MetricNames.SYSTEM_DATABASE_ERRORS,
        },
        {
          category: ErrorCategory.AUTH,
          metric: MetricNames.SYSTEM_AUTH_ERRORS,
        },
        {
          category: ErrorCategory.INFRASTRUCTURE,
          metric: MetricNames.SYSTEM_INFRASTRUCTURE_ERRORS,
        },
        {
          category: ErrorCategory.WORKFLOW_ENGINE,
          metric: MetricNames.SYSTEM_WORKFLOW_ENGINE_ERRORS,
        },
      ];

      for (const { category, metric } of categories) {
        vi.clearAllMocks();
        const error = new Error("Test");
        logSystemError(category, "[Test] Error", error);

        expect(mockCollector.recordError).toHaveBeenCalledWith(
          metric,
          error,
          expect.anything()
        );
      }
    });

    it("should fallback to API_ERRORS_TOTAL for unknown category", () => {
      logSystemError(
        ErrorCategory.UNKNOWN,
        "[Unknown] Error",
        new Error("test")
      );

      expect(mockCollector.recordError).toHaveBeenCalledWith(
        MetricNames.API_ERRORS_TOTAL,
        expect.anything(),
        expect.anything()
      );
    });
  });

  describe("logValidationError", () => {
    it("should use VALIDATION category and log as warning", () => {
      logValidationError("[Check Balance] Invalid address:", "0xINVALID", {
        plugin_name: "web3",
        action_name: "check-balance",
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[Check Balance] Invalid address:",
        "0xINVALID"
      );

      expect(mockCollector.recordError).toHaveBeenCalledWith(
        MetricNames.USER_VALIDATION_ERRORS,
        { message: "[Check Balance] Invalid address:" },
        expect.objectContaining({
          [LabelKeys.ERROR_CATEGORY]: ErrorCategory.VALIDATION,
          [LabelKeys.ERROR_CONTEXT]: "Check Balance",
          [LabelKeys.IS_USER_ERROR]: "true",
          plugin_name: "web3",
          action_name: "check-balance",
        })
      );
    });
  });

  describe("logConfigurationError", () => {
    it("should use CONFIGURATION category and log as warning", () => {
      logConfigurationError("[Discord] Missing bot token", undefined, {
        integration_id: "abc123",
      });

      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(mockCollector.recordError).toHaveBeenCalledWith(
        MetricNames.USER_CONFIGURATION_ERRORS,
        expect.anything(),
        expect.objectContaining({
          [LabelKeys.ERROR_CATEGORY]: ErrorCategory.CONFIGURATION,
          integration_id: "abc123",
        })
      );
    });
  });

  describe("logExternalServiceError", () => {
    it("should use EXTERNAL_SERVICE category and log as warning", () => {
      const error = new Error("API timeout");
      logExternalServiceError("[Etherscan] Request failed", error, {
        service: "etherscan",
      });

      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(mockCollector.recordError).toHaveBeenCalledWith(
        MetricNames.EXTERNAL_SERVICE_ERRORS,
        error,
        expect.objectContaining({
          [LabelKeys.ERROR_CATEGORY]: ErrorCategory.EXTERNAL_SERVICE,
          service: "etherscan",
        })
      );
    });
  });

  describe("logNetworkError", () => {
    it("should use NETWORK_RPC category and log as warning", () => {
      logNetworkError("[RPC] Connection timeout", undefined, {
        chain_id: "1",
      });

      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(mockCollector.recordError).toHaveBeenCalledWith(
        MetricNames.NETWORK_RPC_ERRORS,
        expect.anything(),
        expect.objectContaining({
          [LabelKeys.ERROR_CATEGORY]: ErrorCategory.NETWORK_RPC,
          chain_id: "1",
        })
      );
    });
  });

  describe("logTransactionError", () => {
    it("should use TRANSACTION category and log as warning", () => {
      const error = new Error("Gas estimation failed");
      logTransactionError("[Transaction] Failed to send", error, {
        tx_hash: "0x123",
      });

      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(mockCollector.recordError).toHaveBeenCalledWith(
        MetricNames.TRANSACTION_BLOCKCHAIN_ERRORS,
        error,
        expect.objectContaining({
          [LabelKeys.ERROR_CATEGORY]: ErrorCategory.TRANSACTION,
          tx_hash: "0x123",
        })
      );
    });
  });

  describe("logDatabaseError", () => {
    it("should use DATABASE category and log as error", () => {
      const error = new Error("Query failed");
      logDatabaseError("[DB] Insert failed", error, {
        table: "workflows",
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalled();

      expect(mockCollector.recordError).toHaveBeenCalledWith(
        MetricNames.SYSTEM_DATABASE_ERRORS,
        error,
        expect.objectContaining({
          [LabelKeys.ERROR_CATEGORY]: ErrorCategory.DATABASE,
          [LabelKeys.IS_USER_ERROR]: "false",
          table: "workflows",
        })
      );
    });
  });

  describe("logAuthError", () => {
    it("should use AUTH category and log as error", () => {
      const error = new Error("Session invalid");
      logAuthError("[Auth] Verification failed", error, {
        endpoint: "/api/workflows",
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(mockCollector.recordError).toHaveBeenCalledWith(
        MetricNames.SYSTEM_AUTH_ERRORS,
        error,
        expect.objectContaining({
          [LabelKeys.ERROR_CATEGORY]: ErrorCategory.AUTH,
          [LabelKeys.IS_USER_ERROR]: "false",
        })
      );
    });
  });

  describe("logInfrastructureError", () => {
    it("should use INFRASTRUCTURE category and log as error", () => {
      const error = new Error("Deployment failed");
      logInfrastructureError("[Infrastructure] Init failed", error, {
        component: "metrics",
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(mockCollector.recordError).toHaveBeenCalledWith(
        MetricNames.SYSTEM_INFRASTRUCTURE_ERRORS,
        error,
        expect.objectContaining({
          [LabelKeys.ERROR_CATEGORY]: ErrorCategory.INFRASTRUCTURE,
          component: "metrics",
        })
      );
    });
  });

  describe("logWorkflowEngineError", () => {
    it("should use WORKFLOW_ENGINE category and log as error", () => {
      const error = new Error("Step execution failed");
      logWorkflowEngineError("[Workflow] Step failed", error, {
        workflow_id: "abc123",
        step_id: "xyz789",
      });

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(mockCollector.recordError).toHaveBeenCalledWith(
        MetricNames.SYSTEM_WORKFLOW_ENGINE_ERRORS,
        error,
        expect.objectContaining({
          [LabelKeys.ERROR_CATEGORY]: ErrorCategory.WORKFLOW_ENGINE,
          [LabelKeys.IS_USER_ERROR]: "false",
          workflow_id: "abc123",
          step_id: "xyz789",
        })
      );
    });
  });

  describe("Context extraction", () => {
    it("should extract simple context", () => {
      logValidationError("[Discord] Error");

      expect(mockCollector.recordError).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          [LabelKeys.ERROR_CONTEXT]: "Discord",
        })
      );
    });

    it("should extract multi-word context", () => {
      logValidationError("[Check Balance] Error");

      expect(mockCollector.recordError).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          [LabelKeys.ERROR_CONTEXT]: "Check Balance",
        })
      );
    });

    it("should extract context with special characters", () => {
      logValidationError("[Web3/RPC] Error");

      expect(mockCollector.recordError).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          [LabelKeys.ERROR_CONTEXT]: "Web3/RPC",
        })
      );
    });

    it("should handle message without context prefix", () => {
      logValidationError("Plain error message");

      expect(mockCollector.recordError).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          [LabelKeys.ERROR_CONTEXT]: "Unknown",
        })
      );
    });
  });

  describe("Label merging", () => {
    it("should merge custom labels with standard labels", () => {
      logValidationError("[Test] Error", undefined, {
        custom_label: "value",
        another_label: "value2",
      });

      expect(mockCollector.recordError).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          [LabelKeys.ERROR_CATEGORY]: ErrorCategory.VALIDATION,
          [LabelKeys.ERROR_CONTEXT]: "Test",
          [LabelKeys.IS_USER_ERROR]: "true",
          custom_label: "value",
          another_label: "value2",
        })
      );
    });

    it("should handle empty labels object", () => {
      logValidationError("[Test] Error", undefined, {});

      expect(mockCollector.recordError).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.objectContaining({
          [LabelKeys.ERROR_CATEGORY]: ErrorCategory.VALIDATION,
        })
      );
    });
  });
});
