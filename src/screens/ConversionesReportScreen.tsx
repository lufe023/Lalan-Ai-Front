import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  MessagesSquare, CalendarCheck2, ShoppingBag, HelpCircle, Hourglass, Bot, Store, ChevronRight, TrendingUp,
} from 'lucide-react';
import { Aparecer, NumeroAnimado } from '../components/ui/movimiento';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { IOSHeader } from '../components/ui/IOSHeader';
import { PageContent } from '../components/ui/PageContent';
import { CascadingRibbonCalendar, CalendarGranularity, MonthWeek } from '../components/ui/CascadingRibbonCalendar';
import { SelectorSede } from '../components/ui/SelectorSede';
import { useSedes } from '../hooks/useSedes';
import { useDinero } from '../hooks/useDinero';

type Resultado = 'cita' | 'compra' | 'cita_y_compra' | 'informacion';
interface Conteo { total: number; clienta: number; lalan: number; equipo: number }
interface Conversacion {
  conversationId: string; cliente: string; canal: string | null; sedeId: string | null; sede: string | null;
  inicio: string; fin: string; mensajes: Conteo; resultado: Resultado;
  citas: { id: string; servicio: string; startsAt: string; estado: string }[];
  valorCitas: number; compras: number; pedidosPorChat: number; montoCompras: number;
  mensajesAntesDeCita: Conteo | null;
}
interface Grupo {
  clave: string; nombre: string; conversaciones: number; convertidas: number; soloInformacion: number;
  tasaConversion: number | null; citas: number; compras: number; mensajesDeLalan: number; promedioAntesDeCita: number | null;
}
interface Informe {
  moneda: { codigo: string; simbolo: string };
  reglas: { horasDeSilencioParaCortar: number; diasParaContarCompra: number };
  conversiones: {
    conversaciones: number; convertidas: number; tasaConversion: number | null; soloInformacion: number;
    soloCita: number; soloCompra: number; citaYCompra: number; conCita: number; conCompra: number;
    tasaCita: number | null; tasaCompra: number | null; citas: number; compras: number; valorCitas: number; montoCompras: number;
  };
  mensajes: {
    total: number; deClientas: number; deLalan: number; delEquipo: number;
    promedioPorConversacion: number | null; promedioConvertidas: number | null; promedioSoloInformacion: number | null;
    deLalanEnConvertidas: number; deLalanEnSoloInformacion: number; deLalanPorConversion: number | null;
  };
  antesDeConvertir: {
    conversiones: number; promedio: number | null; mediana: number | null; minimo: number | null; maximo: number | null;
    promedioDeLaClienta: number | null; promedioDeLalan: number | null; porTramo: { tramo: string; conversiones: number }[];
  };
  porCanal: Grupo[]; porSede: Grupo[]; conversaciones: Conversacion[]; hayMas: boolean;
}

const NOMBRE_CANAL: Record<string, string> = { whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger' };
const RESULTADO: Record<Resultado, { texto: string; clase: string }> = {
  cita: { texto: 'Agendó', clase: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  compra: { texto: 'Compró', clase: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  cita_y_compra: { texto: 'Agendó y compró', clase: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
  informacion: { texto: 'Solo información', clase: 'bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300' },
};
const FILTROS = [
  { id: 'todas', texto: 'Todas' },
  { id: 'convirtieron', texto: 'Convirtieron' },
  { id: 'informacion', texto: 'Solo información' },
] as const;
type Filtro = (typeof FILTROS)[number]['id'];

const fecha = (iso: string) =>
  new Date(iso).toLocaleString('es-DO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const n = (v: number | null | undefined) => (v == null ? '—' : String(v));

/** Cada bloque sube suave al asomarse, como en el Informe de citas */
const Tarjeta: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <Aparecer className={`bg-white dark:bg-neutral-900 rounded-2xl border border-slate-200 dark:border-neutral-800 ${className}`}>
    {children}
  </Aparecer>
);

const Titulo: React.FC<{ icono: React.ReactNode; children: React.ReactNode }> = ({ icono, children }) => (
  <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-100 dark:border-neutral-800">
    {icono}
    <span className="text-xs font-bold text-slate-900 dark:text-white">{children}</span>
  </div>
);

const Cifra: React.FC<{ etiqueta: string; valor: React.ReactNode; nota?: string; clase?: string }> = ({ etiqueta, valor, nota, clase = '' }) => (
  <div>
    <div className="text-[0.6875rem] text-slate-400 font-medium">{etiqueta}</div>
    <div className={`text-sm font-bold tabular-nums ${clase || 'text-slate-800 dark:text-neutral-200'}`}>{valor}</div>
    {nota && <div className="text-[0.6875rem] text-slate-400">{nota}</div>}
  </div>
);

/**
 * Informe de conversiones: de las conversaciones del chat, quién agenda o
 * compra y quién solo pregunta. Los planes se cobran por mensajes de Lalán,
 * así que las conversiones y los mensajes van en bloques separados.
 */
export const ConversionesReportScreen: React.FC = () => {
  const { goBack, abrirConversacion, loadCurrencies } = useApp();
  const { dinero } = useDinero();
  const [informe, setInforme] = useState<Informe | null>(null);
  const [cargando, setCargando] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const drillDownOccurred = useRef(false);
  const diaElegido = useRef(false);

  // Por defecto, el mes en curso: con un solo día casi no hay conversaciones que comparar
  const [rangeStart, setRangeStart] = useState<Date>(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [rangeEnd, setRangeEnd] = useState<Date>(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999); });

  useEffect(() => { void loadCurrencies?.(); }, []);

  // '' = toda la cadena; con sede, solo sus chats
  const sedes = useSedes();
  const [sede, setSede] = useState('');
  const deSede = sede ? `&sede=${encodeURIComponent(sede)}` : '';
  const variasSedes = sedes.length > 1;

  useEffect(() => {
    if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) return;
    let cancelado = false;
    setCargando(true);
    api.get<Informe>(`/reports/conversiones?desde=${rangeStart.toISOString()}&hasta=${rangeEnd.toISOString()}${deSede}`)
      .then(r => { if (!cancelado) setInforme(r); })
      .catch(() => { if (!cancelado) setInforme(null); })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [rangeStart, rangeEnd, deSede]);

  const handleRangeChange = useCallback(({
    granularity: g, year, monthIndex, week, date,
  }: { granularity: CalendarGranularity; year: number; monthIndex: number; week?: MonthWeek; date: Date; dateStr: string }) => {
    const veniaDeDrill = drillDownOccurred.current;
    drillDownOccurred.current = false;
    let start: Date, end: Date;
    if (g === 'days') {
      const eligioDia = diaElegido.current;
      diaElegido.current = false;
      if (!eligioDia && veniaDeDrill && week) {
        start = new Date(week.startDate); start.setHours(0, 0, 0, 0);
        end = new Date(week.endDate); end.setHours(23, 59, 59, 999);
      } else {
        start = new Date(date); start.setHours(0, 0, 0, 0);
        end = new Date(date); end.setHours(23, 59, 59, 999);
      }
    } else if (g === 'weeks' && week) {
      start = new Date(week.startDate); start.setHours(0, 0, 0, 0);
      end = new Date(week.endDate); end.setHours(23, 59, 59, 999);
    } else if (g === 'months') {
      start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
      end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
    } else {
      start = new Date(year, 0, 1, 0, 0, 0, 0);
      end = new Date(year, 11, 31, 23, 59, 59, 999);
    }
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return;
    setRangeStart(start);
    setRangeEnd(end);
  }, []);

  const plata = (v: number) => dinero(v, informe?.moneda.codigo);
  const c = informe?.conversiones;
  const m = informe?.mensajes;
  const antes = informe?.antesDeConvertir;
  const total = c?.conversaciones ?? 0;
  const ancho = (parte: number) => `${total ? (parte / total) * 100 : 0}%`;
  const maxTramo = Math.max(1, ...(antes?.porTramo ?? []).map(t => t.conversiones));
  const lista = (informe?.conversaciones ?? []).filter(x =>
    filtro === 'todas' ? true : filtro === 'informacion' ? x.resultado === 'informacion' : x.resultado !== 'informacion');

  const grupos = (titulo: string, icono: React.ReactNode, filas: Grupo[]) => !!filas.length && (
    <Tarjeta className="overflow-hidden mb-4">
      <Titulo icono={icono}>{titulo}</Titulo>
      {filas.map(g => (
        <div key={g.clave} className="px-4 py-3 border-b border-slate-50 dark:border-neutral-800/50 last:border-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{NOMBRE_CANAL[g.clave] ?? g.nombre}</span>
            <span className="text-xs font-bold text-slate-900 dark:text-white tabular-nums shrink-0">
              {g.convertidas} de {g.conversaciones}
              <span className="text-[0.6875rem] text-slate-400 font-normal ml-1">({n(g.tasaConversion)} %)</span>
            </span>
          </div>
          <div className="h-1.5 bg-slate-100 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${g.tasaConversion ?? 0}%` }} />
          </div>
          <p className="text-[0.6875rem] text-slate-400 mt-1">
            {g.citas} cita{g.citas === 1 ? '' : 's'} · {g.compras} compra{g.compras === 1 ? '' : 's'} · {g.soloInformacion} solo información
            {` · ${g.mensajesDeLalan} mensajes de Lalán`}
            {g.promedioAntesDeCita != null && ` · ${g.promedioAntesDeCita} mensajes antes de la cita`}
          </p>
        </div>
      ))}
    </Tarjeta>
  );

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-neutral-950">
      <IOSHeader title="Informe de conversiones" onBack={goBack} />
      <PageContent>
        {/* Varias sedes: los chats de una o de toda la cadena */}
        {variasSedes && (
          <div className="flex justify-end mb-3">
            <SelectorSede sedes={sedes} value={sede} onChange={setSede} todas />
          </div>
        )}

        <CascadingRibbonCalendar
          events={[]}
          initialGranularity="months"
          conConteo={false}
          onGranularityChange={() => { drillDownOccurred.current = true; }}
          onSelectDate={() => { diaElegido.current = true; }}
          onRangeChange={handleRangeChange}
        />

        {/* Conversiones: quién agenda o compra y quién solo pregunta */}
        <Tarjeta className="p-4 mt-3 mb-4">
          <div className="flex items-start justify-between mb-3 gap-3">
            <div>
              <p className="text-[0.75rem] font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wider mb-1">
                Conversaciones que convirtieron
              </p>
              <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums">
                <NumeroAnimado valor={c?.convertidas ?? 0} />
                <span className="text-base font-semibold text-slate-400"> de {total}</span>
              </div>
            </div>
            {c?.tasaConversion != null && (
              <span className="px-2.5 py-1 rounded-full text-[0.75rem] font-bold flex items-center gap-1 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 shrink-0">
                <TrendingUp className="w-3 h-3" />
                {c.tasaConversion} %
              </span>
            )}
          </div>

          {/* Una barra: agendó, compró, las dos, solo preguntó */}
          <div className="h-2.5 flex rounded-full overflow-hidden bg-slate-100 dark:bg-neutral-800 mb-3">
            <div className="bg-emerald-500 transition-all duration-500" style={{ width: ancho(c?.soloCita ?? 0) }} />
            <div className="bg-violet-500 transition-all duration-500" style={{ width: ancho(c?.citaYCompra ?? 0) }} />
            <div className="bg-sky-500 transition-all duration-500" style={{ width: ancho(c?.soloCompra ?? 0) }} />
          </div>

          <div className="flex flex-wrap gap-x-3 gap-y-1 mb-3 text-[0.6875rem] text-slate-500 dark:text-neutral-400">
            {[['bg-emerald-500', 'Agendó'], ['bg-violet-500', 'Agendó y compró'], ['bg-sky-500', 'Compró'], ['bg-slate-200 dark:bg-neutral-700', 'Solo información']].map(([color, texto]) => (
              <span key={texto} className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${color}`} />{texto}</span>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-neutral-800 text-center">
            <Cifra etiqueta="Agendaron" valor={c?.conCita ?? 0} nota={`${c?.citas ?? 0} citas · ${plata(c?.valorCitas ?? 0)}`} clase="text-emerald-600 dark:text-emerald-400" />
            <Cifra etiqueta="Compraron" valor={c?.conCompra ?? 0} nota={plata(c?.montoCompras ?? 0)} clase="text-sky-600 dark:text-sky-400" />
            <Cifra etiqueta="Solo información" valor={c?.soloInformacion ?? 0} nota={total ? `${Math.round(((c?.soloInformacion ?? 0) / total) * 100)} %` : undefined} />
          </div>
          {!!c?.citaYCompra && (
            <p className="text-[0.6875rem] text-slate-400 mt-2 text-center">{c.citaYCompra} agendaron y además compraron</p>
          )}
        </Tarjeta>

        {/* Cuántos mensajes hacen falta antes de la cita */}
        {!!antes?.conversiones && (
          <Tarjeta className="overflow-hidden mb-4">
            <Titulo icono={<Hourglass className="w-4 h-4 text-amber-500" />}>Mensajes antes de agendar</Titulo>
            <div className="p-4">
              <div className="grid grid-cols-3 gap-2 text-center mb-4">
                <Cifra etiqueta="Promedio" valor={n(antes.promedio)} />
                <Cifra etiqueta="Lo normal" valor={n(antes.mediana)} nota="la mitad tarda menos" />
                <Cifra etiqueta="Rango" valor={`${n(antes.minimo)}–${n(antes.maximo)}`} />
              </div>
              <div className="space-y-2">
                {antes.porTramo.map(t => (
                  <div key={t.tramo} className="flex items-center gap-2">
                    <span className="w-12 text-[0.75rem] font-semibold text-slate-500 tabular-nums">{t.tramo}</span>
                    <div className="flex-1 h-2 bg-slate-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-amber-500 transition-all duration-500" style={{ width: `${(t.conversiones / maxTramo) * 100}%` }} />
                    </div>
                    <span className="w-8 text-right text-[0.75rem] text-slate-400 tabular-nums">{t.conversiones}</span>
                  </div>
                ))}
              </div>
              <p className="text-[0.6875rem] text-slate-400 mt-3 leading-relaxed">
                De esos, la clienta escribe {n(antes.promedioDeLaClienta)} y Lalán responde {n(antes.promedioDeLalan)} en promedio
                hasta que queda la cita. Medido en {antes.conversiones} {antes.conversiones === 1 ? 'conversación que agendó' : 'conversaciones que agendaron'}.
              </p>
            </div>
          </Tarjeta>
        )}

        {/* Lo que costó en mensajes: va aparte de las conversiones */}
        {!!m?.total && (
          <Tarjeta className="overflow-hidden mb-4">
            <Titulo icono={<MessagesSquare className="w-4 h-4 text-[var(--primary)]" />}>Mensajes</Titulo>
            <div className="p-4">
              <div className="grid grid-cols-3 gap-2 text-center mb-3">
                <Cifra etiqueta="De Lalán" valor={m.deLalan} nota="los que cuenta tu plan" clase="text-purple-600 dark:text-purple-400" />
                <Cifra etiqueta="De clientas" valor={m.deClientas} />
                <Cifra etiqueta="Del equipo" valor={m.delEquipo} />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 dark:border-neutral-800">
                <Cifra etiqueta="Por conversación que convirtió" valor={n(m.promedioConvertidas)} nota={`${m.deLalanEnConvertidas} de Lalán en total`} />
                <Cifra etiqueta="Por conversación de solo información" valor={n(m.promedioSoloInformacion)} nota={`${m.deLalanEnSoloInformacion} de Lalán en total`} />
              </div>
              {m.deLalanPorConversion != null && (
                <p className="text-[0.6875rem] text-slate-400 mt-3 leading-relaxed">
                  Cada conversión te costó <strong>{m.deLalanPorConversion} mensajes de Lalán</strong>, contando también
                  los que gastó con quien solo preguntó.
                </p>
              )}
            </div>
          </Tarjeta>
        )}

        {grupos('Por canal', <Bot className="w-4 h-4 text-purple-500" />, informe?.porCanal ?? [])}
        {variasSedes && !sede && grupos('Por sede', <Store className="w-4 h-4 text-[var(--primary)]" />, informe?.porSede ?? [])}

        {/* Quién es quién */}
        {!!total && (
          <Tarjeta className="overflow-hidden mb-4">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 dark:border-neutral-800">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-sky-500" /> Conversaciones
              </span>
              <div className="flex gap-1 p-0.5 rounded-xl bg-slate-100 dark:bg-neutral-800">
                {FILTROS.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFiltro(f.id)}
                    className={`px-2.5 py-1 rounded-lg text-[0.6875rem] font-bold transition ${
                      filtro === f.id ? 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-white shadow-2xs' : 'text-slate-500 dark:text-neutral-400'
                    }`}
                  >
                    {f.texto}
                  </button>
                ))}
              </div>
            </div>
            {lista.map(x => (
              <button
                key={`${x.conversationId}-${x.inicio}`}
                onClick={() => abrirConversacion(x.conversationId)}
                className="w-full text-left px-4 py-3 border-b border-slate-50 dark:border-neutral-800/50 last:border-0 hover:bg-slate-50 dark:hover:bg-neutral-800/40 transition flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">{x.cliente}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[0.6875rem] font-bold ${RESULTADO[x.resultado].clase}`}>
                      {RESULTADO[x.resultado].texto}
                    </span>
                    {variasSedes && !sede && x.sede && (
                      <span className="px-2 py-0.5 rounded-full text-[0.6875rem] font-semibold bg-[var(--primary)]/10 text-[var(--primary)]">{x.sede}</span>
                    )}
                  </div>
                  <p className="text-[0.6875rem] text-slate-400 mt-0.5">
                    {x.canal ? `${NOMBRE_CANAL[x.canal] ?? x.canal} · ` : ''}{fecha(x.inicio)}
                    {` · ${x.mensajes.total} mensajes (${x.mensajes.lalan} de Lalán)`}
                  </p>
                  {(!!x.citas.length || x.compras > 0) && (
                    <p className="text-[0.6875rem] text-slate-500 dark:text-neutral-400 mt-0.5 flex items-center gap-1 flex-wrap">
                      {!!x.citas.length && (
                        <span className="flex items-center gap-1">
                          <CalendarCheck2 className="w-3 h-3 text-emerald-500" />
                          {x.citas.map(ci => ci.servicio).join(', ')}
                          {x.mensajesAntesDeCita && ` · a los ${x.mensajesAntesDeCita.total} mensajes`}
                        </span>
                      )}
                      {x.compras > 0 && (
                        <span className="flex items-center gap-1">
                          <ShoppingBag className="w-3 h-3 text-sky-500" />
                          {x.montoCompras > 0 ? plata(x.montoCompras) : `${x.pedidosPorChat} pedido${x.pedidosPorChat === 1 ? '' : 's'} por el chat`}
                        </span>
                      )}
                    </p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
              </button>
            ))}
            {!lista.length && <p className="px-4 py-6 text-center text-xs text-slate-400">Nada en este filtro.</p>}
            {informe?.hayMas && (
              <p className="px-4 py-2 text-[0.6875rem] text-slate-400 text-center">Se enseñan las 500 más recientes; las cuentas de arriba usan todas.</p>
            )}
          </Tarjeta>
        )}

        {!cargando && !total && (
          <Tarjeta className="p-8 text-center">
            <MessagesSquare className="w-10 h-10 mx-auto text-slate-300 dark:text-neutral-600 mb-2" />
            <p className="text-xs text-slate-400">Sin conversaciones en este período.</p>
          </Tarjeta>
        )}

        <div className="p-3 rounded-2xl bg-slate-100/60 dark:bg-neutral-900/60 mb-4">
          <p className="text-[0.6875rem] text-slate-400 leading-relaxed flex items-start gap-1.5">
            <TrendingUp className="w-3 h-3 mt-0.5 shrink-0" />
            <span>
              Una conversación termina cuando pasan {informe?.reglas.horasDeSilencioParaCortar ?? 24} horas sin mensajes. Cuenta como
              compra lo que se le cobró a esa clienta en la misma sede hasta {informe?.reglas.diasParaContarCompra ?? 7} días
              después (sin el cobro de una cita) o un pedido que llegó por el chat. Las reservas de la Vitrina no cuentan aquí.
            </span>
          </p>
        </div>
      </PageContent>
    </div>
  );
};
