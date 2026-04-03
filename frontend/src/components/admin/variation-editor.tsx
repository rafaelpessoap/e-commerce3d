'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api-client';

export interface VariationData {
  id?: string;
  scaleId: string;
  name: string;
  sku: string;
  gtin?: string;
  price: number;
  salePrice?: number;
  stock: number;
  image?: string;
}

interface VariationEditorProps {
  productId?: string;
  variations: VariationData[];
  onChange: (variations: VariationData[]) => void;
}

export function VariationEditor({ productId, variations, onChange }: VariationEditorProps) {
  const { data: scales } = useQuery({
    queryKey: ['scales'],
    queryFn: async () => {
      const { data } = await api.get('/scales');
      return (data.data ?? data) as Array<{ id: string; name: string; code: string }>;
    },
  });

  function addVariation() {
    onChange([
      ...variations,
      {
        scaleId: scales?.[0]?.id ?? '',
        name: scales?.[0]?.name ?? '',
        sku: '',
        price: 0,
        stock: 0,
      },
    ]);
  }

  function updateVariation(index: number, field: string, value: string | number) {
    const updated = [...variations];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (updated[index] as any)[field] = value;

    // Auto-set name from scale selection
    if (field === 'scaleId' && scales) {
      const scale = scales.find((s) => s.id === value);
      if (scale) updated[index].name = scale.name;
    }

    onChange(updated);
  }

  function removeVariation(index: number) {
    onChange(variations.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      {variations.map((v, i) => (
        <Card key={i}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Variação {i + 1}: {v.name || '(sem nome)'}</CardTitle>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeVariation(i)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Escala</Label>
                <select
                  value={v.scaleId}
                  onChange={(e) => updateVariation(i, 'scaleId', e.target.value)}
                  className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm"
                >
                  <option value="">Selecionar...</option>
                  {scales?.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">SKU</Label>
                <Input value={v.sku} onChange={(e) => updateVariation(i, 'sku', e.target.value)} placeholder="ELF-28" className="h-9" />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Preço (R$)</Label>
                <Input type="number" step="0.01" value={v.price || ''} onChange={(e) => updateVariation(i, 'price', parseFloat(e.target.value) || 0)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Promo (R$)</Label>
                <Input type="number" step="0.01" value={v.salePrice || ''} onChange={(e) => updateVariation(i, 'salePrice', parseFloat(e.target.value) || 0)} placeholder="Opcional" className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Estoque</Label>
                <Input type="number" min="0" value={v.stock} onChange={(e) => updateVariation(i, 'stock', parseInt(e.target.value) || 0)} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">GTIN</Label>
                <Input value={v.gtin || ''} onChange={(e) => updateVariation(i, 'gtin', e.target.value)} placeholder="Opcional" className="h-9" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">URL da imagem (opcional)</Label>
              <Input value={v.image || ''} onChange={(e) => updateVariation(i, 'image', e.target.value)} placeholder="https://cdn.../imagem.jpg" className="h-9" />
            </div>
          </CardContent>
        </Card>
      ))}

      <Button type="button" variant="outline" onClick={addVariation}>
        <Plus className="h-4 w-4 mr-2" />
        Adicionar Variação
      </Button>
    </div>
  );
}
