export async function onRequestPost({ request, env }: any) {
  const { text, language = "en-US" } = await request.json();

  // Use your own server if you have it; otherwise public API:
  const base = env.LT_BASE_URL || "https://api.languagetool.org";
  const url = `${base}/v2/check`;

  // LanguageTool expects form-encoded data
  const form = new URLSearchParams();
  form.set("text", text);
  form.set("language", language);

  // Optional: if your LT plan supports it, you might have an API key / username
  // (LanguageTool public endpoint usually doesn't need one)
  if (env.LT_USERNAME) form.set("username", env.LT_USERNAME);
  if (env.LT_API_KEY) form.set("apiKey", env.LT_API_KEY);

  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  const data = await r.json();

  return new Response(JSON.stringify(data), {
    status: r.status,
    headers: { "content-type": "application/json" },
  });
}
