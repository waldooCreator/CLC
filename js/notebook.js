(function (root) {
  const SX = root.SX;
  const R = SX.REL_TXT;
  const S = SX.SIGN_TXT;

  const row = (text, hint = '') => ({ type: 'row', text, hint });
  const vec = (a) => `(${a.join(', ')})`;
  const paren = (v) => { const s = String(v); return /^-|\s/.test(s) ? `(${s})` : s; };
  const lin = (a, names) => SX.linearExpr(a, names);
  const STATUS_TXT = { optimal: 'tiene óptimo', infeasible: 'no tiene solución factible', unbounded: 'es no acotado', error: 'dio error' };
  const COLORS = 5;

  // Expresión con cada término pintado (para seguir columnas con la vista).
  function colorExpr(coefs, names, colorOf) {
    const parts = [];
    coefs.forEach((c, j) => {
      if (c.isZero()) return;
      const neg = c.sign() < 0;
      const abs = neg ? c.neg() : c;
      const coef = abs.isOne() ? '' : abs.d === 1n ? `${abs}` : `(${abs})`;
      const cls = colorOf(j);
      const body = `${coef}${names[j]}`;
      parts.push({ neg, t: cls ? `[${cls}]${body}[/${cls}]` : body });
    });
    if (!parts.length) return '0';
    return parts.map((p, i) => (i === 0 ? `${p.neg ? '−' : ''}${p.t}` : `${p.neg ? ' − ' : ' + '}${p.t}`)).join('');
  }

  function modelRows(model, { zName = 'Z', relMark = 'r', signMark = 'p', color = false } = {}) {
    const signs = model.varSigns || model.varNames.map(() => '>=0');
    const out = [row(`[y]${model.sense === 'max' ? 'Max' : 'Min'} ${zName} = ${lin(model.c, model.varNames)}[/y]`)];
    model.constraints.forEach((r, i) => {
      const c = `c${i % COLORS}`;
      const expr = lin(r.a, model.varNames);
      out.push(row(color
        ? `   [${c}]${expr}[/${c}] [${relMark}]${R[r.rel]}[/${relMark}] [${c}]${r.b}[/${c}]`
        : `   ${expr} [${relMark}]${R[r.rel]}[/${relMark}] ${r.b}`));
    });
    const groups = [];
    model.varNames.forEach((n, j) => {
      const g = groups.find((x) => x.sign === signs[j]);
      g ? g.names.push(n) : groups.push({ sign: signs[j], names: [n] });
    });
    out.push(row(`   ${groups.map((g) => `${g.names.join(', ')} [${signMark}]${S[g.sign]}[/${signMark}]`).join('   ')}`));
    return out;
  }

  // ---------- Simplex Revisado ----------
  function simplexSteps(res, model, { zName = 'Z', idp = 's', withPlan = true } = {}) {
    const steps = [];
    const std = res.std;
    const names = std.names;

    if (withPlan) steps.push({ id: `${idp}-plan`, title: 'El problema', lines: modelRows(model, { zName, relMark: 'p', signMark: 'R' }) });

    if (res.subst && res.subst.changed) {
      steps.push({
        id: `${idp}-subst`,
        title: 'Variables que no son ≥ 0',
        lines: res.subst.groups.filter((g) => g.type !== 'pos').map((g) => (g.type === 'neg'
          ? row(`${g.name} = −${g.name}'`, `${g.name} ≤ 0 · el simplex solo acepta ≥ 0`)
          : row(`${g.name} = ${g.name}⁺ − ${g.name}⁻`, `${g.name} irrestricta = resta de dos ≥ 0`))),
      });
    }

    const L = [];
    if (std.isMin) L.push(row(`Min ${zName} → Max (−${zName})`, 'cambio signos y al final lo regreso'));
    std.rows.forEach((r, i) => {
      const k = i + 1;
      const what = r.rel === '<=' ? `≤ → + s${k}` : r.rel === '>=' ? `≥ → − e${k} + a${k}` : `= → + a${k}`;
      L.push(row(`R${k}: ${std.equations[i]}`, `${r.flipped ? '×(−1) por b negativo · ' : ''}${what}`));
    });
    L.push(row(std.objective.replace(/^Max \(−Z\)/, `Max (−${zName})`).replace(/^Max Z/, `Max ${zName}`),
      std.hasArt ? (std.method === 'bigM' ? '−M castiga a las artificiales' : 'hay artificiales → Dos Fases') : ''));
    L.push(row(`Base inicial [y]{${std.basis.map((j) => names[j]).join(', ')}}[/y]`, 'forman la identidad → B⁻¹ = I'));
    steps.push({ id: `${idp}-std`, title: 'Forma estándar', lines: L });

    res.phases.forEach((ph, pi) => {
      const phaseTag = ph.key === 'phase1' ? ' · Fase 1' : ph.key === 'phase2' && std.hasArt ? ' · Fase 2' : '';
      const zl = ph.key === 'phase1' ? 'W₁' : std.isMin ? `(−${zName})` : zName;

      ph.iterations.forEach((it, idx) => {
        const bn = it.basis.map((j) => names[j]);
        const I = [];
        if (idx === 0 && ph.key === 'phase1') I.push(row('Max W₁ = −(suma de artificiales)', 'primero saco las artificiales'));
        if (idx === 0 && ph.key === 'phase2' && std.hasArt) I.push(row('costos originales', 'sigo con la base de la Fase 1'));
        I.push(row(`Base {${bn.join(', ')}}`));
        I.push({ type: 'matrices', items: [['B⁻¹ =', it.Binv]] });
        I.push(row(bn.map((n, i) => `${n} = ${it.xB[i]}`).join(', '), 'xB = B⁻¹·b'));
        I.push(row(`π = ${vec(it.pi)}   ${zl} = ${it.Z}`, 'π = cB·B⁻¹'));
        I.push(row(it.reduced.map((r) => `${names[r.j]}: ${r.zc.sign() < 0 ? `[r]${r.zc}[/r]` : r.zc}`).join('   '), 'zj − cj'));
        if (it.status === 'optimal') {
          I.push(row('[y]ninguno negativo → ÓPTIMO[/y]', 'ya no se puede mejorar'));
        } else {
          const en = names[it.entering];
          I.push(row(`[y]entra ${en}[/y]`, it.rule === 'bland' ? 'primer negativo (regla de Bland)' : 'el más negativo'));
          I.push(row(`α = ${vec(it.alpha)}`, `B⁻¹ · columna de ${en}`));
          I.push(row(bn.map((n, i) => {
            if (it.ratios[i] === null) return `${n}: —`;
            const q = `${it.xB[i]}/${paren(it.alpha[i])}`;
            const val = i === it.leavingRow ? `[y]${it.ratios[i]}[/y]` : `${it.ratios[i]}`;
            return q === `${it.ratios[i]}` ? `${n}: ${val}` : `${n}: ${q} = ${val}`;
          }).join('   '), 'xB / α (solo α > 0)'));
          if (it.status === 'unbounded') {
            I.push(row(`[r]${en} crece sin límite → no acotado[/r]`, 'ningún α positivo'));
          } else {
            I.push(row(`[y]sale ${names[it.leaving]}[/y]`, it.degenerate ? 'la menor razón (es 0: degenerada)' : 'la menor razón'));
            I.push({ type: 'matrices', items: [['E =', it.E], ['B⁻¹ nueva = E·B⁻¹ =', it.newBinv]] });
          }
        }
        steps.push({ id: `${idp}-f${pi}-i${it.index}`, title: `Iteración ${it.index}${phaseTag}`, lines: I });
      });

      if (ph.adjustments && ph.adjustments.length) {
        steps.push({
          id: `${idp}-adj`,
          title: 'Artificiales que quedaron en 0',
          lines: ph.adjustments.map((a) => (a.type === 'redundant'
            ? row(`${names[a.col]} se queda con valor 0`, `R${a.row + 1} sobra (redundante)`)
            : row(`${names[a.from]} → ${names[a.to]}`, 'la cambio con un pivote, el valor no cambia'))),
        });
      }
    });

    const F = [];
    if (res.status === 'optimal') {
      const s = res.solution;
      F.push(row(`[y]${zName}* = ${s.Z}[/y]`, s.Z.d !== 1n ? `≈ ${s.Z.toDecimal(4)}` : ''));
      const vals = s.values;
      res.subst.groups.forEach((g, j) => {
        const v = s.decision[j].value;
        if (g.type === 'neg') F.push(row(`${g.name} = −${paren(vals[g.idx[0]])} = [y]${v}[/y]`, `${g.name} = −${g.name}'`));
        else if (g.type === 'free') F.push(row(`${g.name} = ${vals[g.idx[0]]} − ${paren(vals[g.idx[1]])} = [y]${v}[/y]`, `${g.name}⁺ − ${g.name}⁻`));
        else F.push(row(`${g.name} = [y]${v}[/y]`));
      });
      const extra = s.extra.filter((e) => e.kind !== 'artificial');
      if (extra.length) F.push(row(extra.map((e) => `${e.name} = ${e.value}`).join(', '), 'holguras / excesos'));
      F.push(row(s.duals.map((y, i) => `R${i + 1}: ${y}`).join('   '), 'precios sombra'));
      if (res.alternative) F.push(row('hay más de una solución óptima', 'una no básica quedó con zj − cj = 0'));
    } else {
      F.push(row(`[r]${res.message}[/r]`));
    }
    steps.push({ id: `${idp}-res`, title: 'Resultado', lines: F });
    return steps;
  }

  const graphSteps = (g, idp) => g.steps.map((st) => ({ id: `${idp}-${st.key}`, title: st.title, lines: st.lines }));

  function simplexNotebook(res, model, { graph } = {}) {
    const sheets = [{ title: 'Simplex Revisado', open: true, steps: simplexSteps(res, model) }];
    if (graph) {
      const steps = graphSteps(graph, 'g');
      if (graph.best && res.status === 'optimal') {
        const same = graph.best.z.cmp(res.solution.Z) === 0;
        steps[steps.length - 1].lines.push(same
          ? row(`igual que el simplex: Z* = ${res.solution.Z} ✓`, 'los dos métodos coinciden')
          : row(`[r]el simplex dio Z* = ${res.solution.Z}[/r]`, 'no coincide: revisa el modelo'));
      }
      sheets.push({ title: 'Despejes y gráfica', open: true, steps });
    } else if (graph === null) {
      sheets[0].steps.push({ id: 'g-no', title: 'Despejes y gráfica', lines: [row('no se puede graficar', 'solo sirve con 2 variables')] });
    }
    return { title: 'Simplex Revisado', sheets };
  }

  // ---------- Dualidad ----------
  function dualNotebook(d, model, { graph, graphPrimal } = {}) {
    const { dual } = d;
    const isMax = model.sense === 'max';
    const xs = model.varNames;
    const ys = dual.varNames;
    const P = isMax ? 'Max' : 'Min';
    const Dn = isMax ? 'Min' : 'Max';
    const colorOf = (j) => `c${j % COLORS}`;
    const sheets = [];

    const conHint = isMax
      ? { '<=': '≤ en Max → ≥ 0', '>=': '≥ en Max → ≤ 0', '=': '= → irrestricta' }
      : { '>=': '≥ en Min → ≥ 0', '<=': '≤ en Min → ≤ 0', '=': '= → irrestricta' };

    const groups = [
      {
        title: `${P} → ${Dn}`,
        rows: [{
          left: `${P} Z = ${colorExpr(model.c, xs, colorOf)}`,
          right: `${Dn} W = ${colorExpr(dual.c, ys, () => 'k')}`,
          hint: `los b (${dual.c.join(', ')}) suben a W`,
        }],
      },
      {
        title: 'cada restricción → una variable',
        rows: model.constraints.map((r, i) => ({
          left: `R${i + 1}: ${colorExpr(r.a, xs, colorOf)} [p]${R[r.rel]}[/p] [k]${r.b}[/k]`,
          right: `${ys[i]} [p]${S[dual.varSigns[i]]}[/p]`,
          hint: conHint[r.rel],
        })),
      },
      {
        title: 'cada variable → una restricción',
        rows: xs.map((x, j) => {
          const col = dual.constraints[j];
          return {
            left: `[${colorOf(j)}]${x}[/${colorOf(j)}] [R]${S[dual.primalSigns[j]]}[/R]  columna ${vec(col.a)}`,
            right: `[${colorOf(j)}]${lin(col.a, ys)}[/${colorOf(j)}] [r]${R[col.rel]}[/r] [${colorOf(j)}]${col.b}[/${colorOf(j)}]`,
            hint: `${S[dual.primalSigns[j]]} en ${P} → ${R[col.rel]} · Z da el ${col.b}`,
          };
        }),
      },
    ];

    sheets.push({
      title: 'De P a D',
      open: true,
      steps: [
        {
          id: 'd-tabla',
          title: 'La tabla',
          lines: [
            { type: 'dualTable', hl: [...new Set([...dual.rowForVar, ...dual.rowForCon])] },
            row(`P es de ${P}`, isMax ? 'leo de izquierda a derecha' : 'leo de derecha a izquierda'),
          ],
        },
        { id: 'd-map', title: 'Paso de P a D (sigue las flechas)', lines: [{ type: 'map', groups }] },
        { id: 'd-dual', title: 'Así queda D', lines: modelRows(dual, { zName: 'W', relMark: 'r', signMark: 'p', color: true }) },
      ],
    });

    sheets.push({ title: 'Resuelvo D con Simplex Revisado', open: true, steps: simplexSteps(d.dualRes, dual, { zName: 'W', idp: 'dd', withPlan: false }) });
    if (graph) sheets.push({ title: 'Despejes y gráfica de D', open: true, steps: graphSteps(graph, 'dg') });
    if (graphPrimal) sheets.push({ title: 'Despejes y gráfica de P', open: false, steps: graphSteps(graphPrimal, 'pg') });
    if (graph === null && graphPrimal === null) {
      sheets[1].steps.push({ id: 'dg-no', title: 'Despejes y gráfica', lines: [row('no se puede graficar', 'ni P ni D tienen 2 variables')] });
    }

    const F = [];
    if (d.check) {
      const c = d.check;
      F.push(row(`[y]W* = ${c.W}[/y]   [y]Z* = ${c.Z}[/y]`, c.strong ? 'iguales → dualidad fuerte ✓' : 'no coinciden ✗'));
      F.push(row(`y = ${vec(c.y)}`, 'sale de D'));
      F.push(row(`x = ${vec(c.x)}`, 'sale de P'));
      F.push(row(`π de P = ${vec(c.yFromPrimal)}`, c.sameY ? 'da lo mismo que y ✓' : 'otra solución óptima de D'));
      c.cs1.forEach((r, i) => F.push(row(`${ys[i]} · holgura R${i + 1} = ${paren(r.y)} · ${paren(r.slack)} = ${r.prod} ${r.prod.isZero() ? '✓' : '✗'}`, i === 0 ? 'holgura complementaria: todo da 0' : '')));
      c.cs2.forEach((r) => F.push(row(`${r.name} · exceso en D = ${paren(r.x)} · ${paren(r.surplus)} = ${r.prod} ${r.prod.isZero() ? '✓' : '✗'}`)));
    } else {
      F.push(row(`P ${STATUS_TXT[d.primal.status]} · D ${STATUS_TXT[d.dualRes.status]}`));
      F.push(row(`[r]${d.theory}[/r]`));
    }
    sheets.push({ title: '¿Cuadra?', open: true, steps: [{ id: 'd-final', title: 'Comparo P y D', lines: F }] });
    sheets.push({ title: 'Simplex Revisado de P (para comparar)', open: false, steps: simplexSteps(d.primal, model, { idp: 'pp' }) });
    return { title: 'Dualidad', sheets };
  }

  // ---------- Dibujo HTML ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function ink(text) {
    return esc(text)
      .replace(/(^|[\s(=,:→·/\]])-(?=[\dA-Za-z(M\s])/g, '$1−')
      .replace(/\[(c\d|k)\]([\s\S]*?)\[\/\1\]/g, '<span class="ink-$1">$2</span>')
      .replace(/\[r\]([\s\S]*?)\[\/r\]/g, '<span class="ink-r">$1</span>')
      .replace(/\[R\]([\s\S]*?)\[\/R\]/g, '<span class="ink-box ink-box-r">$1</span>')
      .replace(/\[p\]([\s\S]*?)\[\/p\]/g, '<span class="ink-box ink-box-p">$1</span>')
      .replace(/\[y\]([\s\S]*?)\[\/y\]/g, '<mark class="ink-y">$1</mark>')
      .replace(/\[b\]([\s\S]*?)\[\/b\]/g, '<b class="ink-b">$1</b>');
  }

  const renderMatrix = (rows) =>
    `<span class="nb-br"><table class="nb-matrix">${rows.map((r) => `<tr>${r.map((v) => `<td>${ink(v)}</td>`).join('')}</tr>`).join('')}</table></span>`;

  function renderDualTable(hl) {
    const rows = SX.DUAL_TABLE.map((r, i) => `<tr class="${hl.includes(i) ? 'hl' : ''}${i === 3 ? ' gap' : ''}">
      <th>${r.group}</th><td>${r.max}</td><td class="arrow">↔</td><td>${r.min}</td><th>${r.minGroup}</th></tr>`).join('');
    return `<div class="nb-scroll"><table class="nb-dual"><tr class="head"><th></th><td>Maximización</td><td class="arrow">↔</td><td>Minimización</td><th></th></tr>${rows}</table></div>`;
  }

  const ARROW = '<svg class="nb-arrow-svg" viewBox="0 0 96 22" aria-hidden="true"><path d="M3 13 C 26 5, 58 19, 86 11"/><path d="M76 4 L88 11 L77 18"/></svg>';

  function renderMap(groups) {
    return `<div class="nb-map">${groups.map((g) => `
      <div class="nb-map-group">${ink(g.title)}</div>
      ${g.rows.map((r) => `
        <div class="nb-map-row">
          <div class="nb-map-l">${ink(r.left)}</div>
          <div class="nb-map-a">${ARROW}<span class="nb-map-h">${ink(r.hint)}</span></div>
          <div class="nb-map-r">${ink(r.right)}</div>
        </div>`).join('')}`).join('')}
    </div>`;
  }

  function renderLine(l) {
    if (typeof l === 'string') return `<div class="nb-row"><span class="nb-row-t">${ink(l)}</span></div>`;
    if (l.type === 'row') {
      const pad = l.text.match(/^ */)[0].length;
      return `<div class="nb-row"${pad ? ` style="padding-left:${pad * 0.45}em"` : ''}><span class="nb-row-t">${ink(l.text.trim())}</span>${l.hint ? `<span class="nb-hint">← ${ink(l.hint)}</span>` : ''}</div>`;
    }
    if (l.type === 'matrices') return `<div class="nb-mxs">${l.items.map(([label, rows]) => `<div class="nb-mx"><span>${ink(label)}</span>${renderMatrix(rows.map((r) => r.map(String)))}</div>`).join('')}</div>`;
    if (l.type === 'svg') return `<div class="nb-graph">${l.html}</div>`;
    if (l.type === 'dualTable') return renderDualTable(l.hl);
    if (l.type === 'map') return renderMap(l.groups);
    if (l.type === 'hmatrix') return SX.NetNB.renderH(l);
    return '';
  }

  function render(nb) {
    let n = 0;
    const sheets = nb.sheets.map((sh, i) => `
      <details class="sheet" ${sh.open ? 'open' : ''}>
        <summary><span class="sheet-n">HOJA ${i + 1}</span><span class="sheet-t">${esc(sh.title)}</span></summary>
        <div class="paper">${sh.steps.map((st) => `
          <article class="nb-step">
            <h3 class="nb-title"><span class="nb-num">${++n}.</span> ${esc(st.title)}</h3>
            <aside class="nb-comment" data-comment="${esc(st.id)}" hidden></aside>
            <div class="nb-body">${st.lines.map(renderLine).join('')}</div>
          </article>`).join('')}
        </div>
      </details>`).join('');
    return `
      <section class="notebook pop" aria-label="Cuaderno paso a paso">
        <header class="nb-head">
          <div class="nb-head-t"><span class="nb-kicker">CUADERNO DE APUNTES</span><h2 class="nb-h">${esc(nb.title)} paso a paso</h2></div>
          <div class="nb-actions">
            <button class="px-btn px-btn--hot" type="button" data-ai-explain>▶ EXPLICAR A DETALLE</button>
          </div>
        </header>
        <div class="nb-ai-status" data-ai-status hidden></div>
        <aside class="nb-comment nb-summary" data-comment="final" hidden></aside>
        ${sheets}
      </section>`;
  }

  // ---------- Texto plano para la IA ----------
  const strip = (s) => String(s).replace(/\[\/?(?:[rRpybk]|c\d)\]/g, '');

  function plain(l) {
    if (typeof l === 'string') return strip(l);
    if (l.type === 'row') return strip(l.hint ? `${l.text.trim()}   (${l.hint})` : l.text.trim());
    if (l.type === 'matrices') return l.items.map(([label, rows]) => `${label} [${rows.map((r) => r.join(' ')).join(' ; ')}]`).join('   ');
    if (l.type === 'svg') return l.text || '(gráfica de la región)';
    if (l.type === 'hmatrix') return SX.NetNB.plainH(l);
    if (l.type === 'dualTable') return '(tabla: Max variables ≥0/≤0/irrestricta ↔ Min restricciones ≥/≤/= ; Max restricciones ≤/≥/= ↔ Min variables ≥0/≤0/irrestricta)';
    if (l.type === 'map') return l.groups.map((g) => `${g.title}:\n${g.rows.map((r) => strip(`${r.left} → ${r.right} (${r.hint})`)).join('\n')}`).join('\n');
    return '';
  }

  function forAI(nb) {
    const out = [];
    nb.sheets.filter((sh) => sh.open).forEach((sh) => sh.steps.forEach((st) => {
      out.push({ id: st.id, title: `${sh.title} › ${st.title}`, body: st.lines.map(plain).filter(Boolean).join('\n') });
    }));
    return out;
  }

  // Limpia restos de LaTeX o markdown que a veces mandan los modelos.
  function humanize(text) {
    let s = String(text);
    for (let i = 0; i < 3; i++) s = s.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '$1/$2');
    s = s
      .replace(/\\\(|\\\)|\\\[|\\\]|\$\$?/g, '')
      .replace(/\\(?:text|mathrm|mathbf|mathit|operatorname|boldsymbol)\s*\{([^{}]*)\}/g, '$1')
      .replace(/\\leq?(?![a-z])/g, '≤')
      .replace(/\\geq?(?![a-z])/g, '≥')
      .replace(/\\neq(?![a-z])/g, '≠')
      .replace(/\\(?:cdot|times)(?![a-z])/g, '·')
      .replace(/\\(?:rightarrow|to|Rightarrow|implies)(?![a-z])/g, '→')
      .replace(/\\infty(?![a-z])/g, '∞')
      .replace(/\\pi(?![a-z])/g, 'π')
      .replace(/\\alpha(?![a-z])/g, 'α')
      .replace(/\\eta(?![a-z])/g, 'η')
      .replace(/\\sum(?![a-z])/g, 'Σ')
      .replace(/\^\{?-1\}?/g, '⁻¹')
      .replace(/\^\{?T\}?/g, 'ᵀ')
      .replace(/([A-Za-zπα])_\{?(\w+)\}?/g, '$1$2')
      .replace(/\\([A-Za-z]+)/g, '$1')
      .replace(/[{}]/g, '')
      .replace(/\*\*|__/g, '')
      .replace(/^\s*#+\s*/gm, '')
      .replace(/[ \t]{2,}/g, ' ');
    return s.trim();
  }

  SX.NB = { simplexNotebook, dualNotebook, render, forAI, humanize, ink };
})(typeof window !== 'undefined' ? window : globalThis);
