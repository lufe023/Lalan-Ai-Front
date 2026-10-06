/**
 * Las clientas a la agenda del teléfono de la dueña: un archivo de contactos
 * (.vcf, vCard 3.0) que abren el iPhone y Android. Así los números no viven
 * solo dentro de Lalan.
 *
 * Cada contacto lleva su FOTO (la dueña las reconoce por la cara antes que
 * por el nombre) y su Instagram, si escribió por ahí. En el teléfono se
 * entrega por el menú "Compartir" (de ahí a Contactos); donde no hay, se
 * descarga.
 */
import { api, urlDeFoto } from '../services/api';

interface Contacto { id: string; name: string; phone: string | null; email: string | null; avatar: string | null; instagram: string | null }

/** Lado de la foto en el contacto: de sobra para la agenda y el archivo no pesa */
const LADO_FOTO = 160;
const CALIDAD_FOTO = 0.82;
/** Fotos que se bajan a la vez */
const A_LA_VEZ = 6;
/** vCard corta las líneas largas a 75 caracteres (las fotos van en base64) */
const LARGO_LINEA = 75;
/** Las iniciales de la app no son una foto: el teléfono pone las suyas */
const RELLENO = /^https?:\/\/ui-avatars\.com\//;

/** vCard pide escapar comas, punto y coma, barras y saltos de línea */
const escapar = (t: string) => t.replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\r?\n/g, '\\n');

/** Una línea larga, partida como manda vCard (las de continuación empiezan con un espacio) */
function plegar(linea: string): string {
  if (linea.length <= LARGO_LINEA) return linea;
  const partes = [linea.slice(0, LARGO_LINEA)];
  for (let i = LARGO_LINEA; i < linea.length; i += LARGO_LINEA - 1) partes.push(' ' + linea.slice(i, i + LARGO_LINEA - 1));
  return partes.join('\r\n');
}

function tarjeta(c: Contacto, salon: string, foto: string | null): string {
  const nombre = c.name.trim() || 'Clienta';
  const partes = nombre.split(/\s+/);
  const apellidos = partes.length > 1 ? partes.slice(1).join(' ') : '';
  const lineas = [
    'BEGIN:VCARD', 'VERSION:3.0',
    `FN:${escapar(nombre)}`,
    `N:${escapar(apellidos)};${escapar(partes[0])};;;`,
    `TEL;TYPE=CELL:${(c.phone ?? '').replace(/[^\d+]/g, '')}`,
    ...(c.email ? [`EMAIL:${escapar(c.email)}`] : []),
    ...(c.instagram ? [
      `X-SOCIALPROFILE;TYPE=instagram:https://www.instagram.com/${encodeURIComponent(c.instagram)}/`,
      `URL:https://www.instagram.com/${encodeURIComponent(c.instagram)}/`,
    ] : []),
    ...(foto ? [plegar(`PHOTO;ENCODING=b;TYPE=JPEG:${foto}`)] : []),
    `ORG:${escapar(salon)}`,
    `NOTE:${escapar(`Clienta de ${salon} (guardada desde Lalan)${c.instagram ? ` · Instagram @${c.instagram}` : ''}`)}`,
    'CATEGORIES:Clientas',
    'END:VCARD',
  ];
  return lineas.join('\r\n');
}

/** La foto, cuadrada y chica, en JPEG base64 (sin el "data:…,"). null si no se pudo */
async function fotoEnBase64(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { mode: 'cors' });
    if (!r.ok) return null;
    const imagen = await createImageBitmap(await r.blob());
    const lado = Math.min(imagen.width, imagen.height);
    const lienzo = document.createElement('canvas');
    lienzo.width = lienzo.height = LADO_FOTO;
    // Recorte al centro: las fotos de perfil ya son casi cuadradas
    lienzo.getContext('2d')!.drawImage(imagen, (imagen.width - lado) / 2, (imagen.height - lado) / 2, lado, lado, 0, 0, LADO_FOTO, LADO_FOTO);
    return lienzo.toDataURL('image/jpeg', CALIDAD_FOTO).split(',')[1] ?? null;
  } catch {
    // Una foto de otro sitio que no deja leerla, o que ya no existe: el contacto va sin foto
    return null;
  }
}

async function fotosDe(lista: Contacto[]): Promise<Map<string, string>> {
  const fotos = new Map<string, string>();
  const pendientes = lista.filter(c => c.avatar && !RELLENO.test(c.avatar));
  for (let i = 0; i < pendientes.length; i += A_LA_VEZ) {
    await Promise.all(pendientes.slice(i, i + A_LA_VEZ).map(async c => {
      const f = await fotoEnBase64(urlDeFoto(c.avatar)!);
      if (f) fotos.set(c.id, f);
    }));
  }
  return fotos;
}

export interface ArchivoDeContactos { archivo: File; cantidad: number; conFoto: number }

/** Arma el archivo con todas las clientas que tienen teléfono (con su foto) */
export async function prepararContactos(salon: string): Promise<ArchivoDeContactos> {
  const lista = await api.get<Contacto[]>('/clients/contactos');
  const conTelefono = lista.filter(c => (c.phone ?? '').replace(/\D/g, '').length >= 7);
  const fotos = await fotosDe(conTelefono);
  const texto = conTelefono.map(c => tarjeta(c, salon, fotos.get(c.id) ?? null)).join('\r\n') + '\r\n';
  const nombre = `clientas-${salon.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.vcf`;
  return { archivo: new File([texto], nombre, { type: 'text/vcard' }), cantidad: conTelefono.length, conFoto: fotos.size };
}

/** ¿Este teléfono puede pasarlo por "Compartir" (iPhone y Android, también con la app instalada)? */
export function sePuedeCompartir(archivo: File): boolean {
  const esTactil = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  return !!esTactil && typeof navigator.canShare === 'function' && navigator.canShare({ files: [archivo] });
}

/**
 * Lo entrega: por "Compartir" en el teléfono (de ahí a Contactos), o como
 * descarga. Compartir necesita que la persona acabe de tocar algo, por eso
 * va aparte de prepararlo (las fotos tardan unos segundos).
 * Devuelve false si la persona cerró el menú sin elegir.
 */
export async function entregarContactos(archivo: File): Promise<boolean> {
  if (sePuedeCompartir(archivo)) {
    try {
      await navigator.share({ files: [archivo], title: 'Mis clientas' });
      return true;
    } catch (e) {
      if ((e as DOMException)?.name === 'AbortError') return false;
      // Si el teléfono no lo dejó compartir, se descarga
    }
  }
  const url = URL.createObjectURL(archivo);
  const a = document.createElement('a');
  a.href = url;
  a.download = archivo.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return true;
}
