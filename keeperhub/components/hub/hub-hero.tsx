import { BookOpen, Play } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";

export function HubHero() {
  return (
    <div className="relative grid items-center gap-8 overflow-visible pt-4 lg:grid-cols-2">
      <div className="relative z-10">
        <h1 className="mb-2 font-bold text-4xl tracking-tight">
          KeeperHub Web3 Templates
        </h1>
        <p className="mb-4 max-w-lg text-muted-foreground text-base">
          Browse ready-made workflow templates and community automations.
          Duplicate any template to get started in seconds.
        </p>
        <div className="flex items-center gap-3">
          <Button asChild>
            <a
              href="https://youtube.com/@KeeperHub"
              rel="noopener noreferrer"
              target="_blank"
            >
              <Play className="size-4" />
              Watch demos
            </a>
          </Button>
          <Button asChild variant="outline">
            <a
              href="https://docs.keeperhub.com"
              rel="noopener noreferrer"
              target="_blank"
            >
              <BookOpen className="size-4" />
              Read docs
            </a>
          </Button>
        </div>
      </div>

      <div className="relative hidden lg:block">
        <div className="absolute top-1/2 left-1/2 -z-10 h-[150%] w-[150%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,#243548_0%,transparent_70%)]" />
        <Image
          alt=""
          height={285}
          priority
          src="/hub-graphic.png"
          width={500}
        />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-2/3 bg-[linear-gradient(to_top,oklch(0.2101_0.0318_264.66)_0%,oklch(0.2101_0.0318_264.66)_10%,transparent_100%)] lg:block" />
    </div>
  );
}
