/**
 * Huevo de pascua: el origen del nombre, que no está a la vista.
 * Se descubre escribiendo «lalan» en el teclado o tocando las cinco letras
 * de la sección «Lo que significa Lalan», en orden, sin pausa.
 * El texto va codificado para que no salga en buscadores ni a simple vista
 * en el código de la página.
 */
const SECRETO = 'eyJ0aXR1bG8iOiAiRWwgc2VjcmV0byBkZWwgbm9tYnJlIiwgInBhcnJhZm9zIjogWyJIYWNlIGHDsW9zLCB1biBoZXJtYW5pdG8gcXVlIHRvZGF2w61hIG5vIHNhYsOtYSBkZWNpciBlbCBub21icmUgZGUgc3UgaGVybWFuYSBsYSBsbGFtYWJhIMKrTGFsYW7Cuy4iLCAiU2UgbGUgcXVlZMOzLiBQcmltZXJvIGxvIGFkb3B0w7MgbGEgZmFtaWxpYSB5IGRlc3B1w6lzIGxvcyBhbWlnb3MgbcOhcyBjZXJjYW5vcywgcXVlIGxhIHNlZ3VpbW9zIGxsYW1hbmRvIGFzw60gaGFzdGEgaG95LiIsICJMYWxhbiBuYWNpw7MgY29uIGVzZSBjYXJpw7FvIGFkZW50cm86IGF0ZW5kZXIgYSBjYWRhIHBlcnNvbmEgY29tbyBzZSBhdGllbmRlIGEgYWxndWllbiBkZSBsYSBjYXNhLiJdLCAiY2llcnJlIjogIkVuY29udHJhc3RlIG51ZXN0cm8gc2VjcmV0by4gR3XDoXJkYWxvIGJpZW4uIn0=';
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
  const filas = Array.from(lista.children);
  let siguiente = 0;
  let ultimoToque = 0;
  lista.addEventListener('click', e => {
    const fila = (e.target as HTMLElement).closest('li');
    if (!fila) return;
    const ahora = Date.now();
    if (ahora - ultimoToque > PAUSA_MAXIMA_MS) siguiente = 0;
    ultimoToque = ahora;
    siguiente = filas.indexOf(fila) === siguiente ? siguiente + 1 : (filas.indexOf(fila) === 0 ? 1 : 0);
    if (siguiente === LETRAS) { siguiente = 0; mostrar(); }
  });
}
