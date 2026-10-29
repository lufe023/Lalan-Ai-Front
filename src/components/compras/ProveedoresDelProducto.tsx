import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, ShoppingCart, Star, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { IOSModal } from '../ui/IOSModal';
import { useConfirmar } from '../ui/ModalConfirmar';
import { ABRIR_PEDIDO, comprasApi, unidadTexto, type Proveedor, type Vinculo } from '../../services/compras';
import { FichaProveedor, SugerenciasDeLalan } from './Proveedores';
import { botonPrincipal, botonSuave, campo, etiqueta } from './piezas';

type ConProveedor = Vinculo & { proveedor: { id: string; nombre: string; whatsapp: string | null; correo: string | null; currencyCode: string | null } };
interface Borrador { proveedorId: string; codigo: string; precio: string; unidadCompra: string; factor: string; minimo: string; preferido: boolean }

/**
 * A quién se le compra un producto, desde su tarjeta del catálogo: cada
 * proveedor con su precio, su presentación (caja de 12) y la estrella del
 * preferido, que es a quien Lalan le arma el pedido. Desde aquí mismo se
 * pide.
 */
export const ProveedoresDelProducto: React.FC<{
  producto: { id: string; name: string; unit?: string } | null;
  onClose: () => void;
  onCambio?: () => void;
}> = ({ producto, onClose, onCambio }) => {
  const { showToast, navigateTo } = useApp();
  const { confirmar, modalConfirmar } = useConfirmar();
  const [vinculos, setVinculos] = useState<ConProveedor[] | null>(null);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [b, setB] = useState<Borrador | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [nuevo, setNuevo] = useState(false);
  const [pidiendo, setPidiendo] = useState(false);

  const cargar = useCallback(() => {
    if (!producto) return;
    comprasApi.deProducto(producto.id).then(setVinculos).catch(() => setVinculos([]));
    comprasApi.proveedores().then(setProveedores).catch(() => setProveedores([]));
  }, [producto]);
  useEffect(() => { setVinculos(null); setB(null); cargar(); }, [cargar]);

  if (!producto) return null;
  const unidad = unidadTexto(producto.unit);
  const libres = proveedores.filter((p) => !vinculos?.some((v) => v.proveedorId === p.id));

  const editar = (v?: ConProveedor) => setB(v
    ? { proveedorId: v.proveedorId, codigo: v.codigo ?? '', precio: v.precio == null ? '' : String(v.precio), unidadCompra: v.unidadCompra ?? '', factor: String(v.factor), minimo: v.minimo == null ? '' : String(v.minimo), preferido: v.preferido }
    : { proveedorId: libres[0]?.id ?? '', codigo: '', precio: '', unidadCompra: '', factor: '1', minimo: '', preferido: !vinculos?.length });

  const guardar = async () => {
    if (!b?.proveedorId) return;
    setGuardando(true);
    try {
      await comprasApi.guardarVinculo({
        proveedorId: b.proveedorId, productId: producto.id, codigo: b.codigo || null, precio: b.precio === '' ? null : Number(b.precio),
        unidadCompra: b.unidadCompra || null, factor: Number(b.factor) || 1, minimo: b.minimo === '' ? null : Number(b.minimo), preferido: b.preferido,
      });
      setB(null); cargar(); onCambio?.();
    } catch (e) { showToast('No se pudo guardar', (e as Error).message, 'warning'); }
    finally { setGuardando(false); }
  };
  const quitar = async (v: ConProveedor) => {
    if (!(await confirmar({ titulo: `¿Ya no le compras ${producto.name} a ${v.proveedor.nombre}?`, tono: 'peligro', textoConfirmar: 'Quitar' }))) return;
    try { await comprasApi.quitarVinculo(v.id); cargar(); onCambio?.(); } catch (e) { showToast('No se pudo quitar', (e as Error).message, 'warning'); }
  };
  const preferir = async (v: ConProveedor) => {
    try { await comprasApi.guardarVinculo({ ...v, preferido: true }); cargar(); onCambio?.(); } catch (e) { showToast('No se pudo', (e as Error).message, 'warning'); }
  };
  /** Un borrador con este producto al preferido; abre el pedido en Compras */
  const pedir = async () => {
    setPidiendo(true);
    try {
      const r = await comprasApi.armar({ origen: 'manual', items: [{ productId: producto.id, faltan: 1 }] });
      if (!r.ordenes.length) throw new Error('Este producto todavía no tiene proveedor');
      try { sessionStorage.setItem(ABRIR_PEDIDO, r.ordenes[0].id); } catch { /* nada */ }
      onClose();
      navigateTo('compras');
    } catch (e) { showToast('No se pudo armar el pedido', (e as Error).message, 'warning'); }
    finally { setPidiendo(false); }
  };

  return (
    <>
    <IOSModal isOpen={!!producto} onClose={onClose} title="Proveedores" subtitle={producto.name} fixedHeight={false}>
      {modalConfirmar}
      <div className="space-y-3 p-1">
        <SugerenciasDeLalan productId={producto.id} compacto onAgregado={() => { cargar(); onCambio?.(); }} />
        {!vinculos && <div className="flex items-center gap-2 text-[0.8125rem] text-slate-400 py-4 justify-center"><Loader2 className="w-4 h-4 animate-spin" /></div>}
        {vinculos?.length === 0 && !b && <p className="text-[0.8125rem] text-slate-500">Todavía no dices a quién se lo compras. Agrégalo y Lalan sabrá a quién pedírselo cuando se acabe.</p>}
        {vinculos?.map((v) => (
          <div key={v.id} className="p-3 rounded-2xl border border-slate-200/80 dark:border-neutral-800 flex items-center gap-2">
            <button type="button" onClick={() => void preferir(v)} title={v.preferido ? 'Proveedor preferido' : 'Hacerlo el preferido'} aria-label={v.preferido ? 'Proveedor preferido' : 'Hacerlo el preferido'} className="cursor-pointer">
              <Star className={`w-5 h-5 ${v.preferido ? 'text-amber-500 fill-amber-400' : 'text-slate-300'}`} />
            </button>
            <button type="button" onClick={() => editar(v)} className="flex-1 min-w-0 text-left cursor-pointer">
              <span className="block font-bold text-[0.8125rem] text-slate-900 dark:text-white">{v.proveedor.nombre}</span>
              <span className="block text-[0.75rem] text-slate-500">
                {v.precio != null ? `${v.precio.toLocaleString('es-DO')} ${v.currencyCode ?? ''}` : 'sin precio'}
                {v.unidadCompra ? ` por ${v.unidadCompra}${v.factor > 1 ? ` (${v.factor} ${unidad})` : ''}` : ` por ${unidad}`}
                {v.codigo ? ` · código ${v.codigo}` : ''}{v.minimo ? ` · mínimo ${v.minimo}` : ''}
              </span>
            </button>
            <button type="button" onClick={() => void quitar(v)} aria-label={`Quitar ${v.proveedor.nombre}`} className="text-slate-400 hover:text-rose-500 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}

        {b ? (
          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-neutral-800/60 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <label className="col-span-2"><span className={etiqueta}>Proveedor</span>
                <select className={campo} value={b.proveedorId} disabled={vinculos?.some((v) => v.proveedorId === b.proveedorId)} onChange={(e) => (e.target.value === '__nuevo' ? setNuevo(true) : setB({ ...b, proveedorId: e.target.value }))}>
                  {vinculos?.filter((v) => v.proveedorId === b.proveedorId).map((v) => <option key={v.proveedorId} value={v.proveedorId}>{v.proveedor.nombre}</option>)}
                  {libres.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  {!libres.length && !vinculos?.some((v) => v.proveedorId === b.proveedorId) && <option value="">Crea un proveedor primero</option>}
                  <option value="__nuevo">+ Nuevo proveedor…</option>
                </select>
              </label>
              <label><span className={etiqueta}>Cómo lo vende</span><input className={campo} placeholder={`por ${unidad}, caja de 12…`} value={b.unidadCompra} onChange={(e) => setB({ ...b, unidadCompra: e.target.value })} /></label>
              <label><span className={etiqueta}>¿Cuántas {unidad} trae?</span><input className={campo} inputMode="decimal" value={b.factor} onChange={(e) => setB({ ...b, factor: e.target.value.replace(/[^\d.]/g, '') })} /></label>
              <label><span className={etiqueta}>Precio{b.unidadCompra ? ` por ${b.unidadCompra}` : ''}</span><input className={campo} inputMode="decimal" value={b.precio} onChange={(e) => setB({ ...b, precio: e.target.value.replace(/[^\d.]/g, '') })} /></label>
              <label><span className={etiqueta}>Código en su lista</span><input className={campo} value={b.codigo} onChange={(e) => setB({ ...b, codigo: e.target.value })} /></label>
              <label><span className={etiqueta}>Mínimo que vende</span><input className={campo} inputMode="decimal" value={b.minimo} onChange={(e) => setB({ ...b, minimo: e.target.value.replace(/[^\d.]/g, '') })} /></label>
              <label className="flex items-center gap-2 pt-5 text-[0.8125rem] cursor-pointer"><input type="checkbox" checked={b.preferido} onChange={(e) => setB({ ...b, preferido: e.target.checked })} /> Es el preferido</label>
            </div>
            <div className="flex gap-2">
              <button type="button" disabled={guardando || !b.proveedorId} onClick={() => void guardar()} className={`${botonPrincipal} flex-1`}>{guardando && <Loader2 className="w-4 h-4 animate-spin" />} Guardar</button>
              <button type="button" onClick={() => setB(null)} className={botonSuave}>Cancelar</button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => (libres.length ? editar() : setNuevo(true))} className={botonSuave}><Plus className="w-4 h-4" /> Agregar proveedor</button>
            {!!vinculos?.length && <button type="button" disabled={pidiendo} onClick={() => void pedir()} className={botonPrincipal}>{pidiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />} Pedirlo</button>}
          </div>
        )}
      </div>
    </IOSModal>
    <FichaProveedor id={nuevo ? 'nuevo' : null} onClose={() => setNuevo(false)} onCambio={cargar}
        onCreado={(p) => { setProveedores((l) => [...l, p]); setB({ proveedorId: p.id, codigo: '', precio: '', unidadCompra: '', factor: '1', minimo: '', preferido: !vinculos?.length }); }} />
    </>
  );
};
