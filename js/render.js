(function (root) {
  const SX = root.SX;
  const { Frac } = SX;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const str = (v) => (v === null || v === undefined ? '—' : v.toString());
  const dec = (f) => (f instanceof Frac && f.d !== 1n ? ` <span class="dec">≈ ${f.toDecimal(4)}</span>` : '');

  function matrix(rows, { rowLabels, colLabels, hlRow = -1, hlCol = -1 } = {}) {
    const nCols = rows[0] ? rows[0].length : 0;
    let html = '<table class="mx">';
    if (colLabels) {
      html += `<tr>${rowLabels ? '<th></th>' : ''}${colLabels.map((c, j) => `<th class="${j === hlCol ? 'hl' : ''}">${esc(c)}</th>`).join('')}</tr>`;
    }
    rows.forEach((row, i) => {
      const cls = [i === 0 ? 'bt' : '', i === rows.length - 1 ? 'bb' : ''].join(' ');
      html += `<tr class="${cls}">`;
      if (rowLabels) html += `<td class="rl ${i === hlRow ? 'hl' : ''}">${esc(rowLabels[i])}</td>`;
      row.forEach((v, j) => {
        const c = ['v', j === 0 ? 'bl' : '', j === nCols - 1 ? 'br' : '', i === hlRow || j === hlCol ? 'hl' : ''].join(' ');
        html += `<td class="${c}">${esc(str(v))}</td>`;
      });
      html += '</tr>';
    });
    return html + '</table>';
  }

  const vector = (values, labels, hl = -1) => matrix(values.map((v) => [v]), { rowLabels: labels, hlRow: hl });
  const eq = (label, body) => `<div class="eq"><span class="eq-l">${label}</span>${body}</div>`;

  function modelLines(model, { signs, tag = 'R' } = {}) {
    const R = SX.REL_TXT;
    const lines = [`<div class="ml-obj">${model.sense === 'max' ? 'Max' : 'Min'} ${model.objName || 'Z'} = ${esc(SX.linearExpr(model.c, model.varNames))}</div>`];
    lines.push('<div class="ml-sa">sujeto a:</div>');
    model.constraints.forEach((r, i) => {
      lines.push(`<div class="ml-row"><span class="ml-tag">${tag}${i + 1}</span>${esc(SX.linearExpr(r.a, model.varNames))} ${R[r.rel]} ${esc(r.b)}</div>`);
    });
    if (signs) {
      const groups = {};
      model.varNames.forEach((n, i) => (groups[signs[i]] = groups[signs[i]] || []).push(n));
      Object.entries(groups).forEach(([s, names]) => lines.push(`<div class="ml-row"><span class="ml-tag"></span>${esc(names.join(', '))} ${esc(SX.SIGN_TXT[s])}</div>`));
    } else {
      lines.push(`<div class="ml-row"><span class="ml-tag"></span>${esc(model.varNames.join(', '))} ≥ 0</div>`);
    }
    return `<div class="model">${lines.join('')}</div>`;
  }

  function stepList(steps) {
    return `<ol class="steps">${steps.map(([title, body], i) => `
      <li class="step"><div class="step-tag"><span>PASO ${i + 1}</span>${esc(title)}</div><div class="step-body">${body}</div></li>`).join('')}</ol>`;
  }

  function zLabel(phase, std) {
    if (phase.key === 'phase1') return 'W';
    return std.isMin ? '(−Z)' : 'Z';
  }

  function renderStandard(std) {
    const names = std.names;
    const basisNames = std.basis.map((j) => names[j]);
    return `
      <section class="box pop">
        <h3 class="box-title">FORMA ESTÁNDAR</h3>
        <ul class="notes">${std.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
        <div class="model">
          <div class="ml-obj">${esc(std.objective)}</div>
          <div class="ml-sa">sujeto a:</div>
          ${std.equations.map((e, i) => `<div class="ml-row"><span class="ml-tag">R${i + 1}</span>${esc(e)}</div>`).join('')}
          <div class="ml-row"><span class="ml-tag"></span>todas las variables ≥ 0</div>
        </div>
        <div class="eqs scroll-x">
          ${eq('A =', matrix(std.A, { colLabels: names, rowLabels: std.A.map((_, i) => `R${i + 1}`) }))}
          ${eq('b =', vector(std.b))}
        </div>
        <p class="lead">Base inicial: <b class="t-coin">{ ${esc(basisNames.join(', '))} }</b>. Sus columnas en A forman la matriz identidad, por eso al inicio <b>B = I</b> y <b>B⁻¹ = I</b>.</p>
      </section>`;
  }

  function renderIteration(it, std, phase) {
    const names = std.names;
    const bn = it.basis.map((j) => names[j]);
    const zl = zLabel(phase, std);
    const rowNames = it.pi.map((_, i) => `R${i + 1}`);
    const steps = [];

    steps.push(['BASE ACTUAL', `
      <p>Variables básicas: <b class="t-coin">${esc(bn.join(', '))}</b>. B se forma con sus columnas de A.</p>
      <div class="eqs scroll-x">${eq('B =', matrix(it.B, { colLabels: bn }))}${eq('B⁻¹ =', matrix(it.Binv))}</div>`]);

    steps.push(['VALOR DE LAS BÁSICAS', `
      <p>x<sub>B</sub> = B⁻¹ · b &nbsp;y&nbsp; ${zl} = c<sub>B</sub> · x<sub>B</sub></p>
      <div class="eqs scroll-x">${eq('x<sub>B</sub> =', vector(it.xB, bn))}${eq('c<sub>B</sub> =', matrix([it.cB], { colLabels: bn }))}</div>
      <p class="score-inline">${zl} = <b>${esc(it.Z)}</b></p>`]);

    steps.push(['MULTIPLICADORES SIMPLEX', `
      <p>π = c<sub>B</sub> · B⁻¹ (son los precios duales de esta base).</p>
      <div class="eqs scroll-x">${eq('π =', matrix([it.pi], { colLabels: rowNames }))}</div>`]);

    const enterIdx = it.entering;
    steps.push(['COSTOS REDUCIDOS', `
      <p>Para cada variable no básica: z<sub>j</sub> = π · a<sub>j</sub> y se calcula z<sub>j</sub> − c<sub>j</sub>. Si alguno es negativo, Z todavía puede mejorar.</p>
      <div class="scroll-x"><table class="dt">
        <tr><th>VARIABLE</th><th>c<sub>j</sub></th><th>z<sub>j</sub> = π·a<sub>j</sub></th><th>z<sub>j</sub> − c<sub>j</sub></th></tr>
        ${it.reduced.map((r) => `<tr class="${r.j === enterIdx ? 'pick' : ''}"><td>${esc(names[r.j])}</td><td>${esc(phase.costs[r.j])}</td><td>${esc(r.z)}</td><td class="${r.zc.sign() < 0 ? 't-hot' : ''}">${esc(r.zc)}</td></tr>`).join('')}
      </table></div>`]);

    if (it.status === 'optimal') {
      steps.push(['PRUEBA DE OPTIMALIDAD', `<p class="verdict t-win">Todos los z<sub>j</sub> − c<sub>j</sub> son ≥ 0 → no hay variable que mejore ${zl}. <b>ESTA BASE ES ÓPTIMA.</b></p>`]);
    } else {
      const en = names[enterIdx];
      const entering = it.reduced.find((r) => r.j === enterIdx);
      steps.push(['VARIABLE QUE ENTRA', `<p class="verdict">Entra <b class="t-coin">${esc(en)}</b> ${it.rule === 'bland'
        ? `(regla de Bland: la primera con z<sub>j</sub> − c<sub>j</sub> &lt; 0, para evitar ciclos).`
        : `porque tiene el z<sub>j</sub> − c<sub>j</sub> más negativo (${esc(entering.zc)}).`}</p>`]);
      steps.push(['COLUMNA ACTUALIZADA', `
        <p>α = B⁻¹ · a<sub>${esc(en)}</sub>: indica cuánto cambia cada básica cuando ${esc(en)} aumenta.</p>
        <div class="eqs scroll-x">${eq(`α =`, vector(it.alpha, bn, it.leavingRow ?? -1))}</div>`]);
      steps.push(['PRUEBA DE LA RAZÓN MÍNIMA', `
        <p>Solo con α<sub>i</sub> &gt; 0 se calcula x<sub>B</sub> / α. La menor razón indica qué variable sale.</p>
        <div class="scroll-x"><table class="dt">
          <tr><th>BÁSICA</th><th>x<sub>B</sub></th><th>α</th><th>RAZÓN</th></tr>
          ${bn.map((n, i) => `<tr class="${i === it.leavingRow ? 'pick' : ''}"><td>${esc(n)}</td><td>${esc(it.xB[i])}</td><td>${esc(it.alpha[i])}</td><td>${it.ratios[i] === null ? '<span class="t-mute">no aplica</span>' : esc(it.ratios[i])}</td></tr>`).join('')}
        </table></div>
        ${it.status === 'unbounded'
          ? `<p class="verdict t-lose">Ningún α<sub>i</sub> es positivo: ${esc(en)} puede crecer sin límite. <b>PROBLEMA NO ACOTADO.</b></p>`
          : `<p class="verdict">Sale <b class="t-hot">${esc(names[it.leaving])}</b> (razón mínima = ${esc(it.ratios[it.leavingRow])}).${it.degenerate ? ' <span class="t-coin">La razón es 0: iteración degenerada (Z no cambia).</span>' : ''}</p>`}`]);
      if (it.status === 'continue') {
        const r = it.leavingRow;
        steps.push(['NUEVA B⁻¹ (FORMA PRODUCTO)', `
          <p>E es la identidad con la columna ${r + 1} reemplazada por η: η<sub>${r + 1}</sub> = 1/α<sub>${r + 1}</sub> y η<sub>i</sub> = −α<sub>i</sub>/α<sub>${r + 1}</sub>. Luego B⁻¹<sub>nueva</sub> = E · B⁻¹.</p>
          <div class="eqs scroll-x">${eq('E =', matrix(it.E, { hlCol: r }))}${eq('B⁻¹<sub>nueva</sub> =', matrix(it.newBinv))}</div>`]);
      }
    }

    const chip = it.status === 'optimal'
      ? '<span class="chip chip-win">ÓPTIMO</span>'
      : it.status === 'unbounded'
        ? '<span class="chip chip-lose">NO ACOTADO</span>'
        : `<span class="chip">ENTRA ${esc(names[it.entering])} · SALE ${esc(names[it.leaving])}</span>`;

    return `
      <details class="round pop" open>
        <summary><span class="round-n">RONDA ${String(it.index).padStart(2, '0')}</span><span class="round-z">${zl} = ${esc(it.Z)}</span>${chip}</summary>
        ${stepList(steps)}
      </details>`;
  }

  function renderAdjustments(adj, std) {
    if (!adj || !adj.length) return '';
    const names = std.names;
    return `<section class="box pop"><h3 class="box-title">SACAR ARTIFICIALES DE LA BASE</h3>${adj.map((a) => a.type === 'redundant'
      ? `<p class="lead">${esc(names[a.col])} sigue básica con valor 0 y no se puede reemplazar: la restricción R${a.row + 1} es <b>redundante</b>. Se deja en la base con valor 0 y no puede volver a entrar.</p>`
      : `<p class="lead">${esc(names[a.from])} quedó básica con valor 0. Se hace un pivote para cambiarla por <b class="t-coin">${esc(names[a.to])}</b> (su elemento en la fila ${a.row + 1} de B⁻¹A es distinto de 0).</p>
         <div class="eqs scroll-x">${eq('E =', matrix(a.E, { hlCol: a.row }))}${eq('B⁻¹<sub>nueva</sub> =', matrix(a.newBinv))}</div>`).join('')}</section>`;
  }

  function renderSummary(res, model) {
    if (res.status === 'infeasible') return `<div class="banner banner-lose pop"><div class="banner-big">GAME OVER</div><p>${esc(res.message)}</p></div>`;
    if (res.status === 'unbounded') return `<div class="banner banner-lose pop"><div class="banner-big">∞ NO ACOTADO</div><p>${esc(res.message)}</p></div>`;
    if (res.status === 'error') return `<div class="banner banner-lose pop"><div class="banner-big">ERROR</div><p>${esc(res.message)}</p></div>`;
    const s = res.solution;
    const R = SX.REL_TXT;
    return `
      <div class="banner banner-win pop">
        <div class="banner-row">
          <div>
            <div class="banner-kicker">★ SOLUCIÓN ÓPTIMA ★</div>
            <div class="score">${model.sense === 'max' ? 'MAX' : 'MIN'} Z* = ${esc(s.Z)}${dec(s.Z)}</div>
          </div>
          <div class="vars">${s.decision.map((d) => `<div class="var"><span>${esc(d.name)}</span><b>${esc(d.value)}</b>${dec(d.value)}</div>`).join('')}</div>
        </div>
        ${res.alternative ? '<p class="t-coin">Hay una variable no básica con z<sub>j</sub> − c<sub>j</sub> = 0: existen soluciones óptimas alternativas.</p>' : ''}
        ${(res.warnings || []).map((w) => `<p class="t-coin">${esc(w)}</p>`).join('')}
      </div>
      <div class="grid-2 pop">
        <section class="box">
          <h3 class="box-title">VARIABLES DE HOLGURA / EXCESO</h3>
          <div class="scroll-x"><table class="dt">
            <tr><th>VARIABLE</th><th>VALOR</th></tr>
            ${s.extra.map((e) => `<tr><td>${esc(e.name)} <span class="t-mute">${{ slack: 'holgura', surplus: 'exceso', artificial: 'artificial' }[e.kind]}</span></td><td>${esc(e.value)}</td></tr>`).join('')}
          </table></div>
        </section>
        <section class="box">
          <h3 class="box-title">PRECIOS SOMBRA (DUALES)</h3>
          <div class="scroll-x"><table class="dt">
            <tr><th>RESTRICCIÓN</th><th>y<sub>i</sub></th></tr>
            ${model.constraints.map((r, i) => `<tr><td>R${i + 1} (${R[r.rel]} ${esc(r.b)})</td><td>${esc(s.duals[i])}</td></tr>`).join('')}
          </table></div>
          <p class="small">Cuánto cambia Z* si el lado derecho de la restricción aumenta en 1 unidad (dentro de su rango de validez).</p>
        </section>
      </div>`;
  }

  function renderReplay(res) {
    const methodTxt = res.method === 'bigM' ? 'GRAN M' : 'DOS FASES';
    let html = `<h2 class="replay-title">MATRICES DE CADA RONDA <span class="t-mute">· ${methodTxt}</span></h2>`;
    if (res.subst && res.subst.changed) {
      html += `<section class="box pop"><h3 class="box-title">SUSTITUCIÓN DE VARIABLES</h3><ul class="notes">${res.subst.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></section>`;
    }
    html += renderStandard(res.std);
    res.phases.forEach((phase) => {
      html += `<h3 class="phase-title">${esc(phase.title)}</h3>`;
      if (phase.key === 'phase1') {
        html += `<p class="lead">Costos de la Fase 1: −1 para cada artificial y 0 para las demás. Objetivo: Max W = ${esc(SX.mLinearExpr(phase.costs, res.std.names))}.</p>`;
      }
      if (phase.key === 'phase2' && res.std.hasArt) {
        html += '<p class="lead">Se parte de la base y la B⁻¹ finales de la Fase 1. Se usan los costos originales y las artificiales ya no pueden entrar.</p>';
      }
      html += phase.iterations.map((it) => renderIteration(it, res.std, phase)).join('');
      html += renderAdjustments(phase.adjustments, res.std);
    });
    return html;
  }

  function dualHeader(d, model) {
    const { dual, check } = d;
    let html = `<div class="banner banner-duo pop"><div class="banner-kicker">2 PLAYERS</div><div class="banner-big">PRIMAL <span class="t-mute">vs</span> DUAL</div></div>`;

    if (check) {
      html += `
        <div class="versus pop">
          <div class="vs-card"><div class="vs-name">PRIMAL</div><div class="score">${model.sense === 'max' ? 'MAX' : 'MIN'} Z* = ${esc(check.Z)}</div>
            <div class="vars">${check.x.map((v, j) => `<div class="var"><span>${esc(model.varNames[j])}</span><b>${esc(v)}</b></div>`).join('')}</div></div>
          <div class="vs-mid ${check.strong ? 't-win' : 't-lose'}">${check.strong ? 'Z* = W*' : 'Z* ≠ W*'}</div>
          <div class="vs-card"><div class="vs-name">DUAL</div><div class="score">${dual.sense === 'max' ? 'MAX' : 'MIN'} W* = ${esc(check.W)}</div>
            <div class="vars">${check.y.map((v, i) => `<div class="var"><span>${esc(dual.varNames[i])}</span><b>${esc(v)}</b></div>`).join('')}</div></div>
        </div>
        <p class="lead ${check.strong ? 't-win' : 't-lose'}">${check.strong ? '✓ Teorema de dualidad fuerte: los dos óptimos valen lo mismo.' : 'Los óptimos no coinciden; revisa el modelo.'}</p>`;
    } else {
      html += `<div class="banner banner-lose pop"><div class="banner-big">SIN ÓPTIMO FINITO</div><p>Primal: ${esc(d.primal.status)} · Dual: ${esc(d.dualRes.status)}</p><p>${esc(d.theory)}</p></div>`;
    }

    return html;
  }

  function dualArcade(d, model) {
    const { dual, conv, check } = d;
    const At = dual.constraints.map((r) => r.a);
    let html = `<h2 class="replay-title">CONSTRUCCIÓN DEL DUAL</h2>
      <div class="grid-2 pop">
        <section class="box"><h3 class="box-title">PRIMAL</h3>${modelLines(model, { signs: model.varSigns })}</section>
        <section class="box"><h3 class="box-title">DUAL</h3>${modelLines({ ...dual, objName: 'W' }, { signs: dual.varSigns, tag: 'D' })}</section>
      </div>
      <section class="box pop">
        <h3 class="box-title">REGLAS APLICADAS</h3>
        <ol class="rules">${dual.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ol>
        <div class="eqs scroll-x">
          ${eq('A =', matrix(model.constraints.map((r) => r.a), { colLabels: model.varNames, rowLabels: model.constraints.map((_, i) => `R${i + 1}`) }))}
          ${eq('Aᵀ =', matrix(At, { colLabels: dual.varNames, rowLabels: model.varNames.map((_, j) => `D${j + 1}`) }))}
        </div>
      </section>
      <section class="box pop">
        <h3 class="box-title">PREPARAR EL DUAL PARA EL SIMPLEX</h3>
        ${conv.notes.length
          ? `<ul class="notes">${conv.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>${modelLines({ ...conv.model, objName: 'W' }, { tag: 'D' })}`
          : '<p class="lead">Todas las variables duales ya son ≥ 0, así que el dual se resuelve tal como está.</p>'}
      </section>`;

    if (check) {
      html += `
        <section class="box pop">
          <h3 class="box-title">VERIFICACIÓN CON LA TABLA FINAL DEL PRIMAL</h3>
          <p class="lead">Los multiplicadores π = c<sub>B</sub>·B⁻¹ de la base óptima del primal (con los signos del modelo original) dan: <b class="t-coin">y = (${esc(check.yFromPrimal.join(', '))})</b>.</p>
          <p class="lead ${check.sameY ? 't-win' : 't-coin'}">${check.sameY
            ? '✓ Es la misma solución que se obtuvo resolviendo el dual directamente.'
            : 'El simplex del dual encontró otra solución, que también es óptima (W* es el mismo): el dual tiene soluciones óptimas múltiples.'}</p>
        </section>
        <div class="grid-2 pop">
          <section class="box">
            <h3 class="box-title">HOLGURA COMPLEMENTARIA I</h3>
            <p class="small">y<sub>i</sub> · (b<sub>i</sub> − a<sub>i</sub>x) = 0 para cada restricción.</p>
            <div class="scroll-x"><table class="dt"><tr><th>R</th><th>y<sub>i</sub></th><th>HOLGURA</th><th>PRODUCTO</th></tr>
              ${check.cs1.map((c, i) => `<tr><td>R${i + 1}</td><td>${esc(c.y)}</td><td>${esc(c.slack)}</td><td class="${c.prod.isZero() ? 't-win' : 't-lose'}">${esc(c.prod)}</td></tr>`).join('')}
            </table></div>
          </section>
          <section class="box">
            <h3 class="box-title">HOLGURA COMPLEMENTARIA II</h3>
            <p class="small">x<sub>j</sub> · (a<sub>j</sub>ᵀy − c<sub>j</sub>) = 0 para cada variable primal.</p>
            <div class="scroll-x"><table class="dt"><tr><th>x</th><th>VALOR</th><th>EXCESO DUAL</th><th>PRODUCTO</th></tr>
              ${check.cs2.map((c) => `<tr><td>${esc(c.name)}</td><td>${esc(c.x)}</td><td>${esc(c.surplus)}</td><td class="${c.prod.isZero() ? 't-win' : 't-lose'}">${esc(c.prod)}</td></tr>`).join('')}
            </table></div>
          </section>
        </div>`;
    }

    html += `
      <details class="stage"><summary>MATRICES · SIMPLEX REVISADO DEL DUAL</summary><div class="stage-body">${renderReplay(d.dualRes)}</div></details>
      <details class="stage"><summary>MATRICES · SIMPLEX REVISADO DEL PRIMAL</summary><div class="stage-body">${renderReplay(d.primal)}</div></details>`;
    return html;
  }

  const arcadeDrawer = (title, body) =>
    `<details class="stage stage-arcade"><summary>${title}</summary><div class="stage-body">${body}</div></details>`;

  const screenSimplex = (res, model, notebookHtml, verifyHtml = '') =>
    renderSummary(res, model) + verifyHtml + notebookHtml + arcadeDrawer('MODO ARCADE · MATRICES DE CADA RONDA', renderReplay(res));

  const screenDual = (d, model, notebookHtml, verifyHtml = '') =>
    dualHeader(d, model) + verifyHtml + notebookHtml + arcadeDrawer('MODO ARCADE · CONSTRUCCIÓN Y MATRICES', dualArcade(d, model));

  SX.UI = { esc, screenSimplex, screenDual };
})(typeof window !== 'undefined' ? window : globalThis);
