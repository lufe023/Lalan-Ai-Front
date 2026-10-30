import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Banknote, Bot, Check, ChevronRight, Loader2, MessageCircle, Trash2, Wallet } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useConfirmar } from '../ui/ModalConfirmar';
import { IOSModal } from '../ui/IOSModal';
import { ItemAnimado, ListaAnimada } from '../ui/movimiento';
import { useSedes } from '../../hooks/useSedes';
import {
  FORMAS_DE_PAGO, colorVence, comprasApi, dinero, textoVence, type FormaDePago, type Pedido, type PorPagar as Reporte,
} from '../../services/compras';
import { ComoSePaga } from './ComoSePaga';
import { botonPrincipal, botonSuave, campo, deInputFecha, etiqueta, fechaCorta, paraInputFecha } from './piezas';

/** Lo que el modal de pagar necesita saber del pedido */
export interface ParaPagar { id: string; numero: string; proveedor: string; simbolo: string; currencyCode: string; debe: number; monto?: number | null }

/**
 * Anotar un pago o un abono: cuánto, cuándo, cómo y la referencia de la
 * transferencia. Nunca más de lo que se debe.
 */
export const PagarPedido: React.FC<{ pedido: ParaPagar | null; onClose: () => void; onPagado: (p: Pedido) => void }> = ({ pedido, onClose, onPagado }) => {
  const { showToast } = useApp();
  const [monto, setMonto] = useState('');
  const [fecha, setFecha] = useState('');
  const [forma, setForma] = useState<FormaDePago>('transferencia');
  const [referencia, setReferencia] = useState('');
  const [nota, setNota] = useState('');
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    if (!pedido) return;
    setMonto(String(pedido.monto ?? pedido.debe));
    setFecha(paraInputFecha(new Date().toISOString()));
    setReferencia(''); setNota('');
  }, [pedido]);
  if (!pedido) return null;
  const cuanto = Number(monto) || 0;
  const queda = Math.max(0, Math.round((pedido.debe - cuanto) * 100) / 100);
  const pasa = cuanto > pedido.debe + 0.009;

  const guardar = async () => {
    setGuardando(true);
    try {
      const p = await comprasApi.pagar(pedido.id, { monto: cuanto, fecha: deInputFecha(fecha), forma, referencia: referencia.trim() || null, nota: nota.trim() || null });
      onPagado(p);
      showToast(queda < 0.005 ? 'Pedido pagado' : 'Abono anotado', queda < 0.005 ? `${pedido.numero} de ${pedido.proveedor} quedó saldado.` : `Queda ${dinero(pedido.simbolo, queda)} por pagar.`, 'success');
      onClose();
    } catch (e) { showToast('No se pudo anotar el pago', (e as Error).message, 'warning'); }
    finally { setGuardando(false); }
  };

  return (
    <IOSModal isOpen onClose={onClose} title="Anotar pago" subtitle={`${pedido.numero} · ${pedido.proveedor}`} fixedHeight={false}>
      <div className="space-y-3 p-1">
        <p className="text-[0.8125rem] text-slate-600 dark:text-neutral-300">Se debe <b className="text-slate-900 dark:text-white tabular-nums">{dinero(pedido.simbolo, pedido.debe)}</b>.</p>
        <div className="grid grid-cols-2 gap-2">
          <label><span className={etiqueta}>Cuánto pagaste ({pedido.currencyCode})</span>
            <input className={campo} inputMode="decimal" autoFocus value={monto} onChange={(e) => setMonto(e.target.value.replace(/[^\d.]/g, ''))} /></label>
          <label><span className={etiqueta}>Cuándo</span>
            <input type="date" className={campo} value={fecha} onChange={(e) => setFecha(e.target.value)} /></label>
        </div>
        <div>
          <span className={etiqueta}>Cómo</span>
          <div role="radiogroup" aria-label="Cómo pagaste" className="flex flex-wrap gap-1.5">
            {FORMAS_DE_PAGO.map((f) => (
              <button key={f.id} type="button" role="radio" aria-checked={forma === f.id} onClick={() => setForma(f.id)}
                className={`px-3 py-1.5 rounded-full text-[0.75rem] font-bold border cursor-pointer ${forma === f.id ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]' : 'border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300'}`}>
                {f.nombre}
              </button>
            ))}
          </div>
        </div>
        <label className="block"><span className={etiqueta}>Referencia (número de la transferencia o del cheque)</span>
          <input className={campo} value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Opcional" /></label>
        <label className="block"><span className={etiqueta}>Nota</span>
          <input className={campo} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Opcional" /></label>
        {pasa
          ? <p className="text-[0.75rem] font-semibold text-rose-600">Es más de lo que se debe.</p>
          : cuanto > 0 && <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">{queda < 0.005 ? 'Con esto queda saldado.' : `Queda ${dinero(pedido.simbolo, queda)} por pagar.`}</p>}
        <button type="button" disabled={guardando || !(cuanto > 0) || pasa || !fecha} onClick={() => void guardar()} className={`${botonPrincipal} w-full py-3`}>
          {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} {queda < 0.005 && cuanto > 0 ? 'Marcar pagado' : 'Anotar abono'}
        </button>
      </div>
    </IOSModal>
  );
};

/**
 * El pago dentro del pedido: cómo se le paga, cuándo vence, lo abonado y lo
 * que falta, con los pagos anotados. Si el proveedor dijo que ya le pagaron,
 * aquí mismo se marca.
 */
export const CuentaDelPedido: React.FC<{ pedido: Pedido; onCambio: (p: Pedido) => void; pedirPago?: number }> = ({ pedido: p, onCambio, pedirPago }) => {
  const { showToast } = useApp();
  const { confirmar, modalConfirmar } = useConfirmar();
  const [pagar, setPagar] = useState<ParaPagar | null>(null);
  // «Otra» se escribe letra a letra: se guarda cuando deja de escribir
  const guardada = p.cuenta?.condicionesPago ?? p.condicionesPago ?? '';
  const [condiciones, setCondiciones] = useState(guardada);
  useEffect(() => { setCondiciones(guardada); }, [guardada]);
  useEffect(() => {
    if (condiciones === guardada) return;
    const t = window.setTimeout(() => {
      comprasApi.editar(p.id, { condicionesPago: condiciones.trim() || null }).then(onCambio)
        .catch((e) => showToast('No se pudo guardar', (e as Error).message, 'warning'));
    }, 700);
    return () => window.clearTimeout(t);
  }, [condiciones, guardada, p.id, onCambio, showToast]);
  const caja = useRef<HTMLElement>(null);
  // «Sí, anotarlo» en el aviso de arriba: baja hasta aquí con el pago listo
  useEffect(() => {
    if (!pedirPago || !p.cuenta) return;
    caja.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setPagar({ id: p.id, numero: p.numero, proveedor: p.proveedor.nombre, simbolo: p.simbolo, currencyCode: p.currencyCode, debe: p.cuenta.debe, monto: p.pagoReportado?.monto ?? p.cuenta.debe });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pedirPago]);
  const c = p.cuenta;
  if (!c) return null;
  const s = p.simbolo;
  const pct = p.total > 0 ? Math.min(100, Math.round((c.pagado / p.total) * 100)) : 0;
  const editar = async (d: { venceEl?: string | null }) => {
    try { onCambio(await comprasApi.editar(p.id, d)); } catch (e) { showToast('No se pudo guardar', (e as Error).message, 'warning'); }
  };
  const quitar = async (id: string, monto: number) => {
    if (!(await confirmar({ titulo: `¿Quitar el pago de ${dinero(s, monto)}?`, mensaje: 'Vuelve a quedar como deuda.', tono: 'peligro', textoConfirmar: 'Quitar' }))) return;
    try { onCambio(await comprasApi.quitarPago(id)); } catch (e) { showToast('No se pudo quitar', (e as Error).message, 'warning'); }
  };
  const base: ParaPagar = { id: p.id, numero: p.numero, proveedor: p.proveedor.nombre, simbolo: s, currencyCode: p.currencyCode, debe: c.debe };

  return (
    <section ref={caja} id="pago-del-pedido" className="scroll-mt-4 p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 space-y-3">
      {modalConfirmar}
      <div className="flex items-center gap-2">
        <Wallet className="w-4 h-4 text-slate-400" />
        <h3 className="flex-1 text-[0.6875rem] uppercase font-bold tracking-wider text-slate-400">Pago</h3>
        <span className={`text-[0.75rem] font-bold ${c.debe < 0.005 ? 'text-emerald-600 dark:text-emerald-400' : colorVence(c.diasParaVencer)}`}>{textoVence(c, p.condicionesPago)}</span>
      </div>

      {/* El proveedor dice que ya le pagaron: se decide aquí */}
      {p.pagoReportado && (
        <div className="p-3 rounded-2xl border border-violet-200 dark:border-violet-900/60 bg-violet-50/70 dark:bg-violet-950/20 flex flex-wrap items-center gap-2">
          <Bot className="w-4 h-4 text-violet-600 shrink-0" />
          <span className="flex-1 min-w-[12rem] text-[0.8125rem] text-violet-900 dark:text-violet-200">
            {p.proveedor.nombre} dice que ya recibió el pago{p.pagoReportado.monto ? ` de ${dinero(s, p.pagoReportado.monto)}` : ''}. ¿Lo marco?
          </span>
          <button type="button" onClick={() => setPagar({ ...base, monto: p.pagoReportado!.monto ?? c.debe })} className={botonPrincipal}><Check className="w-4 h-4" /> Sí, anotarlo</button>
        </div>
      )}

      <div>
        <div className="flex items-baseline justify-between gap-2 text-[0.8125rem]">
          <span className="text-slate-500 dark:text-neutral-400">Pagado <b className="text-slate-900 dark:text-white tabular-nums">{dinero(s, c.pagado)}</b> de {dinero(s, p.total)}</span>
          {c.debe >= 0.005 && <span className="font-extrabold tabular-nums text-slate-900 dark:text-white">Debes {dinero(s, c.debe)}</span>}
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 dark:bg-neutral-800 overflow-hidden">
          <div className={`h-full rounded-full ${c.debe < 0.005 ? 'bg-emerald-500' : 'bg-[var(--primary)]'}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div><span className={etiqueta}>Cómo se le paga</span>
          <ComoSePaga valor={condiciones} onCambio={setCondiciones} /></div>
        <label><span className={etiqueta}>Vence el</span>
          <input type="date" className={campo} value={paraInputFecha(c.venceEl)} onChange={(e) => void editar({ venceEl: deInputFecha(e.target.value) })} /></label>
      </div>
      {!c.venceEl && c.debe >= 0.005 && <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 -mt-1">La fecha se pone sola cuando llegue el pedido, con los días de crédito.</p>}

      {c.debe >= 0.005 && (
        <button type="button" onClick={() => setPagar(base)} className={`${botonPrincipal} w-full`}><Banknote className="w-4 h-4" /> Anotar pago</button>
      )}

      {p.pagos.length > 0 && (
        <ul className="divide-y divide-slate-100 dark:divide-neutral-800">
          {p.pagos.map((x) => (
            <li key={x.id} className="py-2 flex items-center gap-2 text-[0.8125rem]">
              <Banknote className="w-4 h-4 text-emerald-500 shrink-0" />
              <span className="flex-1 min-w-0">
                <b className="tabular-nums text-slate-900 dark:text-white">{dinero(s, x.monto)}</b>
                <span className="text-slate-500 dark:text-neutral-400"> · {fechaCorta(x.fecha)}{x.forma ? ` · ${FORMAS_DE_PAGO.find((f) => f.id === x.forma)?.nombre ?? x.forma}` : ''}{x.referencia ? ` · ref. ${x.referencia}` : ''}</span>
                {x.nota && <span className="block text-[0.75rem] text-slate-500 dark:text-neutral-400 truncate">{x.nota}</span>}
              </span>
              <button type="button" onClick={() => void quitar(x.id, x.monto)} aria-label={`Quitar el pago de ${dinero(s, x.monto)}`} className="text-slate-400 hover:text-rose-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
      <PagarPedido pedido={pagar} onClose={() => setPagar(null)} onPagado={onCambio} />
    </section>
  );
};

/**
 * «Por pagar»: lo que se le debe a cada proveedor, lo vencido primero. Cada
 * pedido se paga ahí mismo o se abre; al proveedor se le escribe en un toque.
 */
export const PorPagarVista: React.FC<{ sede?: string; recarga: number; onAbrir: (id: string) => void }> = ({ sede, recarga, onAbrir }) => {
  const sedes = useSedes();
  const [r, setR] = useState<Reporte | null>(null);
  const [error, setError] = useState(false);
  const [pagar, setPagar] = useState<ParaPagar | null>(null);
  const cargar = useCallback(() => {
    setError(false);
    comprasApi.porPagar(sede).then(setR).catch(() => { setR(null); setError(true); });
  }, [sede]);
  useEffect(() => { cargar(); }, [cargar, recarga]);

  if (error) return <p className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-[0.8125rem]">No se pudo cargar lo que debes. Intenta de nuevo.</p>;
  if (!r) return <div className="flex items-center gap-2 text-[0.8125rem] text-slate-400 py-6 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Sumando lo que debes…</div>;
  const m = r.moneda.simbolo;

  return (
    <div className="space-y-3">
      {/* En el teléfono «Debes» va a lo ancho: los montos no caben en tres columnas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <div className="col-span-2 sm:col-span-1 p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 min-w-0">
          <span className="block text-xl sm:text-xl font-extrabold tabular-nums text-slate-900 dark:text-white truncate">{dinero(m, r.total)}</span>
          <span className="text-[0.6875rem] font-semibold text-slate-500 dark:text-neutral-400">Debes</span>
        </div>
        <div className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 min-w-0">
          <span className={`block text-[1.0625rem] sm:text-xl font-extrabold tabular-nums truncate ${r.vencido > 0 ? 'text-rose-600' : 'text-slate-900 dark:text-white'}`}>{dinero(m, r.vencido)}</span>
          <span className="text-[0.6875rem] font-semibold text-slate-500 dark:text-neutral-400 flex items-center gap-1">{r.vencido > 0 && <AlertTriangle className="w-3 h-3 text-rose-500" />}Vencido</span>
        </div>
        <div className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 min-w-0">
          <span className={`block text-[1.0625rem] sm:text-xl font-extrabold tabular-nums truncate ${r.estaSemana > 0 ? 'text-amber-600' : 'text-slate-900 dark:text-white'}`}>{dinero(m, r.estaSemana)}</span>
          <span className="text-[0.6875rem] font-semibold text-slate-500 dark:text-neutral-400">Vence esta semana</span>
        </div>
      </div>

      {!r.proveedores.length && (
        <div className="py-10 flex flex-col items-center text-center p-6 bg-white dark:bg-neutral-900 rounded-2xl border border-dashed border-slate-300 dark:border-neutral-800">
          <Wallet className="w-10 h-10 text-slate-300 dark:text-neutral-700 mb-2" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No le debes nada a ningún proveedor</h4>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1 max-w-xs">Cuando confirmes un pedido, aquí sale lo que falta pagar y cuándo vence.</p>
        </div>
      )}

      <ListaAnimada className="space-y-2">
        {r.proveedores.map((g, i) => (
          <ItemAnimado key={g.id} indice={i} className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-[0.9375rem] text-slate-900 dark:text-white truncate">{g.nombre}</span>
                <span className="text-[0.75rem] text-slate-500 dark:text-neutral-400">
                  Debes <b className="text-slate-900 dark:text-white tabular-nums">{dinero(m, g.debe)}</b>
                  {g.vencido > 0 && <span className="text-rose-600 font-semibold"> · {dinero(m, g.vencido)} vencido</span>}
                </span>
              </span>
              {g.whatsapp && (
                <a href={`https://wa.me/${g.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener" aria-label={`Escribirle a ${g.nombre} por WhatsApp`}
                  className="grid place-items-center size-9 rounded-full bg-[#25D366]/10 text-[#1da851] shrink-0"><MessageCircle className="w-4 h-4" /></a>
              )}
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-neutral-800">
              {g.pedidos.map((o) => (
                <li key={o.id} className="py-2 flex items-center gap-2">
                  <button type="button" onClick={() => onAbrir(o.id)} className="flex-1 min-w-0 text-left cursor-pointer group">
                    <span className="flex items-center gap-1 text-[0.8125rem] font-bold text-slate-900 dark:text-white group-hover:text-[var(--primary)] whitespace-nowrap">
                      {o.numero}<ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                    </span>
                    {sedes.length > 1 && <span className="block text-[0.6875rem] text-slate-500 dark:text-neutral-400 truncate">{o.sede.nombre}</span>}
                    <span className={`block text-[0.75rem] font-semibold ${colorVence(o.diasParaVencer)}`}>
                      {textoVence(o, o.condicionesPago)}{o.venceEl && o.diasParaVencer != null ? ` · ${fechaCorta(o.venceEl)}` : ''}
                      {!o.llego && <span className="font-normal text-slate-500 dark:text-neutral-400"> · aún no llega</span>}
                    </span>
                  </button>
                  <span className="text-right shrink-0">
                    <span className="block text-[0.875rem] font-extrabold tabular-nums text-slate-900 dark:text-white">{dinero(o.simbolo, o.debe)}</span>
                    {o.estadoPago === 'abonado' && <span className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">abonado {dinero(o.simbolo, o.pagado)}</span>}
                  </span>
                  <button type="button" onClick={() => setPagar({ id: o.id, numero: o.numero, proveedor: g.nombre, simbolo: o.simbolo, currencyCode: o.currencyCode, debe: o.debe })} className={`${botonSuave} !px-2.5 shrink-0`}>
                    Pagar
                  </button>
                </li>
              ))}
            </ul>
          </ItemAnimado>
        ))}
      </ListaAnimada>
      <PagarPedido pedido={pagar} onClose={() => setPagar(null)} onPagado={() => cargar()} />
    </div>
  );
};
