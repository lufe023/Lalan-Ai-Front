/* global THREE */
window.HISTORIA_AUDIO = '/landing/banda.mp3';
  // ── Historia animada: un manicure premium en 3D ────────────────────
  // Todo sale de un solo reloj t (segundos): la misma función pinta la
  // web en vivo y cada cuadro del reel, así el video y el sonido cuadran.
  (function () {
    var raiz = document.getElementById('historia-escena');
    if (!raiz) return;
    var GRABANDO = !!window.HISTORIA_GRABAR;
    var DURACION_H = 62;
    var quieta = !GRABANDO && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ── Curvas ──
    function c01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
    function tramo(t, a, b) { return c01((t - a) / (b - a)); }
    function suave(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
    function sale(x) { return 1 - Math.pow(1 - x, 3); }
    function resorte(x) { return x >= 1 ? 1 : 1 - Math.cos(x * Math.PI * 2.5) * Math.pow(1 - x, 2.2); }
    function rebote(x) {
      var n = 7.5625, d = 2.75;
      if (x < 1 / d) return n * x * x;
      if (x < 2 / d) return n * (x -= 1.5 / d) * x + 0.75;
      if (x < 2.5 / d) return n * (x -= 2.25 / d) * x + 0.9375;
      return n * (x -= 2.625 / d) * x + 0.984375;
    }
    function ventana(t, a, b, d) { d = d || 0.45; return sale(tramo(t, a, a + d)) * (1 - suave(tramo(t, b - d, b))); }
    function rd(n) { return 'RD$ ' + Math.round(n).toLocaleString('en-US'); }

    // Momentos clave (segundos)
    var CAIDAS = [16.7, 18.1, 19.5, 20.9, 22.3];
    var VOZ = [5.6, 8.8];
    var CAMBIO_CANCION = 38.0;
    var LLEGA_LAURA = 37.3;
    var DINERO = [[45.6, 46.4], [46.8, 47.6], [48.0, 48.8]];

    // ── Capa de textos ──
    var vertical = false;
    function todos(sel) { return Array.prototype.slice.call(raiz.querySelectorAll(sel)); }
    var anclas = todos('.h-ancla');
    var conVentana = todos('[data-v]').filter(function (el) { return !el.classList.contains('h-ancla'); });
    var conEntrada = todos('[data-e]');
    var contadores = todos('[data-c]');
    var barritas = todos('[data-w]');
    var inventarios = todos('[data-inv]');
    var sello = raiz.querySelector('.h-sello');
    var cuesta = document.getElementById('h-cuesta');
    var onda = document.getElementById('h-onda');
    var ecual = todos('#h-eq i');
    var barraH = document.getElementById('h-barra');
    var txtPara = document.getElementById('h-para'), txtCancion = document.getElementById('h-cancion'), txtArtista = document.getElementById('h-artista');
    var ALTURAS = [5, 9, 14, 8, 16, 11, 6, 13, 17, 10, 7, 12, 15, 9, 5, 11, 14, 8, 6, 10];
    ALTURAS.forEach(function (a) { var i = document.createElement('i'); i.style.height = a + 'px'; onda.appendChild(i); });
    var barrasOnda = Array.prototype.slice.call(onda.children);
    var CANCIONES = [
      { para: 'Suena para Carmen', titulo: 'Propuesta indecente', artista: 'Romeo Santos · de sus favoritas' },
      { para: 'Suena para Laura', titulo: 'La bachata', artista: 'Manuel Turizo · de sus favoritas' }
    ];

    // Líneas que unen cada etiqueta con su objeto
    var SVGNS = 'http://www.w3.org/2000/svg';
    var svg = raiz.querySelector('.h-lineas');
    anclas.forEach(function (el) {
      var g = document.createElementNS(SVGNS, 'g');
      if (el.classList.contains('verde')) g.setAttribute('class', 'verde');
      var l = document.createElementNS(SVGNS, 'line'), c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('r', '4');
      g.appendChild(l); g.appendChild(c); svg.appendChild(g);
      el._g = g; el._l = l; el._c = c;
    });

    function base(el) {
      if (el.classList.contains('h-titulo')) return 'translate(-50%, -50%) ';
      if (el.classList.contains('h-tarjeta') && !vertical) return 'translateY(-50%) ';
      return '';
    }
    function mostrarEl(el, p, desliza) {
      el.style.opacity = p.toFixed(3);
      el.style.visibility = p > 0.001 ? 'visible' : 'hidden';
      el.style.transform = base(el) + 'translateY(' + ((1 - p) * (desliza || 12)).toFixed(2) + 'px) scale(' + (0.97 + 0.03 * p).toFixed(4) + ')';
    }
    function capa(t) {
      conVentana.forEach(function (el) {
        var v = el.getAttribute('data-v').split(',');
        mostrarEl(el, ventana(t, +v[0], +v[1]), el.classList.contains('h-final') ? 0 : 14);
      });
      conEntrada.forEach(function (el) {
        var e = +el.getAttribute('data-e');
        var p = sale(tramo(t, e, e + 0.45));
        el.style.opacity = p.toFixed(3);
        el.style.transform = 'translateY(' + ((1 - p) * 8).toFixed(2) + 'px)';
      });
      contadores.forEach(function (el) {
        var a = +el.getAttribute('data-a');
        var v = +el.getAttribute('data-c') * sale(tramo(t, a, a + 1.3));
        var mas = +el.getAttribute('data-mas') || 0, mt = +el.getAttribute('data-mas-t') || 0;
        if (mas) v += mas * sale(tramo(t, mt, mt + 0.7));
        el.textContent = rd(v);
        el.style.color = mas && t > mt && t < mt + 1.4 ? 'var(--verde)' : '';
      });
      barritas.forEach(function (el) {
        var a = +el.getAttribute('data-a');
        el.style.width = (+el.getAttribute('data-w') * sale(tramo(t, a, a + 1.3))).toFixed(1) + '%';
      });
      inventarios.forEach(function (el) {
        var d = el.getAttribute('data-inv').split(','), t0 = +el.parentNode.getAttribute('data-e') + 0.3;
        var de = +d[0], a = +d[1], v = de - (de - a) * sale(tramo(t, t0, t0 + 1.1));
        el.textContent = Math.round(v) + ' ' + d[2] + (t > t0 ? '  (−' + (de - a) + ')' : '');
      });
      // La nota de voz se va oyendo
      var oido = tramo(t, VOZ[0], VOZ[1]) * barrasOnda.length;
      barrasOnda.forEach(function (b, i) { b.className = i < oido ? 'oida' : ''; });
      todos('.h-escribe i').forEach(function (p, i) { p.style.opacity = (0.35 + 0.65 * Math.abs(Math.sin(t * 5 - i * 0.7))).toFixed(2); });
      var costo = [45, 30, 35, 12, 23].reduce(function (s, c, i) { return s + c * sale(tramo(t, CAIDAS[i] + 0.3, CAIDAS[i] + 0.8)); }, 0);
      cuesta.textContent = rd(costo);
      var cancion = CANCIONES[t >= CAMBIO_CANCION ? 1 : 0];
      if (txtCancion.textContent !== cancion.titulo) { txtPara.textContent = cancion.para; txtCancion.textContent = cancion.titulo; txtArtista.textContent = cancion.artista; }
      ecual.forEach(function (b, i) { b.style.height = (22 + 78 * Math.abs(Math.sin(t * (3.1 + i * 0.7) + i))).toFixed(0) + '%'; });
      sello.style.opacity = GRABANDO ? String(1 - ventana(t, 55.6, 70)) : '0';
      sello.style.visibility = GRABANDO ? 'visible' : 'hidden';
      if (barraH) barraH.style.width = (t / DURACION_H * 100).toFixed(2) + '%';
    }

    // Etiquetas pegadas a objetos 3D
    var vProy = null;
    function pintarAnclas(t, punto) {
      var W = raiz.clientWidth || 960, H = raiz.clientHeight || 540;
      var maxX = vertical ? W * 0.97 : W * 0.62, maxY = vertical ? H * 0.56 : H * 0.95, minY = vertical ? H * 0.17 : H * 0.3;
      anclas.forEach(function (el) {
        var v = el.getAttribute('data-v').split(',');
        var p = ventana(t, +v[0], +v[1], 0.4);
        var pos = p > 0.001 && punto ? punto(el.getAttribute('data-ancla')) : null;
        if (!pos) { el.style.visibility = 'hidden'; el.style.opacity = '0'; el._g.style.display = 'none'; return; }
        var px = pos.x * W, py = pos.y * H;
        var off = (vertical && el.getAttribute('data-lado-v') ? el.getAttribute('data-lado-v') : el.getAttribute('data-lado')).split(',');
        var dx = +off[0] * W, dy = +off[1] * H;
        var w = el.offsetWidth, h = el.offsetHeight;
        var x = px + dx - (dx < -1 ? w : dx > 1 ? 0 : w / 2);
        var y = py + dy - (dy < 0 ? h : 0);
        x = Math.max(W * 0.02, Math.min(x, maxX - w));
        y = Math.max(minY, Math.min(y, maxY - h));
        var sube = (1 - p) * 8;
        el.style.opacity = p.toFixed(3);
        el.style.visibility = 'visible';
        el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + (y + sube).toFixed(1) + 'px)';
        var ex = Math.max(x, Math.min(px, x + w)), ey = Math.max(y, Math.min(py, y + h));
        el._g.style.display = '';
        el._g.style.opacity = p.toFixed(3);
        el._l.setAttribute('x1', px.toFixed(1)); el._l.setAttribute('y1', py.toFixed(1));
        el._l.setAttribute('x2', ex.toFixed(1)); el._l.setAttribute('y2', (ey + sube).toFixed(1));
        el._c.setAttribute('cx', px.toFixed(1)); el._c.setAttribute('cy', py.toFixed(1));
      });
    }

    // ── El mundo en 3D ──
    var hay3D = typeof THREE !== 'undefined';
    var renderer, escena, camara, mundo, mover, tomar, puntoDe;
    if (hay3D) {
      try {
        renderer = new THREE.WebGLRenderer({ canvas: raiz.querySelector('.h-lienzo'), antialias: true, alpha: true, preserveDrawingBuffer: GRABANDO });
      } catch (e) { hay3D = false; }
    }

    if (hay3D) (function () {
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      escena = new THREE.Scene();
      camara = new THREE.PerspectiveCamera(32, 16 / 9, 0.1, 120);

      // Colores: los de la marca del salón, en tonos pastel
      var dinamicos = [];
      var pal = {};
      function leerPaleta() {
        var cs = getComputedStyle(document.documentElement);
        pal.marca = (cs.getPropertyValue('--marca') || '').trim() || '#C46B7C';
        pal.acento = (cs.getPropertyValue('--acento-marca') || '').trim() || '#A58FE3';
      }
      function mezcla(a, b, k) { return new THREE.Color(a).lerp(new THREE.Color(b), k); }
      function lin(c) { return (c && c.isColor ? c.clone() : new THREE.Color(c)).convertSRGBToLinear(); }
      function mat(color, extra) {
        var o = { color: lin(color), roughness: 0.62, metalness: 0 };
        if (extra) for (var k in extra) o[k] = extra[k];
        return new THREE.MeshStandardMaterial(o);
      }
      function matMarca(f, extra) { var m = mat('#ffffff', extra); dinamicos.push({ m: m, f: f }); return m; }
      function pintarPaleta() {
        leerPaleta();
        dinamicos.forEach(function (d) {
          var c = lin(d.f(pal));
          d.m.color.copy(c);
          if (d.m.userData.brilla) d.m.emissive.copy(c);
        });
        tvClave = '';
      }

      // Formas
      function malla(geo, m, sombra) { var x = new THREE.Mesh(geo, m); x.castShadow = sombra !== false; x.receiveShadow = true; return x; }
      function caja(w, h, d, r) {
        r = Math.min(r || 0.06, w / 2.2, h / 2.2, d / 2.2);
        var e = r * 0.7, W = w - 2 * e, H = h - 2 * e, rc = Math.min(r * 0.4, W / 2.2, H / 2.2);
        var s = new THREE.Shape(), x = -W / 2, y = -H / 2;
        s.moveTo(x + rc, y); s.lineTo(x + W - rc, y); s.quadraticCurveTo(x + W, y, x + W, y + rc);
        s.lineTo(x + W, y + H - rc); s.quadraticCurveTo(x + W, y + H, x + W - rc, y + H);
        s.lineTo(x + rc, y + H); s.quadraticCurveTo(x, y + H, x, y + H - rc);
        s.lineTo(x, y + rc); s.quadraticCurveTo(x, y, x + rc, y);
        var g = new THREE.ExtrudeGeometry(s, { depth: Math.max(d - 2 * e, 0.001), bevelEnabled: true, bevelSize: e, bevelThickness: e, bevelSegments: 3, curveSegments: 4 });
        g.center();
        return g;
      }
      function capsula(rb, rt, h, seg) {
        var p = [], i, a;
        for (i = 0; i <= 8; i++) { a = -Math.PI / 2 + (Math.PI / 2) * (i / 8); p.push(new THREE.Vector2(Math.max(rb * Math.cos(a), 0.0001), rb + rb * Math.sin(a))); }
        for (i = 0; i <= 8; i++) { a = (Math.PI / 2) * (i / 8); p.push(new THREE.Vector2(Math.max(rt * Math.cos(a), 0.0001), rb + h + rt * Math.sin(a))); }
        return new THREE.LatheGeometry(p, seg || 22);
      }
      function esfera(r) { return new THREE.SphereGeometry(r, 24, 16); }
      function cil(rt, rb, h, s) { return new THREE.CylinderGeometry(rt, rb, h, s || 28); }
      function en(obj, x, y, z) { obj.position.set(x, y, z); return obj; }
      function lienzo(w, h) { var c = document.createElement('canvas'); c.width = w; c.height = h; var tx = new THREE.CanvasTexture(c); tx.encoding = THREE.sRGBEncoding; tx.anisotropy = 4; return { c: c, x: c.getContext('2d'), tx: tx }; }
      function redondo(x, X, Y, W, H, r) { x.beginPath(); x.moveTo(X + r, Y); x.lineTo(X + W - r, Y); x.quadraticCurveTo(X + W, Y, X + W, Y + r); x.lineTo(X + W, Y + H - r); x.quadraticCurveTo(X + W, Y + H, X + W - r, Y + H); x.lineTo(X + r, Y + H); x.quadraticCurveTo(X, Y + H, X, Y + H - r); x.lineTo(X, Y + r); x.quadraticCurveTo(X, Y, X + r, Y); x.closePath(); }
      var FUENTE = '"Plus Jakarta Sans", system-ui, sans-serif';
      function pastilla(txt, fondo, color, ancho, alto, tam) {
        var l = lienzo(ancho, alto);
        l.x.fillStyle = fondo; redondo(l.x, 0, 0, ancho, alto, alto / 2); l.x.fill();
        l.x.fillStyle = color; l.x.font = '800 ' + tam + 'px ' + FUENTE; l.x.textAlign = 'center'; l.x.textBaseline = 'middle';
        l.x.fillText(txt, ancho / 2, alto / 2 + 2);
        return l.tx;
      }

      // Materiales fijos
      var M = {
        crema: mat('#F7EFEA'), madera: mat('#D8B79C'), oscuro: mat('#2B2124', { roughness: 0.4 }),
        blanco: mat('#FFFFFF', { roughness: 0.3 }), planta: mat('#86A97F'), plantaHonda: mat('#5F8A63'),
        maceta: mat('#E9D6CC'), ojo: mat('#1D1417', { roughness: 0.2 }), rubor: mat('#F2A0AE', { roughness: 0.9 }),
        vino: mat('#7A1F33', { roughness: 0.2 }), vidrio: new THREE.MeshStandardMaterial({ color: lin('#FFFFFF'), transparent: true, opacity: 0.35, roughness: 0.05 }),
        ambar: mat('#C98A3C', { roughness: 0.25 }), noche: mat('#2A2F5E', { emissive: lin('#1B1F45'), roughness: 0.4 }),
        luna: mat('#FFF3C4', { emissive: lin('#FFE9A6') }), lampara: mat('#FFE2B8', { emissive: lin('#FFC98A'), emissiveIntensity: 0.9 }),
        arena: mat('#F3DDB4', { roughness: 0.95 }), arenaHonda: mat('#E2C491', { roughness: 0.95 }),
        mar: mat('#58C4CC', { roughness: 0.18, metalness: 0.05, flatShading: true }), marHondo: mat('#2E8C9E', { roughness: 0.3 }),
        espuma: mat('#FFFFFF', { roughness: 0.5 }), corteza: mat('#B08663', { roughness: 0.9 }), coco: mat('#6B4A2E'),
        naranja: mat('#F29A3A', { roughness: 0.2 }), coral: mat('#F08A6E'), paja: mat('#F2E2BF', { roughness: 0.9 })
      };
      var MM = {
        piso: matMarca(function (p) { return mezcla(p.marca, '#FFFFFF', 0.86); }, { roughness: 0.85 }),
        borde: matMarca(function (p) { return mezcla(p.marca, '#FFFFFF', 0.55); }),
        pared: matMarca(function (p) { return mezcla(p.marca, '#FFFFFF', 0.78); }),
        sofa: matMarca(function (p) { return mezcla(p.acento, '#FFFFFF', 0.35); }, { roughness: 0.9 }),
        alfombra: matMarca(function (p) { return mezcla(p.acento, '#FFFFFF', 0.7); }, { roughness: 1 }),
        marca: matMarca(function (p) { return p.marca; }),
        marcaVidrio: matMarca(function (p) { return p.marca; }, { roughness: 0.15 }),
        marcaSuave: matMarca(function (p) { return mezcla(p.marca, '#FFFFFF', 0.35); }),
        acento: matMarca(function (p) { return p.acento; }),
        acentoHondo: matMarca(function (p) { return mezcla(p.acento, '#1a1030', 0.45); }),
        linea: new THREE.LineDashedMaterial({ color: 0xffffff, dashSize: 0.25, gapSize: 0.18, transparent: true, opacity: 0 })
      };
      function pantallaMat() { var m = matMarca(function (p) { return mezcla(p.marca, '#FFFFFF', 0.25); }, { emissiveIntensity: 0.9 }); m.emissive = new THREE.Color(); m.userData.brilla = true; return m; }
      MM.pantalla = pantallaMat();
      var pantallaAlanny = new THREE.MeshStandardMaterial({ color: lin('#FFFFFF'), emissive: lin('#F5C6CF'), emissiveIntensity: 0.9 });
      var basicoMarca = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
      dinamicos.push({ m: basicoMarca, f: function (p) { return p.marca; } });
      dinamicos.push({ m: MM.linea, f: function (p) { return p.marca; } });

      mundo = new THREE.Group();
      escena.add(mundo);

      // Luz
      escena.add(new THREE.HemisphereLight(0xffffff, 0xf3d9df, 0.72));
      var sol = new THREE.DirectionalLight(0xffffff, 0.78);
      sol.position.set(4, 10, 7);
      sol.castShadow = true;
      sol.shadow.mapSize.set(GRABANDO ? 2048 : 1024, GRABANDO ? 2048 : 1024);
      sol.shadow.camera.left = -9; sol.shadow.camera.right = 9; sol.shadow.camera.top = 9; sol.shadow.camera.bottom = -9;
      sol.shadow.camera.near = 1; sol.shadow.camera.far = 40;
      sol.shadow.radius = 4; sol.shadow.bias = -0.0008;
      escena.add(sol); escena.add(sol.target);
      var relleno = new THREE.DirectionalLight(0xfff0f4, 0.25); relleno.position.set(-6, 4, -3); escena.add(relleno);

      // La plataforma del salón
      mundo.add(en(malla(cil(6, 6.1, 0.4, 72), MM.piso), 0, -0.2, 0));
      mundo.add(en(malla(cil(6.12, 5.9, 0.5, 72), MM.borde), 0, -0.42, 0));

      function planta(x, z, s, padre) {
        var g = new THREE.Group();
        g.add(en(malla(cil(0.2, 0.15, 0.32), M.maceta), 0, 0.16, 0));
        [[0, 0.52, 0, 0.24], [0.13, 0.42, 0.05, 0.17], [-0.12, 0.44, -0.04, 0.18], [0.02, 0.72, -0.02, 0.15]].forEach(function (h, i) {
          g.add(en(malla(esfera(h[3]), i % 2 ? M.plantaHonda : M.planta), h[0], h[1], h[2]));
        });
        g.position.set(x, 0, z); g.scale.setScalar(s || 1);
        (padre || mundo).add(g); return g;
      }

      // Personas: figuras de juguete, cálidas y sencillas
      function persona(o) {
        var g = new THREE.Group();
        var piel = mat(o.piel), pelo = mat(o.pelo, { roughness: 0.8 }), ropa = o.ropa;
        var baseY = o.sentada ? 0.47 : 0.55;
        g.add(en(malla(capsula(0.27, 0.2, 0.34), ropa), 0, baseY, 0));
        var tope = baseY + 0.27 + 0.34 + 0.2;
        var cy = tope + 0.16;
        var cabeza = new THREE.Group(); cabeza.position.y = cy; g.add(cabeza);
        cabeza.add(malla(esfera(0.22), piel));
        [-1, 1].forEach(function (s) {
          if (!o.gafas) cabeza.add(en(malla(esfera(0.024), M.ojo, false), s * 0.075, 0.02, 0.2));
          var mej = malla(esfera(0.042), M.rubor, false); mej.scale.set(1, 0.7, 0.35); cabeza.add(en(mej, s * 0.12, -0.05, 0.175));
        });
        var boca = malla(new THREE.TorusGeometry(0.045, 0.011, 6, 14, Math.PI), M.ojo, false);
        boca.rotation.z = Math.PI; cabeza.add(en(boca, 0, -0.06, 0.205));
        if (o.peinado === 'afro') {
          var afro = malla(esfera(0.31), pelo); afro.scale.set(1.05, 0.95, 0.9); cabeza.add(en(afro, 0, 0.07, -0.09));
          cabeza.add(en(malla(esfera(0.12), pelo), 0, 0.3, -0.05));
        } else {
          var gorro = malla(new THREE.SphereGeometry(0.235, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), pelo);
          gorro.rotation.x = -0.35; cabeza.add(gorro);
          if (o.peinado === 'moño') cabeza.add(en(malla(esfera(0.11), pelo), 0, 0.2, -0.13));
          if (o.peinado === 'largo') cabeza.add(en(malla(capsula(0.2, 0.17, 0.28), pelo), 0, -0.52, -0.1));
          if (o.peinado === 'coleta') {
            // Coleta alta con un lazo grande del color de la marca
            cabeza.add(en(malla(esfera(0.085), pelo), 0, 0.2, -0.16));
            var cola = malla(capsula(0.1, 0.05, 0.34), pelo); cola.rotation.x = Math.PI - 0.5; cabeza.add(en(cola, 0, 0.22, -0.2));
            [-1, 1].forEach(function (s) { var lazo = malla(esfera(0.07), MM.marca); lazo.scale.set(1.3, 0.8, 0.5); cabeza.add(en(lazo, s * 0.08, 0.27, -0.16)); });
            cabeza.add(en(malla(esfera(0.035), MM.marca), 0, 0.27, -0.16));
          }
          if (o.peinado === 'rizos') {
            // Melena larga de rizos con volumen y una flor a un lado
            [[-0.2, 0.02, -0.08], [0.2, 0.02, -0.08], [-0.22, -0.14, -0.06], [0.22, -0.14, -0.06], [-0.18, -0.3, -0.1], [0.18, -0.3, -0.1],
              [0, -0.05, -0.2], [-0.1, -0.2, -0.2], [0.1, -0.2, -0.2], [0, -0.36, -0.18], [-0.12, 0.15, -0.14], [0.12, 0.15, -0.14]].forEach(function (r, i) {
              cabeza.add(en(malla(esfera(0.1 + (i % 3) * 0.012), pelo), r[0], r[1], r[2]));
            });
            [[0, 0], [0.035, 0.02], [-0.035, 0.02], [0.02, -0.03], [-0.02, -0.03]].forEach(function (f, i) {
              cabeza.add(en(malla(esfera(i ? 0.03 : 0.025), i ? MM.marcaSuave : M.ambar, false), 0.21 + f[0] * 0.3, 0.12 + f[1], 0.08 + f[0]));
            });
          }
        }
        if (o.gafas) {
          [-1, 1].forEach(function (s) { cabeza.add(en(malla(caja(0.1, 0.065, 0.02, 0.02), M.ojo, false), s * 0.075, 0.025, 0.212)); });
          cabeza.add(en(malla(new THREE.BoxGeometry(0.06, 0.012, 0.012), M.ojo, false), 0, 0.035, 0.215));
        }
        if (o.sombrero) {
          cabeza.add(en(malla(cil(0.42, 0.42, 0.02, 40), M.paja), 0, 0.14, -0.02));
          cabeza.add(en(malla(cil(0.18, 0.22, 0.17, 30), M.paja), 0, 0.23, -0.02));
          cabeza.add(en(malla(cil(0.222, 0.222, 0.045, 30), MM.marca), 0, 0.17, -0.02));
        }
        var brazos = [-1, 1].map(function (s) {
          var hombro = new THREE.Group(); hombro.position.set(s * 0.25, tope - 0.13, 0);
          var brazo = malla(capsula(0.065, 0.06, 0.28), ropa); brazo.rotation.x = Math.PI; brazo.position.y = 0.06; hombro.add(brazo);
          var mano = malla(esfera(0.07), piel); mano.position.y = -0.4; hombro.add(mano);
          hombro.rotation.z = s * 0.12;
          g.add(hombro); hombro.userData.mano = mano; return hombro;
        });
        var pierna = o.pantalon || ropa;
        [-1, 1].forEach(function (s) {
          if (o.sentada) {
            var muslo = malla(capsula(0.09, 0.085, 0.26), pierna); muslo.rotation.x = Math.PI / 2; g.add(en(muslo, s * 0.12, baseY + 0.09, -0.02));
            if (o.estirada) {
              var pata2 = malla(capsula(0.08, 0.08, 0.3), pierna); pata2.rotation.x = Math.PI / 2; g.add(en(pata2, s * 0.12, baseY + 0.07, 0.4));
              g.add(en(malla(esfera(0.085), piel), s * 0.12, baseY + 0.1, 0.86));
            } else {
              g.add(en(malla(capsula(0.08, 0.08, 0.28), pierna), s * 0.12, 0.02, 0.4));
              g.add(en(malla(esfera(0.085), M.oscuro), s * 0.12, 0.05, 0.46));
            }
          } else {
            g.add(en(malla(capsula(0.09, 0.085, 0.32), pierna), s * 0.12, 0.04, 0));
            g.add(en(malla(esfera(0.09), M.oscuro), s * 0.12, 0.05, 0.05));
          }
        });
        g.userData = { brazos: brazos, cabeza: cabeza, cy: cy, tope: tope, boca: boca };
        (o.padre || mundo).add(g);
        return g;
      }
      function telefono(pant) {
        var t = new THREE.Group();
        t.add(malla(caja(0.13, 0.24, 0.025, 0.02), M.oscuro));
        var p = malla(new THREE.PlaneGeometry(0.11, 0.2), pant || MM.pantalla, false); p.position.z = -0.014; p.rotation.y = Math.PI; t.add(p);
        var p2 = p.clone(); p2.position.z = 0.014; p2.rotation.y = 0; t.add(p2);
        return t;
      }

      // ── La casa de Carmen, de noche ──
      var CASA = new THREE.Vector3(-3.2, 0, 0.3);
      mundo.add(en(malla(cil(1.25, 1.25, 0.02, 48), MM.alfombra), CASA.x, 0.01, CASA.z + 0.1));
      mundo.add(en(malla(caja(2.8, 2.5, 0.16, 0.06), MM.pared), CASA.x, 1.25, CASA.z - 0.85));
      mundo.add(en(malla(caja(1.1, 0.85, 0.06, 0.03), M.blanco), CASA.x, 1.75, CASA.z - 0.76));
      mundo.add(en(malla(new THREE.PlaneGeometry(0.94, 0.7), M.noche, false), CASA.x, 1.75, CASA.z - 0.725));
      mundo.add(en(malla(new THREE.CircleGeometry(0.11, 32), M.luna, false), CASA.x + 0.25, 1.9, CASA.z - 0.72));
      [[-0.3, 1.95], [-0.1, 1.62], [0.05, 2.0], [-0.34, 1.55], [0.32, 1.55]].forEach(function (s) {
        mundo.add(en(malla(new THREE.CircleGeometry(0.012, 8), M.luna, false), CASA.x + s[0], s[1], CASA.z - 0.72));
      });
      mundo.add(en(malla(caja(1.8, 0.3, 0.8, 0.12), MM.sofa), CASA.x, 0.3, CASA.z));
      mundo.add(en(malla(caja(1.8, 0.62, 0.24, 0.1), MM.sofa), CASA.x, 0.72, CASA.z - 0.33));
      [-1, 1].forEach(function (s) { mundo.add(en(malla(caja(0.24, 0.5, 0.8, 0.1), MM.sofa), CASA.x + s * 0.92, 0.42, CASA.z)); });
      mundo.add(en(malla(caja(0.4, 0.34, 0.1, 0.08), MM.marcaSuave), CASA.x - 0.55, 0.62, CASA.z - 0.15));
      var lamp = new THREE.Group(); lamp.position.set(CASA.x - 1.35, 0, CASA.z - 0.3);
      lamp.add(en(malla(cil(0.18, 0.2, 0.04), M.oscuro), 0, 0.02, 0));
      lamp.add(en(malla(cil(0.022, 0.022, 1.45, 10), M.oscuro), 0, 0.74, 0));
      lamp.add(en(malla(cil(0.16, 0.28, 0.3, 28), M.lampara, false), 0, 1.5, 0));
      mundo.add(lamp);
      var luzLampara = new THREE.PointLight(0xffc98a, 0.9, 3.4, 2); luzLampara.position.set(CASA.x - 1.35, 1.3, CASA.z - 0.1); mundo.add(luzLampara);

      var carmen = persona({ piel: '#B9805E', pelo: '#2A1A14', ropa: MM.marca, pantalon: MM.acentoHondo, peinado: 'rizos', sentada: true });
      var telCarmen = telefono(); carmen.userData.brazos[1].userData.mano.add(telCarmen); telCarmen.position.set(0, -0.08, 0.02);
      // Rayitas de "está hablando", al lado de su boca
      var rayas = [-0.5, 0, 0.5].map(function (a) {
        var r = new THREE.Mesh(caja(0.16, 0.028, 0.028, 0.012), basicoMarca);
        var pivote = new THREE.Group(); pivote.position.set(-0.2, -0.06, 0.16); pivote.rotation.z = a; pivote.rotation.y = -0.5;
        r.position.x = -0.16; pivote.add(r); carmen.userData.cabeza.add(pivote);
        pivote.userData.r = r; return pivote;
      });

      // ── La mesa de uñas ──
      var MESA = new THREE.Vector3(0.3, 0, -0.6);
      var ALTO_MESA = 0.9;
      mundo.add(en(malla(caja(1.5, 0.08, 0.66, 0.04), M.crema), MESA.x, ALTO_MESA - 0.04, MESA.z));
      [[-0.66, -0.26], [0.66, -0.26], [-0.66, 0.26], [0.66, 0.26]].forEach(function (p) {
        mundo.add(en(malla(cil(0.03, 0.03, ALTO_MESA - 0.08, 10), M.madera), MESA.x + p[0], (ALTO_MESA - 0.08) / 2, MESA.z + p[1]));
      });
      mundo.add(en(malla(caja(0.46, 0.03, 0.3, 0.02), MM.marcaSuave, false), MESA.x, ALTO_MESA + 0.015, MESA.z + 0.1));
      function silla(x, z, rotY) {
        var g = new THREE.Group();
        g.add(en(malla(caja(0.55, 0.1, 0.5, 0.05), MM.sofa), 0, 0.42, 0));
        g.add(en(malla(caja(0.55, 0.55, 0.1, 0.05), MM.sofa), 0, 0.7, -0.23));
        g.add(en(malla(cil(0.03, 0.03, 0.38, 8), M.madera), 0, 0.19, 0));
        g.add(en(malla(cil(0.2, 0.22, 0.03, 20), M.madera), 0, 0.02, 0));
        g.position.set(x, 0, z); g.rotation.y = rotY; mundo.add(g);
      }
      silla(MESA.x, MESA.z + 0.78, Math.PI);
      silla(MESA.x, MESA.z - 0.78, 0);

      var valentina = persona({ piel: '#7E4E35', pelo: '#140D0B', ropa: M.blanco, pantalon: MM.acentoHondo, peinado: 'coleta', sentada: true });
      valentina.position.set(MESA.x, 0.0, MESA.z - 0.74);
      valentina.add(en(malla(caja(0.36, 0.3, 0.06, 0.03), MM.marca), 0, 0.8, 0.23));

      // Los insumos de la receta, uno por uno
      function botellita(cuerpo, tapa, alto) {
        var g = new THREE.Group();
        g.add(en(malla(caja(0.13, alto, 0.13, 0.04), cuerpo), 0, alto / 2, 0));
        g.add(en(malla(cil(0.03, 0.035, 0.14, 12), tapa), 0, alto + 0.07, 0));
        return g;
      }
      var insumos = [];
      (function () {
        var gel = botellita(MM.marcaVidrio, M.oscuro, 0.14);
        var baseTop = new THREE.Group();
        baseTop.add(en(botellita(M.blanco, MM.marca, 0.12), -0.06, 0, 0));
        baseTop.add(en(botellita(M.blanco, M.oscuro, 0.12), 0.07, 0, 0.02));
        var parafina = new THREE.Group();
        parafina.add(en(malla(cil(0.12, 0.12, 0.12, 28), M.crema), 0, 0.06, 0));
        parafina.add(en(malla(cil(0.125, 0.125, 0.04, 28), MM.acento), 0, 0.14, 0));
        var aceite = new THREE.Group();
        aceite.add(en(malla(cil(0.05, 0.055, 0.12, 20), M.ambar), 0, 0.06, 0));
        aceite.add(en(malla(cil(0.02, 0.02, 0.06, 10), M.oscuro), 0, 0.15, 0));
        aceite.add(en(malla(esfera(0.035), M.oscuro), 0, 0.2, 0));
        var lima = new THREE.Group();
        var l1 = malla(caja(0.32, 0.02, 0.06, 0.01), MM.marcaSuave); l1.rotation.y = 0.4; lima.add(en(l1, 0, 0.01, 0));
        var palito = malla(cil(0.01, 0.01, 0.26, 8), M.madera); palito.rotation.z = Math.PI / 2; palito.rotation.y = -0.3; lima.add(en(palito, 0.02, 0.03, 0.08));
        [[gel, -0.48, -0.1, 0.34], [baseTop, -0.17, -0.14, 0.3], [parafina, 0.14, -0.1, 0.24], [aceite, 0.42, -0.14, 0.34], [lima, 0.7, -0.04, 0.08]].forEach(function (d, i) {
          d[0].position.set(MESA.x + d[1], ALTO_MESA, MESA.z + d[2]);
          d[0].scale.setScalar(1.45);
          d[0].userData = { x: MESA.x + d[1], z: MESA.z + d[2], t: CAIDAS[i], alto: d[3] };
          mundo.add(d[0]);
          var aro = malla(new THREE.RingGeometry(0.1, 0.13, 36), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 }), false);
          dinamicos.push({ m: aro.material, f: function (p) { return p.marca; } });
          aro.rotation.x = -Math.PI / 2; aro.position.set(MESA.x + d[1], ALTO_MESA + 0.005, MESA.z + d[2]);
          mundo.add(aro); d[0].userData.aro = aro;
          insumos.push(d[0]);
        });
      })();

      // ── El teléfono en la mesa: el mando de la TV ──
      var mandoL = lienzo(240, 420);
      var mando = new THREE.Group();
      mando.add(malla(caja(0.17, 0.02, 0.31, 0.02), M.oscuro));
      var mandoPant = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.28), new THREE.MeshBasicMaterial({ map: mandoL.tx }));
      mandoPant.rotation.x = -Math.PI / 2; mandoPant.position.y = 0.012; mando.add(mandoPant);
      mando.position.set(MESA.x + 0.62, ALTO_MESA + 0.012, MESA.z + 0.2); mando.rotation.y = -0.5;
      mundo.add(mando);

      // ── La pizarra del salón (TV) ──
      var tvL = lienzo(640, 368);
      var tv = new THREE.Group(); tv.position.set(-1.05, 0, -0.45); tv.rotation.y = Math.PI / 2 - 0.25;
      tv.add(en(malla(cil(0.22, 0.25, 0.04, 24), M.oscuro), 0, 0.02, 0));
      tv.add(en(malla(cil(0.03, 0.03, 1.3, 10), M.oscuro), 0, 0.66, 0));
      tv.add(en(malla(caja(1.3, 0.77, 0.07, 0.03), M.oscuro), 0, 1.66, 0));
      var tvPant = new THREE.Mesh(new THREE.PlaneGeometry(1.22, 0.7), new THREE.MeshBasicMaterial({ map: tvL.tx }));
      tvPant.position.set(0, 1.66, 0.037); tv.add(tvPant);
      mundo.add(tv);
      var tvClave = '';
      function dibujarTV(t) {
        var x = tvL.x, W = 640, H = 368;
        var cancion = CANCIONES[t >= CAMBIO_CANCION ? 1 : 0];
        var llamaLaura = t >= CAMBIO_CANCION + 0.3;
        var clave = cancion.titulo + llamaLaura + Math.floor(t * 12);
        if (clave === tvClave) return; tvClave = clave;
        var g = x.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, '#1C1216'); g.addColorStop(1, mezcla(pal.marca, '#12090C', 0.72).getStyle());
        x.fillStyle = g; x.fillRect(0, 0, W, H);
        // Música
        x.fillStyle = 'rgba(255,255,255,.06)'; redondo(x, 18, 18, 250, H - 36, 18); x.fill();
        x.fillStyle = mezcla(pal.marca, '#FFFFFF', 0.45).getStyle(); x.font = '800 15px ' + FUENTE; x.fillText('AHORA SUENA', 36, 50);
        var disco = x.createRadialGradient(80, 110, 6, 100, 130, 70); disco.addColorStop(0, pal.marca); disco.addColorStop(1, '#2a0f18');
        x.fillStyle = disco; redondo(x, 36, 66, 110, 110, 16); x.fill();
        x.fillStyle = '#FFFFFF'; x.font = '800 22px ' + FUENTE; x.fillText(cancion.titulo, 36, 210);
        x.fillStyle = 'rgba(255,255,255,.72)'; x.font = '600 15px ' + FUENTE; x.fillText(cancion.artista.split(' · ')[0], 36, 234);
        x.fillStyle = mezcla(pal.marca, '#FFFFFF', 0.45).getStyle(); x.font = '700 14px ' + FUENTE; x.fillText(cancion.para, 36, 258);
        var avance = ((t - (t >= CAMBIO_CANCION ? CAMBIO_CANCION : 30)) / 40) % 1;
        x.fillStyle = 'rgba(255,255,255,.18)'; redondo(x, 36, 290, 212, 6, 3); x.fill();
        x.fillStyle = mezcla(pal.marca, '#FFFFFF', 0.3).getStyle(); redondo(x, 36, 290, Math.max(8, 212 * c01(avance)), 6, 3); x.fill();
        for (var i = 0; i < 6; i++) { var hb = 8 + 26 * Math.abs(Math.sin(t * (3 + i * 0.8) + i)); x.fillRect(170 + i * 12, 170 - hb, 7, hb); }
        // Turnos
        x.fillStyle = 'rgba(255,255,255,.55)'; x.font = '800 15px ' + FUENTE; x.fillText('TURNOS', 290, 50);
        var flash = llamaLaura ? 1 - tramo(t, CAMBIO_CANCION + 0.3, CAMBIO_CANCION + 1.6) : 0;
        x.fillStyle = mezcla(pal.marca, '#FFFFFF', 0.1 + 0.5 * flash).getStyle(); redondo(x, 290, 64, 330, 110, 16); x.fill();
        x.fillStyle = '#FFFFFF'; x.font = '800 13px ' + FUENTE; x.fillText('LLAMANDO', 308, 90);
        x.font = '600 50px Fraunces, Georgia, serif'; x.fillText(llamaLaura ? 'C-12' : 'U-08', 308, 148);
        x.font = '800 20px ' + FUENTE; x.fillText(llamaLaura ? 'Laura M.' : 'Carmen R.', 450, 118);
        x.font = '600 15px ' + FUENTE; x.fillText(llamaLaura ? 'Cabello · Mariela' : 'Uñas · Valentina', 450, 142);
        x.fillStyle = 'rgba(255,255,255,.55)'; x.font = '800 13px ' + FUENTE; x.fillText('EN ATENCIÓN', 290, 204);
        var filas = llamaLaura ? [['U-08', 'Carmen R. · Uñas'], ['S-03', 'Ana L. · Spa']] : [['C-10', 'Paola G. · Cabello'], ['S-03', 'Ana L. · Spa']];
        filas.forEach(function (f, i) {
          x.fillStyle = 'rgba(255,255,255,.07)'; redondo(x, 290, 214 + i * 42, 330, 34, 10); x.fill();
          x.fillStyle = mezcla(pal.marca, '#FFFFFF', 0.45).getStyle(); x.font = '800 16px ' + FUENTE; x.fillText(f[0], 304, 237 + i * 42);
          x.fillStyle = '#FFFFFF'; x.font = '600 15px ' + FUENTE; x.fillText(f[1], 362, 237 + i * 42);
        });
        x.fillStyle = 'rgba(255,255,255,.55)'; x.font = '800 13px ' + FUENTE; x.fillText('ESPERANDO', 290, 318);
        x.fillStyle = '#FFFFFF'; x.font = '600 14px ' + FUENTE;
        x.fillText(t >= LLEGA_LAURA && !llamaLaura ? 'C-12 Laura M.   ·   U-09 Rosa P.' : 'U-09 Rosa P.   ·   C-13 Denisse A.', 290, 342);
        tvL.tx.needsUpdate = true;
        // El mando muestra lo mismo
        var m = mandoL.x;
        m.fillStyle = '#17100F'; m.fillRect(0, 0, 240, 420);
        m.fillStyle = 'rgba(255,255,255,.6)'; m.font = '800 13px ' + FUENTE; m.fillText('MANDO · TV DEL SALÓN', 20, 36);
        m.fillStyle = mezcla(pal.marca, '#2a0f18', 0.2).getStyle(); redondo(m, 18, 52, 204, 120, 16); m.fill();
        m.fillStyle = '#FFFFFF'; m.font = '800 18px ' + FUENTE; m.fillText(cancion.titulo, 32, 96);
        m.font = '600 13px ' + FUENTE; m.fillText(cancion.para, 32, 120);
        m.fillText('⏮      ❚❚      ⏭', 44, 156);
        m.fillStyle = 'rgba(255,255,255,.08)'; redondo(m, 18, 190, 204, 54, 14); m.fill();
        m.fillStyle = '#FFFFFF'; m.font = '700 13px ' + FUENTE; m.fillText('Música automática', 32, 222);
        m.fillStyle = '#4CC38A'; redondo(m, 168, 205, 40, 24, 12); m.fill(); m.fillStyle = '#FFFFFF'; m.beginPath(); m.arc(196, 217, 9, 0, Math.PI * 2); m.fill();
        m.fillStyle = mezcla(pal.marca, '#FFFFFF', 0.15 + 0.4 * flash).getStyle(); redondo(m, 18, 262, 204, 60, 16); m.fill();
        m.fillStyle = '#FFFFFF'; m.font = '800 16px ' + FUENTE; m.fillText('Llamar siguiente', 40, 298);
        m.fillStyle = 'rgba(255,255,255,.55)'; m.font = '600 12px ' + FUENTE; m.fillText(llamaLaura ? 'Llamando a C-12 Laura' : 'Llamando a U-08 Carmen', 20, 350);
        mandoL.tx.needsUpdate = true;
      }

      // ── El Lounge: barra, bocina y la copa ──
      var BARRA = new THREE.Vector3(3.3, 0, 0.2);
      mundo.add(en(malla(caja(1.3, 0.95, 0.55, 0.08), MM.marcaSuave), BARRA.x, 0.475, BARRA.z));
      mundo.add(en(malla(caja(1.4, 0.06, 0.62, 0.03), M.crema), BARRA.x, 0.97, BARRA.z));
      [[-0.4, M.vino], [-0.22, M.ambar], [0.35, MM.acentoHondo]].forEach(function (b) {
        var bot = new THREE.Group();
        bot.add(en(malla(cil(0.06, 0.06, 0.26, 16), b[1]), 0, 0.13, 0));
        bot.add(en(malla(cil(0.022, 0.05, 0.1, 12), b[1]), 0, 0.31, 0));
        bot.position.set(BARRA.x + b[0], 1.0, BARRA.z - 0.1); mundo.add(bot);
      });
      var bocina = new THREE.Group(); bocina.position.set(BARRA.x + 0.75, 0, BARRA.z - 1.05);
      bocina.add(en(malla(caja(0.46, 0.9, 0.4, 0.08), M.oscuro), 0, 0.45, 0));
      var conos = [[0.62, 0.13], [0.3, 0.09]].map(function (c) {
        var cono = malla(new THREE.CircleGeometry(c[1], 28), MM.acento, false); cono.position.set(0, c[0], 0.205); bocina.add(cono); return cono;
      });
      bocina.rotation.y = -0.5;
      mundo.add(bocina);
      var mesita = new THREE.Group(); mesita.position.set(MESA.x + 1.05, 0, MESA.z + 0.85);
      mesita.add(en(malla(cil(0.24, 0.24, 0.04, 28), M.crema), 0, 0.62, 0));
      mesita.add(en(malla(cil(0.03, 0.03, 0.6, 10), M.madera), 0, 0.3, 0));
      mesita.add(en(malla(cil(0.16, 0.18, 0.03, 20), M.madera), 0, 0.015, 0));
      mundo.add(mesita);
      function copaDe(liquido, conBandeja) {
        var c = new THREE.Group();
        var perfil = [[0.001, 0], [0.07, 0.004], [0.07, 0.012], [0.012, 0.02], [0.01, 0.14], [0.03, 0.15], [0.07, 0.19], [0.08, 0.25], [0.075, 0.3]].map(function (p) { return new THREE.Vector2(p[0], p[1]); });
        c.add(malla(new THREE.LatheGeometry(perfil, 24), M.vidrio, false));
        var liq = malla(new THREE.SphereGeometry(0.068, 20, 10, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5), liquido, false);
        liq.position.y = 0.21; c.add(liq);
        if (conBandeja) { var b = malla(cil(0.17, 0.17, 0.02, 28), M.crema); b.position.y = -0.01; c.add(b); }
        return c;
      }
      var copa = copaDe(M.vino, true); mundo.add(copa);

      var laura = persona({ piel: '#C99273', pelo: '#4A2C1C', ropa: MM.acento, pantalon: M.oscuro, peinado: 'largo' });
      laura.position.set(1.15, 0, 1.15); laura.rotation.y = 2.49;

      // Notitas de música
      var notas = [];
      for (var n = 0; n < 7; n++) {
        var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: pastilla(n % 2 ? '♪' : '♫', 'rgba(0,0,0,0)', '#ffffff', 64, 64, 50), transparent: true, opacity: 0, depthWrite: false }));
        dinamicos.push({ m: sp.material, f: function (p) { return p.marca; } });
        sp.scale.set(0.3, 0.3, 1); sp.userData.i = n; mundo.add(sp); notas.push(sp);
      }
      planta(-4.9, -1.6, 1.1); planta(-1.3, -1.9, 0.9); planta(4.8, -1.2, 1.2); planta(-4.3, 2.4, 0.8); planta(4.3, 2.3, 0.9);

      // ── La playa de la dueña ──
      var ISLA = new THREE.Vector3(16, 0, 9);
      var isla = new THREE.Group(); isla.position.copy(ISLA); mundo.add(isla);
      isla.add(en(malla(cil(7.6, 7.2, 0.6, 72), M.marHondo), 0, -0.45, 0));
      var aguaGeo = new THREE.RingGeometry(0.2, 7.55, 64, 10);
      var agua = malla(aguaGeo, M.mar, false); agua.rotation.x = -Math.PI / 2; agua.position.y = -0.14; isla.add(agua);
      var aguaBase = aguaGeo.attributes.position.array.slice();
      isla.add(en(malla(cil(4.2, 4.6, 0.42, 64), M.arena), 0, -0.16, 0));
      var espuma = malla(new THREE.TorusGeometry(4.36, 0.07, 8, 90), M.espuma, false); espuma.rotation.x = Math.PI / 2; espuma.position.y = -0.1; isla.add(espuma);
      // Palmeras
      function palmera(x, z, s, giro) {
        var g = new THREE.Group();
        var curva = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.12, 0.8, 0), new THREE.Vector3(0.38, 1.6, 0), new THREE.Vector3(0.72, 2.3, 0)]);
        g.add(malla(new THREE.TubeGeometry(curva, 20, 0.1, 10, false), M.corteza));
        var copaP = new THREE.Group(); copaP.position.set(0.72, 2.3, 0); g.add(copaP);
        for (var i = 0; i < 8; i++) {
          var hoja = new THREE.Group(); hoja.rotation.y = i * Math.PI * 2 / 8;
          var h = malla(esfera(0.5), i % 2 ? M.plantaHonda : M.planta); h.scale.set(1, 0.06, 0.2); h.position.x = 0.45; h.rotation.z = -0.5;
          hoja.add(h); copaP.add(hoja);
        }
        [[0.08, -0.1, 0.05], [-0.06, -0.12, -0.05], [0.02, -0.1, -0.1]].forEach(function (c) { copaP.add(en(malla(esfera(0.08), M.coco), c[0], c[1], c[2])); });
        g.position.set(x, 0, z); g.scale.setScalar(s); g.rotation.y = giro; isla.add(g); g.userData.copa = copaP; return g;
      }
      var palmeras = [palmera(-2.3, -1.3, 1.25, 0.6), palmera(2.6, -2.0, 1.0, 2.3), palmera(-3.2, 1.2, 0.8, -0.8)];
      // Sombrilla
      var sombrilla = new THREE.Group(); sombrilla.position.set(-0.85, 0, 0.35); sombrilla.rotation.z = 0.16;
      sombrilla.add(en(malla(cil(0.025, 0.025, 2.1, 10), M.blanco), 0, 1.05, 0));
      var lona = malla(new THREE.ConeGeometry(1.2, 0.42, 12, 1, true), MM.marcaSuave); lona.material.side = THREE.DoubleSide; lona.position.y = 2.05; sombrilla.add(lona);
      sombrilla.add(en(malla(esfera(0.06), MM.marca), 0, 2.28, 0));
      isla.add(sombrilla);
      // Tumbona y Alanny
      var tumbona = new THREE.Group(); tumbona.position.set(0.15, 0, 0.7); tumbona.rotation.y = 0.35; isla.add(tumbona);
      tumbona.add(en(malla(caja(0.72, 0.08, 1.35, 0.03), M.blanco), 0, 0.32, 0.15));
      tumbona.add(en(malla(caja(0.66, 0.03, 1.25, 0.02), MM.marca), 0, 0.37, 0.15));
      var respaldo = malla(caja(0.72, 0.08, 0.8, 0.03), M.blanco); respaldo.position.set(0, 0.62, -0.72); respaldo.rotation.x = -1.0; tumbona.add(respaldo);
      [[-0.3, -0.45], [0.3, -0.45], [-0.3, 0.72], [0.3, 0.72]].forEach(function (p) { tumbona.add(en(malla(cil(0.025, 0.025, 0.3, 8), M.madera), p[0], 0.15, p[1])); });
      var alanny = persona({ piel: '#D9A57F', pelo: '#3A2418', ropa: M.blanco, pantalon: M.blanco, peinado: 'largo', sentada: true, estirada: true, gafas: true, sombrero: true, padre: tumbona });
      alanny.position.set(0, -0.08, -0.42); alanny.rotation.x = -0.22;
      var telAlanny = telefono(pantallaAlanny); alanny.userData.brazos[1].userData.mano.add(telAlanny); telAlanny.position.set(0, -0.08, 0.02);
      var trago = copaDe(M.naranja, false); trago.scale.setScalar(0.8); alanny.userData.brazos[0].userData.mano.add(trago); trago.position.set(0, 0.02, 0.04);
      var sombrillita = malla(new THREE.ConeGeometry(0.07, 0.04, 8), MM.marca); sombrillita.position.set(0.03, 0.34, 0); trago.add(sombrillita);
      // Estrellita de mar
      (function () {
        var s = new THREE.Shape();
        for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 0.07 : 0.17; if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        var e = malla(new THREE.ExtrudeGeometry(s, { depth: 0.03, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 }), M.coral);
        e.rotation.x = -Math.PI / 2; e.position.set(1.6, 0.07, 2.2); isla.add(e);
      })();
      var solMar = new THREE.Mesh(new THREE.SphereGeometry(2.2, 32, 16), new THREE.MeshBasicMaterial({ color: 0xFFE3A0 }));
      solMar.position.set(ISLA.x + 10, 6.5, ISLA.z - 20); mundo.add(solMar);

      // ── Sus sedes, flotando alrededor de la playa ──
      var sedes = [['Piantini', -5.6, 1.7, -4.2], ['Naco', 0.4, 3.7, -7.6], ['Santiago', 4.8, 3.2, -5.4]].map(function (s, i) {
        var g = new THREE.Group();
        g.add(en(malla(cil(1.2, 1.25, 0.26, 48), MM.piso), 0, -0.13, 0));
        g.add(en(malla(cil(1.26, 1.1, 0.3, 48), MM.borde), 0, -0.36, 0));
        g.add(en(malla(caja(1.0, 0.8, 0.8, 0.1), M.crema), -0.1, 0.4, -0.1));
        g.add(en(malla(caja(1.1, 0.14, 0.9, 0.06), MM.marca), -0.1, 0.86, -0.1));
        g.add(en(malla(caja(0.26, 0.4, 0.04, 0.03), MM.acentoHondo), -0.1, 0.2, 0.32));
        g.add(en(malla(caja(0.5, 0.55, 0.5, 0.08), MM.marcaSuave), 0.62, 0.28, 0.25));
        var arbol = new THREE.Group();
        arbol.add(en(malla(cil(0.03, 0.04, 0.3, 8), M.madera), 0, 0.15, 0));
        arbol.add(en(malla(esfera(0.2), M.planta), 0, 0.42, 0));
        arbol.position.set(-0.8, 0, 0.55); g.add(arbol);
        var etiqueta = new THREE.Sprite(new THREE.SpriteMaterial({ map: pastilla(s[0], '#FFFFFF', '#2B2124', 512, 128, 60), transparent: true, depthWrite: false }));
        etiqueta.scale.set(1.6, 0.4, 1); etiqueta.position.set(0, 1.55, 0); g.add(etiqueta);
        g.position.set(ISLA.x + s[1], s[2], ISLA.z + s[3]);
        g.userData = { y: s[2], i: i, h: [ISLA.x + s[1], s[2], ISLA.z + s[3]], v: [ISLA.x + [-1.45, 0.1, 1.35][i], [2.3, 2.75, 2.3][i], ISLA.z + [-3.6, -4.6, -3.6][i]] };
        g.scale.setScalar(0.0001);
        mundo.add(g);
        var geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
        var linea = new THREE.Line(geo, MM.linea); mundo.add(linea); g.userData.linea = linea;
        var billete = new THREE.Sprite(new THREE.SpriteMaterial({ map: pastilla('RD$', '#1F8A5B', '#FFFFFF', 256, 112, 60), transparent: true, depthWrite: false, opacity: 0 }));
        billete.scale.set(0.8, 0.35, 1); mundo.add(billete); g.userData.billete = billete;
        return g;
      });

      // ── Cámara: posición y a dónde mira, por momentos ──
      function I(v) { return [ISLA.x + v[0], ISLA.y + v[1], ISLA.z + v[2]]; }
      var TOMAS = [
        [0, [0.4, 8.2, 13.5], [0, 0.6, -0.5]],
        [3.4, [-0.6, 6.4, 11], [-0.8, 0.7, -0.2]],
        [4.9, [-1.35, 2.35, 4.6], [-3.2, 1.05, 0.3]],
        [15.4, [-1.8, 2.1, 4.3], [-3.2, 1.0, 0.3]],
        [16.5, [0.8, 3.35, 2.35], [0.3, 1.0, -0.8]],
        [29.6, [0.5, 3.2, 2.25], [0.3, 1.0, -0.8]],
        [30.8, [3.6, 2.5, -2.6], [0.2, 1.15, -0.3]],
        [42.4, [3.9, 2.4, -2.2], [0.25, 1.15, -0.25]],
        [44.2, I([3.7, 2.9, 7.6]), I([-0.3, 2.0, -2.0])],
        [55.4, I([3.1, 3.3, 8.4]), I([-0.3, 2.1, -2.0])],
        [DURACION_H, I([3.2, 5.5, 13]), I([-0.4, 2.3, -2])]
      ];
      var ESCALA_VERTICAL = 2.4;
      var vPos = new THREE.Vector3(), vMira = new THREE.Vector3(), tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
      tomar = function (t) {
        var i = 0;
        while (i < TOMAS.length - 2 && t >= TOMAS[i + 1][0]) i++;
        var a = TOMAS[i], b = TOMAS[i + 1];
        var k = suave(tramo(t, a[0], b[0]));
        vPos.fromArray(a[1]).lerp(tmpA.fromArray(b[1]), k);
        vMira.fromArray(a[2]).lerp(tmpB.fromArray(b[2]), k);
        // En el vuelo a la playa, la cámara sube un poco
        vPos.y += Math.sin(tramo(t, 42.4, 44.2) * Math.PI) * 3;
        if (vertical) vPos.sub(vMira).multiplyScalar(ESCALA_VERTICAL - 0.75 * tramo(t, 42.8, 44.2)).add(vMira);
        camara.position.copy(vPos);
        camara.lookAt(vMira);
        var w = raiz.clientWidth || 960, h = raiz.clientHeight || 540;
        var lado = ventana(t, 4.4, 55.5, 1.0);
        if (vertical) {
          var fh = h * (1 + 0.34 * lado);
          camara.aspect = w / fh; camara.setViewOffset(w, fh, 0, h * 0.34 * lado, w, h);
        } else {
          var fw = w * (1 + 0.36 * lado);
          camara.aspect = fw / h; camara.setViewOffset(fw, h, w * 0.36 * lado, 0, w, h);
        }
        camara.updateProjectionMatrix();
        // La sombra sigue a la cámara (salón o playa)
        var enPlaya = tramo(t, 42.8, 43.8);
        sol.target.position.set(ISLA.x * enPlaya, 0, ISLA.z * enPlaya);
        sol.position.set(4 + ISLA.x * enPlaya, 10, 7 + ISLA.z * enPlaya);
      };

      // Dónde está cada cosa en pantalla (0..1)
      var tmpP = new THREE.Vector3();
      puntoDe = function (nombre) {
        var i = +nombre;
        if (!isNaN(i)) { var it = insumos[i]; if (!it.visible) return null; tmpP.set(it.position.x, it.position.y + it.userData.alto * 1.45, it.position.z); }
        else if (nombre === 'copa') copa.getWorldPosition(tmpP).y += 0.3;
        else if (nombre === 'tv') { tvPant.getWorldPosition(tmpP); tmpP.y += 0.2; }
        else if (nombre === 'mando') mando.getWorldPosition(tmpP);
        else if (nombre === 'laura') { tvPant.getWorldPosition(tmpP); tmpP.y -= 0.25; }
        else if (nombre === 'telefono') telAlanny.getWorldPosition(tmpP);
        else return null;
        tmpP.project(camara);
        if (tmpP.z > 1) return null;
        return { x: (tmpP.x + 1) / 2, y: (1 - tmpP.y) / 2 };
      };

      // ── Lo que se mueve en cada momento ──
      var origen = new THREE.Vector3(), vDestino = new THREE.Vector3();
      mover = function (t) {
        // Carmen: en su sofá de noche, luego en la mesa de uñas
        var enCasa = t < 16.0;
        var br = carmen.userData.brazos;
        var habla = t > VOZ[0] && t < VOZ[1] ? 1 : 0;
        if (enCasa) {
          carmen.position.set(CASA.x, 0, CASA.z + 0.05);
          carmen.rotation.y = 0;
          br[1].rotation.x = -2.05 + Math.sin(t * 2) * 0.03; br[1].rotation.z = 0.25;
          br[0].rotation.x = -0.15; br[0].rotation.z = -0.12;
          carmen.userData.cabeza.rotation.x = 0.18 + Math.sin(t * 1.3) * 0.03;
          carmen.userData.cabeza.rotation.z = Math.sin(t * 0.9) * 0.05;
          telCarmen.visible = true;
          telCarmen.rotation.set(0.35, Math.PI, 0);
          var alegre = ventana(t, 10.4, 15, 0.3);
          carmen.position.y = Math.abs(Math.sin(t * 7)) * 0.03 * alegre;
          carmen.scale.setScalar(1);
        } else {
          carmen.position.set(MESA.x, 0, MESA.z + 0.74);
          carmen.rotation.y = Math.PI;
          telCarmen.visible = false;
          br[0].rotation.x = -1.2; br[0].rotation.z = -0.25;
          br[1].rotation.x = -1.25 + Math.sin(t * 1.5) * 0.02; br[1].rotation.z = 0.3;
          carmen.userData.cabeza.rotation.x = 0.1;
          carmen.userData.cabeza.rotation.z = Math.sin(t * 2.2) * 0.07 * ventana(t, 30, 42.4);
          carmen.position.y = 0;
          var llega = t < 29.6 ? 0 : resorte(tramo(t, 29.6, 30.5));
          carmen.scale.setScalar(Math.max(llega, 0.0001));
        }
        carmen.userData.boca.scale.set(1, 1 + habla * (0.6 + 0.6 * Math.abs(Math.sin(t * 17))), 1);
        rayas.forEach(function (r, i) {
          var fase = (t * 2.4 + i * 0.33) % 1;
          var v = habla * Math.sin(fase * Math.PI);
          r.scale.setScalar(Math.max(v, 0.0001));
          r.userData.r.position.x = -0.12 - fase * 0.1;
        });
        basicoMarca.opacity = 0.95;
        // Valentina trabaja
        var vb = valentina.userData.brazos;
        vb[0].rotation.x = -1.15 + Math.sin(t * 4) * 0.08; vb[0].rotation.z = -0.28;
        vb[1].rotation.x = -1.3 + Math.sin(t * 6 + 1) * 0.12; vb[1].rotation.z = 0.32;
        valentina.userData.cabeza.rotation.x = 0.28;
        valentina.userData.cabeza.rotation.z = Math.sin(t * 1.1) * 0.05;

        // Los insumos caen a la mesa
        insumos.forEach(function (it) {
          var d = it.userData, p = tramo(t, d.t, d.t + 0.75);
          it.position.set(d.x, ALTO_MESA + (1 - rebote(p)) * 1.5, d.z);
          it.visible = t >= d.t;
          it.rotation.y = (1 - sale(p)) * 2.4;
          var a = tramo(t, d.t + 0.35, d.t + 1.1);
          d.aro.material.opacity = t < d.t + 0.35 ? 0 : (1 - a) * 0.8;
          d.aro.scale.setScalar(1 + a * 2.2);
        });

        // La copa viaja de la barra a su mesita
        var c = suave(tramo(t, 30.2, 31.4));
        copa.position.lerpVectors(tmpA.set(BARRA.x - 0.3, 1.0, BARRA.z + 0.05), tmpB.set(mesita.position.x, 0.66, mesita.position.z), c);
        copa.position.y += Math.sin(c * Math.PI) * 0.5;
        copa.visible = t > 29.8 && t < 43;

        // La pizarra y el mando
        if (t < 44) dibujarTV(t);
        var lauraP = t < LLEGA_LAURA ? 0 : resorte(tramo(t, LLEGA_LAURA, LLEGA_LAURA + 0.8));
        laura.scale.setScalar(0.0001); laura.visible = false;
        laura.userData.brazos[0].rotation.x = -0.2 - 2.4 * ventana(t, 37.8, 39.2, 0.3) * Math.abs(Math.sin(t * 6));
        mando.position.y = ALTO_MESA + 0.012 + 0.01 * Math.max(0, Math.sin(t * 8)) * ventana(t, 35.2, 39);

        // La bocina late y suelta notitas
        var musica = ventana(t, 30, 42.6, 0.6);
        conos.forEach(function (co, i) { co.scale.setScalar(1 + Math.abs(Math.sin(t * (8 + i * 3))) * 0.14 * musica); });
        notas.forEach(function (sp) {
          var i = sp.userData.i, fase = ((t * 0.55 + i / notas.length) % 1);
          var bp = bocina.position;
          sp.position.set(bp.x - 0.25 + Math.sin(fase * 6 + i) * 0.35 - fase * 0.8, 1.0 + fase * 1.6, bp.z + 0.3 + fase * 0.4);
          sp.material.opacity = musica * Math.sin(fase * Math.PI) * 0.95;
          sp.material.rotation = Math.sin(t * 2 + i) * 0.3;
        });

        // El mar se mueve
        if (t > 41 || t < 1) {
          var pos = aguaGeo.attributes.position;
          for (var k = 0; k < pos.count; k++) {
            var x = aguaBase[k * 3], y = aguaBase[k * 3 + 1];
            pos.array[k * 3 + 2] = Math.sin(x * 1.3 + t * 1.6) * 0.05 + Math.cos(y * 1.1 - t * 1.2) * 0.05;
          }
          pos.needsUpdate = true; aguaGeo.computeVertexNormals();
        }
        espuma.scale.setScalar(1 + 0.012 * Math.sin(t * 1.4));
        palmeras.forEach(function (p, i) { p.userData.copa.rotation.z = Math.sin(t * 1.1 + i) * 0.05; p.userData.copa.rotation.x = Math.cos(t * 0.9 + i) * 0.04; });

        // Alanny: mira el teléfono, brinda al final
        var ab = alanny.userData.brazos;
        ab[1].rotation.x = -1.75 + Math.sin(t * 1.4) * 0.03; ab[1].rotation.z = 0.2;
        telAlanny.rotation.set(0.5, Math.PI, 0);
        var brindis = ventana(t, 52.8, 55.4, 0.5);
        ab[0].rotation.x = -0.9 - 1.3 * brindis; ab[0].rotation.z = -0.25 - 0.2 * brindis;
        alanny.userData.cabeza.rotation.x = 0.25 - 0.3 * brindis;
        alanny.userData.cabeza.rotation.z = Math.sin(t * 1.2) * 0.04;
        // Llega el dinero: el teléfono se pone verde
        var verde = 0;
        DINERO.forEach(function (d) { if (t >= d[1]) verde = Math.max(verde, 1 - tramo(t, d[1], d[1] + 0.9)); });
        pantallaAlanny.emissive.copy(lin(mezcla('#F5C6CF', '#3CD98A', verde)));

        // Las sedes aparecen, se conectan con su teléfono y le mandan dinero
        telAlanny.getWorldPosition(origen);
        MM.linea.opacity = ventana(t, 44.6, 55.6, 0.6) * 0.9;
        sedes.forEach(function (g, i) {
          var ap = resorte(tramo(t, 44.3 + i * 0.3, 45.3 + i * 0.3)) * (1 - suave(tramo(t, 61, 62)));
          g.scale.setScalar(Math.max(ap * (vertical ? 0.55 : 1), 0.0001));
          var bs = vertical ? g.userData.v : g.userData.h;
          g.position.set(bs[0], bs[1] + Math.sin(t * 1.2 + i * 2) * 0.12, bs[2]);
          g.rotation.y = Math.sin(t * 0.4 + i) * 0.15;
          var l = g.userData.linea, pos = l.geometry.attributes.position;
          vDestino.set(g.position.x, g.position.y - 0.3, g.position.z);
          pos.setXYZ(0, origen.x, origen.y, origen.z); pos.setXYZ(1, vDestino.x, vDestino.y, vDestino.z);
          pos.needsUpdate = true; l.computeLineDistances(); l.geometry.computeBoundingSphere();
          l.visible = ap > 0.2;
          var d = DINERO[i], bi = g.userData.billete, k = tramo(t, d[0], d[1]);
          bi.material.opacity = t > d[0] && t < d[1] + 0.1 ? Math.sin(k * Math.PI) * 0.5 + 0.5 : 0;
          bi.position.lerpVectors(vDestino, origen, suave(k));
          bi.scale.set(0.8 * (1 - 0.4 * k), 0.35 * (1 - 0.4 * k), 1);
        });
        MM.pantalla.emissiveIntensity = 0.6 + 0.4 * ventana(t, 4.8, 15.8);
        luzLampara.intensity = 0.55 + 0.45 * ventana(t, 3.2, 16.2, 0.8);
        mundo.rotation.y = -0.12 * (1 - suave(tramo(t, 0, 3.4)));
      };

      pintarPaleta();
      if (window.MutationObserver) {
        new MutationObserver(function () { pintarPaleta(); if (!andando) pintar(tiempo); }).observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'data-theme'] });
      }
    })();

    // ── Tamaño ──
    function medir() {
      var w = raiz.clientWidth, h = raiz.clientHeight;
      vertical = h > w * 1.02;
      raiz.classList.toggle('h-vertical', vertical);
      raiz.classList.toggle('h-apaisado', !vertical);
      if (hay3D && w && h) renderer.setSize(w, h, false);
      svg.setAttribute('viewBox', '0 0 ' + (w || 1) + ' ' + (h || 1));
    }

    function pintar(t) {
      capa(t);
      if (hay3D) { mover(t); tomar(t); renderer.render(escena, camara); }
      pintarAnclas(t, hay3D ? puntoDe : null);
    }

    // ── Sonido: una sola pista que va con el reloj ──
    var sonido = { on: false, ctx: null, buffer: null, fuente: null, inicio: 0, desde: 0, cargando: false };
    var botonSonido = document.getElementById('h-sonido');
    var audioSrc = window.HISTORIA_AUDIO;
    if (!audioSrc && botonSonido) botonSonido.hidden = true;
    function marcarSonido() { if (!botonSonido) return; botonSonido.textContent = sonido.on ? '🔊' : '🔇'; var e = sonido.on ? 'Quitar sonido' : 'Activar sonido'; botonSonido.setAttribute('aria-label', e); botonSonido.title = e; botonSonido.setAttribute('aria-pressed', sonido.on ? 'true' : 'false'); }
    function cargarSonido(listo) {
      if (sonido.buffer) { listo(); return; }
      if (sonido.cargando) return;
      sonido.cargando = true;
      var decodificar = function (ab) {
        sonido.ctx.decodeAudioData(ab, function (b) { sonido.buffer = b; sonido.cargando = false; listo(); }, function () { sonido.cargando = false; });
      };
      try {
        if (audioSrc.indexOf('data:') === 0) {
          var bin = atob(audioSrc.split(',')[1]), arr = new Uint8Array(bin.length);
          for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
          decodificar(arr.buffer);
        } else {
          fetch(audioSrc).then(function (r) { return r.arrayBuffer(); }).then(decodificar, function () { sonido.cargando = false; });
        }
      } catch (e) { sonido.cargando = false; }
    }
    function pararFuente() { if (sonido.fuente) { try { sonido.fuente.stop(); } catch (e) {} sonido.fuente = null; } }
    function arrancarFuente(t) {
      pararFuente();
      if (!sonido.on || !sonido.buffer || !andando) return;
      var f = sonido.ctx.createBufferSource(); f.buffer = sonido.buffer;
      var g = sonido.ctx.createGain(); g.gain.value = 0.9; f.connect(g); g.connect(sonido.ctx.destination);
      f.start(0, Math.min(t, sonido.buffer.duration - 0.05));
      sonido.fuente = f; sonido.inicio = sonido.ctx.currentTime; sonido.desde = t;
    }
    function relojSonido() { return sonido.fuente ? sonido.desde + (sonido.ctx.currentTime - sonido.inicio) : null; }

    // ── Reproducción ──
    var tiempo = 0, andando = false, ultimo = 0, quiereVer = true, termino = false;
    // Avisos para quien mida la página (la landing cuenta reproducciones)
    function avisar(tipo) { try { raiz.dispatchEvent(new CustomEvent('historia', { detail: tipo })); } catch (e) {} }
    var botonPlay = document.getElementById('h-play');
    var botonOtra = document.getElementById('h-otra');
    function marcar() { botonPlay.textContent = andando ? '❚❚' : '▶'; var e = andando ? 'Pausar' : 'Ver la historia'; botonPlay.setAttribute('aria-label', e); botonPlay.title = e; botonPlay.setAttribute('aria-pressed', andando ? 'true' : 'false'); }
    function cuadro(ahora) {
      if (!andando) return;
      var dt = Math.min((ahora - ultimo) / 1000, 0.1); ultimo = ahora;
      var r = relojSonido();
      tiempo = r !== null ? r : tiempo + dt;
      if (tiempo >= DURACION_H) {
        // No se repite sola: se queda en la tarjeta final
        tiempo = DURACION_H; pintar(tiempo); termino = true; pausa(); avisar('final');
        return;
      }
      pintar(tiempo);
      requestAnimationFrame(cuadro);
    }
    function play() {
      if (andando) return;
      if (termino || tiempo >= DURACION_H) { termino = false; tiempo = 0; avisar('repetir'); }
      if (tiempo < 0.05) avisar('inicio');
      andando = true; ultimo = performance.now(); marcar(); arrancarFuente(tiempo); requestAnimationFrame(cuadro); }
    function pausa() { andando = false; pararFuente(); marcar(); }

    medir();
    if (GRABANDO) {
      window.HISTORIA = { pintar: pintar, duracion: DURACION_H, medir: medir };
      pintar(0);
      return;
    }
    if (window.ResizeObserver) new ResizeObserver(function () { medir(); if (!andando) pintar(tiempo); }).observe(raiz);
    botonPlay.addEventListener('click', function () { if (andando) { quiereVer = false; pausa(); } else { quiereVer = true; play(); } });
    botonOtra.addEventListener('click', function () {
      quiereVer = true;
      if (andando) { tiempo = 0; pintar(0); avisar('repetir'); avisar('inicio'); arrancarFuente(0); }
      else { termino = true; play(); }
    });
    if (botonSonido) botonSonido.addEventListener('click', function () {
      if (!sonido.ctx) { var C = window.AudioContext || window.webkitAudioContext; if (!C) return; sonido.ctx = new C(); }
      if (sonido.ctx.state === 'suspended') sonido.ctx.resume();
      sonido.on = !sonido.on; marcarSonido();
      if (sonido.on) avisar('sonido');
      if (!sonido.on) { pararFuente(); return; }
      cargarSonido(function () { if (!andando) { quiereVer = true; play(); } else arrancarFuente(tiempo); });
    });
    marcarSonido();
    // Pantalla completa (y un modo de respaldo para teléfonos que no la permiten)
    var botonCompleta = document.getElementById('h-completa');
    function enCompleta() { return document.fullscreenElement === raiz || document.webkitFullscreenElement === raiz || raiz.classList.contains('h-llena'); }
    function marcarCompleta() { var si = enCompleta(); botonCompleta.textContent = si ? '✕' : '⛶'; var e = si ? 'Salir de pantalla completa' : 'Pantalla completa'; botonCompleta.setAttribute('aria-label', e); botonCompleta.title = e; botonCompleta.setAttribute('aria-pressed', si ? 'true' : 'false'); despertar(); }
    // En pantalla completa los botones se esconden solos; vuelven al mover el ratón o tocar
    var reposo = null;
    function despertar() {
      raiz.classList.remove('h-reposo'); clearTimeout(reposo);
      if (enCompleta()) reposo = setTimeout(function () { if (enCompleta() && andando) raiz.classList.add('h-reposo'); }, 2200);
    }
    ['mousemove', 'touchstart', 'keydown'].forEach(function (ev) { raiz.addEventListener(ev, despertar, { passive: true }); });
    function llenaSinApi(si) { raiz.classList.toggle('h-llena', si); document.documentElement.style.overflow = si ? 'hidden' : ''; marcarCompleta(); }
    botonCompleta.addEventListener('click', function () {
      if (raiz.classList.contains('h-llena')) { llenaSinApi(false); return; }
      if (document.fullscreenElement || document.webkitFullscreenElement) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
      var pedir = raiz.requestFullscreen || raiz.webkitRequestFullscreen;
      avisar('pantalla_completa');
      if (!pedir) { llenaSinApi(true); return; }
      try { var r = pedir.call(raiz); if (r && r.catch) r.catch(function () { llenaSinApi(true); }); } catch (e) { llenaSinApi(true); }
      if (!andando) { quiereVer = true; play(); }
    });
    document.addEventListener('fullscreenchange', marcarCompleta);
    document.addEventListener('webkitfullscreenchange', marcarCompleta);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && raiz.classList.contains('h-llena')) llenaSinApi(false); });
    // Quieta si la persona pidió menos movimiento: se ve la dueña en la playa
    tiempo = quieta ? 53.4 : 0;
    pintar(tiempo);
    marcar();
    // En modo mapa de calor (panel de plataforma) no arranca sola, para no mover la página
    if (!quieta && !/[?&]calor=/.test(location.search) && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          // Arranca sola una sola vez; después, solo si la persona toca ▶
          if (e.isIntersecting && quiereVer && !termino) play(); else if (!e.isIntersecting && !enCompleta()) pausa();
        });
      }, { threshold: 0.35 }).observe(raiz);
    }
  })();
