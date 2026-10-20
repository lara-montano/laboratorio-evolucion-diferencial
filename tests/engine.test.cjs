"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const E = require("../src/engine.js");
const data = JSON.parse(fs.readFileSync(path.join(__dirname, "../src/solar-data.json"), "utf8"));
const solar = E.createSolarProblem(data);
const terrain = E.createTerrainProblem();
const close = (a, b, epsilon = 1e-12) => assert.ok(Math.abs(a - b) <= epsilon, `${a} ≠ ${b}`);

test("solar: la referencia se calcula de la matriz, no del metadato con más decimales", () => {
  assert.equal(solar.totalDesigns, 1271);
  assert.equal(solar.optimum.value, 3285.6);
  assert.equal(solar.optimum.decoded.P_kW, 10);
  assert.equal(solar.optimum.decoded.E_kWh, 28);
  assert.notEqual(solar.optimum.value, data.optimo_malla.costo);
  assert.equal(solar.evaluate(solar.optimum.point), solar.optimum.value);
});

test("solar: índices, ejes y reparación de límites", () => {
  assert.deepEqual(solar.decode([0, 0]).indices, [0, 0]);
  assert.deepEqual(solar.decode([1, 1]).indices, [40, 30]);
  assert.deepEqual(solar.decode([-0.1, 1.1]).indices, [0, 30]);
  assert.deepEqual(solar.decode([10 / 20, 28 / 60]).coords, [10, 28]);
  assert.equal(solar.evaluate([1, 0]), data.costo[40][0]);
});

test("solar: los empates exactos se redondean al índice par como np.rint", () => {
  const first = [0.25 / 20, 1 / 60];
  assert.deepEqual(solar.decode(first).indices, [0, 0]);
  assert.deepEqual(solar.decode(first).coords, [0, 0]);
  assert.equal(solar.evaluate(first), data.costo[0][0]);
  const alternate = [0.75 / 20, 3 / 60];
  assert.deepEqual(solar.decode(alternate).indices, [2, 2]);
  assert.deepEqual(solar.decode(alternate).coords, [1, 4]);
  assert.equal(solar.evaluate(alternate), data.costo[2][2]);
  assert.deepEqual(solar.project(alternate), [2 / 40, 2 / 30]);
  assert.deepEqual(solar.decode([(0.5 - 1e-12) / 40, (0.5 + 1e-12) / 30]).indices, [0, 1]);
});

test("solar: la matriz opcional de energía no servida valida dimensiones y valores", () => {
  const base = { P_kW: [0, 1], E_kWh: [0, 1], costo: [[2, 1], [3, 4]] };
  assert.equal(E.createSolarProblem(base).decode([1, 1]).unserved, null);
  const valid = E.createSolarProblem({ ...base, no_servido_kWh: [[5, 4], [3, 2]] });
  assert.equal(valid.decode([1, 1]).unserved, 2);
  for (const invalid of [null, [], [[5]], [[5, 4]], [[5, 4], [3]],
    [[5, NaN], [3, 2]], [[5, 4], [Infinity, 2]], [[5, 4], [3, "2"]],
    [[5, 4], Array(2)], [undefined, [3, 2]]]) {
    assert.throws(() => E.createSolarProblem({ ...base, no_servido_kWh: invalid }), /no_servido_kWh/);
  }
});

test("terreno: misma función de la presentación y mínimo estacionario global", () => {
  assert.equal(terrain.evaluate([0.5, 0.5]), 0);
  const { x, y } = terrain.optimum.decoded;
  assert.ok(x < -1.4 && x > -1.6);
  close(x, y);
  close(4 * x ** 3 - 8 * x + 1, 0, 1e-10);
  close(terrain.optimum.value, 2 * (x ** 4 - 4 * x ** 2 + x));
  for (let i = 0; i <= 100; i++) {
    for (let j = 0; j <= 100; j++) {
      assert.ok(terrain.evaluate([i / 100, j / 100]) >= terrain.optimum.value - 1e-10);
    }
  }
});

test("misma semilla y configuración reproducen población, evolución e inspectores", () => {
  const c = { np: 12, F: 0.7, CR: 0.6, seed: 0, generations: 15 };
  const a = E.runToEnd(E.createRun(solar, c));
  const b = E.runToEnd(E.createRun(solar, c));
  assert.deepEqual(a.population, b.population);
  assert.deepEqual(a.trace, b.trace);
  assert.deepEqual(a.lastTrials, b.lastTrials);
  assert.notDeepEqual(a.population, E.runToEnd(E.createRun(solar, { ...c, seed: 1 })).population);
});

test("DE es generacional; donantes distintos, excluyen objetivo y pertenecen a población previa", () => {
  const run = E.createRun(terrain, { np: 8, F: 1.6, CR: 0.5, seed: 14, generations: 1 });
  const previous = run.population.map((p) => p.slice());
  const values = run.values.slice();
  E.stepGeneration(run);
  for (const t of run.lastTrials) {
    assert.equal(new Set(t.r).size, 3);
    assert.ok(!t.r.includes(t.i));
    assert.deepEqual(t.target, previous[t.i]);
    assert.deepEqual(t.donors, t.r);
    assert.deepEqual(t.donorPoints, t.r.map((r) => previous[r]));
    assert.equal(t.targetCost, values[t.i]);
    for (let j = 0; j < 2; j++) {
      close(t.mutantRaw[j], previous[t.r[0]][j] + 1.6 * (previous[t.r[1]][j] - previous[t.r[2]][j]));
      assert.equal(t.mutant[j], Math.max(0, Math.min(1, t.mutantRaw[j])));
      assert.equal(t.trial[j], t.crossMask[j] ? t.mutant[j] : t.target[j]);
    }
    assert.ok(t.crossMask[t.jrand]);
    assert.equal(t.accepted, t.trialCost <= t.targetCost);
    assert.deepEqual(run.population[t.i], t.accepted ? t.trial : t.target);
  }
});

test("con semilla 36, CR=0 usa una coordenada de mutante y CR=1 usa todas", () => {
  for (const CR of [0, 1]) {
    const run = E.createRun(terrain, { np: 12, CR, F: 2, seed: 36, generations: 1 });
    E.stepGeneration(run);
    assert.ok(run.lastTrials.some((t) => t.clipped));
    run.lastTrials.forEach((t) => {
      assert.equal(t.crossMask.filter(Boolean).length, CR === 0 ? 1 : 2);
      assert.ok(t.trial.every((v) => v >= 0 && v <= 1));
    });
  }
});

test("la cruza acepta rand = CR, como la desigualdad de la presentación", () => {
  const run = E.createRun(terrain, { np: 4, CR: 0.5, seed: 36, generations: 1 });
  // Por objetivo: tres índices distintos, jrand=0 y dos sorteos iguales a CR.
  const sequence = [];
  for (let i = 0; i < 4; i++) {
    const others = [0, 1, 2, 3].filter((j) => j !== i);
    sequence.push(...others.map((j) => (j + 0.1) / 4), 0, 0.5, 0.5);
  }
  let cursor = 0;
  run._rng = () => sequence[cursor++];
  E.stepGeneration(run);
  assert.equal(cursor, sequence.length);
  run.lastTrials.forEach((t) => {
    assert.equal(t.jrand, 0);
    assert.deepEqual(t.crossRand, [0.5, 0.5]);
    assert.deepEqual(t.crossMask, [true, true]);
    assert.equal(t.trial[1], t.mutant[1]);
  });
});

test("presupuesto incluye inicialización, usa solo generaciones completas y termina sin evaluaciones extras", () => {
  const run = E.createRun(solar, { np: 24, budgetMode: "evaluations", budget: 1000, seed: 4 });
  assert.equal(run.evaluations, 24);
  assert.equal(run.maxGenerations, 40);
  E.runToEnd(run);
  assert.equal(run.evaluations, 984);
  assert.equal(run.generation, 40);
  assert.equal(E.summarize(run).unusedBudget, 16);
  E.stepGeneration(run);
  assert.equal(run.evaluations, 984);
  const zero = E.createRun(solar, { np: 8, generations: 0 });
  assert.equal(zero.done, true);
  assert.equal(zero.evaluations, 8);
  assert.equal(zero.trace.length, 1);
});

test("selección acepta empates y cuenta TODAS las evaluaciones aunque sean repetidas", () => {
  let count = 0;
  const constant = { dimension: 2, evaluate() { count++; return 3; }, key() { return "misma"; } };
  const run = E.runToEnd(E.createRun(constant, { np: 4, generations: 7, seed: 10 }));
  assert.equal(count, 32);
  assert.equal(run.evaluations, 32);
  assert.equal(run.uniqueVisited.size, 1);
  assert.ok(run.lastTrials.every((t) => t.accepted));
});

test("presupuesto igual a NP evalúa solo la población inicial", () => {
  const run = E.createRun(solar, { np: 8, budgetMode: "evaluations", budget: 8, seed: 0 });
  const initial = run.population.map((p) => p.slice());
  assert.equal(run.done, true);
  assert.equal(run.maxGenerations, 0);
  assert.equal(run.evaluations, 8);
  E.stepGeneration(run);
  E.runToEnd(run);
  assert.equal(run.evaluations, 8);
  assert.equal(run.generation, 0);
  assert.equal(run.trace.length, 1);
  assert.equal(run.lastTrial, null);
  assert.deepEqual(run.population, initial);
  assert.equal(E.summarize(run).unusedBudget, 0);
});

test("el mejor costo nunca sube; población, trazas y diversidad son coherentes", () => {
  const run = E.runToEnd(E.createRun(solar, { np: 30, generations: 60, seed: 8 }));
  assert.equal(run.trace.length, 61);
  run.trace.forEach((t, i) => {
    assert.equal(t.evaluations, 30 * (i + 1));
    assert.equal(t.generation, i);
    assert.ok(t.diversity >= 0 && t.diversity <= 0.5 + 1e-12);
    if (i) assert.ok(t.best <= run.trace[i - 1].best);
  });
  run.population.forEach((p, i) => {
    assert.ok(p.every((v) => v >= 0 && v <= 1));
    assert.equal(solar.evaluate(p), run.values[i]);
  });
  assert.equal(Math.min(...run.values), run.best);
  assert.equal(E.summarize(run).success, true);
  assert.equal(E.summarize(run).gap, 0);
  close(E.diversity([[0, 0], [1, 1]]), 0.5);
  close(E.diversity([[0.3, 0.3], [0.3, 0.3]]), 0);
});

test("repeticiones emparejan semillas y comunican presupuestos efectivos diferentes", () => {
  const c = [{ np: 20, F: 0.6, CR: 0.8 }, { np: 32, F: 0.9, CR: 0.4 }];
  const options = { seeds: [1, 2, 3, 4, 5], budget: 1000 };
  const repeated = E.repeatCompare(solar, c, options);
  assert.equal(repeated.results[0].evaluations, 1000);
  assert.equal(repeated.results[1].evaluations, 992);
  assert.deepEqual(repeated.results[0].runs.map((r) => r.seed), options.seeds);
  assert.deepEqual(repeated.results[1].runs.map((r) => r.seed), options.seeds);
  assert.equal(repeated.wins.reduce((s, v) => s + v, 0) + repeated.ties, 5);
  assert.deepEqual(repeated, E.repeatCompare(solar, c, options));
  repeated.results.forEach((r) => {
    assert.ok(r.min <= r.median && r.median <= r.max);
    assert.ok(r.successRate >= 0 && r.successRate <= 1);
  });
});

test("entradas inválidas se rechazan antes de ejecutar", () => {
  for (const config of [{ np: 3 }, { F: -1 }, { CR: 1.1 }, { seed: -1 },
    { seed: 4294967296 }, { generations: 1.5 }, { budgetMode: "evaluations", np: 40, budget: 20 }]) {
    assert.throws(() => E.createRun(solar, config));
  }
  assert.throws(() => solar.evaluate([NaN, 0]));
  assert.throws(() => E.createSolarProblem({ P_kW: [0, 1], E_kWh: [0, 1], costo: [[1]] }));
});

const benchmarkIds = ["sphere", "rosenbrock", "rastrigin", "ackley"];
const evaluatePhysical = (problem, coords) => problem.evaluate(coords.map((value, j) =>
  (value - problem.bounds[j][0]) / (problem.bounds[j][1] - problem.bounds[j][0])));

for (const id of benchmarkIds) {
  test(`${id}: contrato, mínimo interior y cotas de la superficie`, () => {
    const problem = E.createBenchmarkProblem(id);
    assert.equal(problem.id, id);
    assert.equal(problem.dimension, 2);
    assert.equal(problem.totalDesigns, null);
    assert.equal(problem.successTolerance, 1e-4);
    for (const key of ["name", "description", "formula", "domainText", "optimumText", "teachingNote"]) {
      assert.ok(typeof problem[key] === "string" && problem[key].length > 0, key);
    }
    assert.ok(problem.optimum.point.every((value) => value > 0 && value < 1));
    assert.equal(problem.optimum.value, 0);
    assert.equal(problem.evaluate(problem.optimum.point), 0);
    assert.equal(problem.optimum.decoded.cost, 0);
    assert.deepEqual(problem.decode([0, 0]).coords, problem.bounds.map((bound) => bound[0]));
    assert.deepEqual(problem.decode([1, 1]).coords, problem.bounds.map((bound) => bound[1]));
    assert.deepEqual(problem.project([-0.1, 1.1]), [0, 1]);
    assert.equal(problem.key([0.123, 0.987]), "0.123,0.987");
    assert.throws(() => problem.evaluate([NaN, 0]));
    for (let i = 0; i <= 50; i++) {
      for (let j = 0; j <= 50; j++) {
        const value = problem.evaluate([i / 50, j / 50]);
        assert.ok(Number.isFinite(value));
        assert.ok(value >= 0, `Valor negativo: ${value}`);
        assert.ok(value <= problem.costRange[1] + 1e-10, `Excede la cota: ${value}`);
      }
    }
  });
}

test("funciones de referencia: valores conocidos y dominio asimétrico de Rosenbrock", () => {
  const sphere = E.createBenchmarkProblem("sphere");
  close(evaluatePhysical(sphere, [1, 2]), 5);
  close(evaluatePhysical(sphere, [-5, 5]), 50);
  const rosenbrock = E.createBenchmarkProblem("rosenbrock");
  assert.deepEqual(rosenbrock.bounds, [[-2, 2], [-1, 3]]);
  assert.deepEqual(rosenbrock.optimum.point, [0.75, 0.5]);
  assert.deepEqual(rosenbrock.optimum.decoded.coords, [1, 1]);
  close(evaluatePhysical(rosenbrock, [0, 0]), 1);
  close(evaluatePhysical(rosenbrock, [-1, 1]), 4);
  close(evaluatePhysical(rosenbrock, [-2, -1]), 2509);
  const rastrigin = E.createBenchmarkProblem("rastrigin");
  close(evaluatePhysical(rastrigin, [1, 1]), 2);
  close(evaluatePhysical(rastrigin, [0.5, 0.5]), 40.5);
  const ackley = E.createBenchmarkProblem("ackley");
  close(evaluatePhysical(ackley, [1, 1]), 20 * (1 - Math.exp(-0.2)));
  close(evaluatePhysical(ackley, [0.5, 0.5]), 20 * (1 - Math.exp(-0.1)) + Math.E - Math.exp(-1));
  for (const offset of [0, 1e-15, -1e-15, 1e-10, -1e-10]) {
    assert.ok(evaluatePhysical(ackley, [offset, offset]) >= 0);
  }
});

test("las funciones de referencia admiten corridas DE reproducibles con presupuesto", () => {
  for (const id of benchmarkIds) {
    const problem = E.createBenchmarkProblem(id);
    const config = { np: 8, F: 2, CR: 0.5, seed: 36, budgetMode: "evaluations", budget: 323 };
    const a = E.runToEnd(E.createRun(problem, config));
    const b = E.runToEnd(E.createRun(problem, config));
    assert.deepEqual(a.trace, b.trace);
    assert.equal(a.evaluations, 320);
    assert.equal(a.generation, 39);
    assert.equal(E.summarize(a).unusedBudget, 3);
    a.trace.forEach((entry, i) => {
      assert.ok(Number.isFinite(entry.best) && entry.best >= 0);
      if (i > 0) assert.ok(entry.best <= a.trace[i - 1].best);
    });
  }
  assert.throws(() => E.createBenchmarkProblem("unknown"), /desconocida/);
  assert.throws(() => E.createBenchmarkProblem("toString"), /desconocida/);
});
