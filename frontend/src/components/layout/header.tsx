'use client';

import Link from 'next/link';
import { Search, ShoppingCart, User, Menu } from 'lucide-react';
import { useState } from 'react';
import { ROUTES, SITE_NAME } from '@/lib/constants';
import { useCartStore } from '@/store/cart-store';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const itemCount = useCartStore((s) => s.itemCount);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-4">
          {/* Logo */}
          <Link href={ROUTES.home} className="text-xl font-bold tracking-tight">
            {SITE_NAME}
          </Link>

          {/* Nav desktop */}
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href={ROUTES.products} className="text-muted-foreground hover:text-foreground transition-colors">
              Produtos
            </Link>
            <Link href="/categoria/fantasy" className="text-muted-foreground hover:text-foreground transition-colors">
              Categorias
            </Link>
            <Link href="/marca/arsenal-craft" className="text-muted-foreground hover:text-foreground transition-colors">
              Marcas
            </Link>
          </nav>

          {/* Search + actions */}
          <div className="flex items-center gap-2">
            <Link href={ROUTES.search}>
              <Button variant="ghost" size="icon" aria-label="Buscar">
                <Search className="h-5 w-5" />
              </Button>
            </Link>

            <Link href={isAuthenticated ? ROUTES.account : ROUTES.login}>
              <Button variant="ghost" size="icon" aria-label="Conta">
                <User className="h-5 w-5" />
              </Button>
            </Link>

            <Link href={ROUTES.cart} className="relative">
              <Button variant="ghost" size="icon" aria-label="Carrinho">
                <ShoppingCart className="h-5 w-5" />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {itemCount}
                  </span>
                )}
              </Button>
            </Link>

            {/* Mobile menu toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileMenuOpen && (
          <nav className="border-t py-4 md:hidden flex flex-col gap-3 text-sm">
            <Link href={ROUTES.products} className="text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>
              Produtos
            </Link>
            <Link href="/categoria/fantasy" className="text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>
              Categorias
            </Link>
            <Link href="/marca/arsenal-craft" className="text-muted-foreground hover:text-foreground" onClick={() => setMobileMenuOpen(false)}>
              Marcas
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
