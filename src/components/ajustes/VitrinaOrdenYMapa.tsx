import React, { useEffect, useMemo, useState } from 'react';
import { Reorder, useDragControls } from 'motion/react';
import { ArrowDown, ArrowUp, Crosshair, GripVertical, Loader2, MapPin, Search, Sparkles, Trash2 } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import MapaSede, { type PuntoMapa } from '../vitrina/MapaSede';
import { ordenarParaVitrina } from '../vitrina/PaginaVitrina';
import type { ConfigVitrina, DatosVitrina, DisenoVitrina } from '../../types/vitrina';

const TARJETA = 'p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs';
const TITULO = 'text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white';
const AYUDA = 'text-[0.75rem] text-slate-400 leading-relaxed';
const BOTON = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[0.75rem] font-semibold text-slate-700 dark:text-neutral-200 bg-slate-100 dark:bg-neutral-800 disabled:opacity-50';
/** Igual que el servidor (MAXIMO_DESTACADOS) */
const MAXIMO_DESTACADOS = 12;

const Etiqueta: React.FC<{ sede: string }> = ({ sede }) => (
  <span className="inline-flex min-w-0 max-w-[55%] items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-neutral-800 text-[0.6875rem] text-slate-500 dark:text-neutral-400">
    <MapPin className="w-3 h-3 shrink-0" /><span className="truncate">{sede}</span>
  </span>
);

type Que = 'servicios' | 'productos';

/**
 * El orden de servicios y productos en la Vitrina, como en un menú: lo que
 * va primero se vende más. Se arrastra por el asa o con las flechas (en el
 * teléfono arrastrar dentro de una lista que se desliza falla). Va con el
 * diseño: se ve al momento en la vista previa y se guarda con «Guardar».
 */
export const OrdenCatalogo: React.FC<{
  datos: DatosVitrina | null; borrador: DisenoVitrina; sede: string; cambiar: (c: Partial<DisenoVitrina>) => void;
}> = ({ datos, borrador, sede, cambiar }) => {
  const { showToast } = useApp();
  const [que, setQue] = useState<Que>('servicios');
  const destacados = borrador.destacados ?? [];
  const orden = borrador.orden ?? { servicios: [], productos: [] };
  const lista = useMemo(
    () => (datos ? ordenarParaVitrina<{ id: string; nombre: string }>(datos[que], orden[que], destacados) : []),
    [datos, que, orden, destacados],
  );

  const poner = (ids: string[]) => cambiar({ orden: { ...orden, [que]: ids } });
  const mover = (i: number, d: -1 | 1) => {
    const ids = lista.map((x) => x.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    poner(ids);
  };
  const destacar = (id: string) => {
    if (destacados.includes(id)) { cambiar({ destacados: destacados.filter((x) => x !== id) }); return; }
    if (destacados.length >= MAXIMO_DESTACADOS) { showToast('Ya hay muchos recomendados', `Hasta ${MAXIMO_DESTACADOS}: si todo se recomienda, nada destaca.`, 'warning'); return; }
    cambiar({ destacados: [...destacados, id] });
  };

  return (
    <div data-guia="vitrina-orden" className={`${TARJETA} space-y-3`}>
      <div className="flex items-center justify-between gap-2"><h2 className={TITULO}>Orden en la Vitrina</h2><Etiqueta sede={sede} /></div>
      <p className={AYUDA}>
        Como en un menú: lo que sale primero se vende más. Arrastra por <GripVertical className="inline w-3.5 h-3.5 -mt-0.5" /> o usa las flechas.
        Con <Sparkles className="inline w-3.5 h-3.5 -mt-0.5" /> lo recomiendas: sale arriba de todo y con la etiqueta «Recomendado».
      </p>
      <div className="flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-neutral-800" role="tablist">
        {(['servicios', 'productos'] as const).map((x) => (
          <button key={x} type="button" role="tab" aria-selected={que === x} onClick={() => setQue(x)}
            className={`flex-1 py-1.5 rounded-lg text-[0.8125rem] font-semibold capitalize transition ${que === x ? 'bg-white dark:bg-neutral-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'}`}>
            {x} {datos ? `(${datos[x].length})` : ''}
          </button>
        ))}
      </div>
      {!datos ? (
        <p className="flex items-center gap-2 text-[0.8125rem] text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</p>
      ) : !lista.length ? (
        <p className={AYUDA}>
          {que === 'servicios' ? 'No hay servicios publicados en esta sede.' : 'No hay productos a la vista: publícalos en Catálogo, ten existencias en esta sede y deja visible el bloque «Productos».'}
        </p>
      ) : (
        <Reorder.Group axis="y" values={lista.map((x) => x.id)} onReorder={poner} layoutScroll
          className="max-h-[420px] overflow-y-auto space-y-1.5 pr-1">
          {lista.map((x, i) => (
            <Fila key={x.id} id={x.id} nombre={x.nombre} puesto={i + 1} recomendado={destacados.includes(x.id)}
              primero={i === 0} ultimo={i === lista.length - 1} subir={() => mover(i, -1)} bajar={() => mover(i, 1)} destacar={() => destacar(x.id)} />
          ))}
        </Reorder.Group>
      )}
      {(orden[que].length > 0 || destacados.length > 0) && (
        <button type="button" className="text-[0.75rem] text-slate-500 underline"
          onClick={() => cambiar({ orden: { ...orden, [que]: [] }, destacados: destacados.filter((id) => !lista.some((x) => x.id === id)) })}>
          Volver al orden de siempre
        </button>
      )}
    </div>
  );
};

const Fila: React.FC<{
  id: string; nombre: string; puesto: number; recomendado: boolean; primero: boolean; ultimo: boolean;
  subir: () => void; bajar: () => void; destacar: () => void;
}> = ({ id, nombre, puesto, recomendado, primero, ultimo, subir, bajar, destacar }) => {
  const agarre = useDragControls();
  const flecha = 'w-8 h-8 grid place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-neutral-800 disabled:opacity-25';
  return (
    <Reorder.Item value={id} dragListener={false} dragControls={agarre}
      className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-1.5 py-1.5">
      <button type="button" onPointerDown={(e) => agarre.start(e)} aria-label={`Arrastrar ${nombre}`}
        className="w-7 h-8 grid place-items-center text-slate-400 cursor-grab active:cursor-grabbing touch-none"><GripVertical className="w-4 h-4" /></button>
      <span className="w-6 text-right text-[0.6875rem] tabular-nums text-slate-400">{puesto}</span>
      <span className="flex-1 min-w-0 truncate text-[0.8125rem] font-medium text-slate-800 dark:text-neutral-100">{nombre}</span>
      <button type="button" onClick={destacar} aria-pressed={recomendado} aria-label={recomendado ? `Dejar de recomendar ${nombre}` : `Recomendar ${nombre}`}
        className={`w-8 h-8 grid place-items-center rounded-lg ${recomendado ? 'text-[var(--primary)] bg-[var(--primary)]/10' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800'}`}>
        <Sparkles className="w-4 h-4" />
      </button>
      <button type="button" disabled={primero} onClick={subir} aria-label={`Subir ${nombre}`} className={flecha}><ArrowUp className="w-4 h-4" /></button>
      <button type="button" disabled={ultimo} onClick={bajar} aria-label={`Bajar ${nombre}`} className={flecha}><ArrowDown className="w-4 h-4" /></button>
    </Reorder.Item>
  );
};

/**
 * Dónde está el local: la dueña mueve el pin o toca donde está la puerta.
 * Con el pin, la Vitrina muestra el mapa y Maps y Waze llevan justo ahí; sin
 * él, buscan la dirección. Se guarda al tocar «Guardar ubicación».
 */
export const UbicacionSede: React.FC<{
  cfg: ConfigVitrina; q: string; direccion: string | null; recargar: (c: ConfigVitrina) => void;
}> = ({ cfg, q, direccion, recargar }) => {
  const { showToast } = useApp();
  const [punto, setPunto] = useState<PuntoMapa | null>(cfg.ubicacion ?? null);
  const [ocupado, setOcupado] = useState<'buscar' | 'aqui' | 'guardar' | null>(null);
  useEffect(() => { setPunto(cfg.ubicacion ?? null); }, [cfg.ubicacion, cfg.sede.id]);

  const sucio = JSON.stringify(punto) !== JSON.stringify(cfg.ubicacion ?? null);

  const buscar = async () => {
    if (!direccion) return;
    setOcupado('buscar');
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(direccion)}`, { headers: { 'Accept-Language': 'es' } });
      const [x] = (await r.json()) as { lat: string; lon: string }[];
      if (x) setPunto({ latitud: Number(x.lat), longitud: Number(x.lon) });
      else showToast('No encontré esa dirección', 'Mueve el mapa y toca donde está el local.', 'info');
    } catch { showToast('No se pudo buscar', 'Mueve el mapa y toca donde está el local.', 'warning'); }
    finally { setOcupado(null); }
  };

  const aqui = () => {
    if (!navigator.geolocation) { showToast('Este aparato no da su ubicación', 'Toca en el mapa donde está el local.', 'info'); return; }
    setOcupado('aqui');
    navigator.geolocation.getCurrentPosition(
      (p) => { setPunto({ latitud: p.coords.latitude, longitud: p.coords.longitude }); setOcupado(null); },
      () => { showToast('No pude saber dónde estás', 'Revisa el permiso de ubicación o toca en el mapa.', 'info'); setOcupado(null); },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const guardar = async (ubicacion: PuntoMapa | null) => {
    setOcupado('guardar');
    try {
      const c = await api.patch<ConfigVitrina>(`/vitrina${q}`, { ubicacion });
      recargar(c);
      showToast(ubicacion ? 'Ubicación guardada' : 'Pin quitado', ubicacion ? 'La Vitrina ya muestra el mapa.' : 'La Vitrina muestra solo la dirección.', 'success');
    } catch (e: any) { showToast('No se pudo guardar', e?.message ?? 'Inténtalo de nuevo.', 'warning'); }
    finally { setOcupado(null); }
  };

  const quitar = () => {
    if (!window.confirm('¿Quitar el pin del mapa? La Vitrina mostrará solo la dirección.')) return;
    void guardar(null);
  };

  return (
    <div data-guia="vitrina-mapa" className={`${TARJETA} space-y-3`}>
      <div className="flex items-center justify-between gap-2"><h2 className={TITULO}>Ubicación en el mapa</h2><Etiqueta sede={cfg.sede.nombre} /></div>
      <p className={AYUDA}>Toca donde está la puerta o arrastra el pin. Así el mapa de la Vitrina, Google Maps y Waze llevan justo al local.</p>
      <MapaSede punto={punto} cambiar={setPunto} alto={260} color="var(--primary)" etiqueta={`Mapa de ${cfg.sede.nombre}`} />
      <div className="flex flex-wrap gap-2">
        {direccion && (
          <button type="button" onClick={() => void buscar()} disabled={!!ocupado} className={BOTON}>
            {ocupado === 'buscar' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />} Buscar mi dirección
          </button>
        )}
        <button type="button" onClick={aqui} disabled={!!ocupado} className={BOTON}>
          {ocupado === 'aqui' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5" />} Estoy en el local
        </button>
        {cfg.ubicacion && (
          <button type="button" onClick={quitar} disabled={!!ocupado} className={`${BOTON} text-rose-600 bg-rose-50 dark:bg-rose-500/10`}>
            <Trash2 className="w-3.5 h-3.5" /> Quitar pin
          </button>
        )}
      </div>
      {sucio && punto && (
        <button type="button" onClick={() => void guardar(punto)} disabled={!!ocupado}
          className="w-full min-h-[40px] rounded-xl bg-[var(--primary)] text-white text-[0.8125rem] font-bold disabled:opacity-50 inline-flex items-center justify-center gap-2">
          {ocupado === 'guardar' && <Loader2 className="w-4 h-4 animate-spin" />} Guardar ubicación
        </button>
      )}
      {direccion && <p className="text-[0.6875rem] text-slate-400">Dirección de la sede: {direccion}</p>}
    </div>
  );
};
