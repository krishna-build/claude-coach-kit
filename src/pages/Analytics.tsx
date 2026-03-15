import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import Layout from "@/components/Layout";
import { motion } from "framer-motion";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from "recharts";
import {
  TrendingUp, Mail, MousePointer, Users, Zap, Trophy, Clock, BarChart2
} from "lucide-react";

const GOLD = "#FFB433";
const GOLD_DARK = "#e6a02e";
const GREEN = "#22C55E";
const BLUE = "#60A5FA";

function StatCard({ icon: Icon, label, value, sub, color = GOLD }: {
  icon: any; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border/50 rounded-2xl p-5 flex items-start gap-4">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#262830', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#f2f2f2' }} className="p-3 shadow-xl text-xs">
      <p className="text-gray-400 mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

const CHART_AXIS_PROPS = {
  stroke: "#4b5563" as const,
  tick: { fill: '#6b7280', fontSize: 11 } as const,
  tickLine: false as const,
} as const;

const CHART_GRID_PROPS = {
  strokeDasharray: "3 3" as const,
  stroke: "#374151" as const,
} as const;

const TOOLTIP_CONTENT_STYLE = {
  background: '#262830',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '12px',
  color: '#f2f2f2',
} as const;


export default function Analytics() {
  // Email log data
  const { data: emailLog } = useQuery({
    queryKey: ["analytics-email-log"],
    queryFn: async () => {
      const { data } = await supabase
        .from("automation_email_log")
        .select("status, sent_at, step_id")
        .order("sent_at", { ascending: true });
      return data || [];
    },
    staleTime: 60_000,
  });

  // Contacts data
  const { data: contacts } = useQuery({
    queryKey: ["analytics-contacts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("automation_contacts")
        .select("created_at, tags")
        .order("created_at", { ascending: true });
      return data || [];
    },
    staleTime: 60_000,
  });

  // Sequences data
  const { data: sequences } = useQuery({
    queryKey: ["analytics-sequences"],
    queryFn: async () => {
      const { data } = await supabase
        .from("automation_sequences")
        .select("id, name, status");
      return data || [];
    },
    staleTime: 60_000,
  });

  // Enrollments
  const { data: enrollments } = useQuery({
    queryKey: ["analytics-enrollments"],
    queryFn: async () => {
      const { data } = await supabase
        .from("automation_sequence_enrollments")
        .select("sequence_id, status, created_at");
      return data || [];
    },
    staleTime: 60_000,
  });

  // Process email stats
  const emailStats = useMemo(() => {
    if (!emailLog) return { sent: 0, opened: 0, clicked: 0, openRate: 0, clickRate: 0 };
    const sent = emailLog.length;
    const opened = emailLog.filter(e => e.status === "opened" || e.status === "clicked").length;
    const clicked = emailLog.filter(e => e.status === "clicked").length;
    return {
      sent,
      opened,
      clicked,
      openRate: sent > 0 ? Math.round((opened / sent) * 100) : 0,
      clickRate: sent > 0 ? Math.round((clicked / sent) * 100) : 0,
    };
  }, [emailLog]);

  // Contact growth by week
  const contactGrowth = useMemo(() => {
    if (!contacts) return [];
    const weeks: Record<string, number> = {};
    contacts.forEach(c => {
      const d = new Date(c.created_at);
      const week = `W${Math.ceil(d.getDate() / 7)} ${d.toLocaleString("default", { month: "short" })}`;
      weeks[week] = (weeks[week] || 0) + 1;
    });
    return Object.entries(weeks).slice(-8).map(([week, count]) => ({ week, count }));
  }, [contacts]);

  // Email activity by day (last 14 days)
  const emailActivity = useMemo(() => {
    if (!emailLog) return [];
    const days: Record<string, { sent: number; opened: number; clicked: number }> = {};
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
      days[key] = { sent: 0, opened: 0, clicked: 0 };
    }
    emailLog.forEach(e => {
      const key = new Date(e.sent_at).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
      if (days[key]) {
        days[key].sent++;
        if (e.status === "opened" || e.status === "clicked") days[key].opened++;
        if (e.status === "clicked") days[key].clicked++;
      }
    });
    return Object.entries(days).map(([date, v]) => ({ date, ...v }));
  }, [emailLog]);

  // Sequence performance
  const sequencePerf = useMemo(() => {
    if (!sequences || !enrollments || !emailLog) return [];
    return sequences.map(seq => {
      const enrolCount = enrollments.filter(e => e.sequence_id === seq.id).length;
      const completed = enrollments.filter(e => e.sequence_id === seq.id && e.status === "completed").length;
      const compRate = enrolCount > 0 ? Math.round((completed / enrolCount) * 100) : 0;
      return { name: seq.name.slice(0, 25), enrolled: enrolCount, completed, compRate, status: seq.status };
    }).filter(s => s.enrolled > 0).sort((a, b) => b.enrolled - a.enrolled);
  }, [sequences, enrollments, emailLog]);

  // Tag distribution
  const tagDist = useMemo(() => {
    if (!contacts) return [];
    const tagCount: Record<string, number> = {};
    contacts.forEach(c => {
      (c.tags || []).forEach((tag: string) => {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
      });
    });
    return Object.entries(tagCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([tag, count]) => ({ tag, count }));
  }, [contacts]);

  const COLORS = [GOLD, GREEN, BLUE, "#A78BFA", "#F472B6", "#FB923C"];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BarChart2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
            <p className="text-sm text-muted-foreground">Email performance, contact growth & sequence stats</p>
          </div>
        </div>

        {/* Top Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Total Contacts" value={(contacts || []).length.toLocaleString()} color={BLUE} />
          <StatCard icon={Mail} label="Emails Sent" value={emailStats.sent.toLocaleString()} color={GOLD} />
          <StatCard icon={TrendingUp} label="Open Rate" value={`${emailStats.openRate}%`} sub={`${emailStats.opened} opened`} color={GREEN} />
          <StatCard icon={MousePointer} label="Click Rate" value={`${emailStats.clickRate}%`} sub={`${emailStats.clicked} clicked`} color="#A78BFA" />
        </div>

        {/* Email Activity Chart */}
        <div className="bg-card border border-border/50 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <Mail className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Email Activity — Last 14 Days</h2>
          </div>
          {emailActivity.some(d => d.sent > 0) ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={emailActivity} margin={{ left: -20, right: 8 }}>
                <defs>
                  <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={GOLD} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="openGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={GREEN} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={GREEN} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...CHART_GRID_PROPS} />
                <XAxis dataKey="date" {...CHART_AXIS_PROPS} axisLine={false} />
                <YAxis {...CHART_AXIS_PROPS} axisLine={false} />
                <Tooltip content={<CustomTooltip />} contentStyle={TOOLTIP_CONTENT_STYLE} />
                <Area type="monotone" dataKey="sent" name="Sent" stroke={GOLD} fill="url(#sentGrad)" strokeWidth={2} />
                <Area type="monotone" dataKey="opened" name="Opened" stroke={GREEN} fill="url(#openGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              No email data yet. Start a sequence to see activity here.
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Contact Growth */}
          <div className="bg-card border border-border/50 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <Users className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Contact Growth</h2>
            </div>
            {contactGrowth.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={contactGrowth} margin={{ left: -20, right: 8 }}>
                  <CartesianGrid {...CHART_GRID_PROPS} />
                  <XAxis dataKey="week" {...CHART_AXIS_PROPS} axisLine={false} />
                  <YAxis {...CHART_AXIS_PROPS} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} contentStyle={TOOLTIP_CONTENT_STYLE} />
                  <Bar dataKey="count" name="New Contacts" fill={GOLD} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
            )}
          </div>

          {/* Tag Distribution */}
          <div className="bg-card border border-border/50 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Contact Tags</h2>
            </div>
            {tagDist.length > 0 ? (
              <div className="space-y-3">
                {tagDist.map((t, i) => {
                  const max = tagDist[0].count;
                  const pct = Math.round((t.count / max) * 100);
                  return (
                    <div key={t.tag}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-foreground font-medium">{t.tag}</span>
                        <span className="text-muted-foreground">{t.count}</span>
                      </div>
                      <div className="h-2 bg-muted/30 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ delay: i * 0.1, duration: 0.5 }}
                          className="h-full rounded-full"
                          style={{ background: COLORS[i % COLORS.length] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">No tags yet</div>
            )}
          </div>
        </div>

        {/* Sequence Performance */}
        <div className="bg-card border border-border/50 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border/50 flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Sequence Performance</h2>
          </div>
          {sequencePerf.length > 0 ? (
            <div className="divide-y divide-border/30">
              {sequencePerf.map((seq, i) => (
                <div key={i} className="px-6 py-4 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Zap className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-foreground truncate">{seq.name}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ml-2 flex-shrink-0 ${seq.status === "active" ? "bg-green-500/10 text-green-400" : "bg-muted/50 text-muted-foreground"}`}>
                        {seq.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{seq.enrolled} enrolled</span>
                      <span>{seq.completed} completed</span>
                      <span className="text-primary font-semibold">{seq.compRate}% completion</span>
                    </div>
                  </div>
                  <div className="w-16 text-right">
                    <p className="text-lg font-bold text-foreground">{seq.compRate}%</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="px-6 py-12 text-center text-muted-foreground text-sm">
              No sequence data yet. Enroll contacts in sequences to see performance.
            </div>
          )}
        </div>

        {/* Email Funnel */}
        <div className="bg-card border border-border/50 rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-6">
            <Trophy className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Email Funnel</h2>
          </div>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {[
              { label: "Sent", value: emailStats.sent, color: GOLD },
              { label: "Opened", value: emailStats.opened, color: GREEN },
              { label: "Clicked", value: emailStats.clicked, color: BLUE },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="text-center px-6 py-4 rounded-2xl border border-border/50" style={{ borderColor: `${item.color}30`, background: `${item.color}08` }}>
                  <p className="text-3xl font-bold" style={{ color: item.color }}>{item.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.label}</p>
                  {i > 0 && emailStats.sent > 0 && (
                    <p className="text-[10px] mt-1" style={{ color: item.color }}>
                      {Math.round((item.value / emailStats.sent) * 100)}% of sent
                    </p>
                  )}
                </div>
                {i < 2 && <span className="text-muted-foreground text-lg">→</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
