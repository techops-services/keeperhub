import { Webhook } from "lucide-react";

export function WebhookIcon({
  className,
  style,
}: { className?: string; style?: React.CSSProperties }) {
  return <Webhook className={`${className}`} style={style} strokeWidth={1.5} />;
}
