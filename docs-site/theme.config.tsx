import type { DocsThemeConfig } from 'nextra-theme-docs'
import { KeeperHubLogo } from './components/keeperhub-logo'

const config: DocsThemeConfig = {
  logo: (
    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '1.1rem' }}>
      <KeeperHubLogo />
      KeeperHub Docs
    </span>
  ),
  project: {
    link: 'https://github.com/techops-services/keeperhub',
  },
  docsRepositoryBase: 'https://github.com/techops-services/keeperhub/edit/main/docs',
  footer: {
    content: (
      <span>
        {new Date().getFullYear()} KeeperHub. All rights reserved.
      </span>
    ),
  },
  head: (
    <>
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta name="description" content="KeeperHub Documentation - Blockchain automation without code" />
      <meta name="og:title" content="KeeperHub Docs" />
      <link rel="icon" href="/favicon.ico" />
    </>
  ),
  useNextSeoProps() {
    return {
      titleTemplate: '%s - KeeperHub Docs'
    }
  },
  sidebar: {
    defaultMenuCollapseLevel: 1,
    toggleButton: true,
  },
  toc: {
    backToTop: true,
  },
  editLink: {
    content: 'Edit this page on GitHub',
  },
  feedback: {
    content: 'Question? Give us feedback',
    labels: 'feedback',
  },
  navigation: {
    prev: true,
    next: true,
  },
  darkMode: true,
  primaryHue: 142, // Green hue to match KeeperHub branding
  primarySaturation: 70,
}

export default config
