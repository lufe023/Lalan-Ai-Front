import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, CalendarClock, Cake, Check, ChevronDown, Clock, Loader2, Package, UserRound } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { CarrilHorizontal } from '../ui/CarrilHorizontal';
import { alRecibir } from '../../services/socket';
import { EVENTO_PENDIENTES, avisarCambioPendientes, pendientesApi, textoFelicitar, type ItemTuDia, type TuDia } from '../../services/pendientes';

interface Props {
  /** Lalan se hace burbuja antes de ir a otra pantalla */
  onIr: (destino: { ir: string; aviso?: string | null; conversacion?: string | null }) => void;
  /** Le pregunta algo a Lalan (los atajos) */
  onPreguntar: (texto: string) => void;
  /** Abre el teclado con algo ya escrito («Recuérdame ») */
  onEscribir: (texto: string) => void;
  /** «panel»: en la PC, fijo en el panel de la esfera (siempre abierto, con la próxima cita y los atajos abajo) */
  variante?: 'tarjeta' | 'panel';
}

const ATAJOS: { texto: string; pregunta?: string; escribir?: string; ir?: string }[] = [
  { texto: 'Mi semana', pregunta: '¿Cómo viene mi semana?' },
  { texto: 'Recuérdame…', escribir: 'Recuérdame ' },
  { texto: 'Encargar', escribir: 'Encárgale a ' },
  { texto: 'Recordatorios', ir: 'recordatorios' },
];

const ETIQUETA: Record<ItemTuDia['tipo'], { texto: string; clase: string; Icono: React.FC<{ className?: string }> }> = {
  recordatorio: { texto: 'Recordatorio', clase: 'bg-[var(--primary)]/12 text-[var(--primary-dark-val)] dark:text-[var(--primary)]', Icono: Bell },
  cita: { texto: 'Cita', clase: 'bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200', Icono: CalendarClock },
  cumple: { texto: 'Cumpleaños', clase: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200', Icono: Cake },
  producto: { texto: 'No alcanza', clase: 'bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-300', Icono: Package },
};

const botonPrincipal = 'min-h-[40px] px-4 rounded-full bg-[var(--primary)] text-white text-[0.8125rem] font-semibold cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5';
const botonSecundario = 'min-h-[40px] px-4 rounded-full bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-200 text-[0.8125rem] font-semibold cursor-pointer disabled:opacity-50';

/**
 * «Tu día»: lo primero que se ve al abrir a Lalan. Sus recordatorios y
 * encargos, las citas de hoy que piden algo, los cumpleaños y lo que no
 * alcanza, cada uno con su botón para resolverlo ahí mismo, sin hablar.
 * La esfera y la conversación siguen debajo, como siempre.
 */
export const TuDiaLalan: React.FC<Props> = ({ onIr, onPreguntar, onEscribir, variante = 'tarjeta' }) => {
  const { showToast, confirmarCita } = useApp();
  const [dia, setDia] = useState<TuDia | null>(null);
  const [abierto, setAbierto] = useState(() => { try { return sessionStorage.getItem('lalan.tuDiaCerrado') !== '1'; } catch { return true; } });
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try { setDia(await pendientesApi.tuDia()); } catch { /* sin «Tu día», Lalan sigue igual */ }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);
  useEffect(() => {
    const otra = () => void cargar();
    window.addEventListener(EVENTO_PENDIENTES, otra);
    const fuera = alRecibir('avisos:nuevo', otra);
    return () => { window.removeEventListener(EVENTO_PENDIENTES, otra); fuera(); };
  }, [cargar]);

  const cambiarAbierto = () => {
    setAbierto((a) => {
      try { sessionStorage.setItem('lalan.tuDiaCerrado', a ? '1' : '0'); } catch { /* nada */ }
      return !a;
    });
  };

  const quitarDeLaLista = (id: string) => setDia((d) => d && { ...d, items: d.items.filter((i) => i.id !== id), resumen: { ...d.resumen, pendientes: Math.max(0, d.resumen.pendientes - 1) } });

  const hacer = async (id: string, accion: () => Promise<unknown>, listo: string) => {
    setOcupado(id);
    try {
      await accion();
      quitarDeLaLista(id);
      avisarCambioPendientes();
      showToast(listo, '', 'success');
    } catch (e) {
      showToast('No se pudo', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning');
    } finally { setOcupado(null); }
  };

  const confirmar = async (i: Extract<ItemTuDia, { tipo: 'cita' }>) => {
    setOcupado(i.id);
    try {
      const r = await confirmarCita(i.id);
      // Si la cita pide algo más (un adelanto, un aviso), se abre para decidirlo allí
      if (r.aviso) { onIr({ ir: 'calendar', aviso: `cita:${i.id}` }); return; }
      quitarDeLaLista(i.id);
      showToast('Cita confirmada', i.titulo.replace(' no ha confirmado', ''), 'success');
    } catch {
      onIr({ ir: 'calendar', aviso: `cita:${i.id}` });
    } finally { setOcupado(null); }
  };

  const felicitar = (i: Extract<ItemTuDia, { tipo: 'cumple' }>) => {
    if (i.telefono) {
      window.open(`https://wa.me/${i.telefono}?text=${encodeURIComponent(textoFelicitar(i.nombre))}`, '_blank', 'noopener');
      return;
    }
    if (i.conversationId) onIr({ ir: 'chats', conversacion: i.conversationId });
  };

  /** Los botones de cada cosa de «Tu día» (los mismos en la tarjeta y en el panel) */
  const botones = (i: ItemTuDia) => (
    <>
                {i.tipo === 'recordatorio' && (i.relacion === 'encargue' ? (
                  <button type="button" className={botonSecundario} onClick={() => onIr({ ir: 'recordatorios', aviso: `recordatorio:${i.id}` })}>Ver encargo</button>
                ) : (
                  <>
                    <button type="button" className={botonPrincipal} disabled={ocupado === i.id} onClick={() => void hacer(i.id, () => pendientesApi.hecho(i.id), 'Listo')}>
                      {ocupado === i.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Listo
                    </button>
                    <button type="button" className={botonSecundario} disabled={ocupado === i.id} onClick={() => void hacer(i.id, () => pendientesApi.posponer(i.id, { minutos: 60 }), 'Te lo recuerdo en una hora')}>
                      <Clock className="w-4 h-4 inline -mt-0.5 mr-1" />Pospón 1 h
                    </button>
                  </>
                ))}
                {i.tipo === 'cita' && (
                  <>
                    {i.motivo === 'por_confirmar' ? (
                      <button type="button" className={botonPrincipal} disabled={ocupado === i.id} onClick={() => void confirmar(i)}>
                        {ocupado === i.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Confirmar
                      </button>
                    ) : (
                      <button type="button" className={botonPrincipal} onClick={() => onIr({ ir: 'calendar', aviso: `cita:${i.id}` })}>Asignar especialista</button>
                    )}
                    {i.conversationId
                      ? <button type="button" className={botonSecundario} onClick={() => onIr({ ir: 'chats', conversacion: i.conversationId })}>Escribirle</button>
                      : <button type="button" className={botonSecundario} onClick={() => onIr({ ir: 'calendar', aviso: `cita:${i.id}` })}>Ver cita</button>}
                  </>
                )}
                {i.tipo === 'cumple' && i.quien === 'clienta' && (
                  <>
                    {(i.telefono || i.conversationId) && <button type="button" className={botonPrincipal} onClick={() => felicitar(i)}>Felicitarla</button>}
                    {i.clientId && <button type="button" className={botonSecundario} onClick={() => onIr({ ir: 'clients', aviso: `clienta:${i.clientId}` })}>Ver ficha</button>}
                  </>
                )}
                {i.tipo === 'producto' && (
                  <button type="button" className={botonPrincipal} onClick={() => onIr({ ir: 'compras', aviso: `por-pedir:${i.sede.id}` })}>Pedirlo</button>
                )}
    </>
  );

  if (!dia) return null;
  const { resumen } = dia;

  if (variante === 'panel') {
    const p = dia.proxima;
    return (
      <section aria-label="Tu día" className="w-full space-y-2.5 text-left">
        <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400 first-letter:uppercase">Tu día · {dia.fecha}{dia.sede ? ` · ${dia.sede.nombre}` : ''}</p>
        <div className="grid grid-cols-3 gap-2">
          <Cifra n={resumen.citas} texto={resumen.citas === 1 ? 'cita' : 'citas'} clase="bg-[var(--primary)]/10 text-[var(--primary-dark-val)] dark:text-[var(--primary)]" />
          <Cifra n={resumen.libres} texto={resumen.libres === 1 ? 'hora libre' : 'horas libres'} clase="bg-violet-100/80 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200" />
          <Cifra n={resumen.pendientes} texto={resumen.pendientes === 1 ? 'pendiente' : 'pendientes'} clase="bg-amber-100/80 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200" />
        </div>
        {p && (
          <>
            <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400 pt-1">{p.enCurso ? 'Ahora' : 'Sigue'}</p>
            <button type="button" onClick={() => onIr({ ir: 'calendar', aviso: `cita:${p.id}` })}
              className="w-full flex items-center gap-3 rounded-2xl bg-white/90 dark:bg-neutral-900/85 border border-white/80 dark:border-white/5 shadow-sm px-3.5 py-2.5 cursor-pointer hover:bg-white dark:hover:bg-neutral-900 text-left">
              <span className="text-[0.9375rem] font-extrabold text-[var(--primary)] tabular-nums shrink-0 whitespace-nowrap">{p.hora}</span>
              <span className="min-w-0">
                <span className="block text-[0.875rem] font-semibold text-slate-900 dark:text-neutral-100 truncate">{p.clienta}</span>
                <span className="block text-[0.75rem] text-slate-500 dark:text-neutral-400 truncate">{p.servicio}{p.especialista ? ` · con ${p.especialista}` : ''}</span>
              </span>
            </button>
          </>
        )}
        {!!dia.items.length && <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400 pt-1">Pendiente</p>}
        {dia.items.map((i) => (
          <Tarjeta key={`${i.tipo}:${i.id}`} item={i}>{botones(i)}</Tarjeta>
        ))}
        {!dia.items.length && !p && <p className="text-[0.8125rem] text-slate-500 dark:text-neutral-400 pt-1">Nada pendiente por hoy.</p>}
        <div className="flex flex-wrap gap-1.5 pt-2">
          {ATAJOS.map((a) => (
            <button key={a.texto} type="button"
              onClick={() => (a.pregunta ? onPreguntar(a.pregunta) : a.escribir ? onEscribir(a.escribir) : a.ir ? onIr({ ir: a.ir }) : undefined)}
              className="min-h-[32px] px-3 rounded-full bg-white/80 dark:bg-neutral-900/80 border border-slate-200/80 dark:border-white/10 text-[0.75rem] font-semibold text-slate-600 dark:text-neutral-300 cursor-pointer hover:bg-white dark:hover:bg-neutral-900">
              {a.texto}
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Tu día" className="space-y-3">
      <button type="button" onClick={cambiarAbierto} aria-expanded={abierto}
        className="w-full text-left rounded-3xl bg-white/90 dark:bg-neutral-900/85 border border-white/80 dark:border-white/5 shadow-sm px-4 py-3.5 cursor-pointer">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[0.75rem] font-bold uppercase tracking-wider text-slate-400 first-letter:uppercase">{dia.fecha}{dia.sede ? ` · ${dia.sede.nombre}` : ''}</p>
            <p className="text-[0.9375rem] leading-snug text-slate-800 dark:text-neutral-100 mt-0.5">
              {resumen.citas === 0 ? 'Hoy no tienes citas.' : <>Hoy tienes <b>{resumen.citas} {resumen.citas === 1 ? 'cita' : 'citas'}</b>{resumen.porConfirmar ? <>, <b>{resumen.porConfirmar} por confirmar</b></> : ''}.</>}
              {resumen.pendientes ? <> {resumen.pendientes === 1 ? 'Hay 1 cosa' : `Hay ${resumen.pendientes} cosas`} para hoy.</> : ' Nada pendiente.'}
            </p>
          </div>
          <ChevronDown className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${abierto ? 'rotate-180' : ''}`} />
        </div>
        {abierto && (
          <div className="grid grid-cols-3 gap-2 mt-3">
            <Cifra n={resumen.citas} texto={resumen.citas === 1 ? 'cita' : 'citas'} clase="bg-[var(--primary)]/10 text-[var(--primary-dark-val)] dark:text-[var(--primary)]" />
            <Cifra n={resumen.libres} texto={resumen.libres === 1 ? 'hora libre' : 'horas libres'} clase="bg-violet-100/80 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200" />
            <Cifra n={resumen.pendientes} texto={resumen.pendientes === 1 ? 'pendiente' : 'pendientes'} clase="bg-amber-100/80 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200" />
          </div>
        )}
      </button>

      <AnimatePresence initial={false}>
        {abierto && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }} className="space-y-2.5 overflow-hidden">
            <CarrilHorizontal className="gap-2 -mx-1 px-1 py-0.5">
              {ATAJOS.map((a) => (
                <button key={a.texto} type="button"
                  onClick={() => (a.pregunta ? onPreguntar(a.pregunta) : a.escribir ? onEscribir(a.escribir) : a.ir ? onIr({ ir: a.ir }) : undefined)}
                  className="shrink-0 min-h-[36px] px-3.5 rounded-full bg-white/90 dark:bg-neutral-900/85 border border-slate-200/80 dark:border-white/10 text-[0.8125rem] font-semibold text-slate-700 dark:text-neutral-200 whitespace-nowrap cursor-pointer shadow-sm">
                  {a.texto}
                </button>
              ))}
            </CarrilHorizontal>
            {dia.items.map((i) => (
              <Tarjeta key={`${i.tipo}:${i.id}`} item={i}>{botones(i)}</Tarjeta>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

const Cifra: React.FC<{ n: number; texto: string; clase: string }> = ({ n, texto, clase }) => (
  <div className={`rounded-2xl py-2 text-center ${clase}`}>
    <div className="text-lg font-bold leading-tight">{n}</div>
    <div className="text-[0.6875rem] font-medium">{texto}</div>
  </div>
);

const Tarjeta: React.FC<{ item: ItemTuDia; children?: React.ReactNode }> = ({ item, children }) => {
  const e = ETIQUETA[item.tipo];
  const vencido = item.tipo === 'recordatorio' && item.vencido;
  const etiqueta = item.tipo === 'recordatorio' && item.relacion === 'encargue' ? 'Encargo'
    : item.tipo === 'recordatorio' && item.relacion === 'me_toca' ? 'Te lo encargaron'
      : item.tipo === 'cita' && item.motivo === 'sin_especialista' ? 'Sin especialista' : e.texto;
  return (
    <div className="rounded-3xl bg-white/90 dark:bg-neutral-900/85 border border-white/80 dark:border-white/5 shadow-sm px-4 py-3">
      <span className={`inline-flex items-center gap-1 text-[0.6875rem] font-bold rounded-full px-2 py-0.5 ${vencido ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-200' : e.clase}`}>
        {item.tipo === 'cumple' && item.quien === 'equipo' ? <UserRound className="w-3 h-3" /> : <e.Icono className="w-3 h-3" />}
        {vencido ? 'Ya pasó la hora' : etiqueta}
      </span>
      <p className="text-[0.9375rem] font-semibold text-slate-900 dark:text-neutral-100 mt-1.5 leading-snug">{item.titulo}</p>
      <p className="text-[0.8125rem] text-slate-500 dark:text-neutral-400 leading-snug first-letter:uppercase">{item.detalle}</p>
      {children && <div className="flex flex-wrap gap-2 mt-2.5">{children}</div>}
    </div>
  );
};
