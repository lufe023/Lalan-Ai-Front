import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles, X, Loader2, Check, Copy, FileDown, ExternalLink, ImagePlus, Upload, Store, Scissors, Flower2, Hand, Brush, Building2, AlertCircle,
  ShieldCheck, Music, Coffee, ListChecks, Leaf, Archive, Undo2,
} from 'lucide-react';
import { api, descargarArchivo, subirArchivo, urlCortaDeVitrina } from '../../services/api';
import { fotoParaCatalogo } from '../../utils/fotoParaCatalogo';
import { useConfirmar } from '../ui/ModalConfirmar';

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
  ejemplos: {
    id: string; nombre: string; slug: string; creadoEn: string;
    /** Lo activo que ya tiene: se ofrece archivarlo antes de rellenar */
    productos?: number; servicios?: number;
    /** Hay algo que deshacer: vueltas del rellenado y cuántos archivó al prepararlo */
    deshacer?: { vueltas: number; archivados: number } | null;
  }[];
}

interface Resultado {
  negocioId: string;
  acceso: { email: string; clave: string | null; nueva: boolean } | null;
  salon: string;
  sedes: { id: string; nombre: string }[];
  resumen: {
    servicios: number; especialistas: number; clientas: number; productos: number; porPedir: string[]; suplidor: string;
    visitasPasadas: number; ventas: number; citasDeLaSemana: number; chats: number;
    citasDelMes?: number; cobrado90?: number; moneda?: string;
    planesDeSeguimiento?: number; plantillasDePlan?: number;
  };
  vitrinas: { sede: string; direccion: string }[];
  factura: string;
  canales?: { canal: string; cuenta: string; sede: string | null; todasLasSedes: boolean; activo: boolean; intacto: boolean }[];
  lounge?: {
    musica: number; enMenu: number; gustosPuestos: number;
    sinProducto: { valor: string; tipo: 'bebida' | 'snack'; clientas: number }[];
    agotado: { producto: string; sede: string } | null;
  };
  recorrido?: {
    alergia: string | null; nueva: string | null; atrasadas: number;
    planConAviso?: string | null; planAtrasado?: string | null; planPorTerminar?: string | null;
  };
}

const NOMBRE_CANAL: Record<string, string> = { whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger' };

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

const ICONO_NEGOCIO: Record<string, React.FC<{ className?: string }>> = { salon: Store, unas: Hand, barberia: Scissors, spa: Flower2, peluqueria: Brush, capilar: Leaf };

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
    archivarCatalogo: false,
  });
  const { confirmar, modalConfirmar } = useConfirmar();
  const [deshaciendo, setDeshaciendo] = useState(false);
  const [deshecho, setDeshecho] = useState<string>('');

  const cargarOpciones = () => api.get<Opciones>('/plataforma/ejemplo/opciones')
    .then((o) => { setOp(o); setF((x) => ({ ...x, planId: x.planId || o.planRecomendado || '' })); })
    .catch((e) => setError((e as Error).message));
  useEffect(() => { cargarOpciones(); }, []);

  /** Quita lo que puso el ejemplo y devuelve lo que se archivó al prepararlo */
  const deshacer = async (x: Opciones['ejemplos'][number]) => {
    const ok = await confirmar({
      titulo: `¿Deshacer el ejemplo de ${x.nombre}?`,
      mensaje: `Se quita todo lo que puso el ejemplo (clientas, citas, ventas, chats, equipo, productos, servicios, sedes nuevas, fotos)${x.deshacer?.archivados ? ` y vuelven los ${x.deshacer.archivados} productos y servicios que se archivaron al prepararlo` : ''}. Lo que el salón ya tenía y sus canales conectados no se tocan.`,
      textoConfirmar: 'Deshacer el ejemplo',
      tono: 'peligro',
      icono: <Undo2 className="w-7 h-7" aria-hidden="true" />,
    });
    if (!ok) return;
    setDeshaciendo(true); setError(''); setDeshecho('');
    try {
      const res = await api.post<{ borrados: Record<string, number>; restaurados: { productos: number; servicios: number }; quedan: string[] }>(`/plataforma/ejemplo/${x.id}/deshacer`, {});
      const quitados = Object.values(res.borrados).reduce((a, b) => a + b, 0);
      const vuelven = res.restaurados.productos + res.restaurados.servicios;
      setDeshecho(`Listo: se quitaron ${quitados.toLocaleString('es')} cosas del ejemplo${vuelven ? ` y volvieron ${res.restaurados.productos} productos y ${res.restaurados.servicios} servicios` : ''}.`
        + (res.quedan.length ? ` No se pudo quitar: ${res.quedan.join(', ')}.` : ''));
      await cargarOpciones();
      onCambio();
    } catch (err) { setError((err as Error).message); } finally { setDeshaciendo(false); }
  };

  const negocio = op?.negocios.find((n) => n.id === f.tipo);
  const rellenar = !!f.negocioId;

  const preparar = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setOcupado(true);
    try {
      const res = await api.post<Resultado>('/plataforma/ejemplo', {
        negocioId: f.negocioId || undefined, tipo: f.tipo, pais: f.pais, sedes: f.sedes, especialistas: f.especialistas, clientas: f.clientas,
        vitrina: f.vitrina,
        ...(rellenar && f.archivarCatalogo ? { archivarCatalogo: true } : {}),
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
            ? (
              <div className="text-[0.75rem] text-slate-500 space-y-1">
                <p>Se completa lo que le falte (sedes, equipo, clientas, gustos del Lounge, suplidor) y se llena la agenda del próximo mes en los huecos libres. No se borra nada.</p>
                {(() => {
                  const x = op.ejemplos.find((e) => e.id === f.negocioId);
                  if (!x) return null;
                  const tiene = (x.productos ?? 0) + (x.servicios ?? 0);
                  return <>
                    {tiene > 0 && (
                      <label className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 border border-slate-200/80 dark:border-neutral-700 text-slate-700 dark:text-neutral-200 cursor-pointer">
                        <input type="checkbox" checked={f.archivarCatalogo} onChange={(e) => setF({ ...f, archivarCatalogo: e.target.checked })} className="accent-[var(--primary)] mt-0.5" />
                        <span>
                          <span className="font-semibold flex items-center gap-1"><Archive className="w-3.5 h-3.5" /> Archivar antes los {x.productos ?? 0} productos y {x.servicios ?? 0} servicios que ya tiene</span>
                          <span className="block text-[0.6875rem] text-slate-500">Así el catálogo queda solo con lo del ejemplo. Nada se borra: vuelven con «Deshacer el ejemplo» o desde Catálogo → Archivados.</span>
                        </span>
                      </label>
                    )}
                    {x.deshacer && (
                      <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl border border-dashed border-slate-300 dark:border-neutral-700">
                        <span>
                          Este salón ya se rellenó {x.deshacer.vueltas === 1 ? 'una vez' : `${x.deshacer.vueltas} veces`}
                          {x.deshacer.archivados ? ` y tiene ${x.deshacer.archivados} productos y servicios archivados por el ejemplo` : ''}.
                        </span>
                        <button type="button" onClick={() => void deshacer(x)} disabled={deshaciendo}
                          className="px-3 py-1.5 rounded-xl bg-white dark:bg-neutral-900 border border-rose-300 text-rose-600 text-[0.75rem] font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                          {deshaciendo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Undo2 className="w-3.5 h-3.5" />} Deshacer el ejemplo
                        </button>
                      </div>
                    )}
                  </>;
                })()}
                {deshecho && <p className="flex items-start gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold" role="status"><Check className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {deshecho}</p>}
                <p className="flex items-start gap-1.5 text-emerald-700 dark:text-emerald-400 font-semibold"><ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-0.5" /> El WhatsApp, Instagram y Messenger que ya tenga conectados no se tocan: siguen conectados. Al terminar te los muestro.</p>
              </div>
            )
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

        <div className="p-3 rounded-xl bg-slate-50 dark:bg-neutral-800 text-[0.75rem] text-slate-600 dark:text-neutral-300 space-y-1">
          <div className="font-bold text-slate-700 dark:text-neutral-100">Lo que se siembra para la demo</div>
          <ul className="list-disc pl-4 space-y-0.5">
            <li>90 días de visitas pagadas (casi la mitad con producto) y la agenda de hoy a un mes, llena esta semana, con {negocio?.masculino ? 'un cliente' : 'una clienta'} con alergia y {negocio?.masculino ? 'uno nuevo' : 'una nueva'} mañana.</li>
            <li>El Lounge completo: cada {negocio?.masculino ? 'cliente' : 'clienta'} con su música (artistas y géneros), su bebida y su snack. Unos están en el menú del salón y otros no, para que Lalán sugiera qué vender.</li>
            <li>Una bebida del menú agotada en la primera sede y dos insumos por pedir.</li>
            <li>Cuatro chats de Lalán: reserva por WhatsApp, precio por Instagram, fuera de horario por Messenger y «quiero hablar con una persona».</li>
            <li>Los recordatorios de estas citas ya salen como enviados: los teléfonos son inventados y no se gasta nada si el salón tiene WhatsApp conectado.</li>
          </ul>
        </div>

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
      {modalConfirmar}
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
    [s.citasDeLaSemana, 'citas esta semana'], ...(s.citasDelMes ? [[s.citasDelMes, 'citas en el mes'] as [number, string]] : []),
    ...(s.cobrado90 ? [[`${s.moneda ?? ''} ${s.cobrado90.toLocaleString('es')}`.trim(), 'cobrado en 90 días'] as [string, string]] : []),
    [s.clientas, 'clientas con gustos'], [s.visitasPasadas, 'visitas pasadas'],
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {cifras.map(([n, t]) => (
          <div key={t} className="p-2 rounded-xl bg-slate-50 dark:bg-neutral-800 text-center">
            <div className="text-lg font-extrabold tabular-nums">{n}</div>
            <div className="text-[0.6875rem] text-slate-500 leading-tight">{t}</div>
          </div>
        ))}
      </div>
      {s.porPedir.length > 0 && <p className="text-[0.8125rem]"><b>Por pedir en la primera sede:</b> {s.porPedir.join(' y ')}. Suplidor: {s.suplidor}.</p>}

      {r.canales && r.canales.length > 0 && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 space-y-1">
          <div className="text-[0.8125rem] font-bold flex items-center gap-1.5 text-emerald-800 dark:text-emerald-300"><ShieldCheck className="w-4 h-4" /> Canales conectados: siguen igual</div>
          <ul className="text-[0.75rem] text-emerald-900 dark:text-emerald-200 space-y-0.5">
            {r.canales.map((c) => (
              <li key={`${c.canal}-${c.cuenta}`}>
                <b>{NOMBRE_CANAL[c.canal] ?? c.canal}</b> · {c.cuenta}{c.todasLasSedes ? ' · todas las sedes' : c.sede ? ` · ${c.sede}` : ''}{!c.activo ? ' · apagado' : ''}
              </li>
            ))}
          </ul>
        </div>
      )}

      {r.lounge && <LoungeDelEjemplo l={r.lounge} />}

      <Recorrido r={r} />

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

/** Lo que el Lounge tiene para enseñar: lo que piden y no hay es lo que Lalán sugiere vender */
const LoungeDelEjemplo: React.FC<{ l: NonNullable<Resultado['lounge']> }> = ({ l }) => (
  <div className="space-y-1.5">
    <div className={`${titulo} flex items-center gap-1.5`}><Music className="w-3.5 h-3.5" /> El Lounge</div>
    <p className="text-[0.8125rem]">
      {l.musica} gustos de música, {l.enMenu} bebidas y snacks del menú que ya les gustan{l.gustosPuestos ? ` (${l.gustosPuestos} gustos nuevos en esta vuelta)` : ''}.
    </p>
    {l.sinProducto.length > 0 && (
      <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30">
        <div className="text-[0.8125rem] font-bold flex items-center gap-1.5 text-amber-900 dark:text-amber-200"><Coffee className="w-4 h-4" /> Te lo piden y no lo tienes</div>
        <ul className="mt-1 text-[0.75rem] text-amber-900 dark:text-amber-100 space-y-0.5">
          {l.sinProducto.map((g) => <li key={g.valor}><b>{g.valor}</b> ({g.tipo}): {g.clientas} {g.clientas === 1 ? 'persona' : 'personas'}</li>)}
        </ul>
        {l.agotado && <p className="mt-1 text-[0.75rem] text-amber-900 dark:text-amber-100">Y se acabó <b>{l.agotado.producto}</b> en {l.agotado.sede}.</p>}
      </div>
    )}
  </div>
);

/**
 * El paso a paso de la demo con lo que se sembró: qué abrir, en qué orden,
 * qué decir y qué dato concreto va a ver la dueña en cada pantalla.
 */
const Recorrido: React.FC<{ r: Resultado }> = ({ r }) => {
  const s = r.resumen;
  const l = r.lounge;
  const rc = r.recorrido;
  const whatsapp = r.canales?.find((c) => c.canal === 'whatsapp' && c.activo);
  const top = l?.sinProducto.slice(0, 2).map((g) => `${g.valor} (${g.clientas})`).join(' y ');
  const pasos: { donde: string; que: string; dato?: string }[] = [
    {
      donde: 'Antes de la llamada',
      que: 'Entra con el acceso de arriba en otra ventana (o en incógnito) y deja abierta la Agenda. Ten a mano el teléfono con tu WhatsApp: harás de suplidor.',
      dato: whatsapp ? `El WhatsApp ${whatsapp.cuenta} está conectado: pídele a la dueña que le escriba a Lalán en vivo.` : 'Sin WhatsApp conectado, enseña los chats de ejemplo (y conecta uno en Ajustes → Canales si quieres el chat en vivo).',
    },
    {
      donde: 'Chats',
      que: `Abre los ${s.chats} chats de Lalán: la reserva por WhatsApp (agenda sola y pregunta música y bebida), el precio por Instagram (manda la Vitrina), el de fuera de horario por Messenger y el que pide hablar con una persona.`,
      dato: 'Di: «Lalán contesta, agenda y te avisa solo cuando de verdad te necesita».',
    },
    {
      donde: 'Agenda y Mi semana',
      que: `Enseña las ${s.citasDeLaSemana} citas de la semana y luego Mi semana.`,
      dato: [
        rc?.alergia ? `Mañana viene ${rc.alergia}: sale el aviso de su alergia en la cita.` : null,
        rc?.nueva ? `${rc.nueva} viene por primera vez.` : null,
        rc?.atrasadas ? `${rc.atrasadas} ya se pasaron de su ritmo: salen en «Por volver».` : null,
      ].filter(Boolean).join(' '),
    },
    ...(s.planesDeSeguimiento ? [{
      donde: 'Planes de seguimiento (Mi semana y la ficha)',
      que: `${s.planesDeSeguimiento} clientas van en un tratamiento de varias sesiones. En Mi semana sale quién avisó algo y quién se atrasó; toca una y abre su ficha con el plan.`,
      dato: [
        rc?.planConAviso ? `${rc.planConAviso} le contestó algo a Lalán que hay que atender: sale con sus palabras.` : null,
        rc?.planAtrasado ? `${rc.planAtrasado} no vino a su sesión: sale como atrasada.` : null,
        rc?.planPorTerminar ? `${rc.planPorTerminar} va casi al final: enseña cómo bajó la caída en la gráfica.` : null,
      ].filter(Boolean).join(' ') || undefined,
    }] : []),
    {
      donde: 'Lounge',
      que: 'Abre el Lounge y toca una clienta que llega: su música suena, y su bebida y su snack del menú se sirven con un toque.',
      dato: l ? `${l.musica} gustos de música y ${l.enMenu} gustos que el menú ya cumple.` : undefined,
    },
    {
      donde: 'Informes → «Te lo piden y no lo tienes»',
      que: 'Aquí está la venta que se le escapa: lo que sus clientas piden y el salón no tiene.',
      dato: [top ? `Lo más pedido: ${top}.` : null, l?.agotado ? `Y se le acabó ${l.agotado.producto} en ${l.agotado.sede}.` : null, 'Di: «Lalán te dice qué comprar porque lo pidieron tus clientas».'].filter(Boolean).join(' '),
    },
    {
      donde: 'Compras → Por pedir',
      que: 'Abre el aviso de Por pedir y toca «Encárgaselo a Lalán».',
      dato: s.porPedir.length ? `Se acabaron ${s.porPedir.join(' y ')}. El pedido de precio le llega a ${s.suplidor}: contesta tú desde tu WhatsApp.` : `El pedido de precio le llega a ${s.suplidor}.`,
    },
    {
      donde: 'Pásale la factura a Lalán',
      que: 'Descarga la factura de abajo antes de la llamada y súbela en Compras (o pásasela a Lalán en su chat).',
      dato: 'Reconoce al suplidor, suma al inventario de la sede, avisa del precio que subió y crea el producto nuevo.',
    },
    {
      donde: 'Vitrina',
      que: r.vitrinas.length ? 'Abre la Vitrina desde el botón de abajo: así la ven sus clientas desde Instagram o WhatsApp.' : 'La Vitrina no se publicó en esta vuelta.',
      dato: 'Cierra con: «Lalán trabaja por ti; tú solo atiendes».',
    },
  ];
  return (
    <div className="space-y-1.5">
      <div className={`${titulo} flex items-center gap-1.5`}><ListChecks className="w-3.5 h-3.5" /> Tu recorrido de la demo, paso a paso</div>
      <ol className="space-y-1.5">
        {pasos.map((p, i) => (
          <li key={p.donde} className="flex gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800">
            <span className="w-6 h-6 rounded-full bg-[var(--primary)] text-white text-[0.75rem] font-bold flex items-center justify-center shrink-0 tabular-nums">{i + 1}</span>
            <div className="min-w-0 text-[0.8125rem] space-y-0.5">
              <div className="font-bold">{p.donde}</div>
              <div className="text-slate-600 dark:text-neutral-300">{p.que}</div>
              {p.dato && <div className="text-[0.75rem] text-[var(--primary)] font-semibold">{p.dato}</div>}
            </div>
          </li>
        ))}
      </ol>
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
