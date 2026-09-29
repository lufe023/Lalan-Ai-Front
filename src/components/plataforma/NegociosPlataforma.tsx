import React, { useCallback, useEffect, useState } from 'react';
import { Building2, Plus, Loader2, X, KeyRound, MapPin, Save, Power, ChevronRight, LifeBuoy } from 'lucide-react';
import { entrarComoSoporte } from '../../services/soporte';
import { api } from '../../services/api';
import { ClaveParaCompartir } from './ClaveParaCompartir';
import { UsoDelPlan } from './UsoDelPlan';
import {
  NOMBRE_RECURSO, RECURSOS, type CatalogoModulos, type ClaveModulo, type Limites, type NegocioDetalle, type NegocioResumen, type PlanLalan, type Recurso,
} from '../../types/plataforma';
import { CanalesCliente } from './CanalesCliente';
import { EditorCanales } from './EditorCanales';
import { LineasTelefonicas } from './LineasTelefonicas';

/** Lo que llega de una aplicación al piloto para llenar el formulario */
export interface PrellenadoNegocio { aplicacionId?: string; salon?: string; nombre?: string; telefono?: string; ciudad?: string; planClave?: string | null }

interface ClaveNueva { nombre: string; email: string; clave: string; telefono?: string | null; salon?: string }

const campo = 'w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[12px] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';
const tarjeta = 'p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-2xs text-slate-900 dark:text-neutral-100 dark:[color-scheme:dark]';
const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' });

const FormNuevo: React.FC<{ planes: PlanLalan[]; prellenado: PrellenadoNegocio | null; onCreado: (c: ClaveNueva, id: string) => void; onCancelar: () => void }> = ({ planes, prellenado, onCreado, onCancelar }) => {
  const activos = planes.filter((p) => p.activo);
  const planInicial = activos.find((p) => p.clave === prellenado?.planClave)?.id ?? activos[0]?.id ?? '';
  const [f, setF] = useState({
    salon: prellenado?.salon ?? '', sede: '', direccion: prellenado?.ciudad ?? '', planId: planInicial,
    nombre: prellenado?.nombre ?? '', email: '', telefono: prellenado?.telefono ?? '',
  });
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const enviar = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setOcupado(true);
    try {
      const r = await api.post<{ negocioId: string; email: string; claveTemporal: string; telefono: string | null }>('/plataforma/negocios', {
        salon: f.salon, sede: f.sede || undefined, direccion: f.direccion || undefined, planId: f.planId,
        duena: { nombre: f.nombre, email: f.email, telefono: f.telefono || undefined }, aplicacionId: prellenado?.aplicacionId,
      });
      onCreado({ nombre: f.nombre, email: r.email, clave: r.claveTemporal, telefono: r.telefono, salon: f.salon }, r.negocioId);
    } catch (err) { setError((err as Error).message); } finally { setOcupado(false); }
  };
  return (
    <form onSubmit={enviar} className={`${tarjeta} space-y-3 border-[var(--primary)]/50`}>
      <div className="flex justify-between items-center">
        <b className="text-[14px]">Nuevo cliente{prellenado?.aplicacionId ? ' · desde el piloto' : ''}</b>
        <button type="button" onClick={onCancelar} aria-label="Cancelar" className="cursor-pointer"><X className="w-4 h-4 text-slate-400" /></button>
      </div>
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">El salón</div>
      <div className="grid sm:grid-cols-2 gap-2">
        <input required minLength={2} placeholder="Nombre del salón" value={f.salon} onChange={(e) => setF({ ...f, salon: e.target.value })} className={campo} />
        <input placeholder="Nombre de la sede (si no, el del salón)" value={f.sede} onChange={(e) => setF({ ...f, sede: e.target.value })} className={campo} />
        <input placeholder="Dirección o ciudad" value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })} className={campo} />
        <select required value={f.planId} onChange={(e) => setF({ ...f, planId: e.target.value })} className={campo}>
          {activos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">La dueña (entra como administración)</div>
      <div className="grid sm:grid-cols-3 gap-2">
        <input required minLength={2} placeholder="Nombre" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} className={campo} />
        <input required type="email" placeholder="Correo (con él entra)" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={campo} />
        <input placeholder="WhatsApp (809…)" value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} className={campo} />
      </div>
      <p className="text-[11px] text-slate-500">Se crea el salón con su primera sede en hora dominicana y pesos (se cambia en Ajustes), y una clave temporal para la dueña.</p>
      {error && <p className="text-[12px] font-semibold text-rose-600" role="alert">{error}</p>}
      <button type="submit" disabled={ocupado} className="px-4 py-2.5 rounded-xl bg-[var(--primary)] text-white text-[12px] font-bold flex items-center gap-1.5 disabled:opacity-50 cursor-pointer">
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
          <span className="text-[12px] font-semibold text-slate-800 dark:text-neutral-100">{m.nombre}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${extra ? 'bg-emerald-100 text-emerald-700' : quitado ? 'bg-rose-100 text-rose-700' : tiene ? 'bg-slate-100 text-slate-500 dark:bg-neutral-800' : 'text-slate-400'}`}>
            {extra ? 'De más' : quitado ? 'Quitado' : tiene ? 'Del plan' : 'No incluido'}
          </span>
        </button>
      );
    })}
  </div>
);

const Detalle: React.FC<{ id: string; planes: PlanLalan[]; catalogo: CatalogoModulos; onCerrar: () => void; onCambio: () => void; soloSoporte?: boolean }> = ({ id, planes, catalogo, onCerrar, onCambio, soloSoporte }) => {
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
  const nuevaClave = async (u: NegocioDetalle['usuarios'][number]) => {
    if (!window.confirm(`¿Generar una clave temporal nueva para ${u.name}? Se le cerrará la sesión.`)) return;
    try { const r = await api.post<{ claveTemporal: string }>(`/plataforma/negocios/${id}/usuarios/${u.id}/clave-temporal`, {}); setClave({ nombre: u.name, email: u.email, clave: r.claveTemporal, salon: d?.nombre }); void cargar(); }
    catch (e) { setError((e as Error).message); }
  };
  const [entrando, setEntrando] = useState(false);
  const entrar = async () => {
    if (!window.confirm(`Vas a entrar al salón ${d?.nombre ?? ''} como soporte. Lo que cambies se guarda en su salón. Quedará anotado en su bitácora.`)) return;
    setEntrando(true);
    try { const r = await api.post<{ accessToken: string }>(`/plataforma/negocios/${id}/entrar`, {}); entrarComoSoporte(r.accessToken); }
    catch (e) { setError((e as Error).message); setEntrando(false); }
  };
  const agregarSede = async () => {
    if (sede.trim().length < 2) return;
    try { setD(await api.post<NegocioDetalle>(`/plataforma/negocios/${id}/sedes`, { nombre: sede.trim() })); setSede(''); onCambio(); } catch (e) { setError((e as Error).message); }
  };

  if (!d) return <div className={tarjeta}><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>;
  // Soporte no ve los planes: se guía por lo que el cliente tiene hoy
  const planModulos = planes.find((p) => p.id === d.plan?.id)?.modulos ?? d.efectivo.modulos;
  const limitePlan = planes.find((p) => p.id === d.plan?.id)?.limites;

  return (
    <div className={`${tarjeta} space-y-4`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[16px] font-extrabold text-slate-900 dark:text-white">{d.nombre}</h3>
          <p className="text-[11px] text-slate-500">Cliente desde {fecha(d.creadoEn)} · {d.sedes.length} {d.sedes.length === 1 ? 'sede' : 'sedes'}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={() => void entrar()} disabled={entrando}
            className="px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50 cursor-pointer" title="Abrir su app para configurarle especialistas, moneda, ajustes…">
            {entrando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LifeBuoy className="w-3.5 h-3.5" />} Entrar a su salón
          </button>
          <button type="button" disabled={soloSoporte} onClick={() => { if (!d.activo || window.confirm(`¿Suspender ${d.nombre}? Nadie de ese salón podrá entrar hasta que lo actives.`)) void guardar({ active: !d.activo }); }}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer ${d.activo ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
            <Power className="w-3.5 h-3.5" /> {d.activo ? 'Activo' : 'Suspendido'}
          </button>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="cursor-pointer"><X className="w-4 h-4 text-slate-400" /></button>
        </div>
      </div>
      {clave && <ClaveParaCompartir {...clave} onListo={() => setClave(null)} />}
      {error && <p className="text-[12px] font-semibold text-rose-600" role="alert">{error}</p>}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Plan</div>
          {soloSoporte ? <div className={campo}>{d.plan?.nombre ?? 'Sin plan'}</div> : (
          <select value={d.plan?.id ?? ''} onChange={(e) => void guardar({ planId: e.target.value })} className={campo}>
            {planes.map((p) => <option key={p.id} value={p.id}>{p.nombre}{p.activo ? '' : ' (retirado)'}</option>)}
          </select>)}
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 pt-2">Uso</div>
          <UsoDelPlan uso={d.uso} limites={d.efectivo.limites} />
        </div>
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Límites propios <span className="normal-case font-normal">(vacío = los del plan)</span></div>
          <div className="grid grid-cols-2 gap-2">
            {RECURSOS.map((r: Recurso) => {
              const campoApi = { mensajesMes: 'limiteMensajesMes', sedes: 'limiteSedes', usuarios: 'limiteUsuarios', especialistas: 'limiteEspecialistas' }[r];
              const propio = d.limitesPropios[r];
              const delPlan = limitePlan ? (limitePlan as Limites)[r] : null;
              return (
                <label key={r} className="space-y-1 block">
                  <span className="text-[11px] text-slate-500">{NOMBRE_RECURSO[r]}</span>
                  <input type="number" min={0} disabled={soloSoporte} defaultValue={propio ?? ''} placeholder={delPlan === null ? 'Plan: sin límite' : `Plan: ${delPlan}`}
                    onBlur={(e) => { const v = e.target.value === '' ? null : Math.max(0, Math.round(Number(e.target.value))); if (v !== propio) void guardar({ [campoApi]: v }); }}
                    className={campo} />
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Módulos de este cliente <span className="normal-case font-normal">(toca para darle uno de más o quitarle uno de su plan)</span></div>
        <div className={soloSoporte ? 'pointer-events-none' : ''}><Excepciones d={d} catalogo={catalogo} planModulos={planModulos} onCambio={(extra, quitados) => void guardar({ modulosExtra: extra, modulosQuitados: quitados })} /></div>
      </div>

      <CanalesCliente key={`salud-${versionCanales}`} negocioId={id} />
      <div className="grid lg:grid-cols-2 gap-4">
        <EditorCanales negocioId={id} alGuardar={() => setVersionCanales((v) => v + 1)} />
        <LineasTelefonicas negocioId={id} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Usuarios</div>
          {d.usuarios.map((u) => (
            <div key={u.id} className={`flex items-center gap-2 text-[12px] ${u.active ? '' : 'opacity-50'}`}>
              <div className="flex-1 min-w-0"><b>{u.name}</b> <span className="text-slate-400">· {u.role === 'admin' ? 'Administración' : u.role === 'assistant' ? 'Asistente' : u.role}</span>
                <div className="text-[11px] text-slate-500 truncate">{u.email}{u.debeCambiarClave && <span className="text-amber-600"> · aún no entra</span>}</div></div>
              <button type="button" onClick={() => void nuevaClave(u)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-pointer" title="Clave temporal nueva"><KeyRound className="w-3.5 h-3.5 text-slate-500" /></button>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Sedes</div>
          {d.sedes.map((s) => <div key={s.id} className="flex items-center gap-1.5 text-[12px]"><MapPin className="w-3.5 h-3.5 text-slate-400" />{s.name}{s.address && <span className="text-slate-400"> · {s.address}</span>}</div>)}
          {!soloSoporte && <div className="flex gap-2">
            <input value={sede} onChange={(e) => setSede(e.target.value)} placeholder="Nueva sede (ej.: Naco)" className={campo} />
            <button type="button" onClick={() => void agregarSede()} className="px-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[11px] font-bold cursor-pointer shrink-0">Agregar</button>
          </div>}
        </div>
      </div>

      {!soloSoporte && <div className="space-y-1.5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Tus notas (el salón no las ve)</div>
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className={campo} />
        {notas !== (d.notasPlataforma ?? '') && (
          <button type="button" onClick={() => void guardar({ notasPlataforma: notas })} className="px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"><Save className="w-3.5 h-3.5" /> Guardar notas</button>
        )}
      </div>}
    </div>
  );
};

/** Los clientes de Lalan: crear, cambiar de plan, excepciones, suspender */
export const NegociosPlataforma: React.FC<{ prellenado: PrellenadoNegocio | null; onPrellenadoUsado: () => void; soloSoporte?: boolean; abrirId?: string | null }> = ({ prellenado, onPrellenadoUsado, soloSoporte, abrirId }) => {
  const [lista, setLista] = useState<NegocioResumen[] | null>(null);
  const [planes, setPlanes] = useState<PlanLalan[]>([]);
  const [catalogo, setCatalogo] = useState<CatalogoModulos | null>(null);
  const [creando, setCreando] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [clave, setClave] = useState<ClaveNueva | null>(null);
  const [error, setError] = useState('');

  const cargar = useCallback(async () => {
    try {
      const [n, p, c] = await Promise.all([
        api.get<NegocioResumen[]>('/plataforma/negocios'), soloSoporte ? Promise.resolve([] as PlanLalan[]) : api.get<PlanLalan[]>('/plataforma/planes'),
        soloSoporte ? api.get<CatalogoModulos>('/mi-plan/modulos') : api.get<CatalogoModulos>('/plataforma/planes/modulos'),
      ]);
      setLista(n); setPlanes(p); setCatalogo(c);
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);
  useEffect(() => { if (prellenado) { setCreando(true); setAbierto(null); } }, [prellenado]);
  // Desde Salud: abrir directo la ficha del cliente con problemas
  useEffect(() => { if (abrirId) { setAbierto(abrirId); setCreando(false); } }, [abrirId]);

  if (error) return <p className="text-xs text-rose-600">{error}</p>;
  if (!lista || !catalogo) return <div className="flex items-center gap-2 text-xs text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Cargando clientes…</div>;

  return (
    <div className="space-y-3 text-slate-900 dark:text-neutral-100 dark:[color-scheme:dark]">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-slate-500 dark:text-neutral-400">{lista.length} {lista.length === 1 ? 'cliente' : 'clientes'} · {lista.filter((n) => n.activo).length} activos</p>
        {!creando && !soloSoporte && <button type="button" onClick={() => { setCreando(true); setAbierto(null); }} className="px-3 py-2 rounded-xl bg-[var(--primary)] text-white text-[12px] font-bold flex items-center gap-1 cursor-pointer"><Plus className="w-4 h-4" /> Nuevo cliente</button>}
      </div>
      {clave && <ClaveParaCompartir {...clave} onListo={() => setClave(null)} />}
      {creando && (
        <FormNuevo planes={planes} prellenado={prellenado}
          onCancelar={() => { setCreando(false); onPrellenadoUsado(); }}
          onCreado={(c, id) => { setClave(c); setCreando(false); onPrellenadoUsado(); setAbierto(id); void cargar(); }} />
      )}
      {abierto && <Detalle key={abierto} id={abierto} planes={planes} catalogo={catalogo} soloSoporte={soloSoporte} onCerrar={() => setAbierto(null)} onCambio={() => void cargar()} />}
      <div className="grid lg:grid-cols-2 gap-3">
        {lista.map((n) => (
          <button key={n.id} type="button" onClick={() => { setAbierto(n.id); setCreando(false); }}
            className={`${tarjeta} text-left hover:border-[var(--primary)]/50 transition cursor-pointer ${abierto === n.id ? 'border-[var(--primary)]' : ''} ${n.activo ? '' : 'opacity-60'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center shrink-0"><Building2 className="w-4 h-4" /></div>
                <div className="min-w-0">
                  <div className="text-[14px] font-extrabold text-slate-900 dark:text-white truncate">{n.nombre}</div>
                  <div className="text-[11px] text-slate-500 truncate">{n.duena ? `${n.duena.name} · ${n.duena.email}` : 'Sin administración'}</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2.5 mb-2.5">
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--primary)]/10 text-[var(--primary)]">{n.plan?.nombre ?? 'Sin plan'}</span>
              {n.excepciones > 0 && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">{n.excepciones} {n.excepciones === 1 ? 'excepción' : 'excepciones'}</span>}
              {!n.activo && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">Suspendido</span>}
              {n.duena?.debeCambiarClave && <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">Aún no entra</span>}
            </div>
            <UsoDelPlan uso={n.uso} limites={n.limites} compacto />
          </button>
        ))}
      </div>
    </div>
  );
};
