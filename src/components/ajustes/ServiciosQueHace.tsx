import React, { useMemo, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useApp, type SalonStaff } from '../../context/AppContext';
import { categoriasPorZona } from '../../utils/quienHace';

/**
 * «Servicios que hace», debajo de la fila de una especialista en Equipo.
 * Lo mismo que «Quién lo hace» en el servicio, visto desde la persona: se
 * marcan los servicios y solo ella (y las demás marcadas) recibe esas citas.
 *
 * Para elegir rápido: los servicios van por categoría, primero los de su
 * zona, y tocar la categoría marca o desmarca todos los suyos.
 */
export const ServiciosQueHace: React.FC<{ persona: SalonStaff; onListo: () => void }> = ({ persona, onListo }) => {
  const { services, zonas, guardarServiciosDeEspecialista, showToast } = useApp();
  const nombre = persona.name.split(' ')[0];

  // En «Todas las sedes» un servicio puede estar varias veces (sus copias): va una vez por nombre
  const porNombre = useMemo(() => {
    const m = new Map<string, { nombre: string; categoria: string; categoriaNombre: string; ids: string[]; suyo: boolean }>();
    for (const s of services) {
      const k = s.name.trim().toLowerCase();
      const ya = m.get(k);
      const suyo = (s.especialistaIds ?? []).includes(persona.id);
      if (ya) { ya.ids.push(s.id); ya.suyo = ya.suyo || suyo; }
      else m.set(k, { nombre: s.name, categoria: s.category, categoriaNombre: s.categoryName, ids: [s.id], suyo });
    }
    return [...m.entries()].map(([clave, v]) => ({ clave, ...v }));
  }, [services, persona.id]);

  const [marcados, setMarcados] = useState<Set<string>>(() => new Set(porNombre.filter(s => s.suyo).map(s => s.clave)));
  const [guardando, setGuardando] = useState(false);
  const deSuZona = categoriasPorZona(persona, zonas ?? []);
  const conZona = !!deSuZona?.length;
  const [soloSuZona, setSoloSuZona] = useState(conZona);

  const categorias = useMemo(() => {
    const m = new Map<string, { nombre: string; servicios: typeof porNombre }>();
    for (const s of porNombre) {
      if (soloSuZona && conZona && !deSuZona!.includes(s.categoria) && !s.suyo) continue;
      const c = m.get(s.categoria) ?? { nombre: s.categoriaNombre || s.categoria, servicios: [] };
      c.servicios.push(s);
      m.set(s.categoria, c);
    }
    // Las de su zona primero
    return [...m.entries()].sort(([a], [b]) => Number(!!deSuZona?.includes(b)) - Number(!!deSuZona?.includes(a)));
  }, [porNombre, soloSuZona, conZona, deSuZona]);

  const alternar = (claves: string[], poner: boolean) =>
    setMarcados(prev => { const n = new Set(prev); claves.forEach(c => (poner ? n.add(c) : n.delete(c))); return n; });

  const guardar = async () => {
    setGuardando(true);
    try {
      const ids = porNombre.filter(s => marcados.has(s.clave)).flatMap(s => s.ids);
      await guardarServiciosDeEspecialista(persona.id, ids);
      showToast('Listo', marcados.size ? `${nombre} hace ${marcados.size} servicio${marcados.size === 1 ? '' : 's'}` : `${nombre} hace lo de su zona`, 'success');
      onListo();
    } catch (e: any) {
      showToast('No se pudo guardar', e?.message ?? 'Intenta de nuevo', 'warning');
    } finally {
      setGuardando(false);
    }
  };

  if (!porNombre.length) {
    return <p className="text-[0.75rem] text-slate-400">Todavía no hay servicios en el catálogo.</p>;
  }

  return (
    <div className="space-y-2.5">
      <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 leading-relaxed">
        ¿Qué servicios hace {nombre}? En los que marques, Lalan solo da la cita a quien esté marcada.
        Los que no tengan a nadie marcado siguen por zona.
      </p>
      {conZona && (
        <button type="button" onClick={() => setSoloSuZona(v => !v)}
          className="text-[0.6875rem] font-semibold text-[var(--primary)] hover:opacity-70 cursor-pointer">
          {soloSuZona ? 'Ver todos los servicios' : 'Solo los de su zona'}
        </button>
      )}
      <div className="space-y-2.5">
        {categorias.map(([clave, c]) => {
          const todas = c.servicios.every(s => marcados.has(s.clave));
          return (
            <div key={clave}>
              <button type="button" onClick={() => alternar(c.servicios.map(s => s.clave), !todas)}
                className="mb-1 flex items-center gap-1 text-[0.6875rem] font-bold uppercase tracking-wide text-slate-400 hover:text-[var(--primary)] cursor-pointer"
                title={todas ? 'Desmarcar todos' : 'Marcar todos'}>
                {c.nombre} · {todas ? 'quitar todos' : 'todos'}
              </button>
              <div className="flex flex-wrap gap-1.5">
                {c.servicios.map(s => {
                  const marcado = marcados.has(s.clave);
                  return (
                    <button key={s.clave} type="button" aria-pressed={marcado} onClick={() => alternar([s.clave], !marcado)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[0.75rem] font-semibold border transition cursor-pointer ${
                        marcado ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'bg-slate-50 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 border-slate-200 dark:border-neutral-700'
                      }`}>
                      {marcado && <Check className="w-3 h-3" />} {s.nombre}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-end">
        <button type="button" disabled={guardando} onClick={() => void guardar()}
          className="px-3 py-2 rounded-xl bg-[var(--primary)] text-white text-[0.75rem] font-bold hover:opacity-90 transition disabled:opacity-40 cursor-pointer flex items-center gap-1">
          {guardando && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Guardar
        </button>
      </div>
    </div>
  );
};
