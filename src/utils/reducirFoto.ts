/**
 * Toda foto sale de aquí a lo sumo de 1600 px por lado, en JPEG: sobra para
 * leer una factura o una lista de precios, sube en un momento y el modelo de visión responde antes
 * (una foto de 4000 px son muchos más "trozos" de imagen que procesar). Se
 * hace en el navegador y no en el servidor a propósito: allí, una foto
 * corrupta tumbaba el proceso entero. Si el navegador no puede, va tal cual.
 */
const LADO_MAXIMO = 1600;
export async function reducirFoto(f: File): Promise<File> {
  if (f.type === 'application/pdf') return f;
  try {
    const img = await createImageBitmap(f);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(img.width, img.height));
    if (escala === 1 && f.size <= 500 * 1024) return f; // ya es pequeña
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(img.width * escala);
    lienzo.height = Math.round(img.height * escala);
    lienzo.getContext('2d')!.drawImage(img, 0, 0, lienzo.width, lienzo.height);
    const blob = await new Promise<Blob | null>(ok => lienzo.toBlob(ok, 'image/jpeg', 0.8));
    // Si se achicó, siempre la reducida (lo que cuesta tiempo son los píxeles); si no, solo si pesa menos
    return blob && (escala < 1 || blob.size < f.size) ? new File([blob], f.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : f;
  } catch { return f; }
}
