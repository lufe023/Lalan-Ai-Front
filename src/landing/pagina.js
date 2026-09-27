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
    if (m.voz) {
      b.innerHTML = '<span class="nota-voz"><span aria-hidden="true">▶</span><span class="onda"></span><span>0:07</span></span>';
      var tr = document.createElement('span');
      tr.className = 'transcrito';
      tr.textContent = 'Lalan escuchó: «' + m.t + '»';
      b.appendChild(tr);
    } else {
      b.appendChild(document.createTextNode(m.t));
    }
    if (m.h) {
      var h = document.createElement('span');
      h.className = 'hora';
      h.textContent = m.h;
      b.appendChild(h);
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
        escr.className = 'escribiendo';
        escr.innerHTML = '<i></i><i></i><i></i>';
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
  // La primera escena ya se ve completa al cargar; luego se anima al tocar
  ESCENAS.noche.forEach(function (m) { hilo.appendChild(burbuja(m)); });

  // ── Recorrido por la app ─────────────────────────────────────────
  (function () {
    var LEYENDAS = {
      agenda: 'La agenda del día. Las citas que agenda Lalan dicen "Confirmada · Lalan"; toca una para ver quién la atiende y qué le gusta.',
      chats: 'Todas las conversaciones en un lugar. Cuando algo necesita a una persona, el chat se marca y ves el motivo sin leerlo entero.',
      lounge: 'La música que suena es la de las clientas que están en el salón, más las que piden desde el QR.',
      pizarra: 'La pantalla de la pared: a quién se llama, quién está en cada zona y quién sigue. Se actualiza sola, al instante.',
      metricas: 'Los números del mes, en vivo: cuánto trabajó Lalan, cuándo se llena el salón y qué se pide más.',
      ganancias: 'Cada servicio con su receta de insumos: ves lo que cobras, lo que te cuesta hacerlo y lo que de verdad te queda. Toca uno para ver su receta.'
    };
    var CITAS = [
      { h: '9:00', f: 'mañana', q: 'Paola G.', s: '💅 Manicure semipermanente', e: 'Valentina', c: 'unas', est: ['lista', 'Completada'], por: 'Lalan', g: 'Café negro · Bachata' },
      { h: '10:30', f: 'mañana', q: 'Laura M.', s: '💇‍♀️ Blower', e: 'Mariela', c: 'cabello', est: ['lista', 'Completada'], por: 'Alanny', g: 'Agua con limón · Manuel Turizo' },
      { h: '2:00', f: 'tarde', q: 'Carmen R.', s: '💅 Manicure semipermanente', e: 'Valentina', c: 'unas', est: ['atendiendo', 'En atención'], por: 'Lalan', g: 'Café con leche · Romeo Santos' },
      { h: '2:30', f: 'tarde', q: 'Carmen R.', s: '💆‍♀️ Masaje relajante', e: 'Carla', c: 'masajes', est: ['lalan', 'Confirmada · Lalan'], por: 'Lalan', g: 'Café con leche · Romeo Santos' },
      { h: '4:00', f: 'tarde', q: 'Yaneris P.', s: '💇‍♀️ Retoque de color', e: 'Mariela', c: 'cabello', est: ['equipo', 'Confirmada · Alanny'], por: 'Alanny', g: 'Todavía no sabemos sus gustos' },
      { h: '6:30', f: 'tarde', q: 'Marleny S.', s: '💅 Pedicure spa', e: 'Valentina', c: 'unas', est: ['lalan', 'Confirmada · Lalan'], por: 'Lalan', g: 'Té frío · Juan Luis Guerra' }
    ];
    var lista = document.getElementById('lista-citas');
    var detalle = document.getElementById('detalle-cita');
    var filtro = 'todos';
    var elegida = 2;

    function pintarDetalle(i) {
      var c = CITAS[i];
      detalle.innerHTML = '';
      if (!c) { detalle.innerHTML = '<p class="vacio">Toca una cita para ver el detalle.</p>'; return; }
      var h = document.createElement('h5'); h.textContent = c.q; detalle.appendChild(h);
      var dl = document.createElement('dl');
      [['Servicio', c.s.replace(/^\S+\s/, '')], ['Hora', c.h + ' de la ' + c.f], ['Especialista', c.e], ['Agendó', c.por]].forEach(function (par) {
        var dt = document.createElement('dt'); dt.textContent = par[0];
        var dd = document.createElement('dd'); dd.textContent = par[1];
        dl.appendChild(dt); dl.appendChild(dd);
      });
      detalle.appendChild(dl);
      var g = document.createElement('div'); g.className = 'gustitos';
      g.innerHTML = '<b>Para recibirla</b><br>';
      g.appendChild(document.createTextNode(c.g));
      detalle.appendChild(g);
    }
    function pintarCitas() {
      lista.innerHTML = '';
      CITAS.forEach(function (c, i) {
        if (filtro !== 'todos' && c.c !== filtro) return;
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'cita';
        b.setAttribute('aria-pressed', i === elegida ? 'true' : 'false');
        b.innerHTML = '<span class="h"></span><span><span class="quien"></span><br><span class="que"></span></span><span class="estado"></span>';
        b.querySelector('.h').innerHTML = c.h + '<small>' + c.f + '</small>';
        b.querySelector('.quien').textContent = c.q;
        b.querySelector('.que').textContent = c.s + ' · ' + c.e;
        var est = b.querySelector('.estado'); est.className = 'estado ' + c.est[0]; est.textContent = c.est[1];
        b.addEventListener('click', function () { elegida = i; detenerRecorrido(); pintarCitas(); pintarDetalle(i); });
        lista.appendChild(b);
      });
      if (!lista.children.length) lista.innerHTML = '<p class="vacio">No hay citas de esa categoría hoy.</p>';
    }
    document.querySelectorAll('.filtros [data-cat]').forEach(function (b) {
      b.addEventListener('click', function () {
        filtro = b.getAttribute('data-cat');
        document.querySelectorAll('.filtros [data-cat]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        detenerRecorrido();
        pintarCitas();
      });
    });
    pintarCitas(); pintarDetalle(elegida);

    // ── Números que suben ───────────────────────────────────────────
    function formatear(n, el) {
      var t = Math.round(n).toLocaleString('en-US');
      return (el.getAttribute('data-moneda') ? 'RD$ ' : '') + t + (el.getAttribute('data-sufijo') || '');
    }
    function animarCuentas(raizCuentas) {
      raizCuentas.querySelectorAll('[data-cuenta]').forEach(function (el) {
        var fin = Number(el.getAttribute('data-cuenta'));
        if (reducido) { el.textContent = formatear(fin, el); return; }
        var t0 = null, DUR = 1100;
        function paso(t) {
          if (t0 === null) t0 = t;
          var k = Math.min(1, (t - t0) / DUR);
          el.textContent = formatear(fin * (1 - Math.pow(1 - k, 3)), el);
          if (k < 1) requestAnimationFrame(paso);
        }
        requestAnimationFrame(paso);
      });
    }
    function crecerGraficas(panel) {
      if (reducido) return;
      panel.querySelectorAll('.crece').forEach(function (g) {
        g.classList.add('plano'); void g.offsetWidth;
        requestAnimationFrame(function () { g.classList.remove('plano'); });
      });
    }
    // Las cifras de la sección de métricas suben cuando aparecen en pantalla
    if ('IntersectionObserver' in window) {
      var cifras = document.querySelector('.cifras');
      if (cifras) {
        var obs = new IntersectionObserver(function (es) {
          es.forEach(function (e) { if (e.isIntersecting) { animarCuentas(cifras); obs.disconnect(); } });
        }, { threshold: 0.5 });
        obs.observe(cifras);
      }
    }

    // ── Ganancia real: cada servicio con su receta ──────────────────
    var NETOS = [
      { n: 'Manicure semipermanente', z: 'Uñas', p: 800, r: [['Esmalte en gel', '3 ml', 45], ['Base y top', '2 ml', 30], ['Removedor y algodón', '', 15], ['Lima y palito', '1 juego', 25]] },
      { n: 'Pedicure spa', z: 'Uñas', p: 1200, r: [['Sales exfoliantes', '40 g', 60], ['Crema hidratante', '30 ml', 45], ['Esmalte', '2 ml', 40], ['Kit desechable', '1', 55]] },
      { n: 'Blower', z: 'Cabello', p: 900, r: [['Champú', '20 ml', 25], ['Acondicionador', '15 ml', 20], ['Protector térmico', '5 ml', 30]] },
      { n: 'Retoque de color', z: 'Cabello', p: 2500, r: [['Tinte', '60 g', 420], ['Oxidante', '90 ml', 95], ['Tratamiento', '1 sobre', 110], ['Guantes y papel', '', 35]], consejo: 'El tinte es el 64 % del costo. Si el suplidor sube el precio, aquí lo notas el mismo día.' },
      { n: 'Picadera del Lounge', z: 'Lounge · se prepara', p: 350, r: [['Salchichón de lomo', '60 g', 48], ['Galletas', '8 unidades', 32], ['Queso crema', '30 g', 40]], consejo: 'Al servirla se descuentan los insumos del inventario: sabes cuántas te quedan por hacer.' },
      { n: 'Café con leche', z: 'Lounge · cortesía', p: 0, r: [['Café', '12 g', 18], ['Leche', '120 ml', 10]], consejo: 'Es un regalo para la clienta, pero no es gratis para ti: cada taza te cuesta RD$ 28.' }
    ];
    var filasNetos = document.getElementById('netos-filas');
    var cajaReceta = document.getElementById('receta');
    var netoElegido = 3;
    function costo(x) { return x.r.reduce(function (s, l) { return s + l[2]; }, 0); }
    function rd(n) { return 'RD$ ' + Math.round(n).toLocaleString('en-US'); }
    function pintarReceta(i) {
      var x = NETOS[i], c = costo(x);
      cajaReceta.innerHTML = '';
      var h = document.createElement('h5'); h.textContent = x.n; cajaReceta.appendChild(h);
      var sub = document.createElement('div'); sub.className = 'sub'; sub.textContent = 'Receta de una porción · ' + x.z; cajaReceta.appendChild(sub);
      var ul = document.createElement('ul');
      x.r.forEach(function (l) {
        var li = document.createElement('li');
        var a = document.createElement('span'); a.textContent = l[0] + (l[1] ? ' · ' + l[1] : '');
        var b = document.createElement('span'); b.textContent = rd(l[2]);
        li.appendChild(a); li.appendChild(b); ul.appendChild(li);
      });
      cajaReceta.appendChild(ul);
      function total(txt, val, clase) {
        var d = document.createElement('div'); d.className = 'total' + (clase ? ' ' + clase : '');
        var a = document.createElement('span'); a.textContent = txt;
        var b = document.createElement('span'); b.textContent = val;
        d.appendChild(a); d.appendChild(b); cajaReceta.appendChild(d);
      }
      total('Te cuesta hacerlo', rd(c));
      if (x.p > 0) { total('Cobras', rd(x.p)); total('Te queda', rd(x.p - c) + ' (' + Math.round((x.p - c) / x.p * 100) + ' %)', 'bueno'); }
      if (x.consejo) { var k = document.createElement('div'); k.className = 'consejo'; k.textContent = x.consejo; cajaReceta.appendChild(k); }
    }
    function pintarNetos(animar) {
      filasNetos.innerHTML = '';
      NETOS.forEach(function (x, i) {
        var c = costo(x), queda = x.p - c, pct = x.p > 0 ? Math.round(queda / x.p * 100) : 0;
        var b = document.createElement('button'); b.type = 'button'; b.className = 'fila'; b.setAttribute('role', 'row');
        b.setAttribute('aria-pressed', i === netoElegido ? 'true' : 'false');
        b.innerHTML = '<span class="nombre" role="cell"><b></b><small></small></span><span role="cell"></span><span role="cell"></span><span class="queda" role="cell"><b></b><i><s></s></i></span>';
        b.querySelector('.nombre b').textContent = x.n;
        b.querySelector('.nombre small').textContent = x.z;
        b.children[1].textContent = x.p > 0 ? rd(x.p) : 'Cortesía';
        b.children[2].textContent = rd(c);
        b.querySelector('.queda b').textContent = x.p > 0 ? rd(queda) + ' · ' + pct + ' %' : '— ' + rd(c) + ' por taza';
        var barra = b.querySelector('.queda s');
        if (x.p === 0) { barra.parentNode.style.visibility = 'hidden'; b.querySelector('.queda b').style.color = 'var(--ambar)'; }
        if (animar && !reducido) requestAnimationFrame(function () { requestAnimationFrame(function () { barra.style.width = pct + '%'; }); });
        else { barra.style.transition = 'none'; barra.style.width = pct + '%'; }
        b.addEventListener('click', function () { netoElegido = i; detenerRecorrido(); pintarNetos(false); pintarReceta(i); });
        filasNetos.appendChild(b);
      });
    }
    pintarNetos(false); pintarReceta(netoElegido);

    // ── Pizarra de turnos: la cola se mueve sola ────────────────────
    SONIDOS.turno = function (ctx, t) { nota(ctx, 784, t, 0.5, 0.12); nota(ctx, 622, t + 0.32, 0.7, 0.11); };
    var ZONAS = [
      { id: 'C', nombre: 'Cabello', sillas: [{ e: 'Mariela', t: { c: 'C-11', q: 'Laura M.', s: 'Blower' } }, { e: 'Rosa', t: null }] },
      { id: 'U', nombre: 'Uñas', sillas: [{ e: 'Valentina', t: { c: 'U-07', q: 'Paola G.', s: 'Manicure' } }, { e: 'Yuleisy', t: { c: 'U-06', q: 'Rocío T.', s: 'Pedicure spa' } }] },
      { id: 'S', nombre: 'Spa', sillas: [{ e: 'Carla', t: { c: 'S-03', q: 'Ana L.', s: 'Masaje relajante' } }] }
    ];
    var cont = { C: 12, U: 8, S: 4 };
    var LLEGAN = [
      { z: 'U', q: 'Carmen R.', s: 'Manicure semipermanente', o: 'Cita · Lalan' },
      { z: 'C', q: 'Yaneris P.', s: 'Retoque de color', o: 'Cita · Alanny' },
      { z: 'S', q: 'Marleny S.', s: 'Masaje relajante', o: 'Cita · Lalan' },
      { z: 'C', q: 'Denisse A.', s: 'Peinado', o: 'Llegó sin cita' },
      { z: 'U', q: 'Kelvin M.', s: 'Manicure', o: 'Cita · Lalan' },
      { z: 'C', q: 'Rosanna F.', s: 'Blower', o: 'Cita · Lalan' },
      { z: 'U', q: 'Wendy C.', s: 'Pedicure spa', o: 'Llegó sin cita' }
    ];
    var siguienteLlega = 0;
    function nuevoTurno() {
      var x = LLEGAN[siguienteLlega++ % LLEGAN.length];
      return { c: x.z + '-' + String(cont[x.z]++).padStart(2, '0'), z: x.z, q: x.q, s: x.s, o: x.o };
    }
    var esperando = [nuevoTurno(), nuevoTurno(), nuevoTurno()];
    var llamado = null, etiquetaLlamado = 'Último llamado';
    var minutos = 10 * 60 + 24;
    var cajaLlamando = document.getElementById('pz-llamando');
    var cajaZonas = document.getElementById('pz-zonas');
    var cajaFichas = document.getElementById('pz-fichas');
    var horaPz = document.getElementById('pz-hora');
    function zona(id) { return ZONAS.filter(function (z) { return z.id === id; })[0]; }
    function pintarHora() {
      var h = Math.floor(minutos / 60), m = minutos % 60;
      horaPz.textContent = (h % 12 || 12) + ':' + String(m).padStart(2, '0');
      horaPz.nextSibling.nodeValue = ' ' + (h < 12 ? 'mañana' : h < 19 ? 'tarde' : 'noche');
    }
    function pintarLlamando(flash) {
      cajaLlamando.innerHTML = '';
      if (!llamado) { cajaLlamando.innerHTML = '<p class="pz-vacio">En un momento llamamos al siguiente turno</p>'; return; }
      var z = zona(llamado.z);
      cajaLlamando.innerHTML = '<div><div class="etq"></div><div class="pz-codigo"></div></div><div class="pz-quien"><span></span><small></small></div><div class="pz-destino">Pasa a<b></b><span></span></div>';
      cajaLlamando.querySelector('.etq').textContent = etiquetaLlamado;
      cajaLlamando.querySelector('.pz-codigo').textContent = llamado.c;
      cajaLlamando.querySelector('.pz-quien span').textContent = llamado.q;
      cajaLlamando.querySelector('.pz-quien small').textContent = llamado.s;
      cajaLlamando.querySelector('.pz-destino b').textContent = z.nombre;
      cajaLlamando.querySelector('.pz-destino span').textContent = 'con ' + llamado.e;
      if (flash) { cajaLlamando.classList.remove('flash'); void cajaLlamando.offsetWidth; cajaLlamando.classList.add('flash'); }
    }
    function pintarZonas() {
      cajaZonas.innerHTML = '';
      ZONAS.forEach(function (z) {
        var d = document.createElement('div'); d.className = 'pz-zona';
        var h = document.createElement('h6'); h.textContent = z.nombre; d.appendChild(h);
        z.sillas.forEach(function (s) {
          var f = document.createElement('div');
          if (!s.t) { f.className = 'pz-silla libre'; f.textContent = s.e + ' · libre'; }
          else {
            f.className = 'pz-silla' + (s.t.fin ? ' termino' : '') + (s.t.recien ? ' entra' : '');
            var b = document.createElement('b'); b.textContent = s.t.c;
            var q = document.createElement('span'); q.textContent = s.t.q;
            var sm = document.createElement('small'); sm.textContent = s.t.fin ? '✓ Terminó · ' + s.e : s.t.s + ' · ' + s.e;
            f.appendChild(b); f.appendChild(q); f.appendChild(sm);
            s.t.recien = false;
          }
          d.appendChild(f);
        });
        cajaZonas.appendChild(d);
      });
    }
    function pintarFichas() {
      cajaFichas.innerHTML = '';
      if (!esperando.length) { cajaFichas.innerHTML = '<span class="pz-ficha">Nadie esperando</span>'; return; }
      esperando.forEach(function (t) {
        var f = document.createElement('span'); f.className = 'pz-ficha' + (t.nueva ? ' nueva' : '');
        var b = document.createElement('b'); b.textContent = t.c;
        var q = document.createElement('span'); q.textContent = t.q;
        var o = document.createElement('span'); o.className = 'origen'; o.textContent = t.o;
        f.appendChild(b); f.appendChild(q); f.appendChild(o);
        t.nueva = false;
        cajaFichas.appendChild(f);
      });
    }
    function pintarPizarra(flash) { pintarHora(); pintarLlamando(flash); pintarZonas(); pintarFichas(); }

    // Cada paso es lo que haría recepción en la app: terminar, llamar, sentar, y alguien llega
    var fase = 0, pasoPz = null, PASO_PZ = 2300;
    function avanzarPizarra() {
      var prox = esperando[0];
      if (fase === 0) {
        // Si la zona está llena, alguien termina
        var z = zona(prox.z);
        if (!z.sillas.some(function (s) { return !s.t; })) {
          var sil = z.sillas.filter(function (s) { return s.t && !s.t.fin; })[0];
          if (sil) sil.t.fin = true;
        }
        minutos += 2;
        pintarPizarra(false);
      } else if (fase === 1) {
        // Se llama el turno: la silla terminada se libera
        var zz = zona(prox.z);
        zz.sillas.forEach(function (s) { if (s.t && s.t.fin) s.t = null; });
        var libre = zz.sillas.filter(function (s) { return !s.t; })[0];
        esperando.shift();
        prox.e = libre.e; llamado = prox; etiquetaLlamado = 'Llamando';
        minutos += 1;
        pintarPizarra(true);
        if (audio && audio.state === 'running' && actual === 'pizarra') sonar('turno');
      } else if (fase === 2) {
        // Se sentó: pasa a su zona
        var zs = zona(llamado.z);
        var silla = zs.sillas.filter(function (s) { return s.e === llamado.e; })[0];
        silla.t = { c: llamado.c, q: llamado.q, s: llamado.s, recien: true };
        etiquetaLlamado = 'Último llamado';
        var t = nuevoTurno(); t.nueva = true; esperando.push(t);
        minutos += 3;
        pintarPizarra(false);
      }
      fase = (fase + 1) % 3;
    }
    function arrancarPizarra() {
      clearInterval(pasoPz);
      if (reducido) return;
      pasoPz = setInterval(avanzarPizarra, PASO_PZ);
    }
    function pararPizarra() { clearInterval(pasoPz); }
    pintarPizarra(false);

    function alEntrar(p) {
      if (p === 'pizarra') arrancarPizarra(); else pararPizarra();
      if (p === 'metricas' || p === 'ganancias') {
        var panel = document.getElementById('p-' + p);
        animarCuentas(panel); crecerGraficas(panel);
        if (p === 'ganancias') pintarNetos(true);
      }
    }
    var DURACIONES = { pizarra: 16000, ganancias: 10000 };

    // Pantallas
    var ORDEN = ['agenda', 'chats', 'pizarra', 'lounge', 'metricas', 'ganancias'];
    var actual = 'agenda';
    var leyenda = document.getElementById('leyenda-recorrido');
    function mostrar(p) {
      actual = p;
      ORDEN.forEach(function (x) {
        document.getElementById('p-' + x).classList.toggle('activa', x === p);
        document.getElementById('tab-' + x).setAttribute('aria-selected', x === p ? 'true' : 'false');
      });
      document.querySelectorAll('.app-menu [data-p]').forEach(function (b) {
        if (b.getAttribute('data-p') === p) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
      });
      leyenda.textContent = LEYENDAS[p];
      alEntrar(p);
      reiniciarProgreso();
    }
    document.querySelectorAll('.pestanas [data-p], .app-menu [data-p]').forEach(function (b) {
      b.addEventListener('click', function () { detenerRecorrido(); mostrar(b.getAttribute('data-p')); });
    });

    // Recorrido solo: avanza cada 7 s hasta que la persona toque algo
    var DURACION = 7000;
    var reducido = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var andando = !reducido;
    var reloj = null;
    var pausa = document.getElementById('pausa-recorrido');
    function reiniciarProgreso() {
      document.querySelectorAll('.pestanas .progreso').forEach(function (b) { b.style.transition = 'none'; b.style.width = '0'; });
      if (!andando) return;
      var barra = document.querySelector('#tab-' + actual + ' .progreso');
      requestAnimationFrame(function () { requestAnimationFrame(function () {
        barra.style.transition = 'width ' + (DURACIONES[actual] || DURACION) + 'ms linear'; barra.style.width = '100%';
      }); });
      clearTimeout(reloj);
      reloj = setTimeout(function () { mostrar(ORDEN[(ORDEN.indexOf(actual) + 1) % ORDEN.length]); }, DURACIONES[actual] || DURACION);
    }
    function detenerRecorrido() {
      andando = false; clearTimeout(reloj);
      pausa.textContent = 'Seguir recorrido'; pausa.setAttribute('aria-pressed', 'true');
      document.querySelectorAll('.pestanas .progreso').forEach(function (b) { b.style.transition = 'none'; b.style.width = '0'; });
    }
    pausa.addEventListener('click', function () {
      if (andando) { detenerRecorrido(); return; }
      andando = true; pausa.textContent = 'Pausar recorrido'; pausa.setAttribute('aria-pressed', 'false');
      mostrar(ORDEN[(ORDEN.indexOf(actual) + 1) % ORDEN.length]);
    });
    if (!andando) { pausa.textContent = 'Seguir recorrido'; }
    mostrar('agenda');
  })();

  // ── El Lounge: servir con un toque ───────────────────────────────
  [['servir-cafe', 'Café con leche servido'], ['servir-picadera', 'Picadera servida']].forEach(function (par) {
    var b = document.getElementById(par[0]);
    b.addEventListener('click', function () { b.textContent = '✓ ' + par[1]; b.disabled = true; });
  });

