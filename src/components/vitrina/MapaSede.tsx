import React, { useEffect, useRef } from 'react';
import type { Map as MapaLeaflet, Marker } from 'leaflet';

export interface PuntoMapa { latitud: number; longitud: number }

/** Leaflet se carga solo cuando hay un mapa a la vista: la app no lo paga al abrir */
const cargarLeaflet = async () => {
  const [L] = await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]);
  return L.default ?? L;
};

/** El pin con el color de la página (los íconos de Leaflet no sobreviven al empaquetado) */
const pin = (L: typeof import('leaflet'), color: string) => L.divIcon({
  className: '',
  html: `<svg width="34" height="44" viewBox="0 0 34 44" aria-hidden="true"><path d="M17 43C17 43 32 27.5 32 17A15 15 0 0 0 2 17C2 27.5 17 43 17 43Z" fill="${color}" stroke="white" stroke-width="2.5"/><circle cx="17" cy="17" r="5.5" fill="white"/></svg>`,
  iconSize: [34, 44],
  iconAnchor: [17, 43],
});

/**
 * Un mapa de OpenStreetMap con el local. En la Vitrina es para mirar (en el
 * teléfono no se arrastra, así no atrapa el dedo al bajar por la página);
 * en Ajustes la dueña mueve el pin o toca donde está la puerta.
 */
export default function MapaSede({ punto, color = '#C46B7C', alto = 200, cambiar, etiqueta }: {
  punto: PuntoMapa | null;
  color?: string;
  alto?: number;
  /** Con esto, el pin se mueve */
  cambiar?: (p: PuntoMapa) => void;
  etiqueta: string;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapaLeaflet | null>(null);
  const marca = useRef<Marker | null>(null);
  const ponerPin = useRef<((p: PuntoMapa) => void) | null>(null);
  const alCambiar = useRef(cambiar);
  alCambiar.current = cambiar;
  const editable = !!cambiar;

  useEffect(() => {
    let vivo = true;
    void cargarLeaflet().then((L) => {
      if (!vivo || !caja.current) return;
      const m = L.map(caja.current, {
        zoomControl: editable, attributionControl: true, scrollWheelZoom: editable,
        dragging: editable || !L.Browser.mobile, touchZoom: editable, doubleClickZoom: editable,
      });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      mapa.current = m;
      const poner = (p: PuntoMapa) => {
        if (marca.current) marca.current.setLatLng([p.latitud, p.longitud]);
        else {
          marca.current = L.marker([p.latitud, p.longitud], { icon: pin(L, color), draggable: editable, title: etiqueta }).addTo(m);
          marca.current.on('dragend', () => {
            const ll = marca.current!.getLatLng();
            alCambiar.current?.({ latitud: ll.lat, longitud: ll.lng });
          });
        }
      };
      if (punto) { poner(punto); m.setView([punto.latitud, punto.longitud], 16); } else m.setView([15, -70], 3);
      if (editable) {
        m.on('click', (e) => {
          poner({ latitud: e.latlng.lat, longitud: e.latlng.lng });
          alCambiar.current?.({ latitud: e.latlng.lat, longitud: e.latlng.lng });
        });
      }
      ponerPin.current = poner;
    });
    return () => { vivo = false; mapa.current?.remove(); mapa.current = null; marca.current = null; ponerPin.current = null; };
    // El mapa se arma una vez; los cambios de punto se aplican abajo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable, color]);

  // Cuando el punto llega de afuera (buscar la dirección, "estoy aquí"), el pin y el mapa van ahí
  useEffect(() => {
    const m = mapa.current;
    if (!m) return;
    if (!punto) { marca.current?.remove(); marca.current = null; return; }
    const actual = marca.current?.getLatLng();
    if (actual && Math.abs(actual.lat - punto.latitud) < 1e-7 && Math.abs(actual.lng - punto.longitud) < 1e-7) return;
    ponerPin.current?.(punto);
    m.setView([punto.latitud, punto.longitud], Math.max(m.getZoom(), 16));
  }, [punto]);

  return <div ref={caja} role={editable ? undefined : 'img'} aria-label={etiqueta} className="relative z-0 w-full overflow-hidden rounded-2xl bg-[#e8e4e1]" style={{ height: alto }} />;
}
