import React, { useCallback, useEffect, useState } from 'react';
import { Copy, Eye, EyeOff, KeyRound, Loader2, Pencil } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';

interface CanalFila {
  locationId: string; sede: string; channel: 'whatsapp' | 'instagram' | 'messenger'; nombre: string;
  identificador: string | null; cuentaMeta: string | null; tieneToken: boolean; encendido: boolean;
  /** PIN de dos pasos del número (solo WhatsApp, solo lectura) */
  pin: string | null;
  conexion: string | null; conectadoEn: string | null; conectadoPor: string | null;
}
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
  const [pinVisible, setPinVisible] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try { setFilas((await api.get<{ canales: CanalFila[] }>(`/plataforma/negocios/${negocioId}/canales`)).canales); }
    catch { setFilas([]); }
  }, [negocioId]);
  useEffect(() => { void cargar(); }, [cargar]);

  const clave = (c: CanalFila) => `${c.locationId}:${c.channel}`;
  const abrir = (c: CanalFila) => {
    setAbierto(clave(c));
    setF({ identificador: c.identificador ?? '', cuentaMeta: c.cuentaMeta ?? '', token: '', quitarToken: false, encendido: c.encendido || !c.identificador });
  };
  const guardar = async (c: CanalFila) => {
    setGuardando(true);
    try {
      const r = await api.put<{ canales: CanalFila[] }>(`/plataforma/negocios/${negocioId}/canales`, {
        locationId: c.locationId, channel: c.channel, identificador: f.identificador, cuentaMeta: f.cuentaMeta,
        ...(f.token.trim() ? { token: f.token.trim() } : {}), ...(f.quitarToken ? { quitarToken: true } : {}), encendido: f.encendido,
      });
      setFilas(r.canales); setAbierto(null); alGuardar?.();
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
                {c.pin ? (<>
                  <b className="font-mono tracking-widest">{pinVisible === k ? c.pin : '••••••'}</b>
                  <button type="button" title={pinVisible === k ? 'Ocultar' : 'Ver'} onClick={() => setPinVisible(pinVisible === k ? null : k)} className="p-0.5 text-slate-400 hover:text-[var(--primary)] cursor-pointer">
                    {pinVisible === k ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button type="button" title="Copiar" onClick={() => { void navigator.clipboard.writeText(c.pin!); showToast('PIN copiado', 'Dáselo solo a este cliente si se muda de proveedor.', 'success'); }} className="p-0.5 text-slate-400 hover:text-[var(--primary)] cursor-pointer">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </>) : (
                  <span className="text-slate-400">sin PIN guardado (número en coexistencia, conectado a mano o sin registrar)</span>
                )}
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
    </div>
  );
};
