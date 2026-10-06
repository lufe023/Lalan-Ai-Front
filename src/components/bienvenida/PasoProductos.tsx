import React, { useEffect, useState } from 'react';
import { Check, Receipt } from 'lucide-react';
import { bienvenidaApi } from '../../services/bienvenida';
import type { ProductoBienvenida, ProductoLeido } from '../../types/bienvenida';
import { Aviso, BotonFoto, BotonPrincipal, BotonSecundario, Cargando, Encabezado, Tarjeta, claseCampo, conArticulo, dinero, leerNumero } from './comun';

interface Borrador { costo: string; entran: string }
interface RenglonFactura extends ProductoLeido { usar: boolean; cantidadTexto: string; costoTexto: string }

/**
 * Paso 7: lo que cuesta cada producto y cuántos hay. Con el costo, los
 * informes dicen cuánto deja cada servicio; con la cantidad, Lalan avisa
 * antes de que se acabe. La foto de la factura del suplidor lo llena de una vez.
 */
export const PasoProductos: React.FC<{ onSiguiente: () => void }> = ({ onSiguiente }) => {
  const [productos, setProductos] = useState<ProductoBienvenida[] | null>(null);
  const [borradores, setBorradores] = useState<Record<string, Borrador>>({});
  const [factura, setFactura] = useState<RenglonFactura[] | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [hecho, setHecho] = useState('');

  const cargar = (lista: ProductoBienvenida[]) => {
    // Los que van en recetas primero: son los que mueven los informes
    setProductos([...lista].sort((a, b) => b.enRecetas - a.enRecetas || a.nombre.localeCompare(b.nombre)));
    setBorradores(Object.fromEntries(lista.map((p) => [p.productId, { costo: p.costo != null ? String(p.costo) : '', entran: '' }])));
  };
  useEffect(() => { bienvenidaApi.productos().then(cargar).catch((e) => setError((e as Error).message)); }, []);

  const leerFactura = async (fotos: File[]) => {
    setError(''); setHecho('');
    setLeyendo(true);
    try {
      const leidos = await bienvenidaApi.fotoFactura(fotos);
      if (!leidos.length) { setError('No encontré productos en esa foto. Prueba con una más clara y derecha.'); return; }
      setFactura(leidos.map((l) => ({ ...l, usar: true, cantidadTexto: l.cantidad != null ? String(l.cantidad) : '', costoTexto: l.costo != null ? String(l.costo) : '' })));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLeyendo(false);
    }
  };

  const guardarFactura = async () => {
    if (!factura) return;
    setError('');
    const lista = factura.filter((r) => r.usar).map((r) => ({
      ...(r.productIdExistente ? { productId: r.productIdExistente } : r.plantilla ? { plantilla: r.plantilla } : { nombre: r.leido }),
      cantidad: leerNumero(r.cantidadTexto) ?? undefined,
      costo: leerNumero(r.costoTexto) ?? undefined,
    }));
    if (!lista.length) { setFactura(null); return; }
    setGuardando(true);
    try {
      const r = await bienvenidaApi.guardarProductos(lista);
      cargar(r.productos);
      setFactura(null);
      setHecho(`Listo: cargué ${r.guardados.length} productos de la factura.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  const seguir = async () => {
    setError('');
    const cambios = (productos ?? []).flatMap((p) => {
      const b = borradores[p.productId];
      if (!b) return [];
      const costo = leerNumero(b.costo);
      const entran = leerNumero(b.entran);
      const cambioCosto = costo != null && costo !== p.costo;
      if (!cambioCosto && !entran) return [];
      return [{ productId: p.productId, ...(cambioCosto ? { costo } : {}), ...(entran ? { cantidad: entran } : {}) }];
    });
    setGuardando(true);
    try {
      if (cambios.length) await bienvenidaApi.guardarProductos(cambios);
      onSiguiente();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  if (!productos && !error) return <Cargando />;

  if (factura) {
    return (
      <div className="space-y-5">
        <Encabezado titulo="Revisa la factura" texto="Esto es lo que leí. Corrige lo que haga falta y desmarca lo que no quieras cargar." />
        {factura.map((r, i) => {
          const cambiar = (c: Partial<RenglonFactura>) => setFactura((f) => f!.map((x, j) => (j === i ? { ...x, ...c } : x)));
          return (
            <Tarjeta key={i} className={`space-y-2 ${r.usar ? '' : 'opacity-50'}`}>
              <button type="button" onClick={() => cambiar({ usar: !r.usar })} className="w-full flex items-start gap-3 text-left cursor-pointer">
                <span className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${r.usar ? 'bg-[var(--primary)] border-[var(--primary)]' : 'border-slate-300'}`}>
                  {r.usar && <Check className="w-3.5 h-3.5 text-white" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[0.875rem] font-semibold text-slate-900 dark:text-white">{r.leido}</span>
                  <span className="block text-[0.75rem] text-slate-400">
                    {r.productoExistente ? `Se suma a: ${r.productoExistente}` : r.plantillaNombre ? `Producto nuevo: ${r.plantillaNombre}` : 'Producto nuevo'}
                  </span>
                </span>
              </button>
              {r.usar && (
                <div className="flex gap-2 pl-8">
                  <input value={r.cantidadTexto} onChange={(e) => cambiar({ cantidadTexto: e.target.value })} inputMode="decimal" placeholder="Cantidad" aria-label="Cantidad" className={`${claseCampo} flex-1`} />
                  <input value={r.costoTexto} onChange={(e) => cambiar({ costoTexto: e.target.value })} inputMode="decimal" placeholder="Costo c/u" aria-label="Costo de cada uno" className={`${claseCampo} flex-1`} />
                </div>
              )}
            </Tarjeta>
          );
        })}
        {error && <Aviso tipo="error">{error}</Aviso>}
        <div className="flex gap-2">
          <BotonSecundario onClick={() => setFactura(null)} className="flex-1">Cancelar</BotonSecundario>
          <BotonPrincipal onClick={guardarFactura} cargando={guardando} className="flex-[2]">Cargar al inventario</BotonPrincipal>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Encabezado titulo="Tus productos" texto="Pon lo que te cuesta cada uno y, si quieres, cuántos tienes. Lo que no sepas, déjalo en blanco." />
      <Tarjeta className="space-y-2">
        <p className="text-[0.875rem] text-slate-600 dark:text-neutral-300 flex items-start gap-2">
          <Receipt className="w-4 h-4 mt-0.5 shrink-0 text-[var(--primary)]" />
          ¿Tienes a mano la última factura de tu suplidor? Tómale una foto y cargo productos, cantidades y costos.
        </p>
        <BotonFoto texto="Foto de la factura" cargando={leyendo} onFotos={leerFactura} />
        {hecho && <Aviso>{hecho}</Aviso>}
      </Tarjeta>

      {!!productos?.length && (
        <Tarjeta className="!p-0 divide-y divide-slate-100 dark:divide-neutral-800">
          {productos.map((p) => {
            const b = borradores[p.productId];
            if (!b) return null;
            const cambiar = (c: Partial<Borrador>) => setBorradores((x) => ({ ...x, [p.productId]: { ...x[p.productId], ...c } }));
            return (
              <div key={p.productId} className="p-3.5 space-y-2">
                <div>
                  <div className="text-[0.9375rem] font-semibold text-slate-900 dark:text-white">{p.nombre}</div>
                  <div className="text-[0.75rem] text-slate-400">
                    {p.presentacion ? `${conArticulo(p.presentacion)} · ` : ''}Tienes {dinero(p.cantidad)}
                  </div>
                </div>
                <div className="flex gap-2">
                  <input value={b.costo} onChange={(e) => cambiar({ costo: e.target.value })} inputMode="decimal" placeholder="Te cuesta" aria-label={`Costo de ${p.nombre}`} className={`${claseCampo} flex-1`} />
                  <input value={b.entran} onChange={(e) => cambiar({ entran: e.target.value })} inputMode="decimal" placeholder={p.cantidad ? 'Agregar' : 'Tienes'} aria-label={`Cuántos agregar de ${p.nombre}`} className={`${claseCampo} flex-1`} />
                </div>
              </div>
            );
          })}
        </Tarjeta>
      )}
      {!productos?.length && <Aviso>Todavía no hay productos. Se crean solos con las recetas de tus servicios, o con la foto de una factura.</Aviso>}

      {error && <Aviso tipo="error">{error}</Aviso>}
      <div className="sticky bottom-0 -mx-4 px-4 pt-3 pb-1 bg-gradient-to-t from-[#f8fafc] dark:from-[#09090b] via-[#f8fafc] dark:via-[#09090b] to-transparent">
        <BotonPrincipal onClick={seguir} cargando={guardando} className="w-full">Siguiente</BotonPrincipal>
      </div>
    </div>
  );
};
