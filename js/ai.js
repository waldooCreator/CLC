(function (root) {
  const SX = root.SX;

  const API = 'https://openrouter.ai/api/v1';
  const K_KEY = 'sx.openrouter.key';
  const K_MODEL = 'sx.openrouter.model';
  const K_FREE = 'sx.openrouter.freeModels';
  const DEFAULT_MODEL = 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';
  const FALLBACKS = ['nvidia/nemotron-3-super-120b-a12b:free', 'nvidia/nemotron-3-ultra-550b-a55b:free'];
  const PREFERRED = ['nemotron-3-nano-omni', 'nemotron-3-super', 'nemotron-3-ultra', 'nemotron', 'deepseek', 'qwen', 'gemma', 'llama'];

  const store = {
    get(k) { try { return localStorage.getItem(k) || ''; } catch { return ''; } },
    set(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* sin almacenamiento */ } },
  };

  const config = {
    get key() { return store.get(K_KEY); },
    set key(v) { store.set(K_KEY, v.trim()); },
    get model() {
      const v = store.get(K_MODEL);
      return v === 'auto' ? '' : v || DEFAULT_MODEL;
    },
    set model(v) { store.set(K_MODEL, v.trim() || 'auto'); },
    DEFAULT_MODEL,
    get freeModels() { try { return JSON.parse(store.get(K_FREE) || '[]'); } catch { return []; } },
    set freeModels(list) { store.set(K_FREE, JSON.stringify(list)); },
  };

  async function listFreeModels() {
    const resp = await fetch(`${API}/models`);
    if (!resp.ok) throw new Error(`No se pudo leer la lista de modelos de OpenRouter (HTTP ${resp.status}).`);
    const { data } = await resp.json();
    const rank = (id) => {
      const i = PREFERRED.findIndex((p) => id.includes(p));
      return i === -1 ? PREFERRED.length : i;
    };
    const list = data
      .filter((m) => m.id.endsWith(':free') || (m.pricing && Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0 && !m.id.startsWith('openrouter/auto')))
      .filter((m) => {
        const outMods = (m.architecture && m.architecture.output_modalities) || ['text'];
        return outMods.length === 1 && outMods[0] === 'text' && !/(embed|audio|tts|whisper|lyria|guard|safety)/i.test(m.id);
      })
      .sort((a, b) => rank(a.id) - rank(b.id) || (b.context_length || 0) - (a.context_length || 0))
      .map((m) => ({ id: m.id, name: m.name || m.id }));
    config.freeModels = list;
    return list;
  }

  function friendlyError(status, detail) {
    const d = detail ? ` (${detail})` : '';
    if (status === 401) return `OpenRouter rechazó la API key. Revísala con el botón OPENROUTER${d}.`;
    if (status === 402) return `Ese modelo requiere créditos. Elige uno que termine en ":free"${d}.`;
    if (status === 404) return `El modelo ya no está disponible. Pulsa "CARGAR MODELOS GRATIS" y elige otro${d}.`;
    if (status === 429) return `Se alcanzó el límite gratuito de peticiones. Espera un minuto o prueba con otro modelo${d}.`;
    return `OpenRouter respondió con error ${status}${d}.`;
  }

  async function chat(messages, { maxTokens = 8000, temperature = 0.2 } = {}) {
    if (!config.key) throw new Error('Falta tu API key de OpenRouter. Pulsa el botón OPENROUTER (arriba a la derecha) para configurarla.');
    let models = config.freeModels.map((m) => m.id);
    if (!config.model && !models.length) models = (await listFreeModels()).map((m) => m.id);
    const tries = [...new Set([config.model, ...FALLBACKS, ...models].filter(Boolean))].slice(0, 4);
    if (!tries.length) throw new Error('No se encontraron modelos gratuitos en OpenRouter.');

    const headers = { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json', 'X-Title': 'Simplex Arcade' };
    if (location.protocol.startsWith('http')) headers['HTTP-Referer'] = location.origin;

    let lastError;
    for (const model of tries) {
      let resp;
      try {
        resp = await fetch(`${API}/chat/completions`, {
          method: 'POST',
          headers,
          // Los modelos de razonamiento gastan tokens "pensando"; se excluye ese texto de la respuesta.
          body: JSON.stringify({ model, messages, max_tokens: maxTokens, temperature, reasoning: { exclude: true } }),
        });
      } catch {
        throw new Error('No hay conexión con OpenRouter. Revisa tu internet.');
      }
      const data = await resp.json().catch(() => ({}));
      const detail = data.error && data.error.message;
      if (resp.ok && !data.error) {
        const choice = data.choices && data.choices[0];
        const content = choice && choice.message && choice.message.content;
        if (content && content.trim()) return { content, model };
        lastError = new Error(choice && choice.finish_reason === 'length'
          ? `El modelo ${model} se quedó sin tokens mientras razonaba. Intenta de nuevo.`
          : `El modelo ${model} devolvió una respuesta vacía.`);
        continue;
      }
      const status = resp.ok ? (data.error && data.error.code) || 500 : resp.status;
      lastError = new Error(friendlyError(status, detail));
      if (status === 401) throw lastError;
    }
    throw lastError;
  }

  function extractJson(text) {
    const clean = text.replace(/```(?:json)?/gi, '');
    const start = clean.indexOf('{');
    const end = clean.lastIndexOf('}');
    if (start === -1 || end <= start) throw new Error('La IA no respondió en el formato esperado. Pulsa de nuevo EXPLICAR A DETALLE.');
    return JSON.parse(clean.slice(start, end + 1));
  }

  const HUMAN_STYLE = `Cómo tienes que escribir:
- Como una persona explicándole a un compañero sus apuntes, en español sencillo de Latinoamérica. Frases cortas y naturales.
- Texto plano. PROHIBIDO usar LaTeX o símbolos de código: nada de \\( \\), $, \\le, \\frac, x_1, **negritas**, # títulos ni tablas.
- Variables pegadas: x1, y2, s1. Fracciones: 9/5. Símbolos permitidos: ≤ ≥ = → · − ⁻¹.
Ejemplos del tono (de apuntes reales):
"Los signos no me los invento, los saco de la tabla. Como x1 es ≤ 0 y el primal es de Max, busco esa fila y me dice que en el Min la restricción es ≤. Por eso la primera me queda y1 + 5y2 ≤ 8."
"De la igualdad despejo y1 = −2 + 2y2. Eso lo reemplazo en las otras restricciones y así me quedan solo con y2, que es más fácil."`;

  const TOPICS = {
    simplex: 'Método Simplex Revisado',
    dual: 'teoría de la dualidad (pasar del primal al dual y resolverlo)',
    assign: 'el problema de asignación resuelto con el método húngaro (Kuhn-Munkres), incluidos sus casos particulares',
    maxflow: 'el problema de flujo máximo resuelto con caminos de aumento (Ford-Fulkerson con búsqueda en anchura) y el corte mínimo',
    mincost: 'el problema de flujo a costo mínimo resuelto con rutas más baratas sucesivas',
  };
  const LP_HELP = 'en la forma estándar se agregan holguras (≤), excesos y artificiales (≥ o =) y la base inicial da B⁻¹ = I; en cada iteración xB = B⁻¹·b, π = cB·B⁻¹, entra la variable con zj − cj más negativo, sale la de menor razón xB/α y E actualiza B⁻¹; en dualidad los signos salen de la tabla, cada restricción del primal da una variable dual y cada variable da una restricción; en los despejes se buscan cortes, se reemplaza, se sacan las esquinas y se evalúa el objetivo.';
  const HELP = {
    simplex: LP_HELP,
    dual: LP_HELP,
    assign: 'restar el mismo número a toda una fila o columna no cambia cuál es la mejor asignación, solo baja el total; por eso se resta el menor de cada fila y luego de cada columna para fabricar ceros; después se tapan los ceros con el menor número de líneas; si hacen falta tantas líneas como filas, ya se puede asignar un cero por fila y columna; si no, se toma k = el menor número sin tapar, se resta a lo no tapado y se suma en los cruces de líneas. Casos particulares: si faltan filas o columnas se agregan ficticias con costo 0 (lo asignado ahí queda sin hacer), si es de maximizar se resta cada valor del mayor (pérdida de oportunidad), una celda prohibida vale M (gigante), un agente que hace varias tareas se copia una vez por tarea, y si hay otra forma de asignar ceros hay óptimos múltiples.',
    maxflow: 'cada arco tiene una capacidad; en cada ronda se busca el camino de la fuente al sumidero con menos arcos que todavía tenga espacio; lo que se puede mandar por él es el tramo más angosto (cuello de botella); un tramo recorrido al revés significa devolver flujo que ya iba por ese arco para mandarlo por otro lado; cuando ya no hay camino, los nodos que todavía se alcanzan desde la fuente forman el corte mínimo, y la suma de capacidades de los arcos que cruzan el corte es igual al flujo máximo.',
    mincost: 'los nodos con número positivo ofrecen unidades y los negativos las piden; todas las ofertas se juntan en un punto inicial S* y todas las demandas en T*; en cada ronda se busca la ruta más barata por unidad que todavía tenga espacio (un tramo al revés resta su costo porque deshace un envío), se manda lo que permita el tramo más limitado y se suma costo por unidad × unidades; si la oferta y la demanda no son iguales se agrega un nodo ficticio con costo 0; al final se revisa que en cada nodo lo que sale menos lo que entra sea su oferta.',
  };

  // Acepta las distintas formas en que los modelos devuelven la lista de pasos.
  function parseExplanations(text, count) {
    const byNum = {};
    let summary = '';
    const put = (key, val) => {
      if (typeof val !== 'string' || !val.trim()) return;
      const k = String(key).toLowerCase();
      if (/resumen|final|summary|conclusi/.test(k)) { summary = summary || val; return; }
      const m = k.match(/\d+/);
      if (!m) return;
      const n = Number(m[0]);
      if (n >= 1 && n <= count && !byNum[n]) byNum[n] = val;
    };
    const walk = (node, key) => {
      if (node === null || node === undefined) return;
      if (typeof node === 'string') { put(key, node); return; }
      if (Array.isArray(node)) {
        node.forEach((item, i) => {
          if (typeof item === 'string') { put(String(i + 1), item); return; }
          if (!item || typeof item !== 'object') return;
          const num = item.paso ?? item.step ?? item.numero ?? item.n ?? item.id;
          const txt = item.explicacion ?? item['explicación'] ?? item.comentario ?? item.texto ?? item.text ?? item.explanation;
          if (typeof txt === 'string') put(num !== undefined ? String(num) : String(i + 1), txt);
          else walk(item, String(i + 1));
        });
        return;
      }
      if (typeof node === 'object') Object.entries(node).forEach(([k, v]) => walk(v, k));
    };

    try {
      walk(extractJson(text), '');
    } catch {
      // Sin JSON: busca marcas "PASO n:" y "RESUMEN:" en texto plano.
      const parts = text.split(/(?:^|\n)\s*(?:\*\*)?(PASO\s*\d+|RESUMEN)(?:\*\*)?\s*[:.\-–)]?/i);
      for (let i = 1; i < parts.length; i += 2) put(parts[i], parts[i + 1]);
    }
    return { byNum, summary };
  }

  async function comment(kind, steps, onProgress = () => {}) {
    const topic = TOPICS[kind] || TOPICS.simplex;
    const help = HELP[kind] || HELP.simplex;
    const numbered = steps.map((s, i) => ({ ...s, n: i + 1 }));

    const ask = async (list, withSummary) => {
      const system = `Eres un estudiante que va muy bien en Investigación de Operaciones y le explicas a un compañero, paso por paso, unos apuntes ya resueltos de ${topic}.
Te paso PASOS numerados. Los números y resultados son exactos: NO los cambies ni los recalcules.
Para CADA paso escribe una explicación de 2 a 4 frases (entre 30 y 70 palabras) que cuente:
- qué se hizo en ese paso,
- por qué se hace así,
- y cuál es el dato clave que sale de ahí.
Explica TODOS los pasos que te paso, sin saltarte ninguno, cada uno con su mismo número.
Ayuda para entender los pasos: ${help}
${HUMAN_STYLE}
Responde SOLO con este JSON, sin nada antes ni después:
{"pasos": [{"paso": ${list[0].n}, "explicacion": "..."}, {"paso": ${list[Math.min(1, list.length - 1)].n}, "explicacion": "..."}]${withSummary ? ', "resumen": "2 o 3 frases: qué se hizo y qué significa el resultado"' : ''}}`;
      const user = list.map((s) => `PASO ${s.n} — ${s.title}\n${s.body}`).join('\n\n').slice(0, 30000);
      const { content, model } = await chat([
        { role: 'system', content: system },
        { role: 'user', content: user },
      ], { maxTokens: 16000, temperature: 0.4 });
      return { ...parseExplanations(content, numbered.length), model };
    };

    const first = await ask(numbered, true);
    const got = { ...first.byNum };
    let summary = first.summary;
    let usedModel = first.model;
    const missing = numbered.filter((s) => !got[s.n]);
    if (missing.length) {
      onProgress(`Faltaron ${missing.length} secciones, se las pido de nuevo a la IA…`);
      try {
        const second = await ask(missing, !summary);
        Object.entries(second.byNum).forEach(([n, t]) => { if (!got[n]) got[n] = t; });
        summary = summary || second.summary;
        usedModel = second.model;
      } catch (err) {
        if (!Object.keys(got).length) throw err;
      }
    }
    if (!Object.keys(got).length && !summary) {
      throw new Error('La IA no devolvió explicaciones. Pulsa de nuevo EXPLICAR A DETALLE o elige otro modelo en OPENROUTER.');
    }

    const comments = {};
    numbered.forEach((s) => { if (got[s.n]) comments[s.id] = SX.NB.humanize(got[s.n]); });
    if (summary) comments.final = SX.NB.humanize(summary);
    return { comments, usedModel, total: numbered.length, explained: numbered.filter((s) => got[s.n]).length };
  }

  SX.AI = { config, listFreeModels, chat, comment, parseExplanations };
})(typeof window !== 'undefined' ? window : globalThis);
