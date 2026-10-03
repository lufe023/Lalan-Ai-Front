import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, ChevronDown, Keyboard, Loader2, MessageSquareText, Mic, MoreHorizontal, RotateCcw, Send, Volume2, VolumeX, X } from 'lucide-react';
import { api, subirArchivo } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useEscucha } from '../../hooks/useEscucha';
import { AjustesLalan, ajustesLalan, cargarAjustesLalan, msDePausa, NOMBRE_PAUSA, type Pausa } from '../../utils/ajustesLalan';
import { PAPEL_TAPIZ_SALON } from './papelTapiz';
import {
  alCargarVoces, callarLalan, callarSiempre, contextoDeAudio, decirComoLalan, despertarVoz, estaCallada, guardarPausa, guardarSeguirEscuchando,
  guardarVoz, hayVoz, lalanHablando, pausaGuardada, prepararAudio, seguirEscuchando, soltarAudio, tonoEscucho, vozDeLalan, vocesEnEspanol,
} from '../../utils/vozLalan';
import { EsferaLalan, ModoEsfera } from './EsferaLalan';

interface Accion {
  id: string; tipo: 'indicacion' | 'mensaje'; resumen: string;
  estado: 'pendiente' | 'hecha' | 'descartada' | 'fallida'; resultado: string | null; conversacionId: string | null;
}
interface Mensaje { id: string; deLalan: boolean; texto: string; porVoz: boolean; creadoEn: string; accion: Accion | null }
interface Respuesta { mensajes: Mensaje[] }

const EVENTO_ABRIR = 'lalan:abrir';

/** Une dos listas de mensajes sin repetir (lo nuevo manda: trae la tarjeta al día) */
function juntar(antes: Mensaje[], nuevos: Mensaje[]): Mensaje[] {
  const ids = new Set(nuevos.map((m) => m.id));
  return [...antes.filter((m) => !ids.has(m.id)), ...nuevos].sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));
}

/** Abre la pantalla de Lalan desde cualquier lado (botón del menú, aviso…) */
export function abrirLalan() {
  // El toque que abre también "despierta" la voz y el micrófono en el iPhone.
  // En silencio no se toca la voz: en el iPhone, una voz "despierta" mientras se
  // abre el micrófono puede dejar la grabación muda.
  if (!estaCallada()) despertarVoz();
  prepararAudio();
  window.dispatchEvent(new Event(EVENTO_ABRIR));
}

/** Quién puede hablar con Lalan aquí: la administración del salón */
export function puedeHablarConLalan(rol?: string) {
  return rol === 'admin' || rol === 'super_admin';
}

/** Lo que dice la pastilla sobre la esfera. Para quien ya sabe usarla, la versión corta */
const TEXTO_ESTADO: Record<ModoEsfera, { nueva: string; sabe: string | null }> = {
  reposo: { nueva: 'Toca la esfera y háblame', sabe: null },
  escuchando: { nueva: 'Te escucho… (toca cuando termines)', sabe: 'Te escucho…' },
  pensando: { nueva: 'Pensando…', sabe: 'Pensando…' },
  hablando: { nueva: 'Toca para interrumpirme', sabe: null },
};
/** Después de tantas preguntas con la voz, ya sabe cómo funciona: menos ayudas en pantalla */
const YA_SABE_TRAS = 5;
/** Cuánto se ve la pastilla antes de desvanecerse */
const PASTILLA_MS = 3500;
const CLAVE_USOS = 'lalan_asistente_usos_voz';
const usosDeVoz = () => { try { return Number(localStorage.getItem(CLAVE_USOS)) || 0; } catch { return 0; } };
const contarUsoDeVoz = () => { try { localStorage.setItem(CLAVE_USOS, String(usosDeVoz() + 1)); } catch { /* noop */ } };

/**
 * La pantalla de Lalan, como Siri: una esfera que escucha, piensa y habla.
 * La persona toca y habla; cuando se calla, la frase se pasa a texto en el
 * servidor (su audio no se guarda) y Lalan responde con lo que sabe del
 * salón, en texto y con la voz del teléfono. Para escribirle a una clienta
 * solo propone: una tarjeta "¿Se lo mando?" que se confirma con un toque o
 * diciendo "sí".
 */
export const PantallaLalan: React.FC = () => {
  const { currentUser } = useAuth();
  const { navigateTo, setActiveConversationId } = useApp();
  const [abierta, setAbierta] = useState(false);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [cargando, setCargando] = useState(false);
  const [modo, setModo] = useState<ModoEsfera>('reposo');
  const [pulso, setPulso] = useState(0);
  const [error, setError] = useState('');
  const [escribiendo, setEscribiendo] = useState(false);
  const [texto, setTexto] = useState('');
  const [menu, setMenu] = useState(false);
  const [callada, setCallada] = useState(estaCallada);
  const calladaAhora = useRef(callada);
  calladaAhora.current = callada;
  const [voces, setVoces] = useState<SpeechSynthesisVoice[]>(vocesEnEspanol);
  const [vozActual, setVozActual] = useState<string | null>(() => vozDeLalan()?.name ?? null);
  const [resolviendo, setResolviendo] = useState<string | null>(null);
  const [aj, setAj] = useState<AjustesLalan>(ajustesLalan);
  // Lo que eligió este aparato; si nunca eligió, vale lo global (Plataforma → Lalan)
  const [seguirAqui, setSeguirAqui] = useState<boolean | null>(seguirEscuchando);
  const [pausaAqui, setPausaAqui] = useState<Pausa | null>(pausaGuardada);
  const seguir = seguirAqui ?? aj.seguirEscuchando;
  const pausa: Pausa = pausaAqui ?? aj.pausaPorDefecto;
  const [altoAbajo, setAltoAbajo] = useState(240);
  const abajo = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  /**
   * Para la conversación continua: si la persona viene hablando (no
   * escribiendo), cuando Lalan termina de hablar el micrófono se abre solo.
   */
  const conVoz = useRef(true);
  const vivo = useRef({ abierta: false, modo: 'reposo' as ModoEsfera, seguir: true, escribiendo: false });
  vivo.current = { abierta, modo, seguir, escribiendo };
  const escucharSola = useRef<() => void>(() => undefined);

  useEffect(() => {
    const abrir = () => setAbierta(true);
    window.addEventListener(EVENTO_ABRIR, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR, abrir);
  }, []);

  useEffect(() => alCargarVoces(() => { setVoces(vocesEnEspanol()); setVozActual(vozDeLalan()?.name ?? null); }), []);

  // Lo que mide la parte de abajo: la conversación deja ese espacio al final para que nada quede tapado
  useEffect(() => {
    const el = abajo.current;
    if (!el) return;
    const medir = () => setAltoAbajo(el.offsetHeight);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [abierta, escribiendo]);

  const bajar = () => requestAnimationFrame(() => lista.current?.scrollTo({ top: lista.current.scrollHeight, behavior: 'smooth' }));

  /** Lalan dice su último mensaje (si no está callada) */
  const decir = useCallback(async (t: string) => {
    // Se mira el silencio de AHORA (no el de cuando se hizo la pregunta): si la
    // pusieron en silencio mientras pensaba, ya no habla
    if (calladaAhora.current || !hayVoz() || !t.trim()) { setModo('reposo'); return; }
    setModo('hablando');
    await decirComoLalan(t, () => setPulso((p) => p + 1));
    // Terminó de hablar sola (no la interrumpieron): le toca a la persona
    const v = vivo.current;
    if (v.modo === 'hablando' && v.abierta && v.seguir && !v.escribiendo && conVoz.current) { escucharSola.current(); return; }
    setModo((m) => (m === 'hablando' ? 'reposo' : m));
  }, []);

  const recibir = useCallback((r: Respuesta, hablar = true) => {
    if (!r.mensajes.length) { setModo('reposo'); return; }
    setMensajes((antes) => juntar(antes, r.mensajes));
    bajar();
    const ultimo = [...r.mensajes].reverse().find((m) => m.deLalan);
    if (hablar && ultimo) void decir(ultimo.texto);
    else setModo('reposo');
  }, [decir]);

  const fallo = (e: unknown) => {
    setError((e as Error)?.message || 'Algo falló. Inténtalo otra vez.');
    setModo('reposo');
  };

  // Al abrir: la conversación de antes y, si hace rato que no hablan, el panorama del día
  useEffect(() => {
    if (!abierta) return;
    let vigente = true;
    setError('');
    setCargando(true);
    conVoz.current = true;
    void cargarAjustesLalan().then((a) => vigente && setAj(a));
    api.get<Respuesta>('/asistente')
      // Se mezcla: el panorama puede llegar antes que la lista
      .then((r) => { if (vigente) { setMensajes((antes) => juntar(r.mensajes, antes)); bajar(); } })
      .catch((e) => vigente && fallo(e))
      .finally(() => vigente && setCargando(false));
    setModo('pensando');
    api.post<Respuesta>('/asistente/panorama', {})
      .then((r) => vigente && recibir(r))
      .catch(() => vigente && setModo('reposo'));
    return () => { vigente = false; };
  }, [abierta]); // eslint-disable-line react-hooks/exhaustive-deps

  const escucha = useEscucha({
    esperaMs: msDePausa(pausa, aj),
    ajustes: ajustesLalan,
    contexto: contextoDeAudio,
    onFrase: async (audio) => {
      contarUsoDeVoz();
      setModo('pensando');
      const f = new FormData();
      const ext = audio.type.includes('webm') ? 'webm' : audio.type.includes('ogg') ? 'ogg' : 'm4a';
      f.append('audio', audio, `pregunta.${ext}`);
      try { recibir(await subirArchivo<Respuesta>('/asistente/voz', f)); } catch (e) { fallo(e); }
    },
    // Si la escucha se abrió sola y no dijo nada, se cierra sin quejarse
    onNada: (sola) => { setModo('reposo'); if (!sola) setError('No te escuché. Toca la esfera y háblame.'); },
    onError: (m) => { setModo('reposo'); setError(m); },
  });

  useEffect(() => { if (escucha.estado === 'escuchando') setModo('escuchando'); }, [escucha.estado]);

  escucharSola.current = () => {
    setModo('escuchando');
    if (!callada) tonoEscucho();
    void escucha.empezar(true);
  };

  /**
   * La pastilla de ayuda aparece suave cuando cambia algo (empieza a escuchar,
   * piensa, la silencian) y se desvanece sola: no se queda haciendo ruido
   * visual. A quien ya la usó varias veces ni siquiera le dice "toca la esfera".
   */
  const [pastilla, setPastilla] = useState<string | null>(null);
  const silencioAnterior = useRef(callada);
  useEffect(() => {
    if (!abierta) { setPastilla(null); return; }
    const cambioSilencio = silencioAnterior.current !== callada;
    silencioAnterior.current = callada;
    const sabe = usosDeVoz() >= YA_SABE_TRAS;
    const t = cambioSilencio
      ? (callada ? 'En silencio: te respondo solo por escrito' : 'Vuelvo a hablar en voz alta')
      : sabe ? TEXTO_ESTADO[modo].sabe : TEXTO_ESTADO[modo].nueva;
    setPastilla(t);
    if (!t) return;
    // "Pensando…" se queda mientras piensa; lo demás se va solo
    if (modo === 'pensando' && !cambioSilencio) return;
    const id = window.setTimeout(() => setPastilla(null), PASTILLA_MS);
    return () => window.clearTimeout(id);
  }, [modo, callada, abierta]);

  const tocarEsfera = () => {
    setError('');
    if (modo === 'pensando') return;
    if (escucha.estado === 'escuchando') { escucha.terminar(true); return; }
    // Primero se calla del todo y después se abre el micrófono: en el iPhone,
    // si la voz sigue activa al abrirlo, la grabación puede salir muda
    const hablaba = lalanHablando();
    callarLalan();
    prepararAudio();
    conVoz.current = true;
    setEscribiendo(false);
    setModo('escuchando');
    if (!callada) tonoEscucho();
    window.setTimeout(() => void escucha.empezar(), hablaba ? 250 : 0);
  };

  const enviarTexto = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = texto.trim();
    if (!t || modo === 'pensando') return;
    callarLalan();
    if (!callada) despertarVoz();
    conVoz.current = false;
    setTexto('');
    setError('');
    setModo('pensando');
    try { recibir(await api.post<Respuesta>('/asistente/mensaje', { texto: t })); } catch (err) { fallo(err); }
  };

  const resolver = async (a: Accion, confirmar: boolean) => {
    callarLalan();
    setResolviendo(a.id);
    setError('');
    try { recibir(await api.post<Respuesta>(`/asistente/acciones/${a.id}`, { confirmar })); } catch (e) { fallo(e); }
    finally { setResolviendo(null); }
  };

  const verChat = (id: string) => {
    cerrar();
    navigateTo('chats');
    setActiveConversationId(id);
  };

  const cerrar = () => {
    callarLalan();
    escucha.terminar(false);
    setMenu(false);
    setAbierta(false);
    setModo('reposo');
    soltarAudio();
  };

  const empezarDeNuevo = async () => {
    setMenu(false);
    callarLalan();
    try { await api.delete('/asistente'); setMensajes([]); } catch (e) { fallo(e); }
  };

  const cambiarCallada = () => {
    const nueva = !callada;
    calladaAhora.current = nueva;
    setCallada(nueva);
    callarSiempre(nueva);
    // Silenciar NO apaga el micrófono: solo que Lalan no hable. Si está escuchando, sigue escuchando
    if (nueva) { callarLalan(); setModo((m) => (m === 'hablando' ? 'reposo' : m)); }
    else despertarVoz();
  };

  const elegirVoz = (nombre: string) => {
    guardarVoz(nombre);
    setVozActual(nombre);
    void decirComoLalan('Hola, así sueno yo.');
  };

  if (!puedeHablarConLalan(currentUser?.role)) return null;

  return (
    <AnimatePresence>
      {abierta && (
        <motion.div
          key="lalan"
          role="dialog" aria-modal="true" aria-label="Lalan"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[300] flex flex-col bg-slate-50/90 dark:bg-neutral-950/92 backdrop-blur-2xl text-slate-900 dark:text-neutral-100"
          style={{ paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
        >
          {/* El fondo: dibujitos de salón, del color de la marca (como el fondo de WhatsApp) */}
          {aj.papelTapiz && aj.intensidadPapel > 0 && (
            <div aria-hidden="true" className="absolute inset-0 pointer-events-none"
              style={{
                backgroundColor: 'var(--primary)', opacity: aj.intensidadPapel / 100,
                WebkitMaskImage: `url("${PAPEL_TAPIZ_SALON}")`, maskImage: `url("${PAPEL_TAPIZ_SALON}")`,
                WebkitMaskSize: `${aj.tamanoPapel}px`, maskSize: `${aj.tamanoPapel}px`, WebkitMaskRepeat: 'repeat', maskRepeat: 'repeat',
              }} />
          )}
          <div className="relative w-full max-w-2xl mx-auto flex-1 min-h-0 flex flex-col">
            {/* Arriba */}
            <div className="flex items-center justify-between px-4 h-12 shrink-0">
              <div className="w-24 flex">
                <button type="button" onClick={cerrar} aria-label="Cerrar" className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-slate-500 dark:text-neutral-400 hover:bg-slate-200/60 dark:hover:bg-neutral-800 cursor-pointer">
                  <ChevronDown className="w-6 h-6" />
                </button>
              </div>
              <span className="text-[0.9375rem] font-bold tracking-tight">Lalan</span>
              <div className="relative w-24 flex justify-end gap-1">
                {/* Silencio con un toque: de noche, en una reunión… Lalan responde solo por escrito */}
                <button type="button" onClick={cambiarCallada} aria-pressed={callada}
                  aria-label={callada ? 'Lalan en silencio: tocar para que vuelva a hablar' : 'Silenciar a Lalan (solo texto)'}
                  title={callada ? 'En silencio' : 'Silenciar'}
                  className={`w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-colors ${callada
                    ? 'bg-[var(--primary)]/12 text-[var(--primary)]'
                    : 'text-slate-500 dark:text-neutral-400 hover:bg-slate-200/60 dark:hover:bg-neutral-800'}`}>
                  {callada ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>
                <button type="button" onClick={() => setMenu((m) => !m)} aria-label="Opciones de Lalan" aria-expanded={menu}
                  className="w-10 h-10 -mr-2 rounded-full flex items-center justify-center text-slate-500 dark:text-neutral-400 hover:bg-slate-200/60 dark:hover:bg-neutral-800 cursor-pointer">
                  <MoreHorizontal className="w-5 h-5" />
                </button>
                {menu && (
                  <div className="absolute right-0 top-11 z-10 w-72 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 shadow-xl p-2 text-[0.875rem]">
                    <button type="button" onClick={cambiarCallada} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-neutral-800 text-left cursor-pointer">
                      {callada ? <VolumeX className="w-4 h-4 text-slate-500" /> : <Volume2 className="w-4 h-4 text-[var(--primary)]" />}
                      <span className="flex-1">{callada ? 'Solo texto (sin voz)' : 'Lalan responde en voz alta'}</span>
                    </button>
                    {!callada && (
                      <button type="button" onClick={() => { const n = !seguir; setSeguirAqui(n); guardarSeguirEscuchando(n); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-neutral-800 text-left cursor-pointer">
                        <Mic className={`w-4 h-4 ${seguir ? 'text-[var(--primary)]' : 'text-slate-500'}`} />
                        <span className="flex-1">Seguir escuchando cuando Lalan termina</span>
                        <span className={`relative w-9 h-5 rounded-full shrink-0 transition-colors ${seguir ? 'bg-[var(--primary)]' : 'bg-slate-300 dark:bg-neutral-700'}`} aria-hidden="true">
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${seguir ? 'left-[18px]' : 'left-0.5'}`} />
                        </span>
                      </button>
                    )}
                    <div className="px-3 pt-2 pb-1">
                      <div className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Cuánto espero cuando te callas</div>
                      <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-neutral-800">
                        {(Object.keys(NOMBRE_PAUSA) as Pausa[]).map((p) => (
                          <button key={p} type="button" onClick={() => { setPausaAqui(p); guardarPausa(p); }} aria-pressed={pausa === p}
                            className={`py-1.5 rounded-lg text-[0.8125rem] font-semibold cursor-pointer ${pausa === p ? 'bg-white dark:bg-neutral-900 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}>
                            {NOMBRE_PAUSA[p]}
                          </button>
                        ))}
                      </div>
                      <div className="text-[0.6875rem] text-slate-400 mt-1">{(msDePausa(pausa, aj) / 1000).toLocaleString('es-DO')} segundos de silencio y te respondo.</div>
                    </div>
                    {voces.length > 0 && !callada && (
                      <div className="px-3 pt-2 pb-1">
                        <div className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Voz en este aparato</div>
                        <div className="max-h-52 overflow-y-auto -mx-1">
                          {voces.map((v) => (
                            <button key={v.name} type="button" onClick={() => elegirVoz(v.name)}
                              className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 text-left cursor-pointer">
                              <span className="w-4 shrink-0">{vozActual === v.name && <Check className="w-4 h-4 text-[var(--primary)]" />}</span>
                              <span className="flex-1 truncate">{v.name}</span>
                              <span className="text-[0.6875rem] text-slate-400 shrink-0">{v.lang}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <button type="button" onClick={() => void empezarDeNuevo()} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-neutral-800 text-left cursor-pointer">
                      <RotateCcw className="w-4 h-4 text-slate-500" /> <span>Empezar de nuevo</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="relative flex-1 min-h-0">
            {/* La conversación: corre por detrás de la esfera (abajo es transparente) */}
            <div ref={lista} className="absolute inset-0 overflow-y-auto px-5 pt-4 space-y-5" style={{ paddingBottom: altoAbajo + 8 }} aria-live="polite">
              {cargando && !mensajes.length && (
                <div className="flex justify-center py-10 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
              )}
              {!cargando && !mensajes.length && modo !== 'pensando' && (
                <div className="text-center py-10 space-y-2 text-slate-500 dark:text-neutral-400">
                  <p className="text-lg font-semibold text-slate-800 dark:text-neutral-100" style={{ textWrap: 'balance' }}>¿En qué te ayudo?</p>
                  <p className="text-[0.875rem]">Prueba: «¿Cómo se ve mi día?», «¿Quién me está esperando?» o «Dile a Ana que sí la esperamos a las 3».</p>
                </div>
              )}
              {mensajes.map((m) => (
                m.deLalan ? (
                  <div key={m.id} className="space-y-2.5 max-w-[92%]">
                    <p className="text-[1.0625rem] leading-relaxed text-slate-800 dark:text-neutral-100 whitespace-pre-line">{m.texto}</p>
                    {m.accion && <TarjetaAccion accion={m.accion} ocupada={resolviendo === m.accion.id} onResolver={resolver} onVerChat={verChat} />}
                  </div>
                ) : (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] px-4 py-2.5 rounded-3xl rounded-br-lg bg-[var(--primary)] text-white text-[0.9375rem] leading-snug">
                      {m.porVoz && <Mic className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5 opacity-80" aria-label="Dicho con la voz" />}
                      {m.texto}
                    </div>
                  </div>
                )
              ))}
            </div>

            {/* Abajo: la esfera, flotando sobre la conversación */}
            <div ref={abajo} className="absolute inset-x-0 bottom-0 px-5 pt-10 flex flex-col items-center gap-2 pointer-events-none [&>*]:pointer-events-auto bg-gradient-to-t from-slate-50/75 via-slate-50/25 to-transparent dark:from-neutral-950/75 dark:via-neutral-950/25">
              {error && <p className="text-[0.8125rem] font-semibold text-rose-600 dark:text-rose-400 text-center" role="alert">{error}</p>}
              {escribiendo ? (
                <form onSubmit={enviarTexto} className="w-full flex items-center gap-2 py-2">
                  <button type="button" onClick={tocarEsfera} aria-label="Hablarle con la voz" className="shrink-0 cursor-pointer">
                    <EsferaLalan modo={modo} nivel={escucha.nivel} pulso={pulso} tamano={48} />
                  </button>
                  <input ref={entrada} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escríbele a Lalan…" autoFocus
                    className="flex-1 min-w-0 px-4 py-3 rounded-full bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-[0.9375rem] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
                  <button type="submit" disabled={!texto.trim() || modo === 'pensando'} aria-label="Enviar"
                    className="w-11 h-11 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shrink-0 disabled:opacity-40 cursor-pointer">
                    {modo === 'pensando' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                </form>
              ) : (
                <>
                  <div className="w-full flex items-center justify-between">
                    <span className="w-11" />
                    <div className="relative">
                    {/* La pastilla, pegada a la esfera; aparece y se desvanece suave */}
                    <AnimatePresence>
                      {pastilla && (
                        <motion.p key={pastilla} role="status"
                          initial={{ opacity: 0, y: 6, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.35, ease: 'easeOut' }}
                          className="absolute left-1/2 z-10 whitespace-nowrap text-[0.8125rem] font-medium text-slate-600 dark:text-neutral-300 px-3 py-1 rounded-full bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md shadow-sm pointer-events-none"
                          style={{ bottom: `calc(100% - ${Math.round(aj.tamanoEsfera * 0.16)}px)`, x: '-50%' }}>
                          {pastilla}
                        </motion.p>
                      )}
                    </AnimatePresence>
                    <button type="button" onClick={tocarEsfera} aria-label={modo === 'escuchando' ? 'Ya terminé' : 'Hablarle a Lalan'}
                      className="relative rounded-full cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]">
                      <EsferaLalan modo={modo} nivel={escucha.nivel} pulso={pulso} tamano={aj.tamanoEsfera} />
                      {/* Se llena cuando la persona se calla: se ve venir el envío y se puede seguir hablando */}
                      {modo === 'escuchando' && escucha.cierre > 0 && (
                        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" aria-hidden="true">
                          <circle cx="50" cy="50" r="40" fill="none" stroke="var(--primary)" strokeOpacity="0.9" strokeWidth="2.5" strokeLinecap="round"
                            strokeDasharray={`${escucha.cierre * 251.3} 251.3`} />
                        </svg>
                      )}
                    </button>
                    </div>
                    <button type="button" onClick={() => { escucha.terminar(false); setEscribiendo(true); }} aria-label="Escribirle"
                      className="w-11 h-11 rounded-full flex items-center justify-center text-slate-500 dark:text-neutral-400 hover:bg-slate-200/60 dark:hover:bg-neutral-800 cursor-pointer">
                      <Keyboard className="w-5 h-5" />
                    </button>
                  </div>
                </>
              )}
            </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/** "¿Se lo mando?": lo que Lalan propone hacer, con Sí / No */
const TarjetaAccion: React.FC<{ accion: Accion; ocupada: boolean; onResolver: (a: Accion, si: boolean) => void; onVerChat: (id: string) => void }> = ({ accion, ocupada, onResolver, onVerChat }) => {
  const titulo = accion.tipo === 'indicacion' ? 'Indicación para Lalan en el chat' : 'Mensaje para la clienta';
  return (
    <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 shadow-sm p-3.5 space-y-2.5">
      <div className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400">{titulo}</div>
      <p className="text-[0.875rem] leading-snug text-slate-700 dark:text-neutral-200">{accion.resumen.replace(/^(Indicación para Lalan en el chat de |Mensaje para )/, '')}</p>
      {accion.estado === 'pendiente' ? (
        <div className="flex items-center gap-2">
          <button type="button" disabled={ocupada} onClick={() => onResolver(accion, true)}
            className="flex-1 py-2.5 rounded-xl bg-[var(--primary)] text-white text-[0.875rem] font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer">
            {ocupada ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Sí, mándalo
          </button>
          <button type="button" disabled={ocupada} onClick={() => onResolver(accion, false)}
            className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 text-[0.875rem] font-semibold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer">
            <X className="w-4 h-4" /> No
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 text-[0.8125rem]">
          <span className={`font-semibold ${accion.estado === 'hecha' ? 'text-emerald-600' : accion.estado === 'fallida' ? 'text-rose-600' : 'text-slate-400'}`}>
            {accion.estado === 'hecha' ? 'Enviado' : accion.estado === 'fallida' ? `No salió${accion.resultado ? `: ${accion.resultado}` : ''}` : 'No se mandó'}
          </span>
          {accion.conversacionId && (
            <button type="button" onClick={() => onVerChat(accion.conversacionId!)} className="font-semibold text-[var(--primary)] flex items-center gap-1 cursor-pointer">
              <MessageSquareText className="w-4 h-4" /> Ver el chat
            </button>
          )}
        </div>
      )}
    </div>
  );
};

/** El botón flotante (móvil): la esfera chiquita, siempre a mano */
export const BotonLalan: React.FC = () => {
  const { currentUser } = useAuth();
  if (!puedeHablarConLalan(currentUser?.role)) return null;
  return (
    <button type="button" onClick={abrirLalan} aria-label="Hablar con Lalan" data-medir="Abrir Lalan"
      className="lg:hidden absolute right-3 bottom-3 z-40 rounded-full shadow-lg shadow-[var(--primary)]/30 cursor-pointer active:scale-95 transition-transform">
      <EsferaLalan modo="reposo" tamano={56} />
    </button>
  );
};
