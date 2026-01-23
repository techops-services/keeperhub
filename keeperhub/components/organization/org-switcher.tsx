"use client";

import { Check, ChevronsUpDown, Settings, Users } from "lucide-react";
import { useState } from "react";
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
import { ManageOrgsModal } from "@/keeperhub/components/organization/manage-orgs-modal";
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
  const [manageModalOpen, setManageModalOpen] = useState(false);

  // Don't show anything if user is not logged in or is anonymous
  // Anonymous users have name "Anonymous" and temp- prefixed emails
  const isAnonymous =
    !session?.user ||
    session.user.name === "Anonymous" ||
    session.user.email?.startsWith("temp-");

  if (isAnonymous) {
    return null;
  }

  // Handle edge case: user has no active organization
  if (!organization) {
    return (
      <div className="text-muted-foreground text-sm">No organization found</div>
    );
  }

  return (
    <>
      <Popover onOpenChange={setOpen} open={open}>
        <PopoverTrigger asChild>
          <Button
            aria-expanded={open}
            className="w-[200px] justify-between"
            role="combobox"
            variant="outline"
          >
            <div className="flex items-center gap-2">
              <Users className="size-4 shrink-0" />
              <span className="truncate">{organization.name}</span>
            </div>
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
                      className={`mr-1 h-4 w-4 ${
                        organization.id === org.id ? "opacity-100" : "opacity-0"
                      }`}
                    />
                    {org.name}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false);
                    setManageModalOpen(true);
                  }}
                >
                  <Settings className="mr-2 h-4 w-4" />
                  Manage Organizations
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <ManageOrgsModal
        onOpenChange={setManageModalOpen}
        open={manageModalOpen}
      />
    </>
  );
}
