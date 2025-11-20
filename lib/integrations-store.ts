import { atom } from "jotai";
import type { ProjectIntegrations } from "@/lib/api-client";

// Re-export the type from API routes
export type { ProjectIntegrations } from "@/lib/api-client";

export const projectIntegrationsAtom = atom<ProjectIntegrations | null>(null);
