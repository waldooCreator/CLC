(function (root) {
  const SX = root.SX;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dec = (f) => (f && f.d !== undefined && f.d !== 1n ? ` <span class="dec">≈ ${f.toDecimal(4)}</span>` : '');
  const arcName = (a) => `${a.from}→${a.to}`;
  const capTxt = (c) => (c === null ? '∞' : `${c}`);

  const lose = (title, msg) => `<div class="banner banner-lose pop"><div class="banner-big">${title}</div><p>${esc(msg)}</p></div>`;
  const drawer = (title, body) => `<details class="stage stage-arcade"><summary>${title}</summary><div class="stage-body">${body}</div></details>`;
  const table = (head, rows, pick = () => false) => `<div class="scroll-x"><table class="dt"><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>${rows.map((r, i) => `<tr class="${pick(i) ? 'pick' : ''}">${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</table></div>`;

  function screenAssign(res, notebookHtml, verifyHtml = '') {
    const { model } = res;
    if (res.status !== 'optimal') return lose('GAME OVER', res.message) + verifyHtml + notebookHtml;
    const real = res.assignment.filter((a) => !a.dummy);
    const idle = res.assignment.filter((a) => a.dummy);
    const head = `
      <div class="banner banner-win pop">
        <div class="banner-row">
          <div>
            <div class="banner-kicker">★ ASIGNACIÓN ÓPTIMA ★</div>
            <div class="score">${model.sense === 'max' ? 'MAX' : 'MIN'} Z* = ${esc(res.total)}${dec(res.total)}</div>
          </div>
          <div class="vars">${real.map((a) => `<div class="var"><span>${esc(a.agent)}</span><b>${esc(a.task)}</b><span class="var-sub">${esc(a.value)}</span></div>`).join('')}</div>
        </div>
        ${idle.length ? `<p class="t-coin">${idle.map((a) => (a.agent ? `${esc(a.agent)} se queda sin tarea` : `${esc(a.task)} queda sin hacer`)).join(' · ')} (asignado a lo ficticio).</p>` : ''}
        ${res.alternative ? `<p class="t-coin">Hay óptimos múltiples: otra asignación con el mismo total es ${res.alternative.filter((a) => !res.prep.rows[a.row].dummy && !res.prep.cols[a.col].dummy).map((a) => `${esc(a.rowLabel)} → ${esc(a.colLabel)}`).join(', ')}.</p>` : ''}
      </div>`;
    const rounds = res.stages.map((s, i) => {
      if (s.type === 'rows') return ['1', 'restar el menor de cada fila', s.mins.map(SX.mstr).join(', ')];
      if (s.type === 'cols') return ['2', 'restar el menor de cada columna', s.mins.map(SX.mstr).join(', ')];
      if (s.type === 'cover') return ['3', `tapar ceros: ${s.count} línea${s.count === 1 ? '' : 's'} de ${s.n}`, s.count >= s.n ? 'listo para asignar' : 'faltan líneas'];
      return ['4', 'ajustar con el menor sin tapar', `k = ${SX.mstr(s.k)}`];
    });
    const arcade = drawer('MODO ARCADE · RONDAS DEL MÉTODO HÚNGARO', `
      ${res.prep.notes.length ? `<section class="box"><h3 class="box-title">PREPARACIÓN</h3><ul class="notes">${res.prep.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></section>` : ''}
      <section class="box"><h3 class="box-title">PASOS</h3>${table(['PASO', 'QUÉ SE HIZO', 'DATO'], rounds.map((r) => r.map(esc)), (i) => res.stages[i].type === 'adjust')}</section>
      <p class="small t-mute">Ajustes realizados: ${res.adjustments}. Tabla final de ${res.prep.n} × ${res.prep.n}.</p>`);
    return head + verifyHtml + notebookHtml + arcade;
  }

  function screenMaxflow(res, notebookHtml, verifyHtml = '') {
    const { model } = res;
    if (res.status !== 'optimal') return lose('∞ NO ACOTADO', res.message) + verifyHtml + notebookHtml;
    const head = `
      <div class="banner banner-win pop">
        <div class="banner-row">
          <div>
            <div class="banner-kicker">★ FLUJO MÁXIMO ★</div>
            <div class="score">${esc(model.source)} → ${esc(model.sink)} = ${esc(res.total)}${dec(res.total)}</div>
          </div>
          <div class="vars">
            <div class="var"><span>CAMINOS</span><b>${res.iterations.length}</b></div>
            <div class="var"><span>CORTE MÍNIMO</span><b>${esc(res.cut.cap)}</b></div>
          </div>
        </div>
        <p>Corte mínimo: ${res.cut.arcs.map((a) => `${esc(arcName(a))} (${esc(a.cap)})`).join(' + ')} = ${esc(res.cut.cap)} ${res.cut.ok ? '✓ igual al flujo máximo' : '✗'}</p>
      </div>
      <section class="box pop"><h3 class="box-title">FLUJO POR ARCO</h3>${table(['ARCO', 'FLUJO', 'CAPACIDAD', ''], res.arcs.map((a, k) => [esc(arcName(a)), esc(res.flow[k]), esc(capTxt(a.cap)), a.cap !== null && res.flow[k].cmp(a.cap) === 0 ? 'lleno' : '']), (k) => res.flow[k].sign() > 0)}</section>`;
    const arcade = drawer('MODO ARCADE · CAMINOS DE AUMENTO', table(['RONDA', 'CAMINO', 'CUELLO', 'FLUJO TOTAL'],
      res.iterations.map((it) => [it.index, esc(it.nodes.join(' → ')) + (it.usesBack ? ' <span class="t-hot">(devuelve)</span>' : ''), esc(it.delta), esc(it.total)])));
    return head + verifyHtml + notebookHtml + arcade;
  }

  function screenMincost(res, notebookHtml, verifyHtml = '') {
    if (res.status === 'infeasible') return lose('GAME OVER', res.message) + verifyHtml + notebookHtml;
    if (res.status !== 'optimal') return lose('ERROR', res.message) + verifyHtml + notebookHtml;
    const real = res.arcs.slice(0, res.nReal);
    const used = real.map((a, k) => ({ a, k })).filter(({ k }) => res.flow[k].sign() > 0);
    const head = `
      <div class="banner banner-win pop">
        <div class="banner-row">
          <div>
            <div class="banner-kicker">★ COSTO MÍNIMO ★</div>
            <div class="score">MIN Z* = ${esc(res.cost)}${dec(res.cost)}</div>
          </div>
          <div class="vars">
            <div class="var"><span>UNIDADES</span><b>${esc(res.S.cmp(res.D) > 0 ? res.D : res.S)}</b></div>
            <div class="var"><span>RUTAS</span><b>${res.iterations.length}</b></div>
          </div>
        </div>
        ${res.notes.map((n) => `<p class="t-coin">${esc(n)}</p>`).join('')}
      </div>
      <section class="box pop"><h3 class="box-title">ENVÍOS</h3>${table(['ARCO', 'UNIDADES', 'COSTO C/U', 'SUBTOTAL'], used.map(({ a, k }) => [esc(arcName(a)), esc(res.flow[k]), esc(a.cost), esc(res.flow[k].mul(a.cost))]))}</section>`;
    const arcade = drawer('MODO ARCADE · RUTAS MÁS BARATAS', table(['RONDA', 'RUTA', 'COSTO C/U', 'ENVÍO', 'ACUMULADO'],
      res.iterations.map((it) => [it.index, esc(it.nodes.map((v) => (v === SX.MC.DUMMY ? 'Ficticio' : v)).join(' → ')) + (it.usesBack ? ' <span class="t-hot">(devuelve)</span>' : ''), esc(it.unit), esc(it.delta), esc(it.cost)])));
    return head + verifyHtml + notebookHtml + arcade;
  }

  SX.NetUI = { screenAssign, screenMaxflow, screenMincost };
})(typeof window !== 'undefined' ? window : globalThis);
