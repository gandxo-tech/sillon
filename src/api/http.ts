export async function fetchJson<T>(url: string, timeoutMs = 30000): Promise<T> {
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const reponse = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
    return (await reponse.json()) as T;
  } finally {
    clearTimeout(minuteur);
  }
}

export async function fetchTexte(url: string, timeoutMs = 20000): Promise<Response> {
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const reponse = await fetch(url, { signal: ctrl.signal });
    if (!reponse.ok) throw new Error(`HTTP ${reponse.status}`);
    return reponse;
  } finally {
    clearTimeout(minuteur);
  }
}

export const moyenne = (xs: number[]) =>
  xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN;

export const ecartType = (xs: number[]) => {
  if (xs.length < 2) return 0;
  const m = moyenne(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
};

export const mediane = (xs: number[]) => {
  if (!xs.length) return NaN;
  const tri = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(tri.length / 2);
  return tri.length % 2 ? tri[mid] : (tri[mid - 1] + tri[mid]) / 2;
};

export function doyVersDate(doy: number): string {
  const d = new Date(Date.UTC(2021, 0, 1));
  d.setUTCDate(doy);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
}
