/**
 * Cloudflare Worker — Gemini API Proxy
 *
 * Déploiement :
 * 1. Va sur https://dash.cloudflare.com → Workers & Pages → Create
 * 2. Clique "Create Worker", donne un nom (ex: "gemini-proxy")
 * 3. Colle ce code, clique "Deploy"
 * 4. Va dans Settings → Variables and Secrets
 *    → Ajoute un secret : GEMINI_API_KEY = ta clé Gemini
 * 5. (Optionnel) Va dans Settings → Variables and Secrets
 *    → Ajoute : ALLOWED_ORIGIN = https://ton-username.github.io
 * 6. Note l'URL du worker (ex: https://gemini-proxy.ton-compte.workers.dev)
 *    et mets-la dans WORKER_URL de typing-game.js
 */

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export default {
  async fetch(request, env) {
    // Determine allowed origin (default: allow all for dev, restrict in production)
    const allowedOrigin = env.ALLOWED_ORIGIN || '*';
    const origin = request.headers.get('Origin') || '';

    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigin !== '*' && origin !== allowedOrigin ? '' : allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };

    // Block requests from unauthorized origins
    if (allowedOrigin !== '*' && origin && origin !== allowedOrigin) {
      return new Response('Forbidden', { status: 403 });
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    // Check API key is configured
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY not configured in worker secrets' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      const body = await request.text();

      const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
      });

      const data = await geminiRes.text();

      return new Response(data, {
        status: geminiRes.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: err.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  },
};
