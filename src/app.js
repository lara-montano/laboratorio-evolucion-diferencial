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
  const Nucleo = { DEF, FRONTERA, llega, num, sub, crearProblemas, nuevaCorrida, punto, valor, evaluaciones, costoTexto, explicaPaso, treintaSemillas, treintaTexto };
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
    $("descripcion-terrain").hidden = id !== "terrain"; $("descripcion-solar").hidden = id !== "solar";
    $("resultado-30").textContent = ""; $("barra-30").hidden = true;
    ponControles(); reinicia();
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
  let tRes = null; window.addEventListener("resize", () => { clearTimeout(tRes); tRes = setTimeout(() => { dibujaMapa(); dibujaCurva(); }, 120); });
  eligeProblema("terrain");
})(typeof globalThis !== "undefined" ? globalThis : this);
