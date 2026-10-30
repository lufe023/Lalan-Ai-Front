import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, Loader2, Package, ShoppingCart, Truck, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { EtiquetaSede } from '../ui/CopiarASede';
import { Aparecer } from '../ui/movimiento';
import { comprasApi, cantidadTexto, unidadTexto, type PorPedir as Fila, type Proveedor } from '../../services/compras';
import { ProveedoresDelProducto } from './ProveedoresDelProducto';
import { FichaProveedor } from './Proveedores';
import { botonPrincipal, botonSuave, campo } from './piezas';

/**
 * Lo que hay que pedir en cada sede: lo que bajó de su mínimo y lo que no
 * alcanza para las citas de la semana, menos lo que ya viene pedido. Se
 * marca lo que se quiere y Lalan arma un pedido por proveedor. Lo que no
 * tiene proveedor dice "¿a quién se lo compras?" ahí mismo. Varios marcados
 * pueden ir al mismo proveedor de un toque: queda anotado que se lo vende.
 */
export const PorPedir: React.FC<{ sede?: string; onArmados: (ids: string[]) => void; recarga?: number }> = ({ sede, onArmados, recarga }) => {
  const { showToast } = useApp();
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [armando, setArmando] = useState(false);
  const [producto, setProducto] = useState<{ id: string; name: string; unit?: string } | null>(null);
  const [proveedores, setProveedores] = useState<Proveedor[] | null>(null);
  const [aQuien, setAQuien] = useState('');
  const [asignando, setAsignando] = useState(false);
  const [nuevo, setNuevo] = useState(false);
  const clave = (f: Fila) => `${f.sede.id}:${f.productId}`;

  const cargar = useCallback(() => {
    comprasApi.porPedir(sede).then((r) => {
      setFilas(r);
      setMarcadas(new Set(r.filter((f) => f.proveedor).map(clave)));
    }).catch(() => setFilas([]));
    // También la lista de proveedores: uno pudo darse de alta desde un producto
    comprasApi.proveedores(sede).then(setProveedores).catch(() => setProveedores([]));
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
  const marcadasTodas = (filas ?? []).filter((f) => marcadas.has(clave(f)));
  const sinProveedor = marcadasTodas.filter((f) => !f.proveedor).length;

  /**
   * Los marcados van al proveedor elegido: se anota que él lo vende (el
   * preferido si no tenía ninguno) y así salen en un solo pedido.
   */
  const asignar = async (p: { id: string; nombre: string; currencyCode?: string | null }) => {
    const cambian = marcadasTodas.filter((f) => f.proveedor?.id !== p.id);
    if (!cambian.length) return;
    setAsignando(true);
    try {
      const productos = [...new Set(cambian.map((f) => f.productId))];
      for (const productId of productos) {
        const tenia = cambian.find((f) => f.productId === productId)?.proveedor;
        await comprasApi.guardarVinculo({ proveedorId: p.id, productId, factor: 1, preferido: !tenia });
      }
      setFilas((l) => l?.map((f) => (marcadas.has(clave(f)) ? { ...f, proveedor: { id: p.id, nombre: p.nombre, precio: null, currencyCode: p.currencyCode ?? null, unidadCompra: null, factor: 1 } } : f)) ?? l);
      showToast(`Se los pides a ${p.nombre}`, `${productos.length === 1 ? 'Quedó anotado que te lo vende' : `Quedó anotado que te vende estos ${productos.length}`}. Arma el pedido para pedirle precio.`, 'success');
      setAQuien('');
    } catch (e) { showToast('No se pudo', (e as Error).message, 'warning'); }
    finally { setAsignando(false); }
  };

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
                <input type="checkbox" className="mt-1 size-4 accent-[var(--primary)]" checked={marcadas.has(k)} aria-label={`Pedir ${f.nombre}`}
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
      {marcadasTodas.length > 0 && (
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200/70 dark:border-neutral-700 space-y-2">
          <p className="text-[0.75rem] text-slate-600 dark:text-neutral-300 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            {sinProveedor
              ? <span><b>{sinProveedor === 1 ? '1 marcado no tiene' : `${sinProveedor} marcados no tienen`} proveedor.</b> Elige a quién se los pides.</span>
              : <span>¿Todo a un mismo proveedor? Elige a quién y sale en un solo pedido.</span>}
          </p>
          <div className="flex gap-2">
            <select className={campo} aria-label="Pedírselo a" value={aQuien} disabled={asignando}
              onChange={(e) => {
                if (e.target.value === '__nuevo') { setNuevo(true); return; }
                const p = proveedores?.find((x) => x.id === e.target.value);
                setAQuien(e.target.value);
                if (p) void asignar(p);
              }}>
              <option value="">Pedírselos ({marcadasTodas.length}) a…</option>
              {proveedores?.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              <option value="__nuevo">+ Nuevo proveedor…</option>
            </select>
            {asignando && <span className={botonSuave}><Loader2 className="w-4 h-4 animate-spin" /></span>}
          </div>
        </div>
      )}
      <button type="button" disabled={!cuantas || armando} onClick={() => void armar()} className={`${botonPrincipal} w-full py-3`}>
        {armando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />} Armar {cuantas === 1 ? 'el pedido' : 'los pedidos'} ({cuantas})
      </button>
      <ProveedoresDelProducto producto={producto} onClose={() => { setProducto(null); cargar(); }} />
      <FichaProveedor id={nuevo ? 'nuevo' : null} onClose={() => setNuevo(false)} onCambio={() => undefined}
        onCreado={(p) => { setProveedores((l) => [...(l ?? []), p]); void asignar(p); }} />
    </div>
  );
};
