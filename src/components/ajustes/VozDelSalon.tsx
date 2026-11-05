import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check, ChevronRight, FileText, Loader2, MessageCircleHeart, Mic, Plus, RotateCcw, Send, ShieldCheck, Sparkles, Upload, UserRound, Wand2, X,
} from 'lucide-react';
import { apiCadena, subirArchivo } from '../../services/api';
import { sedeActiva } from '../../services/sedeActiva';
import { useApp } from '../../context/AppContext';
import { useSedes } from '../../hooks/useSedes';
import { SelectorSede } from '../ui/SelectorSede';
import { IOSSegmentedControl } from '../ui/IOSSegmentedControl';
import { IOSToggle } from '../ui/IOSToggle';
import { useConfirmar } from '../ui/ModalConfirmar';
import { GrabadorVoz } from '../chats/GrabadorVoz';

/**
 * Ajustes → Lalan en los chats → «Cómo habla tu salón»: que Lalan no suene a
 * bot sino a la dueña. Lalan aprende de una entrevista por notas de voz y de
 * los chats que ella exporta de WhatsApp (sin datos de clientas), ella revisa
 * la guía y la prueba con mensajes reales antes de encenderla.
 *
 * Dos capas: la voz general del salón (aquí) y el trato de cada clienta
 * (en su ficha: «Cómo le hablas tú»).
 */

type Trato = 'tu' | 'usted' | 'segun';
interface Guia {
  trato: Trato; saludo: string; despedida: string; emojis: string; largo: string;
  frases: string[]; precios: string; quejas: string; nunca: string[]; notas: string[];
}
interface Ejemplo { clienta: string; salon: string }
interface Voz { id: string | null; sede: string | null; guia: Guia; ejemplos: Ejemplo[]; casos: Ejemplo[]; activa: boolean; aprobadaEn: string | null; aprobadaPor: string | null }
interface Pregunta { id: string; pregunta: string; ayuda: string }
interface TratoPropuesto { nombre: string; trato: string; candidatas: { id: string; nombre: string; telefono: string | null; tratoActual: string | null }[] }
interface Propuesta { guia: Guia; ejemplos: Ejemplo[]; casos: Ejemplo[]; cambios: string[]; tratos: TratoPropuesto[] }
type RespuestaChats = (Propuesta & { chats: number; mensajes: number }) | { necesitaAutor: true; autores: string[] };

type Pestana = 'entrevista' | 'chats' | 'guia' | 'probar';

const TRATOS: { id: Trato; label: string }[] = [
  { id: 'segun', label: 'Según la clienta' },
  { id: 'tu', label: 'De tú' },
  { id: 'usted', label: 'De usted' },
];

const CAMPO = 'w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.8125rem] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';
const ETIQUETA = 'block text-[0.75rem] font-bold text-slate-700 dark:text-slate-300 mb-1';
const BOTON = 'py-2.5 px-3 rounded-xl font-bold text-[0.8125rem] flex items-center justify-center gap-1.5 ios-touch cursor-pointer disabled:opacity-50';
const PRINCIPAL = `${BOTON} bg-[var(--primary)] text-white hover:opacity-90 shadow-sm`;
const SECUNDARIO = `${BOTON} bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-neutral-700`;

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' });
const mensajeDe = (e: unknown, si: string) => (e instanceof Error && e.message ? e.message : si);

/** Los tramos del grabador, como los manda el chat */
function formularioDeVoz(tramos: Blob[]): FormData {
  const f = new FormData();
  tramos.forEach((audio, i) => {
    const ext = audio.type.includes('webm') ? 'webm' : audio.type.includes('ogg') ? 'ogg' : 'm4a';
    f.append('audio', audio, `respuesta-${i + 1}.${ext}`);
  });
  return f;
}

export const VozDelSalon: React.FC = () => {
  const { showToast } = useApp();
  const { confirmar, modalConfirmar } = useConfirmar();
  const sedes = useSedes({ todasLasDelSalon: true });
  // '' = la voz de todo el salón; una sede = el ajuste de esa sede (manda sobre la del salón)
  const [sede, setSede] = useState<string>(() => sedeActiva() || '');
  const [pestana, setPestana] = useState<Pestana>('entrevista');
  const [datos, setDatos] = useState<{ salon: Voz; sede: Voz | null; preguntas: Pregunta[] } | null>(null);
  const [error, setError] = useState('');
  /** La guía que se está editando (la de la sede si tiene propia o la está creando; si no, la del salón) */
  const [borrador, setBorrador] = useState<Voz | null>(null);
  const [sinGuardar, setSinGuardar] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const consulta = sede ? `?sede=${sede}` : '';
  const cargar = useCallback(async () => {
    setError('');
    try {
      const d = await apiCadena.get<{ salon: Voz; sede: Voz | null; preguntas: Pregunta[] }>(`/voz-salon${consulta}`);
      setDatos(d);
      setBorrador(d.sede?.id ? d.sede : d.salon);
      setSinGuardar(false);
    } catch (e) { setError(mensajeDe(e, 'No pude traer cómo habla tu salón.')); }
  }, [consulta]);
  useEffect(() => { void cargar(); }, [cargar]);

  // Editando la del salón o la propia de esta sede
  const deEstaSede = !!sede && !!borrador?.sede;
  const nombreSede = sedes.find((s) => s.id === sede)?.name;

  const cambiar = (v: Partial<Voz>) => { setBorrador((b) => (b ? { ...b, ...v } : b)); setSinGuardar(true); };
  const cambiarGuia = (g: Partial<Guia>) => { setBorrador((b) => (b ? { ...b, guia: { ...b.guia, ...g } } : b)); setSinGuardar(true); };

  const guardar = async (v: Voz | null = borrador, aviso = 'Lalan ya sabe cómo hablas.') => {
    if (!v) return null;
    setGuardando(true);
    try {
      const r = await apiCadena.put<Voz>('/voz-salon', {
        sede: v.sede, guia: v.guia, ejemplos: v.ejemplos, casos: v.casos, activa: v.activa,
      });
      setBorrador(r);
      setDatos((d) => (d ? (r.sede ? { ...d, sede: r } : { ...d, salon: r }) : d));
      setSinGuardar(false);
      showToast('Guardado', aviso, 'success');
      return r;
    } catch (e) {
      showToast('No se guardó', mensajeDe(e, 'Inténtalo de nuevo.'), 'warning');
      return null;
    } finally { setGuardando(false); }
  };

  /** Lo que Lalan propone (de la entrevista o de los chats) va a la guía que se está editando y se guarda */
  const aceptarPropuesta = async (p: Propuesta, aviso: string) => {
    if (!borrador) return;
    return guardar({ ...borrador, guia: p.guia, ejemplos: p.ejemplos, casos: p.casos }, aviso);
  };

  const ajustarParaSede = () => {
    if (!datos || !sede) return;
    setBorrador({ ...datos.salon, id: null, sede, activa: datos.salon.activa });
    setSinGuardar(true);
    setPestana('guia');
  };

  const volverALaDelSalon = async () => {
    if (!sede || !datos) return;
    const si = await confirmar({
      titulo: `¿Volver a la voz del salón en ${nombreSede ?? 'esta sede'}?`,
      mensaje: 'Se borra el ajuste de esta sede y Lalan usa la voz de todo el salón.',
      textoConfirmar: 'Sí, volver', tono: 'peligro',
    });
    if (!si) return;
    try {
      await apiCadena.delete(`/voz-salon/sede/${sede}`);
      showToast('Listo', `${nombreSede ?? 'Esta sede'} vuelve a la voz del salón.`, 'success');
    } catch (e) { showToast('No se pudo', mensajeDe(e, 'Inténtalo de nuevo.'), 'warning'); }
    void cargar();
  };

  const encender = async (activa: boolean) => {
    if (!borrador) return;
    await guardar({ ...borrador, activa }, activa ? 'Desde ahora Lalan escribe con tu voz en los chats.' : 'Lalan vuelve a su tono de siempre.');
  };

  const estado = borrador?.activa
    ? `Lalan ya escribe como tú${borrador.aprobadaPor ? ` · la aprobó ${borrador.aprobadaPor}` : ''}${borrador.aprobadaEn ? ` el ${fecha(borrador.aprobadaEn)}` : ''}`
    : 'Todavía con su tono de siempre. Cuéntale cómo hablas y enciéndela cuando te guste.';

  return (
    <div data-guia="voz-del-salon" className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3">
      {modalConfirmar}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <MessageCircleHeart className="w-4 h-4 text-purple-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">Cómo habla tu salón</h3>
          </div>
          <p className="mt-1 text-[0.75rem] text-slate-500 dark:text-neutral-400">{estado}</p>
        </div>
        <SelectorSede sedes={sedes} value={sede} onChange={setSede} todas />
      </div>

      {error && <p className="text-[0.75rem] text-rose-600">{error}</p>}
      {!datos || !borrador ? (
        !error && <div className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
      ) : (
        <>
          {/* La sede usa la del salón, o tiene la suya */}
          {sede && sedes.length > 1 && (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 text-[0.75rem] text-slate-600 dark:text-neutral-300 flex items-center justify-between gap-2">
              {deEstaSede ? (
                <>
                  <span>{nombreSede} tiene su propia voz.</span>
                  {borrador.id && (
                    <button type="button" onClick={volverALaDelSalon} className="font-bold text-[var(--primary)] flex items-center gap-1 cursor-pointer shrink-0">
                      <RotateCcw className="w-3.5 h-3.5" /> Usar la del salón
                    </button>
                  )}
                </>
              ) : (
                <>
                  <span>{nombreSede} usa la voz de todo el salón.</span>
                  <button type="button" onClick={ajustarParaSede} className="font-bold text-[var(--primary)] flex items-center gap-1 cursor-pointer shrink-0">
                    Ajustarla solo aquí <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/30">
            <label htmlFor="voz-activa" className="text-[0.8125rem] font-bold text-slate-900 dark:text-white">
              Lalan usa esta voz en los chats
            </label>
            <IOSToggle id="voz-activa" checked={borrador.activa} disabled={guardando} onChange={encender} ariaLabel="Lalan usa esta voz en los chats" />
          </div>

          <IOSSegmentedControl<Pestana>
            id="voz-pestanas"
            size="sm"
            value={pestana}
            onChange={setPestana}
            options={[
              { id: 'entrevista', label: 'Hablarle' },
              { id: 'chats', label: 'Chats' },
              { id: 'guia', label: 'Tu guía' },
              { id: 'probar', label: 'Probar' },
            ]}
          />

          {pestana === 'entrevista' && (
            <Entrevista preguntas={datos.preguntas} sede={borrador.sede} onAceptar={aceptarPropuesta} />
          )}
          {pestana === 'chats' && (
            <SubirChats sede={borrador.sede} onAceptar={async (p, aviso) => { const r = await aceptarPropuesta(p, aviso); if (r) setPestana('probar'); }} />
          )}
          {pestana === 'guia' && (
            <EditorGuia voz={borrador} onGuia={cambiarGuia} onVoz={cambiar} />
          )}
          {pestana === 'probar' && (
            <Probar voz={borrador} onEjemplo={(e) => { cambiar({ ejemplos: [e, ...borrador.ejemplos.filter((x) => x.clienta !== e.clienta || x.salon !== e.salon)].slice(0, 15) }); }} />
          )}

          {(sinGuardar || pestana === 'guia') && (
            <button type="button" onClick={() => void guardar()} disabled={guardando || !sinGuardar} className={`w-full ${PRINCIPAL}`}>
              {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {sinGuardar ? 'Guardar cambios' : 'Todo guardado'}
            </button>
          )}
          <p className="flex items-start gap-1.5 text-[0.6875rem] text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-px" />
            Lalan quita nombres, teléfonos, montos y todo lo de salud antes de leer. Los chats y las notas de voz se borran al terminar: solo queda esta guía.
          </p>
        </>
      )}
    </div>
  );
};

// ── Hablarle: la entrevista por notas de voz ──────────────────────────

const Entrevista: React.FC<{
  preguntas: Pregunta[];
  sede: string | null;
  onAceptar: (p: Propuesta, aviso: string) => Promise<unknown>;
}> = ({ preguntas, sede, onAceptar }) => {
  const { showToast } = useApp();
  const [i, setI] = useState(0);
  const [escrito, setEscrito] = useState('');
  const [pensando, setPensando] = useState(false);
  const [entendido, setEntendido] = useState<(Propuesta & { transcrito: string }) | null>(null);
  const [aceptando, setAceptando] = useState(false);
  const p = preguntas[i];
  // La pregunta que está en pantalla: una respuesta que llega tarde de otra se descarta
  const actual = useRef(p?.id);
  actual.current = p?.id;

  const mandar = async (f: FormData) => {
    const deCual = p.id;
    f.append('preguntaId', deCual);
    if (sede) f.append('sede', sede);
    setPensando(true);
    try {
      const r = await subirArchivo<Propuesta & { transcrito: string }>('/voz-salon/entrevista', f, { deLaCadena: true });
      if (actual.current !== deCual) return;
      setEntendido(r);
      setEscrito('');
    } catch (e) { showToast('No te entendí', mensajeDe(e, 'Inténtalo otra vez.'), 'warning'); }
    finally { setPensando(false); }
  };
  const porVoz = (tramos: Blob[]) => { if (tramos.length) void mandar(formularioDeVoz(tramos)); };
  const porEscrito = () => { if (!escrito.trim()) return; const f = new FormData(); f.append('texto', escrito.trim()); void mandar(f); };
  const siguiente = () => { setEntendido(null); setI((n) => Math.min(preguntas.length - 1, n + 1)); };

  const aceptar = async () => {
    if (!entendido || aceptando) return;
    setAceptando(true);
    try {
      await onAceptar(entendido, entendido.cambios[0] ?? 'Lo anoté en tu guía.');
      siguiente();
    } finally { setAceptando(false); }
  };

  if (!p) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1" aria-label={`Pregunta ${i + 1} de ${preguntas.length}`}>
        {preguntas.map((q, n) => (
          <button key={q.id} type="button" onClick={() => { setEntendido(null); setI(n); }} aria-label={`Ir a la pregunta ${n + 1}`}
            className={`h-1.5 flex-1 rounded-full cursor-pointer ${n < i ? 'bg-[var(--primary)]/60' : n === i ? 'bg-[var(--primary)]' : 'bg-slate-200 dark:bg-neutral-700'}`} />
        ))}
      </div>

      <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/30">
        <div className="flex items-center gap-1.5 text-[0.6875rem] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" /> Pregunta {i + 1} de {preguntas.length}
        </div>
        <p className="mt-1 text-[0.9375rem] font-bold text-slate-900 dark:text-white">{p.pregunta}</p>
        <p className="mt-1 text-[0.75rem] text-slate-500 dark:text-neutral-400">
          {p.ayuda || 'Respóndeme como se lo dirías a ella.'} Mantén presionado el micrófono para hablar.
        </p>
      </div>

      {entendido ? (
        <div className="p-3 rounded-2xl border border-slate-200 dark:border-neutral-700 space-y-2">
          <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">Te escuché: <span className="italic">«{entendido.transcrito}»</span></p>
          {entendido.cambios.length ? (
            <ul className="space-y-1">
              {entendido.cambios.map((c) => (
                <li key={c} className="flex items-start gap-1.5 text-[0.8125rem] text-slate-900 dark:text-white"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-px" />{c}</li>
              ))}
            </ul>
          ) : (
            <p className="text-[0.8125rem] text-slate-700 dark:text-slate-200">No saqué nada nuevo de esto. Puedes repetirlo con otras palabras o seguir.</p>
          )}
          <TratosDeClientas key={entendido.transcrito} tratos={entendido.tratos} />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={siguiente} className={SECUNDARIO}><X className="w-4 h-4" /> No, así no</button>
            <button type="button" onClick={aceptar} disabled={!entendido.cambios.length || aceptando} className={PRINCIPAL}><Check className="w-4 h-4" /> Está bien</button>
          </div>
        </div>
      ) : (
        <div className="flex items-end gap-2">
          <textarea rows={2} value={escrito} onChange={(e) => setEscrito(e.target.value)} disabled={pensando}
            placeholder="O escríbelo aquí…" aria-label="Tu respuesta por escrito" className={`${CAMPO} flex-1 resize-none`} />
          {pensando ? (
            <span className="w-11 h-11 rounded-full bg-slate-100 dark:bg-neutral-800 flex items-center justify-center shrink-0"><Loader2 className="w-5 h-5 animate-spin text-[var(--primary)]" /></span>
          ) : escrito.trim() ? (
            <button type="button" onClick={porEscrito} aria-label="Enviar respuesta" className="w-11 h-11 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shrink-0 cursor-pointer"><Send className="w-4 h-4" /></button>
          ) : (
            <GrabadorVoz onListo={porVoz} onAviso={(t, d) => showToast(t, d, 'warning')} etiqueta="Mantén presionado para responder hablando" />
          )}
        </div>
      )}
      {!entendido && i < preguntas.length - 1 && (
        <button type="button" onClick={siguiente} className="text-[0.75rem] font-bold text-slate-500 hover:text-slate-700 cursor-pointer flex items-center gap-1">
          Saltar esta pregunta <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}
      <p className="flex items-center gap-1.5 text-[0.6875rem] text-slate-400"><Mic className="w-3.5 h-3.5" /> Puedes volver cuando quieras a corregirme algo en la última pregunta.</p>
    </div>
  );
};

// ── El trato de cada clienta: se enlaza con su ficha ──────────────────

const TratosDeClientas: React.FC<{ tratos: TratoPropuesto[] }> = ({ tratos }) => {
  const { showToast, updateClient } = useApp();
  const [elegida, setElegida] = useState<Record<string, string>>(() => Object.fromEntries(tratos.map((t) => [t.nombre, t.candidatas.length === 1 ? t.candidatas[0].id : ''])));
  const [hechos, setHechos] = useState<Record<string, boolean>>({});
  const [guardando, setGuardando] = useState<string | null>(null);
  if (!tratos.length) return null;

  const guardar = async (t: TratoPropuesto) => {
    const id = elegida[t.nombre];
    if (!id) return;
    setGuardando(t.nombre);
    try {
      // Por la ficha de siempre: así la lista de clientas ya lo trae al abrirla
      await updateClient(id, { tratoPersonal: t.trato });
      setHechos((h) => ({ ...h, [t.nombre]: true }));
      showToast('En su ficha', `Lalan le hablará así a ${t.candidatas.find((c) => c.id === id)?.nombre ?? t.nombre}.`, 'success');
    } catch (e) { showToast('No se guardó', mensajeDe(e, 'Inténtalo de nuevo.'), 'warning'); }
    finally { setGuardando(null); }
  };

  return (
    <div className="space-y-2">
      <p className="text-[0.75rem] font-bold text-slate-700 dark:text-slate-300">Cómo les hablas a algunas clientas</p>
      {tratos.map((t) => (
        <div key={t.nombre} className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 space-y-1.5">
          <div className="flex items-start gap-1.5">
            <UserRound className="w-4 h-4 text-slate-400 shrink-0 mt-px" />
            <div className="min-w-0 text-[0.8125rem]">
              <span className="font-bold text-slate-900 dark:text-white">{t.nombre}</span>
              <span className="text-slate-600 dark:text-neutral-300">: {t.trato}</span>
            </div>
          </div>
          {hechos[t.nombre] ? (
            <p className="text-[0.75rem] text-emerald-600 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Guardado en su ficha</p>
          ) : t.candidatas.length ? (
            <div className="flex items-center gap-2">
              <select value={elegida[t.nombre] ?? ''} onChange={(e) => setElegida((x) => ({ ...x, [t.nombre]: e.target.value }))}
                aria-label={`Ficha de ${t.nombre}`} className={`${CAMPO} py-1.5 flex-1 min-w-0`}>
                {t.candidatas.length > 1 && <option value="">¿Cuál de tus clientas es?</option>}
                {t.candidatas.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.telefono ? ` · ${c.telefono}` : ''}</option>)}
              </select>
              <button type="button" onClick={() => void guardar(t)} disabled={!elegida[t.nombre] || guardando === t.nombre} className={`${PRINCIPAL} py-1.5 shrink-0`}>
                {guardando === t.nombre ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Guardar en su ficha'}
              </button>
            </div>
          ) : (
            <p className="text-[0.75rem] text-slate-500">No encontré su ficha. Cuando la registres, puedes ponerlo en «Cómo le hablas tú».</p>
          )}
        </div>
      ))}
    </div>
  );
};

// ── Chats exportados de WhatsApp ─────────────────────────────────────

const SubirChats: React.FC<{ sede: string | null; onAceptar: (p: Propuesta, aviso: string) => Promise<unknown> }> = ({ sede, onAceptar }) => {
  const { showToast } = useApp();
  const entrada = useRef<HTMLInputElement>(null);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [leyendo, setLeyendo] = useState(false);
  const [autores, setAutores] = useState<string[] | null>(null);
  const [resultado, setResultado] = useState<(Propuesta & { chats: number; mensajes: number }) | null>(null);

  const leer = async (soyYo?: string, lista = archivos) => {
    if (!lista.length) return;
    const f = new FormData();
    lista.forEach((a) => f.append('archivos', a, a.name));
    if (soyYo) f.append('soyYo', soyYo);
    if (sede) f.append('sede', sede);
    setLeyendo(true);
    try {
      const r = await subirArchivo<RespuestaChats>('/voz-salon/chats', f, { deLaCadena: true });
      if ('necesitaAutor' in r) { setAutores(r.autores); return; }
      setAutores(null);
      setResultado(r);
    } catch (e) { showToast('No pude leerlos', mensajeDe(e, 'Inténtalo otra vez.'), 'warning'); }
    finally { setLeyendo(false); }
  };

  const elegir = (e: React.ChangeEvent<HTMLInputElement>) => {
    const lista = Array.from(e.target.files ?? []).slice(0, 50);
    e.target.value = '';
    setArchivos(lista); setResultado(null); setAutores(null);
    if (lista.length) void leer(undefined, lista);
  };

  if (resultado) {
    return (
      <div className="space-y-2">
        <div className="p-3 rounded-2xl border border-slate-200 dark:border-neutral-700 space-y-2">
          <p className="text-[0.8125rem] font-bold text-slate-900 dark:text-white">
            Leí {resultado.chats} {resultado.chats === 1 ? 'chat' : 'chats'} y {resultado.mensajes} mensajes.
          </p>
          <ul className="space-y-1">
            {resultado.cambios.map((c) => (
              <li key={c} className="flex items-start gap-1.5 text-[0.8125rem] text-slate-800 dark:text-slate-100"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-px" />{c}</li>
            ))}
          </ul>
          {!!resultado.casos.length && (
            <p className="text-[0.75rem] text-slate-500">Guardé {resultado.casos.length === 1 ? 'un mensaje' : `${resultado.casos.length} mensajes`} de tus clientas para que pruebes si Lalan responde como tú.</p>
          )}
          <TratosDeClientas tratos={resultado.tratos} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => { setResultado(null); setArchivos([]); }} className={SECUNDARIO}><X className="w-4 h-4" /> Descartar</button>
          <button type="button" onClick={() => void onAceptar(resultado, 'Lo anoté en tu guía. Ahora pruébala.')} className={PRINCIPAL}><Check className="w-4 h-4" /> Guardar y probar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-neutral-800/60 text-[0.75rem] text-slate-600 dark:text-neutral-300 space-y-1.5">
        <p className="font-bold text-slate-900 dark:text-white">Cómo sacar un chat de WhatsApp</p>
        <p>1. Abre el chat de una clienta con la que hablas mucho.</p>
        <p>2. Toca su nombre arriba (iPhone) o ⋮ → Más (Android) → <b>Exportar chat</b> → <b>Sin archivos</b>.</p>
        <p>3. Guárdalo y súbelo aquí. Con 20 a 50 chats Lalan ya te conoce; puedes subir varios a la vez.</p>
      </div>
      <input ref={entrada} type="file" multiple accept=".txt,.zip,text/plain,application/zip" className="hidden" onChange={elegir} />
      {autores ? (
        <div className="p-3 rounded-2xl border border-slate-200 dark:border-neutral-700 space-y-2">
          <p className="text-[0.8125rem] font-bold text-slate-900 dark:text-white">¿Cuál de estos nombres eres tú?</p>
          <div className="flex flex-wrap gap-1.5">
            {autores.map((a) => (
              <button key={a} type="button" onClick={() => void leer(a)} disabled={leyendo}
                className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-neutral-800 text-[0.8125rem] font-bold text-slate-800 dark:text-slate-100 hover:bg-[var(--primary)]/10 cursor-pointer">{a}</button>
            ))}
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => entrada.current?.click()} disabled={leyendo} className={`w-full ${PRINCIPAL}`}>
          {leyendo ? <><Loader2 className="w-4 h-4 animate-spin" /> Leyendo {archivos.length} {archivos.length === 1 ? 'chat' : 'chats'}…</> : <><Upload className="w-4 h-4" /> Subir chats exportados</>}
        </button>
      )}
      {!!archivos.length && !leyendo && !autores && (
        <p className="flex items-center gap-1.5 text-[0.75rem] text-slate-500"><FileText className="w-3.5 h-3.5" /> {archivos.map((a) => a.name).join(', ').slice(0, 140)}</p>
      )}
    </div>
  );
};

// ── Tu guía: lo que Lalan anotó, para revisar y cambiar ───────────────

const ListaEditable: React.FC<{ etiqueta: string; ayuda: string; valores: string[]; onCambio: (v: string[]) => void; ejemplo: string; comillas?: boolean }> = ({ etiqueta, ayuda, valores, onCambio, ejemplo, comillas }) => {
  const [nueva, setNueva] = useState('');
  const sumar = () => { const t = nueva.trim(); if (!t) return; onCambio([...new Set([...valores, t])]); setNueva(''); };
  return (
    <div>
      <span className={ETIQUETA}>{etiqueta}</span>
      <p className="text-[0.6875rem] text-slate-400 mb-1.5">{ayuda}</p>
      {!!valores.length && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {valores.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-purple-50 dark:bg-purple-950/40 text-[0.75rem] text-purple-800 dark:text-purple-200">
              {comillas ? `«${v}»` : v}
              <button type="button" onClick={() => onCambio(valores.filter((x) => x !== v))} aria-label={`Quitar ${v}`} className="p-0.5 rounded-full hover:bg-purple-100 dark:hover:bg-purple-900 cursor-pointer"><X className="w-3 h-3" /></button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input value={nueva} onChange={(e) => setNueva(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sumar(); } }}
          placeholder={ejemplo} aria-label={`Agregar a ${etiqueta}`} maxLength={300} className={`${CAMPO} flex-1 min-w-0`} />
        <button type="button" onClick={sumar} disabled={!nueva.trim()} aria-label="Agregar" className={`${SECUNDARIO} px-2.5`}><Plus className="w-4 h-4" /></button>
      </div>
    </div>
  );
};

const EditorGuia: React.FC<{ voz: Voz; onGuia: (g: Partial<Guia>) => void; onVoz: (v: Partial<Voz>) => void }> = ({ voz, onGuia, onVoz }) => {
  const g = voz.guia;
  const texto = (k: 'saludo' | 'despedida' | 'emojis' | 'largo' | 'precios' | 'quejas', etiqueta: string, ejemplo: string) => (
    <div>
      <label htmlFor={`voz-${k}`} className={ETIQUETA}>{etiqueta}</label>
      <input id={`voz-${k}`} value={g[k]} onChange={(e) => onGuia({ [k]: e.target.value } as Partial<Guia>)} placeholder={ejemplo} maxLength={300} className={CAMPO} />
    </div>
  );
  return (
    <div className="space-y-3">
      <div>
        <span className={ETIQUETA}>Cómo tratas a la gente</span>
        <div className="grid grid-cols-3 gap-1.5">
          {TRATOS.map((t) => (
            <button key={t.id} type="button" aria-pressed={g.trato === t.id} onClick={() => onGuia({ trato: t.id })}
              className={`px-2 py-1.5 rounded-xl text-[0.75rem] font-bold border transition ios-touch cursor-pointer ${g.trato === t.id
                ? 'bg-[var(--primary)]/10 text-[var(--primary)] border-current ring-1 ring-current'
                : 'bg-slate-50 dark:bg-neutral-800/40 text-slate-500 border-slate-200 dark:border-neutral-700'}`}>{t.label}</button>
          ))}
        </div>
        <p className="mt-1 text-[0.6875rem] text-slate-400">
          {g.trato === 'segun' ? 'De usted a quien no conoces; de tú a las que tengan ese trato en su ficha.' : 'A todas por igual, salvo la que tenga otro trato en su ficha.'}
        </p>
      </div>
      {texto('saludo', 'Cómo saludas a una clienta nueva', 'Hola mi vida 💕 ¿en qué te ayudo?')}
      {texto('despedida', 'Cómo te despides', 'Te esperamos, bendiciones ✨')}
      {texto('emojis', 'Emojis', 'Uso bastantes: 💕 ✨ 🙏')}
      {texto('largo', 'Qué tan largos son tus mensajes', 'Cortos, a veces dos seguidos')}
      {texto('precios', 'Cómo das un precio', 'Digo el precio y lo que incluye')}
      {texto('quejas', 'Si alguien se queja', 'Pido disculpas y le ofrezco arreglarlo sin costo')}
      <ListaEditable etiqueta="Tus frases" ayuda="Lalan las usa cuando caen natural, no todas ni en cada mensaje." valores={g.frases} onCambio={(v) => onGuia({ frases: v })} ejemplo="a la orden" comillas />
      <ListaEditable etiqueta="Lo que nunca dirías" ayuda="Lalan no lo dice nunca." valores={g.nunca} onCambio={(v) => onGuia({ nunca: v })} ejemplo="A las nuevas no les digas mi amor" />
      <ListaEditable etiqueta="Algo más de cómo hablas" ayuda="Lo que quieras que Lalan sepa." valores={g.notas} onCambio={(v) => onGuia({ notas: v })} ejemplo="Siempre doy las gracias por escribir" />
      <div>
        <span className={ETIQUETA}>Así respondes ({voz.ejemplos.length})</span>
        <p className="text-[0.6875rem] text-slate-400 mb-1.5">Ejemplos de tus chats, sin datos de nadie. Lalan solo toma el tono: los precios y las horas salen del salón.</p>
        {voz.ejemplos.length ? (
          <div className="space-y-1.5">
            {voz.ejemplos.map((e, n) => (
              <div key={`${n}-${e.clienta}`} className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 text-[0.75rem] flex items-start gap-2">
                <div className="flex-1 min-w-0 space-y-0.5">
                  <p className="text-slate-500 dark:text-neutral-400">Clienta: {e.clienta}</p>
                  <p className="text-slate-900 dark:text-white">Tú: {e.salon}</p>
                </div>
                <button type="button" onClick={() => onVoz({ ejemplos: voz.ejemplos.filter((_, m) => m !== n) })} aria-label="Quitar ejemplo" className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-neutral-700 cursor-pointer"><X className="w-3.5 h-3.5 text-slate-400" /></button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[0.75rem] text-slate-500">Todavía no hay. Salen solos al subir chats o al corregir a Lalan en Probar.</p>
        )}
      </div>
    </div>
  );
};

// ── Probar: «¿Así respondería yo?» ───────────────────────────────────

interface Intento { respuesta: string | null; pensando: boolean; corrigiendo: boolean; correccion: string; listo: boolean }

const Probar: React.FC<{ voz: Voz; onEjemplo: (e: Ejemplo) => void }> = ({ voz, onEjemplo }) => {
  const { showToast } = useApp();
  const [propio, setPropio] = useState('');
  const [libres, setLibres] = useState<string[]>([]);
  const [intentos, setIntentos] = useState<Record<string, Intento>>({});
  // Los mensajes reales (de sus chats) y los que ella escribe para probar
  // Uno por mensaje: el estado de cada prueba va por el texto de la clienta
  const casos = useMemo(() => {
    const vistos = new Set<string>();
    return [...libres.map((clienta) => ({ clienta, salon: '' })), ...voz.casos].filter((c) => !vistos.has(c.clienta) && !!vistos.add(c.clienta));
  }, [libres, voz.casos]);
  // La última prueba pedida de cada mensaje: una respuesta vieja que llega después no la pisa
  const turno = useRef<Record<string, number>>({});

  const poner = (k: string, v: Partial<Intento>) => setIntentos((x) => ({ ...x, [k]: { respuesta: null, pensando: false, corrigiendo: false, correccion: '', listo: false, ...x[k], ...v } }));
  const probar = async (mensaje: string) => {
    const mio = (turno.current[mensaje] ?? 0) + 1;
    turno.current[mensaje] = mio;
    poner(mensaje, { pensando: true, listo: false, corrigiendo: false });
    try {
      // Con la guía tal como está en pantalla, aunque no la haya guardado
      const r = await apiCadena.post<{ respuesta: string }>('/voz-salon/probar', { mensaje, sede: voz.sede, guia: voz.guia, ejemplos: voz.ejemplos });
      if (turno.current[mensaje] !== mio) return;
      poner(mensaje, { respuesta: r.respuesta, pensando: false });
    } catch (e) {
      if (turno.current[mensaje] !== mio) return;
      poner(mensaje, { pensando: false });
      showToast('No pude probar', mensajeDe(e, 'Inténtalo otra vez.'), 'warning');
    }
  };
  const suenaAMi = (c: Ejemplo, r: string) => { onEjemplo({ clienta: c.clienta, salon: r }); poner(c.clienta, { listo: true }); };
  const corregir = (c: Ejemplo) => {
    const t = intentos[c.clienta]?.correccion.trim();
    if (!t) return;
    onEjemplo({ clienta: c.clienta, salon: t });
    poner(c.clienta, { listo: true, corrigiendo: false });
  };
  const sumarPropio = () => { const t = propio.trim(); if (!t) return; setLibres((l) => [t, ...l.filter((x) => x !== t)]); setPropio(''); void probar(t); };

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-2">
        <textarea rows={2} value={propio} onChange={(e) => setPropio(e.target.value)} placeholder="Escribe como si fueras una clienta: «hola, tienen espacio el sábado?»"
          aria-label="Mensaje de prueba" maxLength={600} className={`${CAMPO} flex-1 resize-none`} />
        <button type="button" onClick={sumarPropio} disabled={!propio.trim()} aria-label="Probar" className="w-11 h-11 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-50"><Wand2 className="w-4 h-4" /></button>
      </div>
      {!casos.length && (
        <p className="text-[0.75rem] text-slate-500">Sube algunos chats en «Chats» y aquí verás mensajes reales de tus clientas con lo que tú respondiste al lado de lo que respondería Lalan.</p>
      )}
      {casos.map((c) => {
        const it = intentos[c.clienta];
        return (
          <div key={c.clienta} className="p-3 rounded-2xl border border-slate-200 dark:border-neutral-700 space-y-2">
            <p className="text-[0.8125rem] text-slate-900 dark:text-white"><span className="text-[0.6875rem] font-bold text-slate-400 uppercase tracking-wider block">Clienta</span>{c.clienta}</p>
            <div className={`grid gap-2 ${c.salon ? 'sm:grid-cols-2' : ''}`}>
              {c.salon && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60">
                  <span className="text-[0.6875rem] font-bold text-slate-400 uppercase tracking-wider">Tú respondiste</span>
                  <p className="text-[0.8125rem] text-slate-800 dark:text-slate-100">{c.salon}</p>
                </div>
              )}
              <div className="p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/30">
                <span className="text-[0.6875rem] font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">Lalan respondería</span>
                {it?.pensando ? <Loader2 className="w-4 h-4 animate-spin text-purple-500 mt-1" />
                  : it?.respuesta ? <p className="text-[0.8125rem] text-slate-900 dark:text-white">{it.respuesta}</p>
                    : <button type="button" onClick={() => void probar(c.clienta)} className="mt-1 text-[0.8125rem] font-bold text-[var(--primary)] flex items-center gap-1 cursor-pointer"><Wand2 className="w-3.5 h-3.5" /> Ver cómo respondería</button>}
              </div>
            </div>
            {it?.respuesta && !it.pensando && (it.listo ? (
              <p className="text-[0.75rem] text-emerald-600 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Anotado como ejemplo de tu voz. Guarda los cambios abajo.</p>
            ) : it.corrigiendo ? (
              <div className="space-y-1.5">
                <label htmlFor={`corr-${c.clienta}`} className={ETIQUETA}>¿Cómo lo dirías tú?</label>
                <textarea id={`corr-${c.clienta}`} rows={2} value={it.correccion} onChange={(e) => poner(c.clienta, { correccion: e.target.value })} maxLength={400} className={`${CAMPO} resize-none`} />
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => poner(c.clienta, { corrigiendo: false })} className={SECUNDARIO}>Cancelar</button>
                  <button type="button" onClick={() => corregir(c)} disabled={!it.correccion.trim()} className={PRINCIPAL}>Así lo digo yo</button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                <button type="button" onClick={() => void probar(c.clienta)} className={SECUNDARIO} aria-label="Otra respuesta"><RotateCcw className="w-4 h-4" /></button>
                <button type="button" onClick={() => poner(c.clienta, { corrigiendo: true, correccion: c.salon || it.respuesta || '' })} className={SECUNDARIO}>Corregir</button>
                <button type="button" onClick={() => suenaAMi(c, it.respuesta!)} className={PRINCIPAL}><Check className="w-4 h-4" /> Suena a mí</button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
};
