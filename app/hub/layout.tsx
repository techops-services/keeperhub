// start custom keeperhub code //
import type { Metadata } from "next";
import type { ReactNode } from "react";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.keeperhub.com";

export const metadata: Metadata = {
  title: "Workflow Hub | KeeperHub",
  description:
    "Discover and deploy community-built blockchain workflow automations. Browse featured templates, DeFi strategies, and monitoring setups.",
  openGraph: {
    title: "Workflow Hub | KeeperHub",
    description:
      "Discover and deploy community-built blockchain workflow automations.",
    type: "website",
    url: `${baseUrl}/hub`,
    siteName: "KeeperHub",
    images: [
      {
        url: `${baseUrl}/api/og/hub`,
        width: 1200,
        height: 630,
        alt: "KeeperHub Workflow Hub",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Workflow Hub | KeeperHub",
    description:
      "Discover and deploy community-built blockchain workflow automations.",
    images: [`${baseUrl}/api/og/hub`],
  },
};

type HubLayoutProps = {
  children: ReactNode;
};

export default function HubLayout({ children }: HubLayoutProps) {
  return children;
}
// end keeperhub code //
