'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Pencil, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api-client';

interface Scale {
  id: string;
  name: string;
  baseSize: number;
}

interface ScaleRuleItem {
  scaleId: string;
  percentageIncrease: number;
  scale: Scale;
}

interface ScaleRuleSet {
  id: string;
  name: string;
  items: ScaleRuleItem[];
}

export default function AdminScaleRulesPage() {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Create form
  const [newName, setNewName] = useState('');
  const [newItems, setNewItems] = useState<Array<{ scaleId: string; percentageIncrease: string }>>([]);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editItems, setEditItems] = useState<Array<{ scaleId: string; percentageIncrease: string }>>([]);

  const { data: ruleSets, isLoading } = useQuery({
    queryKey: ['admin', 'scale-rule-sets'],
    queryFn: async () => {
      const { data } = await api.get('/scales/rule-sets');
      return (data.data ?? []) as ScaleRuleSet[];
    },
  });

  const { data: scales } = useQuery({
    queryKey: ['admin', 'scales'],
    queryFn: async () => {
      const { data } = await api.get('/scales');
      return (data.data ?? []) as Scale[];
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/scales/rule-sets', {
        name: newName,
        items: newItems.filter((i) => i.scaleId).map((i) => ({
          scaleId: i.scaleId,
          percentageIncrease: parseFloat(i.percentageIncrease) || 0,
        })),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'scale-rule-sets'] });
      setNewName('');
      setNewItems([]);
      setError('');
      setSuccess('Regra criada com sucesso!');
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: () => setError('Erro ao criar regra'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, name, items }: { id: string; name: string; items: Array<{ scaleId: string; percentageIncrease: number }> }) =>
      api.put(`/scales/rule-sets/${id}`, { name, items }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'scale-rule-sets'] });
      setEditingId(null);
      setError('');
      setSuccess('Regra atualizada!');
      setTimeout(() => setSuccess(''), 3000);
    },
    onError: () => setError('Erro ao atualizar regra'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/scales/rule-sets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'scale-rule-sets'] });
      setSuccess('Regra desativada');
      setTimeout(() => setSuccess(''), 3000);
    },
  });

  function addNewItem() {
    setNewItems([...newItems, { scaleId: '', percentageIncrease: '0' }]);
  }

  function removeNewItem(index: number) {
    setNewItems(newItems.filter((_, i) => i !== index));
  }

  function startEdit(rs: ScaleRuleSet) {
    setEditingId(rs.id);
    setEditName(rs.name);
    setEditItems(rs.items.map((i) => ({
      scaleId: i.scaleId,
      percentageIncrease: String(i.percentageIncrease),
    })));
  }

  function saveEdit() {
    if (!editingId || !editName.trim()) return;
    updateMutation.mutate({
      id: editingId,
      name: editName,
      items: editItems.filter((i) => i.scaleId).map((i) => ({
        scaleId: i.scaleId,
        percentageIncrease: parseFloat(i.percentageIncrease) || 0,
      })),
    });
  }

  function addEditItem() {
    setEditItems([...editItems, { scaleId: '', percentageIncrease: '0' }]);
  }

  function removeEditItem(index: number) {
    setEditItems(editItems.filter((_, i) => i !== index));
  }

  // Filter out already-used scales
  function availableScales(currentItems: Array<{ scaleId: string }>, currentScaleId?: string) {
    const usedIds = new Set(currentItems.map((i) => i.scaleId).filter((id) => id && id !== currentScaleId));
    return (scales ?? []).filter((s) => !usedIds.has(s.id));
  }

  function renderItemEditor(
    items: Array<{ scaleId: string; percentageIncrease: string }>,
    setItems: (items: Array<{ scaleId: string; percentageIncrease: string }>) => void,
    addItem: () => void,
    removeItem: (i: number) => void,
  ) {
    return (
      <div className="space-y-2">
        <Label className="text-xs font-medium">Escalas e incremento (%)</Label>
        {items.map((item, i) => (
          <div key={i} className="flex gap-2 items-center">
            <select
              value={item.scaleId}
              onChange={(e) => {
                const updated = [...items];
                updated[i] = { ...updated[i], scaleId: e.target.value };
                setItems(updated);
              }}
              className="flex-1 h-9 rounded-md border bg-background px-3 py-1 text-sm"
            >
              <option value="">Selecionar escala...</option>
              {availableScales(items, item.scaleId).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.baseSize}mm)
                </option>
              ))}
            </select>
            <Input
              type="number"
              min="0"
              step="1"
              value={item.percentageIncrease}
              onChange={(e) => {
                const updated = [...items];
                updated[i] = { ...updated[i], percentageIncrease: e.target.value };
                setItems(updated);
              }}
              className="w-24 h-9"
              placeholder="%"
            />
            <span className="text-xs text-muted-foreground w-4">%</span>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeItem(i)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addItem}>
          <Plus className="h-3 w-3 mr-1" /> Adicionar escala
        </Button>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Regras de Escala</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Crie regras nomeadas que definem quais escalas se aplicam e o incremento de preco (%) de cada uma.
        Depois, atribua a regra a um produto, tag ou categoria.
      </p>

      {error && (
        <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 mb-4 text-sm">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 text-green-700 border border-green-200 rounded-md px-4 py-3 mb-4 text-sm">{success}</div>
      )}

      {/* Create new rule */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-lg">Nova Regra</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Nome da regra</Label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ex: Miniaturas Padrao"
              className="max-w-sm"
            />
          </div>

          {renderItemEditor(newItems, setNewItems, addNewItem, removeNewItem)}

          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !newName.trim() || newItems.filter((i) => i.scaleId).length === 0}
          >
            <Plus className="h-4 w-4 mr-2" /> Criar Regra
          </Button>
        </CardContent>
      </Card>

      {/* Existing rules */}
      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <div className="space-y-4">
          {ruleSets?.map((rs) => (
            <Card key={rs.id}>
              <CardContent className="pt-6">
                {editingId === rs.id ? (
                  <div className="space-y-4">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="max-w-sm font-medium"
                    />
                    {renderItemEditor(editItems, setEditItems, addEditItem, removeEditItem)}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEdit} disabled={updateMutation.isPending}>
                        <Save className="h-3 w-3 mr-1" /> Salvar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        <X className="h-3 w-3 mr-1" /> Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-base">{rs.name}</h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {rs.items
                          .sort((a, b) => a.scale.baseSize - b.scale.baseSize)
                          .map((item) => (
                            <span
                              key={item.scaleId}
                              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs"
                            >
                              {item.scale.name}
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
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(rs)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => {
                          if (confirm(`Desativar regra "${rs.name}"?`)) deleteMutation.mutate(rs.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {ruleSets?.length === 0 && (
            <p className="text-muted-foreground text-sm">Nenhuma regra cadastrada. Crie uma acima.</p>
          )}
        </div>
      )}
    </div>
  );
}
