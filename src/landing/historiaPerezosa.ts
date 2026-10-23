/**
 * La historia en 3D pesa (Three.js son ~600 KB), así que no se baja con la
 * página: se carga cuando la sección se acerca a la pantalla. Mientras tanto
 * se ve una portada fija (.h-portada) con el título de la historia.
 *
 * Quien pidió menos movimiento se queda con la portada y el 3D se carga solo
 * si toca un botón de la historia.
 */
let cargando: Promise<void> | null = null;

function cargarThree(): Promise<void> {
  if ((window as unknown as { THREE?: unknown }).THREE) return Promise.resolve();
  return new Promise((listo) => {
    const s = document.createElement('script');
    s.src = '/landing/three.min.js';
    s.async = true;
    // Si Three.js no llega, la historia igual corre sin el 3D
    s.onload = () => listo();
    s.onerror = () => listo();
    document.head.appendChild(s);
  });
}

function cargar(raiz: HTMLElement): Promise<void> {
  if (!cargando) {
    raiz.classList.add('h-cargando');
    cargando = cargarThree()
      .then(() => import('./historia.js'))
      .then(() => {
        raiz.classList.remove('h-cargando');
        raiz.classList.add('h-lista');
      });
  }
  return cargando;
}

export function iniciarHistoria() {
  const raiz = document.getElementById('historia-escena');
  if (!raiz) return;
  const quieta = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Un toque en ▶, 🔇, ↺ o ⛶ antes de que cargue: se carga y se repite el toque
  const controles = raiz.querySelector('.h-controles');
  const alTocar = (e: Event) => {
    if (raiz.classList.contains('h-lista')) return;
    const boton = (e.target as Element).closest('button');
    if (!boton) return;
    e.stopImmediatePropagation();
    void cargar(raiz).then(() => {
      // Si ya arrancó sola al entrar en pantalla, ▶ la pausaría
      if (boton.id === 'h-play' && boton.getAttribute('aria-pressed') === 'true') return;
      boton.click();
    });
  };
  controles?.addEventListener('click', alTocar, true);

  if (quieta) return;
  if (!('IntersectionObserver' in window)) {
    void cargar(raiz);
    return;
  }
  const mirador = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) {
      mirador.disconnect();
      void cargar(raiz);
    }
  }, { rootMargin: '600px 0px' });
  mirador.observe(raiz);
}
