import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RotateCcw, Save } from 'lucide-react';
import { api } from '../../services/api';
import { cargarAjustesLalan } from '../../utils/ajustesLalan';
import { abrirLalan } from '../lalan/PantallaLalan';

type Valor = number | boolean | string;
interface Campo {
  id: string; grupo: string; nombre: string; descripcion: string;
  tipo: 'numero' | 'si_no' | 'texto' | 'opciones';
  porDefecto: Valor; min?: number; max?: number; paso?: number; unidad?: string;
  opciones?: { id: string; nombre: string }[]; soloServidor?: boolean;
}
interface Catalogo { grupos: { id: string; nombre: string }[]; campos: Campo[]; valores: Record<string, Valor>; porDefecto: Record<string, Valor> }

const caja = 'px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.8125rem]';

/** Cómo se lee un valor ("2.8 s", "Sí"…) */
function legible(c: Campo, v: Valor) {
  if (c.tipo === 'si_no') return v ? 'Sí' : 'No';
  if (c.tipo === 'opciones') return c.opciones?.find((o) => o.id === v)?.nombre ?? String(v);
  if (c.tipo === 'numero' && c.unidad === 'ms') return `${(Number(v) / 1000).toLocaleString('es-DO')} s`;
  if (c.tipo === 'numero') return `${Number(v).toLocaleString('es-DO')}${c.unidad ? ` ${c.unidad}` : ''}`;
  return String(v);
}

const Interruptor: React.FC<{ si: boolean; onCambio: (v: boolean) => void; etiqueta: string }> = ({ si, onCambio, etiqueta }) => (
  <button type="button" role="switch" aria-checked={si} aria-label={etiqueta} onClick={() => onCambio(!si)}
    className={`relative w-10 h-6 rounded-full shrink-0 transition-colors cursor-pointer ${si ? 'bg-[var(--primary)]' : 'bg-slate-300 dark:bg-neutral-700'}`}>
    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${si ? 'left-[18px]' : 'left-0.5'}`} />
  </button>
);

const Control: React.FC<{ c: Campo; v: Valor; onCambio: (v: Valor) => void }> = ({ c, v, onCambio }) => {
  if (c.tipo === 'si_no') return <Interruptor si={!!v} onCambio={onCambio} etiqueta={c.nombre} />;
  if (c.tipo === 'opciones') {
    return (
      <div className="inline-grid grid-flow-col gap-1 p-1 rounded-xl bg-slate-100 dark:bg-neutral-800">
        {c.opciones?.map((o) => (
          <button key={o.id} type="button" onClick={() => onCambio(o.id)} aria-pressed={v === o.id}
            className={`px-3 py-1.5 rounded-lg text-[0.8125rem] font-semibold cursor-pointer ${v === o.id ? 'bg-white dark:bg-neutral-900 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}>
            {o.nombre}
          </button>
        ))}
      </div>
    );
  }
  if (c.tipo === 'texto') return <input value={String(v)} onChange={(e) => onCambio(e.target.value)} className={`${caja} w-full`} />;
  const esMs = c.unidad === 'ms';
  // Los milisegundos se muestran en segundos: nadie piensa en "2800 ms"
  const mostrar = esMs ? Number(v) / 1000 : Number(v);
  const factor = esMs ? 1000 : 1;
  return (
    <div className="flex items-center gap-3 w-full">
      <input type="range" min={(c.min ?? 0) / factor} max={(c.max ?? 100) / factor} step={(c.paso ?? 1) / factor} value={mostrar}
        onChange={(e) => onCambio(Number(e.target.value) * factor)} aria-label={c.nombre}
        className="flex-1 min-w-0 accent-[var(--primary)]" />
      <div className="flex items-center gap-1 shrink-0">
        <input type="number" min={(c.min ?? 0) / factor} max={(c.max ?? 100) / factor} step={(c.paso ?? 1) / factor} value={mostrar}
          onChange={(e) => onCambio(Number(e.target.value) * factor)} aria-label={`${c.nombre} (número)`}
          className={`${caja} w-20 text-right tabular-nums`} />
        <span className="text-[0.75rem] text-slate-400 w-10">{esMs ? 's' : c.unidad ?? ''}</span>
      </div>
    </div>
  );
};

/**
 * Plataforma → Lalan: los ajustes GLOBALES de la pantalla de Lalan (todos los
 * salones). Cada teléfono puede elegir su pausa, su voz y si sigue
 * escuchando; aquí se pone lo que vale por defecto y lo que solo decide
 * Lalan (pausas exactas, sensibilidad, fondo, modelo de IA, topes de costo).
 */
export const AjustesLalanPlataforma: React.FC = () => {
  const [cat, setCat] = useState<Catalogo | null>(null);
  const [borrador, setBorrador] = useState<Record<string, Valor>>({});
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');

  const tomar = (c: Catalogo) => { setCat(c); setBorrador(c.valores); };
  const cargar = useCallback(async () => {
    try { tomar(await api.get<Catalogo>('/asistente/ajustes/catalogo')); } catch (e) { setAviso((e as Error).message); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  const cambiados = useMemo(() => (cat ? cat.campos.filter((c) => borrador[c.id] !== cat.valores[c.id]).length : 0), [cat, borrador]);

  const guardar = async () => {
    setGuardando(true); setAviso('');
    try {
      tomar(await api.put<Catalogo>('/asistente/ajustes', { valores: borrador }));
      await cargarAjustesLalan();
      setAviso('Guardado. Los teléfonos lo toman la próxima vez que abran a Lalan.');
    } catch (e) { setAviso((e as Error).message); } finally { setGuardando(false); }
  };

  const restaurar = async () => {
    setGuardando(true); setAviso('');
    try {
      tomar(await api.delete<Catalogo>('/asistente/ajustes'));
      await cargarAjustesLalan();
      setAviso('Listo: todo volvió a lo recomendado.');
    } catch (e) { setAviso((e as Error).message); } finally { setGuardando(false); }
  };

  if (!cat) {
    return <div className="flex items-center gap-2 text-[0.8125rem] text-slate-400 p-4">{aviso || <><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</>}</div>;
  }

  return (
    <div className="space-y-4 text-slate-900 dark:text-neutral-100 dark:[color-scheme:dark]">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <p className="text-[0.8125rem] text-slate-500 dark:text-neutral-400 max-w-xl">
          Ajustes de la pantalla de Lalan para <b>todos los salones</b>. Cada teléfono puede cambiar su pausa, su voz y si sigue escuchando; esto es lo que vale si no ha elegido.
        </p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={abrirLalan} className="px-3 py-2 rounded-xl text-[0.8125rem] font-semibold text-[var(--primary)] bg-[var(--primary)]/10 cursor-pointer">Probar</button>
          <button type="button" onClick={() => void restaurar()} disabled={guardando}
            className="px-3 py-2 rounded-xl text-[0.8125rem] font-semibold text-slate-600 dark:text-neutral-300 bg-slate-100 dark:bg-neutral-800 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer">
            <RotateCcw className="w-4 h-4" /> Lo recomendado
          </button>
          <button type="button" onClick={() => void guardar()} disabled={guardando || !cambiados}
            className="px-4 py-2 rounded-xl text-[0.8125rem] font-bold text-white bg-[var(--primary)] flex items-center gap-1.5 disabled:opacity-40 cursor-pointer">
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar{cambiados ? ` (${cambiados})` : ''}
          </button>
        </div>
      </div>
      {aviso && <p className="text-[0.8125rem] font-semibold text-slate-600 dark:text-neutral-300" role="status">{aviso}</p>}

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        {cat.grupos.map((g) => (
          <section key={g.id} className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">{g.nombre}</h3>
            {cat.campos.filter((c) => c.grupo === g.id).map((c) => {
              const v = borrador[c.id] ?? c.porDefecto;
              const distinto = v !== cat.porDefecto[c.id];
              return (
                <div key={c.id} className="space-y-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[0.875rem] font-semibold">{c.nombre}</div>
                      <div className="text-[0.75rem] text-slate-500 dark:text-neutral-400">{c.descripcion}</div>
                    </div>
                    {c.tipo === 'si_no' && <Control c={c} v={v} onCambio={(x) => setBorrador((b) => ({ ...b, [c.id]: x }))} />}
                  </div>
                  {c.tipo !== 'si_no' && <Control c={c} v={v} onCambio={(x) => setBorrador((b) => ({ ...b, [c.id]: x }))} />}
                  {distinto && (
                    <button type="button" onClick={() => setBorrador((b) => ({ ...b, [c.id]: cat.porDefecto[c.id] }))}
                      className="text-[0.6875rem] font-semibold text-[var(--primary)] cursor-pointer">
                      Recomendado: {legible(c, cat.porDefecto[c.id])} · usar
                    </button>
                  )}
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
};
