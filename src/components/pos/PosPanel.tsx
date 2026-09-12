import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  Coffee, Receipt, Search, X, Plus, Minus, Gift, Tag, Split, UserPlus,
  ChevronDown, Printer, UserCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { imprimirRecibo } from '../../utils/recibo';

/** Algo que se le puede despachar a la clienta: producto o servicio */
type Vendible = {
  id: string; name: string; price: number;
  stock: number | null;          // null = servicio, no se agota
  tipo: 'product' | 'service';
  grupo: 'beverage' | 'snack' | 'product' | 'service';
};

const GRUPOS = [
  { id: 'beverage' as const, label: '☕ Bebidas' },
  { id: 'snack'    as const, label: '🍪 Aperitivos' },
  { id: 'product'  as const, label: '📦 Productos' },
  { id: 'service'  as const, label: '✂️ Servicios' },
];

const normalizar = (t: string) =>
  t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/**
 * El punto de venta completo: la carta, la comanda y el cobro.
 *
 * Vive aquí y no dentro de una pantalla porque se monta en DOS sitios —
 * Lounge (para servir sin cambiar de pantalla) y Caja (para cobrar). Una
 * sola fuente: lo que se arregla aquí se arregla en ambas.
 */
export const PosPanel: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const {
    products, services, appointments, clients, navigateTo, showToast, settings,
    activeLoungeClient,
    activeSale, saleBusy, openSale, addSaleItem, removeSaleItem,
    setSaleItemQty, toggleSaleItemCourtesy, setSalePriceList, paySale, closeSale,
    openFolios, loadOpenFolios, selectFolio, newCounterFolio, moveSaleItem,
    asignarClientaAFolio, cerrarFolio,
    priceLists, loadPriceLists,
    currencies, baseCurrency, loadCurrencies,
  } = useApp();

  const reduceMotion = useReducedMotion();

  // Ponerle dueña a una cuenta de mostrador: qué comanda y qué se busca
  const [asignando, setAsignando] = useState<string | null>(null);
  const [buscaClienta, setBuscaClienta] = useState('');

  const clientasParaAsignar = useMemo(() => {
    const q = normalizar(buscaClienta);
    const lista = clients ?? [];
    return (q ? lista.filter(c => normalizar(c.name).includes(q)) : lista).slice(0, 20);
  }, [clients, buscaClienta]);

  useEffect(() => { void loadPriceLists?.(); void loadCurrencies?.(); }, []);
  useEffect(() => { void loadOpenFolios?.(); }, [activeSale?.id, loadOpenFolios]);

  const [mostrarListas, setMostrarListas] = useState(false);
  const [moviendo, setMoviendo] = useState<string | null>(null);
  const [cartaTipo, setCartaTipo] = useState<Vendible['grupo']>('beverage');
  const [cartaBusca, setCartaBusca] = useState('');
  const [verTodo, setVerTodo] = useState(false);
  const [mostrarCobro, setMostrarCobro] = useState(false);
  const [cobroMetodo, setCobroMetodo] = useState<'cash' | 'card' | 'transfer' | 'other'>('cash');
  const [cobroMonto, setCobroMonto] = useState('');
  const [cobroPropina, setCobroPropina] = useState('');
  const [cobroMoneda, setCobroMoneda] = useState<string>('');
  const [imprimirAlCerrar, setImprimirAlCerrar] = useState(true);

  /** Dinero con símbolo. Lo que se lee es "43.00 RD$", no un número pelado. */
  const sim = baseCurrency?.symbol ?? '';
  const plata = useCallback(
    (n: number | string | null | undefined, simbolo = sim) =>
      `${Number(n ?? 0).toFixed(2)}${simbolo ? ` ${simbolo}` : ''}`,
    [sim],
  );

  const vendibles = useMemo<Vendible[]>(() => {
    const deProductos: Vendible[] = (products ?? [])
      .filter(p => p.active !== false)
      .map(p => ({
        id: p.id, name: p.name,
        price: Number(p.basePrice ?? 0),
        stock: Number(p.stock ?? 0),
        tipo: 'product' as const,
        grupo: (p.category === 'beverage' || p.category === 'snack'
          ? p.category : 'product') as Vendible['grupo'],
      }));
    const deServicios: Vendible[] = (services ?? []).map(sv => ({
      id: sv.id, name: sv.name,
      price: Number(sv.price ?? 0),
      stock: null,
      tipo: 'service' as const,
      grupo: 'service' as const,
    }));
    return [...deProductos, ...deServicios];
  }, [products, services]);

  const cartaCompleta = useMemo(() => {
    const q = normalizar(cartaBusca);
    return vendibles
      .filter(v => (q ? normalizar(v.name).includes(q) : v.grupo === cartaTipo))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [vendibles, cartaTipo, cartaBusca]);

  const VISIBLES = compact ? 6 : 9;
  useEffect(() => { setVerTodo(false); }, [cartaTipo, cartaBusca]);
  const carta = useMemo(
    () => (verTodo || cartaBusca ? cartaCompleta : cartaCompleta.slice(0, VISIBLES)),
    [cartaCompleta, verTodo, cartaBusca, VISIBLES],
  );
  const ocultos = cartaCompleta.length - carta.length;

  const servir = useCallback(async (v: Vendible) => {
    // Si ya está en la comanda, subimos la cantidad: tocar dos veces debe dar
    // «2× Agua», no dos renglones de agua.
    const yaEsta = activeSale?.items?.find(i =>
      v.tipo === 'service' ? i.serviceId === v.id : i.productId === v.id,
    );
    if (yaEsta) {
      await setSaleItemQty(yaEsta.id, Number(yaEsta.quantity || 1) + 1);
      return;
    }
    await addSaleItem({
      kind: v.tipo === 'service' ? 'service' : v.price > 0 ? 'product' : 'courtesy',
      ...(v.tipo === 'service' ? { serviceId: v.id } : { productId: v.id }),
      label: v.name,
      quantity: 1,
    });
  }, [addSaleItem, activeSale, setSaleItemQty]);

  // ── La cita de hoy, para abrir el folio solo ──────────────────────────
  const citaDeHoy = useMemo(() => {
    if (!activeLoungeClient) return null;
    const hoy = new Date().toISOString().slice(0, 10);
    return (appointments ?? []).find(a =>
      a.clientId === activeLoungeClient.id && a.date === hoy && a.status !== 'cancelled',
    ) ?? null;
  }, [appointments, activeLoungeClient?.id]);

  // Con cita hay cuenta: el servicio ya es parte de la cuenta y nadie
  // debería tener que agregarlo a mano. Sin cita no creamos nada solo.
  const abriendoRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!activeLoungeClient || !citaDeHoy || activeSale) return;
    if (abriendoRef.current === citaDeHoy.id) return;
    abriendoRef.current = citaDeHoy.id;
    void openSale({ clientId: activeLoungeClient.id, appointmentId: citaDeHoy.id });
  }, [activeLoungeClient?.id, citaDeHoy?.id, activeSale, openSale]);

  // ── Cobro ─────────────────────────────────────────────────────────────
  const pendiente = Math.max(
    0, Number(activeSale?.total ?? 0) - Number(activeSale?.paidTotal ?? 0),
  );
  const monedaActiva = useMemo(
    () => currencies?.find(c => c.code === cobroMoneda) ?? baseCurrency ?? null,
    [currencies, cobroMoneda, baseCurrency],
  );
  const tasa = Number(monedaActiva?.rateToBase ?? 1) || 1;
  const esExtranjera = !!monedaActiva && !monedaActiva.isBase;
  const entregadoEnBase = (Number(cobroMonto) || 0) * tasa;
  const vuelto = Math.max(0, entregadoEnBase - pendiente - (Number(cobroPropina) || 0));

  useEffect(() => {
    if (!mostrarCobro) return;
    setCobroMoneda(baseCurrency?.code ?? '');
    setCobroMonto(pendiente > 0 ? pendiente.toFixed(2) : '');
  }, [mostrarCobro]);

  useEffect(() => {
    if (!mostrarCobro || !monedaActiva) return;
    setCobroMonto(pendiente > 0 ? (pendiente / tasa).toFixed(2) : '');
  }, [cobroMoneda]);

  const imprimir = useCallback((venta: any) => {
    imprimirRecibo(venta, {
      anchoMm: Number((settings as any)?.receiptWidthMm) || 80,
      salon: (settings as any)?.salonName ?? 'Lalan AI Studio & Lounge',
      direccion: (settings as any)?.address ?? '',
      telefono: (settings as any)?.phone ?? '',
      pie: (settings as any)?.receiptFooter ?? '¡Gracias por tu visita!',
      simbolo: sim,
    });
  }, [settings, sim]);

  if (!activeSale && !activeLoungeClient) {
    return (
      <div className="p-8 text-center bg-white dark:bg-neutral-900 rounded-3xl border border-slate-200 dark:border-neutral-800">
        <Receipt className="w-10 h-10 mx-auto text-slate-300 dark:text-neutral-600 mb-2" />
        <h3 className="text-sm font-bold text-slate-700 dark:text-neutral-300">
          Ninguna cuenta abierta
        </h3>
        <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
          Abre una cuenta de mostrador para vender sin cita, o elige una clienta.
        </p>
        <button
          onClick={() => newCounterFolio()}
          className="mt-4 px-4 py-2 rounded-full bg-[var(--primary)] text-white text-xs font-bold shadow-xs"
        >
          Abrir cuenta de mostrador
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
          {/* ── Servir o vender (OFERTA) ──────────────────────────── */}
          {/* Esto SÍ es el catálogo: productos reales, con precio y
              stock, que se editan desde Catálogo como todo lo demás. */}
          <div className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 shrink-0 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Coffee className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    Servir o vender
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Entra a la comanda con su precio · 0.00 es cortesía
                  </p>
                </div>
              </div>
            </div>

            {/* Buscador: escribir ignora la pestaña y busca en todo */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={cartaBusca}
                onChange={e => setCartaBusca(e.target.value)}
                placeholder="Buscar en todo el catálogo…"
                className="w-full pl-9 pr-8 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400"
              />
              {!!cartaBusca && (
                <button
                  onClick={() => setCartaBusca('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-200 dark:hover:bg-neutral-700"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {!cartaBusca && (
              <div className="flex items-center gap-1 p-0.5 rounded-full bg-slate-100 dark:bg-neutral-800 overflow-x-auto">
                {GRUPOS.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setCartaTipo(g.id)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition ${
                      cartaTipo === g.id
                        ? 'bg-white dark:bg-neutral-700 text-slate-900 dark:text-white shadow-2xs'
                        : 'text-slate-500 dark:text-neutral-400'
                    }`}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            )}

            {carta.length ? (
              <motion.div
                layout
                className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[46vh] overflow-y-auto pr-1 -mr-1"
              >
                {carta.map(p => {
                  // Un servicio no se agota; un producto sí
                  const agotado = p.stock !== null && p.stock <= 0;
                  const enComanda = activeSale?.items?.find(i =>
                    p.tipo === 'service' ? i.serviceId === p.id : i.productId === p.id,
                  );
                  return (
                    <motion.div
                      key={p.id}
                      layout="position"
                      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18 }}
                      className={`relative p-3.5 rounded-2xl border flex flex-col gap-3 transition-colors ${
                        agotado
                          ? 'border-slate-200/60 dark:border-neutral-800 opacity-50'
                          : enComanda
                            ? 'border-[var(--primary)] bg-[var(--primary)]/5'
                            : 'border-slate-200 dark:border-neutral-700 hover:border-slate-300 dark:hover:border-neutral-600'
                      }`}
                    >
                      {!!enComanda && (
                        <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1.5 rounded-full bg-[var(--primary)] text-white text-[10px] font-extrabold flex items-center justify-center tabular-nums">
                          {Number(enComanda.quantity)}
                        </span>
                      )}
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 dark:text-neutral-100 leading-snug">
                          {p.name}
                        </div>
                        <div className="text-[10px] text-slate-400 tabular-nums">
                          {plata(p.price)}
                          {p.stock === null
                            ? ' · servicio'
                            : agotado ? ' · sin stock' : ` · ${p.stock} disp.`}
                        </div>
                      </div>
                      {enComanda ? (
                        // Ya está en la comanda: el botón se convierte
                        // en el contador, ahí mismo, sin bajar a mirar.
                        <div className="flex items-center gap-1">
                          <button
                            disabled={saleBusy}
                            onClick={() => setSaleItemQty(enComanda.id, Number(enComanda.quantity) - 1)}
                            className="w-9 h-8 rounded-lg bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-neutral-700 transition disabled:opacity-40"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="flex-1 text-center text-xs font-extrabold text-slate-800 dark:text-neutral-100 tabular-nums">
                            {Number(enComanda.quantity)}
                          </span>
                          <button
                            disabled={agotado || saleBusy}
                            onClick={() => setSaleItemQty(enComanda.id, Number(enComanda.quantity) + 1)}
                            className="w-9 h-8 rounded-lg bg-[var(--primary)] text-white flex items-center justify-center hover:opacity-90 transition disabled:opacity-40"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          disabled={agotado || saleBusy}
                          onClick={() => servir(p)}
                          className="w-full py-2 rounded-lg bg-[var(--primary)] text-white text-[11px] font-extrabold hover:opacity-90 active:scale-98 transition disabled:opacity-40"
                        >
                          Servir
                        </button>
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>
            ) : (
              <div className="py-6 text-center space-y-2">
                <p className="text-xs text-slate-400">
                  {cartaBusca
                    ? `Nada que se llame «${cartaBusca}».`
                    : `No hay ${GRUPOS.find(g => g.id === cartaTipo)?.label.slice(2).toLowerCase() ?? 'nada'} en el catálogo.`}
                </p>
                <button
                  onClick={() => navigateTo('catalog')}
                  className="text-[11px] font-bold text-[var(--primary)]"
                >
                  Agregarlos en Catálogo →
                </button>
              </div>
            )}

            {!cartaBusca && ocultos > 0 && (
              <button
                onClick={() => setVerTodo(true)}
                className="w-full py-2 rounded-xl text-[11px] font-bold text-[var(--primary)] bg-[var(--primary)]/10 hover:bg-[var(--primary)]/15 transition"
              >
                Ver {ocultos} más — o búscalo arriba
              </button>
            )}
            {verTodo && !cartaBusca && (
              <button
                onClick={() => setVerTodo(false)}
                className="w-full py-2 rounded-xl text-[11px] font-bold text-slate-400 hover:text-slate-600 transition"
              >
                Mostrar menos
              </button>
            )}
          </div>

          {/* ── El consumo (TICKET) ───────────────────────────────── */}
          <div className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs space-y-3">
            {/* Cuentas abiertas. Como en un hotel: cada quien tiene su
                folio y al final cada quien paga el suyo. */}
            {(openFolios?.length ?? 0) > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1 overflow-x-auto pb-1 -mx-1 px-1">
                  {openFolios.map(f => {
                    const activa = f.id === activeSale?.id;
                    const pend = Math.max(0, Number(f.total) - Number(f.paidTotal));
                    const vacia = !(f.items?.length) && !(f.payments?.length);
                    return (
                      /* Pestaña = botón + su propia X. Antes era un solo botón
                         y una cuenta abierta por error se quedaba ahí para
                         siempre, sin forma de quitarla. */
                      <div
                        key={f.id}
                        className={`shrink-0 flex items-center rounded-xl text-[11px] font-bold whitespace-nowrap transition ${
                          activa
                            ? 'bg-[var(--primary)] text-white'
                            : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-neutral-700'
                        }`}
                      >
                        <button
                          onClick={() => selectFolio(f.id)}
                          className="pl-2.5 py-1.5 cursor-pointer"
                        >
                          {(f.clientName ?? f.label ?? 'Cuenta').split(' ')[0]}
                          <span className={`ml-1.5 font-mono tabular-nums ${activa ? 'opacity-80' : 'text-slate-400'}`}>
                            {plata(pend)}
                          </span>
                        </button>
                        <button
                          onClick={() => cerrarFolio(f.id)}
                          disabled={saleBusy}
                          title={vacia
                            ? 'Cerrar esta cuenta vacía'
                            : 'Tiene consumo: se cierra cobrándola'}
                          className={`px-1.5 py-1.5 rounded-r-xl transition disabled:opacity-40 cursor-pointer ${
                            activa ? 'hover:bg-black/15' : 'hover:bg-slate-300/60 dark:hover:bg-neutral-600'
                          }`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                  <button
                    onClick={() => newCounterFolio()}
                    disabled={saleBusy}
                    title="Abrir una cuenta de mostrador"
                    className="shrink-0 w-8 h-8 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-500 flex items-center justify-center hover:bg-slate-200 dark:hover:bg-neutral-700 transition disabled:opacity-40 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* ── Ponerle dueña a la cuenta ──────────────────────────
                    Llega alguien, pide un café, se sienta; nadie sabe aún si
                    es clienta del salón. Se abre mostrador y después se pasa
                    a su nombre sin retranscribir nada. */}
                {activeSale && !activeSale.clientId && (
                  asignando === activeSale.id ? (
                    <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200 dark:border-neutral-700 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input
                            autoFocus
                            value={buscaClienta}
                            onChange={e => setBuscaClienta(e.target.value)}
                            placeholder="¿De quién es esta cuenta?"
                            className="w-full pl-8 pr-2 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[11px] text-slate-900 dark:text-white"
                          />
                        </div>
                        <button
                          onClick={() => { setAsignando(null); setBuscaClienta(''); }}
                          className="px-2 py-1.5 rounded-xl text-[11px] font-bold text-slate-500 hover:bg-slate-200 dark:hover:bg-neutral-700 cursor-pointer"
                        >
                          Cancelar
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                        {clientasParaAsignar.map(c => (
                          <button
                            key={c.id}
                            disabled={saleBusy}
                            onClick={async () => {
                              const ok = await asignarClientaAFolio(activeSale.id, c.id);
                              if (ok) { setAsignando(null); setBuscaClienta(''); }
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[11px] font-semibold text-slate-700 dark:text-neutral-200 hover:border-[var(--primary)] hover:text-[var(--primary)] transition disabled:opacity-40 cursor-pointer"
                          >
                            {c.name}
                          </button>
                        ))}
                        {!clientasParaAsignar.length && (
                          <p className="w-full py-2 text-center text-[11px] text-slate-400">
                            Ninguna clienta con ese nombre.
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setAsignando(activeSale.id); setBuscaClienta(''); }}
                      className="w-full py-1.5 rounded-xl border border-dashed border-slate-300 dark:border-neutral-700 text-[11px] font-bold text-slate-500 dark:text-neutral-400 flex items-center justify-center gap-1.5 hover:border-[var(--primary)] hover:text-[var(--primary)] transition cursor-pointer"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      Asignar esta cuenta a una clienta
                    </button>
                  )
                )}
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
                  <Receipt className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                    Comanda de {(activeSale?.clientName ?? activeSale?.label ?? activeLoungeClient?.name ?? 'Mostrador').split(' ')[0]}
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[11px] text-slate-400">
                      {activeSale?.items?.length
                        ? `${activeSale.items.length} línea${activeSale.items.length === 1 ? '' : 's'}`
                        : 'Sin nada todavía'}
                    </p>
                    {/* Qué tarifa se está aplicando. Antes esto era
                        invisible y las listas parecían no existir. */}
                    {!!activeSale && (
                      <button
                        onClick={() => setMostrarListas(v => !v)}
                        disabled={saleBusy}
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold flex items-center gap-1 transition disabled:opacity-40 ${
                          activeSale.priceList && !activeSale.priceList.isDefault
                            ? 'bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300'
                            : 'bg-slate-100 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400'
                        }`}
                      >
                        <Tag className="w-2.5 h-2.5" />
                        {activeSale.priceList?.name ?? 'Sin lista'}
                        <ChevronDown className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
              {!!activeSale?.total && (
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-slate-400 uppercase font-bold">Total</div>
                  <div className="text-lg font-extrabold text-slate-900 dark:text-white tabular-nums">
                    {plata(activeSale.total)}
                  </div>
                  {Number(activeSale.discountTotal) > 0 && (
                    <div className="text-[10px] font-bold text-violet-600 dark:text-violet-400 tabular-nums">
                      ahorró {plata(activeSale.discountTotal)}
                    </div>
                  )}
                </div>
              )}
            </div>

            <AnimatePresence>
              {mostrarListas && !!activeSale && (
                <motion.div
                  initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-2 rounded-2xl bg-slate-50 dark:bg-neutral-800/50 space-y-1">
                    <p className="text-[10px] text-slate-400 px-1">
                      Cambiar la tarifa revalora las líneas al instante. Las
                      cortesías y lo ya pagado no se tocan.
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {(priceLists ?? []).filter((pl: any) => pl.active !== false).map((pl: any) => (
                        <button
                          key={pl.id}
                          disabled={saleBusy}
                          onClick={async () => {
                            await setSalePriceList(pl.id);
                            setMostrarListas(false);
                          }}
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition disabled:opacity-40 ${
                            activeSale.priceListId === pl.id
                              ? 'bg-[var(--primary)] text-white'
                              : 'bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300 hover:border-[var(--primary)]'
                          }`}
                        >
                          {pl.name}
                        </button>
                      ))}
                      <button
                        disabled={saleBusy}
                        onClick={async () => {
                          await setSalePriceList(null);
                          setMostrarListas(false);
                        }}
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition disabled:opacity-40 ${
                          !activeSale.priceListId
                            ? 'bg-slate-700 text-white'
                            : 'bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-slate-500'
                        }`}
                      >
                        Precio de lista
                      </button>
                    </div>
                    {!(priceLists ?? []).length && (
                      <button
                        onClick={() => navigateTo('price-lists')}
                        className="w-full py-2 text-[11px] font-bold text-[var(--primary)]"
                      >
                        No tienes listas creadas — créalas en Precios →
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {activeSale?.items?.length ? (
              <>
                <motion.div layout className="divide-y divide-slate-100 dark:divide-neutral-800">
                  <AnimatePresence initial={false}>
                  {activeSale.items.map(it => {
                    // Tres estados posibles por línea, y cada uno se
                    // lee distinto en la comanda:
                    //   · pagado en línea  → ya entró plata, no se cobra
                    //   · cortesía         → vale 0 a propósito
                    //   · normal           → se cobra al cerrar
                    const prepagado = (it.notes ?? '').toLowerCase().includes('pagado');
                    const cortesia = Number(it.lineTotal) === 0 && !prepagado;
                    return (
                      <motion.div
                        key={it.id}
                        layout={reduceMotion ? false : 'position'}
                        initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs overflow-hidden"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {/* El contador vive aquí: es donde uno mira
                              cuando quiere corregir «puse 1, eran 2». */}
                          {!prepagado && (
                            <div className="flex items-center gap-0.5 shrink-0 rounded-lg bg-slate-100 dark:bg-neutral-800 p-0.5">
                              <button
                                onClick={() => setSaleItemQty(it.id, Number(it.quantity) - 1)}
                                disabled={saleBusy}
                                className="w-6 h-6 rounded-md flex items-center justify-center text-slate-500 hover:bg-white dark:hover:bg-neutral-700 transition disabled:opacity-40"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="w-5 text-center font-extrabold tabular-nums text-slate-700 dark:text-neutral-200">
                                {Number(it.quantity)}
                              </span>
                              <button
                                onClick={() => setSaleItemQty(it.id, Number(it.quantity) + 1)}
                                disabled={saleBusy}
                                className="w-6 h-6 rounded-md flex items-center justify-center text-slate-500 hover:bg-white dark:hover:bg-neutral-700 transition disabled:opacity-40"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                          <span className="font-semibold text-slate-800 dark:text-neutral-200 truncate">
                            {it.label}
                          </span>
                          {prepagado && (
                            <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 font-extrabold">
                              PAGADO EN LÍNEA
                            </span>
                          )}
                          {cortesia && (
                            <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-extrabold">
                              CORTESÍA
                            </span>
                          )}
                          {!!it.discountPercent && (
                            <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300 font-extrabold">
                              −{Number(it.discountPercent).toFixed(0)}%
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`font-mono tabular-nums ${
                            prepagado || cortesia
                              ? 'text-slate-400'
                              : 'text-slate-700 dark:text-neutral-200 font-bold'
                          }`}>
                            {Number(it.lineTotal).toFixed(2)}
                          </span>
                          {!prepagado && (openFolios?.length ?? 0) > 1 && (
                            <button
                              onClick={() => setMoviendo(moviendo === it.id ? null : it.id)}
                              disabled={saleBusy}
                              title="Pasar esta línea a otra cuenta"
                              className={`w-6 h-6 rounded-full flex items-center justify-center transition disabled:opacity-40 ${
                                moviendo === it.id
                                  ? 'bg-sky-100 dark:bg-sky-900/50 text-sky-600'
                                  : 'text-slate-300 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-950/40'
                              }`}
                            >
                              <Split className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {!prepagado && (
                            <button
                              onClick={() => toggleSaleItemCourtesy(it.id)}
                              disabled={saleBusy}
                              title={cortesia ? 'Volver a cobrarla' : 'Invitarla — ponerla en 0'}
                              className={`w-6 h-6 rounded-full flex items-center justify-center transition disabled:opacity-40 ${
                                cortesia
                                  ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600'
                                  : 'text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                              }`}
                            >
                              <Gift className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => removeSaleItem(it.id)}
                            disabled={saleBusy}
                            className="w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition disabled:opacity-40"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        {moviendo === it.id && (
                          <div className="w-full flex flex-wrap items-center gap-1 pt-2 pl-1">
                            <span className="text-[10px] text-slate-400 mr-1">Pasar a:</span>
                            {openFolios.filter(f => f.id !== activeSale?.id).map(f => (
                              <button
                                key={f.id}
                                disabled={saleBusy}
                                onClick={async () => {
                                  await moveSaleItem(it.id, f.id);
                                  setMoviendo(null);
                                }}
                                className="px-2 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 text-[10px] font-bold hover:bg-sky-100 transition disabled:opacity-40"
                              >
                                {f.clientName ?? f.label ?? 'Cuenta'}
                              </button>
                            ))}
                            <button
                              disabled={saleBusy}
                              onClick={async () => {
                                const nueva = await newCounterFolio('Acompañante');
                                if (nueva) { await moveSaleItem(it.id, nueva.id); }
                                setMoviendo(null);
                              }}
                              className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 text-[10px] font-bold disabled:opacity-40"
                            >
                              + Cuenta nueva
                            </button>
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                  </AnimatePresence>
                </motion.div>

                {Number(activeSale.paidTotal) > 0 && (
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-neutral-400 pt-1">
                    <span>Ya cobrado</span>
                    <span className="font-mono tabular-nums">
                      {plata(activeSale.paidTotal)}
                    </span>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => imprimir(activeSale)}
                    title="Imprimir la cuenta sin cobrar todavía"
                    className="shrink-0 px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-neutral-700 transition"
                  >
                    <Printer className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setMostrarCobro(true)}
                    disabled={saleBusy}
                    className="flex-1 py-2.5 rounded-xl bg-[var(--primary)] text-white text-xs font-extrabold hover:opacity-90 transition disabled:opacity-40"
                  >
                    Cobrar {plata(activeSale.total)}
                  </button>
                </div>
              </>
            ) : (
              <div className="py-4 text-center space-y-2">
                <p className="text-xs text-slate-400">
                  {citaDeHoy
                    ? 'Abriendo la comanda de su cita…'
                    : 'No tiene cita hoy. Toca Servir arriba para venderle igual.'}
                </p>
                {!citaDeHoy && !activeSale && (
                  <button
                    onClick={() => (activeLoungeClient ? openSale({ clientId: activeLoungeClient.id }) : newCounterFolio())}
                    disabled={saleBusy}
                    className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-neutral-800 text-[11px] font-bold text-slate-600 dark:text-neutral-300 disabled:opacity-40"
                  >
                    Abrir comanda vacía
                  </button>
                )}
              </div>
            )}
          </div>

        {/* ── Cobro del consumo ──────────────────────────────────────────── */}
        <AnimatePresence>
          {mostrarCobro && activeSale && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-3"
            >
              <motion.div
                initial={{ y: 24, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 24, opacity: 0 }}
                className="w-full max-w-sm rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 p-4 shadow-2xl space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Cobrar consumo</h3>
                    <p className="text-[11px] text-slate-400">
                      {activeSale.clientName ?? 'Mostrador'}
                    </p>
                  </div>
                  <button
                    onClick={() => setMostrarCobro(false)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Lo que falta por cobrar, no el total: si ya hubo anticipo,
                    cobrar el total de nuevo sería cobrar dos veces. */}
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-neutral-800/50 space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-500 dark:text-neutral-400">
                    <span>Total del consumo</span>
                    <span className="font-mono tabular-nums">{plata(activeSale.total)}</span>
                  </div>
                  {Number(activeSale.paidTotal) > 0 && (
                    <div className="flex justify-between text-[11px] text-emerald-600 dark:text-emerald-400">
                      <span>Anticipo / ya cobrado</span>
                      <span className="font-mono tabular-nums">
                        −{plata(activeSale.paidTotal)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-extrabold text-slate-900 dark:text-white pt-1 border-t border-slate-200 dark:border-neutral-700">
                    <span>Por cobrar</span>
                    <span className="font-mono tabular-nums">{plata(pendiente)}</span>
                  </div>
                </div>

                {pendiente > 0 ? (
                  <>
                    <div>
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Método
                      </label>
                      <div className="grid grid-cols-4 gap-1 mt-1">
                        {([
                          { id: 'cash', label: 'Efectivo' },
                          { id: 'card', label: 'Tarjeta' },
                          { id: 'transfer', label: 'Transf.' },
                          { id: 'other', label: 'Otro' },
                        ] as const).map(m => (
                          <button
                            key={m.id}
                            onClick={() => setCobroMetodo(m.id)}
                            className={`py-2 rounded-xl text-[10px] font-bold transition ${
                              cobroMetodo === m.id
                                ? 'bg-[var(--primary)] text-white'
                                : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300'
                            }`}
                          >
                            {m.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Con qué paga. Solo aparece si hay más de una moneda
                        registrada — un salón que solo cobra en pesos no tiene
                        por qué ver esto. */}
                    {(currencies?.length ?? 0) > 1 && cobroMetodo === 'cash' && (
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Paga con
                        </label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {currencies.filter(c => c.active !== false).map(c => (
                            <button
                              key={c.id}
                              onClick={() => setCobroMoneda(c.code)}
                              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition ${
                                monedaActiva?.code === c.code
                                  ? 'bg-slate-800 dark:bg-neutral-200 text-white dark:text-neutral-900'
                                  : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300'
                              }`}
                            >
                              {c.symbol} {c.code}
                            </button>
                          ))}
                        </div>
                        {esExtranjera && (
                          <p className="text-[10px] text-slate-400 mt-1">
                            1 {monedaActiva!.symbol} = {plata(tasa)} · la devuelta se da en {sim}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Billetes: el gesto más rápido del cobro en efectivo */}
                    {cobroMetodo === 'cash' && !!monedaActiva?.denominations?.length && (
                      <div className="grid grid-cols-3 gap-1">
                        {monedaActiva.denominations
                          .filter(d => d.active !== false)
                          .map(d => (
                            <button
                              key={d.id}
                              onClick={() => setCobroMonto(String(Number(d.value)))}
                              className="py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs font-bold text-slate-700 dark:text-neutral-200 tabular-nums hover:border-[var(--primary)] hover:text-[var(--primary)] transition"
                            >
                              {monedaActiva.symbol}{Number(d.value).toLocaleString()}
                            </button>
                          ))}
                        <button
                          onClick={() => setCobroMonto((pendiente / tasa).toFixed(2))}
                          className="py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 transition"
                        >
                          Exacto
                        </button>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Recibido {monedaActiva?.symbol ?? sim}
                        </label>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={cobroMonto}
                          onChange={e => setCobroMonto(e.target.value)}
                          className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-sm font-mono tabular-nums text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          Propina {sim}
                        </label>
                        <input
                          type="number"
                          inputMode="decimal"
                          value={cobroPropina}
                          onChange={e => setCobroPropina(e.target.value)}
                          placeholder="0.00"
                          className="w-full mt-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-sm font-mono tabular-nums text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>

                    {(esExtranjera || vuelto > 0) && (
                      <div className="p-2 rounded-xl bg-slate-50 dark:bg-neutral-800/60 space-y-0.5 text-[11px]">
                        {esExtranjera && (
                          <div className="flex justify-between text-slate-500 dark:text-neutral-400">
                            <span>Equivale a</span>
                            <span className="font-mono tabular-nums">
                              {plata(entregadoEnBase)}
                            </span>
                          </div>
                        )}
                        {vuelto > 0 && (
                          <div className="flex justify-between font-extrabold text-emerald-600 dark:text-emerald-400">
                            <span>Devuelta</span>
                            <span className="font-mono tabular-nums">{plata(vuelto)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    <button
                      onClick={async () => {
                        const monto = Number(cobroMonto);
                        if (!monto || monto <= 0) return;
                        // Nunca registramos más de lo que falta: el resto es vuelto,
                        // no un cobro. Si no, la caja cuadraría de más.
                        // Mandamos lo ENTREGADO en su moneda: el backend
                        // convierte, aplica lo que falta y calcula el vuelto.
                        await paySale({
                          method: cobroMetodo,
                          amount: monto,
                          tip: Number(cobroPropina) || 0,
                          currency: monedaActiva?.code,
                        });
                        setCobroMonto('');
                        setCobroPropina('');
                      }}
                      disabled={saleBusy || !Number(cobroMonto)}
                      className="w-full py-2.5 rounded-xl bg-[var(--primary)] text-white text-xs font-extrabold disabled:opacity-40 transition"
                    >
                      Registrar pago
                    </button>
                  </>
                ) : (
                  <p className="text-center text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                    Consumo cubierto. Ya puedes cerrarlo.
                  </p>
                )}

                <button
                  onClick={async () => {
                    // Foto de la venta ANTES de cerrar: closeSale vacía
                    // activeSale y el recibo se quedaría sin líneas.
                    const paraImprimir = {
                      ...activeSale,
                      closedAt: new Date().toISOString(),
                    };
                    const ok = await closeSale(pendiente > 0);
                    if (!ok) return;
                    setMostrarCobro(false);
                    if (imprimirAlCerrar) imprimir(paraImprimir);
                  }}
                  disabled={saleBusy}
                  className={`w-full py-2.5 rounded-xl text-xs font-extrabold transition disabled:opacity-40 ${
                    pendiente > 0
                      ? 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300'
                      : 'bg-emerald-500 text-white'
                  }`}
                >
                  {pendiente > 0 ? 'Cerrar sin cobrar el resto' : 'Cerrar consumo'}
                </button>

                <label className="flex items-center justify-center gap-2 text-[11px] text-slate-500 dark:text-neutral-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={imprimirAlCerrar}
                    onChange={e => setImprimirAlCerrar(e.target.checked)}
                    className="accent-[var(--primary)]"
                  />
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir recibo al cerrar
                </label>

                <p className="text-[10px] text-center text-slate-400 leading-relaxed">
                  Al cerrar se descuenta el inventario: la receta del servicio y
                  cada producto servido o vendido.
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
    </div>
  );
};
