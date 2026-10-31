import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, CalendarClock, Check, Loader2, Package, Scale, ShoppingCart, Truck, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { usePlan } from '../../context/PlanContext';
import { EtiquetaSede } from '../ui/CopiarASede';
import { Aparecer } from '../ui/movimiento';
import { comprasApi, cantidadTexto, unidadTexto, type PorPedir as Fila, type Proveedor } from '../../services/compras';
import { ProveedoresDelProducto } from './ProveedoresDelProducto';
import { FichaProveedor } from './Proveedores';
import { CompararPrecios } from './CompararPrecios';
import { botonPrincipal, botonSuave, campo } from './piezas';

/**
 * Lo que hay que pedir en cada sede: lo que bajó de su mínimo y lo que no
 * alcanza para las citas de la semana, menos lo que ya viene pedido. Se
 * marca lo que se quiere y Lalan arma un pedido por proveedor. Lo que no
 * tiene proveedor dice "¿a quién se lo compras?" ahí mismo. Varios marcados
 * pueden ir al mismo proveedor de un toque: queda anotado que se lo vende.
 */
export const PorPedir: React.FC<{
  sede?: string; onArmados: (ids: string[]) => void; onComparar: (comparacionId: string) => void; recarga?: number;
  /**
   * Viene de un aviso «Por pedir» («<sede>|<vez>»): todo lo que falta en esa
   * sede queda marcado, también lo que no tiene proveedor. Cada aviso tocado
   * trae otra vez, así se aplica una sola vez por toque.
   */
  marcarSede?: string | null;
}> = ({ sede, onArmados, onComparar, recarga, marcarSede }) => {
  const { showToast } = useApp();
  const { puede } = useAuth();
  // Compras automáticas: Lalan busca proveedores y les escribe ella
  const lalanCompra = usePlan().tieneModulo('compras_lalan') && puede('compras.gestionar');
  const [encargando, setEncargando] = useState(false);
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [armando, setArmando] = useState(false);
  const [producto, setProducto] = useState<{ id: string; name: string; unit?: string } | null>(null);
  const [proveedores, setProveedores] = useState<Proveedor[] | null>(null);
  const [aQuien, setAQuien] = useState('');
  const [asignando, setAsignando] = useState(false);
  const [nuevo, setNuevo] = useState(false);
  const [comparar, setComparar] = useState(false);
  const clave = (f: Fila) => `${f.sede.id}:${f.productId}`;

  // Desde el aviso: lo de esa sede marcado y la caja de «¿a quién?» arriba, a la vista
  const [desdeAviso, setDesdeAviso] = useState(false);
  const marcarRef = useRef(marcarSede);
  marcarRef.current = marcarSede;
  const aplicado = useRef<string | null>(null);
  const vez = useRef(0);
  const cargar = useCallback(() => {
    const esta = ++vez.current;
    comprasApi.porPedir(sede).then((r) => {
      if (esta !== vez.current) return; // llegó tarde: ya se pidió otra sede
      setFilas(r);
      const delAviso = marcarRef.current;
      if (delAviso && delAviso !== aplicado.current) {
        aplicado.current = delAviso;
        const deSede = delAviso.split('|')[0];
        setMarcadas(new Set(r.filter((f) => f.sede.id === deSede).map(clave)));
        setDesdeAviso(true);
      } else {
        setMarcadas(new Set(r.filter((f) => f.proveedor).map(clave)));
      }
    }).catch(() => setFilas([]));
    // También la lista de proveedores: uno pudo darse de alta desde un producto
    comprasApi.proveedores(sede).then(setProveedores).catch(() => setProveedores([]));
  }, [sede]);
  useEffect(() => { cargar(); }, [cargar, recarga, marcarSede]);

  const porSede = useMemo(() => {
    const m = new Map<string, Fila[]>();
    for (const f of filas ?? []) (m.get(f.sede.id) ?? m.set(f.sede.id, []).get(f.sede.id)!).push(f);
    return [...m.values()];
  }, [filas]);

  const armar = async (lista?: Fila[]) => {
    const elegidas = (lista ?? (filas ?? []).filter((f) => marcadas.has(clave(f)))).filter((f) => f.proveedor);
    if (!elegidas.length) return;
    setArmando(true);
    try {
      // Un pedido por sede y proveedor: cada sede recibe lo suyo
      const ids: string[] = [];
      for (const grupo of porSede) {
        const items = elegidas.filter((f) => f.sede.id === grupo[0].sede.id).map((f) => ({ productId: f.productId, faltan: f.faltan, proveedorId: f.proveedor!.id }));
        if (!items.length) continue;
        const r = await comprasApi.armar({ locationId: grupo[0].sede.id, origen: grupo.some((f) => f.motivo === 'citas') ? 'mi_semana' : 'stock_bajo', items });
        ids.push(...r.ordenes.map((o) => o.id));
      }
      showToast(ids.length === 1 ? 'Pedido armado' : `${ids.length} pedidos armados`, 'Revísalos y pide precio o confírmalos.', 'success');
      onArmados(ids);
    } catch (e) { showToast('No se pudo armar', (e as Error).message, 'warning'); }
    finally { setArmando(false); }
  };

  /**
   * «Encárgaselo a Lalan»: por cada sede marcada, Lalan busca quién lo vende
   * (los proveedores del salón y su lista), arma los borradores (para
   * comparar si hay varios) y les pide precio. Lo que no pudo, lo dice con
   * el dato concreto y queda marcado para elegir a quién.
   */
  const encargar = async () => {
    const elegidas = (filas ?? []).filter((f) => marcadas.has(clave(f)));
    if (!elegidas.length) return;
    setEncargando(true);
    const ids: string[] = []; const comparaciones: string[] = []; const encontrados = new Set<string>();
    const sinQuien: string[] = []; const sinCanal: string[] = []; let whatsapp = 0; let correo = 0; let directos = 0;
    try {
      for (const grupo of porSede) {
        const deSede = elegidas.filter((f) => f.sede.id === grupo[0].sede.id);
        if (!deSede.length) continue;
        const r = await comprasApi.encargar(grupo[0].sede.id, deSede.map((f) => f.productId));
        ids.push(...r.ordenes.map((o) => o.id));
        directos += r.ordenes.filter((o) => !o.comparacion).length;
        if (r.comparacionId) comparaciones.push(r.comparacionId);
        r.encontrados.forEach((n) => encontrados.add(n));
        sinQuien.push(...r.sinQuien); sinCanal.push(...r.sinCanal.map((x) => x.proveedor));
        whatsapp += r.pidio.whatsapp; correo += r.pidio.correo;
      }
    } catch (e) { showToast('Lalan no pudo', (e as Error).message, 'warning'); setEncargando(false); return; }
    setEncargando(false);
    const total = whatsapp + correo;
    const por = [whatsapp ? 'WhatsApp' : '', correo ? 'correo' : ''].filter(Boolean).join(' y ');
    if (ids.length) {
      const hallo = encontrados.size ? ` Encontré a ${[...encontrados].join(', ')} en mi lista.` : '';
      const pidio = total ? `Le pedí precio a ${total === 1 ? '1 proveedor' : `${total} proveedores`} por ${por}.` : 'Te dejé los borradores listos.';
      const manual = sinCanal.length ? ` ${[...new Set(sinCanal)].join(', ')} no tiene WhatsApp ni correo: mándaselo tú.` : '';
      showToast('Lalan se encarga', `${pidio}${hallo}${manual} Te aviso cuando contesten; nada se compra sin tu sí.`, 'success');
    }
    if (sinQuien.length) {
      showToast(`No encontré quién venda ${sinQuien.join(', ')}`, 'Dime a quién se lo compras y yo me encargo del resto.', 'warning');
      // Queda marcado solo lo que falta resolver, con la caja de «¿a quién?» a la vista
      setMarcadas(new Set(elegidas.filter((f) => sinQuien.includes(f.nombre)).map(clave)));
      setDesdeAviso(true);
    }
    // Si quedó algo sin proveedor, se sigue aquí para decir a quién; si no, a lo que armó Lalan
    if (!ids.length || sinQuien.length) { cargar(); return; }
    if (comparaciones.length === 1 && !directos) onComparar(comparaciones[0]);
    else onArmados(ids);
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
   * preferido si no tenía ninguno) y Lalan deja el borrador armado de una
   * vez (un pedido por sede), que se abre para revisarlo y mandarlo.
   */
  const asignar = async (p: { id: string; nombre: string; currencyCode?: string | null }) => {
    const cambian = marcadasTodas.filter((f) => f.proveedor?.id !== p.id);
    const conEl = marcadasTodas.map((f) => ({ ...f, proveedor: { id: p.id, nombre: p.nombre, precio: null, currencyCode: p.currencyCode ?? null, unidadCompra: null, factor: 1 } }));
    if (!cambian.length) { await armar(conEl); return; }
    setAsignando(true);
    try {
      const productos = [...new Set(cambian.map((f) => f.productId))];
      for (const productId of productos) {
        const tenia = cambian.find((f) => f.productId === productId)?.proveedor;
        await comprasApi.guardarVinculo({ proveedorId: p.id, productId, factor: 1, preferido: !tenia });
      }
      setFilas((l) => l?.map((f) => conEl.find((x) => clave(x) === clave(f)) ?? f) ?? l);
      showToast(`Se los pides a ${p.nombre}`, `${productos.length === 1 ? 'Quedó anotado que te lo vende' : `Quedó anotado que te vende estos ${productos.length}`}. Te dejo el pedido listo para revisarlo.`, 'success');
      setAQuien('');
    } catch (e) { showToast('No se pudo', (e as Error).message, 'warning'); setAsignando(false); return; }
    setAsignando(false);
    await armar(conEl);
  };

  const cajaAQuien = marcadasTodas.length > 0 && (
        <div className={`p-3 rounded-2xl border space-y-2 ${desdeAviso && sinProveedor ? 'bg-[var(--primary)]/[0.06] border-[var(--primary)]/30' : 'bg-slate-50 dark:bg-neutral-800/60 border-slate-200/70 dark:border-neutral-700'}`}>
          <p className="text-[0.75rem] text-slate-600 dark:text-neutral-300 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{sinProveedor
              ? <><b>{sinProveedor === 1 ? `${marcadasTodas.find((f) => !f.proveedor)?.nombre} no tiene` : `${sinProveedor} marcados no tienen`} proveedor.</b> Elige a quién se {sinProveedor === 1 ? 'lo' : 'los'} compras y te dejo el pedido listo.</>
              : '¿Todo a un mismo proveedor? Elige a quién y sale en un solo pedido.'}
            {!!sinProveedor && lalanCompra && ' O encárgaselo a Lalan: ella busca quién lo vende y les pide precio.'}</span>
          </p>
          <div className="flex gap-2">
            <select className={campo} aria-label="Pedírselo a" value={aQuien} disabled={asignando || armando}
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
            {(asignando || armando) && <span className={botonSuave}><Loader2 className="w-4 h-4 animate-spin" /></span>}
          </div>
        </div>
  );

  return (
    <div className="space-y-3">
      {desdeAviso && cajaAQuien}
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
                  ? <span className="text-[0.75rem] text-slate-600 dark:text-neutral-300 flex items-center gap-1 shrink-0 max-w-[40%] truncate"><Truck className="w-3.5 h-3.5 text-slate-400" />{f.proveedor.nombre}{f.opciones.length > 1 && <span className="text-slate-400"> +{f.opciones.length - 1}</span>}</span>
                  : <button type="button" onClick={() => setProducto({ id: f.productId, name: f.nombre, unit: f.unidad })} className="text-[0.75rem] font-bold text-[var(--primary)] cursor-pointer shrink-0">¿A quién se lo compras?</button>}
              </div>
            );
          })}
        </Aparecer>
      ))}
      {!desdeAviso && cajaAQuien}
      {lalanCompra && (
        <button type="button" disabled={!marcadasTodas.length || encargando || armando} onClick={() => void encargar()} className={`${botonPrincipal} w-full py-3`}
          title="Lalan busca quién lo vende, arma los pedidos y les pide precio. Nada se compra sin tu sí.">
          {encargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />} {encargando ? 'Lalan está buscando proveedores…' : `Encárgaselo a Lalan (${marcadasTodas.length})`}
        </button>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        <button type="button" disabled={!cuantas || armando} onClick={() => void armar()} className={`${lalanCompra ? botonSuave : botonPrincipal} flex-1 py-3`}>
          {armando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />} Armar {cuantas === 1 ? 'el pedido' : 'los pedidos'} ({cuantas})
        </button>
        {/* Lo mismo a varios proveedores: Lalan pide precio a todos y la dueña elige viendo la comparación */}
        <button type="button" disabled={!marcadasTodas.length || armando} onClick={() => setComparar(true)} className={`${botonSuave} flex-1 py-3`} title="Pídele lo mismo a varios proveedores y elige el mejor precio">
          <Scale className="w-4 h-4" /> Comparar precios
        </button>
      </div>
      <CompararPrecios abierto={comparar} filas={marcadasTodas} proveedores={proveedores ?? []} onClose={() => setComparar(false)}
        onCreada={(ids) => { setComparar(false); if (ids.length) onComparar(ids[0]); }} />
      <ProveedoresDelProducto producto={producto} onClose={() => { setProducto(null); cargar(); }} />
      <FichaProveedor id={nuevo ? 'nuevo' : null} onClose={() => setNuevo(false)} onCambio={() => undefined}
        onCreado={(p) => { setProveedores((l) => [...(l ?? []), p]); void asignar(p); }} />
    </div>
  );
};
