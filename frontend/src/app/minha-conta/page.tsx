'use client';

import { useAuthStore } from '@/store/auth-store';
import { Package, Heart, MapPin } from 'lucide-react';
import Link from 'next/link';

export default function AccountDashboard() {
  const user = useAuthStore((s) => s.user);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">
        Olá, {user?.name ?? 'Visitante'}!
      </h1>
      <p className="text-muted-foreground mb-8">
        Gerencie seus pedidos, dados e lista de desejos.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { href: '/minha-conta/pedidos', icon: Package, label: 'Meus Pedidos', desc: 'Acompanhe suas compras' },
          { href: '/minha-conta/lista-de-desejos', icon: Heart, label: 'Lista de Desejos', desc: 'Produtos salvos' },
          { href: '/minha-conta/dados', icon: MapPin, label: 'Meus Dados', desc: 'Dados pessoais e endereços' },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex flex-col items-center p-6 border rounded-lg hover:shadow-md transition-shadow text-center"
          >
            <item.icon className="h-8 w-8 text-primary mb-3" />
            <h3 className="font-medium">{item.label}</h3>
            <p className="text-sm text-muted-foreground mt-1">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
