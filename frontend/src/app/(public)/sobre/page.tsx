import type { Metadata } from 'next';
import { SITE_NAME } from '@/lib/constants';

export const metadata: Metadata = { title: 'Sobre' };

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
      <h1 className="text-3xl font-bold mb-6">Sobre a {SITE_NAME}</h1>
      <div className="prose max-w-none">
        <p>Somos uma loja especializada em miniaturas 3D de alta qualidade para colecionadores, jogadores de RPG e entusiastas de wargames.</p>
        <p>Cada miniatura é cuidadosamente impressa em resina de alta resolução, garantindo detalhes incríveis em todas as escalas.</p>
        <h2>Nossa Missão</h2>
        <p>Tornar miniaturas 3D acessíveis para todos os entusiastas, oferecendo variedade de escalas, preços justos e atendimento personalizado.</p>
        <h2>Escalas Disponíveis</h2>
        <p>Trabalhamos com diversas escalas: 28mm (Heroic), 32mm, 54mm, 75mm e mais. Cada escala tem regras de preço configuráveis para garantir o melhor custo-benefício.</p>
      </div>
    </div>
  );
}
