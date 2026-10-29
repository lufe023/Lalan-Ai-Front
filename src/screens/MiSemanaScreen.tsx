import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, Check, ChevronRight, Clock, Copy, FileText, Loader2, MessageCircle, Package, Sparkles, UserRound, UserX } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { IOSHeader } from '../components/ui/IOSHeader';
import { IOSModal } from '../components/ui/IOSModal';
import { PageContent } from '../components/ui/PageContent';
import { Aparecer } from '../components/ui/movimiento';
import { SelectorSede } from '../components/ui/SelectorSede';
import { EtiquetaSede } from '../components/ui/CopiarASede';
import { useSedes } from '../hooks/useSedes';
import { ABRIR_CLIENTA } from '../services/saberProductos';
import { BotonWhatsapp, CHIP_RECORDATORIO, faltaRecordar, type RecordatorioAMano } from '../components/agenda/RecordarPorWhatsapp';
import { ABRIR_CITA } from './CalendarScreen';
import { CambiarEspecialista } from '../components/agenda/CambiarEspecialista';
import { HojaDelDia, OfrecerHueco, ResolverCita, hora12, type HuecoElegido, type PorVolver } from '../components/mi-semana/AccionesMiSemana';
import { urlDeFoto } from '../services/api';

/* Lo que devuelve /mi-semana (mi-semana.service.ts) */
interface Gusto { tipo: string; descripcion: string; valor: string; notas: string | null; falta: 'sin_producto' | 'se_acabo' | null; productId: string | null }
interface ProductoDeCita { productId: string; nombre: string; necesita: number; hay: number; unidad: string; alcanza: boolean }
interface Cita {
  id: string; startsAt: string; durationMinutes: number; status: string;
  clientId: string | null; clientName: string; serviceName: string;
  staffId: string | null; staffName: string | null;
  sede: { id: string; nombre: string };
  recordatorio: RecordatorioAMano;
  gustos: Gusto[];
  alergias: { nombres: string[]; avisos: { productId: string; texto: string }[] };
  senales: { emoji: string; descripcion: string; valor: string; fechaEvento: string | null }[];
  productos: ProductoDeCita[];
  staffTelefono: string | null;
  conversationId: string | null;
  adelanto: { estado: string | null; pagado: number } | null;
  historia: { visitas: number; ultima: string | null; faltas: number; de: number };
  fiao: { saldo: number; ventas: number } | null;
  foto: { url: string; fecha: string; nota: string | null; esVideo: boolean } | null;
  ausente: { motivo: string; emoji: string } | null;
  precio: number | null;
}
interface Hueco { desde: string; hasta: string; sede: { id: string; nombre: string } }
interface Dia { fecha: string; nombre: string; citas: Cita[]; huecos: Hueco[]; ingreso: number | null }
interface PorVencer { productId: string; nombre: string; sede: { id: string; nombre: string }; cantidad: number; unidad: string; vence: string }
interface ProductoQueFalta { productId: string; nombre: string; sede: { id: string; nombre: string }; necesita: number; hay: number; unidad: string; citas: number; desde: string }
interface MiSemana {
  dias: Dia[];
  teToca: { porRecordar: number; sinEspecialista: number; porConfirmar: number; productosQueFaltan: number; gustosSinProducto: number; alergias: number };
  productosQueFaltan: ProductoQueFalta[];
  porVolver: PorVolver[];
  porVencer: PorVencer[];
  moneda: { codigo: string; simbolo: string };
  ingreso: number | null;
}

type Pestana = 'hoy' | 'manana' | 'pasado' | 'semana';
type Filtro = 'porRecordar' | 'sinEspecialista' | 'ausentes' | 'porConfirmar' | 'adelantos' | 'productos' | 'gustos' | 'alergias' | null;

const PESTANAS: { id: Pestana; nombre: string; dia?: string }[] = [
  { id: 'hoy', nombre: 'Hoy', dia: 'Hoy' },
  { id: 'manana', nombre: 'Mañana', dia: 'Mañana' },
  { id: 'pasado', nombre: 'Pasado', dia: 'Pasado mañana' },
  { id: 'semana', nombre: 'Semana' },
];

const EMOJI_GUSTO: Record<string, string> = { music: '🎵', drink: '🍹', food: '🍪', style: '💇', movie: '🎬', other: '✨' };

const FILTROS: { id: Exclude<Filtro, null>; texto: (n: number) => string; pasa: (c: Cita) => boolean; color: string }[] = [
  { id: 'porRecordar', texto: (n) => `${n} sin recordar`, pasa: (c) => faltaRecordar(c.recordatorio), color: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800' },
  { id: 'sinEspecialista', texto: (n) => `${n} sin especialista`, pasa: (c) => !c.staffId, color: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  { id: 'ausentes', texto: (n) => `${n} con alguien que no viene`, pasa: (c) => !!c.ausente, color: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' },
  { id: 'porConfirmar', texto: (n) => `${n} por confirmar`, pasa: (c) => c.status === 'pending', color: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  { id: 'adelantos', texto: (n) => `${n} con adelanto por ver`, pasa: (c) => adelantoPorVer(c), color: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800' },
  { id: 'productos', texto: (n) => `${n} sin productos suficientes`, pasa: (c) => c.productos.some((p) => !p.alcanza), color: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' },
  { id: 'alergias', texto: (n) => `${n} con alergia`, pasa: (c) => c.alergias.avisos.length > 0, color: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800' },
  { id: 'gustos', texto: (n) => `${n} con un gusto que no tienes`, pasa: (c) => c.gustos.some((g) => g.falta), color: 'bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-800' },
];

/** Lo mismo que adelantoPorResolver del servidor: falta, llegó un comprobante o venció */
const adelantoPorVer = (c: Cita) => !!c.adelanto && c.status === 'pending' && ['esperando', 'comprobante', 'vencido'].includes(c.adelanto.estado ?? '');
const ADELANTO: Record<string, { texto: (c: Cita, $: (n: number) => string) => string; tono: string }> = {
  esperando: { texto: () => 'Apartada, esperando el adelanto', tono: 'text-amber-800 dark:text-amber-200' },
  comprobante: { texto: () => 'Mandó el comprobante del adelanto: revísalo', tono: 'text-amber-800 dark:text-amber-200' },
  vencido: { texto: () => 'Se venció el plazo del adelanto', tono: 'text-rose-800 dark:text-rose-300' },
  pagado: { texto: (c, $) => `Adelanto pagado: ${$(c.adelanto!.pagado)}`, tono: 'text-emerald-700 dark:text-emerald-400' },
};
const haceCuanto = (iso: string) => {
  const dias = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000));
  return dias < 14 ? `hace ${dias} ${dias === 1 ? 'día' : 'días'}` : dias < 60 ? `hace ${Math.round(dias / 7)} semanas` : `hace ${Math.round(dias / 30)} meses`;
};

const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit', hour12: true });
const cantidad = (n: number, unidad: string) => `${Number.isInteger(n) ? n : n.toFixed(1)}${unidad === 'unit' ? '' : ` ${unidad}`}`;
const fechaCorta = (f: string) => new Date(`${f.slice(0, 10)}T12:00:00`).toLocaleDateString('es-DO', { weekday: 'short', day: 'numeric', month: 'short' });

/**
 * Mi semana: lo que viene hoy, mañana, pasado y en la semana, cita por cita,
 * con lo que hace falta para decidir de frente a cada clienta. Cada aviso
 * tiene su botón: mandar el recordatorio, elegir especialista, ver su
 * ficha, ver el inventario.
 */
export const MiSemanaScreen: React.FC = () => {
  const { navigateTo, setActiveConversationId, showToast } = useApp();
  const sedes = useSedes();
  const [sede, setSede] = useState('');
  const [datos, setDatos] = useState<MiSemana | null>(null);
  const [error, setError] = useState('');
  const [pestana, setPestana] = useState<Pestana>('manana');
  const [filtro, setFiltro] = useState<Filtro>(null);
  // Las hojas que se abren desde una tarjeta: todo se resuelve aquí mismo
  const [cambiar, setCambiar] = useState<{ cita: Cita; asignar: boolean } | null>(null);
  const [resolver, setResolver] = useState<{ id: string; modo: 'confirmar' | 'adelanto' } | null>(null);
  const [ofrecer, setOfrecer] = useState<HuecoElegido | null>(null);
  const [hoja, setHoja] = useState<Dia | null>(null);
  const [foto, setFoto] = useState<Cita | null>(null);

  const cargar = useCallback(() => {
    setError('');
    api.get<MiSemana>(`/mi-semana${sede ? `?sede=${sede}` : ''}`)
      .then((d) => {
        setDatos(d);
        // Si mañana está vacío y hoy no, se abre en hoy
        setPestana((p) => (p === 'manana' && !d.dias.some((x) => x.nombre === 'Mañana') && d.dias.some((x) => x.nombre === 'Hoy') ? 'hoy' : p));
      })
      .catch((e) => setError(e?.message ?? 'No pude traer tu semana.'));
  }, [sede]);
  useEffect(() => { cargar(); }, [cargar]);

  const cambiarRecordatorio = (r: RecordatorioAMano) => setDatos((d) => d && ({
    ...d,
    dias: d.dias.map((x) => ({ ...x, citas: x.citas.map((c) => (c.id === r.id ? { ...c, recordatorio: r } : c)) })),
  }));

  const diasVisibles = useMemo(() => {
    if (!datos) return [];
    const p = PESTANAS.find((x) => x.id === pestana)!;
    const dias = p.dia ? datos.dias.filter((d) => d.nombre === p.dia) : datos.dias;
    const f = FILTROS.find((x) => x.id === filtro);
    // Sin filtro se ven también los días sin citas: tienen horas para llenar
    return dias.map((d) => ({ ...d, citas: f ? d.citas.filter(f.pasa) : d.citas })).filter((d) => d.citas.length || (!f && d.huecos.length));
  }, [datos, pestana, filtro]);

  const todas = useMemo(() => {
    const p = PESTANAS.find((x) => x.id === pestana)!;
    return (datos?.dias ?? []).filter((d) => !p.dia || d.nombre === p.dia).flatMap((d) => d.citas);
  }, [datos, pestana]);
  const cuantasPor = (f: (typeof FILTROS)[number]) => todas.filter(f.pasa).length;
  const productosDeLaPestana = useMemo(() => {
    const ids = new Set(todas.flatMap((c) => c.productos.filter((p) => !p.alcanza).map((p) => `${c.sede.id}:${p.productId}`)));
    return (datos?.productosQueFaltan ?? []).filter((p) => ids.has(`${p.sede.id}:${p.productId}`));
  }, [datos, todas]);

  const abrirFicha = (clientId: string) => { try { sessionStorage.setItem(ABRIR_CLIENTA, clientId); } catch { /* nada */ } navigateTo('clients'); };
  const abrirCita = (id: string) => { try { sessionStorage.setItem(ABRIR_CITA, id); } catch { /* nada */ } navigateTo('calendar'); };
  const abrirChat = (id: string) => { setActiveConversationId(id); navigateTo('chats'); };
  const $ = (n: number) => `${datos?.moneda.simbolo ?? '$'}${n.toLocaleString('es-DO', { maximumFractionDigits: 0 })}`;
  const diasDeLaPestana = useMemo(() => {
    const p = PESTANAS.find((x) => x.id === pestana)!;
    return (datos?.dias ?? []).filter((d) => !p.dia || d.nombre === p.dia);
  }, [datos, pestana]);
  const ingresoDeLaPestana = datos?.ingreso == null ? null : diasDeLaPestana.reduce((t, d) => t + (d.ingreso ?? 0), 0);
  const porVencer = datos?.porVencer ?? [];
  const listaParaPedir = productosDeLaPestana.map((p) => `• ${p.nombre}: faltan ${cantidad(Math.max(0, p.necesita - p.hay), p.unidad)} (${p.sede.nombre})`).join('\n');
  const copiarLista = async () => {
    try { await navigator.clipboard.writeText(`Para pedir:\n${listaParaPedir}`); showToast?.('Lista copiada', 'Pégala donde le pides a tu proveedor.', 'success'); } catch { /* sin portapapeles */ }
  };

  return (
    <div id="mi-semana-screen" className="flex-1 w-full h-full flex flex-col overflow-hidden">
      <IOSHeader
        title="Mi semana"
        subtitle="Lo que viene y lo que falta"
        rightAction={<SelectorSede sedes={sedes} value={sede} onChange={setSede} todas />}
      />
      <PageContent className="space-y-3">
        <div className="max-w-3xl mx-auto w-full space-y-3">
          {/* ── Hoy · Mañana · Pasado · Semana ── */}
          <div className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-neutral-800/70">
            {PESTANAS.map((p) => {
              const n = p.dia ? datos?.dias.find((d) => d.nombre === p.dia)?.citas.length ?? 0 : datos?.dias.reduce((a, d) => a + d.citas.length, 0) ?? 0;
              return (
                <button key={p.id} type="button" onClick={() => { setPestana(p.id); setFiltro(null); }}
                  className={`py-2 rounded-xl text-[0.8125rem] font-bold transition cursor-pointer ${pestana === p.id ? 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-neutral-400'}`}>
                  {p.nombre}{datos ? <span className="ml-1 text-[0.6875rem] font-semibold opacity-60">{n}</span> : null}
                </button>
              );
            })}
          </div>

          {datos && todas.length > 0 && (
            <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 px-1">
              <b className="text-slate-800 dark:text-neutral-100">{todas.length} {todas.length === 1 ? 'cita' : 'citas'}</b>
              {ingresoDeLaPestana != null && <> · deja <b className="text-slate-800 dark:text-neutral-100">{$(ingresoDeLaPestana)}</b></>}
              {todas.filter((c) => c.historia.visitas === 0).length > 0 && <> · {todas.filter((c) => c.historia.visitas === 0).length} por primera vez</>}
            </p>
          )}

          {error && <p className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-[0.8125rem]">{error}</p>}
          {!datos && !error && <div className="flex items-center gap-2 text-[0.8125rem] text-slate-400 py-6 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Armando tu semana…</div>}

          {/* ── Lo que te toca: cada número filtra la lista ── */}
          {datos && todas.length > 0 && (
            <div className="space-y-1.5">
              <h3 className="text-[0.6875rem] uppercase font-bold tracking-wider text-slate-400">Lo que te toca</h3>
              <div className="flex flex-wrap gap-1.5">
                {FILTROS.map((f) => {
                  const n = cuantasPor(f);
                  if (!n) return null;
                  const activo = filtro === f.id;
                  return (
                    <button key={f.id} type="button" onClick={() => setFiltro(activo ? null : f.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-bold border transition cursor-pointer ${f.color} ${activo ? 'ring-2 ring-offset-1 ring-[var(--primary)] dark:ring-offset-neutral-900' : ''}`}>
                      {f.texto(n)}
                    </button>
                  );
                })}
                {FILTROS.every((f) => !cuantasPor(f)) && (
                  <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Todo listo</span>
                )}
                {filtro && <button type="button" onClick={() => setFiltro(null)} className="px-3 py-1.5 rounded-full text-xs font-bold text-slate-500 cursor-pointer">Ver todas</button>}
              </div>
            </div>
          )}

          {/* ── Productos que no alcanzan ── */}
          {productosDeLaPestana.length > 0 && (!filtro || filtro === 'productos') && (
            <Aparecer className="p-4 rounded-3xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/60 dark:bg-rose-950/20 space-y-2">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-rose-600" />
                <span className="flex-1 font-bold text-[0.8125rem] text-rose-800 dark:text-rose-300">Productos que no alcanzan</span>
              </div>
              {productosDeLaPestana.map((p) => (
                <div key={`${p.sede.id}:${p.productId}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.8125rem]">
                  <span className="font-semibold text-slate-900 dark:text-white">{p.nombre}</span>
                  <EtiquetaSede locationId={p.sede.id} />
                  <span className="text-slate-600 dark:text-neutral-300">las citas piden {cantidad(p.necesita, p.unidad)} y hay {cantidad(p.hay, p.unidad)}</span>
                  <span className="text-[0.75rem] text-rose-700 dark:text-rose-400">· falta desde el {fechaCorta(p.desde)}</span>
                </div>
              ))}
              <div className="flex flex-wrap gap-2 pt-1">
                <a href={`https://wa.me/?text=${encodeURIComponent(`Hola, quiero pedir:\n${listaParaPedir}`)}`} target="_blank" rel="noopener"
                  className="px-3 py-2 rounded-xl text-[0.75rem] font-bold bg-[#25D366] text-white flex items-center gap-1.5"><MessageCircle className="w-4 h-4" /> Pedirlo por WhatsApp</a>
                <button type="button" onClick={() => void copiarLista()} className="px-3 py-2 rounded-xl text-[0.75rem] font-bold bg-white dark:bg-neutral-900 border border-rose-200 dark:border-rose-900/60 text-slate-700 dark:text-neutral-200 flex items-center gap-1.5 cursor-pointer"><Copy className="w-4 h-4" /> Copiar la lista</button>
                <button type="button" onClick={() => navigateTo('catalog')} className="px-3 py-2 rounded-xl text-[0.75rem] font-bold bg-white dark:bg-neutral-900 border border-rose-200 dark:border-rose-900/60 text-slate-700 dark:text-neutral-200 flex items-center gap-1.5 cursor-pointer">Ver inventario <ChevronRight className="w-3.5 h-3.5" /></button>
              </div>
            </Aparecer>
          )}

          {/* ── Lo que vence esta semana ── */}
          {porVencer.length > 0 && !filtro && (
            <Aparecer className="p-4 rounded-3xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/60 dark:bg-amber-950/20 space-y-2">
              <div className="flex items-center gap-2">
                <span>⏳</span>
                <span className="flex-1 font-bold text-[0.8125rem] text-amber-800 dark:text-amber-300">Vence esta semana: úsalo primero</span>
                <Enlace onClick={() => navigateTo('catalog')}>Ver inventario</Enlace>
              </div>
              {porVencer.map((p) => {
                const ya = new Date(p.vence).getTime() < Date.now();
                return (
                  <div key={`${p.sede.id}:${p.productId}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.8125rem]">
                    <span className="font-semibold text-slate-900 dark:text-white">{p.nombre}</span>
                    <EtiquetaSede locationId={p.sede.id} />
                    <span className="text-slate-600 dark:text-neutral-300">quedan {cantidad(p.cantidad, p.unidad)}</span>
                    <span className={`text-[0.75rem] ${ya ? 'text-rose-700 dark:text-rose-400 font-bold' : 'text-amber-700 dark:text-amber-400'}`}>· {ya ? 'ya venció' : `vence el ${fechaCorta(p.vence)}`}</span>
                  </div>
                );
              })}
            </Aparecer>
          )}

          {datos && !diasVisibles.length && !error && (
            <div className="py-10 text-center text-[0.875rem] text-slate-500 space-y-1">
              <CalendarClock className="w-8 h-8 mx-auto text-slate-300" />
              <p>{filtro ? 'Nada con ese aviso aquí.' : 'No hay citas para estos días.'}</p>
            </div>
          )}

          {diasVisibles.map((d) => (
            <section key={d.fecha} className="space-y-2">
              <div className="pt-2 flex items-center gap-2">
                <h3 className="flex-1 min-w-0 text-[0.75rem] font-bold uppercase tracking-wider text-slate-500">
                  {pestana === 'semana' ? d.nombre : 'El día'}{' '}
                  <span className="font-semibold normal-case tracking-normal text-slate-400">
                    · {d.citas.length ? `${d.citas.length} ${d.citas.length === 1 ? 'cita' : 'citas'}` : 'sin citas'}{d.ingreso ? ` · ${$(d.ingreso)}` : ''}
                  </span>
                </h3>
                {d.citas.length > 0 && (
                  <button type="button" onClick={() => setHoja(datos!.dias.find((x) => x.fecha === d.fecha)!)}
                    className="px-2.5 py-1 rounded-full text-[0.6875rem] font-bold bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 flex items-center gap-1 cursor-pointer whitespace-nowrap"><FileText className="w-3.5 h-3.5" /> Hoja del día</button>
                )}
              </div>
              {/* Horas libres: cada una abre a quién ofrecérsela */}
              {d.huecos.length > 0 && !filtro && (
                <div className="p-3 rounded-2xl border border-dashed border-slate-300 dark:border-neutral-700 flex flex-wrap items-center gap-1.5">
                  <span className="text-[0.75rem] font-bold text-slate-500 dark:text-neutral-400 mr-1 flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> Libre:</span>
                  {d.huecos.map((h, i) => (
                    <button key={i} type="button" onClick={() => setOfrecer({ fecha: d.fecha, nombreDia: d.nombre, desde: h.desde, hasta: h.hasta, sede: h.sede })}
                      className="px-2.5 py-1 rounded-full text-[0.75rem] font-bold bg-[var(--primary)]/10 text-[var(--primary)] cursor-pointer whitespace-nowrap">
                      {hora12(h.desde)} a {hora12(h.hasta)}{sedes.length > 1 && !sede ? ` · ${h.sede.nombre}` : ''}
                    </button>
                  ))}
                  <span className="text-[0.6875rem] text-slate-400 w-full sm:w-auto sm:ml-1">Toca una para ofrecérsela a quien ya le toca volver</span>
                </div>
              )}
              {d.citas.map((c, i) => (
                <TarjetaCita key={c.id} c={c} indice={i} $={$} onRecordatorio={cambiarRecordatorio} onFicha={abrirFicha} onCita={abrirCita} onChat={abrirChat}
                  onInventario={() => navigateTo('catalog')}
                  onCambiar={(asignar) => setCambiar({ cita: c, asignar })} onResolver={(modo) => setResolver({ id: c.id, modo })} onFoto={() => setFoto(c)} />
              ))}
            </section>
          ))}
        </div>
      </PageContent>

      {cambiar && (
        <CambiarEspecialista
          cita={{ id: cambiar.cita.id, clientName: cambiar.cita.clientName, clientPhone: cambiar.cita.recordatorio.telefono, serviceName: cambiar.cita.serviceName, startsAt: cambiar.cita.startsAt, staffName: cambiar.cita.staffName }}
          asignar={cambiar.asignar} onCerrar={() => setCambiar(null)} onListo={() => cargar()} />
      )}
      {resolver && <ResolverCita citaId={resolver.id} modo={resolver.modo} onCerrar={() => setResolver(null)} onListo={() => cargar()} />}
      {ofrecer && <OfrecerHueco hueco={ofrecer} porVolver={datos?.porVolver ?? []} onCerrar={() => setOfrecer(null)} onFicha={abrirFicha} />}
      {hoja && <HojaDelDia nombreDia={hoja.nombre} citas={hoja.citas} onCerrar={() => setHoja(null)} />}
      {foto?.foto && (
        <IOSModal id="mi-semana-foto" isOpen onClose={() => setFoto(null)} title="Cómo quedó" subtitle={`${foto.clientName} · ${fechaCorta(foto.foto.fecha)}`}>
          <div className="max-w-xl mx-auto pb-6 space-y-3">
            <img src={urlDeFoto(foto.foto.url)} alt={`Cómo quedó ${foto.clientName}`} className="w-full rounded-3xl object-cover" />
            {foto.foto.nota && <p className="text-[0.875rem] text-slate-700 dark:text-neutral-200">{foto.foto.nota}</p>}
            {foto.clientId && (
              <button type="button" onClick={() => abrirFicha(foto.clientId!)} className="w-full py-3 rounded-2xl bg-slate-100 dark:bg-neutral-800 font-bold text-[0.875rem] text-slate-700 dark:text-neutral-200 cursor-pointer">Ver todas en su ficha</button>
            )}
          </div>
        </IOSModal>
      )}
    </div>
  );
};

const BOTON = 'px-2 sm:px-3 py-2 justify-center whitespace-nowrap rounded-xl text-[0.75rem] font-bold bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-200 cursor-pointer flex items-center gap-1.5 hover:text-[var(--primary)]';

const Fila: React.FC<{ icono: React.ReactNode; children: React.ReactNode; tono?: string }> = ({ icono, children, tono = '' }) => (
  <div className={`flex items-start gap-2 text-[0.8125rem] ${tono}`}>
    <span className="shrink-0 mt-0.5 w-4 text-center">{icono}</span>
    <div className="flex-1 min-w-0">{children}</div>
  </div>
);

const Enlace: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button type="button" onClick={onClick} className="text-[0.75rem] font-bold text-[var(--primary)] inline-flex items-center gap-0.5 cursor-pointer whitespace-nowrap">
    {children} <ChevronRight className="w-3 h-3" />
  </button>
);

/** Una cita con todo lo que hay que saber antes de que llegue */
const TarjetaCita: React.FC<{
  c: Cita; indice: number; $: (n: number) => string;
  onRecordatorio: (r: RecordatorioAMano) => void; onFicha: (id: string) => void; onCita: (id: string) => void; onChat: (id: string) => void; onInventario: () => void;
  onCambiar: (asignar: boolean) => void; onResolver: (modo: 'confirmar' | 'adelanto') => void; onFoto: () => void;
}> = ({ c, indice, $, onRecordatorio, onFicha, onCita, onChat, onInventario, onCambiar, onResolver, onFoto }) => {
  const [chip, color] = c.recordatorio.aMano ? ['Ya se lo mandaste', 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'] : CHIP_RECORDATORIO[c.recordatorio.automatico.estado];
  const faltan = c.productos.filter((p) => !p.alcanza);
  const hoy = new Date().toISOString().slice(0, 10);
  return (
    <Aparecer indice={indice} className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 space-y-3">
      {/* Cuándo, quién, qué y con quién */}
      <div className="flex items-start gap-3">
        <div className="w-20 shrink-0">
          <div className="text-[0.9375rem] font-bold text-slate-900 dark:text-white leading-tight whitespace-nowrap">{hora(c.startsAt)}</div>
          <div className="text-[0.6875rem] text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" />{c.durationMinutes} min</div>
          {c.precio != null && c.precio > 0 && <div className="text-[0.6875rem] font-semibold text-slate-500 dark:text-neutral-400">{$(c.precio)}</div>}
        </div>
        <div className="flex-1 min-w-0">
          <button type="button" onClick={() => (c.clientId ? onFicha(c.clientId) : onCita(c.id))} className="font-bold text-[0.9375rem] text-slate-900 dark:text-white truncate max-w-full text-left cursor-pointer hover:text-[var(--primary)]">
            {c.clientName}
          </button>
          <div className="text-[0.75rem] text-slate-500 dark:text-neutral-400">{c.serviceName}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {!c.staffName ? (
              <button type="button" onClick={() => onCambiar(true)} className="px-2.5 py-1 rounded-full text-[0.6875rem] font-extrabold bg-amber-500 text-white flex items-center gap-1 cursor-pointer"><UserX className="w-3 h-3" />Sin especialista · asignar</button>
            ) : c.ausente ? (
              <button type="button" onClick={() => onCambiar(false)} className="px-2.5 py-1 rounded-full text-[0.6875rem] font-extrabold bg-rose-500 text-white flex items-center gap-1 cursor-pointer">
                {c.ausente.emoji} {c.staffName.split(' ')[0]} no viene ({c.ausente.motivo.toLowerCase()}) · pasarla a otra
              </button>
            ) : (
              <button type="button" onClick={() => onCambiar(false)} title="Cambiar quién la atiende" className="px-2 py-0.5 rounded-full text-[0.6875rem] font-bold bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 cursor-pointer hover:text-[var(--primary)]">con {c.staffName}</button>
            )}
            {c.status === 'pending' && <button type="button" onClick={() => onResolver('confirmar')} className="px-2.5 py-1 rounded-full text-[0.6875rem] font-extrabold bg-amber-500/15 text-amber-700 dark:text-amber-400 cursor-pointer flex items-center gap-1"><Check className="w-3 h-3" />Por confirmar · confirmar</button>}
            <EtiquetaSede locationId={c.sede.id} />
          </div>
        </div>
      </div>

      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-neutral-800">
        {/* Recordatorio */}
        <Fila icono="🔔">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-[0.6875rem] font-extrabold ${color}`} title={c.recordatorio.automatico.detalle}>{chip}</span>
            {faltaRecordar(c.recordatorio) && <BotonWhatsapp r={c.recordatorio} onMarcado={onRecordatorio} compacto />}
            {!c.recordatorio.enlace && <span className="text-[0.75rem] text-amber-700 dark:text-amber-400">No tiene teléfono</span>}
          </div>
        </Fila>

        {/* Cómo viene: primera vez, cuántas veces y si suele faltar */}
        <Fila icono={c.historia.visitas === 0 ? '🌱' : '🗓️'}>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            {c.historia.visitas === 0
              ? <span className="font-semibold text-emerald-700 dark:text-emerald-400">Primera vez en esta sede: dale la bienvenida</span>
              : <span className="text-slate-700 dark:text-neutral-200">Visita {c.historia.visitas + 1}{c.historia.ultima ? ` · la última ${haceCuanto(c.historia.ultima)}` : ''}</span>}
            {c.historia.faltas >= 2 && (
              <span className="font-semibold text-rose-700 dark:text-rose-400">· canceló o no vino {c.historia.faltas} de sus últimas {c.historia.de}{faltaRecordar(c.recordatorio) ? ': recuérdale' : ''}</span>
            )}
          </div>
        </Fila>

        {/* El adelanto: se registra o se revisa aquí mismo */}
        {c.adelanto && ADELANTO[c.adelanto.estado ?? ''] && (
          <Fila icono="💵" tono={ADELANTO[c.adelanto.estado!].tono}>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-semibold">{ADELANTO[c.adelanto.estado!].texto(c, $)}</span>
              {adelantoPorVer(c) && <Enlace onClick={() => onResolver('adelanto')}>{c.adelanto.estado === 'comprobante' ? 'Revisarlo' : 'Registrarlo'}</Enlace>}
            </div>
          </Fila>
        )}

        {/* Lo que debe fiado en esta sede */}
        {c.fiao && (
          <Fila icono="🧾" tono="text-rose-800 dark:text-rose-300">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span><b>Debe {$(c.fiao.saldo)}</b> fiado en esta sede{c.fiao.ventas > 1 ? ` (${c.fiao.ventas} cuentas)` : ''}: cóbraselo al pasar por caja</span>
              {c.clientId && <Enlace onClick={() => onFicha(c.clientId!)}>Ver su cuenta</Enlace>}
            </div>
          </Fila>
        )}

        {/* Cómo quedó la última vez */}
        {c.foto && (
          <Fila icono="📸">
            <button type="button" onClick={onFoto} className="flex items-center gap-2.5 text-left cursor-pointer group">
              <img src={urlDeFoto(c.foto.url)} alt="" className="size-11 rounded-xl object-cover shrink-0 ring-1 ring-slate-200 dark:ring-neutral-700" />
              <span className="min-w-0">
                <span className="block text-[0.8125rem] font-semibold text-slate-800 dark:text-neutral-100 group-hover:text-[var(--primary)]">Cómo quedó el {fechaCorta(c.foto.fecha)}</span>
                {c.foto.nota && <span className="block text-[0.75rem] text-slate-500 dark:text-neutral-400 line-clamp-1">{c.foto.nota}</span>}
              </span>
            </button>
          </Fila>
        )}

        {/* Alergias: por su nombre y el producto que la lleva */}
        {(c.alergias.avisos.length > 0 || c.alergias.nombres.length > 0) && (
          <Fila icono={<AlertTriangle className="w-4 h-4 text-amber-500" />} tono="text-amber-800 dark:text-amber-200">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span><b>Alergia:</b> {c.alergias.nombres.join(', ') || 'revisa la etiqueta'}</span>
              {c.clientId && <Enlace onClick={() => onFicha(c.clientId!)}>Ver su ficha</Enlace>}
            </div>
            {c.alergias.avisos.map((a) => <p key={a.productId} className="text-[0.75rem] text-amber-700 dark:text-amber-300">{a.texto}</p>)}
          </Fila>
        )}

        {/* Productos del servicio en su sede */}
        {faltan.length > 0 ? (
          <Fila icono={<Package className="w-4 h-4 text-rose-500" />} tono="text-rose-800 dark:text-rose-300">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span><b>Falta:</b> {faltan.map((p) => `${p.nombre} (hay ${cantidad(p.hay, p.unidad)}, pide ${cantidad(p.necesita, p.unidad)})`).join(' · ')}</span>
              <Enlace onClick={onInventario}>Ver inventario</Enlace>
            </div>
          </Fila>
        ) : c.productos.length > 0 && (
          <Fila icono={<Package className="w-4 h-4 text-emerald-500" />} tono="text-slate-500 dark:text-neutral-400">
            <span className="text-[0.75rem]">Productos del servicio: alcanzan</span>
          </Fila>
        )}

        {/* Gustos: aunque el salón no tenga Lounge */}
        {c.gustos.length > 0 && (
          <Fila icono="💜">
            <div className="flex flex-wrap gap-1.5">
              {c.gustos.map((g, i) => (
                <span key={i} title={g.descripcion}
                  className={`px-2 py-0.5 rounded-full text-[0.75rem] ${g.falta ? 'bg-violet-500/15 text-violet-800 dark:text-violet-300 font-semibold' : 'bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-200'}`}>
                  {EMOJI_GUSTO[g.tipo] ?? '•'} {g.valor}{g.notas ? ` (${g.notas})` : ''}
                  {g.falta === 'sin_producto' && ' · no lo tienes'}
                  {g.falta === 'se_acabo' && ' · se acabó en esta sede'}
                </span>
              ))}
              {c.gustos.some((g) => g.falta) && <Enlace onClick={onInventario}>Inventario</Enlace>}
            </div>
          </Fila>
        )}

        {/* Lo que Lalan sabe de ella */}
        {c.senales.length > 0 && (
          <Fila icono={<Sparkles className="w-4 h-4 text-[var(--primary)]" />}>
            <ul className="space-y-0.5">
              {c.senales.map((s, i) => {
                const viene = s.fechaEvento && s.fechaEvento.slice(0, 10) >= hoy;
                return (
                  <li key={i} className="text-[0.8125rem] text-slate-700 dark:text-neutral-200">
                    {s.emoji} {s.valor}
                    {s.fechaEvento && <b className={`ml-1 text-[0.75rem] ${viene ? 'text-[var(--primary)]' : 'text-slate-400'}`}>· {fechaCorta(s.fechaEvento)}</b>}
                  </li>
                );
              })}
            </ul>
          </Fila>
        )}
      </div>

      <div className="grid grid-cols-3 sm:flex gap-2 pt-1">
        {c.conversationId && <button type="button" onClick={() => onChat(c.conversationId!)} className={BOTON}><MessageCircle className="w-3.5 h-3.5" /> Su chat</button>}
        {c.clientId && <button type="button" onClick={() => onFicha(c.clientId!)} className={BOTON}><UserRound className="w-3.5 h-3.5" /> Su ficha</button>}
        <button type="button" onClick={() => onCita(c.id)} className={BOTON}><CalendarClock className="w-3.5 h-3.5" /> En la agenda</button>
      </div>
    </Aparecer>
  );
};
