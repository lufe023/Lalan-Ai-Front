import React, { useEffect, useState } from 'react';
import { Check, ExternalLink, Loader2, Mail, RefreshCw, TriangleAlert } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useConfirmar } from '../ui/ModalConfirmar';
import { comprasApi, type CorreoCompras } from '../../services/compras';
import { botonPrincipal, botonSuave, campo, etiqueta, fechaHora } from './piezas';

/** Los correos que ya sabemos dónde leer; los demás escriben su servidor */
const CONOCIDOS = ['gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.es', 'ymail.com', 'icloud.com', 'me.com', 'mac.com', 'zoho.com', 'zohomail.com'];
const dominio = (c: string) => c.split('@')[1]?.trim().toLowerCase() ?? '';

/**
 * El correo del salón para compras, como en Odoo cada quien pone el suyo.
 * Los pedidos salen con el nombre del salón y la respuesta le llega a este
 * correo; Lalan lo lee para ver qué contestan los proveedores.
 */
export const CorreoDeCompras: React.FC = () => {
  const { showToast } = useApp();
  const { confirmar, modalConfirmar } = useConfirmar();
  const [estado, setEstado] = useState<CorreoCompras | null>(null);
  const [editando, setEditando] = useState(false);
  const [f, setF] = useState({ correo: '', nombre: '', clave: '', imapHost: '', imapPuerto: '993' });
  const [ocupado, setOcupado] = useState<'guardar' | 'revisar' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { comprasApi.correo().then(setEstado).catch(() => setEstado({ conectado: false })); }, []);

  const abrir = () => {
    setError(null);
    setF(estado?.conectado
      ? { correo: estado.correo, nombre: estado.nombre ?? '', clave: '', imapHost: CONOCIDOS.includes(dominio(estado.correo)) ? '' : estado.imapHost, imapPuerto: String(estado.imapPuerto) }
      : { correo: '', nombre: '', clave: '', imapHost: '', imapPuerto: '993' });
    setEditando(true);
  };
  const esGmail = ['gmail.com', 'googlemail.com'].includes(dominio(f.correo));
  const pideServidor = !!dominio(f.correo) && !CONOCIDOS.includes(dominio(f.correo));

  const guardar = async () => {
    setOcupado('guardar'); setError(null);
    try {
      const r = await comprasApi.conectarCorreo({
        correo: f.correo.trim(), nombre: f.nombre.trim() || undefined, clave: f.clave || undefined,
        imapHost: f.imapHost.trim() || undefined, imapPuerto: Number(f.imapPuerto) || undefined,
      });
      setEstado(r); setEditando(false);
      showToast('Correo conectado', 'Lalan ya lee lo que te contestan los proveedores.', 'success');
    } catch (e) { setError((e as Error).message); }
    finally { setOcupado(null); }
  };
  const revisar = async () => {
    setOcupado('revisar');
    try { setEstado(await comprasApi.revisarCorreo()); } catch (e) { showToast('No se pudo revisar', (e as Error).message, 'warning'); }
    finally { setOcupado(null); }
  };
  const quitar = async () => {
    if (!(await confirmar({ titulo: '¿Desconectar tu correo?', mensaje: 'Lalan deja de leer lo que contestan los proveedores por correo. Las respuestas te seguirán llegando a tu correo.', tono: 'peligro', textoConfirmar: 'Desconectar' }))) return;
    try { setEstado(await comprasApi.quitarCorreo()); } catch (e) { showToast('No se pudo', (e as Error).message, 'warning'); }
  };

  if (!estado) return null;

  return (
    <div className="p-3 rounded-2xl border border-slate-200 dark:border-neutral-700 space-y-2.5">
      {modalConfirmar}
      <div className="flex items-start gap-3">
        <span className="grid place-items-center size-8 rounded-xl shrink-0 bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"><Mail className="w-4 h-4" /></span>
        <span className="flex-1 min-w-0">
          <span className="block font-bold text-[0.8125rem] text-slate-900 dark:text-white">Tu correo para compras</span>
          {estado.conectado ? (
            <span className="block text-[0.75rem] text-slate-500 dark:text-neutral-400 break-all">
              {estado.correo} · {estado.error ? 'no se pudo leer' : estado.revisadoEn ? `revisado ${fechaHora(estado.revisadoEn)}` : 'conectado'}
            </span>
          ) : (
            <span className="block text-[0.75rem] text-slate-500 dark:text-neutral-400">Los pedidos salen con el nombre de tu salón y la respuesta del proveedor te llega a tu correo. Si lo conectas, Lalan la lee y la pone en el pedido.</span>
          )}
        </span>
      </div>

      {estado.conectado && estado.error && !editando && (
        <p className="flex gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-[0.75rem] text-amber-800 dark:text-amber-200"><TriangleAlert className="w-4 h-4 shrink-0" /> {estado.error}</p>
      )}

      {!editando && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={abrir} className={estado.conectado && !estado.error ? botonSuave : botonPrincipal}>{estado.conectado ? (estado.error ? 'Arreglar' : 'Cambiar') : 'Conectar mi correo'}</button>
          {estado.conectado && <button type="button" disabled={!!ocupado} onClick={() => void revisar()} className={botonSuave}>{ocupado === 'revisar' ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Revisar ahora</button>}
          {estado.conectado && <button type="button" onClick={() => void quitar()} className={`${botonSuave} hover:!border-rose-300 hover:text-rose-600`}>Desconectar</button>}
        </div>
      )}

      {editando && (
        <div className="space-y-2.5">
          <label className="block"><span className={etiqueta}>Correo</span>
            <input className={campo} type="email" autoComplete="email" placeholder="compras.misalon@gmail.com" value={f.correo} onChange={(e) => setF({ ...f, correo: e.target.value })} /></label>
          <label className="block"><span className={etiqueta}>Nombre con que sale (opcional)</span>
            <input className={campo} placeholder="El nombre de tu salón" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></label>
          {esGmail && (
            <ol className="p-2.5 rounded-xl bg-slate-50 dark:bg-neutral-800/60 text-[0.75rem] text-slate-600 dark:text-neutral-300 space-y-1 list-decimal pl-6">
              <li>Activa la <a className="font-bold text-[var(--primary)] inline-flex items-center gap-0.5" href="https://myaccount.google.com/signinoptions/twosv" target="_blank" rel="noreferrer">verificación en 2 pasos <ExternalLink className="w-3 h-3" /></a> de tu Gmail.</li>
              <li>Crea una <a className="font-bold text-[var(--primary)] inline-flex items-center gap-0.5" href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">contraseña de aplicación <ExternalLink className="w-3 h-3" /></a> con el nombre «Lalan».</li>
              <li>Copia las 16 letras que te da Google y pégalas aquí.</li>
            </ol>
          )}
          <label className="block"><span className={etiqueta}>{esGmail ? 'Contraseña de aplicación (16 letras)' : 'Contraseña (de aplicación, si tu correo la pide)'}</span>
            <input className={campo} type="password" autoComplete="new-password" placeholder={estado.conectado ? 'Déjala vacía para no cambiarla' : ''} value={f.clave} onChange={(e) => setF({ ...f, clave: e.target.value })} /></label>
          {pideServidor && (
            <div className="grid grid-cols-[1fr_6rem] gap-2">
              <label className="block"><span className={etiqueta}>Servidor de entrada (IMAP)</span>
                <input className={campo} placeholder="imap.tucorreo.com" value={f.imapHost} onChange={(e) => setF({ ...f, imapHost: e.target.value })} /></label>
              <label className="block"><span className={etiqueta}>Puerto</span>
                <input className={campo} inputMode="numeric" value={f.imapPuerto} onChange={(e) => setF({ ...f, imapPuerto: e.target.value.replace(/\D/g, '') })} /></label>
            </div>
          )}
          <p className="text-[0.6875rem] text-slate-500">Lalan solo lee los correos de tus proveedores, no marca nada como leído y guarda la contraseña cifrada.</p>
          {error && <p className="flex gap-2 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-[0.75rem] text-rose-700 dark:text-rose-300"><TriangleAlert className="w-4 h-4 shrink-0" /> {error}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={!!ocupado || !f.correo.trim() || (!f.clave && !estado.conectado)} onClick={() => void guardar()} className={`${botonPrincipal} flex-1`}>
              {ocupado === 'guardar' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Probar y conectar
            </button>
            <button type="button" onClick={() => setEditando(false)} className={botonSuave}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
};
