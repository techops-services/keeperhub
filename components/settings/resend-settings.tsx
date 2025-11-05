import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ResendSettingsProps = {
  apiKey: string;
  fromEmail: string;
  hasKey?: boolean;
  onApiKeyChange: (key: string) => void;
  onFromEmailChange: (email: string) => void;
};

export const ResendSettings = ({
  apiKey,
  fromEmail,
  hasKey,
  onApiKeyChange,
  onFromEmailChange,
}: ResendSettingsProps) => (
  <Card className="gap-4 border-0 py-0 shadow-none">
    <CardHeader className="px-0">
      <CardTitle>Resend (Email)</CardTitle>
      <CardDescription>
        Configure your Resend API key to send emails from workflows
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4 rounded-md bg-secondary py-6">
      <div className="space-y-2">
        <Label htmlFor="resendApiKey">API Key</Label>
        <Input
          className="bg-background"
          id="resendApiKey"
          onChange={(e) => onApiKeyChange(e.target.value)}
          placeholder={
            hasKey ? "API key is configured" : "Enter your Resend API key"
          }
          type="password"
          value={apiKey}
        />
        <p className="text-muted-foreground text-sm">
          Get your API key from{" "}
          <a
            className="text-primary underline"
            href="https://resend.com/api-keys"
            rel="noopener noreferrer"
            target="_blank"
          >
            Resend
          </a>
          .
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="resendFromEmail">From Email</Label>
        <Input
          className="bg-background"
          id="resendFromEmail"
          onChange={(e) => onFromEmailChange(e.target.value)}
          placeholder="noreply@yourdomain.com"
          type="email"
          value={fromEmail}
        />
        <p className="text-muted-foreground text-sm">
          The email address that will appear as the sender.
        </p>
      </div>
    </CardContent>
  </Card>
);
