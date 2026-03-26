import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import Layout from "@/components/Layout";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Users,
  CreditCard,
  TrendingUp,
  IndianRupee,
  ArrowRight,
  Phone,
  Zap,
  Tag,
  Activity,
  Mail,
  Webhook,
  Kanban,
  Sparkles,
  ChevronRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  RefreshCw,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, formatDistanceToNow, subDays, isAfter } from "date-fns";

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    if (value === 0) return;
    const duration = 1000;
    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [value]);
  return <>{display.toLocaleString()}</>;
}

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" },
  }),
};

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSyncInfo, setLastSyncInfo] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [customSince, setCustomSince] = useState("");
  const [customUntil, setCustomUntil] = useState("");
  const firstName = profile?.full_name?.split(" ")[0] || "Admin";

  // Date range helpers
  const getDateRange = () => {
    if (customSince && customUntil) return { since: new Date(customSince), until: new Date(customUntil + "T23:59:59") };
    const now = new Date();
    const until = new Date(now); until.setHours(23, 59, 59, 999);
    if (dateRange === "7d") return { since: subDays(now, 7), until };
    if (dateRange === "30d") return { since: subDays(now, 30), until };
    if (dateRange === "90d") return { since: subDays(now, 90), until };
    return { since: new Date("2025-01-01"), until };
  };
  const { since: rangeStart, until: rangeEnd } = getDateRange();
  const rangeDays = Math.max(1, Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / (1000 * 60 * 60 * 24)));

  const { data: emailPerf } = useQuery({
    queryKey: ["dashboard-email-perf"],
    queryFn: async () => {
      // Count campaigns
      const { data: campaigns } = await supabase
        .from("automation_campaigns")
        .select("id")
        .eq("status", "sent");
      const totalCampaigns = campaigns?.length || 0;

      // Real stats from email_log (both campaigns + sequences)
      const { data: logs } = await supabase
        .from("automation_email_log")
        .select("status, opened_at, clicked_at");
      const allLogs = logs || [];
      const totalSent = allLogs.length;
      const totalOpened = allLogs.filter((l: any) => l.opened_at || l.status === "opened" || l.status === "clicked").length;
      const totalClicked = allLogs.filter((l: any) => l.clicked_at || l.status === "clicked").length;
      const avgOpenRate = totalSent > 0 ? ((totalOpened / totalSent) * 100) : 0;
      const avgClickRate = totalSent > 0 ? ((totalClicked / totalSent) * 100) : 0;
      return { totalCampaigns, totalSent, avgOpenRate, avgClickRate };
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["dashboard-stats", dateRange, customSince, customUntil],
    queryFn: async () => {
      const [contactsRes, webhookRes] = await Promise.all([
        supabase.from("automation_contacts").select("id, first_name, last_name, email, paid_299, paid_299_at, purchased_50k, purchased_50k_at, call_booked, call_booked_at, higher_ticket_amount, higher_ticket_program, higher_ticket_source, tags, status, source, utm_campaign, utm_content, utm_source, created_at"),
        supabase.from("automation_webhook_log").select("id, source, payload, action_taken, processed, created_at").order("created_at", { ascending: false }).limit(20),
      ]);
      const emailRes = { data: [] as any[] };

      // Exclude webinar & referral contacts — campaigns only
      const allContacts = (contactsRes.data || []).filter((c: any) => {
        const src = (c.source || "").toLowerCase();
        const camp = (c.higher_ticket_source || "").toLowerCase();
        return !src.includes("webinar") && !src.includes("referral") && !camp.includes("webinar") && !camp.includes("referral");
      });
      const webhookLogs = webhookRes.data || [];
      const emailLogs = emailRes.data || [];

      const { since: rs, until: re } = getDateRange();

      // Filter contacts CREATED in date range (for lead count)
      const leadsInRange = allContacts.filter((c: any) => {
        const d = new Date(c.created_at);
        return d >= rs && d <= re;
      });

      // Filter by PAYMENT DATE for paid/converted counts
      const paid299Count = allContacts.filter((c: any) => {
        if (!c.paid_299 || !c.paid_299_at) return false;
        const d = new Date(c.paid_299_at);
        return d >= rs && d <= re;
      }).length;
      const purchased50kCount = allContacts.filter((c: any) => {
        if (!c.purchased_50k || !c.purchased_50k_at) return false;
        const d = new Date(c.purchased_50k_at);
        return d >= rs && d <= re;
      }).length;
      const callBookedCount = allContacts.filter((c: any) => {
        if (!c.call_booked || !c.call_booked_at) return false;
        const d = new Date(c.call_booked_at);
        return d >= rs && d <= re;
      }).length;

      // Revenue within date range based on payment dates
      const rangeRevenue299 = allContacts.filter((c: any) => {
        if (!c.paid_299 || !c.paid_299_at) return false;
        const d = new Date(c.paid_299_at);
        return d >= rs && d <= re;
      }).length * 299;
      const rangeRevenue50k = allContacts.filter((c: any) => {
        if (!c.purchased_50k || !c.purchased_50k_at) return false;
        const d = new Date(c.purchased_50k_at);
        return d >= rs && d <= re;
      }).reduce((sum: number, c: any) => sum + (c.higher_ticket_amount || 0), 0);

      // Build daily chart data for the selected range
      const chartData = [];
      const days = Math.min(rangeDays, 90);
      for (let i = days - 1; i >= 0; i--) {
        const day = subDays(new Date(), i);
        if (day < rs) continue;
        const dayStr = days <= 14 ? format(day, "MMM dd") : format(day, "dd");
        const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(day); dayEnd.setHours(23, 59, 59, 999);
        const dayLeads = allContacts.filter((c: any) => {
          const d = new Date(c.created_at);
          return d >= dayStart && d <= dayEnd;
        }).length;
        const daySales = allContacts.filter((c: any) => {
          if (!c.paid_299_at) return false;
          const d = new Date(c.paid_299_at);
          return d >= dayStart && d <= dayEnd;
        }).length;
        const dayRevenue = daySales * 299 + allContacts.filter((c: any) => {
          if (!c.purchased_50k_at) return false;
          const d = new Date(c.purchased_50k_at);
          return d >= dayStart && d <= dayEnd;
        }).reduce((sum: number, c: any) => sum + (c.higher_ticket_amount || 0), 0);
        chartData.push({ name: dayStr, leads: dayLeads, sales: daySales, revenue: dayRevenue });
      }

      // Sparkline data for stat cards (daily values for trend line)
      const sparkLeads = chartData.map((d: any) => d.leads);
      const sparkSales = chartData.map((d: any) => d.sales);
      const sparkRevenue = chartData.map((d: any) => d.revenue);

      // New leads in last 7 days
      const weekAgo = subDays(new Date(), 7);
      const newLeadsThisWeek = allContacts.filter((c: any) => isAfter(new Date(c.created_at), weekAgo)).length;

      return {
        totalContacts: leadsInRange.length,
        allTimeContacts: allContacts.length,
        paid299Count,
        purchased50kCount,
        callBookedCount,
        higherTicketRevenue: allContacts.filter((c: any) => c.purchased_50k).reduce((s: number, c: any) => s + (c.higher_ticket_amount || 0), 0),
        // Program breakdown
        programBreakdown: (() => {
          const map: Record<string, { count: number; revenue: number }> = {};
          allContacts.filter((c: any) => c.purchased_50k && c.higher_ticket_program).forEach((c: any) => {
            const p = c.higher_ticket_program;
            if (!map[p]) map[p] = { count: 0, revenue: 0 };
            map[p].count++;
            map[p].revenue += (c.higher_ticket_amount || 0);
          });
          return Object.entries(map).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.revenue - a.revenue);
        })(),
        rangeRevenue: rangeRevenue299 + rangeRevenue50k,
        totalRevenue: allContacts.filter((c: any) => c.paid_299).length * 299 + allContacts.filter((c: any) => c.purchased_50k).reduce((s: number, c: any) => s + (c.higher_ticket_amount || 0), 0),
        webhookLogs,
        emailLogs,
        contacts: allContacts,
        chartData,
        newLeadsThisWeek,
        sparkLeads,
        sparkSales,
        sparkRevenue,

        // 1. Campaign → Higher Ticket Attribution
        campaignAttribution: (() => {
          const map: Record<string, { leads: number; paid299: number; higherTicket: number; revenue: number }> = {};
          allContacts.forEach((c: any) => {
            const camp = c.utm_campaign || "No Campaign Data";
            if (!map[camp]) map[camp] = { leads: 0, paid299: 0, higherTicket: 0, revenue: 0 };
            map[camp].leads++;
            if (c.paid_299) { map[camp].paid299++; map[camp].revenue += 299; }
            if (c.purchased_50k) { map[camp].higherTicket++; map[camp].revenue += (c.higher_ticket_amount || 0); }
          });
          // Named campaigns first, "No Campaign Data" last
          return Object.entries(map)
            .map(([name, d]) => ({ name, ...d }))
            .sort((a, b) => a.name === "No Campaign Data" ? 1 : b.name === "No Campaign Data" ? -1 : b.revenue - a.revenue);
        })(),

        // 2. Cohort Analysis (weekly cohorts)
        cohorts: (() => {
          const cohorts: { week: string; start: Date; leads: number; paid: number; higherTicket: number; convRate: string }[] = [];
          const now = new Date();
          for (let w = 0; w < 6; w++) {
            const wStart = subDays(now, (w + 1) * 7);
            const wEnd = subDays(now, w * 7);
            const weekLabel = `${format(wStart, "MMM d")} – ${format(wEnd, "MMM d")}`;
            const inCohort = allContacts.filter((c: any) => {
              const d = new Date(c.created_at);
              return d >= wStart && d < wEnd;
            });
            const paid = inCohort.filter((c: any) => c.paid_299).length;
            const ht = inCohort.filter((c: any) => c.purchased_50k).length;
            cohorts.push({
              week: weekLabel,
              start: wStart,
              leads: inCohort.length,
              paid,
              higherTicket: ht,
              convRate: inCohort.length > 0 ? ((paid / inCohort.length) * 100).toFixed(1) : "0",
            });
          }
          return cohorts.reverse();
        })(),

        // 3. Recent Higher Ticket Journeys (payment timeline)
        higherTicketJourneys: allContacts
          .filter((c: any) => c.purchased_50k)
          .map((c: any) => ({
            name: `${c.first_name || ""} ${(c.last_name || "").charAt(0)}.`.trim(),
            email: c.email,
            campaign: c.utm_campaign || "Unknown",
            creative: c.utm_content || "—",
            created: c.created_at,
            paid299At: c.paid_299_at,
            calledAt: c.call_booked_at,
            convertedAt: c.purchased_50k_at,
            program: c.higher_ticket_program || "—",
            amount: c.higher_ticket_amount || 0,
          }))
          .sort((a: any, b: any) => new Date(b.convertedAt).getTime() - new Date(a.convertedAt).getTime()),
      };
    },
  });

  // Realtime subscription for auto-refresh
  useEffect(() => {
    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "automation_contacts" }, () => {
        queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const funnelData = [
    { name: "Total Leads", value: stats?.totalContacts || 0, color: "#FFB433", gradient: "from-[#FFB433] to-[#ffc85c]" },
    { name: "Paid ₹299", value: stats?.paid299Count || 0, color: "#10b981", gradient: "from-emerald-500 to-emerald-400" },
    { name: "Call Booked", value: stats?.callBookedCount || 0, color: "#f59e0b", gradient: "from-amber-500 to-amber-400" },
    { name: "Higher Ticket", value: stats?.purchased50kCount || 0, color: "#8b5cf6", gradient: "from-violet-500 to-violet-400" },
  ];

  const statCards = [
    {
      label: "Total Leads",
      value: stats?.totalContacts || 0,
      icon: Users,
      spark: stats?.sparkLeads || [],
      sparkColor: "#FFB433",
      href: "/contacts",
      change: stats?.newLeadsThisWeek ? `+${stats.newLeadsThisWeek} this week` : undefined,
    },
    {
      label: "Paid ₹299",
      value: stats?.paid299Count || 0,
      icon: CreditCard,
      spark: stats?.sparkSales || [],
      sparkColor: "#10b981",
      href: "/contacts",
    },
    {
      label: "Higher Ticket",
      value: stats?.purchased50kCount || 0,
      icon: TrendingUp,
      spark: [],
      sparkColor: "#8b5cf6",
      href: "/pipeline",
    },
    {
      label: "Call Booked",
      value: stats?.callBookedCount || 0,
      icon: Phone,
      spark: [],
      sparkColor: "#f59e0b",
      href: "/bookings",
    },
  ];

  const quickActions = [
    { label: "View Contacts", description: "Manage your leads", icon: Users, href: "/contacts", iconBg: "from-[#FFB433]/20 to-[#FFB433]/10", iconColor: "text-primary" },
    { label: "Pipeline", description: "Track conversions", icon: Kanban, href: "/pipeline", iconBg: "from-violet-500/20 to-violet-500/10", iconColor: "text-violet-400" },
    { label: "Sequences", description: "Email automation", icon: Zap, href: "/sequences", iconBg: "from-amber-500/20 to-amber-500/10", iconColor: "text-warning" },
    { label: "Tags", description: "Organize contacts", icon: Tag, href: "/tags", iconBg: "from-emerald-500/20 to-emerald-500/10", iconColor: "text-success" },
  ];

  // Activity feed
  const activityFeed = [
    ...(stats?.webhookLogs || []).map((log: any) => ({
      id: `wh-${log.id}`,
      type: "webhook" as const,
      source: log.source,
      event: log.payload?.event || "webhook",
      email: log.payload?.email || log.payload?.notes?.email || "—",
      status: log.processed ? "processed" : "pending",
      created_at: log.created_at,
    })),
    ...(stats?.emailLogs || []).filter((log: any) => log?.id).map((log: any) => ({
      id: `em-${log.id}`,
      type: "email" as const,
      source: "email",
      event: log.status,
      email: "",
      status: log.status,
      created_at: log.created_at,
    })),
  ]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);

  const chartData = stats?.chartData || [];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card/95 backdrop-blur-xl border border-border/15 rounded-2xl p-4 shadow-2xl shadow-black/40">
          <p className="text-sm font-bold text-foreground mb-2">{label}</p>
          {payload.map((p: any) => (
            <p key={p.dataKey} className="text-xs text-muted-foreground leading-relaxed">
              {p.dataKey === "revenue" ? (
                <span>Revenue: <span className="font-semibold text-[#FFB433]">₹{p.value.toLocaleString("en-IN")}</span></span>
              ) : (
                <span>Sales: <span className="font-semibold text-emerald-400">{p.value}</span></span>
              )}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Layout>
      <div className="space-y-3 sm:space-y-4">
        {/* ═══════════ HERO WELCOME ═══════════ */}
        {/* ═══════════ HERO WELCOME ═══════════ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative overflow-hidden rounded-2xl border border-border/15 bg-card"
        >
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#FFB433]/8 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />

          <div className="relative z-10 p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 lg:gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#FFB433]" />
                  <span className="text-[10px] font-bold text-[#FFB433]/80 uppercase tracking-[0.15em]">Command Center</span>
                </div>

                <h1 className="text-lg sm:text-2xl lg:text-3xl font-black text-foreground leading-tight tracking-tight" style={{ fontFamily: "'PT Serif', Georgia, serif" }}>
                  Welcome back, <span className="bg-gradient-to-r from-[#FFB433] to-[#ffc85c] bg-clip-text text-transparent">{firstName}</span>
                </h1>

                {/* Hero inline stats — NO revenue */}
                <div className="flex items-center gap-4 sm:gap-5 pt-1">
                  <div>
                    <p className="text-xl sm:text-2xl font-black text-foreground leading-none"><AnimatedNumber value={stats?.totalContacts || 0} /></p>
                    <p className="text-[9px] sm:text-[10px] text-muted-foreground/60 mt-0.5 uppercase tracking-wider">Total Leads</p>
                  </div>
                  <div className="w-px h-7 bg-border/20" />
                  <div>
                    <p className="text-xl sm:text-2xl font-black text-emerald-400 leading-none"><AnimatedNumber value={stats?.purchased50kCount || 0} /></p>
                    <p className="text-[9px] sm:text-[10px] text-muted-foreground/60 mt-0.5 uppercase tracking-wider">Converted</p>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-0.5 bg-muted/20 rounded-lg p-0.5 border border-border/15">
                  {([["7d", "7D"], ["30d", "30D"], ["90d", "90D"], ["all", "All"]] as const).map(([key, label]) => (
                    <button key={key} onClick={() => { setDateRange(key as any); setCustomSince(""); setCustomUntil(""); }}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${dateRange === key && !customSince ? "bg-primary/15 text-primary" : "text-muted-foreground/50 hover:text-muted-foreground"}`}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <input type="date" value={customSince} onChange={e => { setCustomSince(e.target.value); if (customUntil) setDateRange("30d"); }}
                    className="h-7 px-1.5 rounded-lg border border-border/15 bg-muted/20 text-[10px] text-foreground focus:outline-none w-[105px]" />
                  <span className="text-muted-foreground/30 text-[10px]">→</span>
                  <input type="date" value={customUntil} onChange={e => { setCustomUntil(e.target.value); if (customSince) setDateRange("30d"); }}
                    className="h-7 px-1.5 rounded-lg border border-border/15 bg-muted/20 text-[10px] text-foreground focus:outline-none w-[105px]" />
                </div>
                <button
                  onClick={async () => {
                    setIsRefreshing(true);
                    try {
                      const resp = await fetch("https://YOUR_SUPABASE_REF.supabase.co/functions/v1/trigger-sync", {
                        headers: { "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` }
                      }).catch(() => null);
                      if (resp) {
                        const data = await resp.json().catch(() => null);
                        if (data?.lastSheetSync) {
                          const ago = formatDistanceToNow(new Date(data.lastSheetSync), { addSuffix: true });
                          setLastSyncInfo(`Synced ${ago}`);
                        }
                      }
                      await queryClient.invalidateQueries();
                      await queryClient.refetchQueries();
                    } finally { setTimeout(() => setIsRefreshing(false), 800); }
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/20 border border-border/15 text-muted-foreground text-xs font-medium hover:bg-muted/40 transition-all"
                  disabled={isRefreshing}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
                  {isRefreshing ? "Syncing..." : "Sync All"}
                </button>
                <button onClick={() => navigate("/contacts")} className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#FFB433] to-[#e6a02e] text-black text-xs font-bold flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> Contacts
                </button>
                <button onClick={() => navigate("/pipeline")} className="px-3 py-1.5 rounded-lg bg-muted/20 border border-border/15 text-foreground text-xs font-medium flex items-center gap-1.5">
                  <Kanban className="w-3.5 h-3.5" /> Pipeline
                </button>
              </div>
            </div>
            {lastSyncInfo && <p className="text-[9px] text-muted-foreground/30 mt-2">{lastSyncInfo}</p>}
          </div>
        </motion.div>

        {/* ═══════════ STAT CARDS — Glass Morphism ═══════════ */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 pt-2"
        >
          {statCards.map((stat, i) => {
            const Icon = stat.icon;
            // Use real data if available, fallback to seed pattern
            const rawPts = stat.spark.length > 1 ? stat.spark : [];
            const hasRealData = rawPts.some((v: number) => v > 0);
            const pts = hasRealData ? rawPts : [2,5,3,8,6,9,7,4,8,5];
            const sc = stat.sparkColor;
            return (
              <motion.div
                key={stat.label}
                custom={i}
                variants={cardVariants}
                onClick={() => stat.href && navigate(stat.href)}
                className="group relative overflow-hidden rounded-xl border border-border/15 p-3 sm:p-5 cursor-pointer bg-card hover:border-primary/20 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <p className="text-[11px] text-muted-foreground/60 font-medium uppercase tracking-[0.12em]">{stat.label}</p>
                  <Icon className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary/50 transition-colors" />
                </div>
                <p className="text-2xl sm:text-3xl font-semibold text-foreground leading-none tracking-tight">
                  {typeof stat.value === "number" ? <AnimatedNumber value={stat.value} /> : stat.value}
                </p>
                {/* Real data sparkline */}
                <div className="mt-4">
                  <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="w-full h-10 overflow-visible">
                    <defs>
                      <linearGradient id={`sg-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={sc} stopOpacity="0.35" />
                        <stop offset="100%" stopColor={sc} stopOpacity="0.02" />
                      </linearGradient>
                    </defs>
                    {(() => {
                      const max = Math.max(...pts, 1);
                      const coords = pts.map((v: number, j: number) => `${(j / Math.max(pts.length - 1, 1)) * 100},${32 - (v / max) * 28}`);
                      const line = coords.join(" ");
                      return (
                        <>
                          <polygon points={`0,32 ${line} 100,32`} fill={`url(#sg-${i})`} />
                          <polyline points={line} fill="none" stroke={sc} strokeWidth="1.5" strokeLinejoin="round" />
                        </>
                      );
                    })()}
                  </svg>
                </div>
                {stat.change && (
                  <div className="flex items-center gap-1.5 mt-3">
                    <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                    <span className="text-[11px] text-emerald-400 font-medium">{stat.change}</span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </motion.div>

        {/* ═══════════ QUICK ACTIONS — Icon-forward hover lift ═══════════ */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 pt-2"
        >
          {quickActions.map((action, i) => {
            const Icon = action.icon;
            return (
              <motion.button
                key={action.label}
                custom={i + 4}
                variants={fadeUp}
                onClick={() => navigate(action.href)}
                className="group flex items-center gap-2.5 px-3 py-3 rounded-xl bg-card border border-border/15 hover:border-border/30 transition-all duration-200 text-left"
              >
                <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-foreground block leading-tight">
                    {action.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground/60 mt-0.5 block hidden sm:block">{action.description}</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/20 ml-auto group-hover:text-muted-foreground/50 transition-colors flex-shrink-0 hidden sm:block" />
              </motion.button>
            );
          })}
        </motion.div>

        {/* ═══════════ REVENUE HERO + 14-DAY CHART ═══════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6 pt-2">
          {/* Revenue Hero */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="lg:col-span-2 relative overflow-hidden rounded-xl border border-border/15 p-4 sm:p-6 bg-card"
          >

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FFB433] to-[#e6a02e] flex items-center justify-center shadow-lg shadow-[#FFB433]/20">
                  <IndianRupee className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Revenue</h2>
              </div>

              {/* Hero metric */}
              <p className="text-2xl sm:text-4xl font-semibold bg-gradient-to-r from-[#FFB433] to-[#ffc85c] bg-clip-text text-transparent leading-none tracking-tight">
                ₹{(stats?.totalRevenue || 0).toLocaleString("en-IN")}
              </p>
              <p className="text-xs text-muted-foreground mt-1.5 font-medium">Total Revenue</p>

              {/* Breakdown */}
              <div className="mt-5 space-y-2.5">
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/10 border border-border/15">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span className="text-sm text-muted-foreground">₹299 × {stats?.paid299Count || 0}</span>
                  </div>
                  <span className="text-sm font-bold text-foreground">₹{((stats?.paid299Count || 0) * 299).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/10 border border-border/15">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-violet-400" />
                    <span className="text-sm text-muted-foreground">Higher Ticket × {stats?.purchased50kCount || 0}</span>
                  </div>
                  <span className="text-sm font-bold text-foreground">₹{(stats?.higherTicketRevenue || 0).toLocaleString("en-IN")}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#FFB433]/[0.04] border border-[#FFB433]/10">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#FFB433]" />
                    <span className="text-sm text-muted-foreground">Selected Period</span>
                  </div>
                  <span className="text-sm font-bold bg-gradient-to-r from-[#FFB433] to-[#ffc85c] bg-clip-text text-transparent">
                    ₹{(stats?.rangeRevenue || 0).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              {/* Program Breakdown */}
              {(stats?.programBreakdown || []).length > 0 && (
                <div className="mt-5">
                  <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.12em] mb-3">Program Breakdown</p>
                  <div className="space-y-2">
                    {(stats?.programBreakdown || []).map((p: any) => (
                      <div key={p.name} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/10 border border-border/10">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                          <span className="text-xs text-muted-foreground truncate">{p.name}</span>
                          <span className="text-[10px] text-muted-foreground/40 flex-shrink-0">×{p.count}</span>
                        </div>
                        <span className="text-xs font-semibold text-foreground ml-2">₹{p.revenue.toLocaleString("en-IN")}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>

          {/* 14-Day Chart */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="lg:col-span-3 rounded-xl border border-border/15 p-4 sm:p-6 bg-card"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0 mb-5 sm:mb-6">
              <div>
                <p className="text-[11px] text-muted-foreground/50 uppercase tracking-[0.12em] mb-1">Sales Trend</p>
                <h2 className="text-lg font-semibold text-foreground">₹{(stats?.rangeRevenue || 0).toLocaleString("en-IN")}</h2>
              </div>
              <p className="text-[10px] text-muted-foreground/30">{dateRange === "all" ? "All time" : `Last ${dateRange}`}{customSince ? ` (${customSince} → ${customUntil})` : ""}</p>
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#FFB433]" />
                <span className="text-[10px] text-muted-foreground/50">Revenue</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#e6a02e]/50" />
                <span className="text-[10px] text-muted-foreground/50">Sales</span>
              </div>
            </div>
            <div className="h-[220px] sm:h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }} barGap={2} barCategoryGap="20%">
                  <defs>
                    <linearGradient id="barGold" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FFB433" stopOpacity={1} />
                      <stop offset="100%" stopColor="#e6a02e" stopOpacity={0.6} />
                    </linearGradient>
                    <linearGradient id="barGoldLight" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FFB433" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#e6a02e" stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#4b5563" }}
                    dy={8}
                    interval="preserveStartEnd"
                    minTickGap={20}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: "#4b5563" }}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,180,51,0.05)', radius: 4 }} />
                  <Bar
                    dataKey="revenue"
                    fill="url(#barGold)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={14}
                  />
                  <Bar
                    dataKey="sales"
                    fill="url(#barGoldLight)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={14}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </div>

        {/* ═══════════ EMAIL PERFORMANCE ═══════════ */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.5 }}
          className="rounded-xl border border-border/15 p-4 sm:p-6 bg-card mt-2"
        >
          <div className="flex items-center gap-2 mb-4">
            <Mail className="w-4 h-4 text-muted-foreground/50" />
            <h2 className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-[0.12em]">Email Performance</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Campaigns Sent", value: emailPerf?.totalCampaigns || 0 },
              { label: "Emails Sent", value: (emailPerf?.totalSent || 0).toLocaleString() },
              { label: "Avg Open Rate", value: `${(emailPerf?.avgOpenRate || 0).toFixed(1)}%` },
              { label: "Avg Click Rate", value: `${(emailPerf?.avgClickRate || 0).toFixed(1)}%` },
            ].map((item, idx) => (
              <div key={item.label} className="p-3 sm:p-4 rounded-xl border border-border/15 bg-card">
                <p className="text-[10px] text-muted-foreground/50 uppercase tracking-[0.1em] mb-2">{item.label}</p>
                <p className="text-xl sm:text-2xl font-semibold text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ═══════════ FUNNEL + ACTIVITY ═══════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 pt-2">
          {/* Conversion Funnel */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55, duration: 0.5 }}
            className="rounded-2xl border border-border/15 p-5 sm:p-7 bg-card"
          >
            <div className="flex items-center justify-between mb-6 sm:mb-8">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#FFB433] to-[#e6a02e] flex items-center justify-center shadow-lg shadow-[#FFB433]/20">
                  <TrendingUp className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-bold text-foreground uppercase tracking-wider">Conversion Funnel</h2>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Lead → Conversion pipeline</p>
                </div>
              </div>
              <div className="px-3.5 py-2 rounded-2xl bg-[#FFB433]/10 border border-[#FFB433]/20 shadow-lg shadow-[#FFB433]/5">
                <span className="text-sm font-black bg-gradient-to-r from-[#FFB433] to-[#ffc85c] bg-clip-text text-transparent">
                  {stats?.totalContacts && stats.totalContacts > 0
                    ? ((stats.purchased50kCount / stats.totalContacts) * 100).toFixed(1)
                    : "0"}%
                </span>
              </div>
            </div>

            <div className="space-y-5">
              {funnelData.map((step, idx) => {
                const maxVal = funnelData[0].value || 1;
                const pct = (step.value / maxVal) * 100;
                const convRate =
                  idx > 0 && funnelData[idx - 1].value > 0
                    ? ((step.value / funnelData[idx - 1].value) * 100).toFixed(1)
                    : null;
                const isLast = idx === funnelData.length - 1;
                return (
                  <div key={step.name}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: step.color }} />
                        <span className="text-sm font-semibold text-foreground">{step.name}</span>
                        {convRate && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/30 border border-border/15 text-muted-foreground font-bold">
                            {convRate}%
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-black text-foreground">{step.value}</span>
                    </div>
                    <div className={`w-full rounded-full h-7 overflow-hidden ${isLast ? "bg-[#FFB433]/10" : "bg-muted/30"}`}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(pct, 4)}%` }}
                        transition={{ duration: 1.2, delay: 0.6 + idx * 0.15, ease: [0.25, 0.46, 0.45, 0.94] }}
                        className={`h-full rounded-full flex items-center pl-3 bg-gradient-to-r ${step.gradient} ${isLast ? "shadow-lg shadow-[#8b5cf6]/20" : ""}`}
                      >
                        {pct > 15 && (
                          <span className="text-xs font-black text-white/90 drop-shadow">
                            {pct.toFixed(0)}%
                          </span>
                        )}
                      </motion.div>
                    </div>
                    {idx < funnelData.length - 1 && (
                      <div className="flex justify-center my-1">
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/20 rotate-90" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Activity Feed — Timeline style */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="rounded-2xl border border-border/15 p-5 sm:p-7 bg-card mb-2"
          >
            <div className="flex items-center justify-between mb-5 sm:mb-6">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center shadow-lg">
                  <Activity className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-xs sm:text-sm font-bold text-foreground uppercase tracking-wider">Live Activity</h2>
              </div>
              <span className="text-[11px] text-muted-foreground font-bold px-3 py-1.5 rounded-full bg-muted/20 border border-border/15">
                {activityFeed.length} events
              </span>
            </div>

            {activityFeed.length === 0 ? (
              <div className="text-center py-14">
                <div className="w-14 h-14 rounded-full bg-muted/20 flex items-center justify-center mx-auto mb-4">
                  <Activity className="w-7 h-7 text-muted-foreground/20" />
                </div>
                <p className="text-sm text-muted-foreground">No recent activity</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Events from webhooks and emails will appear here.</p>
              </div>
            ) : (
              <div className="space-y-0.5 max-h-[420px] overflow-y-auto scrollbar-none">
                {activityFeed.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.65 + idx * 0.04, duration: 0.35 }}
                    className="flex items-start gap-3 sm:gap-4 px-2.5 sm:px-4 py-3 sm:py-3.5 rounded-2xl hover:bg-muted/20 transition-colors duration-200 group"
                  >
                    {/* Timeline dot + line */}
                    <div className="relative flex flex-col items-center pt-0.5">
                      <div
                        className={`w-3 h-3 rounded-full flex-shrink-0 ring-4 ring-card/80 ${
                          item.type === "webhook"
                            ? "bg-blue-400"
                            : "bg-emerald-400"
                        }`}
                      />
                      {idx < activityFeed.length - 1 && (
                        <div className="w-px h-8 bg-border/30 mt-1" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 -mt-0.5">
                      <p className="text-sm text-foreground leading-snug">
                        <span className="font-bold capitalize">{item.source}</span>
                        <span className="text-muted-foreground"> · {item.event || "event"}</span>
                      </p>
                      {item.email && item.email !== "—" && (
                        <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{item.email}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground/50 mt-1">
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                        <span className="text-muted-foreground/30 ml-1.5">
                          {new Date(item.created_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true, day: "numeric", month: "short" })}
                        </span>
                      </p>
                    </div>

                    <span
                      className={`flex-shrink-0 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        item.status === "processed"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : item.status === "error"
                          ? "bg-red-500/10 text-red-400"
                          : "bg-muted/20 text-muted-foreground"
                      }`}
                    >
                      {item.status || "received"}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* ═══════════ SEQUENCE PERFORMANCE ═══════════ */}
        <SequencePerformance />

        {/* ═══════════ CAMPAIGN → HIGHER TICKET ATTRIBUTION ═══════════ */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="rounded-xl border border-border/15 bg-card overflow-hidden"
        >
          <div className="p-4 sm:p-5 border-b border-border/10">
            <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.12em] mb-1">Campaign Attribution</p>
            <p className="text-sm font-semibold text-foreground">Which campaign generated what revenue</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/10">
                  <th className="text-left px-4 py-2.5 text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">Campaign</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">Leads</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">Paid ₹299</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">Higher Ticket</th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                {(stats?.campaignAttribution || []).slice(0, 8).map((c: any) => (
                  <tr key={c.name} className="hover:bg-primary/[0.02] transition-colors">
                    <td className="px-4 py-3 text-xs font-medium text-foreground max-w-[200px] truncate" title={c.name}>{c.name}</td>
                    <td className="px-3 py-3 text-right text-xs text-muted-foreground">{c.leads}</td>
                    <td className="px-3 py-3 text-right text-xs text-emerald-400">{c.paid299}</td>
                    <td className="px-3 py-3 text-right text-xs font-semibold text-primary">{c.higherTicket}</td>
                    <td className="px-4 py-3 text-right text-xs font-semibold text-foreground">₹{c.revenue.toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* ═══════════ COHORT ANALYSIS ═══════════ */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85 }}
          className="rounded-xl border border-border/15 bg-card overflow-hidden mt-2"
        >
          <div className="p-4 sm:p-5 border-b border-border/10">
            <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.12em] mb-1">Weekly Cohort Analysis</p>
            <p className="text-sm font-semibold text-foreground">How each week's leads are converting</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/10">
                  <th className="text-left px-4 py-2.5 text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">Week</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">Leads</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">Paid ₹299</th>
                  <th className="text-right px-3 py-2.5 text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">Higher Ticket</th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-medium text-muted-foreground/40 uppercase tracking-wider">Conv %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                {(stats?.cohorts || []).map((c: any, i: number) => (
                  <tr key={i} className="hover:bg-primary/[0.02] transition-colors">
                    <td className="px-4 py-3 text-xs font-medium text-foreground whitespace-nowrap">{c.week}</td>
                    <td className="px-3 py-3 text-right text-xs text-muted-foreground">{c.leads}</td>
                    <td className="px-3 py-3 text-right text-xs text-emerald-400">{c.paid}</td>
                    <td className="px-3 py-3 text-right text-xs font-semibold text-primary">{c.higherTicket}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-xs font-semibold ${parseFloat(c.convRate) > 15 ? 'text-emerald-400' : parseFloat(c.convRate) > 5 ? 'text-primary' : 'text-muted-foreground'}`}>
                        {c.convRate}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* ═══════════ HIGHER TICKET JOURNEYS ═══════════ */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="rounded-xl border border-border/15 bg-card overflow-hidden mt-2"
        >
          <div className="p-4 sm:p-5 border-b border-border/10">
            <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.12em] mb-1">Higher Ticket Journeys</p>
            <p className="text-sm font-semibold text-foreground">Full path: Lead → ₹299 → Call → Higher Ticket</p>
          </div>
          <div className="divide-y divide-border/10">
            {(stats?.higherTicketJourneys || []).slice(0, 10).map((j: any, i: number) => {
              const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" }) : null;
              const fmtTime = (d: string | null) => d ? new Date(d).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }) : null;
              return (
                <div key={i} className="p-4 hover:bg-primary/[0.02] transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">{j.name}</p>
                      <p className="text-[10px] text-muted-foreground/40 mt-0.5">{j.campaign} · {j.creative}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-primary">₹{j.amount.toLocaleString("en-IN")}</p>
                      <p className="text-[10px] text-muted-foreground/40">{j.program}</p>
                    </div>
                  </div>
                  {/* Timeline */}
                  <div className="flex items-center gap-1 text-[10px] flex-wrap">
                    <span className="px-2 py-0.5 rounded bg-muted/20 text-muted-foreground">Lead {fmtDate(j.created) || '—'}</span>
                    <span className="text-muted-foreground/20">→</span>
                    <span className={`px-2 py-0.5 rounded ${j.paid299At ? 'bg-emerald-500/10 text-emerald-400' : 'bg-muted/10 text-muted-foreground/30'}`}>
                      ₹299 {fmtDate(j.paid299At) || '—'}
                    </span>
                    <span className="text-muted-foreground/20">→</span>
                    <span className={`px-2 py-0.5 rounded ${j.calledAt ? 'bg-amber-500/10 text-amber-400' : 'bg-muted/10 text-muted-foreground/30'}`}>
                      Call {fmtDate(j.calledAt) || '—'}
                    </span>
                    <span className="text-muted-foreground/20">→</span>
                    <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">
                      Converted {fmtDate(j.convertedAt)} {fmtTime(j.convertedAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}

function SequencePerformance() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ["dash-seq-perf"],
    queryFn: async () => {
      const [seqRes, stepsRes, enrollRes, logRes] = await Promise.all([
        supabase.from("automation_sequences").select("id, name, status").order("created_at", { ascending: false }).limit(5),
        supabase.from("automation_sequence_steps").select("id, sequence_id"),
        supabase.from("automation_sequence_enrollments").select("sequence_id, status"),
        supabase.from("automation_email_log").select("step_id, status"),
      ]);
      const sequences = seqRes.data || [];
      const steps = stepsRes.data || [];
      const enrolls = enrollRes.data || [];
      const logs = logRes.data || [];

      const stepSeqMap: Record<string, string> = {};
      steps.forEach((s: any) => { stepSeqMap[s.id] = s.sequence_id; });

      return sequences.map((seq: any) => {
        const seqSteps = steps.filter((s: any) => s.sequence_id === seq.id);
        const seqEnrolls = enrolls.filter((e: any) => e.sequence_id === seq.id);
        const seqLogs = logs.filter((l: any) => stepSeqMap[l.step_id] === seq.id);
        const sent = seqLogs.length;
        const opened = seqLogs.filter((l: any) => l.status === "opened" || l.status === "clicked").length;
        const completed = seqEnrolls.filter((e: any) => e.status === "completed").length;
        return {
          id: seq.id,
          name: seq.name,
          status: seq.status,
          steps: seqSteps.length,
          enrolled: seqEnrolls.length,
          completed,
          openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
        };
      });
    },
  });

  const rows = data || [];
  if (rows.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.7, duration: 0.5 }}
      className="rounded-2xl border border-border/15 p-4 sm:p-7 bg-card"
    >
      <div className="flex items-center justify-between mb-5 sm:mb-6">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-xs sm:text-sm font-bold text-foreground uppercase tracking-wider">Sequence Performance</h2>
        </div>
        <motion.button
          whileHover={{ x: 3 }}
          onClick={() => navigate("/sequences")}
          className="text-xs text-[#FFB433] hover:text-[#ffc85c] font-bold flex items-center gap-1.5 transition-colors"
        >
          View all <ArrowRight className="w-3.5 h-3.5" />
        </motion.button>
      </div>
      <div className="overflow-x-auto -mx-1 sm:mx-0">
        <table className="w-full text-xs sm:text-sm min-w-[500px]">
          <thead>
            <tr className="border-b border-border/30">
              {["Sequence", "Emails", "Enrolled", "Completed", "Open Rate", "Status"].map(h => (
                <th key={h} className="text-left py-3 px-4 text-[10px] font-black text-muted-foreground/60 uppercase tracking-[0.12em]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row: any, idx: number) => (
              <motion.tr
                key={row.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.75 + idx * 0.05 }}
                onClick={() => navigate("/sequences")}
                className={`border-b border-border/20 last:border-0 hover:bg-muted/20 cursor-pointer transition-colors duration-200 ${
                  idx % 2 === 0 ? "bg-muted/10" : ""
                }`}
              >
                <td className="py-4 px-4 font-bold text-foreground">{row.name}</td>
                <td className="py-4 px-4 text-muted-foreground">{row.steps}</td>
                <td className="py-4 px-4 text-muted-foreground">{row.enrolled}</td>
                <td className="py-4 px-4 text-muted-foreground">{row.completed}</td>
                <td className="py-4 px-4">
                  <span className={`font-black ${row.openRate > 0 ? "text-emerald-400" : "text-muted-foreground/30"}`}>{row.openRate}%</span>
                </td>
                <td className="py-4 px-4">
                  <span className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                    row.status === "active"
                      ? "bg-emerald-500/10 text-emerald-400 shadow-sm shadow-emerald-500/10"
                      : "bg-muted/20 text-muted-foreground"
                  }`}>
                    {row.status}
                  </span>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
