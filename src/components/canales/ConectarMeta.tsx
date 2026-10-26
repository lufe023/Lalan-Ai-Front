import React, { useEffect, useState } from 'react';
import { Check, Facebook, Instagram, Loader2, MessageCircle, Unplug } from 'lucide-react';
import { api } from '../../services/api';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useSedeActiva } from '../../context/SedeActivaContext';
import { IOSModal } from '../ui/IOSModal';
import { abrirLoginPaginas, abrirRegistroWhatsapp, type ConfigMeta } from '../../utils/metaSdk';
import { conectarSoloInstagram } from '../../utils/instagramLogin';
import { irAFacebook, irAWhatsapp, necesitaRedireccion, tomarNumeros, tomarPendientes, type NumerosPendientes, type ResultadoWhatsapp } from '../../utils/facebookLogin';
import type { CommunicationChannel } from '../../types';
import { sedeDeLaGuia } from '../guias/GuiaEnCurso';

/** Si Lalan trajo a la persona con "Llévame" para una sede, esa sede ya viene elegida */
const sedeGuia = (sedes: Sede[]) => {
  const id = sedeDeLaGuia();
  return id && sedes.some((s) => s.id === id) ? id : null;
};

/** Lo que llega de cada página (nunca su token). Foto, seguidores y negocio sirven para reconocer la correcta */
interface Pagina { id: string; nombre: string; instagram: string | null; foto?: string | null; seguidores?: number | null; negocio?: string | null }
interface Sede { id: string; name: string }

const BOTONES: { canal: CommunicationChannel; texto: string; Icono: React.FC<{ className?: string }>; color: string }[] = [
  { canal: 'whatsapp', texto: 'Conectar WhatsApp', Icono: MessageCircle, color: 'bg-[#25D366] text-white' },
  { canal: 'instagram', texto: 'Conectar Instagram', Icono: Instagram, color: 'bg-gradient-to-br from-[#833AB4] via-[#E1306C] to-[#F77737] text-white' },
  { canal: 'messenger', texto: 'Conectar Facebook', Icono: Facebook, color: 'bg-[#1877F2] text-white' },
];
/** Para qué sirve cada variable de Meta del servidor (lo ve solo el equipo de Lalan) */
const PARA_QUE_SIRVE: Record<string, string> = {
  META_APP_ID: 'ID de la app Lalan AI',
  META_APP_SECRET: 'clave secreta de la app',
  META_ES_CONFIG_ID: 'sin esto no funciona Conectar WhatsApp',
  META_LOGIN_CONFIG_ID: 'configuración de Inicio de sesión para empresas, para Facebook e Instagram',
  INSTAGRAM_APP_ID: 'ID de la app de Instagram, para Conectar solo Instagram',
  INSTAGRAM_APP_SECRET: 'clave de la app de Instagram, para Conectar solo Instagram',
};
const NOMBRE: Record<CommunicationChannel, string> = { whatsapp: 'WhatsApp', instagram: 'Instagram', messenger: 'Messenger' };

/**
 * Los tres botones de Meta. La dueña toca, acepta en la ventana de Meta y
 * listo: Lalan queda recibiendo sus mensajes. Nada de copiar números raros.
 */
export const ConectarMeta: React.FC<{ incrustado?: boolean }> = ({ incrustado }) => {
  const { botConfigs, recargarBots, showToast } = useApp();
  const { currentUser } = useAuth();
  // Con una sede activa elegida arriba, se conecta a esa: el servidor trabaja en ella
  const { actual } = useSedeActiva();
  const [cfg, setCfg] = useState<ConfigMeta | null>(null);
  const [sedes, setSedes] = useState<Sede[]>([]);
  const [sede, setSede] = useState<string>('');
  const [ocupado, setOcupado] = useState<CommunicationChannel | null>(null);
  const [preguntaWa, setPreguntaWa] = useState(false);
  const [elegir, setElegir] = useState<{ token: string; paginas: Pagina[]; canal: CommunicationChannel } | null>(null);
  const [numeros, setNumeros] = useState<NumerosPendientes | null>(null);
  /** Los canales conectados de la sede elegida (no los de la sede que muestra el panel) */
  const [deLaSede, setDeLaSede] = useState<{ channel: CommunicationChannel; channelIdentifier: string | null }[] | null>(null);

  useEffect(() => {
    api.get<ConfigMeta>('/bots/conexion/configuracion').then(setCfg).catch(() => setCfg(null));
    // Si se volvió de Meta (app instalada / teléfono), sus páginas o sus números esperan aquí para elegir
    const pendientes = tomarPendientes();
    const nums = tomarNumeros();
    api.get<Sede[]>('/users/sedes').then((s) => {
      setSedes(s);
      setSede(pendientes?.locationId ?? nums?.locationId ?? sedeGuia(s) ?? actual?.id ?? s[0]?.id ?? '');
    }).catch(() => undefined);
    if (pendientes) {
      setElegir({ token: pendientes.tokenUsuario, paginas: pendientes.paginas, canal: pendientes.canal });
    }
    if (nums) setNumeros(nums);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // La sede activa manda: si se cambia arriba, aquí también
  useEffect(() => { if (actual) setSede(actual.id); }, [actual]);

  useEffect(() => {
    if (!sede) { setDeLaSede(null); return; }
    api.get<{ channel: CommunicationChannel; channelIdentifier: string | null }[]>(`/bots?sede=${encodeURIComponent(sede)}`)
      .then(setDeLaSede).catch(() => setDeLaSede(null));
  }, [sede, botConfigs]);

  const conectado = (c: CommunicationChannel) => deLaSede
    ? deLaSede.some((b) => b.channel === c && b.channelIdentifier)
    : botConfigs.some((b) => b.id === c && b.channelIdentifier);
  const fallo = (e: unknown) => showToast('No se pudo conectar', (e as Error)?.message || 'Inténtalo de nuevo.', 'warning');

  const listoWhatsapp = async (res: ResultadoWhatsapp) => {
    if (res.elegir) { setNumeros({ canal: 'whatsapp', locationId: res.locationId, ...res.elegir }); return; }
    setNumeros(null);
    await recargarBots();
    showToast('WhatsApp conectado', res.avisos[0] ?? `Lalan ya recibe los mensajes${res.numero ? ` de ${res.numero}` : ''}.`, res.avisos.length ? 'warning' : 'success');
  };

  const whatsapp = async (coexistencia: boolean) => {
    if (!cfg) return;
    setPreguntaWa(false);
    setOcupado('whatsapp');
    // En la app instalada o el teléfono la ventanita de Meta no existe o no vuelve: se va a Meta en esta pestaña
    if (necesitaRedireccion()) {
      try { await irAWhatsapp(coexistencia, sede || undefined); } catch (e) { fallo(e); setOcupado(null); }
      return;
    }
    try {
      const r = await abrirRegistroWhatsapp(cfg, coexistencia);
      await listoWhatsapp(await api.post<ResultadoWhatsapp>('/bots/conexion/whatsapp', { ...r, locationId: sede || undefined }));
    } catch (e) { fallo(e); } finally { setOcupado(null); }
  };

  const usarNumero = async (id: string) => {
    if (!numeros) return;
    setOcupado('whatsapp');
    try {
      await listoWhatsapp(await api.post<ResultadoWhatsapp>('/bots/conexion/whatsapp/numero', { pendiente: numeros.pendiente, phoneNumberId: id }));
    } catch (e) { fallo(e); } finally { setOcupado(null); }
  };

  const paginas = async (canal: CommunicationChannel) => {
    if (!cfg) return;
    setOcupado(canal);
    // En la app instalada o el teléfono, la ventanita de Facebook no vuelve: se va a Facebook en esta pestaña
    if (necesitaRedireccion()) {
      try { await irAFacebook(canal, sede || undefined); } catch (e) { fallo(e); setOcupado(null); }
      return;
    }
    try {
      const token = await abrirLoginPaginas(cfg);
      const lista = await api.post<Pagina[]>('/bots/conexion/paginas', { tokenUsuario: token });
      if (!lista.length) throw new Error('Tu usuario de Facebook no administra ninguna página, o no la marcaste en la ventana de Meta.');
      setElegir({ token, paginas: lista, canal });
    } catch (e) { fallo(e); } finally { setOcupado(null); }
  };

  const usarPagina = async (p: Pagina) => {
    if (!elegir) return;
    setOcupado(elegir.canal);
    try {
      await api.post('/bots/conexion/pagina', {
        tokenUsuario: elegir.token, paginaId: p.id, locationId: sede || undefined,
        messenger: true, instagram: false,
      });
      setElegir(null);
      await recargarBots();
      showToast('Cuenta conectada', `Lalan ya recibe los mensajes de ${p.nombre}.`, 'success');
    } catch (e) { fallo(e); } finally { setOcupado(null); }
  };

  /** Instagram sin Facebook: entra con su usuario de Instagram */
  const soloInstagram = async () => {
    setOcupado('instagram');
    try {
      const cuenta = await conectarSoloInstagram(sede || undefined);
      if (cuenta === null) return; // se fue a Instagram en esta misma pestaña; al volver lo termina RetornoInstagram
      await recargarBots();
      showToast('Instagram conectado', `Lalan ya recibe los mensajes de ${cuenta}.`, 'success');
    } catch (e) { fallo(e); } finally { setOcupado(null); }
  };

  const desconectar = async (c: CommunicationChannel) => {
    if (!window.confirm(`¿Desconectar ${NOMBRE[c]}? Lalan dejará de recibir y contestar esos mensajes.`)) return;
    setOcupado(c);
    try {
      await api.delete(`/bots/conexion/${c}${sede ? `?sede=${sede}` : ''}`);
      await recargarBots();
      showToast(`${NOMBRE[c]} desconectado`, 'Puedes volver a conectarlo cuando quieras.', 'success');
    } catch (e) { fallo(e); } finally { setOcupado(null); }
  };

  const disponible = (c: CommunicationChannel) =>
    c === 'whatsapp' ? cfg?.whatsapp : c === 'instagram' ? cfg?.soloInstagram : cfg?.paginas;
  /** Instagram entra con su propio usuario, sin Facebook; Facebook conecta solo Messenger */
  const abrir = (c: CommunicationChannel) =>
    c === 'whatsapp' ? setPreguntaWa(true) : c === 'instagram' ? void soloInstagram() : void paginas(c);

  return (
    <div className={incrustado ? 'space-y-3 pb-1' : 'p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 space-y-3'}>
      <div>
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Conecta tus cuentas</h3>
        <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400 mt-0.5 leading-relaxed">
          Toca el botón, entra con tu cuenta de Meta y acepta. Tus mensajes empiezan a llegar a Lalan al momento.
        </p>
      </div>

      {sedes.length > 1 && (
        <label className="block" data-guia="conectar-sede">
          <span className="text-[0.6875rem] font-bold uppercase text-slate-400">Para la sede</span>
          <select value={sede} onChange={(e) => setSede(e.target.value)} disabled={!!actual}
            className="mt-1 w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs text-slate-900 dark:text-white disabled:opacity-80">
            {sedes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {actual && <span className="block mt-1 text-[0.6875rem] text-slate-400">Es la sede en la que estás trabajando. Para otra, cámbiala arriba, junto a tu cuenta.</span>}
        </label>
      )}

      <div className="grid gap-2 sm:grid-cols-3">
        {BOTONES.map(({ canal, texto, Icono, color }) => {
          const hecho = conectado(canal);
          const cargandoEste = ocupado === canal;
          if (hecho) {
            return (
              <div key={canal} className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40">
                <Check className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300 flex-1">{NOMBRE[canal]} conectado</span>
                <button type="button" onClick={() => void desconectar(canal)} disabled={!!ocupado} title="Desconectar"
                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 disabled:opacity-40 cursor-pointer">
                  {cargandoEste ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unplug className="w-3.5 h-3.5" />}
                </button>
              </div>
            );
          }
          return (
            <button key={canal} type="button" disabled={!disponible(canal) || !!ocupado} data-guia={`conectar-${canal}`}
              onClick={() => abrir(canal)}
              className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold shadow-sm ${color} disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98] transition`}>
              {cargandoEste ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icono className="w-4 h-4" />}
              {texto}
            </button>
          );
        })}
      </div>

      {/* Lo que cobra Meta y las plantillas viven en la tarjeta de WhatsApp (Interruptores por canal) */}

      {cfg && currentUser?.role === 'super_admin' && !!(cfg.faltan?.length || cfg.faltanSoloInstagram?.length) && (
        <p className="text-[0.6875rem] text-slate-400">
          Falta en el servidor: {[...cfg.faltan, ...(cfg.faltanSoloInstagram ?? [])].map((v) => `${v}${PARA_QUE_SIRVE[v] ? ` (${PARA_QUE_SIRVE[v]})` : ''}`).join(' · ')}.
        </p>
      )}
      {cfg && currentUser?.role !== 'super_admin' && (!cfg.whatsapp || !cfg.paginas) && (
        <p className="text-[0.6875rem] text-slate-400">Muy pronto: estamos terminando la verificación con Meta. Mientras tanto, el equipo de Lalan te lo conecta.</p>
      )}

      <IOSModal isOpen={preguntaWa} onClose={() => setPreguntaWa(false)} title="Conectar WhatsApp" subtitle="Una pregunta antes de abrir Meta" fixedHeight={false}>
        <div className="space-y-2 p-1" data-guia="conectar-whatsapp-opciones">
          <button type="button" onClick={() => void whatsapp(false)}
            className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-neutral-700 hover:border-[var(--primary)] cursor-pointer">
            <b className="text-sm block">Un número solo para el salón <span className="text-[0.6875rem] text-emerald-600 font-bold">Recomendado</span></b>
            <span className="text-[0.75rem] text-slate-500">Un chip que no está en ninguna app de WhatsApp. Meta te manda un código por SMS o llamada.</span>
          </button>
          <button type="button" onClick={() => void whatsapp(true)}
            className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-neutral-700 hover:border-[var(--primary)] cursor-pointer">
            <b className="text-sm block">Usar el número que ya tengo en WhatsApp Business</b>
            <span className="text-[0.75rem] text-slate-500">Sigues usando la app en tu teléfono y Lalan contesta a la vez. Si le escribes a una clienta desde el teléfono, Lalan se aparta de esa conversación. Tendrás que escanear un código con el teléfono.</span>
          </button>
        </div>
      </IOSModal>

      <IOSModal isOpen={!!numeros} onClose={() => setNumeros(null)} title="¿Qué número conecto?" subtitle={`Autorizaste varios en Meta. Elige el de ${sedes.find((s) => s.id === numeros?.locationId)?.name ?? 'esta sede'}`} fixedHeight={false}>
        <div className="space-y-3 p-1">
          {numeros?.numeros.map((n) => (
            <button key={n.id} type="button" disabled={!!ocupado} onClick={() => void usarNumero(n.id)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-neutral-700 hover:border-[var(--primary)] disabled:opacity-40 cursor-pointer text-left">
              <MessageCircle className="w-5 h-5 text-[#25D366] shrink-0" />
              <span className="flex-1 min-w-0">
                <b className="text-sm block truncate">{n.numero ?? n.id}</b>
                {n.nombre && <span className="text-[0.75rem] text-slate-500 block truncate">{n.nombre}</span>}
              </span>
              {ocupado && <Loader2 className="w-4 h-4 animate-spin" />}
            </button>
          ))}
        </div>
      </IOSModal>

      <IOSModal isOpen={!!elegir} onClose={() => setElegir(null)} title="¿Cuál es la página de tu negocio?" subtitle="Elige una" fixedHeight={false}>
        <div className="space-y-3 p-1">
          {elegir?.paginas.map((p) => (
            <button key={p.id} type="button" disabled={!!ocupado} onClick={() => void usarPagina(p)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-neutral-700 hover:border-[var(--primary)] disabled:opacity-40 cursor-pointer text-left">
              {p.foto
                ? <img src={p.foto} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" referrerPolicy="no-referrer" />
                : <Facebook className="w-5 h-5 text-[#1877F2] shrink-0" />}
              <span className="flex-1 min-w-0">
                <b className="text-sm block truncate">{p.nombre}</b>
                {(p.negocio || p.seguidores != null) && (
                  <span className="text-[0.75rem] text-slate-500 block truncate">
                    {[p.negocio, p.seguidores != null ? `${p.seguidores.toLocaleString('es-DO')} seguidores` : null].filter(Boolean).join(' · ')}
                  </span>
                )}
              </span>
              {ocupado && <Loader2 className="w-4 h-4 animate-spin" />}
            </button>
          ))}
        </div>
      </IOSModal>
    </div>
  );
};
