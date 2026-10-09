import React from 'react';
import { Check, MapPin } from 'lucide-react';
import { paletaDeSede, useSedeActiva } from '../../context/SedeActivaContext';
import { THEME_PALETTE_PRESETS } from '../../theme/ThemeContext';

/** El color con el que se ve cada sede (el mismo que toma la app al entrar) */
function colorDe(sedes: ReturnType<typeof useSedeActiva>['sedes'], id: string): string {
  const paleta = paletaDeSede(sedes, id);
  return THEME_PALETTE_PRESETS.find((p) => p.id === paleta)?.primary ?? 'var(--primary)';
}

/**
 * "¿En qué sede estás?": la lista para cambiar de sede, en el menú de la
 * cuenta. Es el control principal de las sedes: al tocar una, toda la app
 * pasa a esa sede y cambia de color. Con una sola sede no se muestra.
 */
export const ListaSedes: React.FC<{ alElegir?: () => void }> = ({ alElegir }) => {
  const { sedes, actual, fija, varias, elegir } = useSedeActiva();
  if (!varias) return null;

  if (fija) {
    return (
      <div className="px-2 py-2 text-[0.75rem] text-slate-500 dark:text-neutral-400 flex items-center gap-1.5">
        <MapPin className="w-3.5 h-3.5" /> Trabajas en <b className="text-slate-700 dark:text-neutral-200">{actual?.name}</b>
      </div>
    );
  }

  const fila = (id: string, nombre: string, detalle: string | null, color: string) => {
    const activa = (actual?.id ?? '') === id;
    return (
      <button
        key={id || 'todas'}
        type="button"
        onClick={() => { alElegir?.(); elegir(id); }}
        className={`w-full min-h-[44px] flex items-center gap-2.5 px-2 py-2 rounded-xl text-left transition cursor-pointer ${activa ? 'bg-slate-100 dark:bg-neutral-800' : 'hover:bg-slate-50 dark:hover:bg-neutral-800/60'}`}
      >
        <span className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
        <span className="flex-1 min-w-0">
          <span className={`block text-[0.8125rem] truncate ${activa ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-neutral-200'}`}>{nombre}</span>
          {detalle && <span className="block text-[0.6875rem] text-slate-400 truncate">{detalle}</span>}
        </span>
        {activa && <Check className="w-4 h-4 text-[var(--primary)] shrink-0" />}
      </button>
    );
  };

  return (
    <div className="py-1">
      <div className="px-2 pb-1 text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400">¿En qué sede estás?</div>
      {sedes.map((s) => fila(s.id, s.name, s.address, colorDe(sedes, s.id)))}
      {fila('', 'Todas las sedes', 'Ver la cadena completa', 'linear-gradient(135deg,#94a3b8,#cbd5e1)')}
    </div>
  );
};

/** El nombre de la sede en la que se está, para ponerlo junto al rol */
export function useNombreSede(): string | null {
  const { varias, actual } = useSedeActiva();
  if (!varias) return null;
  return actual?.name ?? 'Todas las sedes';
}
