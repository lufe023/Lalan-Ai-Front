import React, { useEffect, useState } from 'react';
import { ExternalLink, MousePointerClick, Loader2 } from 'lucide-react';
import { api } from '../../services/api';

type Dispositivo = 'pc' | 'tableta' | 'movil';
interface Resumen {
  pantallas: { pantalla: string; visitas: number; segundosMedios: number; salones: number }[];
  clicsPorPantalla: { pantalla: string; clics: number }[];
  destacados: { detalle: string; clics: number }[];
}

/** Nombre de cada pantalla de la app, como sale en el menú */
const PANTALLAS: { id: string; nombre: string }[] = [
  { id: 'dashboard', nombre: 'Métricas' }, { id: 'calendar', nombre: 'Agenda' }, { id: 'sala', nombre: 'Sala' }, { id: 'clients', nombre: 'Clientas' },
  { id: 'lounge', nombre: 'Lounge' }, { id: 'caja', nombre: 'Caja' }, { id: 'chats', nombre: 'Chats' }, { id: 'catalog', nombre: 'Catálogo' },
  { id: 'settings', nombre: 'Ajustes' }, { id: 'price-lists', nombre: 'Precios' }, { id: 'ganancias', nombre: 'Ganancias' },
  { id: 'citas-report', nombre: 'Informe de citas' }, { id: 'bots', nombre: 'Lalan (bots)' },
];
const nombre = (id: string) => (id === 'menu' ? 'Menú' : PANTALLAS.find((p) => p.id === id)?.nombre ?? id);
const ANCHO: Record<Dispositivo, number> = { pc: 1280, tableta: 820, movil: 390 };
const DISPOSITIVOS: { id: Dispositivo; nombre: string }[] = [{ id: 'pc', nombre: 'PC' }, { id: 'tableta', nombre: 'Tableta' }, { id: 'movil', nombre: 'Móvil' }];
const tiempo = (s: number) => (s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`);

/** El mapa de calor de la app por dentro: qué pantallas usan los salones y dónde tocan */
export const UsoAppPanel: React.FC<{ desde: string }> = ({ desde }) => {
  const [pantalla, setPantalla] = useState('calendar');
  const [disp, setDisp] = useState<Dispositivo>('pc');
  const [r, setR] = useState<Resumen | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const q = new URLSearchParams({ desde, dispositivo: disp, pantalla });
    api.get<Resumen>(`/plataforma/app/resumen?${q}`).then(setR).catch((e) => setError((e as Error).message));
  }, [desde, disp, pantalla]);

  const url = `/app/?calor=app&pantalla=${pantalla}&dispositivo=${disp}&desde=${encodeURIComponent(desde)}`;
  const max = Math.max(...(r?.pantallas.map((p) => p.visitas) ?? [1]), 1);

  return (
    <div className="grid xl:grid-cols-[1fr_320px] gap-3">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {PANTALLAS.map((p) => (
              <button key={p.id} type="button" onClick={() => setPantalla(p.id)}
                className={`px-3 py-1.5 rounded-full text-[12px] font-semibold border cursor-pointer ${pantalla === p.id ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300'}`}>{p.nombre}</button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {DISPOSITIVOS.map((d) => (
              <button key={d.id} type="button" onClick={() => setDisp(d.id)}
                className={`px-2.5 py-1.5 rounded-full text-[11px] font-semibold border cursor-pointer ${disp === d.id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'border-slate-200 dark:border-neutral-700 text-slate-500'}`}>{d.nombre}</button>
            ))}
            <a href={url} target="_blank" rel="noopener" className="flex items-center gap-1 text-[12px] font-semibold text-[var(--primary)] hover:underline ml-2"><ExternalLink className="w-3.5 h-3.5" /> Abrir</a>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-neutral-400">Se ve con los datos de tu salón, pero las manchas son los toques de todos los salones en esa pantalla. Tu uso y el de soporte no se cuentan.</p>
        <div className="rounded-xl overflow-auto bg-slate-100 dark:bg-neutral-950 border border-slate-200 dark:border-neutral-800" style={{ height: 'min(75vh, 860px)' }}>
          <iframe key={url} src={url} title="Mapa de calor de la app" className="block mx-auto bg-white" style={{ width: ANCHO[disp], height: '100%', border: 0 }} />
        </div>
      </div>

      <div className="space-y-3 text-slate-900 dark:text-neutral-100">
        {error && <p className="text-[12px] text-rose-600">{error}</p>}
        {!r && !error && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
        {r && (
          <>
            <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800">
              <h3 className="text-[13px] font-bold mb-3">Pantallas más usadas</h3>
              {r.pantallas.length === 0 && <p className="text-[11px] text-slate-400">Todavía no hay uso registrado.</p>}
              <div className="space-y-2">
                {r.pantallas.map((p) => (
                  <button key={p.pantalla} type="button" onClick={() => p.pantalla !== 'menu' && setPantalla(p.pantalla)} className="w-full text-left cursor-pointer">
                    <div className="flex justify-between text-[12px]"><span className={pantalla === p.pantalla ? 'font-bold text-[var(--primary)]' : ''}>{nombre(p.pantalla)}</span>
                      <span className="tabular-nums text-slate-500">{p.visitas.toLocaleString('es-DO')} · {tiempo(p.segundosMedios)} · {p.salones} salones</span></div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-neutral-800 mt-1 overflow-hidden"><div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${(p.visitas / max) * 100}%` }} /></div>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-2">Veces que la abrieron · tiempo medio · cuántos salones</p>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800">
              <h3 className="text-[13px] font-bold mb-3">Lo que más tocan en {nombre(pantalla)}</h3>
              {r.destacados.length === 0 && <p className="text-[11px] text-slate-400">Sin toques con nombre todavía.</p>}
              <div className="space-y-1.5">
                {r.destacados.map((d) => (
                  <div key={d.detalle} className="flex justify-between gap-2 text-[12px]"><span className="truncate"><MousePointerClick className="w-3 h-3 inline mr-1 text-slate-400" />{d.detalle}</span><span className="tabular-nums font-semibold">{d.clics}</span></div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
