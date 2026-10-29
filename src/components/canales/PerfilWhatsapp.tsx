import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BadgeCheck, Camera, Clock, ExternalLink, Loader2, Store } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';

interface Perfil { acerca: string; descripcion: string; direccion: string; correo: string; sitios: string[]; rubro: string; foto: string | null }
interface Vista {
  sede: { id: string; nombre: string };
  compartida: boolean;
  conectadaEn: string;
  numero: string | null;
  nombre: { actual: string | null; estado: string | null; nuevo: string | null; estadoNuevo: string | null; dondeCambiar: string | null };
  perfil: Perfil;
  sugerido: { nombre: string; direccion: string | null; sitio: string | null };
  rubros: { id: string; nombre: string }[];
  limites: { acerca: number; descripcion: number; direccion: number; correo: number; sitio: number; sitios: number };
}

/** WhatsApp la muestra en un círculo: cuadrada, 640 px, en JPEG */
const LADO_FOTO = 640;
async function fotoCuadrada(f: File): Promise<string> {
  if (!f.type.startsWith('image/')) throw new Error('Eso no es una foto: elige una imagen JPG o PNG.');
  let img: ImageBitmap;
  try { img = await createImageBitmap(f, { imageOrientation: 'from-image' }); }
  catch { throw new Error('No pude abrir esa foto. Prueba con otra.'); }
  const lado = Math.min(img.width, img.height);
  if (lado < 192) { img.close(); throw new Error('La foto es muy pequeña: WhatsApp pide al menos 192 × 192 px.'); }
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = LADO_FOTO;
  const ctx = lienzo.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, LADO_FOTO, LADO_FOTO);
  // El centro de la foto: lo que sobra a los lados (o arriba y abajo) se recorta
  ctx.drawImage(img, (img.width - lado) / 2, (img.height - lado) / 2, lado, lado, 0, 0, LADO_FOTO, LADO_FOTO);
  img.close();
  return lienzo.toDataURL('image/jpeg', 0.88);
}

const campo = 'w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-[0.8125rem] text-slate-900 dark:text-white';
const etiqueta = 'block text-[0.6875rem] font-bold text-slate-600 dark:text-neutral-300 mb-1';

const Contador: React.FC<{ v: string; max: number }> = ({ v, max }) => (
  <span className={`text-[0.625rem] ${v.length > max ? 'text-rose-600' : 'text-slate-400'}`}>{v.length}/{max}</span>
);

/**
 * Cómo ven las clientas el WhatsApp de esta sede: la foto, el «info», la
 * descripción, la dirección, el correo, los sitios y el rubro. Todo se
 * cambia aquí y Meta lo publica al momento. El nombre visible solo se
 * muestra: Meta lo revisa y se pide en WhatsApp Manager (el botón lleva).
 */
export const PerfilWhatsapp: React.FC<{ sede?: string | null }> = ({ sede }) => {
  const { showToast } = useApp();
  const [v, setV] = useState<Vista | null>(null);
  const [f, setF] = useState<Perfil | null>(null);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);
  const q = sede ? `?sede=${encodeURIComponent(sede)}` : '';

  const mostrar = (r: Vista) => { setV(r); setF({ ...r.perfil, sitios: [...r.perfil.sitios] }); setError(''); };
  const cargar = useCallback(() => {
    api.get<Vista>(`/bots/conexion/whatsapp/perfil${q}`).then(mostrar).catch((e) => setError((e as Error).message));
  }, [q]);
  useEffect(() => { cargar(); }, [cargar]);

  if (!v || !f) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-neutral-800 p-3">
        {error ? <p className="text-[0.6875rem] text-rose-600">{error}</p> : <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
      </div>
    );
  }

  const poner = <K extends keyof Perfil>(k: K, valor: Perfil[K]) => setF((x) => (x ? { ...x, [k]: valor } : x));
  const sitios = [...f.sitios, '', ''].slice(0, v.limites.sitios);
  const ponerSitio = (i: number, valor: string) => poner('sitios', sitios.map((s, j) => (j === i ? valor : s)));
  const limpiosSitios = (l: string[]) => l.map((s) => s.trim()).filter(Boolean);

  // Solo se manda lo que cambió
  const cambios: Partial<Perfil> = {};
  (['acerca', 'descripcion', 'direccion', 'correo', 'rubro'] as const).forEach((k) => { if (f[k].trim() !== v.perfil[k]) cambios[k] = f[k]; });
  if (limpiosSitios(f.sitios).join('\n') !== v.perfil.sitios.join('\n')) cambios.sitios = limpiosSitios(f.sitios);
  const hayCambios = Object.keys(cambios).length > 0;
  const pasado = f.acerca.length > v.limites.acerca || f.descripcion.length > v.limites.descripcion || f.direccion.length > v.limites.direccion;

  const guardar = async () => {
    setGuardando(true);
    try {
      mostrar(await api.patch<Vista>(`/bots/conexion/whatsapp/perfil${q}`, cambios));
      showToast('Perfil de WhatsApp guardado', 'Tus clientas ya lo ven así al tocar tu nombre en el chat.', 'success');
    } catch (e) { showToast('No se pudo guardar', (e as Error).message, 'warning'); }
    finally { setGuardando(false); }
  };

  const cambiarFoto = async (archivoElegido?: File) => {
    if (!archivoElegido) return;
    setSubiendo(true);
    try {
      const imagen = await fotoCuadrada(archivoElegido);
      const r = await api.put<Vista>(`/bots/conexion/whatsapp/perfil/foto${q}`, { imagen });
      mostrar({ ...r, perfil: { ...r.perfil, foto: r.perfil.foto ?? imagen } });
      showToast('Foto de perfil cambiada', 'Puede tardar unos minutos en verse en el WhatsApp de tus clientas.', 'success');
    } catch (e) { showToast('No se pudo cambiar la foto', (e as Error).message, 'warning'); }
    finally { setSubiendo(false); if (archivo.current) archivo.current.value = ''; }
  };

  const { nombre, sugerido } = v;
  const sitioVitrina = sugerido.sitio && !limpiosSitios(f.sitios).includes(sugerido.sitio) ? sugerido.sitio : null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-neutral-800 p-3 space-y-3">
      <div>
        <div className="text-xs font-bold text-slate-900 dark:text-white">Cómo te ven en WhatsApp</div>
        <p className="text-[0.6875rem] text-slate-500 dark:text-neutral-400">
          Lo que ve la clienta al tocar el nombre del chat{v.numero ? ` de ${v.numero}` : ''}. Al guardar, Meta lo cambia al momento.
        </p>
        {v.compartida && (
          <p className="mt-1 text-[0.6875rem] font-semibold text-amber-700 dark:text-amber-400">
            Este número atiende todas las sedes (conectado en {v.conectadaEn}): lo que cambies aquí se ve en todas.
          </p>
        )}
      </div>

      {/* La foto y el nombre, como se ven arriba del perfil */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => archivo.current?.click()} disabled={subiendo} aria-label="Cambiar la foto de perfil"
          className="relative w-16 h-16 shrink-0 rounded-full overflow-hidden bg-slate-100 dark:bg-neutral-800 flex items-center justify-center cursor-pointer group">
          {f.foto ? <img src={f.foto} alt="Foto de perfil de WhatsApp" className="w-full h-full object-cover" /> : <Store className="w-7 h-7 text-slate-400" />}
          <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera className="w-5 h-5 text-white" />
          </span>
          {subiendo && <span className="absolute inset-0 flex items-center justify-center bg-black/40"><Loader2 className="w-5 h-5 text-white animate-spin" /></span>}
        </button>
        <input ref={archivo} type="file" accept="image/jpeg,image/png" className="hidden" onChange={(e) => void cambiarFoto(e.target.files?.[0])} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-[0.875rem] font-bold text-slate-900 dark:text-white truncate">
            {nombre.actual ?? 'Sin nombre'}
            {nombre.estado === 'Aprobado' && <BadgeCheck className="w-4 h-4 shrink-0 text-emerald-500" />}
          </div>
          {nombre.estado && nombre.estado !== 'Aprobado' && <div className="text-[0.6875rem] text-amber-700 dark:text-amber-400">{nombre.estado}</div>}
          <button type="button" onClick={() => archivo.current?.click()} disabled={subiendo}
            className="mt-1 text-[0.75rem] font-bold text-[#128C7E] dark:text-[#25D366] cursor-pointer disabled:opacity-50">
            {f.foto ? 'Cambiar foto' : 'Poner foto'}
          </button>
        </div>
      </div>

      {/* El nombre: Meta lo revisa, no se cambia desde Lalan */}
      <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-neutral-800/60 text-[0.6875rem] text-slate-600 dark:text-neutral-300 space-y-1.5">
        {nombre.nuevo && (
          <p className="flex items-start gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
            <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0" /> Pediste «{nombre.nuevo}». {nombre.estadoNuevo ?? 'Meta lo está revisando'}.
          </p>
        )}
        <p>
          <b>El nombre no se cambia desde aquí:</b> Meta revisa cada nombre nuevo (uno a dos días) y pide que sea el de tu negocio
          {sugerido.nombre ? <>, por ejemplo «<b>{sugerido.nombre}</b>»</> : ''}, sin palabras como «WhatsApp» ni solo una palabra genérica.
        </p>
        {nombre.dondeCambiar ? (
          <a href={nombre.dondeCambiar} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 font-bold text-[#128C7E] dark:text-[#25D366]">
            Pedir el cambio en WhatsApp Manager <ExternalLink className="w-3 h-3" />
          </a>
        ) : (
          <p className="font-semibold">Este número está en la cuenta de Meta de Lalan: escríbenos el nombre que quieres y lo pedimos por ti.</p>
        )}
      </div>

      <div>
        <div className="flex justify-between items-baseline"><label htmlFor="pw-acerca" className={etiqueta}>Info (la frase bajo tu nombre)</label><Contador v={f.acerca} max={v.limites.acerca} /></div>
        <input id="pw-acerca" className={campo} value={f.acerca} onChange={(e) => poner('acerca', e.target.value)} placeholder="Reserva tu cita por aquí 💅" />
      </div>
      <div>
        <div className="flex justify-between items-baseline"><label htmlFor="pw-desc" className={etiqueta}>Descripción</label><Contador v={f.descripcion} max={v.limites.descripcion} /></div>
        <textarea id="pw-desc" rows={3} className={campo} value={f.descripcion} onChange={(e) => poner('descripcion', e.target.value)}
          placeholder="Qué haces, en qué te especializas, horario…" />
      </div>
      <div>
        <div className="flex justify-between items-baseline"><label htmlFor="pw-dir" className={etiqueta}>Dirección</label><Contador v={f.direccion} max={v.limites.direccion} /></div>
        <input id="pw-dir" className={campo} value={f.direccion} onChange={(e) => poner('direccion', e.target.value)} />
        {sugerido.direccion && f.direccion.trim() !== sugerido.direccion && (
          <button type="button" onClick={() => poner('direccion', sugerido.direccion!)} className="mt-1 text-[0.6875rem] font-bold text-[#128C7E] dark:text-[#25D366] cursor-pointer">
            Usar la de {v.sede.nombre}: {sugerido.direccion}
          </button>
        )}
      </div>
      <div>
        <label htmlFor="pw-correo" className={etiqueta}>Correo</label>
        <input id="pw-correo" type="email" className={campo} value={f.correo} onChange={(e) => poner('correo', e.target.value)} />
      </div>
      <div>
        <span className={etiqueta}>Sitios web (hasta {v.limites.sitios})</span>
        <div className="space-y-1.5">
          {sitios.map((s, i) => (
            <input key={i} aria-label={`Sitio web ${i + 1}`} type="url" className={campo} value={s} placeholder="https://"
              onChange={(e) => ponerSitio(i, e.target.value)} />
          ))}
        </div>
        {sitioVitrina && limpiosSitios(f.sitios).length < v.limites.sitios && (
          <button type="button" onClick={() => poner('sitios', [...limpiosSitios(f.sitios), sitioVitrina])}
            className="mt-1 text-[0.6875rem] font-bold text-[#128C7E] dark:text-[#25D366] cursor-pointer">
            Poner tu Vitrina, para que reserven solas
          </button>
        )}
      </div>
      <div>
        <label htmlFor="pw-rubro" className={etiqueta}>Rubro</label>
        <select id="pw-rubro" className={campo} value={f.rubro} onChange={(e) => poner('rubro', e.target.value)}>
          {!v.rubros.some((r) => r.id === f.rubro) && <option value={f.rubro}>{f.rubro ? f.rubro : 'Sin elegir'}</option>}
          {v.rubros.map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
        </select>
      </div>

      <button type="button" onClick={() => void guardar()} disabled={!hayCambios || guardando || pasado}
        className="w-full py-2 rounded-lg bg-[#25D366] text-white text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer">
        {guardando && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {hayCambios ? 'Guardar en WhatsApp' : 'Sin cambios'}
      </button>
    </div>
  );
};
