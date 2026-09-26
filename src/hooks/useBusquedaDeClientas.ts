import { useEffect } from 'react';
import { useApp } from '../context/AppContext';

/**
 * Buscar clientas más allá de lo que hay cargado.
 *
 * El directorio ya no se trae entero al arrancar: viene por páginas. Eso
 * significa que cualquier pantalla que filtre la lista en local solo está
 * mirando lo que se cargó hasta ahora, y escribir el nombre de una clienta
 * que todavía no ha entrado al caché daría "no hay resultados" teniendo su
 * ficha guardada. Es el peor error posible, porque no parece un error:
 * parece una respuesta.
 *
 * Esto lo arregla en un solo sitio. Quien tenga un buscador de clientas lo
 * llama con su texto, y lo que el servidor encuentre se SUMA al caché — la
 * lista local nunca se reemplaza ni encoge. Así el filtro de cada pantalla
 * sigue funcionando exactamente igual que antes, solo que ahora el caché
 * contiene lo que hacía falta.
 *
 * El retardo evita una petición por tecla: se cancela en cada pulsación, y
 * la consulta sale cuando dejas de escribir.
 */
export function useBusquedaDeClientas(texto: string, minimo = 2) {
  const { buscarClientas } = useApp();

  useEffect(() => {
    const q = (texto ?? '').trim();
    if (q.length < minimo) return;      // con una letra sobran coincidencias
    const t = setTimeout(() => { void buscarClientas(q); }, 350);
    return () => clearTimeout(t);
  }, [texto, minimo, buscarClientas]);
}
