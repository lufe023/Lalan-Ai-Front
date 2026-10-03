import React, { useState } from 'react';
import { Check, Plus, Settings2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { PapelEnLounge, TipoCategoria } from '../../types';
import { GestorDeCategorias } from './GestorDeCategorias';

const LARGO_NOMBRE = 60;
/** Ícono si no eligen uno */
const ICONO_POR_DEFECTO: Record<TipoCategoria, string> = { service: '✨', product: '🛍️' };

export const OPCIONES_LOUNGE: { id: PapelEnLounge; label: string; ayuda: string }[] = [
  { id: 'none', label: 'No va en el Lounge', ayuda: 'Productos de venta o de uso en servicios' },
  { id: 'drink', label: 'Bebida', ayuda: 'Lalan la ofrece como bebida y sale en la bienvenida' },
  { id: 'food', label: 'Comida', ayuda: 'Lalan la ofrece como snack y sale en la bienvenida' },
];

/**
 * Elegir la categoría de un servicio o producto, y crear una nueva sin
 * salir del formulario. Las categorías son del salón: las de siempre vienen
 * de inicio, y la dueña agrega las suyas ("Picaderas", "Cejas", "Barbería").
 */
export const SelectorDeCategoria: React.FC<{
  kind: TipoCategoria;
  value: string;
  onChange: (key: string, nombre: string) => void;
}> = ({ kind, value, onChange }) => {
  const { categoriasDe, categoriaPorClave, crearCategoria, showToast } = useApp();
  const lista = categoriasDe(kind);
  const actual = categoriaPorClave(kind, value);
  const [creando, setCreando] = useState(false);
  const [gestionando, setGestionando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [icono, setIcono] = useState('');
  const [papel, setPapel] = useState<PapelEnLounge>('none');
  const [guardando, setGuardando] = useState(false);

  const crear = async () => {
    if (!nombre.trim()) return;
    setGuardando(true);
    try {
      const c = await crearCategoria({ kind, name: nombre.trim(), icon: icono.trim() || ICONO_POR_DEFECTO[kind], loungeRole: kind === 'product' ? papel : undefined });
      onChange(c.key, c.name);
      setCreando(false); setNombre(''); setIcono(''); setPapel('none');
      showToast('Categoría creada', c.name, 'success');
    } catch (e: any) {
      showToast('No se pudo crear', e?.message ?? 'Intenta de nuevo', 'warning');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-[0.6875rem] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Categoría</label>
        <button type="button" onClick={() => setGestionando(true)}
          className="flex items-center gap-1 text-[0.6875rem] font-semibold text-[var(--primary)] hover:opacity-70 cursor-pointer">
          <Settings2 className="w-3 h-3" /> Administrar
        </button>
      </div>

      {/* Una categoría desactivada que el producto todavía tiene: se enseña para no perderla de vista */}
      {actual && !actual.active && (
        <p className="text-[0.6875rem] text-amber-600 mb-1.5">Está en "{actual.name}", que está desactivada. Elige otra o actívala en Administrar.</p>
      )}

      <div className="grid grid-cols-2 gap-2">
        {lista.map(cat => {
          const elegida = value === cat.key;
          return (
            <button key={cat.id} type="button" onClick={() => onChange(cat.key, cat.name)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-left transition ios-touch cursor-pointer ${
                elegida
                  ? 'bg-[var(--primary)]/10 border-[var(--primary)] text-[var(--primary)] font-bold'
                  : 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-300 hover:border-slate-300 dark:hover:border-neutral-600'
              }`}>
              <span className="text-base shrink-0">{cat.icon || ICONO_POR_DEFECTO[kind]}</span>
              <span className="text-[0.75rem] leading-tight flex-1">
                {cat.name}
                {cat.loungeRole !== 'none' && (
                  <span className="block text-[0.6875rem] font-normal text-slate-400">Lounge · {cat.loungeRole === 'drink' ? 'bebida' : 'comida'}</span>
                )}
              </span>
              {elegida && <Check className="w-3.5 h-3.5 shrink-0" />}
            </button>
          );
        })}
        {!creando && (
          <button type="button" onClick={() => setCreando(true)}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-neutral-700 text-[0.75rem] font-semibold text-slate-500 hover:border-[var(--primary)] hover:text-[var(--primary)] transition cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Nueva categoría
          </button>
        )}
      </div>

      {creando && (
        <div className="mt-2 p-3 rounded-xl border border-[var(--primary)]/40 bg-[var(--primary)]/5 space-y-2.5">
          <div className="flex gap-2">
            <input value={icono} onChange={e => setIcono(e.target.value)} placeholder={ICONO_POR_DEFECTO[kind]} maxLength={4}
              aria-label="Ícono (emoji)"
              className="w-12 text-center px-2 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-base focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
            <input value={nombre} onChange={e => setNombre(e.target.value)} maxLength={LARGO_NOMBRE} autoFocus
              placeholder={kind === 'service' ? 'Ej: Cejas y pestañas' : 'Ej: Picaderas'}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void crear(); } }}
              className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[0.8125rem] font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]" />
          </div>
          {kind === 'product' && (
            <div>
              <p className="text-[0.6875rem] font-semibold text-slate-500 mb-1">¿Va en el menú del Lounge?</p>
              <div className="grid grid-cols-3 gap-1.5">
                {OPCIONES_LOUNGE.map(o => (
                  <button key={o.id} type="button" onClick={() => setPapel(o.id)} title={o.ayuda}
                    className={`px-2 py-1.5 rounded-lg border text-[0.6875rem] font-semibold transition cursor-pointer ${
                      papel === o.id ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300'
                    }`}>
                    {o.label}
                  </button>
                ))}
              </div>
              <p className="text-[0.6875rem] text-slate-400 mt-1">{OPCIONES_LOUNGE.find(o => o.id === papel)?.ayuda}</p>
            </div>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={() => { setCreando(false); setNombre(''); setIcono(''); }}
              className="px-3 py-2 rounded-lg text-[0.75rem] font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-pointer flex items-center gap-1">
              <X className="w-3 h-3" /> Cancelar
            </button>
            <button type="button" disabled={!nombre.trim() || guardando} onClick={() => void crear()}
              className="flex-1 py-2 rounded-lg bg-[var(--primary)] text-white text-[0.75rem] font-bold disabled:opacity-40 cursor-pointer">
              {guardando ? 'Creando…' : 'Crear y elegir'}
            </button>
          </div>
        </div>
      )}

      <GestorDeCategorias kind={kind} abierto={gestionando} onCerrar={() => setGestionando(false)} />
    </div>
  );
};
