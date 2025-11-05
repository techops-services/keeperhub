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
};

export const SlackSettings = ({
  apiKey,
  hasKey,
  onApiKeyChange,
}: SlackSettingsProps) => (
  <Card className="gap-4 border-0 py-0 shadow-none">
    <CardHeader className="px-0">
      <CardTitle>Slack</CardTitle>
      <CardDescription>
        Configure your Slack Bot Token to send messages from workflows
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4 rounded-md bg-secondary py-6">
      <div className="space-y-2">
        <Label htmlFor="slackApiKey">Bot Token</Label>
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
    </CardContent>
  </Card>
);
