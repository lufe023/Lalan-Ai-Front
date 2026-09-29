import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Pencil, Phone, Plus, Wallet } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';

interface Compania { id: string; descripcion: string }
type Alerta = 'vencida' | 'por_vencer' | 'registro_vencido' | 'registro_pronto';
interface Linea {
  id: string; locationId: string | null; numero: string; compania: string; prepago: boolean; pagaLalan: boolean;
  titular: string | null; registrada: boolean; registradaEn: string | null; registroLimite: string | null;
  ultimaRecargaMonto: number | null; ultimaRecargaEn: string | null; vence: string | null; notas: string | null;
  activa: boolean; alertas: Alerta[];
}
interface Recarga { id: string; monto: number; fecha: string; vence: string | null; nota: string | null }

const ALERTA: Record<Alerta, { texto: string; grave: boolean }> = {
  vencida: { texto: 'Recarga vencida', grave: true },
  por_vencer: { texto: 'Recarga por vencer', grave: false },
  registro_vencido: { texto: 'Se pasó la prórroga del registro', grave: true },
  registro_pronto: { texto: 'Prórroga del registro por vencer', grave: false },
};
/** Días que suele durar una recarga de plan prepago (se puede cambiar al anotarla) */
const DIAS_RECARGA_TIPICA = 30;
const campo = 'w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[12px]';

const hoyISO = () => new Date().toLocaleDateString('en-CA');
const masDias = (base: string, dias: number) => { const d = new Date(`${base}T12:00:00`); d.setDate(d.getDate() + dias); return d.toLocaleDateString('en-CA'); };
/** Fecha del input (AAAA-MM-DD) → ISO al mediodía, para que la zona horaria no la mueva de día */
const aISO = (d: string) => (d ? new Date(`${d}T12:00:00`).toISOString() : null);
const aInput = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-CA') : '');
const fecha = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const pesos = (n: number | null) => (n == null ? '—' : n.toLocaleString('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }));
const telefono = (n: string) => { const d = n.replace(/^1(?=\d{10}$)/, ''); return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : n; };

const VACIA = { numero: '', compania: 'claro', prepago: true, pagaLalan: false, titular: '', registrada: false, registroLimite: '', vence: '', notas: '', activa: true };

/**
 * Los chips (líneas) con que el salón usa WhatsApp. Las telefónicas de RD no
 * tienen API: se anota cada recarga y el panel de salud avisa antes de que venza.
 */
export const LineasTelefonicas: React.FC<{ negocioId: string }> = ({ negocioId }) => {
  const { showToast } = useApp();
  const [datos, setDatos] = useState<{ companias: Compania[]; diasAviso: number; lineas: Linea[] } | null>(null);
  const [editando, setEditando] = useState<string | 'nueva' | null>(null);
  const [f, setF] = useState(VACIA);
  const [recargando, setRecargando] = useState<string | null>(null);
  const [r, setR] = useState({ monto: '', fecha: hoyISO(), vence: masDias(hoyISO(), DIAS_RECARGA_TIPICA), nota: '' });
  const [historial, setHistorial] = useState<{ id: string; lista: Recarga[] } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(async () => {
    try { setDatos(await api.get(`/plataforma/negocios/${negocioId}/lineas`)); } catch { setDatos({ companias: [], diasAviso: 7, lineas: [] }); }
  }, [negocioId]);
  useEffect(() => { void cargar(); }, [cargar]);

  const nombreCompania = (id: string) => datos?.companias.find((c) => c.id === id)?.descripcion ?? id;
  const error = (e: unknown) => showToast('No se pudo guardar', (e as Error)?.message || 'Revisa los datos.', 'warning');

  const abrir = (l?: Linea) => {
    setRecargando(null);
    setEditando(l?.id ?? 'nueva');
    setF(l ? { numero: telefono(l.numero), compania: l.compania, prepago: l.prepago, pagaLalan: l.pagaLalan, titular: l.titular ?? '', registrada: l.registrada,
      registroLimite: aInput(l.registroLimite), vence: aInput(l.vence), notas: l.notas ?? '', activa: l.activa } : VACIA);
  };
  const guardar = async () => {
    setOcupado(true);
    const cuerpo = { ...f, titular: f.titular || null, notas: f.notas || null, registroLimite: aISO(f.registroLimite), vence: aISO(f.vence) };
    try {
      if (editando === 'nueva') await api.post(`/plataforma/negocios/${negocioId}/lineas`, cuerpo);
      else await api.patch(`/plataforma/lineas/${editando}`, cuerpo);
      setEditando(null); await cargar();
    } catch (e) { error(e); } finally { setOcupado(false); }
  };
  const abrirRecarga = (l: Linea) => {
    setEditando(null); setRecargando(l.id);
    setR({ monto: l.ultimaRecargaMonto ? String(l.ultimaRecargaMonto) : '', fecha: hoyISO(), vence: masDias(hoyISO(), DIAS_RECARGA_TIPICA), nota: '' });
  };
  const anotarRecarga = async (id: string) => {
    setOcupado(true);
    try {
      await api.post(`/plataforma/lineas/${id}/recargas`, { monto: Number(r.monto), fecha: aISO(r.fecha), ...(r.vence ? { vence: aISO(r.vence) } : {}), ...(r.nota ? { nota: r.nota } : {}) });
      setRecargando(null); await cargar();
      showToast('Recarga anotada', r.vence ? `La línea queda activa hasta el ${fecha(aISO(r.vence))}.` : 'Listo.', 'success');
    } catch (e) { error(e); } finally { setOcupado(false); }
  };
  const verHistorial = async (id: string) => {
    if (historial?.id === id) { setHistorial(null); return; }
    try { setHistorial({ id, lista: await api.get<Recarga[]>(`/plataforma/lineas/${id}/recargas`) }); } catch (e) { error(e); }
  };

  if (!datos) return <div className="flex items-center gap-2 text-[12px] text-slate-500"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando líneas…</div>;

  const formulario = (
    <div className="grid gap-2 sm:grid-cols-2 text-[12px] rounded-xl border border-[var(--primary)]/40 p-2.5">
      <label><span className="text-[10px] text-slate-500">Número</span><input className={campo} inputMode="tel" placeholder="809 555 1234" value={f.numero} onChange={(e) => setF({ ...f, numero: e.target.value })} /></label>
      <label><span className="text-[10px] text-slate-500">Compañía</span>
        <select className={campo} value={f.compania} onChange={(e) => setF({ ...f, compania: e.target.value })}>
          {datos.companias.map((c) => <option key={c.id} value={c.id}>{c.descripcion}</option>)}
        </select></label>
      <label className="sm:col-span-2"><span className="text-[10px] text-slate-500">Titular (a nombre de quién está registrada)</span><input className={campo} value={f.titular} onChange={(e) => setF({ ...f, titular: e.target.value })} /></label>
      <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.registrada} onChange={(e) => setF({ ...f, registrada: e.target.checked })} /> Registro hecho</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.prepago} onChange={(e) => setF({ ...f, prepago: e.target.checked })} /> Prepago</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.pagaLalan} onChange={(e) => setF({ ...f, pagaLalan: e.target.checked })} /> La paga Lalan</label>
        {editando !== 'nueva' && <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.activa} onChange={(e) => setF({ ...f, activa: e.target.checked })} /> Activa</label>}
      </div>
      {!f.registrada && <label><span className="text-[10px] text-slate-500">Prórroga para registrarla (hasta)</span><input type="date" className={campo} value={f.registroLimite} onChange={(e) => setF({ ...f, registroLimite: e.target.value })} /></label>}
      <label><span className="text-[10px] text-slate-500">Vence la recarga actual</span><input type="date" className={campo} value={f.vence} onChange={(e) => setF({ ...f, vence: e.target.value })} /></label>
      <label className="sm:col-span-2"><span className="text-[10px] text-slate-500">Notas</span><input className={campo} value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} /></label>
      <div className="sm:col-span-2 flex justify-end gap-2">
        <button type="button" onClick={() => setEditando(null)} className="px-3 py-1.5 rounded-lg text-slate-500 cursor-pointer">Cancelar</button>
        <button type="button" disabled={ocupado || f.numero.replace(/\D/g, '').length < 10} onClick={() => void guardar()} className="px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white font-bold disabled:opacity-50 cursor-pointer">Guardar línea</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Líneas de teléfono</div>
        {editando !== 'nueva' && <button type="button" onClick={() => abrir()} className="text-[11px] font-bold flex items-center gap-1 text-[var(--primary)] cursor-pointer"><Plus className="w-3 h-3" /> Agregar línea</button>}
      </div>
      <p className="text-[10px] text-slate-400">Claro, Altice y Viva no ofrecen una forma de consultar el saldo desde otra app: anota cada recarga y Lalan te avisa {datos.diasAviso} días antes de que venza.</p>
      {editando === 'nueva' && formulario}
      {!datos.lineas.length && editando !== 'nueva' && <p className="text-[12px] text-slate-500">No tiene líneas anotadas.</p>}

      {datos.lineas.map((l) => (
        <div key={l.id} className={`rounded-xl border p-2.5 text-[12px] space-y-1.5 ${l.activa ? 'border-slate-200 dark:border-neutral-800' : 'border-dashed border-slate-200 dark:border-neutral-800 opacity-60'}`}>
          {editando === l.id ? formulario : (<>
            <div className="flex items-center gap-2 flex-wrap">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <b className="font-mono">{telefono(l.numero)}</b>
              <span className="text-slate-500">{nombreCompania(l.compania)} · {l.prepago ? 'prepago' : 'pospago'}</span>
              <span className={`px-1.5 rounded-full text-[10px] font-bold ${l.pagaLalan ? 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300' : 'bg-slate-100 text-slate-600 dark:bg-neutral-800 dark:text-neutral-300'}`}>
                {l.pagaLalan ? 'La paga Lalan' : 'La paga el cliente'}
              </span>
              {!l.activa && <span className="text-[10px] text-slate-500">Inactiva</span>}
              <button type="button" onClick={() => abrir(l)} className="ml-auto text-slate-400 hover:text-[var(--primary)] cursor-pointer" title="Editar"><Pencil className="w-3.5 h-3.5" /></button>
            </div>
            {l.alertas.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {l.alertas.map((a) => (
                  <span key={a} className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${ALERTA[a].grave ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}`}>
                    <AlertTriangle className="w-3 h-3" /> {ALERTA[a].texto}
                  </span>
                ))}
              </div>
            )}
            <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-[11px]">
              <div><dt className="text-[10px] text-slate-400">Última recarga</dt><dd className="tabular-nums">{pesos(l.ultimaRecargaMonto)} · {fecha(l.ultimaRecargaEn)}</dd></div>
              <div><dt className="text-[10px] text-slate-400">Vence</dt><dd className="tabular-nums">{fecha(l.vence)}</dd></div>
              <div><dt className="text-[10px] text-slate-400">Titular</dt><dd className="truncate">{l.titular ?? '—'}</dd></div>
              <div><dt className="text-[10px] text-slate-400">Registro</dt>
                <dd>{l.registrada ? <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 className="w-3 h-3" /> Hecho</span> : `Pendiente${l.registroLimite ? ` · hasta ${fecha(l.registroLimite)}` : ''}`}</dd></div>
            </dl>
            {l.notas && <p className="text-[11px] text-slate-500">{l.notas}</p>}
            <div className="flex gap-3">
              {l.activa && recargando !== l.id && <button type="button" onClick={() => abrirRecarga(l)} className="flex items-center gap-1 text-[11px] font-bold text-[var(--primary)] cursor-pointer"><Wallet className="w-3 h-3" /> Anotar recarga</button>}
              <button type="button" onClick={() => void verHistorial(l.id)} className="text-[11px] text-slate-500 cursor-pointer">{historial?.id === l.id ? 'Ocultar recargas' : 'Ver recargas'}</button>
            </div>
            {recargando === l.id && (
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-4 items-end">
                <label><span className="text-[10px] text-slate-500">Monto (RD$)</span><input className={campo} inputMode="decimal" value={r.monto} onChange={(e) => setR({ ...r, monto: e.target.value.replace(/[^\d.]/g, '') })} /></label>
                <label><span className="text-[10px] text-slate-500">Fecha</span><input type="date" className={campo} value={r.fecha} onChange={(e) => setR({ ...r, fecha: e.target.value, vence: masDias(e.target.value, DIAS_RECARGA_TIPICA) })} /></label>
                <label><span className="text-[10px] text-slate-500">Activa hasta</span><input type="date" className={campo} value={r.vence} onChange={(e) => setR({ ...r, vence: e.target.value })} /></label>
                <label><span className="text-[10px] text-slate-500">Nota</span><input className={campo} value={r.nota} placeholder="Opcional" onChange={(e) => setR({ ...r, nota: e.target.value })} /></label>
                <div className="col-span-2 sm:col-span-4 flex justify-end gap-2">
                  <button type="button" onClick={() => setRecargando(null)} className="px-3 py-1.5 rounded-lg text-slate-500 cursor-pointer">Cancelar</button>
                  <button type="button" disabled={ocupado || !(Number(r.monto) >= 1) || !r.fecha} onClick={() => void anotarRecarga(l.id)} className="px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white font-bold disabled:opacity-50 cursor-pointer">Anotar</button>
                </div>
              </div>
            )}
            {historial?.id === l.id && (
              historial.lista.length ? (
                <ul className="text-[11px] divide-y divide-slate-100 dark:divide-neutral-800">
                  {historial.lista.map((x) => (
                    <li key={x.id} className="py-1 flex gap-3 tabular-nums"><span>{fecha(x.fecha)}</span><b>{pesos(x.monto)}</b><span className="text-slate-500">{x.vence ? `hasta ${fecha(x.vence)}` : ''}</span><span className="text-slate-400 truncate">{x.nota}</span></li>
                  ))}
                </ul>
              ) : <p className="text-[11px] text-slate-400">Sin recargas anotadas.</p>
            )}
          </>)}
        </div>
      ))}
    </div>
  );
};
