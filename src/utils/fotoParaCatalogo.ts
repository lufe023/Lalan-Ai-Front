/**
 * La foto de un producto o servicio, lista para subir: a lo sumo 1200 px por
 * lado, en JPEG, como data URL. Sobra para la Vitrina y pesa unos 200 KB. Se
 * reduce en el navegador (como reducirFoto): en el servidor una foto corrupta
 * tumbaba el proceso entero. Respeta el giro que trae la foto del teléfono.
 */
const LADO_MAXIMO = 1200;
const CALIDAD = 0.82;
/** Más que esto no lo acepta el servidor */
const MAXIMO_BYTES = 600_000;

export async function fotoParaCatalogo(f: File): Promise<string> {
  if (!f.type.startsWith('image/')) throw new Error('Eso no es una foto: elige una imagen JPG, PNG o WebP.');
  let img: ImageBitmap;
  try {
    img = await createImageBitmap(f, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('No pude abrir esa foto. Prueba con otra o tómala de nuevo.');
  }
  const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height));
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.round(img.width * escala);
  lienzo.height = Math.round(img.height * escala);
  const ctx = lienzo.getContext('2d')!;
  // Un PNG con transparencia queda sobre blanco, no sobre negro
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, lienzo.width, lienzo.height);
  ctx.drawImage(img, 0, 0, lienzo.width, lienzo.height);
  img.close();
  for (const calidad of [CALIDAD, 0.7, 0.55]) {
    const url = lienzo.toDataURL('image/jpeg', calidad);
    if ((url.length - url.indexOf(',') - 1) * 0.75 <= MAXIMO_BYTES) return url;
  }
  throw new Error('La foto pesa demasiado aun reducida. Prueba con otra.');
}
