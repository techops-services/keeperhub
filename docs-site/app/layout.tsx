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

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pageMap = await getPageMap("/");

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
