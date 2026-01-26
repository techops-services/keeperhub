"use client";

import { ethers } from "ethers";
import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useSession } from "@/lib/auth-client";
import { AddressSelectPopover } from "./address-select-popover";
import { SaveAddressButton } from "./save-address-button";
import { SaveAddressForm } from "./save-address-form";

type SaveAddressBookmarkProps = {
  address?: string;
  children: React.ReactElement<{
    value?: string;
    onChange?: (value: string) => void;
    onFocus?: (e: React.FocusEvent) => void;
    onBlur?: (e: React.FocusEvent) => void;
  }>;
};

export function SaveAddressBookmark({
  address: addressProp,
  children,
}: SaveAddressBookmarkProps) {
  const { data: session } = useSession();
  const [showForm, setShowForm] = useState(false);
  const [currentAddress, setCurrentAddress] = useState<string>("");
  const [isInputFocused, setIsInputFocused] = useState(false);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isTemporalAccount =
    !session?.user ||
    session.user.name === "Anonymous" ||
    session.user.email?.startsWith("temp-");

  useEffect(() => {
    const childValue = children.props.value;
    if (childValue !== undefined) {
      setCurrentAddress(childValue);
    } else if (addressProp !== undefined) {
      setCurrentAddress(addressProp);
    }
  }, [children.props.value, addressProp]);

  const address = addressProp ?? currentAddress;

  const childWithInterception = React.cloneElement(children, {
    onChange: (value: string) => {
      setCurrentAddress(value);
      children.props.onChange?.(value);
    },
    onFocus: (e: React.FocusEvent) => {
      if (!isTemporalAccount) {
        setIsInputFocused(true);
      }
      if (children.props.onFocus) {
        children.props.onFocus(e);
      }
    },
    onBlur: (e: React.FocusEvent) => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
      blurTimeoutRef.current = setTimeout(() => {
        const activeElement = document.activeElement;
        if (
          activeElement?.closest('[data-slot="popover-content"]') ||
          activeElement?.closest('[data-slot="command"]')
        ) {
          return;
        }
        setIsInputFocused(false);
      }, 200);
      if (children.props.onBlur) {
        children.props.onBlur(e);
      }
    },
  });

  useEffect(() => {
    const container = inputContainerRef.current;
    if (!container) {
      return;
    }

    const handleFocus = () => {
      if (!isTemporalAccount) {
        setIsInputFocused(true);
      }
    };

    const handleBlur = (_e: FocusEvent) => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
      blurTimeoutRef.current = setTimeout(() => {
        const activeElement = document.activeElement;
        if (
          activeElement?.closest('[data-slot="popover-content"]') ||
          activeElement?.closest('[data-slot="command"]')
        ) {
          return;
        }
        setIsInputFocused(false);
      }, 200);
    };

    container.addEventListener("focusin", handleFocus);
    container.addEventListener("focusout", handleBlur);

    return () => {
      container.removeEventListener("focusin", handleFocus);
      container.removeEventListener("focusout", handleBlur);
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, [isTemporalAccount]);

  const handleAddressSelect = (selectedAddress: string) => {
    if (children.props.onChange) {
      children.props.onChange(selectedAddress);
    }
    setCurrentAddress(selectedAddress);
    setIsInputFocused(false);
  };

  const handleSaveClick = () => {
    if (!(address && ethers.isAddress(address))) {
      toast.error("Please enter a valid Ethereum address first");
      return;
    }

    setShowForm(true);
  };

  const handleFormCancel = () => {
    setShowForm(false);
  };

  const handleFormSave = () => {
    setShowForm(false);
  };

  const handleFormAddressChange = (newAddress: string) => {
    setCurrentAddress(newAddress);
    if (children.props.onChange) {
      children.props.onChange(newAddress);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1" ref={inputContainerRef}>
          <AddressSelectPopover
            currentAddress={currentAddress}
            isOpen={isInputFocused && !isTemporalAccount}
            onAddressSelect={handleAddressSelect}
            onClose={() => setIsInputFocused(false)}
          >
            {childWithInterception}
          </AddressSelectPopover>
        </div>
        {!isTemporalAccount && (
          <SaveAddressButton
            address={currentAddress}
            onClick={handleSaveClick}
          />
        )}
      </div>

      {showForm && (
        <SaveAddressForm
          address={currentAddress}
          onAddressChange={handleFormAddressChange}
          onCancel={handleFormCancel}
          onSave={handleFormSave}
        />
      )}
    </div>
  );
}
