(function (root) {
  const SX = (root.SX = root.SX || {});

  const abs = (a) => (a < 0n ? -a : a);
  function gcd(a, b) {
    a = abs(a);
    b = abs(b);
    while (b) [a, b] = [b, a % b];
    return a;
  }

  class Frac {
    constructor(n, d = 1n) {
      n = BigInt(n);
      d = BigInt(d);
      if (d === 0n) throw new Error('División entre cero');
      if (d < 0n) {
        n = -n;
        d = -d;
      }
      const g = gcd(n, d) || 1n;
      this.n = n / g;
      this.d = d / g;
    }

    static of(v) {
      if (v instanceof Frac) return v;
      if (typeof v === 'bigint') return new Frac(v);
      return Frac.parse(v);
    }

    static parse(input) {
      let s = String(input).trim().replace(/\s+/g, '').replace(',', '.').replace('−', '-');
      const frac = s.match(/^([+-]?\d+(?:\.\d+)?)\/([+-]?\d+(?:\.\d+)?)$/);
      if (frac) return Frac.parse(frac[1]).div(Frac.parse(frac[2]));
      const m = s.match(/^([+-])?(\d*)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
      if (!m || (m[2] === '' && (m[3] === undefined || m[3] === ''))) {
        throw new Error(`Número inválido: "${input}"`);
      }
      const sign = m[1] === '-' ? -1n : 1n;
      const intPart = m[2] || '0';
      const decPart = m[3] || '';
      let n = BigInt(intPart + decPart) * sign;
      let d = 10n ** BigInt(decPart.length);
      const exp = m[4] ? parseInt(m[4], 10) : 0;
      if (exp > 0) n *= 10n ** BigInt(exp);
      if (exp < 0) d *= 10n ** BigInt(-exp);
      return new Frac(n, d);
    }

    add(o) { o = Frac.of(o); return new Frac(this.n * o.d + o.n * this.d, this.d * o.d); }
    sub(o) { o = Frac.of(o); return new Frac(this.n * o.d - o.n * this.d, this.d * o.d); }
    mul(o) { o = Frac.of(o); return new Frac(this.n * o.n, this.d * o.d); }
    div(o) {
      o = Frac.of(o);
      if (o.n === 0n) throw new Error('División entre cero');
      return new Frac(this.n * o.d, this.d * o.n);
    }
    neg() { return new Frac(-this.n, this.d); }
    sign() { return this.n > 0n ? 1 : this.n < 0n ? -1 : 0; }
    isZero() { return this.n === 0n; }
    isOne() { return this.n === 1n && this.d === 1n; }
    cmp(o) { return this.sub(o).sign(); }
    toNumber() { return Number(this.n) / Number(this.d); }
    toString() { return this.d === 1n ? this.n.toString() : `${this.n}/${this.d}`; }
    toDecimal(digits = 4) {
      if (this.d === 1n) return this.n.toString();
      return String(+this.toNumber().toFixed(digits));
    }
  }

  Frac.ZERO = new Frac(0n);
  Frac.ONE = new Frac(1n);

  // a + b·M, con M un número "infinitamente grande" (método de la Gran M).
  class MVal {
    constructor(a = Frac.ZERO, b = Frac.ZERO) {
      this.a = Frac.of(a);
      this.b = Frac.of(b);
    }
    static of(v) { return v instanceof MVal ? v : new MVal(Frac.of(v), Frac.ZERO); }
    add(o) { o = MVal.of(o); return new MVal(this.a.add(o.a), this.b.add(o.b)); }
    sub(o) { o = MVal.of(o); return new MVal(this.a.sub(o.a), this.b.sub(o.b)); }
    mulF(f) { f = Frac.of(f); return new MVal(this.a.mul(f), this.b.mul(f)); }
    neg() { return new MVal(this.a.neg(), this.b.neg()); }
    sign() { const s = this.b.sign(); return s !== 0 ? s : this.a.sign(); }
    isZero() { return this.a.isZero() && this.b.isZero(); }
    hasM() { return !this.b.isZero(); }
    cmp(o) { return this.sub(o).sign(); }
    toString() {
      if (this.b.isZero()) return this.a.toString();
      let mPart;
      if (this.b.isOne()) mPart = 'M';
      else if (this.b.neg().isOne()) mPart = '-M';
      else mPart = (this.b.d === 1n ? this.b.toString() : `(${this.b})`) + 'M';
      if (this.a.isZero()) return mPart;
      return mPart.startsWith('-')
        ? `${this.a} - ${mPart.slice(1)}`
        : `${this.a} + ${mPart}`;
    }
  }

  SX.Frac = Frac;
  SX.MVal = MVal;
})(typeof window !== 'undefined' ? window : globalThis);
