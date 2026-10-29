import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Loader2, Mail, ShieldCheck, Smartphone } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth, type RetoDosPasos } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { useIrAtras } from '../../hooks/useIrAtras';

const campoCodigo = 'w-full px-3.5 py-3 rounded-xl bg-slate-50 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-center text-xl font-bold tracking-[0.4em] text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]';
const soloCifras = (v: string) => v.replace(/\D/g, '').slice(0, 6);

/** Al entrar, tras la clave: el código de la app o uno por correo */
export const PasoDelCodigo: React.FC<{ reto: RetoDosPasos; onListo: () => void; onVolver: () => void }> = ({ reto, onListo, onVolver }) => {
  const { completarDosPasos } = useAuth();
  useIrAtras(onVolver);
  const [codigo, setCodigo] = useState('');
  const [porCorreo, setPorCorreo] = useState(false);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (codigo.length !== 6) return;
    setError(''); setOcupado(true);
    try { await completarDosPasos(reto.pase, codigo, porCorreo); onListo(); }
    catch (err) { setError((err as Error).message); setCodigo(''); }
    finally { setOcupado(false); }
  };
  const pedirCorreo = async () => {
    setError(''); setOcupado(true);
    try {
      const r = await api.post<{ correo: string | null }>('/auth/dos-pasos/correo', { pase: reto.pase });
      setPorCorreo(true); setCodigo('');
      setAviso(`Te mandamos un código a ${r.correo ?? 'tu correo'}. Vence en 15 minutos.`);
    } catch (err) { setError((err as Error).message); }
    finally { setOcupado(false); }
  };

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div className="p-5 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-sm space-y-3">
        <div className="w-11 h-11 rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center">
          {porCorreo ? <Mail className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
        </div>
        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white">{porCorreo ? 'El código del correo' : 'El código de tu app'}</h2>
          <p className="text-[0.8125rem] text-slate-500 dark:text-neutral-400 mt-0.5">
            {porCorreo ? aviso : 'Abre tu app de códigos (Google Authenticator, Microsoft Authenticator, 1Password…) y escribe el de Lalan.'}
          </p>
        </div>
        <input autoFocus inputMode="numeric" autoComplete="one-time-code" aria-label="Código de 6 cifras" placeholder="000000"
          value={codigo} onChange={(e) => { setCodigo(soloCifras(e.target.value)); setError(''); }} className={campoCodigo} />
        {error && <p className="text-[0.8125rem] font-semibold text-rose-600" role="alert">{error}</p>}
        <button type="submit" disabled={ocupado || codigo.length !== 6}
          className="w-full py-3 rounded-xl bg-[var(--primary)] text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer">
          {ocupado && <Loader2 className="w-4 h-4 animate-spin" />} Entrar
        </button>
      </div>
      <div className="flex flex-col items-center gap-2 text-[0.8125rem]">
        {!porCorreo && reto.correo && (
          <button type="button" onClick={() => void pedirCorreo()} disabled={ocupado} className="font-semibold text-[var(--primary)] cursor-pointer disabled:opacity-50">
            No tengo el teléfono: mándame un código a {reto.correo}
          </button>
        )}
        {porCorreo && <button type="button" onClick={() => { setPorCorreo(false); setCodigo(''); }} className="font-semibold text-[var(--primary)] cursor-pointer">Usar la app de códigos</button>}
        <button type="button" onClick={onVolver} className="text-slate-400 cursor-pointer">Volver</button>
      </div>
    </form>
  );
};

/** Escanear el QR con la app y probar el primer código */
export const ConfigurarDosPasos: React.FC<{ onListo: () => void }> = ({ onListo }) => {
  const [alta, setAlta] = useState<{ secreto: string; enlace: string; pase: string } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [codigo, setCodigo] = useState('');
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    api.post<{ secreto: string; enlace: string; pase: string }>('/auth/dos-pasos/preparar', {})
      .then((a) => { setAlta(a); return QRCode.toDataURL(a.enlace, { margin: 1, width: 220, errorCorrectionLevel: 'M' }); })
      .then(setQr)
      .catch((e) => setError((e as Error).message));
  }, []);

  const activar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!alta || codigo.length !== 6) return;
    setError(''); setOcupado(true);
    try { await api.post('/auth/dos-pasos/activar', { pase: alta.pase, codigo }); onListo(); }
    catch (err) { setError((err as Error).message); setCodigo(''); }
    finally { setOcupado(false); }
  };
  const copiar = () => {
    if (!alta) return;
    navigator.clipboard?.writeText(alta.secreto).then(() => { setCopiado(true); window.setTimeout(() => setCopiado(false), 2000); }).catch(() => undefined);
  };

  if (!alta) return error ? <p className="text-[0.8125rem] font-semibold text-rose-600" role="alert">{error}</p> : <Loader2 className="w-5 h-5 animate-spin text-slate-400" />;
  return (
    <form onSubmit={activar} className="space-y-3">
      <ol className="text-[0.8125rem] text-slate-600 dark:text-neutral-300 space-y-1 list-decimal pl-5">
        <li>Instala una app de códigos: Google Authenticator, Microsoft Authenticator o 1Password.</li>
        <li>En la app, toca «+» y escanea este código.</li>
        <li>Escribe aquí el número de 6 cifras que te muestra.</li>
      </ol>
      <div className="flex flex-col items-center gap-2">
        {qr && <img src={qr} alt="Código QR para tu app de códigos" width={180} height={180} className="rounded-xl border border-slate-200 bg-white p-1" />}
        <button type="button" onClick={copiar} className="flex items-center gap-1.5 text-[0.75rem] text-slate-500 cursor-pointer" title="Si estás en el mismo teléfono, pega esta clave en la app">
          {copiado ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          <span className="font-mono">{alta.secreto.match(/.{1,4}/g)?.join(' ')}</span>
        </button>
      </div>
      <input inputMode="numeric" autoComplete="one-time-code" aria-label="Código de 6 cifras" placeholder="000000"
        value={codigo} onChange={(e) => { setCodigo(soloCifras(e.target.value)); setError(''); }} className={campoCodigo} />
      {error && <p className="text-[0.8125rem] font-semibold text-rose-600" role="alert">{error}</p>}
      <button type="submit" disabled={ocupado || codigo.length !== 6}
        className="w-full py-3 rounded-xl bg-[var(--primary)] text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer">
        {ocupado && <Loader2 className="w-4 h-4 animate-spin" />} Activar
      </button>
    </form>
  );
};

/** Mi cuenta → Verificación en dos pasos */
export const DosPasosCuenta: React.FC = () => {
  const { showToast } = useApp();
  const [estado, setEstado] = useState<{ activa: boolean; desde: string | null; obligatoria: boolean } | null>(null);
  const [configurando, setConfigurando] = useState(false);
  const [quitando, setQuitando] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState('');
  const cargar = () => api.get<typeof estado>('/auth/dos-pasos').then(setEstado).catch(() => setEstado(null));
  useEffect(() => { void cargar(); }, []);
  if (!estado) return null;

  const quitar = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    try { setEstado(await api.post('/auth/dos-pasos/quitar', { codigo })); setQuitando(false); setCodigo(''); showToast('Listo', 'Ya no se te pedirá el código al entrar.', 'success'); }
    catch (err) { setError((err as Error).message); }
  };

  return (
    <div className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 shadow-xs space-y-3 text-slate-900 dark:text-neutral-100">
      <div className="flex items-center gap-1.5">
        <ShieldCheck className="w-4 h-4 text-[var(--primary)]" />
        <h2 className="text-xs font-bold uppercase tracking-wider">Verificación en dos pasos</h2>
      </div>
      <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 leading-relaxed">
        {estado.activa
          ? `Activa${estado.desde ? ` desde el ${new Date(estado.desde).toLocaleDateString('es-DO', { day: 'numeric', month: 'long' })}` : ''}: al entrar con tu clave, Lalan te pide el código de tu app. Si no tienes el teléfono, te lo manda al correo.`
          : 'Además de tu clave, un código de tu teléfono al entrar. Si alguien averigua tu clave, sin tu teléfono no entra.'}
        {estado.obligatoria && ' Es obligatoria para quien entra a los salones de otros.'}
      </p>
      {configurando ? (
        <ConfigurarDosPasos onListo={() => { setConfigurando(false); void cargar(); showToast('Activada', 'La próxima vez que entres te pediremos el código.', 'success'); }} />
      ) : quitando ? (
        <form onSubmit={quitar} className="space-y-2">
          <input inputMode="numeric" autoComplete="one-time-code" aria-label="Código de 6 cifras" placeholder="Código de tu app"
            value={codigo} onChange={(e) => setCodigo(soloCifras(e.target.value))} className={campoCodigo} />
          {error && <p className="text-[0.8125rem] font-semibold text-rose-600" role="alert">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={codigo.length !== 6} className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-[0.75rem] font-bold disabled:opacity-50 cursor-pointer">Quitarla</button>
            <button type="button" onClick={() => setQuitando(false)} className="px-3 py-1.5 rounded-lg text-[0.75rem] font-semibold text-slate-500 cursor-pointer">Cancelar</button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setConfigurando(true)} className="px-3 py-1.5 rounded-xl bg-[var(--primary)] text-white text-[0.75rem] font-bold cursor-pointer">
            {estado.activa ? 'Pasarla a otro teléfono' : 'Activarla'}
          </button>
          {estado.activa && !estado.obligatoria && (
            <button type="button" onClick={() => setQuitando(true)} className="px-3 py-1.5 rounded-xl text-[0.75rem] font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-pointer">Quitarla</button>
          )}
        </div>
      )}
    </div>
  );
};
