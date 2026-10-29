import React, { useEffect, useState } from 'react';
import { Loader2, PackageCheck } from 'lucide-react';
import { IOSModal } from '../ui/IOSModal';
import { IOSToggle } from '../ui/IOSToggle';
import { useApp } from '../../context/AppContext';
import { cantidadTexto, comprasApi, unidadTexto, type Pedido } from '../../services/compras';
import { botonPrincipal, campo, deInputFecha, etiqueta } from './piezas';

interface Fila { lineaId: string; cantidad: string; costo: string; lote: string; vence: string }

/**
 * Lo que llegó del pedido. Viene puesto lo que falta por llegar; se corrige
 * lo que vino distinto. Entra al inventario de la sede del pedido con su
 * lote y vencimiento, y el costo nuevo queda como último precio del proveedor.
 */
export const RecibirPedido: React.FC<{ pedido: Pedido | null; onClose: () => void; onRecibido: (p: Pedido) => void }> = ({ pedido, onClose, onRecibido }) => {
  const { showToast, recargarCatalogo } = useApp();
  const [filas, setFilas] = useState<Fila[]>([]);
  const [cerrarResto, setCerrarResto] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!pedido) return;
    setCerrarResto(false);
    setFilas(pedido.lineas.map((l) => ({
      lineaId: l.id, cantidad: String(Math.max(0, Math.round((l.cantidad - l.recibido) * 1000) / 1000)), costo: String(l.precio), lote: '', vence: '',
    })));
  }, [pedido]);

  if (!pedido) return null;
  const cambiar = (i: number, c: Partial<Fila>) => setFilas((f) => f.map((x, j) => (j === i ? { ...x, ...c } : x)));
  const llega = filas.filter((f) => Number(f.cantidad) > 0);
  const quedaAlgo = pedido.lineas.some((l, i) => l.recibido + Number(filas[i]?.cantidad || 0) < l.cantidad - 1e-9);

  const guardar = async () => {
    setGuardando(true);
    try {
      const r = await comprasApi.recibir(pedido.id, {
        lineas: llega.map((f) => {
          const l = pedido.lineas.find((x) => x.id === f.lineaId)!;
          return {
            lineaId: f.lineaId, cantidad: Number(f.cantidad),
            costo: f.costo !== '' && Number(f.costo) !== l.precio ? Number(f.costo) : null,
            lote: f.lote.trim() || null, vence: deInputFecha(f.vence),
          };
        }),
        cerrarResto: quedaAlgo && cerrarResto,
      });
      showToast('Mercancía recibida', `Entró al inventario de ${pedido.sede.nombre}.`, 'success');
      await recargarCatalogo?.();
      onRecibido(r);
      onClose();
    } catch (e) { showToast('No se pudo recibir', (e as Error).message || 'Revisa las cantidades.', 'warning'); }
    finally { setGuardando(false); }
  };

  return (
    <IOSModal isOpen={!!pedido} onClose={onClose} title="Recibir mercancía" subtitle={`${pedido.numero} · entra a ${pedido.sede.nombre}`} fixedHeight={false}>
      <div className="space-y-3 p-1">
        {pedido.lineas.map((l, i) => {
          const f = filas[i];
          if (!f) return null;
          const falta = Math.max(0, l.cantidad - l.recibido);
          const unidad = l.unidadCompra ?? unidadTexto(l.producto?.unit);
          return (
            <div key={l.id} className="p-3 rounded-2xl border border-slate-200/80 dark:border-neutral-800 space-y-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-bold text-[0.8125rem] text-slate-900 dark:text-white">{l.descripcion}</span>
                <span className="text-[0.6875rem] text-slate-500 shrink-0">
                  {l.recibido > 0 ? `llegó ${cantidadTexto(l.recibido)} de ${cantidadTexto(l.cantidad)}` : `pedido ${cantidadTexto(l.cantidad)}`} {unidad}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <label><span className={etiqueta}>Llegó ({unidad})</span>
                  <input className={campo} inputMode="decimal" value={f.cantidad} onChange={(e) => cambiar(i, { cantidad: e.target.value.replace(/[^\d.]/g, '') })} /></label>
                <label><span className={etiqueta}>Costo c/u</span>
                  <input className={campo} inputMode="decimal" value={f.costo} onChange={(e) => cambiar(i, { costo: e.target.value.replace(/[^\d.]/g, '') })} /></label>
                <label><span className={etiqueta}>Lote</span>
                  <input className={campo} value={f.lote} onChange={(e) => cambiar(i, { lote: e.target.value })} /></label>
                <label><span className={etiqueta}>Vence</span>
                  <input type="date" className={campo} value={f.vence} onChange={(e) => cambiar(i, { vence: e.target.value })} /></label>
              </div>
              {l.factor > 1 && Number(f.cantidad) > 0 && (
                <p className="text-[0.6875rem] text-slate-500">Suma {cantidadTexto(Number(f.cantidad) * l.factor)} {unidadTexto(l.producto?.unit)} al inventario</p>
              )}
              {falta === 0 && <p className="text-[0.6875rem] text-emerald-600">Ya llegó todo</p>}
            </div>
          );
        })}

        {quedaAlgo && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-neutral-800/60">
            <span className="text-[0.8125rem] text-slate-700 dark:text-neutral-200">
              <b>Lo que falta no vendrá</b>
              <span className="block text-[0.6875rem] text-slate-500">Cierra la orden aunque no haya llegado todo</span>
            </span>
            <IOSToggle checked={cerrarResto} onChange={setCerrarResto} ariaLabel="Lo que falta no vendrá" />
          </div>
        )}

        <button type="button" disabled={guardando || (!llega.length && !(quedaAlgo && cerrarResto))} onClick={() => void guardar()} className={`${botonPrincipal} w-full py-3`}>
          {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <PackageCheck className="w-4 h-4" />} Sumar al inventario
        </button>
      </div>
    </IOSModal>
  );
};
