'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil, ArrowLeft, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/api-client';

interface ScaleItem {
  id: string;
  name: string;
  percentageIncrease: number;
  sortOrder: number;
}

interface ScaleRuleSet {
  id: string;
  name: string;
  items: ScaleItem[];
}

function extractError(err: unknown): string {
  const resp = (err as { response?: { data?: { error?: { message?: string; details?: string[] } } } })?.response?.data;
  if (resp?.error?.details?.length) return resp.error.details.join(', ');
  return resp?.error?.message ?? 'Erro desconhecido';
}

export default function AdminScalesPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Navigation: null = list, string = inside a rule set
  const [activeRuleSetId, setActiveRuleSetId] = useState<string | null>(null);

  // Create rule set form
  const [newRuleName, setNewRuleName] = useState('');

  // Edit rule name
  const [editingRuleName, setEditingRuleName] = useState(false);
  const [editName, setEditName] = useState('');

  // Add item form
  const [newItemName, setNewItemName] = useState('');
  const [newItemPercentage, setNewItemPercentage] = useState('0');

  // Edit item inline
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemPercentage, setEditItemPercentage] = useState('');

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setError('');
    setTimeout(() => setSuccess(''), 3000);
  };

  // ── Queries ──

  const { data: ruleSets, isLoading } = useQuery({
    queryKey: ['admin', 'scale-rule-sets'],
    queryFn: async () => {
      const { data } = await api.get('/scales/rule-sets');
      return (data.data ?? []) as ScaleRuleSet[];
    },
  });

  const activeRuleSet = ruleSets?.find((rs) => rs.id === activeRuleSetId);

  // ── Rule Set Mutations ──

  const createRuleSetMutation = useMutation({
    mutationFn: (name: string) => api.post('/scales/rule-sets', { name }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'scale-rule-sets'] });
      setNewRuleName('');
      const created = res.data.data;
      setActiveRuleSetId(created.id);
      showSuccess(`Regra "${created.name}" criada. Adicione escalas abaixo.`);
    },
    onError: (err) => setError(extractError(err)),
  });

  const updateRuleSetMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.put(`/scales/rule-sets/${id}`, { name }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'scale-rule-sets'] });
      setEditingRuleName(false);
      showSuccess('Nome atualizado');
    },
    onError: (err) => setError(extractError(err)),
  });

  const deleteRuleSetMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/scales/rule-sets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'scale-rule-sets'] });
      setActiveRuleSetId(null);
      showSuccess('Regra excluída');
    },
    onError: (err) => setError(extractError(err)),
  });

  // ── Item Mutations ──

  const addItemMutation = useMutation({
    mutationFn: (dto: { ruleSetId: string; name: string; percentageIncrease: number; sortOrder: number }) =>
      api.post(`/scales/rule-sets/${dto.ruleSetId}/items`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'scale-rule-sets'] });
      setNewItemName('');
      setNewItemPercentage('0');
      showSuccess('Escala adicionada');
    },
    onError: (err) => setError(extractError(err)),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, ...dto }: { id: string; name?: string; percentageIncrease?: number }) =>
      api.put(`/scales/items/${id}`, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'scale-rule-sets'] });
      setEditingItemId(null);
      showSuccess('Escala atualizada');
    },
    onError: (err) => setError(extractError(err)),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/scales/items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'scale-rule-sets'] });
      showSuccess('Escala removida');
    },
    onError: (err) => setError(extractError(err)),
  });

  // ── Handlers ──

  function handleCreateRuleSet(e: React.FormEvent) {
    e.preventDefault();
    if (!newRuleName.trim()) return;
    createRuleSetMutation.mutate(newRuleName.trim());
  }

  function handleAddItem(e: React.FormEvent) {
    e.preventDefault();
    if (!activeRuleSetId || !newItemName.trim()) return;
    addItemMutation.mutate({
      ruleSetId: activeRuleSetId,
      name: newItemName.trim(),
      percentageIncrease: parseFloat(newItemPercentage) || 0,
      sortOrder: (activeRuleSet?.items.length ?? 0),
    });
  }

  function startEditItem(item: ScaleItem) {
    setEditingItemId(item.id);
    setEditItemName(item.name);
    setEditItemPercentage(String(item.percentageIncrease));
  }

  function saveEditItem() {
    if (!editingItemId) return;
    updateItemMutation.mutate({
      id: editingItemId,
      name: editItemName.trim(),
      percentageIncrease: parseFloat(editItemPercentage) || 0,
    });
  }

  // ── Render: Inside a rule set ──

  if (activeRuleSetId && activeRuleSet) {
    return (
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => {
            setActiveRuleSetId(null);
            setError('');
            setSuccess('');
          }}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>

        {error && (
          <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 mb-4 text-sm">{error}</div>
        )}
        {success && (
          <div className="bg-green-50 text-green-700 border border-green-200 rounded-md px-4 py-3 mb-4 text-sm">{success}</div>
        )}

        {/* Rule name header */}
        <div className="flex items-center gap-3 mb-6">
          {editingRuleName ? (
            <>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-2xl font-bold h-12 max-w-md"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') updateRuleSetMutation.mutate({ id: activeRuleSetId, name: editName.trim() });
                  if (e.key === 'Escape') setEditingRuleName(false);
                }}
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => updateRuleSetMutation.mutate({ id: activeRuleSetId, name: editName.trim() })}
              >
                <Save className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setEditingRuleName(false)}>
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold">{activeRuleSet.name}</h1>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => {
                  setEditName(activeRuleSet.name);
                  setEditingRuleName(true);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        <p className="text-sm text-muted-foreground mb-6">
          Adicione as escalas disponíveis nesta regra. A escala com 0% é o preço base.
        </p>

        {/* Add item form */}
        <form onSubmit={handleAddItem} className="flex gap-3 mb-6 items-end max-w-xl">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Nome da escala</Label>
            <Input
              placeholder="Ex: 28mm, 32mm, 75mm"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              required
            />
          </div>
          <div className="w-32 space-y-1">
            <Label className="text-xs">Incremento (%)</Label>
            <Input
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={newItemPercentage}
              onChange={(e) => setNewItemPercentage(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={addItemMutation.isPending}>
            <Plus className="h-4 w-4 mr-2" />
            Adicionar
          </Button>
        </form>

        {/* Items table */}
        {activeRuleSet.items.length === 0 ? (
          <p className="text-muted-foreground text-sm">Nenhuma escala cadastrada nesta regra. Adicione acima.</p>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Escala</TableHead>
                  <TableHead className="w-40">Incremento</TableHead>
                  <TableHead className="w-[80px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeRuleSet.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {editingItemId === item.id ? (
                        <Input
                          value={editItemName}
                          onChange={(e) => setEditItemName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') saveEditItem();
                            if (e.key === 'Escape') setEditingItemId(null);
                          }}
                          className="h-8"
                          autoFocus
                        />
                      ) : (
                        <span
                          className="cursor-pointer hover:text-primary hover:underline"
                          onClick={() => startEditItem(item)}
                        >
                          {item.name}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingItemId === item.id ? (
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={editItemPercentage}
                            onChange={(e) => setEditItemPercentage(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveEditItem();
                              if (e.key === 'Escape') setEditingItemId(null);
                            }}
                            className="h-8 w-24"
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveEditItem}>
                            <Save className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditingItemId(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <span
                          className="cursor-pointer hover:text-primary hover:underline"
                          onClick={() => startEditItem(item)}
                        >
                          {item.percentageIncrease === 0 ? (
                            <span className="text-muted-foreground">base (0%)</span>
                          ) : (
                            <span className="text-primary font-medium">+{item.percentageIncrease}%</span>
                          )}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm(`Excluir escala "${item.name}"?`))
                            deleteItemMutation.mutate(item.id);
                        }}
                        disabled={deleteItemMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Delete rule set */}
        <div className="mt-8 pt-6 border-t">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              if (confirm(`Excluir regra "${activeRuleSet.name}" e todas as suas escalas?`))
                deleteRuleSetMutation.mutate(activeRuleSetId);
            }}
            disabled={deleteRuleSetMutation.isPending}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir regra
          </Button>
          <p className="text-xs text-muted-foreground mt-1">
            Todas as escalas dentro desta regra serão excluídas junto.
          </p>
        </div>
      </div>
    );
  }

  // ── Render: List of rule sets ──

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">Regras de Escala</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Cada regra define um conjunto de escalas com preços. Atribua regras a produtos, tags ou categorias.
      </p>

      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 mb-4 text-sm">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 text-green-700 border border-green-200 rounded-md px-4 py-3 mb-4 text-sm">{success}</div>
      )}

      {/* Create new rule */}
      <form onSubmit={handleCreateRuleSet} className="flex gap-3 mb-6 items-end max-w-md">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Nome da regra</Label>
          <Input
            placeholder="Ex: Miniaturas Padrão, Veículos"
            value={newRuleName}
            onChange={(e) => setNewRuleName(e.target.value)}
            required
          />
        </div>
        <Button type="submit" disabled={createRuleSetMutation.isPending}>
          <Plus className="h-4 w-4 mr-2" />
          Criar
        </Button>
      </form>

      {/* Rule sets list */}
      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : ruleSets?.length === 0 ? (
        <p className="text-muted-foreground text-sm">Nenhuma regra cadastrada. Crie uma acima.</p>
      ) : (
        <div className="space-y-3">
          {ruleSets?.map((rs) => (
            <Card
              key={rs.id}
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => {
                setActiveRuleSetId(rs.id);
                setError('');
                setSuccess('');
              }}
            >
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium text-base">{rs.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {rs.items.length === 0
                        ? 'Sem escalas — clique para adicionar'
                        : `${rs.items.length} escala${rs.items.length > 1 ? 's' : ''}: ${rs.items.map((i) => i.name).join(', ')}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {rs.items.map((item) => (
                      <span
                        key={item.id}
                        className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
                      >
                        {item.name}
                        {item.percentageIncrease > 0 && (
                          <span className="text-primary font-medium">+{item.percentageIncrease}%</span>
                        )}
                        {item.percentageIncrease === 0 && (
                          <span className="text-muted-foreground">base</span>
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
