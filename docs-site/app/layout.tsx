import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { Head } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import type { ReactNode } from 'react'
import 'nextra-theme-docs/style.css'
import './globals.css'

import themeConfig from '../theme.config'

export const metadata = {
  title: {
    default: 'KeeperHub Docs',
    template: '%s - KeeperHub Docs',
  },
  description: 'KeeperHub Documentation - Blockchain automation without code',
  icons: {
    icon: '/favicon.ico',
  },
}

export default async function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  const pageMap = await getPageMap('/')

  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Head>
      <body>
        <Layout
          navbar={<Navbar logo={themeConfig.logo} projectLink={themeConfig.project?.link} />}
          footer={<Footer>{themeConfig.footer?.content}</Footer>}
          editLink={themeConfig.editLink?.content}
          docsRepositoryBase={themeConfig.docsRepositoryBase}
          sidebar={{ defaultMenuCollapseLevel: 1 }}
          pageMap={pageMap}
        >
          {children}
        </Layout>
      </body>
    </html>
  )
}
