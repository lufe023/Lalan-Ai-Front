import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Eye, EyeOff, KeyRound, Loader2, Pencil } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { horaDe } from '../../utils/hora';

interface CanalFila {
  locationId: string; sede: string; channel: 'whatsapp' | 'instagram' | 'messenger'; nombre: string;
  identificador: string | null; cuentaMeta: string | null; tieneToken: boolean; encendido: boolean;
  /** id de la fila (null si el canal nunca se conectó) */
  id: string | null;
  /** Hay PIN de dos pasos guardado (solo WhatsApp; se mira con "Ver") */
  tienePin: boolean;
  conexion: string | null; conectadoEn: string | null; conectadoPor: string | null;
}
interface Vista { id: string; canal: string; que: 'token' | 'pin'; email: string; creadoEn: string }
type Respuesta = { canales: CanalFila[]; vistas: Vista[] };
/** Segundos que un secreto queda a la vista antes de volver a ocultarse */
const SEGUNDOS_VISIBLE = 30;
const QUE: Record<Vista['que'], string> = { token: 'el token', pin: 'el PIN' };
const NOMBRE_CANAL: Record<string, string> = { whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger' };
const COMO: Record<string, string> = { boton_meta: 'con el botón de Meta', manual: 'a mano' };
const AYUDA: Record<string, { id: string; cuenta: string }> = {
  whatsapp: { id: 'Phone number ID', cuenta: 'WABA ID (cuenta de WhatsApp Business)' },
  instagram: { id: 'ID de la cuenta profesional de Instagram', cuenta: 'ID de la página de Facebook vinculada' },
  messenger: { id: 'ID de la página de Facebook', cuenta: 'ID de la página (el mismo)' },
};
const campo = 'w-full px-2.5 py-2 rounded-lg bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-[12px] font-mono';

/**
 * Conectar o corregir un canal a mano, cuando el cliente no puede usar el
 * botón. El token se escribe pero nunca se vuelve a mostrar.
 */
export const EditorCanales: React.FC<{ negocioId: string; alGuardar?: () => void }> = ({ negocioId, alGuardar }) => {
  const { showToast } = useApp();
  const [filas, setFilas] = useState<CanalFila[] | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [f, setF] = useState({ identificador: '', cuentaMeta: '', token: '', quitarToken: false, encendido: true });
  const [guardando, setGuardando] = useState(false);
  const { currentUser } = useAuth();
  const esSuperAdmin = currentUser?.role === 'super_admin';
  const [vistas, setVistas] = useState<Vista[]>([]);
  /** El secreto que se está mirando: se oculta solo a los 30 segundos */
  const [visible, setVisible] = useState<{ clave: string; valor: string } | null>(null);
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => setVisible(null), SEGUNDOS_VISIBLE * 1000);
    return () => clearTimeout(t);
  }, [visible]);

  const cargar = useCallback(async () => {
    try { const r = await api.get<Respuesta>(`/plataforma/negocios/${negocioId}/canales`); setFilas(r.canales); setVistas(r.vistas ?? []); }
    catch { setFilas([]); }
  }, [negocioId]);
  useEffect(() => { void cargar(); }, [cargar]);

  const ver = async (c: CanalFila, que: Vista['que']) => {
    const clave = `${c.id}:${que}`;
    if (visible?.clave === clave) { setVisible(null); return; }
    try {
      const r = await api.post<{ valor: string }>(`/plataforma/negocios/${negocioId}/canales/${c.id}/ver`, { que });
      setVisible({ clave, valor: r.valor });
      void cargar();
    } catch (e) { showToast('No se pudo mostrar', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning'); }
  };
  const copiar = (valor: string, que: Vista['que']) => {
    void navigator.clipboard.writeText(valor);
    showToast(que === 'pin' ? 'PIN copiado' : 'Token copiado', que === 'pin' ? 'Dáselo solo a este cliente si se muda de proveedor.' : 'No lo pegues en chats ni correos.', 'success');
  };
  /** Un secreto oculto, con "Ver" (solo super admin, queda anotado) y "Copiar" mientras se ve */
  const secreto = (c: CanalFila, que: Vista['que']) => {
    const abierto = visible?.clave === `${c.id}:${que}` ? visible.valor : null;
    return (<>
      <b className={`font-mono ${que === 'pin' ? 'tracking-widest' : 'break-all'} ${abierto && que === 'token' ? 'text-[10px] font-normal' : ''}`}>{abierto ?? (que === 'pin' ? '••••••' : '••••••••')}</b>
      {esSuperAdmin && (
        <button type="button" title={abierto ? 'Ocultar' : 'Ver (queda anotado)'} onClick={() => void ver(c, que)} className="p-0.5 text-slate-400 hover:text-[var(--primary)] cursor-pointer shrink-0">
          {abierto ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>
      )}
      {abierto && (
        <button type="button" title="Copiar" onClick={() => copiar(abierto, que)} className="p-0.5 text-slate-400 hover:text-[var(--primary)] cursor-pointer shrink-0"><Copy className="w-3.5 h-3.5" /></button>
      )}
    </>);
  };

  const clave = (c: CanalFila) => `${c.locationId}:${c.channel}`;
  const abrir = (c: CanalFila) => {
    setAbierto(clave(c));
    setF({ identificador: c.identificador ?? '', cuentaMeta: c.cuentaMeta ?? '', token: '', quitarToken: false, encendido: c.encendido || !c.identificador });
  };
  const guardar = async (c: CanalFila) => {
    setGuardando(true);
    try {
      const r = await api.put<Respuesta>(`/plataforma/negocios/${negocioId}/canales`, {
        locationId: c.locationId, channel: c.channel, identificador: f.identificador, cuentaMeta: f.cuentaMeta,
        ...(f.token.trim() ? { token: f.token.trim() } : {}), ...(f.quitarToken ? { quitarToken: true } : {}), encendido: f.encendido,
      });
      setFilas(r.canales); setVistas(r.vistas ?? []); setAbierto(null); alGuardar?.();
      showToast('Canal guardado', `${c.nombre} de ${c.sede} quedó actualizado.`, 'success');
    } catch (e) {
      showToast('No se pudo guardar', (e as Error)?.message || 'Revisa los datos.', 'warning');
    } finally { setGuardando(false); }
  };

  if (!filas) return <div className="flex items-center gap-2 text-[12px] text-slate-500"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando canales…</div>;
  const variasSedes = new Set(filas.map((x) => x.locationId)).size > 1;

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Editor de canales</div>
      {filas.map((c) => {
        const k = clave(c);
        return (
          <div key={k} className="rounded-xl border border-slate-200 dark:border-neutral-800 p-2.5 text-[12px]">
            <div className="flex items-center gap-2">
              <b>{c.nombre}</b>{variasSedes && <span className="text-slate-500">· {c.sede}</span>}
              <span className="text-slate-500 font-mono truncate">{c.identificador ?? 'sin conectar'}</span>
              {c.tieneToken && <span title="Tiene token guardado" className="flex items-center gap-0.5 text-[10px] text-emerald-600"><KeyRound className="w-3 h-3" /> token</span>}
              {abierto !== k && (
                <button type="button" onClick={() => abrir(c)} className="ml-auto flex items-center gap-1 text-[11px] font-bold text-[var(--primary)] cursor-pointer">
                  <Pencil className="w-3 h-3" /> {c.identificador ? 'Editar' : 'Conectar'}
                </button>
              )}
            </div>
            {c.conectadoEn && abierto !== k && (
              <p className="text-[10px] text-slate-400 mt-0.5">
                Conectado {COMO[c.conexion ?? ''] ?? ''} el {new Date(c.conectadoEn).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' })}{c.conectadoPor ? ` por ${c.conectadoPor}` : ''}
              </p>
            )}
            {c.channel === 'whatsapp' && c.identificador && (
              <div className="mt-1 flex items-center gap-1.5 text-[11px]">
                <span className="text-slate-500">PIN de dos pasos:</span>
                {c.tienePin ? secreto(c, 'pin') : (
                  <span className="text-slate-400">sin PIN guardado (número en coexistencia, conectado a mano o sin registrar)</span>
                )}
              </div>
            )}
            {c.tieneToken && c.id && esSuperAdmin && abierto !== k && (
              <div className="mt-1 flex items-start gap-1.5 text-[11px]">
                <span className="text-slate-500 shrink-0">Token:</span>
                {secreto(c, 'token')}
              </div>
            )}
            {abierto === k && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="block"><span className="text-[10px] text-slate-500">{AYUDA[c.channel].id}</span>
                  <input className={campo} inputMode="numeric" value={f.identificador} onChange={(e) => setF({ ...f, identificador: e.target.value })} /></label>
                <label className="block"><span className="text-[10px] text-slate-500">{AYUDA[c.channel].cuenta}</span>
                  <input className={campo} inputMode="numeric" value={f.cuentaMeta} onChange={(e) => setF({ ...f, cuentaMeta: e.target.value })} /></label>
                <label className="block sm:col-span-2"><span className="text-[10px] text-slate-500">Token de acceso {c.tieneToken ? '(ya hay uno guardado; escribe solo para reemplazarlo)' : ''}</span>
                  <input className={campo} type="password" autoComplete="off" value={f.token} placeholder={c.tieneToken ? '•••••••• guardado' : 'Pega el token'}
                    onChange={(e) => setF({ ...f, token: e.target.value, quitarToken: false })} /></label>
                <div className="sm:col-span-2 flex flex-wrap items-center gap-4 text-[11px]">
                  <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.encendido} onChange={(e) => setF({ ...f, encendido: e.target.checked })} /> Lalan contesta aquí</label>
                  {c.tieneToken && <label className="flex items-center gap-1.5 text-rose-600"><input type="checkbox" checked={f.quitarToken} onChange={(e) => setF({ ...f, quitarToken: e.target.checked, token: '' })} /> Borrar el token</label>}
                  <span className="ml-auto flex gap-2">
                    <button type="button" onClick={() => setAbierto(null)} className="px-3 py-1.5 rounded-lg text-slate-500 cursor-pointer">Cancelar</button>
                    <button type="button" disabled={guardando} onClick={() => void guardar(c)} className="px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white font-bold disabled:opacity-50 cursor-pointer">
                      {guardando ? 'Guardando…' : 'Guardar'}
                    </button>
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {vistas.length > 0 && (
        <details className="text-[11px]">
          <summary className="cursor-pointer text-slate-500">Quién ha visto secretos de este cliente</summary>
          <ul className="mt-1 space-y-0.5">
            {vistas.map((v) => (
              <li key={v.id} className="text-slate-500">
                {new Date(v.creadoEn).toLocaleDateString('es-DO', { day: 'numeric', month: 'short' })}, {horaDe(v.creadoEn)} · {v.email} vio {QUE[v.que]} de {NOMBRE_CANAL[v.canal] ?? v.canal}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
};
