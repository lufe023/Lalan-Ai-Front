import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Play, RotateCcw, Save } from 'lucide-react';
import { api, pedirAudio } from '../../services/api';
import { cargarAjustesLalan } from '../../utils/ajustesLalan';
import { abrirLalan } from '../lalan/PantallaLalan';
import { EsferaLalan, type ColorEsfera, type EstiloEsfera, type ModoEsfera } from '../lalan/EsferaLalan';
import { decirConNavegador, elegirVozNavegador, hayVozNavegador } from '../../landing/vozNavegador';

type Valor = number | boolean | string;
interface Campo {
  id: string; grupo: string; nombre: string; descripcion: string;
  tipo: 'numero' | 'si_no' | 'texto' | 'opciones';
  porDefecto: Valor; min?: number; max?: number; paso?: number; unidad?: string;
  opciones?: { id: string; nombre: string }[]; soloServidor?: boolean;
}
interface Catalogo { grupos: { id: string; nombre: string }[]; campos: Campo[]; valores: Record<string, Valor>; porDefecto: Record<string, Valor> }

const caja = 'px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.8125rem]';

/** Cómo se lee un valor ("2.8 s", "Sí"…) */
function legible(c: Campo, v: Valor) {
  if (c.tipo === 'si_no') return v ? 'Sí' : 'No';
  if (c.tipo === 'opciones') return c.opciones?.find((o) => o.id === v)?.nombre ?? String(v);
  if (c.tipo === 'numero' && c.unidad === 'ms') return `${(Number(v) / 1000).toLocaleString('es-DO')} s`;
  if (c.tipo === 'numero') return `${Number(v).toLocaleString('es-DO')}${c.unidad ? ` ${c.unidad}` : ''}`;
  return String(v);
}

const Interruptor: React.FC<{ si: boolean; onCambio: (v: boolean) => void; etiqueta: string }> = ({ si, onCambio, etiqueta }) => (
  <button type="button" role="switch" aria-checked={si} aria-label={etiqueta} onClick={() => onCambio(!si)}
    className={`relative w-10 h-6 rounded-full shrink-0 transition-colors cursor-pointer ${si ? 'bg-[var(--primary)]' : 'bg-slate-300 dark:bg-neutral-700'}`}>
    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${si ? 'left-[18px]' : 'left-0.5'}`} />
  </button>
);

const Control: React.FC<{ c: Campo; v: Valor; onCambio: (v: Valor) => void }> = ({ c, v, onCambio }) => {
  if (c.tipo === 'si_no') return <Interruptor si={!!v} onCambio={onCambio} etiqueta={c.nombre} />;
  if (c.tipo === 'opciones') {
    return (
      <div className="inline-flex flex-wrap gap-1 p-1 rounded-xl bg-slate-100 dark:bg-neutral-800">
        {c.opciones?.map((o) => (
          <button key={o.id} type="button" onClick={() => onCambio(o.id)} aria-pressed={v === o.id}
            className={`px-3 py-1.5 rounded-lg text-[0.8125rem] font-semibold cursor-pointer ${v === o.id ? 'bg-white dark:bg-neutral-900 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}>
            {o.nombre}
          </button>
        ))}
      </div>
    );
  }
  if (c.tipo === 'texto') return <input value={String(v)} onChange={(e) => onCambio(e.target.value)} className={`${caja} w-full`} />;
  const esMs = c.unidad === 'ms';
  // Los milisegundos se muestran en segundos: nadie piensa en "2800 ms"
  const mostrar = esMs ? Number(v) / 1000 : Number(v);
  const factor = esMs ? 1000 : 1;
  return (
    <div className="flex items-center gap-3 w-full">
      <input type="range" min={(c.min ?? 0) / factor} max={(c.max ?? 100) / factor} step={(c.paso ?? 1) / factor} value={mostrar}
        onChange={(e) => onCambio(Number(e.target.value) * factor)} aria-label={c.nombre}
        className="flex-1 min-w-0 accent-[var(--primary)]" />
      <div className="flex items-center gap-1 shrink-0">
        <input type="number" min={(c.min ?? 0) / factor} max={(c.max ?? 100) / factor} step={(c.paso ?? 1) / factor} value={mostrar}
          onChange={(e) => onCambio(Number(e.target.value) * factor)} aria-label={`${c.nombre} (número)`}
          className={`${caja} w-20 text-right tabular-nums`} />
        <span className="text-[0.75rem] text-slate-400 w-10">{esMs ? 's' : c.unidad ?? ''}</span>
      </div>
    </div>
  );
};

/**
 * Elegir la esfera viéndola: cada forma (o color) se muestra moviéndose, y
 * arriba una grande que se puede poner a escuchar, pensar o hablar.
 */
const SelectorEsfera: React.FC<{ campo: 'estiloEsfera' | 'colorEsfera'; c: Campo; v: Valor; todo: Record<string, Valor>; onCambio: (v: Valor) => void }> = ({ campo, c, v, todo, onCambio }) => (
  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
    {c.opciones?.map((o) => {
      const elegida = v === o.id;
      return (
        <button key={o.id} type="button" onClick={() => onCambio(o.id)} aria-pressed={elegida}
          className={`flex flex-col items-center gap-1 p-2 rounded-2xl border-2 cursor-pointer transition-colors ${elegida ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-transparent bg-slate-50 dark:bg-neutral-800/60 hover:border-slate-200 dark:hover:border-neutral-700'}`}>
          <EsferaLalan modo={elegida ? 'hablando' : 'reposo'} tamano={64}
            estilo={(campo === 'estiloEsfera' ? o.id : todo.estiloEsfera) as EstiloEsfera}
            color={(campo === 'colorEsfera' ? o.id : todo.colorEsfera) as ColorEsfera}
            ritmo={Number(todo.ritmoEsfera) || 1} reaccion={Number(todo.reaccionEsfera) || 1} simulada />
          <span className={`text-[0.75rem] font-semibold ${elegida ? 'text-[var(--primary)]' : 'text-slate-500'}`}>{o.nombre}</span>
        </button>
      );
    })}
  </div>
);

const MODOS_VISTA: { id: ModoEsfera; nombre: string }[] = [
  { id: 'reposo', nombre: 'En reposo' }, { id: 'escuchando', nombre: 'Escuchando' }, { id: 'pensando', nombre: 'Pensando' }, { id: 'hablando', nombre: 'Hablando' },
];

/** La esfera grande, con el estilo del borrador, en el estado que se elija */
const VistaEsfera: React.FC<{ todo: Record<string, Valor> }> = ({ todo }) => {
  const [modo, setModo] = useState<ModoEsfera>('hablando');
  const [nivel, setNivel] = useState(0);
  // Simula la voz de quien habla al "escuchar" (al "hablar", la esfera simula la de Lalan)
  useEffect(() => {
    const id = window.setInterval(() => setNivel(0.15 + Math.random() * 0.6), 220);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div className="flex flex-col items-center gap-2 p-3 rounded-2xl bg-slate-50 dark:bg-neutral-800/60">
      <EsferaLalan modo={modo} tamano={Math.min(180, Number(todo.tamanoEsfera) || 150)} nivel={modo === 'escuchando' ? nivel : 0} simulada
        estilo={todo.estiloEsfera as EstiloEsfera} color={todo.colorEsfera as ColorEsfera} ritmo={Number(todo.ritmoEsfera) || 1}
        reaccion={Number(todo.reaccionEsfera) || 1} />
      <div className="inline-flex flex-wrap justify-center gap-1 p-1 rounded-xl bg-white dark:bg-neutral-900">
        {MODOS_VISTA.map((x) => (
          <button key={x.id} type="button" onClick={() => setModo(x.id)} aria-pressed={modo === x.id}
            className={`px-2.5 py-1 rounded-lg text-[0.75rem] font-semibold cursor-pointer ${modo === x.id ? 'bg-[var(--primary)] text-white' : 'text-slate-500'}`}>
            {x.nombre}
          </button>
        ))}
      </div>
    </div>
  );
};

const FRASE_DE_PRUEBA = 'Buenas tardes. Hoy tienes seis citas y la tarde libre de tres a cinco. Ana te espera en WhatsApp: pregunta si hay cupo el jueves. ¿Quieres que le diga que sí?';

/** Oír la voz de Cloudflare elegida (sin guardar) y ver cuánto se ha usado este mes */
const PruebaVoz: React.FC<{ motor: string; voz: string; frase?: string; sinConsumo?: boolean }> = ({ motor, voz, frase = FRASE_DE_PRUEBA, sinConsumo }) => {
  const [texto, setTexto] = useState(frase);
  const [estado, setEstado] = useState<'' | 'cargando' | 'sonando'>('');
  const [aviso, setAviso] = useState('');
  const [consumo, setConsumo] = useState<{ configurada: boolean; filas: { negocio: string; motor: string; caracteres: number; pedidos: number }[] } | null>(null);
  useEffect(() => { api.get<typeof consumo>('/asistente/voz-lalan/consumo').then(setConsumo).catch(() => undefined); }, []);
  const filas = consumo?.filas.filter((f) => !sinConsumo && !f.negocio.startsWith('Landing')) ?? [];

  if (motor === 'aparato') return <p className="text-[0.75rem] text-slate-400">Con "Aparato" cada teléfono usa su propia voz (Paulina, Google…). Elige MeloTTS o Aura-2 para probar las de Cloudflare.</p>;

  const probar = async () => {
    setAviso(''); setEstado('cargando');
    const t0 = performance.now();
    try {
      const blob = await pedirAudio('/asistente/voz-lalan/prueba', { texto, motor, voz });
      if (!blob) throw new Error('Sin audio');
      const segundos = ((performance.now() - t0) / 1000).toLocaleString('es-DO', { maximumFractionDigits: 1 });
      const audio = new Audio(URL.createObjectURL(blob));
      audio.onended = () => setEstado('');
      setEstado('sonando');
      await audio.play();
      // Lo que cuesta esta frase con Aura-2 (MeloTTS cobra por minuto: casi nada)
      setAviso(`Tardó ${segundos} s en llegar.${motor === 'aura2' ? ` Esta frase cuesta ~US$ ${((texto.length / 1000) * 0.03).toFixed(4)}.` : ''}`);
    } catch (e) {
      setEstado('');
      setAviso((e as Error).message);
    }
  };

  return (
    <div className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-neutral-800/60">
      {consumo && !consumo.configurada && (
        <p className="text-[0.75rem] font-semibold text-amber-700 dark:text-amber-300">Falta configurar Cloudflare en Railway: CLOUDFLARE_ACCOUNT_ID y CLOUDFLARE_AI_TOKEN. Mientras tanto, {sinConsumo ? 'la landing no muestra el botón de voz' : 'Lalan usa la voz del teléfono'}.</p>
      )}
      <textarea value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 600))} rows={3} className={`${caja} w-full`} aria-label="Frase de prueba" />
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => void probar()} disabled={estado !== '' || !texto.trim()}
          className="px-3 py-2 rounded-xl text-[0.8125rem] font-bold text-white bg-[var(--primary)] flex items-center gap-1.5 disabled:opacity-50 cursor-pointer">
          {estado === 'cargando' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
          {estado === 'sonando' ? 'Sonando…' : `Probar la voz (${motor === 'aura2' ? `Aura-2 · ${voz}` : 'MeloTTS'})`}
        </button>
        {aviso && <span className="text-[0.75rem] text-slate-500 dark:text-neutral-400">{aviso}</span>}
      </div>
      {!!filas.length && (
        <div className="text-[0.75rem] text-slate-500 dark:text-neutral-400 space-y-0.5">
          <div className="font-semibold">Este mes</div>
          {filas.map((f) => (
            <div key={f.negocio + f.motor} className="flex justify-between tabular-nums">
              <span>{f.negocio} · {f.motor === 'aura2' ? 'Aura-2' : 'MeloTTS'}</span>
              <span>{f.caracteres.toLocaleString('es-DO')} letras{f.motor === 'aura2' ? ` · ~US$ ${((f.caracteres / 1000) * 0.03).toFixed(2)}` : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const FRASE_LANDING = '¡Holiii, amiga! 💕 Soy Lalan. Te contesto el WhatsApp del salón a cualquier hora y te dejo las citas en la agenda. ¿Tienes tu propio salón? ✨';
const PRECIO_AURA_MIL = 0.03;

interface MetricasVozLanding {
  ajustes: { motor: string; topeMes: number; letrasPorChat: number };
  configurada: boolean;
  consumo: { motor: string; caracteres: number; pedidos: number }[];
  conversaciones: number;
  conVoz: number;
}

/** Probar la voz del navegador como la oirían en la landing */
const PruebaNavegador: React.FC<{ voces: string; velocidad: number }> = ({ voces, velocidad }) => {
  const [texto, setTexto] = useState(FRASE_LANDING);
  const [nombre, setNombre] = useState('');
  const [sonando, setSonando] = useState(false);
  const lista = useMemo(() => voces.split(',').map((v) => v.trim()).filter(Boolean), [voces]);
  useEffect(() => { if (hayVozNavegador()) void elegirVozNavegador(lista).then((v) => setNombre(v ? `${v.name} (${v.lang})` : 'ninguna en español')); }, [lista]);
  if (!hayVozNavegador()) return <p className="text-[0.75rem] text-slate-400">Este navegador no tiene voz para probar.</p>;
  const probar = async () => {
    if (sonando) { speechSynthesis.cancel(); setSonando(false); return; }
    setSonando(true);
    try { await decirConNavegador(texto, lista, velocidad); } finally { setSonando(false); }
  };
  return (
    <div className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-neutral-800/60">
      <textarea value={texto} onChange={(e) => setTexto(e.target.value.slice(0, 600))} rows={3} className={`${caja} w-full`} aria-label="Frase de prueba" />
      <div className="flex items-center gap-2 flex-wrap">
        <button type="button" onClick={() => void probar()} disabled={!texto.trim()}
          className="px-3 py-2 rounded-xl text-[0.8125rem] font-bold text-white bg-[var(--primary)] flex items-center gap-1.5 disabled:opacity-50 cursor-pointer">
          <Play className="w-4 h-4" /> {sonando ? 'Parar' : 'Probar la voz del navegador'}
        </button>
        <span className="text-[0.75rem] text-slate-500 dark:text-neutral-400">En este aparato sonaría: {nombre || '…'}. Cada visita oye la de su propio teléfono o computadora.</span>
      </div>
    </div>
  );
};

/** La voz de la landing: probarla y ver lo que se ha gastado este mes */
const VozLandingPanel: React.FC<{ todo: Record<string, Valor> }> = ({ todo }) => {
  const [m, setM] = useState<MetricasVozLanding | null>(null);
  useEffect(() => { api.get<MetricasVozLanding>('/plataforma/landing/voz').then(setM).catch(() => undefined); }, []);
  const motor = String(todo.landingVoz ?? 'navegador');
  const aura = m?.consumo.find((c) => c.motor === 'aura2');
  const melo = m?.consumo.find((c) => c.motor === 'melotts');
  const tope = Number(todo.landingTopeVozMes) || 0;
  const usado = aura?.caracteres ?? 0;
  const pct = tope ? Math.min(100, Math.round((usado / tope) * 100)) : 0;
  const n = (x: number) => x.toLocaleString('es-DO');
  return (
    <div className="space-y-3">
      {motor === 'apagada' && <p className="text-[0.75rem] text-slate-400">La voz está apagada: las respuestas de la landing no traen botón "Escúchala".</p>}
      {motor === 'navegador' && <PruebaNavegador voces={String(todo.landingVocesNavegador ?? '')} velocidad={Number(todo.landingVelocidadVoz) || 1} />}
      {(motor === 'melotts' || motor === 'aura2') && <PruebaVoz motor={motor} voz={String(todo.landingVozAura ?? 'celeste')} frase={FRASE_LANDING} sinConsumo />}
      {m && (
        <div className="p-3 rounded-xl border border-slate-200 dark:border-neutral-800 space-y-2 text-[0.75rem]">
          <div className="font-semibold text-slate-600 dark:text-neutral-300">Este mes en la landing</div>
          <div className="grid grid-cols-2 gap-2 tabular-nums">
            <div><div className="text-lg font-bold">{n(m.conversaciones)}</div><div className="text-slate-500">conversaciones</div></div>
            <div><div className="text-lg font-bold">{n(m.conVoz)}</div><div className="text-slate-500">usaron la voz de Cloudflare</div></div>
            <div><div className="text-lg font-bold">{n(usado)}</div><div className="text-slate-500">letras con Aura-2 · ~US$ {((usado / 1000) * PRECIO_AURA_MIL).toFixed(2)}</div></div>
            <div><div className="text-lg font-bold">{n(melo?.caracteres ?? 0)}</div><div className="text-slate-500">letras con MeloTTS · casi gratis</div></div>
          </div>
          {tope > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-slate-500"><span>Tope de Aura-2</span><span className="tabular-nums">{n(usado)} / {n(tope)} ({pct}%)</span></div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-neutral-800 overflow-hidden">
                <div className={`h-full rounded-full ${pct >= 90 ? 'bg-rose-500' : 'bg-[var(--primary)]'}`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          )}
          <p className="text-slate-400">La voz del navegador no cuesta y no se cuenta aquí. Los cambios de arriba se aplican al guardar.</p>
        </div>
      )}
    </div>
  );
};

/** Los campos de la landing que no aplican al motor elegido no se muestran */
function aplica(c: Campo, todo: Record<string, Valor>) {
  const motor = String(todo.landingVoz ?? 'navegador');
  if (c.id === 'landingVozAura' || c.id === 'landingTopeVozMes') return motor === 'aura2';
  if (c.id === 'landingLetrasPorChat') return motor === 'aura2' || motor === 'melotts';
  if (c.id === 'landingVocesNavegador') return motor === 'navegador';
  if (c.id === 'landingVelocidadVoz') return motor !== 'apagada';
  return true;
}

/**
 * Plataforma → Lalan: los ajustes GLOBALES de la pantalla de Lalan (todos los
 * salones). Cada teléfono puede elegir su pausa, su voz y si sigue
 * escuchando; aquí se pone lo que vale por defecto y lo que solo decide
 * Lalan (pausas exactas, sensibilidad, fondo, modelo de IA, topes de costo).
 */
export const AjustesLalanPlataforma: React.FC = () => {
  const [cat, setCat] = useState<Catalogo | null>(null);
  const [borrador, setBorrador] = useState<Record<string, Valor>>({});
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');

  const tomar = (c: Catalogo) => { setCat(c); setBorrador(c.valores); };
  const cargar = useCallback(async () => {
    try { tomar(await api.get<Catalogo>('/asistente/ajustes/catalogo')); } catch (e) { setAviso((e as Error).message); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  const cambiados = useMemo(() => (cat ? cat.campos.filter((c) => borrador[c.id] !== cat.valores[c.id]).length : 0), [cat, borrador]);

  const guardar = async () => {
    setGuardando(true); setAviso('');
    try {
      tomar(await api.put<Catalogo>('/asistente/ajustes', { valores: borrador }));
      await cargarAjustesLalan();
      setAviso('Guardado. Los teléfonos lo toman la próxima vez que abran a Lalan.');
    } catch (e) { setAviso((e as Error).message); } finally { setGuardando(false); }
  };

  const restaurar = async () => {
    setGuardando(true); setAviso('');
    try {
      tomar(await api.delete<Catalogo>('/asistente/ajustes'));
      await cargarAjustesLalan();
      setAviso('Listo: todo volvió a lo recomendado.');
    } catch (e) { setAviso((e as Error).message); } finally { setGuardando(false); }
  };

  if (!cat) {
    return <div className="flex items-center gap-2 text-[0.8125rem] text-slate-400 p-4">{aviso || <><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</>}</div>;
  }

  return (
    <div className="space-y-4 text-slate-900 dark:text-neutral-100 dark:[color-scheme:dark]">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <p className="text-[0.8125rem] text-slate-500 dark:text-neutral-400 max-w-xl">
          Ajustes de la pantalla de Lalan para <b>todos los salones</b>. Cada teléfono puede cambiar su pausa, su voz y si sigue escuchando; esto es lo que vale si no ha elegido.
        </p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={abrirLalan} className="px-3 py-2 rounded-xl text-[0.8125rem] font-semibold text-[var(--primary)] bg-[var(--primary)]/10 cursor-pointer">Probar</button>
          <button type="button" onClick={() => void restaurar()} disabled={guardando}
            className="px-3 py-2 rounded-xl text-[0.8125rem] font-semibold text-slate-600 dark:text-neutral-300 bg-slate-100 dark:bg-neutral-800 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer">
            <RotateCcw className="w-4 h-4" /> Lo recomendado
          </button>
          <button type="button" onClick={() => void guardar()} disabled={guardando || !cambiados}
            className="px-4 py-2 rounded-xl text-[0.8125rem] font-bold text-white bg-[var(--primary)] flex items-center gap-1.5 disabled:opacity-40 cursor-pointer">
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar{cambiados ? ` (${cambiados})` : ''}
          </button>
        </div>
      </div>
      {aviso && <p className="text-[0.8125rem] font-semibold text-slate-600 dark:text-neutral-300" role="status">{aviso}</p>}

      <div className="grid lg:grid-cols-2 gap-4 items-start">
        {cat.grupos.map((g) => (
          <section key={g.id} className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">{g.nombre}</h3>
            {g.id === 'apariencia' && <VistaEsfera todo={borrador} />}
            {g.id === 'voz' && <PruebaVoz motor={String(borrador.motorVoz ?? 'aparato')} voz={String(borrador.vozAura ?? 'celeste')} />}
            {g.id === 'landing' && <VozLandingPanel todo={borrador} />}
            {cat.campos.filter((c) => c.grupo === g.id && aplica(c, borrador)).map((c) => {
              const v = borrador[c.id] ?? c.porDefecto;
              const distinto = v !== cat.porDefecto[c.id];
              return (
                <div key={c.id} className="space-y-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-[0.875rem] font-semibold">{c.nombre}</div>
                      <div className="text-[0.75rem] text-slate-500 dark:text-neutral-400">{c.descripcion}</div>
                    </div>
                    {c.tipo === 'si_no' && <Control c={c} v={v} onCambio={(x) => setBorrador((b) => ({ ...b, [c.id]: x }))} />}
                  </div>
                  {(c.id === 'estiloEsfera' || c.id === 'colorEsfera')
                    ? <SelectorEsfera campo={c.id} c={c} v={v} todo={borrador} onCambio={(x) => setBorrador((b) => ({ ...b, [c.id]: x }))} />
                    : c.tipo !== 'si_no' && <Control c={c} v={v} onCambio={(x) => setBorrador((b) => ({ ...b, [c.id]: x }))} />}
                  {distinto && (
                    <button type="button" onClick={() => setBorrador((b) => ({ ...b, [c.id]: cat.porDefecto[c.id] }))}
                      className="text-[0.6875rem] font-semibold text-[var(--primary)] cursor-pointer">
                      Recomendado: {legible(c, cat.porDefecto[c.id])} · usar
                    </button>
                  )}
                </div>
              );
            })}
          </section>
        ))}
      </div>
    </div>
  );
};
