import React, { useCallback, useEffect, useState } from 'react';
import { Bot, Loader2, Mail, MessageCircle, Phone, Plus, Sparkles, Star, Trash2, Truck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useSedes } from '../../hooks/useSedes';
import { IOSModal } from '../ui/IOSModal';
import { IOSToggle } from '../ui/IOSToggle';
import { useConfirmar } from '../ui/ModalConfirmar';
import { ItemAnimado, ListaAnimada } from '../ui/movimiento';
import {
  comprasApi, dinero, type DetalleProveedor, type Proveedor, type Sugerencia,
} from '../../services/compras';
import { PastillaEstado, botonPrincipal, botonSuave, campo, etiqueta, fechaCorta } from './piezas';

/**
 * Los proveedores del salón. Son del salón, no de una sede: cada uno dice a
 * qué sedes les vende (vacío = a todas). Tocar uno abre su ficha con lo que
 * se le compra y sus pedidos.
 */
export const ListaProveedores: React.FC<{ sede?: string; onAbrirPedido: (id: string) => void; recarga?: number }> = ({ sede, onAbrirPedido, recarga }) => {
  const [lista, setLista] = useState<Proveedor[] | null>(null);
  const [abierto, setAbierto] = useState<string | 'nuevo' | null>(null);
  const cargar = useCallback(() => { comprasApi.proveedores(sede).then(setLista).catch(() => setLista([])); }, [sede]);
  useEffect(() => { cargar(); }, [cargar, recarga]);

  return (
    <div className="space-y-3">
      <SugerenciasDeLalan onAgregado={cargar} />
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[0.6875rem] uppercase font-bold tracking-wider text-slate-400">{lista ? `${lista.length} ${lista.length === 1 ? 'proveedor' : 'proveedores'}` : 'Proveedores'}</h3>
        <button type="button" onClick={() => setAbierto('nuevo')} className={botonPrincipal}><Plus className="w-4 h-4" /> Nuevo proveedor</button>
      </div>
      {!lista && <div className="flex items-center gap-2 text-[0.8125rem] text-slate-400 py-6 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>}
      {lista && !lista.length && (
        <div className="py-10 flex flex-col items-center text-center p-6 bg-white dark:bg-neutral-900 rounded-2xl border border-dashed border-slate-300 dark:border-neutral-800">
          <Truck className="w-10 h-10 text-slate-300 dark:text-neutral-700 mb-2" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">Todavía no hay proveedores</h4>
          <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1 max-w-xs">Agrega a quién le compras. Después, en cada producto del catálogo, dices qué le compras y a cuánto.</p>
        </div>
      )}
      {lista && lista.length > 0 && (
        <ListaAnimada className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {lista.map((p, i) => (
            <ItemAnimado key={p.id} indice={i} onClick={() => setAbierto(p.id)} className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 cursor-pointer hover:border-[var(--primary)]/40 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <span className="font-bold text-[0.875rem] text-slate-900 dark:text-white">{p.nombre}</span>
                {p.plataformaId && <span title="De la lista de Lalan" className="text-violet-500"><Sparkles className="w-3.5 h-3.5" /></span>}
              </div>
              {p.contacto && <p className="text-[0.75rem] text-slate-500">{p.contacto}</p>}
              <p className="text-[0.75rem] text-slate-500 flex flex-wrap gap-x-2">
                <span>{p.productos ?? 0} {p.productos === 1 ? 'producto' : 'productos'}</span>
                {!!p.pedidosAbiertos && <span className="font-semibold text-[var(--primary)]">{p.pedidosAbiertos} {p.pedidosAbiertos === 1 ? 'pedido abierto' : 'pedidos abiertos'}</span>}
                {p.diasEntrega != null && <span>entrega en {p.diasEntrega} {p.diasEntrega === 1 ? 'día' : 'días'}</span>}
              </p>
              <div className="flex gap-2 text-slate-400">
                {p.whatsapp && <MessageCircle className="w-3.5 h-3.5 text-[#25D366]" />}
                {p.correo && <Mail className="w-3.5 h-3.5" />}
                {p.telefono && <Phone className="w-3.5 h-3.5" />}
                {p.lalanHabla && (p.whatsapp || p.correo) && <span title="Lalan le puede escribir"><Bot className="w-3.5 h-3.5 text-violet-500" /></span>}
              </div>
            </ItemAnimado>
          ))}
        </ListaAnimada>
      )}
      <FichaProveedor id={abierto} onClose={() => setAbierto(null)} onCambio={cargar} onAbrirPedido={(id) => { setAbierto(null); onAbrirPedido(id); }} />
    </div>
  );
};

type Formulario = {
  nombre: string; contacto: string; whatsapp: string; correo: string; telefono: string; direccion: string; rnc: string;
  currencyCode: string; diasEntrega: string; condicionesPago: string; pedidoMinimo: string; notas: string; sedes: string[]; lalanHabla: boolean;
};
const vacio: Formulario = { nombre: '', contacto: '', whatsapp: '', correo: '', telefono: '', direccion: '', rnc: '', currencyCode: '', diasEntrega: '', condicionesPago: '', pedidoMinimo: '', notas: '', sedes: [], lalanHabla: true };
const aFormulario = (p: Proveedor | DetalleProveedor): Formulario => ({
  nombre: p.nombre, contacto: p.contacto ?? '', whatsapp: p.whatsapp ?? '', correo: p.correo ?? '', telefono: p.telefono ?? '',
  direccion: p.direccion ?? '', rnc: p.rnc ?? '', currencyCode: p.currencyCode ?? '', diasEntrega: p.diasEntrega == null ? '' : String(p.diasEntrega),
  condicionesPago: p.condicionesPago ?? '', pedidoMinimo: p.pedidoMinimo == null ? '' : String(p.pedidoMinimo), notas: p.notas ?? '', sedes: p.sedes ?? [], lalanHabla: p.lalanHabla,
});

/** La ficha del proveedor: sus datos, lo que se le compra y sus pedidos */
export const FichaProveedor: React.FC<{
  id: string | 'nuevo' | null; onClose: () => void; onCambio: () => void; onAbrirPedido?: (id: string) => void;
  /** Al crear uno nuevo desde otro lado (un producto), quien llama recibe el proveedor */
  onCreado?: (p: Proveedor) => void;
}> = ({ id, onClose, onCambio, onAbrirPedido, onCreado }) => {
  const { showToast, currencies, navigateToCatalog } = useApp();
  const sedes = useSedes({ todasLasDelSalon: true });
  const { confirmar, modalConfirmar } = useConfirmar();
  const [f, setF] = useState<Formulario>(vacio);
  const [detalle, setDetalle] = useState<DetalleProveedor | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setDetalle(null);
    if (!id) return;
    if (id === 'nuevo') { setF(vacio); return; }
    comprasApi.proveedor(id).then((d) => { setDetalle(d); setF(aFormulario(d)); }).catch((e) => showToast('No se pudo abrir', (e as Error).message, 'warning'));
  }, [id, showToast]);

  const guardar = async () => {
    setGuardando(true);
    const datos: Partial<Proveedor> = {
      nombre: f.nombre, contacto: f.contacto || null, whatsapp: f.whatsapp || null, correo: f.correo || null, telefono: f.telefono || null,
      direccion: f.direccion || null, rnc: f.rnc || null, currencyCode: f.currencyCode || null,
      diasEntrega: f.diasEntrega === '' ? null : Number(f.diasEntrega), condicionesPago: f.condicionesPago || null,
      pedidoMinimo: f.pedidoMinimo === '' ? null : Number(f.pedidoMinimo), notas: f.notas || null, sedes: f.sedes, lalanHabla: f.lalanHabla,
    };
    try {
      if (id === 'nuevo') {
        const p = await comprasApi.crearProveedor(datos);
        showToast('Proveedor guardado', `${p.nombre} ya está en tu lista.`, 'success');
        onCreado?.(p);
      } else if (id) {
        await comprasApi.editarProveedor(id, datos);
        showToast('Proveedor guardado', '', 'success');
      }
      onCambio();
      onClose();
    } catch (e) { showToast('No se pudo guardar', (e as Error).message, 'warning'); }
    finally { setGuardando(false); }
  };

  const borrar = async () => {
    if (!detalle) return;
    const conPedidos = detalle.ordenes.length > 0;
    if (!(await confirmar({
      titulo: conPedidos ? `¿Archivar a ${detalle.nombre}?` : `¿Borrar a ${detalle.nombre}?`,
      mensaje: conPedidos ? 'Tiene pedidos: se archiva para que el historial siga diciendo a quién se le compró.' : 'Se quita de tu lista y de los productos que le comprabas.',
      tono: 'peligro', textoConfirmar: conPedidos ? 'Archivar' : 'Borrar',
    }))) return;
    try { await comprasApi.borrarProveedor(detalle.id); onCambio(); onClose(); }
    catch (e) { showToast('No se pudo', (e as Error).message, 'warning'); }
  };

  const toggleSede = (s: string) => setF((x) => ({ ...x, sedes: x.sedes.includes(s) ? x.sedes.filter((y) => y !== s) : [...x.sedes, s] }));
  const t = (k: keyof Formulario) => ({ value: f[k] as string, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value }) });

  return (
    <IOSModal isOpen={!!id} onClose={onClose} title={id === 'nuevo' ? 'Nuevo proveedor' : detalle?.nombre ?? 'Proveedor'} subtitle={id === 'nuevo' ? 'A quién le compras' : detalle?.contacto ?? undefined}>
      {modalConfirmar}
      <div className="space-y-4 p-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="sm:col-span-2"><span className={etiqueta}>Nombre</span><input className={campo} autoFocus={id === 'nuevo'} placeholder="Cecomsa, S.R.L." {...t('nombre')} /></label>
          <label><span className={etiqueta}>Persona de contacto</span><input className={campo} placeholder="Juan Pérez" {...t('contacto')} /></label>
          <label><span className={etiqueta}>WhatsApp</span><input className={campo} inputMode="tel" placeholder="18095551234" {...t('whatsapp')} /></label>
          <label><span className={etiqueta}>Correo</span><input className={campo} type="email" placeholder="ventas@proveedor.com" {...t('correo')} /></label>
          <label><span className={etiqueta}>Teléfono</span><input className={campo} inputMode="tel" {...t('telefono')} /></label>
          <label><span className={etiqueta}>RNC</span><input className={campo} {...t('rnc')} /></label>
          <label><span className={etiqueta}>Moneda en que factura</span>
            <select className={campo} {...t('currencyCode')}>
              <option value="">La del salón</option>
              {currencies.filter((c) => c.active !== false).map((c) => <option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}
            </select>
          </label>
          <label><span className={etiqueta}>Días que tarda en entregar</span><input className={campo} inputMode="numeric" placeholder="3" value={f.diasEntrega} onChange={(e) => setF({ ...f, diasEntrega: e.target.value.replace(/\D/g, '') })} /></label>
          <label><span className={etiqueta}>Cómo se le paga</span><input className={campo} placeholder="Contado, 15 días, 30 días…" {...t('condicionesPago')} /></label>
          <label><span className={etiqueta}>Pedido mínimo</span><input className={campo} inputMode="decimal" value={f.pedidoMinimo} onChange={(e) => setF({ ...f, pedidoMinimo: e.target.value.replace(/[^\d.]/g, '') })} /></label>
          <label className="sm:col-span-2"><span className={etiqueta}>Dirección</span><input className={campo} {...t('direccion')} /></label>
          <label className="sm:col-span-2"><span className={etiqueta}>Notas</span><textarea className={`${campo} min-h-[60px]`} {...t('notas')} /></label>
        </div>

        {sedes.length > 1 && (
          <div>
            <span className={etiqueta}>Le vende a {f.sedes.length ? 'estas sedes' : 'todas las sedes'}</span>
            <div className="flex flex-wrap gap-1.5">
              {sedes.map((s) => (
                <button key={s.id} type="button" onClick={() => toggleSede(s.id)} className={`px-3 py-1.5 rounded-full text-xs font-bold border cursor-pointer ${f.sedes.includes(s.id) ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300'}`}>{s.name}</button>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-violet-50/70 dark:bg-violet-950/20">
          <span className="text-[0.8125rem] text-slate-700 dark:text-neutral-200">
            <b className="flex items-center gap-1"><Bot className="w-4 h-4 text-violet-600" /> Lalan le puede escribir</b>
            <span className="block text-[0.6875rem] text-slate-500">Pedir precios y preguntar por la entrega. Lo que escriba a tu WhatsApp va a su pedido en Compras, no a los chats de clientas. Nunca compra sin tu sí.</span>
          </span>
          <IOSToggle checked={f.lalanHabla} onChange={(v) => setF({ ...f, lalanHabla: v })} ariaLabel="Lalan le puede escribir" />
        </div>

        <div className="flex gap-2">
          <button type="button" disabled={guardando || !f.nombre.trim()} onClick={() => void guardar()} className={`${botonPrincipal} flex-1 py-3`}>{guardando && <Loader2 className="w-4 h-4 animate-spin" />} Guardar</button>
          {detalle && <button type="button" onClick={() => void borrar()} className={`${botonSuave} hover:!border-rose-300 hover:text-rose-600`} aria-label="Borrar proveedor"><Trash2 className="w-4 h-4" /></button>}
        </div>

        {detalle && (
          <>
            <div className="space-y-1.5">
              <h4 className="text-[0.6875rem] uppercase font-bold tracking-wider text-slate-400">Lo que le compras</h4>
              {!detalle.productos.length && <p className="text-[0.8125rem] text-slate-500">Nada todavía. En Catálogo → Productos, toca «Proveedor» en cada producto para decir qué le compras.</p>}
              {detalle.productos.map((v) => (
                <button key={v.id} type="button" onClick={() => { onClose(); navigateToCatalog({ productId: v.productId }); }} className="w-full flex items-center justify-between gap-2 py-1.5 border-b border-slate-100 dark:border-neutral-800 text-left cursor-pointer">
                  <span className="text-[0.8125rem] font-semibold text-slate-900 dark:text-white flex items-center gap-1">{v.preferido && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />}{v.producto.name}</span>
                  <span className="text-[0.75rem] text-slate-500 shrink-0">{v.precio != null ? dinero('', v.precio) : 'sin precio'}{v.unidadCompra ? ` · ${v.unidadCompra}` : ''}</span>
                </button>
              ))}
            </div>
            {detalle.ordenes.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-[0.6875rem] uppercase font-bold tracking-wider text-slate-400">Pedidos</h4>
                {detalle.ordenes.map((o) => (
                  <button key={o.id} type="button" onClick={() => onAbrirPedido?.(o.id)} className="w-full flex items-center justify-between gap-2 py-1.5 border-b border-slate-100 dark:border-neutral-800 text-left cursor-pointer">
                    <span className="text-[0.8125rem] font-bold text-slate-900 dark:text-white">{o.numeroTexto} <span className="font-normal text-slate-500">· {fechaCorta(o.creadoEn)}</span></span>
                    <span className="flex items-center gap-2 shrink-0"><span className="text-[0.75rem] tabular-nums">{dinero('', o.total)} {o.currencyCode}</span><PastillaEstado estado={o.estado} /></span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </IOSModal>
  );
};

/**
 * Proveedores de la lista de Lalan que distribuyen lo que el salón compra,
 * en su ciudad. Sale solo si Plataforma lo activó para el salón. Un toque y
 * queda en su lista, ya vinculado a esos productos.
 */
export const SugerenciasDeLalan: React.FC<{ productId?: string; onAgregado: (proveedorId: string) => void; compacto?: boolean }> = ({ productId, onAgregado, compacto }) => {
  const { showToast } = useApp();
  const [lista, setLista] = useState<Sugerencia[]>([]);
  const [agregando, setAgregando] = useState<string | null>(null);
  useEffect(() => { comprasApi.sugerencias(productId).then((r) => setLista(r.sugerencias ?? [])).catch(() => setLista([])); }, [productId]);
  if (!lista.length) return null;
  const agregar = async (s: Sugerencia) => {
    setAgregando(s.id);
    try {
      const r = await comprasApi.adoptar(s.id, s.productos.map((p) => p.id));
      showToast('Proveedor agregado', `${s.nombre} quedó en tu lista con ${s.productos.length === 1 ? s.productos[0].nombre : `${s.productos.length} productos`}.`, 'success');
      setLista((l) => l.filter((x) => x.id !== s.id));
      onAgregado(r.proveedorId);
    } catch (e) { showToast('No se pudo agregar', (e as Error).message, 'warning'); }
    finally { setAgregando(null); }
  };
  return (
    <div className="p-3 rounded-2xl border border-violet-200 dark:border-violet-900/60 bg-violet-50/60 dark:bg-violet-950/20 space-y-2">
      <p className="text-[0.75rem] font-bold text-violet-800 dark:text-violet-300 flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> Lalan conoce quién te lo vende</p>
      {lista.slice(0, compacto ? 2 : 5).map((s) => (
        <div key={s.id} className="flex flex-wrap items-center gap-2">
          <div className="flex-1 min-w-[12rem] text-[0.8125rem]">
            <b className="text-slate-900 dark:text-white">{s.nombre}</b>
            <span className="text-slate-600 dark:text-neutral-300"> distribuye {s.productos.slice(0, 3).map((p) => p.nombre).join(', ')}{s.productos.length > 3 ? ` y ${s.productos.length - 3} más` : ''}{s.ciudades.length ? ` en ${s.ciudades.slice(0, 2).join(', ')}` : ''}.</span>
          </div>
          <button type="button" disabled={agregando === s.id} onClick={() => void agregar(s)} className={botonPrincipal}>{agregando === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Agregarlo</button>
        </div>
      ))}
    </div>
  );
};
