import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const payload = await req.json();
    const type = payload.type; // email.bounced, email.complained, email.delivered, email.opened, email.clicked
    const email = payload.data?.to?.[0] || payload.data?.email;
    const emailId = payload.data?.email_id;

    console.log(`Resend webhook: ${type} for ${email}`);

    if (type === "email.bounced" && email) {
      // Mark contact as bounced
      await supabase
        .from("automation_contacts")
        .update({ status: "bounced" })
        .eq("email", email);

      // Mark email log as bounced
      await supabase
        .from("automation_email_log")
        .update({ status: "bounced" })
        .eq("email_to", email)
        .eq("status", "sent");

      // Stop all active sequences for this contact
      const { data: contact } = await supabase
        .from("automation_contacts")
        .select("id")
        .eq("email", email)
        .single();

      if (contact) {
        await supabase
          .from("automation_sequence_enrollments")
          .update({ status: "stopped" })
          .eq("contYOUR_AD_ACCOUNT_IDid", contact.id)
          .eq("status", "active");
      }

      console.log(`Bounced: ${email} — contact + sequences stopped`);
    }

    if (type === "email.complained" && email) {
      // Spam complaint — unsubscribe immediately
      await supabase
        .from("automation_contacts")
        .update({ status: "complained" })
        .eq("email", email);

      await supabase
        .from("automation_email_log")
        .update({ status: "complained" })
        .eq("email_to", email)
        .eq("status", "sent");

      const { data: contact } = await supabase
        .from("automation_contacts")
        .select("id")
        .eq("email", email)
        .single();

      if (contact) {
        await supabase
          .from("automation_sequence_enrollments")
          .update({ status: "stopped" })
          .eq("contYOUR_AD_ACCOUNT_IDid", contact.id)
          .eq("status", "active");
      }

      console.log(`Spam complaint: ${email} — contact stopped`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Resend webhook error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
