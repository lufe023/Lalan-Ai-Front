import React, { useState } from 'react';
import { Eye, EyeOff, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { IOSModal } from '../ui/IOSModal';
import { CategoriaCatalogo, PapelEnLounge, TipoCategoria } from '../../types';
import { OPCIONES_LOUNGE } from './SelectorDeCategoria';

/**
 * Renombrar, cambiar el ícono, decir si va en el Lounge, activar o quitar.
 * Una categoría con cosas dentro no se borra: se desactiva, para que las
 * citas y ventas de antes sigan diciendo de qué eran.
 */
export const GestorDeCategorias: React.FC<{ kind: TipoCategoria; abierto: boolean; onCerrar: () => void }> = ({ kind, abierto, onCerrar }) => {
  const { categorias } = useApp();
  const lista = categorias.filter(c => c.kind === kind).sort((a, b) => Number(b.active) - Number(a.active) || a.sortOrder - b.sortOrder);
  return (
    <IOSModal isOpen={abierto} onClose={onCerrar} fixedHeight={false}
      title={kind === 'service' ? 'Categorías de servicios' : 'Categorías de productos'}
      subtitle="Los cambios se guardan al salir de cada campo">
      <div className="space-y-2 text-xs pb-4">
        {kind === 'service' && (
          <p className="text-[11px] text-slate-500 dark:text-neutral-400 leading-relaxed">
            Una categoría nueva aparece sola en Ajustes → Zonas: marca en qué zona se atiende y Lalan sabrá a quién darle la cita.
          </p>
        )}
        {lista.map(c => <Fila key={c.id} c={c} />)}
      </div>
    </IOSModal>
  );
};

const Fila: React.FC<{ c: CategoriaCatalogo }> = ({ c }) => {
  const { editarCategoria, quitarCategoria, showToast } = useApp();
  const [nombre, setNombre] = useState(c.name);
  const [icono, setIcono] = useState(c.icon ?? '');

  const guardar = async (dto: Parameters<typeof editarCategoria>[1]) => {
    try { await editarCategoria(c.id, dto); }
    catch (e: any) { showToast('No se pudo guardar', e?.message ?? 'Intenta de nuevo', 'warning'); }
  };
  const quitar = async () => {
    try {
      const motivo = await quitarCategoria(c.id);
      showToast(motivo ? 'Categoría desactivada' : 'Categoría borrada', motivo ?? c.name, 'info');
    } catch (e: any) { showToast('No se pudo quitar', e?.message ?? 'Intenta de nuevo', 'warning'); }
  };

  return (
    <div className={`p-2.5 rounded-xl border ${c.active ? 'border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900' : 'border-dashed border-slate-300 dark:border-neutral-700 opacity-60'}`}>
      <div className="flex items-center gap-2">
        <input value={icono} maxLength={4} aria-label="Ícono"
          onChange={e => setIcono(e.target.value)}
          onBlur={() => icono !== (c.icon ?? '') && void guardar({ icon: icono })}
          className="w-10 text-center py-1.5 rounded-lg bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-base focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
        <input value={nombre} aria-label="Nombre"
          onChange={e => setNombre(e.target.value)}
          onBlur={() => nombre.trim() && nombre.trim() !== c.name && void guardar({ name: nombre.trim() })}
          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
        <span className="text-[10px] text-slate-400 shrink-0 tabular-nums" title="Servicios o productos activos dentro">{c.usos}</span>
        <button type="button" onClick={() => void guardar({ active: !c.active })} title={c.active ? 'Desactivar' : 'Activar'}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-pointer">
          {c.active ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>
        <button type="button" onClick={() => void quitar()} title={c.usos ? 'Tiene cosas dentro: se desactivará' : 'Borrar'}
          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      {c.kind === 'product' && (
        <div className="grid grid-cols-3 gap-1.5 mt-2">
          {OPCIONES_LOUNGE.map(o => (
            <button key={o.id} type="button" title={o.ayuda}
              onClick={() => o.id !== c.loungeRole && void guardar({ loungeRole: o.id as PapelEnLounge })}
              className={`px-2 py-1 rounded-lg border text-[10px] font-semibold transition cursor-pointer ${
                c.loungeRole === o.id ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-slate-200 dark:border-neutral-700 text-slate-500'
              }`}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
