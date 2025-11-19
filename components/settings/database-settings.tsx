import { Database } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DatabaseSettingsProps = {
  databaseUrl: string;
  hasDatabaseUrl?: boolean;
  onDatabaseUrlChange: (url: string) => void;
  showCard?: boolean;
};

export function DatabaseSettings({
  databaseUrl,
  hasDatabaseUrl,
  onDatabaseUrlChange,
  showCard = true,
}: DatabaseSettingsProps) {
  const content = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="ml-1" htmlFor="database-url">
          Database URL
        </Label>
        <Input
          id="database-url"
          onChange={(e) => onDatabaseUrlChange(e.target.value)}
          placeholder={
            hasDatabaseUrl
              ? "••••••••"
              : "postgresql://user:password@host:port/database"
          }
          type="password"
          value={databaseUrl}
        />
        <p className="text-muted-foreground text-xs">
          This connection URL will be used by all Database Query actions in this
          workflow. Supported formats: PostgreSQL connection URLs.
        </p>
      </div>
    </div>
  );

  if (!showCard) {
    return content;
  }

  return (
    <Card className="border-0 shadow-none">
      <CardHeader className="px-0">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4" />
          <CardTitle>Database Connection</CardTitle>
        </div>
        <CardDescription>
          Configure your database connection URL for Database Query actions
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">{content}</CardContent>
    </Card>
  );
}
