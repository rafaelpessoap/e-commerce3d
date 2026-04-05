'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Ruler,
  ShoppingBag,
  Users,
  Ticket,
  FileText,
  Tag,
  Award,
  Truck,
  Settings,
  Layers,
  BarChart3,
  ImageIcon,
  Mail,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SITE_NAME, ROUTES } from '@/lib/constants';

const NAV_ITEMS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/produtos', label: 'Produtos', icon: Package },
  { href: '/admin/pedidos', label: 'Pedidos', icon: ShoppingBag },
  { href: '/admin/clientes', label: 'Clientes', icon: Users },
  { href: '/admin/categorias', label: 'Categorias', icon: FolderTree },
  { href: '/admin/cupons', label: 'Cupons', icon: Ticket },
  { href: '/admin/marcas', label: 'Marcas', icon: Award },
  { href: '/admin/tags', label: 'Tags', icon: Tag },
  { href: '/admin/galeria', label: 'Galeria', icon: ImageIcon },
  { href: '/admin/atributos', label: 'Atributos', icon: Layers },
  { href: '/admin/escalas', label: 'Escalas', icon: Ruler, exact: true },
  { href: '/admin/estoque', label: 'Estoque', icon: BarChart3 },
  { href: '/admin/frete', label: 'Frete', icon: Truck },
  { href: '/admin/emails', label: 'Emails', icon: Mail },
  { href: '/admin/blog', label: 'Blog', icon: FileText },
  { href: '/admin/configuracoes', label: 'Config', icon: Settings },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isAuthenticated, isHydrated } = useAuthStore();

  useEffect(() => {
    if (isHydrated && (!isAuthenticated || user?.role !== 'ADMIN')) {
      router.push(`/login?returnTo=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthenticated, isHydrated, user, router, pathname]);

  if (!isHydrated || !isAuthenticated || user?.role !== 'ADMIN') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Verificando acesso...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-60 h-screen border-r bg-muted/30 flex flex-col sticky top-0">
        <div className="p-4 border-b flex-shrink-0">
          <Link href="/admin" className="font-bold text-lg">
            {SITE_NAME}
          </Link>
          <p className="text-xs text-muted-foreground">Admin</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t space-y-1 flex-shrink-0">
          <Link
            href={ROUTES.home}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar à loja
          </Link>
          <p className="text-[10px] text-muted-foreground/50 px-3">
            v{process.env.NEXT_PUBLIC_APP_VERSION ?? 'dev'}
          </p>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  );
}
