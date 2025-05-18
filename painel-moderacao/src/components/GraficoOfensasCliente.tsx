// src/components/GraficoOfensasCliente.tsx
'use client';

import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';

interface GraficoOfensasProps {
  data: { name: string; value: number }[];
  isMobile: boolean;
  cores: string[];
}

const GraficoOfensasCliente: React.FC<GraficoOfensasProps> = ({ data, isMobile, cores }) => {
  // Calcula a largura aqui, garantindo que window esteja disponível
  // Usamos um valor padrão caso window não esteja disponível (embora 'use client' e dynamic import devam ajudar)
  const chartWidth = typeof window !== 'undefined' ? (isMobile ? window.innerWidth - 80 : 400) : 400;

  if (!data || data.length === 0) {
    return <p className="text-center text-gray-500 dark:text-gray-400 py-4">Sem dados para exibir no gráfico.</p>;
  }

  return (
    <PieChart width={chartWidth} height={300}>
      <Pie
        data={data}
        cx="50%"
        cy="50%"
        labelLine={false}
        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
        outerRadius={80}
        dataKey="value"
        isAnimationActive={false} // Desativar animações pode ajudar em alguns casos de hidratação
      >
        {data.map((entry, index) => (
          <Cell key={`cell-${index}`} fill={cores[index % cores.length]} />
        ))}
      </Pie>
      <Tooltip />
      <Legend />
    </PieChart>
  );
};

export default GraficoOfensasCliente;
