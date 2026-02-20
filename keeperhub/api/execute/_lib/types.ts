export type ExecutionType = "transfer" | "contract-call" | "check-and-execute";

export type ExecutionStatus = "pending" | "running" | "completed" | "failed";

export type ExecuteResponse = {
  executionId: string;
  status: ExecutionStatus;
};

export type ExecutionStatusResponse = {
  executionId: string;
  status: ExecutionStatus;
  type: ExecutionType;
  transactionHash: string | null;
  transactionLink: string | null;
  result: unknown;
  error: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type ExecuteErrorResponse = {
  error: string;
  details?: string;
  field?: string;
};
