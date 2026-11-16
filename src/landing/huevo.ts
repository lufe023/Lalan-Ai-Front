/**
 * Huevo de pascua: el origen del nombre, que no está a la vista.
 * Se descubre escribiendo «lalan» en el teclado o tocando las cinco letras
 * de «Live Assistant for Logistics, Appointments & Networking» en el pie,
 * en orden, sin pausa.
 * El texto va codificado para que no salga en buscadores ni a simple vista
 * en el código de la página.
 */
const SECRETO = 'eyJ0aXR1bG8iOiAiRWwgc2VjcmV0byBkZWwgbm9tYnJlIiwgInBhcnJhZm9zIjogWyJBbnRlcyBkZSBzZXIgdW5hIGFzaXN0ZW50ZSwgTGFsYW4gZnVlIHVuYSBwYWxhYnJhIHRvcnBlIHkgdGllcm5hLiBMYSBkaWpvIHVuIG5pw7FvIHF1ZSB0b2RhdsOtYSBubyBwb2TDrWEgcHJvbnVuY2lhciBlbCBub21icmUgZGUgc3UgaGVybWFuYTogbG8gaW50ZW50YWJhLCBzZSBsZSBlbnJlZGFiYSBsYSBsZW5ndWEgeSBsZSBzYWzDrWEgwqtMYWxhbsK7LiIsICJFbGxhIHNlIHJlw61hIHkgbGUgY29udGVzdGFiYS4gw4lsIGxvIHJlcGV0w61hIG9yZ3VsbG9zbywgY29tbyBxdWllbiBhY2FiYSBkZSBpbnZlbnRhciBhbGdvLiBZIGVuIGNpZXJ0byBtb2RvIGxvIGhhYsOtYSBoZWNoby4iLCAiU2UgcXVlZMOzLiBQcmltZXJvIGVuIGxhIGNhc2EsIGVuIGxhIG1lc2EgeSBlbiBsb3MgY3VtcGxlYcOxb3MuIERlc3B1w6lzIGVudHJlIGxvcyBhbWlnb3MgZGUgc2llbXByZSwgcXVlIHRvZGF2w61hIGhveSBsYSBsbGFtYW1vcyBhc8OtLiIsICJDdWFuZG8gbmFjacOzIHVuYSBhc2lzdGVudGUgcGFyYSBhdGVuZGVyIGEgY2FkYSBjbGllbnRhIGNvbW8gc2UgYXRpZW5kZSBhIGFsZ3VpZW4gZGUgbGEgY2FzYSwgbm8gaHVibyBxdWUgYnVzY2FyIG5vbWJyZS4gWWEgbG8gdGVuw61hbW9zLiBTb2xvIGZhbHRhYmEgcXVlIGxhcyBsZXRyYXMgZGlqZXJhbiBsbyBxdWUgZWwgY2FyacOxbyB5YSBzYWLDrWE6IExpdmUgQXNzaXN0YW50IGZvciBMb2dpc3RpY3MsIEFwcG9pbnRtZW50cyAmIE5ldHdvcmtpbmcuIiwgIkNhZGEgdmV6IHF1ZSBMYWxhbiBzYWx1ZGEgYSB1bmEgY2xpZW50YSBwb3Igc3Ugbm9tYnJlIG8gcmVjdWVyZGEgc3UgY2Fmw6kgeSBzdSBjYW5jacOzbiwgbGxldmEgZGVudHJvIHVuIHBvcXVpdG8gZGUgYXF1ZWxsYSBwYWxhYnJhIGRlIG5pw7FvLiJdLCAiY2llcnJlIjogIkVuY29udHJhc3RlIG51ZXN0cm8gc2VjcmV0by4gQWhvcmEgZXJlcyBkZSBsYSBjYXNhLiJ9';
const PALABRA = 'lalan';
const LETRAS = 5;
/** Tiempo máximo entre un toque (o una tecla) y el siguiente */
const PAUSA_MAXIMA_MS = 1500;

interface Historia { titulo: string; parrafos: string[]; cierre: string }

function leer(): Historia {
  const bytes = Uint8Array.from(atob(SECRETO), c => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

function mostrar() {
  if (document.getElementById('huevo')) return;
  const h = leer();
  const d = document.createElement('dialog');
  d.id = 'huevo';
  d.className = 'huevo';
  d.setAttribute('aria-labelledby', 'huevo-titulo');
  const marca = document.createElement('span');
  marca.className = 'marca-logo';
  marca.innerHTML = document.querySelector('.barra .marca-logo')?.innerHTML ?? 'L';
  const t = document.createElement('h3');
  t.id = 'huevo-titulo';
  t.textContent = h.titulo;
  d.append(marca, t);
  h.parrafos.forEach(texto => { const p = document.createElement('p'); p.textContent = texto; d.append(p); });
  const cierre = document.createElement('p');
  cierre.className = 'huevo-cierre';
  cierre.textContent = h.cierre;
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.textContent = 'Cerrar';
  boton.addEventListener('click', () => d.close());
  d.append(cierre, boton);
  d.addEventListener('close', () => d.remove());
  d.addEventListener('click', e => { if (e.target === d) d.close(); });
  document.body.append(d);
  d.showModal();
}

export function iniciarHuevo() {
  // Escribir «lalan» en cualquier parte (menos dentro de un formulario)
  let escrito = '';
  let ultimaTecla = 0;
  window.addEventListener('keydown', e => {
    const destino = e.target as HTMLElement | null;
    if (destino?.closest('input, textarea, select, [contenteditable]') || e.key.length !== 1) return;
    const ahora = Date.now();
    if (ahora - ultimaTecla > PAUSA_MAXIMA_MS) escrito = '';
    ultimaTecla = ahora;
    escrito = (escrito + e.key.toLowerCase()).slice(-PALABRA.length);
    if (escrito === PALABRA) { escrito = ''; mostrar(); }
  });

  // Tocar las cinco letras en orden: L · A · L · A · N
  const lista = document.getElementById('siglas');
  if (!lista) return;
  const filas = Array.from(lista.querySelectorAll('b'));
  let siguiente = 0;
  let ultimoToque = 0;
  let apagar = 0;
  // Cada letra acertada se enciende: la pista de que se va por buen camino
  const encender = (cuantas: number) => {
    filas.forEach((f, i) => f.classList.toggle('encendida', i < cuantas));
    window.clearTimeout(apagar);
    if (cuantas > 0) apagar = window.setTimeout(() => { siguiente = 0; encender(0); }, PAUSA_MAXIMA_MS);
  };
  lista.addEventListener('click', e => {
    const fila = (e.target as HTMLElement).closest('b');
    if (!fila) return;
    const ahora = Date.now();
    if (ahora - ultimoToque > PAUSA_MAXIMA_MS) siguiente = 0;
    ultimoToque = ahora;
    siguiente = filas.indexOf(fila) === siguiente ? siguiente + 1 : (filas.indexOf(fila) === 0 ? 1 : 0);
    encender(siguiente);
    if (siguiente === LETRAS) {
      siguiente = 0;
      // Un instante con las cinco encendidas antes de abrir el secreto
      window.setTimeout(() => { encender(0); mostrar(); }, 250);
    }
  });
}
