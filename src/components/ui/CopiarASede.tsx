import React, { useState } from 'react';
import { Copy, Check, MapPin } from 'lucide-react';
import { useSedeActiva } from '../../context/SedeActivaContext';

/**
 * "Copiar a otra sede": un botón en cada servicio u oferta. Se abre con las
 * otras sedes, se marcan y se copia con su precio, variantes y todo. Con una
 * sola sede no se muestra.
 */
export const CopiarASede: React.FC<{
  /** La sede del servicio u oferta (null = de todas): no se ofrece copiarlo a sí misma */
  desde?: string | null;
  onCopiar: (sedes: string[]) => Promise<void>;
}> = ({ desde, onCopiar }) => {
  const { varias, sedes, actual } = useSedeActiva();
  const [abierto, setAbierto] = useState(false);
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [estado, setEstado] = useState<'' | 'copiando' | 'listo' | string>('');
  if (!varias) return null;

  const aqui = desde ?? actual?.id ?? null;
  const otras = sedes.filter((s) => s.id !== aqui);
  if (!otras.length) return null;

  const copiar = async () => {
    if (!marcadas.length) return;
    setEstado('copiando');
    try {
      await onCopiar(marcadas);
      setEstado('listo');
      setMarcadas([]);
      setTimeout(() => { setAbierto(false); setEstado(''); }, 1500);
    } catch (e: any) {
      setEstado(e?.message || 'No se pudo copiar');
    }
  };

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-neutral-800 text-[0.75rem] font-semibold text-slate-700 dark:text-neutral-200 hover:text-[var(--primary)] ios-touch cursor-pointer"
      >
        <Copy className="w-3.5 h-3.5" /> Copiar a otra sede
      </button>
    );
  }

  return (
    <div className="w-full p-2.5 rounded-xl bg-[var(--primary)]/5 border border-[var(--primary)]/20 space-y-2">
      <p className="text-[0.75rem] text-slate-700 dark:text-neutral-200">
        ¿A qué sede lo copio? Va con su precio, sus opciones y su duración.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {otras.map((s) => {
          const si = marcadas.includes(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setMarcadas((m) => (si ? m.filter((x) => x !== s.id) : [...m, s.id]))}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-[0.75rem] font-semibold border cursor-pointer ${
                si
                  ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                  : 'bg-white dark:bg-neutral-900 text-slate-700 dark:text-neutral-200 border-slate-200 dark:border-neutral-700'
              }`}
            >
              {si ? <Check className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />} {s.name}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!marcadas.length || estado === 'copiando'}
          onClick={copiar}
          className="px-3 py-1.5 rounded-full bg-[var(--primary)] text-white text-[0.75rem] font-bold disabled:opacity-40 cursor-pointer"
        >
          {estado === 'copiando' ? 'Copiando…' : 'Copiar'}
        </button>
        <button
          type="button"
          onClick={() => { setAbierto(false); setEstado(''); setMarcadas([]); }}
          className="px-3 py-1.5 rounded-full text-[0.75rem] font-semibold text-slate-500 cursor-pointer"
        >
          Cancelar
        </button>
        {estado === 'listo' && <span className="text-[0.75rem] font-semibold text-emerald-600">Listo, copiado</span>}
        {estado && estado !== 'listo' && estado !== 'copiando' && <span className="text-[0.75rem] text-rose-600">{estado}</span>}
      </div>
    </div>
  );
};

/** El nombre de la sede de un servicio u oferta, para verlo en "Todas las sedes" (y, con `siempre`, lo que vale en todas) */
export const EtiquetaSede: React.FC<{ locationId?: string | null; siempre?: boolean }> = ({ locationId, siempre }) => {
  const { varias, actual, sedes } = useSedeActiva();
  // Dentro de una sede solo se marca lo que es de todas (con `siempre`): lo demás es de aquí
  if (!varias || (actual && (!siempre || locationId))) return null;
  const nombre = locationId ? sedes.find((s) => s.id === locationId)?.name ?? 'Otra sede' : 'Todas las sedes';
  return (
    <span className="inline-flex items-center gap-1 px-1.5 rounded-full bg-slate-100 dark:bg-neutral-800 text-[0.6875rem] font-semibold text-slate-500 dark:text-neutral-400">
      <MapPin className="w-3 h-3" /> {nombre}
    </span>
  );
};
