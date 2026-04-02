'use client';

import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
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

export default function AdminCouponsPage() {
  const { data: coupons, isLoading } = useQuery({
    queryKey: ['admin', 'coupons'],
    queryFn: async () => {
      const { data } = await api.get('/coupons');
      return data.data;
    },
  });

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Cupons</h1>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Usos</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons?.map((coupon: any) => (
                <TableRow key={coupon.id}>
                  <TableCell className="font-mono font-medium">
                    {coupon.code}
                  </TableCell>
                  <TableCell>{coupon.type}</TableCell>
                  <TableCell>
                    {coupon.type === 'PERCENTAGE'
                      ? `${coupon.value}%`
                      : coupon.type === 'FIXED'
                        ? formatCurrency(coupon.value)
                        : 'Frete Grátis'}
                  </TableCell>
                  <TableCell>
                    {coupon._count?.usages ?? 0}
                    {coupon.maxUses ? `/${coupon.maxUses}` : ''}
                  </TableCell>
                  <TableCell>
                    <Badge variant={coupon.isActive ? 'default' : 'secondary'}>
                      {coupon.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
