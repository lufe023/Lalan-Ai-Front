/**
 * La ventana de Meta para conectar cuentas (SDK de JavaScript de Facebook).
 * Se carga solo cuando alguien toca "Conectar", no en cada visita.
 */

export interface ConfigMeta {
  appId: string | null; whatsappConfigId: string | null; loginConfigId: string | null; version: string;
  whatsapp: boolean; paginas: boolean;
}

/** Lo que devuelve el registro insertado de WhatsApp */
export interface RegistroWhatsapp { code: string; wabaId: string; phoneNumberId: string; coexistencia: boolean }

/** Tipos de evento que manda la ventana de WhatsApp */
const EVENTO_WA = { tipo: 'WA_EMBEDDED_SIGNUP', cancelar: 'CANCEL', error: 'ERROR' } as const;

/** Permisos para Messenger e Instagram si no hay configuración de "Inicio de sesión para empresas" */
const PERMISOS_PAGINAS = 'pages_show_list,pages_messaging,pages_manage_metadata,instagram_basic,instagram_manage_messages,business_management';

declare global { interface Window { FB?: any; fbAsyncInit?: () => void } }

let cargando: Promise<any> | null = null;
let iniciadoCon: string | null = null;

function sdk(cfg: ConfigMeta): Promise<any> {
  if (!cfg.appId) return Promise.reject(new Error('Falta configurar la app de Meta en el servidor.'));
  if (!cargando) {
    cargando = new Promise((resolve, reject) => {
      if (window.FB) { resolve(window.FB); return; }
      const s = document.createElement('script');
      s.src = 'https://connect.facebook.net/es_LA/sdk.js';
      s.async = true; s.defer = true; s.crossOrigin = 'anonymous';
      s.onerror = () => { cargando = null; reject(new Error('No se pudo abrir Meta. Revisa la conexión o un bloqueador de anuncios.')); };
      window.fbAsyncInit = () => resolve(window.FB);
      document.body.appendChild(s);
    });
  }
  return cargando.then((FB) => {
    if (iniciadoCon !== cfg.appId) {
      FB.init({ appId: cfg.appId, autoLogAppEvents: true, xfbml: false, version: cfg.version });
      iniciadoCon = cfg.appId;
    }
    return FB;
  });
}

/** Abre el registro insertado de WhatsApp. `coexistencia`: el número sigue en la app WhatsApp Business. */
export async function abrirRegistroWhatsapp(cfg: ConfigMeta, coexistencia: boolean): Promise<RegistroWhatsapp> {
  const FB = await sdk(cfg);
  return new Promise((resolve, reject) => {
    let ids: { wabaId: string; phoneNumberId: string } | null = null;
    let code: string | null = null;
    const listo = () => {
      if (ids && code) { window.removeEventListener('message', oir); resolve({ code, ...ids, coexistencia }); }
    };
    const oir = (ev: MessageEvent) => {
      if (!/(^|\.)facebook\.com$/.test(new URL(ev.origin).hostname)) return;
      let d: any; try { d = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data; } catch { return; }
      if (d?.type !== EVENTO_WA.tipo) return;
      if (d.event === EVENTO_WA.cancelar) { window.removeEventListener('message', oir); reject(new Error('Se cerró la ventana antes de terminar.')); return; }
      if (d.event === EVENTO_WA.error) { window.removeEventListener('message', oir); reject(new Error(d.data?.error_message ?? 'Meta reportó un error.')); return; }
      if (d.data?.waba_id && d.data?.phone_number_id) { ids = { wabaId: String(d.data.waba_id), phoneNumberId: String(d.data.phone_number_id) }; listo(); }
    };
    window.addEventListener('message', oir);
    // El SDK no acepta una función async aquí
    FB.login((r: any) => {
      code = r?.authResponse?.code ?? null;
      if (!code) { window.removeEventListener('message', oir); reject(new Error('No se completó la conexión.')); return; }
      listo();
      // Si el evento con los ids no llega (ventanas viejas), se avisa en vez de quedarse esperando
      setTimeout(() => { if (!ids) { window.removeEventListener('message', oir); reject(new Error('Meta no devolvió el número elegido. Inténtalo de nuevo.')); } }, 8000);
    }, {
      config_id: cfg.whatsappConfigId,
      response_type: 'code',
      override_default_response_type: true,
      extras: { setup: {}, sessionInfoVersion: '3', ...(coexistencia ? { featureType: 'whatsapp_business_app_onboarding' } : {}) },
    });
  });
}

/** Inicia sesión con Facebook para elegir la página (Messenger) y su Instagram. Devuelve el token de usuario. */
export async function abrirLoginPaginas(cfg: ConfigMeta): Promise<string> {
  const FB = await sdk(cfg);
  return new Promise((resolve, reject) => {
    FB.login((r: any) => {
      const token = r?.authResponse?.accessToken;
      token ? resolve(token) : reject(new Error('No se completó la conexión.'));
    }, cfg.loginConfigId ? { config_id: cfg.loginConfigId } : { scope: PERMISOS_PAGINAS });
  });
}
