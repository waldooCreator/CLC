(function (root) {
  const SX = root.SX;
  const { Frac } = SX;

  const row = (text, hint = '') => ({ type: 'row', text, hint });
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ms = (v) => SX.mstr(v);
  const arcName = (a) => `${a.from}→${a.to}`;
  const capTxt = (c) => (c === null ? '∞' : `${c}`);
  const sum = (list) => list.reduce((acc, v) => acc.add(v), Frac.ZERO);
  const plus = (list) => list.map((v, i) => (i && String(v).startsWith('-') ? ` − ${String(v).slice(1)}` : `${i ? ' + ' : ''}${v}`)).join('');

  // Tabla del método húngaro: ceros, líneas que los tapan y asignación en círculo.
  const hmatrix = (res, M, extra = {}) => ({
    type: 'hmatrix',
    rowLabels: res.prep.rows.map((r) => r.label),
    colLabels: res.prep.cols.map((c) => c.label),
    cells: M.map((r) => r.map(ms)),
    zeros: extra.zeros !== false,
    lines: extra.lines || null,
    assigned: extra.assigned || [],
    side: extra.side || null,
    bottom: extra.bottom || null,
    sideTitle: extra.sideTitle || '',
    bottomTitle: extra.bottomTitle || '',
    dummyRows: res.prep.rows.map((r) => r.dummy),
    dummyCols: res.prep.cols.map((c) => c.dummy),
  });

  // ---------- Asignación (Kuhn-Munkres) ----------
  function assignNotebook(res) {
    const { model, prep } = res;
    const steps = [];
    const n = prep.n;

    const P = [];
    P.push(row(`[y]${model.sense === 'max' ? 'Maximizar' : 'Minimizar'} el ${model.sense === 'max' ? 'beneficio' : 'costo'} total[/y]`, 'cada agente hace una tarea'));
    P.push({ type: 'hmatrix', rowLabels: model.agents, colLabels: model.tasks, cells: model.cost.map((r) => r.map((v) => (v === null ? '✕' : `${v}`))), zeros: false, lines: null, assigned: [], side: prep.cap.some((k) => k > 1) ? prep.cap.map(String) : null, sideTitle: 'tareas' });
    P.push(row(`${model.agents.length} agentes y ${model.tasks.length} tareas`, model.agents.length === model.tasks.length && !prep.cap.some((k) => k > 1) ? 'tabla cuadrada: está balanceado' : 'hay que preparar la tabla'));
    if (prep.forbidden) P.push(row('✕ = no se puede asignar', 'asignación prohibida'));
    steps.push({ id: 'a-plan', title: 'El problema', lines: P });

    if (prep.notes.length) {
      const L = prep.notes.map((t) => row(t));
      if (prep.isMax) L.push(row(`[y]pérdida = ${prep.top} − valor[/y]`, 'minimizar la pérdida = maximizar la ganancia'));
      L.push(hmatrix(res, prep.M, { zeros: false }));
      L.push(row(`tabla de ${n} × ${n}`, 'ya es cuadrada'));
      steps.push({ id: 'a-prep', title: 'Preparar la tabla (casos particulares)', lines: L });
    }

    res.stages.forEach((st, idx) => {
      if (st.type === 'rows') {
        const changed = st.mins.some((m) => !m.isZero());
        steps.push({
          id: 'a-rows', title: 'Paso 1 · Restar el menor de cada fila', lines: [
            hmatrix(res, st.before, { zeros: false, side: st.mins.map(ms), sideTitle: 'menor' }),
            row(changed ? 'a cada número de la fila le resto el menor de su fila' : 'todas las filas ya tienen un 0', changed ? 'así cada fila tiene al menos un 0' : 'no cambia nada'),
            ...(changed ? [hmatrix(res, st.after)] : []),
          ],
        });
      } else if (st.type === 'cols') {
        const changed = st.mins.some((m) => !m.isZero());
        steps.push({
          id: 'a-cols', title: 'Paso 2 · Restar el menor de cada columna', lines: [
            hmatrix(res, st.before, { bottom: st.mins.map(ms), bottomTitle: 'menor' }),
            row(changed ? 'a cada columna le resto su menor' : 'todas las columnas ya tienen un 0', changed ? 'así cada columna tiene al menos un 0' : 'no cambia nada'),
            ...(changed ? [hmatrix(res, st.after)] : []),
          ],
        });
      } else if (st.type === 'cover') {
        const round = res.stages.slice(0, idx).filter((s) => s.type === 'cover').length + 1;
        const names = [
          ...st.lines.rows.map((i) => `fila ${res.prep.rows[i].label}`),
          ...st.lines.cols.map((j) => `columna ${res.prep.cols[j].label}`),
        ];
        steps.push({
          id: `a-cover${round}`, title: `Paso 3 · Tapar los ceros con el menor número de líneas${round > 1 ? ` (otra vez)` : ''}`, lines: [
            hmatrix(res, st.matrix, { lines: st.lines }),
            row(`líneas: ${names.join(', ')}`),
            st.count >= st.n
              ? row(`[y]${st.count} líneas = ${st.n} filas → ya se puede asignar[/y]`, 'hay un cero para cada fila')
              : row(`[r]${st.count} líneas < ${st.n} filas → todavía no[/r]`, 'hay que crear más ceros'),
          ],
        });
      } else if (st.type === 'adjust') {
        const round = res.stages.slice(0, idx).filter((s) => s.type === 'adjust').length + 1;
        steps.push({
          id: `a-adj${round}`, title: 'Paso 4 · Ajustar con el menor número sin tapar', lines: [
            row(`[y]k = ${ms(st.k)}[/y]`, 'el menor de los números que no tiene ninguna línea'),
            row(`a los números sin tapar les resto ${ms(st.k)}`, 'aparece al menos un cero nuevo'),
            row(`a los cruces de dos líneas les sumo ${ms(st.k)}`, 'lo tapado una vez no cambia'),
            hmatrix(res, st.after),
          ],
        });
      }
    });

    const why = { row: 'único cero libre de su fila', col: 'único cero libre de su columna', choice: 'había varios: elijo uno', match: 'búsqueda de ceros independientes' };
    const A = [hmatrix(res, res.final, { assigned: res.assignment.map((a) => [a.row, a.col]) })];
    res.order.forEach((o, i) => A.push(row(`${i + 1}) ${res.prep.rows[o.row].label} → ${res.prep.cols[o.col].label}`, `${why[o.reason]} · tacho su fila y su columna`)));
    steps.push({ id: 'a-assign', title: 'Paso 5 · Asignar un cero por fila y columna', lines: A });

    const F = [];
    if (res.status === 'optimal') {
      const real = res.assignment.filter((a) => !a.dummy);
      real.forEach((a) => F.push(row(`${a.agent} → ${a.task}`, `${model.sense === 'max' ? 'gana' : 'cuesta'} ${a.value}`)));
      res.assignment.filter((a) => a.dummy).forEach((a) => F.push(row(`${a.rowLabel} → ${a.colLabel}`, a.agent ? `${a.agent} se queda sin tarea` : `${a.task} queda sin hacer`)));
      F.push(row(`[y]${model.sense === 'max' ? 'Beneficio' : 'Costo'} total = ${plus(real.map((a) => a.value))} = ${res.total}[/y]`, 'con los valores originales'));
      if (res.alternative) F.push(row('hay otra asignación con el mismo total', 'óptimos múltiples'));
    } else {
      F.push(row(`[r]${res.message}[/r]`));
    }
    steps.push({ id: 'a-res', title: 'Resultado', lines: F });

    const lp = SX.NetLP.assignLP(model);
    const L = [
      row(`[y]${model.sense === 'max' ? 'Max' : 'Min'} Z = ${SX.linearExpr(lp.c, lp.varNames)}[/y]`, 'xij = 1 si el agente i hace la tarea j'),
      ...lp.constraints.map((c) => row(`   ${SX.linearExpr(c.a, lp.varNames)} ${SX.REL_TXT[c.rel]} ${c.b}`)),
      row('   xij ≥ 0', 'el resultado sale con 0 y 1 solos'),
    ];
    return {
      title: 'Asignación · Kuhn-Munkres',
      sheets: [
        { title: 'Método húngaro', open: true, steps },
        { title: 'El mismo problema como programación lineal', open: false, steps: [{ id: 'a-lp', title: 'Modelo de PL equivalente', lines: L }] },
      ],
    };
  }

  // ---------- Flujo máximo ----------
  function maxflowNotebook(res, { layout } = {}) {
    const { arcs, nodes, model } = res;
    const roles = { [model.source]: 'src', [model.sink]: 'snk' };
    const drawNet = (o) => ({ type: 'svg', text: '(dibujo de la red)', html: SX.NetDraw.draw({ nodes, arcs, layout, roles, starts: [model.source], ...o }) });
    const steps = [];

    steps.push({
      id: 'f-plan', title: 'La red', lines: [
        drawNet({ labels: arcs.map((a) => capTxt(a.cap)), title: 'Red con capacidades' }),
        row(`[y]sacar lo más posible de ${model.source} y llevarlo a ${model.sink}[/y]`, `fuente ${model.source} · sumidero ${model.sink}`),
        row(arcs.map((a) => `${arcName(a)}: ${capTxt(a.cap)}`).join('   '), 'capacidad de cada arco'),
        row('al inicio todo el flujo vale 0'),
      ],
    });

    res.iterations.forEach((it) => {
      const L = [drawNet({ labels: arcs.map((a, k) => `${it.after[k]}/${capTxt(a.cap)}`), path: it.path, used: it.after.map((f) => f.sign() > 0), title: `Camino ${it.index}` })];
      L.push(row(`[y]${it.nodes.join(' → ')}[/y]`, 'el camino con menos arcos que todavía tiene espacio'));
      L.push(row(it.path.map((e) => (e.dir === 1 ? `${e.from}→${e.to}: ${capTxt(e.res)}` : `[r]${e.from}→${e.to}: ${e.res}[/r]`)).join('   '), 'lo que cabe en cada tramo'));
      if (it.usesBack) {
        it.path.filter((e) => e.dir === -1).forEach((e) => L.push(row(`[r]${e.from}→${e.to} es ${arcs[e.arc].from}→${arcs[e.arc].to} al revés[/r]`, `devuelvo ${it.delta} que ya iban por ahí`)));
      }
      L.push(row(`cuello de botella = mín(${it.path.map((e) => capTxt(e.res)).join(', ')}) = [y]${it.delta}[/y]`, 'el tramo más angosto manda'));
      L.push(row(`flujo total = ${it.total}`, `sumo ${it.delta}`));
      steps.push({ id: `f-it${it.index}`, title: `Camino de aumento ${it.index}`, lines: L });
    });

    if (res.status === 'optimal') {
      const { cut } = res;
      steps.push({
        id: 'f-cut', title: 'Ya no hay camino: corte mínimo', lines: [
          drawNet({ labels: arcs.map((a, k) => `${res.flow[k]}/${capTxt(a.cap)}`), cutS: cut.S, cutArcs: cut.arcs.map((a) => a.k), used: res.flow.map((f) => f.sign() > 0), title: 'Corte mínimo' }),
          row(`desde ${model.source} solo llego a {${cut.S.join(', ')}}`, `${model.sink} ya no se alcanza`),
          row(`arcos que cruzan: ${cut.arcs.map((a) => `${arcName(a)} (${a.cap})`).join(', ')}`, 'todos van llenos'),
          row(`[y]capacidad del corte = ${plus(cut.arcs.map((a) => a.cap))} = ${cut.cap}[/y]`, cut.ok ? 'igual al flujo máximo ✓' : '[r]no coincide[/r]'),
        ],
      });
      steps.push({
        id: 'f-res', title: 'Resultado', lines: [
          row(`[y]Flujo máximo = ${res.total}[/y]`, `de ${model.source} a ${model.sink}`),
          ...arcs.map((a, k) => row(`${arcName(a)}: ${res.flow[k]} de ${capTxt(a.cap)}`, a.cap !== null && res.flow[k].cmp(a.cap) === 0 ? 'lleno' : res.flow[k].isZero() ? 'sin usar' : '')),
        ],
      });
    } else {
      steps.push({ id: 'f-res', title: 'Resultado', lines: [row(`[r]${res.message}[/r]`)] });
    }

    const lp = SX.NetLP.maxflowLP(model);
    const L = [
      row(`[y]Max Z = ${SX.linearExpr(lp.c, lp.varNames)}[/y]`, `lo que sale de ${model.source}`),
      ...lp.constraints.map((c) => row(`   ${SX.linearExpr(c.a, lp.varNames)} ${SX.REL_TXT[c.rel]} ${c.b}`)),
      row('   todos los flujos ≥ 0', 'capacidad: ≤ · conservación: entra = sale'),
    ];
    return {
      title: 'Flujo máximo',
      sheets: [
        { title: 'Caminos de aumento (Ford-Fulkerson)', open: true, steps },
        { title: 'El mismo problema como programación lineal', open: false, steps: [{ id: 'f-lp', title: 'Modelo de PL equivalente', lines: L }] },
      ],
    };
  }

  // ---------- Flujo a costo mínimo ----------
  function mincostNotebook(res, { layout } = {}) {
    const { model, order, supply } = res;
    const real = res.arcs.slice(0, res.nReal);
    const und = model.undirected || 0;
    const nodes = order.filter((v) => v !== SX.MC.DUMMY);
    const roles = {};
    const notes = {};
    nodes.forEach((v) => {
      const b = supply.get(v);
      if (b.sign() > 0) { roles[v] = 'sup'; notes[v] = `+${b}`; }
      if (b.sign() < 0) { roles[v] = 'dem'; notes[v] = `${b}`; }
    });
    const drawNet = (o) => ({ type: 'svg', text: '(dibujo de la red)', html: SX.NetDraw.draw({ nodes, arcs: real, layout, roles, nodeNotes: notes, undirected: und, starts: nodes.filter((v) => roles[v] === 'sup'), ...o }) });
    const shown = und ? real.slice(0, und) : real;
    const steps = [];

    steps.push({
      id: 'm-plan', title: 'La red', lines: [
        drawNet({ labels: shown.map((a) => (a.cap === null ? `$${a.cost}` : `$${a.cost} (≤${a.cap})`)), title: 'Red con costos' }),
        row('[y]mandar todo lo que se pide gastando lo menos posible[/y]', 'costo por unidad en cada arco'),
        row(nodes.filter((v) => roles[v]).map((v) => `${v}: ${notes[v]}`).join('   '), '+ ofrece · − pide'),
        ...(und ? [row('cada conexión se puede usar en los dos sentidos', 'red no dirigida')] : []),
        row(shown.filter((a) => a.cap !== null).length ? `límites: ${shown.filter((a) => a.cap !== null).map((a) => `${arcName(a)} ≤ ${a.cap}`).join(', ')}` : 'ningún arco tiene límite', 'capacidad'),
      ],
    });

    const P = [row(`ofrecen ${res.S} · piden ${res.D}`, res.S.cmp(res.D) === 0 ? 'está balanceado' : 'no está balanceado')];
    res.notes.forEach((t) => P.push(row(t)));
    P.push(row(`todas las ofertas salen de un punto inicial ${SX.MC.SRC} y todas las demandas llegan a ${SX.MC.SNK}`, 'así se busca una sola ruta a la vez'));
    steps.push({ id: 'm-prep', title: 'Preparar la red', lines: P });

    const dummyName = (v) => (v === SX.MC.DUMMY ? 'Ficticio' : v);
    res.iterations.forEach((it) => {
      const L = [drawNet({ labels: shown.map((a, k) => { const f = und ? it.after[k].add(it.after[k + und]) : it.after[k]; return f.isZero() ? `$${a.cost}` : `${f} u · $${a.cost}`; }), path: it.inner.filter((e) => e.arc < res.nReal), used: it.after.slice(0, res.nReal).map((f) => f.sign() > 0), title: `Ruta ${it.index}` })];
      L.push(row(`[y]${it.nodes.map(dummyName).join(' → ')}[/y]`, 'la ruta más barata que todavía tiene espacio'));
      const costs = it.inner.map((e) => (e.dir === 1 ? res.arcs[e.arc].cost : res.arcs[e.arc].cost.neg()));
      L.push(row(`costo por unidad = ${costs.length > 1 ? `${plus(costs)} = ` : ''}${it.unit}`, it.usesBack ? 'un tramo al revés resta su costo' : 'sumo el costo de cada tramo'));
      if (it.usesBack) it.inner.filter((e) => e.dir === -1).forEach((e) => L.push(row(`[r]${e.from}→${e.to} deshace ${res.arcs[e.arc].from}→${res.arcs[e.arc].to}[/r]`, `ahorro ${res.arcs[e.arc].cost} por unidad`)));
      const limits = it.path.map((e) => {
        const a = res.arcs[e.arc];
        if (a.kind === 'super') return `${a.from === SX.MC.SRC ? `le quedan a ${dummyName(a.to)}` : `le faltan a ${dummyName(a.from)}`} ${e.res}`;
        return `${e.from}→${e.to}: ${capTxt(e.res)}`;
      });
      L.push(row(`envío = mín(${limits.join(', ')}) = [y]${it.delta}[/y]`, 'lo que permite el tramo más corto'));
      L.push(row(`costo = ${it.unit} × ${it.delta} = ${it.partial}   acumulado = ${it.cost}`, `ya van ${it.sent} de ${res.S.cmp(res.D) > 0 ? res.S : res.D} unidades`));
      steps.push({ id: `m-it${it.index}`, title: `Ruta más barata ${it.index}`, lines: L });
    });

    const F = [];
    if (res.status === 'optimal') {
      const used = real.map((a, k) => ({ a, k, f: res.flow[k] })).filter((x) => x.f.sign() > 0);
      used.forEach(({ a, f }) => F.push(row(`${arcName(a)}: ${f} unidades × $${a.cost} = ${f.mul(a.cost)}`)));
      res.arcs.forEach((a, k) => { if (a.kind === 'dummy' && res.flow[k].sign() > 0) F.push(row(`${dummyName(a.from)} → ${dummyName(a.to)}: ${res.flow[k]}`, a.from === SX.MC.DUMMY ? 'demanda sin cubrir' : 'oferta que no se envía')); });
      F.push(row(`[y]Costo total = ${plus(used.map(({ a, f }) => f.mul(a.cost)))} = ${res.cost}[/y]`, 'el mínimo posible'));
      F.push(row(res.balance.filter((b) => b.id !== SX.MC.DUMMY).map((b) => `${b.id}: ${b.net}`).join('   '), `sale − entra = oferta o −demanda ${res.balance.every((b) => b.ok) ? '✓' : '✗'}`));
    } else {
      F.push(row(`[r]${res.message}[/r]`));
    }
    steps.push({ id: 'm-res', title: 'Resultado', lines: F });

    const lp = SX.NetLP.mincostLP(model);
    const L = [
      row(`[y]Min Z = ${SX.linearExpr(lp.c, lp.varNames)}[/y]`, 'costo por unidad × unidades'),
      ...lp.constraints.map((c) => row(`   ${SX.linearExpr(c.a, lp.varNames)} ${SX.REL_TXT[c.rel]} ${c.b}`)),
      row('   todos los flujos ≥ 0', 'capacidad: ≤ · cada nodo: sale − entra = oferta'),
    ];
    return {
      title: 'Flujo a costo mínimo',
      sheets: [
        { title: 'Rutas más baratas sucesivas', open: true, steps },
        { title: 'El mismo problema como programación lineal', open: false, steps: [{ id: 'm-lp', title: 'Modelo de PL equivalente', lines: L }] },
      ],
    };
  }

  // ---------- Dibujo de la tabla húngara ----------
  function renderH(l) {
    const covR = new Set(l.lines ? l.lines.rows : []);
    const covC = new Set(l.lines ? l.lines.cols : []);
    const asg = new Set(l.assigned.map(([i, j]) => `${i},${j}`));
    const head = `<tr><th></th>${l.colLabels.map((c, j) => `<th class="${l.dummyCols && l.dummyCols[j] ? 'h-dummy' : ''}">${esc(c)}</th>`).join('')}${l.side ? `<th class="h-side">${esc(l.sideTitle)}</th>` : ''}</tr>`;
    const body = l.cells.map((r, i) => `<tr class="${covR.has(i) ? 'h-cov-r' : ''}"><th class="${l.dummyRows && l.dummyRows[i] ? 'h-dummy' : ''}">${esc(l.rowLabels[i])}</th>${r.map((v, j) => {
      const cls = [
        l.zeros && v === '0' ? 'h-zero' : '',
        covC.has(j) ? 'h-cov-c' : '',
        covR.has(i) && covC.has(j) ? 'h-cross' : '',
        asg.has(`${i},${j}`) ? 'h-asg' : '',
        v === '✕' || /M/.test(v) ? 'h-m' : '',
      ].join(' ');
      return `<td class="${cls}"><span>${esc(v)}</span></td>`;
    }).join('')}${l.side ? `<td class="h-side">${esc(l.side[i])}</td>` : ''}</tr>`).join('');
    const bottom = l.bottom ? `<tr class="h-bottom"><th>${esc(l.bottomTitle)}</th>${l.bottom.map((v) => `<td>${esc(v)}</td>`).join('')}${l.side ? '<td></td>' : ''}</tr>` : '';
    return `<div class="nb-scroll"><table class="h-table">${head}${body}${bottom}</table></div>`;
  }

  function plainH(l) {
    const covR = new Set(l.lines ? l.lines.rows : []);
    const covC = new Set(l.lines ? l.lines.cols : []);
    const asg = new Set(l.assigned.map(([i, j]) => `${i},${j}`));
    const lines = l.cells.map((r, i) => `${l.rowLabels[i]}: ${r.map((v, j) => (asg.has(`${i},${j}`) ? `[${v}]` : v)).join('  ')}${l.side ? `   (${l.sideTitle} ${l.side[i]})` : ''}${covR.has(i) ? '   ← fila tapada' : ''}`);
    if (l.bottom) lines.push(`${l.bottomTitle}: ${l.bottom.join('  ')}`);
    if (covC.size) lines.push(`columnas tapadas: ${[...covC].map((j) => l.colLabels[j]).join(', ')}`);
    return `tabla (columnas ${l.colLabels.join(', ')}):\n${lines.join('\n')}`;
  }

  SX.NetNB = { assignNotebook, maxflowNotebook, mincostNotebook, renderH, plainH };
})(typeof window !== 'undefined' ? window : globalThis);
