import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import Layout from "@/components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import {
  Workflow,
  Plus,
  Search,
  Trash2,
  Edit3,
  Copy,
  Play,
  Pause,
  Users,
  CheckCircle2,
  Activity,
  Zap,
  Mail,
  Clock,
  GitBranch,
  Tag,
  X,
  Sparkles,
  ArrowRight,
  FileText,
} from "lucide-react";

/* ─── Types ─── */
interface WorkflowRow {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "active" | "paused";
  trigger_type: string | null;
  trigger_config: Record<string, unknown>;
  nodes: WorkflowNode[];
  edges: unknown[];
  stats: { enrolled: number; completed: number; active: number };
  created_at: string;
  updated_at: string;
}

interface WorkflowNode {
  id: string;
  type: string;
  config: Record<string, unknown>;
  position: number;
}

type FilterTab = "all" | "active" | "paused" | "draft";

/* ─── Templates ─── */
const WORKFLOW_TEMPLATES = [
  {
    id: "welcome",
    name: "Welcome Series",
    description: "Greet new contacts with a warm welcome email, wait 2 days, then send a follow-up.",
    icon: Mail,
    color: "#10b981",
    trigger: "contYOUR_AD_ACCOUNT_IDcreated",
    nodes: [
      { id: "1", type: "trigger", config: { triggerType: "contYOUR_AD_ACCOUNT_IDcreated", label: "New Contact Created" }, position: 0 },
      { id: "2", type: "action", config: { actionType: "send_email", subject: "Welcome to Your Business!", label: "Send Welcome Email" }, position: 1 },
      { id: "3", type: "delay", config: { delayType: "days", delayValue: 2, label: "Wait 2 Days" }, position: 2 },
      { id: "4", type: "condition", config: { field: "email_opened", operator: "equals", value: "true", label: "Email Opened?" }, position: 3 },
      { id: "5a", type: "action", config: { actionType: "send_email", subject: "Your next step to abundance", branch: "yes", label: "Send Follow-up" }, position: 4 },
      { id: "5b", type: "action", config: { actionType: "send_email", subject: "Did you see our welcome email?", branch: "no", label: "Send Reminder" }, position: 4 },
    ],
  },
  {
    id: "payment",
    name: "Payment Follow-up",
    description: "When someone pays ₹299, send a thank you, wait 1 day, then offer an upsell.",
    icon: Zap,
    color: "#3b82f6",
    trigger: "tag_added",
    nodes: [
      { id: "1", type: "trigger", config: { triggerType: "tag_added", tagName: "paid-299", label: "Tag 'paid-299' Added" }, position: 0 },
      { id: "2", type: "action", config: { actionType: "send_email", subject: "Thank you for your purchase!", label: "Send Thank You" }, position: 1 },
      { id: "3", type: "delay", config: { delayType: "days", delayValue: 1, label: "Wait 1 Day" }, position: 2 },
      { id: "4", type: "action", config: { actionType: "send_email", subject: "Ready for the next level?", label: "Send Upsell Email" }, position: 3 },
    ],
  },
  {
    id: "reengagement",
    name: "Re-engagement",
    description: "Win back inactive contacts — send a 'we miss you' email, then offer a discount if no response.",
    icon: Activity,
    color: "#f59e0b",
    trigger: "no_activity",
    nodes: [
      { id: "1", type: "trigger", config: { triggerType: "no_activity", days: 7, label: "No Activity for 7 Days" }, position: 0 },
      { id: "2", type: "action", config: { actionType: "send_email", subject: "We miss you!", label: "Send 'We Miss You'" }, position: 1 },
      { id: "3", type: "delay", config: { delayType: "days", delayValue: 3, label: "Wait 3 Days" }, position: 2 },
      { id: "4", type: "condition", config: { field: "email_opened", operator: "equals", value: "false", label: "Email Not Opened?" }, position: 3 },
      { id: "5a", type: "action", config: { actionType: "send_email", subject: "Here's 20% off — just for you", branch: "yes", label: "Send Discount" }, position: 4 },
      { id: "5b", type: "action", config: { actionType: "add_tag", tagName: "re-engaged", branch: "no", label: "Tag as Re-engaged" }, position: 4 },
    ],
  },
  {
    id: "call-booking",
    name: "Call Booking Nurture",
    description: "Prepare contacts for their booked call and follow up after with next steps.",
    icon: GitBranch,
    color: "#8b5cf6",
    trigger: "tag_added",
    nodes: [
      { id: "1", type: "trigger", config: { triggerType: "tag_added", tagName: "call-booked", label: "Tag 'call-booked' Added" }, position: 0 },
      { id: "2", type: "action", config: { actionType: "send_email", subject: "How to prepare for your call", label: "Send Preparation Email" }, position: 1 },
      { id: "3", type: "delay", config: { delayType: "days", delayValue: 1, label: "Wait Until Call Date" }, position: 2 },
      { id: "4", type: "action", config: { actionType: "send_email", subject: "Great talking to you — next steps", label: "Send Follow-up" }, position: 3 },
    ],
  },
];

const STATUS_STYLES: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  paused: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  draft: "bg-muted/60 text-muted-foreground border-border/50",
};

const STATUS_ICONS: Record<string, typeof Play> = {
  active: Play,
  paused: Pause,
  draft: FileText,
};

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "paused", label: "Paused" },
  { key: "draft", label: "Drafts" },
];

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};


export default function AutomationWorkflows() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: workflows, isLoading } = useQuery({
    queryKey: ["automation-workflows", filter, search],
    queryFn: async () => {
      let q = supabase
        .from("automation_workflows")
        .select("*")
        .order("updated_at", { ascending: false });
      if (filter !== "all") q = q.eq("status", filter);
      if (search) q = q.ilike("name", `%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as WorkflowRow[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("automation_workflows").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-workflows"] });
      setDeleteId(null);
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (wf: WorkflowRow) => {
      const { error } = await supabase.from("automation_workflows").insert({
        name: `${wf.name} (Copy)`,
        description: wf.description,
        status: "draft",
        trigger_type: wf.trigger_type,
        trigger_config: wf.trigger_config,
        nodes: wf.nodes,
        edges: wf.edges,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automation-workflows"] }),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const newStatus = status === "active" ? "paused" : "active";
      const { error } = await supabase.from("automation_workflows").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automation-workflows"] }),
  });

  const createFromTemplate = async (template: (typeof WORKFLOW_TEMPLATES)[number] | null) => {
    const payload = template
      ? {
          name: template.name,
          description: template.description,
          trigger_type: template.trigger,
          nodes: template.nodes,
          edges: [],
          status: "draft" as const,
        }
      : { name: "Untitled Workflow", status: "draft" as const, nodes: [], edges: [] };

    const { data, error } = await supabase.from("automation_workflows").insert(payload).select("id").single();
    if (error) throw error;
    setShowTemplates(false);
    navigate(`/workflows/${data.id}`);
  };

  const total = workflows?.length ?? 0;

  return (
    <Layout>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-gold-dark flex items-center justify-center shadow-lg shadow-primary/20">
              <Workflow className="w-5 h-5 text-white" />
            </div>
            Automation Workflows
            <span className="ml-2 px-2.5 py-0.5 text-xs font-medium bg-primary/15 text-primary border border-primary/20 rounded-full">
              {total}
            </span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Build visual automations to nurture contacts on autopilot
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowTemplates(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-gold-dark text-black text-sm font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-shadow"
        >
          <Plus className="w-4 h-4" />
          Create Workflow
        </motion.button>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex bg-card rounded-xl border border-border/50 p-1 gap-0.5">
          {FILTER_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === t.key
                  ? "bg-primary/15 text-primary shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search workflows…"
            className="w-full pl-10 pr-4 py-2 bg-card border border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
          />
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-48 rounded-2xl bg-card border border-border/50 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && total === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-6">
            <Workflow className="w-10 h-10 text-primary/60" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">No workflows yet</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            Create your first automation workflow to start nurturing contacts on autopilot.
          </p>
          <button
            onClick={() => setShowTemplates(true)}
            className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-primary to-gold-dark text-black text-sm font-semibold shadow-lg shadow-primary/25"
          >
            <Plus className="w-4 h-4 inline mr-1" />
            Create Your First Workflow
          </button>
        </motion.div>
      )}

      {/* Workflow Cards */}
      {!isLoading && total > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {workflows!.map((wf, i) => {
            const StatusIcon = STATUS_ICONS[wf.status] || FileText;
            return (
              <motion.div
                key={wf.id}
                custom={i}
                initial="hidden"
                animate="visible"
                variants={cardVariants}
                className="group bg-card rounded-2xl border border-border/50 hover:border-primary/30 transition-all duration-300 overflow-hidden hover:shadow-lg hover:shadow-primary/5"
              >
                {/* Status bar top */}
                <div
                  className="h-1"
                  style={{
                    background:
                      wf.status === "active"
                        ? "#10b981"
                        : wf.status === "paused"
                        ? "#f59e0b"
                        : "var(--color-border)",
                  }}
                />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-foreground truncate">{wf.name}</h3>
                      {wf.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{wf.description}</p>
                      )}
                    </div>
                    <span
                      className={`ml-3 px-2.5 py-1 text-[10px] font-semibold uppercase rounded-full border flex items-center gap-1 whitespace-nowrap ${STATUS_STYLES[wf.status]}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {wf.status}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-surface rounded-xl p-2.5 text-center">
                      <Users className="w-3.5 h-3.5 text-blue-400 mx-auto mb-1" />
                      <p className="text-sm font-bold text-foreground">{wf.stats?.enrolled ?? 0}</p>
                      <p className="text-[10px] text-muted-foreground">Enrolled</p>
                    </div>
                    <div className="bg-surface rounded-xl p-2.5 text-center">
                      <Activity className="w-3.5 h-3.5 text-amber-400 mx-auto mb-1" />
                      <p className="text-sm font-bold text-foreground">{wf.stats?.active ?? 0}</p>
                      <p className="text-[10px] text-muted-foreground">Active</p>
                    </div>
                    <div className="bg-surface rounded-xl p-2.5 text-center">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mx-auto mb-1" />
                      <p className="text-sm font-bold text-foreground">{wf.stats?.completed ?? 0}</p>
                      <p className="text-[10px] text-muted-foreground">Done</p>
                    </div>
                  </div>

                  {/* Node count */}
                  <p className="text-[10px] text-muted-foreground mb-3">
                    {(wf.nodes as unknown[])?.length || 0} steps · Updated{" "}
                    {new Date(wf.updated_at).toLocaleDateString()}
                  </p>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleStatusMutation.mutate({ id: wf.id, status: wf.status })}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                        wf.status === "active"
                          ? "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"
                          : "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                      }`}
                    >
                      {wf.status === "active" ? (
                        <>
                          <Pause className="w-3.5 h-3.5" /> Pause
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5" /> Activate
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => navigate(`/workflows/${wf.id}`)}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium bg-primary/15 text-primary hover:bg-primary/25 transition-all"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit
                    </button>
                    <button
                      onClick={() => duplicateMutation.mutate(wf)}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface hover:bg-surface-hover text-muted-foreground hover:text-foreground transition-all"
                      title="Duplicate"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteId(wf.id)}
                      className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface hover:bg-red-500/15 text-muted-foreground hover:text-red-400 transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Template Picker Modal */}
      <AnimatePresence>
        {showTemplates && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowTemplates(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-2xl border border-border/50 shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-auto"
            >
              <div className="p-6 border-b border-border/50 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-primary" />
                    Create New Workflow
                  </h2>
                  <p className="text-xs text-muted-foreground mt-1">
                    Start from scratch or use a template
                  </p>
                </div>
                <button
                  onClick={() => setShowTemplates(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface hover:bg-surface-hover transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <div className="p-6 space-y-3">
                {/* Blank */}
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => createFromTemplate(null)}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-dashed border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-all text-left group"
                >
                  <div className="w-12 h-12 rounded-xl bg-surface flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                    <Plus className="w-6 h-6 text-muted-foreground group-hover:text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">Start from scratch</p>
                    <p className="text-xs text-muted-foreground">Build a custom workflow from the ground up</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </motion.button>

                {/* Templates */}
                {WORKFLOW_TEMPLATES.map((t) => {
                  const Icon = t.icon;
                  return (
                    <motion.button
                      key={t.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => createFromTemplate(t)}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border/50 hover:border-primary/30 hover:bg-card transition-all text-left group"
                    >
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ background: `${t.color}20` }}
                      >
                        <Icon className="w-6 h-6" style={{ color: t.color }} />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.description}</p>
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {deleteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setDeleteId(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-2xl border border-border/50 shadow-2xl p-6 max-w-sm w-full"
            >
              <div className="w-12 h-12 rounded-2xl bg-red-500/15 flex items-center justify-center mb-4 mx-auto">
                <Trash2 className="w-6 h-6 text-red-400" />
              </div>
              <h3 className="text-base font-semibold text-foreground text-center mb-1">
                Delete Workflow?
              </h3>
              <p className="text-xs text-muted-foreground text-center mb-6">
                This action cannot be undone. All workflow data will be permanently removed.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteId(null)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-surface text-sm font-medium text-foreground hover:bg-surface-hover transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-red-500/15 text-sm font-medium text-red-400 hover:bg-red-500/25 transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
