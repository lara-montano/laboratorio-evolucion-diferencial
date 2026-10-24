"use strict";
/* Laboratorio de Evolución Diferencial, sesión 36 · versión 3 (23-oct-2026): una sola vista, sin pestañas ni registros.
 * El núcleo (sin DOM) se exporta para las pruebas de node; la interfaz solo corre en el navegador. El motor es engine.js (DE/rand/1/bin). */
(function (root) {
  const enNode = typeof module === "object" && module.exports;
  const E = enNode ? require("./engine.js") : root.DELabEngine;
  const MENOS = "−";
  const SUB = "₀₁₂₃₄₅₆₇₈₉";

  // ------------------------------------------------------------------ núcleo
  const DEF = {
    terrain: { np: 6, F: 0.5, CR: 0.5, generations: 8, seed: 1 },
    solar: { np: 10, F: 0.5, CR: 0.5, generations: 20, seed: 0 }
  };
  function num(x, dec) { const s = Number(x).toFixed(dec); return s.startsWith("-") && Number(s) !== 0 ? MENOS + s.slice(1) : s.replace(/^-/, ""); }
  function sub(n) { return String(n).replace(/\d/g, (d) => SUB[Number(d)]); }
  function kw(v) { return Number.isInteger(v) ? String(v) : num(v, 1); }
  function crearProblemas(data) { return { terrain: E.createTerrainProblem(), solar: E.createSolarProblem(data) }; }
  function nuevaCorrida(problema, cfg) {
    return E.createRun(problema, { np: cfg.np, F: cfg.F, CR: cfg.CR, seed: cfg.seed, generations: cfg.generations, budgetMode: "generations" });
  }
  function punto(problema, u) {
    const d = problema.decode(u);
    return problema.id === "solar" ? `(${kw(d.P_kW)} kW, ${kw(d.E_kWh)} kWh)` : `(${num(d.x, 2)}, ${num(d.y, 2)})`;
  }
  function valor(problema, v) { return problema.id === "solar" ? `${num(v, 1)} USD/año` : num(v, 2); }
  function evaluaciones(cfg) { return cfg.np * (cfg.generations + 1); }
  function costoTexto(problema, cfg) {
    const n = evaluaciones(cfg);
    const base = `Cada corrida evalúa f NP × (generaciones + 1) = ${cfg.np} × ${cfg.generations + 1} = ${n} veces`;
    return problema.id === "solar" ? `${base}: ${n} simulaciones, frente a las 1271 de recorrer toda la malla.` : `${base}.`;
  }
  // El paso del explorador 1 (índice 0) en la última generación, dicho con las tres reglas de la clase
  function explicaPaso(problema, t, cfg) {
    if (!t) return null;
    const [a, b, c] = t.r.map((k) => k + 1);
    const mut = `Se sortearon los exploradores ${a}, ${b} y ${c}: v = x${sub(a)} + F (x${sub(b)} ${MENOS} x${sub(c)}) = ${punto(problema, t.mutant)}` +
      (t.clipped ? ", recortado al dominio." : ".");
    const origen = t.crossMask.map((m, j) => `la ${j + 1} de ${m ? "v" : "x₁"}${j === t.jrand ? " (es la j<sub>rand</sub>)" : ""}`);
    const cruza = `Sorteos ${t.crossRand.map((r) => num(r, 2)).join(" y ")} contra CR = ${num(cfg.CR, 2)}; la j<sub>rand</sub> es la coordenada ${t.jrand + 1}. ` +
      `u = ${punto(problema, t.trial)}: ${origen.join(" y ")}.`;
    const sel = t.accepted
      ? `f(u) = ${valor(problema, t.trialCost)} ≤ f(x₁) = ${valor(problema, t.targetCost)}: el explorador 1 se mueve a u.`
      : `f(u) = ${valor(problema, t.trialCost)} > f(x₁) = ${valor(problema, t.targetCost)}: el explorador 1 se queda donde estaba.`;
    return { mutacion: mut, cruza, seleccion: sel };
  }
  // La frontera entre las regiones de atracción del cerro: el máximo local de g(t) = t⁴ − 4t² + t, raíz de 4t³ − 8t + 1 entre −0.8 y 0.8 (≈ 0.126).
  const FRONTERA = (() => { let a = -0.8, b = 0.8; const d = (x) => 4 * x ** 3 - 8 * x + 1; for (let k = 0; k < 80; k++) { const m = (a + b) / 2; if (d(a) * d(m) <= 0) b = m; else a = m; } return (a + b) / 2; })();
  // Éxito: en el cerro, que el mejor termine en la región de atracción del mínimo global (como en la clase); en el caso solar, que sea el diseño más barato.
  function llega(problema, run) {
    if (problema.id === "terrain") { const d = problema.decode(run.bestPoint); return d.x < FRONTERA && d.y < FRONTERA; }
    return E.summarize(run).success;
  }
  function treintaSemillas(problema, cfg) {
    const mejores = []; let exitos = 0;
    for (let s = 0; s < 30; s++) {
      const run = nuevaCorrida(problema, Object.assign({}, cfg, { seed: s }));
      E.runToEnd(run);
      if (llega(problema, run)) exitos += 1;
      mejores.push(run.best);
    }
    const orden = mejores.slice().sort((x, y) => x - y);
    return { exitos, total: 30, mediana: (orden[14] + orden[15]) / 2, evaluaciones: evaluaciones(cfg) };
  }
  function treintaTexto(problema, cfg, r) {
    const criterio = problema.id === "solar" ? "el mejor fue el diseño más barato de la malla" : "el mejor terminó en la región de atracción del mínimo global";
    return `Con NP = ${cfg.np}, F = ${num(cfg.F, 2)}, CR = ${num(cfg.CR, 2)} y ${cfg.generations} generaciones: en ${r.exitos} de 30 semillas ${criterio}. ` +
      `Cada corrida gastó ${r.evaluaciones} evaluaciones de f.`;
  }
  // La gráfica 3D del costo solar (23-oct-2026, la de la lámina 7 de la clase): proyección ortográfica de la malla de 41 × 31 diseños dentro de una caja
  // de lados CAJA (paneles, batería, costo), con la altura lineal de 0 a ZMAX USD/año. Devuelve, en unidades de dibujo (x a la derecha, y hacia arriba),
  // las celdas ordenadas de atrás hacia adelante (por la profundidad horizontal de su centro: en una superficie z = f(x, y) vista desde arriba ese orden
  // no deja una celda delante de otra que la tape), las tres caras de atrás con su retícula, los tres ejes con sus marcas y el mínimo global.
  const CAJA = [1.0, 1.4, 0.68], ZMAX = 26000, VISTA = { az: 36, el: 24 };
  const MARCAS3D = { P: [0, 5, 10, 15, 20], E: [0, 20, 40, 60], z: [0, 10000, 20000] };
  function bandaSolar(pr, c) {
    const [lo, hi] = pr.costRange;
    return Math.min(7, Math.floor(8 * Math.pow(Math.log(c / lo) / Math.log(hi / lo), 0.7)));   // las ocho bandas logarítmicas del mapa
  }
  function vista3d(pr, az, el) {
    const a = az * Math.PI / 180, e = el * Math.PI / 180;
    const R = [-Math.sin(a), Math.cos(a), 0], U = [-Math.sin(e) * Math.cos(a), -Math.sin(e) * Math.sin(a), Math.cos(e)];
    const W = [Math.cos(e) * Math.cos(a), Math.cos(e) * Math.sin(a), Math.sin(e)];
    const pmax = pr.bounds[0][1], emax = pr.bounds[1][1];
    const caja = (P, E, z) => [P / pmax * CAJA[0], E / emax * CAJA[1], z / ZMAX * CAJA[2]];
    const pp = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
    const q = (P, E, z) => { const c = caja(P, E, z); return [pp(c, R), pp(c, U)]; };
    const xs = pr.xValues, ys = pr.yValues, C = pr.costs, celdas = [];
    for (let i = 0; i < xs.length - 1; i++) for (let j = 0; j < ys.length - 1; j++) {
      const costo = (C[i][j] + C[i + 1][j] + C[i + 1][j + 1] + C[i][j + 1]) / 4;
      celdas.push({ d: pp(caja((xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2, 0), W), banda: bandaSolar(pr, costo),
        q: [q(xs[i], ys[j], C[i][j]), q(xs[i + 1], ys[j], C[i + 1][j]), q(xs[i + 1], ys[j + 1], C[i + 1][j + 1]), q(xs[i], ys[j + 1], C[i][j + 1])] });
    }
    celdas.sort((u, v) => u.d - v.d);
    // las paredes de atrás (las que dan la espalda a la cámara) y los bordes de adelante, donde van los ejes
    const fx = W[0] > 0 ? 0 : pmax, fy = W[1] > 0 ? 0 : emax, ax = fx === 0 ? pmax : 0, ay = fy === 0 ? emax : 0;
    const caras = [[q(0, 0, 0), q(pmax, 0, 0), q(pmax, emax, 0), q(0, emax, 0)],
      [q(fx, 0, 0), q(fx, emax, 0), q(fx, emax, ZMAX), q(fx, 0, ZMAX)], [q(0, fy, 0), q(pmax, fy, 0), q(pmax, fy, ZMAX), q(0, fy, ZMAX)]];
    const reticula = [];
    MARCAS3D.P.forEach((v) => { reticula.push([q(v, 0, 0), q(v, emax, 0)], [q(v, fy, 0), q(v, fy, ZMAX)]); });
    MARCAS3D.E.forEach((v) => { reticula.push([q(0, v, 0), q(pmax, v, 0)], [q(fx, v, 0), q(fx, v, ZMAX)]); });
    MARCAS3D.z.forEach((v) => { reticula.push([q(fx, 0, v), q(fx, emax, v)], [q(0, fy, v), q(pmax, fy, v)]); });
    const izq = [[ax, fy], [fx, ay]].sort((u, v) => q(u[0], u[1], 0)[0] - q(v[0], v[1], 0)[0])[0];
    const sP = ay === emax ? 1 : -1, sE = ax === pmax ? 1 : -1;
    const ejes = {
      P: { linea: [q(0, ay, 0), q(pmax, ay, 0)], marcas: MARCAS3D.P.map((v) => ({ v, q: q(v, ay, 0) })), fuera: [q(0, ay, 0), q(0, ay + sP * 0.1 * emax, 0)] },
      E: { linea: [q(ax, 0, 0), q(ax, emax, 0)], marcas: MARCAS3D.E.map((v) => ({ v, q: q(ax, v, 0) })), fuera: [q(ax, 0, 0), q(ax + sE * 0.1 * pmax, 0, 0)] },
      z: { linea: [q(izq[0], izq[1], 0), q(izq[0], izq[1], ZMAX)], marcas: MARCAS3D.z.map((v) => ({ v, q: q(izq[0], izq[1], v) })) }
    };
    const esquinas = [];
    [0, pmax].forEach((P) => [0, emax].forEach((E) => [0, ZMAX].forEach((z) => esquinas.push(q(P, E, z)))));
    const o = pr.optimum.decoded;
    return { celdas, caras, reticula, ejes, esquinas, minimo: { q: q(o.P_kW, o.E_kWh, o.cost), P: o.P_kW, E: o.E_kWh, costo: o.cost }, paredes: { P: fx, E: fy } };
  }
  const Nucleo = { DEF, FRONTERA, llega, num, sub, crearProblemas, nuevaCorrida, punto, valor, evaluaciones, costoTexto, explicaPaso, treintaSemillas, treintaTexto, vista3d, bandaSolar, VISTA, ZMAX };
  if (enNode) { module.exports = Nucleo; return; }

  // ------------------------------------------------------------------ interfaz
  const $ = (id) => document.getElementById(id);
  const P = crearProblemas(JSON.parse($("solar-data").textContent));
  const estado = { id: "terrain", cfg: { terrain: Object.assign({}, DEF.terrain), solar: Object.assign({}, DEF.solar) }, run: null, timer: null, fondo: {} };
  const COLORES = ["#0F3A47", "#2C6577", "#6F9CA8", "#B9CFCF", "#F6EBD6"];
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const STOPS = COLORES.map(hex);
  function color(t) {
    t = Math.min(1, Math.max(0, t));
    const x = t * (STOPS.length - 1), i = Math.min(STOPS.length - 2, Math.floor(x)), f = x - i;
    return STOPS[i].map((c, k) => Math.round(c + f * (STOPS[i + 1][k] - c)));
  }
  const problema = () => P[estado.id];
  const cfg = () => estado.cfg[estado.id];

  // fondo del mapa, calculado una vez por problema
  function fondo(pr) {
    if (estado.fondo[pr.id]) return estado.fondo[pr.id];
    const c = document.createElement("canvas");
    let nx, ny, val;
    if (pr.id === "solar") {
      nx = pr.gridSize[0]; ny = pr.gridSize[1];
      const [lo, hi] = pr.costRange;
      // ocho bandas en escala logarítmica, como el mapa de la clase
      val = (i, j) => Math.min(7, Math.floor(8 * Math.pow(Math.log(pr.costs[i][j] / lo) / Math.log(hi / lo), 0.7))) / 7;
    } else {
      nx = ny = 360;
      // bandas de nivel cada 2 unidades de f, de −10 a 4, como el relieve en bandas de la clase
      const niveles = [-10, -8, -6, -4, -2, 0, 2, 4];
      val = (i, j) => { const v = pr.evaluate([(i + 0.5) / nx, (j + 0.5) / ny]); let k = 0; while (k < niveles.length && v > niveles[k]) k++; return k / niveles.length; };
    }
    c.width = nx; c.height = ny;
    const g = c.getContext("2d"), img = g.createImageData(nx, ny);
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) {
      const k = ((ny - 1 - j) * nx + i) * 4, rgb = color(val(i, j));
      img.data[k] = rgb[0]; img.data[k + 1] = rgb[1]; img.data[k + 2] = rgb[2]; img.data[k + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    estado.fondo[pr.id] = c;
    return c;
  }
  function lienzo(cv, alto) {
    const w = cv.clientWidth || cv.parentElement.clientWidth || 600, h = Math.round(alto(w)), r = window.devicePixelRatio || 1;
    cv.width = Math.round(w * r); cv.height = Math.round(h * r); cv.style.height = h + "px";
    const g = cv.getContext("2d"); g.setTransform(r, 0, 0, r, 0, 0);
    return { g, w, h };
  }
  function flecha(g, a, b, colorTrazo, grosor) {
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); if (L < 2) return;
    const ux = dx / L, uy = dy / L, p = 8;
    g.strokeStyle = colorTrazo; g.fillStyle = colorTrazo; g.lineWidth = grosor;
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0] - ux * p * 0.8, b[1] - uy * p * 0.8); g.stroke();
    g.beginPath(); g.moveTo(b[0], b[1]); g.lineTo(b[0] - ux * p - uy * p * 0.45, b[1] - uy * p + ux * p * 0.45);
    g.lineTo(b[0] - ux * p + uy * p * 0.45, b[1] - uy * p - ux * p * 0.45); g.closePath(); g.fill();
  }
  function dibujaMapa() {
    const pr = problema(), cv = $("mapa");
    const { g, w, h } = lienzo(cv, (w) => pr.id === "solar" ? Math.min(w * 0.7, 400) : Math.min(w * 0.8, 440));
    const m = { l: 40, r: 10, t: 8, b: 34 };
    let W = w - m.l - m.r, H = h - m.t - m.b;
    // el cerro va en un cuadrado (su dominio es [−2.2, 2.2]²), centrado
    if (pr.id === "terrain") { const L = Math.min(W, H); m.l += (W - L) / 2; W = H = L; }
    const X = (u) => [m.l + u[0] * W, m.t + (1 - u[1]) * H];
    const vis = (u) => X(pr.project ? pr.project(u) : u);
    g.clearRect(0, 0, w, h);
    g.imageSmoothingEnabled = false;
    g.drawImage(fondo(pr), m.l, m.t, W, H);
    g.strokeStyle = "#DAD7D0"; g.lineWidth = 1; g.strokeRect(m.l + 0.5, m.t + 0.5, W - 1, H - 1);
    // ejes
    g.fillStyle = "#5C6670"; g.font = "12px system-ui, sans-serif"; g.textAlign = "center"; g.textBaseline = "top";
    const [bx, by] = pr.bounds;
    const tx = pr.id === "solar" ? [0, 10, 20] : [-2, 0, 2], ty = pr.id === "solar" ? [0, 30, 60] : [-2, 0, 2];
    tx.forEach((v) => g.fillText(num(v, 0), m.l + (v - bx[0]) / (bx[1] - bx[0]) * W, m.t + H + 4));
    g.textAlign = "right"; g.textBaseline = "middle";
    ty.forEach((v) => g.fillText(num(v, 0), m.l - 5, m.t + (1 - (v - by[0]) / (by[1] - by[0])) * H));
    g.textAlign = "center"; g.textBaseline = "top";
    g.fillText(pr.id === "solar" ? "paneles (kW)" : "x₁", m.l + W / 2, m.t + H + 18);
    g.save(); g.translate(m.l - 29, m.t + H / 2); g.rotate(-Math.PI / 2); g.textBaseline = "middle";
    g.fillText(pr.id === "solar" ? "batería (kWh)" : "x₂", 0, 0); g.restore();
    // mínimo global
    const o = vis(pr.optimum.point);
    g.strokeStyle = "#212A30"; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(o[0] - 6, o[1] - 6); g.lineTo(o[0] + 6, o[1] + 6); g.moveTo(o[0] + 6, o[1] - 6); g.lineTo(o[0] - 6, o[1] + 6); g.stroke();
    const run = estado.run; if (!run) return;
    // el paso del explorador 1: la flecha d (de r3 a r2), F d sobre r1 y el mutante
    const t = run.lastTrial;
    if (t) {
      const [d1, d2, d3] = t.donorPoints.map(vis), v = vis(t.mutant);
      // donde estaban los tres sorteados al empezar la generación (algunos ya se movieron): aros tenues
      g.setLineDash([2, 2]); g.strokeStyle = "rgba(33,42,48,.6)"; g.lineWidth = 1.2;
      [d1, d2, d3].forEach((p) => { g.beginPath(); g.arc(p[0], p[1], 5, 0, 2 * Math.PI); g.stroke(); });
      g.setLineDash([]);
      flecha(g, d3, d2, "rgba(33,42,48,.85)", 1.6);
      flecha(g, d1, v, "#C4622D", 2.4);
      if (t.accepted) { g.setLineDash([4, 3]); g.strokeStyle = "#C4622D"; g.lineWidth = 1.2; const a = vis(t.target); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(vis(t.trial)[0], vis(t.trial)[1]); g.stroke(); g.setLineDash([]); }
      g.fillStyle = "#C4622D"; g.strokeStyle = "#fff"; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(v[0], v[1] - 6); g.lineTo(v[0] + 6, v[1]); g.lineTo(v[0], v[1] + 6); g.lineTo(v[0] - 6, v[1]); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = "#212A30"; g.font = "600 12px system-ui, sans-serif"; g.textAlign = "left"; g.textBaseline = "bottom";
      [[d1, "r₁"], [d2, "r₂"], [d3, "r₃"]].forEach(([p, s]) => g.fillText(s, p[0] + 7, p[1] - 4));
    }
    // la población; el mejor en salvia; el explorador 1 con borde terracota, encima de todo
    run.population.forEach((u, i) => {
      if (i === 0) return;
      const p = vis(u); g.beginPath(); g.arc(p[0], p[1], 5, 0, 2 * Math.PI);
      const esMejor = i === run.bestIndex;
      g.fillStyle = esMejor ? "#4E7A5A" : "#fff"; g.fill(); g.lineWidth = esMejor ? 1.5 : 2; g.strokeStyle = esMejor ? "#fff" : "#212A30"; g.stroke();
    });
    const p1 = vis(run.population[0]);
    g.beginPath(); g.arc(p1[0], p1[1], 6, 0, 2 * Math.PI); g.fillStyle = run.bestIndex === 0 ? "#4E7A5A" : "#fff"; g.fill();
    g.lineWidth = 2.6; g.strokeStyle = "#C4622D"; g.stroke();
    g.fillStyle = "#B05512"; g.font = "600 12px system-ui, sans-serif"; g.textAlign = "left"; g.textBaseline = "top"; g.fillText("1", p1[0] + 7, p1[1] + 2);
  }
  function dibujaCurva() {
    const pr = problema(), run = estado.run, cv = $("curva");
    const { g, w, h } = lienzo(cv, (w) => Math.min(200, Math.max(150, w * 0.3)));
    const m = { l: pr.id === "solar" ? 58 : 40, r: 12, t: 10, b: 30 }, W = w - m.l - m.r, H = h - m.t - m.b;
    g.clearRect(0, 0, w, h);
    if (!run) return;
    const G = run.maxGenerations, tr = run.trace.map((x) => x.best), opt = pr.optimum.value;
    const ys = tr.concat([opt]); let lo = Math.min(...ys), hi = Math.max(...ys); if (hi - lo < 1e-9) { hi = lo + 1; }
    const pad = (hi - lo) * 0.08; lo -= pad; hi += pad;
    const X = (k) => m.l + (G === 0 ? 0 : k / G) * W, Y = (v) => m.t + (1 - (v - lo) / (hi - lo)) * H;
    g.strokeStyle = "#DAD7D0"; g.lineWidth = 1; g.beginPath(); g.moveTo(m.l, m.t); g.lineTo(m.l, m.t + H); g.lineTo(m.l + W, m.t + H); g.stroke();
    g.setLineDash([5, 4]); g.strokeStyle = "#4E7A5A"; g.beginPath(); g.moveTo(m.l, Y(opt)); g.lineTo(m.l + W, Y(opt)); g.stroke(); g.setLineDash([]);
    g.fillStyle = "#4E7A5A"; g.font = "12px system-ui, sans-serif"; g.textAlign = "right"; g.textBaseline = "bottom";
    g.fillText("mínimo global", m.l + W, Y(opt) - 3);
    g.strokeStyle = "#0F4C5C"; g.lineWidth = 2; g.beginPath();
    tr.forEach((v, k) => { if (k === 0) g.moveTo(X(k), Y(v)); else { g.lineTo(X(k), Y(tr[k - 1])); g.lineTo(X(k), Y(v)); } }); g.stroke();
    g.fillStyle = "#0F4C5C"; tr.forEach((v, k) => { g.beginPath(); g.arc(X(k), Y(v), 2.5, 0, 2 * Math.PI); g.fill(); });
    g.fillStyle = "#5C6670"; g.textAlign = "center"; g.textBaseline = "top";
    [0, G].forEach((k) => g.fillText(String(k), X(k), m.t + H + 4)); g.fillText("generación", m.l + W / 2, m.t + H + 14);
    g.textAlign = "right"; g.textBaseline = "middle";
    [hi - pad, lo + pad].forEach((v) => g.fillText(pr.id === "solar" ? num(v, 0) : num(v, 1), m.l - 5, Y(v)));
  }
  // La gráfica 3D del costo solar: se gira arrastrando (horizontal: azimut; vertical, con ratón: elevación)
  const vista = { az: VISTA.az, el: VISTA.el };
  function dibuja3D() {
    const cv = $("costo3d"); if ($("vista3d").hidden) return;
    const { g, w, h } = lienzo(cv, (w) => Math.min(430, Math.max(220, w * 0.72)));
    const V = vista3d(P.solar, vista.az, vista.el);
    const xs = V.esquinas.map((p) => p[0]), ys = V.esquinas.map((p) => p[1]);
    const m = w < 480 ? { l: 60, r: 40, t: 26, b: 44 } : { l: 74, r: 58, t: 30, b: 52 };   // en el teléfono, márgenes más chicos
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const s = Math.min((w - m.l - m.r) / (x1 - x0), (h - m.t - m.b) / (y1 - y0));
    const ox = m.l + ((w - m.l - m.r) - s * (x1 - x0)) / 2, oy = m.t + ((h - m.t - m.b) - s * (y1 - y0)) / 2;
    const X = (p) => [ox + (p[0] - x0) * s, oy + (y1 - p[1]) * s];
    const poly = (pts) => { g.beginPath(); pts.forEach((p, k) => { const [a, b] = X(p); if (k) g.lineTo(a, b); else g.moveTo(a, b); }); g.closePath(); };
    const seg = (a, b) => { const [p, q] = [X(a), X(b)]; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(q[0], q[1]); g.stroke(); };
    g.clearRect(0, 0, w, h);
    g.fillStyle = "#F4F3F0"; g.strokeStyle = "#C9C6BF"; g.lineWidth = 1;
    V.caras.forEach((c) => { poly(c); g.fill(); g.stroke(); });
    g.strokeStyle = "#E2DFD8"; g.lineWidth = 0.8; V.reticula.forEach((l) => seg(l[0], l[1]));
    g.lineWidth = 0.5; g.strokeStyle = "rgba(33,42,48,.35)";
    V.celdas.forEach((c) => { const rgb = color(c.banda / 7); poly(c.q); g.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`; g.fill(); g.stroke(); });
    // ejes con sus marcas: las cifras salen hacia afuera de la caja
    g.font = "12px system-ui, sans-serif"; g.fillStyle = "#5C6670"; g.strokeStyle = "#212A30";
    const unidad = (a, b) => { const p = X(a), q = X(b), dx = q[0] - p[0], dy = q[1] - p[1], L = Math.hypot(dx, dy) || 1; return [dx / L, dy / L]; };
    // el texto sale hacia donde apunta d; si no cabe en el lienzo, se corre hacia adentro
    const texto = (p, d, t) => {
      const al = d[0] > 0.35 ? "left" : d[0] < -0.35 ? "right" : "center", tw = g.measureText(t).width;
      const ini = al === "left" ? p[0] : al === "right" ? p[0] - tw : p[0] - tw / 2, x = p[0] + Math.min(0, w - 2 - (ini + tw)) + Math.max(0, 2 - ini);
      g.textAlign = al; g.textBaseline = d[1] > 0.35 ? "top" : d[1] < -0.35 ? "bottom" : "middle";
      g.fillText(t, x, p[1]);
    };
    const eje = (e, d, titulo, en, lejos, salta) => {
      g.lineWidth = 1.2; seg(e.linea[0], e.linea[1]);
      e.marcas.forEach((mk) => {
        const p = X(mk.q); g.lineWidth = 1; g.beginPath(); g.moveTo(p[0], p[1]); g.lineTo(p[0] + d[0] * 4, p[1] + d[1] * 4); g.stroke();
        if (mk.v !== salta) texto([p[0] + d[0] * 7, p[1] + d[1] * 7], d, mk.v >= 10000 ? num(mk.v / 1000, 0) + " 000" : String(mk.v));
      });
      if (titulo) {
        const a = X(e.linea[0]), b = X(e.linea[1]), p = [a[0] + en * (b[0] - a[0]) + d[0] * lejos, a[1] + en * (b[1] - a[1]) + d[1] * lejos];
        g.fillStyle = "#212A30"; texto(p, d, titulo); g.fillStyle = "#5C6670";
      }
    };
    // el título de los paneles entre el 10 y el 15; en el teléfono, más abajo (cerca del 20), donde hay lugar
    eje(V.ejes.P, unidad(...V.ejes.P.fuera), "paneles (kW)", w < 480 ? 0.9 : 0.625, w < 480 ? 24 : 34, null);
    eje(V.ejes.E, unidad(...V.ejes.E.fuera), "batería (kWh)", 0.5, 30, null);
    eje(V.ejes.z, [-1, 0], null, 0, 0, 0);
    // el título del costo, arriba del eje; al girar, el eje puede quedar pegado al borde izquierdo y el título no debe salirse del lienzo
    const tz = X(V.ejes.z.linea[1]), tt = "costo (USD/año)"; g.fillStyle = "#212A30"; g.textAlign = "right"; g.textBaseline = "bottom";
    g.fillText(tt, Math.max(tz[0] + 6, g.measureText(tt).width + 4), tz[1] - 8);
    // el mínimo global: disco oscuro y su rótulo arriba a la izquierda, con una línea
    const o = X(V.minimo.q), r = [o[0] - 34, o[1] - 40];
    g.strokeStyle = "#fff"; g.lineWidth = 3.5; g.beginPath(); g.moveTo(r[0], r[1]); g.lineTo(o[0], o[1]); g.stroke();
    g.strokeStyle = "#212A30"; g.lineWidth = 1.3; g.beginPath(); g.moveTo(r[0], r[1]); g.lineTo(o[0], o[1]); g.stroke();
    g.beginPath(); g.arc(o[0], o[1], 5, 0, 2 * Math.PI); g.fillStyle = "#212A30"; g.fill(); g.lineWidth = 1.5; g.strokeStyle = "#fff"; g.stroke();
    g.font = "600 12px system-ui, sans-serif"; const t = "mínimo global", tw = g.measureText(t).width;
    g.fillStyle = "rgba(255,255,255,.92)"; g.fillRect(r[0] - tw / 2 - 4, r[1] - 18, tw + 8, 17);
    g.fillStyle = "#212A30"; g.textAlign = "center"; g.textBaseline = "bottom"; g.fillText(t, r[0], r[1] - 3);
  }
  (function arrastre() {
    const cv = $("costo3d"); let x = null, y = null, raf = 0;
    cv.addEventListener("pointerdown", (ev) => { x = ev.clientX; y = ev.clientY; cv.setPointerCapture(ev.pointerId); });
    cv.addEventListener("pointermove", (ev) => {
      if (x === null) return;
      vista.az = (vista.az - (ev.clientX - x) * 0.4 + 360) % 360;
      if (ev.pointerType === "mouse") vista.el = Math.max(8, Math.min(75, vista.el + (ev.clientY - y) * 0.3));
      x = ev.clientX; y = ev.clientY;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; dibuja3D(); });
    });
    const suelta = () => { x = y = null; };
    cv.addEventListener("pointerup", suelta); cv.addEventListener("pointercancel", suelta);
    $("vista-inicial").addEventListener("click", () => { vista.az = VISTA.az; vista.el = VISTA.el; dibuja3D(); });
  })();
  function actualiza() {
    const pr = problema(), c = cfg(), run = estado.run, s = E.summarize(run);
    $("estado").textContent = `Generación ${run.generation} de ${run.maxGenerations} · ${run.evaluations} evaluaciones de f · mejor f = ${valor(pr, s.best)} en ${punto(pr, s.bestPoint)}`;
    const e = explicaPaso(pr, run.lastTrial, c);
    $("regla-mut").innerHTML = "<b>Mutación.</b> " + (e ? e.mutacion : "Avance una generación para verla.");
    $("regla-cruza").innerHTML = "<b>Cruza.</b> " + (e ? e.cruza : "—");
    $("regla-sel").innerHTML = "<b>Selección.</b> " + (e ? e.seleccion : "—");
    $("paso").disabled = run.done; $("animar").disabled = run.done && !estado.timer;
    if (run.done) { parar(); }
    dibujaMapa(); dibujaCurva();
  }
  function parar() { if (estado.timer) { clearInterval(estado.timer); estado.timer = null; } $("animar").textContent = "Animar"; $("animar").disabled = estado.run && estado.run.done; }
  function reinicia() {
    parar();
    estado.run = nuevaCorrida(problema(), cfg());
    $("costo-corrida").textContent = costoTexto(problema(), cfg());
    actualiza();
  }
  function leeControles() {
    const c = cfg();
    c.np = Math.max(4, Math.min(30, parseInt($("np").value, 10) || 6));
    c.F = Number($("f").value); c.CR = Number($("cr").value);
    c.generations = Math.max(1, Math.min(60, parseInt($("gen").value, 10) || 1));
    c.seed = Math.max(0, Math.min(9999, parseInt($("semilla").value, 10) || 0));
    $("np-val").textContent = c.np; $("f-val").textContent = num(c.F, 2); $("cr-val").textContent = num(c.CR, 2);
  }
  function ponControles() {
    const c = cfg();
    $("np").value = c.np; $("f").value = c.F; $("cr").value = c.CR; $("gen").value = c.generations; $("semilla").value = c.seed;
    $("np-val").textContent = c.np; $("f-val").textContent = num(c.F, 2); $("cr-val").textContent = num(c.CR, 2);
  }
  function eligeProblema(id) {
    estado.id = id;
    document.querySelectorAll(".opcion").forEach((b) => { const on = b.dataset.problema === id; b.classList.toggle("activa", on); b.setAttribute("aria-checked", String(on)); });
    $("descripcion-terrain").hidden = id !== "terrain"; $("descripcion-solar").hidden = id !== "solar"; $("vista3d").hidden = id !== "solar";
    $("resultado-30").textContent = ""; $("barra-30").hidden = true;
    ponControles(); reinicia(); dibuja3D();
  }
  document.querySelectorAll(".opcion").forEach((b) => b.addEventListener("click", () => eligeProblema(b.dataset.problema)));
  ["np", "f", "cr", "gen", "semilla"].forEach((id) => $(id).addEventListener("input", () => { leeControles(); $("resultado-30").textContent = ""; $("barra-30").hidden = true; reinicia(); }));
  $("paso").addEventListener("click", () => { if (!estado.run.done) { E.stepGeneration(estado.run); actualiza(); } });
  $("reiniciar").addEventListener("click", reinicia);
  $("animar").addEventListener("click", () => {
    if (estado.timer) { parar(); return; }
    if (estado.run.done) return;
    $("animar").textContent = "Pausa";
    estado.timer = setInterval(() => { if (estado.run.done) { parar(); return; } E.stepGeneration(estado.run); actualiza(); }, 650);
  });
  $("treinta").addEventListener("click", () => {
    const r = treintaSemillas(problema(), cfg());
    $("resultado-30").textContent = treintaTexto(problema(), cfg(), r);
    $("barra-30").hidden = false; $("barra-30-lleno").style.width = (100 * r.exitos / r.total) + "%";
  });
  let tRes = null; window.addEventListener("resize", () => { clearTimeout(tRes); tRes = setTimeout(() => { dibujaMapa(); dibujaCurva(); dibuja3D(); }, 120); });
  eligeProblema("terrain");
})(typeof globalThis !== "undefined" ? globalThis : this);
