// Prueba de la interfaz con clics reales en Firefox (opcional).
// Requiere: npm i --no-save playwright@1.48.2 && npx playwright install firefox   Uso: node tests/ui.mjs
import { firefox } from 'playwright';
const URL = new URL('../index.html', import.meta.url).href;
const browser = await firefox.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
let fails = 0;
const check = (cond, name) => { console.log(`${cond ? '✓' : '✗'} ${name}`); if (!cond) fails++; };
const score = async () => (await page.locator('.score').first().textContent().catch(() => '')).replace(/\s+/g, ' ').trim();

await page.goto(URL);
await page.click('#btn-solve');
check((await score()).includes('36'), 'simplex por defecto (Wyndor) da 36');
await page.click('[data-mode="dual"]');
check(await page.locator('.notebook').count() > 0, 'dualidad re-resuelve al cambiar de pestaña');

// Asignación: ejemplo y resolver
await page.click('[data-mode="assign"]');
check(await page.locator('#form-net').isVisible() && !(await page.locator('#form-lp').isVisible()), 'pestaña 3P muestra el formulario de asignación');
await page.click('[data-net-example="1"]');
await page.click('#btn-solve');
check((await score()).includes('9'), 'asignación no balanceada de ejemplo da 9');
// cambiar tamaño y escribir un valor inválido
await page.fill('[data-k="n"]', '3'); await page.locator('[data-k="n"]').dispatchEvent('change');
await page.fill('[data-k="cost"][data-i="2"][data-j="0"]', 'abc');
await page.click('#btn-solve');
check(await page.locator('#form-error').isVisible() && await page.locator('[data-k="cost"][data-i="2"][data-j="0"].invalid').count() === 1, 'celda inválida marcada en rojo con mensaje');
await page.fill('[data-k="cost"][data-i="2"][data-j="0"]', 'M');
await page.fill('[data-k="cost"][data-i="2"][data-j="1"]', '1');
await page.fill('[data-k="cost"][data-i="2"][data-j="2"]', '1');
await page.click('#btn-solve');
check(!(await page.locator('#form-error').isVisible()) && (await score()).length > 0, 'con M y valores válidos resuelve');
// guardar en la bóveda
await page.fill('#vault-name', 'Prueba asignación');
await page.click('#vault-save');
check((await page.locator('#vault-list .vault-name').allTextContents()).includes('Prueba asignación'), 'se guarda en la bóveda');

// Flujo máximo: agregar arco y resolver
await page.click('[data-mode="maxflow"]');
await page.click('[data-net-example="0"]');
await page.click('[data-k="add-arc"]');
const last = (await page.locator('[data-k="arc"][data-c="0"]').count()) - 1;
await page.fill(`[data-k="arc"][data-r="${last}"][data-c="0"]`, 's');
await page.fill(`[data-k="arc"][data-r="${last}"][data-c="1"]`, 't');
await page.fill(`[data-k="arc"][data-r="${last}"][data-c="2"]`, '5');
await page.click('#btn-solve');
check((await score()).includes('11'), 'flujo máximo con arco extra s→t de 5 da 6 + 5 = 11');
check(await page.locator('.n-svg').count() > 2, 'dibuja la red en el cuaderno');

// Costo mínimo con red no dirigida
await page.click('[data-mode="mincost"]');
await page.click('[data-net-example="1"]');
await page.click('#btn-solve');
check((await score()).includes('70'), 'costo mínimo oferta > demanda da 70');

// Abrir memoria de la bóveda de informes
await page.click('.vault-group:has-text("FLUJO MÁXIMO") > summary');
await page.click('[data-preset="11"]');
await page.click('#btn-solve');
check((await score()).includes('14'), 'memoria 11 (Seervada) da 14');
await page.click('.vault-group:has-text("COSTO MÍNIMO") > summary');
await page.click('[data-preset="15"]');
await page.click('#btn-solve');
check((await score()).includes('13'), 'memoria 15 (ruta más corta) da 13');

// Reabrir lo guardado
await page.click('#vault-list [data-vault-open]');
check(await page.locator('[data-mode="assign"][aria-selected="true"]').count() === 1 && (await score()).length > 0, 'abre el ejercicio guardado en su modo y lo resuelve');

// Explicar sin key abre el diálogo
await page.click('[data-ai-explain]');
await page.waitForTimeout(300);
check(await page.locator('#dlg-ai[open]').count() === 1, 'EXPLICAR sin API key abre la configuración de OpenRouter');
await page.keyboard.press('Escape');

// Exportar / importar no se prueban (diálogos del sistema). Limpiar:
await page.click('[data-mode="maxflow"]');
await page.click('#btn-clear');
check((await page.locator('[data-k="arc"]').count()) >= 6, 'LIMPIAR deja un formulario de arcos vacío');

// Celular
const m = await browser.newPage({ viewport: { width: 390, height: 900 } });
m.on('pageerror', (e) => errors.push(`mobile pageerror: ${e.message}`));
await m.goto(`${URL}#m14&run`);
const overflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
check(overflow <= 1, `sin scroll horizontal en celular (sobra ${overflow}px)`);

check(errors.length === 0, `sin errores en consola${errors.length ? `: ${errors.join(' | ')}` : ''}`);
await browser.close();
console.log(fails ? `${fails} fallas` : 'Interfaz OK');
process.exit(fails ? 1 : 0);
