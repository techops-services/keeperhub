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
import { WalletDialog } from "@/keeperhub/components/settings/wallet-dialog";
import { Web3WalletSection } from "@/keeperhub/components/settings/web3-wallet-section";
import { AbiWithAutoFetchField } from "@/keeperhub/components/workflow/config/abi-with-auto-fetch-field";
import { ChainSelectField } from "@/keeperhub/components/workflow/config/chain-select-field";
import {
  registerBranding,
  registerComponentSlot,
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

// ============================================================================
// Register Custom Integration Form Handlers
// ============================================================================

/**
 * Web3 Wallet Integration
 * Shows the wallet creation/management UI instead of a standard form
 */
registerIntegrationFormHandler("web3", () => <Web3WalletSection />);

// ============================================================================
// Register Branding
// ============================================================================

registerBranding({
  logo: KeeperHubLogo,
  appName: "KeeperHub",
});

// ============================================================================
// Register Component Slots
// ============================================================================

/**
 * User Menu Wallet Dialog
 * Shows wallet management in the user menu dropdown
 */
registerComponentSlot(
  "user-menu-wallet-dialog",
  (props: { open: boolean; onOpenChange: (open: boolean) => void }) => (
    <WalletDialog onOpenChange={props.onOpenChange} open={props.open} />
  )
);

// Export a flag to indicate extensions are loaded
export const KEEPERHUB_EXTENSIONS_LOADED = true;
