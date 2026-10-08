import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FondoVivo } from '../ui/FondoVivo';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronLeft, PartyPopper, Sparkles, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { abrirLalan } from '../lalan/PantallaLalan';
import { alPedirBienvenida, avisarCambioBienvenida, bienvenidaApi, bienvenidaPospuesta, posponerBienvenida } from '../../services/bienvenida';
import type { EstadoBienvenida, Paso } from '../../types/bienvenida';
import { Aviso, BotonPrincipal, BotonSecundario, Cargando } from './comun';
import { PasoSalon } from './PasoSalon';
import { PasoHorario, PasoSedes } from './PasoSedes';
import { PasoEspecialistas } from './PasoEspecialistas';
import { PasoServicios } from './PasoServicios';
import { PasoRecetas } from './PasoRecetas';
import { PasoProductos } from './PasoProductos';

/** Además de los pasos del servidor, una pantalla de entrada y una de cierre */
type Pantalla = 'inicio' | Paso | 'final';

/** Configurar el salón lo hace la dirección; el resto del equipo nunca la ve */
const puedeConfigurar = (rol?: string) => rol === 'admin' || rol === 'super_admin';

/**
 * La Bienvenida: el "primer acercamiento". La primera vez que la dueña entra,
 * se abre sola y la lleva paso a paso (siguiente, siguiente, marco casillas,
 * pongo precios). Puede salir cuando quiera ("Ahora no") y seguir después
 * desde el aviso "Tu salón está al 70 %" o desde Ajustes.
 */
export const Bienvenida: React.FC = () => {
  const { currentUser, isAuthenticated } = useAuth();
  const { recargarCatalogo } = useApp();
  const [abierta, setAbierta] = useState(false);
  const [estado, setEstado] = useState<EstadoBienvenida | null>(null);
  const [pantalla, setPantalla] = useState<Pantalla>('inicio');
  const [terminando, setTerminando] = useState(false);
  const [error, setError] = useState('');
  const puede = isAuthenticated && puedeConfigurar(currentUser?.role);

  const refrescar = useCallback(async () => {
    const e = await bienvenidaApi.estado();
    setEstado(e);
    return e;
  }, []);

  // La primera vez se abre sola (solo a la dueña, no a soporte ni a Lalan)
  useEffect(() => {
    if (!puede || currentUser?.role !== 'admin' || currentUser?.soporte) return;
    refrescar()
      .then((e) => {
        if (!e.mostrar || bienvenidaPospuesta()) return;
        setPantalla(e.porcentaje > 10 && e.siguiente ? e.siguiente : 'inicio');
        setAbierta(true);
      })
      .catch(() => undefined);
  }, [puede, currentUser?.role, currentUser?.soporte, refrescar]);

  // Desde Ajustes o desde el aviso
  useEffect(() => alPedirBienvenida(() => {
    if (!puede) return;
    setAbierta(true);
    setPantalla('inicio');
    refrescar().catch((e) => setError((e as Error).message));
  }), [puede, refrescar]);

  /** Los pasos que aplican a su plan (sin inventario no hay recetas ni productos) */
  const orden = useMemo<Pantalla[]>(
    () => ['inicio', ...(estado?.pasos.filter((p) => p.aplica).map((p) => p.id) ?? []), 'final'],
    [estado],
  );
  const indice = orden.indexOf(pantalla);
  const pasoActual = estado?.pasos.find((p) => p.id === pantalla);

  const irA = (p: Pantalla) => { setError(''); setPantalla(p); };
  const siguiente = async () => {
    const e = await refrescar().catch(() => estado);
    const lista: Pantalla[] = ['inicio', ...(e?.pasos.filter((p) => p.aplica).map((p) => p.id) ?? []), 'final'];
    irA(lista[Math.min(lista.indexOf(pantalla) + 1, lista.length - 1)]);
  };
  const atras = () => irA(orden[Math.max(indice - 1, 0)]);

  const cerrar = () => {
    if (!estado?.terminada) posponerBienvenida();
    setAbierta(false);
    avisarCambioBienvenida();
    void recargarCatalogo();
  };

  const terminar = async () => {
    setTerminando(true);
    try {
      await bienvenidaApi.terminar();
      setAbierta(false);
      avisarCambioBienvenida();
      void recargarCatalogo();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTerminando(false);
    }
  };

  const contenido = () => {
    if (!estado) return error ? <Aviso tipo="error">{error}</Aviso> : <Cargando />;
    switch (pantalla) {
      case 'inicio': return <Inicio nombre={currentUser?.name?.split(' ')[0]} estado={estado} onEmpezar={() => irA(estado.siguiente && estado.porcentaje > 10 ? estado.siguiente : 'salon')} onIrA={irA} />;
      case 'salon': return <PasoSalon tiposElegidos={estado.tipos} onSiguiente={siguiente} />;
      case 'sedes': return <PasoSedes onSiguiente={siguiente} />;
      case 'horario': return <PasoHorario onSiguiente={siguiente} />;
      case 'especialistas': return <PasoEspecialistas onSiguiente={siguiente} />;
      case 'servicios': return <PasoServicios onSiguiente={siguiente} />;
      case 'recetas': return <PasoRecetas onSiguiente={siguiente} />;
      case 'productos': return <PasoProductos onSiguiente={siguiente} />;
      case 'final': return <Final estado={estado} terminando={terminando} error={error} onTerminar={terminar} onIrA={irA} />;
    }
  };

  if (!puede) return null;

  return (
    <AnimatePresence>
      {abierta && (
        <motion.div
          key="bienvenida"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          className="absolute inset-0 z-[45] flex flex-col overflow-hidden bg-[#fbf7f8] dark:bg-[#0c0a0b]"
          role="dialog"
          aria-modal="true"
          aria-label="Configurar mi salón"
        >
          {/* El fondo del quiosco: manchas de color de la marca que se mueven despacio */}
          <FondoVivo />
          {/* Arriba: volver, cuánto falta y salir */}
          <div className="relative shrink-0 px-4 pb-3 border-b border-slate-200/50 dark:border-white/5 bg-white/40 dark:bg-black/20 backdrop-blur-md" style={{ paddingTop: 'var(--header-safe-pt, max(calc(env(safe-area-inset-top, 0px) + 12px), 16px))' }}>
            <div className="flex items-center gap-2">
              <button type="button" onClick={atras} disabled={indice <= 0} aria-label="Atrás" className="p-1.5 -ml-1.5 rounded-lg text-slate-500 disabled:opacity-0 cursor-pointer">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="flex-1 text-center">
                <div className="text-[0.8125rem] font-bold text-slate-900 dark:text-white">{pasoActual?.nombre ?? 'Configurar mi salón'}</div>
                {estado && <div className="text-[0.6875rem] text-slate-400">Tu salón está al {estado.porcentaje} %</div>}
              </div>
              <button type="button" onClick={cerrar} className="px-2 py-1 rounded-lg text-[0.8125rem] font-semibold text-slate-500 flex items-center gap-1 cursor-pointer">
                {estado?.terminada ? <X className="w-4 h-4" /> : 'Ahora no'}
              </button>
            </div>
            <div className="mt-2.5 h-1.5 rounded-full bg-slate-200 dark:bg-neutral-800 overflow-hidden">
              <motion.div className="h-full bg-[var(--primary)]" animate={{ width: `${estado?.porcentaje ?? 0}%` }} transition={{ duration: 0.5 }} />
            </div>
          </div>

          {/* El paso (sin posición propia: las hojas de abajo, como la del horario, se abren sobre toda la Bienvenida) */}
          <div className="relative flex-1 overflow-y-auto">
            <div className="max-w-xl mx-auto px-4 py-5 pb-10">
              <AnimatePresence mode="wait">
                {/* Solo opacidad: un desplazamiento (transform) haría que la hoja del horario se abriera dentro del paso y no sobre la pantalla */}
                <motion.div key={pantalla} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
                  {contenido()}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/** La entrada: qué vamos a hacer y en qué va */
const Inicio: React.FC<{ nombre?: string; estado: EstadoBienvenida; onEmpezar: () => void; onIrA: (p: Paso) => void }> = ({ nombre, estado, onEmpezar, onIrA }) => {
  const empezado = estado.porcentaje > 10;
  return (
    <div className="space-y-5">
      <div className="w-14 h-14 rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center"><Sparkles className="w-7 h-7" /></div>
      <div className="space-y-1.5">
        <h2 className="text-[1.5rem] font-extrabold leading-tight text-slate-900 dark:text-white">
          {empezado ? `Sigamos${nombre ? `, ${nombre}` : ''}` : `¡Bienvenida${nombre ? `, ${nombre}` : ''}!`}
        </h2>
        <p className="text-[0.9375rem] leading-snug text-slate-500 dark:text-neutral-400">
          {empezado
            ? 'Tu salón ya está avanzado. Termina lo que falta y tus informes quedan completos.'
            : 'Vamos a dejar tu salón listo en unos minutos. Casi todo ya viene hecho: tú solo marcas lo que haces y pones tus precios.'}
        </p>
      </div>
      <div className="rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 divide-y divide-slate-100 dark:divide-neutral-800">
        {estado.pasos.filter((p) => p.aplica).map((p, i) => (
          <button key={p.id} type="button" onClick={() => onIrA(p.id)} className="w-full flex items-center gap-3 p-3.5 text-left cursor-pointer">
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[0.75rem] font-bold shrink-0 ${p.hecho ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-neutral-800 text-slate-500'}`}>
              {p.hecho ? '✓' : i + 1}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[0.9375rem] font-semibold text-slate-900 dark:text-white">{p.nombre}</span>
              <span className="block text-[0.75rem] text-slate-400 truncate">{p.hecho ? 'Listo' : p.falta ?? p.descripcion}</span>
            </span>
            {!p.necesario && !p.hecho && <span className="text-[0.6875rem] text-slate-400">Opcional</span>}
          </button>
        ))}
      </div>
      <BotonPrincipal onClick={onEmpezar} className="w-full">{empezado ? 'Continuar' : 'Empezar'}</BotonPrincipal>
    </div>
  );
};

/** El cierre: cuánto quedó y qué falta (si falta algo, Lalan lo pregunta después) */
const Final: React.FC<{ estado: EstadoBienvenida; terminando: boolean; error: string; onTerminar: () => void; onIrA: (p: Paso) => void }> = ({ estado, terminando, error, onTerminar, onIrA }) => {
  const faltan = estado.pasos.filter((p) => p.aplica && !p.hecho);
  const faltaLoBasico = faltan.filter((p) => p.necesario);
  return (
    <div className="space-y-5 text-center">
      <div className="mx-auto w-16 h-16 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] flex items-center justify-center"><PartyPopper className="w-8 h-8" /></div>
      <div className="space-y-1.5">
        <h2 className="text-[1.5rem] font-extrabold text-slate-900 dark:text-white">{faltaLoBasico.length ? 'Ya casi' : '¡Tu salón está listo!'}</h2>
        <p className="text-[0.9375rem] text-slate-500 dark:text-neutral-400">
          {faltaLoBasico.length
            ? 'Falta un poco de lo básico para que Lalan atienda bien a tus clientas.'
            : estado.porcentaje >= 100
              ? 'Todo configurado. Lalan ya puede atender, agendar y darte informes completos.'
              : `Está al ${estado.porcentaje} %. Lalan ya puede atender y agendar; lo que falta te lo voy preguntando con el uso.`}
        </p>
      </div>
      {faltan.length > 0 && (
        <div className="text-left rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-800 divide-y divide-slate-100 dark:divide-neutral-800">
          {faltan.map((p) => (
            <button key={p.id} type="button" onClick={() => onIrA(p.id)} className="w-full p-3.5 text-left cursor-pointer">
              <span className="block text-[0.875rem] font-semibold text-slate-900 dark:text-white">{p.nombre}{p.necesario ? '' : ' (opcional)'}</span>
              <span className="block text-[0.75rem] text-slate-400">{p.falta}</span>
            </button>
          ))}
        </div>
      )}
      {error && <Aviso tipo="error">{error}</Aviso>}
      <BotonPrincipal onClick={onTerminar} cargando={terminando} disabled={faltaLoBasico.length > 0} className="w-full">Empezar a usar Lalan</BotonPrincipal>
      {!faltaLoBasico.length && (
        <BotonSecundario onClick={() => { void onTerminar(); abrirLalan(); }} className="w-full">Hablar con Lalan</BotonSecundario>
      )}
    </div>
  );
};
