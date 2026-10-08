/**
 * La landing: la portada pública de Lalan, sin sesión.
 * Estilos y página propios (no usa React ni Tailwind: carga rápido y se
 * comparte bien), más la medición anónima, el piloto y el mapa de calor.
 */
import './pagina.js';
import './historia.js';
import { leerToken } from './api';
import { iniciarMedicion } from './medicion';
import { iniciarPiloto } from './piloto';
import { iniciarCalor } from './calor';
import { iniciarHuevo } from './huevo';
import { iniciarOtroNegocio } from './otroNegocio';
import { iniciarAsistente } from './asistente';
import { iniciarPlanes } from './planes';

// Quien ya tiene sesión en este aparato ve "Ir a mi salón" en vez de "Entrar"
if (leerToken()) {
  const entrar = document.getElementById('enlace-entrar');
  if (entrar) entrar.textContent = 'Ir a mi salón';
}

void iniciarMedicion();
void iniciarPiloto();
void iniciarCalor();
iniciarHuevo();
void iniciarOtroNegocio();
iniciarAsistente();
void iniciarPlanes();
