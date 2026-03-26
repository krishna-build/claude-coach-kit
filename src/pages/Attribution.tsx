import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import Layout from "@/components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import { lazy, Suspense } from "react";
const IndiaMap = lazy(() => import("@/components/IndiaMap"));
import {
  Target,
  Users,
  CreditCard,
  IndianRupee,
  TrendingUp,
  Trophy,
  ChevronDown,
  ChevronRight,
  Search,
  Filter,
  Monitor,
  Smartphone,
  MapPin,
  Calendar,
  Mail,
  Phone,
  Clock,
  ArrowUpRight,
  BarChart3,
  Eye,
  Loader2,
  MousePointerClick,
  Sparkles,
  X,
  RefreshCw,
  BadgeCheck,
  UserCheck,
  ShoppingBag,
  Zap,
  ArrowLeft,
  Home,
  Download,
  Layers,
  User,
} from "lucide-react";
import CustomerJourneyModal from "@/components/CustomerJourneyModal";
import {
  AreaChart,
  ComposedChart,
  Line,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { format, subDays, isAfter, isBefore, startOfDay, endOfDay, parseISO } from "date-fns";

// ─── Animation Variants ──────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const rowVariants = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3 } },
};

// ─── Types ────────────────────────────────────────────────────
interface UtmVisitor {
  visitor_id: string;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  city: string | null;
  region: string | null;
  device: string | null;
  age_group: string | null;
  created_at: string;
  razorpay_payment_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  amount: number | null;
  payment_status: string | null;
  matched_at: string | null;
}

interface AdGroupData {
  adName: string;
  campaignName: string;
  visitors: number;
  payments: number;
  revenue: number;
  conversionRate: number;
  topCity: string;
  customers: UtmVisitor[];
}

// ─── Date Range Options ───────────────────────────────────────
type DateRange = "7d" | "30d" | "90d" | "all" | "custom";
type ViewMode = "all" | "paid" | "unpaid";
type TabMode = "visitors" | "by-creative";

const dateRangeOptions: { value: DateRange; label: string }[] = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "all", label: "All Time" },
  { value: "custom", label: "Custom" },
];

// ─── Component ────────────────────────────────────────────────

export default function Attribution() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [customStartDate, setCustomStartDate] = useState<string>(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [customEndDate, setCustomEndDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [campaignFilter, setCampaignFilter] = useState<string>("all");
  const [cityFilter, setCityFilter] = useState<string>("all");
  const [deviceFilter, setDeviceFilter] = useState<string>("all");
  const [expandedAd, setExpandedAd] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [buyersSearch, setBuyersSearch] = useState("");
  const [buyersSortBy, setBuyersSortBy] = useState<"date" | "amount">("date");
  const [selectedVisitor, setSelectedVisitor] = useState<any | null>(null);

  const [tabMode, setTabMode] = useState<TabMode>("visitors");
  const [expandedCreative, setExpandedCreative] = useState<string | null>(null);

  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [tick, setTick] = useState(0);

  // Ticker to keep "synced X ago" text fresh
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 10_000);
    return () => clearInterval(timer);
  }, []);

  // ─── Fetch all utm_visitors (auto-syncs every 60s) ──────────
  const { data: visitors, isLoading, isFetching } = useQuery({
    queryKey: ["attribution-visitors"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("utm_visitors")
        .select("id,visitor_id,utm_source,utm_medium,utm_campaign,utm_content,utm_term,city,region,device,age_group,created_at,payment_status,customer_name,customer_email,customer_phone,amount,matched_at,razorpay_payment_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setLastSyncTime(new Date());
      return (data || []) as UtmVisitor[];
    },
    staleTime: 60_000,
    refetchInterval: 60_000,        // auto-refresh every 60 seconds
    refetchIntervalInBackground: false,
  });

  // Track syncing state
  useEffect(() => {
    setIsSyncing(isFetching);
  }, [isFetching]);

  // ─── Fetch ad lookup for ID→name resolution ─────────────────
  const { data: adLookup } = useQuery({
    queryKey: ["ad-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ad_lookup").select("*");
      if (error) console.error("ad_lookup error:", error);
      const map: Record<string, { ad_name: string; campaign_name: string; adset_name: string }> = {};
      (data || []).forEach((r: any) => { map[r.ad_id] = { ad_name: r.ad_name, campaign_name: r.campaign_name, adset_name: r.adset_name }; });
      return map;
    },
    staleTime: 300_000,
    refetchInterval: 300_000,       // auto-refresh ad lookup every 5 mins
  });

  // ─── Fetch campaign lookup for campaign_id → name resolution ──
  const { data: campaignLookup } = useQuery({
    queryKey: ["campaign-lookup"],
    queryFn: async () => {
      const { data, error } = await supabase.from("campaign_lookup").select("*");
      if (error) console.error("campaign_lookup error:", error);
      const map: Record<string, string> = {};
      (data || []).forEach((r: any) => { map[r.campaign_id] = r.campaign_name; });
      return map;
    },
    staleTime: 300_000,
    refetchInterval: 300_000,
  });

  // ─── Fetch age/gender breakdown from Meta Ads API ────────────
  const PROXY_URL = "https://YOUR_SUPABASE_REF.supabase.co/functions/v1/meta-ads-proxy";
  const PROXY_KEY = "YOUR_SUPABASE_KEY";

  const { data: ageBreakdownRaw } = useQuery({
    queryKey: ["age-breakdown-v2"],
    queryFn: async () => {
      const res = await fetch(`${PROXY_URL}?breakdowns=age,gender&date_preset=last_7d`, {
        headers: { Authorization: `Bearer ${PROXY_KEY}` },
      });
      const json = await res.json();
      // Index by ad_id for reliable lookup
      const mapById: Record<string, any> = {};
      // Also index by normalized name for fuzzy fallback
      const mapByName: Record<string, any> = {};
      (json.breakdown || []).forEach((r: any) => {
        if (r.ad_id) mapById[r.ad_id] = r;
        if (r.ad_name) {
          // Normalize: lowercase, collapse spaces, strip date suffix (everything after last |)
          const normalized = r.ad_name.toLowerCase().replace(/\s+/g, " ").split("|")[0].trim();
          mapByName[normalized] = r;
        }
      });
      return { byId: mapById, byName: mapByName };
    },
    staleTime: 600_000,      // cache 10 mins
    refetchInterval: 600_000,
  });

  // ─── Deduplicate + resolve ad names ─────────────────────────
  const dedupedVisitors = useMemo(() => {
    if (!visitors) return [];
    // Step 1: Dedup by visitor_id (keep richest entry)
    const byVisitor: Record<string, UtmVisitor> = {};
    visitors.forEach((v) => {
      const existing = byVisitor[v.visitor_id];
      if (!existing || (v.city && !existing.city) || (v.payment_status && !existing.payment_status)) {
        byVisitor[v.visitor_id] = v;
      }
    });
    // Step 2: Dedup by razorpay_payment_id (prevent same payment showing twice)
    const byPayment: Record<string, boolean> = {};
    const uniqueVisitors: UtmVisitor[] = [];
    Object.values(byVisitor).forEach((v) => {
      if (v.razorpay_payment_id) {
        if (byPayment[v.razorpay_payment_id]) return; // skip duplicate payment
        byPayment[v.razorpay_payment_id] = true;
      }
      uniqueVisitors.push(v);
    });
    return uniqueVisitors.map((v) => {
      let resolved = { ...v };

      // Resolve utm_content (ad name) from ad_lookup if it's a numeric ID
      if (resolved.utm_content && /^\d+$/.test(resolved.utm_content) && adLookup?.[resolved.utm_content]) {
        const lookup = adLookup[resolved.utm_content];
        resolved.utm_content = lookup.ad_name;
        resolved.utm_campaign = lookup.campaign_name || resolved.utm_campaign;
        resolved.utm_term = lookup.adset_name || resolved.utm_term;
      }

      // Resolve utm_campaign if it's still a numeric campaign ID
      if (resolved.utm_campaign && /^\d+$/.test(resolved.utm_campaign) && campaignLookup?.[resolved.utm_campaign]) {
        resolved.utm_campaign = campaignLookup[resolved.utm_campaign];
      }

      return resolved;
    });
  }, [visitors, adLookup, campaignLookup]);

  // ─── Filter visitors (date + campaign + city + device) ──────
  const baseFiltered = useMemo(() => {
    if (!dedupedVisitors) return [];
    let result = [...dedupedVisitors];

    if (dateRange === "custom") {
      const start = startOfDay(parseISO(customStartDate));
      const end = endOfDay(parseISO(customEndDate));
      result = result.filter((v) => {
        const d = new Date(v.created_at);
        return d >= start && d <= end;
      });
    } else if (dateRange !== "all") {
      const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
      const cutoff = subDays(new Date(), days);
      result = result.filter((v) => isAfter(new Date(v.created_at), cutoff));
    }

    if (campaignFilter !== "all") result = result.filter((v) => v.utm_campaign === campaignFilter);
    if (cityFilter !== "all") result = result.filter((v) => v.city === cityFilter);
    if (deviceFilter !== "all") {
      result = result.filter((v) => {
        const d = (v.device || "").toLowerCase();
        if (deviceFilter === "mobile") return d.includes("mobile") || d.includes("android") || d.includes("iphone") || d.includes("ios");
        if (deviceFilter === "desktop") return d.includes("desktop") || d.includes("windows") || d.includes("mac") || d.includes("linux") || (!d.includes("mobile") && !d.includes("android") && !d.includes("iphone") && !d.includes("ios") && d.length > 0);
        return true;
      });
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (v) =>
          (v.customer_name || "").toLowerCase().includes(term) ||
          (v.customer_email || "").toLowerCase().includes(term) ||
          (v.utm_content || "").toLowerCase().includes(term) ||
          (v.utm_campaign || "").toLowerCase().includes(term) ||
          (v.city || "").toLowerCase().includes(term)
      );
    }

    return result;
  }, [dedupedVisitors, dateRange, customStartDate, customEndDate, campaignFilter, cityFilter, deviceFilter, searchTerm]);

  // ─── Apply view mode filter ──────────────────────────────────
  const filteredVisitors = useMemo(() => {
    if (viewMode === "paid") return baseFiltered.filter((v) => v.payment_status === "captured");
    if (viewMode === "unpaid") return baseFiltered.filter((v) => v.payment_status !== "captured");
    return baseFiltered;
  }, [baseFiltered, viewMode]);

  // ─── Paid buyers list ────────────────────────────────────────
  const paidBuyers = useMemo(() => {
    const buyers = baseFiltered.filter((v) => v.payment_status === "captured");
    if (buyersSearch.trim()) {
      const term = buyersSearch.toLowerCase();
      return buyers.filter(
        (v) =>
          (v.customer_name || "").toLowerCase().includes(term) ||
          (v.customer_email || "").toLowerCase().includes(term) ||
          (v.customer_phone || "").toLowerCase().includes(term) ||
          (v.utm_content || "").toLowerCase().includes(term) ||
          (v.city || "").toLowerCase().includes(term)
      );
    }
    return buyers.sort((a, b) => {
      if (buyersSortBy === "amount") return (b.amount || 0) - (a.amount || 0);
      return new Date(b.matched_at || b.created_at).getTime() - new Date(a.matched_at || a.created_at).getTime();
    });
  }, [baseFiltered, buyersSearch, buyersSortBy]);

  // ─── Compute stats (exclude historical from visitor counts) ──
  const stats = useMemo(() => {
    const realVisitors = baseFiltered.filter((v) => !v.visitor_id.startsWith("hist_"));
    const total = realVisitors.length;
    const paid = realVisitors.filter((v) => v.payment_status === "captured");
    const totalPayments = paid.length;
    const totalRevenue = paid.reduce((sum, v) => sum + (v.amount || 0), 0);
    const conversionRate = total > 0 ? (totalPayments / total) * 100 : 0;

    const adRevMap: Record<string, number> = {};
    paid.forEach((v) => {
      const ad = v.utm_content || "Direct / Unknown";
      adRevMap[ad] = (adRevMap[ad] || 0) + (v.amount || 0);
    });
    let bestAd = "—";
    let bestAdRevenue = 0;
    Object.entries(adRevMap).forEach(([ad, rev]) => {
      if (rev > bestAdRevenue) { bestAd = ad; bestAdRevenue = rev; }
    });

    return { total, totalPayments, totalRevenue, conversionRate, bestAd, bestAdRevenue };
  }, [baseFiltered]);

  // ─── Group by ad ────────────────────────────────────────────
  const adGroups = useMemo(() => {
    const groups: Record<string, AdGroupData> = {};
    filteredVisitors.forEach((v) => {
      const adName = v.utm_content || "Direct / Unknown";
      const isHistorical = v.visitor_id.startsWith("hist_");
      if (!groups[adName]) {
        groups[adName] = { adName, campaignName: v.utm_campaign || "—", visitors: 0, payments: 0, revenue: 0, conversionRate: 0, topCity: "", customers: [] };
      }
      if (!isHistorical) {
        groups[adName].visitors++;
        if (v.payment_status === "captured") {
          groups[adName].payments++;
          groups[adName].revenue += v.amount || 0;
        }
      }
      groups[adName].customers.push(v);
    });

    Object.values(groups).forEach((g) => {
      g.conversionRate = g.visitors > 0 ? (g.payments / g.visitors) * 100 : 0;
      const cityCount: Record<string, number> = {};
      g.customers.forEach((c) => { const city = c.city || "Unknown"; cityCount[city] = (cityCount[city] || 0) + 1; });
      g.topCity = Object.entries(cityCount).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
    });

    return Object.values(groups).sort((a, b) => b.revenue - a.revenue);
  }, [filteredVisitors]);

  // ─── Meta Ads spend map (ad_id → spend) ─────────────────────
  const { data: spendMap } = useQuery({
    queryKey: ["meta-spend-map", dateRange, customStartDate, customEndDate],
    queryFn: async () => {
      const since = dateRange === "custom" ? customStartDate
        : format(subDays(new Date(), dateRange === "7d" ? 7 : dateRange === "90d" ? 90 : 30), "yyyy-MM-dd");
      const until = dateRange === "custom" ? customEndDate : format(new Date(), "yyyy-MM-dd");
      const res = await fetch(
        `${PROXY_URL}?since=${since}&until=${until}&level=ad`,
        { headers: { Authorization: `Bearer ${PROXY_KEY}` } }
      );
      const json = await res.json();
      // Build map: ad_id → spend
      const map: Record<string, number> = {};
      (json.ads || []).forEach((r: any) => { if (r.ad_id) map[r.ad_id] = (map[r.ad_id] || 0) + r.spend; });
      return map;
    },
    staleTime: 600_000,
  });

  // ─── Lost leads query ────────────────────────────────────────
  const { data: lostLeads } = useQuery({
    queryKey: ["lost-leads"],
    queryFn: async () => {
      const since = format(subDays(new Date(), 7), "yyyy-MM-dd") + "T00:00:00Z";
      const until = format(subDays(new Date(), 0), "yyyy-MM-dd") + "T" +
        new Date(Date.now() - 2 * 3600000).toISOString().slice(11); // 2h ago
      const { data, error } = await supabase
        .from("utm_visitors")
        .select("id,city,utm_content,utm_campaign,created_at,visitor_id")
        .is("payment_status", null)
        .not("utm_content", "is", null)
        .gt("created_at", since)
        .lt("created_at", until)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as UtmVisitor[];
    },
    staleTime: 300_000,
    refetchInterval: 300_000,
  });

  // ─── Group lost leads by ad + city ───────────────────────────
  const lostLeadsGroups = useMemo(() => {
    if (!lostLeads || !adLookup) return [];
    const groups: Record<string, { adName: string; city: string; count: number; sample: UtmVisitor[] }> = {};
    lostLeads.forEach(v => {
      const rawContent = v.utm_content || "Unknown";
      const adName = adLookup[rawContent]?.ad_name || rawContent;
      const city = v.city || "Unknown city";
      const key = `${adName}::${city}`;
      if (!groups[key]) groups[key] = { adName, city, count: 0, sample: [] };
      groups[key].count++;
      if (groups[key].sample.length < 5) groups[key].sample.push(v);
    });
    return Object.values(groups).filter(g => g.count >= 3).sort((a, b) => b.count - a.count).slice(0, 10);
  }, [lostLeads, adLookup]);

  // ─── Leads (form fills) per ad ──────────────────────────────
  const { data: leadsMap } = useQuery({
    queryKey: ["attribution-leads"],
    queryFn: async () => {
      const { data } = await supabase.from("automation_contacts").select("utm_content");
      const map: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        const key = (r.utm_content || "").trim();
        if (key) map[key] = (map[key] || 0) + 1;
      });
      return map;
    },
    staleTime: 300_000,
    refetchInterval: 300_000,
  });

  // ─── Heatmap: visitors/conversions by IST hour × day ────────
  // AUDIT FIX: Exclude hist_ records from visitor heatmap counts for consistency
  const heatmapData = useMemo(() => {
    const IST_OFFSET = 330; // +5:30 in minutes
    const visitGrid: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));
    const paidGrid: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));
    filteredVisitors.forEach((v) => {
      if (!v.created_at) return;
      const isHistorical = v.visitor_id.startsWith("hist_");
      const d = new Date(new Date(v.created_at).getTime() + IST_OFFSET * 60000);
      if (!isHistorical) {
        visitGrid[d.getDay()][d.getHours()]++;
      }
      if (v.payment_status === "captured") paidGrid[d.getDay()][d.getHours()]++;
    });
    const maxVisit = Math.max(...visitGrid.flat(), 1);
    const maxPaid = Math.max(...paidGrid.flat(), 1);
    return { visitGrid, paidGrid, maxVisit, maxPaid };
  }, [filteredVisitors]);

  // ─── City × conversion insights ─────────────────────────────
  // AUDIT FIX: Exclude hist_ records from city visitor counts for consistency with stats
  const cityInsights = useMemo(() => {
    const cityMap: Record<string, { visitors: number; paid: number; revenue: number }> = {};
    filteredVisitors.forEach((v) => {
      const city = v.city?.trim();
      if (!city) return;
      const isHistorical = v.visitor_id.startsWith("hist_");
      // Normalize city names (merge Bangalore/Bengaluru, etc.)
      const normalizedCity = city === "Bengaluru" ? "Bangalore" : city;
      if (!cityMap[normalizedCity]) cityMap[normalizedCity] = { visitors: 0, paid: 0, revenue: 0 };
      if (!isHistorical) {
        cityMap[normalizedCity].visitors++;
      }
      if (v.payment_status === "captured" && !isHistorical) {
        cityMap[normalizedCity].paid++;
        cityMap[normalizedCity].revenue += v.amount || 0;
      }
    });
    // AUDIT FIX: Filter out cities with 0 real visitors (all were hist_) and use >= 2 threshold
    return Object.entries(cityMap)
      .filter(([, v]) => v.visitors >= 2 || v.paid > 0)
      .map(([city, s]) => ({ city, ...s, convRate: s.visitors > 0 ? Math.min((s.paid / s.visitors) * 100, 100) : 0 }))
      .sort((a, b) => b.paid - a.paid || b.visitors - a.visitors)
      .slice(0, 12);
  }, [filteredVisitors]);

  // ─── Chart data ─────────────────────────────────────────────
  const chartData = useMemo(() => {
    let days: number;
    if (dateRange === "custom") {
      const diff = Math.ceil((parseISO(customEndDate).getTime() - parseISO(customStartDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
      days = Math.max(diff, 1);
    } else {
      days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : dateRange === "90d" ? 90 : 60;
    }
    const data: { date: string; visitors: number; payments: number }[] = [];
    const endPoint = dateRange === "custom" ? endOfDay(parseISO(customEndDate)) : new Date();

    for (let i = days - 1; i >= 0; i--) {
      const day = subDays(endPoint, i);
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);
      const label = format(day, days <= 14 ? "MMM dd" : "dd");
      let visitorsCount = 0;
      let paymentsCount = 0;
      baseFiltered.forEach((v) => {
        const created = new Date(v.created_at);
        if (created >= dayStart && created <= dayEnd) {
          if (!v.visitor_id.startsWith("hist_")) visitorsCount++;
          if (v.payment_status === "captured") paymentsCount++;
        }
      });
      data.push({ date: label, visitors: visitorsCount, payments: paymentsCount });
    }
    return data;
  }, [baseFiltered, dateRange, customStartDate, customEndDate]);

  // ─── Unique campaigns, cities ──────────────────────────────
  const uniqueCampaigns = useMemo(() => {
    if (!visitors) return [];
    const set = new Set<string>();
    visitors.forEach((v) => { if (v.utm_campaign) set.add(v.utm_campaign); });
    return Array.from(set).sort();
  }, [visitors]);

  const uniqueCities = useMemo(() => {
    if (!visitors) return [];
    const set = new Set<string>();
    visitors.forEach((v) => { if (v.city) set.add(v.city); });
    return Array.from(set).sort();
  }, [visitors]);

  // ─── Custom Tooltip ─────────────────────────────────────────
  const ChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border/50 rounded-xl p-3 shadow-xl backdrop-blur-xl">
          <p className="text-xs font-semibold text-foreground mb-1.5">{label}</p>
          {payload.map((p: any) => (
            <div key={p.dataKey} className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="text-muted-foreground capitalize">{p.dataKey}:</span>
              <span className="font-semibold text-foreground">{p.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // ─── Stat Cards ─────────────────────────────────────────────
  const statCards = [
    { label: "Total Visitors", value: stats.total.toLocaleString("en-IN"), icon: Eye, gradient: "from-blue-500/20 to-blue-500/5", iconGradient: "from-blue-500 to-blue-600", accent: "text-blue-400" },
    { label: "Total Payments", value: stats.totalPayments.toLocaleString("en-IN"), icon: CreditCard, gradient: "from-emerald-500/20 to-emerald-500/5", iconGradient: "from-emerald-500 to-emerald-600", accent: "text-emerald-400" },
    { label: "Total Revenue", value: `₹${stats.totalRevenue.toLocaleString("en-IN")}`, icon: IndianRupee, gradient: "from-[#FFB433]/20 to-[#FFB433]/5", iconGradient: "from-[#FFB433] to-[#e6a02e]", accent: "text-primary" },
    { label: "Conversion Rate", value: `${stats.conversionRate.toFixed(1)}%`, icon: TrendingUp, gradient: "from-violet-500/20 to-violet-500/5", iconGradient: "from-violet-500 to-violet-600", accent: "text-violet-400" },
    { label: "Best Performing Ad", value: stats.bestAd.length > 28 ? stats.bestAd.slice(0, 26) + "…" : stats.bestAd, subValue: stats.bestAdRevenue > 0 ? `₹${stats.bestAdRevenue.toLocaleString("en-IN")}` : undefined, icon: Trophy, gradient: "from-amber-500/20 to-amber-500/5", iconGradient: "from-amber-500 to-amber-600", accent: "text-amber-400", small: true },
  ];

  // ─── View mode counts (exclude historical records from ALL counts) ──
  const viewCounts = useMemo(() => {
    const realVisitors = baseFiltered.filter((v) => !v.visitor_id.startsWith("hist_"));
    const paidReal = realVisitors.filter((v) => v.payment_status === "captured").length;
    const unpaidReal = realVisitors.filter((v) => v.payment_status !== "captured").length;
    return { all: realVisitors.length, paid: paidReal, unpaid: unpaidReal };
  }, [baseFiltered]);

  // ─── "By Ad Creative" grouped data ──────────────────────────
  const creativeGroups = useMemo(() => {
    const groups: Record<string, { creative: string; campaign: string; adSet: string; visitors: number; leads: number; paid299: number; revenue: number; customers: UtmVisitor[] }> = {};
    filteredVisitors.forEach((v) => {
      const creative = v.utm_content || "Direct / Unknown";
      const isHistorical = v.visitor_id.startsWith("hist_");
      if (!groups[creative]) {
        groups[creative] = { creative, campaign: v.utm_campaign || "—", adSet: v.utm_term || "—", visitors: 0, leads: 0, paid299: 0, revenue: 0, customers: [] };
      }
      if (!isHistorical) groups[creative].visitors++;
      if (v.payment_status === "captured") {
        groups[creative].paid299++;
        groups[creative].revenue += v.amount || 0;
      }
      groups[creative].customers.push(v);
    });

    // Merge leads count from leadsMap
    Object.values(groups).forEach((g) => {
      const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
      const raw = Object.entries(leadsMap || {}).find(([k]) => normalize(k) === normalize(g.creative))?.[1] || 0;
      g.leads = Math.min(raw, g.visitors);
    });

    return Object.values(groups).sort((a, b) => b.revenue - a.revenue || b.visitors - a.visitors);
  }, [filteredVisitors, leadsMap]);

  // ─── CSV Export Function ────────────────────────────────────
  const exportCSV = () => {
    const headers = ["Name", "Email", "Phone", "Ad Creative", "Campaign", "Ad Set", "City", "Age Group", "Device", "Date", "Payment Status", "Amount", "Razorpay ID"];
    const rows = filteredVisitors.map((v) => [
      v.customer_name || "",
      v.customer_email || "",
      v.customer_phone || "",
      v.utm_content || "",
      v.utm_campaign || "",
      v.utm_term || "",
      v.city || "",
      v.age_group || "",
      v.device || "",
      v.created_at ? format(new Date(v.created_at), "yyyy-MM-dd HH:mm:ss") : "",
      v.payment_status || "not_paid",
      v.amount ? String(v.amount) : "",
      v.razorpay_payment_id || "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `attribution-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ─── Render ─────────────────────────────────────────────────
  return (
    <Layout>
      <div className="space-y-3 md:space-y-6">
        {/* ──── Back Navigation ──── */}
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-4 pb-2"
        >
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border/50 text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-all group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
            <span className="text-sm font-medium hidden sm:inline">Back</span>
          </button>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1 hover:text-primary transition-colors"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>
            <ChevronRight className="w-4 h-4" />
            <div className="flex items-center gap-1.5">
              <Target className="w-4 h-4 text-primary" />
              <span className="font-semibold text-foreground">Attribution</span>
            </div>
          </div>
        </motion.div>

        {/* ──── Header ──── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden bg-gradient-to-br from-card via-card to-primary/5 rounded-2xl border border-border/50 p-4 md:p-8"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-violet-500/5 to-transparent rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />

          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Target className="w-5 h-5 text-primary" />
                <span className="text-xs font-semibold text-primary uppercase tracking-wider">Ad Attribution</span>
              </div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-foreground">
                Attribution <span className="gold-text">Dashboard</span>
              </h1>
              <p className="hidden sm:block text-sm text-muted-foreground mt-1.5 max-w-lg">
                Track every visitor from ad click to payment. See which ads drive real revenue.
              </p>
            </div>

            <div className="flex flex-col gap-3 w-full">
              {/* Mobile: search first on mobile, then sync controls */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Search - full width on mobile */}
                <div className="relative flex-1 sm:flex-none sm:w-72">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search ads, names, cities..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                      <X className="w-4 h-4 text-muted-foreground hover:text-foreground transition-colors" />
                    </button>
                  )}
                </div>

                {/* Sync controls */}
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card/60 border border-border/40 text-xs text-muted-foreground flex-shrink-0">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isSyncing ? "bg-primary animate-pulse" : "bg-green-500"}`} />
                    <span className="hidden sm:inline">{isSyncing ? "Syncing…" : lastSyncTime ? (() => {
                      void tick;
                      const secs = Math.floor((Date.now() - lastSyncTime.getTime()) / 1000);
                      return secs < 60 ? `Synced ${secs}s ago` : `Synced ${Math.floor(secs/60)}m ago`;
                    })() : "Auto-sync ON"}</span>
                    <span className="sm:hidden">{isSyncing ? "Syncing…" : "Live"}</span>
                  </div>
                  <button
                    onClick={async () => {
                      setIsRefreshing(true);
                      await queryClient.invalidateQueries({ queryKey: ["attribution-visitors"] });
                      await queryClient.invalidateQueries({ queryKey: ["ad-lookup"] });
                      await queryClient.refetchQueries({ queryKey: ["attribution-visitors"] });
                      await queryClient.refetchQueries({ queryKey: ["ad-lookup"] });
                      setTimeout(() => setIsRefreshing(false), 500);
                    }}
                    className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl bg-primary/10 border border-primary/30 text-primary text-sm font-semibold hover:bg-primary/20 transition-all flex-shrink-0"
                    disabled={isRefreshing || isSyncing}
                  >
                    <RefreshCw className={`w-4 h-4 ${(isRefreshing || isSyncing) ? "animate-spin" : ""}`} />
                    <span className="hidden sm:inline">{isRefreshing ? "Syncing..." : "Refresh"}</span>
                  </button>
                  <button
                    onClick={exportCSV}
                    className="flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/20 transition-all flex-shrink-0"
                    title="Export filtered data as CSV"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Export CSV</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ──── TAB MODE: Visitors vs By Ad Creative ──── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03, duration: 0.4 }}
          className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none pt-2"
        >
          {[
            { key: "visitors" as TabMode, label: "All Visitors", icon: Users },
            { key: "by-creative" as TabMode, label: "By Ad Creative", icon: Layers },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = tabMode === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setTabMode(tab.key)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all border whitespace-nowrap ${
                  isActive
                    ? "bg-primary/15 border-primary/40 text-primary"
                    : "bg-card border-border/50 text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </motion.div>

        {/* ──── VIEW MODE TABS (always visible) ──── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.4 }}
          className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none pt-2"
        >
          {[
            { key: "all" as ViewMode, label: "All Visitors", shortLabel: "All", icon: Users, count: viewCounts.all, color: "blue" },
            { key: "paid" as ViewMode, label: "₹299 Buyers", shortLabel: "Buyers", icon: BadgeCheck, count: viewCounts.paid, color: "emerald" },
            { key: "unpaid" as ViewMode, label: "Not Converted", shortLabel: "Unpaid", icon: Eye, count: viewCounts.unpaid, color: "muted" },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = viewMode === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setViewMode(tab.key)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-all border whitespace-nowrap ${
                  isActive
                    ? tab.key === "paid"
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                      : tab.key === "all"
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "bg-surface border-border text-foreground"
                    : "bg-card border-border/50 text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded-md font-bold flex-shrink-0 ${
                  isActive
                    ? tab.key === "paid"
                      ? "bg-emerald-500/20 text-emerald-300"
                      : tab.key === "all"
                      ? "bg-primary/20 text-primary"
                      : "bg-muted/50 text-muted-foreground"
                    : "bg-muted/30 text-muted-foreground"
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </motion.div>

        {/* ──── Filters Bar ──── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="bg-card rounded-2xl border border-border/50 p-4 shadow-sm mt-2"
        >
          {/* Single scrollable row: pills + filters button */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-0.5">
            <div className="flex items-center gap-0.5 bg-surface rounded-xl p-1 flex-shrink-0">
              {dateRangeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setDateRange(opt.value)}
                  className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    dateRange === opt.value
                      ? "bg-primary text-black shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                  }`}
                >
                  <span className="hidden sm:inline">{opt.label}</span>
                  <span className="sm:hidden">
                    {opt.value === "7d" ? "7D" : opt.value === "30d" ? "30D" : opt.value === "90d" ? "90D" : opt.value === "all" ? "All" : "Custom"}
                  </span>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                showFilters ? "bg-primary/10 border-primary/30 text-primary" : "bg-surface border-border/50 text-muted-foreground hover:text-foreground hover:bg-surface-hover"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              Filters
              {(campaignFilter !== "all" || cityFilter !== "all" || deviceFilter !== "all") && (
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              )}
            </button>
          </div>
          {dateRange === "custom" && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <input type="date" value={customStartDate} onChange={(e) => setCustomStartDate(e.target.value)} className="px-3 py-1.5 rounded-lg text-xs bg-surface border border-border/50 text-foreground" />
              <span className="text-xs text-muted-foreground">to</span>
              <input type="date" value={customEndDate} onChange={(e) => setCustomEndDate(e.target.value)} className="px-3 py-1.5 rounded-lg text-xs bg-surface border border-border/50 text-foreground" />
            </div>
          )}

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-4 mt-4 border-t border-border/30">
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Campaign</label>
                    <select value={campaignFilter} onChange={(e) => setCampaignFilter(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-surface border border-border/50 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40">
                      <option value="all">All Campaigns</option>
                      {uniqueCampaigns.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">City</label>
                    <select value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-surface border border-border/50 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40">
                      <option value="all">All Cities</option>
                      {uniqueCities.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Device</label>
                    <select value={deviceFilter} onChange={(e) => setDeviceFilter(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-surface border border-border/50 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40">
                      <option value="all">All Devices</option>
                      <option value="mobile">Mobile</option>
                      <option value="desktop">Desktop</option>
                    </select>
                  </div>
                </div>
                {(campaignFilter !== "all" || cityFilter !== "all" || deviceFilter !== "all") && (
                  <div className="pt-3 flex justify-end">
                    <button onClick={() => { setCampaignFilter("all"); setCityFilter("all"); setDeviceFilter("all"); }} className="text-xs text-primary hover:text-primary-light font-semibold transition-colors">
                      Reset All Filters
                    </button>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <span className="ml-3 text-sm text-muted-foreground">Loading attribution data...</span>
          </div>
        )}

        {!isLoading && (
          <>
            {/* ──── Stat Cards ──── */}
            <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 md:gap-4 mt-2">
              {statCards.map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <motion.div
                    key={stat.label}
                    custom={i}
                    variants={cardVariants as any}
                    whileHover={{ y: -3, transition: { duration: 0.2 } }}
                    className={`relative overflow-hidden bg-gradient-to-b ${stat.gradient} rounded-2xl border border-border/30 p-3 md:p-5 group cursor-default ${i === 4 ? "col-span-2 lg:col-span-1" : ""}`}
                  >
                    <div className="absolute top-3 right-3 opacity-[0.07] group-hover:opacity-[0.12] transition-opacity">
                      <Icon className="w-14 h-14 text-foreground" />
                    </div>
                    <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl bg-gradient-to-br ${stat.iconGradient} flex items-center justify-center mb-2 md:mb-3 shadow-lg`}>
                      <Icon className="w-4 h-4 md:w-5 md:h-5 text-white" />
                    </div>
                    <p className={`${(stat as any).small ? "text-sm sm:text-base md:text-xl" : "text-lg sm:text-xl md:text-3xl"} font-bold text-foreground leading-tight`} title={(stat as any).small ? stats.bestAd : undefined}>
                      {stat.value}
                    </p>
                    {(stat as any).subValue && <p className={`text-sm font-semibold ${stat.accent} mt-0.5`}>{(stat as any).subValue}</p>}
                    <p className="text-sm text-muted-foreground mt-1 font-medium">{stat.label}</p>
                  </motion.div>
                );
              })}
            </motion.div>

            {/* ──── PAID CUSTOMERS SECTION (shown when paid tab active) ──── */}
            <AnimatePresence mode="wait">
              {viewMode === "paid" && (
                <motion.div
                  key="buyers"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35 }}
                  className="bg-card rounded-2xl border border-emerald-500/20 shadow-sm overflow-hidden"
                >
                  {/* Header */}
                  <div className="px-3 py-3 md:px-6 md:py-5 border-b border-emerald-500/10 bg-gradient-to-r from-emerald-500/5 to-transparent">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg">
                          <ShoppingBag className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold text-foreground">Paid Customers</h2>
                          <p className="text-xs text-muted-foreground">{paidBuyers.length} buyer{paidBuyers.length !== 1 ? "s" : ""} · ₹{paidBuyers.reduce((s, v) => s + (v.amount || 0), 0).toLocaleString("en-IN")} total</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Sort */}
                        <div className="flex items-center gap-1 bg-surface rounded-xl p-1">
                          {[{ key: "date" as const, label: "Latest" }, { key: "amount" as const, label: "Amount" }].map((s) => (
                            <button
                              key={s.key}
                              onClick={() => setBuyersSortBy(s.key)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${buyersSortBy === s.key ? "bg-emerald-500 text-white" : "text-muted-foreground hover:text-foreground"}`}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                        {/* Search */}
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                          <input
                            type="text"
                            value={buyersSearch}
                            onChange={(e) => setBuyersSearch(e.target.value)}
                            placeholder="Search buyers..."
                            className="pl-9 pr-4 py-2 rounded-xl bg-surface border border-border/50 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40 w-44"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Table header */}
                  <div className="hidden md:grid grid-cols-12 gap-2 px-6 py-3 bg-surface/40 border-b border-border/20 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    <div className="col-span-2">Name</div>
                    <div className="col-span-2">Email</div>
                    <div className="col-span-1">Phone</div>
                    <div className="col-span-1">City</div>
                    <div className="col-span-1">Age</div>
                    <div className="col-span-1">Device</div>
                    <div className="col-span-2">Ad Source</div>
                    <div className="col-span-1 text-center">Paid At</div>
                    <div className="col-span-1 text-right">Amount</div>
                  </div>

                  {paidBuyers.length === 0 ? (
                    <div className="text-center py-16">
                      <ShoppingBag className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                      <p className="text-sm text-muted-foreground">No paid customers in this period.</p>
                    </div>
                  ) : (
                    <div className="max-h-[520px] overflow-y-auto">
                      {paidBuyers.map((buyer, idx) => (
                        <motion.div
                          key={buyer.visitor_id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.02 }}
                          className="grid grid-cols-1 md:grid-cols-12 gap-2 px-6 py-3.5 hover:bg-emerald-500/5 transition-colors border-b border-border/10 group cursor-pointer"
                          onClick={() => setSelectedVisitor(buyer)}
                        >
                          {/* Mobile */}
                          <div className="md:hidden flex items-center justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                                  {(buyer.customer_name || "A").charAt(0).toUpperCase()}
                                </div>
                                <span className="text-sm font-semibold text-foreground">{buyer.customer_name || "Anonymous"}</span>
                                <BadgeCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground pl-9">
                                {buyer.customer_email && <span>{buyer.customer_email}</span>}
                                {buyer.city && <span>📍 {buyer.city}</span>}
                                {buyer.age_group && <span>🎂 {buyer.age_group}</span>}
                                <span>{buyer.utm_content || "Direct"}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-bold text-emerald-400">₹{(buyer.amount || 0).toLocaleString("en-IN")}</div>
                              <div className="text-[11px] text-muted-foreground">{buyer.matched_at ? format(new Date(buyer.matched_at), "dd MMM") : "—"}</div>
                            </div>
                          </div>

                          {/* Desktop */}
                          <div className="hidden md:flex md:col-span-2 items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                              {(buyer.customer_name || "A").charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-medium text-foreground truncate">{buyer.customer_name || "Anonymous"}</span>
                          </div>
                          <div className="hidden md:flex md:col-span-2 items-center min-w-0">
                            <span className="text-xs text-muted-foreground truncate" title={buyer.customer_email || ""}>{buyer.customer_email || "—"}</span>
                          </div>
                          <div className="hidden md:flex md:col-span-1 items-center min-w-0">
                            <span className="text-xs text-muted-foreground">{buyer.customer_phone || "—"}</span>
                          </div>
                          <div className="hidden md:flex md:col-span-1 items-center min-w-0">
                            <span className="text-xs text-muted-foreground truncate">{buyer.city || "—"}</span>
                          </div>
                          <div className="hidden md:flex md:col-span-1 items-center min-w-0">
                            <span className="text-xs text-muted-foreground truncate">{buyer.age_group || "—"}</span>
                          </div>
                          <div className="hidden md:flex md:col-span-1 items-center">
                            {(buyer.device || "").toLowerCase().includes("mobile") || (buyer.device || "").toLowerCase().includes("android") || (buyer.device || "").toLowerCase().includes("iphone") ? (
                              <Smartphone className="w-3.5 h-3.5 text-muted-foreground" />
                            ) : (
                              <Monitor className="w-3.5 h-3.5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="hidden md:flex md:col-span-2 items-center min-w-0">
                            <span className="text-xs text-muted-foreground truncate" title={buyer.utm_content || ""}>{buyer.utm_content || "Direct / Unknown"}</span>
                          </div>
                          <div className="hidden md:flex md:col-span-1 items-center justify-center">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">{buyer.matched_at ? format(new Date(buyer.matched_at), "dd MMM, h:mm a") : "—"}</span>
                          </div>
                          <div className="hidden md:flex md:col-span-1 items-center justify-end">
                            <span className="text-sm font-bold text-emerald-400">₹{(buyer.amount || 0).toLocaleString("en-IN")}</span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ──── Chart ──── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.4 }}
              className="bg-card rounded-2xl border border-border/50 p-3 md:p-6 shadow-sm mt-2"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 md:mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <BarChart3 className="w-4 h-4 text-primary" />
                    <h2 className="text-base font-semibold text-foreground whitespace-nowrap">Visitors vs Payments</h2>
                  </div>
                  <p className="text-xs text-muted-foreground">Daily trend over selected period</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" /><span className="text-xs text-muted-foreground">Visitors</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /><span className="text-xs text-muted-foreground">Payments</span></div>
                </div>
              </div>
              <div className="h-48 sm:h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: -10 }}>
                    <defs>
                      <linearGradient id="visitorsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.3} />
                    <XAxis dataKey="date" tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }} tickLine={false} axisLine={false} interval={"preserveStartEnd"} />
                    <YAxis yAxisId="visitors" tick={{ fill: "#3b82f6", fontSize: 10 }} tickLine={false} axisLine={false} orientation="left" label={{ value: "Visitors", angle: -90, position: "insideLeft", style: { fill: "#3b82f6", fontSize: 9 } }} />
                    <YAxis yAxisId="payments" tick={{ fill: "#10b981", fontSize: 10 }} tickLine={false} axisLine={false} orientation="right" label={{ value: "Payments", angle: 90, position: "insideRight", style: { fill: "#10b981", fontSize: 9 } }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area yAxisId="visitors" type="monotone" dataKey="visitors" stroke="#3b82f6" strokeWidth={2} fill="url(#visitorsGrad)" fillOpacity={1} />
                    <Bar yAxisId="payments" dataKey="payments" fill="#10b981" fillOpacity={0.85} radius={[3, 3, 0, 0]} barSize={8} stroke="#10b981" strokeWidth={0.5} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* ──── India Geographic Map ──── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.4 }}
              className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden mt-2"
            >
              <div className="px-3 py-3 md:px-6 md:py-5 border-b border-border/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 md:w-8 md:h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                      <MapPin className="w-3.5 h-3.5 md:w-4 md:h-4 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-base md:text-lg font-semibold text-foreground">Geographic Reach</h2>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Where your visitors & buyers are — hover dots for city stats
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] text-muted-foreground/50 border border-border/30 px-2.5 py-1 rounded-full">
                    🇮🇳 India Map
                  </span>
                </div>
              </div>
              <div className="overflow-hidden">
                <Suspense fallback={
                  <div className="flex items-center justify-center h-[300px] bg-background">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-muted-foreground">Loading map…</span>
                    </div>
                  </div>
                }>
                  <IndiaMap visitors={filteredVisitors as any} />
                </Suspense>
              </div>
            </motion.div>

            {/* ──── BY AD CREATIVE VIEW ──── */}
            {tabMode === "by-creative" && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden"
              >
                <div className="px-3 py-3 md:px-6 md:py-5 border-b border-border/30">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    <h2 className="text-base md:text-lg font-semibold text-foreground">By Ad Creative</h2>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Grouped by ad creative · click to expand leads</p>
                </div>

                {creativeGroups.length === 0 ? (
                  <div className="text-center py-16">
                    <Layers className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No ad creative data found.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    {/* Header */}
                    <div className="hidden md:grid grid-cols-[2.5fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-6 py-3 bg-surface/50 border-b border-border/20 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      <div>Ad Creative</div>
                      <div className="text-center">Visitors</div>
                      <div className="text-center">Leads</div>
                      <div className="text-center">₹299 Paid</div>
                      <div className="text-right">Revenue</div>
                      <div className="text-center">Conv %</div>
                    </div>

                    {creativeGroups.map((cg, idx) => {
                      const isExpanded = expandedCreative === cg.creative;
                      const convRate = cg.visitors > 0 ? (cg.paid299 / cg.visitors) * 100 : 0;
                      return (
                        <div key={cg.creative}>
                          <motion.div
                            variants={rowVariants}
                            initial="hidden"
                            animate="visible"
                            transition={{ delay: idx * 0.03 }}
                            onClick={() => setExpandedCreative(isExpanded ? null : cg.creative)}
                            className={`grid grid-cols-1 md:grid-cols-[2.5fr_1fr_1fr_1fr_1fr_1fr] gap-1.5 md:gap-2 px-3 py-2 md:px-6 md:py-4 cursor-pointer transition-all group hover:bg-surface-hover/50 border-b border-border/10 ${isExpanded ? "bg-surface/30" : ""}`}
                          >
                            {/* Mobile */}
                            <div className="md:hidden space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 min-w-0">
                                  <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
                                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                  </motion.div>
                                  <span className="text-sm font-semibold text-foreground truncate">{cg.creative}</span>
                                </div>
                                <span className="text-sm font-bold text-primary whitespace-nowrap ml-2">₹{cg.revenue.toLocaleString("en-IN")}</span>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground pl-6">
                                <span>{cg.visitors} visitors</span>
                                <span>{cg.leads} leads</span>
                                {cg.paid299 > 0 && (
                                  <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                                    <BadgeCheck className="w-3 h-3" />
                                    {cg.paid299} paid
                                  </span>
                                )}
                                <span className={convRate > 5 ? "text-emerald-400" : ""}>{convRate.toFixed(1)}%</span>
                              </div>
                            </div>

                            {/* Desktop */}
                            <div className="hidden md:flex items-center gap-2 min-w-0">
                              <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
                                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 group-hover:text-primary transition-colors" />
                              </motion.div>
                              <span className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors" title={cg.creative}>
                                {cg.creative}
                              </span>
                            </div>
                            <div className="hidden md:flex items-center justify-center">
                              <span className="text-sm font-semibold text-foreground">{cg.visitors}</span>
                            </div>
                            <div className="hidden md:flex items-center justify-center">
                              <span className="text-sm text-yellow-400 font-semibold">{cg.leads > 0 ? cg.leads : "—"}</span>
                            </div>
                            <div className="hidden md:flex items-center justify-center">
                              {cg.paid299 > 0 ? (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-bold">
                                  <BadgeCheck className="w-3 h-3" />
                                  {cg.paid299}
                                </span>
                              ) : <span className="text-xs text-muted-foreground/40">—</span>}
                            </div>
                            <div className="hidden md:flex items-center justify-end">
                              <span className="text-sm font-bold text-primary">₹{cg.revenue.toLocaleString("en-IN")}</span>
                            </div>
                            <div className="hidden md:flex items-center justify-center">
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${convRate > 10 ? "bg-emerald-500/15 text-emerald-400" : convRate > 3 ? "bg-amber-500/15 text-amber-400" : "bg-muted/50 text-muted-foreground"}`}>
                                {convRate.toFixed(1)}%
                              </span>
                            </div>
                          </motion.div>

                          {/* Expanded leads under this creative */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3, ease: "easeInOut" }}
                                className="overflow-hidden bg-surface/20"
                              >
                                <div className="hidden md:grid grid-cols-12 gap-2 px-6 py-2 bg-surface/40 text-[9px] font-bold text-muted-foreground/70 uppercase tracking-wider border-b border-border/10">
                                  <div className="col-span-2">Name</div>
                                  <div className="col-span-2">Email</div>
                                  <div className="col-span-1">Phone</div>
                                  <div className="col-span-1">City</div>
                                  <div className="col-span-1">Age</div>
                                  <div className="col-span-1">Device</div>
                                  <div className="col-span-2">Date</div>
                                  <div className="col-span-1">Status</div>
                                  <div className="col-span-1 text-right">Amount</div>
                                </div>
                                <div className="max-h-[400px] overflow-y-auto">
                                  {cg.customers.map((cust, cIdx) => (
                                    <motion.div
                                      key={cust.visitor_id}
                                      initial={{ opacity: 0, y: 4 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      transition={{ delay: cIdx * 0.02 }}
                                      onClick={(e) => { e.stopPropagation(); setSelectedVisitor(cust); }}
                                      className={`grid grid-cols-1 md:grid-cols-12 gap-2 px-6 py-3 transition-colors border-b border-border/5 cursor-pointer ${
                                        cust.payment_status === "captured" ? "hover:bg-emerald-500/5" : "hover:bg-surface-hover/30"
                                      }`}
                                    >
                                      {/* Mobile */}
                                      <div className="md:hidden space-y-1.5 pl-4">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-sm font-medium text-foreground">{cust.customer_name || "Anonymous"}</span>
                                            {cust.payment_status === "captured" && <BadgeCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                                          </div>
                                          {cust.payment_status === "captured" ? (
                                            <span className="text-xs font-bold text-emerald-400">₹{(cust.amount || 0).toLocaleString("en-IN")}</span>
                                          ) : (
                                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground">Not paid</span>
                                          )}
                                        </div>
                                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                          {cust.customer_email && <span>{cust.customer_email}</span>}
                                          {cust.city && <span>📍 {cust.city}</span>}
                                          {cust.age_group && <span>🎂 {cust.age_group}</span>}
                                          <span>{format(new Date(cust.created_at), "dd MMM, h:mm a")}</span>
                                        </div>
                                      </div>
                                      {/* Desktop */}
                                      <div className="hidden md:flex md:col-span-2 items-center gap-1.5 min-w-0">
                                        {cust.payment_status === "captured" && <BadgeCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                                        <span className="text-xs font-medium text-foreground truncate">{cust.customer_name || "Anonymous"}</span>
                                      </div>
                                      <div className="hidden md:flex md:col-span-2 items-center min-w-0">
                                        <span className="text-xs text-muted-foreground truncate" title={cust.customer_email || ""}>{cust.customer_email || "—"}</span>
                                      </div>
                                      <div className="hidden md:flex md:col-span-1 items-center min-w-0">
                                        <span className="text-xs text-muted-foreground truncate">{cust.customer_phone || "—"}</span>
                                      </div>
                                      <div className="hidden md:flex md:col-span-1 items-center min-w-0">
                                        <span className="text-xs text-muted-foreground truncate">{cust.city || "—"}</span>
                                      </div>
                                      <div className="hidden md:flex md:col-span-1 items-center min-w-0">
                                        <span className="text-xs text-muted-foreground truncate">{cust.age_group || "—"}</span>
                                      </div>
                                      <div className="hidden md:flex md:col-span-1 items-center">
                                        {(cust.device || "").toLowerCase().includes("mobile") || (cust.device || "").toLowerCase().includes("android") || (cust.device || "").toLowerCase().includes("iphone") ? (
                                          <Smartphone className="w-3.5 h-3.5 text-muted-foreground" />
                                        ) : (
                                          <Monitor className="w-3.5 h-3.5 text-muted-foreground" />
                                        )}
                                      </div>
                                      <div className="hidden md:flex md:col-span-2 items-center">
                                        <span className="text-xs text-muted-foreground">{format(new Date(cust.created_at), "dd MMM, h:mm a")}</span>
                                      </div>
                                      <div className="hidden md:flex md:col-span-1 items-center">
                                        {cust.payment_status === "captured" ? (
                                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold">Paid</span>
                                        ) : (
                                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground">—</span>
                                        )}
                                      </div>
                                      <div className="hidden md:flex md:col-span-1 items-center justify-end">
                                        {cust.payment_status === "captured" ? (
                                          <span className="text-xs font-bold text-emerald-400">₹{(cust.amount || 0).toLocaleString("en-IN")}</span>
                                        ) : (
                                          <span className="text-[11px] text-muted-foreground/40">—</span>
                                        )}
                                      </div>
                                    </motion.div>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            {/* ──── Ad Performance Table ──── */}
            {tabMode === "visitors" && <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden mt-2"
            >
              <div className="px-3 py-3 md:px-6 md:py-5 border-b border-border/30">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <MousePointerClick className="w-4 h-4 text-primary" />
                      <h2 className="text-base md:text-lg font-semibold text-foreground">Ad Performance</h2>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Grouped by ad · click a row to see visitors</p>
                  </div>
                  {viewMode !== "all" && (
                    <span className={`text-xs px-3 py-1.5 rounded-full font-semibold border ${
                      viewMode === "paid" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-muted/30 border-border text-muted-foreground"
                    }`}>
                      {viewMode === "paid" ? "💰 Paid only" : "Unpaid only"}
                    </span>
                  )}
                </div>
              </div>

              {adGroups.length === 0 ? (
                <div className="text-center py-16">
                  <Target className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">No data found for the selected filters.</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Try changing the date range or clearing filters.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  {/* Table header */}
                  <div className="hidden md:grid grid-cols-[2.5fr_2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-2 px-6 py-3 bg-surface/50 border-b border-border/20 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                    <div>Ad Name</div>
                    <div>Campaign</div>
                    <div className="text-center">Visitors</div>
                    <div className="text-center">Paid</div>
                    <div className="text-right">Spend</div>
                    <div className="text-right">Revenue</div>
                    <div className="text-center">CPA</div>
                    <div className="text-center">ROI</div>
                    <div className="text-center">Conv %</div>
                  </div>

                  {adGroups.map((ad, idx) => (
                    <div key={ad.adName}>
                      <motion.div
                        variants={rowVariants}
                        initial="hidden"
                        animate="visible"
                        transition={{ delay: idx * 0.03 }}
                        onClick={() => setExpandedAd(expandedAd === ad.adName ? null : ad.adName)}
                        className={`grid grid-cols-1 md:grid-cols-[2.5fr_2fr_1fr_1fr_1fr_1fr_1fr_1fr_1fr] gap-1.5 md:gap-2 px-3 py-2 md:px-6 md:py-4 cursor-pointer transition-all group hover:bg-surface-hover/50 border-b border-border/10 ${expandedAd === ad.adName ? "bg-surface/30" : ""}`}
                      >
                        {/* Mobile */}
                        <div className="md:hidden space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <motion.div animate={{ rotate: expandedAd === ad.adName ? 90 : 0 }} transition={{ duration: 0.2 }}>
                                <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              </motion.div>
                              <span className="text-sm font-semibold text-foreground truncate">{ad.adName}</span>
                            </div>
                            <span className="text-sm font-bold text-primary whitespace-nowrap ml-2">₹{ad.revenue.toLocaleString("en-IN")}</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground pl-6">
                            <span>{ad.visitors} visitors</span>
                            {ad.payments > 0 && (
                              <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                                <BadgeCheck className="w-3 h-3" />
                                {ad.payments} paid
                              </span>
                            )}
                            <span className={ad.conversionRate > 5 ? "text-emerald-400" : ""}>{ad.conversionRate.toFixed(1)}%</span>
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{ad.topCity}</span>
                          </div>
                        </div>

                        {/* Desktop */}
                        <div className="hidden md:flex items-center gap-2 min-w-0">
                          <motion.div animate={{ rotate: expandedAd === ad.adName ? 90 : 0 }} transition={{ duration: 0.2 }}>
                            <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0 group-hover:text-primary transition-colors" />
                          </motion.div>
                          <span className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors" title={ad.adName}>
                            {ad.adName}
                          </span>
                        </div>
                        <div className="hidden md:flex items-center">
                          <span className="text-xs text-muted-foreground truncate" title={ad.campaignName}>{ad.campaignName}</span>
                        </div>
                        <div className="hidden md:flex items-center justify-center">
                          <span className="text-sm font-semibold text-foreground">{ad.visitors}</span>
                        </div>
                        {/* Paid badge */}
                        <div className="hidden md:flex items-center justify-center">
                          {ad.payments > 0 ? (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-bold">
                              <BadgeCheck className="w-3 h-3" />
                              {ad.payments}
                            </span>
                          ) : <span className="text-xs text-muted-foreground/40">—</span>}
                        </div>
                        {/* Spend + Revenue + CPA + ROI */}
                        {(() => {
                          const adId = adLookup ? Object.entries(adLookup).find(([, v]) => v.ad_name === ad.adName)?.[0] : null;
                          const spend = adId && spendMap ? (spendMap[adId] || 0) : 0;
                          const roi = spend > 0 ? ((ad.revenue - spend) / spend) * 100 : null;
                          const cpa = spend > 0 && ad.payments > 0 ? spend / ad.payments : null;
                          return (<>
                            <div className="hidden md:flex items-center justify-end">
                              <span className="text-xs text-muted-foreground/70">
                                {spend > 0 ? `₹${spend.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—"}
                              </span>
                            </div>
                            <div className="hidden md:flex items-center justify-end">
                              <span className="text-sm font-bold text-primary">₹{ad.revenue.toLocaleString("en-IN")}</span>
                            </div>
                            {/* CPA */}
                            <div className="hidden md:flex items-center justify-center">
                              {cpa !== null ? (
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cpa <= 500 ? "bg-emerald-500/15 text-emerald-400" : cpa <= 1500 ? "bg-amber-500/15 text-amber-400" : "bg-red-500/10 text-red-400"}`}>
                                  ₹{cpa.toFixed(0)}
                                </span>
                              ) : <span className="text-xs text-muted-foreground/40">—</span>}
                            </div>
                            <div className="hidden md:flex items-center justify-center">
                              {roi !== null ? (
                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${roi >= 100 ? "bg-emerald-500/15 text-emerald-400" : roi >= 0 ? "bg-amber-500/15 text-amber-400" : "bg-red-500/10 text-red-400"}`}>
                                  {roi >= 0 ? "+" : ""}{roi.toFixed(0)}%
                                </span>
                              ) : <span className="text-xs text-muted-foreground/40">—</span>}
                            </div>
                          </>);
                        })()}
                        <div className="hidden md:flex items-center justify-center">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ad.conversionRate > 10 ? "bg-emerald-500/15 text-emerald-400" : ad.conversionRate > 3 ? "bg-amber-500/15 text-amber-400" : "bg-muted/50 text-muted-foreground"}`}>
                            {ad.conversionRate.toFixed(1)}%
                          </span>
                        </div>
                      </motion.div>

                      {/* ──── Expanded Customer Rows ──── */}
                      <AnimatePresence>
                        {expandedAd === ad.adName && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: "easeInOut" }}
                            className="overflow-hidden bg-surface/20"
                          >
                            {/* ── Age & Gender Breakdown Panel ── */}
                            {ageBreakdownRaw && (() => {
                              // 1. Match by ad_id via adLookup
                              const matchedAdId = adLookup ? Object.entries(adLookup).find(([, v]) => v.ad_name === ad.adName)?.[0] : null;
                              let breakdown = matchedAdId ? ageBreakdownRaw.byId?.[matchedAdId] : null;
                              // 2. Fuzzy fallback: match by normalized name (strip date suffix)
                              if (!breakdown) {
                                const normalizedAdName = ad.adName.toLowerCase().replace(/\s+/g, " ").split("|")[0].trim();
                                breakdown = ageBreakdownRaw.byName?.[normalizedAdName] ?? null;
                              }
                              if (!breakdown) return null;
                              const maxPct = Math.max(...breakdown.ages.map((a: any) => a.pct), 1);
                              return (
                                <div className="px-6 py-4 border-b border-border/20 bg-surface/30">
                                  <div className="flex items-center gap-6 flex-wrap">
                                    {/* Age bars */}
                                    <div className="flex-1 min-w-[280px]">
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Age Breakdown</span>
                                        <span className="text-[11px] text-muted-foreground/60">· Top: {breakdown.top_age}</span>
                                      </div>
                                      <div className="space-y-1.5">
                                        {breakdown.ages.map((a: any) => (
                                          <div key={a.age} className="flex items-center gap-2">
                                            <span className="text-[11px] text-muted-foreground w-12 flex-shrink-0">{a.age}</span>
                                            <div className="flex-1 h-4 bg-surface rounded-sm overflow-hidden">
                                              <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${(a.pct / maxPct) * 100}%` }}
                                                transition={{ duration: 0.6, ease: "easeOut" }}
                                                className={`h-full rounded-sm ${a.age === breakdown.top_age ? "bg-primary" : "bg-primary/30"}`}
                                              />
                                            </div>
                                            <span className="text-[11px] font-semibold text-foreground w-8 text-right">{a.pct}%</span>
                                            <span className="text-[11px] text-muted-foreground/60 w-14">({a.clicks} clicks)</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>

                                    {/* Gender split */}
                                    <div className="flex-shrink-0 w-36">
                                      <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Gender</div>
                                      <div className="flex h-5 rounded-full overflow-hidden border border-border/30">
                                        <div
                                          className="bg-blue-500/70 flex items-center justify-center text-[11px] font-bold text-white transition-all"
                                          style={{ width: `${breakdown.gender.male_pct}%` }}
                                        >
                                          {breakdown.gender.male_pct >= 20 ? `${breakdown.gender.male_pct}%` : ""}
                                        </div>
                                        <div
                                          className="bg-pink-500/70 flex items-center justify-center text-[11px] font-bold text-white transition-all"
                                          style={{ width: `${breakdown.gender.female_pct}%` }}
                                        >
                                          {breakdown.gender.female_pct >= 20 ? `${breakdown.gender.female_pct}%` : ""}
                                        </div>
                                      </div>
                                      <div className="flex justify-between mt-1">
                                        <span className="text-[11px] text-blue-400/80 flex items-center gap-0.5">
                                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500/70 inline-block" /> M {breakdown.gender.male_pct}%
                                        </span>
                                        <span className="text-[11px] text-pink-400/80 flex items-center gap-0.5">
                                          F {breakdown.gender.female_pct}% <span className="w-1.5 h-1.5 rounded-full bg-pink-500/70 inline-block" />
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}

                            <div className="hidden md:grid grid-cols-12 gap-2 px-6 py-2 bg-surface/40 text-[9px] font-bold text-muted-foreground/70 uppercase tracking-wider border-b border-border/10">
                              <div className="col-span-2">Name</div>
                              <div className="col-span-2">Email</div>
                              <div className="col-span-1">City</div>
                              <div className="col-span-1">Age</div>
                              <div className="col-span-1">Device</div>
                              <div className="col-span-2">Landed At</div>
                              <div className="col-span-2">Paid At</div>
                              <div className="col-span-1 text-right">Amount</div>
                            </div>

                            {ad.customers.length === 0 ? (
                              <div className="px-6 py-6 text-center text-xs text-muted-foreground">No customers for this ad.</div>
                            ) : (
                              <div className="max-h-[400px] overflow-y-auto">
                                {ad.customers.map((cust, cIdx) => (
                                  <motion.div
                                    key={cust.visitor_id}
                                    initial={{ opacity: 0, y: 4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: cIdx * 0.02 }}
                                    className={`grid grid-cols-1 md:grid-cols-12 gap-2 px-6 py-3 transition-colors border-b border-border/5 cursor-pointer ${
                                      cust.payment_status === "captured" ? "hover:bg-emerald-500/5" : "hover:bg-surface-hover/30"
                                    }`}
                                    onClick={(e) => { e.stopPropagation(); setSelectedVisitor(cust); }}
                                  >
                                    {/* Mobile */}
                                    <div className="md:hidden space-y-1.5 pl-4">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-sm font-medium text-foreground">{cust.customer_name || "Anonymous"}</span>
                                          {cust.payment_status === "captured" && <BadgeCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                                        </div>
                                        {cust.payment_status === "captured" ? (
                                          <span className="text-xs font-bold text-emerald-400">₹{(cust.amount || 0).toLocaleString("en-IN")}</span>
                                        ) : (
                                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground">Not paid</span>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                        {cust.customer_email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{cust.customer_email}</span>}
                                        {cust.customer_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{cust.customer_phone}</span>}
                                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{cust.city || "—"}</span>
                                        {cust.age_group && <span className="flex items-center gap-1"><User className="w-3 h-3" />{cust.age_group}</span>}
                                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{format(new Date(cust.created_at), "dd MMM, h:mm a")}</span>
                                      </div>
                                    </div>

                                    {/* Desktop */}
                                    <div className="hidden md:flex md:col-span-2 items-center gap-1.5 min-w-0">
                                      {cust.payment_status === "captured" && <BadgeCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                                      <span className="text-xs font-medium text-foreground truncate">{cust.customer_name || "Anonymous"}</span>
                                    </div>
                                    <div className="hidden md:flex md:col-span-2 items-center min-w-0">
                                      <span className="text-xs text-muted-foreground truncate" title={cust.customer_email || ""}>{cust.customer_email || "—"}</span>
                                    </div>
                                    <div className="hidden md:flex md:col-span-1 items-center min-w-0">
                                      <span className="text-xs text-muted-foreground truncate">{cust.city || "—"}</span>
                                    </div>
                                    <div className="hidden md:flex md:col-span-1 items-center min-w-0">
                                      <span className="text-xs text-muted-foreground truncate">{cust.age_group || "—"}</span>
                                    </div>
                                    <div className="hidden md:flex md:col-span-1 items-center">
                                      {(cust.device || "").toLowerCase().includes("mobile") || (cust.device || "").toLowerCase().includes("android") || (cust.device || "").toLowerCase().includes("iphone") ? (
                                        <Smartphone className="w-3.5 h-3.5 text-muted-foreground" />
                                      ) : (
                                        <Monitor className="w-3.5 h-3.5 text-muted-foreground" />
                                      )}
                                    </div>
                                    <div className="hidden md:flex md:col-span-2 items-center">
                                      <span className="text-xs text-muted-foreground">{format(new Date(cust.created_at), "dd MMM yyyy, h:mm a")}</span>
                                    </div>
                                    <div className="hidden md:flex md:col-span-2 items-center">
                                      <span className="text-xs text-muted-foreground">{cust.matched_at ? format(new Date(cust.matched_at), "dd MMM yyyy, h:mm a") : "—"}</span>
                                    </div>
                                    <div className="hidden md:flex md:col-span-1 items-center justify-end">
                                      {cust.payment_status === "captured" ? (
                                        <span className="text-xs font-bold text-emerald-400">₹{(cust.amount || 0).toLocaleString("en-IN")}</span>
                                      ) : (
                                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted/50 text-muted-foreground">—</span>
                                      )}
                                    </div>
                                  </motion.div>
                                ))}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>}
          {/* ══════ SECTION: LOST LEADS ALERT ══════ */}
          {lostLeadsGroups.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
              className="bg-card/60 border border-amber-500/20 rounded-2xl p-3 md:p-6">
              {/* Header — stacks on mobile */}
              <div className="flex flex-col gap-1.5 mb-3 md:mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
                  <h3 className="text-base font-bold text-foreground">Lost Leads Alert</h3>
                  <span className="text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full font-semibold whitespace-nowrap">
                    {lostLeads?.length || 0} unpaid · 7 days
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">Clicked your ads but didn't buy — prime retargeting targets 🎯</p>
              </div>

              <div className="space-y-1.5">
                {lostLeadsGroups.map((group, i) => (
                  <div key={i} className="flex items-center gap-2 md:gap-3 px-2 py-2 md:px-3 md:py-3 rounded-xl bg-surface/30 border border-amber-500/10 hover:border-amber-500/30 transition-all group cursor-pointer">
                    {/* Count bubble */}
                    <div className="flex-shrink-0 w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-amber-400">{group.count}</span>
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <span className="text-xs font-semibold text-foreground truncate" title={group.adName}
                          style={{ maxWidth: "calc(100% - 80px)" }}>
                          {group.adName.length > 28 ? group.adName.slice(0, 28) + "…" : group.adName}
                        </span>
                        {group.city !== "Unknown city" && (
                          <span className="flex-shrink-0 flex items-center gap-0.5 text-[11px] text-muted-foreground">
                            <MapPin className="w-2.5 h-2.5" />{group.city}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {group.count} visitors · no purchase
                      </p>
                    </div>
                    {/* CTA */}
                    <div className="flex-shrink-0">
                      <span className="text-[11px] text-amber-400/70 font-medium">retarget →</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 pt-3 border-t border-border/20 flex items-center gap-2 text-xs text-muted-foreground">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Potential revenue if 10% convert: <span className="text-amber-400 font-semibold">₹{Math.round((lostLeads?.length || 0) * 0.1 * 299).toLocaleString("en-IN")}</span></span>
              </div>
            </motion.div>
          )}

          {/* ══════ SECTION: CONVERSION FUNNEL ══════ */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="bg-card/60 border border-border/30 rounded-2xl p-3 md:p-6 mt-2">
            <div className="flex items-center gap-2 mb-3 md:mb-6">
              <Target className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              <h3 className="text-sm md:text-base font-bold text-foreground">Conversion Funnel</h3>
              <span className="text-xs text-muted-foreground ml-1">· per ad</span>
            </div>
            <div className="space-y-3 md:space-y-4">
              {adGroups.filter(ad => ad.visitors > 0).slice(0, 8).map(ad => {
                const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
                const rawLeads = Object.entries(leadsMap || {}).find(([k]) => normalize(k) === normalize(ad.adName))?.[1] || 0;
                const visitors = ad.visitors;
                const paid = ad.payments;
                // Cap leads at visitors to prevent impossible funnel (leads come from Google Sheets, visitors from UTM)
                const leads = Math.min(rawLeads, visitors);
                const leadPct = visitors > 0 ? Math.min(100, (leads / visitors) * 100) : 0;
                const paidPct = visitors > 0 ? Math.min(100, (paid / visitors) * 100) : 0;
                const convLabel = paid > 0 ? `${Math.round(paidPct)}% conv` : "no conversions";
                return (
                  <div key={ad.adName} className="space-y-2">
                    {/* Ad name + conv rate */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground truncate" title={ad.adName}>{ad.adName}</span>
                      <span className={`text-[11px] font-semibold flex-shrink-0 ${paid > 0 ? "text-emerald-400" : "text-muted-foreground/50"}`}>{convLabel}</span>
                    </div>
                    {/* 3 stage bars — stacked vertically on mobile */}
                    <div className="space-y-1">
                      {/* Stage 1: Visitors */}
                      <div className="flex items-center gap-2">
                        <span className="w-14 text-[11px] text-blue-400/70 flex-shrink-0 text-right">Visitors</span>
                        <div className="flex-1 h-5 bg-blue-500/10 rounded-sm relative overflow-hidden">
                          <div className="absolute inset-0 bg-blue-500/30 rounded-sm" style={{ width: "100%" }} />
                          <span className="absolute inset-0 flex items-center px-2 text-[11px] text-blue-300 font-medium">{visitors}</span>
                        </div>
                      </div>
                      {/* Stage 2: Leads */}
                      <div className="flex items-center gap-2">
                        <span className="w-14 text-[11px] text-yellow-400/70 flex-shrink-0 text-right">Leads</span>
                        <div className="flex-1 h-5 bg-yellow-500/5 rounded-sm relative overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(leadPct, leads > 0 ? 8 : 0)}%` }} transition={{ duration: 0.7 }}
                            className="absolute inset-0 bg-yellow-500/35 rounded-sm" />
                          <span className="absolute inset-0 flex items-center px-2 text-[11px] text-yellow-300 font-medium">{leads > 0 ? leads : "—"}</span>
                        </div>
                      </div>
                      {/* Stage 3: Paid */}
                      <div className="flex items-center gap-2">
                        <span className="w-14 text-[11px] text-emerald-400/70 flex-shrink-0 text-right">Paid</span>
                        <div className="flex-1 h-5 bg-emerald-500/5 rounded-sm relative overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(paidPct, paid > 0 ? 8 : 0)}%` }} transition={{ duration: 0.7, delay: 0.2 }}
                            className="absolute inset-0 bg-emerald-500/40 rounded-sm" />
                          <span className="absolute inset-0 flex items-center px-2 text-[11px] text-emerald-300 font-bold">{paid > 0 ? paid : "—"}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* ══════ SECTION: BEST TIME HEATMAP ══════ */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="bg-card/60 border border-border/30 rounded-2xl p-3 md:p-6 mt-2">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              <h3 className="text-sm md:text-base font-bold text-foreground">Best Time to Run Ads</h3>
              <span className="text-xs text-muted-foreground ml-1 hidden sm:inline">· IST · green = conversions</span>
            </div>
            <p className="text-xs text-muted-foreground mb-2 md:mb-4">Peak hours when visitors land and buy (IST)</p>

            {/* ── MOBILE: Top 3 hours per day ── */}
            <div className="sm:hidden space-y-1.5">
              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day, dayIdx) => {
                // Get top 3 hours by visitors for this day
                const hours = Array.from({ length: 24 }, (_, h) => ({
                  h,
                  visits: heatmapData.visitGrid[dayIdx][h],
                  paid: heatmapData.paidGrid[dayIdx][h],
                })).filter(x => x.visits > 0).sort((a, b) => b.visits - a.visits).slice(0, 3);

                if (hours.length === 0) return (
                  <div key={day} className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-surface/20 border border-border/10">
                    <span className="w-8 text-xs font-bold text-muted-foreground/40 flex-shrink-0">{day}</span>
                    <span className="text-[11px] text-muted-foreground/30 italic">No data</span>
                  </div>
                );

                return (
                  <div key={day} className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-surface/30 border border-border/10">
                    <span className="w-8 text-xs font-bold text-foreground flex-shrink-0">{day}</span>
                    <div className="flex items-center gap-2 flex-wrap">
                      {hours.map(({ h, visits, paid }) => (
                        <div key={h} className={`flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold ${
                          paid > 0 ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "bg-primary/10 text-primary border border-primary/20"
                        }`}>
                          <span>{h}:00</span>
                          <span className="opacity-60 text-[11px]">{visits}v</span>
                          {paid > 0 && <span className="text-emerald-300">💰</span>}
                        </div>
                      ))}
                    </div>
                    {hours[0]?.paid > 0 && (
                      <span className="ml-auto text-[11px] text-emerald-400 font-semibold flex-shrink-0">converts</span>
                    )}
                  </div>
                );
              })}
              <p className="text-[11px] text-muted-foreground/40 text-center mt-1">💡 Green = hours with paid conversions · v = visitors</p>
            </div>

            {/* ── DESKTOP: Full heatmap grid ── */}
            <div className="hidden sm:block overflow-x-auto scrollbar-none">
              <div className="min-w-[500px]">
                <div className="flex gap-px mb-1 ml-8">
                  {Array.from({ length: 24 }, (_, h) => (
                    <div key={h} className="flex-1 text-center text-[7px] text-muted-foreground/50">
                      {h % 6 === 0 ? `${h}` : ""}
                    </div>
                  ))}
                </div>
                {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day, dayIdx) => (
                  <div key={day} className="flex items-center gap-px mb-px">
                    <span className="w-8 text-right text-[9px] text-muted-foreground/60 pr-1 flex-shrink-0">{day}</span>
                    {Array.from({ length: 24 }, (_, h) => {
                      const visits = heatmapData.visitGrid[dayIdx][h];
                      const paid = heatmapData.paidGrid[dayIdx][h];
                      const intensity = heatmapData.maxVisit > 0 ? visits / heatmapData.maxVisit : 0;
                      const hasPaid = paid > 0;
                      return (
                        <div key={h} className="flex-1 aspect-square rounded-[2px] relative group cursor-default transition-transform hover:scale-125"
                          style={{ background: hasPaid ? `rgba(34,197,94,${0.3 + intensity * 0.7})` : `rgba(99,102,241,${intensity * 0.8})` }}>
                          {(visits > 0 || hasPaid) && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                              <div className="bg-popover border border-border rounded px-2 py-1 text-[11px] whitespace-nowrap shadow-lg">
                                <span className="text-foreground font-medium">{day} {h}:00 IST</span><br />
                                <span className="text-blue-400">{visits} visitors</span>
                                {hasPaid && <><br /><span className="text-emerald-400 font-bold">{paid} paid 💰</span></>}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div className="flex items-center gap-3 mt-2 text-[9px] text-muted-foreground flex-wrap">
                  <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500/60 inline-block"/><span>Visitors</span></div>
                  <div className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/60 inline-block"/><span>Paid</span></div>
                  <span className="ml-auto opacity-60">darker = more</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ══════ SECTION: CITY × CONVERSION TABLE ══════ */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="bg-card/60 border border-border/30 rounded-2xl p-3 md:p-6 mt-2">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              <h3 className="text-sm md:text-base font-bold text-foreground">City Performance</h3>
              {ageBreakdownRaw && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">+ Age Signal</span>}
            </div>
            <p className="text-xs text-muted-foreground mb-2 md:mb-4">Which cities convert + top age group from Meta Ads</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/20 text-muted-foreground/60 text-[11px] uppercase tracking-wider">
                    <th className="text-left pb-2 font-semibold">City</th>
                    <th className="text-right pb-2 font-semibold">Visitors</th>
                    <th className="text-right pb-2 font-semibold">Paid</th>
                    <th className="text-right pb-2 font-semibold">Conv %</th>
                    <th className="text-right pb-2 font-semibold">Revenue</th>
                    <th className="text-right pb-2 font-semibold">Top Age Signal</th>
                  </tr>
                </thead>
                <tbody>
                  {cityInsights.map((c, i) => {
                    // Get top age from ageBreakdown (aggregate across all ads)
                    const allAges: Record<string, number> = {};
                    Object.values(ageBreakdownRaw?.byId || {}).forEach((ad: any) => {
                      (ad.ages || []).forEach((a: any) => {
                        allAges[a.age] = (allAges[a.age] || 0) + a.clicks;
                      });
                    });
                    const topAge = Object.entries(allAges).sort((a, b) => b[1] - a[1])[0]?.[0];
                    return (
                      <tr key={c.city} className={`border-b border-border/10 hover:bg-surface-hover/30 transition-colors ${c.paid > 0 ? "" : "opacity-60"}`}>
                        <td className="py-2.5 font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            {c.paid > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />}
                            {c.paid === 0 && <span className="w-1.5 h-1.5 rounded-full bg-border flex-shrink-0" />}
                            {c.city}
                          </div>
                        </td>
                        <td className="py-2.5 text-right text-muted-foreground">{c.visitors}</td>
                        <td className="py-2.5 text-right">
                          {c.paid > 0 ? <span className="text-emerald-400 font-bold">{c.paid}</span> : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="py-2.5 text-right">
                          <span className={`font-semibold ${c.convRate > 2 ? "text-emerald-400" : c.convRate > 0 ? "text-yellow-400" : "text-muted-foreground/40"}`}>
                            {c.convRate.toFixed(1)}%
                          </span>
                        </td>
                        <td className="py-2.5 text-right text-primary font-medium">
                          {c.revenue > 0 ? `₹${c.revenue.toLocaleString("en-IN")}` : "—"}
                        </td>
                        <td className="py-2.5 text-right">
                          {i === 0 && topAge ? (
                            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">{topAge} · top</span>
                          ) : topAge ? (
                            <span className="text-muted-foreground/50 text-[11px]">{topAge}</span>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {cityInsights.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">No city data in selected range</div>
              )}
            </div>
          </motion.div>

          </>
        )}
      </div>

      {/* ──── Customer Journey Modal ──── */}
      {selectedVisitor && (
        <CustomerJourneyModal
          visitor={selectedVisitor}
          onClose={() => setSelectedVisitor(null)}
        />
      )}
    </Layout>
  );
}
