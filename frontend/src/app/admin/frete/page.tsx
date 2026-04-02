'use client';
import type { ApiRecord } from '@/types/api';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api-client';
import { formatCurrency } from '@/lib/constants';

export default function AdminShippingPage() {
  const queryClient = useQueryClient();
  const [zipStart, setZipStart] = useState('');
  const [zipEnd, setZipEnd] = useState('');
  const [minValue, setMinValue] = useState('');

  const { data: rules, isLoading } = useQuery({
    queryKey: ['admin', 'shipping-rules'],
    queryFn: async () => { const { data } = await api.get('/shipping/free-rules'); return data.data; },
  });

  const createMutation = useMutation({
    mutationFn: () => api.post('/shipping/free-rules', {
      zipCodeStart: zipStart.replace(/\D/g, ''),
      zipCodeEnd: zipEnd.replace(/\D/g, ''),
      minOrderValue: parseFloat(minValue),
    }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['admin', 'shipping-rules'] }); setZipStart(''); setZipEnd(''); setMinValue(''); },
  });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Regras de Frete Grátis</h1>

      <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(); }} className="flex gap-2 mb-6 items-end max-w-2xl">
        <div className="space-y-1">
          <Label className="text-xs">CEP Início</Label>
          <Input placeholder="01000000" value={zipStart} onChange={(e) => setZipStart(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">CEP Fim</Label>
          <Input placeholder="09999999" value={zipEnd} onChange={(e) => setZipEnd(e.target.value)} required />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Valor Mínimo (R$)</Label>
          <Input type="number" step="0.01" placeholder="150" value={minValue} onChange={(e) => setMinValue(e.target.value)} required />
        </div>
        <Button type="submit" disabled={createMutation.isPending}><Plus className="h-4 w-4 mr-2" />Criar</Button>
      </form>

      {isLoading ? <p className="text-muted-foreground">Carregando...</p> : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader><TableRow><TableHead>CEP Início</TableHead><TableHead>CEP Fim</TableHead><TableHead>Valor Mínimo</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {rules?.map((r: ApiRecord) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono">{r.zipCodeStart}</TableCell>
                  <TableCell className="font-mono">{r.zipCodeEnd}</TableCell>
                  <TableCell>{formatCurrency(r.minOrderValue)}</TableCell>
                  <TableCell><Badge variant={r.isActive ? 'default' : 'secondary'}>{r.isActive ? 'Ativo' : 'Inativo'}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
