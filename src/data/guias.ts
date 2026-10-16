import type { ScreenName } from '../context/AppContext';
import type { SeccionAjustes } from '../components/ajustes/MenuAjustes';

/**
 * "Llévame": las tareas a las que Lalan lleva a la dueña, paso a paso.
 *
 * Cada paso señala un elemento de la app con su marca `data-guia="…"` y le
 * dice qué hacer ("Toca aquí"). Al tocarlo pasa al siguiente. Los pasos de
 * leer (escribir algo, revisar) llevan el botón Siguiente o Listo.
 *
 * Lalan tiene la copia corta de este catálogo en el servidor
 * (`src/modules/asistente/guias.contrato.ts`): los dos se emparejan por `id`.
 * Una guía nueva se agrega en los dos.
 */
export interface PasoGuia {
  /** El valor de `data-guia` del elemento que se señala */
  ancla: string;
  texto: string;
  /** No hay que tocar nada: se avanza con Siguiente (o Listo, si es el último) */
  leer?: boolean;
}

export interface GuiaApp {
  id: string;
  nombre: string;
  pantalla: ScreenName;
  /** En Ajustes: la guía empieza en el menú, para que aprenda el camino */
  ajustes?: boolean;
  /**
   * La pantalla trabaja con la sede activa (Caja, El salón, Sala): si Lalan
   * eligió otra sede, la app se cambia a esa antes de empezar.
   */
  cambiaSede?: boolean;
  pasos: PasoGuia[];
}

/** El primer paso de las guías de Ajustes: la fila del menú */
const fila = (s: SeccionAjustes, nombre: string): PasoGuia => ({ ancla: `ajustes-${s}`, texto: `Toca «${nombre}».` });

export const GUIAS: GuiaApp[] = [
  {
    id: 'cambiar-clave', nombre: 'Cambiar mi contraseña', pantalla: 'settings', ajustes: true,
    pasos: [
      fila('cuenta', 'Mi cuenta'),
      { ancla: 'cambiar-clave', texto: 'Toca «Cambiar contraseña».' },
      { ancla: 'guardar-clave', texto: 'Escribe tu contraseña actual y la nueva dos veces. Luego toca «Guardar contraseña nueva». Las demás sesiones se cierran solas.', leer: true },
    ],
  },
  {
    id: 'activar-notificaciones', nombre: 'Activar las notificaciones', pantalla: 'settings', ajustes: true,
    pasos: [
      fila('cuenta', 'Mi cuenta'),
      { ancla: 'notificaciones', texto: 'Aquí se activan los avisos en este aparato. Toca el botón y, cuando el teléfono pregunte, elige «Permitir».', leer: true },
    ],
  },
  {
    id: 'acceso-rapido', nombre: 'Entrar con 1 toque', pantalla: 'settings', ajustes: true,
    pasos: [
      fila('cuenta', 'Mi cuenta'),
      { ancla: 'acceso-rapido', texto: 'Toca «Vincular». Desde ahora este aparato entra a tu salón con un toque.', leer: true },
    ],
  },
  {
    id: 'conectar-whatsapp', nombre: 'Conectar WhatsApp', pantalla: 'settings', ajustes: true,
    pasos: [
      fila('chats', 'Lalan en los chats'),
      { ancla: 'conectar-sede', texto: 'Revisa que esté elegida la sede de este número.', leer: true },
      { ancla: 'conectar-whatsapp', texto: 'Toca «Conectar WhatsApp».' },
      { ancla: 'conectar-whatsapp-opciones', texto: 'Si el número ya está en la app WhatsApp Business de tu teléfono, elige «Usar el número que ya tengo». Si es un chip solo para el salón, elige la primera. Después Meta te pide entrar con tu Facebook.', leer: true },
    ],
  },
  {
    id: 'conectar-instagram', nombre: 'Conectar Instagram', pantalla: 'settings', ajustes: true,
    pasos: [
      fila('chats', 'Lalan en los chats'),
      { ancla: 'conectar-sede', texto: 'Revisa que esté elegida la sede de esta cuenta.', leer: true },
      { ancla: 'conectar-instagram', texto: 'Toca «Conectar Instagram» y entra con tu cuenta. Tiene que ser una cuenta profesional.' },
    ],
  },
  {
    id: 'conectar-facebook', nombre: 'Conectar Facebook y Messenger', pantalla: 'settings', ajustes: true,
    pasos: [
      fila('chats', 'Lalan en los chats'),
      { ancla: 'conectar-sede', texto: 'Revisa que esté elegida la sede de esta página.', leer: true },
      { ancla: 'conectar-messenger', texto: 'Toca «Conectar Facebook» y elige la página del salón.' },
    ],
  },
  {
    id: 'agregar-usuario', nombre: 'Darle entrada a alguien del equipo', pantalla: 'settings', ajustes: true,
    pasos: [
      fila('equipo', 'Equipo'),
      { ancla: 'agregar-usuario', texto: 'Toca «Agregar».' },
      { ancla: 'nuevo-usuario', texto: 'Escribe su nombre y cómo va a entrar, y elige qué puede hacer. La app le da una clave temporal para su primera vez.', leer: true },
    ],
  },
  {
    id: 'horario-salon', nombre: 'Cambiar el horario del salón', pantalla: 'settings', ajustes: true, cambiaSede: true,
    pasos: [
      fila('salon', 'El salón'),
      { ancla: 'horario-salon', texto: 'Este es el horario de la semana. Cambia la hora de abrir y de cerrar de cada día, o márcalo cerrado, y guarda.', leer: true },
    ],
  },
  {
    id: 'pantalla-turnos', nombre: 'Poner la pantalla de turnos en el TV', pantalla: 'settings', ajustes: true, cambiaSede: true,
    pasos: [
      fila('sala', 'Sala y Lounge'),
      { ancla: 'pantalla-turnos', texto: 'Abre esta dirección en el navegador del TV o la tablet, o escanea el código QR con ella. No pide contraseña.', leer: true },
    ],
  },
  {
    id: 'monedas', nombre: 'Agregar una moneda', pantalla: 'settings', ajustes: true,
    pasos: [
      fila('caja', 'Caja'),
      { ancla: 'monedas', texto: 'Aquí agregas la moneda, su símbolo y cuánto vale en la moneda del salón.', leer: true },
    ],
  },
  {
    id: 'agendar-cita', nombre: 'Agendar una cita a mano', pantalla: 'calendar', cambiaSede: true,
    pasos: [
      { ancla: 'nueva-cita', texto: 'Toca el + para una cita nueva.' },
      { ancla: 'cita-clienta', texto: 'Escribe su nombre o su teléfono y elígela de la lista. Si es nueva, escribe su nombre completo y su teléfono: se crea sola al guardar.', leer: true },
      { ancla: 'guardar-cita', texto: 'Elige la hora, el servicio y la especialista, y toca «Guardar Cita en Agenda».', leer: true },
    ],
  },
  {
    id: 'abrir-caja', nombre: 'Abrir la caja', pantalla: 'caja', cambiaSede: true,
    pasos: [
      { ancla: 'fondo-caja', texto: 'Escribe con cuánto efectivo empiezas el día.', leer: true },
      { ancla: 'abrir-caja', texto: 'Toca «Abrir caja».' },
    ],
  },
  {
    id: 'cerrar-caja', nombre: 'Cerrar la caja', pantalla: 'caja', cambiaSede: true,
    pasos: [
      { ancla: 'cerrar-caja', texto: 'Cuenta el efectivo, escríbelo arriba y toca «Cerrar caja». Si no cuadra, se guarda tal como salió.', leer: true },
    ],
  },
  {
    id: 'tamano-letra', nombre: 'Cambiar el tamaño de la letra', pantalla: 'settings', ajustes: true,
    pasos: [
      fila('apariencia', 'Apariencia'),
      { ancla: 'tamano-letra', texto: 'Elige el tamaño de letra que veas mejor. Se cambia al momento.', leer: true },
    ],
  },
  {
    id: 'lo-que-lalan-sabe', nombre: 'Ver lo que Lalan sabe de mí', pantalla: 'settings', ajustes: true,
    pasos: [
      fila('cuenta', 'Mi cuenta'),
      { ancla: 'lo-que-lalan-sabe', texto: 'Aquí está lo que le contaste a Lalan. Puedes borrar cada cosa, tocar «Nunca guardes esto» o borrar todo.', leer: true },
    ],
  },
  {
    id: 'tema-colores', nombre: 'Cambiar el modo oscuro y los colores', pantalla: 'settings', ajustes: true,
    pasos: [
      fila('apariencia', 'Apariencia'),
      { ancla: 'tema-colores', texto: 'Elige modo claro, oscuro o automático, y toca «Ver Paletas» para cambiar los colores.', leer: true },
    ],
  },
];

export const guiaPorId = (id: string) => GUIAS.find((g) => g.id === id) ?? null;
