import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LinearSettingsProps = {
  apiKey: string;
  hasKey?: boolean;
  onApiKeyChange: (key: string) => void;
};

export const LinearSettings = ({
  apiKey,
  hasKey,
  onApiKeyChange,
}: LinearSettingsProps) => (
  <Card className="gap-4 border-0 py-0 shadow-none">
    <CardHeader className="px-0">
      <CardTitle>Linear</CardTitle>
      <CardDescription>
        Configure your Linear API key to create and manage tickets from
        workflows
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4 py-6">
      <div className="space-y-2">
        <Label className="ml-1" htmlFor="linearApiKey">
          API Key
        </Label>
        <Input
          className="bg-background"
          id="linearApiKey"
          onChange={(e) => onApiKeyChange(e.target.value)}
          placeholder={
            hasKey ? "API key is configured" : "Enter your Linear API key"
          }
          type="password"
          value={apiKey}
        />
        <p className="text-muted-foreground text-sm">
          Get your API key from{" "}
          <a
            className="text-primary underline"
            href="https://linear.app/settings/account/security/api-keys/new"
            rel="noopener noreferrer"
            target="_blank"
          >
            Linear
          </a>
          .
        </p>
      </div>
    </CardContent>
  </Card>
);
