// Vercel deployment configuration
export const VERCEL_DEPLOY_URL =
  "https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvercel-labs%2Fworkflow-builder-template&project-name=workflow-builder&repository-name=workflow-builder&demo-title=Workflow%20Builder&demo-description=A%20free%2C%20open-source%20template%20for%20building%20visual%20workflow%20automation%20platforms%20with%20real%20integrations%20and%20code%20generation&demo-url=https%3A%2F%2Fworkflow-builder-template.vercel.app&demo-image=https%3A%2F%2Fraw.githubusercontent.com%2Fvercel-labs%2Fworkflow-builder-template%2Fmain%2Fscreenshot.png&env=BETTER_AUTH_SECRET,INTEGRATION_ENCRYPTION_KEY,AI_GATEWAY_API_KEY&envDescription=BETTER_AUTH_SECRET+and+INTEGRATION_ENCRYPTION_KEY+are+required+secrets.+AI_GATEWAY_API_KEY+is+optional.&stores=%5B%7B%22type%22%3A%22postgres%22%7D%5D";

// Vercel button URL for markdown
export const VERCEL_DEPLOY_BUTTON_URL = `[![Deploy with Vercel](https://vercel.com/button)](${VERCEL_DEPLOY_URL})`;
