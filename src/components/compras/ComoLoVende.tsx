import React, { useState } from 'react';
import { Box, Boxes, Droplet, FlaskConical, Gift, Grid3x3, Package, PencilLine, ShoppingBag, Wine } from 'lucide-react';
import { campo, etiqueta } from './piezas';

/** Las presentaciones comunes. `trae` = cuántas unidades del producto trae, si se sabe */
const PRESENTACIONES: { id: string; nombre: string; la?: boolean; icono: React.ElementType; trae?: (unidad: string) => number | null }[] = [
  { id: '', nombre: 'Suelto', icono: Package, trae: () => 1 },
  { id: 'caja', nombre: 'Caja', la: true, icono: Box },
  { id: 'paquete', nombre: 'Paquete', icono: Boxes },
  { id: 'docena', nombre: 'Docena', la: true, icono: Grid3x3, trae: (u) => (u === 'unid.' ? 12 : null) },
  { id: 'galón', nombre: 'Galón', icono: Droplet, trae: (u) => (u === 'ml' ? 3785 : u === 'l' ? 3.785 : null) },
  { id: 'litro', nombre: 'Litro', icono: Wine, trae: (u) => (u === 'ml' ? 1000 : u === 'l' ? 1 : null) },
  { id: 'frasco', nombre: 'Frasco', icono: FlaskConical },
  { id: 'bolsa', nombre: 'Bolsa', la: true, icono: ShoppingBag },
  { id: 'kit', nombre: 'Kit', icono: Gift },
];

/**
 * Cómo lo vende el proveedor: se toca la presentación en vez de escribirla,
 * y se dice cuántas unidades trae (la docena, el litro y el galón ya lo saben).
 * Lo que no esté en la lista se escribe en «Otra».
 */
export const ComoLoVende: React.FC<{
  unidad: string;
  valor: string;
  factor: string;
  onCambio: (unidadCompra: string, factor: string) => void;
}> = ({ unidad, valor, factor, onCambio }) => {
  const actual = valor.trim().toLowerCase();
  const [escribiendo, setEscribiendo] = useState(false);
  const conocida = escribiendo ? undefined : PRESENTACIONES.find((p) => p.id === actual);
  const otra = !conocida;
  const elegir = (id: string) => {
    if (id === '__otra') { if (!otra) onCambio('', factor); setEscribiendo(true); return; }
    setEscribiendo(false);
    const p = PRESENTACIONES.find((x) => x.id === id)!;
    const trae = p.trae?.(unidad);
    onCambio(id, trae != null ? String(trae) : id === actual ? factor : '');
  };
  const chip = (activo: boolean) => `flex flex-col items-center justify-center gap-1 py-2 rounded-xl border text-[0.6875rem] font-semibold cursor-pointer transition ${activo
    ? 'border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]'
    : 'border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-300 hover:border-slate-300 dark:hover:border-neutral-600'}`;

  return (
    <div className="space-y-2">
      <div role="radiogroup" aria-label="Cómo lo vende" className="grid grid-cols-5 gap-1.5">
        {PRESENTACIONES.map((p) => {
          const Icono = p.icono;
          return (
            <button key={p.id || 'suelto'} type="button" role="radio" aria-checked={conocida?.id === p.id} onClick={() => elegir(p.id)} className={chip(conocida?.id === p.id)}>
              <Icono className="w-4 h-4" /> {p.id ? p.nombre : `Por ${unidad}`}
            </button>
          );
        })}
        <button type="button" role="radio" aria-checked={otra} onClick={() => elegir('__otra')} className={chip(otra)}>
          <PencilLine className="w-4 h-4" /> Otra
        </button>
      </div>
      {(otra || (conocida && conocida.id)) && (
        <div className="grid grid-cols-2 gap-2">
          {otra ? (
            <label><span className={etiqueta}>¿Cuál?</span>
              <input className={campo} autoFocus placeholder="rollo, sobre, tubo…" value={valor} onChange={(e) => onCambio(e.target.value, factor)} /></label>
          ) : <span />}
          <label><span className={etiqueta}>¿Cuántas {unidad} trae {otra ? 'cada una' : `${conocida!.la ? 'la' : 'el'} ${conocida!.nombre.toLowerCase()}`}?</span>
            <input className={campo} inputMode="decimal" placeholder="12" value={factor} onChange={(e) => onCambio(valor, e.target.value.replace(/[^\d.]/g, ''))} /></label>
        </div>
      )}
    </div>
  );
};
