import React, { useCallback, useEffect, useState } from 'react';
import { CalendarDays, ChevronRight, Loader2, LogIn, MapPin, MessageSquareText, Settings2, ShieldAlert, ShoppingCart, Tag, UserRound, Wallet } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useSedes } from '../hooks/useSedes';
import { IOSHeader } from '../components/ui/IOSHeader';
import { PageContent } from '../components/ui/PageContent';
import { SelectorSede } from '../components/ui/SelectorSede';
import { Paginas } from '../components/avisos/Paginas';
import { actividadApi, irA, porDia, type FilaActividad, type GrupoActividad, type PaginaActividad } from '../services/avisos';

const ICONO: Record<GrupoActividad, { icono: React.ElementType; color: string }> = {
  entradas: { icono: LogIn,             color: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300' },
  agenda:   { icono: CalendarDays,      color: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300' },
  caja:     { icono: Wallet,            color: 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300' },
  clientas: { icono: UserRound,         color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' },
  chats:    { icono: MessageSquareText, color: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' },
  catalogo: { icono: Tag,               color: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' },
  compras:  { icono: ShoppingCart,      color: 'bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300' },
  ajustes:  { icono: Settings2,         color: 'bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-300' },
};

const PERIODOS = [
  { dias: 1, nombre: 'Hoy' },
  { dias: 7, nombre: 'Últimos 7 días' },
  { dias: 30, nombre: 'Últimos 30 días' },
  { dias: 90, nombre: 'Últimos 90 días' },
];

const hora = (iso: string) => new Date(iso).toLocaleTimeString('es', { hour: 'numeric', minute: '2-digit' });

/**
 * Mi actividad: lo que hice en Lalan (entradas, cobros, citas, cambios), con
 * la hora, la sede y el dato concreto. La dueña puede mirar a cualquiera de
 * su equipo o a todo el equipo (decidido por Luis, 2026-10-30).
 */
export const MiActividadScreen: React.FC = () => {
  const { goBack, navigateTo, showToast } = useApp();
  const { currentUser } = useAuth();
  const sedes = useSedes();
  const [persona, setPersona] = useState('yo');
  const [sede, setSede] = useState('');
  const [dias, setDias] = useState(7);
  const [grupo, setGrupo] = useState('');
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<PaginaActividad | null>(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try { setDatos(await actividadApi.lista({ persona, sede: sede || undefined, dias, grupo: grupo || undefined, pagina })); }
    catch (e) { showToast('No se pudo cargar la actividad', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
    finally { setCargando(false); }
  }, [persona, sede, dias, grupo, pagina, showToast]);
  useEffect(() => { void cargar(); }, [cargar]);

  const cambiar = (f: () => void) => { f(); setPagina(1); };
  const mia = persona === 'yo';
  const esDireccion = (datos?.personas.length ?? 0) > 0;
  const nombreDe = persona === 'todas' ? 'tu equipo' : datos?.personas.find(p => p.id === persona)?.nombre;
  const chip = (activo: boolean) => `min-h-[36px] px-3 rounded-full text-[0.75rem] font-bold whitespace-nowrap cursor-pointer transition ${activo ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white border border-slate-200 text-slate-700 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-300'}`;
  const selectCls = 'min-h-[36px] px-3 rounded-full text-[0.75rem] font-semibold bg-white border border-slate-200 dark:bg-neutral-900 dark:border-neutral-700 text-slate-700 dark:text-neutral-200';
  const misSesiones = () => { try { sessionStorage.setItem('lalan_ajustes_seccion', 'cuenta'); } catch { /* nada */ } navigateTo('settings'); };

  const fila = (f: FilaActividad) => {
    const g = ICONO[f.grupo] ?? ICONO.ajustes;
    const Icono = g.icono;
    const contenido = (
      <>
        <span className="w-14 shrink-0 text-[0.75rem] text-slate-500 dark:text-neutral-400 pt-2">{hora(f.cuando)}</span>
        <span className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${g.color}`} aria-hidden="true"><Icono className="w-4 h-4" /></span>
        <span className="flex-1 min-w-0">
          <span className="block text-[0.8125rem] font-semibold text-slate-900 dark:text-white">{f.frase}</span>
          {(f.detalle || (f.sede?.nombre && sedes.length > 1) || f.soporte) && (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.75rem] text-slate-500 dark:text-neutral-400 mt-0.5">
              {f.detalle && <span>{f.detalle}</span>}
              {f.sede?.nombre && sedes.length > 1 && <span className="inline-flex items-center gap-0.5"><MapPin className="w-3 h-3" aria-hidden="true" />{f.sede.nombre}</span>}
              {f.soporte && <span className="px-1.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 text-[0.6875rem] font-bold">Soporte de Lalan</span>}
            </span>
          )}
        </span>
      </>
    );
    // Lo que se puede abrir (la cita, la ficha, el chat) lleva a resolverlo ahí mismo
    const abre = !!(f.aviso || f.conversacion) || f.grupo !== 'entradas';
    return abre ? (
      <button key={f.id} type="button" onClick={() => irA(f)} className="w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-neutral-800/50 cursor-pointer">
        {contenido}
        <ChevronRight className="w-4 h-4 text-slate-400 mt-2 shrink-0" aria-hidden="true" />
      </button>
    ) : <div key={f.id} className="flex items-start gap-3 px-4 py-3">{contenido}</div>;
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-neutral-950">
      <IOSHeader
        title="Mi actividad"
        subtitle={mia ? 'Todo lo que hiciste en Lalan, con la hora y la sede' : `Lo que hizo ${nombreDe ?? '…'} en Lalan`}
        showBack
        onBack={goBack}
      />
      <PageContent>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {esDireccion && (
            <select value={persona} onChange={e => cambiar(() => setPersona(e.target.value))} aria-label="De quién" className={selectCls}>
              <option value="yo">Yo</option>
              <option value="todas">Todo el equipo</option>
              {datos!.personas.filter(p => p.id !== currentUser?.id).map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          )}
          <select value={dias} onChange={e => cambiar(() => setDias(Number(e.target.value)))} aria-label="Desde cuándo" className={selectCls}>
            {PERIODOS.map(p => <option key={p.dias} value={p.dias}>{p.nombre}</option>)}
          </select>
          <SelectorSede sedes={sedes} value={sede} onChange={s => cambiar(() => setSede(s))} todas className="min-h-[36px] px-3" />
        </div>

        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar pb-1 mb-3">
          <button type="button" onClick={() => cambiar(() => setGrupo(''))} className={chip(grupo === '')}>Todo</button>
          {(datos?.grupos ?? []).map(g => (
            <button key={g.id} type="button" onClick={() => cambiar(() => setGrupo(g.id))} className={chip(grupo === g.id)}>{g.nombre}</button>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <section aria-label="Lista de actividad" className="flex-1 min-w-0 rounded-3xl border border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
            {!datos ? (
              <div className="flex items-center justify-center gap-2 py-12 text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>
            ) : datos.items.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-sm font-bold text-slate-800 dark:text-neutral-100">Nada en este tiempo</p>
                <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 mt-1">Prueba con más días o con «Todo».</p>
              </div>
            ) : (
              <div className={cargando ? 'opacity-60 transition' : 'transition'}>
                {porDia(datos.items, x => x.cuando).map(g => (
                  <div key={g.dia}>
                    <div className="px-4 pt-3 pb-1 text-[0.6875rem] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">{g.dia}</div>
                    <div className="divide-y divide-slate-100 dark:divide-neutral-800/70">{g.items.map(fila)}</div>
                  </div>
                ))}
                <Paginas pagina={datos.pagina} paginas={datos.paginas} total={datos.total} porPagina={datos.porPagina} onIr={setPagina} />
              </div>
            )}
          </section>

          <aside className="lg:w-72 shrink-0 flex flex-col gap-3">
            {datos && (
              <div className="rounded-3xl border border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">{PERIODOS.find(p => p.dias === dias)?.nombre}</h2>
                <div className="grid grid-cols-2 gap-3 mt-3">
                  {datos.resumen.filter(r => r.cuantas > 0).map(r => (
                    <button key={r.id} type="button" onClick={() => cambiar(() => setGrupo(r.id))} className="text-left cursor-pointer rounded-xl hover:bg-slate-50 dark:hover:bg-neutral-800/60 p-1 -m-1">
                      <span className="block text-xl font-extrabold text-slate-900 dark:text-white">{r.cuantas}</span>
                      <span className="block text-[0.75rem] text-slate-500 dark:text-neutral-400">{r.nombre}</span>
                    </button>
                  ))}
                  {datos.resumen.every(r => r.cuantas === 0) && <p className="col-span-2 text-[0.75rem] text-slate-500">Sin movimientos.</p>}
                </div>
              </div>
            )}
            {mia && (
              <div className="rounded-3xl border border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/40 p-4">
                <h2 className="text-sm font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5"><ShieldAlert className="w-4 h-4" /> ¿Algo que no hiciste tú?</h2>
                <p className="text-[0.75rem] text-amber-900/80 dark:text-amber-200/80 mt-1">Mira dónde está abierta tu sesión, cierra las que no reconozcas y cambia tu contraseña.</p>
                <button type="button" onClick={misSesiones} className="mt-2 min-h-[36px] text-[0.75rem] font-bold text-amber-900 dark:text-amber-200 underline cursor-pointer">Ver mis sesiones</button>
              </div>
            )}
          </aside>
        </div>
      </PageContent>
    </div>
  );
};
