import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Bot, Check, ChevronRight, HandCoins, Loader2, MessageCircle, Scale, Send, Trophy, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useConfirmar } from '../ui/ModalConfirmar';
import { EtiquetaSede } from '../ui/CopiarASede';
import { Aparecer } from '../ui/movimiento';
import { cantidadTexto, comprasApi, dinero, type Comparacion, type Oferta } from '../../services/compras';
import { PastillaEstado, botonPrincipal, botonSuave, fechaCorta } from './piezas';

type Proveedor = Comparacion['proveedores'][number];

/**
 * Comparar precios: lo mismo pedido a varios proveedores, lado a lado. Lalan
 * lee lo que contesta cada uno (mensaje, PDF o foto) y marca lo más barato
 * por unidad. La dueña elige a quién le compra cada producto; puede pedirle a
 * Lalan que negocie con uno antes de decidir. Nada se compra sin su toque.
 */
export const ComparacionPrecios: React.FC<{ id: string; onVolver: () => void; onAbrirPedido: (id: string) => void; onCambio: () => void }> = ({ id, onVolver, onAbrirPedido, onCambio }) => {
  const { showToast, currencies } = useApp();
  const { confirmar, modalConfirmar } = useConfirmar();
  const [c, setC] = useState<Comparacion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [eleccion, setEleccion] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState<string | null>(null);

  const poner = useCallback((x: Comparacion) => {
    setC(x);
    // Lo sugerido (lo más barato) queda marcado; lo que la dueña ya cambió se respeta
    setEleccion((e) => ({ ...x.sugerida, ...Object.fromEntries(Object.entries(e).filter(([p]) => x.productos.some((y) => y.productId === p))) }));
  }, []);
  const cargar = useCallback(() => {
    setError(null);
    comprasApi.comparacion(id).then(poner).catch((e) => setError((e as Error).message || 'No se pudo abrir la comparación'));
  }, [id, poner]);
  useEffect(() => { cargar(); }, [cargar]);

  const simbolo = useCallback((codigo: string) => currencies.find((m) => m.code === codigo)?.symbol ?? `${codigo} `, [currencies]);

  const total = useMemo(() => {
    if (!c) return { base: 0, renglones: 0, aQuien: [] as string[] };
    let base = 0; let renglones = 0;
    const aQuien = new Set<string>();
    for (const p of c.productos) {
      const o = p.ofertas.find((x) => x.proveedorId === eleccion[p.productId]);
      if (!o) continue;
      renglones++; aQuien.add(o.proveedorId);
      base += o.importeBase ?? 0;
    }
    return { base, renglones, aQuien: [...aQuien].map((pid) => c.proveedores.find((x) => x.proveedor.id === pid)?.proveedor.nombre ?? '') };
  }, [c, eleccion]);

  if (error) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={onVolver} className="flex items-center gap-1 text-[0.8125rem] font-bold text-[var(--primary)] cursor-pointer"><ArrowLeft className="w-4 h-4" /> Pedidos</button>
        <p className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-[0.8125rem]">{error}</p>
      </div>
    );
  }
  if (!c) return <div className="flex items-center gap-2 text-[0.8125rem] text-slate-400 py-10 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Abriendo la comparación…</div>;

  const vivos = c.proveedores.filter((p) => p.estado === 'borrador' || p.estado === 'cotizacion_enviada');
  const sinPedir = vivos.filter((p) => p.estado === 'borrador' && !p.manejaLalan);
  const s = c.moneda.simbolo;
  const nombre = (pid: string) => c.proveedores.find((x) => x.proveedor.id === pid)?.proveedor.nombre ?? '';

  const pedirATodos = async () => {
    setOcupado('pedir');
    try {
      const r = await comprasApi.pedirATodos(id);
      poner(r.comparacion); onCambio();
      const salieron = r.pedidos.filter((x) => x.canal);
      const no = r.pedidos.filter((x) => !x.canal && x.motivo !== 'ya se le pidió');
      showToast(salieron.length ? `Lalan pidió precio a ${salieron.length === 1 ? '1 proveedor' : `${salieron.length} proveedores`}` : 'Lalan no pudo escribirles',
        [salieron.length ? 'Te aviso cuando contesten.' : '', no.map((x) => `${x.proveedor}: ${x.motivo}`).join(' · ')].filter(Boolean).join(' '), no.length ? 'warning' : 'success');
    } catch (e) { showToast('No se pudo', (e as Error).message, 'warning'); }
    finally { setOcupado(null); }
  };
  const mejorar = async (p: Proveedor) => {
    if (!(await confirmar({
      titulo: `¿Pedirle mejor precio a ${p.proveedor.nombre}?`,
      mensaje: 'Lalan le dice que tienes otra cotización más baja, sin decir de quién, y le pregunta si puede mejorarla. No le compra nada.',
      textoConfirmar: 'Sí, pídeselo',
    }))) return;
    setOcupado(`mejorar:${p.proveedor.id}`);
    try {
      const r = await comprasApi.mejorarPrecio(id, p.proveedor.id);
      poner(r.comparacion); onCambio();
      showToast('Lalan está negociando', `Le pidió a ${p.proveedor.nombre} que mejore ${r.renglones === 1 ? '1 precio' : `${r.renglones} precios`}. Si baja, aquí se actualiza.`, 'success');
    } catch (e) { showToast('No se pudo', (e as Error).message, 'warning'); }
    finally { setOcupado(null); }
  };
  const comprar = async () => {
    const lista = Object.entries(eleccion).filter(([productId, pid]) => pid && c.productos.some((x) => x.productId === productId));
    if (!lista.length) return;
    const porProveedor = new Map<string, number>();
    for (const [, pid] of lista) porProveedor.set(pid, (porProveedor.get(pid) ?? 0) + 1);
    const resumen = [...porProveedor].map(([pid, n]) => `${nombre(pid)} (${n === 1 ? '1 producto' : `${n} productos`})`).join(', ');
    const fuera = vivos.filter((p) => !porProveedor.has(p.proveedor.id)).map((p) => p.proveedor.nombre);
    if (!(await confirmar({
      titulo: '¿Comprar lo elegido?',
      mensaje: `Le compras a ${resumen}${total.base ? `, ${dinero(s, total.base)} en total` : ''}.${fuera.length ? ` A ${fuera.join(', ')} se le cancela y Lalan le da las gracias.` : ''}`,
      textoConfirmar: 'Sí, comprar',
    }))) return;
    setOcupado('comprar');
    try {
      const r = await comprasApi.elegir(id, lista.map(([productId, proveedorId]) => ({ productId, proveedorId })));
      poner(r.comparacion); onCambio();
      const confirmadas = r.resultado.filter((x) => x.estado === 'confirmada');
      showToast(confirmadas.length === 1 ? 'Orden de compra lista' : `${confirmadas.length} órdenes de compra listas`,
        `${confirmadas.map((x) => x.proveedor).join(', ')}. Si Lalan llevaba la conversación, ya se lo dijo a cada uno.`, 'success');
      if (confirmadas.length === 1) onAbrirPedido(confirmadas[0].ordenId);
    } catch (e) { showToast('No se pudo comprar', (e as Error).message, 'warning'); }
    finally { setOcupado(null); }
  };

  const precioDe = (o: Oferta) => (o.precio == null ? null : `${dinero(simbolo(o.currencyCode), o.precio)}${o.unidadCompra ? ` / ${o.unidadCompra}` : ''}`);
  const celda = (p: Comparacion['productos'][number], prov: Proveedor) => {
    const o = p.ofertas.find((x) => x.proveedorId === prov.proveedor.id);
    if (!o) return <span className="text-slate-300 dark:text-neutral-600">No se le pidió</span>;
    if (o.sinExistencia) return <span className="text-rose-500 font-semibold">No lo tiene</span>;
    if (o.precio == null) return <span className="text-slate-400 italic">{prov.estado === 'cancelada' ? '—' : 'Esperando precio'}</span>;
    const mejor = p.mejor === prov.proveedor.id && p.ofertas.filter((x) => x.precio != null).length > 1;
    return (
      <span className={`inline-flex flex-col ${mejor ? 'text-emerald-700 dark:text-emerald-400' : ''}`}>
        <span className="font-bold tabular-nums">{precioDe(o)}</span>
        {o.factor !== 1 && o.porUnidadBase != null && <span className="text-[0.6875rem] text-slate-500">{dinero(s, o.porUnidadBase)} c/u</span>}
        {mejor && <span className="text-[0.6875rem] font-bold flex items-center gap-0.5"><Trophy className="w-3 h-3" /> Más barato</span>}
      </span>
    );
  };
  const elegible = (p: Comparacion['productos'][number], pid: string) => {
    const o = p.ofertas.find((x) => x.proveedorId === pid);
    return !!o && !o.sinExistencia && vivos.some((v) => v.proveedor.id === pid);
  };
  const elegir = (productId: string, pid: string) => setEleccion((e) => ({ ...e, [productId]: e[productId] === pid ? '' : pid }));
  const puedeMejorar = (p: Proveedor) => p.cotizados > 0 && vivos.includes(p) && c.productos.some((x) => {
    const suya = x.ofertas.find((o) => o.proveedorId === p.proveedor.id);
    return suya?.porUnidadBase != null && x.ofertas.some((o) => o.proveedorId !== p.proveedor.id && o.porUnidadBase != null && !o.sinExistencia && o.porUnidadBase < suya.porUnidadBase! - 0.005);
  });

  return (
    <div className="space-y-3">
      {modalConfirmar}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onVolver} className="flex items-center gap-1 text-[0.8125rem] font-bold text-[var(--primary)] cursor-pointer"><ArrowLeft className="w-4 h-4" /> Pedidos</button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        <span className="font-bold text-[0.9375rem] text-slate-900 dark:text-white flex items-center gap-1.5"><Scale className="w-4 h-4 text-[var(--primary)]" /> Comparar precios</span>
        <EtiquetaSede locationId={c.sede.id} />
      </div>

      {/* Dónde va la ronda: lo que Lalan sabe, dicho con números */}
      <div className={`p-3 rounded-2xl border flex flex-wrap items-center gap-2 ${c.completa && !c.decidida ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/70 dark:bg-emerald-950/20' : 'border-violet-200 dark:border-violet-900/60 bg-violet-50/70 dark:bg-violet-950/20'}`}>
        <Bot className="w-4 h-4 text-violet-600 shrink-0" />
        <span className="flex-1 min-w-[12rem] text-[0.8125rem] text-slate-800 dark:text-neutral-200">
          {c.decidida ? 'Esta comparación ya se decidió. Abre cada pedido para recibirlo o pagarlo.'
            : c.completa ? <>Ya cotizaron los {c.enRonda}. {c.ahorroBase >= 0.5 && <>Con lo más barato ahorras <b>{dinero(s, c.ahorroBase)}</b> frente a la cotización más cara. </>}Elige y compra.</>
              : sinPedir.length ? <>Todavía no se le ha pedido precio a {sinPedir.map((p) => p.proveedor.nombre).join(', ')}.</>
                : <>Cotizaron {c.cotizaron} de {c.enRonda}. Lalan lee lo que manden (mensaje, PDF o foto) y te avisa cuando estén todos.</>}
        </span>
        {!c.decidida && sinPedir.length > 0 && (
          <button type="button" disabled={!!ocupado} onClick={() => void pedirATodos()} className={botonPrincipal}>
            {ocupado === 'pedir' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Que Lalan pida precio a {sinPedir.length === 1 ? '1' : `los ${sinPedir.length}`}
          </button>
        )}
      </div>

      {/* Los proveedores de la ronda: cómo va cada uno y su conversación */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {c.proveedores.map((p, i) => (
          <Aparecer key={p.ordenId} indice={i} className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-[0.875rem] text-slate-900 dark:text-white truncate">{p.proveedor.nombre}</span>
              <PastillaEstado estado={p.estado} />
            </div>
            <p className="text-[0.75rem] text-slate-500 flex flex-wrap gap-x-2">
              <span>{p.numero}</span>
              <span>{p.completo ? 'Cotizó todo' : `${p.cotizados} de ${p.renglones} con precio`}</span>
              {p.sinExistencia > 0 && <span className="text-rose-500">no tiene {p.sinExistencia}</span>}
              {p.entregaEsperada && <span>entrega {fechaCorta(p.entregaEsperada)}</span>}
            </p>
            {p.cotizados > 0 && <p className="text-[0.9375rem] font-extrabold tabular-nums text-slate-900 dark:text-white">{dinero(simbolo(p.currencyCode), p.total)}</p>}
            {p.esperaDuena && <p className="text-[0.75rem] font-semibold text-violet-600 flex items-center gap-1"><Bot className="w-3.5 h-3.5" /> Lalan te pregunta algo</p>}
            <div className="flex flex-wrap gap-1.5 pt-1">
              <button type="button" onClick={() => onAbrirPedido(p.ordenId)} className={botonSuave}><MessageCircle className="w-4 h-4" /> Conversación</button>
              {puedeMejorar(p) && (
                <button type="button" disabled={!!ocupado} onClick={() => void mejorar(p)} className={botonSuave} title="Lalan le dice que hay otra cotización más baja, sin decir de quién">
                  {ocupado === `mejorar:${p.proveedor.id}` ? <Loader2 className="w-4 h-4 animate-spin" /> : <HandCoins className="w-4 h-4" />} Pedir mejor precio
                </button>
              )}
            </div>
          </Aparecer>
        ))}
      </div>

      {/* Computadora: la tabla de productos contra proveedores; se toca la celda para elegir */}
      <div className="hidden md:block rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 overflow-x-auto">
        <table className="w-full text-[0.8125rem]">
          <thead className="text-[0.6875rem] text-slate-400 text-left">
            <tr className="border-b border-slate-100 dark:border-neutral-800">
              <th className="px-3 py-2 font-bold">Producto</th>
              {c.proveedores.map((p) => <th key={p.ordenId} className="px-3 py-2 font-bold">{p.proveedor.nombre}</th>)}
            </tr>
          </thead>
          <tbody>
            {c.productos.map((p) => (
              <tr key={p.productId} className="border-b border-slate-50 dark:border-neutral-800/60 align-top">
                <td className="px-3 py-2.5">
                  <span className="font-semibold text-slate-900 dark:text-white">{p.descripcion}</span>
                  {p.ahorro >= 0.5 && <span className="block text-[0.6875rem] text-emerald-600">ahorras {dinero(s, p.ahorro)}</span>}
                </td>
                {c.proveedores.map((prov) => {
                  const puede = !c.decidida && elegible(p, prov.proveedor.id);
                  const elegido = eleccion[p.productId] === prov.proveedor.id;
                  const o = p.ofertas.find((x) => x.proveedorId === prov.proveedor.id);
                  return (
                    <td key={prov.ordenId} className="px-2 py-1.5">
                      <button type="button" disabled={!puede} onClick={() => elegir(p.productId, prov.proveedor.id)} aria-pressed={elegido}
                        className={`w-full text-left px-2 py-1.5 rounded-xl border transition ${elegido ? 'border-[var(--primary)] bg-[var(--primary)]/10' : 'border-transparent'} ${puede ? 'cursor-pointer hover:border-[var(--primary)]/40' : 'cursor-default'}`}>
                        <span className="flex items-start gap-1.5">
                          {puede && <span className={`mt-0.5 grid place-items-center size-4 rounded-full border shrink-0 ${elegido ? 'bg-[var(--primary)] border-[var(--primary)] text-white' : 'border-slate-300 dark:border-neutral-600'}`}>{elegido && <Check className="w-3 h-3" />}</span>}
                          <span className="flex-1">{celda(p, prov)}{o && o.precio != null && <span className="block text-[0.6875rem] text-slate-400">{cantidadTexto(o.cantidad)}{o.unidadCompra ? ` ${o.unidadCompra}` : ''}</span>}</span>
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Teléfono: una tarjeta por producto con sus ofertas */}
      <div className="md:hidden space-y-2">
        {c.productos.map((p, i) => (
          <Aparecer key={p.productId} indice={i} className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 space-y-1.5">
            <p className="font-bold text-[0.875rem] text-slate-900 dark:text-white">{p.descripcion}
              {p.ahorro >= 0.5 && <span className="font-semibold text-[0.6875rem] text-emerald-600"> · ahorras {dinero(s, p.ahorro)}</span>}
            </p>
            {c.proveedores.map((prov) => {
              const puede = !c.decidida && elegible(p, prov.proveedor.id);
              const elegido = eleccion[p.productId] === prov.proveedor.id;
              return (
                <button key={prov.ordenId} type="button" disabled={!puede} onClick={() => elegir(p.productId, prov.proveedor.id)} aria-pressed={elegido}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl border text-left text-[0.8125rem] ${elegido ? 'border-[var(--primary)] bg-[var(--primary)]/10' : 'border-slate-100 dark:border-neutral-800'} ${puede ? 'cursor-pointer' : 'cursor-default opacity-80'}`}>
                  {puede && <span className={`grid place-items-center size-4 rounded-full border shrink-0 ${elegido ? 'bg-[var(--primary)] border-[var(--primary)] text-white' : 'border-slate-300 dark:border-neutral-600'}`}>{elegido && <Check className="w-3 h-3" />}</span>}
                  <span className="flex-1 truncate text-slate-700 dark:text-neutral-200">{prov.proveedor.nombre}</span>
                  <span className="text-right">{celda(p, prov)}</span>
                </button>
              );
            })}
          </Aparecer>
        ))}
      </div>

      {!c.decidida && (
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200/70 dark:border-neutral-700 flex flex-wrap items-center gap-2">
          <span className="flex-1 min-w-[12rem] text-[0.8125rem] text-slate-700 dark:text-neutral-200">
            {total.renglones
              ? <>Compras {total.renglones === 1 ? '1 producto' : `${total.renglones} productos`} a <b>{total.aQuien.join(' y ')}</b>{total.base ? <> · <b className="tabular-nums">{dinero(s, total.base)}</b></> : null}</>
              : 'Toca el precio que quieres en cada producto.'}
          </span>
          {Object.values(eleccion).some(Boolean) && (
            <button type="button" onClick={() => setEleccion({})} className={botonSuave}><X className="w-4 h-4" /> Quitar todo</button>
          )}
          <button type="button" disabled={!total.renglones || !!ocupado} onClick={() => void comprar()} className={botonPrincipal}>
            {ocupado === 'comprar' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Comprar lo elegido
          </button>
        </div>
      )}
    </div>
  );
};
