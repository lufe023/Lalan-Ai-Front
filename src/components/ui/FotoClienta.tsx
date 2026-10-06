import React, { useState } from 'react';

/** La imagen de iniciales de ui-avatars: se dibuja aquí mismo, sin depender de otro servidor */
const RELLENO = /^https?:\/\/ui-avatars\.com\//;
const TONOS = [
  'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-200',
  'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-200',
  'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-200',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200',
  'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200',
  'bg-slate-200 text-slate-700 dark:bg-neutral-700 dark:text-neutral-200',
];

export function iniciales(nombre: string): string {
  const partes = nombre.replace(/^@/, '').trim().split(/\s+/).filter(Boolean);
  const letras = partes.length > 1 ? partes[0][0] + partes[partes.length - 1][0] : (partes[0] ?? '?').slice(0, 2);
  return letras.toUpperCase();
}

/**
 * La foto de una clienta. Si no tiene, o la foto no carga (el enlace venció,
 * no hay internet), se ven sus iniciales en un color fijo para ella: nunca
 * una imagen rota.
 */
export const FotoClienta: React.FC<{ foto?: string | null; nombre: string; className?: string }> = ({ foto, nombre, className = 'w-10 h-10' }) => {
  const [rota, setRota] = useState<string | null>(null);
  const valida = foto && !RELLENO.test(foto) && rota !== foto ? foto : null;
  if (valida) {
    return <img src={valida} alt={nombre} onError={() => setRota(valida)} className={`${className} rounded-full object-cover shrink-0`} />;
  }
  const tono = TONOS[[...nombre].reduce((n, c) => n + c.charCodeAt(0), 0) % TONOS.length];
  return (
    <span aria-label={nombre} role="img" className={`${className} ${tono} rounded-full shrink-0 inline-flex items-center justify-center font-bold text-[0.8em] select-none`}>
      {iniciales(nombre)}
    </span>
  );
};
