'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api-client';

interface AttributeSelectorProps {
  selectedValueIds: string[];
  onChange: (valueIds: string[]) => void;
}

interface AttrValue {
  id: string;
  value: string;
  slug: string;
}

interface Attr {
  id: string;
  name: string;
  slug: string;
  values: AttrValue[];
}

export function AttributeSelector({ selectedValueIds, onChange }: AttributeSelectorProps) {
  const queryClient = useQueryClient();
  const [newAttrName, setNewAttrName] = useState('');
  const [newValueFor, setNewValueFor] = useState<string | null>(null);
  const [newValueText, setNewValueText] = useState('');

  const { data: attributes } = useQuery({
    queryKey: ['attributes'],
    queryFn: async () => {
      const { data } = await api.get('/attributes');
      return (data.data ?? data) as Attr[];
    },
  });

  const createAttr = useMutation({
    mutationFn: (name: string) => api.post('/attributes', { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attributes'] });
      setNewAttrName('');
    },
  });

  const createValue = useMutation({
    mutationFn: ({ attrId, value }: { attrId: string; value: string }) =>
      api.post(`/attributes/${attrId}/values`, { value }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['attributes'] });
      const created = res.data.data ?? res.data;
      // Auto-select the new value
      onChange([...selectedValueIds, created.id]);
      setNewValueText('');
      setNewValueFor(null);
    },
  });

  function toggleValue(valueId: string) {
    if (selectedValueIds.includes(valueId)) {
      onChange(selectedValueIds.filter((id) => id !== valueId));
    } else {
      onChange([...selectedValueIds, valueId]);
    }
  }

  return (
    <div className="space-y-4">
      {attributes?.map((attr) => (
        <Card key={attr.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{attr.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-2">
              {attr.values.map((val) => {
                const selected = selectedValueIds.includes(val.id);
                return (
                  <Badge
                    key={val.id}
                    variant={selected ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleValue(val.id)}
                  >
                    {val.value}
                    {selected && <X className="h-3 w-3 ml-1" />}
                  </Badge>
                );
              })}
            </div>

            {newValueFor === attr.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newValueText.trim()) createValue.mutate({ attrId: attr.id, value: newValueText });
                }}
                className="flex gap-2"
              >
                <Input value={newValueText} onChange={(e) => setNewValueText(e.target.value)} placeholder="Novo valor..." autoFocus className="max-w-[200px] h-8 text-sm" />
                <Button type="submit" size="sm" className="h-8">OK</Button>
                <Button type="button" variant="ghost" size="sm" className="h-8" onClick={() => { setNewValueFor(null); setNewValueText(''); }}>
                  Cancelar
                </Button>
              </form>
            ) : (
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setNewValueFor(attr.id); setNewValueText(''); }}>
                <Plus className="h-3 w-3 mr-1" />Novo valor
              </Button>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Create new attribute */}
      <div className="flex gap-2">
        <Input placeholder="Novo atributo (ex: Raça)" value={newAttrName} onChange={(e) => setNewAttrName(e.target.value)} className="max-w-[250px]" />
        <Button variant="outline" size="sm" disabled={!newAttrName.trim()} onClick={() => createAttr.mutate(newAttrName)}>
          <Plus className="h-3 w-3 mr-1" />Criar Atributo
        </Button>
      </div>
    </div>
  );
}
