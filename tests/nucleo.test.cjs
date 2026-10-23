"use strict";
// Pruebas del núcleo de la interfaz v3 (sin DOM): textos del paso del explorador 1, costo de una corrida y la repetición con 30 semillas.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const E = require("../src/engine.js");
const N = require("../src/app.js");
const data = JSON.parse(fs.readFileSync(path.join(__dirname, "../src/solar-data.json"), "utf8"));
const P = N.crearProblemas(data);

test("valores por omisión: el cerro como la animación de la clase (NP 6, 8 generaciones) y el caso solar como su corrida (NP 10, 20 generaciones)", () => {
  assert.deepEqual(N.DEF.terrain, { np: 6, F: 0.5, CR: 0.5, generations: 8, seed: 1 });
  assert.deepEqual(N.DEF.solar, { np: 10, F: 0.5, CR: 0.5, generations: 20, seed: 0 });
  assert.equal(N.evaluaciones(N.DEF.terrain), 54);
  assert.equal(N.evaluaciones(N.DEF.solar), 210);
  assert.match(N.costoTexto(P.solar, N.DEF.solar), /210 simulaciones, frente a las 1271/);
});

test("formato: signo menos tipográfico, sin «−0.00», y subíndices", () => {
  assert.equal(N.num(-1.234, 2), "−1.23");
  assert.equal(N.num(-0.001, 2), "0.00");
  assert.equal(N.sub(12), "₁₂");
  assert.equal(N.punto(P.solar, P.solar.optimum.point), "(10 kW, 28 kWh)");
  assert.equal(N.valor(P.solar, 3285.6), "3285.6 USD/año");
});

test("el paso del explorador 1 se explica con los datos del motor y es coherente con la regla de selección", () => {
  for (const id of ["terrain", "solar"]) {
    const run = N.nuevaCorrida(P[id], N.DEF[id]);
    for (let g = 0; g < 4; g++) {
      E.stepGeneration(run);
      const t = run.lastTrial, e = N.explicaPaso(P[id], t, N.DEF[id]);
      assert.equal(t.i, 0);
      assert.ok(e.mutacion.includes(`exploradores ${t.r[0] + 1}, ${t.r[1] + 1} y ${t.r[2] + 1}`));
      assert.ok(e.cruza.includes(`la j<sub>rand</sub> es la coordenada ${t.jrand + 1}`));
      assert.equal(t.accepted, t.trialCost <= t.targetCost);
      assert.ok(t.accepted ? e.seleccion.includes("se mueve a u") : e.seleccion.includes("se queda donde estaba"));
      assert.ok(t.crossMask[t.jrand], "la j_rand siempre viene del mutante");
    }
  }
});

test("la frontera del cerro es el máximo local de g, cerca de 0.126 (la misma que la clase)", () => {
  assert.ok(Math.abs(N.FRONTERA - 0.1256) < 1e-3);
});

test("repetir con 30 semillas: reproducible y con el criterio de la clase (región de atracción del mínimo global)", () => {
  const a = N.treintaSemillas(P.terrain, N.DEF.terrain), b = N.treintaSemillas(P.terrain, N.DEF.terrain);
  assert.deepEqual(a, b);
  assert.equal(a.total, 30);
  assert.ok(a.exitos >= 0 && a.exitos <= 30);
  assert.match(N.treintaTexto(P.terrain, N.DEF.terrain, a), /el mejor terminó en la región de atracción del mínimo global/);
  const s = N.treintaSemillas(P.solar, N.DEF.solar);
  assert.ok(s.exitos > 0, "en el caso solar alguna corrida llega al diseño más barato");
  assert.match(N.treintaTexto(P.solar, N.DEF.solar, s), /de 30 semillas el mejor fue el diseño más barato de la malla/);
});
