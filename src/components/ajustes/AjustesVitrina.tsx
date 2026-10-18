import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowDown, ArrowUp, Check, Copy, Eye, EyeOff, ExternalLink, Globe, ImagePlus, Loader2, Lock, MapPin, Monitor,
  MoveVertical, Pencil, Smartphone, Trash2,
} from 'lucide-react';
import QRCode from 'qrcode';
import { api, urlCortaDeVitrina, urlDeFoto, urlDeVitrina } from '../../services/api';
import { sedePropia } from '../../services/sedeActiva';
import { useApp } from '../../context/AppContext';
import { useSedes } from '../../hooks/useSedes';
import { SelectorSede } from '../ui/SelectorSede';
import { IOSToggle } from '../ui/IOSToggle';
import { THEME_PALETTE_PRESETS } from '../../theme/ThemeContext';
import { fotoParaCatalogo } from '../../utils/fotoParaCatalogo';
import PaginaVitrina from '../vitrina/PaginaVitrina';
import { OrdenCatalogo, RedesSede, UbicacionSede } from './VitrinaOrdenYMapa';
import { paletaVitrina } from '../vitrina/temaVitrina';
import { INFO_BLOQUE_VITRINA, type ConfigVitrina, type DatosVitrina, type DisenoVitrina, type NombreCortoDisponible } from '../../types/vitrina';

/**
 * Ajustes → Vitrina: la página pública de cada sede.
 *
 * Se arma como la pizarra de la pared: los bloques se suben, se bajan y se
 * esconden, y los colores salen de las mismas paletas de Lalan. Lo que se
 * cambia se ve al momento en la vista previa, pero no le llega a nadie hasta
 * tocar «Guardar».
 */

const TARJETA = 'p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs';
const TITULO = 'text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white';
const AYUDA = 'text-[0.75rem] text-slate-400 leading-relaxed';

/** El ancho al que se dibuja la vista previa "de computadora" antes de achicarla */
const ANCHO_PC = 1120;

export const AjustesVitrina: React.FC = () => {
  const { showToast } = useApp();
  const sedes = useSedes();
  const [sedeElegida, setSedeElegida] = useState('');
  const sede = sedeElegida || sedes[0]?.id || '';
  const q = sede ? `?sede=${encodeURIComponent(sede)}` : '';

  const [cfg, setCfg] = useState<ConfigVitrina | null>(null);
  const [previa, setPrevia] = useState<DatosVitrina | null>(null);
  const [borrador, setBorrador] = useState<DisenoVitrina | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const c = await api.get<ConfigVitrina>(`/vitrina${q}`);
      setCfg(c); setBorrador(c.diseno);
      if (c.incluidaEnElPlan) setPrevia(await api.get<DatosVitrina>(`/vitrina/vista-previa${q}`));
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo cargar la Vitrina');
    }
  }, [q]);
  useEffect(() => { setCfg(null); setPrevia(null); void cargar(); }, [cargar]);

  const sucio = !!cfg && !!borrador && JSON.stringify(cfg.diseno) !== JSON.stringify(borrador);
  const cambiar = (c: Partial<DisenoVitrina>) => setBorrador((b) => (b ? { ...b, ...c } : b));

  const guardar = async () => {
    if (!borrador) return;
    setGuardando(true);
    try {
      const c = await api.patch<ConfigVitrina>(`/vitrina${q}`, { diseno: borrador });
      setCfg(c); setBorrador(c.diseno);
      // Lo que se acaba de prender (productos, ofertas) llega con la vista previa nueva
      setPrevia(await api.get<DatosVitrina>(`/vitrina/vista-previa${q}`));
      showToast('Vitrina guardada', c.activa ? 'Tus clientas ya la ven así.' : 'Publícala cuando esté lista.', 'success');
    } catch (e: any) {
      showToast('No se pudo guardar', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    } finally { setGuardando(false); }
  };

  const publicar = async (activa: boolean) => {
    if (!cfg) return;
    if (activa && sucio && !window.confirm('Tienes cambios sin guardar en el diseño. ¿Publicar la Vitrina como está guardada?')) return;
    setCfg({ ...cfg, activa });
    try {
      const c = await api.patch<ConfigVitrina>(`/vitrina${q}`, { activa });
      setCfg((v) => (v ? { ...c, diseno: v.diseno } : c));
      showToast(activa ? 'Vitrina publicada' : 'Vitrina apagada', activa ? 'Comparte el enlace o el QR con tus clientas.' : 'El enlace deja de abrir hasta que la vuelvas a publicar.', activa ? 'success' : 'info');
    } catch (e: any) {
      setCfg({ ...cfg });
      showToast('No se pudo cambiar', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    }
  };

  const subirPortada = async (f: File | undefined) => {
    if (!f) return;
    setSubiendo(true);
    try {
      const foto = await fotoParaCatalogo(f);
      const c = await api.put<ConfigVitrina>(`/vitrina/portada${q}`, { foto });
      setCfg((v) => (v ? { ...v, portada: c.portada } : c));
    } catch (e: any) {
      showToast('No se pudo subir la foto', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    } finally { setSubiendo(false); }
  };
  const quitarPortada = async () => {
    if (!window.confirm('¿Quitar la foto de portada? La Vitrina usará los colores de la paleta en su lugar.')) return;
    try {
      const c = await api.delete<ConfigVitrina>(`/vitrina/portada${q}`);
      setCfg((v) => (v ? { ...v, portada: c.portada } : c));
    } catch (e: any) { showToast('No se pudo quitar', e?.message ?? 'Inténtalo de nuevo.', 'warning'); }
  };

  const selector = <SelectorSede sedes={sedes} value={sede} onChange={setSedeElegida} />;

  if (error) {
    return <div className={TARJETA}><p className="text-sm text-rose-500">{error}</p></div>;
  }
  if (!cfg || !borrador) {
    return <div className={`${TARJETA} flex items-center gap-2 text-sm text-slate-400`}><Loader2 className="w-4 h-4 animate-spin" /> Cargando la Vitrina…</div>;
  }

  if (!cfg.incluidaEnElPlan) {
    return (
      <div className={`${TARJETA} space-y-2`}>
        <div className="flex items-center gap-1.5"><Lock className="w-4 h-4 text-amber-500" /><h2 className={TITULO}>Vitrina</h2></div>
        <p className="text-sm text-slate-700 dark:text-neutral-200">Tu plan no incluye la Vitrina.</p>
        <p className={AYUDA}>
          Es una página con tus servicios, productos y ofertas donde las clientas eligen la hora y reservan solas, y a ti
          te llega el aviso al momento. Viene en los planes Salón y Lounge: pídelo en Ajustes → Mi plan.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Publicacion cfg={cfg} q={q} selector={selector} publicar={publicar} recargar={setCfg} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] xl:items-start">
        <div className="min-w-0 space-y-4">
          {/* Portada */}
          <div className={`${TARJETA} space-y-3`}>
            <Encabezado titulo="Foto de portada" sede={cfg.sede.nombre} />
            {cfg.portada && (
              <AcomodarPortada url={urlDeFoto(cfg.portada)!} y={borrador.portadaY ?? 50} cambiar={(portadaY) => cambiar({ portadaY })} />
            )}
            <div className="flex items-center gap-3">
              {!cfg.portada && (
                <div className="w-28 h-20 rounded-xl overflow-hidden shrink-0 bg-slate-100 dark:bg-neutral-800 grid place-items-center">
                  <ImagePlus className="w-6 h-6 text-slate-300" />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <label className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[0.75rem] font-semibold bg-[var(--primary)] text-white cursor-pointer ${subiendo ? 'opacity-60 pointer-events-none' : ''}`}>
                  {subiendo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />}
                  {cfg.portada ? 'Cambiar foto' : 'Subir foto'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { void subirPortada(e.target.files?.[0]); e.target.value = ''; }} />
                </label>
                {cfg.portada && (
                  <button type="button" onClick={quitarPortada} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-[0.75rem] font-semibold text-rose-600 bg-rose-50 dark:bg-rose-500/10">
                    <Trash2 className="w-3.5 h-3.5" /> Quitar
                  </button>
                )}
              </div>
            </div>
            <p className={AYUDA}>Una foto del local o de un trabajo tuyo. Se ve arriba, detrás del nombre. La foto se guarda sola al subirla; dónde la acomodas se guarda con el diseño.</p>
          </div>

          {/* Colores */}
          <div data-guia="vitrina-colores" className={`${TARJETA} space-y-3`}>
            <Encabezado titulo="Colores" sede={cfg.sede.nombre} />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <ChipPaleta activa={borrador.paleta === null} onClick={() => cambiar({ paleta: null })} id={cfg.sede.paleta} nombre="La de la sede" />
              {THEME_PALETTE_PRESETS.map((p) => (
                <ChipPaleta key={p.id} activa={borrador.paleta === p.id} onClick={() => cambiar({ paleta: p.id })} id={p.id} nombre={p.name} />
              ))}
            </div>
            <div className="flex gap-2">
              {(['claro', 'oscuro'] as const).map((f) => (
                <button key={f} type="button" onClick={() => cambiar({ fondo: f })} aria-pressed={borrador.fondo === f}
                  className={`flex-1 py-2 rounded-xl text-[0.8125rem] font-semibold border transition ${borrador.fondo === f ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--primary)]/5' : 'border-slate-200 dark:border-neutral-700 text-slate-500'}`}>
                  Fondo {f}
                </button>
              ))}
            </div>
          </div>

          {/* Bloques */}
          <div data-guia="vitrina-bloques" className={`${TARJETA} space-y-3`}>
            <Encabezado titulo="Bloques" sede={cfg.sede.nombre} />
            <p className={AYUDA}>Sube, baja o esconde cada bloque. «Tu reserva» no es un bloque: siempre está a la vista.</p>
            <ul className="space-y-1.5">
              {borrador.bloques.map((b, i) => {
                const info = INFO_BLOQUE_VITRINA[b.tipo];
                const mover = (d: -1 | 1) => {
                  const l = [...borrador.bloques];
                  [l[i], l[i + d]] = [l[i + d], l[i]];
                  cambiar({ bloques: l });
                };
                return (
                  <li key={b.tipo} className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 ${b.visible ? 'border-slate-200 dark:border-neutral-700' : 'border-dashed border-slate-200 dark:border-neutral-800 opacity-60'}`}>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[0.8125rem] font-semibold text-slate-800 dark:text-neutral-100">{info.nombre}</span>
                      <span className="block text-[0.6875rem] text-slate-400 truncate">{info.ayuda}</span>
                    </span>
                    <button type="button" disabled={i === 0} onClick={() => mover(-1)} aria-label={`Subir ${info.nombre}`} className="w-8 h-8 grid place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-neutral-800 disabled:opacity-25"><ArrowUp className="w-4 h-4" /></button>
                    <button type="button" disabled={i === borrador.bloques.length - 1} onClick={() => mover(1)} aria-label={`Bajar ${info.nombre}`} className="w-8 h-8 grid place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-neutral-800 disabled:opacity-25"><ArrowDown className="w-4 h-4" /></button>
                    <button type="button" onClick={() => cambiar({ bloques: borrador.bloques.map((x, j) => (j === i ? { ...x, visible: !x.visible } : x)) })}
                      aria-pressed={b.visible} aria-label={b.visible ? `Esconder ${info.nombre}` : `Mostrar ${info.nombre}`}
                      className={`w-8 h-8 grid place-items-center rounded-lg ${b.visible ? 'text-[var(--primary)] bg-[var(--primary)]/10' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800'}`}>
                      {b.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <OrdenCatalogo datos={previa} borrador={borrador} sede={cfg.sede.nombre} cambiar={cambiar} />

          <UbicacionSede cfg={cfg} q={q} direccion={previa?.sede.direccion ?? null} recargar={(c) => setCfg((v) => (v ? { ...c, diseno: v.diseno } : c))} />

          <RedesSede cfg={cfg} q={q} recargar={(c) => setCfg((v) => (v ? { ...c, diseno: v.diseno } : c))} />

          {/* Textos y reservas */}
          <div className={`${TARJETA} space-y-3`}>
            <Encabezado titulo="Textos y reservas" sede={cfg.sede.nombre} />
            <label className="block space-y-1">
              <span className="text-[0.75rem] font-semibold text-slate-600 dark:text-neutral-300">Título de la portada</span>
              <input value={borrador.titulo ?? ''} maxLength={80} onChange={(e) => cambiar({ titulo: e.target.value || null })}
                placeholder={cfg.sede.nombre}
                className="w-full px-3 py-2 rounded-xl text-[0.875rem] text-slate-800 dark:text-neutral-100 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700" />
            </label>
            <label className="block space-y-1">
              <span className="text-[0.75rem] font-semibold text-slate-600 dark:text-neutral-300">Mensaje <span className="font-normal text-slate-400">(sale en el bloque «Mensaje»)</span></span>
              <textarea value={borrador.mensaje ?? ''} maxLength={400} rows={3} onChange={(e) => cambiar({ mensaje: e.target.value || null })}
                placeholder="Bienvenida, promoción del mes, un aviso…"
                className="w-full px-3 py-2 rounded-xl text-[0.875rem] text-slate-800 dark:text-neutral-100 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 resize-none" />
            </label>
            {!!borrador.mensaje && !borrador.bloques.find((b) => b.tipo === 'mensaje')?.visible && (
              <p className="text-[0.75rem] text-amber-600">El bloque «Mensaje» está escondido: muéstralo para que se vea.</p>
            )}
            <Opcion titulo="La reserva entra confirmada" detalle={borrador.confirmaSola ? 'La cita queda confirmada al momento y te llega el aviso.' : 'La cita queda pendiente hasta que la confirmes tú.'}
              valor={borrador.confirmaSola} cambiar={(v) => cambiar({ confirmaSola: v })} />
            {!borrador.confirmaSola && <Recordatorio minutos={borrador.minutosParaRecordar ?? MINUTOS_PARA_RECORDAR} cambiar={(m) => cambiar({ minutosParaRecordar: m })} />}
            <Opcion titulo="Puede elegir especialista" detalle={borrador.elegirEspecialista ? 'Elige con quién, o «quien esté libre».' : 'Se le asigna quien esté libre.'}
              valor={borrador.elegirEspecialista} cambiar={(v) => cambiar({ elegirEspecialista: v })} />
          </div>

          <Publicados cfg={cfg} />
        </div>

        {/* Vista previa */}
        <div className="min-w-0 xl:sticky xl:top-4 space-y-3">
          <VistaPrevia datos={previa ? {
            ...previa, diseno: { ...borrador, paleta: borrador.paleta ?? cfg.sede.paleta }, portada: cfg.portada,
            // El pin recién guardado, sin esperar a recargar la vista previa
            sede: {
              ...previa.sede, latitud: cfg.ubicacion?.latitud ?? null, longitud: cfg.ubicacion?.longitud ?? null,
              ...(cfg.redes ? { instagram: cfg.redes.instagram, facebook: cfg.redes.facebook } : {}),
            },
          } : null} />
        </div>
      </div>

      {/* Guardar: a la vista mientras haya cambios */}
      {sucio && (
        <div className="sticky bottom-3 z-20 flex items-center gap-2 p-2 pl-4 rounded-2xl bg-slate-900 text-white shadow-lg">
          <span className="flex-1 text-[0.8125rem]">Tienes cambios sin guardar</span>
          <button type="button" onClick={() => setBorrador(cfg.diseno)} className="px-3 py-2 rounded-xl text-[0.8125rem] text-white/80 hover:bg-white/10">Descartar</button>
          <button type="button" onClick={guardar} disabled={guardando} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[0.8125rem] font-semibold bg-[var(--primary)] disabled:opacity-60">
            {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Guardar
          </button>
        </div>
      )}
    </div>
  );
};

/* ───────────── piezas ───────────── */

const Encabezado: React.FC<{ titulo: string; sede: string }> = ({ titulo, sede }) => (
  <div className="flex items-center justify-between gap-2">
    <h2 className={TITULO}>{titulo}</h2>
    <span className="inline-flex min-w-0 max-w-[55%] items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-neutral-800 text-[0.6875rem] text-slate-500 dark:text-neutral-400">
      <MapPin className="w-3 h-3 shrink-0" /><span className="truncate">{sede}</span>
    </span>
  </div>
);

const ChipPaleta: React.FC<{ activa: boolean; onClick: () => void; id: string | null; nombre: string }> = ({ activa, onClick, id, nombre }) => {
  const p = paletaVitrina(id);
  return (
    <button type="button" onClick={onClick} aria-pressed={activa}
      className={`flex items-center gap-2 p-2 rounded-xl border text-left transition ${activa ? 'border-[var(--primary)] ring-1 ring-[var(--primary)]' : 'border-slate-200 dark:border-neutral-700'}`}>
      <span className="flex -space-x-1.5 shrink-0">
        {[p.primary, p.accent, p.tertiary].map((c) => <span key={c} className="w-4 h-4 rounded-full ring-2 ring-white dark:ring-neutral-900" style={{ background: c }} />)}
      </span>
      <span className="text-[0.75rem] font-medium text-slate-700 dark:text-neutral-200 truncate">{nombre}</span>
    </button>
  );
};

const Opcion: React.FC<{ titulo: string; detalle: string; valor: boolean; cambiar: (v: boolean) => void }> = ({ titulo, detalle, valor, cambiar }) => (
  <div className="flex items-center gap-3 pt-1">
    <span className="flex-1 min-w-0">
      <span className="block text-[0.8125rem] font-semibold text-slate-800 dark:text-neutral-100">{titulo}</span>
      <span className="block text-[0.6875rem] text-slate-400">{detalle}</span>
    </span>
    <IOSToggle checked={valor} onChange={cambiar} ariaLabel={titulo} />
  </div>
);

const MINUTOS_PARA_RECORDAR = 5;
const OPCIONES_RECORDAR = [5, 10, 15, 30, 0];

/**
 * Si nadie confirma una reserva en esos minutos, Lalan le vuelve a avisar al
 * equipo y, si la clienta ya escribió por WhatsApp, le dice que la están
 * revisando. Una sola vez, con un texto fijo: no gasta mensajes del plan.
 */
const Recordatorio: React.FC<{ minutos: number; cambiar: (m: number) => void }> = ({ minutos, cambiar }) => (
  <div className="pt-1 space-y-1.5">
    <span className="block text-[0.8125rem] font-semibold text-slate-800 dark:text-neutral-100">Si nadie la confirma</span>
    <div className="flex gap-1.5" role="group" aria-label="Si nadie la confirma">
      {OPCIONES_RECORDAR.map((m) => (
        <button key={m} type="button" onClick={() => cambiar(m)} aria-pressed={minutos === m}
          className={`flex-1 py-2 rounded-xl text-[0.75rem] font-semibold border transition cursor-pointer ${minutos === m ? 'border-[var(--primary)] text-[var(--primary)] bg-[var(--primary)]/5' : 'border-slate-200 dark:border-neutral-700 text-slate-500'}`}>
          {m ? `${m} min` : 'No'}
        </button>
      ))}
    </div>
    <span className="block text-[0.6875rem] text-slate-400">
      {minutos
        ? `A los ${minutos} minutos te lo volvemos a avisar y, si la clienta ya escribió por WhatsApp, le decimos que la estás revisando. No gasta mensajes de tu plan.`
        : 'No se te recuerda ni se le escribe a la clienta mientras esperas.'}
    </span>
  </div>
);

/** El enlace con `?de=…` antes del #, para contar desde dónde llegan las visitas */
const conOrigen = (url: string, de: string) => {
  const [base, hash] = url.split('#');
  return `${base}${base.includes('?') ? '&' : '?'}de=${encodeURIComponent(de)}${hash !== undefined ? `#${hash}` : ''}`;
};

/** Publicar, el enlace, el QR y cambiar la dirección */
const Publicacion: React.FC<{
  cfg: ConfigVitrina; q: string; selector: React.ReactNode; publicar: (v: boolean) => void; recargar: (c: ConfigVitrina) => void;
}> = ({ cfg, q, selector, publicar, recargar }) => {
  const { showToast } = useApp();
  // La corta si el salón ya eligió nombre; si no, la larga de siempre
  const url = cfg.direccionCorta ? urlCortaDeVitrina(cfg.direccionCorta) : cfg.slug ? urlDeVitrina(cfg.slug) : null;
  const [qr, setQr] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [slug, setSlug] = useState(cfg.slug ?? '');

  useEffect(() => {
    setSlug(cfg.slug ?? '');
    if (!url) { setQr(null); return; }
    // El QR lleva ?de=qr: así en Métricas las visitas del mostrador salen aparte
    QRCode.toDataURL(conOrigen(url, 'qr'), { margin: 1, width: 240 }).then(setQr).catch(() => setQr(null));
  }, [url, cfg.slug]);

  const copiar = async () => {
    if (!url) return;
    try { await navigator.clipboard.writeText(url); showToast('Enlace copiado', 'Pégalo en tu Instagram, WhatsApp o donde quieras.', 'success'); }
    catch { /* sin portapapeles: el enlace está a la vista */ }
  };

  const cambiarSlug = async () => {
    if (cfg.slug && !window.confirm('Si cambias la dirección, el enlace y el QR que ya compartiste dejan de abrir. ¿Cambiarla?')) return;
    try {
      const c = await api.patch<ConfigVitrina>(`/vitrina${q}`, { slug });
      recargar({ ...c, diseno: cfg.diseno });
      setEditando(false);
      showToast('Dirección cambiada', 'Comparte el enlace nuevo.', 'success');
    } catch (e: any) { showToast('No se pudo cambiar', e?.message ?? 'Inténtalo de nuevo.', 'warning'); }
  };

  return (
    <div className={`${TARJETA} space-y-3`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5"><Globe className="w-4 h-4 text-[var(--primary)]" /><h2 className={TITULO}>Vitrina</h2></div>
        {selector}
      </div>
      <p className={AYUDA}>
        La página de <b>{cfg.sede.nombre}</b> donde tus clientas ven servicios, productos y ofertas, eligen la hora y reservan solas.
        Cada sede tiene la suya, con sus precios y su horario. Las horas libres son las mismas que ofrece Lalan en los chats.
      </p>
      <div data-guia="vitrina-publicar" className="flex items-center gap-3 py-1">
        <span className="flex-1">
          <span className="block text-[0.875rem] font-semibold text-slate-800 dark:text-neutral-100">{cfg.activa ? 'Publicada' : 'Sin publicar'}</span>
          <span className="block text-[0.6875rem] text-slate-400">{cfg.activa ? 'Cualquiera con el enlace puede verla y reservar.' : 'Nadie la ve todavía. Ármala y publícala cuando esté lista.'}</span>
        </span>
        <IOSToggle checked={cfg.activa} onChange={publicar} ariaLabel="Publicar la Vitrina" />
      </div>

      {url && (
        <div className="pt-3 border-t border-slate-100 dark:border-neutral-800 flex flex-col sm:flex-row gap-3">
          {qr && <img src={qr} alt="QR de la Vitrina" className="w-28 h-28 rounded-xl bg-white p-1 border border-slate-200 self-center sm:self-start" />}
          <div className="flex-1 min-w-0 space-y-2">
            {editando ? (
              <div className="flex gap-2">
                <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} maxLength={80} aria-label="Dirección de la Vitrina"
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl text-[0.8125rem] text-slate-800 dark:text-neutral-100 bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700" />
                <button type="button" onClick={cambiarSlug} disabled={!slug || slug === cfg.slug} className="px-3 py-2 rounded-xl text-[0.75rem] font-semibold bg-[var(--primary)] text-white disabled:opacity-50">Cambiar</button>
                <button type="button" onClick={() => { setEditando(false); setSlug(cfg.slug ?? ''); }} className="px-2 text-[0.75rem] text-slate-500">Cancelar</button>
              </div>
            ) : (
              <p className="text-[0.8125rem] font-mono break-all text-slate-700 dark:text-neutral-200">{url}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={copiar} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.75rem] font-semibold text-slate-700 dark:text-neutral-200 bg-slate-100 dark:bg-neutral-800"><Copy className="w-3.5 h-3.5" /> Copiar enlace</button>
              <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.75rem] font-semibold text-slate-700 dark:text-neutral-200 bg-slate-100 dark:bg-neutral-800"><ExternalLink className="w-3.5 h-3.5" /> Abrir</a>
              {!editando && !cfg.nombreCorto && <button type="button" onClick={() => setEditando(true)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.75rem] font-semibold text-slate-700 dark:text-neutral-200 bg-slate-100 dark:bg-neutral-800"><Pencil className="w-3.5 h-3.5" /> Cambiar dirección</button>}
            </div>
            {!cfg.activa && <p className="text-[0.6875rem] text-amber-600">El enlace no abre mientras la Vitrina esté sin publicar.</p>}
          </div>
        </div>
      )}

      <DireccionCorta cfg={cfg} q={q} recargar={recargar} />
    </div>
  );
};

/** Solo lo que vale en un nombre corto: "@Lalan Spa" → "lalanspa" */
const limpiarNombre = (v: string) => v.trim().replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 30);

/**
 * La dirección corta, como el usuario de Instagram: el nombre es de todo el
 * salón (lo cambia quien ve todas las sedes) y cada sede suma su parte
 * cuando hay más de una publicada.
 */
const DireccionCorta: React.FC<{ cfg: ConfigVitrina; q: string; recargar: (c: ConfigVitrina) => void }> = ({ cfg, q, recargar }) => {
  const { showToast } = useApp();
  const variasSedes = useSedes({ todasLasDelSalon: true }).length > 1;
  const atada = !!sedePropia();
  const [nombre, setNombre] = useState(cfg.nombreCorto ?? '');
  const [corto, setCorto] = useState(cfg.corto ?? '');
  const [revision, setRevision] = useState<NombreCortoDisponible | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => { setNombre(cfg.nombreCorto ?? ''); setCorto(cfg.corto ?? ''); }, [cfg.nombreCorto, cfg.corto]);

  // ¿Está libre? Se pregunta cuando deja de escribir
  useEffect(() => {
    setRevision(null);
    if (!nombre || nombre === cfg.nombreCorto) return;
    let vigente = true;
    const t = window.setTimeout(() => {
      api.get<NombreCortoDisponible>(`/vitrina/nombre-corto/disponible?nombre=${encodeURIComponent(nombre)}`)
        .then((r) => { if (vigente) setRevision(r); })
        .catch(() => undefined);
    }, 400);
    return () => { vigente = false; window.clearTimeout(t); };
  }, [nombre, cfg.nombreCorto]);

  const releer = async () => {
    const c = await api.get<ConfigVitrina>(`/vitrina${q}`);
    recargar({ ...c, diseno: cfg.diseno });
  };

  const guardarNombre = async () => {
    if (cfg.nombreCorto && !window.confirm(`La dirección de antes (/${cfg.nombreCorto}) seguirá llevando aquí unos días y luego quedará libre para otro salón. ¿Cambiarla por /${nombre}?`)) return;
    setOcupado(true);
    try {
      await api.put(`/vitrina/nombre-corto`, { nombre });
      await releer();
      showToast('Dirección guardada', 'Ya puedes compartir el enlace corto.', 'success');
    } catch (e: any) { showToast('No se pudo guardar', e?.message ?? 'Inténtalo de nuevo.', 'warning'); }
    finally { setOcupado(false); }
  };

  const guardarCorto = async () => {
    setOcupado(true);
    try {
      const c = await api.patch<ConfigVitrina>(`/vitrina${q}`, { corto });
      recargar({ ...c, diseno: cfg.diseno });
      showToast('Dirección de la sede guardada', `${cfg.sede.nombre} ya abre con /${c.nombreCorto ?? 'tu-nombre'}/${c.corto}.`, 'success');
    } catch (e: any) { showToast('No se pudo guardar', e?.message ?? 'Inténtalo de nuevo.', 'warning'); }
    finally { setOcupado(false); }
  };

  const dominio = `${window.location.host}/`;
  const puedeGuardar = !!nombre && nombre !== cfg.nombreCorto && revision?.nombre === nombre && revision.libre;
  const CAMPO = 'flex items-center min-w-0 flex-1 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 overflow-hidden';
  const BOTON = 'px-3 py-2 rounded-xl text-[0.75rem] font-semibold bg-[var(--primary)] text-white disabled:opacity-50 inline-flex items-center gap-1.5';

  return (
    <div data-guia="vitrina-direccion" className="pt-3 border-t border-slate-100 dark:border-neutral-800 space-y-3">
      <div>
        <span className="block text-[0.8125rem] font-semibold text-slate-800 dark:text-neutral-100">Dirección corta</span>
        <span className={`block ${AYUDA}`}>
          Como tu usuario de Instagram: un nombre para todo el salón{variasSedes ? ', y cada sede le suma su parte' : ''}. Fácil de decir y de poner en tu biografía.
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex gap-2">
          <label className={CAMPO}>
            <span className="pl-3 text-[0.75rem] text-slate-400 whitespace-nowrap">{dominio}</span>
            <input value={nombre} onChange={(e) => setNombre(limpiarNombre(e.target.value))} disabled={atada} maxLength={30}
              placeholder="tusalon" aria-label="Nombre corto del salón" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              className="flex-1 min-w-0 bg-transparent py-2 pr-3 text-[0.8125rem] font-mono text-slate-800 dark:text-neutral-100 outline-none disabled:opacity-60" />
          </label>
          {!atada && (
            <button type="button" onClick={guardarNombre} disabled={!puedeGuardar || ocupado} className={BOTON}>
              {ocupado && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {cfg.nombreCorto ? 'Cambiar' : 'Guardar'}
            </button>
          )}
        </div>
        {atada ? (
          <p className="text-[0.6875rem] text-slate-400">El nombre del salón lo cambia quien ve todas las sedes.</p>
        ) : revision && revision.nombre === nombre ? (
          <p className={`text-[0.6875rem] flex items-center gap-1 ${revision.libre ? 'text-emerald-600' : 'text-rose-500'}`}>
            {revision.libre ? <><Check className="w-3.5 h-3.5" /> Está libre</> : revision.motivo}
          </p>
        ) : !cfg.nombreCorto ? (
          <p className="text-[0.6875rem] text-slate-400">De 3 a 30 letras o números; puedes usar punto, guion y guion bajo.</p>
        ) : null}
      </div>

      {variasSedes && (
        <div className="space-y-1">
          <span className="block text-[0.75rem] font-semibold text-slate-700 dark:text-neutral-200">La parte de {cfg.sede.nombre}</span>
          <div className="flex gap-2">
            <label className={CAMPO}>
              <span className="pl-3 text-[0.75rem] text-slate-400 whitespace-nowrap">/{cfg.nombreCorto || 'tusalon'}/</span>
              <input value={corto} onChange={(e) => setCorto(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40))} maxLength={40}
                aria-label={`Parte de la dirección de ${cfg.sede.nombre}`} autoCapitalize="none" autoCorrect="off" spellCheck={false}
                className="flex-1 min-w-0 bg-transparent py-2 pr-3 text-[0.8125rem] font-mono text-slate-800 dark:text-neutral-100 outline-none" />
            </label>
            <button type="button" onClick={guardarCorto} disabled={!corto || corto === cfg.corto || ocupado} className={BOTON}>Guardar</button>
          </div>
          <p className="text-[0.6875rem] text-slate-400">
            Quien entra solo con /{cfg.nombreCorto || 'tusalon'} elige la sede viendo la dirección de cada una.
          </p>
        </div>
      )}
    </div>
  );
};

/** Cuánto del catálogo sale en la Vitrina (se decide en Catálogo, en cada servicio y producto) */
const Publicados: React.FC<{ cfg: ConfigVitrina }> = ({ cfg }) => {
  const p = cfg.publicados;
  return (
    <div className={`${TARJETA} space-y-2`}>
      <Encabezado titulo="Qué sale en la Vitrina" sede={cfg.sede.nombre} />
      <p className="text-[0.8125rem] text-slate-700 dark:text-neutral-200">
        {p.serviciosPublicados} de {p.servicios} servicios · {p.productosPublicados} de {p.productos} productos
      </p>
      <p className={AYUDA}>
        Se elige en Catálogo con el interruptor «Sale en la Vitrina» de cada servicio, producto y oferta. Los productos solo
        salen si hay existencias en esta sede, y los precios son los de esta sede.
      </p>
    </div>
  );
};

/** La Vitrina tal cual, en un teléfono o en una computadora achicada */
const VistaPrevia: React.FC<{ datos: DatosVitrina | null }> = ({ datos }) => {
  const [modo, setModo] = useState<'movil' | 'pc'>('movil');
  const caja = useRef<HTMLDivElement>(null);
  const [ancho, setAncho] = useState(0);
  useLayoutEffect(() => {
    const el = caja.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAncho(el.clientWidth));
    ro.observe(el);
    setAncho(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  const escala = modo === 'pc' && ancho ? Math.min(1, ancho / ANCHO_PC) : 1;
  const alto = 640;
  const pagina = datos ? <PaginaVitrina datos={datos} slug={null} previa /> : null;

  return (
    <div className={`${TARJETA} space-y-3`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className={TITULO}>Vista previa</h2>
        <div className="flex p-0.5 rounded-full bg-slate-100 dark:bg-neutral-800">
          {([['movil', Smartphone, 'Teléfono'], ['pc', Monitor, 'Computadora']] as const).map(([id, Icono, nombre]) => (
            <button key={id} type="button" onClick={() => setModo(id)} aria-pressed={modo === id}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.6875rem] font-semibold ${modo === id ? 'bg-white dark:bg-neutral-700 shadow-xs text-slate-900 dark:text-white' : 'text-slate-500'}`}>
              <Icono className="w-3.5 h-3.5" /> {nombre}
            </button>
          ))}
        </div>
      </div>
      <div ref={caja} className="w-full">
        {/* El transform hace que lo "fixed" de la página (la barra, la hoja, la reserva a pantalla completa) quede dentro de la caja */}
        <div
          className={`relative mx-auto overflow-hidden border border-slate-200 dark:border-neutral-700 bg-white [transform:translateZ(0)] ${modo === 'movil' ? 'rounded-[32px]' : 'rounded-xl'}`}
          style={{ width: modo === 'movil' ? Math.min(380, ancho || 380) : '100%', height: alto }}
        >
          {!pagina ? (
            <div className="h-full grid place-items-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : modo === 'movil' ? (
            <div className="h-full overflow-y-auto">{pagina}</div>
          ) : (
            <div style={{ width: ANCHO_PC, height: alto / escala, transform: `scale(${escala})`, transformOrigin: 'top left' }}>
              <div className="h-full overflow-y-auto">{pagina}</div>
            </div>
          )}
        </div>
      </div>
      <p className={AYUDA}>Aquí puedes probar elegir servicios. Las horas libres y el botón de reservar solo funcionan en la Vitrina publicada.</p>
    </div>
  );
};

/**
 * La foto de portada con el mismo recorte que tendrá en la Vitrina: la dueña
 * la arrastra hacia arriba o hacia abajo (o usa la barra) hasta que se vea lo
 * que importa, sin caras cortadas. Se guarda con el diseño.
 */
function AcomodarPortada({ url, y, cambiar }: { url: string; y: number; cambiar: (y: number) => void }) {
  const caja = React.useRef<HTMLDivElement>(null);
  const inicio = React.useRef<{ py: number; y: number } | null>(null);
  const mover = (e: React.PointerEvent) => {
    if (!inicio.current || !caja.current) return;
    // Arrastrar hacia abajo muestra lo de arriba de la foto, como al acomodar una foto de perfil
    const delta = ((e.clientY - inicio.current.py) / caja.current.clientHeight) * 100;
    cambiar(Math.round(Math.min(100, Math.max(0, inicio.current.y - delta))));
  };
  return (
    <div className="space-y-2">
      <div
        ref={caja}
        onPointerDown={(e) => { (e.target as Element).setPointerCapture?.(e.pointerId); inicio.current = { py: e.clientY, y }; }}
        onPointerMove={mover}
        onPointerUp={() => { inicio.current = null; }}
        onPointerCancel={() => { inicio.current = null; }}
        className="relative w-full aspect-[16/6] rounded-2xl overflow-hidden bg-slate-100 dark:bg-neutral-800 cursor-grab active:cursor-grabbing touch-none select-none"
      >
        <img src={url} alt="" draggable={false} className="absolute inset-0 w-full h-full object-cover pointer-events-none" style={{ objectPosition: `50% ${y}%` }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
        <span className="absolute left-2 bottom-2 inline-flex items-center gap-1 px-2 py-1 rounded-full bg-black/55 text-white text-[0.6875rem] font-semibold pointer-events-none">
          <MoveVertical className="w-3 h-3" /> Arrastra para acomodarla
        </span>
      </div>
      <label className="flex items-center gap-3 text-[0.75rem] text-slate-600 dark:text-neutral-300">
        <span className="shrink-0">Arriba</span>
        <input type="range" min={0} max={100} value={y} onChange={(e) => cambiar(Number(e.target.value))} className="flex-1 accent-[var(--primary)]" aria-label="Qué parte de la foto se ve" />
        <span className="shrink-0">Abajo</span>
      </label>
    </div>
  );
}
