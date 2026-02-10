import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Box,
  Clock,
  Code,
  GitBranch,
  Hash,
  Mail,
  Play,
  User,
  Zap,
} from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DiscordIcon } from "@/keeperhub/plugins/discord/icon";
import { Web3Icon } from "@/keeperhub/plugins/web3/icon";
import { WebhookIcon } from "@/keeperhub/plugins/webhook/icon";
import type { WorkflowNode } from "@/lib/workflow-store";

const MAX_VISIBLE = 4;

type IconType =
  | LucideIcon
  | (({
      className,
      style,
    }: {
      className?: string;
      style?: CSSProperties;
    }) => ReactNode);

type IntegrationEntry = {
  key: string;
  label: string;
  Icon: IconType;
};

function getTriggerInfo(triggerType: string | undefined): {
  Icon: IconType;
  label: string;
} {
  switch (triggerType) {
    case "Schedule":
      return { Icon: Clock, label: "Schedule trigger" };
    case "Webhook":
      return { Icon: Zap, label: "Webhook trigger" };
    default:
      return { Icon: Play, label: "Manual trigger" };
  }
}

function getActionInfo(actionType: string): { Icon: IconType; label: string } {
  if (actionType.includes("/")) {
    const slug = actionType.split("/")[0];
    switch (slug) {
      case "web3":
        return { Icon: Web3Icon, label: "Web3" };
      case "discord":
        return { Icon: DiscordIcon, label: "Discord" };
      case "slack":
        return { Icon: Hash, label: "Slack" };
      case "sendgrid":
        return { Icon: Mail, label: "Email" };
      case "resend":
        return { Icon: Mail, label: "Resend" };
      case "webhook":
        return { Icon: WebhookIcon, label: "Webhook" };
      case "ai-gateway":
        return { Icon: Bot, label: "AI Gateway" };
      case "clerk":
        return { Icon: User, label: "Clerk" };
      default:
        return { Icon: Box, label: slug };
    }
  }

  const lower = actionType.toLowerCase();
  if (
    lower.includes("balance") ||
    lower.includes("transfer") ||
    lower.includes("contract")
  ) {
    return { Icon: Web3Icon, label: "Web3" };
  }
  if (lower.includes("slack")) {
    return { Icon: Hash, label: "Slack" };
  }
  if (lower.includes("discord")) {
    return { Icon: DiscordIcon, label: "Discord" };
  }
  if (lower.includes("email") || lower.includes("sendgrid")) {
    return { Icon: Mail, label: "Email" };
  }
  if (lower.includes("webhook")) {
    return { Icon: WebhookIcon, label: "Webhook" };
  }
  if (lower.includes("http") || lower.includes("request")) {
    return { Icon: Code, label: "HTTP Request" };
  }
  if (lower === "condition") {
    return { Icon: GitBranch, label: "Condition" };
  }
  return { Icon: Box, label: actionType };
}

function getNodeEntry(
  node: WorkflowNode
): { key: string; info: { Icon: IconType; label: string } } | null {
  const isTrigger = node.type === "trigger" || node.data?.type === "trigger";

  if (isTrigger) {
    const triggerType = node.data?.config?.triggerType as string | undefined;
    return {
      key: `trigger-${triggerType ?? "manual"}`,
      info: getTriggerInfo(triggerType),
    };
  }

  const actionType = node.data?.config?.actionType as string | undefined;
  if (!actionType) {
    return null;
  }

  const key = actionType.includes("/")
    ? actionType.split("/")[0]
    : actionType.toLowerCase();
  return { key, info: getActionInfo(actionType) };
}

function getUniqueIntegrations(nodes: WorkflowNode[]): IntegrationEntry[] {
  const seen = new Set<string>();
  const integrations: IntegrationEntry[] = [];

  for (const node of nodes) {
    if (node.type === "add") {
      continue;
    }

    const entry = getNodeEntry(node);
    if (!entry || seen.has(entry.key)) {
      continue;
    }

    seen.add(entry.key);
    integrations.push({
      key: entry.key,
      label: entry.info.label,
      Icon: entry.info.Icon,
    });
  }

  return integrations;
}

type WorkflowNodeIconsProps = {
  nodes: WorkflowNode[];
};

export function WorkflowNodeIcons({ nodes }: WorkflowNodeIconsProps) {
  const integrations = getUniqueIntegrations(nodes);
  const visible = integrations.slice(0, MAX_VISIBLE);
  const overflow = integrations.length - MAX_VISIBLE;

  return (
    <div className="flex items-center gap-2">
      {visible.map(({ key, label, Icon }) => (
        <Tooltip key={key}>
          <TooltipTrigger asChild>
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#2a3342] transition-colors hover:bg-[#354155]">
              <Icon className="size-5 text-slate-400" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">{label}</TooltipContent>
        </Tooltip>
      ))}
      {overflow > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex size-10 items-center justify-center rounded-lg bg-[#2a3342] transition-colors hover:bg-[#354155]">
              <span className="font-medium text-slate-400 text-sm">
                +{overflow}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="top">{overflow} more</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
