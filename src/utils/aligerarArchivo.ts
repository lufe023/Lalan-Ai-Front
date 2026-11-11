/**
 * Los videos del teléfono pesan cientos de MB y el servidor acepta hasta
 * 100 MB (y los PDF hasta 8 MB): subirlos enteros daba «File too large».
 * Lalán no necesita el archivo entero para leerlo, así que aquí, en el
 * navegador, se saca solo lo que usa:
 *  - de un video, unos cuadros en JPG y el audio en WAV de 16 kHz;
 *  - de un PDF, cada página como foto.
 * Lo que sube son pocos MB, sin importar cuánto pese el original.
 */

/** Hasta este tamaño el video sube entero (lo mismo que acepta el servidor, con margen) */
export const VIDEO_SUBE_ENTERO = 95 * 1024 * 1024;
/** Los mismos cuadros que saca el servidor de un video, según dure */
const CUADROS_POR_DURACION = [{ hasta: 20, cuadros: 4 }, { hasta: 45, cuadros: 6 }, { hasta: Infinity, cuadros: 8 }];
const ANCHO_CUADRO = 720;
/** Whisper acepta 25 MB: 10 minutos de WAV a 16 kHz son unos 19 MB */
const SEGUNDOS_DE_AUDIO = 600;
const MUESTREO = 16000;
/** Un video más pesado no se abre entero en memoria para sacarle el audio (el teléfono se colgaría) */
const MAXIMO_PARA_AUDIO = 1024 * 1024 * 1024;

export interface VideoAligerado { cuadros: File[]; audio: File | null }

/** El formulario para subir un video: entero si es liviano, aligerado si pesa */
export async function formularioDeVideo(video: File, campos: Record<string, string | undefined> = {}): Promise<FormData> {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) if (v !== undefined) f.append(k, v);
  if (video.size <= VIDEO_SUBE_ENTERO) {
    f.append('archivo', video);
    return f;
  }
  const { cuadros, audio } = await aligerarVideo(video);
  if (!cuadros.length && !audio) throw new Error('No pude abrir ese video aquí. Prueba con otro o recórtalo un poco.');
  for (const c of cuadros) f.append('cuadros', c);
  if (audio) f.append('audio', audio);
  return f;
}

export async function aligerarVideo(video: File): Promise<VideoAligerado> {
  const [cuadros, audio] = await Promise.all([
    cuadrosDelVideo(video).catch(() => [] as File[]),
    audioDelVideo(video).catch(() => null),
  ]);
  return { cuadros, audio };
}

/** Cuadros repartidos a lo largo del video, como fotos de 720 px */
async function cuadrosDelVideo(video: File): Promise<File[]> {
  const url = URL.createObjectURL(video);
  const el = document.createElement('video');
  el.muted = true;
  el.playsInline = true;
  el.preload = 'auto';
  el.src = url;
  try {
    await esperar(el, 'loadeddata');
    const duracion = Number.isFinite(el.duration) ? el.duration : 0;
    const total = CUADROS_POR_DURACION.find(x => duracion <= x.hasta)!.cuadros;
    const momentos = duracion > 0 ? Array.from({ length: total }, (_, i) => duracion * (i + 0.5) / total) : [0];
    const escala = Math.min(1, ANCHO_CUADRO / (el.videoWidth || ANCHO_CUADRO));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round((el.videoWidth || ANCHO_CUADRO) * escala);
    lienzo.height = Math.round((el.videoHeight || ANCHO_CUADRO) * escala);
    const ctx = lienzo.getContext('2d')!;
    const cuadros: File[] = [];
    for (const [i, t] of momentos.entries()) {
      el.currentTime = t;
      await esperar(el, 'seeked');
      ctx.drawImage(el, 0, 0, lienzo.width, lienzo.height);
      const blob = await new Promise<Blob | null>(ok => lienzo.toBlob(ok, 'image/jpeg', 0.8));
      if (blob) cuadros.push(new File([blob], `cuadro-${i}.jpg`, { type: 'image/jpeg' }));
    }
    return cuadros;
  } finally {
    el.removeAttribute('src');
    el.load();
    URL.revokeObjectURL(url);
  }
}

/** El audio en mono a 16 kHz (lo que usa Whisper), hasta 10 minutos */
async function audioDelVideo(video: File): Promise<File | null> {
  if (video.size > MAXIMO_PARA_AUDIO) return null;
  const Contexto = window.AudioContext ?? (window as any).webkitAudioContext;
  if (!Contexto || typeof OfflineAudioContext === 'undefined') return null;
  const ctx = new Contexto();
  try {
    const sonido = await ctx.decodeAudioData(await video.arrayBuffer());
    const segundos = Math.min(sonido.duration, SEGUNDOS_DE_AUDIO);
    if (segundos < 0.5) return null;
    const offline = new OfflineAudioContext(1, Math.ceil(segundos * MUESTREO), MUESTREO);
    const fuente = offline.createBufferSource();
    fuente.buffer = sonido;
    fuente.connect(offline.destination);
    fuente.start(0);
    const mono = await offline.startRendering();
    return new File([wav(mono.getChannelData(0))], 'audio.wav', { type: 'audio/wav' });
  } finally {
    void ctx.close().catch(() => undefined);
  }
}

/** PCM de 16 bits en un WAV */
function wav(muestras: Float32Array): Blob {
  const datos = new DataView(new ArrayBuffer(44 + muestras.length * 2));
  const texto = (en: number, s: string) => { for (let i = 0; i < s.length; i++) datos.setUint8(en + i, s.charCodeAt(i)); };
  texto(0, 'RIFF'); datos.setUint32(4, 36 + muestras.length * 2, true); texto(8, 'WAVE');
  texto(12, 'fmt '); datos.setUint32(16, 16, true); datos.setUint16(20, 1, true); datos.setUint16(22, 1, true);
  datos.setUint32(24, MUESTREO, true); datos.setUint32(28, MUESTREO * 2, true); datos.setUint16(32, 2, true); datos.setUint16(34, 16, true);
  texto(36, 'data'); datos.setUint32(40, muestras.length * 2, true);
  for (let i = 0; i < muestras.length; i++) {
    const m = Math.max(-1, Math.min(1, muestras[i]));
    datos.setInt16(44 + i * 2, m < 0 ? m * 0x8000 : m * 0x7fff, true);
  }
  return new Blob([datos.buffer], { type: 'audio/wav' });
}

function esperar(el: HTMLVideoElement, evento: 'loadeddata' | 'seeked'): Promise<void> {
  return new Promise((ok, mal) => {
    const reloj = setTimeout(() => { limpiar(); mal(new Error('El video no respondió')); }, 15000);
    const listo = () => { limpiar(); ok(); };
    const fallo = () => { limpiar(); mal(new Error('El navegador no pudo abrir el video')); };
    const limpiar = () => { clearTimeout(reloj); el.removeEventListener(evento, listo); el.removeEventListener('error', fallo); };
    el.addEventListener(evento, listo, { once: true });
    el.addEventListener('error', fallo, { once: true });
  });
}

/** Cada página del PDF como foto JPG de 1600 px de ancho, hasta `maximo` páginas */
export async function paginasDelPdf(pdf: File, maximo: number): Promise<File[]> {
  const pdfjs = await import('pdfjs-dist');
  const { default: trabajador } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = trabajador;
  const doc = await pdfjs.getDocument({ data: await pdf.arrayBuffer() }).promise;
  try {
    const fotos: File[] = [];
    for (let n = 1; n <= Math.min(doc.numPages, maximo); n++) {
      const pagina = await doc.getPage(n);
      const base = pagina.getViewport({ scale: 1 });
      const vista = pagina.getViewport({ scale: 1600 / base.width });
      const lienzo = document.createElement('canvas');
      lienzo.width = vista.width; lienzo.height = vista.height;
      const ctx = lienzo.getContext('2d')!;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, lienzo.width, lienzo.height);
      await pagina.render({ canvasContext: ctx, viewport: vista }).promise;
      const blob = await new Promise<Blob | null>(ok => lienzo.toBlob(ok, 'image/jpeg', 0.82));
      if (blob) fotos.push(new File([blob], `${pdf.name.replace(/\.pdf$/i, '')}-p${n}.jpg`, { type: 'image/jpeg' }));
    }
    return fotos;
  } finally { void doc.destroy(); }
}
