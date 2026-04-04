'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Plus, Package, Clock, Layers, GitBranch, CheckCircle, ExternalLink, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api-client';
import { RichTextEditor } from './rich-text-editor';
import { ImageUpload, type ProductImageData } from './image-upload';
import { VariationEditor, type VariationData } from './variation-editor';
import { AttributeSelector } from './attribute-selector';
import { StockAuditLog } from './stock-audit-log';
import slugify from 'slug';

interface ProductFormProps {
  productId?: string; // undefined = create, string = edit
}

const DATA_TABS = [
  { id: 'inventory', label: 'Inventário', icon: Package },
  { id: 'delivery', label: 'Produção', icon: Clock },
  { id: 'attributes', label: 'Atributos', icon: Layers },
] as const;

type DataTabId = (typeof DATA_TABS)[number]['id'] | 'variations' | 'stock-log';

export function ProductForm({ productId }: ProductFormProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isEdit = !!productId;

  // Form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [description, setDescription] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [type, setType] = useState('simple');
  const [basePrice, setBasePrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [sku, setSku] = useState('');
  const [gtin, setGtin] = useState('');
  const [manageStock, setManageStock] = useState(true);
  const [stock, setStock] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState('');
  const [weight, setWeight] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  const [length, setLength] = useState('');
  const [extraDays, setExtraDays] = useState('');
  const [productImages, setProductImages] = useState<ProductImageData[]>([]);
  const [variations, setVariations] = useState<VariationData[]>([]);
  const [attributeValueIds, setAttributeValueIds] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [featured, setFeatured] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);

  // Inline create states
  const [newCatName, setNewCatName] = useState('');
  const [newBrandName, setNewBrandName] = useState('');
  const [newTagName, setNewTagName] = useState('');

  // Data tabs
  const [activeDataTab, setActiveDataTab] = useState<DataTabId>('inventory');

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
      setDescription(existingProduct.content || existingProduct.description || '');
      setShortDescription(existingProduct.shortDescription ?? '');
      setType(existingProduct.type ?? 'simple');
      setBasePrice(String(existingProduct.basePrice ?? ''));
      setSalePrice(existingProduct.salePrice ? String(existingProduct.salePrice) : '');
      setSku(existingProduct.sku ?? '');
      setGtin(existingProduct.gtin ?? '');
      setManageStock(existingProduct.manageStock ?? true);
      setStock(String(existingProduct.stock ?? 0));
      setLowStockThreshold(existingProduct.lowStockThreshold != null ? String(existingProduct.lowStockThreshold) : '');
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
      // Images (with mediaFile relation)
      setProductImages(
        existingProduct.images?.map((img: { id: string; mediaFileId: string; isMain: boolean; order: number; mediaFile?: { id: string; thumb: string; card: string; gallery: string; full: string; alt?: string } }) => ({
          mediaFileId: img.mediaFileId,
          thumb: img.mediaFile?.thumb ?? '',
          card: img.mediaFile?.card ?? '',
          gallery: img.mediaFile?.gallery ?? '',
          full: img.mediaFile?.full ?? '',
          alt: img.mediaFile?.alt ?? undefined,
          isMain: img.isMain,
          order: img.order,
        })) ?? [],
      );
      // Variations
      setVariations(
        existingProduct.variations?.map((v: { id: string; name: string; sku: string; gtin?: string; price: number; salePrice?: number; stock: number; weight?: number; width?: number; height?: number; length?: number; image?: string; attributeValueId?: string }) => ({
          id: v.id, name: v.name, sku: v.sku, gtin: v.gtin, price: v.price, salePrice: v.salePrice, stock: v.stock, weight: v.weight, width: v.width, height: v.height, length: v.length, image: v.image, attributeValueId: v.attributeValueId,
        })) ?? [],
      );
      // Attributes
      setAttributeValueIds(
        existingProduct.attributes?.map((pa: { attributeValueId: string }) => pa.attributeValueId) ?? [],
      );
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
      queryClient.invalidateQueries({ queryKey: ['admin', 'categories'] });
    },
  });

  const createBrand = useMutation({
    mutationFn: (n: string) => api.post('/brands', { name: n }),
    onSuccess: (res) => {
      const created = res.data.data ?? res.data;
      setBrandId(created.id);
      setNewBrandName('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'brands'] });
    },
  });

  const createTag = useMutation({
    mutationFn: (n: string) => api.post('/tags', { name: n }),
    onSuccess: (res) => {
      const created = res.data.data ?? res.data;
      setSelectedTagIds((prev) => [...prev, created.id]);
      setNewTagName('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'tags'] });
    },
  });

  const resetForm = useCallback(() => {
    setName('');
    setSlug('');
    setSlugManual(false);
    setDescription('');
    setShortDescription('');
    setType('simple');
    setBasePrice('');
    setSalePrice('');
    setSku('');
    setGtin('');
    setManageStock(true);
    setStock('0');
    setWeight('');
    setWidth('');
    setHeight('');
    setLength('');
    setExtraDays('');
    setProductImages([]);
    setVariations([]);
    setAttributeValueIds([]);
    setCategoryId('');
    setBrandId('');
    setSelectedTagIds([]);
    setIsActive(true);
    setFeatured(false);
    setSuccessMsg('');
    setCreatedProductId(null);
    setError('');
  }, []);

  async function handleSubmit() {
    setError('');
    setSuccessMsg('');
    setSaving(true);

    const body: Record<string, unknown> = {
      name,
      slug: slug || undefined,
      description: description || ' ',
      shortDescription: shortDescription || undefined,
      content: description || undefined,
      type,
      basePrice: type === 'variable' ? 0 : parseFloat(basePrice),
      salePrice: salePrice ? parseFloat(salePrice) : undefined,
      sku: sku || undefined,
      gtin: gtin || undefined,
      manageStock,
      stock: manageStock ? parseInt(stock, 10) : undefined,
      lowStockThreshold: lowStockThreshold ? parseInt(lowStockThreshold, 10) : null,
      weight: weight ? parseFloat(weight) : undefined,
      width: width ? parseFloat(width) : undefined,
      height: height ? parseFloat(height) : undefined,
      length: length ? parseFloat(length) : undefined,
      extraDays: extraDays ? parseInt(extraDays, 10) : undefined,
      categoryId: categoryId || undefined,
      brandId: brandId || undefined,
      tagIds: selectedTagIds,
      attributeValueIds,
      images: productImages.map((img, i) => ({
        mediaFileId: img.mediaFileId,
        isMain: img.isMain,
        order: i,
      })),
      isActive,
      featured,
    };

    // Include variations for variable products
    if (type === 'variable') {
      body.variations = variations.map((v) => ({
        ...(v.id ? { id: v.id } : {}),
        name: v.name,
        sku: v.sku || undefined,
        gtin: v.gtin || undefined,
        price: v.price,
        salePrice: v.salePrice ?? undefined,
        stock: v.stock ?? 0,
        weight: v.weight ?? undefined,
        width: v.width ?? undefined,
        height: v.height ?? undefined,
        length: v.length ?? undefined,
        image: v.image || undefined,
      }));
    }

    try {
      if (isEdit) {
        await api.put(`/products/${productId}`, body);
        setSuccessMsg('Produto salvo com sucesso!');
      } else {
        const res = await api.post('/products', body);
        const created = res.data.data ?? res.data;
        setCreatedProductId(created.id);
        setSuccessMsg('Produto salvo com sucesso!');
      }
    } catch (err) {
      const resp = (err as { response?: { data?: { error?: { message?: string; details?: string[] } } } })?.response?.data;
      setError(resp?.error?.details?.join('. ') ?? resp?.error?.message ?? 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  const allDataTabs: Array<{ id: DataTabId; label: string; icon: typeof Package }> = [
    ...DATA_TABS,
    ...(type === 'variable' ? [{ id: 'variations' as DataTabId, label: 'Variações', icon: GitBranch }] : []),
    ...(isEdit ? [{ id: 'stock-log' as DataTabId, label: 'Histórico Estoque', icon: History }] : []),
  ];

  return (
    <div className="text-base">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold">
          {isEdit ? 'Editar Produto' : 'Novo Produto'}
        </h1>
      </div>

      {/* Error */}
      {error && <p className="text-sm text-destructive mb-4 p-3 bg-destructive/10 rounded-md">{error}</p>}

      {/* Success */}
      {successMsg && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-md flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
          <span className="text-sm text-green-700 dark:text-green-300 font-medium">{successMsg}</span>
          {!isEdit && createdProductId && (
            <div className="ml-auto flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={resetForm}>
                <Plus className="h-3 w-3 mr-1" />Cadastrar novo
              </Button>
              <Button size="sm" variant="ghost" onClick={() => router.push('/admin/produtos')}>
                <ExternalLink className="h-3 w-3 mr-1" />Ver na lista
              </Button>
            </div>
          )}
        </div>
      )}

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6">
        {/* ═══════════ LEFT COLUMN ═══════════ */}
        <div className="space-y-6 min-w-0">
          {/* ── Nome + Slug ── */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Nome do Produto</Label>
                <Input
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="Ex: Guerreira Elfica"
                  className="text-lg h-12"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-medium">URL (slug)</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">/p/</span>
                  <Input
                    value={slug}
                    onChange={(e) => { setSlug(e.target.value); setSlugManual(true); }}
                    placeholder="guerreira-elfica"
                  />
                </div>
                {isEdit && slug && (
                  <a
                    href={`/p/${slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1 mt-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    Ver produto: /p/{slug}
                  </a>
                )}
              </div>
            </CardContent>
          </Card>

          {/* ── Descrição Completa ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Descrição Completa</CardTitle>
            </CardHeader>
            <CardContent>
              <RichTextEditor
                value={description}
                onChange={setDescription}
                placeholder="Descrição detalhada com formatação. Pode inserir imagens."
              />
            </CardContent>
          </Card>

          {/* ── Dados do Produto (vertical tabs) ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dados do Produto</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex border-t">
                {/* Tab buttons (left side) */}
                <div className="w-[180px] shrink-0 border-r bg-muted/30">
                  {allDataTabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActiveTab = activeDataTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveDataTab(tab.id)}
                        className={`w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-left border-b transition-colors ${
                          isActiveTab
                            ? 'bg-background text-foreground border-l-2 border-l-primary'
                            : 'text-muted-foreground hover:bg-muted/50 border-l-2 border-l-transparent'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Tab content (right side) — all panels rendered, toggle with display */}
                <div className="flex-1 min-w-0">
                  {/* Inventário */}
                  <div className={activeDataTab === 'inventory' ? 'block' : 'hidden'}>
                    <div className="p-6 space-y-6">
                      <div>
                        <h3 className="text-sm font-medium mb-3">Preço e Identificação</h3>
                        {type === 'variable' ? (
                          <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 mb-4">
                            Produto variável — os preços são definidos em cada variação na aba Variações.
                          </p>
                        ) : (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Preço Base (R$)</Label>
                            <Input type="number" step="0.01" min="0.01" value={basePrice} onChange={(e) => setBasePrice(e.target.value)} placeholder="49.90" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Preço Promocional (R$)</Label>
                            <Input type="number" step="0.01" min="0.01" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="39.90" />
                          </div>
                        </div>
                        )}
                        <div className="grid grid-cols-2 gap-4 mt-4">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">SKU</Label>
                            <Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="ELF-WAR-001" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">GTIN / EAN</Label>
                            <Input value={gtin} onChange={(e) => setGtin(e.target.value)} placeholder="7890123456789" />
                          </div>
                        </div>
                      </div>

                      <hr />

                      {type !== 'variable' && (
                      <div>
                        <h3 className="text-sm font-medium mb-3">Estoque</h3>
                        <div className="flex items-center gap-2 mb-3">
                          <Switch checked={manageStock} onCheckedChange={setManageStock} />
                          <Label className="text-sm font-medium">Gerenciar estoque</Label>
                        </div>
                        {manageStock && (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Quantidade em estoque</Label>
                              <Input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} className="max-w-[160px]" />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-sm font-medium">Limite estoque baixo</Label>
                              <Input type="number" min="0" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} className="max-w-[160px]" placeholder="Padrao global" />
                              <p className="text-xs text-muted-foreground">Deixe vazio para usar o valor global das configuracoes.</p>
                            </div>
                          </div>
                        )}
                      </div>
                      )}
                      {type === 'variable' && (
                        <p className="text-sm text-muted-foreground">
                          Produto variavel: o estoque e gerenciado em cada variacao.
                        </p>
                      )}

                      <hr />

                      <div>
                        <h3 className="text-sm font-medium mb-3">Peso e Dimensões</h3>
                        <div className="space-y-2 mb-4">
                          <Label className="text-sm font-medium">Peso (kg)</Label>
                          <Input type="number" step="0.01" min="0" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="0.10" className="max-w-[160px]" />
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Largura (cm)</Label>
                            <Input type="number" step="0.1" min="0" value={width} onChange={(e) => setWidth(e.target.value)} placeholder="5.0" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Altura (cm)</Label>
                            <Input type="number" step="0.1" min="0" value={height} onChange={(e) => setHeight(e.target.value)} placeholder="8.0" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Comprimento (cm)</Label>
                            <Input type="number" step="0.1" min="0" value={length} onChange={(e) => setLength(e.target.value)} placeholder="3.0" />
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">Usado para calculo de frete.</p>
                      </div>
                    </div>
                  </div>

                  {/* Produção */}
                  <div className={activeDataTab === 'delivery' ? 'block' : 'hidden'}>
                    <div className="p-6 space-y-4">
                      <p className="text-sm text-muted-foreground">
                        Miniaturas impressas precisam de tempo para producao. Este prazo e somado ao prazo de entrega da transportadora.
                        Prioridade: produto {'>'} tag {'>'} categoria.
                      </p>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Dias necessarios para producao</Label>
                        <Input
                          type="number"
                          min="0"
                          value={extraDays}
                          onChange={(e) => setExtraDays(e.target.value)}
                          placeholder="Deixe vazio para usar padrao da tag/categoria"
                          className="max-w-[200px]"
                        />
                      </div>
                      <div className="bg-muted/50 rounded-lg p-4 text-sm">
                        <p className="font-medium mb-2">Como funciona:</p>
                        <p>{extraDays ? `${extraDays} dias para producao` : 'Usando padrao da tag/categoria'} + prazo da transportadora (calculado pelo CEP do cliente)</p>
                        <p className="text-xs text-muted-foreground mt-2">
                          O prazo de entrega total so e calculado no checkout, apos o cliente informar o CEP.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Atributos */}
                  <div className={activeDataTab === 'attributes' ? 'block' : 'hidden'}>
                    <div className="p-6 space-y-4">
                      <p className="text-sm text-muted-foreground">Selecione os atributos que se aplicam a este produto. Usados para filtros na loja.</p>
                      <AttributeSelector selectedValueIds={attributeValueIds} onChange={setAttributeValueIds} />
                    </div>
                  </div>

                  {/* Variações */}
                  <div className={activeDataTab === 'variations' && type === 'variable' ? 'block' : 'hidden'}>
                    <div className="p-6 space-y-4">
                      <p className="text-sm text-muted-foreground">Cada variacao tem sua propria escala, preco, SKU e estoque.</p>
                      <VariationEditor variations={variations} onChange={setVariations} />
                    </div>
                  </div>

                  {/* Histórico Estoque */}
                  <div className={activeDataTab === 'stock-log' ? 'block' : 'hidden'}>
                    <div className="p-6">
                      {isEdit && <StockAuditLog productId={productId!} />}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Descrição Curta ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Descricao Curta</CardTitle>
            </CardHeader>
            <CardContent>
              <RichTextEditor
                value={shortDescription}
                onChange={setShortDescription}
                placeholder="Resumo do produto (sem imagens). Usada como meta description para SEO."
                simple
              />
            </CardContent>
          </Card>
        </div>

        {/* ═══════════ RIGHT COLUMN (sticky sidebar) ═══════════ */}
        <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
          {/* ── Publicar ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Publicar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Status</Label>
                <div className="flex items-center gap-2">
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                  <span className="text-sm">{isActive ? 'Ativo' : 'Inativo'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Destaque</Label>
                <div className="flex items-center gap-2">
                  <Switch checked={featured} onCheckedChange={setFeatured} />
                  <span className="text-sm">{featured ? 'Sim' : 'Nao'}</span>
                </div>
              </div>

              <hr />

              <div className="space-y-2">
                <Label className="text-sm font-medium">Tipo do Produto</Label>
                <div className="flex gap-3">
                  {['simple', 'variable'].map((t) => (
                    <label key={t} className={`flex items-center gap-2 border rounded-lg px-3 py-2 cursor-pointer text-sm ${type === t ? 'border-primary bg-primary/5' : ''}`}>
                      <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} className="accent-primary" />
                      {t === 'simple' ? 'Simples' : 'Variavel'}
                    </label>
                  ))}
                </div>
                {type === 'variable' && <p className="text-xs text-muted-foreground">Configure as variacoes em Dados do Produto.</p>}
              </div>

              <hr />

              <Button onClick={handleSubmit} disabled={saving || !name || (type !== 'variable' && !basePrice)} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Salvando...' : 'Salvar'}
              </Button>
            </CardContent>
          </Card>

          {/* ── Imagem do Produto ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Imagens do Produto</CardTitle>
            </CardHeader>
            <CardContent>
              <ImageUpload images={productImages} onChange={setProductImages} />
            </CardContent>
          </Card>

          {/* ── Categorias ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Categoria</CardTitle>
            </CardHeader>
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
                <Input placeholder="Nova categoria" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} className="text-sm" />
                <Button size="sm" variant="outline" disabled={!newCatName.trim()} onClick={() => createCat.mutate(newCatName)}>
                  <Plus className="h-3 w-3 mr-1" />Criar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── Marca ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Marca</CardTitle>
            </CardHeader>
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
                <Input placeholder="Nova marca" value={newBrandName} onChange={(e) => setNewBrandName(e.target.value)} className="text-sm" />
                <Button size="sm" variant="outline" disabled={!newBrandName.trim()} onClick={() => createBrand.mutate(newBrandName)}>
                  <Plus className="h-3 w-3 mr-1" />Criar
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── Tags ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Tags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {selectedTagIds.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedTagIds.map((tagId) => {
                    const tag = (tags as Array<{ id: string; name: string }>)?.find((t) => t.id === tagId);
                    return tag ? (
                      <Badge key={tagId} variant="secondary" className="gap-1 pr-1 cursor-pointer" onClick={() => setSelectedTagIds((prev) => prev.filter((id) => id !== tagId))}>
                        {tag.name} ✕
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}
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
                <Input placeholder="Nova tag" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} className="text-sm" />
                <Button size="sm" variant="outline" disabled={!newTagName.trim()} onClick={() => createTag.mutate(newTagName)}>
                  <Plus className="h-3 w-3 mr-1" />Criar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
