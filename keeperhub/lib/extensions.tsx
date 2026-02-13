/**
 * KeeperHub Extensions
 *
 * Registers KeeperHub-specific field renderers, integration handlers,
 * branding, and component slots using the extension registry system.
 *
 * This file should be imported early in the app lifecycle to ensure
 * extensions are registered before components are rendered.
 */

import { Label } from "@/components/ui/label";
import { KeeperHubLogo } from "@/keeperhub/components/icons/keeperhub-logo";
import { SendGridConnectionSection } from "@/keeperhub/components/settings/sendgrid-connection-section";
import { Web3WalletSection } from "@/keeperhub/components/settings/web3-wallet-section";
import { AbiEventSelectField } from "@/keeperhub/components/workflow/config/abi-event-select-field";
import { AbiWithAutoFetchField } from "@/keeperhub/components/workflow/config/abi-with-auto-fetch-field";
import { ChainSelectField } from "@/keeperhub/components/workflow/config/chain-select-field";
import { TokenSelectField } from "@/keeperhub/components/workflow/config/token-select-field";
import {
  registerBranding,
  registerFieldRenderer,
  registerIntegrationFormHandler,
} from "@/lib/extension-registry";

// ============================================================================
// Register Custom Field Renderers
// ============================================================================

/**
 * ABI with Auto-Fetch Field
 * Allows users to paste an ABI or auto-fetch it from Etherscan
 */
registerFieldRenderer(
  "abi-with-auto-fetch",
  ({ field, config, onUpdateConfig, disabled }) => {
    const contractAddressField =
      field.contractAddressField || "contractAddress";
    const networkField = field.networkField || "network";
    const value =
      (config[field.key] as string | undefined) || field.defaultValue || "";

    return (
      <div className="space-y-2" key={field.key}>
        <Label className="ml-1" htmlFor={field.key}>
          {field.label}
        </Label>
        <AbiWithAutoFetchField
          config={config}
          contractAddressField={contractAddressField}
          contractInteractionType={field.contractInteractionType}
          disabled={disabled}
          field={field}
          networkField={networkField}
          onChange={(val: unknown) => onUpdateConfig(field.key, val)}
          value={value}
        />
      </div>
    );
  }
);

/**
 * Chain Select Field
 * Dynamic dropdown that fetches enabled chains from /api/chains
 * Respects isEnabled flag from the database
 */
registerFieldRenderer(
  "chain-select",
  ({ field, config, onUpdateConfig, disabled }) => {
    const value =
      (config[field.key] as string | undefined) || field.defaultValue || "";

    return (
      <div className="space-y-2" key={field.key}>
        <Label className="ml-1" htmlFor={field.key}>
          {field.label}
          {field.required && <span className="text-red-500">*</span>}
        </Label>
        <ChainSelectField
          chainTypeFilter={field.chainTypeFilter}
          disabled={disabled}
          field={field}
          onChange={(val: unknown) => onUpdateConfig(field.key, val)}
          value={value}
        />
      </div>
    );
  }
);

/**
 * Token Select Field
 * Toggle between supported tokens (stablecoins) and custom token address
 * In supported mode, shows multi-select of system stablecoins
 * In custom mode, shows text input for any ERC20 address
 */
registerFieldRenderer(
  "token-select",
  ({ field, config, onUpdateConfig, disabled }) => {
    const networkField = field.networkField || "network";

    return (
      <div className="space-y-2" key={field.key}>
        <Label className="ml-1" htmlFor={field.key}>
          {field.label}
          {field.required && <span className="text-red-500">*</span>}
        </Label>
        <TokenSelectField
          config={config}
          disabled={disabled}
          field={field}
          networkField={networkField}
          onUpdateConfig={onUpdateConfig}
        />
      </div>
    );
  }
);

/**
 * ABI Event Select Field
 * Dynamic dropdown that parses ABI and shows available events (type === "event")
 */
registerFieldRenderer(
  "abi-event-select",
  ({ field, config, onUpdateConfig, disabled }) => {
    const abiField = field.abiField || "abi";
    const abiValue = (config[abiField] as string | undefined) || "";
    const value =
      (config[field.key] as string | undefined) || field.defaultValue || "";

    return (
      <div className="space-y-2" key={field.key}>
        <Label className="ml-1" htmlFor={field.key}>
          {field.label}
          {field.required && <span className="text-red-500">*</span>}
        </Label>
        <AbiEventSelectField
          abiValue={abiValue}
          disabled={disabled}
          field={field}
          onChange={(val: unknown) => onUpdateConfig(field.key, val)}
          value={value}
        />
      </div>
    );
  }
);

// ============================================================================
// Register Custom Integration Form Handlers
// ============================================================================

/**
 * Web3 Wallet Integration
 * Shows the wallet creation/management UI instead of a standard form
 */
registerIntegrationFormHandler("web3", ({ onSuccess, closeAll }) => (
  <Web3WalletSection
    closeAll={closeAll}
    onSuccess={onSuccess}
    showDelete={false}
  />
));

/**
 * SendGrid Email Integration
 * Shows login requirement for anonymous users to prevent token abuse
 */
registerIntegrationFormHandler("sendgrid", ({ config, updateConfig }) => (
  <SendGridConnectionSection config={config} updateConfig={updateConfig} />
));

// ============================================================================
// Register Branding
// ============================================================================

registerBranding({
  logo: KeeperHubLogo,
  appName: "KeeperHub",
});

// Export a flag to indicate extensions are loaded
export const KEEPERHUB_EXTENSIONS_LOADED = true;
