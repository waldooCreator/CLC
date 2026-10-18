(function (root) {
  const SX = root.SX;
  const KEY = 'sx.vault.v1';

  const read = () => {
    try {
      const list = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  };
  const write = (list) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
      return true;
    } catch {
      return false;
    }
  };
  const newId = () => `ej-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const isExercise = (e) => e && typeof e.name === 'string' && (e.mode === 'simplex' || e.mode === 'dual')
    && e.form && Array.isArray(e.form.c) && Array.isArray(e.form.rows);

  // Los tres ejercicios de documentacion/ejercicios-simplex-revisado.pdf, con el resultado que trae el informe.
  const PRESETS = [
    {
      slot: 1,
      name: 'Wyndor Glass Co.',
      topic: 'Max con ≤ · puertas y ventanas',
      expected: { pages: 'págs. 2–6' },
      view: { xmax: 9, ymax: 10, step: 2, scale: 0.6 },
      form: {
        sense: 'max', method: 'bigM', graphic: true,
        c: ['3', '5'], signs: ['>=0', '>=0'],
        rows: [[['1', '0'], '<=', '4'], [['0', '2'], '<=', '12'], [['3', '2'], '<=', '18']],
      },
    },
    {
      slot: 2,
      name: 'Reddy Mikks',
      topic: 'Max con ≤ · pinturas',
      expected: { pages: 'págs. 7–10' },
      view: { xmax: 6.5, ymax: 4.5, step: 1, scale: 1.05 },
      form: {
        sense: 'max', method: 'bigM', graphic: true,
        c: ['5', '4'], signs: ['>=0', '>=0'],
        rows: [[['6', '4'], '<=', '24'], [['1', '2'], '<=', '6'], [['-1', '1'], '<=', '1'], [['0', '1'], '<=', '2']],
      },
    },
    {
      slot: 3,
      name: 'Terapia de radiación',
      topic: 'Min con ≤ = ≥ · Gran M',
      expected: { pages: 'págs. 11–16' },
      view: { xmax: 14, ymax: 16, step: 2, scale: 0.52 },
      form: {
        sense: 'min', method: 'bigM', graphic: true,
        c: ['0.4', '0.5'], signs: ['>=0', '>=0'],
        rows: [[['0.3', '0.1'], '<=', '2.7'], [['0.5', '0.5'], '=', '6'], [['0.6', '0.4'], '>=', '6']],
      },
    },
  ];

  SX.Vault = {
    presets: PRESETS,
    list: read,
    get: (id) => read().find((e) => e.id === id),
    add(entry) {
      const list = read();
      const saved = { ...entry, id: newId(), savedAt: new Date().toISOString() };
      list.unshift(saved);
      return write(list) ? saved : null;
    },
    update(id, patch) {
      const list = read();
      const i = list.findIndex((e) => e.id === id);
      if (i === -1) return null;
      list[i] = { ...list[i], ...patch };
      return write(list) ? list[i] : null;
    },
    remove(id) {
      write(read().filter((e) => e.id !== id));
    },
    exportJson: () => JSON.stringify({ app: 'simplex-arcade', version: 1, exercises: read() }, null, 2),
    importJson(text) {
      const data = JSON.parse(text);
      const incoming = (Array.isArray(data) ? data : data.exercises || []).filter(isExercise);
      const list = read();
      let added = 0;
      incoming.forEach((e) => {
        if (e.id && list.some((x) => x.id === e.id)) return;
        list.push({ ...e, id: e.id || newId(), name: e.name.slice(0, 60) });
        added++;
      });
      if (!write(list)) throw new Error('No hay espacio para guardar en este navegador.');
      return added;
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
