import React, { useEffect, useMemo, useState } from 'react';
import { Check, Clock, Plus, Sparkles, Trash2 } from 'lucide-react';
import { bienvenidaApi } from '../../services/bienvenida';
import type { Plantillas, ServicioAGuardar, ServicioLeido } from '../../types/bienvenida';
import { Aviso, BotonFoto, BotonPrincipal, BotonSecundario, Cargando, Encabezado, Tarjeta, claseCampo, leerNumero } from './comun';

interface Marca { marcado: boolean; precio: string; duracion: number; deLaFoto?: boolean }
/** Un servicio que no está en la lista de su tipo de salón (escrito a mano o leído de la foto) */
interface Extra { clave: string; nombre: string; precio: string; duracion: number; plantilla?: string; serviceId?: string; categoria?: string; deLaFoto?: boolean }

const DURACIONES = [15, 20, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240];
const minutos = (m: number) => (m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60}` : `${m / 60} h`);
const nuevaClave = () => `extra-${Math.random().toString(36).slice(2, 9)}`;

/**
 * Paso 5: marcar casillas y poner precios. Los servicios típicos de su tipo
 * de salón ya vienen con la duración y lo que llevan; los más comunes, ya
 * marcados. Con una foto de su lista de precios se llena solo.
 */
export const PasoServicios: React.FC<{ onSiguiente: () => void }> = ({ onSiguiente }) => {
  const [plantillas, setPlantillas] = useState<Plantillas | null>(null);
  const [marcas, setMarcas] = useState<Record<string, Marca>>({});
  const [extras, setExtras] = useState<Extra[]>([]);
  const [leyendo, setLeyendo] = useState(false);
  const [resumenFoto, setResumenFoto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    bienvenidaApi.plantillas()
      .then((p) => {
        setPlantillas(p);
        const yaTiene = p.servicios.some((s) => s.yaLoTienes);
        setMarcas(Object.fromEntries(p.servicios.map((s) => [s.clave, {
          // Si ya tiene servicios, se marca lo que tiene; si empieza, lo más común
          marcado: s.yaLoTienes ? true : !yaTiene && s.comun,
          precio: s.yaLoTienes ? String(s.yaLoTienes.precio) : '',
          duracion: s.yaLoTienes?.duracion ?? s.duracion,
        }])));
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  const grupos = useMemo(() => {
    const m = new Map<string, Plantillas['servicios']>();
    for (const s of plantillas?.servicios ?? []) m.set(s.categoriaNombre, [...(m.get(s.categoriaNombre) ?? []), s]);
    return [...m.entries()];
  }, [plantillas]);

  const cambiar = (clave: string, c: Partial<Marca>) => setMarcas((m) => ({ ...m, [clave]: { ...m[clave], ...c } }));
  const cambiarExtra = (clave: string, c: Partial<Extra>) => setExtras((x) => x.map((e) => (e.clave === clave ? { ...e, ...c } : e)));

  /** Lo leído de la foto se reparte: lo reconocido marca su casilla; lo demás entra como servicio aparte */
  const aplicarFoto = (leidos: ServicioLeido[]) => {
    if (!leidos.length) { setResumenFoto('No encontré servicios con precio en esa foto. Prueba con una más clara y derecha.'); return; }
    const enLista = new Set(plantillas?.servicios.map((s) => s.clave));
    const nuevasMarcas: Record<string, Marca> = {};
    const nuevosExtras: Extra[] = [];
    for (const l of leidos) {
      const precio = l.precio != null ? String(l.precio) : '';
      if (l.plantilla && enLista.has(l.plantilla) && !nuevasMarcas[l.plantilla]) {
        nuevasMarcas[l.plantilla] = { marcado: true, precio, duracion: l.duracion ?? marcas[l.plantilla]?.duracion ?? 60, deLaFoto: true };
      } else {
        nuevosExtras.push({
          clave: nuevaClave(), nombre: l.leido, precio, duracion: l.duracion ?? 60, deLaFoto: true,
          plantilla: l.plantilla ?? undefined, serviceId: l.serviceIdExistente ?? undefined, categoria: l.categoria ?? undefined,
        });
      }
    }
    setMarcas((m) => ({ ...m, ...Object.fromEntries(Object.entries(nuevasMarcas).map(([k, v]) => [k, { ...m[k], ...v }])) }));
    setExtras((x) => [...x, ...nuevosExtras]);
    const reconocidos = Object.keys(nuevasMarcas).length;
    setResumenFoto(`Leí ${leidos.length} servicios: ${reconocidos} los marqué en la lista y ${nuevosExtras.length} los puse abajo como servicios tuyos. Revisa los precios antes de seguir.`);
  };

  const leerFoto = async (fotos: File[]) => {
    setError(''); setResumenFoto('');
    setLeyendo(true);
    try { aplicarFoto(await bienvenidaApi.fotoPrecios(fotos)); } catch (e) { setError((e as Error).message); } finally { setLeyendo(false); }
  };

  const seguir = async () => {
    setError('');
    const lista: ServicioAGuardar[] = [];
    for (const s of plantillas?.servicios ?? []) {
      const m = marcas[s.clave];
      if (!m?.marcado) continue;
      const precio = leerNumero(m.precio);
      if (precio == null) { setError(`Ponle precio a "${s.nombre}".`); return; }
      lista.push(s.yaLoTienes ? { serviceId: s.yaLoTienes.serviceId, plantilla: s.clave, precio, duracion: m.duracion } : { plantilla: s.clave, precio, duracion: m.duracion });
    }
    for (const e of extras) {
      if (!e.nombre.trim()) continue;
      const precio = leerNumero(e.precio);
      if (precio == null) { setError(`Ponle precio a "${e.nombre}".`); return; }
      lista.push({
        ...(e.serviceId ? { serviceId: e.serviceId } : e.plantilla ? { plantilla: e.plantilla } : {}),
        nombre: e.nombre.trim(), categoria: e.categoria, precio, duracion: e.duracion,
      });
    }
    if (!lista.length) { setError('Marca al menos un servicio.'); return; }
    setGuardando(true);
    try {
      await bienvenidaApi.servicios(lista);
      onSiguiente();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  if (!plantillas && !error) return <Cargando />;
  const marcados = Object.values(marcas).filter((m) => m.marcado).length + extras.filter((e) => e.nombre.trim()).length;

  return (
    <div className="space-y-5">
      <Encabezado titulo="¿Qué servicios haces?" texto="Marca los que haces y pon tu precio. La duración y lo que lleva cada uno ya los preparé; los puedes cambiar." />
      <Tarjeta className="space-y-2">
        <p className="text-[0.875rem] text-slate-600 dark:text-neutral-300 flex items-start gap-2">
          <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-[var(--primary)]" />
          ¿Tienes tu lista de precios en un letrero, un flyer o en WhatsApp? Tómale una foto y la lleno yo.
        </p>
        <BotonFoto texto="Foto de mi lista de precios" cargando={leyendo} onFotos={leerFoto} />
        {resumenFoto && <Aviso>{resumenFoto}</Aviso>}
      </Tarjeta>

      {grupos.map(([categoria, servicios]) => (
        <div key={categoria} className="space-y-2">
          <p className="text-[0.75rem] font-bold uppercase tracking-wider text-slate-400 px-1">{categoria}</p>
          <Tarjeta className="!p-0 divide-y divide-slate-100 dark:divide-neutral-800">
            {servicios.map((s) => {
              const m = marcas[s.clave];
              if (!m) return null;
              return (
                <div key={s.clave} className="p-3.5 space-y-2.5">
                  <button type="button" onClick={() => cambiar(s.clave, { marcado: !m.marcado })} aria-pressed={m.marcado} className="w-full flex items-center gap-3 text-left cursor-pointer">
                    <span className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 ${m.marcado ? 'bg-[var(--primary)] border-[var(--primary)]' : 'border-slate-300 dark:border-neutral-600'}`}>
                      {m.marcado && <Check className="w-4 h-4 text-white" />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold text-[0.9375rem] text-slate-900 dark:text-white">{s.nombre}</span>
                      {s.lleva.length > 0 && <span className="block text-[0.75rem] text-slate-400 truncate">Lleva: {s.lleva.slice(0, 4).join(', ')}{s.lleva.length > 4 ? '…' : ''}</span>}
                    </span>
                    {m.deLaFoto && <span className="text-[0.6875rem] font-bold text-[var(--primary)]">De la foto</span>}
                  </button>
                  {m.marcado && (
                    <div className="flex items-center gap-2 pl-9">
                      <input value={m.precio} onChange={(e) => cambiar(s.clave, { precio: e.target.value })} inputMode="decimal" placeholder="Precio" aria-label={`Precio de ${s.nombre}`} className={`${claseCampo} flex-1`} />
                      <SelectorDuracion valor={m.duracion} onCambio={(d) => cambiar(s.clave, { duracion: d })} />
                    </div>
                  )}
                </div>
              );
            })}
          </Tarjeta>
        </div>
      ))}

      <div className="space-y-2">
        <p className="text-[0.75rem] font-bold uppercase tracking-wider text-slate-400 px-1">Otros servicios tuyos</p>
        {extras.map((e) => (
          <Tarjeta key={e.clave} className="space-y-2">
            <div className="flex items-center gap-2">
              <input value={e.nombre} onChange={(x) => cambiarExtra(e.clave, { nombre: x.target.value })} placeholder="Nombre del servicio" maxLength={80} className={`${claseCampo} flex-1`} />
              <button type="button" aria-label="Quitar" onClick={() => setExtras((x) => x.filter((y) => y.clave !== e.clave))} className="p-2 text-slate-400 hover:text-rose-500 cursor-pointer"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="flex items-center gap-2">
              <input value={e.precio} onChange={(x) => cambiarExtra(e.clave, { precio: x.target.value })} inputMode="decimal" placeholder="Precio" className={`${claseCampo} flex-1`} />
              <SelectorDuracion valor={e.duracion} onCambio={(d) => cambiarExtra(e.clave, { duracion: d })} />
            </div>
            {(e.deLaFoto || e.serviceId) && (
              <p className="text-[0.75rem] text-slate-400">{e.serviceId ? 'Ya lo tienes: se actualiza su precio.' : 'Leído de la foto.'}</p>
            )}
          </Tarjeta>
        ))}
        <BotonSecundario onClick={() => setExtras((x) => [...x, { clave: nuevaClave(), nombre: '', precio: '', duracion: 60 }])} className="w-full">
          <Plus className="w-4 h-4" /> Agregar otro servicio
        </BotonSecundario>
      </div>

      {error && <Aviso tipo="error">{error}</Aviso>}
      <div className="sticky bottom-0 -mx-4 px-4 pt-3 pb-1 bg-gradient-to-t from-[#f8fafc] dark:from-[#09090b] via-[#f8fafc] dark:via-[#09090b] to-transparent">
        <BotonPrincipal onClick={seguir} cargando={guardando} className="w-full">
          Guardar {marcados} {marcados === 1 ? 'servicio' : 'servicios'}
        </BotonPrincipal>
      </div>
    </div>
  );
};

const SelectorDuracion: React.FC<{ valor: number; onCambio: (m: number) => void }> = ({ valor, onCambio }) => {
  const opciones = DURACIONES.includes(valor) ? DURACIONES : [...DURACIONES, valor].sort((a, b) => a - b);
  return (
    <label className="relative flex items-center">
      <Clock className="absolute left-2.5 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
      <select value={valor} onChange={(e) => onCambio(Number(e.target.value))} aria-label="Duración"
        className="appearance-none pl-7 pr-3 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.875rem] text-slate-700 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-[var(--primary)] cursor-pointer">
        {opciones.map((m) => <option key={m} value={m}>{minutos(m)}</option>)}
      </select>
    </label>
  );
};

