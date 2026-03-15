import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, x-visitor-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * track-visitor — Receives UTM + visitor data from the client.
 * Uses Cloudflare headers for FREE, UNLIMITED city detection.
 * No API key needed. Works automatically on Supabase Edge Functions (Cloudflare infrastructure).
 *
 * POST body:
 * {
 *   visitor_id: string,
 *   utm_source, utm_medium, utm_campaign, utm_content, utm_term,
 *   page_url, device, first_visit
 * }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── City Detection (priority order) ──────────────────────────────
    // 1. Cloudflare headers (free, unlimited, automatic on Supabase)
    const cfCity    = req.headers.get("CF-IPCity")    || req.headers.get("cf-ipcity") || "";
    const cfRegion  = req.headers.get("CF-IPRegion")  || req.headers.get("cf-ipregion") || "";
    const cfCountry = req.headers.get("CF-IPCountry") || req.headers.get("cf-ipcountry") || "";

    // 2. X-Forwarded headers (fallback)
    const xCity   = req.headers.get("X-City")   || req.headers.get("x-city") || "";
    const xRegion = req.headers.get("X-Region") || req.headers.get("x-region") || "";

    // 3. Client-supplied (from ipapi.co cookie, as fallback)
    const clientCity   = body.city   || "";
    const clientRegion = body.region || "";

    const city   = cfCity   || xCity   || clientCity   || "";
    const region = cfRegion || xRegion || clientRegion || "";

    // Decode URL-encoded city names (Cloudflare encodes spaces as %20)
    const decodedCity   = city   ? decodeURIComponent(city)   : "";
    const decodedRegion = region ? decodeURIComponent(region) : "";

    // ── Visitor ID ────────────────────────────────────────────────────
    const visitorId = body.visitor_id || `v_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // ── Check if visitor exists ───────────────────────────────────────
    const { data: existing } = await supabase
      .from("utm_visitors")
      .select("id, city")
      .eq("visitor_id", visitorId)
      .maybeSingle();

    let data: any;
    let error: any;

    if (existing) {
      // Update city if we got a better one server-side
      const updates: any = {};
      if (decodedCity && !existing.city) updates.city = decodedCity;
      if (decodedRegion) updates.region = decodedRegion;
      
      if (Object.keys(updates).length > 0) {
        const result = await supabase
          .from("utm_visitors")
          .update(updates)
          .eq("visitor_id", visitorId)
          .select("id, visitor_id, city, region")
          .single();
        data = result.data; error = result.error;
      } else {
        data = existing; error = null;
      }
    } else {
      // Insert new visitor
      const result = await supabase
        .from("utm_visitors")
        .insert({
          visitor_id:    visitorId,
          utm_source:    body.utm_source   || null,
          utm_medium:    body.utm_medium   || null,
          utm_campaign:  body.utm_campaign || null,
          utm_content:   body.utm_content  || null,
          utm_term:      body.utm_term     || null,
          city:          decodedCity,
          region:        decodedRegion,
          device:        body.device       || "",
          first_visit:   body.first_visit  || new Date().toISOString(),
          page_url:      body.page_url     || null,
        })
        .select("id, visitor_id, city, region")
        .single();
      data = result.data; error = result.error;
    }

    if (error) {
      console.error("track-visitor error:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
    }

    return new Response(JSON.stringify({
      ok: true,
      visitor_id: visitorId,
      city: decodedCity,
      region: decodedRegion,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("track-visitor fatal:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
