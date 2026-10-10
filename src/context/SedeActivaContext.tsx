import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, apiCadena } from '../services/api';
import { guardarSedeActiva, sedeActiva, sedePropia } from '../services/sedeActiva';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from './AuthContext';

export interface SedeDelSalon { id: string; name: string; address: string | null; phone?: string | null; paleta: string | null }

interface SedeActivaValor {
  /** Todas las sedes activas del salón, la principal primero */
  sedes: SedeDelSalon[];
  /** La sede en la que se trabaja ahora; null = toda la cadena */
  actual: SedeDelSalon | null;
  /** Atada a su sede: no puede cambiarse a otra */
  fija: boolean;
  /** ¿Hay que mostrar el control? Solo con 2 o más sedes */
  varias: boolean;
  /** Cambia de sede (o '' = todas) y recarga la app en esa sede */
  elegir: (id: string) => void;
  /** Pone una paleta; con una sede activa, queda como el color de esa sede */
  ponerPaleta: (paletaId: string) => void;
  /** Guarda la dirección o el teléfono de una sede (salen en sus recibos) */
  ponerContacto: (id: string, datos: { address?: string; phone?: string }) => Promise<void>;
}

const Ctx = createContext<SedeActivaValor>({ sedes: [], actual: null, fija: false, varias: false, elegir: () => undefined, ponerPaleta: () => undefined, ponerContacto: async () => undefined });

/** Paletas que se distinguen a simple vista entre sí y del rosa de siempre */
const COLORES_DE_SEDE = ['menta_fresca', 'lilas', 'dorado_noir', 'cielo_coral', 'medianoche', 'sakura'];

/**
 * Los colores de la cadena: los de la sede principal sin paleta propia y los
 * de "Todas las sedes". Se recuerdan aquí para volver a ellos al salir de una
 * sede con otro color (si no, se quedaría pegado el color de la última sede).
 */
const CLAVE_PALETA_CADENA = 'lalan.paletaCadena';
const PALETA_DE_SIEMPRE = 'lalan_rose';
function paletaCadena(): string {
  try { return localStorage.getItem(CLAVE_PALETA_CADENA) || PALETA_DE_SIEMPRE; } catch { return PALETA_DE_SIEMPRE; }
}
function guardarPaletaCadena(id: string) {
  try { localStorage.setItem(CLAVE_PALETA_CADENA, id); } catch { /* sin almacenamiento, se usa la de siempre */ }
}

/** La paleta de una sede: la que eligió, o una distinta por sede para que el cambio se note */
export function paletaDeSede(sedes: SedeDelSalon[], id: string): string | null {
  const i = sedes.findIndex((s) => s.id === id);
  if (i < 0) return null;
  if (sedes[i].paleta) return sedes[i].paleta;
  // La principal conserva los colores de siempre; las demás estrenan uno bien distinto
  return i === 0 ? null : COLORES_DE_SEDE[(i - 1) % COLORES_DE_SEDE.length];
}

/**
 * La sede activa de toda la app (ver services/sedeActiva.ts). El control
 * principal vive en el menú de la cuenta: al elegir una sede, toda la app
 * trabaja en ella y cambia de color.
 */
export const SedeActivaProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { applyPalettePreset, activePaletteId } = useTheme();
  const [sedes, setSedes] = useState<SedeDelSalon[]>([]);
  const [elegida, setElegida] = useState(() => sedeActiva());

  useEffect(() => {
    if (!isAuthenticated) { setSedes([]); return; }
    apiCadena.get<SedeDelSalon[]>('/users/sedes')
      .then((s) => {
        const lista = s ?? [];
        setSedes(lista);
        // Una sede que ya no existe deja de estar elegida
        if (elegida && !lista.some((x) => x.id === elegida)) { guardarSedeActiva(''); setElegida(''); }
      })
      .catch(() => setSedes([]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const propia = isAuthenticated ? sedePropia() : null;
  const idActual = propia ?? elegida;
  const actual = sedes.find((s) => s.id === idActual) ?? null;

  // Los colores de la sede en la que se está; en la principal sin paleta propia y en "Todas", los de la cadena
  useEffect(() => {
    if (sedes.length < 2) return;
    const paleta = (actual && paletaDeSede(sedes, actual.id)) || paletaCadena();
    if (paleta !== activePaletteId) applyPalettePreset(paleta);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actual?.id, sedes]);

  const elegir = useCallback((id: string) => {
    if (propia || id === elegida) return;
    guardarSedeActiva(id);
    setElegida(id);
    // Todo lo cargado es de la otra sede: se empieza de nuevo en esta
    window.location.reload();
  }, [propia, elegida]);

  const ponerPaleta = useCallback((paletaId: string) => {
    applyPalettePreset(paletaId);
    if (sedes.length < 2) return;
    if (!actual) { guardarPaletaCadena(paletaId); return; }
    setSedes((l) => l.map((x) => (x.id === actual.id ? { ...x, paleta: paletaId } : x)));
    // La sede activa viaja en la cabecera: se guarda en ella
    api.patch('/salon/sede', { paleta: paletaId }).catch(() => undefined);
  }, [applyPalettePreset, actual, sedes.length]);

  const ponerContacto = useCallback(async (id: string, datos: { address?: string; phone?: string }) => {
    await api.patch('/salon/sede', { locationId: id, ...datos });
    setSedes((l) => l.map((x) => (x.id === id ? { ...x, ...datos } : x)));
  }, []);

  const valor = useMemo<SedeActivaValor>(() => ({
    sedes, actual, fija: !!propia, varias: sedes.length > 1, elegir, ponerPaleta, ponerContacto,
  }), [sedes, actual, propia, elegir, ponerPaleta, ponerContacto]);

  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
};

export const useSedeActiva = () => useContext(Ctx);
