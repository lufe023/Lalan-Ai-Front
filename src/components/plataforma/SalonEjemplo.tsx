import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles, X, Loader2, Check, Copy, FileDown, ExternalLink, ImagePlus, Upload, Store, Scissors, Flower2, Hand, Brush, Building2, AlertCircle,
} from 'lucide-react';
import { api, descargarArchivo, subirArchivo, urlCortaDeVitrina } from '../../services/api';
import { fotoParaCatalogo } from '../../utils/fotoParaCatalogo';

/**
 * «Preparar salón de ejemplo»: un salón listo para presentar Lalán en 15
 * minutos (la guía de la demo). Pregunta lo justo, lo arma en el servidor y
 * deja a mano lo que se usa en la llamada: con qué se entra, la Vitrina, la
 * factura del suplidor para «Pásale la factura a Lalán» y las fotos y
 * videos propios del salón que se va a visitar.
 */

interface Opciones {
  negocios: { id: string; nombre: string; descripcion: string; nombreSugerido: string; masculino: boolean }[];
  paises: { id: string; nombre: string; moneda: string }[];
  planes: { id: string; clave: string; nombre: string }[];
  planRecomendado: string | null;
  ejemplos: { id: string; nombre: string; slug: string; creadoEn: string }[];
}

interface Resultado {
  negocioId: string;
  acceso: { email: string; clave: string | null; nueva: boolean } | null;
  salon: string;
  sedes: { id: string; nombre: string }[];
  resumen: {
    servicios: number; especialistas: number; clientas: number; productos: number; porPedir: string[]; suplidor: string;
    visitasPasadas: number; ventas: number; citasDeLaSemana: number; chats: number;
  };
  vitrinas: { sede: string; direccion: string }[];
  factura: string;
}

interface Destinos {
  servicios: { id: string; nombre: string; fotos: number }[];
  especialistas: { id: string; nombre: string; conFoto: boolean }[];
  productos: { id: string; nombre: string; conFoto: boolean }[];
  clientas: { id: string; nombre: string }[];
}

const campo = 'w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.8125rem] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';
const tarjeta = 'p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs text-slate-900 dark:text-neutral-100 dark:[color-scheme:dark]';
const titulo = 'text-[0.75rem] font-bold uppercase tracking-wider text-slate-500';
const chip = (activo: boolean) => `px-3 py-2 rounded-xl border text-[0.8125rem] font-semibold flex items-center gap-1.5 cursor-pointer transition ${activo ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-neutral-200 hover:border-[var(--primary)]/50'}`;

const ICONO_NEGOCIO: Record<string, React.FC<{ className?: string }>> = { salon: Store, unas: Hand, barberia: Scissors, spa: Flower2, peluqueria: Brush };

/** Un número del 1 al N con botones (más rápido que escribirlo) */
const Cuantos: React.FC<{ valor: number; opciones: number[]; onChange: (n: number) => void; etiqueta: string }> = ({ valor, opciones, onChange, etiqueta }) => (
  <div role="group" aria-label={etiqueta} className="flex flex-wrap gap-1">
    {opciones.map((n) => (
      <button key={n} type="button" onClick={() => onChange(n)} aria-pressed={valor === n}
        className={`min-w-9 px-2 py-1.5 rounded-lg border text-[0.8125rem] font-bold tabular-nums cursor-pointer ${valor === n ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300'}`}>
        {n}
      </button>
    ))}
  </div>
);

export const SalonEjemplo: React.FC<{ onCerrar: () => void; onAbrirFicha: (negocioId: string) => void; onCambio: () => void }> = ({ onCerrar, onAbrirFicha, onCambio }) => {
  const [op, setOp] = useState<Opciones | null>(null);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [r, setR] = useState<Resultado | null>(null);
  const [f, setF] = useState({
    negocioId: '', tipo: 'salon', nombre: '', pais: 'DO', planId: '', sedes: 1, especialistas: 4, clientas: 24,
    duenaNombre: '', email: '', clave: '', telefonoDuena: '', suplidorNombre: '', suplidorWhatsapp: '', rnc: '', telefonoSalon: '', vitrina: true,
  });

  useEffect(() => {
    api.get<Opciones>('/plataforma/ejemplo/opciones')
      .then((o) => { setOp(o); setF((x) => ({ ...x, planId: o.planRecomendado ?? '' })); })
      .catch((e) => setError((e as Error).message));
  }, []);

  const negocio = op?.negocios.find((n) => n.id === f.tipo);
  const rellenar = !!f.negocioId;

  const preparar = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setOcupado(true);
    try {
      const res = await api.post<Resultado>('/plataforma/ejemplo', {
        negocioId: f.negocioId || undefined, tipo: f.tipo, pais: f.pais, sedes: f.sedes, especialistas: f.especialistas, clientas: f.clientas,
        vitrina: f.vitrina,
        ...(rellenar ? {} : {
          nombre: f.nombre.trim() || undefined, planId: f.planId || undefined, telefonoSalon: f.telefonoSalon || undefined,
          duena: { nombre: f.duenaNombre || undefined, email: f.email, clave: f.clave || undefined, telefono: f.telefonoDuena || undefined },
        }),
        suplidor: { nombre: f.suplidorNombre || undefined, whatsapp: f.suplidorWhatsapp || undefined, rnc: f.rnc || undefined },
      });
      setR(res);
      onCambio();
    } catch (err) { setError((err as Error).message); } finally { setOcupado(false); }
  };

  if (r) return <Listo r={r} onCerrar={onCerrar} onAbrirFicha={() => onAbrirFicha(r.negocioId)} />;

  return (
    <form onSubmit={preparar} className={`${tarjeta} space-y-4 border-[var(--primary)]/50`}>
      <div className="flex justify-between items-start gap-2">
        <div>
          <b className="text-[0.9375rem] flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-[var(--primary)]" /> Preparar salón de ejemplo</b>
          <p className="text-[0.75rem] text-slate-500 mt-0.5">Para presentar Lalán en 15 minutos: agenda llena, clientas con gustos, chats de Lalán, algo por pedir, un suplidor y su factura.</p>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="cursor-pointer shrink-0"><X className="w-4 h-4 text-slate-400" /></button>
      </div>
      {!op && !error && <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando…</div>}
      {op && <>
        <div className="space-y-1.5">
          <div className={titulo}>1. ¿Uno nuevo o rellenar uno que ya usas?</div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setF({ ...f, negocioId: '' })} aria-pressed={!rellenar} className={chip(!rellenar)}><Sparkles className="w-3.5 h-3.5" /> Salón nuevo</button>
            {op.ejemplos.map((x) => (
              <button key={x.id} type="button" onClick={() => setF({ ...f, negocioId: x.id })} aria-pressed={f.negocioId === x.id} className={chip(f.negocioId === x.id)}>
                <Building2 className="w-3.5 h-3.5" /> {x.nombre}
              </button>
            ))}
          </div>
          {rellenar
            ? <p className="text-[0.75rem] text-slate-500">Se completa lo que le falte (sedes, equipo, clientas, suplidor) y se llena la agenda de esta semana en los huecos libres. No se borra nada.</p>
            : !op.ejemplos.length && <p className="text-[0.75rem] text-slate-500">¿Ya tienes tu salón de ejemplo? Ábrelo en la lista y márcalo como «Salón de ejemplo» para poder rellenarlo desde aquí.</p>}
        </div>

        <div className="space-y-1.5">
          <div className={titulo}>2. ¿Qué tipo de negocio vas a visitar?</div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
            {op.negocios.map((n) => {
              const Icono = ICONO_NEGOCIO[n.id] ?? Store;
              return (
                <button key={n.id} type="button" onClick={() => setF({ ...f, tipo: n.id })} aria-pressed={f.tipo === n.id}
                  className={`${chip(f.tipo === n.id)} flex-col items-start text-left`}>
                  <span className="flex items-center gap-1.5"><Icono className="w-3.5 h-3.5" /> {n.nombre}</span>
                  <span className={`text-[0.6875rem] font-normal ${f.tipo === n.id ? 'text-white/85' : 'text-slate-500'}`}>{n.descripcion}</span>
                </button>
              );
            })}
          </div>
          {negocio?.masculino && <p className="text-[0.75rem] text-slate-500">Los clientes salen en masculino y Lalán les habla así.</p>}
        </div>

        <div className="space-y-1.5">
          <div className={titulo}>3. El salón</div>
          <div className="grid sm:grid-cols-3 gap-2">
            {!rellenar && <input placeholder={`Nombre (ej.: ${negocio?.nombreSugerido ?? 'Bella Studio'})`} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} className={campo} aria-label="Nombre del salón" />}
            <select value={f.pais} onChange={(e) => setF({ ...f, pais: e.target.value })} className={campo} aria-label="País">
              {op.paises.map((p) => <option key={p.id} value={p.id}>{p.nombre} ({p.moneda})</option>)}
            </select>
            {!rellenar && (
              <select value={f.planId} onChange={(e) => setF({ ...f, planId: e.target.value })} className={campo} aria-label="Plan">
                {op.planes.map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.id === op.planRecomendado ? ' (trae todo)' : ''}</option>)}
              </select>
            )}
          </div>
          <div className="grid sm:grid-cols-3 gap-3 pt-1">
            <label className="space-y-1"><span className="text-[0.75rem] text-slate-500">Sedes</span><Cuantos etiqueta="Sedes" valor={f.sedes} opciones={[1, 2, 3]} onChange={(n) => setF({ ...f, sedes: n })} /></label>
            <label className="space-y-1"><span className="text-[0.75rem] text-slate-500">Especialistas</span><Cuantos etiqueta="Especialistas" valor={f.especialistas} opciones={[2, 3, 4, 5, 6]} onChange={(n) => setF({ ...f, especialistas: n })} /></label>
            <label className="space-y-1"><span className="text-[0.75rem] text-slate-500">{negocio?.masculino ? 'Clientes' : 'Clientas'}</span><Cuantos etiqueta="Clientas" valor={f.clientas} opciones={[12, 18, 24, 30]} onChange={(n) => setF({ ...f, clientas: n })} /></label>
          </div>
          {f.sedes > 1 && <p className="text-[0.75rem] text-slate-500">Con varias sedes enseñas el selector de sede, el inventario y la caja de cada una, y que Lalán pregunta a qué sede va la clienta.</p>}
        </div>

        {!rellenar && (
          <div className="space-y-1.5">
            <div className={titulo}>4. Con qué entras tú (la dueña del ejemplo)</div>
            <div className="grid sm:grid-cols-2 gap-2">
              <input placeholder="Nombre de la dueña (ej.: Carolina)" value={f.duenaNombre} onChange={(e) => setF({ ...f, duenaNombre: e.target.value })} className={campo} aria-label="Nombre de la dueña" />
              <input required type="email" placeholder="Correo para entrar (uno que no uses en otro salón)" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={campo} aria-label="Correo para entrar" />
              <input type="text" minLength={8} placeholder="Clave (8 o más; si no, una temporal)" value={f.clave} onChange={(e) => setF({ ...f, clave: e.target.value })} className={campo} aria-label="Clave" autoComplete="new-password" />
              <input placeholder="Tu WhatsApp para los avisos del salón (809…)" value={f.telefonoDuena} onChange={(e) => setF({ ...f, telefonoDuena: e.target.value })} className={campo} aria-label="WhatsApp para avisos" />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <div className={titulo}>{rellenar ? '4' : '5'}. El suplidor (haz tú de suplidor)</div>
          <div className="grid sm:grid-cols-3 gap-2">
            <input placeholder="Nombre (ej.: Distribuidora Belleza Total)" value={f.suplidorNombre} onChange={(e) => setF({ ...f, suplidorNombre: e.target.value })} className={campo} aria-label="Nombre del suplidor" />
            <input placeholder="WhatsApp del suplidor: pon el tuyo" value={f.suplidorWhatsapp} onChange={(e) => setF({ ...f, suplidorWhatsapp: e.target.value })} className={campo} aria-label="WhatsApp del suplidor" />
            <input placeholder="RNC (opcional)" value={f.rnc} onChange={(e) => setF({ ...f, rnc: e.target.value })} className={campo} aria-label="RNC del suplidor" />
          </div>
          <p className="text-[0.75rem] text-slate-500">Con tu número, cuando toques «Encárgaselo a Lalán», el pedido de precio te llega a ti y contestas como suplidor delante de la dueña.</p>
        </div>

        {!rellenar && (
          <div className="space-y-1.5">
            <div className={titulo}>6. El WhatsApp del salón</div>
            <input placeholder="El número que vas a conectar para la demo (opcional)" value={f.telefonoSalon} onChange={(e) => setF({ ...f, telefonoSalon: e.target.value })} className={campo} aria-label="WhatsApp del salón" />
            <p className="text-[0.75rem] text-slate-500">Los chats de ejemplo ya vienen. Para que la dueña le escriba a Lalán en vivo, conecta este número en Ajustes → Canales del salón de ejemplo.</p>
          </div>
        )}

        <label className="flex items-center gap-2 text-[0.8125rem] font-semibold">
          <input type="checkbox" checked={f.vitrina} onChange={(e) => setF({ ...f, vitrina: e.target.checked })} className="accent-[var(--primary)]" /> Publicar la Vitrina de cada sede
        </label>
      </>}
      {error && <p className="text-[0.8125rem] font-semibold text-rose-600 flex items-start gap-1.5" role="alert"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}</p>}
      {op && (
        <button type="submit" disabled={ocupado} className="px-4 py-2.5 rounded-xl bg-[var(--primary)] text-white text-[0.8125rem] font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer">
          {ocupado ? <><Loader2 className="w-4 h-4 animate-spin" /> Preparando el salón…</> : <><Sparkles className="w-4 h-4" /> {rellenar ? 'Rellenar salón de ejemplo' : 'Preparar salón de ejemplo'}</>}
        </button>
      )}
    </form>
  );
};

/** Lo que quedó listo: con qué se entra, qué se armó, la Vitrina, la factura y las fotos propias */
const Listo: React.FC<{ r: Resultado; onCerrar: () => void; onAbrirFicha: () => void }> = ({ r, onCerrar, onAbrirFicha }) => {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    if (!r.acceso) return;
    try { await navigator.clipboard.writeText(`${r.acceso.email}\n${r.acceso.clave ?? ''}`); setCopiado(true); setTimeout(() => setCopiado(false), 2000); } catch { /* sin permiso */ }
  };
  const s = r.resumen;
  const cifras: [number | string, string][] = [
    [s.citasDeLaSemana, 'citas esta semana'], [s.clientas, 'clientas con gustos'], [s.visitasPasadas, 'visitas pasadas'],
    [s.servicios, 'servicios con receta'], [s.especialistas, 'especialistas'], [s.chats, 'chats de Lalán'],
  ];
  return (
    <div className={`${tarjeta} space-y-4 border-emerald-400/60`}>
      <div className="flex justify-between items-start gap-2">
        <div>
          <b className="text-[0.9375rem] flex items-center gap-1.5"><Check className="w-4 h-4 text-emerald-600" /> {r.salon} está listo para la demo</b>
          <p className="text-[0.75rem] text-slate-500 mt-0.5">{r.sedes.map((x) => x.nombre).join(' · ')}</p>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="cursor-pointer shrink-0"><X className="w-4 h-4 text-slate-400" /></button>
      </div>

      {r.acceso && (
        <div className="p-3 rounded-xl bg-[var(--primary)]/5 border border-[var(--primary)]/30 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[0.8125rem]">
            <div className="text-slate-500 text-[0.75rem]">Entra con</div>
            <div className="font-bold">{r.acceso.email}</div>
            <div className="font-mono">{r.acceso.clave}</div>
            {r.acceso.nueva && <div className="text-[0.6875rem] text-slate-500">Clave temporal: te pide cambiarla al entrar.</div>}
          </div>
          <button type="button" onClick={() => void copiar()} className="px-3 py-2 rounded-xl bg-[var(--primary)] text-white text-[0.75rem] font-bold flex items-center gap-1 cursor-pointer">
            {copiado ? <><Check className="w-3.5 h-3.5" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {cifras.map(([n, t]) => (
          <div key={t} className="p-2 rounded-xl bg-slate-50 dark:bg-neutral-800 text-center">
            <div className="text-lg font-extrabold tabular-nums">{n}</div>
            <div className="text-[0.6875rem] text-slate-500 leading-tight">{t}</div>
          </div>
        ))}
      </div>
      {s.porPedir.length > 0 && <p className="text-[0.8125rem]"><b>Por pedir en la primera sede:</b> {s.porPedir.join(' y ')}. Suplidor: {s.suplidor}.</p>}

      <div className="flex flex-wrap gap-2">
        {r.vitrinas.map((v) => (
          <a key={v.direccion} href={urlCortaDeVitrina(v.direccion.replace(/^\//, ''))} target="_blank" rel="noreferrer"
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-neutral-700 text-[0.8125rem] font-semibold flex items-center gap-1.5 hover:border-[var(--primary)]/50">
            <ExternalLink className="w-3.5 h-3.5" /> Vitrina{r.vitrinas.length > 1 ? ` ${v.sede}` : ''}
          </a>
        ))}
        <button type="button" onClick={onAbrirFicha} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-neutral-700 text-[0.8125rem] font-semibold flex items-center gap-1.5 cursor-pointer hover:border-[var(--primary)]/50">
          <Building2 className="w-3.5 h-3.5" /> Abrir su ficha
        </button>
      </div>

      <MediosDelEjemplo negocioId={r.negocioId} factura={r.factura} />
    </div>
  );
};

type Destino = string; // "auto" | "portada" | "servicio:<id>" | "especialista:<id>" | "producto:<id>" | "como-quedo:<id>"
interface PorSubir { archivo: File; vista: string; destino: Destino; estado: 'espera' | 'subiendo' | 'lista' | 'error'; puesta?: string; error?: string }

/**
 * La factura del suplidor y las fotos y videos propios. Sirve también desde
 * la ficha de un salón de ejemplo que ya existe.
 */
export const MediosDelEjemplo: React.FC<{ negocioId: string; factura?: string }> = ({ negocioId, factura }) => {
  const [destinos, setDestinos] = useState<Destinos | null>(null);
  const [lista, setLista] = useState<PorSubir[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [errorFactura, setErrorFactura] = useState('');
  const entrada = useRef<HTMLInputElement>(null);

  useEffect(() => { api.get<Destinos>(`/plataforma/ejemplo/${negocioId}/destinos`).then(setDestinos).catch(() => setDestinos(null)); }, [negocioId]);
  useEffect(() => () => lista.forEach((x) => URL.revokeObjectURL(x.vista)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const agregar = (archivos: FileList | null) => {
    if (!archivos) return;
    const nuevos = Array.from(archivos).filter((a) => a.type.startsWith('image/') || a.type.startsWith('video/'));
    // La primera foto de todas va a la portada; el resto, a los servicios que no tengan
    setLista((l) => [...l, ...nuevos.map((a, i) => ({
      archivo: a, vista: URL.createObjectURL(a), estado: 'espera' as const,
      destino: !l.length && i === 0 && a.type.startsWith('image/') ? 'portada' : 'auto',
    }))]);
  };

  const subir = async () => {
    setSubiendo(true);
    for (let i = 0; i < lista.length; i++) {
      const x = lista[i];
      if (x.estado === 'lista') continue;
      setLista((l) => l.map((y, k) => (k === i ? { ...y, estado: 'subiendo', error: undefined } : y)));
      const [tipo, id] = x.destino.split(':');
      try {
        let res: { puesta: string };
        if (x.archivo.type.startsWith('video/')) {
          const form = new FormData();
          form.append('archivo', x.archivo);
          form.append('tipo', tipo);
          if (id) form.append('id', id);
          res = await subirArchivo<{ puesta: string }>(`/plataforma/ejemplo/${negocioId}/videos`, form);
        } else {
          res = await api.post<{ puesta: string }>(`/plataforma/ejemplo/${negocioId}/fotos`, { imagen: await fotoParaCatalogo(x.archivo), tipo, id });
        }
        setLista((l) => l.map((y, k) => (k === i ? { ...y, estado: 'lista', puesta: res.puesta } : y)));
      } catch (e) {
        setLista((l) => l.map((y, k) => (k === i ? { ...y, estado: 'error', error: (e as Error).message } : y)));
      }
    }
    setSubiendo(false);
    api.get<Destinos>(`/plataforma/ejemplo/${negocioId}/destinos`).then(setDestinos).catch(() => undefined);
  };

  const pendientes = lista.filter((x) => x.estado !== 'lista').length;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <div className={titulo}>La factura del suplidor</div>
        <p className="text-[0.75rem] text-slate-500">Descárgala en la computadora y, en la demo, súbela en Compras → «Registrar factura» (o pásasela a Lalán): reconoce al suplidor, los productos, avisa de un precio que subió y crea uno nuevo.</p>
        <button type="button" onClick={() => { setErrorFactura(''); descargarArchivo(`/${factura ?? `plataforma/ejemplo/${negocioId}/factura`}`, 'factura-suplidor.pdf').catch((e) => setErrorFactura((e as Error).message)); }}
          className="px-3 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[0.8125rem] font-bold flex items-center gap-1.5 cursor-pointer">
          <FileDown className="w-4 h-4" /> Descargar factura (PDF)
        </button>
        {errorFactura && <p className="text-[0.75rem] text-rose-600" role="alert">{errorFactura}</p>}
      </div>

      <div className="space-y-2">
        <div className={titulo}>Fotos y videos del salón que vas a visitar</div>
        <p className="text-[0.75rem] text-slate-500">Bájalos de su Instagram o pídeselos. La dueña ve su propio trabajo en la Vitrina, en el catálogo y en «Cómo quedó». Elige a dónde va cada uno; en «Automático» van a los servicios que aún no tienen foto.</p>
        <button type="button" onClick={() => entrada.current?.click()} className="w-full px-3 py-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-neutral-700 text-[0.8125rem] font-semibold text-slate-600 dark:text-neutral-300 flex items-center justify-center gap-2 cursor-pointer hover:border-[var(--primary)]/60">
          <ImagePlus className="w-4 h-4" /> Elegir fotos y videos
        </button>
        <input ref={entrada} type="file" accept="image/*,video/*" multiple hidden onChange={(e) => { agregar(e.target.files); e.target.value = ''; }} />
        {lista.length > 0 && (
          <ul className="space-y-1.5">
            {lista.map((x, i) => (
              <li key={x.vista} className="flex items-center gap-2 p-1.5 rounded-xl bg-slate-50 dark:bg-neutral-800">
                {x.archivo.type.startsWith('video/')
                  ? <video src={x.vista} muted className="w-12 h-12 rounded-lg object-cover shrink-0 bg-black" />
                  : <img src={x.vista} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />}
                <div className="min-w-0 flex-1 space-y-1">
                  {x.estado === 'lista'
                    ? <div className="text-[0.8125rem] font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1"><Check className="w-3.5 h-3.5" /> {x.puesta}</div>
                    : (
                      <select value={x.destino} disabled={subiendo} aria-label={`A dónde va ${x.archivo.name}`}
                        onChange={(e) => setLista((l) => l.map((y, k) => (k === i ? { ...y, destino: e.target.value } : y)))}
                        className={`${campo} py-1.5`}>
                        <option value="auto">Automático (un servicio sin foto)</option>
                        <option value="portada">Portada de la Vitrina</option>
                        {destinos && <>
                          <optgroup label="Servicio">{destinos.servicios.map((d) => <option key={d.id} value={`servicio:${d.id}`}>{d.nombre}{d.fotos ? ` (${d.fotos})` : ''}</option>)}</optgroup>
                          <optgroup label="Especialista">{destinos.especialistas.map((d) => <option key={d.id} value={`especialista:${d.id}`}>{d.nombre}{d.conFoto ? ' (ya tiene)' : ''}</option>)}</optgroup>
                          <optgroup label="Producto">{destinos.productos.map((d) => <option key={d.id} value={`producto:${d.id}`}>{d.nombre}</option>)}</optgroup>
                          <optgroup label="Cómo quedó (última visita)">{destinos.clientas.map((d) => <option key={d.id} value={`como-quedo:${d.id}`}>{d.nombre}</option>)}</optgroup>
                        </>}
                      </select>
                    )}
                  {x.estado === 'error' && <div className="text-[0.75rem] text-rose-600">{x.error}</div>}
                </div>
                {x.estado === 'subiendo' && <Loader2 className="w-4 h-4 animate-spin text-[var(--primary)] shrink-0" />}
                {x.estado !== 'lista' && x.estado !== 'subiendo' && !subiendo && (
                  <button type="button" onClick={() => { URL.revokeObjectURL(x.vista); setLista((l) => l.filter((_, k) => k !== i)); }} aria-label="Quitar de la lista" className="p-1 cursor-pointer shrink-0">
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {pendientes > 0 && (
          <button type="button" onClick={() => void subir()} disabled={subiendo} className="px-4 py-2.5 rounded-xl bg-[var(--primary)] text-white text-[0.8125rem] font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer">
            {subiendo ? <><Loader2 className="w-4 h-4 animate-spin" /> Subiendo…</> : <><Upload className="w-4 h-4" /> Subir {pendientes} {pendientes === 1 ? 'archivo' : 'archivos'}</>}
          </button>
        )}
      </div>
    </div>
  );
};
