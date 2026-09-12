import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Receipt, Printer, UserPlus, Search, RotateCcw, Users,
  Wallet, LockOpen, Lock, ArrowDownLeft, ArrowUpRight, Plus,
  ClipboardList, Clock,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { api } from '../services/api';
import { PosPanel } from '../components/pos/PosPanel';
import { IOSHeader } from '../components/ui/IOSHeader';
import { PageContent } from '../components/ui/PageContent';
import { imprimirRecibo } from '../utils/recibo';

/**
 * Caja — el punto de venta, fuera del Lounge.
 *
 * El POS vivía dentro de "Lounge", detrás de un icono de música. Nadie busca
 * la caja ahí. Aquí tiene su propia entrada y su propio nombre, y además
 * espacio para lo que no cabía: elegir a quién le cobras y reimprimir.
 */
export const CajaScreen: React.FC = () => {
  const {
    clients, settings, showToast,
    activeLoungeClient, setActiveLoungeClient,
    activeSale, openFolios, loadOpenFolios, selectFolio, newCounterFolio,
    baseCurrency, loadCurrencies,
  } = useApp();

  const [vista, setVista] = useState<'cobrar' | 'comandas' | 'recibos' | 'turno'>('cobrar');
  const [turno, setTurno] = useState<any>(null);
  const [historial, setHistorial] = useState<any[]>([]);
  const [fondo, setFondo] = useState('');
  const [conteo, setConteo] = useState<Record<string, string>>({});
  const [notaCierre, setNotaCierre] = useState('');
  const [mov, setMov] = useState({ kind: 'out' as 'in' | 'out', amount: '', reason: '' });
  const [ocupado, setOcupado] = useState(false);
  const [recibos, setRecibos] = useState<any[]>([]);
  const [cargando, setCargando] = useState(false);
  const [busca, setBusca] = useState('');
  const [eligiendoClienta, setEligiendoClienta] = useState(false);

  const sim = baseCurrency?.symbol ?? '';
  const plata = (n: any) => `${Number(n ?? 0).toFixed(2)}${sim ? ` ${sim}` : ''}`;

  useEffect(() => { void loadCurrencies?.(); void loadOpenFolios?.(); }, []);

  const cargarRecibos = useCallback(async () => {
    setCargando(true);
    try {
      setRecibos(await api.get<any[]>('/sales?status=paid&limit=100') ?? []);
    } catch {
      setRecibos([]);
    } finally { setCargando(false); }
  }, []);

  useEffect(() => { if (vista === 'recibos') void cargarRecibos(); }, [vista, cargarRecibos]);

  const reimprimir = useCallback((venta: any) => {
    imprimirRecibo(venta, {
      anchoMm: Number((settings as any)?.receiptWidthMm) || 80,
      salon: (settings as any)?.salonName ?? 'Lalan AI Studio & Lounge',
      direccion: (settings as any)?.address ?? '',
      telefono: (settings as any)?.phone ?? '',
      pie: (settings as any)?.receiptFooter ?? '¡Gracias por tu visita!',
      simbolo: sim,
      // Marcado como copia: un recibo reimpreso no debe confundirse con el
      // original a la hora de cuadrar la caja.
      copia: true,
    });
  }, [settings, sim]);

  // ── Turno de caja ─────────────────────────────────────────────────────
  const cargarTurno = useCallback(async () => {
    try { setTurno(await api.get<any>('/cash/current')); }
    catch { setTurno(null); }
  }, []);

  const cargarHistorial = useCallback(async () => {
    try { setHistorial(await api.get<any[]>('/cash/history?limit=40') ?? []); }
    catch { setHistorial([]); }
  }, []);

  useEffect(() => {
    if (vista !== 'turno') return;
    void cargarTurno();
    void cargarHistorial();
  }, [vista, cargarTurno, cargarHistorial]);

  const abrirCaja = useCallback(async () => {
    setOcupado(true);
    try {
      setTurno(await api.post<any>('/cash/open', { openingFloat: Number(fondo) || 0 }));
      setFondo('');
      showToast('Caja abierta', 'Ya puedes cobrar con arqueo.', 'success');
    } catch (e: any) {
      showToast('No se pudo abrir', e?.message ?? '', 'warning');
    } finally { setOcupado(false); }
  }, [fondo, showToast]);

  const registrarMovimiento = useCallback(async () => {
    if (!Number(mov.amount) || !mov.reason.trim()) return;
    setOcupado(true);
    try {
      setTurno(await api.post<any>('/cash/movements', {
        kind: mov.kind, amount: Number(mov.amount), reason: mov.reason.trim(),
      }));
      setMov({ kind: 'out', amount: '', reason: '' });
    } catch (e: any) {
      showToast('No se pudo registrar', e?.message ?? '', 'warning');
    } finally { setOcupado(false); }
  }, [mov, showToast]);

  /** Lo contado billete por billete, en vivo mientras se escribe */
  const contado = useMemo(() => {
    const denoms = baseCurrency?.denominations ?? [];
    return denoms.reduce(
      (s, d) => s + Number(d.value) * (Number(conteo[d.id]) || 0), 0,
    );
  }, [conteo, baseCurrency]);

  const esperado = Number(turno?.resumen?.expectedCash ?? 0);
  const diferencia = contado - esperado;

  const cerrarCaja = useCallback(async () => {
    setOcupado(true);
    try {
      const counts = (baseCurrency?.denominations ?? [])
        .filter(d => Number(conteo[d.id]) > 0)
        .map(d => ({
          currencyCode: baseCurrency!.code,
          denomination: Number(d.value),
          quantity: Number(conteo[d.id]),
        }));
      const cerrado = await api.post<any>('/cash/close', {
        counts,
        countedCash: counts.length ? undefined : contado,
        notes: notaCierre.trim() || undefined,
      });
      setTurno(null);
      setConteo({});
      setNotaCierre('');
      await cargarHistorial();
      showToast(
        'Caja cerrada',
        Math.abs(Number(cerrado?.difference ?? 0)) < 0.01
          ? 'El arqueo cuadró exacto.'
          : `Descuadre de ${plata(cerrado?.difference)}.`,
        Math.abs(Number(cerrado?.difference ?? 0)) < 0.01 ? 'success' : 'warning',
      );
    } catch (e: any) {
      showToast('No se pudo cerrar', e?.message ?? '', 'warning');
    } finally { setOcupado(false); }
  }, [conteo, contado, notaCierre, baseCurrency, cargarHistorial, showToast]);

  const recibosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return recibos;
    return recibos.filter(r =>
      (r.clientName ?? r.label ?? '').toLowerCase().includes(q) ||
      String(r.id).slice(-8).toLowerCase().includes(q),
    );
  }, [recibos, busca]);

  /**
   * Comandas abiertas, la de mayor saldo primero.
   *
   * `openFolios` trae TODO lo que está en estado open, incluidas cuentas de
   * mostrador recién creadas y vacías; una comanda en cero no es un descuido,
   * así que no cuenta para el aviso rojo — si contara, el número nunca
   * bajaría a cero y la gente dejaría de mirarlo.
   */
  const abiertas = useMemo(() => {
    return (openFolios ?? [])
      .map((f: any) => ({ f, saldo: Number(f.total ?? 0) - Number(f.paidTotal ?? 0) }))
      .filter(x => x.saldo > 0.009)
      .sort((a, b) => b.saldo - a.saldo);
  }, [openFolios]);

  // Al entrar a la pestaña se refresca: puede haber comandas que abrió otra
  // persona desde la Agenda al marcar una cita como atendida.
  useEffect(() => { if (vista === 'comandas') void loadOpenFolios?.(); }, [vista, loadOpenFolios]);

  const clientasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = (clients ?? []);
    return (q ? lista.filter(c => c.name.toLowerCase().includes(q)) : lista).slice(0, 30);
  }, [clients, busca]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full"
    >
      <IOSHeader
        title="Caja"
        subtitle="PUNTO DE VENTA & COBROS"
      />

      <PageContent className="space-y-4 text-xs select-none">
        {/* Cobrar / Recibos */}
        <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-100 dark:bg-neutral-800">
          {([
            { id: 'cobrar' as const, label: 'Cobrar', icon: Receipt, pendientes: 0 },
            { id: 'comandas' as const, label: 'Comandas', icon: ClipboardList, pendientes: abiertas.length },
            { id: 'recibos' as const, label: 'Recibos', icon: Printer, pendientes: 0 },
            { id: 'turno' as const, label: 'Turno', icon: Wallet, pendientes: 0 },
          ]).map(t => {
            const Icono = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => { setVista(t.id); setBusca(''); }}
                className={`relative flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  vista === t.id
                    ? 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 dark:text-neutral-400'
                }`}
              >
                <Icono className="w-3.5 h-3.5" />
                {t.label}
                {/* En rojo y sin pedir permiso: cada número es una clienta que
                    se puede ir sin pagar. */}
                {t.pendientes > 0 && (
                  <span className="min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-extrabold flex items-center justify-center tabular-nums shadow-sm">
                    {t.pendientes}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {vista === 'cobrar' ? (
          <>
            {/* A quién le cobro */}
            <div className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Cobrando a
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {activeSale?.clientName ?? activeSale?.label
                      ?? activeLoungeClient?.name ?? 'Nadie todavía'}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => { setEligiendoClienta(v => !v); setBusca(''); }}
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-neutral-800 text-[11px] font-bold text-slate-600 dark:text-neutral-300 flex items-center gap-1 hover:bg-slate-200 dark:hover:bg-neutral-700 transition"
                  >
                    <Users className="w-3 h-3" />
                    Clienta
                  </button>
                  <button
                    onClick={() => newCounterFolio()}
                    title="Cuenta de mostrador, sin clienta"
                    className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-neutral-800 text-[11px] font-bold text-slate-600 dark:text-neutral-300 flex items-center gap-1 hover:bg-slate-200 dark:hover:bg-neutral-700 transition"
                  >
                    <UserPlus className="w-3 h-3" />
                    Mostrador
                  </button>
                </div>
              </div>

              {eligiendoClienta && (
                <div className="space-y-2 pt-1">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      value={busca}
                      onChange={e => setBusca(e.target.value)}
                      placeholder="Buscar clienta…"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto flex flex-wrap gap-1">
                    {clientasFiltradas.map(c => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setActiveLoungeClient(c);
                          setEligiendoClienta(false);
                          setBusca('');
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[11px] font-semibold text-slate-700 dark:text-neutral-200 hover:border-[var(--primary)] hover:text-[var(--primary)] transition"
                      >
                        {c.name}
                      </button>
                    ))}
                    {!clientasFiltradas.length && (
                      <p className="w-full py-3 text-center text-[11px] text-slate-400">
                        Ninguna clienta con ese nombre.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* El POS: el mismo componente que se ve en Lounge */}
            <PosPanel />
          </>
        ) : vista === 'comandas' ? (
          <>
            <div className={`p-3 rounded-2xl border shadow-2xs ${
              abiertas.length
                ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/50'
                : 'bg-white dark:bg-neutral-900 border-slate-200/80 dark:border-neutral-800'
            }`}>
              <div className="flex items-center gap-2">
                <ClipboardList className={`w-4 h-4 shrink-0 ${abiertas.length ? 'text-red-500' : 'text-emerald-500'}`} />
                <div className="min-w-0">
                  <div className={`text-xs font-bold ${
                    abiertas.length ? 'text-red-700 dark:text-red-300' : 'text-slate-800 dark:text-neutral-100'
                  }`}>
                    {abiertas.length
                      ? `${abiertas.length} comanda${abiertas.length === 1 ? '' : 's'} sin cobrar`
                      : 'Todo cobrado'}
                  </div>
                  <div className="text-[10px] text-slate-500 dark:text-neutral-400">
                    {abiertas.length
                      ? `${plata(abiertas.reduce((t, x) => t + x.saldo, 0))} en la calle ahora mismo`
                      : 'No hay ninguna cuenta abierta con saldo.'}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-2 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs">
              {abiertas.length ? (
                <div className="divide-y divide-slate-100 dark:divide-neutral-800">
                  {abiertas.map(({ f, saldo }) => {
                    const abierta = new Date(f.openedAt);
                    const minutos = Math.max(0, Math.round((Date.now() - abierta.getTime()) / 60000));
                    // Más de tres horas abierta ya no es "está en el sillón"
                    const vieja = minutos > 180;
                    const lineas = (f.items ?? []).length;
                    return (
                      <div key={f.id} className="p-2.5 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {f.clientName ?? f.label ?? 'Mostrador'}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                            <span className={`inline-flex items-center gap-1 ${vieja ? 'text-red-500 font-bold' : ''}`}>
                              <Clock className="w-2.5 h-2.5" />
                              {minutos < 60
                                ? `${minutos} min`
                                : `${Math.floor(minutos / 60)} h ${minutos % 60} min`}
                            </span>
                            <span>·</span>
                            <span>{lineas} línea{lineas === 1 ? '' : 's'}</span>
                            {Number(f.paidTotal ?? 0) > 0 && (
                              <>
                                <span>·</span>
                                <span className="text-emerald-600 dark:text-emerald-400">
                                  abonó {plata(f.paidTotal)}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-extrabold text-slate-900 dark:text-white tabular-nums">
                            {plata(saldo)}
                          </span>
                          <button
                            onClick={() => { void selectFolio(f.id); setVista('cobrar'); }}
                            className="px-3 py-1.5 rounded-xl bg-[var(--primary)] text-white text-[11px] font-bold hover:opacity-90 transition cursor-pointer"
                          >
                            Cobrar
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="py-8 text-center text-xs text-slate-400">
                  Ninguna cuenta abierta con saldo pendiente.
                </p>
              )}
            </div>
          </>
        ) : vista === 'turno' ? (
          <>
            {turno ? (
              <>
                {/* Estado del turno abierto */}
                <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-emerald-300 dark:border-emerald-900/60 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                        <LockOpen className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          Caja abierta
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {turno.openedByName ?? 'Sin nombre'} ·{' '}
                          {new Date(turno.openedAt).toLocaleString('es', {
                            day: '2-digit', month: 'short',
                            hour: '2-digit', minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-slate-400 uppercase font-bold">
                        Debe haber
                      </div>
                      <div className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums">
                        {plata(esperado)}
                      </div>
                    </div>
                  </div>

                  {/* Cómo se llegó a ese número */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 space-y-1 text-[11px]">
                    {([
                      ['Fondo inicial', turno.resumen?.openingFloat, false],
                      ['Efectivo recibido', turno.resumen?.efectivoRecibido, false],
                      ['Vueltas entregadas', -Number(turno.resumen?.vueltosEntregados ?? 0), true],
                      ['Entradas manuales', turno.resumen?.entradas, false],
                      ['Salidas manuales', -Number(turno.resumen?.salidas ?? 0), true],
                    ] as [string, any, boolean][])
                      .filter(([, v]) => Math.abs(Number(v ?? 0)) > 0.001)
                      .map(([label, valor, negativo]) => (
                        <div key={label} className="flex justify-between text-slate-500 dark:text-neutral-400">
                          <span>{label}</span>
                          <span className={`font-mono tabular-nums ${negativo ? 'text-red-500' : ''}`}>
                            {plata(valor)}
                          </span>
                        </div>
                      ))}
                  </div>

                  {/* Lo que no toca la gaveta */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    {[
                      ['Ventas', turno.resumen?.ventas ?? 0, false],
                      ['Facturado', turno.resumen?.facturado ?? 0, true],
                      ['Propinas', turno.resumen?.propinas ?? 0, true],
                    ].map(([l, v, esPlata]) => (
                      <div key={String(l)} className="p-2 rounded-xl bg-slate-50 dark:bg-neutral-800/40">
                        <div className="text-[10px] text-slate-400 font-medium">{String(l)}</div>
                        <div className="text-xs font-bold text-slate-800 dark:text-neutral-200 tabular-nums">
                          {esPlata ? plata(v) : String(v)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {!!turno.resumen?.porMetodo && (
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(turno.resumen.porMetodo).map(([m, d]: any) => (
                        <span
                          key={m}
                          className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-neutral-800 text-[10px] font-bold text-slate-600 dark:text-neutral-300"
                        >
                          {({ cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transf.', other: 'Otro' } as any)[m] ?? m}
                          {' · '}
                          <span className="font-mono tabular-nums">{Number(d.monto).toFixed(2)}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Entradas y salidas de la gaveta */}
                <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    Movimientos de efectivo
                  </h3>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Todo lo que entra o sale de la gaveta sin ser una venta:
                    un retiro a la bóveda, el café que se compró con plata de
                    caja, un adelanto. Sin registrarlo, el arqueo siempre
                    descuadra y se vuelve inútil.
                  </p>

                  {!!turno.movements?.length && (
                    <div className="divide-y divide-slate-100 dark:divide-neutral-800">
                      {turno.movements.map((m: any) => (
                        <div key={m.id} className="py-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {m.kind === 'in'
                              ? <ArrowDownLeft className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
                              : <ArrowUpRight className="w-3.5 h-3.5 shrink-0 text-red-500" />}
                            <span className="text-xs text-slate-700 dark:text-neutral-200 truncate">
                              {m.reason}
                            </span>
                          </div>
                          <span className={`text-xs font-mono tabular-nums shrink-0 ${
                            m.kind === 'in' ? 'text-emerald-600' : 'text-red-500'
                          }`}>
                            {m.kind === 'in' ? '+' : '−'}{Number(m.amount).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-[auto_1fr_auto] gap-1 items-center">
                    <div className="flex rounded-xl bg-slate-100 dark:bg-neutral-800 p-0.5">
                      {(['out', 'in'] as const).map(k => (
                        <button
                          key={k}
                          onClick={() => setMov(p => ({ ...p, kind: k }))}
                          className={`px-2 py-1.5 rounded-lg text-[10px] font-bold transition ${
                            mov.kind === k
                              ? k === 'in' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                              : 'text-slate-500'
                          }`}
                        >
                          {k === 'in' ? 'Entra' : 'Sale'}
                        </button>
                      ))}
                    </div>
                    <input
                      value={mov.reason}
                      onChange={e => setMov(p => ({ ...p, reason: e.target.value }))}
                      placeholder="Motivo — retiro a bóveda, compra…"
                      className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[11px] text-slate-900 dark:text-white"
                    />
                    <input
                      type="number"
                      value={mov.amount}
                      onChange={e => setMov(p => ({ ...p, amount: e.target.value }))}
                      placeholder="0.00"
                      className="w-24 px-2 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[11px] font-mono tabular-nums text-right text-slate-900 dark:text-white"
                    />
                  </div>
                  <button
                    onClick={registrarMovimiento}
                    disabled={ocupado || !Number(mov.amount) || !mov.reason.trim()}
                    className="w-full py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 text-[11px] font-bold text-slate-600 dark:text-neutral-300 flex items-center justify-center gap-1 disabled:opacity-40 transition"
                  >
                    <Plus className="w-3 h-3" />
                    Registrar movimiento
                  </button>
                </div>

                {/* Arqueo */}
                <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    Arqueo — contar la gaveta
                  </h3>

                  {baseCurrency?.denominations?.length ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {baseCurrency.denominations
                        .filter(d => d.active !== false)
                        .map(d => (
                          <div key={d.id} className="flex items-center gap-2">
                            <span className="w-16 shrink-0 text-[11px] font-bold text-slate-600 dark:text-neutral-300 tabular-nums">
                              {baseCurrency.symbol}{Number(d.value).toLocaleString()}
                            </span>
                            <input
                              type="number"
                              min={0}
                              value={conteo[d.id] ?? ''}
                              onChange={e => setConteo(p => ({ ...p, [d.id]: e.target.value }))}
                              placeholder="0"
                              className="w-full px-2 py-1.5 rounded-lg bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[11px] font-mono tabular-nums text-right text-slate-900 dark:text-white"
                            />
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400">
                      No hay billetes registrados. Agrégalos en Ajustes → Monedas
                      y Billetes para contar más rápido.
                    </p>
                  )}

                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-neutral-800/60 space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-500 dark:text-neutral-400">
                      <span>Contado</span>
                      <span className="font-mono tabular-nums">{plata(contado)}</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-500 dark:text-neutral-400">
                      <span>Debería haber</span>
                      <span className="font-mono tabular-nums">{plata(esperado)}</span>
                    </div>
                    <div className={`flex justify-between text-sm font-extrabold pt-1 border-t border-slate-200 dark:border-neutral-700 ${
                      Math.abs(diferencia) < 0.01
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : diferencia < 0 ? 'text-red-500' : 'text-amber-600'
                    }`}>
                      <span>
                        {Math.abs(diferencia) < 0.01
                          ? 'Cuadra'
                          : diferencia < 0 ? 'Falta' : 'Sobra'}
                      </span>
                      <span className="font-mono tabular-nums">
                        {plata(Math.abs(diferencia))}
                      </span>
                    </div>
                  </div>

                  <input
                    value={notaCierre}
                    onChange={e => setNotaCierre(e.target.value)}
                    placeholder="Nota del cierre (opcional)"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[11px] text-slate-900 dark:text-white"
                  />

                  <button
                    onClick={cerrarCaja}
                    disabled={ocupado}
                    className="w-full py-2.5 rounded-xl bg-slate-800 dark:bg-neutral-200 text-white dark:text-neutral-900 text-xs font-extrabold flex items-center justify-center gap-1.5 disabled:opacity-40 transition"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Cerrar caja
                  </button>
                  <p className="text-[10px] text-center text-slate-400 leading-relaxed">
                    El descuadre se guarda tal como salió. No se corrige el
                    número — un arqueo que siempre cuadra no detecta nada.
                  </p>
                </div>
              </>
            ) : (
              /* Caja cerrada: abrir turno */
              <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-400 flex items-center justify-center">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      Caja cerrada
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Puedes cobrar igual, pero esos pagos no entrarán en ningún arqueo.
                    </p>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Fondo inicial {sim}
                  </label>
                  <input
                    type="number"
                    value={fondo}
                    onChange={e => setFondo(e.target.value)}
                    placeholder="0.00"
                    className="w-full mt-1 px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-sm font-mono tabular-nums text-slate-900 dark:text-white"
                  />
                </div>
                <button
                  onClick={abrirCaja}
                  disabled={ocupado}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 disabled:opacity-40 transition"
                >
                  <LockOpen className="w-3.5 h-3.5" />
                  Abrir caja
                </button>
              </div>
            )}

            {/* Historial de turnos */}
            <div className="p-2 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs">
              <h3 className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Cierres anteriores
              </h3>
              {historial.length ? (
                <div className="divide-y divide-slate-100 dark:divide-neutral-800">
                  {historial.map(h => {
                    const dif = Number(h.difference ?? 0);
                    const cuadra = Math.abs(dif) < 0.01;
                    return (
                      <div key={h.id} className="p-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-800 dark:text-neutral-100">
                            {new Date(h.closedAt).toLocaleString('es', {
                              day: '2-digit', month: 'short',
                              hour: '2-digit', minute: '2-digit',
                            })}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {h.closedByName ?? 'Sin nombre'} · contó {plata(h.countedCash)} de{' '}
                            {plata(h.expectedCash)}
                            {h.notes ? ` · ${h.notes}` : ''}
                          </div>
                        </div>
                        <span className={`shrink-0 px-2 py-1 rounded-lg text-[10px] font-extrabold tabular-nums ${
                          cuadra
                            ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                            : dif < 0
                              ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                              : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                        }`}>
                          {cuadra ? 'cuadró' : `${dif > 0 ? '+' : ''}${dif.toFixed(2)}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="py-6 text-center text-xs text-slate-400">
                  Todavía no se ha cerrado ninguna caja.
                </p>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar por clienta o número de recibo…"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div className="p-2 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs">
              {cargando ? (
                <p className="py-8 text-center text-xs text-slate-400">Cargando…</p>
              ) : recibosFiltrados.length ? (
                <div className="divide-y divide-slate-100 dark:divide-neutral-800">
                  {recibosFiltrados.map(r => {
                    const f = new Date(r.closedAt ?? r.openedAt);
                    return (
                      <div key={r.id} className="p-2 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-800 dark:text-neutral-100 truncate">
                            {r.clientName ?? r.label ?? 'Mostrador'}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            #{String(r.id).slice(-8).toUpperCase()} ·{' '}
                            {f.toLocaleDateString('es')}{' '}
                            {f.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })} ·{' '}
                            {r.items?.length ?? 0} líneas
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-extrabold text-slate-900 dark:text-white tabular-nums">
                            {plata(r.total)}
                          </span>
                          <button
                            onClick={() => reimprimir(r)}
                            title="Reimprimir — sale marcado como COPIA"
                            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-500 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-neutral-700 hover:text-[var(--primary)] transition"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="py-8 text-center text-xs text-slate-400">
                  {busca ? 'Ningún recibo con esa búsqueda.' : 'Todavía no hay recibos cobrados.'}
                </p>
              )}
            </div>
          </>
        )}
      </PageContent>
    </motion.div>
  );
};
