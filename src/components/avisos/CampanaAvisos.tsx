import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, CheckCheck, ChevronLeft, Loader2, Settings2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { useSedeActiva } from '../../context/SedeActivaContext';
import { alRecibir } from '../../services/socket';
import { avisosApi, EVENTO_AVISOS, irA, porDia, type Aviso } from '../../services/avisos';
import { FilaAviso } from './FilaAviso';

/** Cada cuánto se vuelve a contar, por si el socket se cayó */
const CADA_MS = 60_000;
const EN_LA_CAMPANA = 10;

/** Avisa a las otras campanas (otra pestaña de la misma pantalla) que algo se leyó */
export const avisarCambioDeAvisos = () => window.dispatchEvent(new Event(EVENTO_AVISOS));

/**
 * La campana junto a la foto: el número de avisos sin leer y, al tocarla, los
 * últimos con su botón para resolverlos. En la computadora se abre como un
 * panel; en el teléfono ocupa la pantalla.
 */
export const CampanaAvisos: React.FC = () => {
  const { currentUser } = useAuth();
  const { navigateTo } = useApp();
  const { varias } = useSedeActiva();
  const esEspecialista = currentUser?.role === 'especialista';
  const esDireccion = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const [sinLeer, setSinLeer] = useState(0);
  const [abierta, setAbierta] = useState(false);
  const [estado, setEstado] = useState<'sin_leer' | 'todas'>('sin_leer');
  const [items, setItems] = useState<Aviso[] | null>(null);
  const [pagina, setPagina] = useState(1);
  const [paginas, setPaginas] = useState(1);
  const [cargando, setCargando] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);
  /** Dónde va el panel en la computadora: debajo de la campana, alineado a su derecha */
  const [lugar, setLugar] = useState<{ top: number; right: number }>({ top: 56, right: 16 });

  const contar = useCallback(() => {
    if (document.visibilityState !== 'visible') return;
    avisosApi.sinLeer().then(r => setSinLeer(r.sinLeer)).catch(() => undefined);
  }, []);

  const cargar = useCallback(async (p = 1, e = estado) => {
    setCargando(true);
    try {
      const r = await avisosApi.lista({ estado: e, pagina: p, porPagina: EN_LA_CAMPANA });
      setItems(l => (p === 1 ? r.items : [...(l ?? []), ...r.items]));
      setPagina(r.pagina); setPaginas(r.paginas); setSinLeer(r.sinLeer);
    } catch { setItems(l => l ?? []); }
    finally { setCargando(false); }
  }, [estado]);

  useEffect(() => {
    contar();
    const t = window.setInterval(contar, CADA_MS);
    const alVolver = () => contar();
    document.addEventListener('visibilitychange', alVolver);
    window.addEventListener(EVENTO_AVISOS, alVolver);
    const fuera = alRecibir('avisos:nuevo', () => { contar(); if (abierta) void cargar(1); });
    return () => {
      window.clearInterval(t);
      document.removeEventListener('visibilitychange', alVolver);
      window.removeEventListener(EVENTO_AVISOS, alVolver);
      fuera();
    };
  }, [contar, cargar, abierta]);

  useEffect(() => { if (abierta) void cargar(1, estado); }, [abierta, estado, cargar]);

  // Escape cierra
  useEffect(() => {
    if (!abierta) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') setAbierta(false); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [abierta]);

  const leer = async (a: Aviso) => {
    setItems(l => (estado === 'sin_leer' ? l?.filter(x => x.id !== a.id) : l?.map(x => (x.id === a.id ? { ...x, leida: true } : x))) ?? l);
    setSinLeer(n => Math.max(0, n - 1));
    try { const r = await avisosApi.leer(a.id); setSinLeer(r.sinLeer); avisarCambioDeAvisos(); } catch { /* se recuenta solo */ }
  };

  const abrir = (a: Aviso) => {
    if (!a.leida) void leer(a);
    setAbierta(false);
    irA(a);
  };

  const leerTodas = async () => {
    try {
      await avisosApi.leerTodas();
      setSinLeer(0);
      setItems(l => (estado === 'sin_leer' ? [] : l?.map(x => ({ ...x, leida: true })) ?? l));
      avisarCambioDeAvisos();
    } catch { /* nada: el número sigue como estaba */ }
  };

  const verTodos = () => { setAbierta(false); navigateTo('avisos'); };
  const queRecibo = () => {
    setAbierta(false);
    try { sessionStorage.setItem('lalan_ajustes_seccion', 'equipo'); } catch { /* nada */ }
    navigateTo('settings');
  };

  const numero = sinLeer > 99 ? '99+' : String(sinLeer);
  const grupos = porDia(items ?? [], x => x.creadoEn);

  return (
    <div className="relative">
      <button
        type="button"
        ref={boton}
        onClick={() => {
          const r = boton.current?.getBoundingClientRect();
          if (r) setLugar({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
          setAbierta(v => !v);
        }}
        data-medir="Abrir avisos"
        aria-label={sinLeer ? `Avisos, ${sinLeer} sin leer` : 'Avisos'}
        aria-expanded={abierta}
        title="Avisos"
        className={`relative w-8 h-8 rounded-full flex items-center justify-center transition ios-touch cursor-pointer shadow-2xs ${sinLeer ? 'bg-[var(--primary)]/15 text-[var(--primary)]' : 'bg-slate-100 dark:bg-neutral-800/80 text-slate-600 dark:text-neutral-300 hover:text-[var(--primary)]'}`}
      >
        <Bell className="w-4 h-4" />
        {sinLeer > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[0.625rem] font-bold flex items-center justify-center ring-2 ring-white dark:ring-neutral-950">
            {numero}
          </span>
        )}
      </button>

      {createPortal(<AnimatePresence>
        {abierta && (
          <>
            {/* En la computadora, tocar fuera cierra */}
            <div className="hidden sm:block fixed inset-0 z-[69]" onClick={() => setAbierta(false)} aria-hidden="true" />
            <motion.section
              role="dialog"
              aria-label="Avisos"
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              className="fixed inset-0 z-[70] flex flex-col bg-white dark:bg-neutral-950 sm:inset-auto sm:top-[var(--campana-top)] sm:right-[var(--campana-right)] sm:w-[400px] sm:max-h-[min(70vh,640px)] sm:rounded-2xl sm:border sm:border-slate-200 dark:sm:border-neutral-800 sm:shadow-2xl overflow-hidden"
              style={{ paddingTop: 'env(safe-area-inset-top, 0px)', ['--campana-top' as string]: `${lugar.top}px`, ['--campana-right' as string]: `${lugar.right}px` } as React.CSSProperties}
            >
              <div className="flex items-center justify-between gap-2 px-3 sm:px-4 pt-3 pb-2">
                <div className="flex items-center gap-1 min-w-0">
                  <button type="button" onClick={() => setAbierta(false)} className="sm:hidden w-9 h-9 -ml-1 flex items-center justify-center text-[var(--primary)] cursor-pointer" aria-label="Cerrar avisos">
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">Avisos</h2>
                </div>
                <button
                  type="button"
                  onClick={leerTodas}
                  disabled={!sinLeer}
                  className="min-h-[36px] px-2 flex items-center gap-1 text-[0.75rem] font-bold text-[var(--primary)] disabled:text-slate-400 disabled:cursor-default cursor-pointer"
                >
                  <CheckCheck className="w-4 h-4" /> Marcar todas como leídas
                </button>
              </div>
              <div className="flex gap-1.5 px-3 sm:px-4 pb-2" role="tablist" aria-label="Qué avisos ver">
                {(['sin_leer', 'todas'] as const).map(e => (
                  <button
                    key={e}
                    type="button"
                    role="tab"
                    aria-selected={estado === e}
                    onClick={() => setEstado(e)}
                    className={`min-h-[32px] px-3 rounded-full text-[0.75rem] font-bold cursor-pointer transition ${estado === e ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-300'}`}
                  >
                    {e === 'sin_leer' ? `Sin leer${sinLeer ? ` · ${numero}` : ''}` : 'Todas'}
                  </button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto hide-scrollbar border-t border-slate-100 dark:border-neutral-800">
                {items === null ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>
                ) : items.length === 0 ? (
                  <div className="px-6 py-10 text-center">
                    <p className="text-sm font-bold text-slate-800 dark:text-neutral-100">{estado === 'sin_leer' ? 'Estás al día' : 'Todavía no hay avisos'}</p>
                    <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 mt-1">
                      {estado === 'sin_leer' ? 'Cuando Lalan necesite algo de ti, aparece aquí.' : 'Aquí quedan los avisos de los últimos 90 días.'}
                    </p>
                    {estado === 'sin_leer' && <button type="button" onClick={() => setEstado('todas')} className="mt-3 text-[0.75rem] font-bold text-[var(--primary)] cursor-pointer">Ver los leídos</button>}
                  </div>
                ) : (
                  <>
                    {grupos.map(g => (
                      <div key={g.dia}>
                        <div className="px-4 pt-3 pb-1 text-[0.6875rem] font-bold uppercase tracking-wider text-slate-500 dark:text-neutral-400">{g.dia}</div>
                        <div className="divide-y divide-slate-100 dark:divide-neutral-800/70">
                          {g.items.map(a => <FilaAviso key={a.id} aviso={a} onAbrir={abrir} onLeer={leer} conSede={varias} />)}
                        </div>
                      </div>
                    ))}
                    {pagina < paginas && (
                      <div className="py-3 flex justify-center">
                        <button type="button" onClick={() => cargar(pagina + 1)} disabled={cargando} className="min-h-[40px] px-4 rounded-full border border-slate-200 dark:border-neutral-700 text-[0.75rem] font-bold text-slate-700 dark:text-neutral-200 cursor-pointer flex items-center gap-1.5">
                          {cargando && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Cargar más
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>

              {!esEspecialista && (
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-t border-slate-100 dark:border-neutral-800" style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom, 0px))' }}>
                  <button type="button" onClick={verTodos} className="min-h-[36px] text-[0.8125rem] font-bold text-[var(--primary)] cursor-pointer">Ver todos los avisos</button>
                  {esDireccion && (
                    <button type="button" onClick={queRecibo} className="min-h-[36px] flex items-center gap-1 text-[0.75rem] font-semibold text-slate-500 dark:text-neutral-400 hover:text-slate-700 cursor-pointer">
                      <Settings2 className="w-3.5 h-3.5" /> Quién recibe qué
                    </button>
                  )}
                </div>
              )}
            </motion.section>
          </>
        )}
      </AnimatePresence>, document.body)}
    </div>
  );
};
