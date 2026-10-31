import React, { useCallback, useEffect, useState } from 'react';
import { ChevronRight, Scissors } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useSedes } from '../../hooks/useSedes';
import { IOSModal } from '../ui/IOSModal';
import { IOSSegmentedControl } from '../ui/IOSSegmentedControl';
import { SelectorSede } from '../ui/SelectorSede';
import { EspecialistasEquipo } from '../ajustes/EspecialistasEquipo';
import { PlantillaPermisosEspecialista } from '../ajustes/EntradaEspecialista';
import { ComoSePaga } from './ComoSePaga';
import { PagosEspecialistas } from './PagosEspecialistas';
import { pagos } from '../../services/pagosEspecialistas';

type Pestana = 'personas' | 'pago' | 'pagos' | 'permisos';

/**
 * Especialistas, en su propia ventana: ya no cabía en Equipo. Quiénes son,
 * cómo se le paga a cada una en cada sede, sus cortes de pago y sus permisos.
 */
export const VentanaEspecialistas: React.FC<{ abierta: boolean; onCerrar: () => void; pestana?: Pestana }> = ({ abierta, onCerrar, pestana: inicial }) => {
  const sedes = useSedes();
  const [sede, setSede] = useState('');
  const [pestana, setPestana] = useState<Pestana>(inicial ?? 'personas');
  const [enfocar, setEnfocar] = useState<string | null>(null);
  const [etiquetas, setEtiquetas] = useState<Record<string, string>>({});
  useEffect(() => { if (abierta && inicial) setPestana(inicial); }, [abierta, inicial]);
  // Con varias sedes se trabaja en una: la primera, hasta que elija otra
  const sedeId = sede || (sedes.length > 1 ? sedes[0].id : '');

  const cargarEtiquetas = useCallback(async () => {
    try {
      const a = await pagos.acuerdos(sedeId || undefined);
      setEtiquetas(Object.fromEntries(a.especialistas.map(e => [e.id, e.etiqueta])));
    } catch { setEtiquetas({}); }
  }, [sedeId]);
  useEffect(() => { if (abierta && pestana === 'personas') void cargarEtiquetas(); }, [abierta, pestana, cargarEtiquetas]);

  const irAPago = (staffId: string) => { setEnfocar(staffId); setPestana('pago'); };

  return (
    <IOSModal isOpen={abierta} onClose={onCerrar} title="Especialistas" subtitle="Quiénes son, cómo se les paga y sus cortes" forma="angosta" height="92%">
      <div className="space-y-3 pb-6">
        <div className="flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <IOSSegmentedControl<Pestana>
              id="ventana-especialistas"
              size="sm"
              value={pestana}
              onChange={p => { setPestana(p); if (p !== 'pago') setEnfocar(null); }}
              options={[
                { id: 'personas', label: 'Personas' },
                { id: 'pago', label: 'Cómo se paga' },
                { id: 'pagos', label: 'Pagos' },
                { id: 'permisos', label: 'Permisos' },
              ]}
            />
          </div>
          {pestana !== 'permisos' && pestana !== 'personas' && (
            <SelectorSede sedes={sedes} value={sedeId} onChange={setSede} className="shrink-0" />
          )}
        </div>

        {pestana === 'personas' && <EspecialistasEquipo sinPlantillaPermisos etiquetasPago={etiquetas} onPago={irAPago} />}
        {pestana === 'pago' && <ComoSePaga sede={sedeId} enfocar={enfocar} />}
        {pestana === 'pagos' && <PagosEspecialistas sede={sedeId} onConfigurar={irAPago} onCerrarVentana={onCerrar} />}
        {pestana === 'permisos' && <PlantillaPermisosEspecialista />}
      </div>
    </IOSModal>
  );
};

/** La tarjeta en Ajustes → Equipo que abre la ventana */
export const TarjetaEspecialistas: React.FC = () => {
  const { especialistas, loadEspecialistas } = useApp();
  const [abierta, setAbierta] = useState(false);
  useEffect(() => { void loadEspecialistas?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Un aviso o un enlace puede pedir abrirla directo en una pestaña
  const [pestana, setPestana] = useState<Pestana | undefined>(undefined);
  useEffect(() => {
    const abrir = (ev: Event) => { setPestana(((ev as CustomEvent).detail as Pestana) ?? 'personas'); setAbierta(true); };
    window.addEventListener('lalan:abrir-especialistas', abrir);
    try {
      const pedida = sessionStorage.getItem('lalan.abrirEspecialistas');
      if (pedida) { sessionStorage.removeItem('lalan.abrirEspecialistas'); setPestana(pedida as Pestana); setAbierta(true); }
    } catch { /* nada */ }
    return () => window.removeEventListener('lalan:abrir-especialistas', abrir);
  }, []);
  const activas = (especialistas ?? []).filter(e => e.active).length;

  return (
    <>
      <button
        id="ajustes-especialistas"
        type="button"
        onClick={() => { setPestana('personas'); setAbierta(true); }}
        className="w-full p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs flex items-center gap-3 text-left cursor-pointer hover:border-[var(--primary)]/40 transition"
      >
        <span className="w-10 h-10 shrink-0 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
          <Scissors className="w-5 h-5" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">Especialistas ({activas})</span>
          <span className="block text-[0.75rem] text-slate-400 leading-relaxed">Quiénes son, cómo se les paga, sus cortes, descuentos y permisos.</span>
        </span>
        <span className="shrink-0 flex items-center gap-0.5 text-[0.75rem] font-bold text-[var(--primary)]">Abrir <ChevronRight className="w-4 h-4" /></span>
      </button>
      <VentanaEspecialistas abierta={abierta} onCerrar={() => setAbierta(false)} pestana={pestana} />
    </>
  );
};
