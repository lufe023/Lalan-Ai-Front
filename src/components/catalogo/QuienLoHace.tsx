import React, { useEffect, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useSedeActiva } from '../../context/SedeActivaContext';
import { useEncuadres } from '../../hooks/useEncuadres';
import { recibeCitas } from '../../utils/recibeCitas';
import { haceLaCategoria, quienesLoHacen, trabajaEn } from '../../utils/quienHace';
import { AvatarEspecialista } from '../ajustes/FotoEspecialista';

/**
 * «Quién lo hace», en el formulario del servicio. La dueña toca a una o a
 * varias y solo ellas reciben las citas de este servicio (en el chat, la
 * Vitrina y el quiosco). Sin marcar a nadie decide la zona, como siempre.
 *
 * Primero salen las de la zona que tiene su categoría, para elegir rápido;
 * «Ver a todo el equipo» abre el resto. Abajo dice con nombres quién lo hace hoy.
 */
export const QuienLoHace: React.FC<{
  category: string;
  value: string[];
  onChange: (ids: string[]) => void;
}> = ({ category, value, onChange }) => {
  const { especialistas, loadEspecialistas, zonas, loadZonas, categoriaPorClave, navigateTo } = useApp();
  const { actual: sedeActual } = useSedeActiva();
  const { encuadres } = useEncuadres();
  const [todas, setTodas] = useState(false);

  useEffect(() => { void loadEspecialistas?.(); void loadZonas?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const lista = (zonas ?? []);
  const equipo = (especialistas ?? []).filter(e => e.active && recibeCitas(e.atiendeCitas, e.role) && trabajaEn(e, sedeActual?.id));
  const deLaZona = equipo.filter(e => haceLaCategoria(e, category, lista));
  const resto = equipo.filter(e => !deLaZona.includes(e));
  // Las marcadas de fuera de la zona siempre se ven
  const visibles = todas ? [...deLaZona, ...resto] : [...deLaZona, ...resto.filter(e => value.includes(e.id))];
  const ocultas = todas ? 0 : resto.filter(e => !value.includes(e.id)).length;
  const nombreCategoria = categoriaPorClave('service', category)?.name ?? 'esta categoría';
  const hoy = quienesLoHacen(especialistas ?? [], lista, { category, especialistaIds: value }, sedeActual?.id);

  /** Ajustes → Equipo → Especialistas, abierta */
  const irAEquipo = () => {
    try {
      sessionStorage.setItem('lalan_ajustes_seccion', 'equipo');
      sessionStorage.setItem('lalan.abrirEspecialistas', 'personas');
    } catch { /* nada */ }
    navigateTo('settings');
  };

  const alternar = (id: string) => onChange(value.includes(id) ? value.filter(x => x !== id) : [...value, id]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="flex items-center gap-1 text-[0.6875rem] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">
          <Users className="w-3 h-3" /> Quién lo hace
        </label>
        {value.length > 0 && (
          <button type="button" onClick={() => onChange([])}
            className="text-[0.6875rem] font-semibold text-[var(--primary)] hover:opacity-70 cursor-pointer">
            Que decida la zona
          </button>
        )}
      </div>

      {!equipo.length ? (
        <p className="text-[0.75rem] text-slate-400 leading-relaxed">
          Todavía no hay especialistas que reciban citas{sedeActual ? ` en ${sedeActual.name}` : ''}.{' '}
          <button type="button" onClick={irAEquipo} className="font-semibold text-[var(--primary)] hover:opacity-70 cursor-pointer">
            Agrégalas en Equipo
          </button>
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-1.5">
            {visibles.map(e => {
              const marcada = value.includes(e.id);
              return (
                <button
                  key={e.id}
                  type="button"
                  aria-pressed={marcada}
                  onClick={() => alternar(e.id)}
                  className={`flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-[0.75rem] font-semibold border transition cursor-pointer ${
                    marcada
                      ? 'bg-[var(--primary)] text-white border-[var(--primary)]'
                      : 'bg-slate-50 dark:bg-neutral-800 text-slate-600 dark:text-neutral-300 border-slate-200 dark:border-neutral-700 hover:border-[var(--primary)]/50'
                  }`}
                >
                  <span className="rounded-full bg-white dark:bg-neutral-900">
                    <AvatarEspecialista fotoId={e.fotoId} nombre={e.name} encuadre={e.fotoId ? encuadres[e.fotoId] : null} className="w-6 h-6" pideFoto={false} />
                  </span>
                  {e.name.split(' ')[0]}
                  {marcada && <Check className="w-3 h-3" />}
                </button>
              );
            })}
          </div>
          {(ocultas > 0 || todas) && resto.length > 0 && (
            <button type="button" onClick={() => setTodas(t => !t)}
              className="mt-1.5 flex items-center gap-1 text-[0.6875rem] font-semibold text-slate-500 dark:text-neutral-400 hover:text-[var(--primary)] cursor-pointer">
              {todas ? <><ChevronUp className="w-3 h-3" /> Solo las de la zona de {nombreCategoria}</> : <><ChevronDown className="w-3 h-3" /> Ver a todo el equipo ({ocultas} más)</>}
            </button>
          )}
          <p className="mt-1.5 text-[0.6875rem] text-slate-400 leading-relaxed">
            {hoy.porMarca
              ? <>Solo {nombres(hoy.gente)} {hoy.gente.length > 1 ? 'reciben' : 'recibe'} las citas de este servicio.</>
              : hoy.gente.length
                ? <>Sin marcar a nadie lo hace{hoy.gente.length > 1 ? 'n' : ''} {nombres(hoy.gente)}, por su zona. Toca a quien lo hace para que sea solo ella.</>
                : <>Nadie tiene {nombreCategoria} en su zona: marca aquí quién lo hace o Lalan no podrá darle cita.</>}
          </p>
        </>
      )}
    </div>
  );
};

function nombres(gente: { name: string }[]) {
  const n = gente.map(g => g.name.split(' ')[0]);
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}` : n[0] ?? '';
}
