(function (root) {
  const SX = root.SX;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ARCS = (txt) => txt.trim().split(/\s*;\s*/).map((t) => t.split(/\s+/));
  const fit = (arr, len, fill) => Array.from({ length: len }, (_, i) => (arr[i] !== undefined ? arr[i] : fill(i)));

  // Ejemplos rápidos de cada modo (los chips de arriba del formulario).
  const EXAMPLES = {
    assign: [
      { label: 'BALANCEADO', form: { sense: 'min', agents: ['Ana', 'Beto', 'Caro'], tasks: ['T1', 'T2', 'T3'], cost: [['9', '2', '7'], ['6', '4', '3'], ['5', '8', '1']], capacity: ['', '', ''] } },
      { label: 'NO BALANCEADO', form: { sense: 'min', agents: ['Ana', 'Beto'], tasks: ['T1', 'T2', 'T3'], cost: [['8', '4', '7'], ['5', '6', '9']], capacity: ['', ''] } },
      { label: 'MAX', form: { sense: 'max', agents: ['A', 'B', 'C'], tasks: ['Zona 1', 'Zona 2', 'Zona 3'], cost: [['12', '9', '7'], ['8', '11', '10'], ['9', '7', '13']], capacity: ['', '', ''] } },
      { label: 'PROHIBIDAS (M)', form: { sense: 'min', agents: ['A', 'B', 'C'], tasks: ['T1', 'T2', 'T3'], cost: [['4', 'M', '6'], ['5', '3', 'M'], ['M', '7', '2']], capacity: ['', '', ''] } },
    ],
    maxflow: [
      { label: 'RED PEQUEÑA', form: { source: 's', sink: 't', arcs: ARCS('s a 4; s b 3; a b 2; a t 2; b t 4') } },
      { label: 'DEVOLVER FLUJO', form: { source: 's', sink: 't', arcs: ARCS('s a 1; s b 1; a b 1; a t 1; b t 1') } },
    ],
    mincost: [
      { label: 'TRANSPORTE 2×2', form: { undirected: false, nodes: [['F1', '20'], ['F2', '30'], ['C1', '-25'], ['C2', '-25']], arcs: ARCS('F1 C1 - 4; F1 C2 - 6; F2 C1 - 5; F2 C2 - 3') } },
      { label: 'OFERTA > DEMANDA', form: { undirected: false, nodes: [['A', '40'], ['B', '-15'], ['C', '-10']], arcs: ARCS('A B 20 2; A C - 5; B C 10 1') } },
    ],
  };

  const blank = {
    assign: () => ({ sense: 'min', agents: ['A1', 'A2', 'A3'], tasks: ['T1', 'T2', 'T3'], cost: [['', '', ''], ['', '', ''], ['', '', '']], capacity: ['', '', ''] }),
    maxflow: () => ({ source: 's', sink: 't', arcs: [['s', '', ''], ['', 't', ''], ['', '', '']] }),
    mincost: () => ({ undirected: false, nodes: [['', ''], ['', '']], arcs: [['', '', '', ''], ['', '', '', ''], ['', '', '', '']] }),
  };

  const state = {
    assign: structuredClone(EXAMPLES.assign[0].form),
    maxflow: structuredClone(EXAMPLES.maxflow[0].form),
    mincost: structuredClone(EXAMPLES.mincost[0].form),
  };

  let host = null;
  let onEnter = () => {};

  const chips = (mode) => `<div class="flex flex-wrap gap-2 mb-5" aria-label="Ejemplos">
    <span class="font-pixel text-[9px] text-mute self-center mr-1">EJEMPLOS</span>
    ${EXAMPLES[mode].map((e, i) => `<button class="px-chip" data-net-example="${i}" type="button">${esc(e.label)}</button>`).join('')}
  </div>`;

  const input = (attrs, value, label, cls = 'cell') => `<input class="px-input ${cls}" ${attrs} value="${esc(value)}" aria-label="${esc(label)}" autocomplete="off">`;

  function renderAssign() {
    const f = state.assign;
    const n = f.agents.length;
    const m = f.tasks.length;
    f.capacity = fit(f.capacity || [], n, () => '');
    const head = `<tr><th></th>${f.tasks.map((t, j) => `<th>${input(`data-k="task" data-j="${j}"`, t, `Nombre de la tarea ${j + 1}`, 'cell name')}</th>`).join('')}<th>CAP.</th></tr>`;
    const body = f.agents.map((a, i) => `<tr><td>${input(`data-k="agent" data-i="${i}"`, a, `Nombre del agente ${i + 1}`, 'cell name')}</td>${f.cost[i].map((v, j) => `<td>${input(`data-k="cost" data-i="${i}" data-j="${j}" inputmode="decimal" placeholder="0"`, v, `Costo de ${a} en ${f.tasks[j]}`)}</td>`).join('')}<td>${input(`data-k="cap" data-i="${i}" inputmode="numeric" placeholder="1"`, f.capacity[i], `Cuántas tareas puede hacer ${a}`, 'cell cap')}</td></tr>`).join('');
    return `${chips('assign')}
      <div class="grid grid-cols-2 gap-4">
        <label class="field col-span-2"><span>OBJETIVO</span>
          <select class="px-input" data-k="sense"><option value="min" ${f.sense === 'min' ? 'selected' : ''}>MINIMIZAR COSTO</option><option value="max" ${f.sense === 'max' ? 'selected' : ''}>MAXIMIZAR BENEFICIO</option></select>
        </label>
        <label class="field"><span>AGENTES (FILAS)</span><input class="px-input" data-k="n" type="number" min="1" max="10" value="${n}"></label>
        <label class="field"><span>TAREAS (COLUMNAS)</span><input class="px-input" data-k="m" type="number" min="1" max="10" value="${m}"></label>
      </div>
      <div class="model-grid net-grid scroll-x mt-6"><table>${head}${body}</table></div>
      <p class="small t-mute mt-3">Escribe el costo (o beneficio) de cada agente en cada tarea. <b>M</b> o <b>-</b> = asignación prohibida. CAP. = cuántas tareas puede hacer ese agente (vacío = 1). Si las filas y columnas no coinciden, la calculadora agrega las ficticias.</p>`;
  }

  function arcTable(rows, withCost) {
    const head = `<tr><th>DESDE</th><th>HACIA</th><th>CAPACIDAD</th>${withCost ? '<th>COSTO</th>' : ''}<th></th></tr>`;
    const body = rows.map((r, k) => `<tr>
      <td>${input(`data-k="arc" data-r="${k}" data-c="0"`, r[0], `Arco ${k + 1}: nodo de origen`, 'cell name')}</td>
      <td>${input(`data-k="arc" data-r="${k}" data-c="1"`, r[1], `Arco ${k + 1}: nodo de destino`, 'cell name')}</td>
      <td>${input(`data-k="arc" data-r="${k}" data-c="2" inputmode="decimal" placeholder="∞"`, r[2] === '-' ? '' : r[2], `Arco ${k + 1}: capacidad`)}</td>
      ${withCost ? `<td>${input(`data-k="arc" data-r="${k}" data-c="3" inputmode="decimal" placeholder="0"`, r[3], `Arco ${k + 1}: costo por unidad`)}</td>` : ''}
      <td><button class="vault-del net-del" type="button" data-k="del-arc" data-r="${k}" aria-label="Quitar arco ${k + 1}">✕</button></td></tr>`).join('');
    return `<div class="model-grid net-grid scroll-x"><table>${head}${body}</table></div>
      <button class="px-btn px-btn--ghost mt-3" type="button" data-k="add-arc">+ ARCO</button>`;
  }

  function nodeNames(arcs) {
    const out = [];
    arcs.forEach((r) => [r[0], r[1]].forEach((v) => { v = String(v || '').trim(); if (v && !out.includes(v)) out.push(v); }));
    return out;
  }

  function renderMaxflow() {
    const f = state.maxflow;
    const names = nodeNames(f.arcs);
    const opts = (sel) => [...new Set([sel, ...names])].filter(Boolean).map((v) => `<option value="${esc(v)}" ${v === sel ? 'selected' : ''}>${esc(v)}</option>`).join('');
    return `${chips('maxflow')}
      <div class="grid grid-cols-2 gap-4 mb-5">
        <label class="field"><span>FUENTE (SALE TODO)</span><select class="px-input" data-k="source">${opts(f.source)}</select></label>
        <label class="field"><span>SUMIDERO (LLEGA TODO)</span><select class="px-input" data-k="sink">${opts(f.sink)}</select></label>
      </div>
      ${arcTable(f.arcs, false)}
      <p class="small t-mute mt-3">Un arco por fila: de qué nodo sale, a cuál llega y cuánto le cabe. Los nombres de los nodos son libres (O, A, 1, Bogotá…). Capacidad vacía = sin límite.</p>`;
  }

  function renderMincost() {
    const f = state.mincost;
    const nodes = f.nodes.map((r, k) => `<tr>
      <td>${input(`data-k="node" data-r="${k}" data-c="0"`, r[0], `Nodo ${k + 1}: nombre`, 'cell name')}</td>
      <td>${input(`data-k="node" data-r="${k}" data-c="1" inputmode="decimal" placeholder="0"`, r[1], `Nodo ${k + 1}: oferta o demanda`)}</td>
      <td><button class="vault-del net-del" type="button" data-k="del-node" data-r="${k}" aria-label="Quitar nodo ${k + 1}">✕</button></td></tr>`).join('');
    return `${chips('mincost')}
      <h3 class="vault-sub">NODOS CON OFERTA O DEMANDA</h3>
      <div class="model-grid net-grid scroll-x"><table><tr><th>NODO</th><th>OFERTA (+) / DEMANDA (−)</th><th></th></tr>${nodes}</table></div>
      <button class="px-btn px-btn--ghost mt-3 mb-6" type="button" data-k="add-node">+ NODO</button>
      <h3 class="vault-sub">ARCOS</h3>
      ${arcTable(f.arcs, true)}
      <label class="px-check mt-5">
        <input type="checkbox" data-k="undirected" ${f.undirected ? 'checked' : ''}>
        <span class="px-check-box" aria-hidden="true"></span>
        <span>CADA ARCO SIRVE EN LOS DOS SENTIDOS <span class="t-mute">(red no dirigida, p. ej. ruta más corta)</span></span>
      </label>
      <p class="small t-mute mt-3">Positivo = el nodo ofrece unidades; negativo = las pide; los nodos de paso no hace falta escribirlos. Capacidad vacía = sin límite. Para una ruta más corta: oferta 1 en el origen y −1 en el destino.</p>`;
  }

  function render(mode) {
    if (!host) return;
    host.innerHTML = mode === 'assign' ? renderAssign() : mode === 'maxflow' ? renderMaxflow() : renderMincost();
    host.dataset.mode = mode;
  }

  function resizeAssign(n, m) {
    const f = state.assign;
    n = Math.min(10, Math.max(1, n | 0 || 1));
    m = Math.min(10, Math.max(1, m | 0 || 1));
    f.agents = fit(f.agents, n, (i) => `A${i + 1}`);
    f.tasks = fit(f.tasks, m, (j) => `T${j + 1}`);
    f.cost = fit(f.cost, n, () => []).map((r) => fit(r, m, () => ''));
    f.capacity = fit(f.capacity || [], n, () => '');
  }

  function attach(el, { enter } = {}) {
    host = el;
    onEnter = enter || onEnter;
    host.addEventListener('input', (e) => {
      const t = e.target;
      const mode = host.dataset.mode;
      const f = state[mode];
      const { k } = t.dataset;
      t.classList.remove('invalid');
      if (k === 'agent') f.agents[t.dataset.i] = t.value;
      if (k === 'task') f.tasks[t.dataset.j] = t.value;
      if (k === 'cost') f.cost[t.dataset.i][t.dataset.j] = t.value;
      if (k === 'cap') f.capacity[t.dataset.i] = t.value;
      if (k === 'arc') f.arcs[t.dataset.r][t.dataset.c] = t.value;
      if (k === 'node') f.nodes[t.dataset.r][t.dataset.c] = t.value;
    });
    host.addEventListener('change', (e) => {
      const t = e.target;
      const mode = host.dataset.mode;
      const f = state[mode];
      const { k } = t.dataset;
      if (k === 'sense') f.sense = t.value;
      if (k === 'source') f.source = t.value;
      if (k === 'sink') f.sink = t.value;
      if (k === 'undirected') f.undirected = t.checked;
      if (k === 'n' || k === 'm') {
        resizeAssign(k === 'n' ? +t.value : f.agents.length, k === 'm' ? +t.value : f.tasks.length);
        render(mode);
      }
      // Al cambiar los nombres de los nodos se actualizan las listas de fuente y sumidero.
      if (k === 'arc' && mode === 'maxflow' && t.dataset.c !== '2') {
        const names = nodeNames(f.arcs);
        ['source', 'sink'].forEach((key) => {
          const sel = host.querySelector(`[data-k="${key}"]`);
          sel.innerHTML = [...new Set([f[key], ...names])].filter(Boolean).map((v) => `<option value="${esc(v)}" ${v === f[key] ? 'selected' : ''}>${esc(v)}</option>`).join('');
        });
      }
    });
    host.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const mode = host.dataset.mode;
      const f = state[mode];
      const { k } = b.dataset;
      if (b.dataset.netExample !== undefined) {
        state[mode] = structuredClone(EXAMPLES[mode][+b.dataset.netExample].form);
        render(mode);
        host.dispatchEvent(new CustomEvent('net-example', { bubbles: true }));
        return;
      }
      if (k === 'add-arc') f.arcs.push(mode === 'mincost' ? ['', '', '', ''] : ['', '', '']);
      else if (k === 'del-arc') { f.arcs.splice(+b.dataset.r, 1); if (!f.arcs.length) f.arcs.push(mode === 'mincost' ? ['', '', '', ''] : ['', '', '']); }
      else if (k === 'add-node') f.nodes.push(['', '']);
      else if (k === 'del-node') { f.nodes.splice(+b.dataset.r, 1); if (!f.nodes.length) f.nodes.push(['', '']); }
      else return;
      render(mode);
    });
    host.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('input')) onEnter(); });
  }

  // Marca en rojo la celda que causó el error.
  function mark(where) {
    if (!where || !host) return;
    let sel = null;
    if (where.kind === 'cost') sel = `[data-k="cost"][data-i="${where.i}"][data-j="${where.j}"]`;
    if (where.kind === 'cap') sel = `[data-k="cap"][data-i="${where.i}"]`;
    if (where.kind === 'arc') sel = `[data-k="arc"][data-r="${where.k}"]${where.col !== undefined ? `[data-c="${where.col}"]` : ''}`;
    if (where.kind === 'node') sel = `[data-k="node"][data-r="${where.k}"][data-c="1"]`;
    if (sel) host.querySelectorAll(sel).forEach((x) => x.classList.add('invalid'));
  }

  function read(mode) {
    try {
      if (mode === 'assign') return SX.NetModel.assignFromForm(state.assign);
      if (mode === 'maxflow') return SX.NetModel.maxflowFromForm(state.maxflow);
      return SX.NetModel.mincostFromForm(state.mincost);
    } catch (err) {
      mark(err.where);
      throw err;
    }
  }

  // En el formulario de arcos, la capacidad "sin límite" se guarda vacía.
  function normalize(mode, form) {
    const f = structuredClone(form);
    if (f.arcs) f.arcs = f.arcs.map((r) => r.map((v, c) => (c === 2 && v === '-' ? '' : v)));
    if (mode === 'assign') f.capacity = fit(f.capacity || [], f.agents.length, () => '');
    return f;
  }

  function load(mode, form) {
    state[mode] = normalize(mode, form);
  }

  const current = (mode) => structuredClone(state[mode]);
  const clear = (mode) => { state[mode] = blank[mode](); };

  SX.NetForms = { attach, render, read, load, normalize, current, clear, EXAMPLES };
})(typeof window !== 'undefined' ? window : globalThis);
