import React, { useCallback, useEffect, useState } from 'react';
import { Activity, CheckCircle2, AlertTriangle, XCircle, CircleDashed, Loader2, RefreshCw } from 'lucide-react';
import { api } from '../../services/api';
import { horaDe } from '../../utils/hora';
import { TodosLosCanales } from './TodosLosCanales';

type Estado = 'ok' | 'aviso' | 'caido' | 'sin_configurar';
interface Servicio { id: string; nombre: string; descripcion: string; estado: Estado; detalle: string; ms: number | null; revisadoEn: string | null; enlaces?: { negocioId: string; texto: string }[] }
interface Evento { id: string; creadoEn: string; servicio: string; estado: Estado; detalle: string | null }
interface Salud { servicios: Servicio[]; historial: Evento[] }

const VISTA: Record<Estado, { texto: string; icono: React.FC<{ className?: string }>; clase: string; borde: string }> = {
  ok: { texto: 'Bien', icono: CheckCircle2, clase: 'text-emerald-600 dark:text-emerald-400', borde: 'border-emerald-200 dark:border-emerald-900/60' },
  aviso: { texto: 'Atención', icono: AlertTriangle, clase: 'text-amber-600 dark:text-amber-400', borde: 'border-amber-300 dark:border-amber-800' },
  caido: { texto: 'Caído', icono: XCircle, clase: 'text-rose-600 dark:text-rose-400', borde: 'border-rose-300 dark:border-rose-800' },
  sin_configurar: { texto: 'Sin configurar', icono: CircleDashed, clase: 'text-slate-400', borde: 'border-slate-200 dark:border-neutral-800' },
};
const ORDEN: Record<Estado, number> = { caido: 0, aviso: 1, sin_configurar: 2, ok: 3 };
const REFRESCO_MS = 60_000;

/** La salud de todo lo que Lalan necesita: lo roto primero */
export const SaludServicios: React.FC<{ onAbrirNegocio?: (id: string) => void }> = ({ onAbrirNegocio }) => {
  const [datos, setDatos] = useState<Salud | null>(null);
  const [revisando, setRevisando] = useState(false);
  const [error, setError] = useState('');
  const [verCanales, setVerCanales] = useState(false);

  const cargar = useCallback(() => {
    api.get<Salud>('/plataforma/salud').then(d => { setDatos(d); setError(''); }).catch(e => setError(e?.message || 'No se pudo cargar'));
  }, []);
  useEffect(() => { cargar(); const t = setInterval(cargar, REFRESCO_MS); return () => clearInterval(t); }, [cargar]);

  const revisarAhora = async () => {
    setRevisando(true);
    try { setDatos(await api.post<Salud>('/plataforma/salud/revisar', {})); } catch (e) { setError((e as Error)?.message || 'No se pudo revisar'); }
    finally { setRevisando(false); }
  };

  if (error && !datos) return <p className="text-sm text-rose-600">{error}</p>;
  if (!datos) return <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Revisando servicios…</div>;

  const servicios = [...datos.servicios].sort((a, b) => ORDEN[a.estado] - ORDEN[b.estado]);
  const caidos = servicios.filter(s => s.estado === 'caido').length;
  const avisos = servicios.filter(s => s.estado === 'aviso').length;
  const nombre = (id: string) => datos.servicios.find(s => s.id === id)?.nombre ?? id;
  const resumen = caidos ? `${caidos} ${caidos === 1 ? 'servicio caído' : 'servicios caídos'}` : avisos ? `${avisos} ${avisos === 1 ? 'cosa que mirar' : 'cosas que mirar'}` : 'Todo funcionando';

  return (
    <section className="space-y-4 text-slate-900 dark:text-neutral-100 dark:[color-scheme:dark]">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold flex items-center gap-2"><Activity className="w-4 h-4" /> Salud de los servicios</h3>
          <p className={`text-sm font-bold ${caidos ? 'text-rose-600' : avisos ? 'text-amber-600' : 'text-emerald-600'}`}>{resumen}</p>
          <p className="text-[0.75rem] text-slate-500">Se revisa sola cada 5 minutos. Si algo se cae o vuelve, te llega un correo.</p>
        </div>
        <button type="button" onClick={() => void revisarAhora()} disabled={revisando}
          className="px-3 py-2 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer">
          <RefreshCw className={`w-3.5 h-3.5 ${revisando ? 'animate-spin' : ''}`} /> {revisando ? 'Revisando…' : 'Revisar ahora'}
        </button>
      </header>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {servicios.map(s => {
          const v = VISTA[s.estado];
          return (
            <article key={s.id} className={`rounded-2xl border bg-white dark:bg-neutral-900 p-3 space-y-1.5 ${v.borde}`}>
              <div className="flex items-center justify-between gap-2">
                <b className="text-sm">{s.nombre}</b>
                <span className={`flex items-center gap-1 text-[0.75rem] font-bold ${v.clase}`}><v.icono className="w-4 h-4" /> {v.texto}</span>
              </div>
              <p className="text-xs text-slate-700 dark:text-neutral-200">{s.detalle}</p>
              {s.enlaces && s.enlaces.length > 0 && (
                <ul className="space-y-1">
                  {s.enlaces.map((e, i) => (
                    <li key={i}>
                      <button type="button" onClick={() => onAbrirNegocio?.(e.negocioId)} className="text-left text-[0.75rem] font-semibold text-[var(--primary)] hover:underline cursor-pointer">{e.texto} →</button>
                    </li>
                  ))}
                </ul>
              )}
              {s.id === 'canales' && s.estado !== 'sin_configurar' && (
                <button type="button" onClick={() => setVerCanales(v => !v)} className="text-[0.75rem] font-bold text-[var(--primary)] hover:underline cursor-pointer" aria-expanded={verCanales}>
                  {verCanales ? 'Ocultar la lista' : 'Ver todos los canales →'}
                </button>
              )}
              <p className="text-[0.6875rem] text-slate-400">{s.descripcion}{s.ms !== null ? ` · ${s.ms} ms` : ''}{s.revisadoEn ? ` · revisado ${horaDe(s.revisadoEn)}` : ''}</p>
            </article>
          );
        })}
      </div>

      {verCanales && <TodosLosCanales onAbrirNegocio={onAbrirNegocio} onCerrar={() => setVerCanales(false)} />}

      {datos.historial.length > 0 && (
        <div className="rounded-2xl border border-slate-200 dark:border-neutral-800 p-3">
          <h4 className="text-xs font-bold mb-2">Últimos cambios</h4>
          <ul className="space-y-1.5">
            {datos.historial.map(h => {
              const v = VISTA[h.estado] ?? VISTA.sin_configurar;
              return (
                <li key={h.id} className="flex items-start gap-2 text-xs">
                  <v.icono className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${v.clase}`} />
                  <span className="flex-1"><b>{nombre(h.servicio)}</b> · {v.texto}{h.detalle ? ` — ${h.detalle}` : ''}</span>
                  <span className="text-[0.6875rem] text-slate-400 whitespace-nowrap">{new Date(h.creadoEn).toLocaleDateString('es', { day: 'numeric', month: 'short' })}, {horaDe(h.creadoEn)}</span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
};
