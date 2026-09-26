/* Prueba de la lógica de peticiones con una base de datos falsa en memoria.
   Ejecuta el servicio REAL y la MusicaSala REAL; solo se simulan Prisma,
   YouTube y el aviso por socket. */
import 'reflect-metadata';
import { SongRequestsService } from 'BACKEND/src/modules/lounge/song-requests.service';
import { MusicaSala } from 'BACKEND/src/modules/realtime/musica.sala';

let fallos = 0;
const ok = (c: any, msg: string) => { if (!c) { fallos++; console.log('  ✗ FALLA:', msg); } else console.log('  ✓', msg); };
const rechaza = async (p: Promise<any>, status: number, frag: string, msg: string) => {
  try { await p; ok(false, `${msg} (no lanzó)`); }
  catch (e: any) {
    const st = e?.getStatus?.() ?? e?.status;
    const txt = typeof e?.getResponse?.() === 'string' ? e.getResponse() : JSON.stringify(e?.getResponse?.() ?? e?.message);
    ok(st === status && txt.includes(frag), `${msg} → ${st} "${txt}"`);
  }
};

// ─── base falsa ───────────────────────────────────────────────────────
const LOC = {
  id: '11111111-1111-4111-8111-111111111111', name: 'Caracas Principal', tenantId: 't1',
  requestToken: 'TOKENinvitadas123', songRequestLimit: 3, songRequestWindowHours: 6,
  tenant: { name: 'Lalan', active: true },
};
const filas: any[] = [];
const cmp = (v: any, cond: any): boolean => {
  if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
    if ('gte' in cond) return v >= cond.gte;
    if ('in' in cond) return cond.in.includes(v);
    if ('not' in cond) return v !== cond.not;
  }
  return v === cond;
};
const coincide = (r: any, w: any): boolean => {
  for (const [k, c] of Object.entries(w ?? {})) {
    if (k === 'OR') { if (!(c as any[]).some(x => coincide(r, x))) return false; continue; }
    if (!cmp(r[k], c)) return false;
  }
  return true;
};
const db: any = {
  location: {
    findFirst: async ({ where }: any) =>
      'requestToken' in where ? (where.requestToken === LOC.requestToken ? LOC : null)
      : (where.id === LOC.id || where.tenantId === 't1') ? LOC : null,
    findUnique: async () => ({ tenantId: 't1', requestToken: LOC.requestToken }),
    update: async ({ data }: any) => { Object.assign(LOC, data); return LOC; },
    updateMany: async () => ({ count: 0 }),
  },
  user: { findUnique: async () => ({ puedeMusica: false }) },
  loungeEvent: { groupBy: async () => [{ refId: 'AAAAAAAAAAA' }] },
  songRequest: {
    findMany: async ({ where, orderBy, take }: any) => {
      let r = filas.filter(x => coincide(x, where));
      if (orderBy?.createdAt) r = r.sort((a, b) => (orderBy.createdAt === 'asc' ? 1 : -1) * (+a.createdAt - +b.createdAt));
      return take ? r.slice(0, take) : r;
    },
    count: async ({ where }: any) => filas.filter(x => coincide(x, where)).length,
    findFirst: async ({ where }: any) => filas.find(x => coincide(x, where)) ?? null,
    create: async ({ data }: any) => {
      await new Promise(r => setTimeout(r, 5)); // para que las peticiones en paralelo se crucen de verdad
      const f = { status: 'pending', quotaReleased: false, createdAt: new Date(), playedAt: null, removedAt: null, ...data };
      filas.push(f); return f;
    },
    update: async ({ where, data }: any) => { const f = filas.find(x => x.id === where.id); Object.assign(f, data); return f; },
    updateMany: async ({ where, data }: any) => {
      const t = filas.filter(x => coincide(x, where)); t.forEach(x => Object.assign(x, data)); return { count: t.length };
    },
  },
};

const pistaDe = (id: string, dur = 200, titulo?: string) => ({
  videoId: id, title: titulo ?? `Canción ${id}`, channel: 'Canal', thumbnail: null, durationSeconds: dur,
});
const catalogo: Record<string, any> = {};
['AAAAAAAAAAA', 'BBBBBBBBBBB', 'CCCCCCCCCCC', 'DDDDDDDDDDD', 'EEEEEEEEEEE'].forEach(i => (catalogo[i] = pistaDe(i)));
catalogo['LIVEVIVOVIV'] = pistaDe('LIVEVIVOVIV', 0);
catalogo['LARGOOOOOOO'] = pistaDe('LARGOOOOOOO', 3600);
let busquedas = 0;
const youtube: any = {
  isConfigured: true,
  search: async () => { busquedas++; return Object.values(catalogo); },
  hydrate: async (ids: string[]) => ids.map(i => catalogo[i]).filter(Boolean),
  resolveUrl: async () => [catalogo['AAAAAAAAAAA']],
};
const avisos: string[] = [];
const rt: any = {
  musicaCambio: () => avisos.push('musica'),
  peticionesCambio: (_t: string, _l: string, m: string) => avisos.push(`peticiones:${m}`),
  salaCambio: () => avisos.push('sala'),
};
const musica = new MusicaSala();
const svc = new SongRequestsService({ } as any, youtube, rt, musica);
(svc as any).prisma = db;
Object.defineProperty(svc, 'db', { get: () => db });
svc.onModuleInit();

const admin: any = { sub: 'u1', tenantId: 't1', locationId: null, role: 'admin', email: 'a@a' };
const staff: any = { sub: 'u2', tenantId: 't1', locationId: null, role: 'assistant', email: 'b@b' };
const T = LOC.requestToken;
const dispA = 'device-AAAAAAAAAAAAAAAA-1234';
const dispB = 'device-BBBBBBBBBBBBBBBB-5678';

(async () => {
  console.log('\n1) Estado inicial');
  let e = await svc.estado(T, dispA);
  ok(e.limite === 3 && e.usadas === 0 && e.restantes === 3 && e.habilitado, 'aparato nuevo: 0 de 3 usadas');
  await rechaza(svc.estado('INEXISTENTE-token', dispA), 404, 'no disponible', 'token equivocado → 404');
  await rechaza(svc.estado(T, 'corto'), 400, 'identificar', 'deviceId inválido → 400');

  console.log('\n2) Cola de fondo ya en el salón y tres peticiones');
  musica.ponerCola(LOC.id, ['X1', 'X2', 'X3'].map(v => ({ videoId: v.padEnd(11, '_'), titulo: v })), 0);
  const r1 = await svc.pedir(T, { deviceId: dispA, videoId: 'AAAAAAAAAAA', guestName: '  Sofía <b>M.</b>  ' });
  ok(r1.restantes === 2, 'tras la 1ª quedan 2');
  ok(r1.misPeticiones[0].posicion === 1, 'la 1ª es la siguiente en la fila (posición 1)');
  await svc.pedir(T, { deviceId: dispA, videoId: 'BBBBBBBBBBB' });
  const r3 = await svc.pedir(T, { deviceId: dispA, videoId: 'CCCCCCCCCCC' });
  ok(r3.restantes === 0 && r3.proximaEn !== null, 'tras la 3ª quedan 0 y hay hora de renovación');
  const cola = musica.estado(LOC.id).cola.map(t => t.titulo);
  ok(JSON.stringify(cola) === JSON.stringify(['X1', 'Canción AAAAAAAAAAA', 'Canción BBBBBBBBBBB', 'Canción CCCCCCCCCCC', 'X2', 'X3']),
     `en la cola: detrás de la que suena y en orden de llegada → ${cola.join(' | ')}`);
  ok(filas[0].guestName === 'Sofía M.', `nombre saneado sin < > → "${filas[0].guestName}"`);

  console.log('\n3) Límite, repetidas y validaciones');
  await rechaza(svc.pedir(T, { deviceId: dispA, videoId: 'DDDDDDDDDDD' }), 429, 'Ya usaste tus 3', '4ª canción del mismo aparato → 429');
  await rechaza(svc.pedir(T, { deviceId: dispB, videoId: 'AAAAAAAAAAA' }), 409, 'ya está en la lista', 'canción repetida en la fila → 409');
  await rechaza(svc.pedir(T, { deviceId: dispB, videoId: 'LIVEVIVOVIV' }), 422, 'hasta 15 minutos', 'directo (sin duración) → 422');
  await rechaza(svc.pedir(T, { deviceId: dispB, videoId: 'LARGOOOOOOO' }), 422, 'hasta 15 minutos', 'mix de una hora → 422');
  await rechaza(svc.pedir(T, { deviceId: dispB, videoId: 'ZZZZZZZZZZZ' }), 422, 'no deja reproducir', 'vídeo que YouTube no da → 422');
  await rechaza(svc.pedir(T, { deviceId: dispB, videoId: 'no-valido' }), 400, 'no es válida', 'videoId mal formado → 400');
  const antes = filas.length;
  musica.reclamar(LOC.id, 'sock1', 'TV'); // el TV es el altavoz
  musica.publicar(LOC.id, 'sock1', { pista: { videoId: 'DDDDDDDDDDD', titulo: 'D' }, sonando: true });
  await rechaza(svc.pedir(T, { deviceId: dispB, videoId: 'DDDDDDDDDDD' }), 409, 'sonando ahora', 'la que suena ahora → 409');
  ok(filas.length === antes, 'ninguna de las rechazadas dejó fila ni gastó cuota');

  console.log('\n4) Concurrencia: 6 peticiones a la vez del mismo aparato');
  const antesB = filas.filter(f => f.deviceId === dispB).length;
  const ids = ['BBBBBBBBBBB', 'CCCCCCCCCCC', 'AAAAAAAAAAA', 'DDDDDDDDDDD', 'EEEEEEEEEEE'];
  // A, B y C ya están pendientes → quedan D (sonando) y E: para probar la carrera usamos otro aparato con límite 1
  await svc.configurar(admin, { limite: 1 });
  const carrera = await Promise.allSettled([
    svc.pedir(T, { deviceId: dispB, videoId: 'EEEEEEEEEEE' }),
    svc.pedir(T, { deviceId: dispB, videoId: 'EEEEEEEEEEE' }),
    svc.pedir(T, { deviceId: dispB, videoId: 'EEEEEEEEEEE' }),
  ]);
  ok(carrera.filter(x => x.status === 'fulfilled').length === 1, 'con límite 1 y 3 en paralelo entra exactamente 1');
  ok(filas.filter(f => f.deviceId === dispB).length === antesB + 1, 'y solo una fila nueva en la base');
  void ids;

  console.log('\n5) Reinicios');
  await svc.configurar(admin, { limite: 3 });
  e = await svc.estado(T, dispA);
  ok(e.restantes === 0, 'A sigue en 0 tras subir el límite a 3 (ya usó 3)');
  const rs = await svc.resumen(admin);
  const pa = rs.personas.find((p: any) => p.deviceId === dispA)!;
  ok(pa.usadas === 3 && pa.nombre === 'Sofía M.', 'el resumen ve a A con 3 usadas y su nombre');
  const rein = await svc.reiniciar(admin, { deviceId: dispA });
  ok(rein.liberadas === 3 && rein.alcance === 'persona', 'reiniciar a A libera sus 3');
  e = await svc.estado(T, dispA);
  ok(e.restantes === 3, 'A vuelve a tener 3 disponibles');
  ok(filas.filter(f => f.deviceId === dispA && f.status === 'pending').length === 3, 'sus canciones siguen en la fila (no se borró nada)');
  const eb = await svc.estado(T, dispB);
  ok(eb.usadas === 1, 'B no se tocó al reiniciar a A');
  const gen = await svc.reiniciar(admin, {});
  ok(gen.alcance === 'todas' && gen.liberadas === 1, 'reinicio general libera lo que quedaba');
  ok((await svc.estado(T, dispB)).restantes === 3, 'B también recupera su cuota');

  console.log('\n6) Ventana móvil y ajustes');
  filas.filter(f => f.deviceId === dispA).forEach(f => { f.quotaReleased = false; f.createdAt = new Date(Date.now() - 7 * 3600_000); });
  ok((await svc.estado(T, dispA)).restantes === 3, 'peticiones de hace 7 h ya no cuentan (ventana de 6 h)');
  filas.filter(f => f.deviceId === dispA)[0].createdAt = new Date(Date.now() - 1 * 3600_000);
  ok((await svc.estado(T, dispA)).usadas === 1, 'una de hace 1 h sí cuenta');
  let cfg = await svc.configurar(admin, { limite: 99, ventanaHoras: 0 });
  ok(cfg.limite === 10 && cfg.ventanaHoras === 1, `se recorta a 10 canciones y 1 h → ${JSON.stringify(cfg)}`);
  await svc.configurar(admin, { limite: 0 });
  await rechaza(svc.pedir(T, { deviceId: dispA, videoId: 'EEEEEEEEEEE' }), 403, 'desactivados', 'límite 0 → pedidos desactivados (403)');
  ok((await svc.estado(T, dispA)).habilitado === false, 'el estado lo dice: habilitado=false');
  await svc.configurar(admin, { limite: 3, ventanaHoras: 6 });

  console.log('\n7) Quitar una pendiente');
  const pendiente = filas.find(f => f.status === 'pending')!;
  await rechaza(svc.quitar(staff, pendiente.id), 403, 'permiso', 'personal sin permiso de música no puede quitar');
  await svc.quitar(admin, pendiente.id);
  ok(pendiente.status === 'removed', 'la fila pasa a removed');
  ok(!musica.estado(LOC.id).cola.some(t => t.peticionId === pendiente.id), 'y sale de la cola en memoria');
  await rechaza(svc.quitar(admin, pendiente.id), 409, 'ya sonó o ya se quitó', 'quitarla dos veces → 409');

  console.log('\n8) El altavoz empieza una petición → pasa a "sonó"');
  const sig = filas.find(f => f.status === 'pending')!;
  avisos.length = 0;
  musica.publicar(LOC.id, 'sock1', { pista: { videoId: sig.videoId, titulo: sig.title, peticionId: sig.id } });
  await new Promise(r => setTimeout(r, 30));
  ok(sig.status === 'played' && sig.playedAt, `la fila pasa a played (${sig.videoId})`);
  ok(avisos.includes('peticiones:sono'), 'y se avisa a los mandos y a las clientas');
  avisos.length = 0;
  musica.publicar(LOC.id, 'sock1', { posicion: 40 });
  await new Promise(r => setTimeout(r, 10));
  ok(avisos.length === 0, 'publicar solo la posición no dispara nada (misma canción)');
  const ajeno = musica.publicar(LOC.id, 'sock-intruso', { pista: { videoId: 'EEEEEEEEEEE' } });
  ok(ajeno === null, 'un socket que no es el altavoz no puede publicar');

  console.log('\n9) Cola del sistema (con sesión)');
  const q = await svc.cola(admin);
  ok(q.items.every((i: any) => ['pending', 'played'].includes(i.status)), 'solo pendientes y sonadas recientes, nunca las quitadas');

  console.log('\n10) Búsqueda: caché, presupuesto y filtros');
  busquedas = 0;
  let b = await svc.buscar(T, 'rosalia despecha', '1.1.1.1');
  ok(b.tracks.length === 5 && b.tracks.every(t => t.durationSeconds! >= 30), `descarta directos y mixes largos (${b.tracks.length} de 7)`);
  await svc.buscar(T, 'Rosalia   Despecha', '1.1.1.1');
  ok(busquedas === 1, 'la misma búsqueda (otra grafía) sale de la caché: 1 sola llamada a YouTube');
  for (let i = 0; i < 60; i++) await svc.buscar(T, `otra cosa ${i}`, `9.9.9.${i % 200}`);
  ok(busquedas <= 40, `presupuesto diario respetado: ${busquedas} búsquedas de pago (tope 40)`);
  b = await svc.buscar(T, 'una más distinta xyz', '2.2.2.2');
  ok((b as any).agotado === true, 'agotado el presupuesto lo dice, sin gastar más');
  const enlace = await svc.buscar(T, 'https://youtu.be/AAAAAAAAAAA', '3.3.3.3');
  ok(enlace.tracks.length === 1, 'un enlace pegado sigue funcionando con el presupuesto agotado');

  console.log('\n11) Rotar el token');
  const antesTok = LOC.requestToken;
  const rot = await svc.rotarToken(admin);
  ok(rot.token !== antesTok && LOC.requestToken === rot.token, 'el token cambia');
  await rechaza(svc.estado(antesTok, dispA), 404, 'no disponible', 'el token viejo (QR impreso) deja de servir');

  console.log(fallos ? `\n✗ ${fallos} FALLO(S)` : '\n✓ TODO CORRECTO');
  process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('EXCEPCIÓN', e); process.exit(2); });
