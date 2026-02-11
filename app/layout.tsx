import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Provider } from "jotai";
import { type ReactNode, Suspense } from "react";
import { AuthProvider } from "@/components/auth/provider";
import { GitHubStarsLoader } from "@/components/github-stars-loader";
import { GitHubStarsProvider } from "@/components/github-stars-provider";
import { GlobalModals } from "@/components/global-modals";
import { LayoutContent } from "@/components/layout-content";
import { OverlayProvider } from "@/components/overlays/overlay-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { KeeperHubExtensionLoader } from "@/keeperhub/components/extension-loader";
// start custom keeperhub code //
import { MobileWarningDialog } from "@/keeperhub/components/mobile-warning-dialog";
// end keeperhub code //
import { mono, sans } from "@/lib/fonts";
import { cn } from "@/lib/utils";

// start custom keeperhub code //
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://app.keeperhub.com"
  ),
  title: "KeeperHub - Blockchain Workflow Automation",
  description:
    "Build powerful blockchain workflow automations with a visual, node-based editor. Built with Next.js and React Flow.",
  openGraph: {
    title: "KeeperHub - Blockchain Workflow Automation",
    description:
      "Build powerful blockchain workflow automations with a visual, node-based editor.",
    type: "website",
    siteName: "KeeperHub",
    images: [
      {
        url: "/api/og/default",
        width: 1200,
        height: 630,
        alt: "KeeperHub - Blockchain Workflow Automation",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "KeeperHub - Blockchain Workflow Automation",
    description:
      "Build powerful blockchain workflow automations with a visual, node-based editor.",
    images: ["/api/og/default"],
  },
};
// end keeperhub code //

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

type RootLayoutProps = {
  children: ReactNode;
};

const RootLayout = ({ children }: RootLayoutProps) => (
  <html lang="en" suppressHydrationWarning>
    <body className={cn(sans.variable, mono.variable, "antialiased")}>
      <KeeperHubExtensionLoader />
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        disableTransitionOnChange
        enableSystem
      >
        <Provider>
          <AuthProvider>
            <OverlayProvider>
              <Suspense
                fallback={
                  <GitHubStarsProvider stars={null}>
                    <LayoutContent>{children}</LayoutContent>
                  </GitHubStarsProvider>
                }
              >
                <GitHubStarsLoader>
                  <LayoutContent>{children}</LayoutContent>
                </GitHubStarsLoader>
              </Suspense>
              <Toaster />
              <GlobalModals />
              {/* start custom keeperhub code */}
              <MobileWarningDialog />
              {/* end keeperhub code */}
            </OverlayProvider>
          </AuthProvider>
        </Provider>
      </ThemeProvider>
      <Analytics />
      <SpeedInsights />
    </body>
  </html>
);

export default RootLayout;
