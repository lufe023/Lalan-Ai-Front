import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { AlertCircle, Eye, EyeOff, Gift, Loader2, MailCheck, MessageCircle, Sparkles } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth, type ApiUser } from '../../context/AuthContext';
import { BotonAtras } from '../ui/BotonAtras';
import { botonOferta, detalleOferta, type OfertaTexto } from '../../landing/textoOferta';

const LARGO_MINIMO = 8;
const WHATSAPP_LALAN = '18092299444';

const campo = 'w-full px-3.5 py-3 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/40 transition';
const etiqueta = 'block text-xs font-semibold text-slate-600 dark:text-neutral-400 mb-1.5';
const botonPrincipal = 'w-full py-3 rounded-xl bg-[var(--primary)] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-md hover:opacity-90 active:scale-[0.98] transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer';

interface PlanPublico { clave: string; nombre: string; oferta: OfertaTexto | null }
interface CodigoEnviado { registroId: string; correo: string; minutos: number }

/** Lo que trae la dirección cuando viene de «Crear mi cuenta» en la página */
export function registroPedido(): { plan: string | null; visita: string | null } | null {
  const q = new URLSearchParams(window.location.search);
  if (q.get('registro') !== '1') return null;
  return { plan: q.get('plan'), visita: q.get('visita') };
}

/** Quita ?registro=… de la dirección: al recargar ya no vuelve al registro */
function limpiarDireccion() {
  const q = new URLSearchParams(window.location.search);
  ['registro', 'plan', 'visita'].forEach((k) => q.delete(k));
  const resto = q.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${resto ? `?${resto}` : ''}${window.location.hash}`);
}

/**
 * «Crear mi cuenta»: la dueña registra su salón sola, sin escribirle a Lalan.
 * Sus datos, un código al correo y ya está dentro; la Bienvenida se abre sola
 * y la lleva a cargar servicios, horario y equipo.
 */
export const CrearCuenta: React.FC<{ plan?: string | null; visita?: string | null; onVolver: (correo?: string) => void }> = ({ plan, visita, onVolver }) => {
  const { entrarConSesion } = useAuth();
  const [paso, setPaso] = useState<'datos' | 'codigo'>('datos');
  const [nombre, setNombre] = useState('');
  const [salon, setSalon] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [acepto, setAcepto] = useState(false);
  const [web, setWeb] = useState('');
  const [codigo, setCodigo] = useState('');
  const [envio, setEnvio] = useState<CodigoEnviado | null>(null);
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [reenviado, setReenviado] = useState(false);
  const [elegido, setElegido] = useState<PlanPublico | null>(null);

  // El plan que tocó en la página, con su prueba gratis, para decirlo aquí
  useEffect(() => {
    if (!plan) return;
    api.get<PlanPublico[]>('/public/landing/planes')
      .then((planes) => setElegido(planes.find((p) => p.clave === plan) ?? null))
      .catch(() => undefined);
  }, [plan]);

  const correoUsado = /ya tiene cuenta/i.test(error);

  const pedir = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (nombre.trim().length < 2) { setError('Escribe tu nombre.'); return; }
    if (salon.trim().length < 2) { setError('Escribe el nombre de tu salón.'); return; }
    if (telefono.replace(/\D/g, '').length < 10) { setError('Escribe tu WhatsApp completo, con el código de área.'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo.trim())) { setError('Ese correo no parece válido. Revísalo.'); return; }
    if (clave.length < LARGO_MINIMO) { setError(`La clave debe tener al menos ${LARGO_MINIMO} caracteres.`); return; }
    if (!acepto) { setError('Para crear tu cuenta tienes que aceptar los términos.'); return; }
    setOcupado(true);
    try {
      const r = await api.post<CodigoEnviado>('/public/registro', {
        nombre: nombre.trim(), salon: salon.trim(), telefono: telefono.trim(), correo: correo.trim(), clave,
        plan: plan || undefined, visitaId: visita || undefined, aceptaTerminos: true, web: web || undefined,
      });
      setEnvio(r); setCodigo(''); setReenviado(false); setPaso('codigo');
    } catch (err) { setError((err as Error).message); } finally { setOcupado(false); }
  };

  const confirmar = async (e?: React.FormEvent) => {
    e?.preventDefault(); setError('');
    if (!envio) return;
    if (!/^\d{6}$/.test(codigo)) { setError('El código son 6 números.'); return; }
    setOcupado(true);
    try {
      const r = await api.post<{ user: ApiUser }>('/public/registro/confirmar', { registroId: envio.registroId, codigo });
      limpiarDireccion();
      entrarConSesion(r.user);
    } catch (err) { setError((err as Error).message); setOcupado(false); }
  };

  const reenviar = async () => {
    if (!envio) return;
    setError(''); setOcupado(true);
    try { setEnvio(await api.post<CodigoEnviado>('/public/registro/reenviar', { registroId: envio.registroId })); setCodigo(''); setReenviado(true); }
    catch (err) { setError((err as Error).message); } finally { setOcupado(false); }
  };

  // Con los 6 números puestos, sigue solo
  useEffect(() => { if (paso === 'codigo' && codigo.length === 6 && !ocupado) void confirmar(); }, [codigo]); // eslint-disable-line react-hooks/exhaustive-deps

  const Error = error ? (
    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} role="alert"
      className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-400 text-xs">
      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
      <div className="space-y-1.5">
        <p>{error}</p>
        {correoUsado && (
          <button type="button" onClick={() => onVolver(correo.trim())} className="font-bold underline cursor-pointer">Entrar con {correo.trim()}</button>
        )}
        {/ahora mismo no podemos|whatsapp/i.test(error) && (
          <a className="font-bold underline inline-flex items-center gap-1" target="_blank" rel="noopener"
            href={`https://wa.me/${WHATSAPP_LALAN}?text=${encodeURIComponent(`Hola, quiero crear la cuenta de ${salon.trim() || 'mi salón'} en Lalan. Soy ${nombre.trim()}, mi correo es ${correo.trim()}.`)}`}>
            <MessageCircle className="w-3.5 h-3.5" /> Escribir a Lalan por WhatsApp
          </a>
        )}
      </div>
    </motion.div>
  ) : null;

  return (
    <div className="space-y-4">
      <BotonAtras onVolver={() => (paso === 'codigo' ? (setPaso('datos'), setError('')) : onVolver())} texto={paso === 'codigo' ? 'Cambiar mis datos' : 'Ya tengo cuenta'} tono="suave" />

      {paso === 'datos' && (
        <form onSubmit={pedir} className="space-y-3.5" noValidate>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Crea la cuenta de tu salón</h2>
            <p className="text-[0.875rem] text-slate-500 dark:text-neutral-400 mt-1">En 2 minutos estás dentro. Te llega un código al correo para confirmar que es tuyo.</p>
          </div>

          {elegido && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-[var(--primary)]/10 text-[0.8125rem] text-slate-700 dark:text-neutral-200">
              <Gift className="w-4 h-4 text-[var(--primary)] shrink-0 mt-0.5" />
              <span>
                <b>{elegido.oferta ? botonOferta(elegido.oferta).replace('Pruébalo', 'Lo pruebas') : `Elegiste el ${elegido.nombre}`}</b>
                {/* Sin prueba gratis publicada arranca en el Plan Gratis (lo mismo que hace el servidor) */}
                <span className="block text-slate-500 dark:text-neutral-400">
                  {elegido.oferta ? detalleOferta(elegido.oferta) : `Empiezas en el Plan Gratis y te pasas al ${elegido.nombre} cuando quieras.`}
                </span>
              </span>
            </div>
          )}

          <div>
            <label htmlFor="r-nombre" className={etiqueta}>Tu nombre</label>
            <input id="r-nombre" value={nombre} onChange={(e) => { setNombre(e.target.value); setError(''); }} placeholder="Ej.: Alanny Pérez" autoComplete="name" maxLength={80} className={campo} />
          </div>
          <div>
            <label htmlFor="r-salon" className={etiqueta}>Nombre de tu salón</label>
            <input id="r-salon" value={salon} onChange={(e) => { setSalon(e.target.value); setError(''); }} placeholder="Ej.: Glam Studio" autoComplete="organization" maxLength={100} className={campo} />
          </div>
          <div>
            <label htmlFor="r-telefono" className={etiqueta}>Tu WhatsApp</label>
            <input id="r-telefono" type="tel" inputMode="tel" value={telefono} onChange={(e) => { setTelefono(e.target.value); setError(''); }} placeholder="809 555 1234" autoComplete="tel" maxLength={24} className={campo} />
          </div>
          <div>
            <label htmlFor="r-correo" className={etiqueta}>Tu correo</label>
            <input id="r-correo" type="email" inputMode="email" value={correo} onChange={(e) => { setCorreo(e.target.value); setError(''); }} placeholder="tu@correo.com" autoComplete="email" autoCapitalize="none" spellCheck={false} maxLength={120} className={campo} />
          </div>
          <div>
            <label htmlFor="r-clave" className={etiqueta}>Una clave para entrar</label>
            <div className="relative">
              <input id="r-clave" type={verClave ? 'text' : 'password'} value={clave} onChange={(e) => { setClave(e.target.value); setError(''); }} placeholder={`Mínimo ${LARGO_MINIMO} caracteres`} autoComplete="new-password" maxLength={100} className={`${campo} pr-11`} />
              <button type="button" onClick={() => setVerClave((v) => !v)} aria-label={verClave ? 'Ocultar la clave' : 'Ver la clave'}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-neutral-200 cursor-pointer">
                {verClave ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          {/* Trampa para robots: una persona no la ve */}
          <div aria-hidden="true" className="absolute -left-[9999px] w-px h-px overflow-hidden">
            <label htmlFor="r-web">No llenar</label>
            <input id="r-web" tabIndex={-1} autoComplete="off" value={web} onChange={(e) => setWeb(e.target.value)} />
          </div>
          <label className="flex items-start gap-2.5 text-[0.8125rem] text-slate-600 dark:text-neutral-300 cursor-pointer">
            <input type="checkbox" checked={acepto} onChange={(e) => { setAcepto(e.target.checked); setError(''); }} className="mt-0.5 w-5 h-5 shrink-0 accent-[var(--primary)]" />
            <span>Acepto los <a href="/terminos.html" target="_blank" rel="noopener" className="underline">términos</a>, las <a href="/condiciones-planes.html" target="_blank" rel="noopener" className="underline">condiciones de los planes</a> y la <a href="/privacidad.html" target="_blank" rel="noopener" className="underline">política de privacidad</a>.</span>
          </label>
          {Error}
          <button type="submit" disabled={ocupado} className={botonPrincipal}>
            {ocupado ? <><Loader2 className="w-4 h-4 animate-spin" /> Enviando el código…</> : <><Sparkles className="w-4 h-4" /> Crear mi cuenta</>}
          </button>
          <p className="text-center text-[0.8125rem] text-slate-500 dark:text-neutral-400">
            ¿Prefieres que te la instalemos? <a href={`https://wa.me/${WHATSAPP_LALAN}?text=${encodeURIComponent('Hola, quiero que me instalen Lalan en mi salón.')}`} target="_blank" rel="noopener" className="font-semibold text-[var(--primary)] hover:underline">Escríbenos</a>
          </p>
        </form>
      )}

      {paso === 'codigo' && envio && (
        <form onSubmit={confirmar} className="space-y-3">
          <div className="flex items-center gap-2 text-[var(--primary)]"><MailCheck className="w-5 h-5" /><h2 className="text-lg font-bold text-slate-900 dark:text-white">Revisa tu correo</h2></div>
          <p className="text-[0.875rem] text-slate-500 dark:text-neutral-400">
            {reenviado ? 'Te mandamos otro código' : 'Te mandamos un código de 6 números'} a <b className="text-slate-700 dark:text-neutral-200">{envio.correo}</b>. Vence en {envio.minutos} minutos; mira también en correo no deseado.
          </p>
          <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus value={codigo} aria-label="Código de 6 números"
            onChange={(e) => { setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }} placeholder="000000"
            className={`${campo} text-center text-xl tracking-[.4em] font-bold`} />
          {Error}
          <button type="submit" disabled={ocupado} className={botonPrincipal}>
            {ocupado ? <><Loader2 className="w-4 h-4 animate-spin" /> Creando tu salón…</> : 'Entrar a mi salón'}
          </button>
          <button type="button" onClick={() => void reenviar()} disabled={ocupado} className="w-full text-[0.8125rem] text-slate-500 hover:text-[var(--primary)] cursor-pointer disabled:opacity-60">No me llegó: enviar otro código</button>
        </form>
      )}
    </div>
  );
};
