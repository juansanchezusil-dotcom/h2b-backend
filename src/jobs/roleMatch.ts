// ¿Esta oferta es del puesto o de la industria que busca la persona? Sirve para los avisos de ofertas nuevas.
// Las familias de puestos son las mismas que usa la app al postular (en español y en inglés).

const FAMILIES: [string, RegExp][] = [
  ['limpieza', /housekeep|room attend|maid|cleaner|janitor|camarer|limpie|aseo|laundry|lavander/],
  ['cocina', /cook|chef|kitchen|cocin|dishwash|lavaplat|prep|baker|panader|food/],
  ['jardin', /landscap|ground|garden|jardin|lawn|paisaj|nursery|farm|agricult|vivero/],
  ['construccion', /construct|laborer|carpent|mason|roof|concrete|drywall|paint|pintor|alba[nñ]il|obra|builder|rigger|electric|plumb|weld|maintenance|mantenim/],
  ['recepcion', /front desk|reception|recepci|concierge|bell|botones|hotel clerk/],
  ['servicio', /server|waiter|waitress|mesero|mesera|bartend|barman|host|busser/],
  ['conduccion', /driver|conduct|chofer|truck/],
  ['almacen', /warehouse|almac|packer|packing|stock|forklift|procesad|production|assembly/],
];

const norm = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function familiesOf(text: string): Set<string> {
  const t = norm(text);
  return new Set(FAMILIES.filter(([, re]) => re.test(t)).map(([id]) => id));
}

// true si la oferta comparte familia con el puesto (o con la industria) de la persona, o comparten una palabra del título
export function jobMatchesRole(jobTitle: string, role: string, industry = ''): boolean {
  if (!jobTitle || !(role || industry)) return false;
  const jobFamilies = familiesOf(jobTitle);
  const want = new Set([...familiesOf(role), ...familiesOf(industry)]);
  for (const f of jobFamilies) if (want.has(f)) return true;
  // Sin familia reconocida en alguno de los dos: se compara por palabras significativas del puesto
  if (want.size === 0 || jobFamilies.size === 0) {
    const words = (s: string) => new Set(norm(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 4));
    const a = words(jobTitle);
    for (const w of words(role)) if (a.has(w)) return true;
  }
  return false;
}
