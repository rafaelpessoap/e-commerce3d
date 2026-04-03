'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Trash2, ChevronDown, ChevronUp, Wand2, Upload, ImageIcon, X } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { api } from '@/lib/api-client';

export interface VariationData {
  id?: string;
  name: string;
  sku: string;
  gtin?: string;
  price: number;
  salePrice?: number;
  stock: number;
  weight?: number;
  width?: number;
  height?: number;
  length?: number;
  image?: string;
  attributeValueId?: string;
}

interface VariationEditorProps {
  variations: VariationData[];
  onChange: (variations: VariationData[]) => void;
}

interface AttributeValue {
  id: string;
  value: string;
  slug: string;
}

interface Attribute {
  id: string;
  name: string;
  slug: string;
  values: AttributeValue[];
}

export function VariationEditor({ variations, onChange }: VariationEditorProps) {
  const [selectedAttributeId, setSelectedAttributeId] = useState<string>('');
  const [checkedValueIds, setCheckedValueIds] = useState<Set<string>>(new Set());
  const [collapsedCards, setCollapsedCards] = useState<Set<number>>(new Set());
  const [galleryOpenFor, setGalleryOpenFor] = useState<number | null>(null);
  const [gallerySearch, setGallerySearch] = useState('');

  const { data: galleryData } = useQuery({
    queryKey: ['variation-gallery', gallerySearch],
    queryFn: async () => {
      const params: Record<string, string | number> = { perPage: 24 };
      if (gallerySearch) params.search = gallerySearch;
      const { data } = await api.get('/media', { params });
      return (data.data ?? data) as Array<{ id: string; thumb: string; card: string; filename: string; alt?: string }>;
    },
    enabled: galleryOpenFor !== null,
  });

  async function handleVariationImageUpload(index: number, file: File) {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const { data } = await api.post('/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const media = data.data ?? data;
      updateVariation(index, 'image', media.card);
    } catch {
      // silently fail — gallery approach is preferred
    }
  }

  function selectGalleryImage(index: number, imageUrl: string) {
    updateVariation(index, 'image', imageUrl);
    setGalleryOpenFor(null);
  }

  const { data: attributes } = useQuery({
    queryKey: ['attributes'],
    queryFn: async () => {
      const { data } = await api.get('/attributes');
      return (data.data ?? data) as Attribute[];
    },
  });

  const selectedAttribute = attributes?.find((a) => a.id === selectedAttributeId);

  function toggleValueChecked(valueId: string) {
    setCheckedValueIds((prev) => {
      const next = new Set(prev);
      if (next.has(valueId)) {
        next.delete(valueId);
      } else {
        next.add(valueId);
      }
      return next;
    });
  }

  function generateVariations() {
    if (!selectedAttribute) return;

    const existingValueIds = new Set(
      variations.map((v) => v.attributeValueId).filter(Boolean),
    );

    const newVariations: VariationData[] = [];
    for (const valueId of checkedValueIds) {
      if (existingValueIds.has(valueId)) continue;
      const attrValue = selectedAttribute.values.find((v) => v.id === valueId);
      if (!attrValue) continue;
      newVariations.push({
        name: attrValue.value,
        sku: '',
        price: 0,
        stock: 0,
        attributeValueId: valueId,
      });
    }

    if (newVariations.length > 0) {
      onChange([...variations, ...newVariations]);
    }
  }

  function addManualVariation() {
    onChange([
      ...variations,
      {
        name: '',
        sku: '',
        price: 0,
        stock: 0,
      },
    ]);
  }

  function updateVariation(index: number, field: keyof VariationData, value: string | number | undefined) {
    const updated = [...variations];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  }

  function removeVariation(index: number) {
    onChange(variations.filter((_, i) => i !== index));
  }

  function toggleCollapse(index: number) {
    setCollapsedCards((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {/* Attribute selection + value picker */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Gerar variações a partir de um atributo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Atributo para variações</Label>
            <select
              value={selectedAttributeId}
              onChange={(e) => {
                setSelectedAttributeId(e.target.value);
                setCheckedValueIds(new Set());
              }}
              className="flex h-9 w-full rounded-md border bg-background px-3 py-1 text-sm"
            >
              <option value="">Selecionar atributo...</option>
              {attributes?.map((attr) => (
                <option key={attr.id} value={attr.id}>
                  {attr.name} ({attr.values.length} valores)
                </option>
              ))}
            </select>
          </div>

          {selectedAttribute && selectedAttribute.values.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs">Selecione os valores que se tornam variações</Label>
              <div className="flex flex-wrap gap-2">
                {selectedAttribute.values.map((val) => {
                  const isChecked = checkedValueIds.has(val.id);
                  const alreadyExists = variations.some(
                    (v) => v.attributeValueId === val.id,
                  );
                  return (
                    <label
                      key={val.id}
                      className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm cursor-pointer transition-colors ${
                        alreadyExists
                          ? 'border-muted bg-muted text-muted-foreground cursor-not-allowed'
                          : isChecked
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={isChecked || alreadyExists}
                        disabled={alreadyExists}
                        onChange={() => toggleValueChecked(val.id)}
                      />
                      {val.value}
                      {alreadyExists && (
                        <span className="text-xs text-muted-foreground">(criada)</span>
                      )}
                    </label>
                  );
                })}
              </div>

              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={generateVariations}
                disabled={checkedValueIds.size === 0}
              >
                <Wand2 className="h-4 w-4 mr-2" />
                Gerar Variações ({checkedValueIds.size})
              </Button>
            </div>
          )}

          {selectedAttribute && selectedAttribute.values.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Este atributo nao possui valores cadastrados. Cadastre valores em{' '}
              <strong>Admin &gt; Atributos</strong>.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Variation cards */}
      {variations.map((v, i) => {
        const isCollapsed = collapsedCards.has(i);
        return (
          <Card key={v.attributeValueId ?? `manual-${i}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="flex items-center gap-2 text-left"
                  onClick={() => toggleCollapse(i)}
                >
                  {isCollapsed ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  )}
                  <CardTitle className="text-sm">
                    Variacao {i + 1}: {v.name || '(sem nome)'}
                    {v.price > 0 && (
                      <span className="ml-2 font-normal text-muted-foreground">
                        — R$ {v.price.toFixed(2)}
                      </span>
                    )}
                  </CardTitle>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => removeVariation(i)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            {!isCollapsed && (
              <CardContent className="space-y-3">
                {/* Row 1: Name + SKU + GTIN */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nome</Label>
                    <Input
                      value={v.name}
                      onChange={(e) => updateVariation(i, 'name', e.target.value)}
                      placeholder="Nome da variacao"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">SKU</Label>
                    <Input
                      value={v.sku}
                      onChange={(e) => updateVariation(i, 'sku', e.target.value)}
                      placeholder="Opcional"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">GTIN</Label>
                    <Input
                      value={v.gtin || ''}
                      onChange={(e) =>
                        updateVariation(i, 'gtin', e.target.value || undefined)
                      }
                      placeholder="Opcional"
                      className="h-9"
                    />
                  </div>
                </div>

                {/* Row 2: Price + Sale Price + Stock */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Preco (R$) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={v.price || ''}
                      onChange={(e) =>
                        updateVariation(i, 'price', parseFloat(e.target.value) || 0)
                      }
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Preco Promocional (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={v.salePrice || ''}
                      onChange={(e) =>
                        updateVariation(
                          i,
                          'salePrice',
                          e.target.value ? parseFloat(e.target.value) : undefined,
                        )
                      }
                      placeholder="Opcional"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Estoque</Label>
                    <Input
                      type="number"
                      min="0"
                      value={v.stock}
                      onChange={(e) =>
                        updateVariation(i, 'stock', parseInt(e.target.value, 10) || 0)
                      }
                      className="h-9"
                    />
                  </div>
                </div>

                {/* Row 3: Weight + Dimensions */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Peso (kg)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={v.weight ?? ''}
                      onChange={(e) =>
                        updateVariation(
                          i,
                          'weight',
                          e.target.value ? parseFloat(e.target.value) : undefined,
                        )
                      }
                      placeholder="Herda do produto pai"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Largura (cm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={v.width ?? ''}
                      onChange={(e) =>
                        updateVariation(
                          i,
                          'width',
                          e.target.value ? parseFloat(e.target.value) : undefined,
                        )
                      }
                      placeholder="Herda do produto pai"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Altura (cm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={v.height ?? ''}
                      onChange={(e) =>
                        updateVariation(
                          i,
                          'height',
                          e.target.value ? parseFloat(e.target.value) : undefined,
                        )
                      }
                      placeholder="Herda do produto pai"
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Comprimento (cm)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      value={v.length ?? ''}
                      onChange={(e) =>
                        updateVariation(
                          i,
                          'length',
                          e.target.value ? parseFloat(e.target.value) : undefined,
                        )
                      }
                      placeholder="Herda do produto pai"
                      className="h-9"
                    />
                  </div>
                </div>

                {/* Row 4: Image */}
                <div className="space-y-1">
                  <Label className="text-xs">Imagem da variação</Label>
                  {v.image ? (
                    <div className="flex items-center gap-3">
                      <div className="relative w-16 h-16 rounded border overflow-hidden">
                        <Image src={v.image} alt={v.name} fill className="object-cover" sizes="64px" />
                      </div>
                      <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => updateVariation(i, 'image', undefined)}>
                        <X className="h-3 w-3 mr-1" />Remover
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <label className="cursor-pointer">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleVariationImageUpload(i, file);
                            e.target.value = '';
                          }}
                        />
                        <span className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs hover:bg-muted transition-colors">
                          <Upload className="h-3 w-3" />Upload
                        </span>
                      </label>
                      <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => { setGalleryOpenFor(i); setGallerySearch(''); }}>
                        <ImageIcon className="h-3 w-3 mr-1" />Galeria
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {/* Manual add button */}
      <Button type="button" variant="outline" onClick={addManualVariation}>
        <Plus className="h-4 w-4 mr-2" />
        Adicionar Variação Manualmente
      </Button>

      {/* Gallery picker dialog */}
      <Dialog open={galleryOpenFor !== null} onOpenChange={(open) => !open && setGalleryOpenFor(null)}>
        <DialogContent className="max-w-2xl max-h-[70vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Escolher imagem da galeria</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Buscar por nome..."
            value={gallerySearch}
            onChange={(e) => setGallerySearch(e.target.value)}
            className="mb-3"
          />
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {(galleryData ?? []).map((media) => (
              <button
                key={media.id}
                type="button"
                onClick={() => galleryOpenFor !== null && selectGalleryImage(galleryOpenFor, media.card)}
                className="relative aspect-square rounded border overflow-hidden hover:ring-2 hover:ring-primary"
              >
                <Image src={media.thumb || media.card} alt={media.alt ?? media.filename} fill className="object-cover" sizes="100px" />
              </button>
            ))}
            {(galleryData ?? []).length === 0 && (
              <p className="col-span-full text-sm text-muted-foreground text-center py-4">Nenhuma imagem encontrada.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
