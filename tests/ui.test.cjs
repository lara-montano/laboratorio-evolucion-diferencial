"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// This harness exercises application event handlers, not browser rendering.
// Canvas can be omitted or instrumented at a fixed size. Numeric drawing
// assertions cannot establish visual layout correctness; visual QA is separate.
const src = path.join(__dirname, "../src");
const read = name => fs.readFileSync(path.join(src, name), "utf8");
const strip = html => String(html).replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");

function createLab(storage = new Map(), options = {}) {
  const elements = new Map(), downloads = [], objectURLs = new Map(), timers = new Map();
  const drawing = { calls: [], errors: [], totalCalls: 0 };
  let nextTimer = 1, nextURL = 1;
  const attributes = text => Object.fromEntries([...text.matchAll(/([\w-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)]
    .map(m => [m[1], m[2] ?? m[3] ?? m[4] ?? ""]));
  class Element {
    constructor(tag = "div", attrs = {}) {
      this.tagName = tag.toUpperCase(); this.attrs = { ...attrs }; this.id = attrs.id || "";
      this.value = attrs.value || ""; this._text = ""; this._html = "";
      this.hidden = "hidden" in attrs; this.disabled = "disabled" in attrs; this.checked = "checked" in attrs;
      this.dataset = Object.fromEntries(Object.entries(attrs).filter(([k]) => k.startsWith("data-")).map(([k, v]) => [k.slice(5), v]));
      this.listeners = new Map(); this.style = {}; this.labels = []; this.children = []; this.options = [];
      this.classes = new Set((attrs.class || "").split(/\s+/).filter(Boolean));
      this.classList = {
        add: (...names) => names.forEach(n => this.classes.add(n)),
        remove: (...names) => names.forEach(n => this.classes.delete(n)),
        contains: name => this.classes.has(name),
        toggle: (name, force) => { const on = force === undefined ? !this.classes.has(name) : !!force; on ? this.classes.add(name) : this.classes.delete(name); return on; }
      };
    }
    set value(value) { this._value = String(value); }
    get value() { return this._value; }
    set innerHTML(value) { this._html = String(value); this._text = strip(value); }
    get innerHTML() { return this._html; }
    set textContent(value) { this._text = String(value); this._html = String(value); }
    get textContent() { return this._text; }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    getAttribute(name) { return this.attrs[name] ?? null; }
    removeAttribute(name) { delete this.attrs[name]; }
    addEventListener(name, fn) { if (!this.listeners.has(name)) this.listeners.set(name, []); this.listeners.get(name).push(fn); }
    async emit(type, props = {}) {
      if (type === "click" && this.disabled) return;
      const event = { type, target: this, currentTarget: this, preventDefault() {}, ...props };
      await Promise.all((this.listeners.get(type) || []).map(fn => fn(event)));
    }
    click() {
      if (this.tagName === "A" && this.download) {
        if (options.downloadFailure === "click") throw new Error("Synthetic browser download restriction");
        downloads.push({ name: this.download, blob: objectURLs.get(this.href) });
        return;
      }
      return this.emit("click");
    }
    appendChild(child) { this.children.push(child); child.parent = this; return child; }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); }
    focus() { document.activeElement = this; }
    select() { this.selected = true; }
    setSelectionRange(start, end) { this.selectionStart = start; this.selectionEnd = end; }
    scrollIntoView() {}
    getBoundingClientRect() {
      const [width, height] = this.tagName === "CANVAS" ? options.canvasSize || [0, 0] : [0, 0];
      return { width, height, top: 0, left: 0, right: width, bottom: height };
    }
    getContext() {
      if (this.context) return this.context;
      const canvas = this.id || "offscreen";
      const check = (value, method) => {
        if (Array.isArray(value)) return value.forEach(v => check(v, method));
        if ((typeof value === "number" && !Number.isFinite(value)) || (typeof value === "string" && /NaN|Infinity/.test(value))) {
          drawing.errors.push({ canvas, method, value });
        }
      };
      this.context = new Proxy({}, {
        get(target, method) {
          if (method in target) return target[method];
          return (...args) => {
            drawing.totalCalls++;
            args.forEach(value => check(value, method));
            if (canvas !== "offscreen") drawing.calls.push({ canvas, method, args });
            if (method === "measureText") return { width: String(args[0]).length * 6 };
          };
        },
        set(target, key, value) { check(value, key); target[key] = value; return true; }
      });
      return this.context;
    }
    querySelector(selector) {
      if (selector === "tbody") { if (!this.tbody) this.tbody = new Element("tbody"); return this.tbody; }
      return document.querySelector(selector);
    }
    querySelectorAll(selector) { return document.querySelectorAll(selector); }
  }
  const html = read("page.html");
  for (const m of html.matchAll(/<([\w-]+)\b([^>]*\bid="[^"]+"[^>]*)>/g)) {
    const attrs = attributes(m[2]), element = new Element(m[1], attrs);
    const end = html.indexOf(`</${m[1]}>`, m.index + m[0].length);
    if (end >= 0 && !["input", "meta", "br"].includes(m[1])) element.innerHTML = html.slice(m.index + m[0].length, end);
    if (m[1] === "select") {
      element.options = [...element.innerHTML.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/g)].map(opt => ({ ...attributes(opt[1]), textContent: strip(opt[2]) }));
      element.value = (element.options.find(opt => "selected" in opt) || element.options[0] || {}).value || "";
    }
    elements.set(element.id, element);
  }
  for (const m of html.matchAll(/<label\b[^>]*for="([^"]+)"[^>]*>([\s\S]*?)<\/label>/g)) {
    if (elements.has(m[1])) elements.get(m[1]).labels.push({ textContent: strip(m[2]) });
  }
  // The tabs container and preset buttons have no IDs in the source template.
  const tabs = new Element("nav", { class: "tabs" });
  const presets = [...html.matchAll(/<button\b([^>]*\bdata-preset="[^"]+"[^>]*)>([\s\S]*?)<\/button>/g)]
    .map(m => { const e = new Element("button", attributes(m[1])); e.innerHTML = m[2]; return e; });
  const body = new Element("body");
  const document = {
    body, hidden: false, activeElement: null,
    getElementById: id => elements.get(id) || null,
    createElement: tag => new Element(tag),
    addEventListener() {},
    querySelector: selector => selector === ".tabs" ? tabs : selector.startsWith("#") ? elements.get(selector.slice(1)) : null,
    querySelectorAll: selector => selector === "[data-tab]" ? [...elements.values()].filter(e => e.dataset.tab) : selector === "[data-preset]" ? presets : [],
    execCommand: () => true
  };
  class BlobMock {
    constructor(parts, options = {}) { this.content = parts.map(p => p instanceof BlobMock ? p.content : String(p)).join(""); this.type = options.type || ""; }
    async text() { return this.content; }
    get size() { return Buffer.byteLength(this.content); }
  }
  const context = {
    document, console, Blob: BlobMock,
    URL: { createObjectURL: blob => { if (options.downloadFailure === "url") throw new Error("Synthetic Blob URL restriction"); const url = `blob:ui-test/${nextURL++}`; objectURLs.set(url, blob); return url; }, revokeObjectURL: url => objectURLs.delete(url) },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
    setTimeout: (fn, delay = 0) => { const id = nextTimer++; timers.set(id, { fn, delay }); if (delay === 0) queueMicrotask(() => { if (timers.delete(id)) fn(); }); return id; },
    clearTimeout: id => timers.delete(id), requestAnimationFrame: fn => { fn(); return 0; }, cancelAnimationFrame() {},
    addEventListener() {}, devicePixelRatio: 1, location: { protocol: "file:", href: "file:///laboratorio_evolucion_diferencial.html" },
    navigator: { clipboard: { writeText: async () => {} } }, matchMedia: () => ({ matches: false, addEventListener() {} })
  };
  context.window = context;
  elements.get("solar-data").textContent = read("solar-data.json");
  vm.createContext(context);
  vm.runInContext(read("engine.js"), context, { filename: "engine.js" });
  vm.runInContext(read("app.js"), context, { filename: "app.js" });
  const el = id => { assert.ok(elements.has(id), `Missing DOM element: ${id}`); return elements.get(id); };
  return {
    el, storage, downloads, timers, drawing,
    async input(id, value) { el(id).value = value; await el(id).emit("input"); },
    async change(id, value) { el(id).value = value; await el(id).emit("change"); },
    async click(id) { await el(id).click(); },
    async lastDownload() { const d = downloads.at(-1); assert.ok(d?.blob, "Expected a downloadable Blob"); return { name: d.name, type: d.blob.type, text: await d.blob.text() }; },
    async fireTimers(delay) { const pending = [...timers].filter(([, t]) => t.delay === delay); for (const [id, t] of pending) if (timers.delete(id)) await t.fn(); }
  };
}

test("UI: el presupuesto que solo cubre NP no deja una animación fantasma", async () => {
  const lab = createLab();
  await lab.change("stop-mode", "evaluations");
  await lab.input("budget", 60);
  await lab.input("np", 60);
  assert.match(lab.el("generation-label").textContent, /0\s*\/\s*0/);
  await lab.click("play");
  await lab.fireTimers(280);
  assert.notEqual(lab.el("play").textContent, "Pausar");
  assert.doesNotMatch(lab.el("run-status").textContent, /avanza una generación/);
  assert.equal(lab.el("step").disabled, true);
});

test("UI: completar y reiniciar restaura el botón Iniciar y la generación cero", async () => {
  const lab = createLab();
  await lab.click("finish");
  assert.equal(lab.el("step").disabled, true);
  await lab.click("restart");
  assert.equal(lab.el("play").textContent, "Iniciar");
  assert.equal(lab.el("step").disabled, false);
  assert.match(lab.el("generation-label").textContent, /0\s*\/\s*20/);
});

test("UI: una configuración inválida bloquea la corrida y puede recuperarse", async () => {
  const lab = createLab();
  await lab.input("seed", "");
  assert.equal(lab.el("play").disabled, true);
  assert.equal(lab.el("seed").getAttribute("aria-invalid"), "true");
  assert.equal(lab.el("run-metrics").innerHTML, "");
  await lab.input("seed", 17);
  assert.equal(lab.el("play").disabled, false);
  assert.equal(lab.el("seed").getAttribute("aria-invalid"), null);
  assert.match(lab.el("run-metrics").textContent, /Evaluaciones/);
  await lab.click("step");
  assert.match(lab.el("generation-label").textContent, /1\s*\/\s*20/);
});

test("UI: las notas se conservan por caso, incluso después de recargar", async () => {
  const lab = createLab();
  const cases = lab.el("problem").options.map(o => o.value);
  assert.ok(cases.includes("solar") && cases.includes("terrain"));
  for (const id of cases) {
    await lab.change("problem", id);
    assert.equal(lab.el("hypothesis").value, "", `A new ${id} notebook should be empty`);
    await lab.input("hypothesis", `Predicción exclusiva de ${id}`);
    await lab.input("evidence", `Evidencia exclusiva de ${id}`);
  }
  for (const id of cases) {
    await lab.change("problem", id);
    assert.equal(lab.el("hypothesis").value, `Predicción exclusiva de ${id}`);
    assert.equal(lab.el("evidence").value, `Evidencia exclusiva de ${id}`);
    await lab.click("download-notes");
    const d = await lab.lastDownload();
    assert.match(d.text, new RegExp(`Predicción exclusiva de ${id}`));
    for (const other of cases.filter(k => k !== id)) assert.ok(!d.text.includes(`exclusiva de ${other}`));
  }
  const restored = createLab(lab.storage);
  for (const id of cases) {
    await restored.change("problem", id);
    assert.equal(restored.el("evidence").value, `Evidencia exclusiva de ${id}`);
  }
});

test("UI: llevar una corrida a A conserva parámetros, semilla y presupuesto", async () => {
  const lab = createLab();
  await lab.input("np", 12);
  await lab.input("factor", 0.35);
  await lab.input("cr", 0.2);
  await lab.input("generations", 9);
  await lab.input("seed", 27);
  await lab.click("use-in-compare");
  assert.deepEqual(["a-np", "a-f", "a-cr", "compare-seed", "compare-budget"].map(id => Number(lab.el(id).value)), [12, 0.35, 0.2, 27, 120]);
  assert.equal(lab.el("panel-compare").hidden, false);
});

test("UI: una y varias semillas producen tablas y CSV coherentes", async () => {
  const lab = createLab();
  await lab.click("tab-compare");
  await lab.input("compare-seed", 17);
  await lab.click("compare-one");
  assert.equal(lab.el("compare-results").hidden, false);
  assert.equal(lab.el("export-csv").disabled, false);
  assert.match(lab.el("results-table").querySelector("tbody").textContent, /Evaluaciones por corrida/);
  await lab.click("export-csv");
  let d = await lab.lastDownload();
  assert.match(d.name, /\.csv$/);
  assert.match(d.type, /^text\/csv/);
  const parse = text => { const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/).map(line => line.split(",")); const header = lines.shift(); return lines.map(row => Object.fromEntries(header.map((key, i) => [key, row[i]]))); };
  let rows = parse(d.text);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(r => [r.semilla, r.configuracion]), [["17", "A"], ["17", "B"]]);
  await lab.input("repetitions", 3);
  assert.equal(lab.el("compare-results").hidden, true);
  assert.equal(lab.el("export-csv").disabled, true);
  await lab.click("compare-many");
  await lab.click("export-csv");
  d = await lab.lastDownload(); rows = parse(d.text);
  assert.equal(rows.length, 6);
  assert.deepEqual(rows.map(r => r.semilla), ["17", "17", "18", "18", "19", "19"]);
  for (const row of rows) {
    assert.ok(Number.isFinite(Number(row.mejor_valor)));
    assert.equal(Number(row.evaluaciones), Number(row.NP) * (Number(row.generaciones) + 1));
    assert.ok(Number(row.evaluaciones) <= Number(row.limite_evaluaciones));
    assert.equal(row.caso, "solar");
  }
  assert.equal(lab.el("compare-one").disabled, false);
  assert.equal(lab.el("compare-many").disabled, false);
});

test("UI: una comparación inválida no exporta resultados anteriores", async () => {
  const lab = createLab();
  await lab.click("compare-one");
  assert.equal(lab.el("export-csv").disabled, false);
  await lab.input("a-np", 3);
  await lab.click("compare-one");
  assert.equal(lab.el("export-csv").disabled, true);
  assert.equal(lab.el("compare-results").hidden, true);
  assert.match(lab.el("compare-status").textContent, /4/);
  await lab.input("a-np", 20);
  await lab.click("compare-one");
  assert.equal(lab.el("compare-results").hidden, false);
});

for (const canvasSize of [[600, 300], [320, 240]]) {
  test(`Canvas numérico: los seis casos y ambas comparaciones dibujan coordenadas finitas a ${canvasSize.join("×")}`, async () => {
    const lab = createLab(new Map(), { canvasSize });
    const cases = lab.el("problem").options.map(o => o.value);
    assert.deepEqual(cases, ["solar", "terrain", "sphere", "rosenbrock", "rastrigin", "ackley"]);
    for (const id of cases) {
      const before = lab.drawing.calls.length;
      await lab.change("problem", id);
      await lab.click("tab-explore");
      assert.equal(lab.el("run-status").classList.contains("error"), false, `Initialization of ${id}`);
      await lab.click("step");
      await lab.click("finish");
      lab.el("compressed").checked = false;
      await lab.el("compressed").emit("change");
      lab.el("compressed").checked = true;
      await lab.el("compressed").emit("change");
      assert.doesNotMatch(lab.el("convergence-caption").textContent, /%/);
      const gapMetric = lab.el("run-metrics").innerHTML.match(/Brecha absoluta([\s\S]*?)<\/div>/);
      assert.ok(gapMetric, `${id} must show the absolute gap`);
      assert.doesNotMatch(gapMetric[0], /%/);
      await lab.click("tab-compare");
      await lab.click("compare-one");
      assert.equal(lab.el("compare-results").hidden, false, `One seed for ${id}`);
      await lab.input("repetitions", 2);
      await lab.click("compare-many");
      assert.equal(lab.el("compare-results").hidden, false, `Multiple seeds for ${id}`);
      const calls = lab.drawing.calls.slice(before);
      assert.ok(calls.some(c => c.canvas === "landscape" && c.method === "arc"), `Population points drawn for ${id}`);
      for (const canvas of ["convergence", "comparison-curve", "paired-chart"]) {
        const labels = calls.filter(c => c.canvas === canvas && c.method === "fillText").map(c => String(c.args[0]));
        assert.ok(labels.some(text => text.startsWith("Brecha absoluta")), `${canvas} axis title for ${id}`);
        assert.ok(labels.every(text => !text.includes("%")), `${canvas} must not label absolute gaps as percentages`);
      }
      assert.deepEqual(lab.drawing.errors, [], `Non-finite draw operation in ${id}`);
    }
    assert.ok(lab.drawing.totalCalls > 1000, "The harness must actually execute heatmap and chart drawing");
  });
}

for (const downloadFailure of ["url", "click"]) {
  test(`UI: el CSV completo sigue disponible si falla la descarga (${downloadFailure})`, async () => {
    const lab = createLab(new Map(), { downloadFailure });
    await lab.click("compare-one");
    await lab.click("export-csv");
    assert.equal(lab.downloads.length, 0);
    assert.equal(lab.el("export-preview").hidden, false);
    assert.match(lab.el("export-title").textContent, /\.csv$/);
    const text = lab.el("export-content").value.replace(/^\uFEFF/, "");
    assert.match(text, /^caso,semilla,configuracion,NP,F,CR,/);
    assert.equal(text.trim().split(/\r?\n/).length, 3);
    assert.match(text, /solar,0,A,/);
    assert.match(text, /solar,0,B,/);
    assert.match(lab.el("export-explanation").textContent, /contenido completo/);
    await lab.click("export-select");
    assert.equal(lab.el("export-content").selected, true);
    await lab.click("close-export");
    assert.equal(lab.el("export-preview").hidden, true);
  });
}

test("UI: las notas heredadas se conservan sin adjudicarles un caso", async () => {
  const old = JSON.stringify({ hypothesis: "Predicción heredada sin procedencia", evidence: "Evidencia heredada", conclusion: "Conclusión heredada" });
  const storage = new Map([["de-lab-sesion36-notes", old]]);
  const lab = createLab(storage);
  assert.equal(lab.el("legacy-notes").hidden, false);
  assert.match(lab.el("legacy-content").textContent, /Predicción heredada sin procedencia/);
  assert.match(lab.el("legacy-content").textContent, /Evidencia heredada/);
  for (const { value: id } of lab.el("problem").options) {
    await lab.change("problem", id);
    for (const field of ["hypothesis", "evidence", "conclusion"]) assert.equal(lab.el(field).value, "", `${field} of ${id} cannot inherit unattributed notes`);
    await lab.click("download-notes");
    assert.doesNotMatch((await lab.lastDownload()).text, /heredad[ao]/);
  }
  assert.equal(storage.get("de-lab-sesion36-notes"), old, "The legacy record must remain recoverable");
  const reloaded = createLab(storage);
  assert.equal(reloaded.el("legacy-notes").hidden, false);
  assert.match(reloaded.el("legacy-content").textContent, /Conclusión heredada/);
});

test("UI: un presupuesto inferior a NP bloquea ambas comparaciones sin generaciones negativas", async () => {
  const lab = createLab();
  await lab.input("a-np", 4);
  await lab.input("b-np", 40);
  await lab.input("compare-budget", 20);
  assert.equal(lab.el("compare-one").disabled, true);
  assert.equal(lab.el("compare-many").disabled, true);
  assert.equal(lab.el("export-csv").disabled, true);
  for (const id of ["a-budget-note", "b-budget-note"]) assert.doesNotMatch(lab.el(id).textContent, /-\d+\s+generaciones/);
  assert.match(lab.el("compare-status").textContent, /al menos NP/);
  await lab.click("compare-one");
  assert.equal(lab.el("compare-results").hidden, true);
  await lab.input("compare-budget", 40);
  assert.equal(lab.el("compare-one").disabled, false);
  assert.match(lab.el("b-budget-note").textContent, /0 generaciones completas/);
  assert.match(lab.el("b-budget-note").textContent, /Solo población inicial/);
  await lab.click("compare-one");
  assert.equal(lab.el("compare-results").hidden, false);
});

test("UI: el aviso identifica los cambios simultáneos de parámetros", async () => {
  const lab = createLab();
  assert.match(lab.el("comparison-design-note").textContent, /Solo cambia F/);
  await lab.input("a-np", 25);
  await lab.input("a-cr", 0.3);
  assert.equal(lab.el("comparison-design-note").classList.contains("comparison-warning"), true);
  assert.match(lab.el("comparison-design-note").textContent, /NP, F, CR/);
  assert.match(lab.el("comparison-design-note").textContent, /No podrás atribuir/);
  await lab.input("a-np", 20);
  await lab.input("a-cr", 0.7);
  assert.equal(lab.el("comparison-design-note").classList.contains("comparison-warning"), false);
  assert.match(lab.el("comparison-design-note").textContent, /Solo cambia F/);
  await lab.input("a-f", 0.9);
  assert.match(lab.el("comparison-design-note").textContent, /A y B son idénticas/);
});

test("UI: el mínimo de cuatro evaluaciones permite población inicial sin generaciones", async () => {
  const lab = createLab(new Map(), { canvasSize: [320, 240] });
  await lab.input("np", 4);
  await lab.change("stop-mode", "evaluations");
  await lab.input("budget", 4);
  assert.match(lab.el("generation-label").textContent, /0\s*\/\s*0/);
  assert.match(lab.el("budget-note").textContent, /4 evaluaciones = 4 iniciales/);
  for (const id of ["play", "step", "finish"]) assert.equal(lab.el(id).disabled, true);
  await lab.input("a-np", 4);
  await lab.input("b-np", 4);
  await lab.input("compare-budget", 4);
  assert.equal(lab.el("compare-one").disabled, false);
  await lab.click("compare-one");
  assert.equal(lab.el("compare-results").hidden, false);
  await lab.click("export-csv");
  const lines = (await lab.lastDownload()).text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  const header = lines.shift().split(",");
  for (const line of lines) {
    const cells = line.split(","), row = Object.fromEntries(header.map((key, i) => [key, cells[i]]));
    assert.equal(row.evaluaciones, "4");
    assert.equal(row.generaciones, "0");
  }
  assert.deepEqual(lab.drawing.errors, []);
});
