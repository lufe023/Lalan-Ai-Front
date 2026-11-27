/**
 * Instalar Lalan en el teléfono o la computadora.
 *
 * Chrome, Edge y Samsung Internet avisan UNA vez, al cargar, que la app se
 * puede instalar (`beforeinstallprompt`). Si nadie lo guarda en ese momento
 * se pierde y ya no hay botón de un toque. Por eso se escucha aquí, al
 * importar este archivo (desde main.tsx), y todas las pantallas lo usan.
 *
 * Safari (iPhone, iPad, Mac) y Firefox no tienen ese botón: ahí solo se
 * puede enseñar el camino (Compartir → Agregar a inicio), con el
 * minitutorial de fotos de Plataforma → Guías o, si aún no hay, con los
 * pasos en texto de `pasosParaInstalar`.
 */

interface EventoInstalar extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

let pendiente: EventoInstalar | null = null;
let recienInstalada = false;
const oyentes = new Set<() => void>();
const avisar = () => oyentes.forEach((f) => f());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    pendiente = e as EventoInstalar;
    avisar();
  });
  window.addEventListener('appinstalled', () => {
    pendiente = null;
    recienInstalada = true;
    avisar();
  });
}

/** Alguien cambió: se puede instalar, o ya se instaló */
export function alCambiarInstalacion(fn: () => void) {
  oyentes.add(fn);
  return () => { oyentes.delete(fn); };
}

export function estaInstalada(): boolean {
  if (recienInstalada) return true;
  try {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: window-controls-overlay)').matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true;
  } catch { return false; }
}

export type ComoInstalar =
  /** Ya está instalada (esta ventana es la app) */
  | 'instalada'
  /** Un toque: el navegador muestra su ventana de instalar */
  | 'directo'
  /** iPhone o iPad: Compartir → Agregar a inicio */
  | 'iphone'
  /** Mac con Safari: Archivo → Agregar al Dock */
  | 'mac-safari'
  /** Dentro de Instagram, Facebook, TikTok…: desde ahí no se instala, hay que abrir el navegador */
  | 'dentro-de-app'
  /** Android sin el aviso (Firefox, o Chrome que aún no lo dio): por el menú ⋮ */
  | 'android-menu'
  /** Computadora con un navegador que no instala (Firefox): mejor Chrome o Edge */
  | 'otro-navegador';

const ua = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent);
export const esIPhone = () => /iPhone|iPad|iPod/i.test(ua()) || (typeof navigator !== 'undefined' && navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const esAndroid = () => /Android/i.test(ua());
export const esTelefono = () => esIPhone() || esAndroid() || /Mobile/i.test(ua());
/** El navegador de adentro de una app (Instagram, Facebook, TikTok, LinkedIn…), donde no hay "Agregar a inicio" */
export const dentroDeOtraApp = () => /FBAN|FBAV|FB_IAB|Instagram|TikTok|musical_ly|Bytedance|LinkedInApp|Snapchat|Line\//i.test(ua());

export function comoInstalar(): ComoInstalar {
  if (estaInstalada()) return 'instalada';
  if (pendiente) return 'directo';
  if (dentroDeOtraApp()) return 'dentro-de-app';
  if (esIPhone()) return 'iphone';
  const u = ua();
  if (/Macintosh/i.test(u) && /Safari/i.test(u) && !/Chrome|Chromium|Firefox|Edg\//i.test(u)) return 'mac-safari';
  if (esAndroid()) return 'android-menu';
  if (/Firefox/i.test(u)) return 'otro-navegador';
  // Chrome o Edge en la computadora que todavía no dio el aviso: el ícono de la barra de direcciones
  return 'android-menu';
}

/** El toque de "Instalar": abre la ventana del navegador. true = la instaló */
export async function instalarDirecto(): Promise<boolean> {
  const e = pendiente;
  if (!e) return false;
  await e.prompt();
  const r = await e.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
  pendiente = null;
  if (r.outcome === 'accepted') recienInstalada = true;
  avisar();
  return r.outcome === 'accepted';
}

/**
 * Los pasos en texto, por si todavía no hay fotos publicadas en Plataforma →
 * Guías para este aparato. Cortos, con el nombre exacto del botón.
 */
export function pasosParaInstalar(como: ComoInstalar): { titulo: string; pasos: { titulo: string; texto: string }[] } {
  const iosChrome = /CriOS/i.test(ua());
  switch (como) {
    case 'iphone':
      return {
        titulo: 'Instalar en tu iPhone',
        pasos: iosChrome ? [
          { titulo: 'Toca Compartir', texto: 'Arriba a la derecha, al lado de la dirección, el cuadrito con la flecha hacia arriba.' },
          { titulo: 'Elige «Agregar a inicio»', texto: 'Baja un poco en la lista. Si no sale, toca «Más» o «Editar acciones».' },
          { titulo: 'Toca «Agregar»', texto: 'Arriba a la derecha. El ícono de Lalan queda en tu pantalla de inicio: ábrela siempre desde ahí.' },
        ] : [
          { titulo: 'Toca Compartir', texto: 'En la barra de Safari (abajo, o arriba en iPad), el cuadrito con la flecha hacia arriba. Si no ves la barra, toca la dirección o los tres puntitos «…».' },
          { titulo: 'Elige «Agregar a inicio»', texto: 'Baja un poco en la lista. Si no sale, toca «Ver más» o «Editar acciones».' },
          { titulo: 'Toca «Agregar»', texto: 'Arriba a la derecha. El ícono de Lalan queda en tu pantalla de inicio: ábrela siempre desde ahí.' },
        ],
      };
    case 'mac-safari':
      return {
        titulo: 'Instalar en tu Mac',
        pasos: [
          { titulo: 'Menú Archivo', texto: 'En la barra de arriba de Safari, toca «Archivo».' },
          { titulo: '«Agregar al Dock»', texto: 'Confirma con «Agregar». Lalan queda en el Dock como cualquier programa.' },
        ],
      };
    case 'dentro-de-app':
      return {
        titulo: 'Abre Lalan en tu navegador',
        pasos: [
          { titulo: 'Desde aquí no se puede instalar', texto: 'Estás dentro de otra app (Instagram, Facebook…). Esas no dejan instalar.' },
          { titulo: 'Ábrela en el navegador', texto: esIPhone()
            ? 'Toca los tres puntitos «…» y elige «Abrir en el navegador» (o copia el enlace y pégalo en Safari).'
            : 'Toca los tres puntitos ⋮ y elige «Abrir en Chrome» (o copia el enlace y pégalo en Chrome).' },
          { titulo: 'Instala desde ahí', texto: 'Ya en el navegador, entra y toca «Instalar».' },
        ],
      };
    case 'otro-navegador':
      return {
        titulo: 'Instalar en esta computadora',
        pasos: [
          { titulo: 'Abre Lalan en Chrome o Edge', texto: 'Este navegador no instala apps. Copia el enlace y ábrelo en Chrome o Edge.' },
          { titulo: 'Toca el ícono de instalar', texto: 'En la barra de la dirección, a la derecha, sale un monitor con una flecha. Tócalo y luego «Instalar».' },
        ],
      };
    case 'android-menu':
    default:
      return esTelefono() ? {
        titulo: 'Instalar en tu teléfono',
        pasos: [
          { titulo: 'Abre el menú', texto: 'Los tres puntitos ⋮ de arriba a la derecha (en Samsung Internet, las tres rayitas ≡ de abajo).' },
          { titulo: '«Instalar app» o «Agregar a pantalla de inicio»', texto: 'Cualquiera de las dos sirve. Confirma con «Instalar».' },
          { titulo: 'Ábrela desde el ícono', texto: 'Lalan queda con las demás apps del teléfono.' },
        ],
      } : {
        titulo: 'Instalar en esta computadora',
        pasos: [
          { titulo: 'Toca el ícono de instalar', texto: 'En la barra de la dirección, a la derecha, un monitor con una flecha (o menú ⋮ → «Instalar Lalan»).' },
          { titulo: 'Confirma con «Instalar»', texto: 'Lalan se abre en su propia ventana y queda en el escritorio.' },
        ],
      };
  }
}
