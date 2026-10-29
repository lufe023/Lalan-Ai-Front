import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, Loader2, Package, ShoppingCart, Truck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EtiquetaSede } from '../ui/CopiarASede';
import { Aparecer } from '../ui/movimiento';
import { comprasApi, cantidadTexto, unidadTexto, type PorPedir as Fila } from '../../services/compras';
import { ProveedoresDelProducto } from './ProveedoresDelProducto';
import { botonPrincipal } from './piezas';

/**
 * Lo que hay que pedir en cada sede: lo que bajó de su mínimo y lo que no
 * alcanza para las citas de la semana, menos lo que ya viene pedido. Se
 * marca lo que se quiere y Lalan arma un pedido por proveedor. Lo que no
 * tiene proveedor dice "¿a quién se lo compras?" ahí mismo.
 */
export const PorPedir: React.FC<{ sede?: string; onArmados: (ids: string[]) => void; recarga?: number }> = ({ sede, onArmados, recarga }) => {
  const { showToast } = useApp();
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [armando, setArmando] = useState(false);
  const [producto, setProducto] = useState<{ id: string; name: string; unit?: string } | null>(null);
  const clave = (f: Fila) => `${f.sede.id}:${f.productId}`;

  const cargar = useCallback(() => {
    comprasApi.porPedir(sede).then((r) => {
      setFilas(r);
      setMarcadas(new Set(r.filter((f) => f.proveedor).map(clave)));
    }).catch(() => setFilas([]));
  }, [sede]);
  useEffect(() => { cargar(); }, [cargar, recarga]);

  const porSede = useMemo(() => {
    const m = new Map<string, Fila[]>();
    for (const f of filas ?? []) (m.get(f.sede.id) ?? m.set(f.sede.id, []).get(f.sede.id)!).push(f);
    return [...m.values()];
  }, [filas]);

  const armar = async () => {
    const elegidas = (filas ?? []).filter((f) => marcadas.has(clave(f)) && f.proveedor);
    if (!elegidas.length) return;
    setArmando(true);
    try {
      // Un pedido por sede y proveedor: cada sede recibe lo suyo
      const ids: string[] = [];
      for (const grupo of porSede) {
        const items = grupo.filter((f) => elegidas.includes(f)).map((f) => ({ productId: f.productId, faltan: f.faltan, proveedorId: f.proveedor!.id }));
        if (!items.length) continue;
        const r = await comprasApi.armar({ locationId: grupo[0].sede.id, origen: grupo.some((f) => f.motivo === 'citas') ? 'mi_semana' : 'stock_bajo', items });
        ids.push(...r.ordenes.map((o) => o.id));
      }
      showToast(ids.length === 1 ? 'Pedido armado' : `${ids.length} pedidos armados`, 'Revísalos y pide precio o confírmalos.', 'success');
      onArmados(ids);
    } catch (e) { showToast('No se pudo armar', (e as Error).message, 'warning'); }
    finally { setArmando(false); }
  };

  if (!filas) return <div className="flex items-center gap-2 text-[0.8125rem] text-slate-400 py-6 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Revisando el inventario…</div>;
  if (!filas.length) {
    return (
      <div className="py-10 flex flex-col items-center text-center p-6 bg-white dark:bg-neutral-900 rounded-2xl border border-dashed border-slate-300 dark:border-neutral-800">
        <Check className="w-10 h-10 text-emerald-400 mb-2" />
        <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No falta nada</h4>
        <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1 max-w-xs">Nada está bajo su mínimo y lo que piden las citas de la semana alcanza. Lo que ya viene pedido cuenta.</p>
      </div>
    );
  }
  const cuantas = (filas ?? []).filter((f) => marcadas.has(clave(f)) && f.proveedor).length;

  return (
    <div className="space-y-3">
      {porSede.map((grupo, gi) => (
        <Aparecer key={grupo[0].sede.id} indice={gi} className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 space-y-2">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-[var(--primary)]" />
            <span className="flex-1 font-bold text-[0.8125rem] text-slate-900 dark:text-white">Por pedir en {grupo[0].sede.nombre}</span>
            <EtiquetaSede locationId={grupo[0].sede.id} />
          </div>
          {grupo.map((f) => {
            const k = clave(f);
            return (
              <div key={k} className="flex items-start gap-2.5 py-1.5 border-t border-slate-100 dark:border-neutral-800 first:border-0">
                <input type="checkbox" className="mt-1 size-4 accent-[var(--primary)]" disabled={!f.proveedor} checked={marcadas.has(k)} aria-label={`Pedir ${f.nombre}`}
                  onChange={(e) => setMarcadas((m) => { const n = new Set(m); if (e.target.checked) n.add(k); else n.delete(k); return n; })} />
                <div className="flex-1 min-w-0 text-[0.8125rem]">
                  <p className="font-semibold text-slate-900 dark:text-white">{f.nombre}
                    <span className="font-normal text-slate-500"> · faltan {cantidadTexto(f.faltan)} {unidadTexto(f.unidad)}</span>
                  </p>
                  <p className="text-[0.75rem] text-slate-500 flex flex-wrap gap-x-2">
                    <span>hay {cantidadTexto(f.hay)}{f.minimo ? `, mínimo ${cantidadTexto(f.minimo)}` : ''}</span>
                    {f.motivo === 'citas' && <span className="text-rose-600 dark:text-rose-400 flex items-center gap-1"><CalendarClock className="w-3 h-3" /> las citas piden {cantidadTexto(f.necesitaCitas)}</span>}
                    {f.yaPedido > 0 && <span>ya vienen {cantidadTexto(f.yaPedido)}</span>}
                  </p>
                </div>
                {f.proveedor
                  ? <span className="text-[0.75rem] text-slate-600 dark:text-neutral-300 flex items-center gap-1 shrink-0 max-w-[40%] truncate"><Truck className="w-3.5 h-3.5 text-slate-400" />{f.proveedor.nombre}</span>
                  : <button type="button" onClick={() => setProducto({ id: f.productId, name: f.nombre, unit: f.unidad })} className="text-[0.75rem] font-bold text-[var(--primary)] cursor-pointer shrink-0">¿A quién se lo compras?</button>}
              </div>
            );
          })}
        </Aparecer>
      ))}
      <button type="button" disabled={!cuantas || armando} onClick={() => void armar()} className={`${botonPrincipal} w-full py-3`}>
        {armando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />} Armar {cuantas === 1 ? 'el pedido' : 'los pedidos'} ({cuantas})
      </button>
      <ProveedoresDelProducto producto={producto} onClose={() => { setProducto(null); cargar(); }} />
    </div>
  );
};
