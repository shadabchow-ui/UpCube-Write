import type { Env } from './health';

function normalizeBaseUrl(raw: string) {
  const base = (raw || '').trim().replace(/\/+$/, '');
  if (!base) throw new Error('LT_BASE_URL is not set');
  return base.endsWith('/v2') ? base : `${base}/v2`;
}

/**
 * POST /api/lt/check
 * Body: { text: string, language?: string }
 * Proxies to LanguageTool /v2/check to avoid CORS + keep keys server-side.
 */
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const { text, language } = (await request.json().catch(() => ({}))) as {
      text?: string;
      language?: string;
    };

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ ok: false, error: 'Missing text' }), {
        status: 400,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }

    const base = normalizeBaseUrl(env.LT_BASE_URL);

    // LanguageTool expects application/x-www-form-urlencoded
    const form = new URLSearchParams();
    form.set('text', text);
    form.set('language', language || 'auto');

    // Optional: Premium API auth (LanguageTool Plus)
    if (env.LT_USERNAME && env.LT_API_KEY) {
      form.set('username', env.LT_USERNAME);
      form.set('apiKey', env.LT_API_KEY);
    }

    const res = await fetch(`${base}/check`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded; charset=utf-8' },
      body: form.toString(),
    });

    const data = await res.text();
    // Always return JSON to the client with 200 so UI can handle “soft offline”.
    return new Response(
      JSON.stringify({ ok: res.ok, status: res.status, data: safeJsonParse(data) }),
      {
        status: 200,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: err?.message || 'unknown' }), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
};

function safeJsonParse(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
