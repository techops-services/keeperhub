"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useOrganization, useOrganizations } from "@/keeperhub/lib/hooks/use-organization";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState } from "react";
import { ManageOrgsModal } from "./manage-orgs-modal";

export function OrgSwitcher() {
  const { organization, switchOrganization } = useOrganization();
  const { organizations } = useOrganizations();
  const [open, setOpen] = useState(false);

  if (!organization) return null;

  return (
    <div className="flex items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-[200px] justify-between"
          >
            <span className="truncate">{organization.name}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-0">
          <Command>
            <CommandList>
              <CommandGroup>
                {organizations.map((org) => (
                  <CommandItem
                    key={org.id}
                    onSelect={async () => {
                      await switchOrganization(org.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={`mr-2 h-4 w-4 ${
                        organization.id === org.id ? "opacity-100" : "opacity-0"
                      }`}
                    />
                    {org.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <ManageOrgsModal />
    </div>
  );
}
