import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { animate, AnimatePresence, motion, useMotionValue } from 'motion/react';
import { Check, FileDown, FileText, Images, Keyboard, Loader2, MapPin, MessageSquareText, Mic, MicOff, Minimize2, MoreHorizontal, Navigation, RotateCcw, Send, Sparkles, ThumbsDown, ThumbsUp, Trash2, Volume2, VolumeX, X } from 'lucide-react';
import { api, subirArchivo } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { avisarCambioBienvenida } from '../../services/bienvenida';
import { useAuth } from '../../context/AuthContext';
import { useEscucha } from '../../hooks/useEscucha';
import { useVistaVisible } from '../../hooks/useVistaVisible';
import { AjustesLalan, ajustesLalan, cargarAjustesLalan, msDePausa, NOMBRE_PAUSA, VOCES_AURA, type Pausa } from '../../utils/ajustesLalan';
import { FondoVivo } from '../ui/FondoVivo';
import { PAPEL_TAPIZ_SALON } from './papelTapiz';
import {
  alCargarVoces, callarLalan, callarSiempre, contextoDeAudio, decirComoLalan, despertarVoz, estaCallada, guardarPausa, guardarSeguirEscuchando,
  auraElegida, guardarInterrumpir, guardarVoz, hayVoz, interrumpirGuardado, lalanHablando, pausaGuardada, pausarLalan, prepararAudio, seguirEscuchando,
  seguirLalan, soltarAudio, tonoEscucho, usaVozDeNube, vozDeLalan, vozDeNube, vocesEnEspanol,
} from '../../utils/vozLalan';
import { vigilarInterrupcion, type Interrupcion } from '../../utils/interrupcion';
import { EsferaLalan, ModoEsfera } from './EsferaLalan';
import { ElegirEsfera } from './ElegirEsfera';
import { iniciarGuia } from '../guias/GuiaEnCurso';
import { guiaPorId } from '../../data/guias';
import { descargarPlan, MisPlanes } from './MisPlanes';
import { VerComo } from '../minitutoriales/VerComo';

interface Accion {
  id: string; tipo: 'indicacion' | 'mensaje' | 'servicio' | 'rendimiento' | 'guia' | 'documento' | 'tutorial' | 'recuerdo'; resumen: string;
  estado: 'pendiente' | 'hecha' | 'descartada' | 'fallida'; resultado: string | null; conversacionId: string | null;
  /** "Llévame": la tarea a la que lleva y en qué sede */
  guia?: GuiaTarjeta | null;
  /** Un plan guardado: cuál es, para descargarlo en PDF */
  documento?: DocumentoTarjeta | null;
  /** "Ver cómo": un minitutorial con fotos de algo que se hace fuera de la app */
  tutorial?: TutorialTarjeta | null;
}
interface TutorialTarjeta { tema: string; nombre: string }
interface DocumentoTarjeta { id: string; titulo: string; sede: string }
interface GuiaTarjeta { id: string; nombre: string; sedeId: string | null; sede: string | null }
interface Mensaje {
  id: string; deLalan: boolean; texto: string; porVoz: boolean; creadoEn: string; accion: Accion | null; util?: boolean | null;
  /** Se pinta al tocar Enviar, antes de que el servidor conteste (lo hablado sale con puntitos hasta tener su texto) */
  enviando?: boolean;
}
/** `seguir`: le habló encima y no dijo nada que pida respuesta: Lalan sigue donde iba */
interface Respuesta { mensajes: Mensaje[]; seguir?: boolean }

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

/**
 * Lalan en burbuja: se minimiza (o se va con "Llévame") y sigue la charla
 * desde una esfera flotante. El botón de siempre se esconde mientras tanto
 * para que no haya dos esferas.
 */
let enBurbuja = false;
const oyentesBurbuja = new Set<() => void>();
function ponerBurbuja(v: boolean) {
  if (enBurbuja === v) return;
  enBurbuja = v;
  oyentesBurbuja.forEach((f) => f());
}
function useEnBurbuja() {
  return useSyncExternalStore((f) => { oyentesBurbuja.add(f); return () => { oyentesBurbuja.delete(f); }; }, () => enBurbuja);
}

/** Quién puede hablar con Lalan aquí: la administración del salón */
export function puedeHablarConLalan(rol?: string) {
  return rol === 'admin' || rol === 'super_admin';
}

/** Lo que dice la pastilla sobre la esfera. Para quien ya sabe usarla, la versión corta */
/**
 * En PC (1024 px o más) la pantalla se reparte en dos paneles: la esfera a
 * un lado y la conversación al otro. La columna de teléfono estirada a un
 * monitor se veía vacía, con la esfera tapando el texto.
 */
const ESCRITORIO = '(min-width: 1024px)';
function usePantallaGrande() {
  const [grande, setGrande] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(ESCRITORIO).matches);
  useEffect(() => {
    const mq = window.matchMedia?.(ESCRITORIO);
    if (!mq) return;
    const cambio = () => setGrande(mq.matches);
    mq.addEventListener('change', cambio);
    return () => mq.removeEventListener('change', cambio);
  }, []);
  return grande;
}

/** Para empezar sin pensar qué decir (en PC, al lado de la esfera) */
const SUGERENCIAS = ['¿Cómo se ve mi día?', '¿Quién me está esperando?', '¿Qué se está acabando en el inventario?'];

/** Los paneles de PC: vidrio sobre el fondo, como las tarjetas del quiosco */
const VIDRIO = 'rounded-[2rem] bg-white/65 dark:bg-neutral-900/55 backdrop-blur-xl border border-white/70 dark:border-white/10 shadow-xl shadow-black/[0.04]';

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
  const { navigateTo, activeConversationId, setActiveConversationId, recargarCatalogo, currentScreen } = useApp();
  const [abierta, setAbierta] = useState(false);
  const burbuja = useEnBurbuja();
  // La esfera del teléfono tirada al zafacón con Lalan cerrada: se guarda solo un rato. En el teléfono no hay
  // otra forma de llamar a Lalan, así que vuelve al cambiar de pantalla o al regresar a la app.
  const [esferaGuardada, setEsferaGuardada] = useState(false);
  useEffect(() => { setEsferaGuardada(false); }, [currentScreen]);
  useEffect(() => {
    const alVolver = () => { if (document.visibilityState === 'visible') setEsferaGuardada(false); };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, []);
  // Lo que dijo mientras estaba en burbuja (útil en silencio, cuando no habla)
  const [sinLeer, setSinLeer] = useState(false);
  /** La conversación sigue viva (abierta o en burbuja): al volver no se recarga */
  const sesionViva = useRef(false);
  const sesion = useRef(0);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [cargando, setCargando] = useState(false);
  const [modo, setModo] = useState<ModoEsfera>('reposo');
  const [pulso, setPulso] = useState(0);
  const [error, setError] = useState('');
  const hayRuido = useRef(false);
  // Los avisos se van solos: no se quedan en rojo toda la conversación
  useEffect(() => {
    if (!error) return;
    const id = window.setTimeout(() => setError(''), 7000);
    return () => window.clearTimeout(id);
  }, [error]);
  const [escribiendo, setEscribiendo] = useState(false);
  const [texto, setTexto] = useState('');
  const [menu, setMenu] = useState(false);
  const [verPlanes, setVerPlanes] = useState(false);
  const [uso, setUso] = useState<Uso | null>(null);
  // Al abrir el menú: cuánto le queda (preguntas de hoy, voz del mes, mensajes del plan)
  useEffect(() => {
    if (!menu) return;
    api.get<Uso>('/asistente/uso').then(setUso).catch(() => undefined);
  }, [menu]);
  const [callada, setCallada] = useState(estaCallada);
  const calladaAhora = useRef(callada);
  calladaAhora.current = callada;
  const [voces, setVoces] = useState<SpeechSynthesisVoice[]>(vocesEnEspanol);
  // Lo elegido en este aparato: "nube…" (la voz natural) o el nombre de una voz del teléfono
  const [vozActual, setVozActual] = useState<string | null>(() => (usaVozDeNube() ? vozDeNube(auraElegida()) : vozDeLalan()?.name ?? null));
  const [resolviendo, setResolviendo] = useState<string | null>(null);
  const [aj, setAj] = useState<AjustesLalan>(ajustesLalan);
  // El fondo lo elige el super admin en Plataforma → Lalan: dibujitos o el del quiosco
  const fondoQuiosco = aj.fondoLalan === 'quiosco';
  // Lo que eligió este aparato; si nunca eligió, vale lo global (Plataforma → Lalan)
  const [seguirAqui, setSeguirAqui] = useState<boolean | null>(seguirEscuchando);
  const [pausaAqui, setPausaAqui] = useState<Pausa | null>(pausaGuardada);
  const seguir = seguirAqui ?? aj.seguirEscuchando;
  // Interrumpirla hablándole: Plataforma lo apaga para todos; si está encendido, cada aparato puede apagarlo
  const [interrumpirAqui, setInterrumpirAqui] = useState<boolean | null>(interrumpirGuardado);
  const interrumpir = aj.interrumpirConVoz && (interrumpirAqui ?? true);
  const pausa: Pausa = pausaAqui ?? aj.pausaPorDefecto;
  const pausaAhora = useRef(pausa);
  pausaAhora.current = pausa;
  const [altoAbajo, setAltoAbajo] = useState(240);
  const grande = usePantallaGrande();
  const abajo = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLDivElement>(null);
  const entrada = useRef<HTMLInputElement>(null);
  /**
   * Para la conversación continua: si la persona viene hablando (no
   * escribiendo), cuando Lalan termina de hablar el micrófono se abre solo.
   */
  const conVoz = useRef(true);
  const vivo = useRef({ abierta: false, modo: 'reposo' as ModoEsfera, seguir: true, escribiendo: false, interrumpir: true });
  // En burbuja la charla sigue: cuenta como abierta para seguir escuchando
  vivo.current = { abierta: abierta || burbuja, modo, seguir, escribiendo, interrumpir };
  const escucharSola = useRef<() => void>(() => undefined);
  /** El micrófono atento mientras Lalan habla (para interrumpirla) */
  const oido = useRef<Interrupcion | null>(null);
  const [nivelOido, setNivelOido] = useState(0);
  /** Cada vez que Lalan empieza a decir algo: lo de una vez anterior ya no decide nada */
  const decires = useRef(0);
  const preguntarConVozRef = useRef<(audio: Blob, interrumpio?: boolean) => void>(() => undefined);
  const soltarOido = () => { oido.current?.soltar(); oido.current = null; setNivelOido(0); };

  useEffect(() => {
    const abrir = () => { ponerBurbuja(false); setSinLeer(false); setAbierta(true); };
    window.addEventListener(EVENTO_ABRIR, abrir);
    return () => window.removeEventListener(EVENTO_ABRIR, abrir);
  }, []);

  useEffect(() => alCargarVoces(() => { setVoces(vocesEnEspanol()); if (!usaVozDeNube()) setVozActual(vozDeLalan()?.name ?? null); }), []);
  // Los ajustes llegan después de abrir: si Plataforma tiene la voz natural, el menú la marca
  useEffect(() => { setVozActual(usaVozDeNube() ? vozDeNube(auraElegida()) : vozDeLalan()?.name ?? null); }, [aj.motorVoz]);

  // Lo que mide la parte de abajo: la conversación deja ese espacio al final para que nada quede tapado
  useEffect(() => {
    const el = abajo.current;
    if (!el) return;
    const medir = () => setAltoAbajo(el.offsetHeight);
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, [abierta, escribiendo, grande]);

  const bajar = () => requestAnimationFrame(() => lista.current?.scrollTo({ top: lista.current.scrollHeight, behavior: 'smooth' }));

  // Con el teclado abierto la pantalla se ajusta a lo que se ve y baja al último mensaje
  const vista = useVistaVisible(abierta);
  const conTeclado = !!vista?.teclado;
  useEffect(() => { if (conTeclado) bajar(); }, [conTeclado, vista?.alto]);

  /**
   * Mientras Lalan habla, el micrófono queda atento (si viene hablando, no
   * escribiendo): si le hablan encima se pausa; si no le dijeron nada, sigue;
   * si de verdad le dijeron algo, la frase se manda como pregunta.
   */
  const armarOido = (mia: number) => {
    soltarOido();
    const v = vivo.current;
    if (!v.interrumpir || !conVoz.current || v.escribiendo || !v.abierta) return;
    const a = ajustesLalan();
    void vigilarInterrupcion({
      ajustes: { vozParaPausarMs: a.vozParaPausarMs, retomarTrasMs: a.retomarTrasMs, sensibilidad: a.sensibilidadInterrupcion, esperaMs: msDePausa(pausaAhora.current, a) },
      contexto: contextoDeAudio(),
      suena: lalanHablando,
      pausar: () => { pausarLalan(); setModo('escuchando'); },
      seguir: () => { seguirLalan(); setNivelOido(0); setModo('hablando'); },
      tomarTurno: () => { conVoz.current = true; },
      alTerminar: (audio) => { oido.current = null; setNivelOido(0); preguntarConVozRef.current(audio, true); },
      alNivel: setNivelOido,
    }).then((o) => {
      // Lalan ya terminó (o la callaron) mientras se abría el micrófono
      if (o && mia !== decires.current) { o.soltar(); return; }
      oido.current = o;
    });
  };

  /** Lalan dice su último mensaje (si no está callada) */
  const decir = useCallback(async (t: string) => {
    // Se mira el silencio de AHORA (no el de cuando se hizo la pregunta): si la
    // pusieron en silencio mientras pensaba, ya no habla
    if (calladaAhora.current || !hayVoz() || !t.trim()) { setModo('reposo'); return; }
    const mia = ++decires.current;
    setModo('hablando');
    armarOido(mia);
    await decirComoLalan(t, () => setPulso((p) => p + 1));
    // Ya empezó a decir otra cosa, o la persona tomó la palabra: esto ya no decide nada
    if (mia !== decires.current || oido.current?.enTurno()) return;
    soltarOido();
    // Terminó de hablar sola (no la interrumpieron): le toca a la persona
    const v = vivo.current;
    if (v.modo === 'hablando' && v.abierta && v.seguir && !v.escribiendo && conVoz.current) { escucharSola.current(); return; }
    setModo((m) => (m === 'hablando' ? 'reposo' : m));
  }, []);

  /** `pintado`: el mensaje que se pintó al enviar; lo reemplaza el que guardó el servidor */
  const recibir = useCallback((r: Respuesta, hablar = true, pintado?: string) => {
    if (pintado) setMensajes((antes) => antes.filter((m) => m.id !== pintado));
    if (!r.mensajes.length) { setModo('reposo'); return; }
    setMensajes((antes) => juntar(antes.filter((m) => m.id !== pintado), r.mensajes));
    if (enBurbuja && r.mensajes.some((m) => m.deLalan)) setSinLeer(true);
    // Guardó un servicio o un rendimiento (con el botón o diciendo "sí"): el catálogo y el aviso de la Bienvenida se ponen al día
    if (r.mensajes.some((m) => m.accion && (m.accion.tipo === 'servicio' || m.accion.tipo === 'rendimiento') && m.accion.estado === 'hecha')) {
      void recargarCatalogo();
      avisarCambioBienvenida();
    }
    bajar();
    const ultimo = [...r.mensajes].reverse().find((m) => m.deLalan);
    if (hablar && ultimo) void decir(ultimo.texto);
    else setModo('reposo');
  }, [decir, recargarCatalogo]);

  /** Lo que la persona manda sale en pantalla al instante, sin esperar al servidor */
  const pintar = (texto: string, porVoz: boolean) => {
    const id = `enviando-${Date.now()}`;
    setMensajes((ms) => [...ms, { id, deLalan: false, texto, porVoz, creadoEn: new Date().toISOString(), accion: null, enviando: true }]);
    bajar();
    return id;
  };
  const despintar = (id: string) => setMensajes((ms) => ms.filter((m) => m.id !== id));

  const fallo = (e: unknown) => {
    setError((e as Error)?.message || 'Algo falló. Inténtalo otra vez.');
    setModo('reposo');
  };

  // Al abrir: la conversación de antes y, si hace rato que no hablan, el panorama del día
  useEffect(() => {
    if (!abierta) return;
    // Vuelve de la burbuja: la conversación ya está aquí
    if (sesionViva.current) { bajar(); return; }
    sesionViva.current = true;
    // Lo que llegue después de cerrarla del todo ya no se pinta (minimizar no la corta)
    const mia = ++sesion.current;
    const vigente = () => sesion.current === mia;
    setError('');
    setCargando(true);
    conVoz.current = true;
    // La voz (aparato o Cloudflare) sale de los ajustes: se esperan antes de que Lalan hable
    const ajustesListos = cargarAjustesLalan().then((a) => { if (vigente()) setAj(a); return a; });
    api.get<Respuesta>('/asistente')
      // Se mezcla: el panorama puede llegar antes que la lista
      .then((r) => { if (vigente()) { setMensajes((antes) => juntar(r.mensajes, antes)); bajar(); } })
      .catch((e) => vigente() && fallo(e))
      .finally(() => vigente() && setCargando(false));
    setModo('pensando');
    api.post<Respuesta>('/asistente/panorama', {})
      .then(async (r) => { await ajustesListos; if (vigente()) recibir(r); })
      .catch(() => vigente() && setModo('reposo'));
  }, [abierta]); // eslint-disable-line react-hooks/exhaustive-deps

  const escucha = useEscucha({
    esperaMs: msDePausa(pausa, aj),
    ajustes: ajustesLalan,
    contexto: contextoDeAudio,
    onFrase: (audio) => preguntarConVozRef.current(audio),
    // Si la escucha se abrió sola y no dijo nada, se cierra sin quejarse
    onNada: (sola) => {
      setModo('reposo');
      if (sola) return;
      setError(hayRuido.current
        ? 'Hay mucho ruido y no te escuché. Acerca el teléfono a la boca, o escríbeme.'
        : 'No te escuché. Toca la esfera y háblame.');
    },
    onError: (m) => { setModo('reposo'); setError(m); },
  });

  /**
   * Lo dicho va al servidor (se pasa a texto allá). Su burbuja sale de una vez
   * con puntitos. `interrumpio`: lo dijo encima de Lalan, que sigue en pausa:
   * si no era nada ("ajá", un ruido), ella sigue donde iba.
   */
  preguntarConVozRef.current = async (audio: Blob, interrumpio = false) => {
    contarUsoDeVoz();
    setModo('pensando');
    const pintado = pintar('', true);
    const f = new FormData();
    const ext = audio.type.includes('webm') ? 'webm' : audio.type.includes('ogg') ? 'ogg' : 'm4a';
    f.append('audio', audio, `pregunta.${ext}`);
    if (interrumpio) f.append('interrumpio', '1');
    try {
      const r = await subirArchivo<Respuesta>('/asistente/voz', f);
      if (interrumpio && r.seguir) {
        despintar(pintado);
        seguirLalan();
        setModo('hablando');
        armarOido(decires.current);
        return;
      }
      // Lo que decía antes ya no sigue
      if (interrumpio) { decires.current++; callarLalan(); }
      recibir(r, true, pintado);
    } catch (e) {
      despintar(pintado);
      if (interrumpio) { decires.current++; callarLalan(); }
      fallo(e);
    }
  };

  useEffect(() => { if (escucha.estado === 'escuchando') setModo('escuchando'); }, [escucha.estado]);
  /** La esfera se mueve con quien habla: con la escucha de siempre o hablándole encima a Lalan */
  const nivelEsfera = escucha.estado === 'escuchando' ? escucha.nivel : nivelOido;
  hayRuido.current = escucha.ruidoso;

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
    // Tocar mientras se le habla encima: se deja de vigilar y se escucha como siempre
    soltarOido();
    decires.current++;
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

  const enviarTexto = (e: React.FormEvent) => {
    e.preventDefault();
    void enviar(texto);
  };

  /** Mandarle algo por escrito (lo tecleado o una sugerencia) */
  const enviar = async (escrito: string) => {
    const t = escrito.trim();
    if (!t || modo === 'pensando') return;
    soltarOido();
    decires.current++;
    callarLalan();
    if (!callada) despertarVoz();
    conVoz.current = false;
    setTexto('');
    setError('');
    setModo('pensando');
    const pintado = pintar(t, false);
    try { recibir(await api.post<Respuesta>('/asistente/mensaje', { texto: t }), true, pintado); }
    catch (err) {
      // No se perdió lo escrito: vuelve al cuadro para mandarlo otra vez
      despintar(pintado);
      setTexto((ahora) => ahora || t);
      fallo(err);
    }
  };

  /**
   * Dejar de escuchar sin cerrar a Lalan ni quitar el permiso: suelta el
   * micrófono y no se vuelve a abrir solo hasta que toque la esfera otra vez.
   */
  const dejarDeEscuchar = () => {
    conVoz.current = false;
    escucha.terminar(false);
    if (oido.current) { soltarOido(); decires.current++; callarLalan(); }
    setModo('reposo');
  };

  const resolver = async (a: Accion, confirmar: boolean) => {
    callarLalan();
    setResolviendo(a.id);
    setError('');
    try { recibir(await api.post<Respuesta>(`/asistente/acciones/${a.id}`, { confirmar })); } catch (e) { fallo(e); }
    finally { setResolviendo(null); }
  };

  const verChat = (id: string) => {
    minimizar();
    navigateTo('chats');
    setActiveConversationId(id);
  };

  /** "Llévame": Lalan se hace burbuja (sigue oyendo) y la app señala dónde tocar */
  const llevame = (g: GuiaTarjeta) => {
    minimizar();
    iniciarGuia(g.id, g.sedeId, g.sede);
  };

  /** A la burbuja: la pantalla se va, la charla sigue (voz, micrófono y animación) */
  const minimizar = () => {
    setMenu(false);
    setEscribiendo(false);
    setAbierta(false);
    ponerBurbuja(true);
  };

  /** Cerrarla del todo: se calla, suelta el micrófono y vuelve el botón de siempre */
  const cerrar = () => {
    ponerBurbuja(false);
    sesionViva.current = false;
    sesion.current++;
    setSinLeer(false);
    soltarOido();
    decires.current++;
    callarLalan();
    escucha.terminar(false);
    setMenu(false);
    setAbierta(false);
    setModo('reposo');
    soltarAudio();
  };

  /** 👍 / 👎: si le sirvió la respuesta (tocar otra vez lo quita) */
  const calificar = async (id: string, util: boolean | null) => {
    const antes = mensajes.find((m) => m.id === id)?.util ?? null;
    setMensajes((ms) => ms.map((m) => (m.id === id ? { ...m, util } : m)));
    try { await api.put(`/asistente/mensajes/${id}/util`, { util }); }
    catch { setMensajes((ms) => ms.map((m) => (m.id === id ? { ...m, util: antes } : m))); }
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
    if (nueva) { soltarOido(); decires.current++; callarLalan(); setModo((m) => (m === 'hablando' ? 'reposo' : m)); }
    else despertarVoz();
  };

  const elegirVoz = (nombre: string) => {
    guardarVoz(nombre);
    setVozActual(nombre);
    void decirComoLalan('Hola, así sueno yo.');
  };

  if (!puedeHablarConLalan(currentUser?.role)) return null;

  return (
    <>
    <BurbujaLalan visible={!abierta && (burbuja || (!grande && !activeConversationId && !esferaGuardada))} viva={burbuja} modo={modo} nivel={nivelEsfera} pulso={pulso} cierre={escucha.cierre}
      sinLeer={sinLeer} onAbrir={abrirLalan} onCerrar={() => { if (burbuja) cerrar(); else setEsferaGuardada(true); }} />
    <AnimatePresence>
      {abierta && (
        <motion.div
          key="lalan"
          role="dialog" aria-modal="true" aria-label="Lalan"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={`fixed inset-0 z-[300] flex flex-col backdrop-blur-2xl text-slate-900 dark:text-neutral-100 ${fondoQuiosco ? 'bg-[#fbf7f8] dark:bg-[#0c0a0b]' : 'bg-slate-50/90 dark:bg-neutral-950/92'}`}
          style={vista && conTeclado
            // Encima del teclado: el teclado ya tapa la raya de abajo del iPhone
            ? { top: vista.arriba, height: vista.alto, bottom: 'auto', paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)', paddingBottom: 4 }
            : { paddingTop: 'max(env(safe-area-inset-top, 0px), 12px)', paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
        >
          {/* El del quiosco: manchas de color que se mueven despacio */}
          {fondoQuiosco && <FondoVivo />}
          {/* Dibujitos de salón, del color de la marca (como el fondo de WhatsApp) */}
          {!fondoQuiosco && aj.papelTapiz && aj.intensidadPapel > 0 && (
            <div aria-hidden="true" className="absolute inset-0 pointer-events-none"
              style={{
                backgroundColor: 'var(--primary)', opacity: aj.intensidadPapel / 100,
                WebkitMaskImage: `url("${PAPEL_TAPIZ_SALON}")`, maskImage: `url("${PAPEL_TAPIZ_SALON}")`,
                WebkitMaskSize: `${aj.tamanoPapel}px`, maskSize: `${aj.tamanoPapel}px`, WebkitMaskRepeat: 'repeat', maskRepeat: 'repeat',
              }} />
          )}
          <div className={`relative w-full ${grande ? 'max-w-6xl' : 'max-w-2xl'} mx-auto flex-1 min-h-0 flex flex-col`}>
            {/* Arriba */}
            <div className="flex items-center justify-between px-4 h-12 shrink-0">
              <div className="w-24 flex">
                {/* Cerrar del todo (para dejarla a mano está Minimizar) */}
                <button type="button" onClick={cerrar} aria-label="Cerrar a Lalan" title="Cerrar" className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-slate-500 dark:text-neutral-400 hover:bg-slate-200/60 dark:hover:bg-neutral-800 cursor-pointer">
                  <X className="w-5.5 h-5.5" />
                </button>
              </div>
              {/* En PC el nombre ya está en el panel de la conversación */}
              <span className={`text-[0.9375rem] font-bold tracking-tight ${grande ? 'invisible' : ''}`}>Lalan</span>
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
                  <div className="absolute right-0 top-11 z-10 w-72 max-h-[75vh] overflow-y-auto rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 shadow-xl p-2 text-[0.875rem]">
                    {uso && <LoQueQueda uso={uso} />}
                    <button type="button" onClick={() => { setMenu(false); setVerPlanes(true); }} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-neutral-800 text-left cursor-pointer">
                      <FileText className="w-4 h-4 text-[var(--primary)]" />
                      <span className="flex-1">Mis planes</span>
                    </button>
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
                    {/* Hablarle encima: Lalan se pausa y, si no le dijeron nada, sigue (Plataforma lo puede apagar para todos) */}
                    {!callada && aj.interrumpirConVoz && (
                      <button type="button" onClick={() => { const n = !interrumpir; setInterrumpirAqui(n); guardarInterrumpir(n); if (!n) soltarOido(); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-neutral-800 text-left cursor-pointer">
                        <MessageSquareText className={`w-4 h-4 ${interrumpir ? 'text-[var(--primary)]' : 'text-slate-500'}`} />
                        <span className="flex-1">Interrumpirla hablándole</span>
                        <span className={`relative w-9 h-5 rounded-full shrink-0 transition-colors ${interrumpir ? 'bg-[var(--primary)]' : 'bg-slate-300 dark:bg-neutral-700'}`} aria-hidden="true">
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${interrumpir ? 'left-[18px]' : 'left-0.5'}`} />
                        </span>
                      </button>
                    )}
                    <ElegirEsfera />
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
                    {/* La voz natural (de pago) solo aparece si Plataforma la tiene encendida */}
                    {aj.motorVoz !== 'aparato' && !callada && (
                      <div className="px-3 pt-2 pb-1">
                        <div className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Voz natural</div>
                        <div className="max-h-52 overflow-y-auto -mx-1">
                          {(aj.motorVoz === 'aura2' ? VOCES_AURA : [null]).map((aura) => {
                            const id = vozDeNube(aura);
                            const elegida = vozActual === id || (aura === aj.vozAura && vozActual === vozDeNube(null));
                            return (
                              <button key={id} type="button" onClick={() => elegirVoz(id)}
                                className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 text-left cursor-pointer">
                                <span className="w-4 shrink-0">{elegida && <Check className="w-4 h-4 text-[var(--primary)]" />}</span>
                                <span className="flex-1 truncate">{aura ? aura[0].toUpperCase() + aura.slice(1) : 'Voz de la nube'}</span>
                                {aura === aj.vozAura && <span className="text-[0.6875rem] text-slate-400 shrink-0">la de siempre</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {voces.length > 0 && !callada && (
                      <div className="px-3 pt-2 pb-1">
                        <div className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400 mb-1.5">{aj.motorVoz !== 'aparato' ? 'Voz del teléfono (gratis)' : 'Voz en este aparato'}</div>
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

            {grande ? (
            <div className="flex-1 min-h-0 grid grid-cols-[minmax(320px,400px)_1fr] gap-5 px-6 pt-2 pb-1">
              {/* Izquierda: Lalan. La esfera es la protagonista, con su estado siempre a la vista */}
              <aside className={`${VIDRIO} flex flex-col items-center justify-center gap-6 p-8 text-center`}>
                <button type="button" onClick={tocarEsfera} aria-label={modo === 'escuchando' ? 'Ya terminé' : 'Hablarle a Lalan'}
                  className="relative rounded-full cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]">
                  <EsferaLalan modo={modo} nivel={nivelEsfera} pulso={pulso} tamano={Math.max(Math.round(aj.tamanoEsfera * 1.6), 240)} />
                  {modo === 'escuchando' && escucha.cierre > 0 && (
                    <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" aria-hidden="true">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="var(--primary)" strokeOpacity="0.9" strokeWidth="2.5" strokeLinecap="round"
                        strokeDasharray={`${escucha.cierre * 251.3} 251.3`} />
                    </svg>
                  )}
                </button>
                <div className="space-y-1.5" role="status">
                  <p className="text-xl font-bold tracking-tight">
                    {callada && modo === 'reposo' ? 'En silencio' : modo === 'reposo' ? 'Toca la esfera y háblame' : TEXTO_ESTADO[modo].sabe ?? TEXTO_ESTADO[modo].nueva}
                  </p>
                  <p className="text-[0.875rem] text-slate-500 dark:text-neutral-400" style={{ textWrap: 'balance' }}>
                    {modo === 'escuchando' ? 'Cuando te calles te respondo; o toca la esfera.'
                      : modo === 'hablando' ? 'Toca la esfera para interrumpirme.'
                      : modo === 'pensando' ? 'Revisando tu salón…'
                      : callada ? 'Te respondo solo por escrito.' : 'O escríbeme en el panel de la derecha.'}
                  </p>
                </div>
                <AnimatePresence>
                  {modo === 'escuchando' && <BotonDejarDeEscuchar key="dejar" onClick={dejarDeEscuchar} />}
                </AnimatePresence>
                <AnimatePresence>
                  {error && (
                    <motion.p key={error} role="alert" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
                      className="max-w-xs text-[0.8125rem] font-medium leading-snug text-amber-800 dark:text-amber-200 px-3.5 py-2 rounded-2xl bg-amber-50/90 dark:bg-amber-950/70 border border-amber-200/80 dark:border-amber-900/60">
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>
                {!mensajes.length && !cargando && (
                  <div className="w-full space-y-2 pt-2">
                    <p className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400">Puedes preguntarme</p>
                    {SUGERENCIAS.map((q) => (
                      <button key={q} type="button" onClick={() => void enviar(q)} disabled={modo === 'pensando'}
                        className="w-full px-4 py-2.5 rounded-2xl bg-white/80 dark:bg-neutral-800/70 hover:bg-white dark:hover:bg-neutral-800 border border-white/70 dark:border-white/5 text-[0.875rem] font-medium text-left shadow-sm cursor-pointer transition-colors disabled:opacity-50">
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </aside>

              {/* Derecha: la conversación, en su panel, con el cuadro para escribir siempre a mano */}
              <section className={`${VIDRIO} flex flex-col min-h-0 overflow-hidden`}>
                <div className="flex items-center gap-3 px-6 h-16 shrink-0 border-b border-black/5 dark:border-white/5">
                  <span className="w-9 h-9 rounded-full bg-[var(--primary)]/12 text-[var(--primary)] flex items-center justify-center"><Sparkles className="w-4.5 h-4.5" /></span>
                  <div className="leading-tight">
                    <div className="text-[0.9375rem] font-bold">Lalan</div>
                    <div className="text-[0.75rem] text-slate-500 dark:text-neutral-400 flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${modo === 'pensando' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                      {modo === 'pensando' ? 'Pensando…' : 'Tu asistente, al día con tu salón'}
                    </div>
                  </div>
                  <button type="button" onClick={minimizar} title="Lalan sigue contigo en una burbuja"
                    className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-[0.8125rem] font-semibold text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-pointer transition-colors">
                    <Minimize2 className="w-4 h-4" /> Minimizar
                  </button>
                </div>
                <div ref={lista} aria-live="polite"
                  className="flex-1 min-h-0 overflow-y-auto px-6 py-6 space-y-6 [scrollbar-width:thin] [scrollbar-color:rgb(0_0_0/0.15)_transparent] dark:[scrollbar-color:rgb(255_255_255/0.15)_transparent]">
                  {cargando && !mensajes.length && (
                    <div className="flex justify-center py-10 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
                  )}
                  {!cargando && !mensajes.length && (
                    <div className="h-full flex flex-col items-center justify-center text-center gap-2 text-slate-500 dark:text-neutral-400">
                      <p className="text-2xl font-bold tracking-tight text-slate-800 dark:text-neutral-100">¿En qué te ayudo?</p>
                      <p className="text-[0.9375rem] max-w-md" style={{ textWrap: 'balance' }}>Háblame con la esfera o escríbeme aquí abajo. Conozco tu agenda, tu caja, tus chats y tu inventario.</p>
                    </div>
                  )}
                  {mensajes.map((m) => (
                    m.deLalan ? (
                      <div key={m.id} className="flex gap-3 max-w-[88%]">
                        <span className="mt-1 w-8 h-8 shrink-0 rounded-full bg-[var(--primary)]/12 text-[var(--primary)] flex items-center justify-center"><Sparkles className="w-4 h-4" /></span>
                        <div className="min-w-0 space-y-2">
                          <div className="px-5 py-3.5 rounded-3xl rounded-tl-lg bg-white/90 dark:bg-neutral-800/80 border border-white/80 dark:border-white/5 shadow-sm">
                            <p className="text-[0.9844rem] leading-relaxed text-slate-800 dark:text-neutral-100 whitespace-pre-line">{m.texto}</p>
                          </div>
                          {m.accion && <Tarjeta accion={m.accion} ocupada={resolviendo === m.accion.id} onResolver={resolver} onVerChat={verChat} onLlevame={llevame} onFallo={fallo} />}
                          <div className="pl-2"><Calificar util={m.util ?? null} onCambio={(u) => void calificar(m.id, u)} /></div>
                        </div>
                      </div>
                    ) : (
                      <div key={m.id} className="flex justify-end">
                        <div className={`max-w-[75%] px-5 py-3 rounded-3xl rounded-br-lg bg-[var(--primary)] text-white text-[0.9375rem] leading-snug shadow-md shadow-[var(--primary)]/20 transition-opacity ${m.enviando ? 'opacity-80' : ''}`}>
                          {m.porVoz && <Mic className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5 opacity-80" aria-label="Dicho con la voz" />}
                          {m.enviando && !m.texto ? <PasandoATexto /> : m.texto}
                        </div>
                      </div>
                    )
                  ))}
                  {modo === 'pensando' && (
                    <div className="flex gap-3">
                      <span className="w-8 h-8 shrink-0 rounded-full bg-[var(--primary)]/12 text-[var(--primary)] flex items-center justify-center"><Sparkles className="w-4 h-4" /></span>
                      <div className="px-5 py-4 rounded-3xl rounded-tl-lg bg-white/90 dark:bg-neutral-800/80 border border-white/80 dark:border-white/5 flex gap-1.5" aria-label="Lalan está pensando">
                        {[0, 1, 2].map((i) => (
                          <motion.span key={i} className="w-2 h-2 rounded-full bg-[var(--primary)]/60"
                            animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }} />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <form onSubmit={enviarTexto} className="shrink-0 p-4 border-t border-black/5 dark:border-white/5">
                  <div className="flex items-center gap-2 p-1.5 pl-5 rounded-2xl bg-white/90 dark:bg-neutral-800/80 border border-white/80 dark:border-white/5 shadow-sm focus-within:ring-2 focus-within:ring-[var(--primary)]">
                    <input ref={entrada} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escríbele a Lalan…"
                      onFocus={() => { if (escucha.estado === 'escuchando') escucha.terminar(false); setEscribiendo(true); }}
                      className="flex-1 min-w-0 bg-transparent py-2.5 text-[0.9375rem] focus:outline-none" />
                    <button type="button" onClick={tocarEsfera} aria-label="Hablarle con la voz" title="Hablarle con la voz"
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 cursor-pointer transition-colors ${modo === 'escuchando' ? 'bg-[var(--primary)]/15 text-[var(--primary)]' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-neutral-700'}`}>
                      <Mic className="w-5 h-5" />
                    </button>
                    <button type="submit" disabled={!texto.trim() || modo === 'pensando'} aria-label="Enviar"
                      className="w-10 h-10 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center shrink-0 disabled:opacity-40 cursor-pointer">
                      {modo === 'pensando' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-4.5 h-4.5" />}
                    </button>
                  </div>
                </form>
              </section>
            </div>
            ) : (
            <div className="relative flex-1 min-h-0">
            {/* La conversación: corre por detrás de la esfera (abajo es transparente).
                Escribiendo termina encima del campo, para que la cajita no tape el texto */}
            <div ref={lista} className="absolute inset-0 overflow-y-auto px-5 pt-4 space-y-5" aria-live="polite"
              style={escribiendo ? { bottom: altoAbajo, paddingBottom: 8 } : { paddingBottom: altoAbajo + 8 }}>
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
                    {m.accion && <Tarjeta accion={m.accion} ocupada={resolviendo === m.accion.id} onResolver={resolver} onVerChat={verChat} onLlevame={llevame} onFallo={fallo} />}
                    <Calificar util={m.util ?? null} onCambio={(u) => void calificar(m.id, u)} />
                  </div>
                ) : (
                  <div key={m.id} className="flex justify-end">
                    <div className={`max-w-[85%] px-4 py-2.5 rounded-3xl rounded-br-lg bg-[var(--primary)] text-white text-[0.9375rem] leading-snug transition-opacity ${m.enviando ? 'opacity-80' : ''}`}>
                      {m.porVoz && <Mic className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5 opacity-80" aria-label="Dicho con la voz" />}
                      {m.enviando && !m.texto ? <PasandoATexto /> : m.texto}
                    </div>
                  </div>
                )
              ))}
            </div>

            {/* Abajo: la esfera, flotando sobre la conversación */}
            <div ref={abajo} className={`absolute inset-x-0 bottom-0 px-5 ${escribiendo ? 'pt-1' : 'pt-10'} flex flex-col items-center gap-2 pointer-events-none [&>*]:pointer-events-auto bg-gradient-to-t to-transparent ${fondoQuiosco
              // Sobre los colores, un velo suave: uno sólido se veía como un bloque tapando las manchas
              ? 'from-white/35 via-white/10 dark:from-black/35 dark:via-black/10'
              : 'from-slate-50/75 via-slate-50/25 dark:from-neutral-950/75 dark:via-neutral-950/25'}`}>
              <AnimatePresence>
                {error && (
                  <motion.p key={error} role="alert" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
                    className="max-w-sm text-center text-[0.8125rem] font-medium leading-snug text-amber-800 dark:text-amber-200 px-3.5 py-2 rounded-2xl bg-amber-50/90 dark:bg-amber-950/70 border border-amber-200/80 dark:border-amber-900/60 backdrop-blur-md shadow-sm">
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
              {escribiendo ? (
                <form onSubmit={enviarTexto} className="w-full flex items-center gap-2 py-2">
                  <button type="button" onClick={tocarEsfera} aria-label="Hablarle con la voz" className="shrink-0 cursor-pointer">
                    <EsferaLalan modo={modo} nivel={nivelEsfera} pulso={pulso} tamano={48} />
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
                    <button type="button" onClick={minimizar} aria-label="Minimizar a Lalan" title="Minimizar"
                      className="w-11 h-11 rounded-full flex items-center justify-center text-slate-500 dark:text-neutral-400 hover:bg-slate-200/60 dark:hover:bg-neutral-800 cursor-pointer">
                      <Minimize2 className="w-5 h-5" />
                    </button>
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
                      <EsferaLalan modo={modo} nivel={nivelEsfera} pulso={pulso} tamano={aj.tamanoEsfera} />
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
                  <AnimatePresence>
                    {modo === 'escuchando' && <BotonDejarDeEscuchar key="dejar" onClick={dejarDeEscuchar} />}
                  </AnimatePresence>
                </>
              )}
            </div>
            </div>
            )}
          </div>
        </motion.div>
      )}
      {abierta && verPlanes && <MisPlanes key="mis-planes" onCerrar={() => setVerPlanes(false)} />}
    </AnimatePresence>
    </>
  );
};

/** Su frase hablada, mientras el servidor la pasa a texto */
const PasandoATexto: React.FC = () => (
  <span className="inline-flex gap-1 align-middle" aria-label="Pasando tu voz a texto">
    {[0, 1, 2].map((i) => (
      <motion.span key={i} className="w-1.5 h-1.5 rounded-full bg-white/90"
        animate={{ opacity: [0.35, 1, 0.35] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }} />
    ))}
  </span>
);

/** Mientras escucha, siempre a la vista: soltar el micrófono sin cerrar a Lalan */
const BotonDejarDeEscuchar: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <motion.button type="button" onClick={onClick}
    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.25 }}
    className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[0.8125rem] font-semibold text-slate-600 dark:text-neutral-300 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border border-slate-200/80 dark:border-white/10 shadow-sm hover:bg-white dark:hover:bg-neutral-800 cursor-pointer">
    <MicOff className="w-4 h-4" /> Dejar de escucharme
  </motion.button>
);

interface Uso {
  preguntas: { usadas: number; tope: number };
  voz: { usadas: number; tope: number } | null;
  mensajesClientas: { usados: number; tope: number | null } | null;
}

/** Una barrita de "cuánto queda": verde, ámbar al 80 %, roja al acabarse */
const Barra: React.FC<{ titulo: string; usado: number; tope: number | null; queda: string }> = ({ titulo, usado, tope, queda }) => {
  const pct = tope ? Math.min(100, (usado / tope) * 100) : 0;
  const color = !tope ? 'bg-emerald-500' : pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="space-y-1">
      <div className="text-[0.75rem] font-semibold text-slate-600 dark:text-neutral-300">{titulo}</div>
      {tope !== null && (
        <div className="h-1.5 rounded-full bg-slate-100 dark:bg-neutral-800 overflow-hidden">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(2, pct)}%` }} />
        </div>
      )}
      <div className="text-[0.6875rem] tabular-nums text-slate-500 dark:text-neutral-400 first-letter:uppercase">{queda}</div>
    </div>
  );
};

const n = (x: number) => x.toLocaleString('es-DO');

/** Lo que le queda a la dueña: preguntas a Lalan hoy, voz natural del mes y mensajes del plan */
const LoQueQueda: React.FC<{ uso: Uso }> = ({ uso }) => {
  const { preguntas, voz, mensajesClientas: m } = uso;
  const quedanPreguntas = Math.max(0, preguntas.tope - preguntas.usadas);
  return (
    <div className="px-3 pt-2 pb-3 mb-1 space-y-2.5 border-b border-slate-100 dark:border-neutral-800">
      <div className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400">Lo que te queda</div>
      <Barra titulo="Preguntas a Lalan hoy" usado={preguntas.usadas} tope={preguntas.tope}
        queda={quedanPreguntas ? `quedan ${n(quedanPreguntas)} de ${n(preguntas.tope)}` : 'se acabaron por hoy'} />
      {voz && (
        <Barra titulo="Voz natural este mes" usado={voz.usadas} tope={voz.tope}
          queda={voz.usadas >= voz.tope ? 'uso la del teléfono' : `quedan ~${n(Math.floor((voz.tope - voz.usadas) / 240))} respuestas`} />
      )}
      {m && (
        <Barra titulo="Mensajes a clientas (mes)" usado={m.usados} tope={m.tope}
          queda={m.tope === null ? `${n(m.usados)} · sin límite` : `quedan ${n(Math.max(0, m.tope - m.usados))} de ${n(m.tope)}`} />
      )}
    </div>
  );
};

/** "¿Se lo mando?": lo que Lalan propone hacer, con Sí / No */
/** ¿Te sirvió? Discreto: dos iconos chiquitos debajo de lo que dijo Lalan */
const Calificar: React.FC<{ util: boolean | null; onCambio: (u: boolean | null) => void }> = ({ util, onCambio }) => {
  const boton = (valor: boolean, Icono: typeof ThumbsUp, etiqueta: string) => {
    const activo = util === valor;
    return (
      <button type="button" aria-label={etiqueta} aria-pressed={activo} title={etiqueta}
        onClick={() => onCambio(activo ? null : valor)}
        className={`p-1.5 rounded-full cursor-pointer transition-colors ${activo
          ? valor ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' : 'text-rose-600 bg-rose-50 dark:bg-rose-950/40'
          : 'text-slate-300 hover:text-slate-500 dark:text-neutral-600 dark:hover:text-neutral-400'}`}>
        <Icono className="w-3.5 h-3.5" fill={activo ? 'currentColor' : 'none'} />
      </button>
    );
  };
  return (
    <div className="flex items-center gap-0.5 -ml-1.5 -mt-1">
      {boton(true, ThumbsUp, 'Me sirvió')}
      {boton(false, ThumbsDown, 'No me sirvió')}
      {util !== null && <span className="text-[0.6875rem] text-slate-400 ml-1">{util ? 'Gracias' : 'Gracias, lo vamos a mejorar'}</span>}
    </div>
  );
};

const TarjetaAccion: React.FC<{ accion: Accion; ocupada: boolean; onResolver: (a: Accion, si: boolean) => void; onVerChat: (id: string) => void }> = ({ accion, ocupada, onResolver, onVerChat }) => {
  // Servicios, rendimientos y lo que Lalan recuerda de ella se GUARDAN; lo demás se MANDA a una clienta
  const delSalon = accion.tipo === 'servicio' || accion.tipo === 'rendimiento' || accion.tipo === 'recuerdo';
  const titulo = accion.tipo === 'recuerdo' ? '¿Me acuerdo de esto? Solo entre tú y yo'
    : accion.tipo === 'indicacion' ? 'Indicación para Lalan en el chat'
    : accion.tipo === 'servicio' ? 'Servicio del salón'
    : accion.tipo === 'rendimiento' ? 'Lo que rinde un producto'
    : 'Mensaje para la clienta';
  return (
    <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 shadow-sm p-3.5 space-y-2.5">
      <div className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400">{titulo}</div>
      <p className="text-[0.875rem] leading-snug text-slate-700 dark:text-neutral-200">{accion.resumen.replace(/^(Indicación para Lalan en el chat de |Mensaje para )/, '')}</p>
      {accion.estado === 'pendiente' ? (
        <div className="flex items-center gap-2">
          <button type="button" disabled={ocupada} onClick={() => onResolver(accion, true)}
            className="flex-1 py-2.5 rounded-xl bg-[var(--primary)] text-white text-[0.875rem] font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer">
            {ocupada ? <Loader2 className="w-4 h-4 animate-spin" /> : delSalon ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />} {accion.tipo === 'recuerdo' ? 'Sí, acuérdate' : delSalon ? 'Sí, guárdalo' : 'Sí, mándalo'}
          </button>
          <button type="button" disabled={ocupada} onClick={() => onResolver(accion, false)}
            className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 text-[0.875rem] font-semibold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer">
            <X className="w-4 h-4" /> No
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 text-[0.8125rem]">
          <span className={`font-semibold ${accion.estado === 'hecha' ? 'text-emerald-600' : accion.estado === 'fallida' ? 'text-rose-600' : 'text-slate-400'}`}>
            {accion.estado === 'hecha' ? (delSalon ? 'Guardado' : 'Enviado') : accion.estado === 'fallida' ? `No salió${accion.resultado ? `: ${accion.resultado}` : ''}` : delSalon ? 'No se guardó' : 'No se mandó'}
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

/** La tarjeta que va bajo la respuesta de Lalan, según lo que dejó */
const Tarjeta: React.FC<{
  accion: Accion; ocupada: boolean; onResolver: (a: Accion, confirmar: boolean) => void; onVerChat: (id: string) => void;
  onLlevame: (g: GuiaTarjeta) => void; onFallo: (e: unknown) => void;
}> = ({ accion, ocupada, onResolver, onVerChat, onLlevame, onFallo }) => {
  if (accion.guia) return <TarjetaGuia guia={accion.guia} onLlevame={onLlevame} />;
  if (accion.documento) return <TarjetaDocumento documento={accion.documento} onFallo={onFallo} />;
  if (accion.tutorial) return <TarjetaTutorial tutorial={accion.tutorial} />;
  if (accion.tipo === 'guia' || accion.tipo === 'documento' || accion.tipo === 'tutorial') return null;
  return <TarjetaAccion accion={accion} ocupada={ocupada} onResolver={onResolver} onVerChat={onVerChat} />;
};

/** Un plan que Lalan dejó guardado: se descarga en PDF y queda en Mis planes */
const TarjetaDocumento: React.FC<{ documento: DocumentoTarjeta; onFallo: (e: unknown) => void }> = ({ documento, onFallo }) => {
  const [bajando, setBajando] = useState(false);
  const descargar = async () => {
    setBajando(true);
    try { await descargarPlan(documento.id, documento.titulo); } catch (e) { onFallo(e); } finally { setBajando(false); }
  };
  return (
    <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 shadow-sm p-3.5 space-y-2.5">
      <div className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400">Plan guardado</div>
      <div>
        <p className="text-[0.875rem] font-semibold leading-snug text-slate-700 dark:text-neutral-200">{documento.titulo}</p>
        <p className="mt-0.5 flex items-center gap-1 text-[0.75rem] text-slate-500 dark:text-neutral-400">
          {documento.sede && <><MapPin className="w-3 h-3" /> {documento.sede} · </>}En Mis planes
        </p>
      </div>
      <button type="button" onClick={descargar} disabled={bajando}
        className="w-full py-2.5 rounded-xl bg-[var(--primary)] text-white text-[0.875rem] font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60">
        {bajando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />} Descargar PDF
      </button>
    </div>
  );
};

/** "Ver cómo": las fotos paso a paso de algo que se hace fuera de la app, para este aparato */
const TarjetaTutorial: React.FC<{ tutorial: TutorialTarjeta }> = ({ tutorial }) => {
  const [viendo, setViendo] = useState(false);
  return (
    <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 shadow-sm p-3.5 space-y-2.5">
      <div className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400">Paso a paso con fotos</div>
      <p className="text-[0.875rem] font-semibold leading-snug text-slate-700 dark:text-neutral-200">{tutorial.nombre}</p>
      <button type="button" onClick={() => setViendo(true)}
        className="w-full py-2.5 rounded-xl bg-[var(--primary)] text-white text-[0.875rem] font-bold flex items-center justify-center gap-1.5 cursor-pointer">
        <Images className="w-4 h-4" /> Ver cómo
      </button>
      <VerComo tema={viendo ? tutorial.tema : null} onCerrar={() => setViendo(false)} />
    </div>
  );
};

/** La tarjeta "Llévame": la app abre la pantalla de la tarea y señala dónde tocar */
const TarjetaGuia: React.FC<{ guia: GuiaTarjeta; onLlevame: (g: GuiaTarjeta) => void }> = ({ guia, onLlevame }) => {
  const enLaApp = guiaPorId(guia.id);
  return (
    <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 shadow-sm p-3.5 space-y-2.5">
      <div className="text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400">Te llevo</div>
      <div>
        <p className="text-[0.875rem] font-semibold leading-snug text-slate-700 dark:text-neutral-200">{guia.nombre}</p>
        <p className="mt-0.5 flex items-center gap-1 text-[0.75rem] text-slate-500 dark:text-neutral-400">
          {guia.sede && <><MapPin className="w-3 h-3" /> {guia.sede} · </>}
          {enLaApp ? `${enLaApp.pasos.length} ${enLaApp.pasos.length === 1 ? 'paso' : 'pasos'}` : 'Actualiza la app para ver esta guía'}
        </p>
      </div>
      {enLaApp && (
        <button type="button" onClick={() => onLlevame(guia)}
          className="w-full py-2.5 rounded-xl bg-[var(--primary)] text-white text-[0.875rem] font-bold flex items-center justify-center gap-1.5 cursor-pointer">
          <Navigation className="w-4 h-4" /> Llévame
        </button>
      )}
    </div>
  );
};

/** El botón flotante (móvil): la esfera chiquita, siempre a mano */
export const BotonLalan: React.FC = () => {
  const { currentUser } = useAuth();
  const puede = puedeHablarConLalan(currentUser?.role);
  // Los ajustes se traen al entrar a la app: al abrir a Lalan ya se sabe qué voz usar
  useEffect(() => { if (puede) void cargarAjustesLalan(); }, [puede]);
  // La esfera del teléfono es la burbuja de PantallaLalan: se mueve desde el primer toque
  return null;
};

const TAM_BURBUJA = 60;
const BORDE_BURBUJA = 12;
/** A cuánto del centro del zafacón (en px) la burbuja "cae" dentro */
const RADIO_ZAFACON = 56;
/** Lo que se mueve el dedo antes de contar como arrastre y no como toque */
const UMBRAL_ARRASTRE = 6;
const CLAVE_POS_BURBUJA = 'lalan_burbuja_pos';
const RESORTE = { type: 'spring', stiffness: 420, damping: 34 } as const;
interface PosBurbuja { lado: 'izq' | 'der'; y: number }

/** Dónde la dejó la persona: el lado y la altura (en proporción de la pantalla) */
function posGuardada(): PosBurbuja {
  try {
    const p = JSON.parse(localStorage.getItem(CLAVE_POS_BURBUJA) || 'null') as PosBurbuja | null;
    if (p && (p.lado === 'izq' || p.lado === 'der') && typeof p.y === 'number') return p;
  } catch { /* noop */ }
  return { lado: 'der', y: 0.72 };
}
function guardarPos(p: PosBurbuja) { try { localStorage.setItem(CLAVE_POS_BURBUJA, JSON.stringify(p)); } catch { /* noop */ } }

/**
 * Al soltar un arrastre el navegador manda un "click" a lo que quede debajo
 * del dedo (en el iPhone abría la tarjeta de abajo). Ese click se traga.
 */
function tragarElClick() {
  const tragar = (e: Event) => { e.preventDefault(); e.stopPropagation(); };
  window.addEventListener('click', tragar, true);
  window.setTimeout(() => window.removeEventListener('click', tragar, true), 450);
}

const ETIQUETA_BURBUJA: Record<ModoEsfera, string> = {
  reposo: 'Lalan. Toca para abrir el chat',
  escuchando: 'Lalan te escucha. Toca para abrir el chat',
  pensando: 'Lalan está pensando. Toca para abrir el chat',
  hablando: 'Lalan está hablando. Toca para abrir el chat',
};

/**
 * La esfera flotante de Lalan. En el teléfono está siempre (también con
 * Lalan cerrada) y se puede mover desde el primer momento; tocarla la abre.
 * Minimizada sigue escuchando y hablando. Se arrastra a cualquier lado y se
 * pega al borde más cercano. Mientras se arrastra aparece el zafacón abajo al
 * centro, flotando sobre el menú: soltarla encima la cierra.
 */
const BurbujaLalan: React.FC<{
  visible: boolean; viva: boolean; modo: ModoEsfera; nivel: number; pulso: number; cierre: number; sinLeer: boolean;
  onAbrir: () => void; onCerrar: () => void;
}> = ({ visible, viva, modo, nivel, pulso, cierre, sinLeer, onAbrir, onCerrar }) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [arrastrando, setArrastrando] = useState(false);
  const [sobre, setSobre] = useState(false);
  const [tirando, setTirando] = useState(false);
  const ancla = useRef<HTMLDivElement>(null);
  const inicio = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const movio = useRef(false);

  const colocar = useCallback((p: PosBurbuja, suave: boolean) => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const nx = p.lado === 'der' ? vw - TAM_BURBUJA - BORDE_BURBUJA : BORDE_BURBUJA;
    const ny = Math.min(Math.max(p.y * vh, BORDE_BURBUJA + 40), vh - TAM_BURBUJA - BORDE_BURBUJA);
    if (suave) { void animate(x, nx, RESORTE); void animate(y, ny, RESORTE); }
    else { x.set(nx); y.set(ny); }
  }, [x, y]);

  useEffect(() => {
    if (!visible) return;
    setTirando(false);
    setSobre(false);
    colocar(posGuardada(), false);
    const alCambiar = () => colocar(posGuardada(), false);
    window.addEventListener('resize', alCambiar);
    return () => window.removeEventListener('resize', alCambiar);
  }, [visible, colocar]);

  /**
   * Dónde queda el centro del zafacón: lo marca un punto quieto (sin
   * animación) en su lugar fijo. Así se pone rojo siempre que la burbuja
   * llega, aunque el zafacón todavía esté entrando.
   */
  const centroZafacon = () => {
    const r = ancla.current?.getBoundingClientRect();
    return r ? { cx: r.left, cy: r.top } : { cx: window.innerWidth / 2, cy: window.innerHeight - 76 };
  };
  const cayendo = () => {
    const z = centroZafacon();
    return Math.hypot(x.get() + TAM_BURBUJA / 2 - z.cx, y.get() + TAM_BURBUJA / 2 - z.cy) < RADIO_ZAFACON;
  };

  /*
   * El arrastre se hace a mano (con el dedo capturado): así se mueve desde el
   * primer toque, sin esperar, y un arrastre nunca cuenta como toque.
   */
  const alBajar = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (tirando) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    inicio.current = { x: x.get(), y: y.get(), px: e.clientX, py: e.clientY };
    movio.current = false;
  };
  const alMover = (e: React.PointerEvent<HTMLButtonElement>) => {
    const i = inicio.current;
    if (!i) return;
    const dx = e.clientX - i.px;
    const dy = e.clientY - i.py;
    if (!movio.current) {
      if (Math.hypot(dx, dy) < UMBRAL_ARRASTRE) return;
      movio.current = true;
      setArrastrando(true);
    }
    x.set(i.x + dx);
    y.set(i.y + dy);
    setSobre(cayendo());
  };
  const alSoltar = () => {
    const i = inicio.current;
    inicio.current = null;
    if (!i || !movio.current) return;
    tragarElClick();
    if (cayendo()) {
      // Entra al zafacón, se encoge y se cierra
      const z = centroZafacon();
      setTirando(true);
      void animate(x, z.cx - TAM_BURBUJA / 2, RESORTE);
      void animate(y, z.cy - TAM_BURBUJA / 2, RESORTE);
      window.setTimeout(() => { setArrastrando(false); setSobre(false); onCerrar(); }, 320);
      return;
    }
    setArrastrando(false);
    setSobre(false);
    const p: PosBurbuja = { lado: x.get() + TAM_BURBUJA / 2 < window.innerWidth / 2 ? 'izq' : 'der', y: y.get() / window.innerHeight };
    guardarPos(p);
    colocar(p, true);
  };

  return (
    <>
      {/* El centro del zafacón: 18 px del borde + el aviso (~20 px) y su espacio (6 px) + medio círculo (32 px) */}
      {visible && (
        <div ref={ancla} aria-hidden="true" className="fixed left-1/2 w-0 h-0 pointer-events-none"
          style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 76px)' }} />
      )}
      <AnimatePresence>
        {visible && (arrastrando || tirando) && (
          <motion.div key="zafacon" aria-hidden="true"
            className="fixed inset-x-0 z-[405] flex justify-center pointer-events-none"
            style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 18px)' }}
            initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 36 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
            <div className="flex flex-col items-center gap-1.5">
              <motion.div
                animate={{ scale: sobre ? 1.18 : 1 }} transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                className={`w-16 h-16 rounded-full flex items-center justify-center backdrop-blur-xl border shadow-xl transition-colors duration-200 ${sobre
                  ? 'bg-rose-500 border-rose-400 text-white shadow-rose-500/40'
                  : 'bg-white/85 dark:bg-neutral-900/85 border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-neutral-300 shadow-black/10'}`}>
                <Trash2 className="w-6 h-6" />
              </motion.div>
              <span className="h-5 flex items-center px-2.5 rounded-full text-[0.6875rem] font-semibold bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md text-slate-600 dark:text-neutral-300 shadow-sm">
                {sobre ? 'Suelta para cerrar a Lalan' : 'Cerrar a Lalan'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {visible && (
          <motion.div key="burbuja"
            className={`fixed left-0 top-0 ${viva || arrastrando ? 'z-[410]' : 'z-40'}`}
            style={{ x, y, width: TAM_BURBUJA, height: TAM_BURBUJA }}
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: tirando ? 0 : 1, scale: tirando ? 0.2 : sobre ? 0.82 : arrastrando ? 1.08 : 1 }}
            exit={{ opacity: 0, scale: 0.4 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}>
            <button type="button" aria-label={ETIQUETA_BURBUJA[modo]} data-medir="Abrir Lalan"
              title="Toca para abrir el chat · arrástrala al zafacón para cerrarla"
              onPointerDown={alBajar} onPointerMove={alMover} onPointerUp={alSoltar} onPointerCancel={alSoltar}
              onClick={() => { if (movio.current) { movio.current = false; return; } onAbrir(); }}
              className="relative w-full h-full rounded-full cursor-pointer touch-none select-none shadow-xl shadow-[var(--primary)]/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--primary)]">
              <EsferaLalan modo={modo} nivel={nivel} pulso={pulso} tamano={TAM_BURBUJA} />
              {modo === 'escuchando' && cierre > 0 && (
                <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" aria-hidden="true">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="var(--primary)" strokeOpacity="0.9" strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={`${cierre * 251.3} 251.3`} />
                </svg>
              )}
              {/* Dijo algo mientras estaba en burbuja (en silencio solo se lee) */}
              <AnimatePresence>
                {sinLeer && (
                  <motion.span key="nuevo" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                    className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-[var(--primary)] ring-2 ring-white dark:ring-neutral-900" />
                )}
              </AnimatePresence>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
