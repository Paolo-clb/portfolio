/**
 * Cloudflare Worker — Gemini API Proxy
 * Builds prompt server-side, validates & cleans response before returning.
 * Client sends { theme } → receives clean { fr:{…}, en:{…} } or { error }.
 */

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const FETCH_TIMEOUT = 45000;
const MODES = ['10', '25', '50', '100'];

const SYSTEM_INSTRUCTION = `Typing practice text generator.
Sizes — "10": 10 sentences (9-11 words), "25": 8 paragraphs (23-27 words), "50": 5 paragraphs (47-53 words), "100": 3 paragraphs (96-104 words).
Natural capitalization and punctuation (. , ; : ! ?). Only: letters, spaces, hyphens, apostrophes, those punctuation marks, French accents (é è ê à ù ô î â ç). No emojis.
"fr" in French, "en" in English. Very informative, very varied and very smooth to type.`;

/* responseSchema forces Gemini to output exactly the right structure */
const MODE_SCHEMA = { type: 'ARRAY', items: { type: 'STRING' } };
const LANG_SCHEMA = {
  type: 'OBJECT',
  properties: { '10': MODE_SCHEMA, '25': MODE_SCHEMA, '50': MODE_SCHEMA, '100': MODE_SCHEMA },
  required: MODES,
};
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: { fr: LANG_SCHEMA, en: LANG_SCHEMA },
  required: ['fr', 'en'],
};

/* Cleaning helpers */
const EMOJI_RE = /[\p{Extended_Pictographic}\u200d\ufe0f]/gu;
const CTRL_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;

function sanitizeTheme(raw) {
  return raw.replace(/[\r\n]/g, ' ').replace(CTRL_RE, '').trim().slice(0, 100);
}

function cleanTexts(parsed) {
  for (const lang of ['fr', 'en']) {
    for (const mode of MODES) {
      parsed[lang][mode] = parsed[lang][mode]
        .map(t => (typeof t === 'string' ? t : String(t)))
        .map(t => t.replace(EMOJI_RE, '').replace(CTRL_RE, '').replace(/\s{2,}/g, ' ').trim())
        .filter(t => t.length > 0);
    }
  }
  return parsed;
}

function respond(body, status, corsHeaders) {
  return new Response(
    JSON.stringify(body),
    { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}

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
      return respond({ error: 'ORIGIN_BLOCKED' }, 403, corsHeaders);
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return respond({ error: 'Method not allowed' }, 405, corsHeaders);
    }

    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) return respond({ error: 'API key not configured' }, 500, corsHeaders);

    try {
      /* ---- Parse & sanitize client input ---- */
      const body = await request.json();
      const theme = body && typeof body.theme === 'string' && sanitizeTheme(body.theme);
      if (!theme) return respond({ error: 'Missing theme' }, 400, corsHeaders);

      /* ---- Build Gemini request ---- */
      const geminiBody = JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: [{ parts: [{ text: 'Theme: "' + theme + '"' }] }],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 16384,
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
        },
      });

      /* ---- Call Gemini with timeout ---- */
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);

      let geminiRes;
      try {
        geminiRes = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: geminiBody,
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(timer);
      }

      if (!geminiRes.ok) {
        if (geminiRes.status === 429) return respond({ error: 'RATE_LIMIT' }, 429, corsHeaders);
        return respond({ error: 'GEMINI_ERROR' }, 502, corsHeaders);
      }

      /* ---- Parse & validate Gemini response ---- */
      const data = await geminiRes.json();
      const candidate = data.candidates?.[0];
      if (!candidate) return respond({ error: 'NO_CANDIDATES' }, 502, corsHeaders);

      const reason = candidate.finishReason;
      if (reason && reason !== 'STOP') {
        return respond({ error: reason === 'MAX_TOKENS' ? 'TRUNCATED' : reason }, 502, corsHeaders);
      }

      const raw = candidate.content?.parts?.[0]?.text;
      if (!raw) return respond({ error: 'EMPTY_RESPONSE' }, 502, corsHeaders);

      let parsed;
      try {
        // Strip any stray code fences (shouldn't happen with responseMimeType but defense in depth)
        parsed = JSON.parse(raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim());
      } catch {
        return respond({ error: 'INVALID_JSON' }, 502, corsHeaders);
      }

      // Structure validation (redundant with schema but defense in depth)
      for (const lang of ['fr', 'en']) {
        if (!parsed[lang] || typeof parsed[lang] !== 'object') {
          return respond({ error: 'MISSING_LANG' }, 502, corsHeaders);
        }
        for (const mode of MODES) {
          if (!Array.isArray(parsed[lang][mode])) {
            return respond({ error: 'MISSING_MODE' }, 502, corsHeaders);
          }
        }
      }

      /* ---- Clean texts & return ---- */
      cleanTexts(parsed);

      return respond(parsed, 200, corsHeaders);
    } catch (e) {
      if (e.name === 'AbortError') return respond({ error: 'TIMEOUT' }, 504, corsHeaders);
      return respond({ error: e.message || 'Internal error' }, 500, corsHeaders);
    }
  },
};
