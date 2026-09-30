import React, { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { IOSModal } from '../ui/IOSModal';

interface Lote { id: string; lotNumber: string | null; expiresAt: string | null; remaining: number | string; receivedAt: string }
export interface ProductoARecibir { id: string; name: string; unit?: string; costPrice?: number | null }

const campo = 'w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[13px]';
const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' }) : 'sin fecha');

/**
 * Recibir mercancía: suma al inventario de la sede y, si el producto vence,
 * guarda la fecha. Con eso Lalan avisa antes de que algo se venza y gasta
 * primero lo que vence antes.
 */
export const RecibirMercancia: React.FC<{ producto: ProductoARecibir | null; onClose: () => void }> = ({ producto, onClose }) => {
  const { showToast, recargarCatalogo } = useApp();
  const [f, setF] = useState({ cantidad: '', costo: '', vence: '', lote: '' });
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!producto) return;
    setF({ cantidad: '', costo: producto.costPrice ? String(producto.costPrice) : '', vence: '', lote: '' });
    api.get<Lote[]>(`/inventory/lots/${producto.id}`).then(setLotes).catch(() => setLotes([]));
  }, [producto]);

  const guardar = async () => {
    if (!producto) return;
    setGuardando(true);
    try {
      await api.post('/inventory/lots', {
        productId: producto.id, quantity: Number(f.cantidad),
        ...(f.costo ? { costPrice: Number(f.costo) } : {}),
        ...(f.vence ? { expiresAt: new Date(`${f.vence}T12:00:00`).toISOString() } : {}),
        ...(f.lote.trim() ? { lotNumber: f.lote.trim() } : {}),
      });
      showToast('Mercancía recibida', `${f.cantidad} ${producto.unit ?? 'unid.'} de ${producto.name}${f.vence ? `, vence el ${fecha(new Date(`${f.vence}T12:00:00`).toISOString())}` : ''}.`, 'success');
      await recargarCatalogo?.();
      onClose();
    } catch (e) { showToast('No se pudo guardar', (e as Error)?.message || 'Revisa los datos.', 'warning'); }
    finally { setGuardando(false); }
  };

  const conExistencia = lotes.filter(l => Number(l.remaining) > 0);
  return (
    <IOSModal isOpen={!!producto} onClose={onClose} title="Recibir mercancía" subtitle={producto?.name} fixedHeight={false}>
      <div className="space-y-3 p-1">
        <div className="grid grid-cols-2 gap-2">
          <label><span className="text-[11px] text-slate-500">Cantidad ({producto?.unit ?? 'unid.'})</span>
            <input className={campo} inputMode="decimal" autoFocus value={f.cantidad} onChange={e => setF({ ...f, cantidad: e.target.value.replace(/[^\d.]/g, '') })} /></label>
          <label><span className="text-[11px] text-slate-500">Costo por unidad (opcional)</span>
            <input className={campo} inputMode="decimal" value={f.costo} onChange={e => setF({ ...f, costo: e.target.value.replace(/[^\d.]/g, '') })} /></label>
          <label><span className="text-[11px] text-slate-500">Vence (si aplica)</span>
            <input type="date" className={campo} value={f.vence} onChange={e => setF({ ...f, vence: e.target.value })} /></label>
          <label><span className="text-[11px] text-slate-500">Número de lote (opcional)</span>
            <input className={campo} value={f.lote} onChange={e => setF({ ...f, lote: e.target.value })} /></label>
        </div>
        <button type="button" disabled={guardando || !(Number(f.cantidad) > 0)} onClick={() => void guardar()}
          className="w-full py-3 rounded-xl bg-[var(--primary)] text-white font-bold text-sm disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
          {guardando && <Loader2 className="w-4 h-4 animate-spin" />} Sumar al inventario
        </button>
        {conExistencia.length > 0 && (
          <div className="text-[11px]">
            <p className="font-bold text-slate-500 mb-1">Lo que ya tienes (se gasta primero lo que vence antes)</p>
            <ul className="divide-y divide-slate-100 dark:divide-neutral-800">
              {conExistencia.map(l => (
                <li key={l.id} className="py-1 flex justify-between tabular-nums">
                  <span>{Number(l.remaining)} {producto?.unit ?? 'unid.'}{l.lotNumber ? ` · lote ${l.lotNumber}` : ''}</span>
                  <span className="text-slate-500">vence {fecha(l.expiresAt)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </IOSModal>
  );
};
