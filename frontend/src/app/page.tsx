import Link from 'next/link';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { ROUTES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { ArrowRight, Sword, Shield, Wand2 } from 'lucide-react';

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-background">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
            <div className="max-w-2xl">
              <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
                Miniaturas 3D de Alta Qualidade
              </h1>
              <p className="mt-6 text-lg text-muted-foreground leading-8">
                Descubra nossa coleção de miniaturas para RPG, wargames e
                colecionadores. Pinups, guerreiros, magos e muito mais em
                diversas escalas.
              </p>
              <div className="mt-8 flex gap-4">
                <Link href={ROUTES.products}>
                  <Button size="lg">
                    Ver Produtos
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href={ROUTES.search}>
                  <Button variant="outline" size="lg">
                    Buscar
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Categorias em destaque */}
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
          <h2 className="text-2xl font-bold mb-8">Categorias</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { name: 'Fantasy', icon: Sword, slug: 'fantasy', desc: 'Guerreiros, elfos, dragões' },
              { name: 'Sci-Fi', icon: Shield, slug: 'sci-fi', desc: 'Soldados, mechs, naves' },
              { name: 'Pin Ups', icon: Wand2, slug: 'pin-ups', desc: 'Modelos artísticos em 3D' },
            ].map((cat) => (
              <Link
                key={cat.slug}
                href={`/categoria/${cat.slug}`}
                className="group flex flex-col items-center p-8 rounded-lg border bg-card hover:shadow-md transition-shadow text-center"
              >
                <cat.icon className="h-10 w-10 text-primary mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="font-semibold text-lg">{cat.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{cat.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="bg-primary text-primary-foreground">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16 text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">
              Pronto para montar sua coleção?
            </h2>
            <p className="mt-4 text-primary-foreground/80 max-w-xl mx-auto">
              Cadastre-se e ganhe 10% de desconto na primeira compra com o cupom WELCOME10.
            </p>
            <div className="mt-8">
              <Link href={ROUTES.register}>
                <Button variant="secondary" size="lg">
                  Criar Conta Grátis
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
