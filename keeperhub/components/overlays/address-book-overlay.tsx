"use client";

import { Bookmark, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmOverlay } from "@/components/overlays/confirm-overlay";
import { Overlay } from "@/components/overlays/overlay";
import { useOverlay } from "@/components/overlays/overlay-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AddressBookRow } from "@/keeperhub/components/address-book/address-book-row";
import { useDebounce } from "@/keeperhub/lib/hooks/use-debounce";
import { useActiveMember } from "@/keeperhub/lib/hooks/use-organization";
import { usePagination } from "@/keeperhub/lib/hooks/use-pagination";
import type { AddressBookEntry } from "@/lib/api-client";
import { addressBookApi } from "@/lib/api-client";
import { ethers } from "ethers";

type AddressBookOverlayProps = {
  overlayId: string;
};

type AddAddressOverlayProps = {
  overlayId: string;
  onSave: (label: string, address: string) => Promise<void>;
};

function AddAddressOverlay({ overlayId, onSave }: AddAddressOverlayProps) {
  const { pop } = useOverlay();
  const [newLabel, setNewLabel] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!newLabel.trim()) {
      toast.error("Please enter a label");
      return;
    }

    if (!(newAddress.trim() && ethers.isAddress(newAddress))) {
      toast.error("Please enter a valid Ethereum address");
      return;
    }

    setSaving(true);
    try {
      await onSave(newLabel.trim(), newAddress.trim());
      toast.success("Address added to address book");
      pop();
    } catch (error) {
      console.error("Failed to add address:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to add address"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Overlay
      actions={[{ label: "Save", onClick: handleSave, loading: saving }]}
      overlayId={overlayId}
      title="Add New Address"
    >
      <p className="mb-4 text-muted-foreground text-sm">
        Add a new address to your organization's address book for easy reuse
        across workflows.
      </p>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="new-label">Label</Label>
          <Input
            disabled={saving}
            id="new-label"
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="e.g., Treasury Wallet"
            value={newLabel}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="new-address">Address</Label>
          <Input
            disabled={saving}
            id="new-address"
            onChange={(e) => setNewAddress(e.target.value)}
            placeholder="0x..."
            value={newAddress}
          />
          {newAddress && !ethers.isAddress(newAddress) && !saving && (
            <p className="text-destructive text-xs">Invalid address format</p>
          )}
        </div>
      </div>
    </Overlay>
  );
}

type AddressBookSearchAndControlsProps = {
  searchQuery: string;
  itemsPerPage: number;
  onSearchChange: (value: string) => void;
  onItemsPerPageChange: (value: number) => void;
};

function AddressBookSearchAndControls({
  searchQuery,
  itemsPerPage,
  onSearchChange,
  onItemsPerPageChange,
}: AddressBookSearchAndControlsProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="relative max-w-sm flex-1">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by name..."
          value={searchQuery}
        />
      </div>
      <div className="flex items-center gap-2">
        <Label className="text-muted-foreground text-sm" htmlFor="page-size">
          Items per page:
        </Label>
        <Select
          onValueChange={(value) =>
            onItemsPerPageChange(Number.parseInt(value, 10))
          }
          value={itemsPerPage.toString()}
        >
          <SelectTrigger className="w-20" id="page-size">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="5">5</SelectItem>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="20">20</SelectItem>
            <SelectItem value="25">25</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

type AddressBookTableProps = {
  entries: AddressBookEntry[];
  isOwner: boolean;
  deleting: string | null;
  onDelete: (entryId: string) => void;
  onUpdate: () => void;
};

function AddressBookTable({
  entries,
  isOwner,
  deleting,
  onDelete,
  onUpdate,
}: AddressBookTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Address</TableHead>
          {isOwner && <TableHead className="text-right">Actions</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <AddressBookRow
            deleting={deleting}
            entry={entry}
            key={entry.id}
            onDelete={onDelete}
            onUpdate={onUpdate}
          />
        ))}
      </TableBody>
    </Table>
  );
}

type AddressBookPaginationProps = {
  totalItems: number;
  itemsPerPage: number;
  showingFrom: number;
  showingTo: number;
  currentPage: number;
  totalPages: number;
  pageNumbers: (number | string)[];
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPreviousPage: () => void;
  onNextPage: () => void;
  onGoToPage: (page: number) => void;
};

function AddressBookPagination({
  totalItems,
  itemsPerPage,
  showingFrom,
  showingTo,
  currentPage,
  totalPages,
  pageNumbers,
  canGoPrevious,
  canGoNext,
  onPreviousPage,
  onNextPage,
  onGoToPage,
}: AddressBookPaginationProps) {
  if (totalItems <= itemsPerPage) {
    return null;
  }

  return (
    <div className="flex items-center justify-between">
      <p className="text-muted-foreground text-sm">
        Showing {showingFrom}-{showingTo} of {totalItems} entries
      </p>
      <div className="flex items-center gap-2">
        <Button
          disabled={!canGoPrevious}
          onClick={onPreviousPage}
          size="sm"
          variant="ghost"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        <div className="flex items-center gap-1">
          {pageNumbers.map((page: number | string, index: number) => {
            if (typeof page === "string") {
              return (
                <span
                  className="px-2 text-muted-foreground"
                  key={`${page}-${index}`}
                >
                  ...
                </span>
              );
            }

            const isCurrentPage = page === currentPage;
            return (
              <Button
                key={page}
                onClick={() => onGoToPage(page)}
                size="sm"
                variant={isCurrentPage ? "default" : "ghost"}
              >
                {page}
              </Button>
            );
          })}
        </div>

        <Button
          disabled={!canGoNext}
          onClick={onNextPage}
          size="sm"
          variant="ghost"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function AddressBookOverlay({ overlayId }: AddressBookOverlayProps) {
  const { push, closeAll } = useOverlay();
  const { isOwner } = useActiveMember();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<AddressBookEntry[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Debounce search query
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // Filter entries by label (name)
  const filteredEntries = useMemo(() => {
    if (!debouncedSearchQuery.trim()) {
      return entries;
    }

    const query = debouncedSearchQuery.trim().toLowerCase();
    return entries.filter((entry) => entry.label.toLowerCase().includes(query));
  }, [entries, debouncedSearchQuery]);

  // Pagination hook - use filtered entries
  const {
    paginatedItems: paginatedEntries,
    totalPages,
    currentPage,
    itemsPerPage,
    setItemsPerPage,
    goToNextPage,
    goToPreviousPage,
    goToPage,
    canGoNext,
    canGoPrevious,
    showingFrom,
    showingTo,
    totalItems,
    pageNumbers,
  } = usePagination<AddressBookEntry>(filteredEntries, {
    defaultItemsPerPage: 5,
  });

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const data = await addressBookApi.getAll();
      setEntries(data);
    } catch (error) {
      console.error("Failed to load address book entries:", error);
      toast.error("Failed to load address book");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleAddAddress = async (label: string, address: string) => {
    await addressBookApi.create({ label, address });
    await loadEntries();
  };

  const handleOpenAddForm = () => {
    push(AddAddressOverlay, {
      onSave: handleAddAddress,
    });
  };

  const handleDelete = (entryId: string) => {
    push(ConfirmOverlay, {
      title: "Delete Address",
      message:
        "Are you sure you want to delete this address from the address book?",
      confirmLabel: "Delete",
      confirmVariant: "destructive" as const,
      destructive: true,
      onConfirm: async () => {
        setDeleting(entryId);
        try {
          await addressBookApi.delete(entryId);
          toast.success("Address deleted");
          await loadEntries();
        } catch (error) {
          console.error("Failed to delete address:", error);
          toast.error(
            error instanceof Error ? error.message : "Failed to delete address"
          );
        } finally {
          setDeleting(null);
        }
      },
    });
  };

  return (
    <Overlay
      actions={[
        ...(isOwner
          ? [
              {
                label: "Add New Address",
                variant: "outline" as const,
                onClick: handleOpenAddForm,
              },
            ]
          : []),
        { label: "Done", onClick: closeAll },
      ]}
      overlayId={overlayId}
      title="Address Book"
    >
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner />
          </div>
        ) : entries.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            <Bookmark className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p>No addresses saved yet</p>
            {!isOwner && (
              <p className="mt-2 text-xs">
                Only organization owners can add addresses
              </p>
            )}
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            <Bookmark className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p>No addresses found matching "{debouncedSearchQuery}"</p>
          </div>
        ) : (
          <>
            <AddressBookSearchAndControls
              itemsPerPage={itemsPerPage}
              onItemsPerPageChange={setItemsPerPage}
              onSearchChange={setSearchQuery}
              searchQuery={searchQuery}
            />

            <AddressBookTable
              deleting={deleting}
              entries={paginatedEntries}
              isOwner={isOwner}
              onDelete={handleDelete}
              onUpdate={loadEntries}
            />

            <AddressBookPagination
              canGoNext={canGoNext}
              canGoPrevious={canGoPrevious}
              currentPage={currentPage}
              itemsPerPage={itemsPerPage}
              onGoToPage={goToPage}
              onNextPage={goToNextPage}
              onPreviousPage={goToPreviousPage}
              pageNumbers={pageNumbers}
              showingFrom={showingFrom}
              showingTo={showingTo}
              totalItems={totalItems}
              totalPages={totalPages}
            />
          </>
        )}
      </div>
    </Overlay>
  );
}
