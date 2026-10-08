/**
 * El texto de una lista de servicios que la dueña ya tenía escrita: un
 * Excel, un Word, un CSV o unas notas. Se saca aquí, en el navegador, y al
 * servidor solo va el texto: es más rápido y barato que leer una foto, y el
 * servidor no tiene que abrir archivos de terceros.
 *
 * Las librerías se cargan solo cuando hacen falta (no pesan en la app).
 */

/** Lo que este extractor sabe abrir (para el `accept` del selector de archivos) */
export const ACEPTA_TEXTO = '.xlsx,.xls,.xlsm,.ods,.csv,.docx,.txt,.md';

/** Lo más largo que se manda (lo mismo que acepta el servidor) */
const LARGO_MAXIMO = 30_000;

export class ArchivoNoLegible extends Error {}

const extension = (nombre: string) => (nombre.split('.').pop() ?? '').toLowerCase();

/** ¿Este archivo es de los que se leen como texto (y no como foto o PDF)? */
export const esDeTexto = (f: File) => ACEPTA_TEXTO.split(',').includes(`.${extension(f.name)}`);

export async function textoDeArchivo(f: File): Promise<string> {
  const ext = extension(f.name);
  let texto = '';
  if (['xlsx', 'xls', 'xlsm', 'ods', 'csv'].includes(ext)) {
    const XLSX = await import('xlsx');
    const libro = XLSX.read(await f.arrayBuffer(), { type: 'array' });
    // Cada hoja como líneas separadas por comas, sin filas vacías: así la IA ve las columnas
    texto = libro.SheetNames
      .map((h) => {
        const csv = XLSX.utils.sheet_to_csv(libro.Sheets[h], { blankrows: false }).split('\n').filter((l) => l.replace(/,/g, '').trim()).join('\n');
        return csv ? (libro.SheetNames.length > 1 ? `# ${h}\n${csv}` : csv) : '';
      })
      .filter(Boolean)
      .join('\n\n');
  } else if (ext === 'docx') {
    const mammoth = await import('mammoth/mammoth.browser.js');
    texto = (await (mammoth as any).extractRawText({ arrayBuffer: await f.arrayBuffer() })).value ?? '';
  } else if (ext === 'txt' || ext === 'md') {
    texto = await f.text();
  } else {
    throw new ArchivoNoLegible(ext === 'doc'
      ? 'Ese Word es del formato viejo (.doc): guárdalo como .docx o copia y pega el texto.'
      : `No sé leer archivos .${ext}: usa Excel, Word, CSV, texto, una foto o un PDF.`);
  }
  texto = texto.replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
  if (!texto) throw new ArchivoNoLegible(`"${f.name}" no tiene texto que leer.`);
  return texto.length > LARGO_MAXIMO ? texto.slice(0, LARGO_MAXIMO) : texto;
}
