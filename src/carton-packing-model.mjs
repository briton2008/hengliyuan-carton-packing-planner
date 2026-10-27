import { pack3D, RotationType } from "binpackingjs/3d";
import { pack2D } from "binpackingjs/2d";
export const rotationLabels = { fixed: "Fixed orientation", upright: "Keep upright; rotate base", any: "Allow all six orientations" };
export const layerLabels = { floor: "One layer / floor only", stack: "Geometric stacking; support needs review" };
export const packingNumber = v => v > 0 && v < .0001 ? v.toExponential(3) : new Intl.NumberFormat("en", { maximumFractionDigits: 4 }).format(v);
const has = v => v !== undefined && v !== null && String(v).trim() !== "";
const text = v => typeof v === "string" ? v.trim().slice(0, 1500) : "";
const rotations = { fixed: [RotationType.WHD], upright: [RotationType.WHD, RotationType.DHW], any: [0, 1, 2, 3, 4, 5] };
const permutation = ([l, h, w], r) => [[l, h, w], [h, l, w], [h, w, l], [w, h, l], [w, l, h], [l, w, h]][r];
export const newPackingItem = () => ({ name: "", length: "", width: "", height: "", mass: "", rotation: "", quantity: "" });
export const newPackingData = () => ({ mode: "grid", layers: "", project: "", notes: "", order: "", carton: { length: "", width: "", height: "", tare: "", limit: "", outerLength: "", outerWidth: "", outerHeight: "" }, items: [newPackingItem()] });

export function calculatePacking(data = {}) {
  const errors = [];
  const fail = (field, message) => { errors.push({ field, message }); return null; };
  function number(value, field, label, scale, optional = false, zero = false) {
    if (!has(value)) return optional ? null : fail(field, `Enter ${label}.`);
    const v = typeof value === "number" || typeof value === "string" ? Number(value) : NaN, scaled = Math.round(v * scale);
    if (!Number.isFinite(v) || v < 0 || (!zero && scaled === 0) || !Number.isSafeInteger(scaled) || Math.abs(v * scale - scaled) > .000001 || scaled > 10000000000) return fail(field, `Use a ${zero ? "non-negative" : "positive"} number with at most ${scale === 100 ? "two decimal places (mm)" : "four decimal places (kg)"} for ${label}.`);
    return scaled;
  }
  function count(value, field, label, optional = false) {
    if (!has(value)) return optional ? null : fail(field, `Enter ${label}.`);
    const n = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
    return Number.isSafeInteger(n) && n > 0 ? n : fail(field, `Use a positive whole number for ${label}.`);
  }
  if (!["grid", "mixed"].includes(data.mode)) fail("mode", "Choose a planning mode.");
  if (!layerLabels[data.layers]) fail("layers", "Choose the stacking rule for this trial.");
  const c = data.carton || {};
  const bin = ["length", "height", "width"].map(k => number(c[k], `carton.${k}`, `usable carton ${k}`, 100));
  const tare = number(c.tare, "carton.tare", "carton and packing-material tare", 10000, true, true);
  const limit = number(c.limit, "carton.limit", "maximum carton gross mass", 10000, true);
  if (limit !== null && tare === null && !errors.some(e => e.field === "carton.tare")) fail("carton.tare", "Enter the carton and packing-material tare to check the gross limit.");
  if (limit !== null && tare !== null && limit < tare) fail("carton.limit", "The gross limit is below the entered tare.");
  const outerKeys = ["outerLength", "outerHeight", "outerWidth"], outerEntered = outerKeys.some(k => has(c[k]));
  const outer = outerKeys.map(k => number(c[k], `carton.${k}`, k.replace("outer", "outside carton ").toLowerCase(), 100, !outerEntered));
  if (outerEntered) outer.forEach((n, i) => { if (n !== null && bin[i] !== null && n < bin[i]) fail(`carton.${outerKeys[i]}`, "Outside dimensions must not be smaller than the corresponding usable inside dimensions."); });
  const rawItems = Array.isArray(data.items) ? data.items : [];
  if (!rawItems.length || rawItems.length > 6) fail("items", "Use one to six SKU rows.");
  const items = (data.mode === "grid" ? rawItems.slice(0, 1) : rawItems).map((r, i) => {
    const prefix = `items.${i}.`, d = ["length", "height", "width"].map(k => number(r?.[k], prefix + k, `SKU ${i + 1} outside ${k}`, 100));
    const mass = number(r?.mass, prefix + "mass", `SKU ${i + 1} packaged unit gross mass`, 10000, limit === null);
    if (!rotationLabels[r?.rotation]) fail(prefix + "rotation", "Choose the allowed orientation for this SKU.");
    return { index: i, name: text(r?.name) || `SKU ${i + 1}`, d, mass, rotation: r?.rotation, quantity: data.mode === "mixed" ? count(r?.quantity, prefix + "quantity", `SKU ${i + 1} trial quantity`) : null };
  });
  const order = data.mode === "grid" ? count(data.order, "order", "order quantity", true) : null;
  if (data.mode === "mixed" && items.reduce((s, r) => s + (r.quantity || 0), 0) > 120) fail("items", "A mixed trial accepts at most 120 units per run. Use grid mode for large single-SKU orders.");
  if (errors.length) return { errors, result: null };
  const payload = limit === null ? Infinity : limit - tare;
  let placements = [], packed, requested, grid = null;
  if (data.mode === "grid") {
    const item = items[0]; let best = null;
    for (const r of rotations[item.rotation]) {
      const d = permutation(item.d, r), cells = bin.map((n, i) => Math.floor(n / d[i]));
      if (data.layers === "floor") cells[1] = Math.min(cells[1], 1);
      const geometry = cells.reduce((s, n) => s * n, 1);
      if (!Number.isSafeInteger(geometry)) return { errors: [{ field: "items", message: "These dimensions imply too many grid units to represent safely. Check the units and measurements." }], result: null };
      const capacity = Math.min(geometry, limit === null ? geometry : Math.floor(payload / item.mass));
      if (!best || capacity > best.capacity || capacity === best.capacity && geometry > best.geometry) best = { capacity, geometry, cells, d, rotation: r };
    }
    grid = best; packed = best.capacity; requested = null;
    for (let i = 0; i < Math.min(packed, 240); i++) placements.push({ sku: 0, position: [(i % best.cells[0]) * best.d[0], Math.floor(i / (best.cells[0] * best.cells[2])) * best.d[1], (Math.floor(i / best.cells[0]) % best.cells[2]) * best.d[2]], dimension: best.d });
  } else {
    requested = items.reduce((s, r) => s + r.quantity, 0);
    if (payload > 0 && data.layers === "floor") {
      const boxes = items.flatMap(r => {
        const choices = rotations[r.rotation].map(rotation => permutation(r.d, rotation)).filter(d => d[1] <= bin[1] && d[0] <= bin[0] && d[2] <= bin[2]);
        choices.sort((a,b) => Math.floor(bin[0]/b[0])*Math.floor(bin[2]/b[2])-Math.floor(bin[0]/a[0])*Math.floor(bin[2]/a[2]));
        if (!choices.length) return [];
        const d = choices[0];
        return Array.from({ length: r.quantity }, () => ({ width: d[0], height: d[2], constrainRotation: r.rotation === "fixed", sku: r.index, physicalHeight: d[1], mass: r.mass ?? 0 }));
      });
      const floor = pack2D({ bins: [{ width: bin[0], height: bin[2] }], boxes, factor: 1 });
      let usedWeight = 0;
      for (const box of floor.packedBins[0].boxes) {
        if (usedWeight + box.sourceBox.mass > payload) continue;
        usedWeight += box.sourceBox.mass;
        placements.push({ sku: box.sourceBox.sku, position: [box.x, 0, box.y], dimension: [box.width, box.sourceBox.physicalHeight, box.height] });
      }
    } else if (payload > 0) {
      const expanded = items.flatMap(r => Array.from({ length: r.quantity }, (_, j) => ({ name: `${r.index}:${j}`, width: r.d[0], height: r.d[1], depth: r.d[2], weight: r.mass ?? 0, allowedRotations: rotations[r.rotation] })));
      const trial = pack3D({ bins: [{ name: "Carton", width: bin[0], height: bin[1], depth: bin[2], maxWeight: payload }], items: expanded, factor: 1 });
      placements = trial.packedBins[0].items.map(p => ({ sku: Number(p.name.split(":")[0]), position: [...p.position], dimension: [...p.dimension] }));
    }
    packed = placements.length;
    // Validate the imported heuristic at the adapter boundary before showing a plan.
    for (let i = 0; i < placements.length; i++) {
      const a = placements[i];
      if (a.position.some((p, axis) => !Number.isSafeInteger(p) || p < 0 || p + a.dimension[axis] > bin[axis])) throw new Error("Packing engine returned an out-of-bounds placement");
      for (const b of placements.slice(0, i)) if (a.position.every((p, axis) => p < b.position[axis] + b.dimension[axis] && b.position[axis] < p + a.dimension[axis])) throw new Error("Packing engine returned overlapping placements");
    }
  }
  const counts = items.map(r => data.mode === "grid" ? packed : placements.filter(p => p.sku === r.index).length);
  const unitMass = counts.some((n, i) => n > 0 && items[i].mass === null) ? null : counts.reduce((s, n, i) => s + n * (items[i].mass ?? 0), 0);
  if (limit !== null && unitMass > payload) throw new Error("Packing engine exceeded the entered payload limit");
  const volume = counts.reduce((s, n, i) => s + n * items[i].d.reduce((v, d) => v * d, 1), 0);
  const cartonVolume = bin.reduce((v, d) => v * d, 1), outerCbm = outerEntered ? outer.reduce((v, d) => v * (d / 100), 1) / 1e9 : null;
  const cartons = order !== null && packed > 0 ? Math.ceil(order / packed) : null;
  const finalCount = cartons === null ? null : order % packed || packed;
  const knownGross = n => items[0].mass !== null && tare !== null ? (n * items[0].mass + tare) / 10000 : null;
  return { errors: [], result: { mode: data.mode, layers: data.layers, project: text(data.project), notes: text(data.notes), bin: bin.map(d => d / 100), items: items.map((r, i) => ({ ...r, d: r.d.map(d => d / 100), mass: r.mass === null ? null : r.mass / 10000, packed: counts[i], remaining: r.quantity === null ? null : r.quantity - counts[i] })), packed, requested, remaining: requested === null ? null : requested - packed,
    placements: placements.map(p => ({ sku: p.sku, position: p.position.map(v => v / 100), dimension: p.dimension.map(v => v / 100) })), visualTruncated: packed > placements.length, grid: grid && { ...grid, d: grid.d.map(d => d / 100) }, utilization: volume / cartonVolume * 100,
    unitMass: unitMass === null ? null : unitMass / 10000, gross: unitMass !== null && tare !== null ? (unitMass + tare) / 10000 : null, tare: tare === null ? null : tare / 10000, limit: limit === null ? null : limit / 10000, outer: outerEntered ? outer.map(d => d / 100) : null, outerCbm,
    order, cartons, finalCount, finalGross: finalCount === null ? null : knownGross(finalCount), shipmentCbm: cartons !== null && outerCbm !== null ? cartons * outerCbm : null,
    aboveFloor: data.mode === "grid" ? Math.max(0, packed - grid.cells[0] * grid.cells[2]) : placements.filter(p => p.position[1] > 0).length } };
}

export function packingReport(r) {
  const n = packingNumber, kg = v => v === null ? "To confirm" : `${n(v)} kg`;
  const lines = ["HENGLIYUAN — CARTON PLANNING WORKSHEET", "Customer-entered preliminary geometry. Not an approved packing instruction or freight quotation.", "", `Project: ${r.project || "Not named"}`, `Mode: ${r.mode === "grid" ? "Single-SKU regular grid" : "One-carton mixed heuristic trial"}`, `Layer rule: ${layerLabels[r.layers]}`, `Usable inside L × W × H: ${n(r.bin[0])} × ${n(r.bin[2])} × ${n(r.bin[1])} mm`, `Outside L × W × H: ${r.outer ? [r.outer[0], r.outer[2], r.outer[1]].map(n).join(" × ") + " mm" : "To confirm"}`, `Carton + packing-material tare: ${kg(r.tare)}`, `Maximum carton gross mass: ${kg(r.limit)}`, `Weight check: ${r.limit === null ? "GEOMETRY ONLY — no gross limit checked" : "Checked against entered unit masses, tare and gross limit"}`, "", "UNITS / RETAIL PACKS"];
  for (const item of r.items) lines.push(`${item.name}: outside L × W × H ${[item.d[0], item.d[2], item.d[1]].map(n).join(" × ")} mm; packaged unit gross ${kg(item.mass)}; ${rotationLabels[item.rotation]}`, `In this carton: ${n(item.packed)}${item.remaining === null ? "" : `; requested in trial: ${n(item.quantity)}; not included: ${n(item.remaining)}`}`);
  lines.push("", `Planned units in carton: ${n(r.packed)}`, `Bounding-box space used: ${n(r.utilization)}%`, `Packed units mass: ${kg(r.unitMass)}`, `Planned carton gross: ${kg(r.gross)}`, `Above-floor units: ${n(r.aboveFloor)}; load-bearing support not validated.`);
  if (r.grid) lines.push(`Uniform grid L × W × H cells: ${[r.grid.cells[0], r.grid.cells[2], r.grid.cells[1]].map(n).join(" × ")}; selected unit orientation L × W × H: ${[r.grid.d[0], r.grid.d[2], r.grid.d[1]].map(n).join(" × ")} mm. Weight limits can leave cells empty.`, "", "ORDER PROJECTION", `Order units: ${r.order === null ? "To confirm" : n(r.order)}`, `Estimated cartons: ${r.cartons === null ? "To confirm" : n(r.cartons)}`, `Final carton units: ${r.finalCount === null ? "To confirm" : n(r.finalCount)}`, `Final carton gross: ${kg(r.finalGross)}`, `Estimated shipment outside volume: ${r.shipmentCbm === null ? "To confirm" : n(r.shipmentCbm) + " m³"}`);
  else {
    lines.push("No order-level carton count is extrapolated from this mixed trial. Unplaced units may fit in another arrangement; this is not an optimality result.", "", "MIXED TRIAL LAYERS");
    for (const height of [...new Set(r.placements.map(p => p.position[1]))].sort((a,b) => a-b)) lines.push(`Bottom at ${n(height)} mm: ` + r.items.map((item,index) => `${item.name} ${r.placements.filter(p=>p.position[1]===height&&p.sku===index).length}`).join("; "));
  }
  if (r.visualTruncated) lines.push(`The illustration shows the first ${r.placements.length} of ${n(r.packed)} units. The numerical grid uses all planned units.`);
  lines.push("", "REVIEW BEFORE PACKING", "Dimensions must already allow for liners, dividers, cushioning, closures and actual filled-pack shape. Tare must include the entered carton's packing materials. No additional allowances have been added.", "Confirm physical fit, load support, carton strength, weight distribution, closures, handling and actual packed gross mass. Cylindrical nesting and flexible-pack compression are not modeled.", "Floor-only mixed trials use one chosen orientation per SKU; other orientation or weight-limited arrangements can differ. Grid trials compare uniform orientations only.", "Pallets, containers, shipping rates and carton costs require separate confirmation. No company price, stock or production capability is inferred.", `Customer notes: ${r.notes || "Not recorded"}`, "Nothing has been submitted. Entries clear on refresh; save your record first.");
  return lines.join("\n");
}
