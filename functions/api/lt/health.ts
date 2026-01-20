export interface Env {
  LT_BASE_URL: string;
  LT_USERNAME?: string;
  LT_API_KEY?: string;
}

function normalizeBaseUrl(raw: string) {
  const base = (raw || '').trim().replace(/\/+$/, '');
  if (!base) throw new Error('LT_BASE_URL is not set');
  // Users typically set https://api.languagetool.org/v2 or https://api.languagetoolplus.com/v2
  return base.endsWith('/v2') ? base : `${base}/v2`;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  try {
    const base = normalizeBaseUrl(env.LT_BASE_URL);

    // Lightweight “is it up?” call.
    const res = await fetch(`${base}/languages`, {
      method: 'GET',
      headers: { 'accept': 'application/json' },
    });

    if (!res.ok) {
      return new Response(JSON.stringify({ ok: false, status: res.status }), {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message || 'unknown' }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
};
