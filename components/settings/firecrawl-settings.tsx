import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FirecrawlSettingsProps = {
  apiKey: string;
  hasKey?: boolean;
  onApiKeyChange: (key: string) => void;
  showCard?: boolean;
};

export const FirecrawlSettings = ({
  apiKey,
  hasKey,
  onApiKeyChange,
  showCard = true,
}: FirecrawlSettingsProps) => {
  const content = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label className="ml-1" htmlFor="firecrawlApiKey">
          API Key
        </Label>
        <Input
          className="bg-background"
          id="firecrawlApiKey"
          onChange={(e) => onApiKeyChange(e.target.value)}
          placeholder={
            hasKey ? "API key is configured" : "Enter your Firecrawl API key"
          }
          type="password"
          value={apiKey}
        />
        <p className="text-muted-foreground text-sm">
          Get your API key from{" "}
          <a
            className="text-primary underline"
            href="https://firecrawl.dev/app/api-keys"
            rel="noopener noreferrer"
            target="_blank"
          >
            Firecrawl
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
        <CardTitle>Firecrawl</CardTitle>
        <CardDescription>
          Configure your Firecrawl API key to scrape, search, and crawl the web
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">{content}</CardContent>
    </Card>
  );
};
