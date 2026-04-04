'use client';
import type { ApiRecord } from '@/types/api';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Save, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Pagination } from '@/components/shared/pagination';
import { api } from '@/lib/api-client';

function extractError(err: unknown): string {
  const resp = (err as { response?: { data?: { error?: { message?: string; details?: string[] }; message?: string } } })?.response?.data;
  if (resp?.error?.details?.length) return resp.error.details.join(', ');
  return resp?.error?.message ?? resp?.message ?? 'Erro desconhecido';
}

function formatCpf(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}

export default function AdminClientesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedUser, setSelectedUser] = useState<ApiRecord | null>(null);
  const [error, setError] = useState('');

  // Edit state
  const [editName, setEditName] = useState('');
  const [editCpf, setEditCpf] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editActive, setEditActive] = useState(true);
  const [editMode, setEditMode] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', page, search],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, perPage: 20 };
      if (search) params.search = search;
      const { data } = await api.get('/users', { params });
      return data;
    },
  });

  // Load addresses when user is selected
  const { data: addressesData } = useQuery({
    queryKey: ['admin', 'user-addresses', selectedUser?.id],
    queryFn: async () => {
      const { data } = await api.get(`/users/${selectedUser!.id}/addresses`);
      return (data.data ?? []) as ApiRecord[];
    },
    enabled: !!selectedUser,
  });
  const addresses = addressesData ?? [];

  function openUserDialog(user: ApiRecord) {
    setSelectedUser(user);
    setEditName((user.name as string) || '');
    setEditCpf((user.cpf as string) || '');
    setEditPhone((user.phone as string) || '');
    setEditActive(user.isActive as boolean);
    setEditMode(false);
    setError('');
  }

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser) return;
      const { data } = await api.put(`/users/${selectedUser.id}`, {
        name: editName,
        cpf: editCpf.replace(/\D/g, '') || undefined,
        phone: editPhone.replace(/\D/g, '') || undefined,
        isActive: editActive,
      });
      return data.data;
    },
    onSuccess: (updated) => {
      setError('');
      setEditMode(false);
      if (updated) setSelectedUser({ ...selectedUser, ...updated });
      queryClient.refetchQueries({ queryKey: ['admin', 'users'] });
    },
    onError: (err) => { setError(extractError(err)); },
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
    setPage(1);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Clientes</h1>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar nome, email ou CPF..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 w-[300px]"
            />
          </div>
        </form>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Pedidos</TableHead>
                  <TableHead>Cadastro</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.data?.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhum cliente encontrado.
                    </TableCell>
                  </TableRow>
                )}
                {data?.data?.map((user: ApiRecord) => (
                  <TableRow
                    key={user.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => openUserDialog(user)}
                  >
                    <TableCell className="font-medium">
                      {user.name || '-'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {user.email}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {user.cpf ? formatCpf(user.cpf) : '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {user.phone ? formatPhone(user.phone) : '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {user._count?.orders ?? 0}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? 'default' : 'secondary'}>
                        {user.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {data?.meta && (
            <Pagination
              page={page}
              lastPage={data.meta.lastPage}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      {/* User Details / Edit Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={(open) => { if (!open) setSelectedUser(null); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editMode ? 'Editar Cliente' : 'Detalhes do Cliente'}
            </DialogTitle>
          </DialogHeader>

          {error && (
            <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-md px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {selectedUser && !editMode && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Nome</p>
                  <p className="font-medium">{selectedUser.name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedUser.email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">CPF</p>
                  <p className="font-mono">{selectedUser.cpf ? formatCpf(selectedUser.cpf) : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Telefone</p>
                  <p>{selectedUser.phone ? formatPhone(selectedUser.phone) : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Role</p>
                  <Badge variant="outline">{selectedUser.role}</Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={selectedUser.isActive ? 'default' : 'secondary'}>
                    {selectedUser.isActive ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pedidos</p>
                  <p className="font-medium">{selectedUser._count?.orders ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cadastro</p>
                  <p>{new Date(selectedUser.createdAt).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>

              {/* Addresses */}
              {addresses.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-1 mb-2">
                    <MapPin className="h-4 w-4" /> Enderecos ({addresses.length})
                  </h3>
                  <div className="space-y-2">
                    {addresses.map((addr: ApiRecord) => (
                      <div key={addr.id} className="border rounded-md px-3 py-2 text-sm bg-muted/30">
                        <p className="font-medium">{addr.label || 'Endereco'}{addr.isDefault ? ' (Padrao)' : ''}</p>
                        <p className="text-muted-foreground">
                          {addr.street}{addr.number ? `, ${addr.number}` : ''}{addr.complement ? ` - ${addr.complement}` : ''}
                        </p>
                        <p className="text-muted-foreground">
                          {addr.neighborhood ? `${addr.neighborhood}, ` : ''}{addr.city}/{addr.state} — CEP {addr.zipCode}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button onClick={() => setEditMode(true)}>Editar</Button>
              </div>
            </div>
          )}

          {selectedUser && editMode && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs">Nome</Label>
                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input value={selectedUser.email as string} disabled className="opacity-60" />
                  <p className="text-[10px] text-muted-foreground">Email nao pode ser alterado pelo admin</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">CPF</Label>
                    <Input value={editCpf} onChange={(e) => setEditCpf(e.target.value)} placeholder="000.000.000-00" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Telefone</Label>
                    <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="(00) 00000-0000" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="user-active"
                    checked={editActive}
                    onChange={(e) => setEditActive(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="user-active" className="text-sm">Cliente ativo</Label>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                  <Save className="h-4 w-4 mr-1" />
                  {updateMutation.isPending ? 'Salvando...' : 'Salvar'}
                </Button>
                <Button variant="ghost" onClick={() => setEditMode(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
