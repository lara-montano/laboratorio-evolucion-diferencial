/* Laboratorio de evolución diferencial, sesión 36.
 * API sin dependencias: window.DELabEngine en navegador, module.exports en Node.
 * DE/rand/1/bin generacional. Coordenadas internas normalizadas en [0,1].
 * No se mezclan individuos recién aceptados con los donantes de su generación.
 * Toda llamada de evaluación cuenta, aunque corresponda a una celda ya visitada.
 */
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.DELabEngine = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const finite = (x) => typeof x === "number" && Number.isFinite(x);
  function assert(condition, message) {
    if (!condition) throw new Error(message);
  }
  function integer(value, min, name) {
    assert(Number.isSafeInteger(value) && value >= min, `${name} debe ser un entero ≥ ${min}.`);
    return value;
  }
  function point(u, dimension) {
    assert(Array.isArray(u) && u.length === dimension && u.every(finite),
      `Se requieren ${dimension} coordenadas numéricas finitas.`);
    return u.map(clamp01);
  }

  // Mulberry32: mismo uint32 inicial => exactamente la misma secuencia.
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function createSolarProblem(data) {
    assert(data && Array.isArray(data.P_kW) && Array.isArray(data.E_kWh) && Array.isArray(data.costo),
      "La malla solar requiere P_kW, E_kWh y costo.");
    const xs = data.P_kW.slice(), ys = data.E_kWh.slice();
    assert(xs.length >= 2 && ys.length >= 2 && xs.every(finite) && ys.every(finite),
      "Los ejes de la malla deben contener al menos dos valores finitos.");
    for (const axis of [xs, ys]) {
      const step = axis[1] - axis[0];
      assert(step > 0 && axis.every((v, i) => Math.abs(v - (axis[0] + i * step)) < 1e-9),
        "La malla solar debe tener ejes regulares y crecientes.");
    }
    assert(data.costo.length === xs.length && data.costo.every(
      (row) => Array.isArray(row) && row.length === ys.length && row.every(finite)),
    "Las dimensiones de costo no coinciden con los ejes de la malla.");
    const costs = data.costo.map((row) => row.slice());
    let unserved = null;
    if (data.no_servido_kWh !== undefined) {
      assert(Array.isArray(data.no_servido_kWh) && data.no_servido_kWh.length === xs.length &&
        Array.from(data.no_servido_kWh).every((row) => Array.isArray(row) &&
          row.length === ys.length && Array.from(row).every(finite)),
      "no_servido_kWh debe ser una matriz de valores finitos con las mismas dimensiones que costo.");
      unserved = data.no_servido_kWh.map((row) => row.slice());
    }
    let min = Infinity, max = -Infinity, bestIJ = [0, 0];
    costs.forEach((row, i) => row.forEach((value, j) => {
      if (value < min) { min = value; bestIJ = [i, j]; }
      max = Math.max(max, value);
    }));
    function nearestEven(value) {
      const lower = Math.floor(value);
      // Como np.rint: solo los empates exactos se llevan al índice par.
      return value - lower === 0.5 ? lower + (lower % 2) : Math.round(value);
    }
    function indices(u) {
      const v = point(u, 2);
      return [nearestEven(v[0] * (xs.length - 1)), nearestEven(v[1] * (ys.length - 1))];
    }
    function decode(u) {
      const [i, j] = indices(u);
      return {
        x: xs[i], y: ys[j], coords: [xs[i], ys[j]], indices: [i, j],
        P_kW: xs[i], E_kWh: ys[j], cost: costs[i][j],
        unserved: unserved ? unserved[i][j] : null,
        no_servido_kWh: unserved ? unserved[i][j] : null
      };
    }
    const optimumPoint = [bestIJ[0] / (xs.length - 1), bestIJ[1] / (ys.length - 1)];
    return {
      id: "solar", name: "Sistema solar con batería", dimension: 2,
      bounds: [[xs[0], xs[xs.length - 1]], [ys[0], ys[ys.length - 1]]],
      labels: ["Potencia solar P (kW)", "Capacidad de batería E (kWh)"],
      xValues: xs, yValues: ys, costs, gridSize: [xs.length, ys.length],
      totalDesigns: xs.length * ys.length, costRange: [min, max],
      successTolerance: 1e-8,
      sourceNote: data._nota || "Modelo simplificado, datos sintéticos.",
      // La referencia es el mínimo de LA MATRIZ utilizada al evaluar.
      // optimo_malla.costo puede tener otra precisión; no se usa como referencia.
      optimum: { value: min, cost: min, point: optimumPoint, decoded: decode(optimumPoint) },
      evaluate(u) { const [i, j] = indices(u); return costs[i][j]; },
      decode,
      project(u) { const [i, j] = indices(u); return [i / (xs.length - 1), j / (ys.length - 1)]; },
      key(u) { return indices(u).join(","); }
    };
  }

  function createTerrainProblem() {
    const lo = -2.2, hi = 2.2, width = hi - lo;
    const g = (x) => x ** 4 - 4 * x ** 2 + x;
    const derivative = (x) => 4 * x ** 3 - 8 * x + 1;
    const turning = Math.sqrt(2 / 3);
    const intervals = [[lo, -turning], [-turning, turning], [turning, hi]];
    const critical = intervals.map(([start, end]) => {
      let a = start, b = end, fa = derivative(a);
      for (let k = 0; k < 80; k++) {
        const mid = (a + b) / 2, fm = derivative(mid);
        if (fa * fm <= 0) b = mid;
        else { a = mid; fa = fm; }
      }
      return (a + b) / 2;
    });
    const candidates = [lo, hi, ...critical];
    const minimizer = candidates.reduce((a, b) => g(a) <= g(b) ? a : b);
    const maximum = Math.max(...candidates.map(g)) * 2;
    function decode(u) {
      const v = point(u, 2), x = lo + width * v[0], y = lo + width * v[1];
      return { x, y, coords: [x, y], cost: g(x) + g(y) };
    }
    const optimumPoint = [(minimizer - lo) / width, (minimizer - lo) / width];
    const minimum = 2 * g(minimizer);
    return {
      id: "terrain", name: "Terreno de cuatro valles", dimension: 2,
      bounds: [[lo, hi], [lo, hi]], labels: ["x₁", "x₂"],
      formula: "f(x₁,x₂) = (x₁⁴ − 4x₁² + x₁) + (x₂⁴ − 4x₂² + x₂)",
      costRange: [minimum, maximum], totalDesigns: null,
      successTolerance: 0.01,
      optimum: { value: minimum, cost: minimum, point: optimumPoint, decoded: decode(optimumPoint) },
      evaluate(u) { return decode(u).cost; }, decode,
      project(u) { return point(u, 2); },
      // Sin discretización artificial: posiciones idénticas son repetidas.
      key(u) { return point(u, 2).join(","); }
    };
  }

  function createBenchmarkProblem(id) {
    const definitions = {
      sphere: {
        name: "Esfera", bounds: [[-5, 5], [-5, 5]], minimum: [0, 0], maximumBound: 50,
        description: "Un mínimo global y una superficie suave, sin mínimos locales adicionales.",
        formula: "f(x₁,x₂) = x₁² + x₂²",
        domainText: "x₁, x₂ ∈ [−5, 5]", optimumText: "(0, 0), f = 0",
        teachingNote: "Sirve como referencia sencilla: observa la velocidad de acercamiento al mínimo y la pérdida de diversidad.",
        objective: (x, y) => x * x + y * y
      },
      rosenbrock: {
        name: "Rosenbrock", bounds: [[-2, 2], [-1, 3]], minimum: [1, 1], maximumBound: 2509,
        description: "Un valle estrecho y curvo conduce al mínimo global; las variables están acopladas.",
        formula: "f(x₁,x₂) = (1 − x₁)² + 100(x₂ − x₁²)²",
        domainText: "x₁ ∈ [−2, 2]; x₂ ∈ [−1, 3]", optimumText: "(1, 1), f = 0",
        teachingNote: "Compara CR bajo y alto: combinar las coordenadas afecta el avance a lo largo del valle. Aumenta el presupuesto para observar el afinamiento.",
        objective: (x, y) => (1 - x) ** 2 + 100 * (y - x * x) ** 2
      },
      rastrigin: {
        name: "Rastrigin", bounds: [[-5.12, 5.12], [-5.12, 5.12]], minimum: [0, 0],
        maximumBound: 40 + 2 * 5.12 ** 2,
        description: "Muchos mínimos locales distribuidos en una superficie periódica; el mínimo global está en el origen.",
        formula: "f(x₁,x₂) = 20 + x₁² + x₂² − 10 cos(2πx₁) − 10 cos(2πx₂)",
        domainText: "x₁, x₂ ∈ [−5.12, 5.12]", optimumText: "(0, 0), f = 0",
        teachingNote: "Observa si la población conserva exploración o se concentra en un mínimo local. Compara varias semillas antes de concluir sobre F o NP.",
        objective: (x, y) => x * x + y * y +
          10 * (1 - Math.cos(2 * Math.PI * x)) + 10 * (1 - Math.cos(2 * Math.PI * y))
      },
      ackley: {
        name: "Ackley", bounds: [[-5, 5], [-5, 5]], minimum: [0, 0],
        // r ≤ 5 y −1 ≤ media(cos) ≤ 1: esta cota no presupone un máximo exacto.
        maximumBound: 20 + Math.E - 21 / Math.E,
        description: "Una región exterior ondulada rodea un pozo central pronunciado con mínimo en el origen.",
        formula: "f(x₁,x₂) = −20 exp(−0.2√((x₁²+x₂²)/2)) − exp((cos(2πx₁)+cos(2πx₂))/2) + 20 + e",
        domainText: "x₁, x₂ ∈ [−5, 5]", optimumText: "(0, 0), f = 0",
        teachingNote: "Distingue encontrar la región central de afinar la solución: compara las curvas y la brecha final con distintos presupuestos.",
        objective(x, y) {
          const radius = Math.sqrt((x * x + y * y) / 2);
          const meanCos = (Math.cos(2 * Math.PI * x) + Math.cos(2 * Math.PI * y)) / 2;
          // Forma equivalente que evita cancelar 20 − 20 cerca del origen.
          const value = -20 * Math.expm1(-0.2 * radius) + (Math.E - Math.exp(meanCos));
          return value < 0 && value > -1e-12 ? 0 : value;
        }
      }
    };
    assert(Object.prototype.hasOwnProperty.call(definitions, id), `Función objetivo desconocida: ${id}.`);
    const definition = definitions[id];
    const bounds = definition.bounds.map((pair) => pair.slice());
    function decode(u) {
      const v = point(u, 2);
      const coords = v.map((value, j) => bounds[j][0] + value * (bounds[j][1] - bounds[j][0]));
      const [x, y] = coords;
      return { x, y, coords, cost: definition.objective(x, y) };
    }
    const optimumPoint = definition.minimum.map((value, j) =>
      (value - bounds[j][0]) / (bounds[j][1] - bounds[j][0]));
    return {
      id, name: definition.name, dimension: 2, bounds, labels: ["x₁", "x₂"],
      description: definition.description, formula: definition.formula,
      domainText: definition.domainText, optimumText: definition.optimumText,
      teachingNote: definition.teachingNote,
      costRange: [0, definition.maximumBound], totalDesigns: null, successTolerance: 1e-4,
      optimum: { value: 0, cost: 0, point: optimumPoint, decoded: decode(optimumPoint) },
      evaluate(u) { return decode(u).cost; }, decode,
      project(u) { return point(u, 2); },
      key(u) { return point(u, 2).join(","); }
    };
  }

  function normalizeConfig(config) {
    const c = Object.assign({
      np: 20, F: 0.8, CR: 0.9, seed: 36, budgetMode: "generations",
      generations: 50, budget: 1200
    }, config || {});
    integer(c.np, 4, "NP");
    assert(finite(c.F) && c.F >= 0 && c.F <= 2, "F debe estar entre 0 y 2.");
    assert(finite(c.CR) && c.CR >= 0 && c.CR <= 1, "CR debe estar entre 0 y 1.");
    integer(c.seed, 0, "La semilla");
    assert(c.seed <= 0xFFFFFFFF, "La semilla debe ser un entero de 32 bits sin signo.");
    assert(["generations", "evaluations"].includes(c.budgetMode), "Modo de presupuesto desconocido.");
    if (c.budgetMode === "generations") integer(c.generations, 0, "Las generaciones");
    else integer(c.budget, c.np, "El presupuesto");
    return c;
  }

  // Diversidad = raíz de la media de las varianzas por coordenada normalizada.
  // No depende de las unidades de P y E y no equivale al nº de celdas distintas.
  function diversity(population) {
    const n = population.length, d = population[0].length;
    const mean = Array(d).fill(0);
    population.forEach((p) => p.forEach((v, j) => { mean[j] += v / n; }));
    let sum = 0;
    population.forEach((p) => p.forEach((v, j) => { sum += (v - mean[j]) ** 2; }));
    return Math.sqrt(sum / (n * d));
  }

  function evaluate(run, u) {
    const value = run.problem.evaluate(u);
    assert(finite(value), "La función objetivo produjo un valor no finito.");
    run.evaluations += 1;
    run.uniqueVisited.add(run.problem.key ? run.problem.key(u) : u.join(","));
    return value;
  }

  function snapshot(run) {
    let bestIndex = 0;
    for (let i = 1; i < run.values.length; i++) {
      if (run.values[i] < run.values[bestIndex]) bestIndex = i;
    }
    run.best = run.values[bestIndex];
    run.bestPoint = run.population[bestIndex].slice();
    run.bestIndex = bestIndex;
    run.diversity = diversity(run.population);
    run.done = run.generation >= run.maxGenerations;
    run.trace.push({
      generation: run.generation, evaluations: run.evaluations,
      best: run.best, diversity: run.diversity, uniqueVisited: run.uniqueVisited.size,
      bestPoint: run.bestPoint.slice()
    });
  }

  function createRun(problem, config) {
    assert(problem && typeof problem.evaluate === "function" && problem.dimension >= 1,
      "Se requiere un problema con evaluate y dimension.");
    const c = normalizeConfig(config);
    const maxGenerations = c.budgetMode === "evaluations"
      ? Math.floor(c.budget / c.np) - 1 : c.generations;
    const rng = mulberry32(c.seed);
    const run = {
      problem, config: c, population: [], values: [], generation: 0, evaluations: 0,
      maxGenerations, effectiveBudget: c.np * (maxGenerations + 1),
      requestedBudget: c.budgetMode === "evaluations" ? c.budget : c.np * (maxGenerations + 1),
      uniqueVisited: new Set(), trace: [], lastTrial: null, lastTrials: [], done: false,
      _rng: rng
    };
    for (let i = 0; i < c.np; i++) {
      const u = Array.from({ length: problem.dimension }, () => rng());
      run.population.push(u);
      run.values.push(evaluate(run, u));
    }
    snapshot(run);
    return run;
  }

  function stepGeneration(run) {
    if (run.done) return run;
    const c = run.config, n = c.np, d = run.problem.dimension, rng = run._rng;
    // Estas referencias permanecen intactas hasta terminar TODOS los ensayos.
    const previous = run.population, previousValues = run.values;
    const next = [], nextValues = [], trials = [];
    for (let i = 0; i < n; i++) {
      const r = [];
      while (r.length < 3) {
        const candidate = Math.floor(rng() * n);
        if (candidate !== i && !r.includes(candidate)) r.push(candidate);
      }
      const donors = r.map((index) => previous[index].slice());
      const target = previous[i].slice();
      const mutantRaw = target.map((_, j) => donors[0][j] + c.F * (donors[1][j] - donors[2][j]));
      // Reparación mediante recorte ANTES de la cruza binomial.
      const mutant = mutantRaw.map(clamp01);
      const jrand = Math.floor(rng() * d);
      const crossRand = Array.from({ length: d }, () => rng());
      const crossMask = crossRand.map((v, j) => j === jrand || v <= c.CR);
      const trial = target.map((v, j) => crossMask[j] ? mutant[j] : v);
      const targetCost = previousValues[i], trialCost = evaluate(run, trial);
      const accepted = trialCost <= targetCost; // Los empates se aceptan.
      next.push(accepted ? trial.slice() : target.slice());
      nextValues.push(accepted ? trialCost : targetCost);
      trials.push({
        generation: run.generation + 1, i, r, donors: r.slice(), donorPoints: donors,
        target, mutantRaw, rawMutant: mutantRaw.slice(), mutant,
        clipped: mutantRaw.some((v) => v < 0 || v > 1),
        crossRand, crossMask, jrand, trial, targetCost, trialCost, accepted
      });
    }
    run.population = next;
    run.values = nextValues;
    run.generation += 1;
    run.lastTrials = trials;
    // El inspector presenta siempre al primer objetivo (i=0); lastTrials conserva todos.
    run.lastTrial = trials[0];
    snapshot(run);
    return run;
  }

  function runToEnd(run) {
    while (!run.done) stepGeneration(run);
    return run;
  }

  function summarize(run) {
    const optimum = run.problem.optimum;
    const gap = optimum ? Math.max(0, run.best - optimum.value) : null;
    return {
      config: Object.assign({}, run.config), seed: run.config.seed,
      best: run.best, bestPoint: run.bestPoint.slice(),
      decoded: run.problem.decode ? run.problem.decode(run.bestPoint) : run.bestPoint.slice(),
      optimum: optimum ? optimum.value : null, gap,
      success: gap !== null && gap <= (run.problem.successTolerance || 0),
      evaluations: run.evaluations, generations: run.generation, generation: run.generation,
      maxGenerations: run.maxGenerations, effectiveBudget: run.effectiveBudget,
      requestedBudget: run.requestedBudget, unusedBudget: run.requestedBudget - run.effectiveBudget,
      diversity: run.diversity, uniqueVisited: run.uniqueVisited.size, done: run.done
    };
  }

  function statistics(values) {
    const sorted = values.slice().sort((a, b) => a - b), n = values.length;
    const mean = values.reduce((s, v) => s + v, 0) / n;
    return {
      mean, median: n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2,
      min: sorted[0], max: sorted[n - 1],
      std: Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / n)
    };
  }

  /* Repeticiones emparejadas por semilla, sin ocultar el costo real.
   * options.seeds = array de uint32 (por defecto 1..20).
   * options.budget, si existe, aplica el mismo techo de evaluaciones a cada config.
   * results[k].runs contiene resúmenes; results[k].stats describe los costos.
   * Diferentes NP pueden dejar distinto sobrante al usar generaciones completas.
   */
  function repeatCompare(problem, configs, options) {
    assert(Array.isArray(configs) && configs.length >= 1, "Se requiere al menos una configuración.");
    const o = options || {};
    const seeds = o.seeds || Array.from({ length: 20 }, (_, i) => i + 1);
    assert(Array.isArray(seeds) && seeds.length > 0, "Se requiere al menos una semilla.");
    const results = configs.map((config, index) => {
      const runs = seeds.map((seed) => {
        const c = Object.assign({}, config, { seed });
        if (o.budget !== undefined) { c.budgetMode = "evaluations"; c.budget = o.budget; }
        return summarize(runToEnd(createRun(problem, c)));
      });
      const stats = statistics(runs.map((r) => r.best));
      const successes = runs.filter((r) => r.success).length;
      return Object.assign({
        index, config: Object.assign({}, config), runs, stats,
        successes, successRate: successes / runs.length,
        meanGap: runs[0].gap === null ? null : runs.reduce((s, r) => s + r.gap, 0) / runs.length,
        evaluations: runs[0].evaluations, generations: runs[0].generations
      }, stats);
    });
    const wins = configs.map(() => 0);
    let ties = 0;
    const pairs = seeds.map((seed, i) => {
      const bests = results.map((r) => r.runs[i].best);
      const best = Math.min(...bests);
      const winners = bests.map((v, j) => Math.abs(v - best) <= 1e-8 ? j : -1).filter((j) => j >= 0);
      if (winners.length === 1) wins[winners[0]] += 1;
      else ties += 1;
      return { seed, bests, gaps: results.map((r) => r.runs[i].gap), winners };
    });
    return { seeds: seeds.slice(), budget: o.budget === undefined ? null : o.budget, results, pairs, wins, ties };
  }

  return {
    createSolarProblem, createTerrainProblem, createBenchmarkProblem, createRun, stepGeneration, runToEnd, summarize,
    repeatCompare, mulberry32, diversity
  };
});
