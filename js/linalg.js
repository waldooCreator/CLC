(function (root) {
  const SX = (root.SX = root.SX || {});
  const { Frac, MVal } = SX;

  const identity = (m) =>
    Array.from({ length: m }, (_, i) => Array.from({ length: m }, (_, j) => (i === j ? Frac.ONE : Frac.ZERO)));

  const column = (A, j) => A.map((row) => row[j]);

  const subMatrixByColumns = (A, cols) => A.map((row) => cols.map((j) => row[j]));

  function matMul(A, B) {
    return A.map((row) =>
      B[0].map((_, j) => row.reduce((acc, v, k) => acc.add(v.mul(B[k][j])), Frac.ZERO))
    );
  }

  const matVec = (A, v) => A.map((row) => row.reduce((acc, x, k) => acc.add(x.mul(v[k])), Frac.ZERO));

  // Vector fila de costos (MVal) por matriz de fracciones.
  const mRowTimesMat = (r, A) =>
    A[0].map((_, j) => r.reduce((acc, ck, k) => acc.add(ck.mulF(A[k][j])), new MVal()));

  const mDot = (r, v) => r.reduce((acc, ck, k) => acc.add(ck.mulF(v[k])), new MVal());

  function inverse(M) {
    const n = M.length;
    const A = M.map((row, i) => [...row, ...identity(n)[i]]);
    for (let c = 0; c < n; c++) {
      let p = c;
      while (p < n && A[p][c].isZero()) p++;
      if (p === n) return null;
      [A[c], A[p]] = [A[p], A[c]];
      const pv = A[c][c];
      A[c] = A[c].map((x) => x.div(pv));
      for (let r = 0; r < n; r++) {
        if (r === c || A[r][c].isZero()) continue;
        const f = A[r][c];
        A[r] = A[r].map((x, k) => x.sub(f.mul(A[c][k])));
      }
    }
    return A.map((row) => row.slice(n));
  }

  SX.LA = { identity, column, subMatrixByColumns, matMul, matVec, mRowTimesMat, mDot, inverse };
})(typeof window !== 'undefined' ? window : globalThis);
