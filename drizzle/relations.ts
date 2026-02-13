import { relations } from "drizzle-orm/relations";
import { users, sessions, workflowExecutions, workflowExecutionLogs, integrations, organization, organizationApiKeys, accounts, workflows, workflowSchedules, paraWallets, organizationTokens, apiKeys, tags, invitation, member, addressBookEntry, projects, categories, protocols, chains, explorerConfigs, userRpcPreferences } from "./schema";

export const sessionsRelations = relations(sessions, ({one}) => ({
	user: one(users, {
		fields: [sessions.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	sessions: many(sessions),
	integrations: many(integrations),
	organizationApiKeys: many(organizationApiKeys),
	accounts: many(accounts),
	workflowExecutions: many(workflowExecutions),
	paraWallets: many(paraWallets),
	apiKeys: many(apiKeys),
	tags: many(tags),
	invitations: many(invitation),
	members: many(member),
	addressBookEntries: many(addressBookEntry),
	workflows: many(workflows),
	protocols: many(protocols),
	projects: many(projects),
	categories: many(categories),
	userRpcPreferences: many(userRpcPreferences),
}));

export const workflowExecutionLogsRelations = relations(workflowExecutionLogs, ({one}) => ({
	workflowExecution: one(workflowExecutions, {
		fields: [workflowExecutionLogs.executionId],
		references: [workflowExecutions.id]
	}),
}));

export const workflowExecutionsRelations = relations(workflowExecutions, ({one, many}) => ({
	workflowExecutionLogs: many(workflowExecutionLogs),
	workflow: one(workflows, {
		fields: [workflowExecutions.workflowId],
		references: [workflows.id]
	}),
	user: one(users, {
		fields: [workflowExecutions.userId],
		references: [users.id]
	}),
}));

export const integrationsRelations = relations(integrations, ({one}) => ({
	user: one(users, {
		fields: [integrations.userId],
		references: [users.id]
	}),
	organization: one(organization, {
		fields: [integrations.organizationId],
		references: [organization.id]
	}),
}));

export const organizationRelations = relations(organization, ({many}) => ({
	integrations: many(integrations),
	organizationApiKeys: many(organizationApiKeys),
	paraWallets: many(paraWallets),
	organizationTokens: many(organizationTokens),
	tags: many(tags),
	invitations: many(invitation),
	members: many(member),
	addressBookEntries: many(addressBookEntry),
	workflows: many(workflows),
	protocols: many(protocols),
	projects: many(projects),
	categories: many(categories),
}));

export const organizationApiKeysRelations = relations(organizationApiKeys, ({one}) => ({
	organization: one(organization, {
		fields: [organizationApiKeys.organizationId],
		references: [organization.id]
	}),
	user: one(users, {
		fields: [organizationApiKeys.createdBy],
		references: [users.id]
	}),
}));

export const accountsRelations = relations(accounts, ({one}) => ({
	user: one(users, {
		fields: [accounts.userId],
		references: [users.id]
	}),
}));

export const workflowsRelations = relations(workflows, ({one, many}) => ({
	workflowExecutions: many(workflowExecutions),
	workflowSchedules: many(workflowSchedules),
	user: one(users, {
		fields: [workflows.userId],
		references: [users.id]
	}),
	organization: one(organization, {
		fields: [workflows.organizationId],
		references: [organization.id]
	}),
	project: one(projects, {
		fields: [workflows.projectId],
		references: [projects.id]
	}),
	tag: one(tags, {
		fields: [workflows.tagId],
		references: [tags.id]
	}),
	category: one(categories, {
		fields: [workflows.categoryId],
		references: [categories.id]
	}),
	protocol: one(protocols, {
		fields: [workflows.protocolId],
		references: [protocols.id]
	}),
}));

export const workflowSchedulesRelations = relations(workflowSchedules, ({one}) => ({
	workflow: one(workflows, {
		fields: [workflowSchedules.workflowId],
		references: [workflows.id]
	}),
}));

export const paraWalletsRelations = relations(paraWallets, ({one}) => ({
	user: one(users, {
		fields: [paraWallets.userId],
		references: [users.id]
	}),
	organization: one(organization, {
		fields: [paraWallets.organizationId],
		references: [organization.id]
	}),
}));

export const organizationTokensRelations = relations(organizationTokens, ({one}) => ({
	organization: one(organization, {
		fields: [organizationTokens.organizationId],
		references: [organization.id]
	}),
}));

export const apiKeysRelations = relations(apiKeys, ({one}) => ({
	user: one(users, {
		fields: [apiKeys.userId],
		references: [users.id]
	}),
}));

export const tagsRelations = relations(tags, ({one, many}) => ({
	organization: one(organization, {
		fields: [tags.organizationId],
		references: [organization.id]
	}),
	user: one(users, {
		fields: [tags.userId],
		references: [users.id]
	}),
	workflows: many(workflows),
}));

export const invitationRelations = relations(invitation, ({one}) => ({
	organization: one(organization, {
		fields: [invitation.organizationId],
		references: [organization.id]
	}),
	user: one(users, {
		fields: [invitation.inviterId],
		references: [users.id]
	}),
}));

export const memberRelations = relations(member, ({one}) => ({
	organization: one(organization, {
		fields: [member.organizationId],
		references: [organization.id]
	}),
	user: one(users, {
		fields: [member.userId],
		references: [users.id]
	}),
}));

export const addressBookEntryRelations = relations(addressBookEntry, ({one}) => ({
	organization: one(organization, {
		fields: [addressBookEntry.organizationId],
		references: [organization.id]
	}),
	user: one(users, {
		fields: [addressBookEntry.createdBy],
		references: [users.id]
	}),
}));

export const projectsRelations = relations(projects, ({one, many}) => ({
	workflows: many(workflows),
	organization: one(organization, {
		fields: [projects.organizationId],
		references: [organization.id]
	}),
	user: one(users, {
		fields: [projects.userId],
		references: [users.id]
	}),
}));

export const categoriesRelations = relations(categories, ({one, many}) => ({
	workflows: many(workflows),
	organization: one(organization, {
		fields: [categories.organizationId],
		references: [organization.id]
	}),
	user: one(users, {
		fields: [categories.userId],
		references: [users.id]
	}),
}));

export const protocolsRelations = relations(protocols, ({one, many}) => ({
	workflows: many(workflows),
	organization: one(organization, {
		fields: [protocols.organizationId],
		references: [organization.id]
	}),
	user: one(users, {
		fields: [protocols.userId],
		references: [users.id]
	}),
}));

export const explorerConfigsRelations = relations(explorerConfigs, ({one}) => ({
	chain: one(chains, {
		fields: [explorerConfigs.chainId],
		references: [chains.chainId]
	}),
}));

export const chainsRelations = relations(chains, ({many}) => ({
	explorerConfigs: many(explorerConfigs),
}));

export const userRpcPreferencesRelations = relations(userRpcPreferences, ({one}) => ({
	user: one(users, {
		fields: [userRpcPreferences.userId],
		references: [users.id]
	}),
}));