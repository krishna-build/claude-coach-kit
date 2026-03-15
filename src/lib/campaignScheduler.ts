import type { SupabaseClient } from "@supabase/supabase-js";
import type { QueryClient } from "@tanstack/react-query";

/**
 * Checks for scheduled campaigns that are due and triggers them.
 * Runs the existing email-engine edge function for each due campaign.
 * Returns the count of campaigns triggered.
 */
export async function checkScheduledCampaigns(
  supabase: SupabaseClient,
  queryClient: QueryClient
): Promise<number> {
  try {
    const now = new Date().toISOString();

    const { data: campaigns, error } = await supabase
      .from("automation_campaigns")
      .select("id, name")
      .eq("status", "scheduled")
      .lte("scheduled_at", now);

    if (error) {
      console.error("[CampaignScheduler] Query error:", error.message);
      return 0;
    }

    if (!campaigns || campaigns.length === 0) return 0;

    console.log(`[CampaignScheduler] Found ${campaigns.length} campaign(s) due to send`);

    let count = 0;

    for (const campaign of campaigns) {
      try {
        // First update status to 'sending' to prevent re-triggering
        const { error: updateError } = await supabase
          .from("automation_campaigns")
          .update({ status: "sending", updated_at: new Date().toISOString() })
          .eq("id", campaign.id)
          .eq("status", "scheduled"); // optimistic lock: only update if still scheduled

        if (updateError) {
          console.error(`[CampaignScheduler] Failed to lock campaign ${campaign.id}:`, updateError.message);
          continue;
        }

        // Call email-engine edge function
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;

        const res = await fetch(
          "https://YOUR_SUPABASE_REF.supabase.co/functions/v1/email-engine",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({ campaign_id: campaign.id }),
          }
        );

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          console.error(`[CampaignScheduler] Edge function error for ${campaign.id}: ${res.status} ${text}`);
        } else {
          console.log(`[CampaignScheduler] Triggered campaign "${campaign.name}" (${campaign.id})`);
          count++;
        }
      } catch (e) {
        console.error(`[CampaignScheduler] Exception for campaign ${campaign.id}:`, e);
      }
    }

    if (count > 0 || campaigns.length > 0) {
      queryClient.invalidateQueries({ queryKey: ["email-campaigns"] });
    }

    return count;
  } catch (e) {
    console.error("[CampaignScheduler] Unexpected error:", e);
    return 0;
  }
}
