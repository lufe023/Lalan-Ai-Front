/* La página: colores y modo, el chat de ejemplo con sus sonidos y el recorrido por la app */

  /* Colores y modo: los mismos temas que trae la app (Ajustes → Apariencia) */
  (function () {
    var TEMAS = [
      { id: 'lalan-rose', nombre: 'Lalan Rose', marca: '#C46B7C', acento: '#A58FE3' },
      { id: 'sakura', nombre: 'Sakura', marca: '#F45B82', acento: '#F99A7A' },
      { id: 'lilas', nombre: 'Lilas', marca: '#845EC2', acento: '#7B90D2' },
      { id: 'menta', nombre: 'Menta Fresca', marca: '#38B2AC', acento: '#68D391' },
      { id: 'cielo-coral', nombre: 'Cielo Coral', marca: '#FF6F59', acento: '#43BCCD' },
      { id: 'medianoche', nombre: 'Medianoche', marca: '#FF2A7A', acento: '#7928CA' },
      { id: 'dorado-noir', nombre: 'Dorado Noir', marca: '#C69C4E', acento: '#B8977E' }
    ];
    var MODO_SISTEMA = 'sistema';
    var CLAVE_COLOR = 'lalan-tema', CLAVE_MODO = 'lalan-modo';
    var raiz = document.documentElement;
    var boton = document.getElementById('tema-boton');
    var panel = document.getElementById('tema-panel');
    var cajaColores = document.getElementById('tema-colores');
    var botonesModo = panel.querySelectorAll('[data-modo]');

    function leer(clave) { try { return localStorage.getItem(clave); } catch (e) { return null; } }
    function guardar(clave, valor) { try { localStorage.setItem(clave, valor); } catch (e) {} }

    TEMAS.forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.tema = t.id;
      b.innerHTML = '<span class="muestra" style="background:linear-gradient(135deg,' + t.marca + ' 50%,' + t.acento + ' 50%)"></span>' + t.nombre;
      b.addEventListener('click', function () { ponerColor(t.id); guardar(CLAVE_COLOR, t.id); });
      cajaColores.appendChild(b);
    });

    function ponerColor(id) {
      var t = TEMAS.filter(function (x) { return x.id === id; })[0] || TEMAS[0];
      raiz.style.setProperty('--marca', t.marca);
      raiz.style.setProperty('--acento-marca', t.acento);
      cajaColores.querySelectorAll('button').forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.tema === t.id)); });
    }
    function ponerModo(modo) {
      if (modo === 'light' || modo === 'dark') raiz.setAttribute('data-theme', modo);
      else { raiz.removeAttribute('data-theme'); modo = MODO_SISTEMA; }
      botonesModo.forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.modo === modo)); });
    }
    botonesModo.forEach(function (b) {
      b.addEventListener('click', function () { ponerModo(b.dataset.modo); guardar(CLAVE_MODO, b.dataset.modo); });
    });

    function abrir(si) { panel.hidden = !si; boton.setAttribute('aria-expanded', String(si)); }
    boton.addEventListener('click', function (e) { e.stopPropagation(); abrir(panel.hidden); });
    panel.addEventListener('click', function (e) { e.stopPropagation(); });
    document.addEventListener('click', function () { abrir(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) { abrir(false); boton.focus(); } });

    ponerColor(leer(CLAVE_COLOR));
    ponerModo(leer(CLAVE_MODO));
  })();


  /* Número de WhatsApp de Lalan AI, solo dígitos con código de país (ej.: 18095551234).
     Mientras esté vacío, el formulario arma el mensaje para copiarlo. */

  // ── La demo del chat ─────────────────────────────────────────────
  var ESCENAS = {
    noche: [
      { q: 'clienta', voz: true, t: 'Hola, buenas noches. Quiero una cita para manicure y un masaje relajante mañana en la tarde.', h: '11:04 noche' },
      { q: 'lalan', t: '¡Buenas noches! 😊 Mañana en la tarde tengo manicure a las 2 con Valentina y el masaje seguido, a las 2:30 con Carla. ¿Te lo dejo así?', h: '11:04 noche' },
      { q: 'clienta', t: 'Sí, perfecto', h: '11:05 noche' },
      { q: 'lalan', t: '¡Listo, Carmen! Mañana jueves: manicure a las 2 de la tarde con Valentina y masaje relajante a las 2:30 con Carla.', h: '11:05 noche' },
      { q: 'lalan', t: 'Para tenerte todo listo cuando llegues: ¿te preparamos un café con leche, un jugo natural o una copa de vino?', h: '11:05 noche' },
      { q: 'clienta', t: 'Café con leche 🥰', h: '11:06 noche' },
      { q: 'sistema', t: 'Cita agendada por Lalan · ya está en tu agenda' }
    ],
    cambio: [
      { q: 'clienta', t: 'Hola, tenía cita el martes y no pude ir. ¿Me pueden atender hoy?', h: '10:12 mañana' },
      { q: 'lalan', t: 'Claro que sí. Tenías manicure el martes a las 10 de la mañana. Hoy puedo moverla a las 4 o a las 5:30 de la tarde con Valentina. ¿Cuál te sirve?', h: '10:12 mañana' },
      { q: 'clienta', t: 'A las 4', h: '10:13 mañana' },
      { q: 'lalan', t: 'Hecho: te moví la cita a hoy a las 4 de la tarde con Valentina. ¡Te esperamos!', h: '10:13 mañana' },
      { q: 'sistema', t: 'Cita movida · no se creó una nueva' }
    ],
    duena: [
      { q: 'clienta', voz: true, t: 'Hola, mañana es la graduación de mi hija y necesitamos peinado y uñas para las dos. ¿Nos pueden atender en la mañana?', h: '7:40 noche' },
      { q: 'lalan', t: '¡Qué bonito, felicidades! 🎓 Mañana en la mañana la agenda está llena, pero es un día especial: le pregunto a Alanny si les puede hacer un espacio y te escribo enseguida.', h: '7:40 noche' },
      { q: 'duena', t: 'Aviso a Alanny por WhatsApp: «Carmen necesita a una persona. Motivo: peinado y uñas para ella y su hija mañana en la mañana por una graduación; no hay cupo.»' },
      { q: 'duena', t: 'Alanny responde con una nota de voz: «Dile que sí, que vengan a las 8, que abrimos más temprano para ellas.»' },
      { q: 'lalan', t: '¡Buenas noticias, Carmen! Alanny abre más temprano para ustedes: mañana a las 8 de la mañana, peinado y uñas para las dos. ¿Se las dejo agendadas?', h: '7:52 noche' },
      { q: 'clienta', t: '¡Sí! Mil gracias 😍', h: '7:53 noche' },
      { q: 'sistema', t: 'Citas agendadas por Lalan · 8 de la mañana, antes de abrir' }
    ]
  };

  var hilo = document.getElementById('hilo');
  var reducido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var turno = 0;

  function burbuja(m) {
    var b = document.createElement('div');
    b.className = 'burbuja ' + m.q;

    if (m.q === 'duena') {
      var esAudio = m.t.indexOf('Alanny responde') === 0;
      var titulo = esAudio ? 'Alanny respondió por nota de voz' : 'Aviso a Alanny (Canal privado por WhatsApp)';
      var cuerpo = m.t.replace(/^(Aviso a Alanny por WhatsApp|Alanny responde con una nota de voz):\s*«?/, '').replace(/»?\s*$/, '');

      b.innerHTML =
        '<div class="duena-insignia">' +
          '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
          '<span>Canal privado con la dueña · No visible para la clienta</span>' +
        '</div>' +
        '<div class="duena-cuerpo">' +
          '<div class="duena-remitente">' + titulo + '</div>' +
          (esAudio
            ? '<div class="duena-audio-caja">' +
                '<span class="duena-play-btn" aria-hidden="true"><svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path d="M8 5v14l11-7z"/></svg></span>' +
                '<div class="duena-onda-mini" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div>' +
                '<span class="duena-duracion">0:06</span>' +
              '</div>' +
              '<div class="duena-transcrito">«' + cuerpo + '»</div>'
            : '<div class="duena-texto">«' + cuerpo + '»</div>'
          ) +
        '</div>';
      return b;
    }

    if (m.q === 'sistema') {
      b.innerHTML =
        '<span class="wa-sistema-icono" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>' +
        '</span>' +
        '<span>' + m.t + '</span>';
      return b;
    }

    var horaTxt = m.h ? m.h.replace(' noche', ' p. m.').replace(' mañana', ' a. m.').replace(' tarde', ' p. m.') : '';
    var checkSvg = m.q === 'lalan'
      ? '<span class="wa-checks" title="Leído"><svg viewBox="0 0 16 11" width="15" height="11" fill="none" aria-hidden="true"><path d="M11.05 1.25L4.85 7.45L2.1 4.7" stroke="#53BDEB" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.55 1.25L8.35 7.45L7.2 6.3" stroke="#53BDEB" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>'
      : '';

    if (m.voz) {
      b.innerHTML =
        '<div class="wa-voz-cuerpo">' +
          '<span class="wa-voz-play" aria-label="Reproducir nota de voz">' +
            '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>' +
          '</span>' +
          '<div class="wa-voz-info">' +
            '<div class="wa-voz-barras" aria-hidden="true">' +
              '<span style="height:6px"></span><span style="height:14px"></span><span style="height:8px"></span><span style="height:18px"></span><span style="height:12px"></span><span style="height:20px"></span><span style="height:14px"></span><span style="height:9px"></span><span style="height:16px"></span><span style="height:7px"></span><span style="height:13px"></span><span style="height:11px"></span><span style="height:17px"></span><span style="height:8px"></span>' +
            '</div>' +
            '<div class="wa-voz-meta">' +
              '<span class="wa-voz-duracion">0:07</span>' +
              '<span class="hora">' + horaTxt + checkSvg + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="wa-voz-mic" title="Nota de voz">' +
            '<svg viewBox="0 0 24 24" width="16" height="16" fill="#00A884"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>' +
          '</div>' +
        '</div>' +
        '<div class="transcrito">Lalan escuchó: «' + m.t + '»</div>';
    } else {
      b.innerHTML =
        '<div class="wa-texto">' + m.t + '</div>' +
        '<div class="wa-meta">' +
          '<span class="hora">' + horaTxt + '</span>' +
          checkSvg +
        '</div>';
    }
    return b;
  }

  // ── Sonidos, hechos en el navegador (sin archivos) ────────────────
  // Solo suenan después de que la persona toca algo: los navegadores no dejan sonar solo.
  var audio = null;
  var sonidoActivo = true;
  try { sonidoActivo = localStorage.getItem('lalan-sonido') !== 'no'; } catch (e) {}
  var botonSonido = document.getElementById('sonido');
  function pintarSonido() { botonSonido.setAttribute('aria-pressed', sonidoActivo ? 'true' : 'false'); botonSonido.title = sonidoActivo ? 'Silenciar' : 'Activar sonido'; }
  pintarSonido();
  function contexto() {
    if (!audio) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return null; audio = new C(); }
    if (audio.state === 'suspended') audio.resume();
    return audio;
  }
  // Una nota corta con subida y caída suaves
  function nota(ctx, frecuencia, inicio, duracion, volumen, forma) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.type = forma || 'sine';
    o.frequency.setValueAtTime(frecuencia, inicio);
    g.gain.setValueAtTime(0.0001, inicio);
    g.gain.exponentialRampToValueAtTime(volumen, inicio + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, inicio + duracion);
    o.connect(g); g.connect(ctx.destination);
    o.start(inicio); o.stop(inicio + duracion + 0.02);
  }
  var SONIDOS = {
    // Llega un mensaje de la clienta: dos gotitas que suben
    clienta: function (ctx, t) { nota(ctx, 880, t, 0.12, 0.18); nota(ctx, 1318, t + 0.09, 0.16, 0.14); },
    // Sale la respuesta de Lalan: un "tic" suave que baja
    lalan: function (ctx, t) { nota(ctx, 740, t, 0.09, 0.12, 'triangle'); nota(ctx, 554, t + 0.06, 0.12, 0.08, 'triangle'); },
    // Aviso a la dueña: campanita de notificación
    duena: function (ctx, t) { nota(ctx, 988, t, 0.35, 0.12); nota(ctx, 1480, t + 0.14, 0.45, 0.09); nota(ctx, 1976, t + 0.28, 0.5, 0.05); },
    // Cita agendada: acorde cortito de "listo"
    sistema: function (ctx, t) { nota(ctx, 659, t, 0.22, 0.09); nota(ctx, 830, t + 0.07, 0.22, 0.08); nota(ctx, 988, t + 0.14, 0.3, 0.08); }
  };
  function sonar(quien) {
    if (!sonidoActivo || reducido) return;
    var ctx = contexto(); if (!ctx || !SONIDOS[quien]) return;
    SONIDOS[quien](ctx, ctx.currentTime + 0.01);
  }
  botonSonido.addEventListener('click', function () {
    sonidoActivo = !sonidoActivo;
    try { localStorage.setItem('lalan-sonido', sonidoActivo ? 'si' : 'no'); } catch (e) {}
    pintarSonido();
    if (sonidoActivo) sonar('clienta');
  });

  function reproducir(nombre) {
    var mio = ++turno;
    var mensajes = ESCENAS[nombre];
    hilo.innerHTML = '';

    // Insignia de fecha de WhatsApp
    var badgeFecha = document.createElement('div');
    badgeFecha.className = 'wa-fecha';
    badgeFecha.innerHTML = '<span>HOY</span>';
    hilo.appendChild(badgeFecha);

    if (reducido) {
      mensajes.forEach(function (m) { hilo.appendChild(burbuja(m)); });
      return;
    }
    var i = 0;
    (function siguiente() {
      if (mio !== turno || i >= mensajes.length) return;
      var m = mensajes[i++];
      var espera = m.q === 'clienta' ? 900 : 700;
      if (m.q === 'lalan') {
        var escr = document.createElement('div');
        escr.className = 'burbuja lalan escribiendo';
        escr.innerHTML = '<div class="wa-typing-dots"><span></span><span></span><span></span></div>';
        hilo.appendChild(escr);
        hilo.scrollTop = hilo.scrollHeight;
        setTimeout(function () {
          if (mio !== turno) return;
          escr.remove();
          hilo.appendChild(burbuja(m));
          sonar(m.q);
          hilo.scrollTop = hilo.scrollHeight;
          setTimeout(siguiente, 900);
        }, 1100);
      } else {
        hilo.appendChild(burbuja(m));
        sonar(m.q);
        hilo.scrollTop = hilo.scrollHeight;
        setTimeout(siguiente, espera + 500);
      }
    })();
  }

  document.querySelectorAll('[data-escena]').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('[data-escena]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      reproducir(b.getAttribute('data-escena'));
    });
  });
  // La primera escena ya se ve completa al cargar con la fecha "HOY"
  var badgeInicial = document.createElement('div');
  badgeInicial.className = 'wa-fecha';
  badgeInicial.innerHTML = '<span>HOY</span>';
  hilo.appendChild(badgeInicial);
  ESCENAS.noche.forEach(function (m) { hilo.appendChild(burbuja(m)); });

  // ── El Lounge: servir con un toque ───────────────────────────────
  [['servir-cafe', 'Café con leche servido'], ['servir-picadera', 'Picadera servida']].forEach(function (par) {
    var b = document.getElementById(par[0]);
    b.addEventListener('click', function () { b.textContent = '✓ ' + par[1]; b.disabled = true; });
  });


  // ── Entrada suave de cada parte ──────────────────────────────────
  // Sube un poco y aparece una sola vez al entrar en pantalla. Sin JavaScript,
  // con «reducir movimiento» o en el mapa de calor todo se ve quieto desde el
  // principio: la clase que lo esconde solo se pone si el observador existe.
  (function () {
    var quieto = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (quieto || !('IntersectionObserver' in window) || /[?&]calor=/.test(location.search)) return;
    var partes = document.querySelectorAll('.entra');
    var obs = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('visto');
        obs.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    partes.forEach(function (p) {
      // Lo que ya está en pantalla al cargar no se esconde: no parpadea
      if (p.getBoundingClientRect().top < window.innerHeight) { p.classList.add('visto'); return; }
      obs.observe(p);
    });
    document.documentElement.classList.add('anima');
  })();
