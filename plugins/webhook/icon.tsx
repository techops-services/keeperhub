import { Webhook } from "lucide-react";

export function WebhookIcon({ className }: { className?: string }) {
  return (
    <Webhook className={`${className}`} strokeWidth={1.5} />
  );
}

