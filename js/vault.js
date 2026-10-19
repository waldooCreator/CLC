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
  const MODES = ['simplex', 'dual', 'assign', 'maxflow', 'mincost'];
  const isExercise = (e) => e && typeof e.name === 'string' && MODES.includes(e.mode) && e.form && typeof e.form === 'object'
    && (e.mode === 'simplex' || e.mode === 'dual' ? Array.isArray(e.form.c) && Array.isArray(e.form.rows)
      : e.mode === 'assign' ? Array.isArray(e.form.cost) && Array.isArray(e.form.agents) && Array.isArray(e.form.tasks)
        : Array.isArray(e.form.arcs));

  const ARCS = (txt) => txt.trim().split(/\s*;\s*/).map((t) => t.split(/\s+/));
  const GROUPS = [
    { key: 'simplex', title: 'PRIMER PREVIO · SIMPLEX REVISADO', doc: 'ejercicios-simplex-revisado.pdf' },
    { key: 'assign', title: 'ASIGNACIÓN · KUHN-MUNKRES', doc: '02-asignacion-kuhn-munkres.pdf' },
    { key: 'special', title: 'CASOS PARTICULARES DE ASIGNACIÓN', doc: '03-casos-particulares-asignacion.pdf' },
    { key: 'maxflow', title: 'FLUJO MÁXIMO', doc: '04-flujo-maximo.pdf' },
    { key: 'mincost', title: 'FLUJO A COSTO MÍNIMO', doc: '05-flujo-costo-minimo.pdf' },
  ];

  // Los ejercicios resueltos en los PDF de documentacion/, con el resultado que trae cada informe.
  const PRESETS = [
    {
      slot: 1, group: 'simplex', mode: 'simplex',
      name: 'Wyndor Glass Co.',
      topic: 'Max con ≤ · puertas y ventanas',
      expected: { pages: 'págs. 2–6', value: '36' },
      view: { xmax: 9, ymax: 10, step: 2, scale: 0.6 },
      form: {
        sense: 'max', method: 'bigM', graphic: true,
        c: ['3', '5'], signs: ['>=0', '>=0'],
        rows: [[['1', '0'], '<=', '4'], [['0', '2'], '<=', '12'], [['3', '2'], '<=', '18']],
      },
    },
    {
      slot: 2, group: 'simplex', mode: 'simplex',
      name: 'Reddy Mikks',
      topic: 'Max con ≤ · pinturas',
      expected: { pages: 'págs. 7–10', value: '21' },
      view: { xmax: 6.5, ymax: 4.5, step: 1, scale: 1.05 },
      form: {
        sense: 'max', method: 'bigM', graphic: true,
        c: ['5', '4'], signs: ['>=0', '>=0'],
        rows: [[['6', '4'], '<=', '24'], [['1', '2'], '<=', '6'], [['-1', '1'], '<=', '1'], [['0', '1'], '<=', '2']],
      },
    },
    {
      slot: 3, group: 'simplex', mode: 'simplex',
      name: 'Terapia de radiación',
      topic: 'Min con ≤ = ≥ · Gran M',
      expected: { pages: 'págs. 11–16', value: '21/4' },
      view: { xmax: 14, ymax: 16, step: 2, scale: 0.52 },
      form: {
        sense: 'min', method: 'bigM', graphic: true,
        c: ['0.4', '0.5'], signs: ['>=0', '>=0'],
        rows: [[['0.3', '0.1'], '<=', '2.7'], [['0.5', '0.5'], '=', '6'], [['0.6', '0.4'], '>=', '6']],
      },
    },
    {
      slot: 4, group: 'assign', mode: 'assign',
      name: 'Los hijos de Joe Klyne',
      topic: 'Taha · 3×3 · tareas de la casa',
      expected: { pages: 'ejercicio 1', value: '27' },
      form: {
        sense: 'min', agents: ['John', 'Karen', 'Terri'], tasks: ['Podar', 'Pintar', 'Lavar'],
        cost: [['15', '10', '9'], ['9', '15', '10'], ['10', '12', '8']], capacity: ['', '', ''],
      },
    },
    {
      slot: 5, group: 'assign', mode: 'assign',
      name: 'Fowle Marketing Research',
      topic: 'Anderson · 3×3 · un ajuste',
      expected: { pages: 'ejercicio 2', value: '26' },
      form: {
        sense: 'min', agents: ['Terry', 'Carle', 'McClymonds'], tasks: ['Cliente 1', 'Cliente 2', 'Cliente 3'],
        cost: [['10', '15', '9'], ['9', '18', '5'], ['6', '14', '3']], capacity: ['', '', ''],
      },
    },
    {
      slot: 6, group: 'assign', mode: 'assign',
      name: 'Machineco',
      topic: 'Winston · 4×4 · tiempos de preparación',
      expected: { pages: 'ejercicio 3', value: '15' },
      form: {
        sense: 'min', agents: ['Máq. 1', 'Máq. 2', 'Máq. 3', 'Máq. 4'], tasks: ['Trabajo 1', 'Trabajo 2', 'Trabajo 3', 'Trabajo 4'],
        cost: [['14', '5', '8', '7'], ['2', '12', '6', '5'], ['7', '8', '3', '9'], ['2', '4', '6', '10']], capacity: ['', '', '', ''],
      },
    },
    {
      slot: 7, group: 'special', mode: 'assign',
      name: 'Job Shop Co.',
      topic: 'Hillier · no balanceado y prohibida',
      expected: { pages: 'ejercicio 1', value: '29' },
      form: {
        sense: 'min', agents: ['Máquina 1', 'Máquina 2', 'Máquina 3'], tasks: ['Lugar 1', 'Lugar 2', 'Lugar 3', 'Lugar 4'],
        cost: [['13', '16', '12', '11'], ['15', 'M', '13', '20'], ['5', '7', '10', '6']], capacity: ['', '', ''],
      },
    },
    {
      slot: 8, group: 'special', mode: 'assign',
      name: 'Vendedores y zonas',
      topic: 'Adaptado · maximizar ventas',
      expected: { pages: 'ejercicio 2', value: '252' },
      form: {
        sense: 'max', agents: ['Ana', 'Beto', 'Carla', 'Diego'], tasks: ['Norte', 'Sur', 'Este', 'Oeste'],
        cost: [['44', '80', '52', '60'], ['60', '56', '40', '72'], ['36', '60', '48', '48'], ['52', '76', '36', '40']], capacity: ['', '', '', ''],
      },
    },
    {
      slot: 9, group: 'special', mode: 'assign',
      name: 'Better Products Co.',
      topic: 'Hillier · plantas con 2 productos',
      expected: { pages: 'ejercicio 3', value: '3290' },
      form: {
        sense: 'min', agents: ['Planta 1', 'Planta 2', 'Planta 3'], tasks: ['Prod. 1', 'Prod. 2', 'Prod. 3', 'Prod. 4'],
        cost: [['820', '810', '840', '960'], ['800', '870', 'M', '920'], ['740', '900', '810', '840']], capacity: ['2', '2', '1'],
      },
    },
    {
      slot: 10, group: 'maxflow', mode: 'maxflow',
      name: 'Sunco Oil',
      topic: 'Winston · oleoducto pequeño',
      expected: { pages: 'ejercicio 1', value: '3' },
      layout: { so: [0, 1], 1: [1.4, 0], 2: [1.4, 2], 3: [2.8, 0], si: [4.2, 1] },
      form: { source: 'so', sink: 'si', arcs: ARCS('so 1 2; so 2 3; 1 2 3; 1 3 4; 3 si 1; 2 si 2') },
    },
    {
      slot: 11, group: 'maxflow', mode: 'maxflow',
      name: 'Parque Seervada',
      topic: 'Hillier · tranvías de O a T',
      expected: { pages: 'ejercicio 2', value: '14' },
      layout: { O: [0, 2], A: [1.5, 0.6], B: [2, 2], C: [1.5, 3.4], D: [3.6, 0.9], E: [3.6, 3.1], T: [5, 2] },
      form: { source: 'O', sink: 'T', arcs: ARCS('O A 5; O B 7; O C 4; A B 1; A D 3; B C 2; B D 4; B E 5; C E 4; D T 9; E D 1; E T 6') },
    },
    {
      slot: 12, group: 'maxflow', mode: 'maxflow',
      name: 'Red de Taha',
      topic: 'Taha · 5 nodos · corte en la fuente',
      expected: { pages: 'ejercicio 3', value: '60' },
      layout: { 1: [0, 2], 2: [1.8, 0.4], 3: [1.8, 2], 4: [1.8, 3.6], 5: [3.6, 2] },
      form: { source: '1', sink: '5', arcs: ARCS('1 2 20; 1 3 30; 1 4 10; 2 3 40; 2 5 30; 3 4 10; 3 5 20; 4 3 5; 4 5 20') },
    },
    {
      slot: 13, group: 'mincost', mode: 'mincost',
      name: 'Powerco',
      topic: 'Winston · transporte como red',
      expected: { pages: 'ejercicio 1', value: '1020' },
      layout: { P1: [0, 0.3], P2: [0, 2], P3: [0, 3.7], C1: [4.6, 0], C2: [4.6, 1.33], C3: [4.6, 2.67], C4: [4.6, 4] },
      form: {
        nodes: [['P1', '35'], ['P2', '50'], ['P3', '40'], ['C1', '-45'], ['C2', '-20'], ['C3', '-30'], ['C4', '-30']],
        arcs: ARCS('P1 C1 - 8; P1 C2 - 6; P1 C3 - 10; P1 C4 - 9; P2 C1 - 9; P2 C2 - 12; P2 C3 - 13; P2 C4 - 7; P3 C1 - 14; P3 C2 - 9; P3 C3 - 16; P3 C4 - 5'),
      },
    },
    {
      slot: 14, group: 'mincost', mode: 'mincost',
      name: 'Distribution Unlimited Co.',
      topic: 'Hillier · fábricas, centro y almacenes',
      expected: { pages: 'ejercicio 2', value: '49000' },
      layout: { F1: [0, 0.4], F2: [0, 3.2], CD: [2, 1.8], A1: [4, 0.4], A2: [4, 3.2] },
      form: {
        nodes: [['F1', '50'], ['F2', '40'], ['CD', '0'], ['A1', '-30'], ['A2', '-60']],
        arcs: ARCS('F1 F2 10 200; F1 CD - 400; F1 A1 - 900; F2 CD - 300; CD A2 80 100; A1 A2 - 300; A2 A1 - 200'),
      },
    },
    {
      slot: 15, group: 'mincost', mode: 'mincost',
      name: 'Ruta más corta en Seervada',
      topic: 'Hillier · 1 unidad de O a T',
      expected: { pages: 'ejercicio 3', value: '13' },
      layout: { O: [0, 2], A: [1.5, 0.6], B: [2, 2], C: [1.5, 3.4], D: [3.6, 0.9], E: [3.6, 3.1], T: [5, 2] },
      form: {
        undirected: true,
        nodes: [['O', '1'], ['T', '-1']],
        arcs: ARCS('O A - 2; O B - 5; O C - 4; A B - 2; A D - 7; B C - 1; B D - 4; B E - 3; C E - 4; D E - 1; D T - 5; E T - 7'),
      },
    },
  ];

  SX.Vault = {
    presets: PRESETS,
    groups: GROUPS,
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
