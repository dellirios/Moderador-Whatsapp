// src/app/page.tsx

// Importe o seu componente PainelModeracao
// O alias '@/' deve estar configurado no seu tsconfig.json para apontar para 'src/'
import PainelModeracao from '@/components/PainelModeracao';

// Se você quiser definir um título para a aba do navegador e outras meta tags para esta página:
// import type { Metadata } from 'next'
// export const metadata: Metadata = {
//   title: 'Painel de Moderação',
//   description: 'Ferramenta de moderação para WhatsApp',
// }

export default function HomePage() {
  return (
    <main>
      {/* Aqui você renderiza o seu componente PainelModeracao */}
      <PainelModeracao />
    </main>
  );
}