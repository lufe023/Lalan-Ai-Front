import React, { useEffect, useState } from 'react';
import { Loader2, MessageCircle, Printer, UserRound } from 'lucide-react';
import { useApp, mapApiAppointment } from '../../context/AppContext';
import { api } from '../../services/api';
import { IOSModal } from '../ui/IOSModal';
import { ConfirmarCita } from '../agenda/ConfirmarCita';
import { AdelantoCita } from '../agenda/AdelantoCita';
import type { Appointment } from '../../types';

const primerNombre = (n?: string | null) => (n ?? '').trim().split(/\s+/)[0] ?? '';
const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit', hour12: true });
/** "13:00" → "1:00 p. m." */
export const hora12 = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
};

/**
 * Confirmar la cita o resolver su adelanto sin salir de Mi semana: es el
 * mismo panel de la agenda, en una hoja. La cita se toma de la agenda ya
 * cargada o se pide al servidor.
 */
export const ResolverCita: React.FC<{ citaId: string; modo: 'confirmar' | 'adelanto'; onCerrar: () => void; onListo: () => void }> = ({ citaId, modo, onCerrar, onListo }) => {
  const { appointments } = useApp();
  const [cita, setCita] = useState<Appointment | null>(() => appointments.find((a) => a.id === citaId) ?? null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (cita) return;
    api.get<any>(`/appointments/${citaId}`).then((a) => setCita(mapApiAppointment(a))).catch((e) => setError(e?.message ?? 'No pude abrir la cita.'));
  }, [cita, citaId]);
  const cambio = (c: Appointment) => { setCita((a) => (a ? { ...a, ...c } : c)); onListo(); };
  return (
    <IOSModal id={`mi-semana-${modo}`} isOpen onClose={onCerrar} fixedHeight={false} height="88%"
      title={modo === 'confirmar' ? 'Confirmar la cita' : 'El adelanto'} subtitle={cita ? `${cita.clientName} · ${cita.serviceName}` : undefined}>
      <div className="max-w-xl mx-auto pb-6 space-y-3">
        {error && <p className="text-[0.8125rem] font-semibold text-rose-600" role="alert">{error}</p>}
        {!cita && !error && <div className="flex items-center gap-2 text-[0.8125rem] text-slate-400 py-6 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Abriendo la cita…</div>}
        {cita && modo === 'adelanto' && <AdelantoCita cita={cita} onCambio={cambio} />}
        {cita && modo === 'confirmar' && <ConfirmarCita key={cita.id} cita={cita} onConfirmada={cambio} onCerrar={onCerrar} />}
      </div>
    </IOSModal>
  );
};

/* ── Ofrecer una hora libre ───────────────────────────────────────── */

export interface PorVolver { clientId: string; nombre: string; telefono: string | null; sede: { id: string; nombre: string }; visitas: number; dias: number; cadaCuanto: number | null }
export interface HuecoElegido { fecha: string; nombreDia: string; desde: string; hasta: string; sede: { id: string; nombre: string } }

const semanas = (dias: number) => (dias < 14 ? `${dias} días` : `${Math.round(dias / 7)} semanas`);

/** "hoy", "mañana", "pasado mañana", "el lunes 2 de noviembre" */
const elDia = (nombreDia: string) => (['Hoy', 'Mañana', 'Pasado mañana'].includes(nombreDia) ? nombreDia.toLowerCase() : `el ${nombreDia}`);

/** Lo que le llega: corto, con el día y la hora, y la pregunta para que solo diga "sí" */
export function textoOferta(nombre: string, h: HuecoElegido) {
  const dia = elDia(h.nombreDia);
  return `¡Hola ${primerNombre(nombre)}! Te escribimos de ${h.sede.nombre}. Hace rato no te vemos y nos quedó un espacio ${dia} a las ${hora12(h.desde)} ¿Te lo apartamos? 💜`;
}

/**
 * Una hora libre y a quién ofrecérsela: las clientas a las que ya les toca
 * volver y no tienen cita, primero las de esa sede. Un toque abre su
 * WhatsApp con el mensaje escrito.
 */
export const OfrecerHueco: React.FC<{ hueco: HuecoElegido; porVolver: PorVolver[]; onCerrar: () => void; onFicha: (id: string) => void }> = ({ hueco, porVolver, onCerrar, onFicha }) => {
  const lista = [...porVolver].sort((x, y) => Number(y.sede.id === hueco.sede.id) - Number(x.sede.id === hueco.sede.id));
  const [enviadas, setEnviadas] = useState<Set<string>>(new Set());
  const general = `¡Hola! En ${hueco.sede.nombre} nos quedó un espacio ${elDia(hueco.nombreDia)} a las ${hora12(hueco.desde)} ¿Quién se anima? Escríbenos y te lo apartamos 💜`;
  return (
    <IOSModal id="ofrecer-hueco" isOpen onClose={onCerrar} fixedHeight={false} height="88%"
      title="Llenar esta hora" subtitle={`${hueco.nombreDia} · de ${hora12(hueco.desde)} a ${hora12(hueco.hasta)} · ${hueco.sede.nombre}`}>
      <div className="max-w-xl mx-auto pb-6 space-y-3 text-slate-900 dark:text-white">
        {lista.length > 0 ? (
          <>
            <p className="text-[0.8125rem] text-slate-500 dark:text-neutral-400">Ya les toca volver y no tienen cita. Toca <b>Ofrecérsela</b> y se abre tu WhatsApp con el mensaje listo.</p>
            {lista.map((p) => {
              const enviada = enviadas.has(p.clientId);
              return (
                <div key={p.clientId} className="p-3 rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center gap-3">
                  <button type="button" onClick={() => onFicha(p.clientId)} className="min-w-0 flex-1 text-left cursor-pointer">
                    <span className="block font-semibold text-[0.875rem] truncate">{p.nombre}</span>
                    <span className="block text-[0.75rem] text-slate-500 dark:text-neutral-400">
                      {p.cadaCuanto ? `Venía cada ${semanas(p.cadaCuanto)}` : 'Vino una vez'} · hace {semanas(p.dias)} · {p.visitas} {p.visitas === 1 ? 'visita' : 'visitas'}
                    </span>
                  </button>
                  {p.telefono ? (
                    <a href={`https://wa.me/${p.telefono}?text=${encodeURIComponent(textoOferta(p.nombre, hueco))}`} target="_blank" rel="noopener"
                      onClick={() => setEnviadas((s) => new Set(s).add(p.clientId))}
                      className={`px-3 py-2 rounded-xl text-[0.75rem] font-bold flex items-center gap-1.5 whitespace-nowrap ${enviada ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-[#25D366] text-white'}`}>
                      <MessageCircle className="w-4 h-4" /> {enviada ? 'Abierto' : 'Ofrecérsela'}
                    </a>
                  ) : (
                    <button type="button" onClick={() => onFicha(p.clientId)} className="px-3 py-2 rounded-xl text-[0.75rem] font-bold bg-slate-100 dark:bg-neutral-800 flex items-center gap-1.5 cursor-pointer whitespace-nowrap"><UserRound className="w-4 h-4" /> Sin teléfono · ficha</button>
                  )}
                </div>
              );
            })}
          </>
        ) : (
          <p className="text-[0.8125rem] text-slate-500 dark:text-neutral-400">Ninguna clienta está pendiente de volver. Puedes ponerlo en tu estado de WhatsApp o mandárselo a quien quieras:</p>
        )}
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-neutral-800/60 space-y-2">
          <span className="block text-[0.6875rem] uppercase font-bold tracking-wider text-slate-400">Para tu estado o un grupo</span>
          <p className="text-[0.8125rem]">{general}</p>
          <a href={`https://wa.me/?text=${encodeURIComponent(general)}`} target="_blank" rel="noopener"
            className="inline-flex px-3 py-2 rounded-xl text-[0.75rem] font-bold bg-[#25D366] text-white items-center gap-1.5"><MessageCircle className="w-4 h-4" /> Compartirlo</a>
        </div>
      </div>
    </IOSModal>
  );
};

/* ── La hoja del día por especialista ─────────────────────────────── */

export interface CitaDeHoja {
  startsAt: string; clientName: string; serviceName: string; staffName: string | null; staffTelefono: string | null;
  alergias: { nombres: string[] }; gustos: { tipo: string; valor: string }[]; senales: { emoji: string; valor: string }[];
  historia: { visitas: number };
}

const EMOJI: Record<string, string> = { music: '🎵', drink: '🍹', food: '🍪', style: '💇', movie: '🎬', other: '✨' };

/** Lo de una clienta en una línea, para leerla de un vistazo antes de que llegue */
function lineasDe(c: CitaDeHoja) {
  return [
    c.historia.visitas === 0 ? '🌱 Primera vez' : null,
    c.alergias.nombres.length ? `⚠️ Alergia: ${c.alergias.nombres.join(', ')}` : null,
    c.gustos.length ? c.gustos.map((g) => `${EMOJI[g.tipo] ?? '•'} ${g.valor}`).join('  ') : null,
    ...c.senales.slice(0, 2).map((s) => `${s.emoji} ${s.valor}`),
  ].filter((x): x is string => !!x);
}

function textoHoja(nombreDia: string, persona: string, citas: CitaDeHoja[]) {
  return [`*Tu día · ${nombreDia}*`, `${primerNombre(persona)}, esto es lo que tienes:`, '',
    ...citas.flatMap((c) => [`*${hora(c.startsAt)}* ${c.clientName} · ${c.serviceName}`, ...lineasDe(c).map((l) => `   ${l}`)]),
  ].join('\n');
}

/**
 * La hoja del día de cada especialista: sus citas en orden con lo que hay
 * que saber de cada clienta. Se imprime o se le manda por WhatsApp.
 */
export const HojaDelDia: React.FC<{ nombreDia: string; citas: CitaDeHoja[]; onCerrar: () => void }> = ({ nombreDia, citas, onCerrar }) => {
  const grupos = new Map<string, CitaDeHoja[]>();
  for (const c of [...citas].sort((x, y) => x.startsAt.localeCompare(y.startsAt))) {
    const k = c.staffName ?? 'Sin especialista';
    grupos.set(k, [...(grupos.get(k) ?? []), c]);
  }
  const imprimir = () => {
    const v = window.open('', '_blank', 'width=720,height=900');
    if (!v) return;
    const esc = (t: string) => t.replace(/[&<>]/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[x]!));
    v.document.write(`<!doctype html><meta charset="utf-8"><title>Hoja del día · ${esc(nombreDia)}</title>
      <style>body{font:14px system-ui,sans-serif;margin:24px;color:#111}h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:24px 0 8px;page-break-before:auto}
      .c{padding:8px 0;border-bottom:1px solid #ddd}.h{font-weight:700}.l{color:#444;margin-left:12px}section{page-break-inside:avoid}@media print{section{page-break-after:always}section:last-child{page-break-after:auto}}</style>
      <h1>Hoja del día · ${esc(nombreDia)}</h1>
      ${[...grupos.entries()].map(([p, cs]) => `<section><h2>${esc(p)}</h2>${cs.map((c) => `<div class="c"><div class="h">${esc(hora(c.startsAt))} · ${esc(c.clientName)} · ${esc(c.serviceName)}</div>${lineasDe(c).map((l) => `<div class="l">${esc(l)}</div>`).join('')}</div>`).join('')}</section>`).join('')}`);
    v.document.close();
    v.focus();
    v.print();
  };
  return (
    <IOSModal id="hoja-del-dia" isOpen onClose={onCerrar} title="Hoja del día" subtitle={`${nombreDia} · ${citas.length} ${citas.length === 1 ? 'cita' : 'citas'}`}>
      <div className="max-w-xl mx-auto pb-6 space-y-4 text-slate-900 dark:text-white">
        <button type="button" onClick={imprimir} className="w-full py-3 rounded-2xl bg-[var(--primary)] text-white font-bold flex items-center justify-center gap-2 cursor-pointer"><Printer className="w-4 h-4" /> Imprimir todas</button>
        {[...grupos.entries()].map(([persona, cs]) => {
          const tel = (cs[0].staffTelefono ?? '').replace(/\D/g, '');
          return (
            <section key={persona} className="rounded-3xl border border-slate-200 dark:border-neutral-800 overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-2 bg-slate-50 dark:bg-neutral-800/60">
                <span className="flex-1 font-bold text-[0.875rem]">{persona} <span className="font-semibold text-slate-400">· {cs.length}</span></span>
                {persona !== 'Sin especialista' && (tel.length >= 8 ? (
                  <a href={`https://wa.me/${tel}?text=${encodeURIComponent(textoHoja(nombreDia, persona, cs))}`} target="_blank" rel="noopener"
                    className="px-3 py-1.5 rounded-xl text-[0.75rem] font-bold bg-[#25D366] text-white flex items-center gap-1.5 whitespace-nowrap"><MessageCircle className="w-3.5 h-3.5" /> Mandársela</a>
                ) : <span className="text-[0.6875rem] text-slate-400">Sin teléfono en su ficha</span>)}
              </div>
              <div className="divide-y divide-slate-100 dark:divide-neutral-800">
                {cs.map((c, i) => (
                  <div key={i} className="px-4 py-2.5">
                    <div className="text-[0.8125rem]"><b>{hora(c.startsAt)}</b> · {c.clientName} · <span className="text-slate-500 dark:text-neutral-400">{c.serviceName}</span></div>
                    {lineasDe(c).map((l, j) => <div key={j} className="text-[0.75rem] text-slate-600 dark:text-neutral-300 ml-3">{l}</div>)}
                  </div>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </IOSModal>
  );
};
