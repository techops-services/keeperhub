import { relations } from "drizzle-orm/relations";
import {
  accounts,
  apiKeys,
  chains,
  explorerConfigs,
  integrations,
  paraWallets,
  sessions,
  userRpcPreferences,
  users,
  workflowExecutionLogs,
  workflowExecutions,
  workflowSchedules,
  workflows,
} from "./schema";

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  apiKeys: many(apiKeys),
  integrations: many(integrations),
  paraWallets: many(paraWallets),
  sessions: many(sessions),
  accounts: many(accounts),
  workflowExecutions: many(workflowExecutions),
  workflows: many(workflows),
  userRpcPreferences: many(userRpcPreferences),
}));

export const integrationsRelations = relations(integrations, ({ one }) => ({
  user: one(users, {
    fields: [integrations.userId],
    references: [users.id],
  }),
}));

export const paraWalletsRelations = relations(paraWallets, ({ one }) => ({
  user: one(users, {
    fields: [paraWallets.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const workflowExecutionLogsRelations = relations(
  workflowExecutionLogs,
  ({ one }) => ({
    workflowExecution: one(workflowExecutions, {
      fields: [workflowExecutionLogs.executionId],
      references: [workflowExecutions.id],
    }),
  })
);

export const workflowExecutionsRelations = relations(
  workflowExecutions,
  ({ one, many }) => ({
    workflowExecutionLogs: many(workflowExecutionLogs),
    workflow: one(workflows, {
      fields: [workflowExecutions.workflowId],
      references: [workflows.id],
    }),
    user: one(users, {
      fields: [workflowExecutions.userId],
      references: [users.id],
    }),
  })
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  workflowExecutions: many(workflowExecutions),
  user: one(users, {
    fields: [workflows.userId],
    references: [users.id],
  }),
  workflowSchedules: many(workflowSchedules),
}));

export const workflowSchedulesRelations = relations(
  workflowSchedules,
  ({ one }) => ({
    workflow: one(workflows, {
      fields: [workflowSchedules.workflowId],
      references: [workflows.id],
    }),
  })
);

export const userRpcPreferencesRelations = relations(
  userRpcPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [userRpcPreferences.userId],
      references: [users.id],
    }),
  })
);

export const explorerConfigsRelations = relations(
  explorerConfigs,
  ({ one }) => ({
    chain: one(chains, {
      fields: [explorerConfigs.chainId],
      references: [chains.chainId],
    }),
  })
);

export const chainsRelations = relations(chains, ({ many }) => ({
  explorerConfigs: many(explorerConfigs),
}));
