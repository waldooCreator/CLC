(function (root) {
  const SX = root.SX;
  const { Frac } = SX;
  const ZERO = Frac.ZERO;
  const ONE = Frac.ONE;
  const REL = { '<=': '≤', '>=': '≥', '=': '=' };
  const FLIP = { '<=': '>=', '>=': '<=', '=': '=' };
  let uid = 0;

  const pt = (p) => `(${p[0]}, ${p[1]})`;
  const lhs = (a, names) => SX.linearExpr(a, names);
  const dot = (a, p) => a[0].mul(p[0]).add(a[1].mul(p[1]));
  const row = (text, hint) => ({ type: 'row', text, hint });
  const coefTimes = (c, body) => {
    if (/^\(-?[\d/]+\)$/.test(body)) return `${c}${body}`;
    return c.isOne() ? body : c.cmp(ONE.neg()) === 0 ? `-${body}` : `${c}${body}`;
  };
  // "3(4) + 5(3)", "2(0) - 4(1)"
  const substituted = (coefs, bodies) => coefs
    .map((c, i) => (c.isZero() ? null : coefTimes(c, bodies[i])))
    .filter(Boolean)
    .join(' + ')
    .replace(/\+ -/g, '- ') || '0';

  function holds(l, p) {
    const c = dot(l.a, p).cmp(l.b);
    return l.rel === '<=' ? c <= 0 : l.rel === '>=' ? c >= 0 : c === 0;
  }

  function affine(konst, coef, name) {
    if (coef.isZero()) return konst.toString();
    const term = SX.linearExpr([coef], [name]);
    if (konst.isZero()) return term;
    return term.startsWith('-') ? `${konst} - ${term.slice(1)}` : `${konst} + ${term}`;
  }

  // Puntos (x1, x2) por los que pasa el simplex, uno por iteración.
  function simplexPath(res) {
    if (!res || !res.phases || !res.subst) return [];
    const twoPhase = res.phases.length > 1;
    const out = [];
    res.phases.forEach((ph, pi) => ph.iterations.forEach((it) => {
      const values = res.std.columns.map(() => ZERO);
      it.basis.forEach((j, i) => { values[j] = it.xB[i]; });
      const p = res.subst.recover(values);
      if (p.length !== 2) return;
      const label = `${twoPhase ? `F${pi + 1} ` : ''}It. ${it.index}`;
      const prev = out[out.length - 1];
      if (prev && prev.p[0].cmp(p[0]) === 0 && prev.p[1].cmp(p[1]) === 0) prev.label += `, ${it.index}`;
      else out.push({ p, label });
    }));
    return out;
  }

  function graphic(model, { path = [], view = null } = {}) {
    const names = model.varNames;
    const signs = model.varSigns || ['>=0', '>=0'];
    const cons = model.constraints.map((r, i) => ({ a: r.a, rel: r.rel, b: r.b, label: `R${i + 1}` }));
    const signLines = [];
    signs.forEach((s, j) => {
      if (s === 'free') return;
      signLines.push({ a: j === 0 ? [ONE, ZERO] : [ZERO, ONE], rel: s === '>=0' ? '>=' : '<=', b: ZERO, label: `${names[j]} = 0`, failLabel: `${names[j]} ${s === '>=0' ? '≥' : '≤'} 0`, sign: true });
    });
    const all = [...cons, ...signLines];
    const feasible = (p) => all.every((l) => holds(l, p));
    const zName = model.objName || 'Z';
    const steps = [];

    // ---- Cortes con los ejes ----
    const cut = [];
    const intercepts = [];
    cons.forEach((l) => {
      const [a1, a2] = l.a;
      const eq = `${l.label}: ${lhs(l.a, names)} = ${l.b}`;
      let side = '';
      if (l.rel === '=') side = 'es igualdad: solo sirve la recta';
      else {
        const test = l.b.isZero() ? [ONE, ONE] : [ZERO, ZERO];
        side = holds(l, test) ? `${pt(test)} cumple → sombreo hacia ahí` : `${pt(test)} no cumple → sombreo al otro lado`;
      }
      if (a1.isZero() && a2.isZero()) {
        cut.push(row(`${l.label}: 0 ${REL[l.rel]} ${l.b}`, holds(l, [ZERO, ZERO]) ? 'siempre se cumple' : 'nunca se cumple'));
      } else if (a1.isZero()) {
        const v = l.b.div(a2);
        cut.push(row(`${eq} → [y]${names[1]} = ${v}[/y]`, `horizontal · ${side}`));
        intercepts.push([null, v]);
      } else if (a2.isZero()) {
        const v = l.b.div(a1);
        cut.push(row(`${eq} → [y]${names[0]} = ${v}[/y]`, `vertical · ${side}`));
        intercepts.push([v, null]);
      } else if (l.b.isZero()) {
        const y1 = a1.neg().div(a2);
        cut.push(row(`${eq} → [y](0, 0)[/y] y [y](1, ${y1})[/y]`, `pasa por el origen · ${side}`));
        intercepts.push([ZERO, ZERO], [ONE, y1]);
      } else {
        const vy = l.b.div(a2);
        const vx = l.b.div(a1);
        cut.push(row(`${eq} → [y](0, ${vy})[/y] y [y](${vx}, 0)[/y]`, side));
        intercepts.push([ZERO, vy], [vx, ZERO]);
      }
    });
    signs.forEach((s, j) => {
      const where = j === 0
        ? { '>=0': 'derecha del eje', '<=0': 'izquierda del eje' }
        : { '>=0': 'arriba del eje', '<=0': 'abajo del eje' };
      cut.push(s === 'free'
        ? row(`${names[j]} [p]irrestricta[/p]`, 'no limita nada')
        : row(`${names[j]} [p]${SX.SIGN_TXT[s]}[/p]`, where[s]));
    });
    steps.push({ key: 'cortes', title: 'Dónde corta cada recta', lines: cut });

    // ---- Despejo de la igualdad y reemplazo ----
    const eqIdx = cons.findIndex((l) => l.rel === '=' && !(l.a[0].isZero() && l.a[1].isZero()));
    if (eqIdx !== -1) {
      const E = cons[eqIdx];
      let k = E.a.findIndex((v) => v.cmp(ONE) === 0 || v.cmp(ONE.neg()) === 0);
      if (k === -1) k = E.a[0].isZero() ? 1 : 0;
      const o = 1 - k;
      const K = E.b.div(E.a[k]);
      const C = E.a[o].neg().div(E.a[k]);
      const expr = affine(K, C, names[o]);
      const sub = [row(`${lhs(E.a, names)} = ${E.b} → [y]${names[k]} = ${expr}[/y]`, `despejo ${names[k]} de ${E.label}`)];
      let lo = null;
      let hi = null;
      let empty = false;
      all.forEach((l, idx) => {
        if (idx === eqIdx) return;
        const ak = l.a[k];
        const ao = l.a[o];
        if (ak.isZero() && ao.isZero()) return;
        const newCoef = ao.add(ak.mul(C));
        const newRhs = l.b.sub(ak.mul(K));
        const bodies = [];
        bodies[k] = `(${expr})`;
        bodies[o] = names[o];
        const start = `${substituted(l.a, bodies)} ${REL[l.rel]} ${l.b}`;
        const tag = l.failLabel || l.label;
        if (newCoef.isZero()) {
          const ok = l.rel === '<=' ? ZERO.cmp(newRhs) <= 0 : l.rel === '>=' ? ZERO.cmp(newRhs) >= 0 : newRhs.isZero();
          if (!ok) empty = true;
          sub.push(row(`${start} → 0 ${REL[l.rel]} ${newRhs}`, `${tag}: ${ok ? 'siempre se cumple' : 'nunca se cumple ✗'}`));
          return;
        }
        const v = newRhs.div(newCoef);
        const rel = newCoef.sign() < 0 ? FLIP[l.rel] : l.rel;
        sub.push(row(`${start} → ${lhs([newCoef], [names[o]])} ${REL[l.rel]} ${newRhs} → [y]${names[o]} ${REL[rel]} ${v}[/y]`,
          newCoef.sign() < 0 && l.rel !== '=' ? `${tag} · ÷ negativo, se voltea` : `${tag} · reemplazo ${names[k]}`));
        if (rel === '<=' || rel === '=') hi = hi === null || v.cmp(hi) < 0 ? v : hi;
        if (rel === '>=' || rel === '=') lo = lo === null || v.cmp(lo) > 0 ? v : lo;
      });
      const cz = model.c[k].mul(K);
      const cc = model.c[o].add(model.c[k].mul(C));
      const zBodies = [];
      zBodies[k] = `(${expr})`;
      zBodies[o] = names[o];
      sub.push(row(`${zName} = ${substituted(model.c, zBodies)} → [y]${zName} = ${affine(cz, cc, names[o])}[/y]`,
        cc.isZero() ? `${names[o]} se cancela: ${zName} siempre vale ${cz}` : `reemplazo en ${zName}`));
      if (lo !== null && hi !== null && lo.cmp(hi) > 0) empty = true;
      if (empty) sub.push(row('[r]no hay ningún valor que cumpla todo[/r]', 'los límites chocan'));
      else {
        const range = lo !== null && hi !== null ? `${lo} ≤ ${names[o]} ≤ ${hi}` : hi !== null ? `${names[o]} ≤ ${hi}` : lo !== null ? `${names[o]} ≥ ${lo}` : `${names[o]} libre`;
        sub.push(row(`[y]${range}[/y]`, 'me quedo con el límite más fuerte'));
      }
      steps.push({ key: 'reemplazo', title: 'Despejo y reemplazo', lines: sub });
    }

    // ---- Vértices ----
    const cand = new Map();
    const discarded = [];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const L1 = all[i];
        const L2 = all[j];
        const det = L1.a[0].mul(L2.a[1]).sub(L1.a[1].mul(L2.a[0]));
        if (det.isZero()) continue;
        const x = L1.b.mul(L2.a[1]).sub(L1.a[1].mul(L2.b)).div(det);
        const y = L1.a[0].mul(L2.b).sub(L1.b.mul(L2.a[0])).div(det);
        const p = [x, y];
        const key = `${x}|${y}`;
        if (!feasible(p)) {
          if (!discarded.some((d) => d.key === key)) discarded.push({ key, p });
          continue;
        }
        if (!cand.has(key)) cand.set(key, { p, L1, L2 });
      }
    }
    const vertices = [...cand.values()];
    const vx = vertices.map(({ p, L1, L2 }) => row(`${L1.label} con ${L2.label} → [y]${pt(p)}[/y] ✓`, crossHint(L1, L2, p, names)));
    if (!vertices.length) vx.push(row('ningún cruce sirve', 'todos fallan alguna restricción'));
    if (discarded.length) vx.push(row(`descarto ${discarded.slice(0, 6).map((d) => pt(d.p)).join(', ')}${discarded.length > 6 ? '…' : ''}`, 'se salen de la región ✗'));
    steps.push({ key: 'vertices', title: 'Esquinas de la región', lines: vx });

    // ---- Evaluar y concluir ----
    const c = model.c;
    const isMax = model.sense === 'max';
    const better = (u, v) => (isMax ? u.cmp(v) > 0 : u.cmp(v) < 0);
    const dirs = [[ONE, ZERO], [ONE.neg(), ZERO], [ZERO, ONE], [ZERO, ONE.neg()], [c[0], c[1]], [c[0].neg(), c[1].neg()]];
    all.forEach((l) => dirs.push([l.a[1].neg(), l.a[0]], [l.a[1], l.a[0].neg()]));
    const inCone = (d) => !(d[0].isZero() && d[1].isZero()) && all.every((l) => {
      const v = dot(l.a, d);
      return l.rel === '<=' ? v.sign() <= 0 : l.rel === '>=' ? v.sign() >= 0 : v.isZero();
    });
    const coneDirs = dirs.filter(inCone);
    const improving = coneDirs.find((d) => (isMax ? dot(c, d).sign() > 0 : dot(c, d).sign() < 0));
    const flatRay = coneDirs.find((d) => dot(c, d).isZero());

    let anyFeasible = vertices.length > 0;
    if (!anyFeasible) {
      const probes = [[ZERO, ZERO], ...cons.map((l) => (l.a[0].isZero() ? [ZERO, l.a[1].isZero() ? ZERO : l.b.div(l.a[1])] : [l.b.div(l.a[0]), ZERO]))];
      anyFeasible = probes.some(feasible);
    }

    let best = null;
    vertices.forEach((v) => {
      v.z = dot(c, v.p);
      if (!best || better(v.z, best.z)) best = v;
    });
    const ev = vertices.map((v) => {
      const isBest = v.z.cmp(best.z) === 0;
      const txt = `${pt(v.p)} → ${zName} = ${substituted(c, [`(${v.p[0]})`, `(${v.p[1]})`])} = ${v.z}`;
      return row(isBest ? `[y]${txt}[/y]` : txt, isBest ? `★ el ${isMax ? 'mayor' : 'menor'}` : '');
    });

    let status;
    const concl = [];
    if (!anyFeasible) {
      status = 'infeasible';
      concl.push(row('[r]no hay solución factible[/r]', 'ningún punto cumple todo'));
    } else if (improving) {
      status = 'unbounded';
      concl.push(row(`[r]${zName} no tiene límite → no acotado[/r]`, `hacia ${pt(improving)} ${zName} ${isMax ? 'sube' : 'baja'} sin parar`));
    } else if (!vertices.length) {
      status = 'novertex';
      concl.push(row('la región no tiene esquinas', 'uso el resultado del simplex'));
    } else {
      status = 'optimal';
      const ties = vertices.filter((v) => v.z.cmp(best.z) === 0);
      concl.push(row(`[y]${zName}* = ${best.z} en ${pt(best.p)}[/y]`, `es ${isMax ? 'Max' : 'Min'}: me quedo con el ${isMax ? 'mayor' : 'menor'}`));
      if (ties.length > 1) concl.push(row(`empate entre ${ties.map((t) => pt(t.p)).join(' y ')}`, 'todo el segmento es óptimo'));
      else if (flatRay) concl.push(row(`hacia ${pt(flatRay)} ${zName} no cambia`, 'hay óptimos múltiples sobre ese rayo'));
    }
    if (vertices.length) steps.push({ key: 'evaluar', title: `${zName} en cada esquina`, lines: ev });

    const svg = drawSvg({ model, zName, names, cons, all, vertices, best: status === 'optimal' ? best : null, intercepts, feasible, path, view });
    steps.push({ key: 'grafica', title: 'La gráfica', lines: [{ type: 'svg', html: svg }, ...concl] });

    return { status, steps, best: status === 'optimal' ? best : null };
  }

  function crossHint(L1, L2, p, names) {
    const simple = (L) => L.a[0].isZero() || L.a[1].isZero();
    let A = L1;
    let B = L2;
    if (simple(L2) && !simple(L1)) [A, B] = [L2, L1];
    if (simple(A)) {
      const k = A.a[0].isZero() ? 1 : 0;
      const o = 1 - k;
      if (B.a[k].isZero()) return `${names[k]} = ${p[k]} y ${names[o]} = ${p[o]}`;
      return `pongo ${names[k]} = ${p[k]} en ${B.label} → ${names[o]} = ${p[o]}`;
    }
    const expr = affine(A.b.div(A.a[0]), A.a[1].neg().div(A.a[0]), names[1]);
    return `de ${A.label}: ${names[0]} = ${expr} → en ${B.label}: ${names[1]} = ${p[1]} → ${names[0]} = ${p[0]}`;
  }

  // ---------- Dibujo SVG ----------
  function niceStep(range) {
    const raw = range / 6;
    const pow = 10 ** Math.floor(Math.log10(raw));
    const n = raw / pow;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * pow;
  }

  function clipPoly(poly, a0, a1, b) {
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const P = poly[i];
      const Q = poly[(i + 1) % poly.length];
      const fp = a0 * P[0] + a1 * P[1] - b;
      const fq = a0 * Q[0] + a1 * Q[1] - b;
      const inP = fp <= 1e-9;
      const inQ = fq <= 1e-9;
      if (inP) out.push(P);
      if (inP !== inQ) {
        const t = fp / (fp - fq);
        out.push([P[0] + t * (Q[0] - P[0]), P[1] + t * (Q[1] - P[1])]);
      }
    }
    return out;
  }

  // Segmento de la recta a·p = b dentro de los semiplanos dados.
  function clipLine(a, b, halfplanes) {
    const [a0, a1] = a;
    const norm = a0 * a0 + a1 * a1;
    if (norm === 0) return null;
    const p0 = [(a0 * b) / norm, (a1 * b) / norm];
    const d = [-a1, a0];
    let tmin = -Infinity;
    let tmax = Infinity;
    for (const h of halfplanes) {
      const ad = h.a[0] * d[0] + h.a[1] * d[1];
      const rest = h.b - (h.a[0] * p0[0] + h.a[1] * p0[1]);
      if (Math.abs(ad) < 1e-12) {
        if (rest < -1e-9) return null;
        continue;
      }
      const t = rest / ad;
      if (ad > 0) tmax = Math.min(tmax, t);
      else tmin = Math.max(tmin, t);
    }
    if (tmin > tmax + 1e-9 || !isFinite(tmin) || !isFinite(tmax)) return null;
    return [[p0[0] + tmin * d[0], p0[1] + tmin * d[1]], [p0[0] + tmax * d[0], p0[1] + tmax * d[1]]];
  }

  // a·p ≤ b en flotantes (≥ se invierte; = da dos semiplanos).
  function toHalfplanes(l) {
    const a = [l.a[0].toNumber(), l.a[1].toNumber()];
    const b = l.b.toNumber();
    if (l.rel === '<=') return [{ a, b }];
    if (l.rel === '>=') return [{ a: [-a[0], -a[1]], b: -b }];
    return [{ a, b }, { a: [-a[0], -a[1]], b: -b }];
  }

  // Número "de informe": decimal si es exacto (0.3, 2.7, 1.5), fracción si no (10/7).
  function num(f) {
    if (f.d === 1n) return f.n.toString();
    let d = f.d;
    while (d % 2n === 0n) d /= 2n;
    while (d % 5n === 0n) d /= 5n;
    return d === 1n ? String(+f.toNumber().toFixed(6)) : f.toString();
  }

  function legendExpr(a, names) {
    const parts = [];
    a.forEach((c, j) => {
      if (c.isZero()) return;
      const abs = c.sign() < 0 ? c.neg() : c;
      parts.push({ neg: c.sign() < 0, body: `${abs.isOne() ? '' : num(abs)}${names[j]}` });
    });
    if (!parts.length) return '0';
    return parts.map((p, i) => (i === 0 ? `${p.neg ? '−' : ''}${p.body}` : `${p.neg ? ' − ' : ' + '}${p.body}`)).join('');
  }

  const REL_TXT = { '<=': '≤', '>=': '≥', '=': '=' };

  function autoView(points) {
    const xs = points.map((p) => p[0]);
    const ys = points.map((p) => p[1]);
    const bounds = (vals) => {
      const lo = Math.min(0, ...vals);
      const hi = Math.max(0, ...vals);
      const span = hi - lo || 2;
      return [lo < 0 ? Math.floor(lo - span * 0.2) : 0, Math.ceil(hi + span * 0.3)];
    };
    const [xmin, xmax] = bounds(xs);
    const [ymin, ymax] = bounds(ys);
    const range = Math.max(xmax - xmin, ymax - ymin);
    const step = range <= 7 ? 1 : range <= 20 ? 2 : niceStep(range);
    const unit = Math.min(420 / (xmax - xmin), 440 / (ymax - ymin), 64);
    return { xmin, xmax, ymin, ymax, step, unit };
  }

  function drawSvg({ model, zName, names, cons, all, vertices, best, intercepts, feasible, path, view }) {
    const id = ++uid;
    const F = (f) => f.toNumber();

    let v;
    if (view) {
      v = { xmin: 0, ymin: 0, xmax: view.xmax, ymax: view.ymax, step: view.step, unit: view.scale * 62 };
    } else {
      const core = [...vertices.map((x) => x.p), ...path.map((x) => x.p)].map((p) => [F(p[0]), F(p[1])]);
      const extent = Math.max(1, ...core.map((p) => Math.max(Math.abs(p[0]), Math.abs(p[1]))));
      const cuts = intercepts.flatMap(([x, y]) => [[x === null ? 0 : F(x), y === null ? 0 : F(y)]])
        .filter((p) => Math.abs(p[0]) <= extent * 1.6 && Math.abs(p[1]) <= extent * 1.6);
      v = autoView([[0, 0], ...core, ...cuts]);
    }
    const { xmin, xmax, ymin, ymax, step, unit: u } = v;
    const ml = 42, mr = 26, mt = 30, mb = 34;
    const W = ml + (xmax - xmin) * u + mr;
    const H = mt + (ymax - ymin) * u + mb;
    const sx = (x) => +(ml + (x - xmin) * u).toFixed(1);
    const sy = (y) => +(mt + (ymax - y) * u).toFixed(1);
    const P = (p) => `${sx(p[0])},${sy(p[1])}`;
    const rect = [{ a: [1, 0], b: xmax }, { a: [-1, 0], b: -xmin }, { a: [0, 1], b: ymax }, { a: [0, -1], b: -ymin }];
    const segSvg = (seg, cls) => (seg ? `<line class="${cls}" x1="${sx(seg[0][0])}" y1="${sy(seg[0][1])}" x2="${sx(seg[1][0])}" y2="${sy(seg[1][1])}"/>` : '');

    // Cuadrícula de 1 en 1 (o del paso si el rango es enorme) y números cada "step".
    const gridStep = Math.max(xmax - xmin, ymax - ymin) <= 20 ? 1 : step;
    let grid = '';
    for (let x = Math.ceil(xmin / gridStep) * gridStep; x <= xmax + 1e-9; x += gridStep) grid += `<line class="g-grid" x1="${sx(x)}" y1="${sy(ymin)}" x2="${sx(x)}" y2="${sy(ymax)}"/>`;
    for (let y = Math.ceil(ymin / gridStep) * gridStep; y <= ymax + 1e-9; y += gridStep) grid += `<line class="g-grid" x1="${sx(xmin)}" y1="${sy(y)}" x2="${sx(xmax)}" y2="${sy(y)}"/>`;

    const ax = xmin <= 0 && xmax >= 0 ? 0 : xmin;
    const ay = ymin <= 0 && ymax >= 0 ? 0 : ymin;
    let ticks = '';
    for (let x = Math.ceil(xmin / step) * step; x <= xmax + 1e-9; x += step) {
      if (Math.abs(x) < 1e-9) continue;
      ticks += `<text class="g-num" x="${sx(x)}" y="${sy(ay) + 17}" text-anchor="middle">${+x.toFixed(2)}</text>`;
    }
    for (let y = Math.ceil(ymin / step) * step; y <= ymax + 1e-9; y += step) {
      if (Math.abs(y) < 1e-9) continue;
      ticks += `<text class="g-num" x="${sx(ax) - 8}" y="${sy(y) + 5}" text-anchor="end">${+y.toFixed(2)}</text>`;
    }

    // Región factible: área rellena, o el pedazo de recta si hay una igualdad.
    const halfplanes = all.flatMap(toHalfplanes);
    const eqs = all.filter((l) => l.rel === '=');
    let region = '';
    if (!eqs.length) {
      let poly = [[xmin, ymin], [xmax, ymin], [xmax, ymax], [xmin, ymax]];
      halfplanes.forEach((h) => { if (poly.length) poly = clipPoly(poly, h.a[0], h.a[1], h.b); });
      if (poly.length >= 3) region = `<polygon class="g-region" points="${poly.map(P).join(' ')}"/>`;
    } else {
      const e = eqs[0];
      region = segSvg(clipLine([F(e.a[0]), F(e.a[1])], F(e.b), [...halfplanes, ...rect]), 'g-region-line');
    }

    const lines = cons.map((l, i) => segSvg(clipLine([F(l.a[0]), F(l.a[1])], F(l.b), rect), `g-line g-c${i % 5}`)).join('');
    const iso = best && !(model.c[0].isZero() && model.c[1].isZero())
      ? segSvg(clipLine([F(model.c[0]), F(model.c[1])], F(best.z), rect), 'g-iso')
      : '';

    // Recorrido del simplex: flechas entre iteraciones.
    const inBox = (p) => p[0] >= xmin - 1e-9 && p[0] <= xmax + 1e-9 && p[1] >= ymin - 1e-9 && p[1] <= ymax + 1e-9;
    const pts = path.map((s) => ({ ...s, f: [F(s.p[0]), F(s.p[1])], ok: feasible(s.p) })).filter((s) => inBox(s.f));
    let arrows = '';
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = [sx(pts[i - 1].f[0]), sy(pts[i - 1].f[1])];
      const [x2, y2] = [sx(pts[i].f[0]), sy(pts[i].f[1])];
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (len < 12) continue;
      const k = (len - 9) / len;
      arrows += `<line class="g-path" x1="${x1}" y1="${y1}" x2="${+(x1 + (x2 - x1) * k).toFixed(1)}" y2="${+(y1 + (y2 - y1) * k).toFixed(1)}" marker-end="url(#g-arrow-${id})"/>`;
    }

    const isBest = (p) => best && p[0].cmp(best.p[0]) === 0 && p[1].cmp(best.p[1]) === 0;
    const dots = vertices.filter((x) => !isBest(x.p)).map((x) => `<circle class="g-dot" cx="${sx(F(x.p[0]))}" cy="${sy(F(x.p[1]))}" r="4"/>`).join('');
    const openDots = pts.filter((s) => !s.ok).map((s) => `<circle class="g-open" cx="${sx(s.f[0])}" cy="${sy(s.f[1])}" r="5"/>`).join('');
    const itLabels = pts.filter((s) => !isBest(s.p)).map((s) => `<text class="g-it" x="${sx(s.f[0]) + 9}" y="${sy(s.f[1]) - 8}">${s.label}</text>`).join('');

    let bestSvg = '';
    if (best) {
      const [bx, by] = [sx(F(best.p[0])), sy(F(best.p[1]))];
      const last = pts.find((s) => isBest(s.p));
      const text = `${last ? `${last.label}: ` : ''}(${num(best.p[0])}, ${num(best.p[1])}) óptimo`;
      const tooRight = bx + 12 + text.length * 8 > W - 4;
      bestSvg = `<circle class="g-best" cx="${bx}" cy="${by}" r="8"/>
        <text class="g-best-label" x="${tooRight ? bx - 12 : bx + 12}" y="${by - 12}" text-anchor="${tooRight ? 'end' : 'start'}">${text}</text>`;
    }

    // Leyenda arriba a la derecha, igual que en el informe.
    const entries = cons.map((l, i) => ({ cls: `g-c${i % 5}`, text: `${l.label}: ${legendExpr(l.a, names)} ${REL_TXT[l.rel]} ${num(l.b)}` }));
    if (best) entries.push({ cls: 'iso', text: `${zName} = ${num(best.z)}` });
    const lw = Math.max(...entries.map((e) => e.text.length)) * 7.4 + 40;
    const lh = entries.length * 18 + 10;
    const lx = sx(xmax) - lw - 6;
    const ly = sy(ymax) + 6;
    const legend = `<g class="g-legend"><rect x="${lx}" y="${ly}" width="${lw}" height="${lh}" rx="4"/>${entries.map((e, i) => {
      const y = ly + 16 + i * 18;
      const swatch = e.cls === 'iso'
        ? `<line class="g-iso" x1="${lx + 8}" y1="${y - 5}" x2="${lx + 28}" y2="${y - 5}"/>`
        : `<line class="g-line ${e.cls}" x1="${lx + 8}" y1="${y - 5}" x2="${lx + 28}" y2="${y - 5}"/>`;
      return `${swatch}<text class="g-legend-text" x="${lx + 34}" y="${y}">${e.text}</text>`;
    }).join('')}</g>`;

    return `<svg class="g-svg" width="${Math.round(W)}" viewBox="0 0 ${Math.round(W)} ${Math.round(H)}" role="img" aria-label="Gráfica de la región factible en ${names[0]} y ${names[1]}">
      <defs><marker id="g-arrow-${id}" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path class="g-arrowhead" d="M0,0 L10,5 L0,10 z"/></marker></defs>
      ${grid}${region}
      <line class="g-axis" x1="${sx(xmin)}" y1="${sy(ay)}" x2="${sx(xmax) + 12}" y2="${sy(ay)}"/>
      <line class="g-axis" x1="${sx(ax)}" y1="${sy(ymin)}" x2="${sx(ax)}" y2="${sy(ymax) - 12}"/>
      <text class="g-axis-name" x="${sx(xmax) + 16}" y="${sy(ay) + 6}">${names[0]}</text>
      <text class="g-axis-name" x="${sx(ax)}" y="${sy(ymax) - 16}" text-anchor="middle">${names[1]}</text>
      ${ticks}${lines}${iso}${arrows}${dots}${openDots}${itLabels}${bestSvg}${legend}
    </svg>`;
  }

  SX.graphic = graphic;
  SX.simplexPath = simplexPath;
})(typeof window !== 'undefined' ? window : globalThis);
