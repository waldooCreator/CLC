(function (root) {
  const SX = root.SX;

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const R = 22;
  const UNIT = 120;
  const PAD = 46;

  // Capas por distancia (en arcos) desde los nodos de inicio; los nodos sueltos van al final.
  function autoLayout(nodes, arcs, starts) {
    const level = new Map();
    const queue = [];
    starts.forEach((s) => { if (nodes.includes(s)) { level.set(s, 0); queue.push(s); } });
    if (!queue.length && nodes.length) { level.set(nodes[0], 0); queue.push(nodes[0]); }
    while (queue.length) {
      const u = queue.shift();
      arcs.forEach((a) => {
        if (a.from === u && !level.has(a.to)) { level.set(a.to, level.get(u) + 1); queue.push(a.to); }
      });
    }
    const maxL = Math.max(0, ...level.values());
    nodes.forEach((v) => { if (!level.has(v)) level.set(v, maxL + 1); });
    const cols = {};
    nodes.forEach((v) => { (cols[level.get(v)] = cols[level.get(v)] || []).push(v); });
    const tallest = Math.max(...Object.values(cols).map((c) => c.length));
    const pos = {};
    Object.entries(cols).forEach(([l, list]) => {
      list.forEach((v, i) => { pos[v] = [Number(l) * 1.5, (i + (tallest - list.length) / 2) * 1.3]; });
    });
    return pos;
  }

  /*
   * opts: nodes, arcs, layout, labels[k] (texto del arco), path [{arc, dir}], cutS (nodos del lado de la fuente),
   * cutArcs (índices), roles {nodo: 'src'|'snk'|'sup'|'dem'}, nodeNotes {nodo: texto}, used[k] (arco con flujo),
   * undirected (cuántos arcos dibujar sin flecha), title
   */
  function draw(opts) {
    const { nodes, arcs } = opts;
    const pos = opts.layout && nodes.every((v) => opts.layout[v]) ? opts.layout : autoLayout(nodes, arcs, opts.starts || [nodes[0]]);
    const xs = nodes.map((v) => pos[v][0]);
    const ys = nodes.map((v) => pos[v][1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const P = (v) => [PAD + (pos[v][0] - minX) * UNIT, PAD + 14 + (pos[v][1] - minY) * UNIT];
    const W = PAD * 2 + (Math.max(...xs) - minX) * UNIT;
    const H = PAD * 2 + 28 + (Math.max(...ys) - minY) * UNIT;

    const onPath = new Map((opts.path || []).map((e) => [e.arc, e.dir]));
    const cutArcs = new Set(opts.cutArcs || []);
    const drawn = opts.undirected ? arcs.slice(0, opts.undirected) : arcs;
    const pairKey = (a, b) => `${a}\u0000${b}`;
    const present = new Set(drawn.map((a) => pairKey(a.from, a.to)));

    const outDeg = {};
    drawn.forEach((a) => { outDeg[a.from] = (outDeg[a.from] || 0) + 1; });
    const parts = [];
    drawn.forEach((a, k) => {
      const [x1, y1] = P(a.from);
      const [x2, y2] = P(a.to);
      const dx = x2 - x1;
      const dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      // Si hay arco de ida y de vuelta, cada uno se curva hacia su lado.
      const bend = !opts.undirected && present.has(pairKey(a.to, a.from)) ? 18 : 0;
      const nx = -uy * bend;
      const ny = ux * bend;
      const sx = x1 + ux * R + nx * 0.35;
      const sy = y1 + uy * R + ny * 0.35;
      const ex = x2 - ux * (R + (opts.undirected ? 0 : 4)) + nx * 0.35;
      const ey = y2 - uy * (R + (opts.undirected ? 0 : 4)) + ny * 0.35;
      const cx = (x1 + x2) / 2 + nx;
      const cy = (y1 + y2) / 2 + ny;
      let dir = onPath.get(k);
      if (opts.undirected && dir === undefined && onPath.has(k + opts.undirected)) dir = -onPath.get(k + opts.undirected);
      const used = opts.used && (opts.used[k] || (opts.undirected && opts.used[k + opts.undirected]));
      const cls = ['n-arc', used ? 'n-used' : '', dir !== undefined ? 'n-path' : '', cutArcs.has(k) ? 'n-cut' : ''].join(' ');
      const marker = opts.undirected ? '' : ` marker-end="url(#${dir !== undefined ? 'nh-path' : cutArcs.has(k) ? 'nh-cut' : 'nh'})"`;
      parts.push(`<path class="${cls}" d="M${sx.toFixed(1)} ${sy.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}"${marker}/>`);
      if (dir === -1 && !opts.undirected) {
        parts.push(`<text class="n-back" x="${cx.toFixed(1)}" y="${(cy + 24).toFixed(1)}" text-anchor="middle">↶ devuelve</text>`);
      }
      const label = opts.labels ? opts.labels[k] : '';
      if (label) {
        // Con muchos arcos saliendo de un nodo, la etiqueta va cerca del origen, donde los arcos ya se separaron.
        const t = outDeg[a.from] >= 3 ? 0.2 : 0.5;
        const lx = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * cx + t * t * ex;
        const ly = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * cy + t * t * ey;
        parts.push(`<text class="n-lab${dir !== undefined ? ' n-lab-path' : ''}" x="${lx.toFixed(1)}" y="${(ly + 5).toFixed(1)}" text-anchor="middle">${esc(label)}</text>`);
      }
    });

    const cutS = opts.cutS ? new Set(opts.cutS) : null;
    nodes.forEach((v) => {
      const [x, y] = P(v);
      const role = (opts.roles && opts.roles[v]) || '';
      const side = cutS ? (cutS.has(v) ? ' n-side-s' : ' n-side-t') : '';
      parts.push(`<g class="n-node n-${role || 'mid'}${side}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${R}"/>`
        + `<text x="${x.toFixed(1)}" y="${(y + 6).toFixed(1)}" text-anchor="middle">${esc(v)}</text></g>`);
      const note = opts.nodeNotes && opts.nodeNotes[v];
      if (note) parts.push(`<text class="n-note" x="${x.toFixed(1)}" y="${(y - R - 8).toFixed(1)}" text-anchor="middle">${esc(note)}</text>`);
    });

    const defs = ['nh', 'nh-path', 'nh-cut'].map((id) => `<marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="${id}" d="M0 0 L10 5 L0 10 z"/></marker>`).join('');
    return `<svg class="n-svg" width="${Math.round(W)}" viewBox="0 0 ${Math.round(W)} ${Math.round(H)}" role="img" aria-label="${esc(opts.title || 'Red')}"><defs>${defs}</defs>${parts.join('')}</svg>`;
  }

  SX.NetDraw = { draw, autoLayout };
})(typeof window !== 'undefined' ? window : globalThis);
