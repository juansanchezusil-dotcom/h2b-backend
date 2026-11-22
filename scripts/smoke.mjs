// Prueba de humo de producción: correr después de cada deploy.
//   node scripts/smoke.mjs
// Revisa que las páginas abran, que la cabecera del micrófono deje dictar, y que cada endpoint del backend
// responda lo esperado (sin sesión: 401/405/400) en vez de un 500. No usa cuenta ni gasta IA.

const APP = process.env.SMOKE_APP || 'https://app.juanteavisa.com';
const API = process.env.SMOKE_API || 'https://h2b-backend-three.vercel.app';

const checks = [
  // Páginas
  { name: 'App raíz (manda a login)', url: `${APP}/`, expect: [200, 307, 308] },
  { name: 'Login', url: `${APP}/login`, expect: [200] },
  { name: 'Privacidad', url: `${APP}/privacidad`, expect: [200] },
  { name: 'Mapa', url: `${APP}/mapa`, expect: [200] },
  { name: 'Masterclass', url: `${APP}/masterclass.html`, expect: [200] },
  { name: 'Service worker', url: `${APP}/sw.js`, expect: [200] },
  { name: 'Manifest', url: `${APP}/manifest.webmanifest`, expect: [200] },
  // Cabeceras: el dictado necesita microphone=(self)
  {
    name: 'Permissions-Policy deja el micrófono',
    url: `${APP}/login`,
    expect: [200],
    header: ['permissions-policy', (v) => /microphone=\(self\)/.test(v || '')],
  },
  // Endpoints con sesión: sin token deben decir 401, nunca 500
  ...['jobs', 'agencias', 'employers', 'account', 'admin/panel', 'admin/errores', 'cron/update', 'cron/followup-reminders', 'cron/admin-snapshot'].map((p) => ({
    name: `GET /api/${p} sin sesión`,
    url: `${API}/api/${p}`,
    expect: [401, 403, 405],
  })),
  // Asistentes de IA sin sesión: 401 antes de gastar IA
  ...['interview', 'cv/interview', 'cv/generate', 'cv/cover-letter', 'email/generate', 'asistente', 'analyze-scam-image'].map((p) => ({
    name: `POST /api/${p} sin sesión`,
    url: `${API}/api/${p}`,
    method: 'POST',
    body: '{}',
    expect: [400, 401, 403],
  })),
  // Rutas públicas
  { name: 'Enlace de baja sin token', url: `${API}/api/avisos`, expect: [400] },
  // Confirma que las llaves VAPID están en Vercel: sin ellas no salen los avisos push
  { name: 'Avisos push configurados', url: `${API}/api/push`, expect: [200], json: (b) => b.enabled === true && !!b.publicKey },
  { name: 'POST /api/client-errors vacío', url: `${API}/api/client-errors`, method: 'POST', body: '{}', expect: [400] },
  { name: 'OPTIONS /api/detector-web (CORS)', url: `${API}/api/detector-web`, method: 'OPTIONS', expect: [204] },
  { name: 'GET /api/clase/ofertas', url: `${API}/api/clase/ofertas`, expect: [200] },
  { name: 'Proxy /api del frontend llega al backend', url: `${APP}/api/client-errors`, method: 'POST', body: '{}', expect: [400, 307] },
];

let failed = 0;
for (const c of checks) {
  let line;
  try {
    const res = await fetch(c.url, {
      method: c.method || 'GET',
      body: c.body,
      headers: c.body ? { 'Content-Type': 'application/json' } : undefined,
      redirect: 'manual',
      signal: AbortSignal.timeout(30000),
    });
    let ok = c.expect.includes(res.status);
    let extra = '';
    if (ok && c.header) {
      const v = res.headers.get(c.header[0]);
      ok = c.header[1](v);
      if (!ok) extra = ` (${c.header[0]}: ${v})`;
    }
    if (ok && c.json) {
      ok = c.json(await res.json().catch(() => ({})));
      if (!ok) extra = ' (respuesta inesperada)';
    }
    line = `${ok ? 'OK  ' : 'FALLA'} ${res.status} ${c.name}${ok ? '' : ` — esperaba ${c.expect.join('/')}`}${extra}`;
    if (!ok) failed++;
  } catch (err) {
    failed++;
    line = `FALLA ---  ${c.name} — ${err.message}`;
  }
  console.log(line);
}

console.log(`\n${checks.length - failed}/${checks.length} bien`);
process.exit(failed ? 1 : 0);
