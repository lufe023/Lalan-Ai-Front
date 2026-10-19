import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle, CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Facebook, Images, Instagram, Loader2, MapPin, Minus,
  MessageCircle, Music, Navigation, Phone, Plus, ShoppingBag, Sparkles, Star, Store, Tag, User, Volume2, VolumeX, X,
} from 'lucide-react';
import { ErrorPublico, publicRequest, urlDeFoto } from '../../services/api';
import type {
  DatosVitrina, EspecialistaVitrina, EstadoDiaVitrina, OfertaVitrina, OtraSedeVitrina, ProductoVitrina, ReservaHecha, ServicioVitrina, TipoBloqueVitrina,
} from '../../types/vitrina';
import { estiloVitrina } from './temaVitrina';
import { IOSModal } from '../ui/IOSModal';
import MapaSede from './MapaSede';
import { FotoEncuadrada, estiloEncuadre, type Encuadre } from '../catalogo/FotoEncuadrada';

/**
 * La Vitrina tal como la ve una clienta: los bloques en el orden que eligió la
 * dueña, con su paleta, y "Tu reserva" siempre a la vista (al lado en
 * pantallas anchas, como barra abajo en el teléfono). Al seguir, en la
 * computadora la reserva ocupa toda la pantalla, como la bienvenida del
 * quiosco; en el teléfono sube como hoja.
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
/** Servicios o productos por página: más que eso y la página se hace muy larga */
const POR_PAGINA = 15;
const CLAVE_CONTACTO = 'lalan_vitrina_contacto';
/** Desde este ancho "Tu reserva" va al lado (el mismo corte que @4xl, 56rem) */
const ANCHO_CON_PANEL = 896;

/** Cómo se acomoda cada foto, por su dirección: lo lee `Foto` sin pasarlo de mano en mano */
const EncuadresVitrina = createContext<Record<string, Encuadre>>({});
/** Cuáles fotos son videos (dirección → segundos): la foto es su primer cuadro y el video va en «<dirección>/video» */
const VideosVitrina = createContext<Record<string, number>>({});

/** Las fotos de la portada (las Vitrinas viejas solo mandan `portada`) */
const fotosDePortada = (datos: DatosVitrina) => (datos.portadas?.length ? datos.portadas : datos.portada ? [datos.portada] : []);

/**
 * Los encuadres de la página. Lo viejo: antes la portada solo se movía de
 * arriba a abajo (`portadaY`); la primera foto lo sigue usando mientras la
 * dueña no la acomode de nuevo.
 */
function encuadresDe(datos: DatosVitrina): Record<string, Encuadre> {
  const todos = { ...(datos.encuadres ?? {}) };
  const primera = fotosDePortada(datos)[0];
  const y = datos.diseno.portadaY ?? 50;
  if (primera && !todos[primera] && y !== 50) todos[primera] = { x: 50, y, zoom: 100, completa: false };
  return todos;
}

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

/**
 * Como en un menú: primero lo que la dueña recomienda, después lo que puso
 * en orden y al final lo demás, como venía.
 */
export function ordenarParaVitrina<T extends { id: string }>(lista: T[], orden: string[] = [], destacados: string[] = []): T[] {
  if (!orden.length && !destacados.length) return lista;
  const lugar = new Map(orden.map((id, i) => [id, i]));
  const recomendado = new Set(destacados);
  const peso = (x: T, i: number) => (recomendado.has(x.id) ? 0 : 1) * 1e6 + (lugar.get(x.id) ?? orden.length + i);
  return lista.map((x, i) => ({ x, p: peso(x, i) })).sort((a, b) => a.p - b.p).map((y) => y.x);
}

/* ───────────── la página ───────────── */

export default function PaginaVitrina({ datos, slug, previa = false }: Props) {
  const { diseno, sede } = datos;
  const dinero = useMemo(() => formateador(sede.moneda), [sede.moneda]);
  const destacados = useMemo(() => new Set(diseno.destacados ?? []), [diseno.destacados]);
  const servicios = useMemo(() => ordenarParaVitrina(datos.servicios, diseno.orden?.servicios, diseno.destacados), [datos.servicios, diseno.orden, diseno.destacados]);
  const productos = useMemo(() => ordenarParaVitrina(datos.productos, diseno.orden?.productos, diseno.destacados), [datos.productos, diseno.orden, diseno.destacados]);

  const [servicioIds, setServicioIds] = useState<string[]>([]);
  const [productoIds, setProductoIds] = useState<string[]>([]);
  const [ofertaId, setOfertaId] = useState<string | null>(null);
  /** Con quién quiere cada servicio (sin entrada = quien esté libre) */
  const [conQuien, setConQuien] = useState<Record<string, string>>({});
  /** La especialista que está mirando: sus servicios y reservar con ella */
  const [persona, setPersona] = useState<EspecialistaVitrina | null>(null);
  // La reserva a pantalla completa. Desde el panel de al lado ya vio lo que eligió: empieza en lo que sigue
  const [abierta, setAbierta] = useState<false | 'lista' | 'siguiente'>(false);
  const [hecha, setHecha] = useState<ReservaHecha | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // `foto`: en cuál abre el carrusel (la carta del abanico que tocó)
  const [ficha, setFicha] = useState<({ tipo: 'servicio'; item: ServicioVitrina } | { tipo: 'producto'; item: ProductoVitrina }) & { foto?: number } | null>(null);

  // "Tu reserva" al lado si la página es ancha, en la barra de abajo y la hoja si no.
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
    setHecha(null); setServicioIds([]); setProductoIds([]); setOfertaId(null); setConQuien({}); setAbierta(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const bloques = diseno.bloques.filter((b) => b.visible);
  const conPortada = bloques.some((b) => b.tipo === 'portada');

  const pintar = (tipo: TipoBloqueVitrina) => {
    switch (tipo) {
      case 'portada': return <Portada key={tipo} datos={datos} />;
      case 'mensaje': return diseno.mensaje ? <Mensaje key={tipo} texto={diseno.mensaje} /> : null;
      case 'servicios': return <Servicios key={tipo} servicios={servicios} destacados={destacados} elegidos={servicioIds} alternar={alternarServicio} dinero={dinero} abrir={(item, foto) => setFicha({ tipo: 'servicio', item, foto })} />;
      case 'ofertas': return datos.ofertas.length ? <Ofertas key={tipo} ofertas={datos.ofertas} elegida={ofertaId} elegir={elegirOferta} dinero={dinero} /> : null;
      case 'productos': return productos.length ? <Productos key={tipo} productos={productos} destacados={destacados} elegidos={productoIds} alternar={alternarProducto} dinero={dinero} abrir={(item) => setFicha({ tipo: 'producto', item })} /> : null;
      case 'especialistas': return datos.especialistas.length ? <Especialistas key={tipo} lista={datos.especialistas} abrir={setPersona} /> : null;
      case 'horario': return <Horario key={tipo} semana={sede.semana} hoy={sede.hoyFecha} />;
      case 'ubicacion': return <Ubicacion key={tipo} datos={datos} />;
      case 'chat': return <Chat key={tipo} datos={datos} />;
      default: return null;
    }
  };

  const cuenta = useMemo(() => cuentaDeLaReserva(elegidos, apartados, oferta), [elegidos, apartados, oferta]);
  const cuantos = elegidos.length + apartados.length;
  const encuadres = useMemo(() => encuadresDe(datos), [datos]);
  const videos = useMemo(() => datos.videos ?? {}, [datos]);

  return (
    <EncuadresVitrina.Provider value={encuadres}>
    <VideosVitrina.Provider value={videos}>
    <div ref={raiz} style={estiloVitrina(diseno)} className={`@container ${previa ? 'min-h-full' : 'min-h-dvh'} bg-[var(--v-fondo)] text-[var(--v-texto)] antialiased`}>
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
              <div className={`sticky top-4 ${TARJETA} p-4 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.35)]`}>
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-lg font-bold">Tu reserva</h2>
                  <span className="inline-flex min-w-0 items-center gap-1 truncate text-xs text-[var(--v-suave)]"><MapPin className="size-3 shrink-0" />{sede.nombre}</span>
                </div>
                <div className="mt-3">
                  <ListaElegidos elegidos={elegidos} apartados={apartados} oferta={oferta} quitarServicio={alternarServicio} quitarProducto={alternarProducto} />
                </div>
                {!!cuantos && (
                  <div className="mt-4 border-t border-[var(--v-borde)] pt-4">
                    <Total cuenta={cuenta} dinero={dinero} />
                    <button type="button" onClick={() => setAbierta('siguiente')} disabled={!elegidos.length} className={`${BOTON_P} mt-3 w-full py-3.5 text-[15px]`}>
                      Reservar <ChevronRight className="size-4" />
                    </button>
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      )}

      {/* Teléfono: la barra de abajo siempre a la vista */}
      {!hecha && !ancha && (
        <div className="fixed inset-x-0 bottom-0 z-30">
          <div className="mx-3 mb-3 rounded-3xl border border-[var(--v-borde)] bg-[var(--v-sup)] p-3 shadow-[0_10px_40px_-10px_rgba(0,0,0,0.35)]">
            <button type="button" onClick={() => setAbierta('lista')} className="flex w-full items-center gap-3 text-left" aria-haspopup="dialog" aria-expanded={!!abierta}>
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
                {elegidos.length ? 'Continuar' : 'Ver'} <ChevronRight className="size-4" />
              </span>
            </button>
          </div>
        </div>
      )}

      {/* La reserva: a pantalla completa en pantallas anchas, en la hoja que sube en el teléfono.
          No se desmonta al cerrarla: lo elegido (día, hora, nombre) sigue ahí */}
      {!hecha && (() => {
        const panel = (
          <PanelReserva
            datos={datos} slug={slug} previa={previa} dinero={dinero} cuenta={cuenta} completa={ancha}
            abierta={abierta} cerrar={() => setAbierta(false)}
            elegidos={elegidos} apartados={apartados} oferta={oferta}
            quitarServicio={alternarServicio} quitarProducto={alternarProducto}
            conQuien={conQuien} setConQuien={setConQuien}
            alHacer={(r) => { setHecha(r); setAbierta(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
          />
        );
        return ancha ? panel : (
          <IOSModal
            isOpen={!!abierta} onClose={() => setAbierta(false)} title="Tu reserva" subtitle={sede.nombre}
            id="vitrina-tu-reserva" fijo mantenerMontado fixedHeight={false} height="90%"
            apariencia={{
              hoja: 'bg-[var(--v-fondo)] border-[var(--v-borde)] text-[var(--v-texto)]',
              titulo: 'text-[var(--v-texto)]', subtitulo: 'text-[var(--v-suave)]', borde: 'border-[var(--v-borde)]',
              cerrar: 'bg-[var(--v-tinte)] text-[var(--v-suave)]', asa: 'bg-[var(--v-borde)]',
            }}
          >
            {panel}
          </IOSModal>
        );
      })()}

      {/* La ficha de un servicio o producto: sus fotos grandes y el botón de agregar */}
      <IOSModal
        isOpen={!!ficha} onClose={() => setFicha(null)} title={ficha?.item.nombre ?? ''} id="vitrina-ficha"
        fijo fixedHeight={false} height="92%"
        apariencia={{
          hoja: 'bg-[var(--v-fondo)] border-[var(--v-borde)] text-[var(--v-texto)]',
          titulo: 'text-[var(--v-texto)]', subtitulo: 'text-[var(--v-suave)]', borde: 'border-[var(--v-borde)]',
          cerrar: 'bg-[var(--v-tinte)] text-[var(--v-suave)]', asa: 'bg-[var(--v-borde)]',
        }}
      >
        {ficha && (() => {
          const servicio = ficha.tipo === 'servicio' ? ficha.item : null;
          const dentro = servicio ? servicioIds.includes(ficha.item.id) : productoIds.includes(ficha.item.id);
          return (
            <div className="mx-auto max-w-md space-y-4">
              <div className="mx-auto aspect-[4/5] max-h-[55vh] w-full overflow-hidden rounded-3xl bg-[var(--v-tinte)]">
                <Carrusel key={`${ficha.item.id}-${ficha.foto ?? 0}`} fotos={fotosDe(ficha.item)} alt={ficha.item.nombre} inicio={ficha.foto} />
              </div>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                {servicio
                  ? <span><Precio s={servicio} dinero={dinero} /><span className="ml-2 text-xs text-[var(--v-suave)]">{duracion(servicio.duracionMin)}</span></span>
                  : <Precio s={ficha.item} dinero={dinero} />}
                {!servicio && (ficha.item as ProductoVitrina).quedanPocos && <span className="text-xs text-[var(--v-suave)]">Quedan pocos</span>}
              </div>
              {ficha.item.descripcion && <p className="whitespace-pre-line text-[15px] leading-relaxed text-[var(--v-suave)]">{ficha.item.descripcion}</p>}
              {!!ficha.item.variantes?.length && (
                <ul className="divide-y divide-[var(--v-borde)] rounded-2xl border border-[var(--v-borde)] text-sm">
                  {ficha.item.variantes.map((v) => (
                    <li key={v.nombre} className="flex items-baseline justify-between gap-3 px-4 py-2.5">
                      <span className="min-w-0">
                        <span className="block font-medium">{v.nombre}</span>
                        {v.detalle && <span className="block text-xs text-[var(--v-suave)]">{v.detalle}</span>}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{dinero.format(v.precio)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button" className={`${BOTON_P} w-full py-3.5 text-[15px]`}
                onClick={() => { if (servicio) alternarServicio(ficha.item.id); else alternarProducto(ficha.item.id); setFicha(null); }}
              >
                {dentro ? <><Minus className="size-4" /> Quitar de tu reserva</> : servicio ? <><Plus className="size-4" /> Agregar a tu reserva</> : <><ShoppingBag className="size-4" /> Apartar</>}
              </button>
            </div>
          );
        })()}
      </IOSModal>

      {/* La ficha de una especialista: cuándo atiende, lo que hace y reservar con ella */}
      <IOSModal
        isOpen={!!persona} onClose={() => setPersona(null)} title={persona?.nombre ?? ''} subtitle={persona?.especialidad || undefined} id="vitrina-especialista"
        fijo fixedHeight={false} height="92%"
        apariencia={{
          hoja: 'bg-[var(--v-fondo)] border-[var(--v-borde)] text-[var(--v-texto)]',
          titulo: 'text-[var(--v-texto)]', subtitulo: 'text-[var(--v-suave)]', borde: 'border-[var(--v-borde)]',
          cerrar: 'bg-[var(--v-tinte)] text-[var(--v-suave)]', asa: 'bg-[var(--v-borde)]',
        }}
      >
        {persona && (
          <FichaEspecialista
            persona={persona} servicios={servicios} elegidos={servicioIds} alternar={alternarServicio} dinero={dinero}
            conElla={!!diseno.elegirEspecialista}
            reservar={(ids) => {
              if (diseno.elegirEspecialista) setConQuien((m) => ({ ...m, ...Object.fromEntries(ids.map((id) => [id, persona.id])) }));
              setPersona(null);
              setAbierta('siguiente');
            }}
          />
        )}
      </IOSModal>

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
    </VideosVitrina.Provider>
    </EncuadresVitrina.Provider>
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

/** Qué tan alta es la portada: con el texto encima es lo mínimo, sola es justo eso */
const ALTO_PORTADA = {
  baja: { con: 'min-h-[180px] @2xl:min-h-[230px]', sola: 'h-[180px] @2xl:h-[230px]' },
  media: { con: 'min-h-[230px] @2xl:min-h-[300px]', sola: 'h-[230px] @2xl:h-[300px]' },
  alta: { con: 'min-h-[320px] @2xl:min-h-[440px]', sola: 'h-[320px] @2xl:h-[440px]' },
} as const;

/**
 * La portada: una foto o varias que se deslizan como en Instagram. El nombre,
 * el horario y la sede van encima de la foto (como siempre) o aparte, arriba o
 * abajo, para la dueña que quiere la foto limpia.
 */
function Portada({ datos }: { datos: DatosVitrina }) {
  const fotos = fotosDePortada(datos);
  const texto = datos.diseno.portadaTexto ?? 'sobre';
  const alto = ALTO_PORTADA[datos.diseno.portadaAlto ?? 'media'] ?? ALTO_PORTADA.media;
  const sobre = texto === 'sobre';
  const fondo = fotos.length ? (
    <Carrusel fotos={fotos} alt={datos.diseno.titulo || datos.sede.nombre} puntosArriba={sobre} />
  ) : (
    <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_10%_0%,var(--v-a),transparent_60%),radial-gradient(90%_90%_at_100%_100%,var(--v-t),transparent_55%)] opacity-80" />
  );

  if (sobre) {
    return (
      <section className="relative overflow-hidden rounded-[28px] bg-[var(--v-p)]">
        <div className="absolute inset-0">{fondo}</div>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent" />
        {/* Sin clics: el dedo pasa a la foto y la desliza */}
        <div className={`pointer-events-none relative flex ${alto.con} flex-col justify-end p-5 text-white @2xl:p-8`}>
          <TextoDePortada datos={datos} sobreLaFoto />
        </div>
      </section>
    );
  }
  const foto = <div className={`relative overflow-hidden rounded-[28px] bg-[var(--v-p)] ${alto.sola}`}>{fondo}</div>;
  const textos = <div className="px-1"><TextoDePortada datos={datos} /></div>;
  return <section className="space-y-4">{texto === 'arriba' ? <>{textos}{foto}</> : <>{foto}{textos}</>}</section>;
}

/** El nombre, el título y cómo está hoy: en blanco sobre la foto, o con los colores de la página */
function TextoDePortada({ datos, sobreLaFoto = false }: { datos: DatosVitrina; sobreLaFoto?: boolean }) {
  const abierto = !datos.sede.hoy.startsWith('Hoy está cerrado');
  const chip = `inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${sobreLaFoto ? 'bg-white/15 backdrop-blur' : 'bg-[var(--v-tinte)]'}`;
  return (
    <>
      <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${sobreLaFoto ? 'text-white/80' : 'text-[var(--v-suave)]'}`}>{datos.salon.nombre}</p>
      <h1 className="mt-1 text-3xl font-bold leading-tight tracking-tight @2xl:text-4xl">{datos.diseno.titulo || datos.sede.nombre}</h1>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span className={chip}>
          <span className={`size-2 rounded-full ${abierto ? 'bg-emerald-400' : 'bg-rose-400'}`} />
          {datos.sede.hoy}
        </span>
        {datos.diseno.titulo && (
          <span className={chip}>
            <MapPin className="size-3.5" /> {datos.sede.nombre}
          </span>
        )}
      </div>
    </>
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

/** El precio como lo deja ver la dueña: exacto, «desde» o «Precio en el salón» */
function Precio({ s, dinero }: { s: { precio: number | null; modoPrecio?: ServicioVitrina['modoPrecio'] }; dinero: Intl.NumberFormat }) {
  if (s.precio == null || s.modoPrecio === 'consultar') return <span className="text-[var(--v-suave)]">Precio en el salón</span>;
  return <span className="font-semibold">{s.modoPrecio === 'desde' ? 'Desde ' : ''}{dinero.format(s.precio)}</span>;
}

/** Todas las fotos de un servicio o producto (las Vitrinas viejas solo mandan `foto`) */
const fotosDe = (x: { foto: string | null; fotos?: string[] }) => (x.fotos?.length ? x.fotos : x.foto ? [x.foto] : []);

/**
 * Las fotos como en Instagram: se desliza con el dedo (scroll con imán, sin
 * librerías) y los puntos dicen en cuál va. Con mouse, además, flechas a los
 * lados y se puede agarrar la foto y arrastrarla. Con una sola foto, la foto.
 */
function Carrusel({ fotos, alt, inicio = 0, puntosArriba = false }: { fotos: string[]; alt: string; inicio?: number; puntosArriba?: boolean }) {
  const caja = useRef<HTMLDivElement>(null);
  const [actual, setActual] = useState(inicio);
  const conMouse = useConMouse();
  // El arrastre con mouse: dónde empezó y si ya se movió (para no tomarlo como clic)
  const arrastre = useRef<{ x: number; desde: number; movido: boolean } | null>(null);
  const [agarrando, setAgarrando] = useState(false);
  useLayoutEffect(() => {
    const el = caja.current;
    if (el && inicio) el.scrollLeft = inicio * el.clientWidth;
  }, [inicio]);
  if (fotos.length <= 1) return <Foto src={fotos[0] ?? null} alt={alt} reproducir />;
  const alDeslizar = () => {
    const el = caja.current;
    if (el) setActual(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)));
  };
  const ir = (i: number) => {
    const el = caja.current;
    if (!el) return;
    const n = Math.max(0, Math.min(fotos.length - 1, i));
    el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' });
  };
  const soltar = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = caja.current;
    const a = arrastre.current;
    if (!el || !a) return;
    arrastre.current = null;
    setAgarrando(false);
    el.releasePointerCapture?.(e.pointerId);
    // Como en Instagram: basta con arrastrar un poco para pasar a la otra
    const dx = e.clientX - a.x;
    const ancho = Math.max(el.clientWidth, 1);
    const base = Math.round(a.desde / ancho);
    const destino = Math.abs(dx) > ancho * 0.15 ? base + (dx < 0 ? 1 : -1) : base;
    ir(destino);
    // El imán vuelve cuando la foto ya llegó, si no la jala de regreso a medio camino
    window.setTimeout(() => { el.style.scrollSnapType = ''; }, 450);
  };
  const FLECHA = 'absolute top-1/2 z-10 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-full bg-white/85 text-neutral-800 shadow-md backdrop-blur transition hover:bg-white active:scale-95';
  return (
    <div className="relative size-full">
      <div
        ref={caja} onScroll={alDeslizar}
        onPointerDown={conMouse ? (e) => {
          if (e.pointerType !== 'mouse' || e.button !== 0) return;
          // La bocina del video es un botón: si se agarra la foto, el clic no le llega
          if ((e.target as HTMLElement).closest('button')) return;
          const el = caja.current;
          if (!el) return;
          arrastre.current = { x: e.clientX, desde: el.scrollLeft, movido: false };
          el.setPointerCapture?.(e.pointerId);
          el.style.scrollSnapType = 'none';
          setAgarrando(true);
        } : undefined}
        onPointerMove={conMouse ? (e) => {
          const el = caja.current;
          const a = arrastre.current;
          if (!el || !a) return;
          const dx = e.clientX - a.x;
          if (Math.abs(dx) > 3) a.movido = true;
          el.scrollLeft = a.desde - dx;
        } : undefined}
        onPointerUp={conMouse ? soltar : undefined}
        onPointerCancel={conMouse ? soltar : undefined}
        onDragStart={(e) => e.preventDefault()}
        className={`flex size-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain select-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${conMouse ? (agarrando ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
      >
        {fotos.map((f, i) => (
          <div key={f} className="size-full shrink-0 snap-center">
            <Foto src={f} alt={i === 0 ? alt : `${alt} (${i + 1})`} reproducir />
          </div>
        ))}
      </div>
      {conMouse && actual > 0 && (
        <button type="button" onClick={() => ir(actual - 1)} aria-label="Foto anterior" className={`${FLECHA} left-2`}>
          <ChevronLeft className="size-4" />
        </button>
      )}
      {conMouse && actual < fotos.length - 1 && (
        <button type="button" onClick={() => ir(actual + 1)} aria-label="Foto siguiente" className={`${FLECHA} right-2`}>
          <ChevronRight className="size-4" />
        </button>
      )}
      <div className={`pointer-events-none absolute inset-x-0 flex justify-center gap-1 ${puntosArriba ? 'top-3' : 'bottom-2'}`} aria-hidden>
        {fotos.map((f, i) => (
          <span key={f} className={`h-1.5 rounded-full bg-white shadow transition-all duration-300 ${i === actual ? 'w-4 opacity-100' : 'w-1.5 opacity-60'}`} />
        ))}
      </div>
    </div>
  );
}

/** ¿Hay un mouse de verdad? (no un dedo): para lo que pasa al pasar por encima */
function useConMouse() {
  const [si, setSi] = useState(false);
  useEffect(() => {
    const m = window.matchMedia?.('(hover: hover) and (pointer: fine)');
    if (!m) return;
    setSi(m.matches);
    const cambio = () => setSi(m.matches);
    m.addEventListener?.('change', cambio);
    return () => m.removeEventListener?.('change', cambio);
  }, []);
  return si;
}

/**
 * Una fila que se desliza de lado (días, categorías, ofertas, equipo). Con el
 * dedo ya se desliza; con mouse no, salvo con la rueda del medio: aquí se
 * agarra y se arrastra. Un arrastre no cuenta como clic en lo que soltó.
 */
function FilaArrastrable({ className = '', children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const conMouse = useConMouse();
  const arrastre = useRef<{ x: number; desde: number; id: number; movido: boolean } | null>(null);
  const acabaDeArrastrar = useRef(false);
  const [agarrando, setAgarrando] = useState(false);
  const soltar = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    const a = arrastre.current;
    arrastre.current = null;
    if (!el || !a?.movido) return;
    acabaDeArrastrar.current = true;
    setAgarrando(false);
    el.releasePointerCapture?.(e.pointerId);
    // El imán (si lo tiene) vuelve cuando terminó de moverse
    window.setTimeout(() => { el.style.scrollSnapType = ''; }, 300);
  };
  if (!conMouse) return <div ref={ref} className={className}>{children}</div>;
  return (
    <div
      ref={ref}
      onPointerDown={(e) => {
        acabaDeArrastrar.current = false;
        if (e.pointerType !== 'mouse' || e.button !== 0 || !ref.current) return;
        arrastre.current = { x: e.clientX, desde: ref.current.scrollLeft, id: e.pointerId, movido: false };
      }}
      onPointerMove={(e) => {
        const el = ref.current;
        const a = arrastre.current;
        if (!el || !a) return;
        const dx = e.clientX - a.x;
        // Unos píxeles de margen: si no, un clic con la mano temblorosa no llega al botón
        if (!a.movido && Math.abs(dx) > 5) {
          a.movido = true;
          el.setPointerCapture?.(a.id);
          el.style.scrollSnapType = 'none';
          setAgarrando(true);
        }
        if (a.movido) el.scrollLeft = a.desde - dx;
      }}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      onClickCapture={(e) => {
        if (!acabaDeArrastrar.current) return;
        acabaDeArrastrar.current = false;
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragStart={(e) => e.preventDefault()}
      className={`${className} ${agarrando ? 'cursor-grabbing select-none' : 'cursor-grab'}`}
    >
      {children}
    </div>
  );
}

/** Cuántas fotos se abren en abanico; si hay más, una tarjeta gris detrás dice cuántas */
const FOTOS_EN_ABANICO = 4;

/**
 * Al pasar el mouse por un servicio con varias fotos, salen de la miniatura
 * como un abanico de cartas, una tras otra. Cada carta abre la ficha en esa
 * foto; la tarjeta gris de «más», en la que sigue.
 */
function Abanico({ fotos, abierto, alt, abrir }: { fotos: string[]; abierto: boolean; alt: string; abrir: (foto: number) => void }) {
  if (fotos.length <= 1) return null;
  const vistas = fotos.slice(0, FOTOS_EN_ABANICO);
  const mas = fotos.length - vistas.length;
  const cartas = [...vistas.map((f) => ({ f, mas: 0 })), ...(mas > 0 ? [{ f: null as string | null, mas }] : [])];
  const centro = (cartas.length - 1) / 2;
  return (
    <div className="pointer-events-none absolute left-0 top-0 z-20 h-full w-28 @md:w-32" aria-hidden>
      <AnimatePresence>
        {abierto && cartas.map((c, i) => {
          const d = i - centro;
          return (
            <motion.button
              type="button" key={c.f ?? 'mas'} tabIndex={-1} onClick={() => abrir(Math.min(i, fotos.length - 1))}
              initial={{ opacity: 0, x: 0, y: 0, rotate: 0, scale: 0.6 }}
              animate={{ opacity: 1, x: 36 + d * 52, y: -64 - Math.abs(d) * 10, rotate: d * 11, scale: 1 }}
              exit={{ opacity: 0, x: 0, y: 0, rotate: 0, scale: 0.6, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 320, damping: 24, delay: i * 0.04 }}
              style={{ zIndex: c.f ? 30 - Math.round(Math.abs(d) * 2) : 1, transformOrigin: '50% 100%' }}
              className="pointer-events-auto absolute left-1/2 top-1/2 -ml-11 -mt-14 h-28 w-22 cursor-pointer overflow-hidden rounded-2xl border-2 border-white bg-[var(--v-sup)] shadow-[0_14px_30px_-12px_rgba(0,0,0,0.55)]"
            >
              {c.f ? (
                <Foto src={c.f} alt={i === 0 ? alt : ''} activo />
              ) : (
                <div className="grid size-full place-items-center bg-neutral-400/90 text-center text-white">
                  <span><span className="block text-lg font-bold leading-none">+{c.mas}</span><span className="text-[11px] font-semibold">más</span></span>
                </div>
              )}
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/** Cuántas fotos tiene, sobre la miniatura: invita a abrirla */
function MasFotos({ cuantas }: { cuantas: number }) {
  if (cuantas <= 1) return null;
  return (
    <span className="pointer-events-none absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
      <Images className="size-3" /> {cuantas}
    </span>
  );
}

/**
 * Una foto del catálogo. Si es un video: en una miniatura, una vista previa
 * sin sonido (`activo`: con mouse, mientras está encima; sin `activo`, en el
 * teléfono, mientras se ve); con `reproducir` (el carrusel), el video con su
 * bocina.
 */
function Foto({ src, alt, reproducir = false, activo }: { src: string | null; alt: string; reproducir?: boolean; activo?: boolean }) {
  const url = urlDeFoto(src);
  const encuadre = useContext(EncuadresVitrina)[src ?? ''];
  const esVideo = useContext(VideosVitrina)[src ?? ''] != null;
  if (url && esVideo && reproducir) return <VideoVitrina cuadro={url} video={`${url}/video`} alt={alt} encuadre={encuadre} />;
  if (url && esVideo) return <VideoPrevia cuadro={url} video={`${url}/video`} alt={alt} encuadre={encuadre} activo={activo} />;
  return url ? (
    <span className="relative block size-full"><FotoEncuadrada src={url} alt={alt} encuadre={encuadre} video={esVideo ? `${url}/video` : null} /></span>
  ) : (
    <div className="grid size-full place-items-center bg-[var(--v-tinte)] text-[var(--v-p)]"><Sparkles className="size-7 opacity-70" /></div>
  );
}

/**
 * Un video del carrusel, como en Instagram: se reproduce sin sonido y en
 * bucle mientras está a la vista (si no, se pausa y no gasta datos). El botón
 * de la bocina le pone sonido. Tocarlo lo pausa o lo sigue.
 */
function VideoVitrina({ cuadro, video, alt, encuadre }: { cuadro: string; video: string; alt: string; encuadre?: Encuadre }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [conSonido, setConSonido] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const vigia = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && e.intersectionRatio >= 0.6) void el.play().catch(() => undefined);
      else el.pause();
    }, { threshold: [0, 0.6] });
    vigia.observe(el);
    return () => vigia.disconnect();
  }, []);
  return (
    <span className="relative block size-full overflow-hidden">
      <video
        ref={ref} src={video} poster={cuadro} aria-label={alt} muted={!conSonido} loop playsInline preload="none"
        onClick={(e) => { const el = e.currentTarget; if (el.paused) void el.play().catch(() => undefined); else el.pause(); }}
        className="absolute inset-0 size-full" style={estiloEncuadre(encuadre)}
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          const el = ref.current;
          const sonar = !conSonido;
          // Directo en el video y en el mismo clic: así el navegador deja que suene
          if (el) { el.muted = !sonar; if (sonar && el.paused) void el.play().catch(() => undefined); }
          setConSonido(sonar);
        }}
        aria-label={conSonido ? 'Quitar el sonido' : 'Poner sonido'}
        className="absolute bottom-2 left-2 z-10 grid size-8 cursor-pointer place-items-center rounded-full bg-black/55 text-white backdrop-blur transition active:scale-95"
      >
        {conSonido ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
      </button>
    </span>
  );
}

/**
 * La vista previa de un video en una miniatura: su primer cuadro y, al pasar
 * el mouse (`activo`), el video sin sonido y en bucle; al salir vuelve al
 * principio. Sin `activo` (en el teléfono no hay mouse) corre sin sonido
 * mientras se ve. Sin ▶ encima: el movimiento ya dice que es un video. El
 * video no se baja hasta que hace falta.
 */
function VideoPrevia({ cuadro, video, alt, encuadre, activo }: { cuadro: string; video: string; alt: string; encuadre?: Encuadre; activo?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [aLaVista, setALaVista] = useState(false);
  const porMouse = activo !== undefined;
  useEffect(() => {
    const el = ref.current;
    if (porMouse || !el || typeof IntersectionObserver === 'undefined') return;
    const vigia = new IntersectionObserver(([e]) => setALaVista(e.isIntersecting && e.intersectionRatio >= 0.6), { threshold: [0, 0.6] });
    vigia.observe(el);
    return () => vigia.disconnect();
  }, [porMouse]);
  const correr = porMouse ? !!activo : aLaVista;
  const [usado, setUsado] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (correr) {
      setUsado(true);
      el.muted = true;
      void el.play().catch(() => undefined);
    } else if (!el.paused) {
      el.pause();
      if (porMouse) el.currentTime = 0;
    }
  }, [correr, porMouse, usado]);
  return (
    <span className="relative block size-full overflow-hidden">
      <video
        ref={ref} src={usado || correr ? video : undefined} poster={cuadro} aria-label={alt} muted loop playsInline preload="none"
        className="pointer-events-none absolute inset-0 size-full" style={estiloEncuadre(encuadre)}
      />
    </span>
  );
}

/**
 * De 15 en 15. Al cambiar de página, la lista vuelve a quedar a la vista
 * (si no, en el teléfono se queda abajo, en los botones).
 */
function usePaginas<T>(lista: T[], seccion: React.RefObject<HTMLElement | null>) {
  const [pagina, setPagina] = useState(0);
  const total = Math.max(1, Math.ceil(lista.length / POR_PAGINA));
  const actual = Math.min(pagina, total - 1);
  const ir = (n: number) => {
    setPagina(n);
    const el = seccion.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  };
  return { visibles: lista.slice(actual * POR_PAGINA, (actual + 1) * POR_PAGINA), pagina: actual, total, ir, reiniciar: () => setPagina(0), cuantos: lista.length };
}

function Paginas({ pagina, total, ir, cuantos, que }: { pagina: number; total: number; ir: (n: number) => void; cuantos: number; que: string }) {
  if (total <= 1) return null;
  const desde = pagina * POR_PAGINA + 1;
  const hasta = Math.min(cuantos, (pagina + 1) * POR_PAGINA);
  const BOTON = 'grid size-10 place-items-center rounded-full text-sm font-semibold transition active:scale-95 disabled:opacity-35';
  return (
    <nav aria-label={`Páginas de ${que}`} className="mt-4 flex flex-col items-center gap-2">
      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => ir(pagina - 1)} disabled={pagina === 0} aria-label="Página anterior" className={`${BOTON} border border-[var(--v-borde)] bg-[var(--v-sup)]`}>
          <ChevronLeft className="size-4" />
        </button>
        {total <= 7 ? Array.from({ length: total }, (_, i) => (
          <button key={i} type="button" onClick={() => ir(i)} aria-label={`Página ${i + 1}`} aria-current={i === pagina ? 'page' : undefined}
            className={`${BOTON} ${i === pagina ? 'bg-[var(--v-texto)] text-[var(--v-fondo)]' : 'border border-[var(--v-borde)] bg-[var(--v-sup)]'}`}>
            {i + 1}
          </button>
        )) : (
          <span className="px-3 text-sm font-medium">Página {pagina + 1} de {total}</span>
        )}
        <button type="button" onClick={() => ir(pagina + 1)} disabled={pagina === total - 1} aria-label="Página siguiente" className={`${BOTON} border border-[var(--v-borde)] bg-[var(--v-sup)]`}>
          <ChevronRight className="size-4" />
        </button>
      </div>
      <span className="text-xs text-[var(--v-suave)]">{desde}–{hasta} de {cuantos} {que}</span>
    </nav>
  );
}

/** La etiqueta de lo que recomienda la dueña */
function Recomendado() {
  return (
    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-[var(--v-p)] px-2 py-0.5 text-[11px] font-semibold text-[var(--v-sobre-p)] shadow">
      <Sparkles className="size-3" /> Recomendado
    </span>
  );
}

function Servicios({ servicios, destacados, elegidos, alternar, dinero, abrir }: {
  servicios: ServicioVitrina[]; destacados: Set<string>; elegidos: string[]; alternar: (id: string) => void; dinero: Intl.NumberFormat;
  abrir: (s: ServicioVitrina, foto?: number) => void;
}) {
  const categorias = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of servicios) if (!m.has(s.categoria)) m.set(s.categoria, s.categoriaNombre || s.categoria);
    return [...m.entries()];
  }, [servicios]);
  const [cat, setCat] = useState<string | null>(null);
  const lista = cat ? servicios.filter((s) => s.categoria === cat) : servicios;
  const seccion = useRef<HTMLElement>(null);
  const paginas = usePaginas(lista, seccion);
  // El abanico de fotos solo con mouse: en el teléfono se desliza en la ficha
  const conMouse = useConMouse();
  const [encima, setEncima] = useState<string | null>(null);

  return (
    <section ref={seccion} aria-labelledby="v-servicios" className="scroll-mt-20">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 id="v-servicios" className={TITULO_BLOQUE}>Servicios</h2>
        <span className="text-xs text-[var(--v-suave)]">Toca para agregar a tu reserva</span>
      </div>
      {categorias.length > 1 && (
        <FilaArrastrable className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {[[null, 'Todo'] as const, ...categorias].map(([id, nombre]) => (
            <button
              key={id ?? 'todo'} type="button" onClick={() => { setCat(id); paginas.reiniciar(); }} aria-pressed={cat === id}
              className={`shrink-0 cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition ${cat === id ? 'bg-[var(--v-texto)] text-[var(--v-fondo)]' : 'border border-[var(--v-borde)] bg-[var(--v-sup)]'}`}
            >
              {nombre}
            </button>
          ))}
        </FilaArrastrable>
      )}
      {!servicios.length ? (
        <p className={`${TARJETA} p-5 text-sm text-[var(--v-suave)]`}>Pronto verás aquí los servicios de esta sede.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2">
          {paginas.visibles.map((s) => {
            const dentro = elegidos.includes(s.id);
            const fotos = fotosDe(s);
            return (
              <div key={s.id} className="relative" onMouseEnter={() => setEncima(s.id)} onMouseLeave={() => setEncima((x) => (x === s.id ? null : x))}>
              {conMouse && <Abanico fotos={fotos} abierto={encima === s.id} alt={s.nombre} abrir={(foto) => abrir(s, foto)} />}
              <article className={`${TARJETA} flex overflow-hidden transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-18px_rgba(0,0,0,0.45)] ${dentro ? 'ring-2 ring-[var(--v-p)]' : ''}`}>
                <button type="button" onClick={() => abrir(s)} aria-label={`Ver ${s.nombre}`} className="group relative w-28 cursor-pointer shrink-0 overflow-hidden @md:w-32">
                  <span className="block size-full transition duration-500 group-hover:scale-105"><Foto src={s.foto} alt={s.nombre} activo={conMouse ? encima === s.id : undefined} /></span>
                  <MasFotos cuantas={fotos.length} />
                  {destacados.has(s.id) ? <Recomendado /> : s.popular && (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
                      <Star className="size-3 fill-current" /> Favorito
                    </span>
                  )}
                </button>
                <div className="flex min-w-0 flex-1 flex-col p-3.5">
                  <h3 className="font-semibold leading-snug"><button type="button" onClick={() => abrir(s)} className="cursor-pointer text-left hover:underline">{s.nombre}</button></h3>
                  {s.descripcion && <p className="mt-0.5 line-clamp-2 text-xs text-[var(--v-suave)]">{s.descripcion}</p>}
                  <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-sm">
                    <div className="min-w-0">
                      <Precio s={s} dinero={dinero} />
                      <span className="ml-2 inline-flex items-center gap-1 text-xs text-[var(--v-suave)]"><Clock className="size-3" />{duracion(s.duracionMin)}</span>
                    </div>
                    <button
                      type="button" onClick={() => alternar(s.id)} aria-pressed={dentro}
                      aria-label={dentro ? `Quitar ${s.nombre}` : `Agregar ${s.nombre}`}
                      className={`grid size-9 shrink-0 cursor-pointer place-items-center rounded-full transition active:scale-95 ${dentro ? 'bg-[var(--v-p)] text-[var(--v-sobre-p)]' : 'bg-[var(--v-tinte)] text-[var(--v-p)]'}`}
                    >
                      {dentro ? <Check className="size-4" /> : <Plus className="size-4" />}
                    </button>
                  </div>
                </div>
              </article>
              </div>
            );
          })}
        </div>
      )}
      <Paginas {...paginas} que="servicios" />
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
      <FilaArrastrable className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
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
      </FilaArrastrable>
    </section>
  );
}

function Productos({ productos, destacados, elegidos, alternar, dinero, abrir }: {
  productos: ProductoVitrina[]; destacados: Set<string>; elegidos: string[]; alternar: (id: string) => void; dinero: Intl.NumberFormat;
  abrir: (p: ProductoVitrina) => void;
}) {
  const seccion = useRef<HTMLElement>(null);
  const paginas = usePaginas(productos, seccion);
  return (
    <section ref={seccion} aria-labelledby="v-productos" className="scroll-mt-20">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 id="v-productos" className={TITULO_BLOQUE}>Productos</h2>
        <span className="text-xs text-[var(--v-suave)]">Apártalos y los pagas en el salón</span>
      </div>
      <div className="grid grid-cols-2 gap-3 @2xl:grid-cols-3 @6xl:grid-cols-4">
        {paginas.visibles.map((p) => {
          const dentro = elegidos.includes(p.id);
          return (
            <article key={p.id} className={`${TARJETA} overflow-hidden transition ${dentro ? 'ring-2 ring-[var(--v-p)]' : ''}`}>
              <div className="relative aspect-square">
                <Carrusel fotos={fotosDe(p)} alt={p.nombre} />
                {destacados.has(p.id) ? <Recomendado /> : p.quedanPocos && <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">Quedan pocos</span>}
              </div>
              <div className="p-3">
                <h3 className="line-clamp-2 text-sm font-semibold leading-snug"><button type="button" onClick={() => abrir(p)} className="cursor-pointer text-left hover:underline">{p.nombre}</button></h3>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm"><Precio s={p} dinero={dinero} /></span>
                  <button
                    type="button" onClick={() => alternar(p.id)} aria-pressed={dentro}
                    aria-label={dentro ? `No apartar ${p.nombre}` : `Apartar ${p.nombre}`}
                    className={`grid size-8 cursor-pointer place-items-center rounded-full transition active:scale-95 ${dentro ? 'bg-[var(--v-p)] text-[var(--v-sobre-p)]' : 'bg-[var(--v-tinte)] text-[var(--v-p)]'}`}
                  >
                    {dentro ? <Check className="size-4" /> : <ShoppingBag className="size-4" />}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <Paginas {...paginas} que="productos" />
    </section>
  );
}

/** Su foto redonda o, sin foto, sus iniciales */
function Avatar({ e, tam = 'size-14' }: { e: EspecialistaVitrina; tam?: string }) {
  return e.foto ? (
    <span className={`mx-auto block ${tam} overflow-hidden rounded-full bg-[var(--v-tinte)]`}><Foto src={e.foto} alt={e.nombre} /></span>
  ) : (
    <span className={`mx-auto grid ${tam} place-items-center rounded-full bg-[var(--v-tinte)] text-lg font-bold text-[var(--v-p)]`}>{iniciales(e.nombre)}</span>
  );
}

function Especialistas({ lista, abrir }: { lista: EspecialistaVitrina[]; abrir: (e: EspecialistaVitrina) => void }) {
  return (
    <section aria-labelledby="v-equipo">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 id="v-equipo" className={TITULO_BLOQUE}>Quién te atiende</h2>
        <span className="text-xs text-[var(--v-suave)]">Toca para ver lo que hace</span>
      </div>
      <FilaArrastrable className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {lista.map((e) => (
          <button
            key={e.id} type="button" onClick={() => abrir(e)} aria-label={`Ver a ${e.nombre}`}
            className={`${TARJETA} w-36 shrink-0 cursor-pointer p-4 text-center transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_30px_-18px_rgba(0,0,0,0.45)] active:scale-[0.98]`}
          >
            <Avatar e={e} />
            <p className="mt-2 truncate text-sm font-semibold">{e.nombre}</p>
            {e.especialidad && <p className="truncate text-xs text-[var(--v-suave)]">{e.especialidad}</p>}
          </button>
        ))}
      </FilaArrastrable>
    </section>
  );
}

/**
 * Lo que la clienta ve de una especialista: cuándo atiende, los servicios
 * que hace (se agregan desde aquí) y «Reservar con ella», que deja esos
 * servicios con ella y sigue al día y la hora. Si la dueña no deja elegir
 * especialista, se reserva igual pero con quien esté libre.
 */
function FichaEspecialista({ persona, servicios, elegidos, alternar, dinero, conElla, reservar }: {
  persona: EspecialistaVitrina; servicios: ServicioVitrina[]; elegidos: string[]; alternar: (id: string) => void; dinero: Intl.NumberFormat;
  conElla: boolean; reservar: (servicioIds: string[]) => void;
}) {
  const suyos = servicios.filter((s) => !persona.categorias || persona.categorias.includes(s.categoria));
  const marcados = suyos.filter((s) => elegidos.includes(s.id)).map((s) => s.id);
  // Empieza el lunes, como el horario de la sede; solo los días que viene
  const dias = [1, 2, 3, 4, 5, 6, 0].map((d) => persona.semana?.find((x) => x.dia === d)).filter((d): d is NonNullable<typeof d> => !!d?.abierto);
  return (
    <div className="mx-auto max-w-md space-y-5">
      <div className="flex flex-col items-center text-center">
        <Avatar e={persona} tam="size-24" />
        <p className="mt-3 text-lg font-bold">{persona.nombre}</p>
        {persona.especialidad && <p className="text-sm text-[var(--v-suave)]">{persona.especialidad}</p>}
      </div>

      {persona.semana && (
        <div className={`${TARJETA} p-4`}>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><CalendarDays className="size-4 text-[var(--v-p)]" />Cuándo atiende</h3>
          {dias.length ? (
            <ul className="divide-y divide-[var(--v-borde)] text-sm">
              {dias.map((d) => (
                <li key={d.dia} className="flex justify-between gap-4 py-1.5">
                  <span>{NOMBRE_DIA[d.dia]}</span>
                  <span className="text-right">{d.tramos.map((t) => `${horaBonita(t.desde)} – ${horaBonita(t.hasta)}`).join(', ')}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--v-suave)]">Ahora mismo no tiene días en el horario.</p>
          )}
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold">Lo que hace</h3>
        {suyos.length ? (
          <ul className="space-y-2">
            {suyos.map((s) => {
              const dentro = elegidos.includes(s.id);
              return (
                <li key={s.id} className={`${TARJETA} flex items-center gap-3 overflow-hidden p-2 pr-3 ${dentro ? 'ring-2 ring-[var(--v-p)]' : ''}`}>
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-2xl"><Foto src={s.foto} alt={s.nombre} activo={false} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{s.nombre}</span>
                    <span className="block truncate text-xs text-[var(--v-suave)]"><Precio s={s} dinero={dinero} /> · {duracion(s.duracionMin)}</span>
                  </span>
                  <button
                    type="button" onClick={() => alternar(s.id)} aria-pressed={dentro}
                    aria-label={dentro ? `Quitar ${s.nombre}` : `Agregar ${s.nombre}`}
                    className={`grid size-9 shrink-0 cursor-pointer place-items-center rounded-full transition active:scale-95 ${dentro ? 'bg-[var(--v-p)] text-[var(--v-sobre-p)]' : 'bg-[var(--v-tinte)] text-[var(--v-p)]'}`}
                  >
                    {dentro ? <Check className="size-4" /> : <Plus className="size-4" />}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-[var(--v-suave)]">Pronto verás aquí sus servicios.</p>
        )}
      </div>

      {!!suyos.length && (
        <div className="sticky bottom-0 -mx-1 bg-[var(--v-fondo)] px-1 pb-1 pt-2">
          <button type="button" onClick={() => reservar(marcados)} disabled={!marcados.length} className={`${BOTON_P} w-full py-3.5 text-[15px]`}>
            <CalendarDays className="size-4" />
            {conElla ? `Reservar con ${persona.nombre}` : 'Reservar'}
            {marcados.length > 0 && ` (${marcados.length})`}
          </button>
          {!marcados.length && <p className="mt-2 text-center text-xs text-[var(--v-suave)]">Agrega al menos un servicio para reservar</p>}
        </div>
      )}
    </div>
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

/** Cómo llegar: con el pin si la dueña lo marcó; si no, buscando la dirección */
function enlacesDeLlegada(salon: string, x: { direccion: string | null; latitud?: number | null; longitud?: number | null }) {
  const conPin = x.latitud != null && x.longitud != null;
  if (!conPin && !x.direccion) return null;
  const q = conPin ? `${x.latitud},${x.longitud}` : `${salon} ${x.direccion}`;
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`,
    waze: conPin ? `https://waze.com/ul?ll=${x.latitud},${x.longitud}&navigate=yes` : `https://waze.com/ul?q=${encodeURIComponent(x.direccion!)}&navigate=yes`,
  };
}

/** La Vitrina de otra sede: por su dirección corta o, si el salón no eligió nombre, la larga */
const enlaceDeSede = (o: OtraSedeVitrina) => (o.direccionCorta ? `/${o.direccionCorta}` : `/app/#/v/${o.slug}`);

function Ubicacion({ datos }: { datos: DatosVitrina }) {
  const { direccion, telefono, instagram, facebook, latitud, longitud, nombre, hoy } = datos.sede;
  const otras = datos.otrasSedes ?? [];
  if (!direccion && !telefono && !instagram && !facebook && latitud == null && !otras.length) return null;
  const llegar = enlacesDeLlegada(datos.salon.nombre, datos.sede);
  const ig = instagram ? `https://instagram.com/${instagram.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '')}` : null;
  const fb = facebook ? (/^https?:/.test(facebook) ? facebook : `https://facebook.com/${facebook}`) : null;
  const fila = 'flex items-center gap-3 rounded-2xl px-3 py-2.5 transition hover:bg-[var(--v-tinte)]';
  const BOTON = 'inline-flex items-center gap-1.5 rounded-full border border-[var(--v-borde)] px-3.5 py-2 text-xs font-semibold transition hover:bg-[var(--v-tinte)]';
  return (
    <section aria-labelledby="v-ubicacion" className={`${TARJETA} p-5`}>
      <h2 id="v-ubicacion" className={`${TITULO_BLOQUE} mb-3`}>{otras.length ? 'Nuestras sedes' : 'Cómo llegar'}</h2>
      {latitud != null && longitud != null && (
        <div className="mb-3"><MapaSede punto={{ latitud, longitud }} color="var(--v-p)" etiqueta={`Mapa de ${nombre}`} /></div>
      )}
      {otras.length > 0 && <p className="font-semibold">{nombre}</p>}
      {direccion && <p className="mt-0.5 flex items-start gap-2 text-sm"><MapPin className="mt-0.5 size-4 shrink-0 text-[var(--v-p)]" />{direccion}</p>}
      <p className="mt-1 flex items-center gap-2 text-sm text-[var(--v-suave)]"><Clock className="size-4 shrink-0" />{hoy}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {llegar && <a href={llegar.google} target="_blank" rel="noreferrer" className={BOTON}><MapPin className="size-3.5" /> Google Maps</a>}
        {llegar && <a href={llegar.waze} target="_blank" rel="noreferrer" className={BOTON}><Navigation className="size-3.5" /> Waze</a>}
        {telefono && <a href={`tel:${telefono.replace(/[^\d+]/g, '')}`} className={BOTON}><Phone className="size-3.5" /> Llamar</a>}
      </div>
      {(ig || fb) && (
        <div className="-mx-3 mt-2 text-sm">
          {ig && <a href={ig} target="_blank" rel="noreferrer" className={fila}><Instagram className="size-4 shrink-0 text-[var(--v-p)]" /><span>@{instagram!.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '')}</span></a>}
          {fb && <a href={fb} target="_blank" rel="noreferrer" className={fila}><Facebook className="size-4 shrink-0 text-[var(--v-p)]" /><span>Facebook</span></a>}
        </div>
      )}
      {otras.length > 0 && (
        <ul className="mt-4 space-y-3 border-t border-[var(--v-borde)] pt-4">
          {otras.map((o) => {
            const ir = enlacesDeLlegada(datos.salon.nombre, o);
            return (
              <li key={o.slug} className="rounded-2xl border border-[var(--v-borde)] p-3.5">
                <p className="flex items-center gap-2 font-semibold"><Store className="size-4 text-[var(--v-p)]" />{o.nombre}</p>
                {o.direccion && <p className="mt-0.5 pl-6 text-sm text-[var(--v-suave)]">{o.direccion}</p>}
                <div className="mt-2.5 flex flex-wrap gap-2 pl-6">
                  <a href={enlaceDeSede(o)} className={`${BOTON} border-transparent bg-[var(--v-p)] text-[var(--v-sobre-p)] hover:bg-[var(--v-p)]`}><CalendarDays className="size-3.5" /> Reservar aquí</a>
                  {ir && <a href={ir.google} target="_blank" rel="noreferrer" className={BOTON}><MapPin className="size-3.5" /> Maps</a>}
                  {ir && <a href={ir.waze} target="_blank" rel="noreferrer" className={BOTON}><Navigation className="size-3.5" /> Waze</a>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/**
 * Escribirle a Lalán, la asistente del salón, por las cuentas que la sede
 * tiene conectadas. El WhatsApp lleva escrito de dónde viene, así Lalán ya
 * sabe la sede aunque el número sea el mismo para todas.
 */
function Chat({ datos }: { datos: DatosVitrina }) {
  const c = datos.chat;
  if (!c || (!c.whatsapp && !c.instagram && !c.messenger)) return null;
  const saludo = `Hola, vengo de la Vitrina de ${datos.salon.nombre} (${datos.sede.nombre})`;
  const canales = [
    c.whatsapp && { nombre: 'WhatsApp', href: `https://wa.me/${c.whatsapp}?text=${encodeURIComponent(saludo)}`, icono: <MessageCircle className="size-5" />, color: '#25D366' },
    c.instagram && { nombre: 'Instagram', href: `https://ig.me/m/${c.instagram}`, icono: <Instagram className="size-5" />, color: '#E1306C' },
    c.messenger && { nombre: 'Messenger', href: `https://m.me/${c.messenger}`, icono: <Facebook className="size-5" />, color: '#0084FF' },
  ].filter(Boolean) as { nombre: string; href: string; icono: React.ReactNode; color: string }[];
  return (
    <section aria-labelledby="v-chat" className={`${TARJETA} p-5`}>
      <h2 id="v-chat" className={TITULO_BLOQUE}>Escríbenos</h2>
      <p className="mt-1 text-sm text-[var(--v-suave)]">Lalán, la asistente del salón, te contesta por aquí: pregunta, reserva o cambia tu cita.</p>
      <div className="mt-3 grid grid-cols-1 gap-2 @md:grid-cols-3">
        {canales.map((x) => (
          <a key={x.nombre} href={x.href} target="_blank" rel="noreferrer"
            className="flex items-center gap-3 rounded-2xl border border-[var(--v-borde)] px-4 py-3 font-semibold transition hover:bg-[var(--v-tinte)]">
            <span className="grid size-9 place-items-center rounded-full text-white" style={{ background: x.color }}>{x.icono}</span>
            {x.nombre}
          </a>
        ))}
      </div>
    </section>
  );
}

/* ───────────── Tu reserva ───────────── */

interface EstadoHoras { cargando: boolean; horas: string[]; cerrado: boolean; error: string | null }

/** Lo que eligió en cada pregunta del Lounge: de la lista y lo que escribió */
interface RespuestaGusto { ids: string[]; otra: string }
/** Opciones que se pueden marcar en cada pregunta del Lounge */
const MAXIMO_POR_GUSTO = 3;

type ClavePaso = 'elegido' | `quien-${string}` | 'cuando' | `gusto-${string}` | 'datos' | 'resumen';

interface CuentaDeLaReserva { total: number; aproximado: boolean; minutos: number }

/** Lo que suma: la oferta a su precio y lo demás por separado */
function cuentaDeLaReserva(elegidos: ServicioVitrina[], apartados: ProductoVitrina[], oferta: OfertaVitrina | null): CuentaDeLaReserva {
  const enOferta = new Set(oferta?.servicioIds ?? []);
  let total = oferta ? oferta.precio : 0;
  let aproximado = false;
  for (const x of [...elegidos.filter((s) => !enOferta.has(s.id)), ...apartados]) {
    if (x.precio == null || x.modoPrecio === 'consultar') { aproximado = true; continue; }
    if (x.modoPrecio === 'desde') aproximado = true;
    total += x.precio;
  }
  return { total, aproximado, minutos: elegidos.reduce((m, s) => m + s.duracionMin, 0) };
}

function Total({ cuenta, dinero }: { cuenta: CuentaDeLaReserva; dinero: Intl.NumberFormat }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-[var(--v-suave)]">
        {cuenta.minutos ? `${duracion(cuenta.minutos)} · ` : ''}Total{cuenta.aproximado ? ' estimado' : ''}
      </span>
      <span className="text-lg font-bold">{cuenta.total > 0 ? `${cuenta.aproximado ? 'Desde ' : ''}${dinero.format(cuenta.total)}` : 'En el salón'}</span>
    </div>
  );
}

/** Lo elegido, con el botón para quitar cada cosa */
function ListaElegidos({ elegidos, apartados, oferta, quitarServicio, quitarProducto }: {
  elegidos: ServicioVitrina[]; apartados: ProductoVitrina[]; oferta: OfertaVitrina | null;
  quitarServicio: (id: string) => void; quitarProducto: (id: string) => void;
}) {
  if (!elegidos.length && !apartados.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--v-borde)] p-4 text-center text-sm text-[var(--v-suave)]">
        Toca <Plus className="inline size-3.5 align-[-2px]" /> en un servicio para empezar.
      </div>
    );
  }
  return (
    <ul className="space-y-1.5">
      <AnimatePresence initial={false}>
        {elegidos.map((s) => (
          <motion.li key={s.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -16 }}
            className="flex items-center gap-2 rounded-2xl bg-[var(--v-tinte)] py-2 pl-3 pr-1.5 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{s.nombre}</span>
              <span className="text-xs text-[var(--v-suave)]">{duracion(s.duracionMin)}</span>
            </span>
            <button type="button" onClick={() => quitarServicio(s.id)} className="grid size-8 place-items-center rounded-full text-[var(--v-suave)] hover:bg-[var(--v-sup)]" aria-label={`Quitar ${s.nombre}`}>
              <Minus className="size-4" />
            </button>
          </motion.li>
        ))}
        {apartados.map((p) => (
          <motion.li key={p.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -16 }}
            className="flex items-center gap-2 rounded-2xl border border-[var(--v-borde)] py-2 pl-3 pr-1.5 text-sm">
            <ShoppingBag className="size-4 shrink-0 text-[var(--v-p)]" />
            <span className="min-w-0 flex-1 truncate">{p.nombre} <span className="text-xs text-[var(--v-suave)]">· para apartar</span></span>
            <button type="button" onClick={() => quitarProducto(p.id)} className="grid size-8 place-items-center rounded-full text-[var(--v-suave)] hover:bg-[var(--v-sup)]" aria-label={`No apartar ${p.nombre}`}>
              <Minus className="size-4" />
            </button>
          </motion.li>
        ))}
      </AnimatePresence>
      {oferta && <li className="px-1 text-xs font-medium text-[var(--v-p)]"><Tag className="mr-1 inline size-3" />Oferta «{oferta.nombre}»</li>}
      {!elegidos.length && <li className="px-1 pt-1 text-xs text-[var(--v-suave)]">Para reservar, agrega también un servicio.</li>}
    </ul>
  );
}

/**
 * "Tu reserva" a pantalla completa, como la bienvenida del quiosco: una cosa
 * por pantalla, con Siguiente y Atrás, y una barra que dice cuánto falta. Lo
 * elegido, con quién se hace cada servicio (si la Vitrina deja elegir: una
 * pantalla por servicio, así puede pedir a una para el cabello y a otra para
 * las uñas), día y hora, los gustos del Lounge (si el salón lo tiene: una
 * pregunta por pantalla, con «Otra» y «Saltar»), sus datos y al final el
 * resumen con el botón de reservar.
 *
 * Nunca la saluda por su nombre ni le dice si ya es clienta: desde internet
 * cualquiera puede escribir el teléfono de otra persona.
 */
function PanelReserva({
  datos, slug, previa, dinero, cuenta, completa, abierta, cerrar, elegidos, apartados, oferta, quitarServicio, quitarProducto, alHacer,
  conQuien, setConQuien,
}: {
  datos: DatosVitrina; slug: string | null; previa: boolean; dinero: Intl.NumberFormat; cuenta: CuentaDeLaReserva;
  /** En pantallas anchas, a pantalla completa; en el teléfono va dentro de la hoja que sube */
  completa: boolean;
  /** 'lista' empieza en lo elegido; 'siguiente' en lo que sigue (ya lo vio en el panel de al lado) */
  abierta: false | 'lista' | 'siguiente';
  cerrar: () => void;
  elegidos: ServicioVitrina[]; apartados: ProductoVitrina[]; oferta: OfertaVitrina | null;
  quitarServicio: (id: string) => void; quitarProducto: (id: string) => void; alHacer: (r: ReservaHecha) => void;
  /** Con quién quiere cada servicio (sin entrada = quien esté libre). Vive en la página: desde una especialista ya se elige */
  conQuien: Record<string, string>;
  setConQuien: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  const { sede, diseno } = datos;
  const gustos = datos.gustos ?? [];
  const [clave, setClave] = useState<ClavePaso>('elegido');
  const [direccion, setDireccion] = useState(1);
  const [fecha, setFecha] = useState<string>(sede.hoyFecha);
  const [hora, setHora] = useState<string | null>(null);
  const [contacto, setContacto] = useState(leerContacto);
  const [nota, setNota] = useState('');
  const [respuestas, setRespuestas] = useState<Record<string, RespuestaGusto>>({});
  const [estado, setEstado] = useState<EstadoHoras>({ cargando: false, horas: [], cerrado: false, error: null });
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recargar, setRecargar] = useState(0);
  const turno = useRef(0);
  const titulo = useRef<HTMLHeadingElement>(null);

  const ids = elegidos.map((s) => s.id).join(',');

  // Para cada servicio, quien lo hace
  const posiblesDe = useMemo(() => {
    const m = new Map<string, EspecialistaVitrina[]>();
    for (const s of elegidos) {
      m.set(s.id, diseno.elegirEspecialista ? datos.especialistas.filter((e) => !e.categorias || e.categorias.includes(s.categoria)) : []);
    }
    return m;
  }, [datos.especialistas, diseno.elegirEspecialista, elegidos]);
  // Si quitó el servicio o esa especialista ya no está, se suelta
  useEffect(() => {
    setConQuien((m) => {
      const limpio = Object.fromEntries(Object.entries(m).filter(([sid, eid]) => posiblesDe.get(sid)?.some((e) => e.id === eid)));
      return Object.keys(limpio).length === Object.keys(m).length ? m : limpio;
    });
  }, [posiblesDe]);
  const conElegir = useMemo(() => elegidos.filter((s) => posiblesDe.get(s.id)?.length), [elegidos, posiblesDe]);
  const especialistas = elegidos.map((s) => conQuien[s.id] ?? '').join(',');

  const pasos = useMemo(() => {
    // Primero lo que hace falta para la cita (día, hora, nombre y WhatsApp); lo demás se puede saltar
    const l: { clave: ClavePaso; titulo: string; ayuda?: string }[] = [
      { clave: 'elegido', titulo: 'Lo que elegiste' },
      { clave: 'cuando', titulo: '¿Qué día y a qué hora?' },
      { clave: 'datos', titulo: '¿A nombre de quién reservamos?' },
    ];
    conElegir.forEach((s, i) => l.push({
      clave: `quien-${s.id}`,
      titulo: conElegir.length > 1 ? `¿Con quién te haces ${s.nombre}?` : '¿Con quién te quieres atender?',
      ayuda: conElegir.length > 1 ? `Servicio ${i + 1} de ${conElegir.length}: puedes elegir a alguien distinto para cada uno.` : undefined,
    }));
    for (const g of gustos) l.push({ clave: `gusto-${g.tipo}`, titulo: g.titulo, ayuda: g.ayuda });
    l.push({ clave: 'resumen', titulo: 'Revisa y reserva' });
    return l;
  }, [conElegir, gustos]);
  const indice = Math.max(0, pasos.findIndex((p) => p.clave === clave));
  const paso = pasos[indice];

  const ir = (destino: ClavePaso) => {
    const a = pasos.findIndex((p) => p.clave === destino);
    setDireccion(a >= indice ? 1 : -1);
    setError(null);
    setClave(destino);
  };
  const siguiente = () => { if (indice < pasos.length - 1) ir(pasos[indice + 1].clave); };
  const atras = () => { if (indice > 0) ir(pasos[indice - 1].clave); };

  // Desde el panel de al lado ya vio lo que eligió: arranca en lo que sigue
  useEffect(() => {
    if (abierta === 'siguiente' && clave === 'elegido' && elegidos.length && pasos[1]) { setDireccion(1); setClave(pasos[1].clave); }
  }, [abierta]);
  // Sin servicios no hay a dónde avanzar: de vuelta al principio
  useEffect(() => { if (!elegidos.length && clave !== 'elegido') { setDireccion(-1); setClave('elegido'); } }, [elegidos.length, clave]);
  // Si se quitó el servicio de ese paso, al que quedó en su lugar
  useEffect(() => { if (!pasos.some((p) => p.clave === clave)) setClave(pasos[Math.min(indice, pasos.length - 1)].clave); }, [pasos, clave, indice]);
  // Al abrir y al cambiar de pantalla, el lector de pantalla oye el título nuevo
  useEffect(() => {
    if (abierta) titulo.current?.focus({ preventScroll: true });
  }, [clave, abierta]);
  // A pantalla completa la página de atrás no se mueve, y Escape la cierra (la hoja ya lo hace sola)
  useEffect(() => {
    if (!abierta || !completa) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(); };
    window.addEventListener('keydown', tecla);
    const antes = document.body.style.overflow;
    if (!previa) document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', tecla); document.body.style.overflow = antes; };
  }, [abierta, completa, cerrar, previa]);

  // Cómo sale cada día para lo que eligió (y con quién), según el servidor:
  // solo los días con horas libres, y en gris el que quien lo hace suele venir
  // pero anotó que no viene. Mientras llega (o en la vista previa), el horario.
  const [estadosDias, setEstadosDias] = useState<{ clave: string; estados: Record<string, EstadoDiaVitrina> } | null>(null);
  const claveDias = `${ids}|${especialistas}`;
  useEffect(() => {
    if (previa || !slug || !ids) return;
    let vale = true;
    const q = new URLSearchParams({ servicios: ids });
    if (especialistas.replace(/,/g, '')) q.set('especialistas', especialistas);
    publicRequest<{ dias: { fecha: string; estado: EstadoDiaVitrina }[] }>(`/vitrina/publica/${encodeURIComponent(slug)}/dias?${q}`)
      .then((r) => { if (vale) setEstadosDias({ clave: claveDias, estados: Object.fromEntries(r.dias.map((d) => [d.fecha, d.estado])) }); })
      // Sin la lista, la tira sigue con el horario y las horas se piden día por día
      .catch(() => { if (vale) setEstadosDias(null); });
    return () => { vale = false; };
  }, [previa, slug, ids, especialistas, claveDias]);
  const estados = estadosDias?.clave === claveDias ? estadosDias.estados : null;

  // Con quien eligió: los días que ella no viene salen cerrados (la sede puede abrir)
  const semanasElegidas = useMemo(() => [...new Set(Object.values(conQuien))]
    .map((id) => datos.especialistas.find((e) => e.id === id)?.semana)
    .filter((x): x is NonNullable<typeof x> => !!x), [conQuien, datos.especialistas]);
  const dias = useMemo(() => {
    const n = Math.max(0, Math.min(sede.diasParaReservar, DIAS_EN_LA_TIRA));
    const todos = Array.from({ length: n + 1 }, (_, i) => {
      const f = sumarDias(sede.hoyFecha, i);
      const dia = diaDeSemana(f);
      const abierto = (sede.semana.find((d) => d.dia === dia)?.abierto ?? true)
        && semanasElegidas.every((sem) => sem.find((d) => d.dia === dia)?.abierto ?? true);
      return { fecha: f, abierto };
    });
    if (!estados) return todos;
    return todos
      .filter((d) => estados[d.fecha] === 'libre' || estados[d.fecha] === 'ausente')
      .map((d) => ({ fecha: d.fecha, abierto: estados[d.fecha] === 'libre' }));
  }, [sede.diasParaReservar, sede.hoyFecha, sede.semana, semanasElegidas, estados]);
  const sinDias = !!estados && !dias.some((d) => d.abierto);
  // Si el día elegido no está o quedó cerrado, al primero que tiene horas
  useEffect(() => {
    if (!estados && !semanasElegidas.length) return;
    if (dias.find((d) => d.fecha === fecha)?.abierto) return;
    const primero = dias.find((d) => d.abierto);
    if (primero) setFecha(primero.fecha);
  }, [dias, fecha, estados, semanasElegidas.length]);

  // Las horas libres de verdad: las mismas que ofrece Lalán en los chats.
  // Al cambiar de día o de servicios se vuelve a elegir la hora; al cambiar
  // de especialista se queda si ella está libre a esa hora.
  const consulta = useRef('');
  const [horaPerdida, setHoraPerdida] = useState<string | null>(null);
  const horaRef = useRef(hora);
  horaRef.current = hora;
  const perdidaRef = useRef(horaPerdida);
  perdidaRef.current = horaPerdida;
  useEffect(() => {
    const nueva = `${fecha}|${ids}|${recargar}`;
    const mismaHora = consulta.current === nueva;
    consulta.current = nueva;
    if (!mismaHora) { setHora(null); setHoraPerdida(null); horaRef.current = null; perdidaRef.current = null; }
    if (previa || !slug || !ids) { setEstado({ cargando: false, horas: [], cerrado: false, error: null }); return; }
    const mio = ++turno.current;
    setEstado((e) => ({ ...e, cargando: true, error: null }));
    const q = new URLSearchParams({ fecha, servicios: ids });
    if (especialistas.replace(/,/g, '')) q.set('especialistas', especialistas);
    publicRequest<{ fecha: string; cerrado: boolean; horas: string[] }>(`/vitrina/publica/${encodeURIComponent(slug)}/horas?${q}`)
      .then((r) => {
        if (mio !== turno.current) return;
        setEstado({ cargando: false, horas: r.horas, cerrado: r.cerrado, error: null });
        // Si eligió a otra persona y a esa hora sí está libre, la hora vuelve sola
        const quiere = horaRef.current ?? perdidaRef.current;
        if (!quiere) return;
        const libre = r.horas.includes(quiere);
        setHora(libre ? quiere : null);
        setHoraPerdida(libre ? null : quiere);
      })
      .catch((e: unknown) => {
        if (mio === turno.current) setEstado({ cargando: false, horas: [], cerrado: false, error: e instanceof ErrorPublico ? e.message : 'No se pudieron cargar las horas' });
      });
  }, [previa, slug, ids, fecha, especialistas, recargar]);

  const telefonoOk = contacto.telefono.replace(/\D/g, '').length >= 7;
  const datosOk = contacto.nombre.trim().length >= 2 && telefonoOk;
  const listo = !!elegidos.length && !!hora && datosOk;

  const respuesta = (tipo: string): RespuestaGusto => respuestas[tipo] ?? { ids: [], otra: '' };
  const marcarGusto = (tipo: string, id: string) => {
    const r = respuesta(tipo);
    if (!r.ids.includes(id) && r.ids.length >= MAXIMO_POR_GUSTO) return;
    setRespuestas((m) => ({ ...m, [tipo]: { ...r, ids: r.ids.includes(id) ? r.ids.filter((x) => x !== id) : [...r.ids, id] } }));
  };
  const loQueLeGusta = (tipo: string) => {
    const g = gustos.find((x) => x.tipo === tipo);
    const r = respuesta(tipo);
    return [...r.ids.map((id) => g?.opciones.find((o) => o.id === id)?.valor).filter(Boolean), r.otra.trim()].filter(Boolean) as string[];
  };

  const puedeSeguir = (() => {
    if (paso.clave === 'elegido') return !!elegidos.length;
    if (paso.clave === 'cuando') return previa || !!hora;
    if (paso.clave === 'datos') return previa || datosOk;
    return true;
  })();
  const porQueNo = paso.clave === 'elegido' ? 'Elige al menos un servicio'
    : paso.clave === 'cuando' ? 'Elige una hora'
      : paso.clave === 'datos' ? (contacto.nombre.trim().length < 2 ? 'Escribe tu nombre' : 'Escribe tu WhatsApp con código de área')
        : '';

  const reservar = async () => {
    if (!listo || !slug || previa || enviando) return;
    setEnviando(true); setError(null);
    try {
      const r = await publicRequest<ReservaHecha>(`/vitrina/publica/${encodeURIComponent(slug)}/reservas`, {
        method: 'POST',
        body: {
          servicioIds: elegidos.map((s) => s.id), fecha, hora,
          especialistaIds: elegidos.map((s) => conQuien[s.id] ?? null),
          nombre: contacto.nombre.trim(), telefono: contacto.telefono.trim(),
          productoIds: apartados.map((p) => p.id),
          nota: [oferta ? `Viene por la oferta «${oferta.nombre}»` : '', nota.trim()].filter(Boolean).join(' · '),
          gustoIds: gustos.flatMap((g) => respuesta(g.tipo).ids),
          gustosNuevos: gustos.map((g) => ({ tipo: g.tipo, valor: respuesta(g.tipo).otra.trim() })).filter((g) => g.valor),
        },
      });
      guardarContacto(contacto.nombre.trim(), contacto.telefono.trim());
      alHacer(r);
    } catch (e) {
      const ocupada = e instanceof ErrorPublico && e.status === 409;
      setError(e instanceof ErrorPublico ? e.message : 'No se pudo reservar. Inténtalo de nuevo.');
      // Si alguien tomó esa hora, se vuelven a pedir las libres y se vuelve a elegir
      if (ocupada) { setRecargar((n) => n + 1); setDireccion(-1); setClave('cuando'); }
    } finally {
      setEnviando(false);
    }
  };

  const campo = 'w-full rounded-2xl border border-[var(--v-borde)] bg-[var(--v-sup)] px-4 py-3.5 text-base outline-none transition placeholder:text-[var(--v-suave)] focus:border-[var(--v-p)]';
  const chip = (activo: boolean) => `rounded-full px-4 py-2.5 text-sm font-medium transition active:scale-95 ${activo ? 'bg-[var(--v-p)] text-[var(--v-sobre-p)]' : 'border border-[var(--v-borde)] bg-[var(--v-sup)]'}`;
  const nombreDe = (id: string | undefined) => datos.especialistas.find((e) => e.id === id)?.nombre ?? null;
  const conAlguien = elegidos.some((s) => conQuien[s.id]);

  const contenido = () => {
    switch (true) {
      case paso.clave === 'elegido':
        return <ListaElegidos elegidos={elegidos} apartados={apartados} oferta={oferta} quitarServicio={quitarServicio} quitarProducto={quitarProducto} />;

      case paso.clave.startsWith('quien-'): {
        const sid = paso.clave.slice(6);
        const actual = conQuien[sid] ?? null;
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 @2xl:grid-cols-3">
              {[null, ...(posiblesDe.get(sid) ?? [])].map((e) => {
                const id = e?.id ?? null;
                const activo = actual === id;
                return (
                  <button
                    key={id ?? 'libre'} type="button" aria-pressed={activo}
                    onClick={() => setConQuien((m) => { const n = { ...m }; if (id) n[sid] = id; else delete n[sid]; return n; })}
                    className={`flex flex-col items-center gap-1.5 rounded-3xl p-4 text-center text-sm transition active:scale-[0.97] ${activo ? 'bg-[var(--v-p)] text-[var(--v-sobre-p)]' : 'border border-[var(--v-borde)] bg-[var(--v-sup)]'}`}
                  >
                    <span className={`grid size-14 place-items-center rounded-full text-lg font-bold ${activo ? 'bg-white/20' : 'bg-[var(--v-tinte)] text-[var(--v-p)]'}`}>
                      {e ? iniciales(e.nombre) : <User className="size-6" />}
                    </span>
                    <span className="font-semibold leading-tight">{e ? e.nombre : 'Quien esté libre'}</span>
                    <span className={`text-xs leading-tight ${activo ? 'opacity-85' : 'text-[var(--v-suave)]'}`}>{e ? e.especialidad || ' ' : 'Te asignamos a alguien'}</span>
                  </button>
                );
              })}
            </div>
            {/* La hora ya está elegida: si con quien eligió no hay hueco a esa hora, se le dice aquí */}
            {!previa && estado.cargando && !!actual && <p className="flex items-center gap-2 text-sm text-[var(--v-suave)]"><Loader2 className="size-4 animate-spin" />Viendo si está libre a tu hora…</p>}
            {!previa && !estado.cargando && horaPerdida && !hora && (
              <div className="flex items-start gap-2 rounded-2xl bg-amber-500/10 p-3 text-sm">
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <span className="min-w-0 flex-1">
                  Con quien elegiste no hay hueco a las {horaBonita(horaPerdida)}: elige a otra persona o{' '}
                  <button type="button" onClick={() => ir('cuando')} className="font-semibold text-[var(--v-p)] underline underline-offset-2">cambia la hora</button>.
                </span>
              </div>
            )}
          </div>
        );
      }

      case paso.clave === 'cuando':
        return (
          <div className="space-y-5">
            <FilaArrastrable className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
              {dias.map((d) => {
                const activo = fecha === d.fecha;
                const fechaD = new Date(`${d.fecha}T12:00:00Z`);
                return (
                  <button
                    key={d.fecha} type="button" disabled={!d.abierto} onClick={() => setFecha(d.fecha)} aria-pressed={activo}
                    aria-label={fmtFechaLarga.format(fechaD) + (d.abierto ? '' : estados ? ', no disponible' : ', cerrado')}
                    className={`flex w-16 shrink-0 flex-col items-center rounded-2xl py-2.5 text-center transition disabled:opacity-35 ${activo ? 'bg-[var(--v-p)] text-[var(--v-sobre-p)]' : 'border border-[var(--v-borde)] bg-[var(--v-sup)]'}`}
                  >
                    <span className="text-[11px] capitalize opacity-80">{d.fecha === sede.hoyFecha ? 'Hoy' : fmtDiaCorto.format(fechaD).replace('.', '')}</span>
                    <span className="text-xl font-bold leading-tight">{fechaD.getUTCDate()}</span>
                    <span className="text-[10px] capitalize opacity-70">{fmtMes.format(fechaD).replace('.', '')}</span>
                  </button>
                );
              })}
            </FilaArrastrable>
            {sinDias ? (
              <p className="py-2 text-sm text-[var(--v-suave)]">
                No quedan horas libres en los próximos {Math.max(0, Math.min(sede.diasParaReservar, DIAS_EN_LA_TIRA)) + 1} días{conAlguien ? ' con quien elegiste' : ''}.
                {conAlguien ? ' Prueba con «Quien esté libre».' : ' Vuelve a mirar en unos días.'}
              </p>
            ) : previa ? (
              <p className="rounded-2xl bg-[var(--v-tinte)] p-3 text-sm">En la vista previa no se ven las horas libres. Tus clientas sí las verán.</p>
            ) : estado.cargando ? (
              <div className="grid grid-cols-3 gap-2 @2xl:grid-cols-4" aria-label="Buscando horas libres">
                {Array.from({ length: 8 }, (_, i) => <span key={i} className="h-11 animate-pulse rounded-xl bg-[var(--v-tinte)]" />)}
              </div>
            ) : estado.error ? (
              <p className="flex items-start gap-2 rounded-2xl bg-rose-500/10 p-3 text-sm text-rose-600"><AlertCircle className="mt-0.5 size-4 shrink-0" />{estado.error}</p>
            ) : estado.cerrado ? (
              <p className="py-2 text-sm text-[var(--v-suave)]">Ese día el salón está cerrado. Elige otro.</p>
            ) : !estado.horas.length ? (
              <p className="py-2 text-sm text-[var(--v-suave)]">No quedan horas libres ese día{conAlguien ? ' con quien elegiste' : ''}. Prueba otro día{conAlguien ? ' o «Quien esté libre»' : ''}.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 @2xl:grid-cols-4">
                {estado.horas.map((h, i) => (
                  <motion.button
                    key={h} type="button" onClick={() => setHora(h)} aria-pressed={hora === h}
                    initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.02 }}
                    className={`rounded-xl py-3 text-sm font-medium tabular-nums transition ${hora === h ? 'bg-[var(--v-p)] text-[var(--v-sobre-p)]' : 'border border-[var(--v-borde)] bg-[var(--v-sup)]'}`}
                  >
                    {horaBonita(h)}
                  </motion.button>
                ))}
              </div>
            )}
          </div>
        );

      case paso.clave.startsWith('gusto-'): {
        const g = gustos.find((x) => `gusto-${x.tipo}` === paso.clave)!;
        const r = respuesta(g.tipo);
        return (
          <div className="space-y-3">
            {!!g.opciones.length && (
              <div className="flex flex-wrap gap-2">
                {g.opciones.map((o) => (
                  <button key={o.id} type="button" onClick={() => marcarGusto(g.tipo, o.id)} aria-pressed={r.ids.includes(o.id)} className={chip(r.ids.includes(o.id))}>
                    {r.ids.includes(o.id) && <Check className="mr-1 inline size-3.5 align-[-2px]" />}{o.valor}
                  </button>
                ))}
              </div>
            )}
            <input
              className={campo} maxLength={60}
              placeholder={g.opciones.length ? 'Otra (escríbela)' : g.tipo === 'music' ? 'Un artista o un género' : 'Lo que te gusta tomar'}
              value={r.otra} onChange={(e) => setRespuestas((m) => ({ ...m, [g.tipo]: { ...respuesta(g.tipo), otra: e.target.value } }))}
            />
            {r.ids.length >= MAXIMO_POR_GUSTO && <p className="text-xs text-[var(--v-suave)]">Con {MAXIMO_POR_GUSTO} nos basta para conocerte.</p>}
          </div>
        );
      }

      case paso.clave === 'datos':
        return (
          <div className="space-y-2.5">
            <input
              className={campo} placeholder="Tu nombre" autoComplete="name" maxLength={80}
              value={contacto.nombre} onChange={(e) => setContacto((c) => ({ ...c, nombre: e.target.value }))}
            />
            <input
              className={campo} placeholder="Tu WhatsApp, con código de área" autoComplete="tel" inputMode="tel" maxLength={24}
              value={contacto.telefono} onChange={(e) => setContacto((c) => ({ ...c, telefono: e.target.value }))}
            />
            <textarea
              className={`${campo} min-h-[88px] resize-none`} placeholder="¿Algo que debamos saber? Una alergia, por ejemplo (opcional)" maxLength={300}
              value={nota} onChange={(e) => setNota(e.target.value)}
            />
            <p className="px-1 text-xs text-[var(--v-suave)]">Solo lo usamos para tu cita.</p>
          </div>
        );

      default: {
        // El resumen: cada línea lleva a su paso para cambiarla
        const fila = (icono: React.ReactNode, texto: React.ReactNode, a: ClavePaso) => (
          <li>
            <button type="button" onClick={() => ir(a)} className="flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left text-[15px] transition hover:bg-[var(--v-tinte)]">
              <span className="mt-0.5 shrink-0 text-[var(--v-p)]">{icono}</span>
              <span className="min-w-0 flex-1">{texto}</span>
              <span className="shrink-0 text-xs font-semibold text-[var(--v-p)]">Cambiar</span>
            </button>
          </li>
        );
        const gustosDichos = gustos.map((g) => loQueLeGusta(g.tipo)).flat();
        return (
          <ul className={`divide-y divide-[var(--v-borde)] ${TARJETA} px-3`}>
            {fila(<Sparkles className="size-4" />, <><b className="font-semibold">{elegidos.map((s) => s.nombre).join(' + ')}</b>{apartados.length ? <span className="block text-xs text-[var(--v-suave)]">Apartas: {apartados.map((p) => p.nombre).join(', ')}</span> : null}</>, 'elegido')}
            {fila(<CalendarDays className="size-4" />, hora
              ? <span className="first-letter:uppercase inline-block">{fmtFechaLarga.format(new Date(`${fecha}T12:00:00Z`))}, {horaBonita(hora)}</span>
              : <span className="text-[var(--v-suave)]">{previa ? 'Aquí va el día y la hora' : 'Elige el día y la hora'}</span>, 'cuando')}
            {fila(<Phone className="size-4" />, contacto.nombre.trim() ? `${contacto.nombre.trim()} · ${contacto.telefono.trim()}` : <span className="text-[var(--v-suave)]">Tu nombre y tu WhatsApp</span>, 'datos')}
            {!!conElegir.length && fila(<User className="size-4" />, (
              <span className="block space-y-0.5">
                {conElegir.map((s) => (
                  <span key={s.id} className="block">
                    {conElegir.length > 1 && <span className="text-[var(--v-suave)]">{s.nombre}: </span>}
                    {nombreDe(conQuien[s.id]) ? `Con ${nombreDe(conQuien[s.id])}` : 'Con quien esté libre'}
                  </span>
                ))}
              </span>
            ), `quien-${conElegir[0].id}`)}
            {gustos.length > 0 && fila(<Music className="size-4" />, gustosDichos.length ? gustosDichos.join(' · ') : <span className="text-[var(--v-suave)]">Sin gustos (puedes decirnos al llegar)</span>, `gusto-${gustos[0].tipo}`)}
          </ul>
        );
      }
    }
  };

  const ultimo = paso.clave === 'resumen';
  const esGusto = paso.clave.startsWith('gusto-');
  // Con quién y los gustos se pueden saltar: de un toque al resumen
  const opcional = esGusto || paso.clave.startsWith('quien-');

  const progreso = (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--v-tinte)]" role="progressbar" aria-valuemin={1} aria-valuemax={pasos.length} aria-valuenow={indice + 1} aria-label="Paso de la reserva">
      <motion.div className="h-full rounded-full bg-[var(--v-p)]" initial={false} animate={{ width: `${((indice + 1) / pasos.length) * 100}%` }} transition={{ type: 'spring', stiffness: 200, damping: 30 }} />
    </div>
  );

  // Una cosa por pantalla
  const pantalla = (
    <AnimatePresence mode="wait" initial={false} custom={direccion}>
      <motion.section
        key={paso.clave} custom={direccion}
        variants={{ entra: (d: number) => ({ opacity: 0, x: d * 32 }), quieto: { opacity: 1, x: 0 }, sale: (d: number) => ({ opacity: 0, x: d * -32 }) }}
        initial="entra" animate="quieto" exit="sale" transition={{ duration: 0.2, ease: 'easeOut' }}
        className={completa ? 'mx-auto w-full max-w-xl px-4 pt-8 pb-10 @4xl:pt-14' : 'mt-4'}
      >
        <h2 ref={titulo} tabIndex={-1} className={`font-bold outline-none ${completa ? 'text-2xl leading-tight tracking-tight @4xl:text-3xl' : 'text-lg leading-snug'}`}>{paso.titulo}</h2>
        {paso.ayuda && <p className={`text-[var(--v-suave)] ${completa ? 'mt-1.5 text-[15px]' : 'mt-0.5 text-sm'}`}>{paso.ayuda}</p>}
        <div className={completa ? 'mt-6' : 'mt-3'}>{contenido()}</div>
      </motion.section>
    </AnimatePresence>
  );

  // El total, los botones y por qué no se puede seguir
  const botones = (
    <>
      {!!elegidos.length && <Total cuenta={cuenta} dinero={dinero} />}
      {error && <p role="alert" className="mt-3 flex items-start gap-2 rounded-2xl bg-rose-500/10 p-3 text-sm text-rose-600"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</p>}
      <div className="mt-3 flex gap-2">
        {(completa || indice > 0) && (
          <button type="button" onClick={indice > 0 ? atras : cerrar} aria-label={indice > 0 ? 'Atrás' : 'Seguir viendo la Vitrina'} className="grid size-[50px] shrink-0 place-items-center rounded-full border border-[var(--v-borde)] transition active:scale-95">
            <ChevronLeft className="size-5" />
          </button>
        )}
        {ultimo ? (
          <button type="button" onClick={reservar} disabled={!listo || previa || enviando} className={`${BOTON_P} flex-1 py-3.5 text-[15px]`}>
            {enviando ? <><Loader2 className="size-4 animate-spin" /> Reservando…</> : previa ? 'Así se ve el botón de reservar' : diseno.confirmaSola ? 'Reservar' : 'Pedir esta cita'}
          </button>
        ) : (
          <button type="button" onClick={siguiente} disabled={!puedeSeguir} className={`${BOTON_P} flex-1 py-3.5 text-[15px]`}>
            {esGusto && !loQueLeGusta(paso.clave.slice(6)).length ? 'Saltar' : 'Siguiente'} <ChevronRight className="size-4" />
          </button>
        )}
      </div>
      {opcional && pasos[indice + 1]?.clave !== 'resumen' && (
        <button type="button" onClick={() => ir('resumen')} className="mt-2 w-full text-center text-xs font-semibold text-[var(--v-p)]">Saltar lo demás e ir a reservar</button>
      )}
      {!puedeSeguir && porQueNo && <p className="mt-2 text-center text-xs text-[var(--v-suave)]">{porQueNo} para seguir</p>}
      {ultimo && !listo && !previa && <p className="mt-2 text-center text-xs text-[var(--v-suave)]">Falta {!hora ? 'la hora' : 'tu nombre o tu WhatsApp'}: toca la línea para completarlo</p>}
      {ultimo && !diseno.confirmaSola && !previa && <p className="mt-2 text-center text-xs text-[var(--v-suave)]">El salón confirma tu cita por WhatsApp.</p>}
    </>
  );

  // En el teléfono, dentro de la hoja que sube: el título y el marco los pone la hoja
  if (!completa) {
    return (
      <div>
        <div className="flex items-center gap-3">
          {progreso}
          <span className="shrink-0 text-xs tabular-nums text-[var(--v-suave)]">{indice + 1} de {pasos.length}</span>
        </div>
        {pantalla}
        {(!!elegidos.length || !!apartados.length) && <div className="mt-5 border-t border-[var(--v-borde)] pt-4">{botones}</div>}
      </div>
    );
  }

  return (
    <motion.div
      role="dialog" aria-modal="true" aria-label="Tu reserva" aria-hidden={!abierta}
      initial={false}
      animate={abierta ? { opacity: 1, y: 0, visibility: 'visible' } : { opacity: 0, y: 32, transitionEnd: { visibility: 'hidden' } }}
      transition={{ type: 'spring', stiffness: 320, damping: 34 }}
      className="fixed inset-0 z-40 flex flex-col bg-[var(--v-fondo)] text-[var(--v-texto)]"
    >
      {/* Arriba: cerrar, dónde reserva y cuánto falta */}
      <header className="shrink-0 border-b border-[var(--v-borde)]">
        <div className="mx-auto flex w-full max-w-xl items-center gap-3 px-4 pt-3 pb-2.5">
          <button type="button" onClick={cerrar} aria-label="Volver a la Vitrina" className="grid size-10 shrink-0 place-items-center rounded-full border border-[var(--v-borde)] bg-[var(--v-sup)] transition active:scale-95">
            <X className="size-5" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-semibold">{datos.salon.nombre}</p>
            <p className="inline-flex max-w-full items-center gap-1 truncate text-xs text-[var(--v-suave)]"><MapPin className="size-3 shrink-0" />{sede.nombre}</p>
          </div>
          <span className="w-10 shrink-0 text-right text-xs tabular-nums text-[var(--v-suave)]">{indice + 1}/{pasos.length}</span>
        </div>
        <div className="mx-auto flex w-full max-w-xl px-4 pb-3">{progreso}</div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">{pantalla}</div>

      <footer className="shrink-0 border-t border-[var(--v-borde)] bg-[var(--v-sup)] pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto w-full max-w-xl px-4 py-3">{botones}</div>
      </footer>
    </motion.div>
  );
}

/* ───────────── listo ───────────── */

/**
 * La clienta le escribe a Lalán con su reserva (el mensaje va listo, con el
 * código). Así el salón le confirma por ese chat sin pagar una plantilla, y
 * Lalán reconoce el código: sabe que es esta reserva y no una cita nueva.
 */
function Agilizar({ hecha, salon }: { hecha: ReservaHecha; salon: string }) {
  const servicios = hecha.citas.map((c) => c.servicio).join(' + ');
  const texto = `Hola 👋 Reservé en la Vitrina de ${salon}: ${servicios} el ${hecha.dia} a las ${hecha.citas[0]?.texto ?? ''}. Reserva ${hecha.codigo}`;
  return (
    <a href={`https://wa.me/${hecha.whatsapp}?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer"
      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-3.5 text-[15px] font-bold text-white shadow-lg shadow-[#25D366]/30 transition hover:bg-[#1FBA59] active:scale-[0.98]">
      <MessageCircle className="size-5" /> Agilizar mi confirmación
    </a>
  );
}

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
      {!hecha.confirmada && hecha.whatsapp && hecha.codigo && (
        <>
          <Agilizar hecha={hecha} salon={salon} />
          <p className="mt-2 text-xs text-[var(--v-suave)]">Envía el mensaje que te dejamos listo en WhatsApp y te confirmamos por ahí.</p>
        </>
      )}

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
