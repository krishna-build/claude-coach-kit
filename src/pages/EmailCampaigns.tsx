import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import Layout from "@/components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Plus,
  Search,
  X,
  Trash2,
  Eye,
  Edit3,
  BarChart3,
  Clock,
  Send,
  FileText,
  ChevronRight,
  Users,
  Copy,
  Zap,
} from "lucide-react";
import { formatDistanceToNow, format, isAfter, addDays, startOfDay } from "date-fns";
import { useToast } from "@/components/Toast";

type CampaignStatus = "all" | "draft" | "sent" | "scheduled";

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted/60 text-muted-foreground border-border/50",
  sent: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  scheduled: "bg-amber-500/15 text-amber-400 border-amber-500/20",
};

const STATUS_ICONS: Record<string, typeof FileText> = {
  draft: FileText,
  sent: Send,
  scheduled: Clock,
};

const filterTabs: { key: CampaignStatus; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "sent", label: "Sent" },
  { key: "scheduled", label: "Scheduled" },
];

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};


export default function EmailCampaigns() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<CampaignStatus>("all");
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ["email-campaigns", filter, search],
    queryFn: async () => {
      let q = supabase
        .from("automation_campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (filter !== "all") q = q.eq("status", filter);
      if (search) q = q.ilike("name", `%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      const campaignList = data || [];

      // Compute live stats from email_log for sent campaigns
      const sentIds = campaignList.filter((c: any) => c.status === "sent").map((c: any) => c.id);
      if (sentIds.length > 0) {
        const { data: logs } = await supabase
          .from("automation_email_log")
          .select("campaign_id, status, opened_at, clicked_at")
          .in("campaign_id", sentIds);
        if (logs) {
          const statsMap: Record<string, any> = {};
          for (const log of logs) {
            if (!statsMap[log.campaign_id]) statsMap[log.campaign_id] = { sent: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 };
            const s = statsMap[log.campaign_id];
            s.sent++;
            if (log.opened_at || log.status === "opened") s.opened++;
            if (log.clicked_at || log.status === "clicked") s.clicked++;
            if (log.status === "bounced") s.bounced++;
            if (log.status === "unsubscribed") s.unsubscribed++;
          }
          for (const c of campaignList) {
            if (statsMap[c.id]) (c as any).stats = statsMap[c.id];
          }
        }
      }
      return campaignList;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("automation_campaigns")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-campaigns"] });
      setDeleteId(null);
    },
  });

  // Duplicate Campaign Mutation (Feature 3)
  const duplicateMutation = useMutation({
    mutationFn: async (campaign: any) => {
      const payload = {
        name: `${campaign.name || "Untitled"} (Copy)`,
        subject: campaign.subject || "",
        preview_text: campaign.preview_text || "",
        body_html: campaign.body_html || "",
        body_blocks: campaign.body_blocks || [],
        recipient_filter: campaign.recipient_filter || {},
        status: "draft",
        recipient_count: campaign.recipient_count || 0,
      };
      const { data, error } = await supabase
        .from("automation_campaigns")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: (newId) => {
      queryClient.invalidateQueries({ queryKey: ["email-campaigns"] });
      navigate(`/campaigns/${newId}`);
    },
  });

  const campaignCount = campaigns?.length || 0;

  const getStats = (c: any) => {
    const stats = c.stats || { sent: 0, opened: 0, clicked: 0, bounced: 0, unsubscribed: 0 };
    return stats;
  };

  return (
    <Layout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Mail className="w-5 h-5 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Email Campaigns</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {campaignCount} campaign{campaignCount !== 1 ? "s" : ""} total
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/campaigns/new")}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-gold-dark text-black text-sm font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow"
          >
            <Plus className="w-4 h-4" /> Create Campaign
          </motion.button>
        </div>

        {/* Search + Filter Tabs */}
        <div className="space-y-3">
          <div className="relative pt-2">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search campaigns..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-12 pl-11 pr-4 rounded-2xl border border-border/50 bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all shadow-sm"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          <div className="flex gap-2 flex-wrap pt-2">
            {filterTabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key)}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-all border ${
                  filter === tab.key
                    ? "bg-primary/15 text-primary border-primary/30 shadow-sm"
                    : "bg-surface text-muted-foreground border-border/50 hover:bg-surface-hover hover:text-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Campaign List */}
        {isLoading ? (
          <div className="grid gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-card rounded-2xl border border-border/50 p-5 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-muted" />
                  <div className="flex-1">
                    <div className="h-4 bg-muted rounded w-48 mb-2" />
                    <div className="h-3 bg-muted/50 rounded w-64" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : campaignCount === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card rounded-2xl border border-border/50 p-16 text-center mt-2"
          >
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Mail className="w-8 h-8 text-primary/40" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              No campaigns yet
            </h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Create your first email campaign to start reaching your audience with beautiful, branded emails.
            </p>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/campaigns/new")}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-gold-dark text-black text-sm font-semibold shadow-lg shadow-primary/20 mt-2"
            >
              <Plus className="w-4 h-4" /> Create Your First Campaign
            </motion.button>
          </motion.div>
        ) : (
          <div className="grid gap-3">
            <AnimatePresence mode="popLayout">
              {campaigns!.map((campaign: any, idx: number) => {
                const stats = getStats(campaign);
                const StatusIcon = STATUS_ICONS[campaign.status] || FileText;
                const openRate = stats.sent > 0 ? Math.round((stats.opened / stats.sent) * 100) : 0;
                const clickRate = stats.sent > 0 ? Math.round((stats.clicked / stats.sent) * 100) : 0;

                return (
                  <motion.div
                    key={campaign.id}
                    custom={idx}
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                    exit={{ opacity: 0, x: -20 }}
                    className="bg-card rounded-2xl border border-border/50 p-5 hover:border-primary/30 transition-all cursor-pointer shadow-sm group"
                    onClick={() => navigate(`/campaigns/${campaign.id}`)}
                  >
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        campaign.status === "sent"
                          ? "bg-gradient-to-br from-emerald-500/20 to-emerald-500/5"
                          : campaign.status === "scheduled"
                          ? "bg-gradient-to-br from-amber-500/20 to-amber-500/5"
                          : "bg-gradient-to-br from-primary/20 to-primary/5"
                      }`}>
                        <StatusIcon className={`w-5 h-5 ${
                          campaign.status === "sent"
                            ? "text-emerald-400"
                            : campaign.status === "scheduled"
                            ? "text-amber-400"
                            : "text-primary"
                        }`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {campaign.name || "Untitled Campaign"}
                          </h3>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border capitalize ${STATUS_STYLES[campaign.status] || STATUS_STYLES.draft}`}>
                            {campaign.status}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate mb-2">
                          {campaign.subject || "No subject line"}
                        </p>

                        {/* Stats Row */}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {campaign.status === "sent" && (
                            <>
                              <span className="flex items-center gap-1">
                                <Send className="w-3 h-3" /> {stats.sent} sent
                              </span>
                              <span className="flex items-center gap-1">
                                <Eye className="w-3 h-3" /> {openRate}% opened
                              </span>
                              <span className="flex items-center gap-1">
                                <BarChart3 className="w-3 h-3" /> {clickRate}% clicked
                              </span>
                            </>
                          )}
                          {campaign.recipient_count > 0 && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" /> {campaign.recipient_count} recipients
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {campaign.status === "scheduled" && campaign.scheduled_at
                              ? `Scheduled: ${new Date(campaign.scheduled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
                              : campaign.status === "sent" && campaign.sent_at
                              ? `Sent: ${new Date(campaign.sent_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                              : `Created: ${new Date(campaign.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        {campaign.status === "draft" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/campaigns/${campaign.id}`); }}
                            className="w-9 h-9 rounded-xl bg-surface hover:bg-surface-hover flex items-center justify-center transition-colors"
                            title="Edit"
                          >
                            <Edit3 className="w-4 h-4 text-muted-foreground" />
                          </button>
                        )}
                        {/* Duplicate Button (Feature 3) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateMutation.mutate(campaign);
                          }}
                          disabled={duplicateMutation.isPending}
                          className="w-9 h-9 rounded-xl bg-surface hover:bg-primary/10 flex items-center justify-center transition-colors"
                          title="Duplicate campaign"
                        >
                          <Copy className="w-4 h-4 text-muted-foreground hover:text-primary" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteId(campaign.id); }}
                          className="w-9 h-9 rounded-xl bg-surface hover:bg-danger/10 flex items-center justify-center transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground hover:text-danger" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {deleteId && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => setDeleteId(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-card rounded-2xl border border-border/50 p-6 max-w-sm w-full shadow-2xl"
              >
                <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-danger/10 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-danger" />
                </div>
                <h3 className="text-lg font-semibold text-foreground text-center mb-2">
                  Delete Campaign?
                </h3>
                <p className="text-sm text-muted-foreground text-center mb-6">
                  This action cannot be undone. The campaign and all its data will be permanently deleted.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setDeleteId(null)}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-surface border border-border/50 text-sm font-medium text-foreground hover:bg-surface-hover transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(deleteId)}
                    disabled={deleteMutation.isPending}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-danger text-white text-sm font-medium hover:bg-danger/90 transition-colors disabled:opacity-50"
                  >
                    {deleteMutation.isPending ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Layout>
  );
}
