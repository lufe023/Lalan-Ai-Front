import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, Film, ImagePlus, Loader2, Play, Save, Trash2 } from 'lucide-react';
import { api, subirArchivo, urlApi } from '../../services/api';
import type { PlanLalan } from '../../types/plataforma';
import { useConfirmar } from '../ui/ModalConfirmar';
import { reducirFoto } from '../../utils/reducirFoto';
import { EJEMPLOS_DE_SERIE } from '../../landing/ejemplos';

const tarjeta = 'p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 space-y-3 text-slate-900 dark:text-neutral-100 dark:[color-scheme:dark]';
const campo = 'w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.8125rem]';
const titulo = 'text-[0.75rem] font-bold uppercase tracking-wider text-slate-500';

interface Ejemplo { id: string; leyenda: string | null; video: boolean; duracionSeg: number | null }
interface Caracteristica { id: string; nombre: string; grupo: string; ejemplos: Ejemplo[] }
interface Respuesta { caracteristicas: Caracteristica[]; maximo: number }

const GRUPOS: { id: string; nombre: string }[] = [
  { id: 'basico', nombre: 'Lo básico (todos los planes)' }, { id: 'atencion', nombre: 'Atención' }, { id: 'salon', nombre: 'El salón' },
  { id: 'dinero', nombre: 'Dinero' }, { id: 'experiencia', nombre: 'Experiencia' },
];

const foto = (id: string) => urlApi(`/public/landing/ejemplos/${id}`);
const video = (id: string) => urlApi(`/public/landing/ejemplos/${id}/video`);

/**
 * En qué tarjeta de la página sale cada característica: lo básico en la del
 * primer plan; un módulo, en la del primer plan que lo trae (los siguientes
 * dicen «Todo lo del Plan …»). Así Luis sabe dónde se va a ver el ejemplo.
 */
function dondeSale(planes: PlanLalan[]): Map<string, string> {
  const enPagina = planes.filter((p) => p.activo && p.enLanding !== false).sort((a, b) => a.orden - b.orden);
  const mapa = new Map<string, string>();
  enPagina.forEach((p, i) => {
    if (i === 0) mapa.set('basico', p.nombre);
    for (const m of p.modulos) if (!mapa.has(m)) mapa.set(m, p.nombre);
  });
  return mapa;
}

/** Un ejemplo abierto: se ve como en la página, con su leyenda, el orden y quitar */
const EditorEjemplo: React.FC<{
  e: Ejemplo; posicion: number; total: number; onCerrar: () => void; onCambio: () => void; onPrimero: () => void;
}> = ({ e, posicion, total, onCerrar, onCambio, onPrimero }) => {
  const [leyenda, setLeyenda] = useState(e.leyenda ?? '');
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState('');
  const { confirmar, modalConfirmar } = useConfirmar();
  useEffect(() => setLeyenda(e.leyenda ?? ''), [e]);

  const guardar = async () => {
    setOcupado(true); setAviso('');
    try { await api.patch(`/plataforma/planes/ejemplos/${e.id}`, { leyenda }); setAviso('Guardado.'); onCambio(); }
    catch (err) { setAviso((err as Error).message); } finally { setOcupado(false); }
  };
  const quitar = async () => {
    if (!(await confirmar({ titulo: '¿Quitar este ejemplo?', mensaje: 'Deja de salir en la página. No se puede deshacer: para volver a ponerlo hay que subirlo otra vez.', textoConfirmar: 'Sí, quitar', tono: 'peligro' }))) return;
    setOcupado(true);
    try { await api.delete(`/plataforma/planes/ejemplos/${e.id}`); onCerrar(); onCambio(); }
    catch (err) { setAviso((err as Error).message); setOcupado(false); }
  };

  return (
    <div className="mt-2 p-3 rounded-xl bg-slate-50 dark:bg-neutral-800/60 space-y-2">
      {modalConfirmar}
      <div className="flex justify-center rounded-lg bg-slate-100 dark:bg-neutral-800 overflow-hidden">
        {e.video
          ? <video src={video(e.id)} poster={foto(e.id)} controls playsInline preload="metadata" className="max-h-80 w-auto" />
          : <img src={foto(e.id)} alt={e.leyenda ?? ''} className="max-h-80 w-auto" />}
      </div>
      <label className="block space-y-1">
        <span className="text-[0.75rem] font-semibold text-slate-500">Leyenda (sale debajo, en la página)</span>
        <input value={leyenda} maxLength={200} onChange={(ev) => setLeyenda(ev.target.value)} placeholder="Ej.: Así le pasas la factura a Lalan" className={campo} />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => void guardar()} disabled={ocupado || leyenda === (e.leyenda ?? '')}
          className="px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white text-[0.75rem] font-bold flex items-center gap-1 disabled:opacity-50 cursor-pointer">
          <Save className="w-3.5 h-3.5" /> Guardar leyenda
        </button>
        {posicion > 0 && (
          <button type="button" onClick={onPrimero} disabled={ocupado} className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-neutral-700 text-[0.75rem] font-semibold flex items-center gap-1 cursor-pointer">
            <ArrowLeft className="w-3.5 h-3.5" /> Que salga primero
          </button>
        )}
        <button type="button" onClick={() => void quitar()} disabled={ocupado} className="px-3 py-1.5 rounded-lg text-[0.75rem] font-semibold text-rose-600 flex items-center gap-1 cursor-pointer">
          <Trash2 className="w-3.5 h-3.5" /> Quitar
        </button>
        <span className="text-[0.6875rem] text-slate-400">{posicion + 1} de {total}</span>
        {aviso && <span className="text-[0.75rem] font-semibold text-[var(--primary)]">{aviso}</span>}
      </div>
    </div>
  );
};

/** Una característica: sus ejemplos en miniatura y el botón para subir otro */
const FilaCaracteristica: React.FC<{ c: Caracteristica; sale?: string; maximo: number; onCambio: () => void }> = ({ c, sale, maximo, onCambio }) => {
  const [abierto, setAbierto] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [aviso, setAviso] = useState('');
  const entrada = useRef<HTMLInputElement>(null);
  const deSerie = !c.ejemplos.length && !!EJEMPLOS_DE_SERIE[c.id];

  const subir = async (archivo: File) => {
    setSubiendo(true); setAviso('');
    try {
      const f = new FormData();
      f.append('archivo', archivo.type.startsWith('image/') ? await reducirFoto(archivo) : archivo);
      const nuevo = await subirArchivo<Ejemplo>(`/plataforma/planes/ejemplos/${c.id}`, f);
      setAbierto(nuevo.id); onCambio();
    } catch (e) { setAviso((e as Error).message); } finally { setSubiendo(false); }
  };
  const primero = async (id: string) => {
    try { await api.put(`/plataforma/planes/ejemplos/${c.id}/orden`, { ids: [id, ...c.ejemplos.map((e) => e.id).filter((x) => x !== id)] }); onCambio(); }
    catch (e) { setAviso((e as Error).message); }
  };
  const elegido = c.ejemplos.findIndex((e) => e.id === abierto);

  return (
    <li className="py-2.5 border-t border-slate-100 dark:border-neutral-800 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[10rem]">
          <b className="text-[0.8125rem]">{c.nombre}</b>
          <span className={`block text-[0.6875rem] ${sale ? 'text-slate-500' : 'text-slate-400'}`}>
            {sale ? `Sale en la tarjeta del ${sale}` : 'Ningún plan de la página lo trae todavía'}
            {deSerie && ' · Tiene el video de serie de Compras; sube otro para cambiarlo'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {c.ejemplos.map((e, i) => (
            <button key={e.id} type="button" onClick={() => setAbierto(abierto === e.id ? null : e.id)} aria-pressed={abierto === e.id}
              aria-label={`Ejemplo ${i + 1}${e.video ? ' (video)' : ''}`}
              className={`relative w-12 h-12 rounded-lg overflow-hidden border-2 cursor-pointer ${abierto === e.id ? 'border-[var(--primary)]' : 'border-transparent'}`}>
              <img src={foto(e.id)} alt="" className="w-full h-full object-cover" />
              {e.video && <span className="absolute inset-0 flex items-center justify-center bg-black/25 text-white"><Play className="w-4 h-4 fill-current" /></span>}
            </button>
          ))}
          {c.ejemplos.length < maximo && (
            <button type="button" onClick={() => entrada.current?.click()} disabled={subiendo}
              className="h-12 px-3 rounded-lg border border-dashed border-slate-300 dark:border-neutral-600 text-[0.75rem] font-semibold text-slate-500 flex items-center gap-1.5 cursor-pointer disabled:opacity-60">
              {subiendo ? <><Loader2 className="w-4 h-4 animate-spin" /> Subiendo…</> : <><ImagePlus className="w-4 h-4" /> Foto o <Film className="w-4 h-4" /> video</>}
            </button>
          )}
          <input ref={entrada} type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" className="hidden"
            onChange={(ev) => { const a = ev.target.files?.[0]; ev.target.value = ''; if (a) void subir(a); }} />
        </div>
      </div>
      {subiendo && <p className="text-[0.6875rem] text-slate-400 mt-1">Si es un video, se pasa a un formato que se ve en cualquier teléfono. Tarda unos segundos.</p>}
      {aviso && <p className="text-[0.75rem] font-semibold text-rose-600 mt-1">{aviso}</p>}
      {elegido >= 0 && (
        <EditorEjemplo e={c.ejemplos[elegido]} posicion={elegido} total={c.ejemplos.length} onCerrar={() => setAbierto(null)} onCambio={onCambio} onPrimero={() => void primero(c.ejemplos[elegido].id)} />
      )}
    </li>
  );
};

/**
 * Las fotos y videos de ejemplo de lo que trae cada plan. En la página, cada
 * línea de la tarjeta que tiene ejemplo se toca y lo abre en grande.
 */
export const EjemplosPlanes: React.FC<{ planes: PlanLalan[] }> = ({ planes }) => {
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [error, setError] = useState('');
  const [abierta, setAbierta] = useState(false);

  const cargar = useCallback(async () => {
    try { setDatos(await api.get<Respuesta>('/plataforma/planes/ejemplos')); setError(''); }
    catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  const sale = dondeSale(planes);
  const conEjemplo = datos?.caracteristicas.filter((c) => c.ejemplos.length || EJEMPLOS_DE_SERIE[c.id]).length ?? 0;

  return (
    <div className={tarjeta}>
      <button type="button" onClick={() => setAbierta((a) => !a)} aria-expanded={abierta} className="w-full flex items-start gap-2 text-left cursor-pointer">
        <div className="flex-1">
          <div className={titulo}>Ejemplos en la página</div>
          <p className="text-[0.6875rem] text-slate-400 mt-0.5">
            Sube una foto o un video de cada cosa que trae un plan. En la página, quien mira la tarjeta toca esa línea y lo ve en grande.
            {datos && ` ${conEjemplo} de ${datos.caracteristicas.length} tienen ejemplo.`}
          </p>
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 mt-0.5 transition-transform ${abierta ? 'rotate-180' : ''}`} />
      </button>
      {error && <p className="text-xs text-rose-600">{error}</p>}
      {abierta && !datos && !error && <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando ejemplos…</div>}
      {abierta && datos && GRUPOS.map((g) => {
        const lista = datos.caracteristicas.filter((c) => c.grupo === g.id);
        if (!lista.length) return null;
        return (
          <div key={g.id}>
            <div className={`${titulo} mt-2`}>{g.nombre}</div>
            <ul>
              {lista.map((c) => <FilaCaracteristica key={c.id} c={c} sale={sale.get(c.grupo === 'basico' ? 'basico' : c.id)} maximo={datos.maximo} onCambio={() => void cargar()} />)}
            </ul>
          </div>
        );
      })}
    </div>
  );
};
