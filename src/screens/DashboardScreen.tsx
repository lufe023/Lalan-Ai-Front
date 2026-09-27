import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  CalendarX2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Hourglass,
  Minus,
  MoonStar,
  RefreshCw,
  UserRound,
  UserX,
  Users,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { IOSHeader } from '../components/ui/IOSHeader';
import { IOSSegmentedControl } from '../components/ui/IOSSegmentedControl';
import { PageContent } from '../components/ui/PageContent';
import { InventarioYMargenes } from '../components/metricas/InventarioYMargenes';
import { useMetricas } from '../hooks/useMetricas';
import { Barra, Comparado, PeriodoMetricas, ResumenMetricas } from '../types/metricas';

const PERIODOS: { id: PeriodoMetricas; label: string }[] = [
  { id: 'day', label: 'Hoy' },
  { id: 'week', label: 'Esta semana' },
  { id: 'month', label: 'Este mes' },
];
/** Debajo de esto una cantidad lleva centavos (un costo de RD$ 1.44 no puede decir RD$ 1) */
const MONTO_CON_CENTAVOS = 100;
const SEGUNDOS_POR_MINUTO = 60;
const MINUTOS_POR_HORA = 60;
const MEDIODIA = 12;

// ── Formatos ─────────────────────────────────────────────────────────────

function formateadorDeDinero(moneda: string) {
  const entero = new Intl.NumberFormat('es-DO', { style: 'currency', currency: moneda, maximumFractionDigits: 0 });
  const conCentavos = new Intl.NumberFormat('es-DO', { style: 'currency', currency: moneda, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (v: number) => (Math.abs(v) < MONTO_CON_CENTAVOS && !Number.isInteger(v) ? conCentavos : entero).format(v || 0);
}
const horaCorta = (h: number) => `${h % MEDIODIA || MEDIODIA}${h < MEDIODIA ? 'a' : 'p'}`;
function duracion(minutos: number) {
  const h = Math.floor(minutos / MINUTOS_POR_HORA);
  const m = Math.round(minutos % MINUTOS_POR_HORA);
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}
function espera(segundos: number | null) {
  if (segundos === null) return '—';
  return segundos < SEGUNDOS_POR_MINUTO ? `${segundos} s` : `${Math.round(segundos / SEGUNDOS_POR_MINUTO)} min`;
}
const plural = (n: number, uno: string, varios: string) => `${n.toLocaleString('es-DO')} ${n === 1 ? uno : varios}`;

// ── Piezas ───────────────────────────────────────────────────────────────

const Tarjeta: React.FC<{ className?: string; onClick?: () => void; children: React.ReactNode }> = ({ className = '', onClick, children }) => (
  <div
    onClick={onClick}
    className={`p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs ${
      onClick ? 'cursor-pointer ios-touch hover:border-slate-300 dark:hover:border-neutral-700 transition' : ''
    } ${className}`}
  >
    {children}
  </div>
);

const Titulo: React.FC<{ icono?: React.ReactNode; texto: string; nota?: React.ReactNode }> = ({ icono, texto, nota }) => (
  <div className="flex items-center justify-between gap-2 mb-3">
    <div className="flex items-center gap-1.5 min-w-0">
      {icono}
      <h3 className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{texto}</h3>
    </div>
    {nota && <span className="text-[10px] text-slate-400 shrink-0">{nota}</span>}
  </div>
);

/** Sube, baja o no hay con qué comparar. Nunca un "+0 %" inventado. */
const Variacion: React.FC<{ c: Comparado; contra: string }> = ({ c, contra }) => {
  if (c.variacion === null) {
    return <span className="text-[10px] text-slate-400" title={`No hubo nada ${contra} con qué comparar`}>Sin datos de {contra}</span>;
  }
  const sube = c.variacion > 0;
  const igual = c.variacion === 0;
  const Icono = igual ? Minus : sube ? ArrowUpRight : ArrowDownRight;
  const color = igual ? 'text-slate-500' : sube ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400';
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${color}`} title={`Antes: ${c.anterior.toLocaleString('es-DO')}`}>
      <Icono className="w-3.5 h-3.5" />
      {sube ? '+' : ''}{c.variacion}%
      <span className="text-slate-400 font-normal text-[10px] ml-0.5">vs. {contra}</span>
    </span>
  );
};

const Kpi: React.FC<{ titulo: string; valor: string; comparado?: Comparado; contra: string; pie?: React.ReactNode; delay?: number }> = ({
  titulo, valor, comparado, contra, pie, delay = 0,
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs flex flex-col gap-1.5 min-w-0"
  >
    <span className="text-[11px] font-semibold text-slate-500 dark:text-neutral-400">{titulo}</span>
    <span className="text-2xl lg:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight tabular-nums truncate">{valor}</span>
    {comparado && <Variacion c={comparado} contra={contra} />}
    {pie && <div className="text-[10px] text-slate-500 dark:text-neutral-400 leading-snug">{pie}</div>}
  </motion.div>
);

/** Un dato suelto dentro de una tarjeta */
const Dato: React.FC<{ etiqueta: string; valor: React.ReactNode; detalle?: React.ReactNode; icono?: React.ReactNode; tono?: 'normal' | 'bien' | 'aviso' | 'mal' }> = ({
  etiqueta, valor, detalle, icono, tono = 'normal',
}) => {
  const color = {
    normal: 'text-slate-900 dark:text-white',
    bien: 'text-emerald-600 dark:text-emerald-400',
    aviso: 'text-amber-600 dark:text-amber-400',
    mal: 'text-red-600 dark:text-red-400',
  }[tono];
  return (
    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 min-w-0">
      <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-neutral-400">
        {icono}
        <span className="truncate">{etiqueta}</span>
      </div>
      <div className={`text-base font-extrabold tabular-nums mt-0.5 ${color}`}>{valor}</div>
      {detalle && <div className="text-[10px] text-slate-400 dark:text-neutral-500 leading-snug mt-0.5">{detalle}</div>}
    </div>
  );
};

/**
 * Barras horizontales medidas contra la MAYOR de la lista: la que más tiene
 * llena la fila y las demás se ven en proporción (2 citas contra 1 se ve
 * el doble, no igual). Un solo color: aquí el color no distingue nada, la
 * etiqueta dice qué es cada barra.
 */
const Barras: React.FC<{
  filas: Barra[];
  valor: (b: Barra) => string;
  vacio: string;
  icono?: (b: Barra) => React.ReactNode;
  onClick?: (b: Barra) => void;
}> = ({ filas, valor, vacio, icono, onClick }) => {
  if (!filas.length) return <p className="text-[11px] text-slate-400 dark:text-neutral-500 text-center py-4">{vacio}</p>;
  const mayor = Math.max(...filas.map(f => f.citas), 1);
  return (
    <div className="space-y-2.5">
      {filas.map((f, i) => (
        <div
          key={f.clave}
          className={onClick ? 'cursor-pointer group' : ''}
          onClick={onClick ? () => onClick(f) : undefined}
          title={`${f.nombre}: ${valor(f)} · ${f.porcentaje}% del total`}
        >
          <div className="flex items-center justify-between gap-2 text-xs mb-1">
            <span className="flex items-center gap-1.5 min-w-0 font-medium text-slate-800 dark:text-slate-200">
              {icono?.(f)}
              <span className="truncate group-hover:underline">{f.nombre}</span>
            </span>
            <span className="shrink-0 text-[11px] text-slate-500 dark:text-neutral-400 tabular-nums">{valor(f)}</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-neutral-800 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${(f.citas / mayor) * 100}%` }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="h-full rounded-full bg-[var(--primary)]"
            />
          </div>
        </div>
      ))}
    </div>
  );
};

/** Columnas por hora o por día. La más alta va en color lleno; el resto, el mismo color más suave. */
const Columnas: React.FC<{ columnas: { clave: string; etiqueta: string; citas: number; ayuda: string }[] }> = ({ columnas }) => {
  const mayor = Math.max(...columnas.map(c => c.citas), 0);
  if (!mayor) return <p className="text-[11px] text-slate-400 dark:text-neutral-500 text-center py-6">Sin citas en este período</p>;
  return (
    <div className="flex items-end gap-1.5 h-32">
      {columnas.map((c, i) => {
        const pico = c.citas === mayor;
        return (
          <div key={c.clave} className="flex-1 min-w-0 h-full flex flex-col items-center justify-end gap-1" title={c.ayuda}>
            <span className={`text-[10px] tabular-nums ${c.citas ? 'text-slate-600 dark:text-neutral-300 font-semibold' : 'text-transparent'}`}>
              {c.citas || 0}
            </span>
            <div className="w-full flex-1 flex items-end">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: c.citas ? `${Math.max((c.citas / mayor) * 100, 6)}%` : '2px' }}
                transition={{ duration: 0.45, delay: i * 0.03 }}
                className={`w-full rounded-t-md ${
                  c.citas === 0 ? 'bg-slate-200 dark:bg-neutral-700' : pico ? 'bg-[var(--primary)]' : 'bg-[var(--primary)] opacity-40'
                }`}
              />
            </div>
            <span className="text-[10px] text-slate-500 dark:text-neutral-400 truncate w-full text-center">{c.etiqueta}</span>
          </div>
        );
      })}
    </div>
  );
};

// ── Pantalla ─────────────────────────────────────────────────────────────

export const DashboardScreen: React.FC = () => {
  const { metricsPeriod, setMetricsPeriod, navigateTo, navigateToCatalog } = useApp();
  const { datos, cargando, error, recargar } = useMetricas(metricsPeriod);

  const [stockAlerts, setStockAlerts] = useState<any[]>([]);
  const [serviceMargins, setServiceMargins] = useState<any[]>([]);
  useEffect(() => {
    api.get<any[]>('/inventory/alerts').then(setStockAlerts).catch(() => {});
    api.get<any[]>('/inventory/margins').then(setServiceMargins).catch(() => {});
  }, []);

  const dinero = useMemo(() => formateadorDeDinero(datos?.moneda ?? 'USD'), [datos?.moneda]);
  const actualizado = datos
    ? new Date(datos.generadoEn).toLocaleTimeString('es', { hour: 'numeric', hour12: true, minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div id="dashboard-screen" className="flex-1 w-full h-full flex flex-col overflow-hidden">
      <IOSHeader
        title="Métricas"
        subtitle={actualizado ? `En vivo · actualizado a las ${actualizado}` : 'Cargando…'}
        rightAction={
          <button
            onClick={() => void recargar()}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-neutral-800 ios-touch"
            title="Actualizar ahora"
          >
            <RefreshCw className={`w-4 h-4 ${cargando ? 'animate-spin' : ''}`} />
          </button>
        }
      />

      <PageContent className="space-y-4 lg:space-y-5">
        <div className="pt-1">
          <IOSSegmentedControl id="metrics-period-selector" options={PERIODOS} value={metricsPeriod} onChange={setMetricsPeriod} size="md" />
        </div>

        {error && !datos && (
          <Tarjeta className="border-red-200 dark:border-red-900/50">
            <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400">
              <AlertTriangle className="w-4 h-4" /> {error}.
              <button className="underline ml-auto" onClick={() => void recargar()}>Reintentar</button>
            </div>
          </Tarjeta>
        )}

        {!datos && cargando && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-slate-100 dark:bg-neutral-800 animate-pulse" />
            ))}
          </div>
        )}

        {datos && <Contenido d={datos} dinero={dinero} navigateTo={navigateTo} />}

        <InventarioYMargenes
          stockAlerts={stockAlerts}
          serviceMargins={serviceMargins}
          navigateToCatalog={navigateToCatalog}
          dinero={dinero}
        />
      </PageContent>
    </div>
  );
};

const Contenido: React.FC<{ d: ResumenMetricas; dinero: (v: number) => string; navigateTo: (s: any) => void }> = ({ d, dinero, navigateTo }) => {
  const contra = d.periodo.comparaCon;
  const { citas, asistente: ia, clientas } = d;
  const variasSemanas = d.periodo.id !== 'day';
  const totalClientas = clientas.nuevas + clientas.recurrentes;

  return (
    <>
      {!!d.monedasSinTasa?.length && (
        <Tarjeta className="border-amber-300 dark:border-amber-800/60">
          <div className="flex items-start gap-2 text-[11px] text-amber-700 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Hay citas con precio en {d.monedasSinTasa.join(', ')} y esa moneda no está en Ajustes → Monedas: esos montos se
              sumaron sin convertir. Agrégala con su tasa y los números se corrigen solos.
            </span>
          </div>
        </Tarjeta>
      )}
      {/* ── Lo principal ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <Kpi
          titulo="Cobrado"
          valor={dinero(d.dinero.cobrado.actual)}
          comparado={d.dinero.cobrado}
          contra={contra}
          pie={
            <>
              {d.dinero.porCobrar > 0
                ? <>Por cobrar: <b className="text-amber-600">{dinero(d.dinero.porCobrar)}</b> en {plural(d.dinero.comandasAbiertas, 'comanda', 'comandas')}</>
                : 'Nada pendiente de cobro'}
              <button onClick={() => navigateTo('ganancias')} className="block mt-1 font-semibold text-[var(--primary)] hover:opacity-70">
                Ver informe →
              </button>
            </>
          }
        />
        <Kpi
          titulo="Citas atendidas"
          valor={citas.atendidas.actual.toLocaleString('es-DO')}
          comparado={citas.atendidas}
          contra={contra}
          delay={0.04}
          pie={<>De {plural(citas.enAgenda, 'cita', 'citas')} en agenda · {citas.porAtender} por atender</>}
        />
        <Kpi
          titulo="Ticket promedio"
          valor={dinero(d.dinero.ticketPromedio.actual)}
          comparado={d.dinero.ticketPromedio}
          contra={contra}
          delay={0.08}
          pie={<>Lo que deja cada cobro · propinas {dinero(d.dinero.propinas)}</>}
        />
        <Kpi
          titulo="Clientas atendidas"
          valor={clientas.atendidas.toLocaleString('es-DO')}
          contra={contra}
          delay={0.12}
          pie={<>{plural(clientas.nuevas, 'nueva', 'nuevas')} · {clientas.recurrentes} volvieron</>}
        />
      </div>

      {/* ── Lo que hizo la asistente ─────────────────────────────────── */}
      <Tarjeta onClick={() => navigateTo('bots')}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white">Lo que hizo {d.agente}</h3>
              <p className="text-[11px] text-slate-500 dark:text-neutral-400 truncate">
                {ia.citasAgendadas.actual
                  ? `Agendó ${plural(ia.citasAgendadas.actual, 'cita', 'citas')}: el ${ia.parteDeLasCitas}% de las que se agendaron`
                  : 'Todavía no agendó citas en este período'}
              </p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Dato
            etiqueta="Citas que agendó"
            valor={ia.citasAgendadas.actual}
            detalle={<Variacion c={ia.citasAgendadas} contra={contra} />}
          />
          <Dato
            etiqueta="Valor de sus citas"
            valor={dinero(ia.montoAtendido)}
            detalle={`ya atendidas · ${dinero(ia.montoPorVenir)} vienen en ${d.dinero.diasPorVenir} días`}
            tono={ia.montoAtendido > 0 ? 'bien' : 'normal'}
          />
          <Dato
            etiqueta="Chats atendidos"
            valor={ia.conversaciones}
            detalle={`${plural(ia.respuestas.actual, 'respuesta', 'respuestas')} · tarda ${espera(ia.segundosEnResponder)}`}
          />
          <Dato
            icono={<MoonStar className="w-3 h-3" />}
            etiqueta="Con el salón cerrado"
            valor={ia.respuestasFueraDeHorario}
            detalle="respuestas fuera de horario"
          />
          <Dato
            icono={<UserRound className="w-3 h-3" />}
            etiqueta="Pasó a una persona"
            valor={ia.pasadasAPersona}
            detalle="la clienta lo pidió o no pudo resolverlo"
            tono={ia.pasadasAPersona ? 'aviso' : 'normal'}
          />
          <Dato
            icono={<AlertTriangle className="w-3 h-3" />}
            etiqueta="No pudo responder"
            valor={ia.fallos}
            detalle={ia.fallos ? 'revisa el saldo o el panel de bots' : 'sin fallos'}
            tono={ia.fallos ? 'mal' : 'bien'}
          />
        </div>
      </Tarjeta>

      {/* ── Asistencia ───────────────────────────────────────────────── */}
      <Tarjeta>
        <Titulo icono={<CalendarX2 className="w-4 h-4 text-[var(--primary)]" />} texto="Asistencia" nota={`Tolerancia según Ajustes`} />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Dato
            icono={<CheckCircle2 className="w-3 h-3" />}
            etiqueta="Llegaron a tiempo"
            valor={citas.llegadas.aTiempo + citas.llegadas.antes}
            detalle={citas.llegadas.antes ? `${citas.llegadas.antes} llegaron antes` : `de ${citas.llegadas.conHora} con hora de llegada`}
            tono="bien"
          />
          <Dato
            icono={<Hourglass className="w-3 h-3" />}
            etiqueta="Llegaron tarde"
            valor={citas.llegadas.tarde}
            detalle={citas.llegadas.tarde ? `${citas.llegadas.promedioMinutosTarde} min tarde en promedio` : 'nadie llegó tarde'}
            tono={citas.llegadas.tarde ? 'aviso' : 'normal'}
          />
          <Dato
            icono={<UserX className="w-3 h-3" />}
            etiqueta="No vinieron"
            valor={citas.noVinieron}
            detalle={`${citas.tasaInasistencia}% de las citas que ya pasaron`}
            tono={citas.noVinieron ? 'mal' : 'normal'}
          />
          <Dato
            icono={<CalendarX2 className="w-3 h-3" />}
            etiqueta="Canceladas"
            valor={citas.canceladas}
            detalle="del período"
          />
        </div>
      </Tarjeta>

      {/* ── Cuándo se llena ──────────────────────────────────────────── */}
      <div className={`grid gap-4 ${variasSemanas ? 'lg:grid-cols-2' : ''}`}>
        <Tarjeta>
          <Titulo
            icono={<Clock className="w-4 h-4 text-[var(--primary)]" />}
            texto="Horas de más movimiento"
            nota="Citas por hora de la cita"
          />
          <Columnas
            columnas={d.porHora.map(h => ({
              clave: String(h.hora),
              etiqueta: horaCorta(h.hora),
              citas: h.citas,
              ayuda: `${plural(h.citas, 'cita', 'citas')} a las ${h.etiqueta}`,
            }))}
          />
        </Tarjeta>
        {variasSemanas && (
          <Tarjeta>
            <Titulo icono={<Clock className="w-4 h-4 text-[var(--primary)]" />} texto="Días de más movimiento" nota="Citas por día" />
            <Columnas
              columnas={d.porDiaSemana.map(x => ({
                clave: String(x.dia),
                etiqueta: x.nombre.slice(0, 3),
                citas: x.citas,
                ayuda: `${plural(x.citas, 'cita', 'citas')} los ${x.nombre}`,
              }))}
            />
          </Tarjeta>
        )}
      </div>

      {/* ── Servicios y equipo ───────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta>
          <Titulo texto="Servicios más pedidos" nota="Citas en agenda" />
          <Barras
            filas={d.servicios}
            valor={b => `${plural(b.citas, 'cita', 'citas')} · ${dinero(b.monto)}`}
            vacio="Sin citas en este período"
          />
        </Tarjeta>
        <Tarjeta>
          <Titulo icono={<Users className="w-4 h-4 text-[var(--primary)]" />} texto="Equipo" nota="Citas atendidas" />
          <Barras
            filas={d.equipo}
            valor={b => `${plural(b.citas, 'cita', 'citas')} · ${duracion((b as any).minutos)} · ${dinero(b.monto)}`}
            vacio="Nadie atendió citas todavía en este período"
          />
        </Tarjeta>
      </div>

      {/* ── Clientas ─────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta>
          <Titulo texto="Clientas" nota={`${totalClientas} atendidas`} />
          {totalClientas > 0 ? (
            <>
              <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5 bg-slate-100 dark:bg-neutral-800">
                {clientas.nuevas > 0 && <div className="h-full bg-[var(--primary)]" style={{ width: `${(clientas.nuevas / totalClientas) * 100}%` }} />}
                {clientas.recurrentes > 0 && <div className="h-full bg-[var(--primary)] opacity-40" style={{ width: `${(clientas.recurrentes / totalClientas) * 100}%` }} />}
              </div>
              <div className="flex gap-4 mt-1.5 text-[10px] text-slate-500 dark:text-neutral-400">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--primary)]" /> Nuevas {clientas.nuevas}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[var(--primary)] opacity-40" /> Volvieron {clientas.recurrentes}</span>
              </div>
            </>
          ) : (
            <p className="text-[11px] text-slate-400 text-center py-2">Sin clientas atendidas en este período</p>
          )}
          <div className="mt-4">
            <p className="text-[11px] font-semibold text-slate-700 dark:text-neutral-300 mb-1.5">Las que más dejaron en caja</p>
            {clientas.mejores.length ? (
              <ul className="divide-y divide-slate-100 dark:divide-neutral-800">
                {clientas.mejores.map((c, i) => (
                  <li key={c.id} className="flex items-center justify-between py-1.5 text-xs">
                    <span className="flex items-center gap-2 min-w-0">
                      <span className="w-4 text-[10px] text-slate-400 tabular-nums">{i + 1}</span>
                      <span className="truncate text-slate-800 dark:text-slate-200">{c.nombre}</span>
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-900 dark:text-white">{dinero(c.monto)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-slate-400">Aparecen cuando se cobra a clientas con ficha.</p>
            )}
          </div>
        </Tarjeta>

        <Tarjeta>
          <Titulo
            icono={<UserX className="w-4 h-4 text-amber-500" />}
            texto="Clientas que se están perdiendo"
            nota={`Más de ${clientas.enRiesgo.diasSinVenir} días sin venir`}
          />
          {clientas.enRiesgo.total ? (
            <>
              <p className="text-[11px] text-slate-500 dark:text-neutral-400 mb-2">
                {plural(clientas.enRiesgo.total, 'clienta venía', 'clientas venían')} y no ha{clientas.enRiesgo.total === 1 ? '' : 'n'} vuelto ni tiene{clientas.enRiesgo.total === 1 ? '' : 'n'} cita. Un mensaje a tiempo las recupera.
              </p>
              <ul className="divide-y divide-slate-100 dark:divide-neutral-800">
                {clientas.enRiesgo.lista.map(c => (
                  <li key={c.id} className="flex items-center justify-between py-1.5 text-xs">
                    <span className="truncate text-slate-800 dark:text-slate-200">{c.nombre}</span>
                    <span className="shrink-0 text-[11px] text-slate-500 tabular-nums">
                      hace {c.dias} días · {plural(c.visitas, 'visita', 'visitas')}
                    </span>
                  </li>
                ))}
              </ul>
              <button onClick={() => navigateTo('clients')} className="mt-2 text-[11px] font-semibold text-[var(--primary)] hover:opacity-70">
                Ir a clientas →
              </button>
            </>
          ) : (
            <p className="text-[11px] text-slate-400 py-2">Ninguna: todas tus clientas habituales han vuelto o tienen cita.</p>
          )}
        </Tarjeta>
      </div>

      {/* ── Quién agendó y qué se vendió ─────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta>
          <Titulo texto="Quién agendó las citas" nota="Citas creadas en el período" />
          <Barras
            filas={d.quienAgendo}
            valor={b => `${plural(b.citas, 'cita', 'citas')} · ${b.porcentaje}%`}
            icono={b => ((b as any).esAsistente ? <Bot className="w-3.5 h-3.5 text-[var(--primary)]" /> : <UserRound className="w-3.5 h-3.5 text-slate-400" />)}
            vacio="No se agendaron citas en este período"
          />
        </Tarjeta>
        <Tarjeta>
          <Titulo texto="Lo más vendido en caja" nota="Productos cobrados" />
          <Barras
            filas={d.productos}
            valor={b => `${b.citas.toLocaleString('es-DO')} u. · ${dinero(b.monto)}`}
            vacio="Sin productos vendidos en este período"
          />
        </Tarjeta>
      </div>
    </>
  );
};
