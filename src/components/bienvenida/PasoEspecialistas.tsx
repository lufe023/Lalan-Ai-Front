import React, { useEffect, useState } from 'react';
import { Plus, Trash2, UserRound } from 'lucide-react';
import { api } from '../../services/api';
import { bienvenidaApi } from '../../services/bienvenida';
import { useAuth } from '../../context/AuthContext';
import { SelectorSede } from '../ui/SelectorSede';
import { useSedes } from '../../hooks/useSedes';
import { Aviso, BotonPrincipal, BotonSecundario, Cargando, Encabezado, Tarjeta, claseCampo } from './comun';

interface Fila { nombre: string; rol: string }
interface Especialista { id: string; name: string; role: string }

/** Lo que más se repite en un salón, para no escribirlo */
const ROLES_SUGERIDOS = ['Manicurista', 'Pedicurista', 'Estilista', 'Colorista', 'Barbero', 'Esteticista', 'Masajista'];

/** Paso 4: quién trabaja en el salón (varias de una vez). Lalan reparte las citas entre ellas */
export const PasoEspecialistas: React.FC<{ onSiguiente: () => void }> = ({ onSiguiente }) => {
  const { currentUser } = useAuth();
  const [existentes, setExistentes] = useState<Especialista[] | null>(null);
  const [filas, setFilas] = useState<Fila[]>([{ nombre: '', rol: '' }]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  // Con varias sedes, las que agregue aquí trabajan en la sede elegida
  const sedes = useSedes();
  const [sedeElegida, setSedeElegida] = useState('');
  const sede = sedes.length > 1 ? (sedeElegida || sedes[0].id) : '';

  useEffect(() => {
    api.get<Especialista[]>('/salon/staff')
      .then((l) => { setExistentes(l); if (l.length) setFilas([]); })
      .catch((e) => setError((e as Error).message));
  }, []);

  const cambiar = (i: number, campo: keyof Fila, valor: string) => setFilas((f) => f.map((x, j) => (j === i ? { ...x, [campo]: valor } : x)));
  const soloYo = () => setFilas([{ nombre: currentUser?.name?.split(' ')[0] ?? '', rol: 'Dueña' }]);

  const seguir = async () => {
    setError('');
    const nuevas = filas.filter((f) => f.nombre.trim()).map((f) => ({ nombre: f.nombre.trim(), rol: f.rol.trim() || undefined }));
    if (!nuevas.length && !existentes?.length) { setError('Agrega al menos a una persona (aunque seas solo tú).'); return; }
    setGuardando(true);
    try {
      if (nuevas.length) await bienvenidaApi.especialistas(nuevas, sede || undefined);
      onSiguiente();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  };

  if (!existentes && !error) return <Cargando />;

  return (
    <div className="space-y-5">
      <Encabezado titulo="¿Quién trabaja contigo?" texto="Lalan reparte las citas entre ellas. Su horario propio y sus zonas los ajustas después en Ajustes." />
      {!!existentes?.length && (
        <Tarjeta className="space-y-2">
          <p className="text-[0.75rem] font-bold uppercase tracking-wider text-slate-400">Ya están</p>
          {existentes.map((e) => (
            <div key={e.id} className="flex items-center gap-2 text-[0.9375rem] text-slate-800 dark:text-neutral-100">
              <UserRound className="w-4 h-4 text-slate-400" /> <span className="font-semibold">{e.name}</span>
              <span className="text-slate-400">· {e.role}</span>
            </div>
          ))}
        </Tarjeta>
      )}
      {sedes.length > 1 && (
        <div className="flex items-center gap-2 text-[0.8125rem] text-slate-500 dark:text-neutral-400">
          <span>Trabajan en</span>
          <SelectorSede sedes={sedes} value={sede} onChange={setSedeElegida} />
        </div>
      )}
      <datalist id="roles-bienvenida">{ROLES_SUGERIDOS.map((r) => <option key={r} value={r} />)}</datalist>
      {filas.map((f, i) => (
        <div key={i} className="flex items-center gap-2">
          <input value={f.nombre} onChange={(e) => cambiar(i, 'nombre', e.target.value)} placeholder="Nombre" maxLength={80} className={`${claseCampo} flex-[3]`} />
          <input value={f.rol} onChange={(e) => cambiar(i, 'rol', e.target.value)} placeholder="Qué hace" list="roles-bienvenida" maxLength={60} className={`${claseCampo} flex-[2]`} />
          <button type="button" aria-label="Quitar" onClick={() => setFilas((x) => x.filter((_, j) => j !== i))} className="p-2 text-slate-400 hover:text-rose-500 cursor-pointer">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <div className="flex gap-2">
        <BotonSecundario onClick={() => setFilas((x) => [...x, { nombre: '', rol: '' }])} className="flex-1"><Plus className="w-4 h-4" /> Otra persona</BotonSecundario>
        {!existentes?.length && <BotonSecundario onClick={soloYo} className="flex-1">Solo yo</BotonSecundario>}
      </div>
      {error && <Aviso tipo="error">{error}</Aviso>}
      <BotonPrincipal onClick={seguir} cargando={guardando} className="w-full">Siguiente</BotonPrincipal>
    </div>
  );
};
