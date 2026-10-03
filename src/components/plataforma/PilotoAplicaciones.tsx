import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageCircle, MapPin, Users, Sparkles, Loader2, Inbox, Smartphone, Monitor, Tablet } from 'lucide-react';
import { api } from '../../services/api';
import type { AplicacionPiloto, CatalogosPiloto, EstadoAplicacion, Opcion } from '../../types/plataforma';
import type { PrellenadoNegocio } from './NegociosPlataforma';

const COLOR_ESTADO: Record<EstadoAplicacion, string> = {
  nueva: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  contactada: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  aceptada: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  descartada: 'bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400',
};

const nombreDe = (lista: Opcion[], id: string | null) => (id ? lista.find((o) => o.id === id)?.descripcion ?? id : null);

/** 18095551234 → 809-555-1234 */
function telefonoBonito(t: string): string {
  const d = t.startsWith('1') && t.length === 11 ? t.slice(1) : t;
  return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : `+${t}`;
}

/** Fecha con hora de 12 horas: "27 sep, 3:15 p. m." */
const cuando = (iso: string) =>
  new Date(iso).toLocaleString('es-DO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });

const Fila: React.FC<{
  a: AplicacionPiloto; estados: Opcion[]; cat: CatalogosPiloto;
  onCambio: (id: string, cambio: Partial<Pick<AplicacionPiloto, 'estado' | 'notas'>>) => Promise<void>;
  onCrearSalon?: (p: PrellenadoNegocio) => void;
}> = ({ a, estados, cat, onCambio, onCrearSalon }) => {
  const [notas, setNotas] = useState(a.notas ?? '');
  const primerNombre = a.nombre.split(' ')[0];
  const saludo = `Hola ${primerNombre}, te escribo de Lalan AI por tu aplicación al piloto para ${a.salon}.`;
  const Aparato = a.dispositivo === 'movil' ? Smartphone : a.dispositivo === 'tableta' ? Tablet : Monitor;
  const datos = [
    a.ciudad && { i: MapPin, t: a.ciudad },
    a.tamanoEquipo && { i: Users, t: nombreDe(cat.tamanosEquipo, a.tamanoEquipo) },
    a.servicios.length > 0 && { i: Sparkles, t: a.servicios.map((s) => nombreDe(cat.servicios, s)).join(', ') },
  ].filter(Boolean) as { i: React.FC<{ className?: string }>; t: string }[];

  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs space-y-3 text-slate-900 dark:text-neutral-100 dark:[color-scheme:dark]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[1rem] font-extrabold text-slate-900 dark:text-white truncate">{a.salon}</div>
          <div className="text-[0.8125rem] text-slate-500 dark:text-neutral-400">{a.nombre} · {cuando(a.creadoEn)}</div>
        </div>
        <select value={a.estado} onChange={(e) => void onCambio(a.id, { estado: e.target.value as EstadoAplicacion })}
          className={`text-[0.75rem] font-bold rounded-full px-3 py-1.5 border-0 cursor-pointer ${COLOR_ESTADO[a.estado]}`} aria-label="Estado">
          {estados.map((e) => <option key={e.id} value={e.id}>{e.descripcion}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[0.8125rem] text-slate-600 dark:text-neutral-300">
        {datos.map((d, i) => <span key={i} className="flex items-center gap-1"><d.i className="w-3.5 h-3.5 text-slate-400" />{d.t}</span>)}
        {a.planInteres && <span className="font-semibold text-[var(--primary)]">{nombreDe(cat.planes, a.planInteres)}</span>}
      </div>
      {a.mensaje && <p className="text-[0.8125rem] text-slate-700 dark:text-neutral-200 bg-slate-50 dark:bg-neutral-800/60 rounded-xl p-2.5">“{a.mensaje}”</p>}
      <div className="text-[0.75rem] text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
        {a.comoNosConocio && <span>Nos conoció por: {nombreDe(cat.comoNosConocio, a.comoNosConocio)}</span>}
        {a.fuente && <span>Llegó desde: {a.fuente}</span>}
        {a.dispositivo && <span className="flex items-center gap-1"><Aparato className="w-3 h-3" />{a.pais ?? ''}</span>}
      </div>

      <textarea value={notas} onChange={(e) => setNotas(e.target.value)} onBlur={() => notas !== (a.notas ?? '') && void onCambio(a.id, { notas })}
        rows={2} placeholder="Tus notas (se guardan al salir del campo)"
        className="w-full text-[0.8125rem] rounded-xl px-3 py-2 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />

      <a href={`https://wa.me/${a.telefono}?text=${encodeURIComponent(saludo)}`} target="_blank" rel="noopener"
        onClick={() => { if (a.estado === 'nueva') void onCambio(a.id, { estado: 'contactada' }); }}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 text-white text-[0.8125rem] font-bold hover:bg-emerald-700">
        <MessageCircle className="w-4 h-4" /> Escribirle · {telefonoBonito(a.telefono)}
      </a>
      {onCrearSalon && a.estado !== 'descartada' && (
        <button type="button" onClick={() => onCrearSalon({ aplicacionId: a.id, salon: a.salon, nombre: a.nombre, telefono: a.telefono, ciudad: a.ciudad ?? undefined, planClave: a.planInteres })}
          className="ml-2 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[var(--primary)] text-white text-[0.8125rem] font-bold cursor-pointer">
          Crear su salón
        </button>
      )}
    </div>
  );
};

/** El libro de aplicaciones al piloto gratis */
export const PilotoAplicaciones: React.FC<{ onCrearSalon?: (p: PrellenadoNegocio) => void }> = ({ onCrearSalon }) => {
  const [lista, setLista] = useState<AplicacionPiloto[] | null>(null);
  const [estados, setEstados] = useState<Opcion[]>([]);
  const [cat, setCat] = useState<CatalogosPiloto>({ tiposNegocio: [], queAutomatizar: [], tamanosEquipo: [], servicios: [], planes: [], comoNosConocio: [] });
  const [filtro, setFiltro] = useState<EstadoAplicacion | 'todas'>('todas');
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [l, e, c] = await Promise.all([
        api.get<AplicacionPiloto[]>('/plataforma/landing/aplicaciones'),
        api.get<Opcion[]>('/plataforma/landing/aplicaciones/estados'),
        api.get<CatalogosPiloto>('/public/landing/formulario'),
      ]);
      setLista(l); setEstados(e); setCat(c); setError(null);
    } catch (err) { setError((err as Error).message || 'No se pudo cargar'); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  const cambiar = useCallback(async (id: string, cambio: Partial<Pick<AplicacionPiloto, 'estado' | 'notas'>>) => {
    setLista((l) => l?.map((a) => (a.id === id ? { ...a, ...cambio } : a)) ?? l);
    try { await api.patch(`/plataforma/landing/aplicaciones/${id}`, cambio); }
    catch { void cargar(); }
  }, [cargar]);

  const conteo = useMemo(() => {
    const c: Record<string, number> = { todas: lista?.length ?? 0 };
    lista?.forEach((a) => { c[a.estado] = (c[a.estado] ?? 0) + 1; });
    return c;
  }, [lista]);

  if (error) return <p className="text-xs text-red-600">{error}</p>;
  if (!lista) return <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando aplicaciones…</div>;

  const visibles = filtro === 'todas' ? lista : lista.filter((a) => a.estado === filtro);
  const filtros: { id: EstadoAplicacion | 'todas'; label: string }[] = [{ id: 'todas', label: 'Todas' }, ...estados.map((e) => ({ id: e.id as EstadoAplicacion, label: e.descripcion }))];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {filtros.map((f) => (
          <button key={f.id} onClick={() => setFiltro(f.id)}
            className={`px-3 py-1.5 rounded-full text-[0.8125rem] font-semibold border cursor-pointer ${filtro === f.id ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300'}`}>
            {f.label} <span className="opacity-70 tabular-nums">{conteo[f.id] ?? 0}</span>
          </button>
        ))}
      </div>
      {visibles.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Inbox className="w-8 h-8 mx-auto mb-2" />
          <p className="text-[0.875rem]">{lista.length === 0 ? 'Todavía nadie ha aplicado. Comparte la landing en Instagram y WhatsApp.' : 'No hay aplicaciones en este estado.'}</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-3">
          {visibles.map((a) => <Fila key={a.id} a={a} estados={estados} cat={cat} onCambio={cambiar} onCrearSalon={onCrearSalon} />)}
        </div>
      )}
    </div>
  );
};
