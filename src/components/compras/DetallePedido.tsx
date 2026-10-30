import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, Bot, Check, ChevronRight, Copy, FileText, Loader2, Mail, MessageCircle, PackageCheck, Paperclip, Plus, Printer,
  Search, Send, Trash2, X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useConfirmar } from '../ui/ModalConfirmar';
import {
  PASOS, cantidadTexto, comprasApi, dinero, unidadTexto, type EstadoCompra, type Evento, type LineaNueva, type Pedido,
} from '../../services/compras';
import { EnviarPedido } from './EnviarPedido';
import { RecibirPedido } from './RecibirPedido';
import { CuentaDelPedido } from './PorPagar';
import {
  IconoCanal, NOMBRE_CANAL, PastillaEstado, botonPrincipal, botonSuave, campo, deInputFecha, etiqueta, fechaHora, paraInputFecha,
} from './piezas';

interface Renglon { productId: string; descripcion: string; cantidad: string; precio: string; impuestoPct: string; unidad: string | null; hay: number; unidadInv: string }

const aRenglones = (p: Pedido): Renglon[] => p.lineas.map((l) => ({
  productId: l.productId, descripcion: l.descripcion, cantidad: String(l.cantidad), precio: String(l.precio),
  impuestoPct: String(l.impuestoPct), unidad: l.unidadCompra, hay: l.hay, unidadInv: unidadTexto(l.producto?.unit),
}));

/**
 * Un pedido, como en Odoo: arriba los pasos (cotización → orden → recibida)
 * y los botones de lo que toca ahora; en medio los productos; al lado (o
 * abajo, en el teléfono) el historial con todo lo que se habló, se mandó y
 * se adjuntó, y por dónde.
 */
export const DetallePedido: React.FC<{ id: string; onVolver: () => void; onCambio: () => void; onAbrir: (id: string) => void }> = ({ id, onVolver, onCambio, onAbrir }) => {
  const { showToast, products, navigateToCatalog } = useApp();
  const { confirmar, modalConfirmar } = useConfirmar();
  const [p, setP] = useState<Pedido | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renglones, setRenglones] = useState<Renglon[]>([]);
  const [cambiado, setCambiado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [enviar, setEnviar] = useState<'cotizacion' | 'orden' | null>(null);
  const [recibir, setRecibir] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  /** Cada vez que sube, el historial abre «Dile a Lalan» */
  const [dileALalan, setDileALalan] = useState(0);
  /** Cada vez que sube, «Pago» abre el pago con lo que dijo el proveedor */
  const [pedirPago, setPedirPago] = useState(0);

  const poner = useCallback((x: Pedido) => { setP(x); setRenglones(aRenglones(x)); setCambiado(false); }, []);
  const cargar = useCallback(() => {
    setError(null);
    comprasApi.pedido(id).then(poner).catch((e) => setError((e as Error).message || 'No se pudo abrir el pedido'));
  }, [id, poner]);
  useEffect(() => { cargar(); }, [cargar]);

  const actualizado = (x: Pedido) => { poner(x); onCambio(); };

  const totales = useMemo(() => {
    let subtotal = 0; let impuestos = 0;
    for (const r of renglones) {
      const imp = (Number(r.cantidad) || 0) * (Number(r.precio) || 0);
      subtotal += imp; impuestos += imp * ((Number(r.impuestoPct) || 0) / 100);
    }
    return { subtotal, impuestos, total: subtotal + impuestos };
  }, [renglones]);

  if (error) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={onVolver} className="flex items-center gap-1 text-[0.8125rem] font-bold text-[var(--primary)] cursor-pointer"><ArrowLeft className="w-4 h-4" /> Pedidos</button>
        <p className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 text-[0.8125rem]">{error}</p>
      </div>
    );
  }
  if (!p) return <div className="flex items-center gap-2 text-[0.8125rem] text-slate-400 py-10 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Abriendo el pedido…</div>;

  const s = p.simbolo;
  const cambiar = (i: number, c: Partial<Renglon>) => { setRenglones((r) => r.map((x, j) => (j === i ? { ...x, ...c } : x))); setCambiado(true); };
  const quitar = async (i: number) => {
    if (!(await confirmar({ titulo: `¿Quitar ${renglones[i].descripcion} del pedido?`, tono: 'peligro', textoConfirmar: 'Quitar' }))) return;
    setRenglones((r) => r.filter((_, j) => j !== i)); setCambiado(true);
  };
  const agregar = (productId: string) => {
    const prod = products.find((x) => x.id === productId);
    if (!prod || renglones.some((r) => r.productId === productId)) return;
    setRenglones((r) => [...r, { productId, descripcion: prod.name, cantidad: '1', precio: '', impuestoPct: '', unidad: null, hay: 0, unidadInv: unidadTexto(prod.unit) }]);
    setCambiado(true);
  };
  const guardar = async (avisar = true): Promise<boolean> => {
    setGuardando(true);
    try {
      const lineas: LineaNueva[] = renglones.map((r) => ({
        productId: r.productId, cantidad: Number(r.cantidad), descripcion: r.descripcion,
        precio: r.precio === '' ? null : Number(r.precio), impuestoPct: r.impuestoPct === '' ? null : Number(r.impuestoPct),
      }));
      actualizado(await comprasApi.editar(p.id, { lineas }));
      if (avisar) showToast('Pedido guardado', '', 'success');
      return true;
    } catch (e) { showToast('No se pudo guardar', (e as Error).message, 'warning'); return false; }
    finally { setGuardando(false); }
  };
  const campoPedido = async (c: Parameters<typeof comprasApi.editar>[1]) => {
    try { actualizado(await comprasApi.editar(p.id, c)); } catch (e) { showToast('No se pudo guardar', (e as Error).message, 'warning'); }
  };
  const pasar = async (estado: EstadoCompra, pregunta?: { titulo: string; mensaje?: string; peligro?: boolean; boton: string }) => {
    if (pregunta && !(await confirmar({ titulo: pregunta.titulo, mensaje: pregunta.mensaje, tono: pregunta.peligro ? 'peligro' : 'normal', textoConfirmar: pregunta.boton }))) return;
    if (cambiado) await guardar();
    setOcupado(estado);
    try { actualizado(await comprasApi.estado(p.id, estado)); } catch (e) { showToast('No se pudo', (e as Error).message, 'warning'); }
    finally { setOcupado(null); }
  };
  const lalanPide = async () => {
    if (cambiado) await guardar();
    setOcupado('lalan');
    try {
      const r = await comprasApi.lalanPide(p.id);
      actualizado(r.orden);
      showToast('Lalan pidió el precio', `Le escribió a ${p.proveedor.nombre} por ${r.canal === 'whatsapp' ? 'WhatsApp' : 'correo'}. Te aviso cuando conteste.`, 'success');
    } catch (e) { showToast('Lalan no pudo escribirle', (e as Error).message, 'warning'); }
    finally { setOcupado(null); }
  };
  /** Guarda tal como está, sin mandarle nada al proveedor ni confirmarle */
  const guardarBorrador = async () => {
    if (cambiado) {
      const ok = await guardar(false);
      if (!ok) return;
    }
    showToast(p.estado === 'borrador' ? 'Borrador guardado' : 'Pedido guardado', `No se le mandó nada a ${p.proveedor.nombre}. Lo sigues cuando quieras.`, 'success');
    onVolver();
  };
  const duplicar = async () => {
    setOcupado('duplicar');
    try { const n = await comprasApi.duplicar(p.id); onCambio(); onAbrir(n.id); showToast('Pedido copiado', `${n.numero} quedó en borrador.`, 'success'); }
    catch (e) { showToast('No se pudo copiar', (e as Error).message, 'warning'); }
    finally { setOcupado(null); }
  };

  const enCotizacion = p.estado === 'borrador' || p.estado === 'cotizacion_enviada';
  const porRecibir = p.estado === 'confirmada' || p.estado === 'recibida_parcial';
  const sinRenglones = !renglones.length;
  const seEditaEntrega = p.estado !== 'recibida' && p.estado !== 'cancelada';
  const pasoActual = p.estado === 'recibida_parcial' ? 'confirmada' : p.estado;
  const indicePaso = PASOS.findIndex((x) => x.id === pasoActual);

  return (
    <div className="space-y-3">
      {modalConfirmar}
      {/* ── Migas y número ── */}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onVolver} className="flex items-center gap-1 text-[0.8125rem] font-bold text-[var(--primary)] cursor-pointer"><ArrowLeft className="w-4 h-4" /> Pedidos</button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        <span className="font-bold text-[0.9375rem] text-slate-900 dark:text-white">{p.numero}</span>
        <PastillaEstado estado={p.estado} />
        {p.manejaLalan && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6875rem] font-bold bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300"><Bot className="w-3 h-3" /> Lo lleva Lalan</span>}
      </div>

      {/* ── Lalan pregunta: el sí de la dueña, donde se decide ── */}
      {p.esperaDuena && (
        <div className="p-3 rounded-2xl border border-violet-200 dark:border-violet-900/60 bg-violet-50/70 dark:bg-violet-950/20 flex flex-wrap items-center gap-2">
          <Bot className="w-4 h-4 text-violet-600 shrink-0" />
          <span className="flex-1 min-w-[12rem] text-[0.8125rem] text-violet-900 dark:text-violet-200">{p.preguntaDuena ?? 'Lalan espera tu sí para seguir con este pedido.'}</span>
          {p.pagoReportado && <button type="button" onClick={() => setPedirPago((n) => n + 1)} className={botonPrincipal}><Check className="w-4 h-4" /> Sí, anotar el pago</button>}
          {enCotizacion && <button type="button" onClick={() => void pasar('confirmada', { titulo: `¿Confirmar la compra a ${p.proveedor.nombre}?`, mensaje: `Total ${dinero(s, p.total)}.`, boton: 'Sí, comprar' })} className={botonPrincipal}><Check className="w-4 h-4" /> Sí, comprar</button>}
          <button type="button" onClick={() => setDileALalan((n) => n + 1)} className={botonSuave}><MessageCircle className="w-4 h-4" /> Dile otra cosa</button>
          {/* «No» es no comprar: solo mientras se cotiza o está confirmada */}
          {(enCotizacion || p.estado === 'confirmada') && !p.pagoReportado && <button type="button" onClick={() => void pasar('cancelada', { titulo: '¿No comprar este pedido?', peligro: true, boton: 'No comprar' })} className={botonSuave}>No</button>}
        </div>
      )}

      {/* ── Botones de lo que toca y los pasos ── */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-2">
        <div className="flex flex-wrap gap-1.5 flex-1">
          {enCotizacion && <>
            <button type="button" disabled={sinRenglones} onClick={async () => { if (cambiado) await guardar(); setEnviar('cotizacion'); }} className={p.estado === 'borrador' ? botonPrincipal : botonSuave}>
              <Send className="w-4 h-4" /> {p.estado === 'borrador' ? 'Pedir precio' : 'Volver a pedir precio'}
            </button>
            <button type="button" disabled={sinRenglones || !!ocupado} onClick={async () => { if (cambiado) await guardar(); setEnviar('orden'); }} className={p.estado === 'cotizacion_enviada' ? botonPrincipal : botonSuave}>
              <Check className="w-4 h-4" /> Confirmar y mandar orden
            </button>
            <button type="button" disabled={sinRenglones || !!ocupado} onClick={() => void pasar('confirmada', { titulo: '¿Confirmar sin mandarla?', mensaje: 'Úsalo si ya la acordaste por teléfono o en persona. Queda como orden de compra, lista para recibir.', boton: 'Confirmar' })} className={botonSuave}>
              {ocupado === 'confirmada' ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Solo confirmar
            </button>
            <button type="button" disabled={guardando || !!ocupado} onClick={() => void guardarBorrador()} className={botonSuave} title="Se queda guardado; no se le manda ni se le confirma nada al proveedor">
              {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />} {p.estado === 'borrador' ? 'Guardar borrador' : 'Guardar'}
            </button>
            {p.proveedor.lalanHabla && !p.manejaLalan && (
              <button type="button" disabled={sinRenglones || !!ocupado} onClick={() => void lalanPide()} className={botonSuave} title="Lalan le escribe, anota los precios y te pregunta antes de comprar">
                {ocupado === 'lalan' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />} Que Lalan pida el precio
              </button>
            )}
          </>}
          {porRecibir && <>
            <button type="button" onClick={() => setRecibir(true)} className={botonPrincipal}><PackageCheck className="w-4 h-4" /> Recibir</button>
            <button type="button" onClick={() => setEnviar('orden')} className={botonSuave}><Send className="w-4 h-4" /> Mandar la orden</button>
          </>}
          <button type="button" onClick={() => void comprasApi.abrirPdf(p.id).catch((e) => showToast('No se pudo abrir', (e as Error).message, 'warning'))} className={botonSuave}><Printer className="w-4 h-4" /> Imprimir</button>
          {(p.estado === 'recibida' || p.estado === 'cancelada' || porRecibir) && (
            <button type="button" disabled={!!ocupado} onClick={() => void duplicar()} className={botonSuave}>{ocupado === 'duplicar' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />} Duplicar</button>
          )}
          {p.estado === 'cancelada' && <button type="button" onClick={() => void pasar('borrador')} className={botonSuave}>Volver a borrador</button>}
          {(enCotizacion || p.estado === 'confirmada') && (
            <button type="button" onClick={() => void pasar('cancelada', { titulo: `¿Cancelar ${p.numero}?`, mensaje: p.estado === 'confirmada' ? 'Avísale al proveedor que ya no lo necesitas.' : undefined, peligro: true, boton: 'Cancelar pedido' })} className={`${botonSuave} hover:!border-rose-300 hover:text-rose-600`}>
              <X className="w-4 h-4" /> Cancelar
            </button>
          )}
        </div>
        {p.estado !== 'cancelada' && (
          <ol className="hidden sm:flex items-center rounded-xl overflow-hidden border border-slate-200 dark:border-neutral-700 text-[0.6875rem] font-bold self-start lg:self-auto overflow-x-auto hide-scrollbar max-w-full">
            {PASOS.map((x, i) => (
              <li key={x.id} className={`px-2.5 py-1.5 whitespace-nowrap ${i === indicePaso ? 'bg-[var(--primary)] text-white' : i < indicePaso ? 'text-slate-600 dark:text-neutral-300 bg-slate-50 dark:bg-neutral-800/60' : 'text-slate-400'} ${i ? 'border-l border-slate-200 dark:border-neutral-700' : ''}`}>
                {x.id === 'confirmada' && p.estado === 'recibida_parcial' ? 'Recibida en parte' : x.nombre}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-3 items-start">
        <div className="space-y-3 min-w-0">
        {/* ── El pedido ── */}
        <div className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 space-y-4">
          <div>
            <p className="text-[0.6875rem] uppercase font-bold tracking-wider text-slate-400">{enCotizacion ? 'Solicitud de cotización' : 'Orden de compra'}</p>
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">{p.numero}</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-[0.8125rem]">
            <div>
              <span className={etiqueta}>Proveedor</span>
              <p className="font-bold text-slate-900 dark:text-white">{p.proveedor.nombre}</p>
              <p className="text-slate-500 dark:text-neutral-400 flex flex-wrap gap-x-2">
                {p.proveedor.contacto && <span>{p.proveedor.contacto}</span>}
                {p.proveedor.whatsapp && <a className="text-[#1da851] font-semibold" href={`https://wa.me/${p.proveedor.whatsapp}`} target="_blank" rel="noopener">WhatsApp</a>}
                {p.proveedor.correo && <a className="text-[var(--primary)] font-semibold" href={`mailto:${p.proveedor.correo}`}>{p.proveedor.correo}</a>}
              </p>
            </div>
            <div>
              <span className={etiqueta}>Entregar en</span>
              <p className="font-bold text-slate-900 dark:text-white">{p.sede.nombre}</p>
              {!seEditaEntrega && <p className="text-slate-500 dark:text-neutral-400">{p.entregarEn ?? p.sede.direccion}</p>}
              {!seEditaEntrega && p.recibeNombre && <p className="text-slate-500 dark:text-neutral-400">Recibe: {p.recibeNombre}{p.recibeTelefono ? ` · ${p.recibeTelefono}` : ''}</p>}
            </div>
            {/* Dónde y quién recibe: sale en la hoja y en el mensaje al proveedor */}
            {seEditaEntrega && (
              <div className="sm:col-span-2 grid grid-cols-2 gap-2">
                <label className="col-span-2"><span className={etiqueta}>Dirección de entrega</span>
                  <input className={campo} placeholder={p.sede.direccion ?? 'Calle, número, sector'} defaultValue={p.entregarEn ?? ''} key={`e-${p.entregarEn}`}
                    onBlur={(e) => { if ((e.target.value.trim() || null) !== p.entregarEn) void campoPedido({ entregarEn: e.target.value.trim() || null }); }} /></label>
                <label><span className={etiqueta}>Quién recibe</span>
                  <input className={campo} placeholder="Nombre" defaultValue={p.recibeNombre ?? ''} key={`rn-${p.recibeNombre}`}
                    onBlur={(e) => { if ((e.target.value.trim() || null) !== p.recibeNombre) void campoPedido({ recibeNombre: e.target.value.trim() || null }); }} /></label>
                <label><span className={etiqueta}>Su teléfono</span>
                  <input className={campo} inputMode="tel" placeholder="809 555 1234" defaultValue={p.recibeTelefono ?? ''} key={`rt-${p.recibeTelefono}`}
                    onBlur={(e) => { if ((e.target.value.trim() || null) !== p.recibeTelefono) void campoPedido({ recibeTelefono: e.target.value.trim() || null }); }} /></label>
              </div>
            )}
            {enCotizacion && (
              <label>
                <span className={etiqueta}>Que responda antes del</span>
                <input type="date" className={campo} value={paraInputFecha(p.fechaLimite)} onChange={(e) => void campoPedido({ fechaLimite: deInputFecha(e.target.value) })} />
              </label>
            )}
            <label>
              <span className={etiqueta}>Entrega esperada</span>
              <input type="date" className={campo} value={paraInputFecha(p.entregaEsperada)} disabled={p.estado === 'recibida' || p.estado === 'cancelada'} onChange={(e) => void campoPedido({ entregaEsperada: deInputFecha(e.target.value) })} />
            </label>
            <label>
              <span className={etiqueta}>Número del proveedor (su cotización o factura)</span>
              <input className={campo} defaultValue={p.referenciaProveedor ?? ''} key={`ref-${p.referenciaProveedor}`} onBlur={(e) => { if ((e.target.value || null) !== p.referenciaProveedor) void campoPedido({ referenciaProveedor: e.target.value || null }); }} />
            </label>
            <div>
              <span className={etiqueta}>Moneda</span>
              <p className="font-semibold text-slate-900 dark:text-white pt-2">{p.currencyCode}{p.totalBase != null && p.totalBase !== p.total ? <span className="font-normal text-slate-500"> · ≈ {p.totalBase.toLocaleString('es-DO', { maximumFractionDigits: 0 })} en moneda base</span> : null}</p>
            </div>
          </div>

          {/* Renglones */}
          <div className="space-y-2">
            <h3 className="text-[0.6875rem] uppercase font-bold tracking-wider text-slate-400">Productos</h3>
            {renglones.map((r, i) => {
              const importe = (Number(r.cantidad) || 0) * (Number(r.precio) || 0);
              const linea = p.lineas.find((l) => l.productId === r.productId);
              const llego = linea && linea.recibido > 0;
              return (
                <div key={r.productId} className="p-2.5 rounded-2xl border border-slate-100 dark:border-neutral-800 space-y-2">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <button type="button" onClick={() => navigateToCatalog({ productId: r.productId })} className="font-semibold text-[0.8125rem] text-slate-900 dark:text-white hover:text-[var(--primary)] text-left cursor-pointer">{r.descripcion}</button>
                      <p className="text-[0.6875rem] text-slate-500">
                        {r.unidad ? `${r.unidad} · ` : ''}hay {cantidadTexto(r.hay)} {r.unidadInv} en {p.sede.nombre}{linea?.codigo ? ` · código ${linea.codigo}` : ''}
                        {llego && <span className={linea!.recibido >= linea!.cantidad ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'}> · llegó {cantidadTexto(linea!.recibido)} de {cantidadTexto(linea!.cantidad)}</span>}
                      </p>
                    </div>
                    <span className="text-[0.875rem] font-extrabold tabular-nums text-slate-900 dark:text-white shrink-0">{dinero(s, importe)}</span>
                    {p.seEdita && <button type="button" onClick={() => void quitar(i)} aria-label={`Quitar ${r.descripcion}`} className="grid place-items-center size-7 -mt-1 rounded-full text-slate-400 hover:text-rose-500 hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-pointer shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>}
                  </div>
                  {p.seEdita ? (
                    <div className="grid grid-cols-3 gap-2">
                      <label><span className="text-[0.6875rem] text-slate-500">Cantidad{r.unidad ? ` (${r.unidad})` : ''}</span>
                        <input aria-label="Cantidad" className={`${campo} !py-1.5`} inputMode="decimal" value={r.cantidad} onChange={(e) => cambiar(i, { cantidad: e.target.value.replace(/[^\d.]/g, '') })} /></label>
                      <label><span className="text-[0.6875rem] text-slate-500">Precio ({s})</span>
                        <input aria-label="Precio" className={`${campo} !py-1.5`} inputMode="decimal" placeholder="0" value={r.precio} onChange={(e) => cambiar(i, { precio: e.target.value.replace(/[^\d.]/g, '') })} /></label>
                      <label><span className="text-[0.6875rem] text-slate-500">Impuesto %</span>
                        <input aria-label="Impuesto" className={`${campo} !py-1.5`} inputMode="decimal" value={r.impuestoPct} onChange={(e) => cambiar(i, { impuestoPct: e.target.value.replace(/[^\d.]/g, '') })} /></label>
                    </div>
                  ) : (
                    <p className="text-[0.75rem] text-slate-600 dark:text-neutral-300 tabular-nums">{cantidadTexto(Number(r.cantidad))}{r.unidad ? ` ${r.unidad}` : ''} × {dinero(s, Number(r.precio) || 0)}{Number(r.impuestoPct) ? ` + ${r.impuestoPct}% impuesto` : ''}</p>
                  )}
                </div>
              );
            })}
            {!renglones.length && <p className="text-[0.8125rem] text-slate-500 py-2">Todavía no tiene productos. Agrega lo que vas a pedir.</p>}
            {p.seEdita && <AgregarProducto excluir={renglones.map((r) => r.productId)} onElegir={agregar} />}
            {cambiado && (
              <div className="flex gap-2 pt-1">
                <button type="button" disabled={guardando} onClick={() => void guardar()} className={botonPrincipal}>{guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Guardar cambios</button>
                <button type="button" onClick={() => { setRenglones(aRenglones(p)); setCambiado(false); }} className={botonSuave}>Deshacer</button>
              </div>
            )}
          </div>

          {/* Totales */}
          <div className="flex justify-end">
            <dl className="w-full sm:w-64 text-[0.8125rem] space-y-1">
              <div className="flex justify-between"><dt className="text-slate-500 dark:text-neutral-400">Subtotal</dt><dd className="font-semibold tabular-nums text-slate-900 dark:text-white">{dinero(s, totales.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500 dark:text-neutral-400">Impuestos</dt><dd className="font-semibold tabular-nums text-slate-900 dark:text-white">{dinero(s, totales.impuestos)}</dd></div>
              <div className="flex justify-between pt-1 border-t border-slate-100 dark:border-neutral-800"><dt className="font-bold text-slate-900 dark:text-white">Total</dt><dd className="text-lg font-extrabold tabular-nums text-slate-900 dark:text-white">{dinero(s, totales.total)}</dd></div>
            </dl>
          </div>

          <label className="block">
            <span className={etiqueta}>Condiciones (salen al pie de la hoja)</span>
            <textarea className={`${campo} min-h-[64px]`} placeholder="Pago a 30 días, entregar en horario de 9 a 12…" defaultValue={p.terminos ?? ''} key={`t-${p.terminos}`}
              onBlur={(e) => { if ((e.target.value.trim() || null) !== p.terminos) void campoPedido({ terminos: e.target.value.trim() || null }); }} />
          </label>
        </div>
        {/* ── Lo que se debe de este pedido ── */}
        <CuentaDelPedido pedido={p} onCambio={actualizado} pedirPago={pedirPago} />
        </div>

        {/* ── Historial ── */}
        <Historial pedido={p} onCambio={actualizado} dileALalan={dileALalan} />
      </div>

      <EnviarPedido pedido={enviar ? p : null} como={enviar ?? 'cotizacion'} onClose={() => setEnviar(null)} onEnviado={actualizado} />
      <RecibirPedido pedido={recibir ? p : null} onClose={() => setRecibir(false)} onRecibido={actualizado} />
    </div>
  );
};

/** Buscar un producto del catálogo y sumarlo al pedido */
const AgregarProducto: React.FC<{ excluir: string[]; onElegir: (id: string) => void }> = ({ excluir, onElegir }) => {
  const { products } = useApp();
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState('');
  const quita = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const lista = useMemo(() => products
    .filter((x) => !excluir.includes(x.id) && !(x as any).preparedToOrder && (!q.trim() || quita(x.name).includes(quita(q.trim()))))
    .slice(0, 8), [products, excluir, q]);
  if (!abierto) return <button type="button" onClick={() => setAbierto(true)} className="flex items-center gap-1 text-[0.8125rem] font-bold text-[var(--primary)] cursor-pointer"><Plus className="w-4 h-4" /> Agregar un producto</button>;
  return (
    <div className="space-y-1">
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input autoFocus className={`${campo} pl-9`} placeholder="Busca el producto…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <ul className="rounded-xl border border-slate-200 dark:border-neutral-700 divide-y divide-slate-100 dark:divide-neutral-800 overflow-hidden">
        {lista.map((x) => (
          <li key={x.id}>
            <button type="button" onClick={() => { onElegir(x.id); setQ(''); }} className="w-full px-3 py-2 text-left text-[0.8125rem] hover:bg-slate-50 dark:hover:bg-neutral-800 cursor-pointer flex justify-between gap-2">
              <span className="font-semibold text-slate-900 dark:text-white truncate">{x.name}</span>
              <span className="text-slate-500 shrink-0">hay {cantidadTexto(x.stock)} {unidadTexto(x.unit)}</span>
            </button>
          </li>
        ))}
        {!lista.length && <li className="px-3 py-2 text-[0.8125rem] text-slate-500">No hay productos con ese nombre</li>}
      </ul>
      <button type="button" onClick={() => setAbierto(false)} className="text-[0.75rem] font-bold text-slate-500 cursor-pointer">Listo</button>
    </div>
  );
};

const TITULO_EVENTO: Record<string, string> = {
  nota: 'Nota', estado: 'Estado', envio: 'Enviado', mensaje_entrante: 'Dijo el proveedor', mensaje_saliente: 'Le escribimos',
  recepcion: 'Recepción', adjunto: 'Archivo', lalan: 'Lalan', aprobacion: 'Tu sí', cambio: 'Cambio', pago: 'Pago',
};

/**
 * El historial del pedido (el "chatter" de Odoo): notas, lo que dijo el
 * proveedor, lo que se le mandó y por dónde, los archivos y cada cambio.
 */
const Historial: React.FC<{ pedido: Pedido; onCambio: (p: Pedido) => void; dileALalan: number }> = ({ pedido, onCambio, dileALalan }) => {
  const { showToast } = useApp();
  const { confirmar, modalConfirmar } = useConfirmar();
  const lalanHabla = pedido.proveedor.lalanHabla;
  const [modo, setModo] = useState<'nota' | 'proveedor' | 'lalan'>(pedido.esperaDuena && lalanHabla ? 'lalan' : 'nota');
  const caja = useRef<HTMLElement>(null);
  const escribir = useRef<HTMLTextAreaElement>(null);
  // «Dile otra cosa» en el aviso de Lalan: abre esta pestaña y deja el cursor listo
  useEffect(() => {
    if (!dileALalan || !lalanHabla) return;
    setModo('lalan');
    caja.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => escribir.current?.focus(), 300);
  }, [dileALalan, lalanHabla]);
  const [canal, setCanal] = useState<'whatsapp' | 'correo'>('whatsapp');
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);

  const indicar = async (literal: boolean) => {
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      onCambio(await comprasApi.indicar(pedido.id, texto, literal));
      setTexto('');
      showToast(literal ? 'Mensaje enviado' : 'Lalan le contestó', `Míralo en el historial de ${pedido.numero}.`, 'success');
    } catch (e) { showToast('No salió', (e as Error).message, 'warning'); }
    finally { setEnviando(false); }
  };
  const anotar = async () => {
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      onCambio(await comprasApi.nota(pedido.id, modo === 'proveedor' ? { texto, tipo: 'mensaje_entrante', canal } : { texto }));
      setTexto('');
    } catch (e) { showToast('No se pudo anotar', (e as Error).message, 'warning'); }
    finally { setEnviando(false); }
  };
  const subir = async (lista: FileList | null) => {
    if (!lista?.length) return;
    setSubiendo(true);
    try { onCambio(await comprasApi.adjuntar(pedido.id, Array.from(lista))); }
    catch (e) { showToast('No se pudo adjuntar', (e as Error).message, 'warning'); }
    finally { setSubiendo(false); if (archivo.current) archivo.current.value = ''; }
  };
  const quitarAdjunto = async (id: string, nombre: string) => {
    if (!(await confirmar({ titulo: `¿Quitar ${nombre}?`, tono: 'peligro', textoConfirmar: 'Quitar' }))) return;
    try { await comprasApi.quitarAdjunto(id); onCambio(await comprasApi.pedido(pedido.id)); }
    catch (e) { showToast('No se pudo quitar', (e as Error).message, 'warning'); }
  };

  return (
    <aside ref={caja} className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 space-y-3 lg:sticky lg:top-2 scroll-mt-4">
      {modalConfirmar}
      <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-neutral-800/70">
        {([['nota', 'Nota interna'], ['proveedor', 'Lo que dijo'], ...(lalanHabla ? [['lalan', 'Dile a Lalan']] : [])] as ['nota' | 'proveedor' | 'lalan', string][]).map(([id, nombre]) => (
          <button key={id} type="button" onClick={() => setModo(id)} className={`flex-1 py-1.5 rounded-lg text-[0.75rem] font-bold cursor-pointer ${modo === id ? 'bg-white dark:bg-neutral-900 shadow-sm text-slate-900 dark:text-white' : 'text-slate-500'}`}>{nombre}</button>
        ))}
      </div>
      {modo === 'proveedor' && (
        <div className="flex gap-1.5">
          {(['whatsapp', 'correo'] as const).map((c) => (
            <button key={c} type="button" onClick={() => setCanal(c)} className={`px-2.5 py-1 rounded-full text-[0.6875rem] font-bold border cursor-pointer flex items-center gap-1 ${canal === c ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-slate-200 dark:border-neutral-700 text-slate-500'}`}>
              {c === 'whatsapp' ? <MessageCircle className="w-3 h-3" /> : <Mail className="w-3 h-3" />} Por {NOMBRE_CANAL[c]}
            </button>
          ))}
        </div>
      )}
      {modo === 'lalan' && (
        <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">Lalan le contesta a {pedido.proveedor.nombre} por donde están hablando, con lo que le digas. Nunca compra ni paga sin tu sí.</p>
      )}
      <textarea ref={escribir} className={`${campo} min-h-[70px]`} value={texto} onChange={(e) => setTexto(e.target.value)}
        placeholder={modo === 'proveedor' ? 'Ej.: la caja está a 1,250 y la trae el jueves' : modo === 'lalan' ? 'Ej.: dile que sí, pero que lo traiga el lunes' : 'Escribe una nota para el equipo…'} />
      {modo === 'lalan' ? (
        <div className="flex gap-2">
          <button type="button" disabled={!texto.trim() || enviando} onClick={() => void indicar(false)} className={`${botonPrincipal} flex-1`}>{enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />} Que Lalan se lo diga</button>
          <button type="button" disabled={!texto.trim() || enviando} onClick={() => void indicar(true)} className={botonSuave} title="Sale tal cual lo escribiste">
            <Send className="w-4 h-4" /> Tal cual
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <button type="button" disabled={!texto.trim() || enviando} onClick={() => void anotar()} className={`${botonPrincipal} flex-1`}>{enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Anotar</button>
          <button type="button" disabled={subiendo} onClick={() => archivo.current?.click()} className={botonSuave} title="Adjuntar la cotización, la factura o una foto">
            {subiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />} Adjuntar
          </button>
          <input ref={archivo} type="file" multiple accept="image/*,application/pdf,.xlsx,.xls,.csv,.doc,.docx" className="hidden" onChange={(e) => void subir(e.target.files)} />
        </div>
      )}

      {pedido.adjuntos.length > 0 && (
        <div className="space-y-1">
          <h4 className="text-[0.6875rem] uppercase font-bold tracking-wider text-slate-400">Archivos</h4>
          {pedido.adjuntos.map((a) => (
            <div key={a.id} className="flex items-center gap-2 text-[0.8125rem]">
              <FileText className="w-4 h-4 text-slate-400 shrink-0" />
              <button type="button" onClick={() => void comprasApi.abrirAdjunto(a.id)} className="flex-1 min-w-0 truncate text-left font-semibold text-[var(--primary)] cursor-pointer">{a.nombre}</button>
              <span className="text-[0.6875rem] text-slate-400 shrink-0">{Math.max(1, Math.round(a.tamano / 1024))} KB</span>
              <button type="button" onClick={() => void quitarAdjunto(a.id, a.nombre)} aria-label={`Quitar ${a.nombre}`} className="text-slate-400 hover:text-rose-500 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          ))}
        </div>
      )}

      <ol className="space-y-3 pt-1">
        {pedido.historial.map((e) => <LineaHistorial key={e.id} e={e} />)}
      </ol>
    </aside>
  );
};

const LineaHistorial: React.FC<{ e: Evento }> = ({ e }) => {
  const color = e.autorTipo === 'lalan' ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300'
    : e.tipo === 'mensaje_entrante' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
    : e.tipo === 'envio' ? 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
    : 'bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300';
  const mensaje: string | null = e.tipo === 'envio' && e.datos?.mensaje ? e.datos.mensaje : null;
  const [ver, setVer] = useState(false);
  return (
    <li className="flex gap-2.5">
      <span className={`grid place-items-center size-7 rounded-full shrink-0 ${color}`}><IconoCanal canal={e.canal} autor={e.autorTipo} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.6875rem] text-slate-400">
          <b className="text-slate-600 dark:text-neutral-300">{e.autorNombre ?? (e.autorTipo === 'proveedor' ? 'Proveedor' : 'Lalan')}</b>
          {' · '}{TITULO_EVENTO[e.tipo] ?? e.tipo}{e.canal && e.canal !== 'app' ? ` · ${NOMBRE_CANAL[e.canal] ?? e.canal}` : ''} · {fechaHora(e.creadoEn)}
        </p>
        <p className={`text-[0.8125rem] text-slate-800 dark:text-neutral-100 whitespace-pre-line break-words ${e.tipo === 'mensaje_entrante' ? 'mt-0.5 p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/30' : ''}`}>{e.texto}</p>
        {e.adjuntoId && e.tipo !== 'adjunto' && (
          <button type="button" onClick={() => void comprasApi.abrirAdjunto(e.adjuntoId!)} className="text-[0.75rem] font-bold text-[var(--primary)] cursor-pointer flex items-center gap-1"><FileText className="w-3.5 h-3.5" /> Ver la hoja que se mandó</button>
        )}
        {e.tipo === 'adjunto' && e.adjuntoId && (
          <button type="button" onClick={() => void comprasApi.abrirAdjunto(e.adjuntoId!)} className="text-[0.75rem] font-bold text-[var(--primary)] cursor-pointer">Abrir</button>
        )}
        {mensaje && (
          <>
            <button type="button" onClick={() => setVer(!ver)} className="text-[0.75rem] font-bold text-slate-500 cursor-pointer">{ver ? 'Ocultar el mensaje' : 'Ver el mensaje'}</button>
            {ver && <p className="mt-1 p-2 rounded-xl bg-slate-50 dark:bg-neutral-800/60 text-[0.75rem] whitespace-pre-line">{mensaje}</p>}
          </>
        )}
      </div>
    </li>
  );
};

