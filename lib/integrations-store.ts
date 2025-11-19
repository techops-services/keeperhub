import { atom } from "jotai";
import type { ProjectIntegrations } from "@/app/actions/vercel-project/get-integrations";

export const projectIntegrationsAtom = atom<ProjectIntegrations | null>(null);

