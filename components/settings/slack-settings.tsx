import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SlackSettingsProps = {
  apiKey: string;
  hasKey?: boolean;
  onApiKeyChange: (key: string) => void;
  showCard?: boolean;
};

export const SlackSettings = ({
  apiKey,
  hasKey,
  onApiKeyChange,
  showCard = true,
}: SlackSettingsProps) => {
  const content = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="ml-1" htmlFor="slackApiKey">
          Bot Token
        </Label>
        <Input
          className="bg-background"
          id="slackApiKey"
          onChange={(e) => onApiKeyChange(e.target.value)}
          placeholder={
            hasKey ? "Bot token is configured" : "Enter your Slack Bot Token"
          }
          type="password"
          value={apiKey}
        />
        <p className="text-muted-foreground text-sm">
          Create a Slack app and get your Bot Token from{" "}
          <a
            className="text-primary hover:underline"
            href="https://api.slack.com/apps"
            rel="noopener noreferrer"
            target="_blank"
          >
            api.slack.com/apps
          </a>
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
        <CardTitle>Slack</CardTitle>
        <CardDescription>
          Configure your Slack Bot Token to send messages from workflows
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">{content}</CardContent>
    </Card>
  );
};
