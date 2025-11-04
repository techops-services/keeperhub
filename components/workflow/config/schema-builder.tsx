'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Plus } from 'lucide-react';

export interface SchemaField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  itemType?: 'string' | 'number' | 'boolean' | 'object';
  fields?: SchemaField[];
  description?: string;
}

interface SchemaBuilderProps {
  schema: SchemaField[];
  onChange: (schema: SchemaField[]) => void;
  disabled?: boolean;
  level?: number;
}

export function SchemaBuilder({ schema, onChange, disabled, level = 0 }: SchemaBuilderProps) {
  const addField = () => {
    onChange([...schema, { name: '', type: 'string' }]);
  };

  const updateField = (index: number, updates: Partial<SchemaField>) => {
    const newSchema = [...schema];
    newSchema[index] = { ...newSchema[index], ...updates };

    // Reset dependent fields when type changes
    if (updates.type) {
      if (updates.type !== 'array') {
        delete newSchema[index].itemType;
      }
      if (updates.type !== 'object') {
        delete newSchema[index].fields;
      }
      if (updates.type === 'array' && !newSchema[index].itemType) {
        newSchema[index].itemType = 'string';
      }
      if (updates.type === 'object' && !newSchema[index].fields) {
        newSchema[index].fields = [];
      }
    }

    onChange(newSchema);
  };

  const removeField = (index: number) => {
    onChange(schema.filter((_, i) => i !== index));
  };

  const updateNestedFields = (index: number, fields: SchemaField[]) => {
    const newSchema = [...schema];
    newSchema[index].fields = fields;
    onChange(newSchema);
  };

  const indentClass = level > 0 ? 'ml-4 border-l-2 border-muted pl-4' : '';

  return (
    <div className={`space-y-3 ${indentClass}`}>
      {schema.map((field, index) => (
        <div key={index} className="space-y-2 rounded-md border p-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <Label htmlFor={`field-name-${level}-${index}`}>Property Name</Label>
              <Input
                id={`field-name-${level}-${index}`}
                value={field.name}
                onChange={(e) => updateField(index, { name: e.target.value })}
                placeholder="propertyName"
                disabled={disabled}
              />
            </div>
            <div className="flex-1">
              <Label htmlFor={`field-type-${level}-${index}`}>Type</Label>
              <Select
                value={field.type}
                onValueChange={(value) =>
                  updateField(index, {
                    type: value as SchemaField['type'],
                  })
                }
                disabled={disabled}
              >
                <SelectTrigger id={`field-type-${level}-${index}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">String</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="boolean">Boolean</SelectItem>
                  <SelectItem value="array">Array</SelectItem>
                  <SelectItem value="object">Object</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeField(index)}
                disabled={disabled}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {field.type === 'array' && (
            <div>
              <Label htmlFor={`field-item-type-${level}-${index}`}>Array Item Type</Label>
              <Select
                value={field.itemType || 'string'}
                onValueChange={(value) =>
                  updateField(index, {
                    itemType: value as SchemaField['itemType'],
                  })
                }
                disabled={disabled}
              >
                <SelectTrigger id={`field-item-type-${level}-${index}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="string">String</SelectItem>
                  <SelectItem value="number">Number</SelectItem>
                  <SelectItem value="boolean">Boolean</SelectItem>
                  <SelectItem value="object">Object</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {field.type === 'object' && (
            <div className="mt-2">
              <Label className="mb-2 block">Object Properties</Label>
              <SchemaBuilder
                schema={field.fields || []}
                onChange={(fields) => updateNestedFields(index, fields)}
                disabled={disabled}
                level={level + 1}
              />
            </div>
          )}

          {field.type === 'array' && field.itemType === 'object' && (
            <div className="mt-2">
              <Label className="mb-2 block">Array Item Properties</Label>
              <SchemaBuilder
                schema={field.fields || []}
                onChange={(fields) => updateNestedFields(index, fields)}
                disabled={disabled}
                level={level + 1}
              />
            </div>
          )}

          <div>
            <Label htmlFor={`field-desc-${level}-${index}`}>Description (optional)</Label>
            <Input
              id={`field-desc-${level}-${index}`}
              value={field.description || ''}
              onChange={(e) => updateField(index, { description: e.target.value })}
              placeholder="Description for the AI"
              disabled={disabled}
            />
          </div>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={addField}
        disabled={disabled}
        className="w-full"
      >
        <Plus className="mr-2 h-4 w-4" />
        Add Property
      </Button>
    </div>
  );
}
