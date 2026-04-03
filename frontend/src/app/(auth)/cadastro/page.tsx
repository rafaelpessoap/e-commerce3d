'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api-client';
import { ROUTES } from '@/lib/constants';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/auth/register', { name, email, password });
      // Preserve returnTo query param through to login
      const params = new URLSearchParams(window.location.search);
      const returnTo = params.get('returnTo');
      const wishlist = params.get('wishlist');
      let loginUrl = ROUTES.login + '?registered=1';
      if (returnTo) loginUrl += `&returnTo=${encodeURIComponent(returnTo)}`;
      if (wishlist) loginUrl += `&wishlist=${wishlist}`;
      router.push(loginUrl);
    } catch (err) {
      const resp = (err as { response?: { data?: { error?: { message?: string; details?: string[] }; message?: string } } })?.response?.data;
      const details = resp?.error?.details;
      const msg = resp?.error?.message ?? resp?.message;
      if (Array.isArray(details)) {
        setError(details.join('. '));
      } else {
        setError(msg ?? 'Erro ao criar conta');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-center">Criar Conta</CardTitle>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              placeholder="Seu nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
            <p className="text-xs text-muted-foreground">
              Mínimo 8 caracteres, 1 maiúscula, 1 número e 1 caractere especial
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Criando...' : 'Criar Conta'}
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            Já tem conta?{' '}
            <Link href={ROUTES.login} className="text-primary hover:underline">
              Entrar
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
