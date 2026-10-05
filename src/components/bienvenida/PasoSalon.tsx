import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { api } from '../../services/api';
import { bienvenidaApi } from '../../services/bienvenida';
import type { TipoSalon, TipoSalonCatalogo } from '../../types/bienvenida';
import { Aviso, BotonPrincipal, Cargando, Encabezado, Etiqueta, claseCampo } from './comun';

/** Paso 1: cómo se llama el salón y qué tipo de salón es (varios = multiservicio) */
export const PasoSalon: React.FC<{ tiposElegidos: TipoSalon[]; onSiguiente: () => void }> = ({ tiposElegidos, onSiguiente }) => {
  const [nombre, setNombre] = useState('');
  const [tipos, setTipos] = useState<TipoSalon[]>(tiposElegidos);
  const [catalogo, setCatalogo] = useState<TipoSalonCatalogo[] | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void Promise.all([
      api.get<{ salonName: string }>('/salon/sede').then((s) => setNombre(s.salonName ?? '')).catch(() => undefined),
      bienvenidaApi.plantillas().then((p) => setCatalogo(p.tiposSalon)).catch((e) => setError((e as Error).message)),
    ]);
  }, []);

  const alternar = (t: TipoSalon) => setTipos((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]));

  const seguir = async () => {
    setError('');
    if (!nombre.trim()) { setError('Ponle nombre a tu salón.'); return; }
    if (!tipos.length) { setError('Elige al menos un tipo de salón.'); return; }
    setGuardando(true);
    try {
      await bienvenidaApi.salon({ nombre: nombre.trim(), tipos });
      onSiguiente();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  if (!catalogo && !error) return <Cargando />;

  return (
    <div className="space-y-5">
      <Encabezado titulo="Cuéntame de tu salón" texto="Con esto preparo los servicios típicos para que no empieces en blanco." />
      <Etiqueta texto="¿Cómo se llama tu salón?">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} placeholder="Ej.: Alanny Nails & Spa" className={claseCampo} />
      </Etiqueta>
      <div className="space-y-2">
        <p className="text-[0.8125rem] font-semibold text-slate-600 dark:text-neutral-300">¿Qué haces? Puedes elegir varios.</p>
        <div className="grid grid-cols-2 gap-2.5">
          {(catalogo ?? []).map((t) => {
            const activo = tipos.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => alternar(t.id)}
                aria-pressed={activo}
                className={`relative text-left rounded-2xl p-3.5 border-2 transition-colors cursor-pointer ${
                  activo ? 'border-[var(--primary)] bg-[var(--primary)]/5' : 'border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
                }`}
              >
                {activo && <Check className="absolute top-2.5 right-2.5 w-4 h-4 text-[var(--primary)]" />}
                <div className="text-2xl">{t.icono}</div>
                <div className="mt-1 font-bold text-[0.9375rem] text-slate-900 dark:text-white">{t.nombre}</div>
                <div className="text-[0.75rem] leading-snug text-slate-500 dark:text-neutral-400">{t.descripcion}</div>
              </button>
            );
          })}
        </div>
        {tipos.length > 1 && <p className="text-[0.8125rem] text-slate-500">Multiservicio: te muestro los servicios de todos.</p>}
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <BotonPrincipal onClick={seguir} cargando={guardando} className="w-full">Siguiente</BotonPrincipal>
    </div>
  );
};
