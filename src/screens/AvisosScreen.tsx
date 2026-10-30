import React, { useCallback, useEffect, useState } from 'react';
import { CheckCheck, Loader2 } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useSedeActiva } from '../context/SedeActivaContext';
import { IOSHeader } from '../components/ui/IOSHeader';
import { PageContent } from '../components/ui/PageContent';
import { FilaAviso } from '../components/avisos/FilaAviso';
import { Paginas } from '../components/avisos/Paginas';
import { avisarCambioDeAvisos } from '../components/avisos/CampanaAvisos';
import { alRecibir } from '../services/socket';
import { avisosApi, EVENTO_AVISOS, irA, porDia, type Aviso, type PaginaAvisos } from '../services/avisos';

/**
 * Todos los avisos (los últimos 90 días), por páginas: sin leer o todos, y
 * por grupo (Chats, Agenda, Compras…). Cada uno con su botón para resolverlo.
 */
export const AvisosScreen: React.FC = () => {
  const { goBack, showToast } = useApp();
  const { varias } = useSedeActiva();
  const [estado, setEstado] = useState<'sin_leer' | 'todas'>('todas');
  const [grupo, setGrupo] = useState('');
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<PaginaAvisos | null>(null);
  const [cargando, setCargando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try { setDatos(await avisosApi.lista({ estado, grupo: grupo || undefined, pagina })); }
    catch (e) { showToast('No se pudieron cargar los avisos', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
    finally { setCargando(false); }
  }, [estado, grupo, pagina, showToast]);

  useEffect(() => { void cargar(); }, [cargar]);
  useEffect(() => {
    const otra = () => void cargar();
    window.addEventListener(EVENTO_AVISOS, otra);
    const fuera = alRecibir('avisos:nuevo', otra);
    return () => { window.removeEventListener(EVENTO_AVISOS, otra); fuera(); };
  }, [cargar]);

  const leer = async (a: Aviso) => {
    setDatos(d => d && { ...d, sinLeer: Math.max(0, d.sinLeer - 1), items: d.items.map(x => (x.id === a.id ? { ...x, leida: true } : x)) });
    try { await avisosApi.leer(a.id); avisarCambioDeAvisos(); } catch { /* se vuelve a cargar solo */ }
  };
  const abrir = (a: Aviso) => { if (!a.leida) void leer(a); irA(a); };
  const leerTodas = async () => {
    try {
      const r = await avisosApi.leerTodas(grupo || undefined);
      avisarCambioDeAvisos();
      showToast('Listo', r.marcadas === 1 ? 'Marcaste 1 aviso como leído.' : `Marcaste ${r.marcadas} avisos como leídos.`, 'success');
      void cargar();
    } catch (e) { showToast('No se pudo marcar', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
  };

  const cambiar = (f: () => void) => { f(); setPagina(1); };
  const sinLeerDelGrupo = grupo ? (datos?.grupos.find(g => g.id === grupo)?.sinLeer ?? 0) : (datos?.sinLeer ?? 0);
  const chip = (activo: boolean) => `min-h-[36px] px-3 rounded-full text-[0.75rem] font-bold whitespace-nowrap cursor-pointer transition ${activo ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-white border border-slate-200 text-slate-700 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-300'}`;

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-neutral-950">
      <IOSHeader title="Avisos" subtitle="Lo que Lalan te avisó en los últimos 90 días" showBack onBack={goBack} />
      <PageContent>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex gap-1.5" role="tablist" aria-label="Qué avisos ver">
            <button type="button" role="tab" aria-selected={estado === 'todas'} onClick={() => cambiar(() => setEstado('todas'))} className={chip(estado === 'todas')}>Todas</button>
            <button type="button" role="tab" aria-selected={estado === 'sin_leer'} onClick={() => cambiar(() => setEstado('sin_leer'))} className={chip(estado === 'sin_leer')}>
              Sin leer{datos?.sinLeer ? ` · ${datos.sinLeer}` : ''}
            </button>
          </div>
          <button type="button" onClick={leerTodas} disabled={!sinLeerDelGrupo}
            className="min-h-[36px] px-3 rounded-full flex items-center gap-1.5 text-[0.75rem] font-bold text-[var(--primary)] disabled:text-slate-400 cursor-pointer disabled:cursor-default">
            <CheckCheck className="w-4 h-4" /> {grupo ? 'Marcar estas como leídas' : 'Marcar todas como leídas'}
          </button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto hide-scrollbar pb-1 mb-3">
          <button type="button" onClick={() => cambiar(() => setGrupo(''))} className={chip(grupo === '')}>Todo</button>
          {(datos?.grupos ?? []).map(g => (
            <button key={g.id} type="button" onClick={() => cambiar(() => setGrupo(g.id))} className={chip(grupo === g.id)}>
              {g.nombre}{g.sinLeer ? ` · ${g.sinLeer}` : ''}
            </button>
          ))}
        </div>

        <section aria-label="Lista de avisos" className="rounded-3xl border border-slate-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden mb-6">
          {!datos ? (
            <div className="flex items-center justify-center gap-2 py-12 text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>
          ) : datos.items.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-sm font-bold text-slate-800 dark:text-neutral-100">{estado === 'sin_leer' ? 'Estás al día' : 'No hay avisos aquí'}</p>
              <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 mt-1">Cuando Lalan necesite algo de ti, aparece aquí y en la campana.</p>
            </div>
          ) : (
            <div className={cargando ? 'opacity-60 transition' : 'transition'}>
              {porDia(datos.items, x => x.creadoEn).map(g => (
                <div key={g.dia}>
                  <div className="px-4 pt-3 pb-1 text-[0.6875rem] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">{g.dia}</div>
                  <div className="divide-y divide-slate-100 dark:divide-neutral-800/70">
                    {g.items.map(a => <FilaAviso key={a.id} aviso={a} onAbrir={abrir} onLeer={leer} conSede={varias} />)}
                  </div>
                </div>
              ))}
              <Paginas pagina={datos.pagina} paginas={datos.paginas} total={datos.total} porPagina={datos.porPagina} onIr={setPagina} />
            </div>
          )}
        </section>
      </PageContent>
    </div>
  );
};
