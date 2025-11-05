import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type VercelSettingsProps = {
  apiToken: string;
  teamId: string;
  hasToken?: boolean;
  onApiTokenChange: (token: string) => void;
  onTeamIdChange: (id: string) => void;
};

export const VercelSettings = ({
  apiToken,
  teamId,
  hasToken,
  onApiTokenChange,
  onTeamIdChange,
}: VercelSettingsProps) => (
  <Card className="gap-4 border-0 py-0 shadow-none">
    <CardHeader className="px-0">
      <CardTitle>Vercel</CardTitle>
      <CardDescription>
        Configure your Vercel API token to manage projects and deployments from
        workflows
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-4 rounded-md bg-secondary py-6">
      <div className="space-y-2">
        <Label htmlFor="vercelApiToken">API Token</Label>
        <Input
          className="bg-background"
          id="vercelApiToken"
          onChange={(e) => onApiTokenChange(e.target.value)}
          placeholder={
            hasToken ? "API token is configured" : "Enter your Vercel API token"
          }
          type="password"
          value={apiToken}
        />
        <p className="text-muted-foreground text-sm">
          Get your API token from{" "}
          <a
            className="text-primary underline"
            href="https://vercel.com/account/tokens"
            rel="noopener noreferrer"
            target="_blank"
          >
            Vercel
          </a>
          .
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="vercelTeamId">Team ID (Optional)</Label>
        <Input
          className="bg-background"
          id="vercelTeamId"
          onChange={(e) => onTeamIdChange(e.target.value)}
          placeholder="team_xxxxxxxxxxxxx"
          value={teamId}
        />
        <p className="text-muted-foreground text-sm">
          Only required if you want to manage team projects instead of personal
          projects.
        </p>
      </div>
    </CardContent>
  </Card>
);
