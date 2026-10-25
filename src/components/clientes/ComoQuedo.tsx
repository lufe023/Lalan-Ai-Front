import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, ChevronDown, Loader2, MapPin, Play, Plus, Trash2, Video, X } from 'lucide-react';
import { api, subirArchivo, urlDeFoto } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { usePlan } from '../../context/PlanContext';
import { useSedes } from '../../hooks/useSedes';
import { fotoParaCatalogo } from '../../utils/fotoParaCatalogo';
import { IOSToggle } from '../ui/IOSToggle';
import { SelectorSede } from '../ui/SelectorSede';
import { useConfirmar } from '../ui/ModalConfirmar';
import { VisorEnGrande, type FotoDeGaleria } from '../catalogo/FotoDelCatalogo';

interface FotoVisita { id: string; url: string; esVideo: boolean; video: string | null; duracionSeg: number | null }
interface Visita {
  id: string;
  fecha: string;
  locationId: string; sede: string | null;
  serviceId: string | null; servicio: string | null;
  staffId: string | null; especialista: string | null;
  nota: string | null;
  lalanLaPuedeMostrar: boolean;
  fotos: FotoVisita[];
}
interface Respuesta {
  permisoFotos: boolean; permisoFotosEn: string | null; permisoFotosPor: string | null;
  uso: { bytes: number; topeMB: number | null };
  maximoPorVisita: number;
  visitas: Visita[];
}

const MB = 1024 * 1024;
const peso = (b: number) => (b < MB ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / MB).toFixed(b < 10 * MB ? 1 : 0)} MB`);
const hoyLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fechaLarga = (f: string) => new Date(`${f}T12:00:00`).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' });
const campo = 'w-full px-2.5 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-[0.8125rem]';

/** Sube los archivos uno por uno: las fotos reducidas en el teléfono, los videos tal cual (el servidor los prepara) */
async function subirArchivos(visitaId: string, archivos: File[], alAvanzar: (van: number) => void) {
  for (let i = 0; i < archivos.length; i++) {
    const f = archivos[i];
    alAvanzar(i + 1);
    if (f.type.startsWith('video/')) {
      const form = new FormData();
      form.append('archivo', f);
      await subirArchivo(`/como-quedo/${visitaId}/videos`, form);
    } else {
      await api.post(`/como-quedo/${visitaId}/fotos`, { imagen: await fotoParaCatalogo(f) });
    }
  }
}

/**
 * «Cómo quedó»: fotos y videos de cada visita del cliente, para responder
 * «¿te acuerdas cómo fue la última vez?». Son privadas (nunca salen en la
 * Vitrina) y solo se suben si el cliente aceptó. Cada visita lleva su sede.
 */
export const ComoQuedo: React.FC<{ clienteId: string }> = ({ clienteId }) => {
  const { showToast, services, especialistas } = useApp();
  const { tieneModulo } = usePlan();
  const incluido = tieneModulo('fotos_clientes');
  const sedes = useSedes();
  const todasLasSedes = useSedes({ todasLasDelSalon: true });
  const { confirmar, modalConfirmar } = useConfirmar();
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [abierta, setAbierta] = useState(false);
  const [agregando, setAgregando] = useState(false);
  const [visor, setVisor] = useState<{ fotos: FotoDeGaleria[]; inicio: number } | null>(null);

  const cargar = useCallback(async () => {
    try { setDatos(await api.get<Respuesta>(`/clients/${clienteId}/como-quedo`)); } catch { setDatos(null); }
  }, [clienteId]);
  useEffect(() => { setDatos(null); setAgregando(false); void cargar(); }, [cargar]);

  if (!datos) return null;
  // Sin el módulo y sin nada guardado no hay nada que enseñar
  if (!incluido && !datos.visitas.length) return null;

  const cambiarPermiso = async (si: boolean) => {
    if (!si && !(await confirmar({
      titulo: '¿Ya no acepta que guardemos sus fotos?',
      mensaje: 'Lo guardado no se borra, pero no se podrán subir más y Lalan dejará de enseñarlas. Puedes quitar las visitas una por una.',
      textoConfirmar: 'Sí, quitar el permiso', tono: 'peligro',
    }))) return;
    try {
      const p = await api.put<Pick<Respuesta, 'permisoFotos' | 'permisoFotosEn' | 'permisoFotosPor'>>(`/clients/${clienteId}/como-quedo/permiso`, { permiso: si });
      setDatos(d => (d ? { ...d, ...p } : d));
    } catch (e) { showToast('No se pudo guardar', (e as Error).message, 'warning'); }
  };

  const ultima = datos.visitas[0];
  const { bytes, topeMB } = datos.uso;
  const lleno = topeMB !== null && bytes >= topeMB * MB;
  const puedeSubir = incluido && datos.permisoFotos && !lleno;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-neutral-800 overflow-hidden">
      {modalConfirmar}
      <button type="button" onClick={() => setAbierta(a => !a)}
        className="w-full px-3.5 py-2.5 flex items-center gap-2 bg-[var(--primary)]/10 text-left cursor-pointer">
        <Camera className="w-4 h-4 text-[var(--primary)] shrink-0" />
        <span className="flex-1 min-w-0">
          <span className="block font-bold text-xs text-slate-900 dark:text-white">Cómo quedó</span>
          <span className="block text-[0.6875rem] text-slate-500 truncate">
            {ultima ? `Última vez: ${fechaLarga(ultima.fecha)}${ultima.servicio ? ` · ${ultima.servicio}` : ''}` : 'Fotos y videos de sus visitas'}
          </span>
        </span>
        {ultima?.fotos[0] && <img src={urlDeFoto(ultima.fotos[0].url)} alt="" className="size-9 rounded-lg object-cover shrink-0" />}
        <ChevronDown className={`w-4 h-4 text-slate-400 transition ${abierta ? 'rotate-180' : ''}`} />
      </button>

      {abierta && (
        <div className="p-3 space-y-3">
          {/* El permiso del cliente, a la vista */}
          <div className="flex items-start gap-2.5">
            <span className="flex-1 min-w-0">
              <span className="block text-[0.8125rem] font-semibold text-slate-800 dark:text-neutral-100">Aceptó que guardemos sus fotos</span>
              <span className="block text-[0.6875rem] text-slate-500">
                {datos.permisoFotos && datos.permisoFotosEn
                  ? `Desde el ${new Date(datos.permisoFotosEn).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })}${datos.permisoFotosPor ? `, lo marcó ${datos.permisoFotosPor}` : ''}`
                  : 'Pregúntale antes de tomar la foto. Sin su permiso no se sube nada.'}
              </span>
            </span>
            <IOSToggle checked={datos.permisoFotos} onChange={cambiarPermiso} disabled={!incluido} ariaLabel="Aceptó que guardemos sus fotos" />
          </div>

          {topeMB !== null && (
            <div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-neutral-800 overflow-hidden">
                <div className={`h-full ${lleno ? 'bg-rose-500' : 'bg-[var(--primary)]'}`} style={{ width: `${Math.min(100, (bytes / (topeMB * MB || 1)) * 100)}%` }} />
              </div>
              <p className={`text-[0.6875rem] mt-1 ${lleno ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-slate-500'}`}>
                {lleno ? `Se llenó el espacio de tu plan (${topeMB} MB). Quita fotos o videos viejos para subir más.` : `Usado ${bytes ? peso(bytes) : '0 MB'} de ${topeMB} MB del salón`}
              </p>
            </div>
          )}

          {!incluido && <p className="text-[0.6875rem] text-amber-700 dark:text-amber-400">«Cómo quedó» no está en tu plan: ves lo guardado, pero no puedes subir más.</p>}

          {puedeSubir && !agregando && (
            <button type="button" onClick={() => setAgregando(true)}
              className="w-full py-2 rounded-xl border border-dashed border-[var(--primary)]/50 text-[var(--primary)] text-[0.8125rem] font-bold flex items-center justify-center gap-1.5 cursor-pointer hover:bg-[var(--primary)]/5">
              <Plus className="w-4 h-4" /> Agregar cómo quedó
            </button>
          )}
          {agregando && (
            <NuevaVisita clienteId={clienteId} sedes={sedes} maximo={datos.maximoPorVisita}
              servicios={services.map(s => ({ id: s.id, name: s.name }))} especialistas={especialistas.map(p => ({ id: p.id, name: p.name }))}
              onCancelar={() => setAgregando(false)}
              onListo={async () => { setAgregando(false); await cargar(); }} />
          )}

          {!datos.visitas.length && !agregando && <p className="text-[0.75rem] text-slate-500 text-center py-2">Todavía no hay fotos de sus visitas.</p>}

          {datos.visitas.map(v => (
            <TarjetaVisita key={v.id} v={v} maximo={datos.maximoPorVisita} conSede={todasLasSedes.length > 1}
              puedeSubir={puedeSubir} confirmar={confirmar}
              onVer={(inicio) => setVisor({ inicio, fotos: v.fotos.map(f => ({ clave: f.id, url: urlDeFoto(f.url)!, video: f.video ? urlDeFoto(f.video) : undefined })) })}
              onCambio={cargar} />
          ))}
        </div>
      )}

      <VisorEnGrande abierto={!!visor} fotos={visor?.fotos ?? []} inicio={visor?.inicio ?? 0} nombre="Cómo quedó" onCerrar={() => setVisor(null)} onVer={() => undefined} />
    </div>
  );
};

/** Una visita: sus fotos, la fecha, la sede, el servicio y quién lo hizo */
const TarjetaVisita: React.FC<{
  v: Visita; maximo: number; conSede: boolean; puedeSubir: boolean;
  confirmar: ReturnType<typeof useConfirmar>['confirmar'];
  onVer: (inicio: number) => void;
  onCambio: () => Promise<void>;
}> = ({ v, maximo, conSede, puedeSubir, confirmar, onVer, onCambio }) => {
  const { showToast } = useApp();
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [verNota, setVerNota] = useState(false);
  const caben = maximo - v.fotos.length;

  const error = (e: unknown) => showToast('No se pudo', (e as Error).message, 'warning');
  const agregar = async (lista: FileList | null) => {
    const archivos = Array.from(lista ?? []).slice(0, caben);
    if (!archivos.length) return;
    try {
      await subirArchivos(v.id, archivos, van => setSubiendo(archivos.length > 1 ? `Subiendo ${van} de ${archivos.length}…` : 'Subiendo…'));
    } catch (e) { error(e); }
    setSubiendo(null);
    await onCambio();
  };
  const quitarFoto = async (f: FotoVisita) => {
    if (!(await confirmar({ titulo: f.esVideo ? '¿Quitar este video?' : '¿Quitar esta foto?', mensaje: 'No se puede deshacer.', textoConfirmar: 'Quitar', tono: 'peligro' }))) return;
    try { await api.delete(`/como-quedo/${v.id}/fotos/${f.id}`); await onCambio(); } catch (e) { error(e); }
  };
  const quitarVisita = async () => {
    if (!(await confirmar({ titulo: '¿Quitar esta visita?', mensaje: `Se borran sus ${v.fotos.length} fotos y videos y la nota. No se puede deshacer.`, textoConfirmar: 'Quitar visita', tono: 'peligro' }))) return;
    try { await api.delete(`/como-quedo/${v.id}`); await onCambio(); } catch (e) { error(e); }
  };
  const cambiarLalan = async (si: boolean) => {
    try { await api.patch(`/como-quedo/${v.id}`, { lalanLaPuedeMostrar: si }); await onCambio(); } catch (e) { error(e); }
  };

  return (
    <div className="rounded-xl bg-slate-50 dark:bg-neutral-800/60 p-2.5 space-y-2">
      <div className="flex items-start gap-2">
        <span className="flex-1 min-w-0">
          <span className="block text-[0.8125rem] font-bold text-slate-900 dark:text-white">{fechaLarga(v.fecha)}</span>
          <span className="flex flex-wrap gap-1 mt-0.5">
            {conSede && v.sede && <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-700 dark:text-sky-300 text-[0.625rem] font-semibold"><MapPin className="w-2.5 h-2.5" />{v.sede}</span>}
            {v.servicio && <span className="px-1.5 py-0.5 rounded-full bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-300 text-[0.625rem] font-semibold">{v.servicio}</span>}
            {v.especialista && <span className="px-1.5 py-0.5 rounded-full bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-300 text-[0.625rem] font-semibold">Con {v.especialista}</span>}
          </span>
        </span>
        <button type="button" onClick={quitarVisita} aria-label="Quitar visita" title="Quitar visita" className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
        {v.fotos.map((f, i) => (
          <div key={f.id} className="relative aspect-square group">
            <button type="button" onClick={() => onVer(i)} aria-label={f.esVideo ? 'Ver video' : 'Ver foto'} className="absolute inset-0 rounded-lg overflow-hidden cursor-pointer">
              <img src={urlDeFoto(f.url)} alt="" className="size-full object-cover" />
              {f.esVideo && <span className="absolute inset-0 grid place-items-center bg-black/20"><Play className="w-6 h-6 text-white drop-shadow" /></span>}
            </button>
            <button type="button" onClick={() => quitarFoto(f)} aria-label="Quitar" className="absolute top-1 right-1 grid place-items-center size-6 rounded-full bg-black/50 text-white cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {puedeSubir && caben > 0 && (
          <button type="button" disabled={!!subiendo} onClick={() => entrada.current?.click()}
            className="aspect-square rounded-lg border border-dashed border-slate-300 dark:border-neutral-600 text-slate-500 flex flex-col items-center justify-center gap-1 text-[0.625rem] font-semibold cursor-pointer disabled:opacity-60">
            {subiendo ? <><Loader2 className="w-4 h-4 animate-spin" />{subiendo}</> : <><Plus className="w-4 h-4" />Foto o video</>}
          </button>
        )}
      </div>
      <input ref={entrada} type="file" accept="image/*,video/*" multiple hidden onChange={e => { void agregar(e.target.files); e.target.value = ''; }} />

      {v.nota && (
        <button type="button" onClick={() => setVerNota(n => !n)} className="w-full text-left text-[0.75rem] text-slate-700 dark:text-neutral-200 cursor-pointer">
          <span className={verNota ? '' : 'line-clamp-1'}>{v.nota}</span>
        </button>
      )}

      <label className="flex items-center gap-2 text-[0.6875rem] text-slate-500">
        <span className="flex-1">Lalan se la puede enseñar en el chat</span>
        <IOSToggle checked={v.lalanLaPuedeMostrar} onChange={cambiarLalan} ariaLabel="Lalan se la puede enseñar en el chat" />
      </label>
    </div>
  );
};

/** El formulario de una visita nueva: fotos o videos, fecha, sede (si hay varias), y lo demás opcional */
const NuevaVisita: React.FC<{
  clienteId: string;
  sedes: { id: string; name: string }[];
  maximo: number;
  servicios: { id: string; name: string }[];
  especialistas: { id: string; name: string }[];
  onCancelar: () => void;
  onListo: () => Promise<void>;
}> = ({ clienteId, sedes, maximo, servicios, especialistas, onCancelar, onListo }) => {
  const { showToast } = useApp();
  const entrada = useRef<HTMLInputElement>(null);
  const [archivos, setArchivos] = useState<File[]>([]);
  const [fecha, setFecha] = useState(hoyLocal());
  const [sede, setSede] = useState('');
  const [servicio, setServicio] = useState('');
  const [especialista, setEspecialista] = useState('');
  const [nota, setNota] = useState('');
  const [lalan, setLalan] = useState(true);
  const [guardando, setGuardando] = useState<string | null>(null);
  const vistas = useMemo(() => archivos.map(f => ({ f, url: URL.createObjectURL(f) })), [archivos]);
  useEffect(() => () => vistas.forEach(x => URL.revokeObjectURL(x.url)), [vistas]);

  const guardar = async () => {
    if (!archivos.length) { showToast('Falta la foto', 'Agrega al menos una foto o un video de cómo quedó.', 'warning'); return; }
    if (sedes.length > 1 && !sede) { showToast('Elige la sede', 'Dinos en qué sede se hizo.', 'warning'); return; }
    setGuardando('Guardando…');
    try {
      const { id } = await api.post<{ id: string }>(`/clients/${clienteId}/como-quedo`, {
        fecha, ...(sede ? { locationId: sede } : {}),
        serviceId: servicio || null, staffId: especialista || null, nota: nota.trim() || null, lalanLaPuedeMostrar: lalan,
      });
      try {
        await subirArchivos(id, archivos, van => setGuardando(archivos.length > 1 ? `Subiendo ${van} de ${archivos.length}…` : 'Subiendo…'));
      } catch (e) {
        showToast('Se guardó la visita, pero no todas las fotos', (e as Error).message, 'warning');
      }
      await onListo();
    } catch (e) {
      showToast('No se pudo guardar', (e as Error).message, 'warning');
      setGuardando(null);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--primary)]/30 p-3 space-y-2.5">
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
        {vistas.map(({ f, url }, i) => (
          <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-slate-100 dark:bg-neutral-800">
            {f.type.startsWith('video/')
              ? <span className="size-full grid place-items-center text-slate-500"><Video className="w-6 h-6" /></span>
              : <img src={url} alt="" className="size-full object-cover" />}
            <button type="button" onClick={() => setArchivos(a => a.filter((_, k) => k !== i))} aria-label="Quitar" className="absolute top-1 right-1 grid place-items-center size-6 rounded-full bg-black/50 text-white cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {archivos.length < maximo && (
          <button type="button" onClick={() => entrada.current?.click()}
            className="aspect-square rounded-lg border border-dashed border-slate-300 dark:border-neutral-600 text-slate-500 flex flex-col items-center justify-center gap-1 text-[0.625rem] font-semibold cursor-pointer">
            <Camera className="w-5 h-5" />Foto o video
          </button>
        )}
      </div>
      <input ref={entrada} type="file" accept="image/*,video/*" multiple hidden
        onChange={e => { const nuevos = Array.from(e.target.files ?? []); setArchivos(a => [...a, ...nuevos].slice(0, maximo)); e.target.value = ''; }} />
      <p className="text-[0.625rem] text-slate-400">Hasta {maximo} fotos o videos. Los videos, de hasta un minuto.</p>

      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1">
          <span className="text-[0.6875rem] font-semibold text-slate-500">Fecha</span>
          <input type="date" value={fecha} max={hoyLocal()} onChange={e => setFecha(e.target.value)} className={campo} />
        </label>
        {sedes.length > 1 && (
          <label className="block space-y-1">
            <span className="text-[0.6875rem] font-semibold text-slate-500">Sede</span>
            <SelectorSede sedes={sedes} value={sede} onChange={setSede} className="w-full !rounded-lg !py-2" />
          </label>
        )}
        <label className="block space-y-1">
          <span className="text-[0.6875rem] font-semibold text-slate-500">Servicio (opcional)</span>
          <select value={servicio} onChange={e => setServicio(e.target.value)} className={campo}>
            <option value="">Sin indicar</option>
            {servicios.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-[0.6875rem] font-semibold text-slate-500">Quién lo hizo (opcional)</span>
          <select value={especialista} onChange={e => setEspecialista(e.target.value)} className={campo}>
            <option value="">Sin indicar</option>
            {especialistas.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-[0.6875rem] font-semibold text-slate-500">Nota (opcional)</span>
        <textarea value={nota} onChange={e => setNota(e.target.value.slice(0, 400))} rows={2} placeholder="Tinte 7.1 con matiz cenizo, 30 min. Degradado en 1."
          className={`${campo} resize-none`} />
      </label>
      <label className="flex items-center gap-2 text-[0.75rem] text-slate-600 dark:text-neutral-300">
        <span className="flex-1">Lalan se la puede enseñar en el chat</span>
        <IOSToggle checked={lalan} onChange={setLalan} ariaLabel="Lalan se la puede enseñar en el chat" />
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={onCancelar} disabled={!!guardando} className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 text-[0.8125rem] font-semibold cursor-pointer">Cancelar</button>
        <button type="button" onClick={guardar} disabled={!!guardando}
          className="flex-1 py-2 rounded-xl bg-[var(--primary)] text-white text-[0.8125rem] font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-70">
          {guardando ? <><Loader2 className="w-4 h-4 animate-spin" />{guardando}</> : 'Guardar'}
        </button>
      </div>
    </div>
  );
};
