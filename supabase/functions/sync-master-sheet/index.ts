import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SHEET_ID = "1nZOQfdCG6jt14eXwEPzADU9G8AN9bEKpP4ZrGRLURDI";
const SHEET1_GID = "0";        // Main sheet — ₹299 paid leads (call pipeline)
const SHEET2_GID = "YOUR_SHEET_GID"; // ₹50K conversions sheet

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const results = { 
    sheet1: { total: 0, campaign: 0, synced: 0, created: 0, updated: 0, skipped: 0 },
    sheet2: { total: 0, campaign: 0, synced: 0, created: 0, updated: 0, skipped: 0 },
    errors: [] as string[],
  };

  try {
    // ===== SHEET 1: ₹299 Paid Leads (Call Pipeline) =====
    console.log("Fetching Sheet 1 (₹299 pipeline)...");
    const sheet1Url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET1_GID}`;
    const sheet1Resp = await fetch(sheet1Url);
    const sheet1Text = await sheet1Resp.text();
    const sheet1Rows = parseCSV(sheet1Text);
    results.sheet1.total = sheet1Rows.length;

    // Filter: only Campaign Leads
    const campaignLeads = sheet1Rows.filter(r => 
      (r["Lead Source"] || "").trim() === "Campaign Lead"
    );
    results.sheet1.campaign = campaignLeads.length;
    console.log(`Sheet 1: ${sheet1Rows.length} total, ${campaignLeads.length} campaign leads`);

    for (const row of campaignLeads) {
      const email = (row["Email"] || "").trim().toLowerCase();
      if (!email || !email.includes("@")) {
        results.sheet1.skipped++;
        continue;
      }

      const name = (row["Name"] || "").trim();
      const phone = (row["Phone"] || "").trim();
      const status = (row["Status"] || "").trim().toLowerCase();
      const batch = (row["Batch"] || "").trim();
      const callDate = (row["Date"] || "").trim();
      const slot = (row["Slot"] || "").trim();
      const age = (row["Age"] || "").trim();
      const workBusiness = (row["Working/Business"] || "").trim();
      const earning = (row["Earning"] || "").trim();
      const moneyGoal = (row["Money goal"] || "").trim();
      const creditCard = (row["Credit card"] || "").trim();
      const remarks = (row["Remarks"] || "").trim();

      // Determine tags based on status
      const tags: string[] = ["paid-299"];
      if (status === "converted") tags.push("purchased");
      if (status === "not converted" || status === "not_converted") tags.push("not-converted");
      if (status === "canceled" || status === "cancelled") tags.push("canceled");
      if (status === "did not show up for the call") tags.push("no-show");
      if (status === "in progress") tags.push("in-progress");
      if (callDate && callDate !== "Canceled" && callDate !== "Rescheduled" && callDate !== "Application on hold") {
        tags.push("call-booked");
      }

      // Custom fields from master sheet
      const customFields: Record<string, string> = {};
      if (batch) customFields.batch = batch;
      if (callDate) customFields.call_date = callDate;
      if (slot) customFields.call_slot = slot;
      if (age) customFields.age = age;
      if (workBusiness) customFields.work_business = workBusiness;
      if (earning) customFields.earning = earning;
      if (moneyGoal) customFields.money_goal = moneyGoal;
      if (creditCard) customFields.credit_card = creditCard;
      if (remarks) customFields.remarks = remarks.substring(0, 500);
      customFields.master_sheet_status = status || "pending";

      // Check if contact exists
      const { data: existing } = await supabase
        .from("automation_contacts")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (existing) {
        // Merge tags (keep existing + add new)
        const existingTags = existing.tags || [];
        const mergedTags = Array.from(new Set([...existingTags, ...tags]));
        const mergedCustom = { ...(existing.custom_fields || {}), ...customFields };

        const updates: Record<string, unknown> = {
          tags: mergedTags,
          paid_299: true,
          custom_fields: mergedCustom,
          updated_at: new Date().toISOString(),
        };

        if (!existing.first_name && name) updates.first_name = name.split(" ")[0];
        if (!existing.phone && phone) updates.phone = phone;
        if (status === "converted" && !existing.purchased_50k) {
          updates.purchased_50k = true;
          updates.purchased_50k_at = new Date().toISOString();
        }

        await supabase.from("automation_contacts").update(updates).eq("id", existing.id);
        results.sheet1.updated++;
      } else {
        // Create new contact
        await supabase.from("automation_contacts").insert({
          email,
          first_name: name ? name.split(" ")[0] : email.split("@")[0],
          last_name: name ? name.split(" ").slice(1).join(" ") : null,
          phone: phone || null,
          tags,
          paid_299: true,
          paid_299_at: new Date().toISOString(),
          source: "master-sheet",
          status: "active",
          custom_fields: customFields,
          purchased_50k: status === "converted",
          purchased_50k_at: status === "converted" ? new Date().toISOString() : null,
        });
        results.sheet1.created++;
      }
      results.sheet1.synced++;
    }

    // ===== SHEET 2: ₹50K Conversions =====
    console.log("Fetching Sheet 2 (₹50K conversions)...");
    const sheet2Url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET2_GID}`;
    const sheet2Resp = await fetch(sheet2Url);
    const sheet2Text = await sheet2Resp.text();
    const sheet2Rows = parseCSV(sheet2Text);
    results.sheet2.total = sheet2Rows.length;

    // Filter: only Campaign source
    const campaignConverted = sheet2Rows.filter(r =>
      (r["Source"] || "").trim() === "Campaign"
    );
    results.sheet2.campaign = campaignConverted.length;
    console.log(`Sheet 2: ${sheet2Rows.length} total, ${campaignConverted.length} campaign conversions`);

    for (const row of campaignConverted) {
      const email = (row["Email"] || "").trim().toLowerCase();
      if (!email || !email.includes("@")) {
        results.sheet2.skipped++;
        continue;
      }

      const name = (row["Name"] || "").trim();
      const phone = (row["Phone"] || "").trim();
      const saleDate = (row["Sale Date"] || "").trim();
      const program = (row["Program"] || "").trim();
      const paid = (row["Paid"] || "").trim();
      const pending = (row["Pending amount"] || "").trim();
      const closer = (row["Closer"] || "").trim();

      const customFields: Record<string, string> = {};
      if (saleDate) customFields.sale_date = saleDate;
      if (program) customFields.program = program;
      if (paid) customFields.amount_paid = paid;
      if (pending && pending !== "-") customFields.amount_pending = pending;
      if (closer) customFields.closer = closer;

      const { data: existing } = await supabase
        .from("automation_contacts")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (existing) {
        const existingTags = existing.tags || [];
        const mergedTags = Array.from(new Set([...existingTags, "paid-299", "purchased"]));
        const mergedCustom = { ...(existing.custom_fields || {}), ...customFields };

        await supabase.from("automation_contacts").update({
          tags: mergedTags,
          paid_299: true,
          purchased_50k: true,
          purchased_50k_at: existing.purchased_50k_at || new Date().toISOString(),
          custom_fields: mergedCustom,
          updated_at: new Date().toISOString(),
        }).eq("id", existing.id);
        results.sheet2.updated++;
      } else {
        await supabase.from("automation_contacts").insert({
          email,
          first_name: name ? name.split(" ")[0] : email.split("@")[0],
          last_name: name ? name.split(" ").slice(1).join(" ") : null,
          phone: phone || null,
          tags: ["paid-299", "purchased"],
          paid_299: true,
          paid_299_at: new Date().toISOString(),
          purchased_50k: true,
          purchased_50k_at: new Date().toISOString(),
          source: "master-sheet",
          status: "active",
          custom_fields: customFields,
        });
        results.sheet2.created++;
      }
      results.sheet2.synced++;
    }

    console.log("Sync complete:", JSON.stringify(results));
    return new Response(JSON.stringify({ status: "ok", ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("Sync error:", err);
    results.errors.push(String(err));
    return new Response(JSON.stringify({ status: "error", ...results, error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Simple CSV parser that handles quoted fields with newlines
function parseCSV(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        current.push(field);
        field = "";
      } else if (ch === '\r') {
        // skip
      } else if (ch === '\n') {
        current.push(field);
        field = "";
        if (current.length > 1) rows.push(current);
        current = [];
      } else {
        field += ch;
      }
    }
  }
  if (field || current.length > 0) {
    current.push(field);
    if (current.length > 1) rows.push(current);
  }

  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => { obj[h.trim()] = (row[i] || "").trim(); });
    return obj;
  });
}
