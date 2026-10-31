import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Package, PackagePlus, Settings2, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useConfirmar } from '../ui/ModalConfirmar';
import { IOSToggle } from '../ui/IOSToggle';
import { FilaProductos, MODOS_PRODUCTO, Productos, cantidad, moverPeriodo, pagos, rango } from '../../services/pagosEspecialistas';

const TARJETA = 'p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3';
const CAMPO = 'min-w-0 px-2.5 py-2 sm:py-1.5 rounded-lg bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[0.8125rem] sm:text-xs text-slate-900 dark:text-white';
const SUBTITULO = 'text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400';

/** Los modos que ya le cobran el producto de cada servicio */
const COBRA_POR_SERVICIO = new Set(['monto', 'porcentaje', 'costo']);

/**
 * El producto de cada especialista en su periodo: lo que gastaron sus
 * servicios según las recetas, lo que se le entregó, lo que le queda en su
 * estante y los avisos cuando se le da más de lo que debería necesitar.
 */
export const ProductosEspecialistas: React.FC<{
  sede: string;
  onConfigurar: (staffId: string) => void;
}> = ({ sede, onConfigurar }) => {
  const { showToast, baseCurrency } = useApp();
  const { confirmar, modalConfirmar } = useConfirmar();
  const [fecha, setFecha] = useState<string | undefined>(undefined);
  const [datos, setDatos] = useState<Productos | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const simbolo = baseCurrency?.symbol ?? '';
  const plata = (n: number | null | undefined) => `${simbolo}${Number(n ?? 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const cargar = useCallback(async () => {
    try { setDatos(await pagos.productos(sede || undefined, fecha)); }
    catch (e: any) { showToast('No se pudo cargar', e?.message ?? '', 'warning'); }
  }, [sede, fecha, showToast]);
  useEffect(() => { void cargar(); }, [cargar]);

  const filas = datos?.filas ?? [];
  const primera = filas[0];
  const conAvisos = filas.filter(f => f.avisos.length).length;

  const deshacer = async (f: FilaProductos, id: string, nombre: string) => {
    const si = await confirmar({
      titulo: `¿Deshacer la entrega de ${nombre}?`,
      mensaje: `Lo que ${f.staff.name.split(' ')[0]} no haya gastado vuelve al almacén de esta sede, y si se le iba a cobrar, ya no se le cobra.`,
      textoConfirmar: 'Deshacer', tono: 'peligro',
    });
    if (!si) return;
    try { await pagos.anularEntrega(id); await cargar(); showToast('Entrega deshecha', '', 'success'); }
    catch (e: any) { showToast('No se pudo', e?.message ?? '', 'warning'); }
  };

  return (
    <div className="space-y-3">
      {modalConfirmar}

      <div className={`${TARJETA} !space-y-2`}>
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-[var(--primary)] shrink-0" />
          <p className="flex-1 min-w-0 text-[0.8125rem] sm:text-xs font-semibold text-slate-900 dark:text-white">
            {primera ? `Periodo ${rango(primera.desde, primera.hasta)}` : 'Periodo actual'}
          </p>
          <button type="button" aria-label="Periodo anterior" disabled={!primera} onClick={() => primera && setFecha(moverPeriodo(primera.desde, primera.hasta, -1))} className="w-9 h-9 sm:w-7 sm:h-7 rounded-lg bg-slate-100 dark:bg-neutral-800 flex items-center justify-center disabled:opacity-40 cursor-pointer">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button type="button" aria-label="Periodo siguiente" disabled={!primera} onClick={() => primera && setFecha(moverPeriodo(primera.desde, primera.hasta, 1))} className="w-9 h-9 sm:w-7 sm:h-7 rounded-lg bg-slate-100 dark:bg-neutral-800 flex items-center justify-center disabled:opacity-40 cursor-pointer">
            <ChevronRight className="w-4 h-4" />
          </button>
          {fecha && <button type="button" onClick={() => setFecha(undefined)} className="text-[0.75rem] font-semibold text-[var(--primary)] cursor-pointer">Hoy</button>}
        </div>
        <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 leading-relaxed">
          Lo que gastan sus servicios sale de las recetas. Lo que le entregas sale del almacén y va a su estante: sus servicios gastan de ahí primero.
          {conAvisos > 0 && <span className="font-semibold text-amber-600"> {conAvisos} con aviso de gasto.</span>}
        </p>
      </div>

      <div className="space-y-2">
        {filas.map(f => {
          const aqui = abierto === f.staff.id;
          const modo = MODOS_PRODUCTO.find(m => m.id === f.modoProducto);
          return (
            <div key={f.staff.id} className={`${TARJETA} !p-0 overflow-hidden`}>
              <button type="button" onClick={() => setAbierto(aqui ? null : f.staff.id)} aria-expanded={aqui} className="w-full p-4 flex items-start gap-3 text-left cursor-pointer">
                <span className="flex-1 min-w-0">
                  <span className="block text-[0.875rem] sm:text-xs font-bold text-slate-900 dark:text-white truncate">{f.staff.name}</span>
                  <span className="block text-[0.75rem] sm:text-[0.6875rem] text-slate-400">
                    {f.servicios} {f.servicios === 1 ? 'servicio' : 'servicios'} · producto {plata(f.costoUso)} · {modo?.nombre ?? 'El salón'}
                    {f.modoProducto === 'monto' && f.cargoProducto ? ` (${plata(f.cargoProducto)})` : ''}
                    {f.modoProducto === 'porcentaje' && f.cargoProducto ? ` (${f.cargoProducto} %)` : ''}
                  </span>
                  {f.avisos.map(a => (
                    <span key={a.texto} className="mt-1 flex items-start gap-1 text-[0.75rem] sm:text-[0.6875rem] font-semibold text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" /> {a.texto}
                    </span>
                  ))}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 mt-0.5 transition ${aqui ? 'rotate-180' : ''}`} />
              </button>

              {aqui && (
                <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-neutral-800 pt-3">
                  <div className="space-y-1">
                    <p className={SUBTITULO}>Gastado según las recetas</p>
                    {f.uso.length === 0 && <p className="text-[0.75rem] text-slate-400">Sus servicios de este periodo no tienen receta.</p>}
                    {f.uso.map(u => (
                      <div key={u.productId} className="flex items-center gap-2 text-[0.8125rem] sm:text-xs">
                        <span className="flex-1 min-w-0 truncate text-slate-700 dark:text-neutral-200">{u.nombre}</span>
                        <span className="tabular-nums text-slate-500">{cantidad(u.cantidad, u.unidad)}</span>
                        <span className="w-24 text-right font-semibold tabular-nums text-slate-900 dark:text-white">{u.costo == null ? 'Sin costo' : plata(u.costo)}</span>
                      </div>
                    ))}
                  </div>

                  {f.estante.length > 0 && (
                    <div className="space-y-1">
                      <p className={SUBTITULO}>Le queda en su estante</p>
                      {f.estante.map(e => (
                        <div key={e.productId} className="flex items-center gap-2 text-[0.8125rem] sm:text-xs">
                          <Package className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="flex-1 min-w-0 truncate text-slate-700 dark:text-neutral-200">{e.nombre}</span>
                          <span className="tabular-nums font-semibold">{cantidad(e.cantidad, e.unidad)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-1">
                    <p className={SUBTITULO}>Entregado en el periodo</p>
                    {f.entregas.length === 0 && <p className="text-[0.75rem] text-slate-400">No se le entregó producto.</p>}
                    {f.entregas.map(e => (
                      <div key={e.id} className="flex flex-wrap sm:flex-nowrap items-center gap-x-2 gap-y-0.5 text-[0.8125rem] sm:text-xs">
                        <span className="basis-full sm:basis-auto sm:flex-1 min-w-0 truncate text-slate-700 dark:text-neutral-200">
                          {e.productName} · {cantidad(e.cantidad, e.unidad)}
                          <span className="text-slate-400"> · {new Date(e.createdAt).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })}</span>
                        </span>
                        {e.cobrar && (
                          <span className={`text-[0.6875rem] font-bold px-2 py-0.5 rounded-full ${e.corteId ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-700'}`}>
                            {e.corteId ? `Cobrado ${plata(e.montoCobro)}` : `Se le cobra ${plata(e.montoCobro)}`}
                          </span>
                        )}
                        {!e.aEstante && <span className="text-[0.6875rem] text-slate-400">No va a su estante</span>}
                        {!e.corteId && (
                          <button type="button" aria-label={`Deshacer la entrega de ${e.productName}`} onClick={() => void deshacer(f, e.id, e.productName)} className="ml-auto sm:ml-0 w-7 h-7 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <FormEntrega fila={f} sede={sede} simbolo={simbolo} onListo={cargar} />

                  <button type="button" onClick={() => onConfigurar(f.staff.id)} className="flex items-center gap-1 text-[0.75rem] font-semibold text-[var(--primary)] cursor-pointer">
                    <Settings2 className="w-3.5 h-3.5" /> Cambiar quién pone el producto
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/** Entregarle producto: sale del almacén de la sede */
const FormEntrega: React.FC<{ fila: FilaProductos; sede: string; simbolo: string; onListo: () => Promise<void> }> = ({ fila, sede, simbolo, onListo }) => {
  const { products, showToast } = useApp();
  const [abierta, setAbierta] = useState(false);
  const [productId, setProductId] = useState('');
  const [cuanto, setCuanto] = useState('1');
  const [aEstante, setAEstante] = useState(true);
  // Quien trae su producto y se lo compra al salón, se le cobra; a quien ya se le cobra por servicio, no
  const [cobrar, setCobrar] = useState(fila.modoProducto === 'propio');
  const [monto, setMonto] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Lo que hay en esta sede; los preparados al momento no se entregan
  const lista = useMemo(() => (products ?? [])
    .filter(p => !p.preparedToOrder)
    .map(p => ({ p, hay: sede ? (p.stockPorSede?.find(s => s.locationId === sede)?.stock ?? 0) : p.stock }))
    .sort((a, b) => a.p.name.localeCompare(b.p.name)), [products, sede]);
  const elegido = lista.find(x => x.p.id === productId);
  const n = Number(cuanto) || 0;
  const costo = elegido?.p.costPrice != null ? elegido.p.costPrice * n : null;
  const enEstante = fila.estante.find(e => e.productId === productId);
  const yaCobraPorServicio = COBRA_POR_SERVICIO.has(fila.modoProducto);

  if (!abierta) {
    return (
      <button type="button" onClick={() => setAbierta(true)} className="w-full sm:w-auto px-3 py-2.5 sm:py-2 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] text-[0.8125rem] sm:text-[0.75rem] font-bold flex items-center justify-center gap-1.5 cursor-pointer">
        <PackagePlus className="w-4 h-4" /> Entregarle producto
      </button>
    );
  }

  const guardar = async () => {
    setGuardando(true);
    try {
      await pagos.entregar(sede || undefined, {
        staffId: fila.staff.id, productId, cantidad: n, aEstante, cobrar,
        montoCobro: cobrar && monto.trim() !== '' ? Number(monto) : null,
      });
      showToast('Entregado', `Salió del almacén${aEstante ? ' y está en su estante' : ''}${cobrar ? '; se le cobra en su próximo corte' : ''}.`, 'success');
      setAbierta(false); setProductId(''); setCuanto('1'); setMonto('');
      await onListo();
    } catch (e: any) {
      showToast('No se pudo entregar', e?.message ?? '', 'warning');
    } finally { setGuardando(false); }
  };

  return (
    <div className="space-y-2.5 p-3 rounded-xl bg-slate-50 dark:bg-neutral-800/50">
      <p className="text-[0.75rem] font-semibold text-slate-700 dark:text-neutral-200">Entregarle producto a {fila.staff.name.split(' ')[0]}</p>
      <div className="flex flex-col sm:flex-row gap-2">
        <select value={productId} onChange={e => setProductId(e.target.value)} aria-label="Producto" className={`${CAMPO} flex-1`}>
          <option value="">Elige el producto</option>
          {lista.map(({ p, hay }) => (
            <option key={p.id} value={p.id} disabled={hay <= 0}>{p.name} · hay {cantidad(hay, p.unit)}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 sm:w-40">
          <input type="number" min={0} step="any" inputMode="decimal" value={cuanto} onChange={e => setCuanto(e.target.value)} aria-label="Cantidad" className={`${CAMPO} w-full`} />
          <span className="text-[0.75rem] text-slate-500 shrink-0">{elegido ? (elegido.p.unit === 'unit' ? 'unid.' : elegido.p.unit) : ''}</span>
        </label>
      </div>
      {enEstante && enEstante.cantidad > 0 && (
        <p className="flex items-start gap-1 text-[0.75rem] font-semibold text-amber-700 dark:text-amber-300">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
          Según sus servicios, todavía debería tener {cantidad(enEstante.cantidad, enEstante.unidad)} de lo que le diste antes.
        </p>
      )}
      {elegido && n > elegido.hay && (
        <p className="text-[0.75rem] font-semibold text-rose-600">En esta sede solo hay {cantidad(elegido.hay, elegido.p.unit)}.</p>
      )}
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.75rem] font-semibold text-slate-700 dark:text-neutral-200">Va a su estante</p>
          <p className="text-[0.6875rem] text-slate-400">Sus servicios gastan de aquí antes que del almacén. Así se ve si gasta de más.</p>
        </div>
        <IOSToggle checked={aEstante} onChange={setAEstante} ariaLabel="Va a su estante" />
      </div>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[0.75rem] font-semibold text-slate-700 dark:text-neutral-200">Se lo cobro en su próximo corte</p>
          <p className="text-[0.6875rem] text-slate-400">{costo != null ? `Cuesta ${simbolo}${costo.toLocaleString('es-DO', { maximumFractionDigits: 2 })}.` : 'Este producto no tiene costo anotado.'}</p>
        </div>
        <IOSToggle checked={cobrar} onChange={setCobrar} ariaLabel="Cobrárselo en su próximo corte" />
      </div>
      {cobrar && yaCobraPorServicio && (
        <p className="text-[0.75rem] font-semibold text-amber-700 dark:text-amber-300">
          A {fila.staff.name.split(' ')[0]} ya se le cobra el producto de cada servicio: si este producto es para sus servicios, se le cobraría dos veces.
        </p>
      )}
      {cobrar && (
        <label className="block space-y-0.5 sm:w-1/2">
          <span className="text-[0.6875rem] text-slate-500">Lo que se le cobra ({simbolo})</span>
          <input type="number" min={0} inputMode="decimal" placeholder={costo != null ? String(Number(costo.toFixed(2))) : 'Monto'} value={monto} onChange={e => setMonto(e.target.value)} className={`${CAMPO} w-full`} />
        </label>
      )}
      <div className="flex gap-2">
        <button type="button" disabled={guardando || !productId || n <= 0 || (!!elegido && n > elegido.hay) || (cobrar && costo == null && !monto)} onClick={() => void guardar()} className="flex-1 sm:flex-none px-4 py-2.5 sm:py-2 rounded-xl bg-[var(--primary)] text-white text-[0.8125rem] sm:text-[0.75rem] font-bold disabled:opacity-40 cursor-pointer">
          {guardando ? 'Entregando…' : 'Entregar'}
        </button>
        <button type="button" onClick={() => setAbierta(false)} className="px-4 py-2.5 sm:py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 text-[0.8125rem] sm:text-[0.75rem] font-semibold cursor-pointer">
          Cancelar
        </button>
      </div>
    </div>
  );
};
