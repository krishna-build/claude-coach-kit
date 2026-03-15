import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { motion } from "framer-motion";
import { Loader2, IndianRupee, Users, CreditCard, Target, Megaphone, CalendarDays, RefreshCw } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const SB_URL = "https://YOUR_SUPABASE_REF.supabase.co/functions/v1/meta-ads-proxy";
const ANON_KEY = "YOUR_SUPABASE_KEY";

type RangeKey = "today" | "7d" | "30d" | "custom";

function getRange(key: RangeKey, customSince?: string, customUntil?: string): { since: string; until: string } {
  if (key === "custom" && customSince && customUntil) {
    return { since: customSince, until: customUntil };
  }
  const now = new Date();
  const until = now.toISOString().slice(0, 10);
  if (key === "today") return { since: until, until };
  if (key === "7d") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return { since: d.toISOString().slice(0, 10), until };
  }
  const d = new Date(now);
  d.setDate(d.getDate() - 30);
  return { since: d.toISOString().slice(0, 10), until };
}

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.35 },
  }),
};


export default function MetaAds() {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [range, setRange] = useState<RangeKey>("30d");
  const [customSince, setCustomSince] = useState("");
  const [customUntil, setCustomUntil] = useState("");
  const { since, until } = getRange(range, customSince, customUntil);

  const { data, isLoading, error } = useQuery({
    queryKey: ["meta-ads", range, customSince, customUntil],
    queryFn: async () => {
      const { since: s, until: u } = getRange(range, customSince, customUntil);
      const resp = await fetch(`${SB_URL}?since=${s}&until=${u}&level=campaign`, {
        headers: { "Authorization": `Bearer ${ANON_KEY}` },
      });
      const json = await resp.json();
      if (json.error) throw new Error(json.error);
      return json;
    },
    enabled: range !== "custom" || (!!customSince && !!customUntil),
  });

  const totals = data?.totals || { spend: 0, impressions: 0, clicks: 0, leads: 0, purchases: 0 };
  const ads = data?.ads || [];
  const cpl = totals.leads > 0 ? totals.spend / totals.leads : 0;
  const cpa = totals.purchases > 0 ? totals.spend / totals.purchases : 0;
  const ctr = totals.clicks > 0 && totals.impressions > 0 ? ((totals.clicks / totals.impressions) * 100).toFixed(1) : "0";
  const statCards = [
    { label: "Total Spend", value: `₹${Math.round(totals.spend).toLocaleString("en-IN")}`, icon: IndianRupee },
    { label: "Purchases", value: totals.purchases.toLocaleString("en-IN"), icon: CreditCard },
    { label: "CPA", value: `₹${Math.round(cpa).toLocaleString("en-IN")}`, icon: Target },
    { label: "Clicks", value: totals.clicks.toLocaleString("en-IN"), icon: Users },
    { label: "CTR", value: `${ctr}%`, icon: Target },
  ];

  const COLORS = ["#FFB433", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

  const handleQuickRange = (key: "today" | "7d" | "30d") => {
    setRange(key);
    setCustomSince("");
    setCustomUntil("");
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border/50 rounded-xl p-3 shadow-xl">
          <p className="text-xs font-semibold text-foreground mb-1">{label}</p>
          {payload.map((p: any) => (
            <p key={p.dataKey} className="text-xs text-muted-foreground">
              Spend: ₹{(p.value ?? 0).toLocaleString("en-IN")}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header with date controls */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Megaphone className="w-5 h-5 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Meta Ads</h1>
            </div>
            <p className="text-sm text-muted-foreground">{since} → {until}</p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <button
              onClick={async () => {
                setIsRefreshing(true);
                await queryClient.invalidateQueries({ queryKey: ["meta-ads"] });
                await queryClient.refetchQueries({ queryKey: ["meta-ads"] });
                setTimeout(() => setIsRefreshing(false), 500);
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card border border-border/15 text-muted-foreground text-sm font-medium hover:text-foreground transition-all"
              disabled={isRefreshing}
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
              {isRefreshing ? "Syncing..." : "Refresh"}
            </button>
            <div className="flex gap-0.5 bg-card rounded-lg p-0.5 border border-border/15">
              {([["today", "Today"], ["7d", "7D"], ["30d", "30D"]] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => handleQuickRange(key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    range === key ? "bg-primary/15 text-primary" : "text-muted-foreground/50 hover:text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                type="date"
                value={customSince}
                onChange={(e) => { setCustomSince(e.target.value); if (customUntil) setRange("custom"); }}
                className="h-10 px-3 rounded-xl border border-border/50 bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
              />
              <span className="text-muted-foreground text-xs">to</span>
              <input
                type="date"
                value={customUntil}
                onChange={(e) => { setCustomUntil(e.target.value); if (customSince) setRange("custom"); }}
                className="h-10 px-3 rounded-xl border border-border/50 bg-card text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all"
              />
            </div>
          </div>
        </motion.div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading ad data...</p>
          </div>
        ) : error ? (
          <div className="bg-danger/10 text-danger p-5 rounded-2xl text-sm border border-danger/20 font-medium">{(error as Error).message}</div>
        ) : (
          <>
            {/* Stat Cards — Clean flat style */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {statCards.map((s, i) => {
                const Icon = s.icon;
                return (
                  <motion.div
                    key={s.label}
                    custom={i}
                    initial="hidden"
                    animate="visible"
                    variants={cardVariants}
                    className="rounded-xl border border-border/15 p-4 bg-card"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.1em]">{s.label}</p>
                      <Icon className="w-3.5 h-3.5 text-muted-foreground/30" />
                    </div>
                    <p className="text-xl font-semibold text-foreground">{s.value}</p>
                  </motion.div>
                );
              })}
            </div>

            {/* Campaign Cards — Spark Pixel style with sparklines */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {ads.map((ad: any, i: number) => {
                const adCpa = ad.purchases > 0 ? ad.spend / ad.purchases : 0;
                const adCpl = ad.leads > 0 ? ad.spend / ad.leads : 0;
                const spendPct = totals.spend > 0 ? ((ad.spend / totals.spend) * 100).toFixed(0) : 0;
                // Sparkline seed data
                const spark = [3,6,4,8,5,9,7].map(v => v * (ad.spend / Math.max(totals.spend, 1)));
                return (
                  <motion.div
                    key={i}
                    custom={i}
                    initial="hidden"
                    animate="visible"
                    variants={cardVariants}
                    className="rounded-xl border border-border/15 bg-card relative overflow-hidden"
                  >
                    {/* Left accent bar */}
                    <div className={`absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl ${
                      ad.purchases > 2 ? 'bg-emerald-500' : ad.purchases > 0 ? 'bg-primary' : 'bg-muted-foreground/20'
                    }`} />
                    <div className="p-4 sm:p-5 pl-5 sm:pl-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate" title={ad.name}>{ad.name}</p>
                        <p className="text-[10px] text-muted-foreground/40 mt-0.5">{spendPct}% of total spend</p>
                      </div>
                      <span className={`flex-shrink-0 ml-2 px-2 py-0.5 rounded-md text-[10px] font-medium ${
                        ad.purchases > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-muted text-muted-foreground/40'
                      }`}>
                        {ad.purchases > 0 ? `${ad.purchases} sales` : 'No sales'}
                      </span>
                    </div>

                    {/* Metrics grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-3 mb-4">
                      <div>
                        <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.08em]">Spend</p>
                        <p className="text-base font-semibold text-foreground">₹{Math.round(ad.spend).toLocaleString("en-IN")}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.08em]">Purchases</p>
                        <p className="text-base font-semibold text-emerald-400">{ad.purchases}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.08em]">CPA</p>
                        <p className="text-sm text-foreground">{ad.purchases > 0 ? `₹${Math.round(adCpa).toLocaleString("en-IN")}` : '—'}</p>
                      </div>
                    </div>

                    {/* Mini sparkline */}
                    {(() => {
                      const sparkColor = ad.purchases > 2 ? '#10b981' : ad.purchases > 0 ? '#FFB433' : '#6b7280';
                      return (
                        <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="w-full h-8">
                          <defs>
                            <linearGradient id={`cs-${i}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={sparkColor} stopOpacity="0.3" />
                              <stop offset="100%" stopColor={sparkColor} stopOpacity="0.02" />
                            </linearGradient>
                          </defs>
                          {(() => {
                            const max = Math.max(...spark, 1);
                            const coords = spark.map((v: number, j: number) => `${(j / 6) * 100},${24 - (v / max) * 20}`);
                            return (
                              <>
                                <polygon points={`0,24 ${coords.join(" ")} 100,24`} fill={`url(#cs-${i})`} />
                                <polyline points={coords.join(" ")} fill="none" stroke={sparkColor} strokeWidth="1.5" strokeLinejoin="round" />
                              </>
                            );
                          })()}
                        </svg>
                      );
                    })()}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Campaign Table — Clean */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-card rounded-xl border border-border/15 overflow-hidden"
            >
              <div className="px-4 py-3 border-b border-border/10">
                <p className="text-[11px] text-muted-foreground/50 uppercase tracking-[0.12em]">Campaign Breakdown</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[340px]">
                  <thead>
                    <tr className="border-b border-border/10">
                      <th className="text-left px-4 py-2.5 text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">Campaign</th>
                      <th className="text-right px-3 py-2.5 text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">Spend</th>
                      <th className="text-right px-3 py-2.5 text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider hidden sm:table-cell">Impr.</th>
                      <th className="text-right px-3 py-2.5 text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider hidden sm:table-cell">Clicks</th>
                      <th className="text-right px-3 py-2.5 text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">Sales</th>
                      <th className="text-right px-3 py-2.5 text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">CPA</th>

                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/10">
                    {ads.map((ad: any, i: number) => (
                      <tr key={i} className="hover:bg-primary/[0.02] transition-colors">
                        <td className="px-4 py-3 text-foreground text-xs max-w-[180px]">
                          <span className="block truncate font-medium" title={ad.name}>{ad.name}</span>
                        </td>
                        <td className="px-3 py-3 text-right text-foreground text-xs whitespace-nowrap">₹{Math.round(ad.spend).toLocaleString("en-IN")}</td>
                        <td className="px-3 py-3 text-right text-muted-foreground/60 text-xs hidden sm:table-cell">{ad.impressions.toLocaleString("en-IN")}</td>
                        <td className="px-3 py-3 text-right text-muted-foreground/60 text-xs hidden sm:table-cell">{ad.clicks.toLocaleString("en-IN")}</td>
                        <td className="px-3 py-3 text-right text-xs">
                          <span className={ad.purchases > 0 ? 'text-emerald-400 font-semibold' : 'text-muted-foreground/30'}>{ad.purchases}</span>
                        </td>
                        <td className="px-3 py-3 text-right text-xs text-foreground">
                          {ad.purchases > 0 ? `₹${Math.round(ad.spend / ad.purchases).toLocaleString("en-IN")}` : "—"}
                        </td>
                        <td className="px-3 py-3 text-right text-xs text-primary hidden sm:table-cell">
                          {ad.spend > 0 ? `${((ad.purchases * 299) / ad.spend).toFixed(1)}x` : "—"}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-border/20">
                      <td className="px-4 py-3 text-foreground text-xs font-semibold">Total</td>
                      <td className="px-3 py-3 text-right text-foreground text-xs font-semibold whitespace-nowrap">₹{Math.round(totals.spend).toLocaleString("en-IN")}</td>
                      <td className="px-3 py-3 text-right text-muted-foreground/60 text-xs hidden sm:table-cell">{totals.impressions.toLocaleString("en-IN")}</td>
                      <td className="px-3 py-3 text-right text-muted-foreground/60 text-xs hidden sm:table-cell">{totals.clicks.toLocaleString("en-IN")}</td>
                      <td className="px-3 py-3 text-right text-emerald-400 text-xs font-semibold">{totals.purchases}</td>
                      <td className="px-3 py-3 text-right text-foreground text-xs font-semibold">₹{Math.round(cpa).toLocaleString("en-IN")}</td>

                    </tr>
                  </tbody>
                </table>
              </div>
            </motion.div>
          </>
        )}
      </div>
    </Layout>
  );
}
