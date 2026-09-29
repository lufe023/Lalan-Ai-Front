/**
 * Las clientas a la agenda del teléfono de la dueña: un archivo de contactos
 * (.vcf, vCard 3.0) que abren el iPhone y Android. Así los números no viven
 * solo dentro de Lalan.
 */
import { api } from '../services/api';

interface Contacto { id: string; name: string; phone: string | null; email: string | null }

/** vCard pide escapar comas, punto y coma, barras y saltos de línea */
const escapar = (t: string) => t.replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\r?\n/g, '\\n');

function tarjeta(c: Contacto, salon: string): string {
  const nombre = c.name.trim() || 'Clienta';
  const partes = nombre.split(/\s+/);
  const apellidos = partes.length > 1 ? partes.slice(1).join(' ') : '';
  const lineas = [
    'BEGIN:VCARD', 'VERSION:3.0',
    `FN:${escapar(nombre)}`,
    `N:${escapar(apellidos)};${escapar(partes[0])};;;`,
    `TEL;TYPE=CELL:${(c.phone ?? '').replace(/[^\d+]/g, '')}`,
    ...(c.email ? [`EMAIL:${escapar(c.email)}`] : []),
    `ORG:${escapar(salon)}`,
    `NOTE:${escapar(`Clienta de ${salon} (guardada desde Lalan)`)}`,
    'CATEGORIES:Clientas',
    'END:VCARD',
  ];
  return lineas.join('\r\n');
}

/** Baja el archivo con todas las clientas que tienen teléfono. Devuelve cuántas iban. */
export async function exportarContactos(salon: string): Promise<number> {
  const lista = await api.get<Contacto[]>('/clients/contactos');
  const conTelefono = lista.filter(c => (c.phone ?? '').replace(/\D/g, '').length >= 7);
  const texto = conTelefono.map(c => tarjeta(c, salon)).join('\r\n') + '\r\n';
  const blob = new Blob([texto], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `clientas-${salon.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.vcf`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return conTelefono.length;
}
