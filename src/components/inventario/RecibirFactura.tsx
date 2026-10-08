import React, { useEffect, useRef, useState } from 'react';
import { Camera, FileUp, Loader2, X } from 'lucide-react';
import { api, subirArchivo } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { IOSModal } from '../ui/IOSModal';

export interface ProductoDeCatalogo { id: string; name: string; unit?: string }

interface Candidato { id: string; name: string; sku: string; unit: string; stock: number; costPrice: number | null; puntos: number }
interface RenglonLeido {
  leido: string; cantidad: number | null; costo: number | null; codigo: string | null;
  lote: string | null; vence: string | null; productId: string | null; producto: string | null;
  parecido: number | null; candidatos: Candidato[]; categoriaSugerida?: string | null;
}
interface FacturaLeida { suplidor: string | null; numero: string | null; renglones: RenglonLeido[] }

/**
 * Lo que la dueña revisa y corrige de cada renglón antes de sumar. `destino`
 * es el id de un producto del catálogo, NUEVO (se crea al sumar) o '' (no se suma).
 */
interface Renglon {
  leido: string; destino: string; cantidad: string; costo: string; lote: string; vence: string; candidatos: Candidato[];
  nombreNuevo: string; categoriaNueva: string; precioNuevo: string;
}
const NUEVO = '__nuevo__';

/** "GEL REAFIRMANTE CORPORAL" → "Gel reafirmante corporal" (lo demás se deja como venga) */
const nombreBonito = (t: string) => (t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t);

/** Archivos por factura y lo que pesa una foto como mucho al subirla (lo mismo que acepta el servidor) */
const ARCHIVOS_MAXIMOS = 3;
const TAMANO_FOTO = 4 * 1024 * 1024;
const TAMANO_PDF = 8 * 1024 * 1024;
const TIPOS = 'image/jpeg,image/png,image/webp,application/pdf';

const campo = 'w-full px-2.5 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.8125rem]';
const soloNumero = (v: string) => v.replace(/[^\d.]/g, '');

/**
 * Una foto del teléfono pasa fácil de 4 MB. Se reduce aquí (2000 px de lado,
 * JPEG) antes de subirla: sobra para leer una factura y no choca con el
 * límite del servidor. Si el navegador no puede, se manda tal cual.
 */
async function reducirFoto(f: File): Promise<File> {
  if (f.type === 'application/pdf' || f.size <= 1.5 * 1024 * 1024) return f;
  try {
    const img = await createImageBitmap(f);
    const escala = Math.min(1, 2000 / Math.max(img.width, img.height));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(img.width * escala);
    lienzo.height = Math.round(img.height * escala);
    lienzo.getContext('2d')!.drawImage(img, 0, 0, lienzo.width, lienzo.height);
    const blob = await new Promise<Blob | null>(ok => lienzo.toBlob(ok, 'image/jpeg', 0.85));
    return blob ? new File([blob], f.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : f;
  } catch { return f; }
}

/**
 * Cargar una factura del suplidor al inventario: se toma la foto, se sube
 * una imagen o el PDF, Lalan lee los renglones y propone a qué producto va
 * cada uno. Nada se guarda hasta que la dueña revisa y pulsa "Sumar".
 */
export const RecibirFactura: React.FC<{ isOpen: boolean; onClose: () => void; productos: ProductoDeCatalogo[] }> = ({ isOpen, onClose, productos }) => {
  const { showToast, recargarCatalogo, categoriasDe } = useApp();
  const categorias = categoriasDe('product');
  const [archivos, setArchivos] = useState<File[]>([]);
  const [leyendo, setLeyendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [renglones, setRenglones] = useState<Renglon[] | null>(null);
  const [suplidor, setSuplidor] = useState('');
  const [numero, setNumero] = useState('');
  const camara = useRef<HTMLInputElement>(null);
  const subir = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setArchivos([]); setRenglones(null); setSuplidor(''); setNumero('');
  }, [isOpen]);

  const agregar = async (lista: FileList | null) => {
    if (!lista?.length) return;
    const nuevos: File[] = [];
    for (const f of Array.from(lista)) {
      if (!TIPOS.split(',').includes(f.type)) { showToast('Archivo no válido', `"${f.name}" no es una foto (JPG, PNG, WEBP) ni un PDF.`, 'warning'); continue; }
      const listo = await reducirFoto(f);
      const tope = listo.type === 'application/pdf' ? TAMANO_PDF : TAMANO_FOTO;
      if (listo.size > tope) { showToast('Archivo muy pesado', `"${f.name}" pasa de ${tope / 1024 / 1024} MB.`, 'warning'); continue; }
      nuevos.push(listo);
    }
    setArchivos(a => {
      const todos = [...a, ...nuevos];
      if (todos.length > ARCHIVOS_MAXIMOS) showToast('Demasiados archivos', `Se leen hasta ${ARCHIVOS_MAXIMOS} a la vez.`, 'warning');
      return todos.slice(0, ARCHIVOS_MAXIMOS);
    });
  };

  const leer = async () => {
    setLeyendo(true);
    try {
      const f = new FormData();
      for (const a of archivos) f.append('archivos', a);
      const r = await subirArchivo<FacturaLeida>('/inventory/factura/leer', f);
      if (!r.renglones.length) { showToast('No encontré productos', 'Prueba con una foto más clara y derecha.', 'warning'); return; }
      setSuplidor(r.suplidor ?? ''); setNumero(r.numero ?? '');
      setRenglones(r.renglones.map(x => ({
        leido: x.leido, candidatos: x.candidatos,
        // Lo que no está en el catálogo se propone como producto nuevo: la dueña lo revisa igual
        destino: x.productId ?? NUEVO,
        nombreNuevo: nombreBonito(x.leido),
        categoriaNueva: categorias.find(c => c.key === x.categoriaSugerida)?.key ?? categorias[0]?.key ?? '',
        precioNuevo: '',
        cantidad: x.cantidad != null ? String(x.cantidad) : '', costo: x.costo != null ? String(x.costo) : '',
        lote: x.lote ?? '', vence: x.vence ?? '',
      })));
    } catch (e) { showToast('No se pudo leer la factura', (e as Error)?.message || 'Intenta de nuevo.', 'warning'); }
    finally { setLeyendo(false); }
  };

  const cambiar = (i: number, cambio: Partial<Renglon>) =>
    setRenglones(rs => rs && rs.map((r, j) => (j === i ? { ...r, ...cambio } : r)));

  const aSumar = (renglones ?? []).filter(r => r.destino && Number(r.cantidad) > 0 && (r.destino !== NUEVO || r.nombreNuevo.trim().length >= 2));
  const nuevos = aSumar.filter(r => r.destino === NUEVO).length;

  const sumar = async () => {
    setGuardando(true);
    try {
      const r = await api.post<{ recibidos: number; creados: { id: string; name: string }[] }>('/inventory/factura/recibir', {
        items: aSumar.map(x => ({
          ...(x.destino === NUEVO
            ? { nuevo: { nombre: x.nombreNuevo.trim(), ...(x.categoriaNueva ? { categoria: x.categoriaNueva } : {}), ...(x.precioNuevo ? { precioVenta: Number(x.precioNuevo) } : {}) } }
            : { productId: x.destino }),
          quantity: Number(x.cantidad),
          ...(x.costo ? { costPrice: Number(x.costo) } : {}),
          ...(x.lote.trim() ? { lotNumber: x.lote.trim() } : {}),
          ...(x.vence ? { expiresAt: new Date(`${x.vence}T12:00:00`).toISOString() } : {}),
        })),
        ...(suplidor.trim() ? { proveedor: suplidor.trim() } : {}),
        ...(numero.trim() ? { numeroFactura: numero.trim() } : {}),
      });
      const creados = r.creados?.length ?? 0;
      showToast('Factura cargada', `${r.recibidos} producto${r.recibidos === 1 ? '' : 's'} sumado${r.recibidos === 1 ? '' : 's'} al inventario${creados ? ` (${creados} nuevo${creados === 1 ? '' : 's'} en el catálogo)` : ''}.`, 'success');
      await recargarCatalogo?.();
      onClose();
    } catch (e) { showToast('No se pudo guardar', (e as Error)?.message || 'Revisa los datos.', 'warning'); }
    finally { setGuardando(false); }
  };

  return (
    <IOSModal isOpen={isOpen} onClose={onClose} title="Cargar factura" subtitle="Foto, cámara o PDF del suplidor" fixedHeight={!!renglones}>
      <div className="space-y-3 p-1">
        {!renglones && (<>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => camara.current?.click()} disabled={archivos.length >= ARCHIVOS_MAXIMOS}
              className="py-4 rounded-2xl border border-dashed border-slate-300 dark:border-neutral-700 flex flex-col items-center gap-1 text-[0.8125rem] font-semibold disabled:opacity-50 cursor-pointer">
              <Camera className="w-5 h-5 text-[var(--primary)]" /> Tomar foto
            </button>
            <button type="button" onClick={() => subir.current?.click()} disabled={archivos.length >= ARCHIVOS_MAXIMOS}
              className="py-4 rounded-2xl border border-dashed border-slate-300 dark:border-neutral-700 flex flex-col items-center gap-1 text-[0.8125rem] font-semibold disabled:opacity-50 cursor-pointer">
              <FileUp className="w-5 h-5 text-[var(--primary)]" /> Subir foto o PDF
            </button>
          </div>
          <input ref={camara} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => { void agregar(e.target.files); e.target.value = ''; }} />
          <input ref={subir} type="file" accept={TIPOS} multiple className="hidden"
            onChange={e => { void agregar(e.target.files); e.target.value = ''; }} />

          {archivos.length > 0 && (
            <ul className="space-y-1">
              {archivos.map((a, i) => (
                <li key={i} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-neutral-800 text-[0.75rem]">
                  <span className="truncate">{a.type === 'application/pdf' ? '📄' : '🖼️'} {a.name}</span>
                  <button type="button" onClick={() => setArchivos(xs => xs.filter((_, j) => j !== i))} className="p-1 cursor-pointer" title="Quitar">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[0.75rem] text-slate-500">
            Hasta {ARCHIVOS_MAXIMOS} archivos (varias páginas de la misma factura). Lalan lee los productos y te los muestra para revisar; nada se suma hasta que confirmes.
          </p>
          <button type="button" disabled={!archivos.length || leyendo} onClick={() => void leer()}
            className="w-full py-3 rounded-xl bg-[var(--primary)] text-white font-bold text-sm disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
            {leyendo && <Loader2 className="w-4 h-4 animate-spin" />} {leyendo ? 'Leyendo la factura…' : 'Leer factura'}
          </button>
        </>)}

        {renglones && (<>
          <div className="grid grid-cols-2 gap-2">
            <label><span className="text-[0.75rem] text-slate-500">Suplidor</span>
              <input className={campo} value={suplidor} onChange={e => setSuplidor(e.target.value)} /></label>
            <label><span className="text-[0.75rem] text-slate-500">N.º de factura / NCF</span>
              <input className={campo} value={numero} onChange={e => setNumero(e.target.value)} /></label>
          </div>

          <ul className="space-y-2">
            {renglones.map((r, i) => {
              const sugeridos = new Set(r.candidatos.map(c => c.id));
              return (
                <li key={i} className={`p-2.5 rounded-2xl border ${r.destino === NUEVO ? 'border-[var(--primary)]/40 bg-[var(--primary)]/[0.03]' : r.destino ? 'border-slate-200 dark:border-neutral-700' : 'border-dashed border-amber-300 dark:border-amber-700'} space-y-2`}>
                  <p className="text-[0.75rem] text-slate-500">En la factura: <span className="font-semibold text-slate-800 dark:text-slate-200">{r.leido}</span></p>
                  <select className={campo} value={r.destino} onChange={e => cambiar(i, { destino: e.target.value })}>
                    <option value={NUEVO}>➕ Crear como producto nuevo</option>
                    <option value="">— No sumar este renglón —</option>
                    {r.candidatos.length > 0 && (
                      <optgroup label="Se parece a">
                        {r.candidatos.map(c => <option key={c.id} value={c.id}>{c.name} · {c.sku}</option>)}
                      </optgroup>
                    )}
                    <optgroup label="Todos los productos">
                      {productos.filter(p => !sugeridos.has(p.id)).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </optgroup>
                  </select>
                  {r.destino === NUEVO && (
                    <div className="grid grid-cols-2 gap-1.5">
                      <label className="col-span-2"><span className="text-[0.6875rem] text-slate-500">Nombre del producto nuevo</span>
                        <input className={campo} value={r.nombreNuevo} onChange={e => cambiar(i, { nombreNuevo: e.target.value })} /></label>
                      <label><span className="text-[0.6875rem] text-slate-500">Categoría</span>
                        <select className={campo} value={r.categoriaNueva} onChange={e => cambiar(i, { categoriaNueva: e.target.value })}>
                          {categorias.map(c => <option key={c.key} value={c.key}>{`${c.icon ?? ''} ${c.name}`.trim()}</option>)}
                        </select></label>
                      <label><span className="text-[0.6875rem] text-slate-500">Precio de venta</span>
                        <input className={campo} inputMode="decimal" placeholder="Vacío = insumo" value={r.precioNuevo} onChange={e => cambiar(i, { precioNuevo: soloNumero(e.target.value) })} /></label>
                    </div>
                  )}
                  {/* En el teléfono, 2 columnas: con 4 la fecha se salía de la pantalla */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    <label><span className="text-[0.6875rem] text-slate-500">Cantidad</span>
                      <input className={campo} inputMode="decimal" value={r.cantidad} onChange={e => cambiar(i, { cantidad: soloNumero(e.target.value) })} /></label>
                    <label><span className="text-[0.6875rem] text-slate-500">Costo c/u</span>
                      <input className={campo} inputMode="decimal" value={r.costo} onChange={e => cambiar(i, { costo: soloNumero(e.target.value) })} /></label>
                    <label><span className="text-[0.6875rem] text-slate-500">Lote</span>
                      <input className={campo} value={r.lote} onChange={e => cambiar(i, { lote: e.target.value })} /></label>
                    <label className="min-w-0"><span className="text-[0.6875rem] text-slate-500">Vence</span>
                      <input type="date" className={`${campo} min-w-0`} value={r.vence} onChange={e => cambiar(i, { vence: e.target.value })} /></label>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex gap-2">
            <button type="button" onClick={() => setRenglones(null)} className="px-4 py-3 rounded-xl bg-slate-100 dark:bg-neutral-800 text-sm font-semibold cursor-pointer">
              Otra foto
            </button>
            <button type="button" disabled={!aSumar.length || guardando} onClick={() => void sumar()}
              className="flex-1 py-3 rounded-xl bg-[var(--primary)] text-white font-bold text-sm disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
              {guardando && <Loader2 className="w-4 h-4 animate-spin" />}
              Sumar {aSumar.length} producto{aSumar.length === 1 ? '' : 's'}{nuevos ? ` (${nuevos} nuevo${nuevos === 1 ? '' : 's'})` : ''}
            </button>
          </div>
        </>)}
      </div>
    </IOSModal>
  );
};
