import React, { useEffect, useState } from 'react';
import { Bot, Hand, Loader2, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { IOSModal } from '../ui/IOSModal';
import { IOSToggle } from '../ui/IOSToggle';
import { comprasApi, type AjustesCompras as Ajustes, type ModoCompra } from '../../services/compras';
import { botonPrincipal, campo, etiqueta } from './piezas';
import { CorreoDeCompras } from './CorreoDeCompras';

const MODOS: { id: ModoCompra; titulo: string; texto: string; icono: React.ReactNode }[] = [
  { id: 'manual', titulo: 'Lo hago yo', texto: 'Lalan solo te avisa qué falta. Tú armas y mandas los pedidos.', icono: <Hand className="w-4 h-4" /> },
  { id: 'sugerir', titulo: 'Lalan me los arma', texto: 'Cada mañana Lalan arma los pedidos por proveedor con lo que falta. Tú los revisas y los mandas.', icono: <Sparkles className="w-4 h-4" /> },
  { id: 'lalan', titulo: 'Lalan pide precio por mí', texto: 'Además le pide precio a los proveedores que dejas que Lalan les escriba, lee lo que contestan (WhatsApp o correo), anota los precios y te pregunta. Comprar y pagar siempre esperan tu sí.', icono: <Bot className="w-4 h-4" /> },
];

/** Cómo compra el salón, como se elige cómo llegan los informes */
export const AjustesCompras: React.FC<{ abierto: boolean; onClose: () => void }> = ({ abierto, onClose }) => {
  const { showToast } = useApp();
  const [a, setA] = useState<Ajustes | null>(null);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { if (abierto) comprasApi.ajustes().then(setA).catch(() => setA(null)); }, [abierto]);

  const guardar = async () => {
    if (!a) return;
    setGuardando(true);
    try { setA(await comprasApi.guardarAjustes(a)); showToast('Compras guardado', '', 'success'); onClose(); }
    catch (e) { showToast('No se pudo guardar', (e as Error).message, 'warning'); }
    finally { setGuardando(false); }
  };

  return (
    <IOSModal isOpen={abierto} onClose={onClose} title="Cómo compras" subtitle="Lo que hace Lalan con lo que falta" fixedHeight={false}>
      {!a ? <div className="flex items-center gap-2 text-[0.8125rem] text-slate-400 py-6 justify-center"><Loader2 className="w-4 h-4 animate-spin" /></div> : (
        <div className="space-y-3 p-1">
          {MODOS.map((m) => (
            <button key={m.id} type="button" onClick={() => setA({ ...a, modo: m.id })} className={`w-full p-3 rounded-2xl border text-left flex gap-3 cursor-pointer transition ${a.modo === m.id ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-slate-200 dark:border-neutral-700'}`}>
              <span className={`grid place-items-center size-8 rounded-xl shrink-0 ${a.modo === m.id ? 'bg-[var(--primary)] text-white' : 'bg-slate-100 dark:bg-neutral-800 text-slate-500'}`}>{m.icono}</span>
              <span>
                <span className="block font-bold text-[0.8125rem] text-slate-900 dark:text-white">{m.titulo}</span>
                <span className="block text-[0.75rem] text-slate-500 dark:text-neutral-400">{m.texto}</span>
              </span>
            </button>
          ))}
          <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-neutral-800/60">
            <span className="text-[0.8125rem] text-slate-700 dark:text-neutral-200"><b>Avisarme lo que falta</b>
              <span className="block text-[0.6875rem] text-slate-500">Cada mañana, al teléfono, si algo bajó de su mínimo o no alcanza para las citas</span></span>
            <IOSToggle checked={a.avisarFaltantes} onChange={(v) => setA({ ...a, avisarFaltantes: v })} ariaLabel="Avisarme lo que falta" />
          </div>
          <CorreoDeCompras />
          <label className="block"><span className={etiqueta}>Impuesto de cada renglón (%)</span>
            <input className={campo} inputMode="decimal" value={String(a.impuestoPct)} onChange={(e) => setA({ ...a, impuestoPct: Number(e.target.value.replace(/[^\d.]/g, '')) || 0 })} /></label>
          <label className="block"><span className={etiqueta}>Condiciones al pie de cada orden</span>
            <textarea className={`${campo} min-h-[64px]`} placeholder="Pago a 30 días. Entregar de 9 a 12." value={a.terminos ?? ''} onChange={(e) => setA({ ...a, terminos: e.target.value })} /></label>
          <button type="button" disabled={guardando} onClick={() => void guardar()} className={`${botonPrincipal} w-full py-3`}>{guardando && <Loader2 className="w-4 h-4 animate-spin" />} Guardar</button>
        </div>
      )}
    </IOSModal>
  );
};
