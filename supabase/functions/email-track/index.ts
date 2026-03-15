import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  const url = new URL(req.url);
  const type = url.searchParams.get("t"); // open, click, unsub
  const trackId = url.searchParams.get("id");
  const redirectUrl = url.searchParams.get("url");
  const email = url.searchParams.get("email");
  const campaignId = url.searchParams.get("campaign");
  const stepId = url.searchParams.get("step");

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    if (type === "open") {
      // Build query - match by track_id OR (email + campaign/step)
      let query = supabase
        .from("automation_email_log")
        .update({ opened_at: new Date().toISOString(), status: "opened" });

      if (trackId) {
        query = query.eq("track_id", trackId);
      } else if (email && campaignId) {
        query = query.eq("email_to", decodeURIComponent(email)).eq("campaign_id", campaignId);
      } else if (email && stepId) {
        query = query.eq("email_to", decodeURIComponent(email)).eq("step_id", stepId);
      } else if (email) {
        // Fallback: match latest email log for this email
        query = query.eq("email_to", decodeURIComponent(email));
      } else {
        console.error("Open track: no id or email provided");
      }

      // Only update first open
      await query.is("opened_at", null);

      // Return 1x1 transparent GIF
      const pixel = new Uint8Array([
        0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00,
        0x80, 0x00, 0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21,
        0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00,
        0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
        0x01, 0x00, 0x3b,
      ]);
      return new Response(pixel, {
        headers: { "Content-Type": "image/gif", "Cache-Control": "no-cache, no-store" },
      });

    } else if (type === "click") {
      // Build query - match by track_id OR (email + campaign/step)
      let query = supabase
        .from("automation_email_log")
        .update({ clicked_at: new Date().toISOString(), status: "clicked" });

      if (trackId) {
        query = query.eq("track_id", trackId);
      } else if (email && campaignId) {
        query = query.eq("email_to", decodeURIComponent(email)).eq("campaign_id", campaignId);
      } else if (email && stepId) {
        query = query.eq("email_to", decodeURIComponent(email)).eq("step_id", stepId);
      } else if (email) {
        query = query.eq("email_to", decodeURIComponent(email));
      }

      await query;

      // Also record open if not already (clicking implies opening)
      if (email) {
        let openQuery = supabase
          .from("automation_email_log")
          .update({ opened_at: new Date().toISOString() });
        
        if (trackId) {
          openQuery = openQuery.eq("track_id", trackId);
        } else if (campaignId) {
          openQuery = openQuery.eq("email_to", decodeURIComponent(email)).eq("campaign_id", campaignId);
        } else if (stepId) {
          openQuery = openQuery.eq("email_to", decodeURIComponent(email)).eq("step_id", stepId);
        }
        await openQuery.is("opened_at", null);
      }

      // Redirect to original URL
      if (redirectUrl) {
        return new Response(null, {
          status: 302,
          headers: { Location: decodeURIComponent(redirectUrl) },
        });
      }
      return new Response("ok", { status: 200 });

    } else if (type === "unsub" && email) {
      // Unsubscribe contact
      await supabase
        .from("automation_contacts")
        .update({ status: "unsubscribed" })
        .eq("email", decodeURIComponent(email));

      // Stop all active sequences
      const { data: contact } = await supabase
        .from("automation_contacts")
        .select("id")
        .eq("email", decodeURIComponent(email))
        .single();

      if (contact) {
        await supabase
          .from("automation_sequence_enrollments")
          .update({ status: "stopped" })
          .eq("contYOUR_AD_ACCOUNT_IDid", contact.id)
          .eq("status", "active");
      }

      return new Response(
        `<!DOCTYPE html><html><body style="background:#0f1117;color:white;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0">
        <div style="text-align:center"><h2>You've been unsubscribed</h2><p style="color:#888">You won't receive any more emails from us.</p></div></body></html>`,
        { headers: { "Content-Type": "text/html" } }
      );
    }
  } catch (err) {
    console.error("Track error:", err);
  }

  // Fallback
  return new Response("ok", { status: 200 });
});
