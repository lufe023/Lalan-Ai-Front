import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, Check, Copy, Loader2, Plus, Search, Trash2, Upload, X } from 'lucide-react';
import { api, subirArchivo } from '../../services/api';
import { baseProductosApi } from '../../services/saberProductos';
import { useApp } from '../../context/AppContext';
import { IOSModal } from '../ui/IOSModal';
import { IOSToggle } from '../ui/IOSToggle';
import { useConfirmar } from '../ui/ModalConfirmar';
import { ChipsFiltro } from '../ui/movimiento';
import type { NegocioResumen } from '../../types/plataforma';
import { botonPrincipal, botonSuave, campo, etiqueta } from '../compras/piezas';

type Estado = 'borrador' | 'publicado' | 'solicitud' | 'rechazado';
interface ProveedorLalan {
  id: string; nombre: string; rnc: string | null; direccion: string | null; contacto: string | null; whatsapp: string | null; correo: string | null; telefono: string | null;
  web: string | null; descripcion: string | null; pais: string; ciudades: string[]; marcas: string[]; productos: string[];
  estado: Estado; origen: 'plataforma' | 'registro' | 'salon'; creadoEn: string; salones: number; productosNombres: string[];
}
interface Interruptor { activo: boolean; salones: Record<string, boolean> }

const NOMBRE: Record<Estado, string> = { solicitud: 'Se registraron', publicado: 'Publicados', borrador: 'Borradores', rechazado: 'Rechazados' };
const COLOR: Record<Estado, string> = {
  solicitud: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
  publicado: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  borrador: 'bg-slate-100 text-slate-700 dark:bg-neutral-800 dark:text-neutral-300',
  rechazado: 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300',
};
/** El formulario del proveedor que se registra solo */
export const urlRegistroProveedor = () => `${window.location.origin}${window.location.pathname}#/proveedores`;

/**
 * Plataforma → Proveedores: la lista de Lalan que se sugiere a los salones.
 * Nada se sugiere hasta publicarlo, y solo a los salones con la sugerencia
 * encendida (para todos, con excepciones por salón). Los proveedores también
 * se registran solos desde un enlace; llegan como «Se registraron».
 */
export const ProveedoresPlataforma: React.FC = () => {
  const { showToast } = useApp();
  const { confirmar, modalConfirmar } = useConfirmar();
  const [lista, setLista] = useState<ProveedorLalan[] | null>(null);
  const [filtro, setFiltro] = useState<'todos' | Estado>('todos');
  const [q, setQ] = useState('');
  const [editando, setEditando] = useState<ProveedorLalan | 'nuevo' | null>(null);
  const [interruptor, setInterruptor] = useState<Interruptor | null>(null);
  const [negocios, setNegocios] = useState<NegocioResumen[]>([]);
  const [salonElegido, setSalonElegido] = useState('');

  const cargar = useCallback(() => { api.get<ProveedorLalan[]>('/plataforma/proveedores').then(setLista).catch(() => setLista([])); }, []);
  useEffect(() => {
    cargar();
    api.get<Interruptor>('/plataforma/proveedores/interruptor').then(setInterruptor).catch(() => setInterruptor(null));
    api.get<NegocioResumen[]>('/plataforma/negocios').then(setNegocios).catch(() => setNegocios([]));
  }, [cargar]);

  const guardarInterruptor = async (cambio: Partial<{ activo: boolean; salones: Record<string, boolean | null> }>) => {
    try { setInterruptor(await api.put<Interruptor>('/plataforma/proveedores/interruptor', cambio)); }
    catch (e) { showToast('No se pudo guardar', (e as Error).message, 'warning'); }
  };
  const cambiarEstado = async (p: ProveedorLalan, estado: Estado) => {
    try { await api.put(`/plataforma/proveedores/${p.id}`, { estado }); cargar(); }
    catch (e) { showToast('No se pudo', (e as Error).message, 'warning'); }
  };
  const borrar = async (p: ProveedorLalan) => {
    if (!(await confirmar({ titulo: `¿Borrar a ${p.nombre}?`, mensaje: p.salones ? `${p.salones} ${p.salones === 1 ? 'salón lo tiene' : 'salones lo tienen'}: se quedan con su copia.` : undefined, tono: 'peligro', textoConfirmar: 'Borrar' }))) return;
    try { await api.delete(`/plataforma/proveedores/${p.id}`); cargar(); } catch (e) { showToast('No se pudo borrar', (e as Error).message, 'warning'); }
  };

  const conteo = (e: Estado) => lista?.filter((p) => p.estado === e).length ?? 0;
  const visibles = (lista ?? []).filter((p) => (filtro === 'todos' || p.estado === filtro) && (!q.trim() || p.nombre.toLowerCase().includes(q.trim().toLowerCase())));
  const excepciones = Object.entries(interruptor?.salones ?? {});
  const nombreSalon = (id: string) => negocios.find((n) => n.id === id)?.nombre ?? id.slice(0, 8);

  return (
    <div className="space-y-4">
      {modalConfirmar}
      {/* Interruptor */}
      <div className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[0.8125rem]"><b className="text-slate-900 dark:text-white">Sugerir proveedores a los salones</b>
            <span className="block text-[0.75rem] text-slate-500">En el producto y en Compras: «Lo distribuye X en tu ciudad. ¿Lo agregas?». Solo los publicados.</span></span>
          <IOSToggle checked={!!interruptor?.activo} onChange={(v) => void guardarInterruptor({ activo: v })} ariaLabel="Sugerir proveedores" />
        </div>
        <div className="space-y-1.5">
          <span className={etiqueta}>Excepciones por salón</span>
          {excepciones.map(([id, si]) => (
            <div key={id} className="flex items-center gap-2 text-[0.8125rem]">
              <span className="flex-1">{nombreSalon(id)}</span>
              <span className={`px-2 py-0.5 rounded-full text-[0.6875rem] font-bold ${si ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{si ? 'Sí le sugiere' : 'No le sugiere'}</span>
              <button type="button" onClick={() => void guardarInterruptor({ salones: { [id]: null } })} aria-label="Quitar excepción" className="text-slate-400 hover:text-rose-500 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <select className={`${campo} flex-1 min-w-[12rem]`} value={salonElegido} onChange={(e) => setSalonElegido(e.target.value)}>
              <option value="">Elige un salón…</option>
              {negocios.filter((n) => !(n.id in (interruptor?.salones ?? {}))).map((n) => <option key={n.id} value={n.id}>{n.nombre}</option>)}
            </select>
            <button type="button" disabled={!salonElegido} onClick={() => { void guardarInterruptor({ salones: { [salonElegido]: !interruptor?.activo } }); setSalonElegido(''); }} className={botonSuave}>
              {interruptor?.activo ? 'No sugerirle' : 'Sí sugerirle'}
            </button>
          </div>
        </div>
      </div>

      <RegistroDgii />

      {/* Enlace para que se registren */}
      <div className="p-3 rounded-2xl bg-slate-50 dark:bg-neutral-800/50 flex flex-wrap items-center gap-2 text-[0.8125rem]">
        <span className="flex-1 min-w-[14rem] text-slate-600 dark:text-neutral-300">Los proveedores se registran solos en <b className="break-all">{urlRegistroProveedor()}</b>. Llegan en «Se registraron» y no se sugieren hasta que los publicas.</span>
        <button type="button" onClick={() => { void navigator.clipboard?.writeText(urlRegistroProveedor()); showToast('Enlace copiado', '', 'success'); }} className={botonSuave}><Copy className="w-4 h-4" /> Copiar enlace</button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
        <ChipsFiltro className="flex-1" valor={filtro} onCambio={(v) => setFiltro(v as 'todos' | Estado)}
          opciones={[{ id: 'todos', label: `Todos ${lista?.length ?? ''}` }, ...(['solicitud', 'publicado', 'borrador', 'rechazado'] as Estado[]).map((e) => ({ id: e, label: `${NOMBRE[e]} ${conteo(e)}` }))]} />
        <button type="button" onClick={() => setEditando('nuevo')} className={botonPrincipal}><Plus className="w-4 h-4" /> Nuevo proveedor</button>
      </div>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input className={`${campo} pl-9`} placeholder="Buscar proveedor…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {!lista && <div className="flex justify-center py-6 text-slate-400"><Loader2 className="w-4 h-4 animate-spin" /></div>}
      {lista && !visibles.length && <p className="text-[0.8125rem] text-slate-500 text-center py-6">No hay proveedores aquí.</p>}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {visibles.map((p) => (
          <div key={p.id} className="p-3 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <button type="button" onClick={() => setEditando(p)} className="text-left font-bold text-[0.875rem] text-slate-900 dark:text-white hover:text-[var(--primary)] cursor-pointer">{p.nombre}</button>
              <span className={`px-2 py-0.5 rounded-full text-[0.6875rem] font-bold shrink-0 ${COLOR[p.estado]}`}>{NOMBRE[p.estado].replace(/s$/, '').replace('Se registraron', 'Se registró')}</span>
            </div>
            <p className="text-[0.75rem] text-slate-500">{p.pais}{p.ciudades.length ? ` · ${p.ciudades.join(', ')}` : ' · todo el país'}{p.salones ? ` · ${p.salones} ${p.salones === 1 ? 'salón' : 'salones'} lo tienen` : ''}</p>
            {(p.marcas.length > 0 || p.productosNombres.length > 0) && (
              <p className="text-[0.75rem] text-slate-600 dark:text-neutral-300">{[...p.marcas, ...p.productosNombres].slice(0, 6).join(' · ')}{p.marcas.length + p.productosNombres.length > 6 ? '…' : ''}</p>
            )}
            <p className="text-[0.75rem] text-slate-500">{[p.contacto, p.whatsapp, p.correo].filter(Boolean).join(' · ')}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {p.estado !== 'publicado' && <button type="button" onClick={() => void cambiarEstado(p, 'publicado')} className={botonPrincipal}><Check className="w-4 h-4" /> Publicar</button>}
              {p.estado === 'publicado' && <button type="button" onClick={() => void cambiarEstado(p, 'borrador')} className={botonSuave}>Despublicar</button>}
              {p.estado === 'solicitud' && <button type="button" onClick={() => void cambiarEstado(p, 'rechazado')} className={botonSuave}>Rechazar</button>}
              <button type="button" onClick={() => setEditando(p)} className={botonSuave}>Editar</button>
              <button type="button" onClick={() => void borrar(p)} aria-label={`Borrar ${p.nombre}`} className={`${botonSuave} hover:!border-rose-300 hover:text-rose-600`}><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
      <EditorProveedorLalan proveedor={editando} onClose={() => setEditando(null)} onGuardado={cargar} />
    </div>
  );
};

const lista = (t: string) => t.split(',').map((x) => x.trim()).filter(Boolean);

interface EstadoDgii { estado: 'nunca' | 'importando' | 'listo' | 'fallo'; archivo?: string; filas?: number; empezo?: string; termino?: string; error?: string | null; total: number }

/**
 * El registro de contribuyentes de la DGII: se sube el archivo tal como se
 * descarga (ZIP, TXT o CSV) y los salones lo encuentran al escribir el nombre
 * o el RNC de un proveedor. Cada carga reemplaza la anterior.
 */
const RegistroDgii: React.FC = () => {
  const { showToast } = useApp();
  const [e, setE] = useState<EstadoDgii | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const cargar = useCallback(() => { api.get<EstadoDgii>('/plataforma/proveedores/dgii').then(setE).catch(() => setE(null)); }, []);
  useEffect(() => { cargar(); }, [cargar]);
  // Mientras importa, se mira cada 4 segundos
  useEffect(() => {
    if (e?.estado !== 'importando') return;
    const t = window.setInterval(cargar, 4000);
    return () => window.clearInterval(t);
  }, [e?.estado, cargar]);

  const subir = async (archivo: File) => {
    setSubiendo(true);
    try {
      const d = new FormData();
      d.append('archivo', archivo);
      setE(await subirArchivo<EstadoDgii>('/plataforma/proveedores/dgii', d));
    } catch (err) { showToast('No se pudo subir', (err as Error).message, 'warning'); }
    finally { setSubiendo(false); }
  };
  const ocupado = subiendo || e?.estado === 'importando';
  const cuando = (iso?: string) => (iso ? new Date(iso).toLocaleString('es-DO', { dateStyle: 'medium', timeStyle: 'short' }) : '');

  return (
    <div className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 space-y-2">
      <div className="flex items-start gap-3">
        <span className="grid place-items-center size-9 rounded-xl shrink-0 bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"><Building2 className="w-4 h-4" /></span>
        <span className="flex-1 min-w-0 text-[0.8125rem]">
          <b className="text-slate-900 dark:text-white">Empresas de la DGII</b>
          <span className="block text-[0.75rem] text-slate-500 dark:text-neutral-400">
            Al registrar un proveedor, el salón escribe el nombre o el RNC y Lalan le ofrece la empresa con sus datos. Sube el archivo de contribuyentes
            (<a className="font-semibold text-[var(--primary)]" href="https://dgii.gov.do/app/WebApps/Consultas/RNC/DGII_RNC.zip" target="_blank" rel="noreferrer">DGII_RNC.zip</a>) tal como se descarga.
          </span>
        </span>
      </div>
      <p className="text-[0.75rem] text-slate-600 dark:text-neutral-300">
        {!e ? '…'
          : e.estado === 'importando' ? <span className="inline-flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando {e.archivo}: {(e.filas ?? 0).toLocaleString('es-DO')} empresas hasta ahora…</span>
            : e.estado === 'fallo' ? <span className="text-rose-600 dark:text-rose-400">No se pudo cargar {e.archivo}: {e.error}</span>
              : e.total ? <>{e.total.toLocaleString('es-DO')} empresas activas{e.termino ? ` · cargadas el ${cuando(e.termino)}` : ''}{e.archivo ? ` de ${e.archivo}` : ''}</>
                : 'Todavía no se ha cargado.'}
      </p>
      <label className={`${botonSuave} ${ocupado ? 'opacity-60 pointer-events-none' : 'cursor-pointer'} inline-flex`}>
        {subiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {e?.total ? 'Subir uno más nuevo' : 'Subir el archivo'}
        <input type="file" className="sr-only" accept=".zip,.txt,.csv" disabled={ocupado} onChange={(ev) => { const a = ev.target.files?.[0]; ev.target.value = ''; if (a) void subir(a); }} />
      </label>
    </div>
  );
};

const EditorProveedorLalan: React.FC<{ proveedor: ProveedorLalan | 'nuevo' | null; onClose: () => void; onGuardado: () => void }> = ({ proveedor, onClose, onGuardado }) => {
  const { showToast } = useApp();
  const [f, setF] = useState({ nombre: '', rnc: '', direccion: '', contacto: '', whatsapp: '', correo: '', telefono: '', web: '', descripcion: '', pais: 'DO', ciudades: '', marcas: '', estado: 'borrador' as Estado });
  const [productos, setProductos] = useState<string[]>([]);
  const [genericos, setGenericos] = useState<{ id: string; nombre: string }[]>([]);
  const [buscar, setBuscar] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!proveedor) return;
    baseProductosApi.base().then((b) => setGenericos(b.productos.map((p) => ({ id: p.id, nombre: p.nombre })))).catch(() => setGenericos([]));
    if (proveedor === 'nuevo') {
      setF({ nombre: '', rnc: '', direccion: '', contacto: '', whatsapp: '', correo: '', telefono: '', web: '', descripcion: '', pais: 'DO', ciudades: '', marcas: '', estado: 'borrador' });
      setProductos([]);
    } else {
      const p = proveedor;
      setF({ nombre: p.nombre, rnc: p.rnc ?? '', direccion: p.direccion ?? '', contacto: p.contacto ?? '', whatsapp: p.whatsapp ?? '', correo: p.correo ?? '', telefono: p.telefono ?? '', web: p.web ?? '', descripcion: p.descripcion ?? '', pais: p.pais, ciudades: p.ciudades.join(', '), marcas: p.marcas.join(', '), estado: p.estado });
      setProductos(p.productos);
    }
  }, [proveedor]);

  const sugeridos = useMemo(() => genericos.filter((g) => !productos.includes(g.id) && buscar.trim() && g.nombre.toLowerCase().includes(buscar.trim().toLowerCase())).slice(0, 6), [genericos, productos, buscar]);
  if (!proveedor) return null;
  const t = (k: keyof typeof f) => ({ value: f[k], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value }) });

  const guardar = async () => {
    setGuardando(true);
    const datos = { ...f, ciudades: lista(f.ciudades), marcas: lista(f.marcas), productos, pais: f.pais.toUpperCase() };
    try {
      if (proveedor === 'nuevo') await api.post('/plataforma/proveedores', datos);
      else await api.put(`/plataforma/proveedores/${proveedor.id}`, datos);
      onGuardado(); onClose();
    } catch (e) { showToast('No se pudo guardar', (e as Error).message, 'warning'); }
    finally { setGuardando(false); }
  };

  return (
    <IOSModal isOpen={!!proveedor} onClose={onClose} title={proveedor === 'nuevo' ? 'Nuevo proveedor de Lalan' : proveedor.nombre} subtitle={proveedor !== 'nuevo' && proveedor.origen === 'registro' ? 'Se registró solo' : proveedor !== 'nuevo' && proveedor.origen === 'salon' ? 'Lo dio de alta un salón' : 'Lista de Plataforma'}>
      <div className="space-y-3 p-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="sm:col-span-2"><span className={etiqueta}>Nombre</span><input className={campo} {...t('nombre')} /></label>
          <label><span className={etiqueta}>Contacto</span><input className={campo} {...t('contacto')} /></label>
          <label><span className={etiqueta}>RNC</span><input className={campo} {...t('rnc')} /></label>
          <label><span className={etiqueta}>WhatsApp</span><input className={campo} inputMode="tel" {...t('whatsapp')} /></label>
          <label><span className={etiqueta}>Correo</span><input className={campo} type="email" {...t('correo')} /></label>
          <label><span className={etiqueta}>Teléfono</span><input className={campo} {...t('telefono')} /></label>
          <label><span className={etiqueta}>Web</span><input className={campo} {...t('web')} /></label>
          <label className="sm:col-span-2"><span className={etiqueta}>Dirección</span><input className={campo} {...t('direccion')} /></label>
          <label><span className={etiqueta}>País (dos letras)</span><input className={campo} maxLength={2} {...t('pais')} /></label>
          <label><span className={etiqueta}>Ciudades (separadas por coma; vacío = todo el país)</span><input className={campo} placeholder="Santo Domingo, Santiago" {...t('ciudades')} /></label>
          <label className="sm:col-span-2"><span className={etiqueta}>Marcas que distribuye (separadas por coma)</span><input className={campo} placeholder="OPI, L'Oréal" {...t('marcas')} /></label>
          <label className="sm:col-span-2"><span className={etiqueta}>Descripción</span><textarea className={`${campo} min-h-[60px]`} {...t('descripcion')} /></label>
        </div>
        <div>
          <span className={etiqueta}>Productos de la base de Lalan que vende</span>
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            {productos.map((id) => (
              <span key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-[0.75rem] font-semibold">
                {genericos.find((g) => g.id === id)?.nombre ?? '…'}
                <button type="button" onClick={() => setProductos((l) => l.filter((x) => x !== id))} aria-label="Quitar" className="cursor-pointer"><X className="w-3 h-3" /></button>
              </span>
            ))}
          </div>
          <input className={campo} placeholder="Busca un producto genérico (acetona, tinte…)" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
          {sugeridos.length > 0 && (
            <div className="mt-1 rounded-xl border border-slate-200 dark:border-neutral-700 divide-y divide-slate-100 dark:divide-neutral-800">
              {sugeridos.map((g) => <button key={g.id} type="button" onClick={() => { setProductos((l) => [...l, g.id]); setBuscar(''); }} className="w-full px-3 py-2 text-left text-[0.8125rem] hover:bg-slate-50 dark:hover:bg-neutral-800 cursor-pointer">{g.nombre}</button>)}
            </div>
          )}
        </div>
        <label className="block"><span className={etiqueta}>Estado</span>
          <select className={campo} {...t('estado')}>
            {(['borrador', 'publicado', 'solicitud', 'rechazado'] as Estado[]).map((e) => <option key={e} value={e}>{NOMBRE[e]}</option>)}
          </select>
        </label>
        <button type="button" disabled={guardando || !f.nombre.trim()} onClick={() => void guardar()} className={`${botonPrincipal} w-full py-3`}>{guardando && <Loader2 className="w-4 h-4 animate-spin" />} Guardar</button>
      </div>
    </IOSModal>
  );
};
