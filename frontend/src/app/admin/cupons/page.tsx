'use client';
import type { ApiRecord } from '@/types/api';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api-client';
import { formatCurrency } from '@/lib/constants';

function extractError(err: unknown): string {
  const resp = (err as { response?: { data?: { error?: { message?: string; details?: string[] }; message?: string } } })?.response?.data;
  if (resp?.error?.details?.length) return resp.error.details.join(', ');
  return resp?.error?.message ?? resp?.message ?? 'Erro desconhecido';
}

interface CouponForm {
  code: string;
  type: 'PERCENTAGE' | 'FIXED' | 'FREE_SHIPPING';
  value: string;
  minOrderValue: string;
  maxUses: string;
  usesPerUser: string;
  validFrom: string;
  validUntil: string;
  isFirstPurchaseOnly: boolean;
  isActive: boolean;
}

const emptyForm: CouponForm = {
  code: '',
  type: 'PERCENTAGE',
  value: '',
  minOrderValue: '',
  maxUses: '',
  usesPerUser: '',
  validFrom: '',
  validUntil: '',
  isFirstPurchaseOnly: false,
  isActive: true,
};

function formToPayload(form: CouponForm) {
  return {
    code: form.code.toUpperCase().trim(),
    type: form.type,
    value: parseFloat(form.value),
    minOrderValue: form.minOrderValue ? parseFloat(form.minOrderValue) : undefined,
    maxUses: form.maxUses ? parseInt(form.maxUses, 10) : undefined,
    usesPerUser: form.usesPerUser ? parseInt(form.usesPerUser, 10) : undefined,
    validFrom: form.validFrom ? new Date(form.validFrom).toISOString() : undefined,
    validUntil: form.validUntil ? new Date(form.validUntil).toISOString() : undefined,
    isFirstPurchaseOnly: form.isFirstPurchaseOnly,
    isActive: form.isActive,
  };
}

function formatDisplayValue(coupon: ApiRecord): string {
  if (coupon.type === 'PERCENTAGE') return `${coupon.value}%`;
  if (coupon.type === 'FIXED') return formatCurrency(coupon.value);
  return 'Frete Gratis';
}

function formatDateForInput(dateStr?: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toISOString().slice(0, 16);
}

export default function AdminCouponsPage() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CouponForm>({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState('');

  const { data: coupons, isLoading } = useQuery({
    queryKey: ['admin', 'coupons'],
    queryFn: async () => {
      const { data } = await api.get('/coupons');
      return data.data ?? data;
    },
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/coupons', formToPayload(form)),
    onSuccess: () => {
      setError('');
      setForm({ ...emptyForm });
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });
    },
    onError: (err) => setError(extractError(err)),
  });

  const updateMutation = useMutation({
    mutationFn: (id: string) => api.put(`/coupons/${id}`, formToPayload(form)),
    onSuccess: () => {
      setError('');
      setEditingId(null);
      setDialogOpen(false);
      setForm({ ...emptyForm });
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });
    },
    onError: (err) => setError(extractError(err)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/coupons/${id}`),
    onSuccess: () => {
      setError('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'coupons'] });
    },
    onError: (err) => setError(extractError(err)),
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate();
  }

  function openEdit(coupon: ApiRecord) {
    setEditingId(coupon.id as string);
    setForm({
      code: coupon.code as string,
      type: coupon.type as CouponForm['type'],
      value: String(coupon.value),
      minOrderValue: coupon.minOrderValue ? String(coupon.minOrderValue) : '',
      maxUses: coupon.maxUses ? String(coupon.maxUses) : '',
      usesPerUser: coupon.usesPerUser ? String(coupon.usesPerUser) : '',
      validFrom: formatDateForInput(coupon.validFrom as string),
      validUntil: formatDateForInput(coupon.validUntil as string),
      isFirstPurchaseOnly: !!coupon.isFirstPurchaseOnly,
      isActive: coupon.isActive !== false,
    });
    setError('');
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    setError('');
  }

  function handleDelete(id: string, code: string) {
    if (confirm(`Desativar o cupom "${code}"?`)) {
      deleteMutation.mutate(id);
    }
  }

  function updateField<K extends keyof CouponForm>(key: K, value: CouponForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const typeLabels: Record<string, string> = {
    PERCENTAGE: 'Percentual',
    FIXED: 'Valor fixo',
    FREE_SHIPPING: 'Frete gratis',
  };

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Cupons</h1>

      {error && !dialogOpen && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Create form */}
      <form onSubmit={handleCreate} className="border rounded-lg p-4 mb-6 space-y-4">
        <h2 className="text-lg font-semibold">Novo Cupom</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">Codigo</Label>
            <Input
              placeholder="DESCONTO10"
              value={form.code}
              onChange={(e) => updateField('code', e.target.value.toUpperCase())}
              required
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select value={form.type} onValueChange={(v) => updateField('type', v as CouponForm['type'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PERCENTAGE">Percentual (%)</SelectItem>
                <SelectItem value="FIXED">Valor fixo (R$)</SelectItem>
                <SelectItem value="FREE_SHIPPING">Frete gratis</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Valor</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder={form.type === 'PERCENTAGE' ? '10' : '25.00'}
              value={form.value}
              onChange={(e) => updateField('value', e.target.value)}
              required
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Pedido minimo (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="100.00"
              value={form.minOrderValue}
              onChange={(e) => updateField('minOrderValue', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Max. usos total</Label>
            <Input
              type="number"
              min="0"
              placeholder="Ilimitado"
              value={form.maxUses}
              onChange={(e) => updateField('maxUses', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Usos por usuario</Label>
            <Input
              type="number"
              min="0"
              placeholder="Ilimitado"
              value={form.usesPerUser}
              onChange={(e) => updateField('usesPerUser', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Valido a partir de</Label>
            <Input
              type="datetime-local"
              value={form.validFrom}
              onChange={(e) => updateField('validFrom', e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Valido ate</Label>
            <Input
              type="datetime-local"
              value={form.validUntil}
              onChange={(e) => updateField('validUntil', e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch
              checked={form.isFirstPurchaseOnly}
              onCheckedChange={(v) => updateField('isFirstPurchaseOnly', v)}
            />
            <Label className="text-sm">Somente primeira compra</Label>
          </div>
          <Button type="submit" disabled={createMutation.isPending}>
            <Plus className="h-4 w-4 mr-2" />
            Criar cupom
          </Button>
        </div>
      </form>

      {/* Table */}
      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Codigo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Pedido min.</TableHead>
                <TableHead>Usos</TableHead>
                <TableHead>Validade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    Nenhum cupom cadastrado.
                  </TableCell>
                </TableRow>
              )}
              {coupons?.map((coupon: ApiRecord) => (
                <TableRow key={coupon.id}>
                  <TableCell>
                    <button
                      type="button"
                      className="font-mono font-medium text-primary hover:underline cursor-pointer"
                      onClick={() => openEdit(coupon)}
                    >
                      {coupon.code}
                    </button>
                  </TableCell>
                  <TableCell className="text-sm">{typeLabels[coupon.type as string] ?? coupon.type}</TableCell>
                  <TableCell className="font-medium">{formatDisplayValue(coupon)}</TableCell>
                  <TableCell className="text-sm">
                    {coupon.minOrderValue ? formatCurrency(coupon.minOrderValue) : '-'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {coupon._count?.usages ?? 0}
                    {coupon.maxUses ? `/${coupon.maxUses}` : ''}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {coupon.validUntil
                      ? new Date(coupon.validUntil as string).toLocaleDateString('pt-BR')
                      : 'Sem prazo'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={coupon.isActive ? 'default' : 'secondary'}>
                      {coupon.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                    {coupon.isFirstPurchaseOnly && (
                      <Badge variant="outline" className="ml-1 text-xs">1a compra</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(coupon)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(coupon.id as string, coupon.code as string)}
                        disabled={deleteMutation.isPending}
                        title="Desativar"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Cupom</DialogTitle>
          </DialogHeader>

          {error && dialogOpen && (
            <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (editingId) updateMutation.mutate(editingId);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Codigo</Label>
                <Input
                  value={form.code}
                  onChange={(e) => updateField('code', e.target.value.toUpperCase())}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={form.type} onValueChange={(v) => updateField('type', v as CouponForm['type'])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">Percentual (%)</SelectItem>
                    <SelectItem value="FIXED">Valor fixo (R$)</SelectItem>
                    <SelectItem value="FREE_SHIPPING">Frete gratis</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valor</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.value}
                  onChange={(e) => updateField('value', e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pedido minimo (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.minOrderValue}
                  onChange={(e) => updateField('minOrderValue', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Max. usos total</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.maxUses}
                  onChange={(e) => updateField('maxUses', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Usos por usuario</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.usesPerUser}
                  onChange={(e) => updateField('usesPerUser', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valido a partir de</Label>
                <Input
                  type="datetime-local"
                  value={form.validFrom}
                  onChange={(e) => updateField('validFrom', e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valido ate</Label>
                <Input
                  type="datetime-local"
                  value={form.validUntil}
                  onChange={(e) => updateField('validUntil', e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => updateField('isActive', v)}
                />
                <Label className="text-sm">Ativo</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.isFirstPurchaseOnly}
                  onCheckedChange={(v) => updateField('isFirstPurchaseOnly', v)}
                />
                <Label className="text-sm">Somente primeira compra</Label>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={closeDialog}>
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
