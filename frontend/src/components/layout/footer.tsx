import Link from 'next/link';
import { SITE_NAME } from '@/lib/constants';

export function Footer() {
  return (
    <footer className="mt-auto border-t bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Sobre */}
          <div>
            <h3 className="text-sm font-semibold">{SITE_NAME}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Miniaturas 3D de alta qualidade para colecionadores e jogadores de RPG.
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-sm font-semibold">Loja</h3>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              <li><Link href="/produtos" className="hover:text-foreground">Produtos</Link></li>
              <li><Link href="/busca" className="hover:text-foreground">Buscar</Link></li>
              <li><Link href="/carrinho" className="hover:text-foreground">Carrinho</Link></li>
            </ul>
          </div>

          {/* Institucional */}
          <div>
            <h3 className="text-sm font-semibold">Institucional</h3>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              <li><Link href="/sobre" className="hover:text-foreground">Sobre</Link></li>
              <li><Link href="/contato" className="hover:text-foreground">Contato</Link></li>
              <li><Link href="/faq" className="hover:text-foreground">FAQ</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-sm font-semibold">Legal</h3>
            <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
              <li><Link href="/termos" className="hover:text-foreground">Termos de Uso</Link></li>
              <li><Link href="/privacidade" className="hover:text-foreground">Privacidade</Link></li>
              <li><Link href="/trocas-e-devolucoes" className="hover:text-foreground">Trocas e Devoluções</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} {SITE_NAME}. Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
}
