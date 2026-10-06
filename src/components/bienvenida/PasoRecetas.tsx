import React, { useEffect, useState } from 'react';
import { Check, ChevronDown, Trash2 } from 'lucide-react';
import { bienvenidaApi } from '../../services/bienvenida';
import type { RecetaServicio } from '../../types/bienvenida';
import { Aviso, BotonPrincipal, BotonSecundario, Cargando, Encabezado, Tarjeta, claseCampo, conArticulo, leerNumero } from './comun';

/**
 * Paso 6: lo que lleva cada servicio, dicho como ella lo sabe: "un frasco
 * de gel me da para 40 manos". Lo que vino de la plantilla está ESTIMADO;
 * ella lo confirma o lo corrige. Lo que no sepa hoy, Lalan se lo pregunta
 * después con el uso.
 */
export const PasoRecetas: React.FC<{ onSiguiente: () => void }> = ({ onSiguiente }) => {
  const [recetas, setRecetas] = useState<RecetaServicio[] | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [valores, setValores] = useState<Record<string, string>>({});
  const [quitar, setQuitar] = useState<Set<string>>(new Set());
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState('');

  const llave = (serviceId: string, productId: string) => `${serviceId}:${productId}`;

  const cargar = (lista: RecetaServicio[]) => {
    // Primero las que hay que confirmar
    const ordenadas = [...lista].sort((a, b) => Number(b.estimada) - Number(a.estimada));
    setRecetas(ordenadas);
    setValores(Object.fromEntries(ordenadas.flatMap((r) => r.lineas.map((l) => [llave(r.serviceId, l.productId), l.rinde != null ? String(l.rinde) : '']))));
    setAbierta((a) => a ?? ordenadas.find((r) => r.estimada)?.serviceId ?? null);
  };
  useEffect(() => { bienvenidaApi.recetas().then(cargar).catch((e) => setError((e as Error).message)); }, []);

  /** Confirma el servicio entero: lo que dejó igual queda confirmado, lo que cambió se recalcula */
  const confirmar = async (r: RecetaServicio) => {
    setError('');
    const lineas = r.lineas.map((l) => {
      const k = llave(r.serviceId, l.productId);
      return { productId: l.productId, rinde: quitar.has(k) ? null : leerNumero(valores[k] ?? '') };
    });
    const sinNumero = r.lineas.find((l, i) => !quitar.has(llave(r.serviceId, l.productId)) && !lineas[i].rinde);
    if (sinNumero) { setError(`Dime para cuántas ${r.palabra.varias} te rinde ${sinNumero.insumo.toLowerCase()}, o quítalo.`); return; }
    setGuardando(r.serviceId);
    try {
      await bienvenidaApi.rendimiento(r.serviceId, lineas);
      const lista = await bienvenidaApi.recetas();
      setQuitar(new Set());
      // Se abre la siguiente que falta confirmar
      setAbierta(lista.find((x) => x.estimada && x.serviceId !== r.serviceId)?.serviceId ?? null);
      cargar(lista);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(null);
    }
  };

  if (!recetas && !error) return <Cargando />;
  const conReceta = (recetas ?? []).filter((r) => r.lineas.length);
  const pendientes = conReceta.filter((r) => r.estimada).length;

  return (
    <div className="space-y-5">
      <Encabezado
        titulo="¿Para cuántos te rinde?"
        texto="No hace falta saber cuántos mililitros usas: dime para cuántos servicios te da cada producto. Con eso calculo lo que te cuesta cada servicio y te aviso antes de que se acabe."
      />
      <Aviso>
        {pendientes
          ? `Puse lo típico de un salón. Te faltan ${pendientes} por confirmar; lo que no sepas hoy, déjalo: yo te lo pregunto cuando lo uses.`
          : 'Todas tus recetas están confirmadas. 🎉'}
      </Aviso>

      {conReceta.map((r) => {
        const abiertaEsta = abierta === r.serviceId;
        return (
          <Tarjeta key={r.serviceId} className="!p-0 overflow-hidden">
            <button type="button" onClick={() => setAbierta(abiertaEsta ? null : r.serviceId)} className="w-full flex items-center gap-3 p-3.5 text-left cursor-pointer">
              <span className="flex-1 min-w-0">
                <span className="block font-semibold text-[0.9375rem] text-slate-900 dark:text-white">{r.servicio}</span>
                <span className="block text-[0.75rem] text-slate-400">{r.lineas.length} productos · {r.categoria}</span>
              </span>
              {r.estimada
                ? <span className="text-[0.6875rem] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">Por confirmar</span>
                : <span className="text-[0.6875rem] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200 flex items-center gap-1"><Check className="w-3 h-3" /> Lista</span>}
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${abiertaEsta ? 'rotate-180' : ''}`} />
            </button>
            {abiertaEsta && (
              <div className="px-3.5 pb-3.5 space-y-2.5 border-t border-slate-100 dark:border-neutral-800 pt-3">
                <p className="text-[0.75rem] text-slate-500 dark:text-neutral-400">Un envase de cada producto te rinde para…</p>
                {r.lineas.map((l) => {
                  const k = llave(r.serviceId, l.productId);
                  const quitada = quitar.has(k);
                  return (
                    <div key={k} className={`flex items-center gap-2 ${quitada ? 'opacity-40' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <div className="text-[0.875rem] font-semibold leading-snug text-slate-800 dark:text-neutral-100">{l.insumo}</div>
                        <div className="text-[0.75rem] text-slate-400">
                          {l.presentacion ? conArticulo(l.presentacion) : 'Un envase'}{l.estimada ? ' · estimado' : ''}
                        </div>
                      </div>
                      <input
                        value={valores[k] ?? ''}
                        onChange={(e) => setValores((v) => ({ ...v, [k]: e.target.value }))}
                        disabled={quitada}
                        inputMode="numeric"
                        aria-label={`Para cuántas ${r.palabra.varias} rinde ${l.insumo}`}
                        className={`${claseCampo} !w-20 text-center`}
                      />
                      <span className="text-[0.75rem] text-slate-500 w-12">{r.palabra.varias}</span>
                      <button type="button" aria-label={quitada ? 'Volver a poner' : 'No lo uso'}
                        onClick={() => setQuitar((q) => { const n = new Set(q); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
                        className="p-1.5 text-slate-400 hover:text-rose-500 cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
                <BotonPrincipal onClick={() => confirmar(r)} cargando={guardando === r.serviceId} className="w-full !py-2.5">
                  <Check className="w-4 h-4" /> Así es
                </BotonPrincipal>
              </div>
            )}
          </Tarjeta>
        );
      })}

      {!conReceta.length && <Aviso>Tus servicios todavía no tienen productos. Los puedes agregar en Catálogo cuando quieras.</Aviso>}
      {error && <Aviso tipo="error">{error}</Aviso>}
      {pendientes > 0
        ? <BotonSecundario onClick={onSiguiente} className="w-full">Lo completo después, pregúntame tú</BotonSecundario>
        : <BotonPrincipal onClick={onSiguiente} className="w-full">Siguiente</BotonPrincipal>}
    </div>
  );
};
