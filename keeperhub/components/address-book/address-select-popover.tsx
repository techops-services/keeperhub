"use client";

import { Bookmark, Check } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { truncateAddress } from "@/keeperhub/lib/address-utils";
import type { AddressBookEntry } from "@/lib/api-client";
import { addressBookApi } from "@/lib/api-client";

type AddressSelectPopoverProps = {
  children: React.ReactElement;
  currentAddress: string;
  isOpen: boolean;
  onAddressSelect: (address: string) => void;
  onClose: () => void;
};

function AddressSelectItem({
  entry,
  currentAddress,
  onSelect,
}: {
  entry: AddressBookEntry;
  currentAddress: string;
  onSelect: (address: string) => void;
}) {
  return (
    <CommandItem key={entry.id} onSelect={() => onSelect(entry.address)}>
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex flex-col">
          <div className="flex items-center gap-1">
            <Bookmark className="h-2 w-2 text-primary" fill="currentColor" />
            <span className="font-medium text-sm">{entry.label}</span>
          </div>
          <span className="font-mono text-muted-foreground text-xs">
            {truncateAddress(entry.address)}
          </span>
        </div>
        {currentAddress === entry.address && (
          <Check className="h-4 w-4 text-primary" />
        )}
      </div>
    </CommandItem>
  );
}

export function AddressSelectPopover({
  children,
  currentAddress,
  isOpen,
  onAddressSelect,
  onClose,
}: AddressSelectPopoverProps) {
  const [addressBookEntries, setAddressBookEntries] = useState<
    AddressBookEntry[]
  >([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [popoverWidth, setPopoverWidth] = useState<number | undefined>(
    undefined
  );
  const anchorRef = useRef<HTMLDivElement>(null);

  const loadAddressBookEntries = useCallback(async () => {
    setLoadingEntries(true);
    try {
      const entries = await addressBookApi.getAll();
      setAddressBookEntries(entries);
    } catch (error) {
      console.error("Failed to load address book entries:", error);
      toast.error("Failed to load address book");
    } finally {
      setLoadingEntries(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadAddressBookEntries();
    }
  }, [isOpen, loadAddressBookEntries]);

  useEffect(() => {
    if (isOpen && anchorRef.current) {
      const updateWidth = () => {
        if (anchorRef.current) {
          setPopoverWidth(anchorRef.current.offsetWidth);
        }
      };

      updateWidth();
      window.addEventListener("resize", updateWidth);

      return () => {
        window.removeEventListener("resize", updateWidth);
      };
    }
  }, [isOpen]);

  const handleSelect = (address: string) => {
    onAddressSelect(address);
    onClose();
  };

  return (
    <Popover open={isOpen}>
      <PopoverAnchor asChild>
        <div ref={anchorRef}>{children}</div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="p-0"
        onEscapeKeyDown={onClose}
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest('[data-slot="popover-content"]')) {
            e.preventDefault();
          }
        }}
        onOpenAutoFocus={(event: Event) => event.preventDefault()}
        style={popoverWidth ? { width: `${popoverWidth}px` } : undefined}
      >
        <Command>
          <CommandInput placeholder="Search addresses..." />
          <CommandList>
            {loadingEntries && (
              <div className="py-6 text-center text-muted-foreground text-sm">
                Loading addresses...
              </div>
            )}
            {!loadingEntries && addressBookEntries.length === 0 && (
              <CommandEmpty>No addresses saved yet</CommandEmpty>
            )}
            {!loadingEntries && addressBookEntries.length > 0 && (
              <CommandGroup heading="Saved Addresses">
                {addressBookEntries.map((entry) => (
                  <AddressSelectItem
                    currentAddress={currentAddress}
                    entry={entry}
                    key={entry.id}
                    onSelect={handleSelect}
                  />
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
