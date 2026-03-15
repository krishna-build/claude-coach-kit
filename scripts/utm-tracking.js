<!-- UTM Tracking Script v2 — Paste in FlexiFunnel Header/Footer Code -->
<!-- City detection is now SERVER-SIDE via Cloudflare (free, unlimited, no API key needed) -->
<script>
(function() {
  var TRACK_URL = 'https://YOUR_SUPABASE_REF.supabase.co/functions/v1/track-visitor';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmZGdpYm1nd2VleGlkbW9wcHJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkxOTYwNzUsImV4cCI6MjA1NDc3MjA3NX0.kaSQiKDfnorH3MjDkb9wVrjMfOMVdGiW7uJ8kj_JVAQ';
  
  // ── Helpers ──────────────────────────────────────────────────────────
  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  }
  function setCookie(name, value, days) {
    var d = new Date();
    d.setDate(d.getDate() + (days || 90));
    document.cookie = name + '=' + encodeURIComponent(value) + ';expires=' + d.toUTCString() + ';path=/;SameSite=Lax';
  }
  function genVisitorId() {
    return 'v_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  }

  // ── 1. UTM Params ─────────────────────────────────────────────────────
  var params = new URLSearchParams(window.location.search);
  var utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  
  // Only update UTM cookies on fresh ad click (UTM in URL)
  var hasUtm = utmKeys.some(function(k) { return params.get(k); });
  if (hasUtm) {
    var expires = new Date();
    expires.setDate(expires.getDate() + 90);
    utmKeys.forEach(function(key) {
      var val = params.get(key);
      if (val) setCookie(key, val);
    });
    setCookie('utm_data', JSON.stringify(
      utmKeys.reduce(function(o, k) { if (params.get(k)) o[k] = params.get(k); return o; }, {})
    ));
  }

  // ── 2. Device + First Visit ──────────────────────────────────────────
  var device = /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
  setCookie('visitor_device', device);
  if (!getCookie('first_visit')) setCookie('first_visit', new Date().toISOString());

  // ── 3. Visitor ID (persistent) ───────────────────────────────────────
  var visitorId = getCookie('visitor_id') || genVisitorId();
  setCookie('visitor_id', visitorId, 365);

  // ── 4. Track visitor server-side (city auto-detected via Cloudflare) ─
  // This replaces ipapi.co — no rate limits, no API key, works 100% of the time
  var payload = {
    visitor_id:    visitorId,
    utm_source:    getCookie('utm_source')   || '',
    utm_medium:    getCookie('utm_medium')   || '',
    utm_campaign:  getCookie('utm_campaign') || '',
    utm_content:   getCookie('utm_content')  || '',
    utm_term:      getCookie('utm_term')     || '',
    device:        device,
    first_visit:   getCookie('first_visit')  || '',
    page_url:      window.location.href,
    // Include any city already known from cookie (secondary source)
    city:          getCookie('visitor_city') || '',
    region:        getCookie('visitor_region') || '',
  };

  fetch(TRACK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(payload),
  })
  .then(function(r) { return r.json(); })
  .then(function(data) {
    // Update city cookie from server response (server detected via Cloudflare)
    if (data.city) {
      setCookie('visitor_city', data.city);
      setCookie('visitor_region', data.region || '');
    }
    console.log('[UTM Tracker v2] Tracked:', data);
  })
  .catch(function(err) {
    console.warn('[UTM Tracker v2] Track failed:', err);
    // Fallback: try ipapi.co client-side if server tracking fails
    if (!getCookie('visitor_city')) {
      fetch('https://ipapi.co/json/')
        .then(function(r) { return r.json(); })
        .then(function(d) {
          if (d.city) {
            setCookie('visitor_city', d.city);
            setCookie('visitor_region', d.region || '');
          }
        })
        .catch(function() {});
    }
  });

  // ── 5. Expose to global for Razorpay/form integration ────────────────
  window.__UTM_DATA = {
    visitor_id:   visitorId,
    utm_source:   getCookie('utm_source')   || '',
    utm_medium:   getCookie('utm_medium')   || '',
    utm_campaign: getCookie('utm_campaign') || '',
    utm_content:  getCookie('utm_content')  || '',
    utm_term:     getCookie('utm_term')     || '',
    city:         getCookie('visitor_city') || '',
    region:       getCookie('visitor_region') || '',
    device:       device,
    first_visit:  getCookie('first_visit') || '',
  };

  console.log('[UTM Tracker v2] Ready:', window.__UTM_DATA);
})();
</script>
