(function () {
  const { Frac, UI, AI } = SX;
  const $ = (s) => document.querySelector(s);
  const esc = UI.esc;

  const EXAMPLES = [
    { sense: 'max', method: 'bigM', c: ['3', '5'], rows: [[['1', '0'], '<=', '4'], [['0', '2'], '<=', '12'], [['3', '2'], '<=', '18']] },
    { sense: 'min', method: 'bigM', c: ['4', '1'], rows: [[['3', '1'], '=', '3'], [['4', '3'], '>=', '6'], [['1', '2'], '<=', '4']] },
    { sense: 'min', method: 'twoPhase', c: ['0.4', '0.5'], rows: [[['0.3', '0.1'], '<=', '2.7'], [['0.5', '0.5'], '=', '6'], [['0.6', '0.4'], '>=', '6']] },
    { sense: 'max', method: 'bigM', mode: 'dual', graphic: true, c: ['8', '3', '-2'], signs: ['<=0', '>=0', 'free'], rows: [[['1', '-6', '1'], '>=', '2'], [['5', '7', '-2'], '=', '-4']] },
  ];

  const state = { mode: 'simplex', n: 2, m: 3, c: [], A: [], rel: [], b: [], signs: [], last: null };

  const el = {
    grid: $('#grid'), sense: $('#sense'), method: $('#method'), nvars: $('#nvars'), ncons: $('#ncons'),
    screen: $('#screen'), formError: $('#form-error'), btnSolve: $('#btn-solve'), btnClear: $('#btn-clear'), btnSound: $('#btn-sound'),
    btnAi: $('#btn-ai'), led: $('#ai-led'), dlg: $('#dlg-ai'), aiKey: $('#ai-key'), aiModel: $('#ai-model'), aiStatus: $('#ai-status'),
  };

  // ---------- Sonido 8 bits ----------
  const Sound = {
    on: (() => { try { return localStorage.getItem('sx.sound') !== 'off'; } catch { return true; } })(),
    ctx: null,
    tone(freq, dur, when = 0, type = 'square', vol = 0.04) {
      if (!this.on) return;
      try {
        this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
        const t = this.ctx.currentTime + when;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        osc.connect(gain).connect(this.ctx.destination);
        osc.start(t);
        osc.stop(t + dur);
      } catch { /* audio no disponible */ }
    },
    click() { this.tone(660, 0.05); },
    coin() { this.tone(988, 0.08); this.tone(1319, 0.28, 0.08); },
    win() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.13, i * 0.1)); },
    lose() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.18, i * 0.15, 'sawtooth', 0.03)); },
  };

  function paintSound() {
    el.btnSound.textContent = Sound.on ? '♪ SONIDO ON' : '♪ SONIDO OFF';
    el.btnSound.setAttribute('aria-pressed', String(Sound.on));
  }

  // ---------- Formulario del modelo ----------
  const fit = (arr, len, fill) => Array.from({ length: len }, (_, i) => (arr[i] !== undefined ? arr[i] : fill()));

  function renderGrid() {
    const { n, m } = state;
    state.c = fit(state.c, n, () => '');
    state.A = fit(state.A, m, () => []).map((row) => fit(row, n, () => ''));
    state.rel = fit(state.rel, m, () => '<=');
    state.b = fit(state.b, m, () => '');
    state.signs = fit(state.signs, n, () => '>=0');

    const head = `<tr><th></th>${Array.from({ length: n }, (_, j) => `<th>x${j + 1}</th>`).join('')}<th></th><th>LADO DER.</th></tr>`;
    const zRow = `<tr><td class="row-tag">Z =</td>${state.c.map((v, j) => `<td><input class="px-input cell" data-k="c" data-j="${j}" value="${esc(v)}" placeholder="0" aria-label="Coeficiente de x${j + 1} en Z" inputmode="decimal"></td>`).join('')}<td></td><td></td></tr>`;
    const rows = state.A.map((row, i) => `<tr><td class="row-tag">R${i + 1}</td>${row.map((v, j) => `<td><input class="px-input cell" data-k="a" data-i="${i}" data-j="${j}" value="${esc(v)}" placeholder="0" aria-label="R${i + 1}, coeficiente de x${j + 1}" inputmode="decimal"></td>`).join('')}
      <td><select class="px-input rel" data-k="rel" data-i="${i}" aria-label="Signo de R${i + 1}">${['<=', '>=', '='].map((r) => `<option value="${r}" ${state.rel[i] === r ? 'selected' : ''}>${SX.REL_TXT[r]}</option>`).join('')}</select></td>
      <td><input class="px-input cell" data-k="b" data-i="${i}" value="${esc(state.b[i])}" placeholder="0" aria-label="Lado derecho de R${i + 1}" inputmode="decimal"></td></tr>`).join('');
    const signRow = `<tr class="sign-row"><td class="row-tag">SIGNO</td>${state.signs.map((s, j) => `<td><select class="px-input sign" data-k="sign" data-j="${j}" aria-label="Signo de x${j + 1}">${[['>=0', '≥ 0'], ['<=0', '≤ 0'], ['free', 'irr.']].map(([v, t]) => `<option value="${v}" ${s === v ? 'selected' : ''}>${t}</option>`).join('')}</select></td>`).join('')}<td></td><td></td></tr>`;
    el.grid.innerHTML = `<table>${head}${zRow}${rows}${signRow}</table>`;
  }

  el.grid.addEventListener('input', (e) => {
    const t = e.target;
    const { k, i, j } = t.dataset;
    t.classList.remove('invalid');
    if (k === 'c') state.c[j] = t.value;
    if (k === 'a') state.A[i][j] = t.value;
    if (k === 'rel') state.rel[i] = t.value;
    if (k === 'b') state.b[i] = t.value;
    if (k === 'sign') state.signs[j] = t.value;
  });
  el.grid.addEventListener('keydown', (e) => { if (e.key === 'Enter') solve(); });

  function setSize(n, m) {
    state.n = Math.min(10, Math.max(1, n | 0 || 1));
    state.m = Math.min(12, Math.max(1, m | 0 || 1));
    el.nvars.value = state.n;
    el.ncons.value = state.m;
    renderGrid();
  }
  el.nvars.addEventListener('change', () => setSize(+el.nvars.value, state.m));
  el.ncons.addEventListener('change', () => setSize(state.n, +el.ncons.value));

  function loadStrings({ sense, method, c, rows, signs }) {
    el.sense.value = sense;
    if (method) el.method.value = method;
    state.c = [...c];
    state.signs = signs ? [...signs] : c.map(() => '>=0');
    state.A = rows.map((r) => [...r[0]]);
    state.rel = rows.map((r) => r[1]);
    state.b = rows.map((r) => r[2]);
    setSize(c.length, rows.length);
  }

  function readModel() {
    let bad = null;
    const parse = (value, input) => {
      const s = String(value).trim();
      if (s === '') return Frac.ZERO;
      try {
        return Frac.parse(s);
      } catch {
        input.classList.add('invalid');
        bad = bad || `"${s}" no es un número válido.`;
        return Frac.ZERO;
      }
    };
    const cell = (sel) => el.grid.querySelector(sel);
    const model = {
      sense: el.sense.value,
      varNames: state.c.map((_, j) => `x${j + 1}`),
      varSigns: [...state.signs],
      c: state.c.map((v, j) => parse(v, cell(`[data-k="c"][data-j="${j}"]`))),
      constraints: state.A.map((row, i) => ({
        a: row.map((v, j) => parse(v, cell(`[data-k="a"][data-i="${i}"][data-j="${j}"]`))),
        rel: state.rel[i],
        b: parse(state.b[i], cell(`[data-k="b"][data-i="${i}"]`)),
      })),
    };
    if (bad) throw new Error(`${bad} Corrige la celda marcada en rojo (usa 3, 0.5 o 3/4).`);
    return model;
  }

  function showFormError(msg) {
    el.formError.textContent = msg;
    el.formError.hidden = !msg;
  }

  // ---------- Resolver ----------
  function solve({ silent = false } = {}) {
    let model;
    try {
      model = readModel();
      showFormError('');
    } catch (err) {
      showFormError(err.message);
      if (!silent) Sound.lose();
      return;
    }
    const method = el.method.value;
    const wantGraph = $('#graphic').checked;
    const form = currentForm();
    const graphOf = (m, objName, res, view = null) => (m.varNames.length === 2
      ? SX.graphic({ ...m, objName }, { path: SX.simplexPath(res), view })
      : null);
    let status;
    try {
      if (state.mode === 'simplex') {
        const res = SX.solve(model, method);
        const nb = SX.NB.simplexNotebook(res, model, { graph: wantGraph ? graphOf(model, 'Z', res, presetView()) : undefined });
        el.screen.innerHTML = UI.screenSimplex(res, model, SX.NB.render(nb), SX.verifyBadge(SX.verify(model, res, 'Z')));
        state.last = { kind: 'simplex', res, model, nb, form, comments: {} };
        status = res.status;
      } else {
        const d = SX.solveDuality(model, method);
        const nb = SX.NB.dualNotebook(d, model, wantGraph
          ? { graph: graphOf(d.dual, 'W', d.dualRes), graphPrimal: graphOf(model, 'Z', d.primal) }
          : {});
        el.screen.innerHTML = UI.screenDual(d, model, SX.NB.render(nb),
          SX.verifyBadge(SX.verify(model, d.primal, 'Z'), 'PRIMAL') + SX.verifyBadge(SX.verify(d.dual, d.dualRes, 'W'), 'DUAL'));
        state.last = { kind: 'dual', res: d, model, nb, form, comments: {} };
        status = d.check ? 'optimal' : 'infeasible';
      }
    } catch (err) {
      el.screen.innerHTML = `<div class="banner banner-lose pop"><div class="banner-big">ERROR</div><p>${esc(err.message)}</p></div>`;
      state.last = null;
      status = 'error';
    }
    paintVaultForm();
    if (silent) return;
    status === 'optimal' ? Sound.win() : Sound.lose();
    if (window.innerWidth < 1024) el.screen.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function currentForm() {
    return {
      sense: el.sense.value,
      method: el.method.value,
      graphic: $('#graphic').checked,
      c: [...state.c],
      signs: [...state.signs],
      rows: state.A.map((row, i) => [[...row], state.rel[i], state.b[i]]),
    };
  }

  function idleScreen(title = 'CARGA UN MODELO<br>Y PULSA ▶ START', text = 'Escribe los coeficientes del ejercicio, elige un ejemplo o abre uno de tu bóveda, y pulsa START.') {
    state.last = null;
    el.screen.innerHTML = `<div class="banner banner-duo"><div class="banner-kicker">PLAYER READY</div><div class="banner-big">${title}</div><p>${text}</p></div>`;
    paintVaultForm();
  }

  el.btnSolve.addEventListener('click', () => solve());
  el.btnClear.addEventListener('click', () => {
    Sound.click();
    state.c = []; state.A = []; state.rel = []; state.b = []; state.signs = [];
    state.preset = null;
    renderPresets();
    renderGrid();
    showFormError('');
    idleScreen();
  });

  function setMode(mode) {
    state.mode = mode;
    document.querySelectorAll('.mode').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.mode === mode)));
  }

  document.querySelectorAll('[data-example]').forEach((btn) =>
    btn.addEventListener('click', () => {
      Sound.coin();
      const ex = EXAMPLES[+btn.dataset.example];
      state.preset = null;
      renderPresets();
      loadStrings(ex);
      if (ex.mode) setMode(ex.mode);
      $('#graphic').checked = Boolean(ex.graphic);
      showFormError('');
      idleScreen('EJEMPLO CARGADO<br>PULSA ▶ START', 'Revisa los datos en el formulario y pulsa START para ver la solución paso a paso.');
    }));

  document.querySelectorAll('.mode').forEach((tab) =>
    tab.addEventListener('click', () => {
      Sound.coin();
      setMode(tab.dataset.mode);
      if (state.last) solve({ silent: true });
    }));

  $('#graphic').addEventListener('change', () => { if (state.last) solve({ silent: true }); });

  el.btnSound.addEventListener('click', () => {
    Sound.on = !Sound.on;
    try { localStorage.setItem('sx.sound', Sound.on ? 'on' : 'off'); } catch { /* sin almacenamiento */ }
    paintSound();
    Sound.click();
  });

  // ---------- IA ----------
  const loading = (label) => `<div class="loading">${esc(label)} <i></i></div>`;

  function paintLed() {
    const ready = Boolean(AI.config.key);
    el.led.classList.toggle('on', ready);
    el.btnAi.title = ready ? `IA lista · ${AI.config.model || 'modelo gratis automático'}` : 'Falta configurar la API key';
  }

  async function withButton(btn, fn) {
    btn.disabled = true;
    try { await fn(); } finally { btn.disabled = false; }
  }

  function needsKey(err) {
    if (!AI.config.key) openAiDialog();
    return `<p class="ai-error">${esc(err.message)}</p>`;
  }

  el.screen.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-ai-explain]');
    if (!btn || !state.last) return;
    const notebook = btn.closest('.notebook');
    const status = notebook.querySelector('[data-ai-status]');
    const { kind, nb } = state.last;
    withButton(btn, async () => {
      Sound.coin();
      status.hidden = false;
      status.innerHTML = loading('LA IA ESTÁ EXPLICANDO · PUEDE TARDAR UN MINUTO');
      try {
        const onProgress = (msg) => { status.innerHTML = loading(msg.toUpperCase()); };
        const all = SX.NB.forAI(nb);
        const pending = all.filter((s) => notebook.querySelector(`[data-comment="${CSS.escape(s.id)}"]`)?.hidden);
        const last = state.last;
        const { comments, usedModel, total, explained } = await AI.comment(kind, pending.length ? pending : all, onProgress);
        applyComments(notebook, comments);
        if (state.last === last) {
          Object.assign(last.comments, comments);
          if (last.vaultId && SX.Vault.update(last.vaultId, { comments: last.comments })) {
            setVaultMsg('Explicación guardada también en la bóveda ✓', 't-win');
            renderVault();
          }
        }
        status.innerHTML = explained === total
          ? `<span class="ai-meta">✓ ${total} DE ${total} SECCIONES EXPLICADAS · ${esc(usedModel)}</span>`
          : `<span class="ai-meta">${explained} DE ${total} SECCIONES EXPLICADAS · ${esc(usedModel)}</span> <span class="ai-error">La IA se saltó algunas; pulsa otra vez para completarlas.</span>`;
        explained ? Sound.win() : Sound.lose();
      } catch (err) {
        status.innerHTML = needsKey(err);
        Sound.lose();
      }
    });
  });

  function applyComments(notebook, comments) {
    if (!notebook || !comments) return 0;
    let shown = 0;
    notebook.querySelectorAll('[data-comment]').forEach((box) => {
      const text = comments[box.dataset.comment];
      if (typeof text !== 'string' || !text) return;
      box.innerHTML = `<span class="nb-comment-tag">${box.dataset.comment === 'final' ? 'EN RESUMEN' : 'EXPLICACIÓN'}</span><p>${esc(text)}</p>`;
      box.hidden = false;
      shown++;
    });
    return shown;
  }

  // ---------- Bóveda de ejercicios ----------
  const vault = {
    form: $('#vault-form'), name: $('#vault-name'), save: $('#vault-save'), msg: $('#vault-msg'),
    list: $('#vault-list'), file: $('#vault-file'),
  };
  const MODE_TXT = { simplex: 'SIMPLEX', dual: 'DUALIDAD' };

  function setVaultMsg(text, cls = 't-mute') {
    vault.msg.className = `small mt-2 ${cls}`;
    vault.msg.textContent = text;
  }

  function suggestName() {
    const { model, kind } = state.last;
    const obj = `${model.sense === 'max' ? 'Max' : 'Min'} Z = ${SX.linearExpr(model.c, model.varNames)}`;
    return `${kind === 'dual' ? 'Dualidad' : 'Simplex'} · ${obj}`.slice(0, 60);
  }

  function paintVaultForm() {
    const last = state.last;
    const ready = Boolean(last);
    const stored = ready && last.vaultId;
    vault.name.disabled = !ready || Boolean(stored);
    vault.save.disabled = !ready || Boolean(stored);
    vault.save.textContent = stored ? 'GUARDADO ✓' : 'GUARDAR';
    vault.name.placeholder = ready ? 'Nombre del ejercicio' : 'Primero pulsa ▶ START';
    if (!ready) vault.name.value = '';
    else if (stored) vault.name.value = SX.Vault.get(last.vaultId)?.name || vault.name.value;
    else if (!vault.name.value || vault.name.dataset.auto === '1') {
      vault.name.value = suggestName();
      vault.name.dataset.auto = '1';
    }
    renderVault();
  }

  function renderVault() {
    const items = SX.Vault.list();
    const activeId = state.last && state.last.vaultId;
    if (!items.length) {
      vault.list.innerHTML = '<li class="vault-empty">Todavía no hay ejercicios guardados.</li>';
      return;
    }
    vault.list.innerHTML = items.map((e) => {
      const date = new Date(e.savedAt);
      const when = isNaN(date) ? '' : date.toLocaleDateString('es', { day: '2-digit', month: 'short' });
      const explained = e.comments && Object.keys(e.comments).length;
      return `<li class="vault-item${e.id === activeId ? ' is-active' : ''}">
        <button class="vault-open" type="button" data-vault-open="${esc(e.id)}">
          <span class="vault-mode vault-mode--${e.mode}">${e.mode === 'dual' ? '2P' : '1P'}</span>
          <span class="vault-text"><span class="vault-name">${esc(e.name)}</span>
          <span class="vault-meta">${MODE_TXT[e.mode]}${when ? ` · ${esc(when)}` : ''}${explained ? ' · CON EXPLICACIÓN' : ''}</span></span>
        </button>
        <button class="vault-del" type="button" data-vault-del="${esc(e.id)}" aria-label="Borrar ${esc(e.name)}">✕</button>
      </li>`;
    }).join('');
  }

  // ---------- Memorias fijas del informe ----------
  const presetList = $('#vault-presets');
  const modelKey = (f) => JSON.stringify([f.sense, f.c, f.signs, f.rows]);

  function renderPresets() {
    presetList.innerHTML = SX.Vault.presets.map((p) => `
      <li class="vault-item${state.preset === p ? ' is-active' : ''}">
        <button class="vault-open" type="button" data-preset="${p.slot}">
          <span class="vault-mode vault-mode--preset">M${p.slot}</span>
          <span class="vault-text"><span class="vault-name">Ejercicio ${p.slot} · ${esc(p.name)}</span>
          <span class="vault-meta">${esc(p.topic.toUpperCase())} · ${esc(p.expected.pages.toUpperCase())}</span></span>
        </button>
      </li>`).join('');
  }

  presetList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-preset]');
    if (!btn) return;
    const p = SX.Vault.presets.find((x) => x.slot === Number(btn.dataset.preset));
    Sound.coin();
    loadStrings(p.form);
    $('#graphic').checked = p.form.graphic;
    setMode('simplex');
    showFormError('');
    idleScreen(`MEMORIA ${p.slot} CARGADA<br>PULSA ▶ START`,
      `Ejercicio ${p.slot} del informe: ${esc(p.name)}. Al resolverlo, compara con el PDF (${esc(p.expected.pages)}).`);
    state.preset = p;
    setVaultMsg(`Memoria ${p.slot} cargada en el formulario.`, 't-phos');
    renderPresets();
    if (window.innerWidth < 1024) el.btnSolve.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // Con una memoria del informe sin modificar, la gráfica usa los mismos ejes que el PDF.
  function presetView() {
    const p = state.preset;
    if (!p || state.mode !== 'simplex' || modelKey(currentForm()) !== modelKey(p.form)) return null;
    return p.view;
  }

  vault.name.addEventListener('input', () => { vault.name.dataset.auto = '0'; });

  vault.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const last = state.last;
    if (!last) return;
    const name = vault.name.value.trim() || suggestName();
    const saved = SX.Vault.add({ name: name.slice(0, 60), mode: last.kind, form: last.form, comments: last.comments });
    if (!saved) {
      setVaultMsg('No se pudo guardar: el navegador no permite almacenamiento en esta página.', 't-lose');
      Sound.lose();
      return;
    }
    last.vaultId = saved.id;
    vault.name.dataset.auto = '1';
    setVaultMsg(`"${saved.name}" quedó guardado en la bóveda.`, 't-win');
    Sound.coin();
    paintVaultForm();
  });

  function openFromVault(id) {
    const entry = SX.Vault.get(id);
    if (!entry) return;
    state.preset = null;
    renderPresets();
    Sound.coin();
    try {
      loadStrings(entry.form);
    } catch {
      setVaultMsg(`"${entry.name}" tiene datos dañados y no se pudo abrir.`, 't-lose');
      return;
    }
    $('#graphic').checked = Boolean(entry.form.graphic);
    setMode(entry.mode);
    solve({ silent: true });
    if (!state.last) {
      setVaultMsg(`"${entry.name}" tiene datos inválidos y no se pudo resolver.`, 't-lose');
      return;
    }
    state.last.vaultId = entry.id;
    state.last.comments = { ...(entry.comments || {}) };
    const notebook = el.screen.querySelector('.notebook');
    if (applyComments(notebook, entry.comments)) {
      const status = notebook.querySelector('[data-ai-status]');
      status.hidden = false;
      status.innerHTML = '<span class="ai-meta">EXPLICACIÓN RECUPERADA DE LA BÓVEDA</span>';
    }
    setVaultMsg(`Mostrando "${entry.name}".`, 't-phos');
    paintVaultForm();
    el.screen.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  vault.list.addEventListener('click', (e) => {
    const open = e.target.closest('[data-vault-open]');
    if (open) { openFromVault(open.dataset.vaultOpen); return; }
    const del = e.target.closest('[data-vault-del]');
    if (!del) return;
    if (del.dataset.confirm !== '1') {
      del.dataset.confirm = '1';
      del.textContent = '¿BORRAR?';
      del.classList.add('is-confirm');
      setTimeout(() => {
        if (!del.isConnected) return;
        del.dataset.confirm = '';
        del.textContent = '✕';
        del.classList.remove('is-confirm');
      }, 3000);
      return;
    }
    const id = del.dataset.vaultDel;
    const name = SX.Vault.get(id)?.name || 'El ejercicio';
    SX.Vault.remove(id);
    if (state.last && state.last.vaultId === id) delete state.last.vaultId;
    setVaultMsg(`"${name}" se borró de la bóveda.`);
    Sound.click();
    paintVaultForm();
  });

  $('#vault-export').addEventListener('click', () => {
    const count = SX.Vault.list().length;
    if (!count) {
      setVaultMsg('La bóveda está vacía: guarda al menos un ejercicio antes de exportar.', 't-coin');
      return;
    }
    const url = URL.createObjectURL(new Blob([SX.Vault.exportJson()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'boveda-simplex-arcade.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setVaultMsg(`Se exportaron ${count} ejercicios a boveda-simplex-arcade.json.`, 't-win');
  });

  $('#vault-import').addEventListener('click', () => vault.file.click());
  vault.file.addEventListener('change', async () => {
    const file = vault.file.files[0];
    vault.file.value = '';
    if (!file) return;
    try {
      const added = SX.Vault.importJson(await file.text());
      setVaultMsg(added ? `Se importaron ${added} ejercicios.` : 'No había ejercicios nuevos en ese archivo.', added ? 't-win' : 't-coin');
      Sound.coin();
      renderVault();
    } catch (err) {
      setVaultMsg(`No se pudo importar: ${err instanceof SyntaxError ? 'el archivo no es un JSON válido' : err.message}.`, 't-lose');
      Sound.lose();
    }
  });

  function fillModels(list) {
    const current = AI.config.model;
    const options = [`<option value="">Automático (primer modelo gratis disponible)</option>`]
      .concat(list.map((m) => `<option value="${esc(m.id)}">${esc(m.id)}${m.id === AI.config.DEFAULT_MODEL ? ' (recomendado)' : ''}</option>`));
    if (current && !list.some((m) => m.id === current)) options.push(`<option value="${esc(current)}">${esc(current)}</option>`);
    el.aiModel.innerHTML = options.join('');
    el.aiModel.value = current;
  }

  function openAiDialog() {
    el.aiKey.value = AI.config.key;
    fillModels(AI.config.freeModels);
    if (!el.dlg.open) el.dlg.showModal();
  }

  const setAiStatus = (msg, cls = 't-mute') => { el.aiStatus.className = `small ${cls}`; el.aiStatus.textContent = msg; };

  el.btnAi.addEventListener('click', () => { Sound.click(); openAiDialog(); });
  $('#ai-show').addEventListener('click', (e) => {
    const show = el.aiKey.type === 'password';
    el.aiKey.type = show ? 'text' : 'password';
    e.currentTarget.textContent = show ? 'OCULTAR' : 'VER';
  });
  $('#ai-load').addEventListener('click', (e) => withButton(e.currentTarget, async () => {
    setAiStatus('Buscando modelos gratuitos…');
    try {
      const list = await AI.listFreeModels();
      fillModels(list);
      setAiStatus(`${list.length} modelos gratuitos encontrados.`, 't-win');
    } catch (err) {
      setAiStatus(err.message, 't-lose');
    }
  }));
  $('#ai-test').addEventListener('click', (e) => withButton(e.currentTarget, async () => {
    AI.config.key = el.aiKey.value;
    AI.config.model = el.aiModel.value;
    paintLed();
    setAiStatus('Probando conexión…');
    try {
      const { model } = await AI.chat([{ role: 'user', content: 'Responde solo con la palabra LISTO.' }], { maxTokens: 2000 });
      setAiStatus(`Conexión correcta con ${model}.`, 't-win');
      Sound.coin();
    } catch (err) {
      setAiStatus(err.message, 't-lose');
      Sound.lose();
    }
  }));
  $('#ai-save').addEventListener('click', () => {
    AI.config.key = el.aiKey.value;
    AI.config.model = el.aiModel.value;
    paintLed();
    Sound.coin();
    el.dlg.close();
  });
  $('#ai-forget').addEventListener('click', () => {
    AI.config.key = '';
    el.aiKey.value = '';
    paintLed();
    setAiStatus('API key borrada de este navegador.');
  });

  // ---------- Inicio ----------
  paintSound();
  paintLed();
  loadStrings(EXAMPLES[0]);
  renderPresets();
  idleScreen();
})();
