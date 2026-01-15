import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import { Footer, Layout, Navbar } from "nextra-theme-docs";
import type { ReactNode } from "react";
import "nextra-theme-docs/style.css";
import "./globals.css";

import themeConfig from "../theme.config";

export const metadata = {
  title: {
    default: "KeeperHub Docs",
    template: "%s - KeeperHub Docs",
  },
  description: "KeeperHub Documentation - Blockchain automation without code",
  icons: {
    icon: "/favicon.ico",
  },
};

// Filter out hidden sections from page map
function filterPageMap(
  items: Awaited<ReturnType<typeof getPageMap>>
): typeof items {
  return items.filter((item) => {
    // Hide sections that are not yet public
    if ("name" in item && (item.name === "api" || item.name === "billing")) {
      return false;
    }
    return true;
  });
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const rawPageMap = await getPageMap("/");
  const pageMap = filterPageMap(rawPageMap);

  return (
    <html dir="ltr" lang="en" suppressHydrationWarning>
      <Head>
        <meta content="width=device-width, initial-scale=1.0" name="viewport" />
      </Head>
      <body>
        <Layout
          docsRepositoryBase={themeConfig.docsRepositoryBase}
          editLink={themeConfig.editLink?.content}
          footer={<Footer>{themeConfig.footer?.content}</Footer>}
          navbar={
            <Navbar
              logo={themeConfig.logo}
              projectLink={themeConfig.project?.link}
            />
          }
          pageMap={pageMap}
          sidebar={{ defaultMenuCollapseLevel: 1 }}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
