import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, MessageCircle, Store } from 'lucide-react';
import { api } from '../../services/api';
import type { CatalogosPiloto, EstadoAplicacion, Opcion, OtroNegocio, ResumenOtrosNegocios } from '../../types/plataforma';

const COLOR_ESTADO: Record<EstadoAplicacion, string> = {
  nueva: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  contactada: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  aceptada: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  descartada: 'bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400',
};
const nombreDe = (lista: Opcion[], id: string) => lista.find((o) => o.id === id)?.descripcion ?? id;

/**
 * «No tengo salón»: quién pidió una asistente para otro tipo de negocio.
 * Arriba, qué negocio pide más (para decidir el siguiente producto con datos).
 */
export const OtrosNegocios: React.FC = () => {
  const [datos, setDatos] = useState<ResumenOtrosNegocios | null>(null);
  const [estados, setEstados] = useState<Opcion[]>([]);
  const [cat, setCat] = useState<CatalogosPiloto | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const [d, e, c] = await Promise.all([
        api.get<ResumenOtrosNegocios>('/plataforma/landing/otros-negocios'),
        api.get<Opcion[]>('/plataforma/landing/aplicaciones/estados'),
        api.get<CatalogosPiloto>('/public/landing/formulario'),
      ]);
      setDatos(d); setEstados(e); setCat(c); setError('');
    } catch (err) {
      setError((err as Error)?.message || 'No se pudo cargar');
    }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  const cambiar = async (o: OtroNegocio, cambios: { estado?: EstadoAplicacion; notas?: string }) => {
    await api.patch(`/plataforma/landing/otros-negocios/${o.id}`, cambios).catch(() => undefined);
    void cargar();
  };

  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!datos || !cat) return <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>;

  const maximo = Math.max(1, ...datos.porTipo.map((t) => t.total));
  return (
    <section className="space-y-4 text-slate-900 dark:text-neutral-100 dark:[color-scheme:dark]">
      <header>
        <h3 className="text-base font-bold flex items-center gap-2"><Store className="w-4 h-4" /> Otros negocios que quieren una asistente</h3>
        <p className="text-xs text-slate-500 dark:text-neutral-400">Los que llenaron «No tengo salón» en la landing. El que más pida es el siguiente producto.</p>
      </header>

      <div className="rounded-2xl border border-slate-200 dark:border-neutral-800 p-4 space-y-2">
        {datos.porTipo.map((t) => (
          <div key={t.id} className="grid grid-cols-[minmax(0,12rem)_1fr_2.5rem] items-center gap-3 text-xs">
            <span className="truncate">{t.descripcion}</span>
            <span className="h-2.5 rounded-full bg-slate-100 dark:bg-neutral-800 overflow-hidden">
              <span className="block h-full rounded-full bg-[var(--primary)]" style={{ width: `${(t.total / maximo) * 100}%` }} />
            </span>
            <b className="text-right tabular-nums">{t.total}</b>
          </div>
        ))}
      </div>

      {datos.lista.length === 0 ? (
        <p className="text-sm text-slate-500">Todavía nadie ha llenado el formulario.</p>
      ) : (
        <ul className="space-y-2">
          {datos.lista.map((o) => (
            <li key={o.id} className="rounded-2xl border border-slate-200 dark:border-neutral-800 p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <b className="text-sm">{nombreDe(cat.tiposNegocio, o.tipoNegocio)}</b>
                {o.negocio && <span className="text-xs text-slate-500">· {o.negocio}</span>}
                {o.nombre && <span className="text-xs text-slate-500">· {o.nombre}</span>}
                <span className={`ml-auto px-2 py-0.5 rounded-full text-[0.6875rem] font-bold ${COLOR_ESTADO[o.estado]}`}>{nombreDe(estados, o.estado)}</span>
              </div>
              {o.queAutomatizar.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {o.queAutomatizar.map((q) => <span key={q} className="px-2 py-0.5 rounded-full text-[0.6875rem] bg-slate-100 dark:bg-neutral-800">{nombreDe(cat.queAutomatizar, q)}</span>)}
                </div>
              )}
              {o.detalle && <p className="text-xs text-slate-600 dark:text-neutral-300">{o.detalle}</p>}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <a href={`https://wa.me/${o.telefono}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-600 text-white font-bold">
                  <MessageCircle className="w-3.5 h-3.5" /> {o.telefono}
                </a>
                <span className="text-slate-400">{new Date(o.creadoEn).toLocaleDateString('es', { day: 'numeric', month: 'short' })}{o.fuente ? ` · ${o.fuente}` : ''}</span>
                <select
                  value={o.estado}
                  onChange={(e) => void cambiar(o, { estado: e.target.value as EstadoAplicacion })}
                  className="ml-auto px-2 py-1 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                  aria-label="Estado"
                >
                  {estados.map((e) => <option key={e.id} value={e.id}>{e.descripcion}</option>)}
                </select>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
