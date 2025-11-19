import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AiGatewaySettingsProps = {
  apiKey: string;
  hasKey?: boolean;
  onApiKeyChange: (key: string) => void;
  showCard?: boolean;
};

export const AiGatewaySettings = ({
  apiKey,
  hasKey,
  onApiKeyChange,
  showCard = true,
}: AiGatewaySettingsProps) => {
  const content = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="ml-1" htmlFor="aiGatewayApiKey">
          API Key
        </Label>
        <Input
          className="bg-background"
          id="aiGatewayApiKey"
          onChange={(e) => onApiKeyChange(e.target.value)}
          placeholder={
            hasKey ? "API key is configured" : "Enter your AI Gateway API key"
          }
          type="password"
          value={apiKey}
        />
        <p className="text-muted-foreground text-sm">
          Get your API key from{" "}
          <a
            className="text-primary underline"
            href="https://vercel.com/docs/ai-gateway/getting-started"
            rel="noopener noreferrer"
            target="_blank"
          >
            Vercel AI Gateway
          </a>
          .
        </p>
      </div>
    </div>
  );

  if (!showCard) {
    return content;
  }

  return (
    <Card className="gap-4 border-0 py-0 shadow-none">
      <CardHeader className="px-0">
        <CardTitle>AI Gateway</CardTitle>
        <CardDescription>
          Configure your AI Gateway API key to use AI models in workflows
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">{content}</CardContent>
    </Card>
  );
};
