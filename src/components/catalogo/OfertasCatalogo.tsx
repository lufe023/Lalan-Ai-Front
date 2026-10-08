import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Bot, Gift, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useDinero } from '../../hooks/useDinero';
import { IOSModal } from '../ui/IOSModal';
import type { SalonService } from '../../types';

interface Oferta {
  id: string;
  nombre: string;
  descripcion: string | null;
  servicioIds: string[];
  precio: number;
  currencyCode: string;
  desde: string | null;
  hasta: string | null;
  dias: number[];
  activa: boolean;
  aiOfrece: boolean;
}

/** Lunes primero, como se lee la semana aquí */
const DIAS = [
  { n: 1, c: 'L' }, { n: 2, c: 'M' }, { n: 3, c: 'X' }, { n: 4, c: 'J' }, { n: 5, c: 'V' }, { n: 6, c: 'S' }, { n: 0, c: 'D' },
];
const NOMBRE_DIA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

const VACIA: Omit<Oferta, 'id'> = {
  nombre: '', descripcion: '', servicioIds: [], precio: 0, currencyCode: '', desde: null, hasta: null, dias: [], activa: true, aiOfrece: true,
};

/**
 * Catálogo → Ofertas: combos de varios servicios a un precio ("Mani + Pedi
 * a RD$1,500"). La asistente las ofrece y, si agenda juntos esos servicios
 * un día en que la oferta vale, el precio del combo se aplica solo.
 */
export const OfertasCatalogo: React.FC<{ servicios: SalonService[] }> = ({ servicios }) => {
  const { showToast } = useApp();
  const { currentUser } = useAuth();
  const { base, dinero, enBase } = useDinero();
  const puedeEditar = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const [ofertas, setOfertas] = useState<Oferta[] | null>(null);
  const [editando, setEditando] = useState<(Omit<Oferta, 'id'> & { id?: string }) | null>(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    try { setOfertas(await api.get<Oferta[]>('/ofertas')); } catch { setOfertas([]); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  const porId = useMemo(() => new Map(servicios.map((s) => [s.id, s])), [servicios]);
  /** Lo que costarían sueltos, en la moneda del salón */
  const suelto = (ids: string[]) => ids.reduce((a, id) => {
    const s = porId.get(id);
    return a + (s ? enBase(s.price, s.currencyCode) ?? s.price : 0);
  }, 0);
  const hoy = new Date().toISOString().slice(0, 10);

  const guardar = async () => {
    if (!editando) return;
    setGuardando(true);
    try {
      const cuerpo = { ...editando, currencyCode: editando.currencyCode || base };
      if (editando.id) await api.patch(`/ofertas/${editando.id}`, cuerpo);
      else await api.post('/ofertas', cuerpo);
      showToast('Oferta guardada', editando.nombre, 'success');
      setEditando(null);
      void cargar();
    } catch (e: any) {
      showToast('No se pudo guardar', e?.message ?? 'Inténtalo de nuevo.', 'warning');
    } finally { setGuardando(false); }
  };

  const cambiar = async (o: Oferta, cambio: Partial<Oferta>) => {
    setOfertas((l) => l?.map((x) => (x.id === o.id ? { ...x, ...cambio } : x)) ?? l);
    try { await api.patch(`/ofertas/${o.id}`, cambio); }
    catch (e: any) { showToast('No se pudo cambiar', e?.message ?? 'Inténtalo de nuevo.', 'warning'); void cargar(); }
  };

  const borrar = async (o: Oferta) => {
    if (!window.confirm(`¿Borrar la oferta «${o.nombre}»?`)) return;
    try { await api.delete(`/ofertas/${o.id}`); void cargar(); }
    catch (e: any) { showToast('No se pudo borrar', e?.message ?? 'Inténtalo de nuevo.', 'warning'); }
  };

  const cuando = (o: Oferta) => [
    o.desde ? `desde ${o.desde}` : null,
    o.hasta ? `hasta ${o.hasta}` : null,
    o.dias.length && o.dias.length < 7 ? `solo ${o.dias.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => NOMBRE_DIA[d]).join(', ')}` : 'todos los días',
  ].filter(Boolean).join(' · ');

  return (
    <div className="space-y-3">
      <div className="p-3 rounded-2xl bg-gradient-to-r from-amber-500/10 to-rose-500/10 border border-amber-500/20 flex items-start gap-2.5 text-xs">
        <Gift className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-[0.75rem] text-slate-600 dark:text-neutral-300 leading-snug">
          Junta varios servicios a un precio especial. La asistente la ofrece cuando la clienta pide uno de ellos y, si los agenda
          juntos un día en que la oferta vale, <b>el precio del combo se aplica solo</b> en la cita y en Caja.
        </p>
      </div>

      {puedeEditar && (
        <button type="button" onClick={() => setEditando({ ...VACIA, currencyCode: base })}
          className="w-full py-2.5 rounded-xl bg-[var(--primary)] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer">
          <Plus className="w-4 h-4" /> Nueva oferta
        </button>
      )}

      {ofertas === null && <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>}
      {ofertas?.length === 0 && <p className="py-8 text-center text-xs text-slate-400">Todavía no hay ofertas.</p>}

      {ofertas?.map((o) => {
        const sueltoTotal = suelto(o.servicioIds);
        const precio = enBase(o.precio, o.currencyCode) ?? o.precio;
        const vencida = !!o.hasta && o.hasta < hoy;
        return (
          <div key={o.id} className={`p-3.5 rounded-2xl bg-white dark:bg-neutral-900 border shadow-xs space-y-2 ${o.activa && !vencida ? 'border-slate-200/80 dark:border-neutral-800' : 'border-dashed border-slate-200 dark:border-neutral-800 opacity-60'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[0.875rem] font-bold text-slate-900 dark:text-white">{o.nombre}{vencida ? ' · vencida' : ''}</div>
                {o.descripcion && <div className="text-[0.75rem] text-slate-500 dark:text-neutral-400">{o.descripcion}</div>}
              </div>
              <div className="text-right shrink-0">
                <div className="text-[0.9375rem] font-black text-slate-900 dark:text-white">{dinero(o.precio, o.currencyCode)}</div>
                {sueltoTotal > precio && <div className="text-[0.6875rem] text-emerald-600 font-semibold">ahorra {dinero(sueltoTotal - precio)}</div>}
              </div>
            </div>
            <div className="flex flex-wrap gap-1">
              {o.servicioIds.map((id, i) => (
                <span key={`${id}-${i}`} className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-neutral-800 text-[0.6875rem] font-semibold text-slate-600 dark:text-neutral-300">
                  {porId.get(id)?.name ?? 'Servicio borrado'}
                </span>
              ))}
            </div>
            <div className="text-[0.6875rem] text-slate-400">{cuando(o)}</div>
            {puedeEditar && (
              <div className="flex items-center gap-2 pt-1">
                <button type="button" onClick={() => void cambiar(o, { aiOfrece: !o.aiOfrece })}
                  className={`px-2 py-1 rounded-lg text-[0.6875rem] font-bold flex items-center gap-1 cursor-pointer ${o.aiOfrece ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300' : 'bg-slate-100 dark:bg-neutral-800 text-slate-500'}`}>
                  <Bot className="w-3.5 h-3.5" /> {o.aiOfrece ? 'La asistente la ofrece' : 'La asistente no la ofrece'}
                </button>
                <button type="button" onClick={() => void cambiar(o, { activa: !o.activa })}
                  className="px-2 py-1 rounded-lg text-[0.6875rem] font-bold bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 cursor-pointer">
                  {o.activa ? 'Pausar' : 'Activar'}
                </button>
                <div className="flex-1" />
                <button type="button" onClick={() => setEditando({ ...o })} aria-label="Editar" className="w-8 h-8 rounded-lg text-slate-400 hover:text-[var(--primary)] flex items-center justify-center cursor-pointer"><Pencil className="w-4 h-4" /></button>
                <button type="button" onClick={() => void borrar(o)} aria-label="Borrar" className="w-8 h-8 rounded-lg text-slate-400 hover:text-rose-500 flex items-center justify-center cursor-pointer"><Trash2 className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        );
      })}

      <IOSModal isOpen={!!editando} onClose={() => setEditando(null)} title={editando?.id ? 'Editar oferta' : 'Nueva oferta'} subtitle="Varios servicios a un precio">
        {editando && (() => {
          const sueltoTotal = suelto(editando.servicioIds);
          const campo = 'w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.875rem] text-slate-900 dark:text-white';
          const set = (c: Partial<Oferta>) => setEditando((e) => (e ? { ...e, ...c } : e));
          return (
            <div className="space-y-4 text-xs pb-6">
              <label className="block space-y-1.5">
                <span className="font-semibold text-slate-600 dark:text-neutral-300">Nombre</span>
                <input value={editando.nombre} onChange={(e) => set({ nombre: e.target.value })} maxLength={80} placeholder="Ej.: Mani + Pedi de martes" className={campo} />
              </label>
              <label className="block space-y-1.5">
                <span className="font-semibold text-slate-600 dark:text-neutral-300">Detalle (opcional, la asistente lo cuenta)</span>
                <input value={editando.descripcion ?? ''} onChange={(e) => set({ descripcion: e.target.value })} maxLength={400} placeholder="Ej.: incluye esmaltado semipermanente" className={campo} />
              </label>
              <div className="space-y-1.5">
                <span className="font-semibold text-slate-600 dark:text-neutral-300">Servicios (en el orden en que se hacen)</span>
                <div className="flex flex-wrap gap-1.5">
                  {servicios.map((s) => {
                    const pos = editando.servicioIds.indexOf(s.id);
                    return (
                      <button key={s.id} type="button"
                        onClick={() => set({ servicioIds: pos >= 0 ? editando.servicioIds.filter((x) => x !== s.id) : [...editando.servicioIds, s.id] })}
                        className={`px-2.5 py-1 rounded-full border text-[0.75rem] font-semibold cursor-pointer ${pos >= 0 ? 'bg-[var(--primary)] text-white border-transparent' : 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300'}`}>
                        {pos >= 0 ? `${pos + 1}. ` : ''}{s.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <label className="block space-y-1.5">
                <span className="font-semibold text-slate-600 dark:text-neutral-300">Precio del combo ({editando.currencyCode || base})</span>
                <input type="number" min={0} value={editando.precio || ''} onChange={(e) => set({ precio: Number(e.target.value) })} className={campo} />
                {editando.servicioIds.length > 1 && (
                  <span className="block text-[0.75rem] text-slate-500">
                    Sueltos costarían {dinero(sueltoTotal)}{editando.precio > 0 && editando.precio < sueltoTotal ? ` · ahorra ${dinero(sueltoTotal - editando.precio)}` : ''}
                  </span>
                )}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block space-y-1.5">
                  <span className="font-semibold text-slate-600 dark:text-neutral-300">Desde (opcional)</span>
                  <input type="date" value={editando.desde ?? ''} onChange={(e) => set({ desde: e.target.value || null })} className={campo} />
                </label>
                <label className="block space-y-1.5">
                  <span className="font-semibold text-slate-600 dark:text-neutral-300">Hasta (opcional)</span>
                  <input type="date" value={editando.hasta ?? ''} onChange={(e) => set({ hasta: e.target.value || null })} className={campo} />
                </label>
              </div>
              <div className="space-y-1.5">
                <span className="font-semibold text-slate-600 dark:text-neutral-300">Días en que vale {editando.dias.length ? '' : '(todos)'}</span>
                <div className="flex gap-1.5">
                  {DIAS.map((d) => {
                    const on = editando.dias.includes(d.n);
                    return (
                      <button key={d.n} type="button" onClick={() => set({ dias: on ? editando.dias.filter((x) => x !== d.n) : [...editando.dias, d.n] })}
                        className={`w-9 h-9 rounded-full text-[0.75rem] font-bold cursor-pointer ${on ? 'bg-[var(--primary)] text-white' : 'bg-slate-100 dark:bg-neutral-800 text-slate-500'}`}>{d.c}</button>
                    );
                  })}
                </div>
              </div>
              <button type="button" onClick={() => set({ aiOfrece: !editando.aiOfrece })}
                className={`w-full flex items-center justify-between p-3 rounded-xl cursor-pointer ${editando.aiOfrece ? 'bg-purple-500/10' : 'bg-slate-100 dark:bg-neutral-800'}`}>
                <span className="flex items-center gap-2 font-semibold text-slate-700 dark:text-neutral-200"><Bot className="w-4 h-4 text-purple-500" />
                  {editando.aiOfrece ? 'La asistente la ofrece y la sugiere' : 'La asistente no la ofrece (solo en el salón)'}</span>
                <span className={`w-9 h-5 rounded-full relative ${editando.aiOfrece ? 'bg-purple-500' : 'bg-slate-300 dark:bg-neutral-600'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${editando.aiOfrece ? 'left-[1.1rem]' : 'left-0.5'}`} />
                </span>
              </button>
              <button type="button" onClick={() => void guardar()}
                disabled={guardando || !editando.nombre.trim() || editando.servicioIds.length < 2 || !(editando.precio >= 0)}
                className="w-full py-3 rounded-xl bg-[var(--primary)] text-white font-bold text-[0.875rem] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer">
                {guardando && <Loader2 className="w-4 h-4 animate-spin" />} Guardar oferta
              </button>
              {editando.servicioIds.length < 2 && <p className="text-center text-slate-400">Elige al menos dos servicios.</p>}
            </div>
          );
        })()}
      </IOSModal>
    </div>
  );
};
