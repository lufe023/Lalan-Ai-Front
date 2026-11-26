import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { comoPregunta, useConfirmar } from '../ui/ModalConfirmar';
import { Plus, Loader2, X, KeyRound, MapPin, Save, Power, LifeBuoy, Gift, Wallet, Sparkles, Pencil, Check, MessageCircle, Mail, Search } from 'lucide-react';
import { entrarComoSoporte } from '../../services/soporte';
import { IOSToggle } from '../ui/IOSToggle';
import { api } from '../../services/api';
import { ClaveParaCompartir } from './ClaveParaCompartir';
import { UsoDelPlan } from './UsoDelPlan';
import {
  NOMBRE_RECURSO, RECURSOS, type CatalogoModulos, type ClaveModulo, type FiltroNegocios, type Limites, type NegocioDetalle, type NegocioResumen, type OrdenNegocios, type PaginaNegocios, type OfertaPlan, type PlanLalan, type PromocionInicial, type Recurso, type VistaCambioDePlan,
} from '../../types/plataforma';
import { CanalesCliente } from './CanalesCliente';
import { EditorCanales } from './EditorCanales';
import { LineasTelefonicas } from './LineasTelefonicas';
import { InstruccionesLalan } from './InstruccionesLalan';
import { MediosDelEjemplo, SalonEjemplo } from './SalonEjemplo';
import { Paginas } from '../avisos/Paginas';
import { BotonAtras } from '../ui/BotonAtras';

/** 809-555-1234 → 18095551234, para wa.me */
const digitosWa = (t: string) => {
  const d = t.replace(/\D/g, '');
  return d.length === 10 && /^(809|829|849)/.test(d) ? `1${d}` : d;
};

/** Cómo contactar a la dueña: WhatsApp y correo a un toque, para ofrecerle ayuda */
function ContactoDuena({ nombre, telefono, correo, salon, sedes }: { nombre: string; telefono: string | null | undefined; correo: string | null | undefined; salon: string; sedes?: NegocioDetalle['sedes'] }) {
  const primer = nombre.trim().split(' ')[0];
  const hola = `Hola ${primer}, soy del equipo de Lalan. Vi que creaste la cuenta de ${salon}. ¿Te ayudo a dejarla lista (tus servicios, tu horario o conectar tu WhatsApp)?`;
  const boton = 'px-3 py-1.5 rounded-xl text-[0.75rem] font-bold flex items-center gap-1 cursor-pointer';
  // Otros números de sedes distintos al de la dueña
  const otras = (sedes ?? []).filter((s) => s.phone && digitosWa(s.phone) !== digitosWa(telefono ?? ''));
  return (
    <div className="rounded-xl bg-slate-50 dark:bg-neutral-800/50 p-3 space-y-2">
      <p className="text-[0.75rem] font-bold text-slate-500">Contacto de la dueña · {nombre}</p>
      <div className="flex flex-wrap items-center gap-2">
        {telefono
          ? <a href={`https://wa.me/${digitosWa(telefono)}?text=${encodeURIComponent(hola)}`} target="_blank" rel="noopener" className={`${boton} bg-emerald-600 text-white hover:bg-emerald-700`}><MessageCircle className="w-3.5 h-3.5" /> Escribirle por WhatsApp · {telefono}</a>
          : <span className="text-[0.75rem] text-slate-500">No dejó teléfono.</span>}
        {correo && <a href={`mailto:${correo}`} className={`${boton} bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-700 dark:text-slate-200`}><Mail className="w-3.5 h-3.5" /> {correo}</a>}
      </div>
      {otras.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[0.75rem] text-slate-500">
          {otras.map((s) => <a key={s.id} href={`https://wa.me/${digitosWa(s.phone!)}`} target="_blank" rel="noopener" className="underline">{s.name}: {s.phone}</a>)}
        </div>
      )}
    </div>
  );
}

/** Lo que llega de una aplicación al piloto para llenar el formulario */
export interface PrellenadoNegocio { aplicacionId?: string; salon?: string; nombre?: string; telefono?: string; ciudad?: string; planClave?: string | null }

interface ClaveNueva { nombre: string; email?: string | null; entraCon?: string[]; clave: string; telefono?: string | null; salon?: string }

const campo = 'w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[0.8125rem] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';
const tarjeta = 'p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs text-slate-900 dark:text-neutral-100 dark:[color-scheme:dark]';
const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' });
/** "2026-12-22" de una fecha ISO, para un <input type="date"> */
const diaDe = (iso: string) => iso.slice(0, 10);
/** Fin del día elegido en hora dominicana: la promoción vale todo ese día */
const finDelDia = (dia: string) => new Date(`${dia}T23:59:00-04:00`).toISOString();

const FormNuevo: React.FC<{ planes: PlanLalan[]; prellenado: PrellenadoNegocio | null; onCreado: (c: ClaveNueva, id: string) => void; onCancelar: () => void }> = ({ planes, prellenado, onCreado, onCancelar }) => {
  const activos = planes.filter((p) => p.activo);
  const planInicial = activos.find((p) => p.clave === prellenado?.planClave)?.id ?? activos[0]?.id ?? '';
  const [f, setF] = useState({
    salon: prellenado?.salon ?? '', sede: '', direccion: prellenado?.ciudad ?? '', planId: planInicial,
    nombre: prellenado?.nombre ?? '', email: '', telefono: prellenado?.telefono ?? '',
  });
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  // La promoción viene marcada: los meses gratis en el plan más alto y luego baja sola al Plan Gratis
  const [promoInicial, setPromoInicial] = useState<PromocionInicial | null>(null);
  const [promo, setPromo] = useState({ activa: true, meses: 2, planDespuesId: '' });
  // Las ofertas activas de Plataforma → Planes: elegir una llena el plan de prueba, los meses y a cuál pasa
  const [ofertas, setOfertas] = useState<OfertaPlan[]>([]);
  const [ofertaId, setOfertaId] = useState('');
  const aplicarOferta = (o: OfertaPlan | undefined) => {
    setOfertaId(o?.id ?? '');
    if (!o) return;
    setF((x) => ({ ...x, planId: o.planPruebaId }));
    setPromo({ activa: true, meses: o.meses, planDespuesId: o.planDespuesId ?? o.planId });
  };
  useEffect(() => {
    Promise.all([
      api.get<PromocionInicial>('/plataforma/planes/promocion'),
      api.get<OfertaPlan[]>('/plataforma/planes/ofertas').then((l) => l.filter((o) => o.activa)).catch(() => [] as OfertaPlan[]),
    ]).then(([p, activas]) => {
      setPromoInicial(p);
      setOfertas(activas);
      setPromo((x) => ({ ...x, meses: p.meses, planDespuesId: p.planDespues?.id ?? '' }));
      if (p.planAlto) setF((x) => ({ ...x, planId: p.planAlto!.id }));
      // Si pidió la prueba desde la página con un plan que tiene oferta, viene elegida
      const delPedido = activas.find((o) => planes.find((pl) => pl.id === o.planId)?.clave === prellenado?.planClave);
      if (delPedido) aplicarOferta(delPedido);
    }).catch(() => setPromo((x) => ({ ...x, activa: false })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setOcupado(true);
    try {
      const r = await api.post<{ negocioId: string; email: string; claveTemporal: string; telefono: string | null; entraCon?: string[] }>('/plataforma/negocios', {
        salon: f.salon, sede: f.sede || undefined, direccion: f.direccion || undefined, planId: f.planId,
        duena: { nombre: f.nombre, email: f.email, telefono: f.telefono || undefined }, aplicacionId: prellenado?.aplicacionId,
        ...(promo.activa && promo.meses > 0 ? { mesesPromo: promo.meses, planDespuesId: promo.planDespuesId || undefined } : {}),
      });
      onCreado({ nombre: f.nombre, email: r.email, entraCon: r.entraCon, clave: r.claveTemporal, telefono: r.telefono, salon: f.salon }, r.negocioId);
    } catch (err) { setError((err as Error).message); } finally { setOcupado(false); }
  };
  return (
    <form onSubmit={enviar} className={`${tarjeta} space-y-3 border-[var(--primary)]/50`}>
      <div className="flex justify-between items-center">
        <b className="text-[0.9375rem]">Nuevo cliente{prellenado?.aplicacionId ? ' · desde el piloto' : ''}</b>
        <button type="button" onClick={onCancelar} aria-label="Cancelar" className="cursor-pointer"><X className="w-4 h-4 text-slate-400" /></button>
      </div>
      <div className="text-[0.75rem] font-bold uppercase tracking-wider text-slate-500">El salón</div>
      <div className="grid sm:grid-cols-2 gap-2">
        <input required minLength={2} placeholder="Nombre del salón" value={f.salon} onChange={(e) => setF({ ...f, salon: e.target.value })} className={campo} />
        <input placeholder="Nombre de la sede (si no, el del salón)" value={f.sede} onChange={(e) => setF({ ...f, sede: e.target.value })} className={campo} />
        <input placeholder="Dirección o ciudad" value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })} className={campo} />
        <select required value={f.planId} onChange={(e) => { setF({ ...f, planId: e.target.value }); setOfertaId(''); }} className={campo}>
          {activos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>
      {ofertas.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[0.75rem] font-bold uppercase tracking-wider text-slate-500">Oferta</div>
          <div className="flex flex-wrap gap-1.5">
            {ofertas.map((o) => (
              <button key={o.id} type="button" onClick={() => aplicarOferta(ofertaId === o.id ? undefined : o)} aria-pressed={ofertaId === o.id}
                className={`px-3 py-1.5 rounded-full border text-[0.75rem] font-semibold cursor-pointer ${ofertaId === o.id ? 'bg-[var(--primary)] text-white border-[var(--primary)]' : 'border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300'}`}>
                {o.nombre}
              </button>
            ))}
          </div>
        </div>
      )}
      {promoInicial && (
        <div className={`p-3 rounded-xl border space-y-2 ${promo.activa ? 'border-[var(--primary)]/40 bg-[var(--primary)]/5' : 'border-slate-200 dark:border-neutral-700'}`}>
          <label className="flex items-center gap-2 text-[0.8125rem] font-semibold">
            <input type="checkbox" checked={promo.activa} onChange={(e) => {
              const activa = e.target.checked;
              setPromo({ ...promo, activa });
              if (activa && promoInicial.planAlto) setF({ ...f, planId: promoInicial.planAlto.id });
            }} className="accent-[var(--primary)]" />
            <Gift className="w-4 h-4 text-[var(--primary)]" /> Empieza con promoción
          </label>
          {promo.activa && (
            <div className="grid sm:grid-cols-[110px_1fr] gap-2 items-center">
              <label className="flex items-center gap-1.5 text-[0.8125rem]">
                <input type="number" min={1} max={promoInicial.mesesMaximo} value={promo.meses}
                  onChange={(e) => setPromo({ ...promo, meses: Math.min(promoInicial.mesesMaximo, Math.max(1, Math.round(Number(e.target.value) || 1))) })}
                  aria-label="Meses de promoción" className={`${campo} w-16`} /> meses
              </label>
              <label className="flex items-center gap-1.5 text-[0.8125rem]">
                <span className="shrink-0 text-slate-500">y después baja solo a</span>
                <select value={promo.planDespuesId} onChange={(e) => setPromo({ ...promo, planDespuesId: e.target.value })} className={campo}>
                  {planes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </label>
              <p className="sm:col-span-2 text-[0.6875rem] text-slate-500">Los meses son en el plan que elegiste arriba. A la dueña se le avisa por correo 7 días antes y el día que baja. No se borra nada de su salón.</p>
            </div>
          )}
        </div>
      )}
      <div className="text-[0.75rem] font-bold uppercase tracking-wider text-slate-500">La dueña (entra como administración)</div>
      <div className="grid sm:grid-cols-3 gap-2">
        <input required minLength={2} placeholder="Nombre" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} className={campo} />
        <input required type="email" placeholder="Correo (con él entra)" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={campo} />
        <input placeholder="WhatsApp (809…)" value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} className={campo} />
      </div>
      <p className="text-[0.75rem] text-slate-500">Se crea el salón con su primera sede en hora dominicana y pesos (se cambia en Ajustes), y una clave temporal para la dueña.</p>
      {error && <p className="text-[0.8125rem] font-semibold text-rose-600" role="alert">{error}</p>}
      <button type="submit" disabled={ocupado} className="px-4 py-2.5 rounded-xl bg-[var(--primary)] text-white text-[0.8125rem] font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer">
        {ocupado && <Loader2 className="w-4 h-4 animate-spin" />} Crear cliente
      </button>
    </form>
  );
};

/** Cada módulo, para este cliente: como en su plan, de más, o quitado */
const Excepciones: React.FC<{ d: NegocioDetalle; catalogo: CatalogoModulos; planModulos: ClaveModulo[]; onCambio: (extra: ClaveModulo[], quitados: ClaveModulo[]) => void }> = ({ d, catalogo, planModulos, onCambio }) => (
  <div className="grid sm:grid-cols-2 gap-1.5">
    {catalogo.modulos.map((m) => {
      const enPlan = planModulos.includes(m.id);
      const extra = d.modulosExtra.includes(m.id);
      const quitado = d.modulosQuitados.includes(m.id);
      const tiene = (enPlan && !quitado) || extra;
      const alternar = () => {
        const sinEste = (l: ClaveModulo[]) => l.filter((x) => x !== m.id);
        if (enPlan) onCambio(sinEste(d.modulosExtra), quitado ? sinEste(d.modulosQuitados) : [...d.modulosQuitados, m.id]);
        else onCambio(extra ? sinEste(d.modulosExtra) : [...d.modulosExtra, m.id], sinEste(d.modulosQuitados));
      };
      return (
        <button key={m.id} type="button" onClick={alternar} className={`px-2.5 py-2 rounded-xl border text-left flex items-center justify-between gap-2 cursor-pointer ${tiene ? 'border-[var(--primary)]/60 bg-[var(--primary)]/5' : 'border-slate-200 dark:border-neutral-700 opacity-60'}`}>
          <span className="text-[0.8125rem] font-semibold text-slate-800 dark:text-neutral-100">{m.nombre}</span>
          <span className={`text-[0.6875rem] font-bold px-2 py-0.5 rounded-full ${extra ? 'bg-emerald-100 text-emerald-700' : quitado ? 'bg-rose-100 text-rose-700' : tiene ? 'bg-slate-100 text-slate-500 dark:bg-neutral-800' : 'text-slate-400'}`}>
            {extra ? 'De más' : quitado ? 'Quitado' : tiene ? 'Del plan' : 'No incluido'}
          </span>
        </button>
      );
    })}
  </div>
);

/** La promoción del cliente: hasta cuándo y a qué plan baja; se puede alargar, quitar o terminar ya */
const PromocionCliente: React.FC<{ d: NegocioDetalle; planes: PlanLalan[]; soloSoporte?: boolean; onGuardar: (c: Record<string, unknown>) => Promise<void> }> = ({ d, planes, soloSoporte, onGuardar }) => {
  const { confirmar, modalConfirmar } = useConfirmar();
  const [dia, setDia] = useState(d.promoHasta ? diaDe(d.promoHasta) : '');
  useEffect(() => setDia(d.promoHasta ? diaDe(d.promoHasta) : ''), [d.promoHasta]);
  const gratis = planes.find((p) => p.clave === 'gratis');
  const despues = planes.find((p) => p.id === d.planDespuesId) ?? gratis;
  if (!d.promoHasta) {
    if (soloSoporte) return null;
    return (
      <div className="flex flex-wrap items-center gap-2 text-[0.75rem] text-slate-500">
        <Gift className="w-3.5 h-3.5" /> Sin promoción.
        <input type="date" value={dia} onChange={(e) => setDia(e.target.value)} aria-label="Promoción hasta" className={`${campo} w-auto py-1.5`} />
        <button type="button" disabled={!dia} onClick={() => void onGuardar({ promoHasta: finDelDia(dia) })}
          className="px-2.5 py-1.5 rounded-lg bg-[var(--primary)] text-white font-bold disabled:opacity-40 cursor-pointer">Dar promoción hasta ese día</button>
      </div>
    );
  }
  return (<>
    <div className="p-3 rounded-xl border border-[var(--primary)]/40 bg-[var(--primary)]/5 space-y-2 text-[0.8125rem]">
      <p className="flex items-center gap-1.5"><Gift className="w-4 h-4 text-[var(--primary)]" />
        <span>Promoción en <b>{d.plan?.nombre ?? 'su plan'}</b> hasta el <b>{fecha(d.promoHasta)}</b>; luego baja sola a <b>{despues?.nombre ?? 'Plan Gratis'}</b>.</span></p>
      {!soloSoporte && (
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={dia} onChange={(e) => setDia(e.target.value)} aria-label="Promoción hasta" className={`${campo} w-auto py-1.5`} />
          {dia && dia !== diaDe(d.promoHasta) && (
            <button type="button" onClick={() => void onGuardar({ promoHasta: finDelDia(dia) })} className="px-2.5 py-1.5 rounded-lg bg-[var(--primary)] text-white text-[0.75rem] font-bold cursor-pointer">Cambiar fecha</button>
          )}
          <select value={d.planDespuesId ?? ''} onChange={(e) => void onGuardar({ planDespuesId: e.target.value || null })} aria-label="Plan al terminar" className={`${campo} w-auto py-1.5`}>
            <option value="">Luego: {gratis?.nombre ?? 'Plan Gratis'}</option>
            {planes.filter((p) => p.id !== gratis?.id).map((p) => <option key={p.id} value={p.id}>Luego: {p.nombre}</option>)}
          </select>
          <button type="button" onClick={async () => { if ((await confirmar(comoPregunta(`¿Terminar la promoción de ${d.nombre} ahora? Baja ya a ${despues?.nombre ?? 'Plan Gratis'} y se le avisa a la dueña por correo.`)))) void onGuardar({ promoHasta: new Date().toISOString() }); }}
            className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 text-[0.75rem] font-bold cursor-pointer">Terminar ahora</button>
          <button type="button" onClick={async () => { if ((await confirmar(comoPregunta(`¿Quitar la promoción? ${d.nombre} se queda en ${d.plan?.nombre ?? 'su plan'} y ya no baja sola.`)))) void onGuardar({ promoHasta: null }); }}
            className="px-2.5 py-1.5 rounded-lg text-slate-500 text-[0.75rem] font-semibold cursor-pointer">Quitar promoción</button>
        </div>
      )}
    </div>
  {modalConfirmar}
  </>);
};

/** Hasta cuándo pagó el salón: con más de 5 días de atraso baja solo al Plan Gratis y pierde lo acumulado */
const PagoCliente: React.FC<{ d: NegocioDetalle; soloSoporte?: boolean; onGuardar: (c: Record<string, unknown>) => Promise<void> }> = ({ d, soloSoporte, onGuardar }) => {
  const { confirmar, modalConfirmar } = useConfirmar();
  const [dia, setDia] = useState(d.pagadoHasta ? diaDe(d.pagadoHasta) : '');
  useEffect(() => setDia(d.pagadoHasta ? diaDe(d.pagadoHasta) : ''), [d.pagadoHasta]);
  const vencido = !!d.pagadoHasta && new Date(d.pagadoHasta).getTime() < Date.now();
  const unMesMas = () => {
    const base = d.pagadoHasta && !vencido ? new Date(d.pagadoHasta) : new Date();
    base.setMonth(base.getMonth() + 1);
    void onGuardar({ pagadoHasta: finDelDia(base.toISOString().slice(0, 10)) });
  };
  if (soloSoporte && !d.pagadoHasta) return null;
  return (<>
    <div className="flex flex-wrap items-center gap-2 text-[0.75rem] text-slate-500">
      <Wallet className="w-3.5 h-3.5" />
      {d.pagadoHasta
        ? <span className={vencido ? 'font-bold text-rose-600' : ''}>{vencido ? 'Pago vencido desde el' : 'Pagado hasta el'} {fecha(d.pagadoHasta)}.{vencido && ' A los 5 días baja solo al Plan Gratis.'}</span>
        : <span>Sin fecha de pago: no baja por atraso.</span>}
      {!soloSoporte && (
        <>
          <input type="date" value={dia} onChange={(e) => setDia(e.target.value)} aria-label="Pagado hasta" className={`${campo} w-auto py-1.5`} />
          {dia && dia !== (d.pagadoHasta ? diaDe(d.pagadoHasta) : '') && (
            <button type="button" onClick={() => void onGuardar({ pagadoHasta: finDelDia(dia) })} className="px-2.5 py-1.5 rounded-lg bg-[var(--primary)] text-white font-bold cursor-pointer">Guardar fecha</button>
          )}
          <button type="button" onClick={unMesMas} className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-neutral-700 font-bold cursor-pointer">Pagó un mes</button>
          {d.pagadoHasta && (
            <button type="button" onClick={async () => { if ((await confirmar(comoPregunta(`¿Quitar la fecha de pago de ${d.nombre}? Ya no bajará al Plan Gratis por atraso.`)))) void onGuardar({ pagadoHasta: null }); }}
              className="px-2.5 py-1.5 rounded-lg text-slate-500 font-semibold cursor-pointer">Quitar fecha</button>
          )}
        </>
      )}
    </div>
  {modalConfirmar}
  </>);
};

const Detalle: React.FC<{ id: string; planes: PlanLalan[]; catalogo: CatalogoModulos; onCerrar: () => void; onCambio: () => void; soloSoporte?: boolean }> = ({ id, planes, catalogo, onCerrar, onCambio, soloSoporte }) => {
  const { confirmar, modalConfirmar } = useConfirmar();
  const [d, setD] = useState<NegocioDetalle | null>(null);
  const [notas, setNotas] = useState('');
  const [clave, setClave] = useState<ClaveNueva | null>(null);
  const [sede, setSede] = useState('');
  const [error, setError] = useState('');
  /* Al guardar un canal a mano se vuelve a revisar su salud con Meta */
  const [versionCanales, setVersionCanales] = useState(0);
  const cargar = useCallback(async () => {
    try { const r = await api.get<NegocioDetalle>(`/plataforma/negocios/${id}`); setD(r); setNotas(r.notasPlataforma ?? ''); } catch (e) { setError((e as Error).message); }
  }, [id]);
  useEffect(() => { void cargar(); }, [cargar]);

  const guardar = async (cambio: Record<string, unknown>) => {
    setError('');
    try { setD(await api.patch<NegocioDetalle>(`/plataforma/negocios/${id}`, cambio)); onCambio(); } catch (e) { setError((e as Error).message); }
  };
  /* Antes de cambiar de plan: en qué sedes deja de contestar Lalan, qué adelanto se cobra y qué pierde */
  const cambiarPlan = async (planId: string) => {
    if (!d || planId === d.plan?.id) return;
    setError('');
    try {
      const v = await api.get<VistaCambioDePlan>(`/plataforma/negocios/${id}/cambio-plan?planId=${encodeURIComponent(planId)}`);
      const avisos = [
        v.sedesSinLalan.length ? `Lalan deja de contestar en ${v.sedesSinLalan.join(', ')}: esos chats pasan a una persona.` : '',
        v.adelanto.respuestas ? `Se le cobran ${v.adelanto.respuestas.toLocaleString('es-DO')} respuestas adelantadas (${v.adelanto.monto.toLocaleString('es-DO')} ${v.adelanto.moneda}).` : '',
        v.modulosQuePierde.length ? `Pierde: ${v.modulosQuePierde.join(', ')}.` : '',
        'Este mes tiene la cuota completa del plan nuevo, pero lo que sobre no pasa al mes siguiente.',
      ].filter(Boolean);
      if (!(await confirmar(comoPregunta(`¿Pasar ${d.nombre} a ${v.plan.nombre}?\n\n${avisos.join('\n\n')}`)))) return;
      await guardar({ planId });
    } catch (e) { setError((e as Error).message); }
  };
  const nuevaClave = async (u: NegocioDetalle['usuarios'][number]) => {
    if (!(await confirmar(comoPregunta(`¿Generar una clave temporal nueva para ${u.name}? Se le cerrará la sesión.`)))) return;
    try { const r = await api.post<{ claveTemporal: string }>(`/plataforma/negocios/${id}/usuarios/${u.id}/clave-temporal`, {}); setClave({ nombre: u.name, entraCon: [u.usuario, u.email].filter((x): x is string => !!x), clave: r.claveTemporal, salon: d?.nombre }); void cargar(); }
    catch (e) { setError((e as Error).message); }
  };
  const [entrando, setEntrando] = useState(false);
  /** El formulario de entrada: para qué, y si hay que cambiar algo (la dueña lo ve) */
  const [paraEntrar, setParaEntrar] = useState<{ motivo: string; cambiar: boolean } | null>(null);
  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paraEntrar || paraEntrar.motivo.trim().length < 5) return;
    setEntrando(true);
    try { await api.post(`/plataforma/negocios/${id}/entrar`, { motivo: paraEntrar.motivo.trim(), cambiar: paraEntrar.cambiar }); entrarComoSoporte(); }
    catch (err) { setError((err as Error).message); setEntrando(false); }
  };
  const agregarPaquete = async (respuestas: number, precio: number) => {
    if (!(await confirmar(comoPregunta(`¿Sumarle ${respuestas.toLocaleString('es-DO')} respuestas a ${d?.nombre ?? 'este salón'} por ${precio.toLocaleString('es-DO')} pesos? Valen hasta fin de mes.`)))) return;
    try { await api.post(`/plataforma/negocios/${id}/paquete`, { respuestas }); await cargar(); onCambio(); } catch (e) { setError((e as Error).message); }
  };
  /** La sede que se está renombrando aquí mismo */
  const [editandoSede, setEditandoSede] = useState<{ id: string; nombre: string; guardando?: boolean } | null>(null);
  const renombrarSede = async () => {
    if (!editandoSede || editandoSede.nombre.trim().length < 2) return;
    setEditandoSede({ ...editandoSede, guardando: true });
    try {
      setD(await api.patch<NegocioDetalle>(`/plataforma/negocios/${id}/sedes/${editandoSede.id}`, { nombre: editandoSede.nombre.trim() }));
      setEditandoSede(null); onCambio();
    } catch (e) { setError((e as Error).message); setEditandoSede((x) => (x ? { ...x, guardando: false } : x)); }
  };
  const agregarSede = async () => {
    if (sede.trim().length < 2) return;
    try { setD(await api.post<NegocioDetalle>(`/plataforma/negocios/${id}/sedes`, { nombre: sede.trim() })); setSede(''); onCambio(); } catch (e) { setError((e as Error).message); }
  };

  if (!d) return <div className={tarjeta}><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>;
  // Soporte no ve los planes: se guía por lo que el cliente tiene hoy
  const planModulos = planes.find((p) => p.id === d.plan?.id)?.modulos ?? d.efectivo.modulos;
  const limitePlan = planes.find((p) => p.id === d.plan?.id)?.limites;

  return (<>
    <div className={`${tarjeta} space-y-4`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[1.0625rem] font-extrabold text-slate-900 dark:text-white">{d.nombre}</h3>
          <p className="text-[0.75rem] text-slate-500">Cliente desde {fecha(d.creadoEn)} · {d.sedes.length} {d.sedes.length === 1 ? 'sede' : 'sedes'}</p>
          {d.registroPropio && <p className="text-[0.75rem] font-semibold text-sky-700 dark:text-sky-400">Se registró sola desde la página{d.planElegido ? ` · eligió el plan «${d.planElegido}»` : ''}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={() => setParaEntrar(paraEntrar ? null : { motivo: '', cambiar: false })} disabled={entrando} aria-expanded={!!paraEntrar}
            className="px-3 py-1.5 rounded-xl text-[0.75rem] font-bold flex items-center gap-1 bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 cursor-pointer" title="Abrir su app para configurarle especialistas, moneda, ajustes…">
            {entrando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LifeBuoy className="w-3.5 h-3.5" />} Entrar a su salón
          </button>
          <button type="button" disabled={soloSoporte} onClick={async () => { if (!d.activo || (await confirmar(comoPregunta(`¿Suspender ${d.nombre}? Nadie de ese salón podrá entrar hasta que lo actives.`)))) void guardar({ active: !d.activo }); }}
            className={`px-3 py-1.5 rounded-xl text-[0.75rem] font-bold flex items-center gap-1 cursor-pointer ${d.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            <Power className="w-3.5 h-3.5" /> {d.activo ? 'Activo' : 'Suspendido'}
          </button>
          <button type="button" onClick={onCerrar} aria-label="Cerrar la ficha" title="Cerrar (Esc)" className="hidden xl:flex w-8 h-8 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-pointer"><X className="w-4 h-4 text-slate-400" /></button>
        </div>
      </div>
      {(() => {
        const adm = d.usuarios.find((u) => u.role === 'admin');
        if (!adm) return null;
        const tel = adm.telefono ?? d.sedes.find((x) => x.alertPhone)?.alertPhone ?? null;
        return <ContactoDuena nombre={adm.name} telefono={tel} correo={adm.email} salon={d.nombre} sedes={d.sedes} />;
      })()}
      {paraEntrar && (
        <form onSubmit={entrar} className="p-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-500/10 dark:border-amber-500/30 space-y-2.5">
          <label className="block space-y-1">
            <span className="text-[0.75rem] font-bold text-slate-700 dark:text-neutral-200">¿Para qué entras? La dueña lo verá en su aviso y en su historial.</span>
            <input autoFocus required minLength={5} maxLength={300} value={paraEntrar.motivo} onChange={(e) => setParaEntrar({ ...paraEntrar, motivo: e.target.value })}
              placeholder="Ej.: Configurar la caja que pidió por WhatsApp" className={campo} />
          </label>
          <label className="flex items-start gap-2.5 cursor-pointer">
            <IOSToggle checked={paraEntrar.cambiar} onChange={(v) => setParaEntrar({ ...paraEntrar, cambiar: v })} ariaLabel="Necesito cambiar algo" />
            <span className="text-[0.75rem] text-slate-600 dark:text-neutral-300 leading-snug">
              <b className="text-slate-800 dark:text-white">Necesito cambiar algo</b><br />
              {paraEntrar.cambiar ? 'Lo que cambies se guarda en su salón y queda en su bitácora con tu nombre.' : 'Entras solo a mirar: ves todo y no puedes cambiar nada.'}
            </span>
          </label>
          <button type="submit" disabled={entrando || paraEntrar.motivo.trim().length < 5}
            className="w-full py-2 rounded-xl bg-amber-500 text-white text-[0.8125rem] font-bold disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer">
            {entrando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LifeBuoy className="w-3.5 h-3.5" />} {paraEntrar.cambiar ? 'Entrar para ayudar' : 'Entrar a mirar'}
          </button>
        </form>
      )}
      {clave && <ClaveParaCompartir {...clave} onListo={() => setClave(null)} />}
      {error && <p className="text-[0.8125rem] font-semibold text-rose-600" role="alert">{error}</p>}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-[0.75rem] font-bold uppercase tracking-wider text-slate-500">Plan</div>
          {soloSoporte ? <div className={campo}>{d.plan?.nombre ?? 'Sin plan'}</div> : (
          <select value={d.plan?.id ?? ''} onChange={(e) => void cambiarPlan(e.target.value)} className={campo}>
            {planes.map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.activo ? '' : ' (retirado)'}</option>)}
          </select>)}
          <PromocionCliente d={d} planes={planes} soloSoporte={soloSoporte} onGuardar={guardar} />
          <PagoCliente d={d} soloSoporte={soloSoporte} onGuardar={guardar} />
          <div className="text-[0.75rem] font-bold uppercase tracking-wider text-slate-500 pt-2">Uso</div>
          <UsoDelPlan uso={d.uso} limites={d.efectivo.limites} cupo={d.efectivo.cupo} />
          {!!d.porCobrar && (
            <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900 text-[0.75rem] text-orange-800 dark:text-orange-200">
              <span><b>Por cobrar: {d.porCobrar.toLocaleString('es-DO')} respuestas adelantadas{d.porCobrarMonto ? ` (${d.porCobrarMonto.toLocaleString('es-DO')} pesos)` : ''}</b> que no devolvió al cambiar de plan.</span>
              {!soloSoporte && <button type="button" onClick={async () => { if ((await confirmar(comoPregunta(`¿Ya le cobraste las ${d.porCobrar!.toLocaleString('es-DO')} respuestas adelantadas a ${d.nombre}? Se borran de por cobrar.`)))) void guardar({ adelantoCobrado: true }); }}
                className="px-2.5 py-1 rounded-lg bg-white dark:bg-neutral-900 border border-orange-300 font-bold cursor-pointer">Marcar cobrado</button>}
            </div>
          )}
          {d.gastoIa && (
            <p className="text-[0.75rem] text-slate-500">
              <b className="text-slate-700 dark:text-neutral-200">Gastó en IA este mes: {d.gastoIa.totalPesos.toLocaleString('es-DO')} pesos</b> (US$ {d.gastoIa.totalUsd.toFixed(2)})
              {Object.keys(d.gastoIa.porFuentePesos).length > 0 && ` · ${Object.entries(d.gastoIa.porFuentePesos).map(([f, v]) => `${({ chat: 'chats', pantalla: 'pantalla', planes: 'planes', informes: 'informes', senales: 'señales', fotos: 'fotos', voz: 'voz' } as Record<string, string>)[f] ?? f} ${v}`).join(' · ')}`}
            </p>
          )}
          {d.terminos && <TerminosAceptados {...d.terminos} />}
          {!!d.efectivo.mensajesExtra && <p className="text-[0.75rem] text-emerald-600">Este mes tiene {d.efectivo.mensajesExtra.toLocaleString('es-DO')} respuestas extra de paquetes (ya sumadas).</p>}
          {!soloSoporte && !!d.efectivo.paquetes?.length && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {d.efectivo.paquetes.map((p) => (
                <button key={p.respuestas} type="button" onClick={() => void agregarPaquete(p.respuestas, p.precio)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-neutral-700 text-[0.75rem] font-semibold cursor-pointer hover:border-[var(--primary)]">
                  + {p.respuestas.toLocaleString('es-DO')} respuestas · {p.precio.toLocaleString('es-DO')} pesos
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-2">
          <div className="text-[0.75rem] font-bold uppercase tracking-wider text-slate-500">Límites propios <span className="normal-case font-normal">(vacío = los del plan)</span></div>
          <div className="grid grid-cols-2 gap-2">
            {RECURSOS.map((r: Recurso) => {
              const campoApi = { mensajesMes: 'limiteMensajesMes', sedes: 'limiteSedes', usuarios: 'limiteUsuarios', especialistas: 'limiteEspecialistas' }[r];
              const propio = d.limitesPropios[r];
              const delPlan = limitePlan ? (limitePlan as Limites)[r] : null;
              return (
                <label key={r} className="space-y-1 block">
                  <span className="text-[0.75rem] text-slate-500">{NOMBRE_RECURSO[r]}</span>
                  <input type="number" min={0} disabled={soloSoporte} defaultValue={propio ?? ''} placeholder={delPlan === null ? 'Plan: sin límite' : `Plan: ${delPlan}`}
                    onBlur={(e) => { const v = e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value))); if (v !== propio) void guardar({ [campoApi]: v }); }}
                    className={campo} />
                </label>
              );
            })}
            <label className="space-y-1 block">
              <span className="text-[0.75rem] text-slate-500">Preguntas a Lalan por persona al día</span>
              <input type="number" min={0} disabled={soloSoporte} defaultValue={d.limitesPropios.preguntasDia ?? ''} placeholder={limitePlan?.preguntasDia == null ? 'Plan: el tope general' : `Plan: ${limitePlan.preguntasDia}`}
                onBlur={(e) => { const v = e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value))); if (v !== (d.limitesPropios.preguntasDia ?? null)) void guardar({ limitePreguntasDia: v }); }}
                className={campo} />
            </label>
            {/* Llamadas extra para este salón (el módulo se le da en «Módulos»): vacío = las del plan */}
            <label className="space-y-1 block">
              <span className="text-[0.75rem] text-slate-500">Llamadas de Lalan al mes</span>
              <input type="number" min={0} disabled={soloSoporte} defaultValue={d.limitesPropios.llamadasMes ?? ''} placeholder={limitePlan?.llamadasMes == null ? 'Plan: sin tope' : `Plan: ${limitePlan.llamadasMes}`}
                onBlur={(e) => { const v = e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value))); if (v !== (d.limitesPropios.llamadasMes ?? null)) void guardar({ limiteLlamadasMes: v }); }}
                className={campo} />
            </label>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-[0.75rem] font-bold uppercase tracking-wider text-slate-500">Módulos de este cliente <span className="normal-case font-normal">(toca para darle uno de más o quitarle uno de su plan)</span></div>
        <div className={soloSoporte ? 'pointer-events-none' : ''}><Excepciones d={d} catalogo={catalogo} planModulos={planModulos} onCambio={(extra, quitados) => void guardar({ modulosExtra: extra, modulosQuitados: quitados })} /></div>
      </div>

      <CanalesCliente key={`salud-${versionCanales}`} negocioId={id} />
      <div className="grid lg:grid-cols-2 gap-4">
        <EditorCanales negocioId={id} alGuardar={() => setVersionCanales((v) => v + 1)} />
        <LineasTelefonicas negocioId={id} />
      </div>

      {!soloSoporte && <InstruccionesLalan key={id} negocioId={id} sedes={d.sedes} />}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-[0.75rem] font-bold uppercase tracking-wider text-slate-500">Usuarios</div>
          {d.usuarios.map((u) => (
            <div key={u.id} className={`flex items-center gap-2 text-[0.8125rem] ${u.active ? '' : 'opacity-50'}`}>
              <div className="flex-1 min-w-0"><b>{u.name}</b> <span className="text-slate-400">· {u.role === 'admin' ? 'Administración' : u.role === 'assistant' ? 'Asistente' : u.role}</span>
                <div className="text-[0.75rem] text-slate-500 truncate">{[u.usuario, u.email].filter(Boolean).join(' · ')}{u.debeCambiarClave && <span className="text-amber-600"> · aún no entra</span>}{u.email && !u.correoConfirmadoEn && <span className="text-amber-600"> · correo sin confirmar</span>}</div></div>
              <button type="button" onClick={() => void nuevaClave(u)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-pointer" title="Clave temporal nueva"><KeyRound className="w-3.5 h-3.5 text-slate-500" /></button>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <div className="text-[0.75rem] font-bold uppercase tracking-wider text-slate-500">Sedes</div>
          {d.sedes.map((s) => editandoSede?.id === s.id ? (
            <form key={s.id} onSubmit={(e) => { e.preventDefault(); void renombrarSede(); }} className="flex gap-2">
              <input autoFocus value={editandoSede.nombre} maxLength={100} onChange={(e) => setEditandoSede({ ...editandoSede, nombre: e.target.value })} onKeyDown={(e) => { if (e.key === 'Escape') setEditandoSede(null); }} aria-label={`Nuevo nombre de ${s.name}`} className={campo} />
              <button type="submit" disabled={editandoSede.guardando || editandoSede.nombre.trim().length < 2} className="px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[0.75rem] font-bold cursor-pointer shrink-0 flex items-center gap-1 disabled:opacity-50">
                {editandoSede.guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}Guardar
              </button>
              <button type="button" onClick={() => setEditandoSede(null)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-pointer" title="Cancelar"><X className="w-3.5 h-3.5 text-slate-500" /></button>
            </form>
          ) : (
            <div key={s.id} className="flex items-center gap-1.5 text-[0.8125rem]">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="min-w-0 truncate">{s.name}{s.address && <span className="text-slate-400"> · {s.address}</span>}</span>
              {!soloSoporte && <button type="button" onClick={() => setEditandoSede({ id: s.id, nombre: s.name })} className="ml-auto p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-pointer shrink-0" title="Cambiar el nombre"><Pencil className="w-3.5 h-3.5 text-slate-500" /></button>}
            </div>
          ))}
          {!soloSoporte && <div className="flex gap-2">
            <input value={sede} onChange={(e) => setSede(e.target.value)} placeholder="Nueva sede (ej.: Naco)" className={campo} />
            <button type="button" onClick={() => void agregarSede()} className="px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[0.75rem] font-bold cursor-pointer shrink-0">Agregar</button>
          </div>}
        </div>
      </div>

      {!soloSoporte && (
        <div className={`p-3 rounded-xl border space-y-3 ${d.esEjemplo ? 'border-[var(--primary)]/40 bg-[var(--primary)]/5' : 'border-slate-200 dark:border-neutral-700'}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[0.8125rem] font-bold flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-[var(--primary)]" /> Salón de ejemplo</div>
              <p className="text-[0.75rem] text-slate-500">Para presentar Lalan: se puede rellenar con datos de ejemplo y queda fuera de las estadísticas. Nunca lo marques en un salón de verdad.</p>
            </div>
            <IOSToggle checked={!!d.esEjemplo} onChange={(v) => void guardar({ esEjemplo: v })} ariaLabel="Salón de ejemplo" />
          </div>
          {d.esEjemplo && <MediosDelEjemplo negocioId={d.id} />}
        </div>
      )}

      {!soloSoporte && <div className="space-y-1.5">
        <div className="text-[0.75rem] font-bold uppercase tracking-wider text-slate-500">Tus notas (el salón no las ve)</div>
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className={campo} />
        {notas !== (d.notasPlataforma ?? '') && (
          <button type="button" onClick={() => void guardar({ notasPlataforma: notas })} className="px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white text-[0.75rem] font-bold flex items-center gap-1 cursor-pointer"><Save className="w-3.5 h-3.5" /> Guardar notas</button>
        )}
      </div>}
    </div>
  {modalConfirmar}
  </>);
};

/** Las vistas rápidas, en el orden en que se muestran */
const VISTAS: { id: FiltroNegocios; nombre: string; tono?: string }[] = [
  { id: 'todos', nombre: 'Todos' },
  { id: 'activos', nombre: 'Activos' },
  { id: 'promocion', nombre: 'En promoción', tono: 'text-emerald-700 dark:text-emerald-400' },
  { id: 'registroPropio', nombre: 'Se registraron solas', tono: 'text-sky-700 dark:text-sky-400' },
  { id: 'aunNoEntra', nombre: 'Aún no entran' },
  { id: 'sinWhatsapp', nombre: 'Sin WhatsApp conectado', tono: 'text-amber-700 dark:text-amber-400' },
  { id: 'conWhatsapp', nombre: 'Con WhatsApp' },
  { id: 'pagoVencido', nombre: 'Pago vencido', tono: 'text-rose-600 dark:text-rose-400' },
  { id: 'porCobrar', nombre: 'Por cobrar', tono: 'text-orange-700 dark:text-orange-400' },
  { id: 'suspendidos', nombre: 'Suspendidos', tono: 'text-rose-600 dark:text-rose-400' },
  { id: 'ejemplo', nombre: 'De ejemplo', tono: 'text-violet-700 dark:text-violet-400' },
];
const POR_PAGINA = 25;
const chip = 'px-1.5 py-px rounded-full text-[0.625rem] font-bold whitespace-nowrap';

/** Respuestas de Lalan del mes, en número y barrita (lo que más se mira para ver si lo usan) */
function UsoRespuestas({ n }: { n: NegocioResumen }) {
  const usadas = n.uso.mensajesMes;
  const tope = n.limites.mensajesMes;
  const p = tope ? Math.min(100, Math.round((usadas / tope) * 100)) : 0;
  const color = !tope ? 'bg-slate-300 dark:bg-neutral-700' : p >= 100 ? 'bg-rose-500' : p >= 80 ? 'bg-amber-500' : 'bg-[var(--primary)]';
  return (
    <div className="min-w-0" title="Respuestas de Lalan este mes">
      <div className="text-[0.75rem] tabular-nums whitespace-nowrap"><b className="text-slate-900 dark:text-white">{usadas.toLocaleString('es-DO')}</b> <span className="text-slate-400">{tope !== null ? `de ${tope.toLocaleString('es-DO')}` : '· sin límite'}</span></div>
      <div className="h-1 rounded-full bg-slate-100 dark:bg-neutral-800 mt-1 overflow-hidden"><div className={`h-full rounded-full ${color}`} style={{ width: `${tope ? Math.max(p, usadas ? 3 : 0) : 100}%`, opacity: tope ? 1 : 0.35 }} /></div>
    </div>
  );
}

/** Lo que pide atención, en etiquetas cortas */
function Etiquetas({ n }: { n: NegocioResumen }) {
  const vencido = !!n.pagadoHasta && new Date(n.pagadoHasta).getTime() < Date.now();
  return (
    <>
      {!n.activo && <span className={`${chip} bg-rose-100 text-rose-700`}>Suspendido</span>}
      {vencido && <span className={`${chip} bg-rose-100 text-rose-700`}>Pago vencido</span>}
      {!!n.porCobrar && <span className={`${chip} bg-orange-100 text-orange-700`}>{n.porCobrar.toLocaleString('es-DO')} por cobrar</span>}
      {n.promoHasta && <span className={`${chip} bg-emerald-100 text-emerald-700`}>Promo hasta {fecha(n.promoHasta)}</span>}
      {n.registroPropio && <span className={`${chip} bg-sky-100 text-sky-700`} title={n.planElegido ? `Eligió el plan «${n.planElegido}»` : undefined}>Se registró sola</span>}
      {n.duena?.debeCambiarClave && <span className={`${chip} bg-slate-100 text-slate-500`}>Aún no entra</span>}
      {n.excepciones > 0 && <span className={`${chip} bg-amber-100 text-amber-700`}>{n.excepciones} {n.excepciones === 1 ? 'excepción' : 'excepciones'}</span>}
      {n.esEjemplo && <span className={`${chip} bg-violet-100 text-violet-700`}>De ejemplo</span>}
    </>
  );
}

/** Si su WhatsApp con Lalan está conectado */
function EstadoWhatsapp({ estado, corto }: { estado: NegocioResumen['whatsapp']; corto?: boolean }) {
  if (!estado) return null;
  const v = { conectado: { t: 'Conectado', c: 'text-emerald-600 dark:text-emerald-400', d: 'bg-emerald-500' }, apagado: { t: 'Apagado', c: 'text-amber-600 dark:text-amber-400', d: 'bg-amber-500' }, sin: { t: 'Sin conectar', c: 'text-slate-400', d: 'bg-slate-300 dark:bg-neutral-600' } }[estado];
  return (
    <span className={`inline-flex items-center gap-1 text-[0.6875rem] font-semibold whitespace-nowrap ${v.c}`} title={`Su WhatsApp con Lalan: ${v.t.toLowerCase()}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${v.d}`} aria-hidden="true" />{corto ? <span className="sr-only">WhatsApp {v.t.toLowerCase()}</span> : v.t}
    </span>
  );
}

/** Botón redondo para escribirle a la dueña sin abrir la ficha */
function BotonWhatsapp({ n }: { n: NegocioResumen }) {
  if (!n.duena?.telefono) return <span className="w-8 h-8 shrink-0" aria-hidden="true" />;
  return (
    <a href={`https://wa.me/${digitosWa(n.duena.telefono)}`} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()}
      title={`Escribirle por WhatsApp · ${n.duena.telefono}`} aria-label={`Escribirle a ${n.duena.name} por WhatsApp`}
      className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10">
      <MessageCircle className="w-4 h-4" />
    </a>
  );
}

/** Pantalla de computadora ancha (xl): la ficha va al lado de la lista; si no, encima */
function useAncho(): boolean {
  const q = '(min-width: 1280px)';
  const [ancho, setAncho] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const c = () => setAncho(m.matches);
    m.addEventListener('change', c);
    return () => m.removeEventListener('change', c);
  }, []);
  return ancho;
}

/** Lo que se abre al lado de la lista */
type Panel = { tipo: 'ficha'; id: string } | { tipo: 'nuevo' } | { tipo: 'ejemplo' } | null;

/** Los clientes de Lalan: buscar, filtrar, y la ficha al lado (crear, cambiar de plan, excepciones, suspender) */
export const NegociosPlataforma: React.FC<{ prellenado: PrellenadoNegocio | null; onPrellenadoUsado: () => void; soloSoporte?: boolean; abrirId?: string | null }> = ({ prellenado, onPrellenadoUsado, soloSoporte, abrirId }) => {
  const [datos, setDatos] = useState<PaginaNegocios | null>(null);
  const [cargando, setCargando] = useState(false);
  const [planes, setPlanes] = useState<PlanLalan[]>([]);
  const [catalogo, setCatalogo] = useState<CatalogoModulos | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [clave, setClave] = useState<ClaveNueva | null>(null);
  const [error, setError] = useState('');
  // Lo que se busca: el texto se manda medio segundo después de dejar de escribir
  const [texto, setTexto] = useState('');
  const [q, setQ] = useState('');
  const [plan, setPlan] = useState('');
  const [filtro, setFiltro] = useState<FiltroNegocios>('todos');
  const [orden, setOrden] = useState<OrdenNegocios>('nuevos');
  const [pagina, setPagina] = useState(1);
  const lista = useRef<HTMLDivElement>(null);
  const ancho = useAncho();
  useEffect(() => { const t = setTimeout(() => { setQ(texto.trim()); setPagina(1); }, 350); return () => clearTimeout(t); }, [texto]);

  useEffect(() => {
    Promise.all([
      soloSoporte ? Promise.resolve([] as PlanLalan[]) : api.get<PlanLalan[]>('/plataforma/planes'),
      soloSoporte ? api.get<CatalogoModulos>('/mi-plan/modulos') : api.get<CatalogoModulos>('/plataforma/planes/modulos'),
    ]).then(([p, c]) => { setPlanes(p); setCatalogo(c); }).catch((e) => setError((e as Error).message));
  }, [soloSoporte]);

  const pedido = useRef(0);
  const cargar = useCallback(async () => {
    const n = ++pedido.current;
    setCargando(true);
    try {
      const qs = new URLSearchParams({ pagina: String(pagina), porPagina: String(POR_PAGINA), filtro, orden });
      if (q) qs.set('q', q);
      if (plan) qs.set('plan', plan);
      const r = await api.get<PaginaNegocios | NegocioResumen[]>(`/plataforma/negocios?${qs}`);
      if (n !== pedido.current) return;
      // Un servidor viejo todavía manda todos de una vez: se pagina aquí mismo
      setDatos(Array.isArray(r) ? { items: r.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA), total: r.length, pagina, porPagina: POR_PAGINA, paginas: Math.max(1, Math.ceil(r.length / POR_PAGINA)), conteos: { todos: r.length, activos: r.filter((x) => x.activo).length } as PaginaNegocios['conteos'], planes: [] } : r);
      setError('');
    } catch (e) { if (n === pedido.current) setError((e as Error).message); } finally { if (n === pedido.current) setCargando(false); }
  }, [pagina, filtro, orden, q, plan]);
  useEffect(() => { void cargar(); }, [cargar]);

  useEffect(() => { if (prellenado) setPanel({ tipo: 'nuevo' }); }, [prellenado]);
  // Desde Salud: abrir directo la ficha del cliente con problemas
  useEffect(() => { if (abrirId) setPanel({ tipo: 'ficha', id: abrirId }); }, [abrirId]);
  const cerrar = useCallback(() => { if (panel?.tipo === 'nuevo') onPrellenadoUsado(); setPanel(null); setClave(null); }, [panel, onPrellenadoUsado]);
  // Esc cierra la ficha
  useEffect(() => {
    if (!panel) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !(e.target as HTMLElement)?.closest('input,textarea,select,[role=dialog]')) cerrar(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [panel, cerrar]);

  const irA = (p: number) => { setPagina(p); lista.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); };
  const elegirFiltro = (f: FiltroNegocios) => { setFiltro(f); setPagina(1); };
  const abierto = panel?.tipo === 'ficha' ? panel.id : null;
  const conPanel = !!panel;
  const nombreAbierto = abierto ? datos?.items.find((n) => n.id === abierto)?.nombre : undefined;
  const hayFiltros = !!q || !!plan || filtro !== 'todos';

  if (error && !datos) return <p className="text-xs text-rose-600">{error}</p>;
  if (!datos || !catalogo) return <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando clientes…</div>;

  // La ficha: en la computadora ancha va al lado de la lista (y la lista sigue a la vista); en el teléfono y la tableta, encima de todo
  const fichaAlLado = panel && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/30 hidden md:block xl:hidden" onClick={cerrar} aria-hidden="true" />
          <aside aria-label={panel.tipo === 'ficha' ? `Ficha de ${nombreAbierto ?? 'el cliente'}` : panel.tipo === 'nuevo' ? 'Nuevo cliente' : 'Salón de ejemplo'}
            className="fixed inset-0 md:left-auto md:w-[min(780px,100%)] z-[61] overflow-y-auto overscroll-contain hide-scrollbar bg-slate-50 dark:bg-neutral-950 md:shadow-2xl
              xl:static xl:z-auto xl:w-auto xl:flex-1 xl:min-w-0 xl:sticky xl:top-0 xl:max-h-[calc(100dvh-9rem)] xl:bg-transparent xl:dark:bg-transparent xl:shadow-none xl:rounded-2xl">
            <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-2 bg-slate-50/90 dark:bg-neutral-950/90 backdrop-blur xl:hidden" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}>
              <BotonAtras onVolver={cerrar} texto="Clientes" enDialogo />
            </div>
            <div className="px-3 pb-6 xl:p-0 space-y-3">
              {clave && <ClaveParaCompartir {...clave} onListo={() => setClave(null)} />}
              {panel.tipo === 'nuevo' && (
                <FormNuevo planes={planes} prellenado={prellenado}
                  onCancelar={cerrar}
                  onCreado={(c, id) => { setClave(c); onPrellenadoUsado(); setPanel({ tipo: 'ficha', id }); void cargar(); }} />
              )}
              {panel.tipo === 'ejemplo' && <SalonEjemplo onCerrar={cerrar} onCambio={() => void cargar()} onAbrirFicha={(id) => setPanel({ tipo: 'ficha', id })} />}
              {panel.tipo === 'ficha' && <Detalle key={panel.id} id={panel.id} planes={planes} catalogo={catalogo} soloSoporte={soloSoporte} onCerrar={cerrar} onCambio={() => void cargar()} />}
            </div>
          </aside>
        </>
  );

  const vistas = VISTAS.filter((v) => v.id === 'todos' || v.id === filtro || (datos.conteos[v.id] ?? 0) > 0);
  const campoChico = 'h-10 px-3 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-[0.8125rem] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';

  return (
    <div className="text-slate-900 dark:text-neutral-100 dark:[color-scheme:dark] xl:flex xl:items-start xl:gap-4">
      {/* La lista */}
      <section ref={lista} aria-label="Clientes" className={`space-y-3 min-w-0 scroll-mt-4 ${conPanel ? 'xl:w-[400px] 2xl:w-[460px] xl:shrink-0' : 'xl:flex-1'}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[0.8125rem] text-slate-500 dark:text-neutral-400">
            <b className="text-slate-900 dark:text-white">{(datos.conteos.todos ?? datos.total).toLocaleString('es-DO')}</b> {datos.conteos.todos === 1 ? 'cliente' : 'clientes'}{datos.conteos.activos !== undefined && <> · {datos.conteos.activos.toLocaleString('es-DO')} activos</>}
          </p>
          {!soloSoporte && (
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setPanel({ tipo: 'ejemplo' })} title="Preparar salón de ejemplo" className="h-9 px-3 rounded-xl border border-[var(--primary)]/50 text-[var(--primary)] text-[0.8125rem] font-bold flex items-center gap-1 cursor-pointer hover:bg-[var(--primary)]/5"><Sparkles className="w-4 h-4" /><span className={conPanel ? 'xl:hidden' : ''}>Salón de ejemplo</span></button>
              <button type="button" onClick={() => setPanel({ tipo: 'nuevo' })} className="h-9 px-3 rounded-xl bg-[var(--primary)] text-white text-[0.8125rem] font-bold flex items-center gap-1 cursor-pointer"><Plus className="w-4 h-4" /> Nuevo cliente</button>
            </div>
          )}
        </div>

        <div className={`grid gap-2 ${conPanel ? '' : 'sm:grid-cols-[1fr_auto_auto]'}`}>
          <label className="relative block">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Buscar salón, dueña, correo o teléfono" aria-label="Buscar clientes" className={`${campoChico} w-full pl-9`} />
          </label>
          <div className={`grid grid-cols-2 gap-2 ${conPanel ? '' : 'sm:contents'}`}>
            <select value={plan} onChange={(e) => { setPlan(e.target.value); setPagina(1); }} aria-label="Plan" className={campoChico}>
              <option value="">Todos los planes</option>
              {datos.planes.map((p) => <option key={p.id} value={p.id}>{p.nombre} ({p.cuantos.toLocaleString('es-DO')})</option>)}
            </select>
            <select value={orden} onChange={(e) => { setOrden(e.target.value as OrdenNegocios); setPagina(1); }} aria-label="Orden" className={campoChico}>
              <option value="nuevos">Los más nuevos</option>
              <option value="antiguos">Los más antiguos</option>
              <option value="nombre">Por nombre (A-Z)</option>
            </select>
          </div>
        </div>

        <div className={`flex gap-1.5 overflow-x-auto hide-scrollbar -mx-1 px-1 pb-0.5 ${conPanel ? '' : 'lg:flex-wrap'}`} role="group" aria-label="Vistas">
          {vistas.map((v) => {
            const activa = filtro === v.id;
            return (
              <button key={v.id} type="button" onClick={() => elegirFiltro(v.id)} aria-pressed={activa}
                className={`shrink-0 h-8 px-3 rounded-full border text-[0.75rem] font-semibold flex items-center gap-1.5 cursor-pointer transition ${activa ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white' : `bg-white dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 ${v.tono ?? 'text-slate-600 dark:text-neutral-300'} hover:border-slate-300`}`}>
                {v.nombre}<span className={`tabular-nums ${activa ? 'opacity-70' : 'text-slate-400'}`}>{(datos.conteos[v.id] ?? 0).toLocaleString('es-DO')}</span>
              </button>
            );
          })}
        </div>

        <div className={`rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 overflow-hidden transition-opacity ${cargando ? 'opacity-60' : ''}`} aria-busy={cargando}>
          {/* Encabezado de la tabla (solo en pantalla ancha y sin la ficha abierta) */}
          {!conPanel && (
            <div className="hidden lg:grid grid-cols-[minmax(0,2.2fr)_minmax(0,2fr)_minmax(120px,1fr)_110px_120px_32px] gap-4 px-4 py-2 border-b border-slate-100 dark:border-neutral-800 text-[0.6875rem] font-bold uppercase tracking-wider text-slate-400">
              <span>Salón y dueña</span><span>Plan</span><span>Respuestas del mes</span><span>Sedes · usuarios</span><span>WhatsApp</span><span />
            </div>
          )}
          {datos.items.length === 0 && (
            <div className="px-4 py-10 text-center space-y-2">
              <p className="text-[0.8125rem] text-slate-500">{hayFiltros ? 'Ningún cliente con esa búsqueda.' : 'Todavía no hay clientes.'}</p>
              {hayFiltros && <button type="button" onClick={() => { setTexto(''); setQ(''); setPlan(''); setFiltro('todos'); setPagina(1); }} className="text-[0.8125rem] font-bold text-[var(--primary)] cursor-pointer">Quitar filtros</button>}
            </div>
          )}
          <ul className="divide-y divide-slate-100 dark:divide-neutral-800">
            {datos.items.map((n) => {
              const sel = abierto === n.id;
              const abrir = () => { setPanel({ tipo: 'ficha', id: n.id }); setClave(null); };
              return (
                <li key={n.id}>
                  <div role="button" tabIndex={0} onClick={abrir} aria-current={sel ? 'true' : undefined}
                    onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); abrir(); } }}
                    className={`relative px-4 py-2.5 cursor-pointer transition-colors focus:outline-none focus-visible:bg-slate-50 dark:focus-visible:bg-neutral-800/60 ${sel ? 'bg-[var(--primary)]/[0.07]' : 'hover:bg-slate-50 dark:hover:bg-neutral-800/50'} ${n.activo ? '' : 'opacity-60'}`}>
                    {sel && <span className="absolute left-0 inset-y-0 w-[3px] bg-[var(--primary)]" aria-hidden="true" />}
                    {/* Fila de tabla: pantalla ancha sin la ficha abierta */}
                    {!conPanel && (
                      <div className="hidden lg:grid grid-cols-[minmax(0,2.2fr)_minmax(0,2fr)_minmax(120px,1fr)_110px_120px_32px] gap-4 items-center">
                        <div className="min-w-0">
                          <div className="text-[0.875rem] font-bold text-slate-900 dark:text-white truncate">{n.nombre}</div>
                          <div className="text-[0.75rem] text-slate-500 truncate">{n.duena ? `${n.duena.name} · ${n.duena.email}` : 'Sin administración'}</div>
                        </div>
                        <div className="min-w-0 flex flex-wrap items-center gap-1">
                          <span className="text-[0.75rem] font-bold text-[var(--primary)] mr-1">{n.plan?.nombre ?? 'Sin plan'}</span>
                          <Etiquetas n={n} />
                        </div>
                        <UsoRespuestas n={n} />
                        <div className="text-[0.75rem] tabular-nums text-slate-600 dark:text-neutral-300">{n.uso.sedes} {n.uso.sedes === 1 ? 'sede' : 'sedes'} · {n.uso.usuarios}</div>
                        <EstadoWhatsapp estado={n.whatsapp} />
                        <BotonWhatsapp n={n} />
                      </div>
                    )}
                    {/* Fila compacta: teléfono, o con la ficha abierta al lado */}
                    <div className={`${conPanel ? '' : 'lg:hidden'} flex items-start gap-2`}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-[0.875rem] font-bold text-slate-900 dark:text-white truncate">{n.nombre}</span>
                          <EstadoWhatsapp estado={n.whatsapp} corto />
                        </div>
                        <div className="text-[0.75rem] text-slate-500 truncate">{n.duena?.name ?? 'Sin administración'} · <span className="font-semibold text-[var(--primary)]">{n.plan?.nombre ?? 'Sin plan'}</span></div>
                        <div className="flex flex-wrap gap-1 mt-1 empty:hidden"><Etiquetas n={n} /></div>
                      </div>
                      <div className="w-[92px] shrink-0 pt-0.5"><UsoRespuestas n={n} /></div>
                      <BotonWhatsapp n={n} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <Paginas pagina={datos.pagina} paginas={datos.paginas} total={datos.total} porPagina={datos.porPagina} onIr={irA} />
        </div>
        {error && <p className="text-xs text-rose-600" role="alert">{error}</p>}
      </section>

      {/* La ficha, al lado de la lista: en la computadora la lista sigue a la vista; en el teléfono ocupa la pantalla */}
      {panel && (ancho ? fichaAlLado : createPortal(fichaAlLado, document.body))}
    </div>
  );
};

/** Si su administración aceptó los términos vigentes: quién y cuándo */
function TerminosAceptados({ vigente, aceptados }: NonNullable<NegocioDetalle['terminos']>) {
  if (!aceptados) return <p className="text-[0.75rem] text-amber-600">Todavía no ha aceptado los términos. Se le piden al entrar.</p>;
  const cuando = new Date(aceptados.en).toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' });
  return aceptados.version === vigente
    ? <p className="text-[0.75rem] text-slate-500">Aceptó los términos el {cuando} ({aceptados.por}).</p>
    : <p className="text-[0.75rem] text-amber-600">Aceptó una versión anterior de los términos el {cuando}. La nueva se le pide al entrar.</p>;
}
