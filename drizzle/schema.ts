import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const apiKeys = pgTable(
  "api_keys",
  {
    id: text().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    name: text(),
    keyHash: text("key_hash").notNull(),
    keyPrefix: text("key_prefix").notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    lastUsedAt: timestamp("last_used_at", { mode: "string" }),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "api_keys_user_id_users_id_fk",
    }),
  ]
);

export const integrations = pgTable(
  "integrations",
  {
    id: text().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    name: text().notNull(),
    type: text().notNull(),
    config: jsonb().notNull(),
    isManaged: boolean("is_managed").default(false),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "integrations_user_id_users_id_fk",
    }),
  ]
);

export const betaAccessRequests = pgTable("beta_access_requests", {
  id: text().primaryKey().notNull(),
  email: text().notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow().notNull(),
});

export const paraWallets = pgTable(
  "para_wallets",
  {
    id: text().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    email: text().notNull(),
    walletId: text("wallet_id").notNull(),
    walletAddress: text("wallet_address").notNull(),
    userShare: text("user_share").notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "para_wallets_user_id_users_id_fk",
    }).onDelete("cascade"),
    unique("para_wallets_user_id_unique").on(table.userId),
  ]
);

export const sessions = pgTable(
  "sessions",
  {
    id: text().primaryKey().notNull(),
    expiresAt: timestamp("expires_at", { mode: "string" }).notNull(),
    token: text().notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "sessions_user_id_users_id_fk",
    }),
    unique("sessions_token_unique").on(table.token),
  ]
);

export const workflowExecutionLogs = pgTable(
  "workflow_execution_logs",
  {
    id: text().primaryKey().notNull(),
    executionId: text("execution_id").notNull(),
    nodeId: text("node_id").notNull(),
    nodeName: text("node_name").notNull(),
    nodeType: text("node_type").notNull(),
    status: text().notNull(),
    input: jsonb(),
    output: jsonb(),
    error: text(),
    startedAt: timestamp("started_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { mode: "string" }),
    duration: text(),
    timestamp: timestamp({ mode: "string" }).defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.executionId],
      foreignColumns: [workflowExecutions.id],
      name: "workflow_execution_logs_execution_id_workflow_executions_id_fk",
    }),
  ]
);

export const verifications = pgTable("verifications", {
  id: text().primaryKey().notNull(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp("expires_at", { mode: "string" }).notNull(),
  createdAt: timestamp("created_at", { mode: "string" }),
  updatedAt: timestamp("updated_at", { mode: "string" }),
});

export const users = pgTable(
  "users",
  {
    id: text().primaryKey().notNull(),
    name: text(),
    email: text(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
    isAnonymous: boolean("is_anonymous").default(false),
  },
  (table) => [unique("users_email_unique").on(table.email)]
);

export const accounts = pgTable(
  "accounts",
  {
    id: text().primaryKey().notNull(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      mode: "string",
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      mode: "string",
    }),
    scope: text(),
    password: text(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "accounts_user_id_users_id_fk",
    }),
  ]
);

export const workflowExecutions = pgTable(
  "workflow_executions",
  {
    id: text().primaryKey().notNull(),
    workflowId: text("workflow_id").notNull(),
    userId: text("user_id").notNull(),
    status: text().notNull(),
    input: jsonb(),
    output: jsonb(),
    error: text(),
    startedAt: timestamp("started_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { mode: "string" }),
    duration: text(),
    totalSteps: text("total_steps"),
    completedSteps: text("completed_steps").default("0"),
    currentNodeId: text("current_node_id"),
    currentNodeName: text("current_node_name"),
    lastSuccessfulNodeId: text("last_successful_node_id"),
    lastSuccessfulNodeName: text("last_successful_node_name"),
    executionTrace: jsonb("execution_trace"),
  },
  (table) => [
    foreignKey({
      columns: [table.workflowId],
      foreignColumns: [workflows.id],
      name: "workflow_executions_workflow_id_workflows_id_fk",
    }),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "workflow_executions_user_id_users_id_fk",
    }),
  ]
);

export const workflows = pgTable(
  "workflows",
  {
    id: text().primaryKey().notNull(),
    name: text().notNull(),
    description: text(),
    userId: text("user_id").notNull(),
    nodes: jsonb().notNull(),
    edges: jsonb().notNull(),
    visibility: text().default("private").notNull(),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "workflows_user_id_users_id_fk",
    }),
  ]
);

export const workflowSchedules = pgTable(
  "workflow_schedules",
  {
    id: text().primaryKey().notNull(),
    workflowId: text("workflow_id").notNull(),
    cronExpression: text("cron_expression").notNull(),
    timezone: text().default("UTC").notNull(),
    enabled: boolean().default(true).notNull(),
    lastRunAt: timestamp("last_run_at", { withTimezone: true, mode: "string" }),
    lastStatus: text("last_status"),
    lastError: text("last_error"),
    nextRunAt: timestamp("next_run_at", { withTimezone: true, mode: "string" }),
    runCount: text("run_count").default("0"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_workflow_schedules_enabled").using(
      "btree",
      table.enabled.asc().nullsLast().op("bool_ops")
    ),
    uniqueIndex("idx_workflow_schedules_workflow").using(
      "btree",
      table.workflowId.asc().nullsLast().op("text_ops")
    ),
    foreignKey({
      columns: [table.workflowId],
      foreignColumns: [workflows.id],
      name: "workflow_schedules_workflow_id_workflows_id_fk",
    }).onDelete("cascade"),
    unique("workflow_schedules_workflow_id_unique").on(table.workflowId),
  ]
);

export const userRpcPreferences = pgTable(
  "user_rpc_preferences",
  {
    id: text().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    chainId: integer("chain_id").notNull(),
    primaryRpcUrl: text("primary_rpc_url").notNull(),
    fallbackRpcUrl: text("fallback_rpc_url"),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    primaryWssUrl: text("primary_wss_url"),
    fallbackWssUrl: text("fallback_wss_url"),
  },
  (table) => [
    uniqueIndex("idx_user_rpc_user_chain").using(
      "btree",
      table.userId.asc().nullsLast().op("int4_ops"),
      table.chainId.asc().nullsLast().op("int4_ops")
    ),
    index("idx_user_rpc_user_id").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops")
    ),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [users.id],
      name: "user_rpc_preferences_user_id_users_id_fk",
    }).onDelete("cascade"),
  ]
);

export const chains = pgTable(
  "chains",
  {
    id: text().primaryKey().notNull(),
    chainId: integer("chain_id").notNull(),
    name: text().notNull(),
    symbol: text().notNull(),
    defaultPrimaryRpc: text("default_primary_rpc").notNull(),
    defaultFallbackRpc: text("default_fallback_rpc"),
    isTestnet: boolean("is_testnet").default(false),
    isEnabled: boolean("is_enabled").default(true),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    defaultPrimaryWss: text("default_primary_wss"),
    defaultFallbackWss: text("default_fallback_wss"),
    chainType: text("chain_type").default("evm").notNull(),
    // KEEP-1240: Chain-specific gas configuration
    gasConfig: jsonb("gas_config").default({}),
  },
  (table) => [
    index("idx_chains_chain_id").using(
      "btree",
      table.chainId.asc().nullsLast().op("int4_ops")
    ),
    unique("chains_chain_id_unique").on(table.chainId),
  ]
);

export const explorerConfigs = pgTable(
  "explorer_configs",
  {
    id: text().primaryKey().notNull(),
    chainId: integer("chain_id").notNull(),
    chainType: text("chain_type").default("evm").notNull(),
    explorerUrl: text("explorer_url"),
    explorerApiType: text("explorer_api_type"),
    explorerApiUrl: text("explorer_api_url"),
    explorerTxPath: text("explorer_tx_path").default("/tx/{hash}"),
    explorerAddressPath: text("explorer_address_path").default(
      "/address/{address}"
    ),
    explorerContractPath: text("explorer_contract_path"),
    createdAt: timestamp("created_at", { mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_explorer_configs_chain_id").using(
      "btree",
      table.chainId.asc().nullsLast().op("int4_ops")
    ),
    foreignKey({
      columns: [table.chainId],
      foreignColumns: [chains.chainId],
      name: "explorer_configs_chain_id_fkey",
    }).onDelete("cascade"),
    unique("explorer_configs_chain_id_key").on(table.chainId),
  ]
);
