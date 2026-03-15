import { useState, useCallback, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Save,
  Play,
  Pause,
  Plus,
  X,
  Trash2,
  Zap,
  Mail,
  Tag,
  Clock,
  GitBranch,
  UserPlus,
  FileText,
  Bell,
  Users,
  CreditCard,
  Timer,
  CalendarClock,
  UserCheck,
  ArrowDownCircle,
  ChevronDown,
  ChevronRight,
  Pencil,
  Kanban,
  Settings2,
  Workflow,
} from "lucide-react";

/* ================================================================
   TYPE DEFINITIONS
   ================================================================ */

interface WorkflowNode {
  id: string;
  type: "trigger" | "action" | "condition" | "delay" | "timing";
  config: Record<string, unknown>;
  position: number;
}

interface WorkflowData {
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

/* ================================================================
   NODE TYPE DEFINITIONS
   ================================================================ */

interface NodeTypeDef {
  key: string;
  label: string;
  icon: typeof Zap;
  color: string;
  category: "trigger" | "action" | "condition" | "timing";
  defaultConfig: Record<string, unknown>;
}

const NODE_TYPES: NodeTypeDef[] = [
  // Triggers
  { key: "contYOUR_AD_ACCOUNT_IDcreated", label: "Contact Created", icon: UserPlus, color: "#10b981", category: "trigger", defaultConfig: { triggerType: "contYOUR_AD_ACCOUNT_IDcreated", label: "New Contact Created" } },
  { key: "tag_added", label: "Tag Added", icon: Tag, color: "#10b981", category: "trigger", defaultConfig: { triggerType: "tag_added", tagName: "", label: "Tag Added" } },
  { key: "form_submitted", label: "Form Submitted", icon: FileText, color: "#10b981", category: "trigger", defaultConfig: { triggerType: "form_submitted", formName: "", label: "Form Submitted" } },
  { key: "payment_received", label: "Payment Received", icon: CreditCard, color: "#10b981", category: "trigger", defaultConfig: { triggerType: "payment_received", label: "Payment Received" } },
  { key: "manual_enrollment", label: "Manual Enrollment", icon: UserCheck, color: "#10b981", category: "trigger", defaultConfig: { triggerType: "manual_enrollment", label: "Manual Enrollment" } },
  // Actions
  { key: "send_email", label: "Send Email", icon: Mail, color: "#3b82f6", category: "action", defaultConfig: { actionType: "send_email", subject: "", body: "", label: "Send Email" } },
  { key: "add_tag", label: "Add Tag", icon: Tag, color: "#3b82f6", category: "action", defaultConfig: { actionType: "add_tag", tagName: "", label: "Add Tag" } },
  { key: "remove_tag", label: "Remove Tag", icon: Tag, color: "#3b82f6", category: "action", defaultConfig: { actionType: "remove_tag", tagName: "", label: "Remove Tag" } },
  { key: "move_pipeline", label: "Move to Stage", icon: Kanban, color: "#3b82f6", category: "action", defaultConfig: { actionType: "move_pipeline", stage: "", label: "Move to Pipeline Stage" } },
  { key: "send_notification", label: "Send Notification", icon: Bell, color: "#3b82f6", category: "action", defaultConfig: { actionType: "send_notification", message: "", label: "Send Notification" } },
  { key: "update_contact", label: "Update Contact", icon: Users, color: "#3b82f6", category: "action", defaultConfig: { actionType: "update_contact", field: "", value: "", label: "Update Contact" } },
  // Conditions
  { key: "if_else", label: "If/Else", icon: GitBranch, color: "#f59e0b", category: "condition", defaultConfig: { field: "tag", operator: "equals", value: "", label: "If/Else Condition" } },
  { key: "wait", label: "Wait", icon: Clock, color: "#f59e0b", category: "condition", defaultConfig: { delayType: "hours", delayValue: 1, label: "Wait" } },
  { key: "wait_until", label: "Wait Until", icon: CalendarClock, color: "#f59e0b", category: "condition", defaultConfig: { waitType: "date", date: "", label: "Wait Until" } },
  // Timing
  { key: "delay", label: "Delay", icon: Timer, color: "#8b5cf6", category: "timing", defaultConfig: { delayType: "days", delayValue: 1, label: "Delay" } },
  { key: "time_window", label: "Time Window", icon: CalendarClock, color: "#8b5cf6", category: "timing", defaultConfig: { startHour: 9, endHour: 17, label: "Time Window (9am–5pm)" } },
];

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  trigger: { label: "Triggers", color: "#10b981" },
  action: { label: "Actions", color: "#3b82f6" },
  condition: { label: "Conditions", color: "#f59e0b" },
  timing: { label: "Timing", color: "#8b5cf6" },
};

const CONDITION_FIELDS = [
  { key: "tag", label: "Has Tag" },
  { key: "email_opened", label: "Email Opened" },
  { key: "email_clicked", label: "Email Clicked" },
  { key: "pipeline_stage", label: "Pipeline Stage" },
  { key: "payment_status", label: "Payment Status" },
];

const CONDITION_OPERATORS = [
  { key: "equals", label: "equals" },
  { key: "not_equals", label: "does not equal" },
  { key: "contains", label: "contains" },
  { key: "greater_than", label: "greater than" },
];

function getNodeTypeDef(node: WorkflowNode): NodeTypeDef | undefined {
  const configType = (node.config?.triggerType || node.config?.actionType || "") as string;
  return NODE_TYPES.find((t) => t.key === configType || t.key === node.type) ?? NODE_TYPES.find((t) => t.category === node.type);
}

function getNodeLabel(node: WorkflowNode): string {
  const label = node.config?.label as string;
  if (label) return label;
  const def = getNodeTypeDef(node);
  return def?.label ?? node.type;
}

function getNodeSummary(node: WorkflowNode): string {
  const c = node.config;
  if (c.subject) return c.subject as string;
  if (c.tagName) return `Tag: ${c.tagName}`;
  if (c.delayValue) return `${c.delayValue} ${c.delayType || "days"}`;
  if (c.field && c.operator) return `${c.field} ${c.operator} ${c.value || "…"}`;
  if (c.stage) return `Stage: ${c.stage}`;
  if (c.message) return String(c.message).slice(0, 40);
  if (c.formName) return `Form: ${c.formName}`;
  if (c.startHour !== undefined) return `${c.startHour}:00 – ${c.endHour}:00`;
  return "";
}

function getNodeColor(node: WorkflowNode): string {
  const def = getNodeTypeDef(node);
  return def?.color ?? "#6b7280";
}

function getNodeIcon(node: WorkflowNode) {
  const def = getNodeTypeDef(node);
  return def?.icon ?? Zap;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/* ================================================================
   MAIN COMPONENT
   ================================================================ */

export default function WorkflowBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState("Untitled Workflow");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"draft" | "active" | "paused">("draft");
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showPalette, setShowPalette] = useState(true);
  const [addAtIndex, setAddAtIndex] = useState<{ position: number; branch?: string } | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  /* ─── Fetch workflow ─── */
  const { isLoading } = useQuery({
    queryKey: ["workflow", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from("automation_workflows").select("*").eq("id", id).single();
      if (error) throw error;
      return data as WorkflowData;
    },
    enabled: !!id,
  });

  /* ─── Populate state from fetched data ─── */
  const { data: workflow } = useQuery<WorkflowData | null>({
    queryKey: ["workflow", id],
    enabled: false,
  });

  useEffect(() => {
    if (workflow) {
      setName(workflow.name);
      setDescription(workflow.description || "");
      setStatus(workflow.status);
      setNodes(workflow.nodes || []);
      setDirty(false);
    }
  }, [workflow]);

  /* ─── Save ─── */
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;
      const triggerNode = nodes.find((n) => n.type === "trigger");
      const { error } = await supabase
        .from("automation_workflows")
        .update({
          name,
          description: description || null,
          status,
          trigger_type: (triggerNode?.config?.triggerType as string) || null,
          trigger_config: triggerNode?.config || {},
          nodes,
          edges: [],
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["workflow", id] });
      queryClient.invalidateQueries({ queryKey: ["automation-workflows"] });
    },
  });

  /* ─── Toggle status ─── */
  const toggleStatus = useCallback(() => {
    setStatus((s) => {
      const next = s === "active" ? "paused" : "active";
      setDirty(true);
      return next;
    });
  }, []);

  /* ─── Node operations ─── */
  const addNode = useCallback(
    (typeDef: NodeTypeDef, position: number, branch?: string) => {
      const newNode: WorkflowNode = {
        id: generateId(),
        type: typeDef.category === "timing" ? "delay" : typeDef.category,
        config: { ...typeDef.defaultConfig, ...(branch ? { branch } : {}) },
        position,
      };
      setNodes((prev) => {
        const updated = prev.map((n) =>
          n.position >= position && !n.config.branch ? { ...n, position: n.position + 1 } : n
        );
        return [...updated, newNode].sort((a, b) => a.position - b.position);
      });
      setDirty(true);
      setAddAtIndex(null);
      setSelectedNodeId(newNode.id);
    },
    []
  );

  const deleteNode = useCallback(
    (nodeId: string) => {
      setNodes((prev) => prev.filter((n) => n.id !== nodeId));
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
      setDirty(true);
    },
    [selectedNodeId]
  );

  const updateNodeConfig = useCallback((nodeId: string, updates: Record<string, unknown>) => {
    setNodes((prev) =>
      prev.map((n) => (n.id === nodeId ? { ...n, config: { ...n.config, ...updates } } : n))
    );
    setDirty(true);
  }, []);

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedNodeId) ?? null, [nodes, selectedNodeId]);

  /* ─── Build tree structure for rendering ─── */
  interface TreeNode {
    node: WorkflowNode;
    children: TreeNode[];
    yesBranch: TreeNode[];
    noBranch: TreeNode[];
    isCondition: boolean;
  }

  const tree = useMemo(() => {
    const sorted = [...nodes].sort((a, b) => a.position - b.position);
    const result: TreeNode[] = [];
    let i = 0;

    while (i < sorted.length) {
      const node = sorted[i];
      const isCondition =
        node.type === "condition" && (node.config.field || node.config.triggerType !== "wait_until");

      if (isCondition && node.config.field) {
        // Collect yes/no branches
        const yesBranch: TreeNode[] = [];
        const noBranch: TreeNode[] = [];
        let j = i + 1;
        while (j < sorted.length && sorted[j].config.branch) {
          const bNode = sorted[j];
          const target = bNode.config.branch === "yes" ? yesBranch : noBranch;
          target.push({ node: bNode, children: [], yesBranch: [], noBranch: [], isCondition: false });
          j++;
        }
        result.push({ node, children: [], yesBranch, noBranch, isCondition: true });
        i = j;
      } else {
        result.push({ node, children: [], yesBranch: [], noBranch: [], isCondition: false });
        i++;
      }
    }
    return result;
  }, [nodes]);

  /* ─── Keyboard shortcut ─── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveMutation.mutate();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [saveMutation]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  /* ================================================================
     RENDER
     ================================================================ */

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* ─── TOP BAR ─── */}
      <header className="h-14 flex-shrink-0 bg-card border-b border-border/50 flex items-center px-4 gap-3 z-20">
        <button
          onClick={() => navigate("/workflows")}
          className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface hover:bg-surface-hover transition-colors"
        >
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Name */}
        {editingName ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => { setName(e.target.value); setDirty(true); }}
            onBlur={() => setEditingName(false)}
            onKeyDown={(e) => e.key === "Enter" && setEditingName(false)}
            className="text-sm font-semibold text-foreground bg-transparent border-b border-primary/50 outline-none px-1 py-0.5 max-w-[200px]"
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className="text-sm font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-1.5 truncate max-w-[200px]"
          >
            {name}
            <Pencil className="w-3 h-3 text-muted-foreground" />
          </button>
        )}

        {/* Status badge */}
        <span
          className={`px-2 py-0.5 text-[10px] font-semibold uppercase rounded-full border ${
            status === "active"
              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
              : status === "paused"
              ? "bg-amber-500/15 text-amber-400 border-amber-500/20"
              : "bg-muted/60 text-muted-foreground border-border/50"
          }`}
        >
          {status}
        </span>

        {dirty && (
          <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
            Unsaved
          </span>
        )}

        <div className="flex-1" />

        {/* Toggle Status */}
        <button
          onClick={toggleStatus}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            status === "active"
              ? "bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"
              : "bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
          }`}
        >
          {status === "active" ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          {status === "active" ? "Pause" : "Activate"}
        </button>

        {/* Save */}
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-primary to-gold-dark text-black text-xs font-semibold shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all disabled:opacity-60"
        >
          <Save className="w-3.5 h-3.5" />
          {saveMutation.isPending ? "Saving…" : "Save"}
        </button>
      </header>

      {/* ─── BODY ─── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ─── LEFT SIDEBAR: NODE PALETTE ─── */}
        {!isMobile && (
          <AnimatePresence>
            {showPalette && (
              <motion.aside
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 260, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex-shrink-0 bg-card border-r border-border/50 overflow-y-auto overflow-x-hidden"
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
                      Add Nodes
                    </h3>
                    <button
                      onClick={() => setShowPalette(false)}
                      className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-surface-hover"
                    >
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>

                  {(["trigger", "action", "condition", "timing"] as const).map((cat) => {
                    const meta = CATEGORY_META[cat];
                    const items = NODE_TYPES.filter((t) => t.category === cat);
                    return (
                      <div key={cat} className="mb-5">
                        <p
                          className="text-[10px] font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5"
                          style={{ color: meta.color }}
                        >
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: meta.color }}
                          />
                          {meta.label}
                        </p>
                        <div className="space-y-1">
                          {items.map((nt) => {
                            const Icon = nt.icon;
                            return (
                              <motion.button
                                key={nt.key}
                                whileHover={{ x: 3, scale: 1.01 }}
                                whileTap={{ scale: 0.97 }}
                                onClick={() => {
                                  const pos = nodes.length > 0 ? Math.max(...nodes.map((n) => n.position)) + 1 : 0;
                                  addNode(nt, pos);
                                }}
                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-all group"
                                style={{ borderLeft: `3px solid ${nt.color}30` }}
                              >
                                <div
                                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                                  style={{ background: `${nt.color}15` }}
                                >
                                  <Icon className="w-3.5 h-3.5" style={{ color: nt.color }} />
                                </div>
                                <span className="truncate">{nt.label}</span>
                              </motion.button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        )}

        {/* Toggle palette button when hidden */}
        {!showPalette && !isMobile && (
          <button
            onClick={() => setShowPalette(true)}
            className="flex-shrink-0 w-10 bg-card border-r border-border/50 flex items-center justify-center hover:bg-surface-hover transition-colors"
            title="Show node palette"
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        )}

        {/* ─── CENTER: CANVAS ─── */}
        <div
          className="flex-1 overflow-auto relative"
          style={{
            backgroundImage:
              "radial-gradient(circle, var(--color-border) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
          onClick={() => {
            setSelectedNodeId(null);
            setAddAtIndex(null);
          }}
        >
          <div className="min-h-full flex flex-col items-center py-10 px-4">
            {/* Empty state */}
            {nodes.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center text-center mt-20"
              >
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <Workflow className="w-8 h-8 text-primary/50" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">Start building your workflow</h3>
                <p className="text-xs text-muted-foreground mb-4 max-w-xs">
                  Add a trigger from the left panel to begin, or click the button below.
                </p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const triggerDef = NODE_TYPES.find((t) => t.key === "contYOUR_AD_ACCOUNT_IDcreated")!;
                    addNode(triggerDef, 0);
                  }}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-gold-dark text-black text-xs font-semibold shadow-lg shadow-primary/25"
                >
                  <Plus className="w-3.5 h-3.5 inline mr-1" />
                  Add Trigger
                </button>
              </motion.div>
            )}

            {/* Rendered tree */}
            {tree.map((treeNode, idx) => (
              <div key={treeNode.node.id} className="flex flex-col items-center w-full max-w-2xl">
                {/* Connector line from previous */}
                {idx > 0 && <ConnectorLine />}

                {/* Add button between nodes */}
                {idx > 0 && (
                  <AddStepButton
                    onClick={(e) => {
                      e.stopPropagation();
                      setAddAtIndex({ position: treeNode.node.position });
                    }}
                  />
                )}
                {idx > 0 && <ConnectorLine />}

                {/* The node */}
                <NodeCard
                  node={treeNode.node}
                  selected={selectedNodeId === treeNode.node.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedNodeId(treeNode.node.id);
                  }}
                  onDelete={() => deleteNode(treeNode.node.id)}
                />

                {/* If/Else branches */}
                {treeNode.isCondition && (
                  <>
                    <ConnectorLine />
                    <div className="flex gap-6 sm:gap-12 w-full justify-center">
                      {/* YES branch */}
                      <div className="flex flex-col items-center flex-1 max-w-[280px]">
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-[10px] font-bold uppercase text-emerald-400 tracking-wider">
                            Yes
                          </span>
                        </div>
                        <div className="w-0.5 h-4 bg-emerald-500/40" />
                        {treeNode.yesBranch.map((yb, yi) => (
                          <div key={yb.node.id} className="flex flex-col items-center w-full">
                            {yi > 0 && <div className="w-0.5 h-4 bg-emerald-500/30" />}
                            <NodeCard
                              node={yb.node}
                              selected={selectedNodeId === yb.node.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedNodeId(yb.node.id);
                              }}
                              onDelete={() => deleteNode(yb.node.id)}
                              compact
                            />
                          </div>
                        ))}
                        <div className="w-0.5 h-3 bg-emerald-500/20" />
                        <AddStepButton
                          small
                          onClick={(e) => {
                            e.stopPropagation();
                            setAddAtIndex({ position: treeNode.node.position + 1, branch: "yes" });
                          }}
                        />
                      </div>

                      {/* NO branch */}
                      <div className="flex flex-col items-center flex-1 max-w-[280px]">
                        <div className="flex items-center gap-1.5 mb-2">
                          <span className="w-2 h-2 rounded-full bg-red-500" />
                          <span className="text-[10px] font-bold uppercase text-red-400 tracking-wider">
                            No
                          </span>
                        </div>
                        <div className="w-0.5 h-4 bg-red-500/40" />
                        {treeNode.noBranch.map((nb, ni) => (
                          <div key={nb.node.id} className="flex flex-col items-center w-full">
                            {ni > 0 && <div className="w-0.5 h-4 bg-red-500/30" />}
                            <NodeCard
                              node={nb.node}
                              selected={selectedNodeId === nb.node.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedNodeId(nb.node.id);
                              }}
                              onDelete={() => deleteNode(nb.node.id)}
                              compact
                            />
                          </div>
                        ))}
                        <div className="w-0.5 h-3 bg-red-500/20" />
                        <AddStepButton
                          small
                          onClick={(e) => {
                            e.stopPropagation();
                            setAddAtIndex({ position: treeNode.node.position + 1, branch: "no" });
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}

            {/* Final add button */}
            {nodes.length > 0 && !tree[tree.length - 1]?.isCondition && (
              <>
                <ConnectorLine />
                <AddStepButton
                  onClick={(e) => {
                    e.stopPropagation();
                    const maxPos = Math.max(...nodes.map((n) => n.position), -1) + 1;
                    setAddAtIndex({ position: maxPos });
                  }}
                />
              </>
            )}

            {/* Bottom padding */}
            <div className="h-20" />
          </div>

          {/* ─── ADD NODE PICKER POPUP ─── */}
          <AnimatePresence>
            {addAtIndex !== null && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 backdrop-blur-sm"
                onClick={() => setAddAtIndex(null)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 20 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-card rounded-2xl border border-border/50 shadow-2xl max-w-sm w-full mx-4 max-h-[70vh] overflow-auto"
                >
                  <div className="p-4 border-b border-border/50 flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground">Add Step</h3>
                    <button onClick={() => setAddAtIndex(null)} className="w-6 h-6 rounded-md flex items-center justify-center hover:bg-surface-hover">
                      <X className="w-3.5 h-3.5 text-muted-foreground" />
                    </button>
                  </div>
                  <div className="p-3 space-y-3">
                    {(["trigger", "action", "condition", "timing"] as const)
                      .filter((cat) => !(cat === "trigger" && nodes.some((n) => n.type === "trigger")))
                      .map((cat) => {
                        const meta = CATEGORY_META[cat];
                        const items = NODE_TYPES.filter((t) => t.category === cat);
                        return (
                          <div key={cat}>
                            <p
                              className="text-[10px] font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1"
                              style={{ color: meta.color }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />
                              {meta.label}
                            </p>
                            <div className="grid grid-cols-2 gap-1.5">
                              {items.map((nt) => {
                                const Icon = nt.icon;
                                return (
                                  <button
                                    key={nt.key}
                                    onClick={() => addNode(nt, addAtIndex.position, addAtIndex.branch)}
                                    className="flex items-center gap-2 px-2.5 py-2 rounded-xl text-left text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-all"
                                    style={{ borderLeft: `2px solid ${nt.color}40` }}
                                  >
                                    <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: nt.color }} />
                                    <span className="truncate">{nt.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ─── RIGHT SIDEBAR: NODE CONFIG ─── */}
        <AnimatePresence>
          {selectedNode && !isMobile && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="flex-shrink-0 bg-card border-l border-border/50 overflow-y-auto overflow-x-hidden"
            >
              <NodeConfigPanel
                node={selectedNode}
                onUpdate={updateNodeConfig}
                onClose={() => setSelectedNodeId(null)}
                onDelete={() => deleteNode(selectedNode.id)}
              />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* ─── MOBILE BOTTOM SHEET for config ─── */}
      <AnimatePresence>
        {selectedNode && isMobile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setSelectedNodeId(null)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl border-t border-border/50 max-h-[70vh] overflow-auto"
            >
              <NodeConfigPanel
                node={selectedNode}
                onUpdate={updateNodeConfig}
                onClose={() => setSelectedNodeId(null)}
                onDelete={() => deleteNode(selectedNode.id)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ================================================================
   SUB-COMPONENTS
   ================================================================ */

function ConnectorLine() {
  return <div className="w-0.5 h-6 bg-border/60" />;
}

function AddStepButton({ onClick, small }: { onClick: (e: React.MouseEvent) => void; small?: boolean }) {
  return (
    <motion.button
      whileHover={{ scale: 1.15 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className={`rounded-full bg-surface border border-border/50 hover:border-primary/50 hover:bg-primary/10 flex items-center justify-center transition-all shadow-sm group ${
        small ? "w-6 h-6" : "w-8 h-8"
      }`}
      title="Add step"
    >
      <Plus className={`text-muted-foreground group-hover:text-primary transition-colors ${small ? "w-3 h-3" : "w-4 h-4"}`} />
    </motion.button>
  );
}

function NodeCard({
  node,
  selected,
  onClick,
  onDelete,
  compact,
}: {
  node: WorkflowNode;
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
  onDelete: () => void;
  compact?: boolean;
}) {
  const color = getNodeColor(node);
  const Icon = getNodeIcon(node);
  const label = getNodeLabel(node);
  const summary = getNodeSummary(node);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      onClick={onClick}
      className={`relative cursor-pointer group transition-all duration-200 ${compact ? "w-full max-w-[240px]" : "w-full max-w-md"}`}
    >
      <div
        className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
          selected
            ? "border-primary/50 shadow-lg shadow-primary/10 ring-2 ring-primary/20"
            : "border-border/50 hover:border-primary/30 hover:shadow-md hover:shadow-primary/5"
        }`}
        style={{ borderLeftWidth: "4px", borderLeftColor: color }}
      >
        <div className={`bg-card ${compact ? "p-3" : "px-4 py-3.5"}`}>
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}15` }}
            >
              <Icon className="w-4.5 h-4.5" style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-foreground truncate ${compact ? "text-xs" : "text-sm"}`}>
                {label}
              </p>
              {summary && (
                <p className="text-[11px] text-muted-foreground truncate mt-0.5">{summary}</p>
              )}
            </div>
            {/* Delete button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500/15 transition-all"
              title="Delete"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground hover:text-red-400" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── NODE CONFIGURATION PANEL ─── */

function NodeConfigPanel({
  node,
  onUpdate,
  onClose,
  onDelete,
}: {
  node: WorkflowNode;
  onUpdate: (nodeId: string, updates: Record<string, unknown>) => void;
  onClose: () => void;
  onDelete: () => void;
}) {
  const color = getNodeColor(node);
  const Icon = getNodeIcon(node);
  const label = getNodeLabel(node);
  const c = node.config;
  const actionType = (c.actionType || c.triggerType || "") as string;

  const update = (key: string, value: unknown) => onUpdate(node.id, { [key]: value });

  return (
    <div className="p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: `${color}15` }}
          >
            <Icon className="w-4.5 h-4.5" style={{ color }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{label}</p>
            <p className="text-[10px] text-muted-foreground capitalize">{node.type}</p>
          </div>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-surface-hover">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Label */}
        <FieldGroup label="Label">
          <input
            value={(c.label as string) || ""}
            onChange={(e) => update("label", e.target.value)}
            className="w-full px-3 py-2 bg-surface border border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Node label"
          />
        </FieldGroup>

        {/* TRIGGER CONFIGS */}
        {node.type === "trigger" && (actionType === "tag_added" || actionType === "form_submitted") && (
          <FieldGroup label={actionType === "tag_added" ? "Tag Name" : "Form Name"}>
            <input
              value={(c.tagName as string) || (c.formName as string) || ""}
              onChange={(e) => update(actionType === "tag_added" ? "tagName" : "formName", e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder={actionType === "tag_added" ? "e.g. paid-299" : "e.g. contact-form"}
            />
          </FieldGroup>
        )}

        {/* SEND EMAIL */}
        {actionType === "send_email" && (
          <>
            <FieldGroup label="Email Subject">
              <input
                value={(c.subject as string) || ""}
                onChange={(e) => update("subject", e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="Subject line"
              />
            </FieldGroup>
            <FieldGroup label="Email Body (optional)">
              <textarea
                value={(c.body as string) || ""}
                onChange={(e) => update("body", e.target.value)}
                rows={3}
                className="w-full px-3 py-2 bg-surface border border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                placeholder="Email content or select a campaign…"
              />
            </FieldGroup>
          </>
        )}

        {/* ADD/REMOVE TAG */}
        {(actionType === "add_tag" || actionType === "remove_tag") && (
          <FieldGroup label="Tag Name">
            <input
              value={(c.tagName as string) || ""}
              onChange={(e) => update("tagName", e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="e.g. vip, paid-299"
            />
          </FieldGroup>
        )}

        {/* MOVE TO PIPELINE STAGE */}
        {actionType === "move_pipeline" && (
          <FieldGroup label="Pipeline Stage">
            <input
              value={(c.stage as string) || ""}
              onChange={(e) => update("stage", e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="e.g. Qualified, Closed"
            />
          </FieldGroup>
        )}

        {/* SEND NOTIFICATION */}
        {actionType === "send_notification" && (
          <FieldGroup label="Notification Message">
            <textarea
              value={(c.message as string) || ""}
              onChange={(e) => update("message", e.target.value)}
              rows={2}
              className="w-full px-3 py-2 bg-surface border border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              placeholder="Alert message for admin"
            />
          </FieldGroup>
        )}

        {/* UPDATE CONTACT */}
        {actionType === "update_contact" && (
          <>
            <FieldGroup label="Field">
              <input
                value={(c.field as string) || ""}
                onChange={(e) => update("field", e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="e.g. source, notes"
              />
            </FieldGroup>
            <FieldGroup label="Value">
              <input
                value={(c.value as string) || ""}
                onChange={(e) => update("value", e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="New value"
              />
            </FieldGroup>
          </>
        )}

        {/* IF/ELSE CONDITION */}
        {node.type === "condition" && c.field !== undefined && !c.delayType && !c.waitType && (
          <>
            <FieldGroup label="Condition Field">
              <select
                value={(c.field as string) || "tag"}
                onChange={(e) => update("field", e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-border/50 rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {CONDITION_FIELDS.map((f) => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
              </select>
            </FieldGroup>
            <FieldGroup label="Operator">
              <select
                value={(c.operator as string) || "equals"}
                onChange={(e) => update("operator", e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-border/50 rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {CONDITION_OPERATORS.map((o) => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            </FieldGroup>
            <FieldGroup label="Value">
              <input
                value={(c.value as string) || ""}
                onChange={(e) => update("value", e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="e.g. true, paid-299"
              />
            </FieldGroup>
          </>
        )}

        {/* WAIT / DELAY */}
        {(c.delayType !== undefined || node.type === "delay") && (
          <>
            <FieldGroup label="Duration">
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  value={(c.delayValue as number) || 1}
                  onChange={(e) => update("delayValue", parseInt(e.target.value) || 1)}
                  className="w-20 px-3 py-2 bg-surface border border-border/50 rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <select
                  value={(c.delayType as string) || "days"}
                  onChange={(e) => update("delayType", e.target.value)}
                  className="flex-1 px-3 py-2 bg-surface border border-border/50 rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="minutes">Minutes</option>
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
              </div>
            </FieldGroup>
          </>
        )}

        {/* WAIT UNTIL */}
        {c.waitType !== undefined && (
          <FieldGroup label="Wait Until Date">
            <input
              type="datetime-local"
              value={(c.date as string) || ""}
              onChange={(e) => update("date", e.target.value)}
              className="w-full px-3 py-2 bg-surface border border-border/50 rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </FieldGroup>
        )}

        {/* TIME WINDOW */}
        {c.startHour !== undefined && (
          <>
            <FieldGroup label="Start Hour">
              <input
                type="number"
                min={0}
                max={23}
                value={(c.startHour as number) ?? 9}
                onChange={(e) => update("startHour", parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-surface border border-border/50 rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </FieldGroup>
            <FieldGroup label="End Hour">
              <input
                type="number"
                min={0}
                max={23}
                value={(c.endHour as number) ?? 17}
                onChange={(e) => update("endHour", parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 bg-surface border border-border/50 rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </FieldGroup>
          </>
        )}

        {/* Delete button */}
        <div className="pt-4 border-t border-border/50">
          <button
            onClick={onDelete}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Delete Node
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
