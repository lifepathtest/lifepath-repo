const TRACK_EVENTS = new Set([
  'quiz_viewed', 'date_entered', 'free_result_shown', 'sample_opened',
  'tier_button_clicked', 'checkout_redirect', 'healthcheck'
]);
const META_KEYS = ['sid', 'tier', 'lifePath', 'hasName', 'ref'];
const META_STRING_MAX = 64;
const MAX_BODY_BYTES = 4096;
const BOT_UA = /bot|crawl|spider|slurp|headless|curl|wget|python|httpclient|monitor/i;

// Keeps only allowlisted scalar meta keys; strings are capped. Never passes PII fields through.
function sanitizeMeta(raw) {
  const meta = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return meta;
  for (const key of META_KEYS) {
    const val = raw[key];
    if (typeof val === 'string') meta[key] = val.slice(0, META_STRING_MAX);
    else if (typeof val === 'boolean' || (typeof val === 'number' && Number.isFinite(val))) meta[key] = val;
  }
  return meta;
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Canonical host: 301 www → apex, preserving path and query
    if (url.hostname === 'www.life-path.icu') {
      url.hostname = 'life-path.icu';
      return Response.redirect(url.toString(), 301);
    }

    // Block automated vulnerability scanner probing on sensitive dotfiles
    if (url.pathname.startsWith('/.env') || url.pathname.startsWith('/.git')) {
      return new Response('404 Not Found', {
        status: 404,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-Robots-Tag': 'noindex, nofollow'
        }
      });
    }

    // Telemetry Ingestion Endpoint: POST /track or /api/track
    if (url.pathname === '/track' || url.pathname === '/api/track') {
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400'
      };

      if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      if (request.method === 'POST') {
        const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
        const tooLarge = () => new Response(JSON.stringify({ ok: false, error: 'payload too large' }), { status: 413, headers: jsonHeaders });

        if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) {
          return tooLarge();
        }

        try {
          const raw = await request.text();
          if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
            return tooLarge();
          }

          let body = null;
          try { body = JSON.parse(raw); } catch (e) { body = null; }
          const eventName = body && typeof body.event_name === 'string' ? body.event_name.trim() : '';

          // Unknown or missing events are acknowledged but never written
          if (!TRACK_EVENTS.has(eventName)) {
            return new Response(null, { status: 204, headers: { ...corsHeaders, 'Cache-Control': 'no-store' } });
          }

          const userAgent = request.headers.get('user-agent') || '';
          const meta = sanitizeMeta(body.meta);
          meta.country = (request.cf && request.cf.country) || null;
          meta.ua_class = !userAgent || BOT_UA.test(userAgent) ? 'bot' : 'human';

          const supabaseUrl = env.SUPABASE_URL || 'https://buaxjmahjinuowoidhmn.supabase.co';
          const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

          if (supabaseKey) {
            const insertPromise = fetch(`${supabaseUrl}/rest/v1/lifepath_events`, {
              method: 'POST',
              headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
              },
              // No raw IP or user-agent is stored (privacy policy §1)
              body: JSON.stringify({
                event_name: eventName,
                meta: meta,
                ip: null,
                user_agent: null
              })
            }).catch(err => {
              console.error('Supabase telemetry write error:', err);
            });

            if (ctx && typeof ctx.waitUntil === 'function') {
              ctx.waitUntil(insertPromise);
            } else {
              await insertPromise;
            }
          }

          return new Response(JSON.stringify({ ok: true }), { status: 200, headers: jsonHeaders });
        } catch (err) {
          return new Response(JSON.stringify({ ok: false, error: err.message }), { status: 400, headers: jsonHeaders });
        }
      }

      return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }

    return env.ASSETS.fetch(request);
  }
};
