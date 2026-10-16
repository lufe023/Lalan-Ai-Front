import type { Aparato } from '../minitutoriales/tipos';

/**
 * Textos de partida para los minitutoriales: al crear una versión, los pasos
 * salen ya escritos y el equipo solo sube las capturas y pone las marcas.
 * Se pueden cambiar todos en el editor.
 */
export const PLANTILLAS: Record<string, Partial<Record<Aparato, { titulo: string; pasos: string[] }>>> = {
  'instalar-app': {
    iphone: {
      titulo: 'Instalar Lalan en tu iPhone',
      pasos: [
        'Abre Lalan en Safari. Si la abriste desde Instagram, WhatsApp o Chrome, cópiala y pégala en Safari.',
        'Toca el botón Compartir: el cuadrado con la flecha hacia arriba, en la barra de abajo.',
        'Desliza el menú hacia arriba y toca «Agregar a inicio».',
        'Toca «Agregar», arriba a la derecha.',
        'Listo: abre Lalan desde el ícono nuevo en tu pantalla de inicio.',
      ],
    },
    'android-chrome': {
      titulo: 'Instalar Lalan en tu Android',
      pasos: [
        'Abre Lalan en Chrome.',
        'Toca los tres puntos, arriba a la derecha.',
        'Toca «Instalar app» (en algunos teléfonos dice «Agregar a la pantalla principal»).',
        'Confirma con «Instalar».',
        'Listo: abre Lalan desde el ícono nuevo, como cualquier app.',
      ],
    },
    'android-samsung': {
      titulo: 'Instalar Lalan en tu Samsung',
      pasos: [
        'Abre Lalan en Samsung Internet.',
        'Toca el menú de tres rayitas, abajo a la derecha.',
        'Toca «Agregar página a» y elige «Pantalla de inicio».',
        'Toca «Agregar».',
        'Listo: abre Lalan desde el ícono nuevo.',
      ],
    },
    'pc-chrome': {
      titulo: 'Instalar Lalan en tu computadora (Chrome)',
      pasos: [
        'Abre Lalan en Chrome.',
        'En la barra de direcciones, a la derecha, toca el ícono de instalar: una pantalla con una flecha.',
        'Toca «Instalar».',
        'Listo: Lalan se abre en su propia ventana y queda en el escritorio y en el menú Inicio.',
      ],
    },
    'pc-edge': {
      titulo: 'Instalar Lalan en tu computadora (Edge)',
      pasos: [
        'Abre Lalan en Edge.',
        'En la barra de direcciones toca «Aplicación disponible». Si no lo ves: menú de tres puntos, «Aplicaciones», «Instalar este sitio como una aplicación».',
        'Toca «Instalar».',
        'Si quieres, ánclala a la barra de tareas para tenerla siempre a mano.',
      ],
    },
    'mac-safari': {
      titulo: 'Instalar Lalan en tu Mac (Safari)',
      pasos: [
        'Abre Lalan en Safari.',
        'En el menú de arriba toca «Archivo» y luego «Agregar al Dock».',
        'Toca «Agregar».',
        'Listo: abre Lalan desde el Dock, en su propia ventana.',
      ],
    },
    todos: {
      titulo: 'Instalar Lalan',
      pasos: [
        'Abre Lalan en el navegador de tu teléfono o computadora.',
        'Busca en el menú del navegador «Instalar app», «Agregar a inicio» o «Agregar a la pantalla principal».',
        'Confírmalo.',
        'Listo: abre Lalan desde el ícono nuevo.',
      ],
    },
  },
};
