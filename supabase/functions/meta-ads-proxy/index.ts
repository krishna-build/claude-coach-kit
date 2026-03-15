import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const url = new URL(req.url);
    const since = url.searchParams.get("since") || "2026-02-01";
    const until = url.searchParams.get("until") || new Date().toISOString().slice(0, 10);
    const level = url.searchParams.get("level") || "campaign";
    const breakdowns = url.searchParams.get("breakdowns") || "";   // e.g. "age,gender"
    const datePreset = url.searchParams.get("date_preset") || "";  // e.g. "last_30d"

    const token = Deno.env.get("CLIENT_META_ACCESS_TOKEN");
    const accountId = Deno.env.get("CLIENT_META_AD_ACCOUNT_ID") || "YOUR_AD_ACCOUNT_ID";

    if (!token) return new Response(JSON.stringify({ error: "No Meta token configured" }), { status: 500, headers: CORS });

    // ── Age/Gender breakdown mode ─────────────────────────────────────
    if (breakdowns) {
      const fields = "ad_id,ad_name,campaign_name,adset_name,impressions,clicks,spend,reach";
      let apiUrl = `https://graph.facebook.com/v21.0/${accountId}/insights?access_token=${token}&fields=${fields}&breakdowns=${encodeURIComponent(breakdowns)}&level=ad&limit=200`;

      if (datePreset) {
        apiUrl += `&date_preset=${datePreset}`;
      } else {
        const timeRange = encodeURIComponent(JSON.stringify({ since, until }));
        apiUrl += `&time_range=${timeRange}`;
      }

      const resp = await fetch(apiUrl);
      const data = await resp.json();
      if (data.error) return new Response(JSON.stringify({ error: data.error.message }), { status: 400, headers: CORS });

      // Group by ad_id → age → gender breakdown
      const byAd: Record<string, {
        ad_id: string;
        ad_name: string;
        campaign_name: string;
        age_gender: { age: string; gender: string; clicks: number; impressions: number; spend: number }[];
      }> = {};

      for (const row of (data.data || [])) {
        const adId = row.ad_id || row.ad_name || "Unknown";
        const adName = row.ad_name || "Unknown";
        if (!byAd[adId]) {
          byAd[adId] = { ad_id: adId, ad_name: adName, campaign_name: row.campaign_name || "", age_gender: [] };
        }
        if (row.gender !== "unknown") {
          byAd[adId].age_gender.push({
            age: row.age || "unknown",
            gender: row.gender || "unknown",
            clicks: parseInt(row.clicks || "0"),
            impressions: parseInt(row.impressions || "0"),
            spend: parseFloat(row.spend || "0"),
          });
        }
      }

      // Aggregate to age-only breakdown per ad (sum male+female)
      const result = Object.values(byAd).map(ad => {
        const ageMap: Record<string, { clicks: number; impressions: number; spend: number }> = {};
        for (const row of ad.age_gender) {
          if (!ageMap[row.age]) ageMap[row.age] = { clicks: 0, impressions: 0, spend: 0 };
          ageMap[row.age].clicks += row.clicks;
          ageMap[row.age].impressions += row.impressions;
          ageMap[row.age].spend += row.spend;
        }

        const totalClicks = Object.values(ageMap).reduce((s, r) => s + r.clicks, 0);
        const ages = Object.entries(ageMap)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([age, stats]) => ({
            age,
            clicks: stats.clicks,
            pct: totalClicks > 0 ? Math.round((stats.clicks / totalClicks) * 100) : 0,
            spend: Math.round(stats.spend),
          }));

        // Gender split (for the whole ad)
        const genderMap: Record<string, number> = {};
        for (const row of ad.age_gender) {
          genderMap[row.gender] = (genderMap[row.gender] || 0) + row.clicks;
        }
        const maleClicks = genderMap["male"] || 0;
        const femaleClicks = genderMap["female"] || 0;
        const totalGender = maleClicks + femaleClicks;

        return {
          ad_id: ad.ad_id,
          ad_name: ad.ad_name,
          campaign_name: ad.campaign_name,
          ages,
          gender: {
            male_pct: totalGender > 0 ? Math.round((maleClicks / totalGender) * 100) : 50,
            female_pct: totalGender > 0 ? Math.round((femaleClicks / totalGender) * 100) : 50,
          },
          top_age: ages.sort((a, b) => b.clicks - a.clicks)[0]?.age || "unknown",
        };
      });

      return new Response(JSON.stringify({ breakdown: result }), { headers: CORS });
    }

    // ── Standard ads performance mode ────────────────────────────────
    const timeRange = encodeURIComponent(JSON.stringify({ since, until }));
    const fields = "ad_id,campaign_name,adset_name,ad_name,spend,impressions,clicks,actions,cpm,cpc,ctr";
    const apiUrl = `https://graph.facebook.com/v21.0/${accountId}/insights?access_token=${token}&time_range=${timeRange}&fields=${fields}&level=${level}&limit=50`;

    const resp = await fetch(apiUrl);
    const data = await resp.json();

    if (data.error) return new Response(JSON.stringify({ error: data.error.message }), { status: 400, headers: CORS });

    const ads = (data.data || []).map((row: any) => {
      const actions = row.actions || [];
      const getAction = (type: string) => parseInt(actions.find((a: any) => a.action_type === type)?.value || "0");

      return {
        ad_id: row.ad_id || "",
        name: row.ad_name || row.adset_name || row.campaign_name || "Unknown",
        campaign: row.campaign_name || "",
        spend: parseFloat(row.spend || "0"),
        impressions: parseInt(row.impressions || "0"),
        clicks: parseInt(row.clicks || "0"),
        leads: getAction("lead"),
        purchases: getAction("purchase"),
        cpm: parseFloat(row.cpm || "0"),
        cpc: parseFloat(row.cpc || "0"),
        ctr: parseFloat(row.ctr || "0"),
      };
    });

    const totals = ads.reduce(
      (acc: any, ad: any) => ({
        spend: acc.spend + ad.spend,
        impressions: acc.impressions + ad.impressions,
        clicks: acc.clicks + ad.clicks,
        leads: acc.leads + ad.leads,
        purchases: acc.purchases + ad.purchases,
      }),
      { spend: 0, impressions: 0, clicks: 0, leads: 0, purchases: 0 }
    );

    return new Response(JSON.stringify({ ads, totals, since, until, level }), { headers: CORS });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: CORS });
  }
});
