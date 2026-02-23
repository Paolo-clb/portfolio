/**
 * Cloudflare Worker — Gemini API Proxy
 * Handles prompt construction server-side so the client only sends the theme.
 */

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_INSTRUCTION = `You are a typing practice text generator.
Output JSON: {"fr":{"10":[...],"25":[...],"50":[...],"100":[...]},"en":{"10":[...],"25":[...],"50":[...],"100":[...]}}

Array sizes: "10": 10 sentences (~10 words each), "25": 8 paragraphs (~25 words), "50": 5 paragraphs (~50 words), "100": 3 paragraphs (~100 words).

Rules:
- Natural capitalization and punctuation (. , ; : ! ?)
- Allowed: letters, spaces, hyphens, apostrophes, punctuation above
- French accents allowed (é è ê à ù ô î â ç)
- "fr" in French, "en" in English
- Texts must be informative, varied, interesting and smooth to type`;

export default {
  async fetch(request, env) {
    const allowedOrigin = env.ALLOWED_ORIGIN || '*';
    const origin = request.headers.get('Origin') || '';

    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigin !== '*' && origin !== allowedOrigin ? '' : allowedOrigin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };

    if (allowedOrigin !== '*' && origin && origin !== allowedOrigin) {
      return new Response('Forbidden', { status: 403 });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      const { theme } = await request.json();
      if (!theme || typeof theme !== 'string') {
        return new Response(
          JSON.stringify({ error: 'Missing theme' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const geminiBody = JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ parts: [{ text: 'Theme: "' + theme.slice(0, 100) + '"' }] }],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 16384,
          responseMimeType: 'application/json'
        }
      });

      const geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: geminiBody,
      });

      const data = await geminiRes.text();

      return new Response(data, {
        status: geminiRes.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: err.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  },
};
