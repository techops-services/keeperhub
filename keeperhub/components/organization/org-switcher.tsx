"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  useOrganization,
  useOrganizations,
} from "@/keeperhub/lib/hooks/use-organization";
import { useSession } from "@/lib/auth-client";

export function OrgSwitcher() {
  const { data: session } = useSession();
  const { organization, switchOrganization } = useOrganization();
  const { organizations } = useOrganizations();
  const [open, setOpen] = useState(false);

  // Don't show anything if user is not logged in
  if (!session?.user) {
    return null;
  }

  // Handle edge case: user has no active organization
  if (!organization) {
    return (
      <div className="text-muted-foreground text-sm">
        No organization found
      </div>
    );
  }

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          className="w-[200px] justify-between"
          role="combobox"
          variant="outline"
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
  );
}
