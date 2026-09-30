import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileDown, ImagePlus, Loader2, Trash2 } from 'lucide-react';
import { api, descargarArchivo, urlApi } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { IOSModal } from '../ui/IOSModal';

interface Portada { mes: number; lema: string; acento: string; actualizadoEn: string }
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
/** Lo que ya trae el diseño dibujado de cada mes (si no se sube imagen) */
const TEMPORADA = ['Año nuevo, metas nuevas', 'Mes del amor', 'Mes de la mujer', 'Tu salón, al día', 'Mes de las madres', 'Temporada de verano', 'Temporada de verano', 'Temporada de verano', 'Tu salón, al día', 'Tu salón, al día', 'Tu salón, al día', 'Temporada de fiestas'];
/** Tamaño con que se guarda (A4 vertical) y calidad del JPG */
const ANCHO = 1240, ALTO = 1754, CALIDAD = 0.82;

/** La imagen elegida → JPG A4 recortado al centro (así nunca pesa de más) */
function prepararImagen(archivo: File): Promise<string> {
  return new Promise((ok, mal) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = ANCHO; c.height = ALTO;
      const esc = Math.max(ANCHO / img.width, ALTO / img.height);
      const w = img.width * esc, h = img.height * esc;
      c.getContext('2d')!.drawImage(img, (ANCHO - w) / 2, (ALTO - h) / 2, w, h);
      URL.revokeObjectURL(img.src);
      ok(c.toDataURL('image/jpeg', CALIDAD));
    };
    img.onerror = () => mal(new Error('No se pudo leer la imagen'));
    img.src = URL.createObjectURL(archivo);
  });
}

/**
 * Plataforma → Portadas: una ilustración por mes para los PDF de todos los
 * salones. La imagen va sin texto; el sistema escribe encima el título y los
 * datos. Sin imagen, se usa el diseño dibujado de la temporada.
 */
export const PortadasPlataforma: React.FC = () => {
  const { showToast } = useApp();
  const [lista, setLista] = useState<Portada[] | null>(null);
  const [editando, setEditando] = useState<number | null>(null);
  const [f, setF] = useState({ lema: '', acento: '#c46b7c', imagen: '' });
  const [ocupado, setOcupado] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => { setLista(await api.get<Portada[]>('/plataforma/portadas')); }, []);
  useEffect(() => { void cargar().catch(() => setLista([])); }, [cargar]);

  const abrir = (mes: number) => {
    const p = lista?.find(x => x.mes === mes);
    setF({ lema: p?.lema ?? TEMPORADA[mes - 1], acento: p?.acento ?? '#c46b7c', imagen: '' });
    setEditando(mes);
  };
  const elegir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = e.target.files?.[0];
    if (!a) return;
    try { setF(x => ({ ...x, imagen: '' })); const d = await prepararImagen(a); setF(x => ({ ...x, imagen: d })); }
    catch (err) { showToast('No se pudo usar la imagen', (err as Error).message, 'warning'); }
    e.target.value = '';
  };
  const guardar = async () => {
    if (!editando) return;
    setOcupado(true);
    try {
      setLista(await api.put<Portada[]>(`/plataforma/portadas/${editando}`, { lema: f.lema, acento: f.acento, ...(f.imagen ? { imagen: f.imagen } : {}) }));
      showToast('Portada guardada', `Los informes de ${MESES[editando - 1].toLowerCase()} ya salen con ella.`, 'success');
      setEditando(null);
    } catch (e) { showToast('No se pudo guardar', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
    finally { setOcupado(false); }
  };
  const quitar = async () => {
    if (!editando || !window.confirm(`¿Quitar la portada de ${MESES[editando - 1].toLowerCase()}? Volverá el diseño de temporada.`)) return;
    setLista(await api.delete<Portada[]>(`/plataforma/portadas/${editando}`));
    setEditando(null);
  };
  const ejemplo = async (mes: number) => {
    try { await descargarArchivo(`/plataforma/portadas/${mes}/ejemplo`, `portada-${MESES[mes - 1].toLowerCase()}.pdf`); }
    catch (e) { showToast('No se pudo generar', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
  };

  if (!lista) return <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>;
  const actual = editando ? lista.find(x => x.mes === editando) : undefined;

  return (
    <div className="space-y-3">
      <p className="text-[12px] text-slate-500 dark:text-neutral-400 leading-relaxed max-w-2xl">
        Una ilustración por mes para la portada de los informes en PDF de todos los salones. Súbela <b>sin texto</b>: el título, el período y los datos los escribe el sistema encima.
        Vertical, idealmente 1240 × 1754 píxeles; deja el tercio de abajo más tranquilo. Los meses sin imagen usan el diseño de temporada.
      </p>
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {MESES.map((nombre, i) => {
          const mes = i + 1;
          const p = lista.find(x => x.mes === mes);
          return (
            <button key={mes} type="button" onClick={() => abrir(mes)} className="text-left rounded-2xl overflow-hidden border border-slate-200 dark:border-neutral-800 hover:border-[var(--primary)] cursor-pointer">
              <div className="aspect-[1/1.414] bg-slate-100 dark:bg-neutral-800 relative">
                {p
                  ? <img src={urlApi(`/plataforma/portadas/${mes}/imagen?v=${encodeURIComponent(p.actualizadoEn)}`)} alt={`Portada de ${nombre}`} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                  : <span className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-400 text-center px-2">Diseño de temporada</span>}
              </div>
              <div className="p-2">
                <b className="text-[12px] block">{nombre}</b>
                <span className="text-[10px] text-slate-500 block truncate">{p?.lema ?? TEMPORADA[i]}</span>
              </div>
            </button>
          );
        })}
      </div>

      <IOSModal isOpen={!!editando} onClose={() => setEditando(null)} title={editando ? `Portada de ${MESES[editando - 1].toLowerCase()}` : ''} subtitle="Para los informes de todos los salones" fixedHeight={false}>
        {editando && (
          <div className="space-y-3 p-1">
            <div className="flex gap-3">
              <div className="w-28 shrink-0 aspect-[1/1.414] rounded-xl overflow-hidden bg-slate-100 dark:bg-neutral-800 relative">
                {f.imagen
                  ? <img src={f.imagen} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  : actual ? <img src={urlApi(`/plataforma/portadas/${editando}/imagen?v=${encodeURIComponent(actual.actualizadoEn)}`)} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  : <span className="absolute inset-0 flex items-center justify-center text-[10px] text-slate-400 text-center px-2">Sin imagen</span>}
              </div>
              <div className="flex-1 space-y-2">
                <input ref={archivo} type="file" accept="image/jpeg,image/png" className="hidden" onChange={e => void elegir(e)} />
                <button type="button" onClick={() => archivo.current?.click()} className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-neutral-700 text-[12px] font-bold cursor-pointer">
                  <ImagePlus className="w-4 h-4" /> {actual || f.imagen ? 'Cambiar imagen' : 'Elegir imagen'}
                </button>
                <label className="block"><span className="text-[10px] text-slate-500">Lema del mes</span>
                  <input value={f.lema} maxLength={60} onChange={e => setF({ ...f, lema: e.target.value })} className="w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[12px]" /></label>
                <label className="flex items-center gap-2 text-[11px] text-slate-500">
                  <input type="color" value={f.acento} onChange={e => setF({ ...f, acento: e.target.value })} className="w-9 h-9 rounded-lg border-0 bg-transparent" /> Color de los detalles
                </label>
              </div>
            </div>
            <button type="button" disabled={ocupado || (!actual && !f.imagen) || f.lema.trim().length < 2} onClick={() => void guardar()}
              className="w-full min-h-[44px] rounded-xl bg-[var(--primary)] text-white text-sm font-bold disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
              {ocupado && <Loader2 className="w-4 h-4 animate-spin" />} Guardar portada
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={() => void ejemplo(editando)} className="flex-1 min-h-[40px] flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-neutral-700 text-[12px] font-bold cursor-pointer">
                <FileDown className="w-4 h-4" /> Ver ejemplo en PDF
              </button>
              {actual && (
                <button type="button" onClick={() => void quitar()} className="min-h-[40px] px-3 flex items-center gap-1.5 rounded-xl text-[12px] text-rose-600 cursor-pointer">
                  <Trash2 className="w-4 h-4" /> Quitar
                </button>
              )}
            </div>
            <p className="text-[10px] text-slate-400">El ejemplo usa la portada ya guardada; guarda primero si cambiaste algo.</p>
          </div>
        )}
      </IOSModal>
    </div>
  );
};
