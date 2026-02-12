"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TaxonomyEntry } from "@/lib/api-client";
import { TaxonomyFormDialog } from "./taxonomy-form-dialog";

const NONE_VALUE = "__none__";
const NEW_VALUE = "__new__";

type TaxonomySelectProps = {
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
  label: string;
  fetchFn: () => Promise<TaxonomyEntry[]>;
  createFn: (data: { name: string }) => Promise<TaxonomyEntry>;
};

export function TaxonomySelect({
  value,
  onChange,
  disabled,
  placeholder,
  label,
  fetchFn,
  createFn,
}: TaxonomySelectProps) {
  const [entries, setEntries] = useState<TaxonomyEntry[]>([]);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const loadEntries = useCallback(async () => {
    try {
      const result = await fetchFn();
      setEntries(result);
    } catch {
      // silently fail - taxonomy entries are optional
    }
  }, [fetchFn]);

  useEffect(() => {
    loadEntries();
  }, [loadEntries]);

  const handleValueChange = (val: string) => {
    if (val === NEW_VALUE) {
      setShowCreateDialog(true);
      return;
    }
    onChange(val === NONE_VALUE ? null : val);
  };

  const handleEntryCreated = (entry: TaxonomyEntry) => {
    setEntries((prev) => [...prev, entry]);
    onChange(entry.id);
  };

  return (
    <>
      <Select
        disabled={disabled}
        onValueChange={handleValueChange}
        value={value ?? NONE_VALUE}
      >
        <SelectTrigger>
          <SelectValue
            placeholder={placeholder ?? `Select ${label.toLowerCase()}...`}
          />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>None</SelectItem>
          {entries.map((entry) => (
            <SelectItem key={entry.id} value={entry.id}>
              {entry.name}
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem value={NEW_VALUE}>
            <span className="flex items-center gap-2">
              <Plus className="size-3.5" />
              New {label}
            </span>
          </SelectItem>
        </SelectContent>
      </Select>
      <TaxonomyFormDialog
        createFn={createFn}
        onCreated={handleEntryCreated}
        onOpenChange={setShowCreateDialog}
        open={showCreateDialog}
        title={label}
      />
    </>
  );
}
