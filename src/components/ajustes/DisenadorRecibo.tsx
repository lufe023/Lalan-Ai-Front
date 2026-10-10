import React, { useEffect, useMemo, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowUp, Eye, EyeOff, MapPin, Minus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useSedeActiva } from '../../context/SedeActivaContext';
import { construirRecibo, DISENO_BASE, NOMBRE_BLOQUE, type DisenoRecibo } from '../../utils/recibo';

/**
 * Diseñador del recibo.
 *
 * El diseño es de todo el salón: qué partes lleva, en qué orden, cómo se
 * alinean y dónde va una raya. La dirección y el teléfono son de cada sede y
 * salen en los recibos de las ventas de esa sede. A la derecha se ve el
 * recibo tal como saldría en la sede elegida.
 */

const campo = 'w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs text-slate-900 dark:text-white';
const etiqueta = 'text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400';

/** Una venta de ejemplo para la vista previa */
const MUESTRA = {
  id: '0000000000000000A1B2C3D4',
  closedAt: new Date().toISOString(),
  clientName: 'María Pérez',
  total: 1850,
  items: [
    { label: 'Corte y secado', quantity: 1, lineTotal: 1200 },
    { label: 'Agua mineral', quantity: 2, lineTotal: 150 },
    { label: 'Tratamiento de keratina', quantity: 1, lineTotal: 500 },
  ],
  payments: [{ method: 'cash', amount: 1850, changeGiven: 150 }],
};

/** El diseño guardado, con las partes nuevas que aún no tenga */
function completar(d?: DisenoRecibo | null): DisenoRecibo {
  if (!d?.bloques?.length) return DISENO_BASE;
  const faltan = DISENO_BASE.bloques.filter(b => !d.bloques.some(x => x.id === b.id));
  return { ...DISENO_BASE, ...d, bloques: [...d.bloques, ...faltan] };
}

export const DisenadorRecibo: React.FC = () => {
  const { settings, updateSettings, baseCurrency, showToast } = useApp();
  const { sedes, actual, varias, ponerContacto } = useSedeActiva();
  const guardado = completar((settings as any)?.reciboDiseno);
  const [d, setD] = useState<DisenoRecibo>(guardado);
  const cambiado = JSON.stringify(d) !== JSON.stringify(guardado);
  // Los ajustes llegan después de montar: el diseño guardado reemplaza al de fábrica
  const llave = JSON.stringify((settings as any)?.reciboDiseno ?? null);
  useEffect(() => { setD(completar((settings as any)?.reciboDiseno)); }, [llave]);

  // Las sedes que se pueden tocar aquí: la activa, o todas en "Todas las sedes"
  const editables = actual ? [actual] : sedes;
  const [vista, setVista] = useState(actual?.id ?? sedes[0]?.id ?? '');
  const sedeVista = sedes.find(s => s.id === vista) ?? actual ?? sedes[0] ?? null;

  const html = useMemo(() => construirRecibo(MUESTRA, {
    diseno: d,
    salon: (settings as any)?.salonName || 'Lalan AI Studio & Lounge',
    sede: varias ? sedeVista?.name : undefined,
    direccion: sedeVista?.address ?? (settings as any)?.address ?? '',
    telefono: sedeVista?.phone ?? (settings as any)?.phone ?? '',
    simbolo: baseCurrency?.symbol ?? '',
  }), [d, settings, sedeVista, varias, baseCurrency]);

  const mover = (i: number, paso: -1 | 1) => setD(prev => {
    const j = i + paso;
    if (j < 0 || j >= prev.bloques.length) return prev;
    const bloques = [...prev.bloques];
    [bloques[i], bloques[j]] = [bloques[j], bloques[i]];
    return { ...prev, bloques };
  });
  const cambiar = (i: number, cambio: Partial<DisenoRecibo['bloques'][number]>) =>
    setD(prev => ({ ...prev, bloques: prev.bloques.map((b, k) => (k === i ? { ...b, ...cambio } : b)) }));

  const guardarContacto = async (id: string, datos: { address?: string; phone?: string }) => {
    try { await ponerContacto(id, datos); }
    catch (e: any) { showToast('No se pudo guardar', e?.message ?? '', 'warning'); }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1fr_auto]">
        <div className="space-y-3 min-w-0">
          <div>
            <span className={etiqueta}>Ancho del papel</span>
            <div className="flex gap-2 mt-1">
              {([58, 80] as const).map(mm => (
                <button key={mm} type="button" onClick={() => setD({ ...d, anchoMm: mm })}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${d.anchoMm === mm
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300'}`}>
                  {mm}mm
                  <span className="block text-[0.6875rem] font-normal opacity-70">{mm === 58 ? 'térmica chica' : 'estándar POS'}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className={etiqueta}>Partes del recibo, de arriba abajo</span>
            <ul className="mt-1 space-y-1">
              {d.bloques.map((b, i) => (
                <li key={b.id} className={`flex items-center gap-1.5 p-1.5 rounded-xl border ${b.visible
                  ? 'bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-700'
                  : 'bg-slate-50 dark:bg-neutral-800/40 border-dashed border-slate-200 dark:border-neutral-800 opacity-60'}`}>
                  <span className="flex flex-col">
                    <button type="button" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir"
                      className="p-0.5 text-slate-400 hover:text-[var(--primary)] disabled:opacity-30 cursor-pointer"><ArrowUp className="w-3 h-3" /></button>
                    <button type="button" onClick={() => mover(i, 1)} disabled={i === d.bloques.length - 1} aria-label="Bajar"
                      className="p-0.5 text-slate-400 hover:text-[var(--primary)] disabled:opacity-30 cursor-pointer"><ArrowDown className="w-3 h-3" /></button>
                  </span>
                  <span className="flex-1 min-w-0 text-xs font-semibold text-slate-800 dark:text-neutral-100 truncate">{NOMBRE_BLOQUE[b.id]}</span>
                  <span className="flex rounded-lg bg-slate-100 dark:bg-neutral-800 p-0.5">
                    {([['izq', AlignLeft], ['centro', AlignCenter], ['der', AlignRight]] as const).map(([a, Icono]) => (
                      <button key={a} type="button" onClick={() => cambiar(i, { alinear: a })} aria-label={`Alinear ${a}`}
                        className={`p-1 rounded-md cursor-pointer ${b.alinear === a ? 'bg-white dark:bg-neutral-900 text-[var(--primary)] shadow-2xs' : 'text-slate-400'}`}>
                        <Icono className="w-3 h-3" />
                      </button>
                    ))}
                  </span>
                  <button type="button" onClick={() => cambiar(i, { raya: !b.raya })} title="Raya debajo"
                    className={`p-1 rounded-md cursor-pointer ${b.raya ? 'text-[var(--primary)] bg-[var(--primary)]/10' : 'text-slate-400'}`}>
                    <Minus className="w-3 h-3" />
                  </button>
                  <button type="button" onClick={() => cambiar(i, { visible: !b.visible })} title={b.visible ? 'Ocultar' : 'Mostrar'}
                    className="p-1 rounded-md text-slate-400 hover:text-[var(--primary)] cursor-pointer">
                    {b.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <label className="block">
            <span className={etiqueta}>Pie del recibo</span>
            <input value={d.pie} onChange={e => setD({ ...d, pie: e.target.value })} placeholder="¡Gracias por tu visita!" className={`${campo} mt-1`} />
          </label>
          <label className="block">
            <span className={etiqueta}>RNC / Identificación fiscal</span>
            <input value={d.rnc} onChange={e => setD({ ...d, rnc: e.target.value })} placeholder="Opcional" className={`${campo} mt-1`} />
          </label>

          <button type="button" disabled={!cambiado}
            onClick={() => { updateSettings({ reciboDiseno: d } as any); showToast('Diseño guardado', 'Los próximos recibos salen así.', 'success'); }}
            className="w-full py-2.5 rounded-xl bg-[var(--primary)] text-white text-xs font-extrabold disabled:opacity-40 transition cursor-pointer">
            {cambiado ? 'Guardar diseño' : 'Diseño guardado'}
          </button>
        </div>

        {/* Vista previa */}
        <div className="space-y-2">
          {varias && !actual && (
            <div className="flex flex-wrap gap-1">
              {sedes.map(s => (
                <button key={s.id} type="button" onClick={() => setVista(s.id)}
                  className={`px-2 py-1 rounded-full text-[0.6875rem] font-bold cursor-pointer ${vista === s.id
                    ? 'bg-[var(--primary)] text-white'
                    : 'bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300'}`}>
                  {s.name}
                </button>
              ))}
            </div>
          )}
          <div className="rounded-xl bg-slate-100 dark:bg-neutral-800 p-3 flex justify-center">
            <iframe title="Vista previa del recibo" srcDoc={html} sandbox=""
              className="bg-white shadow-md rounded-sm"
              style={{ width: `${Math.round(d.anchoMm * 3.78) + 2}px`, height: 460, border: 0 }} />
          </div>
        </div>
      </div>

      {/* Lo que cambia de una sede a otra */}
      {editables.length > 0 && (
        <div className="space-y-2">
          <span className={etiqueta}>{varias ? 'Dirección y teléfono de cada sede' : 'Dirección y teléfono'}</span>
          {editables.map(s => (
            <div key={s.id} className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200/60 dark:border-neutral-700/60 space-y-1.5">
              {varias && (
                <div className="flex items-center gap-1 text-xs font-bold text-slate-800 dark:text-neutral-100">
                  <MapPin className="w-3 h-3 text-[var(--primary)]" /> {s.name}
                </div>
              )}
              <div className="grid gap-1.5 sm:grid-cols-[2fr_1fr]">
                <input defaultValue={s.address ?? ''} placeholder="Dirección"
                  onBlur={e => e.target.value !== (s.address ?? '') && guardarContacto(s.id, { address: e.target.value })}
                  className={campo} aria-label={`Dirección de ${s.name}`} />
                <input defaultValue={s.phone ?? ''} placeholder="Teléfono"
                  onBlur={e => e.target.value !== (s.phone ?? '') && guardarContacto(s.id, { phone: e.target.value })}
                  className={campo} aria-label={`Teléfono de ${s.name}`} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
