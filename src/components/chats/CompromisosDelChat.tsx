import React, { useCallback, useEffect, useState } from 'react';
import { Bell, CalendarPlus, CalendarClock, Check, Loader2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { alRecibir } from '../../services/socket';
import { irA } from '../../services/avisos';
import { avisarCambioPendientes, cuandoCorto } from '../../services/pendientes';
import { citaDeCompromiso, compromisosApi, horasParaRecordar, pedirNuevaCita, type Compromiso, type TipoCompromiso } from '../../services/compromisos';
import type { Conversation } from '../../types';

/** Se juntan las señales del chat (un mensaje y su respuesta son varias en un segundo) */
const RAFAGA_MS = 1200;

const ETIQUETA: Record<TipoCompromiso, string> = {
  cita: 'Cita por cerrar',
  recordatorio: 'Por recordar',
  reunion: 'Reunión o llamada',
  promesa: 'Lo prometiste',
};

const boton = 'px-2.5 py-1 rounded-lg text-[0.6875rem] font-bold shrink-0 cursor-pointer disabled:opacity-50 inline-flex items-center gap-1';
const principal = `${boton} bg-amber-600 hover:bg-amber-700 text-white`;
const secundario = `${boton} bg-white dark:bg-neutral-900 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200`;

/** "2026-11-21T10:00" para el campo de fecha y hora, en la hora del aparato */
const paraCampo = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

/**
 * Lo que Lalan vio pendiente en este chat («tú me dices cuándo y le damos»,
 * una cita para la hija, algo que el salón prometió), donde se decide: con
 * el dato concreto y el botón para agendarlo o recordarlo con un toque.
 */
export const CompromisosDelChat: React.FC<{ conversacion: Conversation; agente: string }> = ({ conversacion, agente }) => {
  const { showToast } = useApp();
  const [lista, setLista] = useState<Compromiso[]>([]);
  const [eligiendo, setEligiendo] = useState<string | null>(null);
  const [otra, setOtra] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  /** En el teléfono no se come el chat: se ve el primero y «Ver N más» */
  const [todos, setTodos] = useState(false);
  const id = conversacion.id;

  const cargar = useCallback(async () => {
    if (!id || id.startsWith('temp_')) return;
    try { setLista(await compromisosApi.delChat(id)); } catch { /* sin permiso o sin red: el chat sigue igual */ }
  }, [id]);

  useEffect(() => { setLista([]); setEligiendo(null); setTodos(false); void cargar(); }, [cargar]);
  // Lalan lo ve unos minutos después de que el chat hace una pausa: llega como un cambio del chat
  useEffect(() => {
    let espera: number | undefined;
    const quitar = alRecibir('chat:cambio', () => {
      window.clearTimeout(espera);
      espera = window.setTimeout(() => void cargar(), RAFAGA_MS);
    });
    return () => { window.clearTimeout(espera); quitar(); };
  }, [cargar]);

  const quitarDeLaLista = (cid: string) => { setLista((l) => l.filter((x) => x.id !== cid)); setEligiendo(null); };

  const recordar = async (c: Compromiso, vence: Date, antesMin: number | null = null) => {
    if (Number.isNaN(vence.getTime())) return;
    setOcupado(c.id);
    try {
      await compromisosApi.recordar(c.id, { vence: vence.toISOString(), antesMin });
      quitarDeLaLista(c.id);
      avisarCambioPendientes();
      showToast(`Te lo recuerdo ${cuandoCorto(vence.toISOString())}`, `${c.titulo}. El aviso abre este chat.`, 'success');
    } catch (e) {
      showToast('No se pudo guardar', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning');
    } finally { setOcupado(null); }
  };

  const descartar = async (c: Compromiso) => {
    setOcupado(c.id);
    try { await compromisosApi.descartar(c.id); quitarDeLaLista(c.id); }
    catch (e) { showToast('No se pudo quitar', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
    finally { setOcupado(null); }
  };

  /** La Agenda abre «Nueva cita» con quién, para quién, el día, la hora y la nota ya puestos */
  const agendar = (c: Compromiso) => {
    pedirNuevaCita(citaDeCompromiso(c));
    irA({ ir: 'calendar' });
  };

  if (!lista.length) return null;
  const visibles = todos ? lista : lista.slice(0, 1);

  return (
    <div className="px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-200/70 dark:border-amber-900 shrink-0 space-y-2.5 max-h-[45%] overflow-y-auto" aria-label={`Pendiente en este chat según ${agente}`}>
      {visibles.map((c) => {
        // Un día sin hora se dice sin hora («sáb 21 nov»)
        const cuando = c.cuando ? (c.conHora ? cuandoCorto(c.cuando) : diaCorto(c.cuando)) : c.cuandoTexto;
        const datos = [c.detalle, cuando].filter(Boolean).join(' · ');
        const abierto = eligiendo === c.id;
        return (
          <div key={c.id} className="flex items-start gap-2">
            <CalendarClock className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-1">
                <div className="flex-1 min-w-0 text-[0.6875rem] font-bold text-amber-800 dark:text-amber-300">{agente} vio algo pendiente · {ETIQUETA[c.tipo]}</div>
                <button type="button" disabled={ocupado === c.id} onClick={() => void descartar(c)} aria-label={`No hace falta: ${c.titulo}`} title="No hace falta"
                  className="-mt-1 -mr-1 p-1.5 rounded-full text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 cursor-pointer disabled:opacity-50 shrink-0">
                  {ocupado === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" aria-hidden="true" />}
                </button>
              </div>
              <p className="text-[0.75rem] font-semibold text-slate-800 dark:text-neutral-100">{c.titulo}</p>
              {datos && <p className="text-[0.75rem] text-slate-600 dark:text-neutral-300 first-letter:uppercase">{datos}</p>}
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {c.tipo === 'cita' && (
                  <button type="button" className={principal} disabled={ocupado === c.id} onClick={() => agendar(c)} data-medir="Chat: agendar compromiso">
                    <CalendarPlus className="w-3 h-3" aria-hidden="true" /> Agendar cita
                  </button>
                )}
                <button type="button" className={c.tipo === 'cita' ? secundario : principal} disabled={ocupado === c.id} aria-expanded={abierto}
                  onClick={() => { setEligiendo(abierto ? null : c.id); setOtra(''); }} data-medir="Chat: recordar compromiso">
                  <Bell className="w-3 h-3" aria-hidden="true" /> Recuérdamelo
                </button>
              </div>
              {abierto && (
                <div className="mt-2 space-y-1.5" role="group" aria-label="Cuándo te lo recuerdo">
                  <div className="flex flex-wrap gap-1.5">
                    {horasParaRecordar(c).map((h) => (
                      <button key={h.etiqueta} type="button" className={secundario} disabled={ocupado === c.id} onClick={() => void recordar(c, h.vence, h.antesMin)}>
                        {h.etiqueta}
                      </button>
                    ))}
                  </div>
                  <form className="flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); if (otra) void recordar(c, new Date(otra)); }}>
                    <label className="text-[0.6875rem] font-semibold text-slate-600 dark:text-neutral-300 shrink-0" htmlFor={`otra-${c.id}`}>Otra:</label>
                    <input id={`otra-${c.id}`} type="datetime-local" value={otra} min={paraCampo(new Date())} onChange={(e) => setOtra(e.target.value)}
                      className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-white dark:bg-neutral-900 border border-amber-200 dark:border-amber-900 text-[0.75rem] text-slate-900 dark:text-white" />
                    <button type="submit" className={principal} disabled={!otra || ocupado === c.id}>
                      <Check className="w-3 h-3" aria-hidden="true" /> Listo
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        );
      })}
      {lista.length > 1 && (
        <button type="button" onClick={() => setTodos((t) => !t)} className="ml-5.5 text-[0.6875rem] font-bold text-amber-800 dark:text-amber-300 underline cursor-pointer">
          {todos ? 'Ver menos' : `Ver ${lista.length - 1} más`}
        </button>
      )}
    </div>
  );
};

const diaCorto = (iso: string) => new Date(iso).toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short' });
