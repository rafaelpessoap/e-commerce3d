'use client';

import { useQuery } from '@tanstack/react-query';
import { Package, DollarSign, Users, ShoppingBag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api-client';
import { formatCurrency } from '@/lib/constants';

export default function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/admin/dashboard');
      return data.data;
    },
  });

  const { data: ordersByStatus } = useQuery({
    queryKey: ['admin', 'orders-by-status'],
    queryFn: async () => {
      const { data } = await api.get('/admin/orders-by-status');
      return data.data;
    },
  });

  const cards = [
    {
      title: 'Pedidos',
      value: stats?.totalOrders ?? 0,
      icon: ShoppingBag,
    },
    {
      title: 'Receita',
      value: formatCurrency(stats?.totalRevenue ?? 0),
      icon: DollarSign,
    },
    {
      title: 'Usuários',
      value: stats?.totalUsers ?? 0,
      icon: Users,
    },
    {
      title: 'Produtos',
      value: stats?.totalProducts ?? 0,
      icon: Package,
    },
  ];

  return (
    <div>
      <h1 className="text-3xl font-bold mb-8">Dashboard</h1>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Orders by status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pedidos por Status</CardTitle>
        </CardHeader>
        <CardContent>
          {ordersByStatus ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {ordersByStatus.map((item: any) => (
                <div key={item.status} className="text-center p-3 rounded-lg bg-muted/50">
                  <p className="text-2xl font-bold">{item.count}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.status}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
