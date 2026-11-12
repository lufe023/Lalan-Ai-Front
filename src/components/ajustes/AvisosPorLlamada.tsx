import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, ChevronRight, Loader2, Lock, Phone, PhoneCall, PhoneMissed, PhoneOff, Sparkles } from 'lucide-react';
import { irA } from '../../services/avisos';
import { api } from '../../services/api';
import { pedirSeccionAjustes } from './MenuAjustes';
import { EVENTO_AJUSTES_MENU } from '../guias/GuiaEnCurso';

interface EstadoLlamadas {
  modulo: boolean;
  proveedor: boolean;
  usadas: number;
  tope: number | null;
  miTelefono: string | null;
  llamarPor: string[];
  avisos: { id: string; descripcion: string; grupo: string }[];
  sedes: { id: string; nombre: string; llamarCitaHoras: number | null; textoLlamadaCita: string | null }[];
  horasCita: number[];
  esDireccion: boolean;
}

interface Llamada {
  id: string; tipo: 'aviso' | 'cita' | 'prueba'; para: string; texto: string;
  estado: 'llamando' | 'contestada' | 'no_contesto' | 'ocupado' | 'fallida';
  respuesta: string | null; segundos: number | null; creadoEn: string; quien: string | null; sede: string | null; appointmentId: string | null;
}

const GRUPOS: Record<string, string> = { chats: 'Chats', agenda: 'Agenda', compras: 'Compras' };

/** Los avisos que de verdad son para llamar: van primero y marcados */
const URGENTES = new Set(['chat_atencion', 'clienta_esperando', 'conducta_especialista', 'plan_aviso', 'cita_sin_especialista']);

const ESTADO: Record<Llamada['estado'], { texto: string; clase: string; Icono: React.ElementType }> = {
  llamando: { texto: 'Llamando', clase: 'text-sky-600', Icono: PhoneCall },
  contestada: { texto: 'Contestó', clase: 'text-emerald-600', Icono: Phone },
  no_contesto: { texto: 'No contestó', clase: 'text-amber-600', Icono: PhoneMissed },
  ocupado: { texto: 'Ocupado', clase: 'text-amber-600', Icono: PhoneMissed },
  fallida: { texto: 'No salió', clase: 'text-rose-600', Icono: PhoneOff },
};

const QUE_MARCO: Record<string, string> = { '1': 'Marcó 1', '2': 'Marcó 2: quiere cambiarla' };

const Interruptor: React.FC<{ encendido: boolean; onCambio: () => void; etiqueta: string; deshabilitado?: boolean }> = ({ encendido, onCambio, etiqueta, deshabilitado }) => (
  <button type="button" role="switch" aria-checked={encendido} aria-label={etiqueta} onClick={onCambio} disabled={deshabilitado}
    className={`relative w-9 h-5 rounded-full shrink-0 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${encendido ? 'bg-[var(--primary)]' : 'bg-slate-300 dark:bg-neutral-700'}`}>
    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${encendido ? 'left-[18px]' : 'left-0.5'}`} />
  </button>
);

const tarjeta = 'p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3 text-slate-900 dark:text-neutral-100';

const cuando = (iso: string) => new Date(iso).toLocaleString('es-DO', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/**
 * Ajustes → Avisos por llamada. Lalán llama por teléfono:
 *  - a esta persona, por los avisos que ella elija (lo urgente);
 *  - a las clientas, unas horas antes de su cita (lo elige la dirección por sede).
 * Sale apagado: hace falta el módulo en el plan y que Lalán tenga las llamadas
 * encendidas. Mientras tanto se puede dejar todo elegido.
 */
export const AvisosPorLlamada: React.FC = () => {
  const [datos, setDatos] = useState<EstadoLlamadas | null>(null);
  const [historial, setHistorial] = useState<Llamada[] | null>(null);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState('');
  const [telefono, setTelefono] = useState('');

  const cargar = useCallback(async () => {
    try {
      const [e, h] = await Promise.all([api.get<EstadoLlamadas>('/llamadas'), api.get<Llamada[]>('/llamadas/historial').catch(() => [])]);
      setDatos(e); setHistorial(h);
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  const guardar = async (cambio: { llamarPor?: string[]; sedes?: { id: string; llamarCitaHoras?: number | null; textoLlamadaCita?: string | null }[]; telefono?: string }, clave: string) => {
    setError(''); setOcupado(clave);
    // Se ve al instante; si falla, se recarga lo que quedó de verdad
    setDatos((d) => d && ({
      ...d,
      ...(cambio.llamarPor ? { llamarPor: cambio.llamarPor } : {}),
      ...(cambio.sedes ? { sedes: d.sedes.map((s) => ({ ...s, ...(cambio.sedes!.find((x) => x.id === s.id) ?? {}) })) } : {}),
    }));
    try { setDatos(await api.patch<EstadoLlamadas>('/llamadas', cambio)); }
    catch (e) { setError((e as Error).message); void cargar(); }
    finally { setOcupado(null); }
  };

  const probar = async () => {
    setError(''); setAviso(''); setOcupado('prueba');
    try { await api.post('/llamadas/prueba', {}); setAviso('Te estamos llamando. Contesta para oír cómo suena.'); void cargar(); }
    catch (e) { setError((e as Error).message); }
    finally { setOcupado(null); }
  };

  /** Oír en mi teléfono lo que Lalán le dice a la clienta de esa sede */
  const probarCita = async (sede: string) => {
    setError(''); setAviso(''); setOcupado(`prueba-${sede}`);
    try { await api.post('/llamadas/prueba-cita', { sede }); setAviso('Te estamos llamando con el recordatorio de la cita. Contesta y prueba marcar 1.'); void cargar(); }
    catch (e) { setError((e as Error).message); }
    finally { setOcupado(null); }
  };

  const avisosOrdenados = useMemo(() => {
    const lista = datos?.avisos ?? [];
    return [...lista.filter((a) => URGENTES.has(a.id)), ...lista.filter((a) => !URGENTES.has(a.id))];
  }, [datos]);

  if (!datos) {
    return (
      <div className={tarjeta}>
        {error ? <p className="text-[0.75rem] font-semibold text-rose-600" role="alert">{error}</p>
          : <div className="flex items-center gap-2 text-[0.75rem] text-slate-400"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando…</div>}
      </div>
    );
  }

  const listo = datos.modulo && datos.proveedor;
  const sinCupo = datos.tope !== null && datos.usadas >= datos.tope;

  return (
    <div className="space-y-3">
      {/* Qué es y en qué punto está */}
      <div className={tarjeta}>
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center shrink-0"><PhoneCall className="w-4 h-4" /></div>
          <div className="min-w-0">
            <h3 className="text-[0.9375rem] font-bold">Lalán te llama cuando es urgente</h3>
            <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 mt-0.5">
              Una llamada de verdad, con su voz, para lo que no puede esperar. Y a tus clientas, para recordarles la cita: marcan 1 y queda confirmada.
            </p>
          </div>
        </div>

        {!datos.modulo ? (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 p-3 flex items-start gap-2.5">
            <Lock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[0.8125rem] font-semibold text-amber-900 dark:text-amber-200">Tu plan no lo incluye todavía</p>
              <p className="text-[0.75rem] text-amber-800/80 dark:text-amber-200/80">Viene en el plan más completo o se añade como extra a cualquier plan. Ya puedes dejar elegido qué quieres.</p>
              {datos.esDireccion && (
                <button type="button" onClick={() => { pedirSeccionAjustes('plan'); window.dispatchEvent(new CustomEvent(EVENTO_AJUSTES_MENU, { detail: 'plan' })); }}
                  className="mt-2 min-h-[36px] px-3 rounded-full bg-amber-600 text-white text-[0.75rem] font-bold inline-flex items-center gap-1 cursor-pointer">
                  <Sparkles className="w-3.5 h-3.5" /> Ver mi plan
                </button>
              )}
            </div>
          </div>
        ) : !datos.proveedor ? (
          <div className="rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200 dark:border-neutral-700 p-3 flex items-start gap-2.5">
            <PhoneOff className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
            <p className="text-[0.75rem] text-slate-600 dark:text-neutral-300">Las llamadas se están encendiendo en Lalán. Deja elegido lo que quieres: empieza a llamar solo, sin que hagas nada más.</p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.75rem] font-semibold ${sinCupo ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'}`}>
              {datos.usadas}{datos.tope !== null ? ` de ${datos.tope}` : ''} llamadas este mes
            </span>
            <button type="button" onClick={() => void probar()} disabled={ocupado === 'prueba' || !datos.miTelefono || sinCupo}
              className="min-h-[36px] px-3 rounded-full border border-slate-200 dark:border-neutral-700 text-[0.75rem] font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
              {ocupado === 'prueba' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Phone className="w-3.5 h-3.5" />} Llámame para probar
            </button>
          </div>
        )}
        {aviso && <p className="text-[0.75rem] font-semibold text-emerald-600" role="status">{aviso}</p>}
        {error && <p className="text-[0.75rem] font-semibold text-rose-600" role="alert">{error}</p>}
      </div>

      {/* Lo mío: por qué avisos me llaman */}
      <div className={tarjeta}>
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">Llámame cuando…</h3>
          <p className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">
            {datos.miTelefono ? `Te llama al ${datos.miTelefono}. Además de la notificación, y como mucho una vez cada 15 minutos por el mismo aviso.` : 'Anota tu teléfono: es al que te llama (y también puedes entrar a Lalán con él).'}
          </p>
          {!datos.miTelefono && (
            <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (telefono.trim()) void guardar({ telefono: telefono.trim() }, 'telefono'); }}>
              <input type="tel" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="809-555-1234" aria-label="Mi teléfono"
                className="flex-1 min-w-0 min-h-[40px] px-3 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.875rem]" />
              <button type="submit" disabled={!telefono.trim() || ocupado === 'telefono'}
                className="min-h-[40px] px-4 rounded-xl bg-[var(--primary)] text-white text-[0.8125rem] font-bold cursor-pointer disabled:opacity-50">Guardar</button>
            </form>
          )}
        </div>
        <ul className="divide-y divide-slate-100 dark:divide-neutral-800">
          {avisosOrdenados.map((a) => {
            const marcado = datos.llamarPor.includes(a.id);
            return (
              <li key={a.id} className="py-2 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[0.8125rem] font-medium leading-snug">{a.descripcion}</p>
                  <p className="text-[0.6875rem] text-slate-400">{GRUPOS[a.grupo] ?? a.grupo}{URGENTES.has(a.id) ? ' · urgente' : ''}</p>
                </div>
                <Interruptor encendido={marcado} etiqueta={a.descripcion} deshabilitado={ocupado === 'mios'}
                  onCambio={() => void guardar({ llamarPor: marcado ? datos.llamarPor.filter((x) => x !== a.id) : [...datos.llamarPor, a.id] }, 'mios')} />
              </li>
            );
          })}
        </ul>
      </div>

      {/* A las clientas: la dirección, por sede */}
      {datos.esDireccion && (
        <div className={tarjeta}>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">Recordar la cita llamando a la clienta</h3>
            <p className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">
              Lalán le recuerda la cita y le pide marcar 1 para confirmar o 2 para cambiarla. Si marca 2, te avisa para darle otra hora. Solo llama entre 8 a. m. y 8 p. m.
            </p>
          </div>
          <div className="space-y-2">
            {datos.sedes.map((s) => (
              <div key={s.id} className="space-y-2">
              <label className="flex items-center gap-3">
                <span className="flex-1 min-w-0 text-[0.8125rem] font-medium truncate">{s.nombre}</span>
                <select value={s.llamarCitaHoras ?? ''} disabled={ocupado === `sede-${s.id}`}
                  onChange={(e) => void guardar({ sedes: [{ id: s.id, llamarCitaHoras: e.target.value ? Number(e.target.value) : null }] }, `sede-${s.id}`)}
                  aria-label={`Recordatorio por llamada en ${s.nombre}`}
                  className="min-h-[36px] px-3 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.8125rem]">
                  <option value="">No llamar</option>
                  {datos.horasCita.map((h) => <option key={h} value={h}>{h === 24 ? 'Un día antes' : `${h} ${h === 1 ? 'hora' : 'horas'} antes`}</option>)}
                </select>
              </label>
              {s.llamarCitaHoras !== null && (
                <TextoDeLaLlamada sede={s} guardando={ocupado === `texto-${s.id}`} probando={ocupado === `prueba-${s.id}`}
                  puedeProbar={listo && !!datos.miTelefono && !sinCupo}
                  onGuardar={(t) => void guardar({ sedes: [{ id: s.id, textoLlamadaCita: t }] }, `texto-${s.id}`)}
                  onProbar={() => void probarCita(s.id)} />
              )}
              </div>
            ))}
          </div>
          {!listo && datos.sedes.some((s) => s.llamarCitaHoras) && (
            <p className="text-[0.6875rem] text-slate-400 flex items-center gap-1"><Check className="w-3 h-3" /> Guardado: empieza cuando se enciendan las llamadas.</p>
          )}
        </div>
      )}

      {/* Lo que ya llamó */}
      {!!historial?.length && (
        <div className={tarjeta}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">Últimas llamadas</h3>
          <ul className="divide-y divide-slate-100 dark:divide-neutral-800">
            {historial.slice(0, 12).map((l) => {
              const e = ESTADO[l.estado] ?? ESTADO.llamando;
              return (
                <li key={l.id}>
                  <button type="button" disabled={!l.appointmentId} onClick={() => l.appointmentId && irA({ ir: 'calendar', aviso: `cita:${l.appointmentId}` })}
                    aria-label={l.appointmentId ? `Ver la cita de ${l.quien ?? ''}` : undefined}
                    className="w-full py-2 flex items-start gap-2.5 text-left enabled:cursor-pointer enabled:hover:bg-slate-50 dark:enabled:hover:bg-neutral-800/50 rounded-lg disabled:cursor-default">
                  <e.Icono className={`w-4 h-4 mt-0.5 shrink-0 ${e.clase}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[0.8125rem] font-medium leading-snug">
                      {l.tipo === 'cita' ? `Recordatorio a ${l.quien ?? l.para}` : l.tipo === 'prueba' ? 'Llamada de prueba' : `Aviso a ${l.quien ?? l.para}`}
                    </p>
                    <p className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">
                      {cuando(l.creadoEn)} · <span className={e.clase}>{e.texto}</span>
                      {l.respuesta && ` · ${QUE_MARCO[l.respuesta] ?? `Marcó ${l.respuesta}`}`}
                      {l.sede && ` · ${l.sede}`}
                    </p>
                  </div>
                  {l.appointmentId && <ChevronRight className="w-4 h-4 text-slate-300 mt-0.5 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

const CAMPOS: { campo: string; etiqueta: string; ejemplo: string }[] = [
  { campo: '{nombre}', etiqueta: 'Nombre', ejemplo: 'Viena' },
  { campo: '{cuando}', etiqueta: 'Día y hora', ejemplo: 'hoy a las 7 de la noche' },
  { campo: '{servicio}', etiqueta: 'Servicio', ejemplo: 'balayage con Karla' },
  { campo: '{sede}', etiqueta: 'Sede', ejemplo: 'Piantini' },
  { campo: '{salon}', etiqueta: 'Salón', ejemplo: 'tu salón' },
];
const SUGERIDO = 'Hola {nombre}, soy Lalán, la asistente de {salon}. Le recuerdo su cita de {servicio} {cuando}. Para confirmar, presione 1. Si necesita cambiarla, presione 2.';

/**
 * Lo que dice Lalán al llamar a la clienta, con las palabras del salón.
 * Los campos entre llaves se llenan con los datos de cada cita; si el texto
 * no dice que marque 1, Lalán lo agrega al final.
 */
const TextoDeLaLlamada: React.FC<{
  sede: { id: string; nombre: string; textoLlamadaCita: string | null };
  guardando: boolean; probando: boolean; puedeProbar: boolean;
  onGuardar: (texto: string) => void; onProbar: () => void;
}> = ({ sede, guardando, probando, puedeProbar, onGuardar, onProbar }) => {
  const [abierto, setAbierto] = useState(!!sede.textoLlamadaCita);
  const [texto, setTexto] = useState(sede.textoLlamadaCita ?? '');
  useEffect(() => { setTexto(sede.textoLlamadaCita ?? ''); }, [sede.textoLlamadaCita]);
  const cambiado = texto.trim() !== (sede.textoLlamadaCita ?? '').trim();
  const ejemplo = CAMPOS.reduce((t, c) => t.split(c.campo).join(c.ejemplo), texto.trim() || SUGERIDO);
  const poner = (campo: string) => setTexto((t) => `${t}${t && !t.endsWith(' ') ? ' ' : ''}${campo}`);

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="ml-0.5 text-[0.75rem] font-semibold text-[var(--primary)] flex items-center gap-1 cursor-pointer">
        <ChevronRight className="w-3.5 h-3.5" /> Lo que dice Lalán en {sede.nombre}
      </button>
    );
  }
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200 dark:border-neutral-700 p-3 space-y-2">
      <div className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-500">Lo que dice Lalán al llamar</div>
      <textarea value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 400))} rows={3} placeholder={SUGERIDO}
        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[16px] sm:text-[0.8125rem] leading-snug resize-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
      <div className="flex flex-wrap gap-1.5">
        {CAMPOS.map((c) => (
          <button key={c.campo} type="button" onClick={() => poner(c.campo)}
            className="px-2.5 py-1 rounded-full bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[0.6875rem] font-semibold text-slate-600 dark:text-neutral-300 cursor-pointer">
            + {c.etiqueta}
          </button>
        ))}
      </div>
      <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 leading-snug"><span className="font-semibold">Así suena:</span> «{ejemplo}»</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onGuardar(texto)} disabled={!cambiado || guardando}
          className="min-h-[36px] px-3.5 rounded-xl bg-[var(--primary)] text-white text-[0.8125rem] font-bold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer">
          {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Guardar
        </button>
        <button type="button" onClick={onProbar} disabled={!puedeProbar || probando || cambiado}
          title={cambiado ? 'Guarda primero el texto' : !puedeProbar ? 'Se puede cuando las llamadas estén encendidas y tengas tu teléfono' : 'Te llama a ti con este texto'}
          className="min-h-[36px] px-3.5 rounded-xl border border-slate-200 dark:border-neutral-700 text-[0.8125rem] font-semibold flex items-center gap-1.5 disabled:opacity-40 cursor-pointer">
          {probando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Phone className="w-3.5 h-3.5" />} Escucharla en mi teléfono
        </button>
        {sede.textoLlamadaCita && (
          <button type="button" onClick={() => { setTexto(''); onGuardar(''); }} disabled={guardando}
            className="min-h-[36px] px-2 text-[0.75rem] font-semibold text-slate-400 hover:text-slate-600 cursor-pointer">Volver al de siempre</button>
        )}
      </div>
    </div>
  );
};
