(function (root) {
  const SX = root.SX;
  const { Frac, MVal } = SX;

  const MAX_ROUNDS = 100;
  const BIG = new MVal(Frac.ZERO, Frac.ONE);

  // a + bM escrito como en el cuaderno: "M", "M − 3", "2M + 1".
  function mstr(v) {
    v = MVal.of(v);
    if (!v.hasM()) return v.a.toString();
    const b = v.b;
    const mPart = b.isOne() ? 'M' : b.neg().isOne() ? '−M' : `${b.d === 1n ? b : `(${b})`}M`;
    if (v.a.isZero()) return mPart;
    return v.a.sign() > 0 ? `${mPart} + ${v.a}` : `${mPart} − ${v.a.neg()}`;
  }

  const copy = (M) => M.map((r) => [...r]);
  const minOf = (vals) => vals.reduce((m, v) => (v.cmp(m) < 0 ? v : m));

  // Asignación máxima sobre los ceros (caminos alternantes, en orden fijo de filas y columnas).
  function zeroMatching(M, forbid = null) {
    const n = M.length;
    const rowMatch = Array(n).fill(-1);
    const colMatch = Array(n).fill(-1);
    const isZero = (i, j) => M[i][j].isZero() && !(forbid && forbid(i, j));
    const tryRow = (i, seen) => {
      for (let j = 0; j < n; j++) {
        if (!isZero(i, j) || seen[j]) continue;
        seen[j] = true;
        if (colMatch[j] === -1 || tryRow(colMatch[j], seen)) {
          rowMatch[i] = j;
          colMatch[j] = i;
          return true;
        }
      }
      return false;
    };
    for (let i = 0; i < n; i++) tryRow(i, Array(n).fill(false));
    return { rowMatch, colMatch, size: rowMatch.filter((j) => j !== -1).length };
  }

  // Menor número de líneas que tapan todos los ceros (teorema de König).
  function coverLines(M, match) {
    const n = M.length;
    const markRow = match.rowMatch.map((j) => j === -1);
    const markCol = Array(n).fill(false);
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < n; i++) {
        if (!markRow[i]) continue;
        for (let j = 0; j < n; j++) {
          if (M[i][j].isZero() && !markCol[j]) {
            markCol[j] = true;
            changed = true;
            const r = match.colMatch[j];
            if (r !== -1 && !markRow[r]) markRow[r] = true;
          }
        }
      }
    }
    return {
      rows: markRow.map((m, i) => (m ? -1 : i)).filter((i) => i !== -1),
      cols: markCol.map((m, j) => (m ? j : -1)).filter((j) => j !== -1),
    };
  }

  // Asignación "a mano": primero filas o columnas con un único cero disponible.
  function handAssign(M) {
    const n = M.length;
    const rowFree = Array(n).fill(true);
    const colFree = Array(n).fill(true);
    const order = [];
    const zerosInRow = (i) => (rowFree[i] ? M[i].map((v, j) => (v.isZero() && colFree[j] ? j : -1)).filter((j) => j !== -1) : []);
    const zerosInCol = (j) => (colFree[j] ? M.map((r, i) => (r[j].isZero() && rowFree[i] ? i : -1)).filter((i) => i !== -1) : []);
    const take = (i, j, reason) => {
      order.push({ row: i, col: j, reason });
      rowFree[i] = false;
      colFree[j] = false;
    };
    while (order.length < n) {
      let done = false;
      for (let i = 0; i < n && !done; i++) {
        const z = zerosInRow(i);
        if (z.length === 1) { take(i, z[0], 'row'); done = true; }
      }
      for (let j = 0; j < n && !done; j++) {
        const z = zerosInCol(j);
        if (z.length === 1) { take(z[0], j, 'col'); done = true; }
      }
      if (done) continue;
      let best = -1;
      for (let i = 0; i < n; i++) {
        const z = zerosInRow(i);
        if (z.length && (best === -1 || z.length < zerosInRow(best).length)) best = i;
      }
      if (best === -1) return null;
      take(best, zerosInRow(best)[0], 'choice');
    }
    return order;
  }

  function prepare(model) {
    const notes = [];
    const isMax = model.sense === 'max';
    const cap = model.agents.map((_, i) => Math.max(1, (model.capacity && model.capacity[i]) | 0 || 1));

    // Filas: cada agente aparece tantas veces como tareas pueda hacer.
    const rows = [];
    model.agents.forEach((name, i) => {
      for (let k = 0; k < cap[i]; k++) rows.push({ agent: i, label: cap[i] > 1 ? `${name} (${k + 1})` : name, dummy: false });
    });
    const cols = model.tasks.map((name, j) => ({ task: j, label: name, dummy: false }));
    const orig = (r, c) => (r.dummy || c.dummy ? Frac.ZERO : model.cost[r.agent][c.task]);

    const forbidden = model.cost.some((row) => row.some((v) => v === null));
    let top = null;

    if (cap.some((k) => k > 1)) {
      const who = model.agents.filter((_, i) => cap[i] > 1).map((a) => `${a} (${cap[model.agents.indexOf(a)]})`);
      notes.push(`Un agente que puede hacer varias tareas se copia una vez por cada tarea: ${who.join(', ')}. Cada copia tiene los mismos costos.`);
    }

    // Balancear con filas o columnas ficticias de costo 0.
    const realRows = rows.length;
    const realCols = cols.length;
    const addR = Math.max(0, realCols - realRows);
    const addC = Math.max(0, realRows - realCols);
    for (let k = 1; k <= addR; k++) rows.push({ label: addR > 1 ? `Ficticio ${k}` : 'Ficticio', dummy: true });
    for (let k = 1; k <= addC; k++) cols.push({ label: addC > 1 ? `Ficticia ${k}` : 'Ficticia', dummy: true });
    if (addR || addC) {
      const which = addR ? `${addR === 1 ? 'una fila' : `${addR} filas`} (agente ficticio)` : `${addC === 1 ? 'una columna' : `${addC} columnas`} (tarea ficticia)`;
      notes.push(`El problema no está balanceado: hay ${realRows} filas de agentes y ${realCols} tareas. Se agrega ${which} con costo 0 para que la tabla quede cuadrada. Lo que se asigne a algo ficticio en realidad queda sin hacer.`);
    }
    const balance = { realRows, realCols, addR, addC };
    const n = rows.length;

    // Valores originales (MVal) en la tabla cuadrada.
    let M = rows.map((r) => cols.map((c) => {
      const v = orig(r, c);
      return v === null ? BIG : MVal.of(v);
    }));
    const base = copy(M);

    if (forbidden) notes.push('Las celdas prohibidas reciben un costo M, un número gigantesco, para que el método nunca las elija.');

    if (isMax) {
      const allowed = [];
      rows.forEach((r, i) => cols.forEach((c, j) => { if (!r.dummy && !c.dummy && !M[i][j].hasM()) allowed.push(M[i][j].a); }));
      top = allowed.reduce((m, v) => (v.cmp(m) > 0 ? v : m), allowed[0] || Frac.ZERO);
      notes.push(`Es de maximizar: cada valor se resta del mayor de la tabla (${top}). Así queda una tabla de "lo que se deja de ganar", y minimizar eso es lo mismo que ganar lo máximo.`);
      M = M.map((row, i) => row.map((v, j) => (v.hasM() || rows[i].dummy || cols[j].dummy ? v : MVal.of(top.sub(v.a)))));
    }

    return { rows, cols, n, M, base, notes, isMax, cap, forbidden, balance, top };
  }

  function solveAssignment(model) {
    const prep = prepare(model);
    const { n, rows, cols } = prep;
    let M = copy(prep.M);
    const stages = [];

    // Paso 1: restar el mínimo de cada fila.
    const rowMin = M.map((r) => minOf(r));
    const afterRows = M.map((r, i) => r.map((v) => v.sub(rowMin[i])));
    stages.push({ type: 'rows', before: M, mins: rowMin, after: afterRows });
    M = afterRows;

    // Paso 2: restar el mínimo de cada columna.
    const colMin = M[0].map((_, j) => minOf(M.map((r) => r[j])));
    const afterCols = M.map((r) => r.map((v, j) => v.sub(colMin[j])));
    stages.push({ type: 'cols', before: M, mins: colMin, after: afterCols });
    M = afterCols;

    let adjustments = 0;
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const match = zeroMatching(M);
      const lines = coverLines(M, match);
      const count = lines.rows.length + lines.cols.length;
      stages.push({ type: 'cover', matrix: M, lines, count, n });
      if (count >= n) break;

      const covR = new Set(lines.rows);
      const covC = new Set(lines.cols);
      const free = [];
      M.forEach((r, i) => r.forEach((v, j) => { if (!covR.has(i) && !covC.has(j)) free.push(v); }));
      const k = minOf(free);
      const next = M.map((r, i) => r.map((v, j) => {
        const cr = covR.has(i);
        const cc = covC.has(j);
        if (!cr && !cc) return v.sub(k);
        if (cr && cc) return v.add(k);
        return v;
      }));
      stages.push({ type: 'adjust', before: M, lines, k, after: next });
      adjustments++;
      M = next;
    }

    const final = M;
    let order = handAssign(final);
    let byMatching = false;
    if (!order) {
      const m = zeroMatching(final);
      order = m.rowMatch.map((j, i) => ({ row: i, col: j, reason: 'match' }));
      byMatching = true;
    }

    const assignment = order
      .map(({ row, col, reason }) => {
        const r = rows[row];
        const c = cols[col];
        const value = prep.base[row][col];
        return {
          row, col, reason,
          agent: r.dummy ? null : model.agents[r.agent],
          task: c.dummy ? null : model.tasks[c.task],
          rowLabel: r.label, colLabel: c.label,
          dummy: r.dummy || c.dummy,
          forbidden: value.hasM(),
          value: value.hasM() ? null : value.a,
        };
      })
      .sort((a, b) => a.row - b.row);

    const infeasible = assignment.some((a) => a.forbidden);
    const total = assignment.reduce((acc, a) => (a.dummy || a.value === null ? acc : acc.add(a.value)), Frac.ZERO);

    // Otra asignación con todos ceros = otro óptimo con el mismo valor.
    let alternative = null;
    for (const a of assignment) {
      const m = zeroMatching(final, (i, j) => i === a.row && j === a.col);
      if (m.size === n) {
        alternative = m.rowMatch.map((j, i) => ({ row: i, col: j, rowLabel: rows[i].label, colLabel: cols[j].label }));
        break;
      }
    }

    return {
      status: infeasible ? 'infeasible' : 'optimal',
      model, prep, stages, final, order, byMatching, assignment, total,
      adjustments, alternative,
      message: infeasible ? 'No hay forma de asignar a todos sin usar una celda prohibida: el problema NO tiene solución factible.' : '',
    };
  }

  // Revisión por fuerza bruta (todas las permutaciones) para tablas pequeñas.
  function bruteForce(res) {
    const { n, base, isMax } = res.prep;
    if (n > 8) return null;
    let best = null;
    const used = Array(n).fill(false);
    const walk = (i, acc) => {
      if (i === n) {
        if (!best || acc.cmp(best) < 0) best = acc;
        return;
      }
      for (let j = 0; j < n; j++) {
        if (used[j]) continue;
        used[j] = true;
        const v = base[i][j];
        walk(i + 1, acc.add(isMax && !v.hasM() ? MVal.of(v.a.neg()) : v));
        used[j] = false;
      }
    };
    walk(0, new MVal());
    if (!best || best.hasM()) return { status: 'infeasible' };
    return { status: 'optimal', total: isMax ? best.a.neg() : best.a };
  }

  SX.mstr = mstr;
  SX.solveAssignment = solveAssignment;
  SX.assignBruteForce = bruteForce;
})(typeof window !== 'undefined' ? window : globalThis);
