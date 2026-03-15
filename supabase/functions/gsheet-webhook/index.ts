import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();

    // Expected payload from Google Apps Script:
    // { email, first_name, phone, path, datetime, utm_source, utm_medium, utm_campaign, utm_content }
    const email = (body.email || "").toLowerCase().trim();
    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Invalid email" }), { status: 400, headers: corsHeaders });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Log webhook
    await supabase.from("automation_webhook_log").insert({
      source: "google_sheet",
      payload: body,
      action_taken: "processing",
      processed: false,
    });

    // Upsert contact
    const { data: existing } = await supabase
      .from("automation_contacts")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    let contact;
    if (existing) {
      // Update with UTM if not already set
      const updates: any = { updated_at: new Date().toISOString() };
      if (body.utm_campaign && !existing.utm_campaign) updates.utm_campaign = body.utm_campaign;
      if (body.utm_content && !existing.utm_content) updates.utm_content = body.utm_content;
      if (body.utm_source && !existing.utm_source) updates.utm_source = body.utm_source;
      if (body.utm_medium && !existing.utm_medium) updates.utm_medium = body.utm_medium;
      if (body.phone && !existing.phone) updates.phone = body.phone;
      if (body.first_name && !existing.first_name) updates.first_name = body.first_name;

      // Ensure "lead" tag
      if (!existing.tags?.includes("lead")) {
        updates.tags = [...(existing.tags || []), "lead"];
      }

      const { data: updated } = await supabase
        .from("automation_contacts")
        .update(updates)
        .eq("id", existing.id)
        .select()
        .single();
      contact = updated;
    } else {
      // Create new contact
      const { data: created } = await supabase
        .from("automation_contacts")
        .insert({
          email,
          first_name: body.first_name || null,
          phone: body.phone || null,
          tags: ["lead"],
          source: "google_sheet",
          utm_source: body.utm_source || null,
          utm_medium: body.utm_medium || null,
          utm_campaign: body.utm_campaign || null,
          utm_content: body.utm_content || null,
          utm_term: body.utm_term || null,
        })
        .select()
        .single();
      contact = created;
    }

    // Auto-enroll in Sequence 1 (if exists and active)
    if (contact && !existing?.paid_299) {
      const { data: seq1 } = await supabase
        .from("automation_sequences")
        .select("id")
        .eq("trigger_tag", "lead")
        .eq("status", "active")
        .maybeSingle();

      if (seq1) {
        // Check if already enrolled
        const { data: enrolled } = await supabase
          .from("automation_sequence_enrollments")
          .select("id")
          .eq("contYOUR_AD_ACCOUNT_IDid", contact.id)
          .eq("sequence_id", seq1.id)
          .maybeSingle();

        if (!enrolled) {
          // Enroll at step 1, send immediately (next cron run picks it up)
          await supabase.from("automation_sequence_enrollments").insert({
            contYOUR_AD_ACCOUNT_IDid: contact.id,
            sequence_id: seq1.id,
            current_step: 1,
            status: "active",
            next_send_at: new Date().toISOString(),
          });
          console.log(`Auto-enrolled ${email} into sequence ${seq1.id}`);
        }
      }
    }

    // Update webhook log
    await supabase
      .from("automation_webhook_log")
      .update({ contYOUR_AD_ACCOUNT_IDid: contact?.id, action_taken: `contact ${existing ? "updated" : "created"}: ${contact?.id}`, processed: true })
      .eq("processed", false)
      .eq("source", "google_sheet")
      .order("created_at", { ascending: false })
      .limit(1);

    return new Response(
      JSON.stringify({ status: "ok", contYOUR_AD_ACCOUNT_IDid: contact?.id, email, action: existing ? "updated" : "created" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("GSheet webhook error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: corsHeaders });
  }
});
