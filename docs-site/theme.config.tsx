import { KeeperHubLogo } from "./components/keeperhub-logo";

const config = {
  logo: (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        fontWeight: 700,
        fontSize: "1.1rem",
      }}
    >
      <KeeperHubLogo />
      KeeperHub Docs
    </span>
  ),
  project: {
    link: "https://github.com/techops-services/keeperhub",
  },
  docsRepositoryBase:
    "https://github.com/techops-services/keeperhub/edit/main/docs",
  footer: {
    content: (
      <span>{new Date().getFullYear()} KeeperHub. All rights reserved.</span>
    ),
  },
  head: (
    <>
      <meta content="width=device-width, initial-scale=1.0" name="viewport" />
      <meta
        content="KeeperHub Documentation - Blockchain automation without code"
        name="description"
      />
      <meta content="KeeperHub Docs" name="og:title" />
      <link href="/favicon.ico" rel="icon" />
    </>
  ),
  useNextSeoProps() {
    return {
      titleTemplate: "%s - KeeperHub Docs",
    };
  },
  sidebar: {
    defaultMenuCollapseLevel: 1,
    toggleButton: true,
  },
  toc: {
    backToTop: true,
  },
  editLink: {
    content: "Edit this page on GitHub",
  },
  feedback: {
    content: "Question? Give us feedback",
    labels: "feedback",
  },
  navigation: {
    prev: true,
    next: true,
  },
  darkMode: true,
  primaryHue: 142, // Green hue to match KeeperHub branding
  primarySaturation: 70,
};

export default config;
