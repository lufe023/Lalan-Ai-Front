/**
 * La foto de un producto o servicio, lista para subir: a lo sumo 1200 px por
 * lado, en JPEG, como data URL. Sobra para la Vitrina y pesa unos 200 KB. Se
 * reduce en el navegador (como reducirFoto): en el servidor una foto corrupta
 * tumbaba el proceso entero. Respeta el giro que trae la foto del teléfono.
 *
 * Abre la foto por tres caminos, del más rápido al que sirve en todos lados:
 * createImageBitmap con el giro de la foto, sin él (Safari de iPhones no tan
 * nuevos no conoce «from-image» y rechazaba TODA foto con «No pude abrir esa
 * foto»), y una <img> (que también abre lo que el navegador sepa mostrar). Si
 * aun reducida pesa mucho, se achica más en vez de rechazarla.
 */
const LADO_MAXIMO = 1200;
const CALIDAD = 0.82;
/** Más que esto no lo acepta el servidor */
const MAXIMO_BYTES = 600_000;

type Abierta = { fuente: CanvasImageSource; ancho: number; alto: number; cerrar: () => void };

/** Parece foto por su tipo o, si el teléfono no lo dice (pasa en Android), por su nombre */
const pareceFoto = (f: File) =>
  f.type.startsWith('image/') || (!f.type && /\.(jpe?g|png|webp|heic|heif|gif|bmp|avif)$/i.test(f.name));

async function conBitmap(f: File, opciones?: ImageBitmapOptions): Promise<Abierta> {
  const img = opciones ? await createImageBitmap(f, opciones) : await createImageBitmap(f);
  return { fuente: img, ancho: img.width, alto: img.height, cerrar: () => img.close() };
}

function conImagen(f: File): Promise<Abierta> {
  return new Promise((ok, mal) => {
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => ok({ fuente: img, ancho: img.naturalWidth, alto: img.naturalHeight, cerrar: () => URL.revokeObjectURL(url) });
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('no abre')); };
    img.src = url;
  });
}

async function abrir(f: File): Promise<Abierta> {
  const caminos: (() => Promise<Abierta>)[] = [];
  if (typeof createImageBitmap === 'function') {
    caminos.push(() => conBitmap(f, { imageOrientation: 'from-image' }), () => conBitmap(f));
  }
  caminos.push(() => conImagen(f));
  for (const camino of caminos) {
    try {
      const a = await camino();
      if (a.ancho > 0 && a.alto > 0) return a;
      a.cerrar();
    } catch { /* el siguiente camino */ }
  }
  throw new Error(/\.(heic|heif)$/i.test(f.name) || /hei[cf]/i.test(f.type)
    ? 'Esa foto está en HEIC y este navegador no la abre. En el iPhone: Ajustes → Cámara → Formatos → «Más compatible», o mándala por WhatsApp y súbela de ahí.'
    : 'No pude abrir esa foto. Prueba con otra o tómala de nuevo.');
}

export async function fotoParaCatalogo(f: File): Promise<string> {
  if (!pareceFoto(f)) throw new Error('Eso no es una foto: elige una imagen JPG, PNG o WebP.');
  const img = await abrir(f);
  try {
    let lado = LADO_MAXIMO;
    // Si aun con menos calidad pesa mucho (una foto con mucho detalle), se achica y se prueba otra vez
    for (let vuelta = 0; vuelta < 4; vuelta++, lado = Math.round(lado * 0.75)) {
      const escala = Math.min(1, lado / Math.max(img.ancho, img.alto));
      const lienzo = document.createElement('canvas');
      lienzo.width = Math.max(1, Math.round(img.ancho * escala));
      lienzo.height = Math.max(1, Math.round(img.alto * escala));
      const ctx = lienzo.getContext('2d');
      if (!ctx) throw new Error('No pude preparar la foto en este teléfono. Prueba de nuevo.');
      // Un PNG con transparencia queda sobre blanco, no sobre negro
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, lienzo.width, lienzo.height);
      ctx.drawImage(img.fuente, 0, 0, lienzo.width, lienzo.height);
      for (const calidad of [CALIDAD, 0.7, 0.55]) {
        const url = lienzo.toDataURL('image/jpeg', calidad);
        if (!url.startsWith('data:image/jpeg')) break; // el navegador no hizo el JPEG: se achica
        if ((url.length - url.indexOf(',') - 1) * 0.75 <= MAXIMO_BYTES) return url;
      }
    }
  } finally {
    img.cerrar();
  }
  throw new Error('La foto pesa demasiado aun reducida. Prueba con otra.');
}
