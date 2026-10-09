import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { api } from '../../services/api';
import { useSedeActiva } from '../../context/SedeActivaContext';

const PARTES = [
  { k: 'horario', label: 'Horario' },
  { k: 'parametros', label: 'Reglas de citas y asistente' },
  { k: 'zonas', label: 'Zonas' },
] as const;
type Parte = (typeof PARTES)[number]['k'];

/**
 * En El salón, dentro de una sede: "Copiar de otra sede". Para no armar la
 * sede nueva desde cero: se elige de cuál y qué se trae.
 */
export const CopiarDeSede: React.FC = () => {
  const { varias, actual, fija, sedes } = useSedeActiva();
  const [abierto, setAbierto] = useState(false);
  const [desde, setDesde] = useState('');
  const [partes, setPartes] = useState<Parte[]>(['horario', 'parametros', 'zonas']);
  const [estado, setEstado] = useState('');
  if (!varias || !actual || fija) return null;
  const otras = sedes.filter((s) => s.id !== actual.id);

  const copiar = async () => {
    setEstado('copiando');
    try {
      const cuerpo: Record<string, unknown> = { desde };
      for (const p of partes) cuerpo[p] = true;
      await api.post('/salon/sede/copiar', cuerpo);
      setEstado('listo');
      setTimeout(() => window.location.reload(), 900);
    } catch (e: any) {
      setEstado(e?.message || 'No se pudo copiar');
    }
  };

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => { setAbierto(true); setDesde(otras[0]?.id ?? ''); }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[0.8125rem] font-semibold text-slate-700 dark:text-neutral-200 cursor-pointer"
      >
        <Copy className="w-3.5 h-3.5" /> Copiar de otra sede
      </button>
    );
  }

  return (
    <div className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 space-y-2.5">
      <p className="text-[0.8125rem] text-slate-700 dark:text-neutral-200">
        Trae a <b>{actual.name}</b> lo que ya tienes en otra sede:
      </p>
      <div className="flex flex-wrap gap-1.5">
        {otras.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setDesde(s.id)}
            className={`px-3 py-1.5 rounded-full text-[0.75rem] font-semibold border cursor-pointer ${
              desde === s.id ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'bg-white dark:bg-neutral-900 text-slate-700 dark:text-neutral-200 border-slate-200 dark:border-neutral-700'
            }`}
          >
            De {s.name}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PARTES.map((p) => {
          const si = partes.includes(p.k);
          return (
            <button
              key={p.k}
              type="button"
              onClick={() => setPartes((l) => (si ? l.filter((x) => x !== p.k) : [...l, p.k]))}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[0.75rem] font-semibold border cursor-pointer ${
                si ? 'bg-[var(--primary)]/10 text-[var(--primary)] border-[var(--primary)]/30' : 'text-slate-500 border-slate-200 dark:border-neutral-700'
              }`}
            >
              {si && <Check className="w-3.5 h-3.5" />} {p.label}
            </button>
          );
        })}
      </div>
      <p className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">
        Las zonas que ya existen aquí se dejan como están. Las especialistas se asignan una por una con el botón de la sede.
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!desde || !partes.length || estado === 'copiando'}
          onClick={copiar}
          className="px-3 py-1.5 rounded-full bg-[var(--primary)] text-white text-[0.75rem] font-bold disabled:opacity-40 cursor-pointer"
        >
          {estado === 'copiando' ? 'Copiando…' : 'Copiar'}
        </button>
        <button type="button" onClick={() => { setAbierto(false); setEstado(''); }} className="px-3 py-1.5 text-[0.75rem] font-semibold text-slate-500 cursor-pointer">
          Cancelar
        </button>
        {estado === 'listo' && <span className="text-[0.75rem] font-semibold text-emerald-600">Listo, copiado</span>}
        {estado && !['listo', 'copiando'].includes(estado) && <span className="text-[0.75rem] text-rose-600">{estado}</span>}
      </div>
    </div>
  );
};
