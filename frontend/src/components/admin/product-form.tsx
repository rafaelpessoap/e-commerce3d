'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Save, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api-client';
import slugify from 'slug';

interface ProductFormProps {
  productId?: string; // undefined = create, string = edit
}

export function ProductForm({ productId }: ProductFormProps) {
  const router = useRouter();
  const isEdit = !!productId;

  // Form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [description, setDescription] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('simple');
  const [basePrice, setBasePrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [sku, setSku] = useState('');
  const [gtin, setGtin] = useState('');
  const [manageStock, setManageStock] = useState(true);
  const [stock, setStock] = useState('0');
  const [weight, setWeight] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [length, setLength] = useState('');
  const [extraDays, setExtraDays] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [featured, setFeatured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Inline create states
  const [newCatName, setNewCatName] = useState('');
  const [newBrandName, setNewBrandName] = useState('');
  const [newTagName, setNewTagName] = useState('');

  // Load existing product for edit
  const { data: existingProduct } = useQuery({
    queryKey: ['admin', 'product', productId],
    queryFn: async () => {
      const { data } = await api.get(`/products/${productId}`);
      return data.data ?? data;
    },
    enabled: isEdit,
  });

  // Load categories, brands, tags
  const { data: categories } = useQuery({
    queryKey: ['admin', 'categories'],
    queryFn: async () => {
      const { data } = await api.get('/categories');
      return data.data ?? data;
    },
  });

  const { data: brands } = useQuery({
    queryKey: ['admin', 'brands'],
    queryFn: async () => {
      const { data } = await api.get('/brands');
      return data.data ?? data;
    },
  });

  const { data: tags } = useQuery({
    queryKey: ['admin', 'tags'],
    queryFn: async () => {
      const { data } = await api.get('/tags');
      return data.data ?? data;
    },
  });

  // Populate form on edit
  useEffect(() => {
    if (existingProduct) {
      setName(existingProduct.name ?? '');
      setSlug(existingProduct.slug ?? '');
      setSlugManual(true);
      setDescription(existingProduct.description ?? '');
      setShortDescription(existingProduct.shortDescription ?? '');
      setContent(existingProduct.content ?? '');
      setType(existingProduct.type ?? 'simple');
      setBasePrice(String(existingProduct.basePrice ?? ''));
      setSalePrice(existingProduct.salePrice ? String(existingProduct.salePrice) : '');
      setSku(existingProduct.sku ?? '');
      setGtin(existingProduct.gtin ?? '');
      setManageStock(existingProduct.manageStock ?? true);
      setStock(String(existingProduct.stock ?? 0));
      setWeight(existingProduct.weight ? String(existingProduct.weight) : '');
      setWidth(existingProduct.width ? String(existingProduct.width) : '');
      setHeight(existingProduct.height ? String(existingProduct.height) : '');
      setLength(existingProduct.length ? String(existingProduct.length) : '');
      setExtraDays(existingProduct.extraDays != null ? String(existingProduct.extraDays) : '');
      setCategoryId(existingProduct.categoryId ?? '');
      setBrandId(existingProduct.brandId ?? '');
      setSelectedTagIds(existingProduct.tags?.map((t: { id: string }) => t.id) ?? []);
      setIsActive(existingProduct.isActive ?? true);
      setFeatured(existingProduct.featured ?? false);
    }
  }, [existingProduct]);

  // Auto-slug
  function handleNameChange(val: string) {
    setName(val);
    if (!slugManual) {
      setSlug(slugify(val, { lower: true }));
    }
  }

  // Inline create mutations
  const createCat = useMutation({
    mutationFn: (n: string) => api.post('/categories', { name: n }),
    onSuccess: (res) => {
      const created = res.data.data ?? res.data;
      setCategoryId(created.id);
      setNewCatName('');
    },
  });

  const createBrand = useMutation({
    mutationFn: (n: string) => api.post('/brands', { name: n }),
    onSuccess: (res) => {
      const created = res.data.data ?? res.data;
      setBrandId(created.id);
      setNewBrandName('');
    },
  });

  const createTag = useMutation({
    mutationFn: (n: string) => api.post('/tags', { name: n }),
    onSuccess: (res) => {
      const created = res.data.data ?? res.data;
      setSelectedTagIds((prev) => [...prev, created.id]);
      setNewTagName('');
    },
  });

  async function handleSubmit() {
    setError('');
    setSaving(true);

    const body: Record<string, unknown> = {
      name,
      slug,
      description,
      shortDescription: shortDescription || undefined,
      content: content || undefined,
      type,
      basePrice: parseFloat(basePrice),
      salePrice: salePrice ? parseFloat(salePrice) : undefined,
      sku: sku || undefined,
      gtin: gtin || undefined,
      manageStock,
      stock: manageStock ? parseInt(stock, 10) : undefined,
      weight: weight ? parseFloat(weight) : undefined,
      width: width ? parseFloat(width) : undefined,
      height: height ? parseFloat(height) : undefined,
      length: length ? parseFloat(length) : undefined,
      extraDays: extraDays ? parseInt(extraDays, 10) : undefined,
      categoryId: categoryId || undefined,
      brandId: brandId || undefined,
      tagIds: selectedTagIds,
      isActive,
      featured,
    };

    try {
      if (isEdit) {
        await api.put(`/products/${productId}`, body);
      } else {
        await api.post('/products', body);
      }
      router.push('/admin/produtos');
    } catch (err) {
      const resp = (err as { response?: { data?: { error?: { message?: string; details?: string[] } } } })?.response?.data;
      setError(resp?.error?.details?.join('. ') ?? resp?.error?.message ?? 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">
          {isEdit ? 'Editar Produto' : 'Novo Produto'}
        </h1>
        <Button onClick={handleSubmit} disabled={saving || !name || !basePrice}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>

      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      <Tabs defaultValue="general">
        <TabsList className="mb-6">
          <TabsTrigger value="general">Geral</TabsTrigger>
          <TabsTrigger value="categorization">Categorização</TabsTrigger>
          <TabsTrigger value="inventory">Inventário</TabsTrigger>
        </TabsList>

        {/* ─── Aba Geral ─── */}
        <TabsContent value="general" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">Informações Básicas</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Produto</Label>
                <Input value={name} onChange={(e) => handleNameChange(e.target.value)} placeholder="Ex: Guerreira Élfica" />
              </div>

              <div className="space-y-2">
                <Label>URL (slug)</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">/p/</span>
                  <Input
                    value={slug}
                    onChange={(e) => { setSlug(e.target.value); setSlugManual(true); }}
                    placeholder="guerreira-elfica"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição Curta</Label>
                <Textarea value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} placeholder="Resumo de até 300 caracteres" rows={2} maxLength={300} />
                <p className="text-xs text-muted-foreground">{shortDescription.length}/300 — Usada como meta description para SEO</p>
              </div>

              <div className="space-y-2">
                <Label>Descrição Completa</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição detalhada do produto" rows={4} />
              </div>

              <div className="space-y-2">
                <Label>Conteúdo HTML (descrição longa)</Label>
                <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="<p>Texto rico com HTML...</p>" rows={6} className="font-mono text-sm" />
                <p className="text-xs text-muted-foreground">Aceita HTML. Editor visual será adicionado na Sprint 2.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Preço e Identificação</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Preço Base (R$)</Label>
                  <Input type="number" step="0.01" min="0.01" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} placeholder="49.90" />
                </div>
                <div className="space-y-2">
                  <Label>Preço Promocional (R$) <span className="text-muted-foreground">(opcional)</span></Label>
                  <Input type="number" step="0.01" min="0.01" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="39.90" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>SKU</Label>
                  <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="ELF-WAR-001" />
                </div>
                <div className="space-y-2">
                  <Label>GTIN / EAN</Label>
                  <Input value={gtin} onChange={(e) => setGtin(e.target.value)} placeholder="7890123456789" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Tipo e Status</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo do Produto</Label>
                <div className="flex gap-4">
                  {['simple', 'variable'].map((t) => (
                    <label key={t} className={`flex items-center gap-2 border rounded-lg px-4 py-2 cursor-pointer ${type === t ? 'border-primary bg-primary/5' : ''}`}>
                      <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} className="accent-primary" />
                      <span className="text-sm font-medium">{t === 'simple' ? 'Simples' : 'Variável'}</span>
                    </label>
                  ))}
                </div>
                {type === 'variable' && <p className="text-xs text-muted-foreground">Variações serão gerenciadas na aba Variações (Sprint 2)</p>}
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                  <Label>Ativo</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={featured} onCheckedChange={setFeatured} />
                  <Label>Destaque</Label>
                </div>
              </div>

              {extraDays !== undefined && (
                <div className="space-y-2">
                  <Label>Dias Adicionais de Entrega <span className="text-muted-foreground">(opcional)</span></Label>
                  <Input type="number" min="0" value={extraDays} onChange={(e) => setExtraDays(e.target.value)} placeholder="0" className="max-w-[120px]" />
                  <p className="text-xs text-muted-foreground">Se vazio, usa o padrão da tag ou categoria. Prazo base: 3 dias úteis.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Aba Categorização ─── */}
        <TabsContent value="categorization" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">Categoria</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Sem categoria</option>
                {(categories as Array<{ id: string; name: string }>)?.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <Input placeholder="Nova categoria" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} className="max-w-xs" />
                <Button size="sm" variant="outline" disabled={!newCatName.trim()} onClick={() => createCat.mutate(newCatName)}>
                  <Plus className="h-3 w-3 mr-1" />Criar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Marca</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Sem marca</option>
                {(brands as Array<{ id: string; name: string }>)?.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <Input placeholder="Nova marca" value={newBrandName} onChange={(e) => setNewBrandName(e.target.value)} className="max-w-xs" />
                <Button size="sm" variant="outline" disabled={!newBrandName.trim()} onClick={() => createBrand.mutate(newBrandName)}>
                  <Plus className="h-3 w-3 mr-1" />Criar
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Tags</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2 mb-2">
                {selectedTagIds.map((tagId) => {
                  const tag = (tags as Array<{ id: string; name: string }>)?.find((t) => t.id === tagId);
                  return tag ? (
                    <Badge key={tagId} variant="secondary" className="gap-1 pr-1 cursor-pointer" onClick={() => setSelectedTagIds((prev) => prev.filter((id) => id !== tagId))}>
                      {tag.name} ✕
                    </Badge>
                  ) : null;
                })}
              </div>
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value && !selectedTagIds.includes(e.target.value)) {
                    setSelectedTagIds((prev) => [...prev, e.target.value]);
                  }
                }}
                className="flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                <option value="">Adicionar tag...</option>
                {(tags as Array<{ id: string; name: string }>)?.filter((t) => !selectedTagIds.includes(t.id)).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <Input placeholder="Nova tag" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} className="max-w-xs" />
                <Button size="sm" variant="outline" disabled={!newTagName.trim()} onClick={() => createTag.mutate(newTagName)}>
                  <Plus className="h-3 w-3 mr-1" />Criar
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Aba Inventário ─── */}
        <TabsContent value="inventory" className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-lg">Estoque</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Switch checked={manageStock} onCheckedChange={setManageStock} />
                <Label>Gerenciar estoque</Label>
              </div>

              {manageStock && (
                <div className="space-y-2">
                  <Label>Quantidade em estoque</Label>
                  <Input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} className="max-w-[160px]" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Peso e Dimensões</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Peso (kg)</Label>
                <Input type="number" step="0.01" min="0" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0.10" className="max-w-[160px]" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Largura (cm)</Label>
                  <Input type="number" step="0.1" min="0" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="5.0" />
                </div>
                <div className="space-y-2">
                  <Label>Altura (cm)</Label>
                  <Input type="number" step="0.1" min="0" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="8.0" />
                </div>
                <div className="space-y-2">
                  <Label>Comprimento (cm)</Label>
                  <Input type="number" step="0.1" min="0" value={length} onChange={(e) => setLength(e.target.value)} placeholder="3.0" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Usado para cálculo de frete.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
