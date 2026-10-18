(function (root) {
  const SX = root.SX;
  const LIB = 'javascript-lp-solver 1.0.3';

  // Resuelve el mismo modelo con una librería externa para confirmar el resultado exacto.
  function verify(model, res, zName = 'Z') {
    const lp = root.solver;
    if (!lp || typeof lp.Solve !== 'function') return { ok: null, lib: LIB, text: 'librería no disponible (revisa tu internet)' };
    const { model: m } = SX.expandSigns(model);
    const constraints = {};
    const variables = {};
    m.constraints.forEach((r, i) => {
      const b = r.b.toNumber();
      constraints[`r${i}`] = r.rel === '<=' ? { max: b } : r.rel === '>=' ? { min: b } : { equal: b };
    });
    m.varNames.forEach((_, j) => {
      const v = { z: m.c[j].toNumber() };
      m.constraints.forEach((r, i) => { v[`r${i}`] = r.a[j].toNumber(); });
      variables[`v${j}`] = v;
    });

    let out;
    try {
      out = lp.Solve({ optimize: 'z', opType: m.sense, constraints, variables });
    } catch (err) {
      return { ok: null, lib: LIB, text: `la librería falló: ${err.message}` };
    }
    const libStatus = !out.feasible ? 'infeasible' : out.bounded === false ? 'unbounded' : 'optimal';
    if (libStatus !== res.status) {
      return { ok: false, lib: LIB, text: `la librería dice "${libStatus}" y el cálculo dice "${res.status}"` };
    }
    if (libStatus !== 'optimal') return { ok: true, lib: LIB, text: `la librería también dice ${libStatus === 'infeasible' ? 'infactible' : 'no acotado'}` };
    const z = res.solution.Z.toNumber();
    const same = Math.abs(z - out.result) <= 1e-6 * (1 + Math.abs(z));
    return same
      ? { ok: true, lib: LIB, text: `la librería también da ${zName}* = ${+out.result.toFixed(6)}` }
      : { ok: false, lib: LIB, text: `la librería da ${+out.result.toFixed(6)} y el cálculo ${res.solution.Z}` };
  }

  // Solo se muestra si la librería contradice el cálculo; cuando coinciden no ocupa espacio.
  function badge(v, label = '') {
    if (!v || v.ok !== false) return '';
    return `<p class="verify badge-bad"><span>✗ NO COINCIDE${label ? ` · ${label}` : ''}</span>${SX.UI.esc(v.text.replace(/(^|\s)-(?=\d)/g, '$1−'))} <em>(${v.lib})</em></p>`;
  }

  SX.verify = verify;
  SX.verifyBadge = badge;
})(typeof window !== 'undefined' ? window : globalThis);
