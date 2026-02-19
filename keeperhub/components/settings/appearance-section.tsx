"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const THEME_OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function AppearanceSection(): React.ReactNode {
  const { theme, setTheme } = useTheme();

  return (
    <Card className="border-0 py-0 shadow-none">
      <CardContent className="p-0">
        <div className="space-y-3">
          <Label className="ml-1">Theme</Label>
          <div className="grid grid-cols-3 gap-2">
            {THEME_OPTIONS.map((option) => {
              const Icon = option.icon;
              const isActive = theme === option.value;
              return (
                <button
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors",
                    isActive
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  )}
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  type="button"
                >
                  <Icon className="size-5" />
                  <span className="text-xs font-medium">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
