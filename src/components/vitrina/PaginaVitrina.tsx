import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle, CalendarDays, Check, ChevronUp, Clock, Facebook, Instagram, Loader2, MapPin, Minus,
  Phone, Plus, ShoppingBag, Sparkles, Star, Tag, User, X,
} from 'lucide-react';
import { ErrorPublico, publicRequest, urlDeFoto } from '../../services/api';
import type {
  DatosVitrina, EspecialistaVitrina, OfertaVitrina, ProductoVitrina, ReservaHecha, ServicioVitrina, TipoBloqueVitrina,
} from '../../types/vitrina';
import { estiloVitrina } from './temaVitrina';

/**
 * La Vitrina tal como la ve una clienta: los bloques en el orden que eligió la
 * dueña, con su paleta, y el panel "Tu reserva" siempre a la vista (al lado
 * en pantallas anchas, como hoja que sube desde abajo en el teléfono).
 *
 * El ancho se mide con container queries y no con el de la ventana: así la
 * vista previa de Ajustes, que vive en una caja angosta, se ve como en un
 * teléfono de verdad.
 *
 * `previa` = la dueña mirando desde Ajustes: se puede elegir todo, pero no se
 * piden horas ni se reserva.
 */

const MAXIMO_SERVICIOS = 4;
const MAXIMO_PRODUCTOS = 6;
const DIAS_EN_LA_TIRA = 30;
const CLAVE_CONTACTO = 'lalan_vitrina_contacto';
/** Desde este ancho "Tu reserva" va al lado (el mismo corte que @4xl, 56rem) */
const ANCHO_CON_PANEL = 896;

interface Props {
  datos: DatosVitrina;
  slug: string | null;
  previa?: boolean;
}

/* ───────────── utilidades ───────────── */

function formateador(moneda: string) {
  try {
    return new Intl.NumberFormat('es-DO', { style: 'currency', currency: moneda, maximumFractionDigits: 2, minimumFractionDigits: 0 });
  } catch {
    return new Intl.NumberFormat('es-DO', { maximumFractionDigits: 2 });
  }
}

const sumarDias = (fecha: string, n: number) => {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const diaDeSemana = (fecha: string) => new Date(`${fecha}T12:00:00Z`).getUTCDay();
const NOMBRE_DIA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const fmtDiaCorto = new Intl.DateTimeFormat('es', { weekday: 'short', timeZone: 'UTC' });
const fmtMes = new Intl.DateTimeFormat('es', { month: 'short', timeZone: 'UTC' });
const fmtFechaLarga = new Intl.DateTimeFormat('es', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });

/** "14:30" → "2:30 p. m." */
function horaBonita(h: string) {
  const [hh, mm] = h.split(':').map(Number);
  return new Date(Date.UTC(2000, 0, 1, hh, mm)).toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' });
}

const duracion = (min: number) => (min >= 60 ? `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ''}` : `${min} min`);

function leerContacto(): { nombre: string; telefono: string } {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_CONTACTO) || 'null');
    return { nombre: typeof v?.nombre === 'string' ? v.nombre : '', telefono: typeof v?.telefono === 'string' ? v.telefono : '' };
  } catch {
    return { nombre: '', telefono: '' };
  }
}
function guardarContacto(nombre: string, telefono: string) {
  try { localStorage.setItem(CLAVE_CONTACTO, JSON.stringify({ nombre, telefono })); } catch { /* sin almacenamiento */ }
}

const iniciales = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

/** Clases que se repiten */
const TARJETA = 'rounded-3xl border border-[var(--v-borde)] bg-[var(--v-sup)]';
const TITULO_BLOQUE = 'text-lg font-bold tracking-tight text-[var(--v-texto)]';
const BOTON_P = 'inline-flex items-center justify-center gap-2 rounded-full bg-[var(--v-p)] px-5 py-3 text-sm font-semibold text-[var(--v-sobre-p)] transition active:scale-[0.98] disabled:opacity-45 disabled:active:scale-100';

/* ───────────── la página ───────────── */

export default function PaginaVitrina({ datos, slug, previa = false }: Props) {
  const { diseno, sede } = datos;
  const dinero = useMemo(() => formateador(sede.moneda), [sede.moneda]);

  const [servicioIds, setServicioIds] = useState<string[]>([]);
  const [productoIds, setProductoIds] = useState<string[]>([]);
  const [ofertaId, setOfertaId] = useState<string | null>(null);
  const [hoja, setHoja] = useState(false);
  const [hecha, setHecha] = useState<ReservaHecha | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Una sola "Tu reserva": al lado si la página es ancha, en la hoja si no.
  // Se mide la página y no la ventana, por la vista previa de Ajustes.
  const raiz = useRef<HTMLDivElement>(null);
  const [ancha, setAncha] = useState(false);
  useLayoutEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const medir = () => setAncha(el.clientWidth >= ANCHO_CON_PANEL);
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    medir();
    return () => ro.disconnect();
  }, []);
  useEffect(() => { if (ancha) setHoja(false); }, [ancha]);

  // Si la dueña cambia el diseño en la vista previa, lo elegido que ya no está se suelta
  useEffect(() => {
    setServicioIds((ids) => ids.filter((id) => datos.servicios.some((s) => s.id === id)));
    setProductoIds((ids) => ids.filter((id) => datos.productos.some((p) => p.id === id)));
  }, [datos.servicios, datos.productos]);

  const avisar = (texto: string) => {
    setAviso(texto);
    window.setTimeout(() => setAviso((a) => (a === texto ? null : a)), 2600);
  };

  const alternarServicio = (id: string) => {
    setServicioIds((ids) => {
      if (ids.includes(id)) return ids.filter((x) => x !== id);
      if (ids.length >= MAXIMO_SERVICIOS) { avisar(`Puedes reservar hasta ${MAXIMO_SERVICIOS} servicios a la vez`); return ids; }
      return [...ids, id];
    });
  };
  const alternarProducto = (id: string) => {
    setProductoIds((ids) => {
      if (ids.includes(id)) return ids.filter((x) => x !== id);
      if (ids.length >= MAXIMO_PRODUCTOS) { avisar(`Puedes apartar hasta ${MAXIMO_PRODUCTOS} productos`); return ids; }
      return [...ids, id];
    });
  };
  const elegirOferta = (o: OfertaVitrina) => {
    if (ofertaId === o.id) { setOfertaId(null); return; }
    const disponibles = o.servicioIds.filter((id) => datos.servicios.some((s) => s.id === id));
    const juntos = [...new Set([...servicioIds, ...disponibles])];
    if (juntos.length > MAXIMO_SERVICIOS) { avisar(`Esa oferta no cabe: quita algún servicio primero (máximo ${MAXIMO_SERVICIOS})`); return; }
    setServicioIds(juntos);
    setOfertaId(o.id);
  };

  // La oferta vale mientras sus servicios sigan elegidos
  const oferta = datos.ofertas.find((o) => o.id === ofertaId) ?? null;
  useEffect(() => {
    if (oferta && !oferta.servicioIds.every((id) => servicioIds.includes(id) || !datos.servicios.some((s) => s.id === id))) setOfertaId(null);
  }, [oferta, servicioIds, datos.servicios]);

  const elegidos = servicioIds.map((id) => datos.servicios.find((s) => s.id === id)).filter(Boolean) as ServicioVitrina[];
  const apartados = productoIds.map((id) => datos.productos.find((p) => p.id === id)).filter(Boolean) as ProductoVitrina[];

  const reiniciar = () => {
    setHecha(null); setServicioIds([]); setProductoIds([]); setOfertaId(null); setHoja(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const bloques = diseno.bloques.filter((b) => b.visible);
  const conPortada = bloques.some((b) => b.tipo === 'portada');

  const pintar = (tipo: TipoBloqueVitrina) => {
    switch (tipo) {
      case 'portada': return <Portada key={tipo} datos={datos} />;
      case 'mensaje': return diseno.mensaje ? <Mensaje key={tipo} texto={diseno.mensaje} /> : null;
      case 'servicios': return <Servicios key={tipo} servicios={datos.servicios} elegidos={servicioIds} alternar={alternarServicio} dinero={dinero} />;
      case 'ofertas': return datos.ofertas.length ? <Ofertas key={tipo} ofertas={datos.ofertas} elegida={ofertaId} elegir={elegirOferta} dinero={dinero} /> : null;
      case 'productos': return datos.productos.length ? <Productos key={tipo} productos={datos.productos} elegidos={productoIds} alternar={alternarProducto} dinero={dinero} /> : null;
      case 'especialistas': return datos.especialistas.length ? <Especialistas key={tipo} lista={datos.especialistas} /> : null;
      case 'horario': return <Horario key={tipo} semana={sede.semana} hoy={sede.hoyFecha} />;
      case 'ubicacion': return <Ubicacion key={tipo} datos={datos} />;
      default: return null;
    }
  };

  const panel = (
    <PanelReserva
      datos={datos} slug={slug} previa={previa} dinero={dinero}
      elegidos={elegidos} apartados={apartados} oferta={oferta}
      quitarServicio={alternarServicio} quitarProducto={alternarProducto}
      alHacer={(r) => { setHecha(r); setHoja(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
    />
  );

  const cuantos = elegidos.length + apartados.length;

  return (
    <div ref={raiz} style={estiloVitrina(diseno)} className="@container min-h-full bg-[var(--v-fondo)] text-[var(--v-texto)] antialiased">
      {hecha ? (
        <Exito hecha={hecha} salon={datos.salon.nombre} otra={reiniciar} />
      ) : (
        <div className="mx-auto max-w-6xl px-4 pt-4 pb-32 @4xl:grid @4xl:grid-cols-[minmax(0,1fr)_360px] @4xl:gap-6 @4xl:px-6 @4xl:pt-6 @4xl:pb-12">
          <main className="min-w-0 space-y-6">
            {!conPortada && <Encabezado datos={datos} />}
            {bloques.map((b) => pintar(b.tipo))}
            <p className="pt-2 text-center text-xs text-[var(--v-suave)]">Reservas con Lalán</p>
          </main>

          {ancha && (
            <aside>
              <div className="sticky top-4">{panel}</div>
            </aside>
          )}
        </div>
      )}

      {/* Teléfono: la barra de abajo siempre a la vista, y la hoja que sube.
          La hoja no se desmonta al cerrarla: lo elegido (día, hora, nombre) sigue ahí. */}
      {!hecha && !ancha && (
        <>
          <div className="fixed inset-x-0 bottom-0 z-30">
            <div className="mx-3 mb-3 rounded-3xl border border-[var(--v-borde)] bg-[var(--v-sup)] p-3 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.35)]">
              <button type="button" onClick={() => setHoja(true)} className="flex w-full items-center gap-3 text-left" aria-haspopup="dialog" aria-expanded={hoja}>
                <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[var(--v-tinte)] text-[var(--v-p)]">
                  <CalendarDays className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">Tu reserva</span>
                  <span className="block truncate text-xs text-[var(--v-suave)]">
                    {cuantos ? `${elegidos.length} servicio${elegidos.length === 1 ? '' : 's'}${apartados.length ? ` · ${apartados.length} para apartar` : ''}` : 'Elige un servicio para empezar'}
                  </span>
                </span>
                <span className={BOTON_P + ' px-4 py-2.5'}>
                  {elegidos.length ? 'Elegir hora' : 'Ver'} <ChevronUp className="size-4" />
                </span>
              </button>
            </div>
          </div>

          <div className={`fixed inset-0 z-40 ${hoja ? '' : 'pointer-events-none'}`} inert={!hoja} aria-hidden={!hoja}>
            <motion.button
              type="button" aria-label="Cerrar" tabIndex={-1} className="absolute inset-0 bg-black/45"
              initial={false} animate={{ opacity: hoja ? 1 : 0 }} onClick={() => setHoja(false)}
            />
            <motion.div
              role="dialog" aria-modal="true" aria-label="Tu reserva"
              className="absolute inset-x-0 bottom-0 max-h-[90%] overflow-y-auto rounded-t-[28px] bg-[var(--v-fondo)] px-3 pb-6 pt-2"
              initial={false} animate={{ y: hoja ? 0 : '105%' }} transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              onKeyDown={(e) => { if (e.key === 'Escape') setHoja(false); }}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between bg-[var(--v-fondo)] px-1 pb-2 pt-1">
                <span className="mx-auto h-1.5 w-10 rounded-full bg-[var(--v-borde)]" />
                <button type="button" onClick={() => setHoja(false)} className="absolute right-1 top-0 grid size-9 place-items-center rounded-full text-[var(--v-suave)]" aria-label="Cerrar">
                  <X className="size-5" />
                </button>
              </div>
              {panel}
            </motion.div>
          </div>
        </>
      )}

      <AnimatePresence>
        {aviso && (
          <motion.div
            role="status" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
            className="fixed inset-x-0 bottom-28 z-50 mx-auto w-fit max-w-[90%] rounded-full bg-[var(--v-texto)] px-4 py-2 text-center text-sm text-[var(--v-fondo)] shadow-lg @4xl:bottom-6"
          >
            {aviso}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ───────────── bloques ───────────── */

function Encabezado({ datos }: { datos: DatosVitrina }) {
  return (
    <header className="flex items-center gap-3 pt-2">
      <span className="grid size-11 place-items-center rounded-2xl bg-[var(--v-p)] text-sm font-bold text-[var(--v-sobre-p)]">{iniciales(datos.salon.nombre)}</span>
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold tracking-tight">{datos.diseno.titulo || datos.salon.nombre}</h1>
        <p className="truncate text-sm text-[var(--v-suave)]">{datos.sede.nombre} · {datos.sede.hoy}</p>
      </div>
    </header>
  );
}

function Portada({ datos }: { datos: DatosVitrina }) {
  const foto = urlDeFoto(datos.portada);
  const abierto = !datos.sede.hoy.startsWith('Hoy está cerrado');
  return (
    <section className="relative overflow-hidden rounded-[28px] bg-[var(--v-p)]">
      {foto ? (
        <img src={foto} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_10%_0%,var(--v-a),transparent_60%),radial-gradient(90%_90%_at_100%_100%,var(--v-t),transparent_55%)] opacity-80" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
      <div className="relative flex min-h-[230px] flex-col justify-end p-5 text-white @2xl:min-h-[300px] @2xl:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">{datos.salon.nombre}</p>
        <h1 className="mt-1 text-3xl font-bold leading-tight tracking-tight @2xl:text-4xl">{datos.diseno.titulo || datos.sede.nombre}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 backdrop-blur">
            <span className={`size-2 rounded-full ${abierto ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            {datos.sede.hoy}
          </span>
          {datos.diseno.titulo && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 backdrop-blur">
              <MapPin className="size-3.5" /> {datos.sede.nombre}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}

function Mensaje({ texto }: { texto: string }) {
  return (
    <section className="rounded-3xl bg-[var(--v-tinte)] p-5">
      <p className="flex gap-3 whitespace-pre-line text-[15px] leading-relaxed">
        <Sparkles className="mt-0.5 size-5 shrink-0 text-[var(--v-p)]" />
        <span>{texto}</span>
      </p>
    </section>
  );
}

function Precio({ s, dinero }: { s: ServicioVitrina; dinero: Intl.NumberFormat }) {
  if (s.precio == null || s.modoPrecio === 'consultar') return <span className="text-[var(--v-suave)]">Precio en el salón</span>;
  return <span className="font-semibold">{s.modoPrecio === 'desde' ? 'Desde ' : ''}{dinero.format(s.precio)}</span>;
}

function Foto({ src, alt }: { src: string | null; alt: string }) {
  const url = urlDeFoto(src);
  return url ? (
    <img src={url} alt={alt} loading="lazy" className="size-full object-cover" />
  ) : (
    <div className="grid size-full place-items-center bg-[var(--v-tinte)] text-[var(--v-p)]"><Sparkles className="size-7 opacity-70" /></div>
  );
}

function Servicios({ servicios, elegidos, alternar, dinero }: {
  servicios: ServicioVitrina[]; elegidos: string[]; alternar: (id: string) => void; dinero: Intl.NumberFormat;
}) {
  const categorias = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of servicios) if (!m.has(s.categoria)) m.set(s.categoria, s.categoriaNombre || s.categoria);
    return [...m.entries()];
  }, [servicios]);
  const [cat, setCat] = useState<string | null>(null);
  const lista = cat ? servicios.filter((s) => s.categoria === cat) : servicios;

  return (
    <section aria-labelledby="v-servicios">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 id="v-servicios" className={TITULO_BLOQUE}>Servicios</h2>
        <span className="text-xs text-[var(--v-suave)]">Toca para agregar a tu reserva</span>
      </div>
      {categorias.length > 1 && (
        <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {[[null, 'Todo'] as const, ...categorias].map(([id, nombre]) => (
            <button
              key={id ?? 'todo'} type="button" onClick={() => setCat(id)} aria-pressed={cat === id}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${cat === id ? 'bg-[var(--v-texto)] text-[var(--v-fondo)]' : 'border border-[var(--v-borde)] bg-[var(--v-sup)]'}`}
            >
              {nombre}
            </button>
          ))}
        </div>
      )}
      {!servicios.length ? (
        <p className={`${TARJETA} p-5 text-sm text-[var(--v-suave)]`}>Pronto verás aquí los servicios de esta sede.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2">
          {lista.map((s) => {
            const dentro = elegidos.includes(s.id);
            return (
              <article key={s.id} className={`${TARJETA} flex overflow-hidden transition ${dentro ? 'ring-2 ring-[var(--v-p)]' : ''}`}>
                <div className="relative w-28 shrink-0 @md:w-32">
                  <Foto src={s.foto} alt={s.nombre} />
                  {s.popular && (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
                      <Star className="size-3 fill-current" /> Favorito
                    </span>
                  )}
                </div>
                <div className="flex min-w-0 flex-1 flex-col p-3.5">
                  <h3 className="font-semibold leading-snug">{s.nombre}</h3>
                  {s.descripcion && <p className="mt-0.5 line-clamp-2 text-xs text-[var(--v-suave)]">{s.descripcion}</p>}
                  <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-sm">
                    <div className="min-w-0">
                      <Precio s={s} dinero={dinero} />
                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-[var(--v-suave)]"><Clock className="size-3" />{duracion(s.duracionMin)}</span>
                    </div>
                    <button
                      type="button" onClick={() => alternar(s.id)} aria-pressed={dentro}
                      aria-label={dentro ? `Quitar ${s.nombre}` : `Agregar ${s.nombre}`}
                      className={`grid size-9 shrink-0 place-items-center rounded-full transition active:scale-95 ${dentro ? 'bg-[var(--v-p)] text-[var(--v-sobre-p)]' : 'bg-[var(--v-tinte)] text-[var(--v-p)]'}`}
                    >
                      {dentro ? <Check className="size-4" /> : <Plus className="size-4" />}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function vigencia(o: OfertaVitrina) {
  const f = (d: string) => `${Number(d.slice(8, 10))} ${fmtMes.format(new Date(`${d}T12:00:00Z`))}`;
  const partes: string[] = [];
  if (o.dias.length && o.dias.length < 7) partes.push(`Solo ${o.dias.map((d) => NOMBRE_DIA[d].toLowerCase()).join(', ')}`);
  if (o.hasta) partes.push(`Hasta el ${f(o.hasta)}`);
  return partes.join(' · ');
}

function Ofertas({ ofertas, elegida, elegir, dinero }: {
  ofertas: OfertaVitrina[]; elegida: string | null; elegir: (o: OfertaVitrina) => void; dinero: Intl.NumberFormat;
}) {
  return (
    <section aria-labelledby="v-ofertas">
      <h2 id="v-ofertas" className={`${TITULO_BLOQUE} mb-3`}>Ofertas</h2>
      <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {ofertas.map((o) => {
          const dentro = elegida === o.id;
          return (
            <article key={o.id} className="relative w-[260px] shrink-0 snap-start overflow-hidden rounded-3xl bg-[var(--v-p)] p-4 text-[var(--v-sobre-p)]">
              <div className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full bg-[var(--v-a)] opacity-40" />
              <p className="relative inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider opacity-85"><Tag className="size-3" /> Oferta</p>
              <h3 className="relative mt-1 text-lg font-bold leading-snug">{o.nombre}</h3>
              <p className="relative mt-1 line-clamp-2 text-xs opacity-85">{o.descripcion || o.servicios.join(' + ')}</p>
              <div className="relative mt-3 flex items-end justify-between gap-2">
                <div>
                  <p className="text-xl font-bold">{dinero.format(o.precio)}</p>
                  {vigencia(o) && <p className="text-[11px] opacity-80">{vigencia(o)}</p>}
                </div>
                <button
                  type="button" onClick={() => elegir(o)} aria-pressed={dentro}
                  className="rounded-full bg-[var(--v-sobre-p)] px-3.5 py-2 text-xs font-semibold text-[var(--v-p)] transition active:scale-95"
                >
                  {dentro ? 'Elegida ✓' : 'La quiero'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Productos({ productos, elegidos, alternar, dinero }: {
  productos: ProductoVitrina[]; elegidos: string[]; alternar: (id: string) => void; dinero: Intl.NumberFormat;
}) {
  return (
    <section aria-labelledby="v-productos">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 id="v-productos" className={TITULO_BLOQUE}>Productos</h2>
        <span className="text-xs text-[var(--v-suave)]">Apártalos y los pagas en el salón</span>
      </div>
      <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-3 @6xl:grid-cols-4">
        {productos.map((p) => {
          const dentro = elegidos.includes(p.id);
          return (
            <article key={p.id} className={`${TARJETA} overflow-hidden transition ${dentro ? 'ring-2 ring-[var(--v-p)]' : ''}`}>
              <div className="relative aspect-square">
                <Foto src={p.foto} alt={p.nombre} />
                {p.quedanPocos && <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">Quedan pocos</span>}
              </div>
              <div className="p-3">
                <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{p.nombre}</h3>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{dinero.format(p.precio)}</span>
                  <button
                    type="button" onClick={() => alternar(p.id)} aria-pressed={dentro}
                    aria-label={dentro ? `No apartar ${p.nombre}` : `Apartar ${p.nombre}`}
                    className={`grid size-8 place-items-center rounded-full transition active:scale-95 ${dentro ? 'bg-[var(--v-p)] text-[var(--v-sobre-p)]' : 'bg-[var(--v-tinte)] text-[var(--v-p)]'}`}
                  >
                    {dentro ? <Check className="size-4" /> : <ShoppingBag className="size-4" />}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Especialistas({ lista }: { lista: EspecialistaVitrina[] }) {
  return (
    <section aria-labelledby="v-equipo">
      <h2 id="v-equipo" className={`${TITULO_BLOQUE} mb-3`}>Quién te atiende</h2>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {lista.map((e) => (
          <div key={e.id} className={`${TARJETA} w-36 shrink-0 p-4 text-center`}>
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-[var(--v-tinte)] text-lg font-bold text-[var(--v-p)]">{iniciales(e.nombre)}</span>
            <p className="mt-2 truncate text-sm font-semibold">{e.nombre}</p>
            {e.especialidad && <p className="truncate text-xs text-[var(--v-suave)]">{e.especialidad}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

function Horario({ semana, hoy }: { semana: DatosVitrina['sede']['semana']; hoy: string }) {
  const hoyDia = diaDeSemana(hoy);
  // Empieza el lunes, como se lee un horario
  const orden = [1, 2, 3, 4, 5, 6, 0].map((d) => semana.find((x) => x.dia === d)).filter(Boolean) as typeof semana;
  return (
    <section aria-labelledby="v-horario" className={`${TARJETA} p-5`}>
      <h2 id="v-horario" className={`${TITULO_BLOQUE} mb-3`}>Horario</h2>
      <ul className="divide-y divide-[var(--v-borde)] text-sm">
        {orden.map((d) => (
          <li key={d.dia} className={`flex justify-between gap-4 py-2 ${d.dia === hoyDia ? 'font-semibold text-[var(--v-p)]' : ''}`}>
            <span>{NOMBRE_DIA[d.dia]}{d.dia === hoyDia ? ' (hoy)' : ''}</span>
            <span className={d.abierto ? '' : 'text-[var(--v-suave)]'}>
              {d.abierto ? d.tramos.map((t) => `${horaBonita(t.desde)} – ${horaBonita(t.hasta)}`).join(', ') : 'Cerrado'}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Ubicacion({ datos }: { datos: DatosVitrina }) {
  const { direccion, telefono, instagram, facebook } = datos.sede;
  if (!direccion && !telefono && !instagram && !facebook) return null;
  const mapa = direccion ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${datos.salon.nombre} ${direccion}`)}` : null;
  const ig = instagram ? `https://instagram.com/${instagram.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '')}` : null;
  const fb = facebook ? (/^https?:/.test(facebook) ? facebook : `https://facebook.com/${facebook}`) : null;
  const fila = 'flex items-center gap-3 rounded-2xl px-3 py-2.5 transition hover:bg-[var(--v-tinte)]';
  return (
    <section aria-labelledby="v-ubicacion" className={`${TARJETA} p-5`}>
      <h2 id="v-ubicacion" className={`${TITULO_BLOQUE} mb-2`}>Cómo llegar</h2>
      <div className="-mx-3 text-sm">
        {direccion && <a href={mapa!} target="_blank" rel="noreferrer" className={fila}><MapPin className="size-4 shrink-0 text-[var(--v-p)]" /><span>{direccion}</span></a>}
        {telefono && <a href={`tel:${telefono.replace(/[^\d+]/g, '')}`} className={fila}><Phone className="size-4 shrink-0 text-[var(--v-p)]" /><span>{telefono}</span></a>}
        {ig && <a href={ig} target="_blank" rel="noreferrer" className={fila}><Instagram className="size-4 shrink-0 text-[var(--v-p)]" /><span>@{instagram!.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '')}</span></a>}
        {fb && <a href={fb} target="_blank" rel="noreferrer" className={fila}><Facebook className="size-4 shrink-0 text-[var(--v-p)]" /><span>Facebook</span></a>}
      </div>
    </section>
  );
}

/* ───────────── Tu reserva ───────────── */

interface EstadoHoras { cargando: boolean; horas: string[]; cerrado: boolean; error: string | null }

function PanelReserva({
  datos, slug, previa, dinero, elegidos, apartados, oferta, quitarServicio, quitarProducto, alHacer,
}: {
  datos: DatosVitrina; slug: string | null; previa: boolean; dinero: Intl.NumberFormat;
  elegidos: ServicioVitrina[]; apartados: ProductoVitrina[]; oferta: OfertaVitrina | null;
  quitarServicio: (id: string) => void; quitarProducto: (id: string) => void; alHacer: (r: ReservaHecha) => void;
}) {
  const { sede, diseno } = datos;
  const [fecha, setFecha] = useState<string>(sede.hoyFecha);
  const [hora, setHora] = useState<string | null>(null);
  const [especialistaId, setEspecialistaId] = useState<string | null>(null);
  const [contacto, setContacto] = useState(leerContacto);
  const [nota, setNota] = useState('');
  const [estado, setEstado] = useState<EstadoHoras>({ cargando: false, horas: [], cerrado: false, error: null });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recargar, setRecargar] = useState(0);
  const turno = useRef(0);

  const ids = elegidos.map((s) => s.id).join(',');

  // Solo quien hace TODO lo elegido
  const posibles = useMemo(() => {
    if (!diseno.elegirEspecialista) return [];
    return datos.especialistas.filter((e) => !e.categorias || elegidos.every((s) => e.categorias!.includes(s.categoria)));
  }, [datos.especialistas, diseno.elegirEspecialista, elegidos]);
  useEffect(() => {
    if (especialistaId && !posibles.some((e) => e.id === especialistaId)) setEspecialistaId(null);
  }, [posibles, especialistaId]);

  const dias = useMemo(() => {
    const n = Math.max(0, Math.min(sede.diasParaReservar, DIAS_EN_LA_TIRA));
    return Array.from({ length: n + 1 }, (_, i) => {
      const f = sumarDias(sede.hoyFecha, i);
      const abierto = sede.semana.find((d) => d.dia === diaDeSemana(f))?.abierto ?? true;
      return { fecha: f, abierto };
    });
  }, [sede.diasParaReservar, sede.hoyFecha, sede.semana]);

  // Las horas libres de verdad: las mismas que ofrece Lalán en los chats
  useEffect(() => {
    setHora(null);
    if (previa || !slug || !ids) { setEstado({ cargando: false, horas: [], cerrado: false, error: null }); return; }
    const mio = ++turno.current;
    setEstado((e) => ({ ...e, cargando: true, error: null }));
    const q = new URLSearchParams({ fecha, servicios: ids });
    if (especialistaId) q.set('especialista', especialistaId);
    publicRequest<{ fecha: string; cerrado: boolean; horas: string[] }>(`/vitrina/publica/${encodeURIComponent(slug)}/horas?${q}`)
      .then((r) => { if (mio === turno.current) setEstado({ cargando: false, horas: r.horas, cerrado: r.cerrado, error: null }); })
      .catch((e: unknown) => {
        if (mio === turno.current) setEstado({ cargando: false, horas: [], cerrado: false, error: e instanceof ErrorPublico ? e.message : 'No se pudieron cargar las horas' });
      });
  }, [previa, slug, ids, fecha, especialistaId, recargar]);

  // Lo que suma: la oferta a su precio y lo demás por separado
  const resumen = useMemo(() => {
    const enOferta = new Set(oferta?.servicioIds ?? []);
    let total = oferta ? oferta.precio : 0;
    let aproximado = false;
    for (const s of elegidos) {
      if (enOferta.has(s.id)) continue;
      if (s.precio == null || s.modoPrecio === 'consultar') { aproximado = true; continue; }
      if (s.modoPrecio === 'desde') aproximado = true;
      total += s.precio;
    }
    for (const p of apartados) total += p.precio;
    return { total, aproximado, minutos: elegidos.reduce((m, s) => m + s.duracionMin, 0) };
  }, [elegidos, apartados, oferta]);

  const telefonoOk = contacto.telefono.replace(/\D/g, '').length >= 7;
  const listo = !!elegidos.length && !!hora && contacto.nombre.trim().length >= 2 && telefonoOk;

  const reservar = async () => {
    if (!listo || !slug || previa || enviando) return;
    setEnviando(true); setError(null);
    try {
      const r = await publicRequest<ReservaHecha>(`/vitrina/publica/${encodeURIComponent(slug)}/reservas`, {
        method: 'POST',
        body: {
          servicioIds: elegidos.map((s) => s.id), fecha, hora, especialistaId,
          nombre: contacto.nombre.trim(), telefono: contacto.telefono.trim(),
          productoIds: apartados.map((p) => p.id),
          nota: [oferta ? `Viene por la oferta «${oferta.nombre}»` : '', nota.trim()].filter(Boolean).join(' · '),
        },
      });
      guardarContacto(contacto.nombre.trim(), contacto.telefono.trim());
      alHacer(r);
    } catch (e) {
      setError(e instanceof ErrorPublico ? e.message : 'No se pudo reservar. Inténtalo de nuevo.');
      // Si alguien tomó esa hora, se vuelven a pedir las libres
      if (e instanceof ErrorPublico && e.status === 409) setRecargar((n) => n + 1);
    } finally {
      setEnviando(false);
    }
  };

  const paso = 'text-xs font-semibold uppercase tracking-wider text-[var(--v-suave)]';
  const campo = 'w-full rounded-2xl border border-[var(--v-borde)] bg-[var(--v-fondo)] px-4 py-3 text-[15px] outline-none transition placeholder:text-[var(--v-suave)] focus:border-[var(--v-p)]';

  return (
    <div className={`${TARJETA} p-4 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.35)]`}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-bold">Tu reserva</h2>
        <span className="inline-flex items-center gap-1 text-xs text-[var(--v-suave)]"><MapPin className="size-3" />{sede.nombre}</span>
      </div>

      {/* 1. Lo elegido */}
      {!elegidos.length && !apartados.length ? (
        <div className="mt-3 rounded-2xl border border-dashed border-[var(--v-borde)] p-4 text-center text-sm text-[var(--v-suave)]">
          Toca <Plus className="inline size-3.5 align-[-2px]" /> en un servicio para empezar.
        </div>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {elegidos.map((s) => (
            <li key={s.id} className="flex items-center gap-2 rounded-2xl bg-[var(--v-tinte)] py-2 pl-3 pr-1.5 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{s.nombre}</span>
                <span className="text-xs text-[var(--v-suave)]">{duracion(s.duracionMin)}</span>
              </span>
              <button type="button" onClick={() => quitarServicio(s.id)} className="grid size-8 place-items-center rounded-full text-[var(--v-suave)] hover:bg-[var(--v-sup)]" aria-label={`Quitar ${s.nombre}`}>
                <Minus className="size-4" />
              </button>
            </li>
          ))}
          {apartados.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-2xl border border-[var(--v-borde)] py-2 pl-3 pr-1.5 text-sm">
              <ShoppingBag className="size-4 shrink-0 text-[var(--v-p)]" />
              <span className="min-w-0 flex-1 truncate">{p.nombre} <span className="text-xs text-[var(--v-suave)]">· para apartar</span></span>
              <button type="button" onClick={() => quitarProducto(p.id)} className="grid size-8 place-items-center rounded-full text-[var(--v-suave)] hover:bg-[var(--v-sup)]" aria-label={`No apartar ${p.nombre}`}>
                <Minus className="size-4" />
              </button>
            </li>
          ))}
          {oferta && <li className="px-1 text-xs font-medium text-[var(--v-p)]"><Tag className="mr-1 inline size-3" />Oferta «{oferta.nombre}»</li>}
        </ul>
      )}

      {!!elegidos.length && (
        <>
          {/* 2. Con quién */}
          {posibles.length > 0 && (
            <div className="mt-5">
              <p className={paso}>Con quién</p>
              <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
                {[null, ...posibles].map((e) => {
                  const id = e?.id ?? null;
                  const activo = especialistaId === id;
                  return (
                    <button
                      key={id ?? 'libre'} type="button" onClick={() => setEspecialistaId(id)} aria-pressed={activo}
                      className={`flex shrink-0 items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 text-sm transition ${activo ? 'bg-[var(--v-p)] text-[var(--v-sobre-p)]' : 'border border-[var(--v-borde)]'}`}
                    >
                      <span className={`grid size-7 place-items-center rounded-full text-[11px] font-bold ${activo ? 'bg-white/20' : 'bg-[var(--v-tinte)] text-[var(--v-p)]'}`}>
                        {e ? iniciales(e.nombre) : <User className="size-3.5" />}
                      </span>
                      {e ? e.nombre.split(' ')[0] : 'Quien esté libre'}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 3. El día */}
          <div className="mt-5">
            <p className={paso}>Día</p>
            <div className="-mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
              {dias.map((d, i) => {
                const activo = fecha === d.fecha;
                const fechaD = new Date(`${d.fecha}T12:00:00Z`);
                return (
                  <button
                    key={d.fecha} type="button" disabled={!d.abierto} onClick={() => setFecha(d.fecha)} aria-pressed={activo}
                    aria-label={fmtFechaLarga.format(fechaD) + (d.abierto ? '' : ', cerrado')}
                    className={`flex w-14 shrink-0 flex-col items-center rounded-2xl py-2 text-center transition disabled:opacity-35 ${activo ? 'bg-[var(--v-p)] text-[var(--v-sobre-p)]' : 'border border-[var(--v-borde)]'}`}
                  >
                    <span className="text-[11px] capitalize opacity-80">{i === 0 ? 'Hoy' : fmtDiaCorto.format(fechaD).replace('.', '')}</span>
                    <span className="text-lg font-bold leading-tight">{fechaD.getUTCDate()}</span>
                    <span className="text-[10px] capitalize opacity-70">{fmtMes.format(fechaD).replace('.', '')}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. La hora */}
          <div className="mt-5">
            <p className={paso}>Hora</p>
            <div className="mt-2">
              {previa ? (
                <p className="rounded-2xl bg-[var(--v-tinte)] p-3 text-sm">En la vista previa no se ven las horas libres. Tus clientas sí las verán.</p>
              ) : estado.cargando ? (
                <p className="flex items-center gap-2 py-3 text-sm text-[var(--v-suave)]"><Loader2 className="size-4 animate-spin" /> Buscando horas libres…</p>
              ) : estado.error ? (
                <p className="flex items-start gap-2 rounded-2xl bg-rose-500/10 p-3 text-sm text-rose-600"><AlertCircle className="mt-0.5 size-4 shrink-0" />{estado.error}</p>
              ) : estado.cerrado ? (
                <p className="py-2 text-sm text-[var(--v-suave)]">Ese día el salón está cerrado. Elige otro.</p>
              ) : !estado.horas.length ? (
                <p className="py-2 text-sm text-[var(--v-suave)]">No quedan horas libres ese día{especialistaId ? ' con esa especialista' : ''}. Prueba otro día{especialistaId ? ' o «Quien esté libre»' : ''}.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {estado.horas.map((h) => (
                    <button
                      key={h} type="button" onClick={() => setHora(h)} aria-pressed={hora === h}
                      className={`rounded-xl py-2 text-sm font-medium tabular-nums transition ${hora === h ? 'bg-[var(--v-p)] text-[var(--v-sobre-p)]' : 'border border-[var(--v-borde)]'}`}
                    >
                      {horaBonita(h)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 5. Quién reserva */}
          <div className="mt-5 space-y-2">
            <p className={paso}>Tus datos</p>
            <input
              className={campo} placeholder="Tu nombre" autoComplete="name" maxLength={80}
              value={contacto.nombre} onChange={(e) => setContacto((c) => ({ ...c, nombre: e.target.value }))}
            />
            <input
              className={campo} placeholder="Tu WhatsApp, con código de área" autoComplete="tel" inputMode="tel" maxLength={24}
              value={contacto.telefono} onChange={(e) => setContacto((c) => ({ ...c, telefono: e.target.value }))}
            />
            <textarea
              className={`${campo} min-h-[72px] resize-none`} placeholder="¿Algo que debamos saber? (opcional)" maxLength={300}
              value={nota} onChange={(e) => setNota(e.target.value)}
            />
          </div>
        </>
      )}

      {/* El total y el botón */}
      {(!!elegidos.length || !!apartados.length) && (
        <div className="mt-5 border-t border-[var(--v-borde)] pt-4">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-[var(--v-suave)]">
              {resumen.minutos ? `${duracion(resumen.minutos)} · ` : ''}Total{resumen.aproximado ? ' estimado' : ''}
            </span>
            <span className="text-lg font-bold">{resumen.aproximado ? 'Desde ' : ''}{dinero.format(resumen.total)}</span>
          </div>
          {hora && (
            <p className="mt-1 text-right text-xs text-[var(--v-suave)]">
              <span className="inline-block first-letter:uppercase">{fmtFechaLarga.format(new Date(`${fecha}T12:00:00Z`))}</span> a las {horaBonita(hora)}
            </p>
          )}
          {error && <p role="alert" className="mt-3 flex items-start gap-2 rounded-2xl bg-rose-500/10 p-3 text-sm text-rose-600"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</p>}
          <button type="button" onClick={reservar} disabled={!listo || previa || enviando} className={`${BOTON_P} mt-3 w-full py-3.5 text-[15px]`}>
            {enviando ? <><Loader2 className="size-4 animate-spin" /> Reservando…</> : previa ? 'Así se ve el botón de reservar' : diseno.confirmaSola ? 'Reservar' : 'Pedir esta cita'}
          </button>
          {!listo && !previa && !!elegidos.length && (
            <p className="mt-2 text-center text-xs text-[var(--v-suave)]">
              {!hora ? 'Elige una hora' : contacto.nombre.trim().length < 2 ? 'Escribe tu nombre' : 'Escribe tu WhatsApp'} para terminar
            </p>
          )}
          {!diseno.confirmaSola && !previa && <p className="mt-2 text-center text-xs text-[var(--v-suave)]">El salón confirma tu cita por WhatsApp.</p>}
        </div>
      )}
    </div>
  );
}

/* ───────────── listo ───────────── */

function Exito({ hecha, salon, otra }: { hecha: ReservaHecha; salon: string; otra: () => void }) {
  return (
    <div className="mx-auto flex min-h-[80vh] max-w-md flex-col items-center justify-center px-4 py-10 text-center">
      <motion.span
        initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 14, stiffness: 260 }}
        className="grid size-20 place-items-center rounded-full bg-[var(--v-p)] text-[var(--v-sobre-p)]"
      >
        <Check className="size-10" strokeWidth={2.5} />
      </motion.span>
      <h1 className="mt-5 text-2xl font-bold tracking-tight">{hecha.confirmada ? '¡Tu cita quedó reservada!' : '¡Recibimos tu pedido!'}</h1>
      <p className="mt-1 text-[var(--v-suave)]">
        {hecha.confirmada ? `Te esperamos en ${salon}.` : `${salon} te confirma la cita por WhatsApp.`}
      </p>

      <div className={`${TARJETA} mt-6 w-full p-4 text-left`}>
        <p className="flex items-center gap-2 text-sm font-semibold first-letter:uppercase"><CalendarDays className="size-4 text-[var(--v-p)]" />{hecha.dia}</p>
        <ul className="mt-3 space-y-2">
          {hecha.citas.map((c, i) => (
            <li key={i} className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--v-tinte)] px-3 py-2.5 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">{c.servicio}</span>
                {c.especialista && <span className="text-xs text-[var(--v-suave)]">Con {c.especialista}</span>}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">{horaBonita(c.hora)}</span>
            </li>
          ))}
        </ul>
        {!!hecha.apartados.length && (
          <p className="mt-3 flex gap-2 text-sm"><ShoppingBag className="mt-0.5 size-4 shrink-0 text-[var(--v-p)]" />Te apartamos: {hecha.apartados.join(', ')}</p>
        )}
        <p className="mt-3 flex gap-2 text-sm text-[var(--v-suave)]"><MapPin className="mt-0.5 size-4 shrink-0" />{hecha.sede.nombre}{hecha.sede.direccion ? ` · ${hecha.sede.direccion}` : ''}</p>
      </div>

      <button type="button" onClick={otra} className="mt-6 text-sm font-semibold text-[var(--v-p)]">Hacer otra reserva</button>
    </div>
  );
}
