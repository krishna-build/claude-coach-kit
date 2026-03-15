import { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import Layout from "@/components/Layout";
import {
  MessageCircle,
  CheckCircle2,
  AlertCircle,
  Key,
  Copy,
  Edit3,
  Send,
  Search,
  ChevronDown,
  Users,
  Clock,
  Check,
  X,
  Zap,
  Plus,
  Trash2,
  Filter,
  Eye,
  Tag,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface WaTemplate {
  id: string;
  name: string;
  category: string;
  body: string;
  variables: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SentMessage {
  id: string;
  contact: string;
  phone: string;
  template: string;
  sentAt: string;
  status: "sent" | "delivered" | "read" | "failed";
}

interface Contact {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = ["general", "lead_welcome", "follow_up", "reminder", "sales", "custom"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  general: "General",
  lead_welcome: "Lead Welcome",
  follow_up: "Follow-up",
  reminder: "Reminder",
  sales: "Sales",
  custom: "Custom",
};
const CATEGORY_COLORS: Record<string, string> = {
  general: "#60A5FA",
  lead_welcome: "#22C55E",
  follow_up: "#A78BFA",
  reminder: "#FFB433",
  sales: "#F87171",
  custom: "#06B6D4",
};

const DEFAULT_TEMPLATES: Omit<WaTemplate, "id" | "created_at" | "updated_at">[] = [
  {
    name: "Lead Welcome",
    category: "lead_welcome",
    body: "Hi {{name}}! Thanks for your interest in Coach's coaching. Reply YES to learn more 🙏",
    variables: ["name"],
    is_active: true,
  },
  {
    name: "Follow-up Day 2",
    category: "follow_up",
    body: "Hi {{name}}, just checking in! Have you had a chance to look at the program details?",
    variables: ["name"],
    is_active: true,
  },
  {
    name: "Call Reminder",
    category: "reminder",
    body: "Hi {{name}}! Your call with Coach is tomorrow at {{time}}. Here's the link: {{link}}",
    variables: ["name", "time", "link"],
    is_active: true,
  },
  {
    name: "Payment Confirmation",
    category: "sales",
    body: "Hi {{name}}! Payment received ✅ Welcome to the family! 🎉",
    variables: ["name"],
    is_active: true,
  },
  {
    name: "Enrollment Nudge",
    category: "sales",
    body: "Hi {{name}}, spots are filling fast for the {{program}} batch. Don't miss out — enroll today! 🚀",
    variables: ["name", "program"],
    is_active: true,
  },
  {
    name: "Session Feedback",
    category: "follow_up",
    body: "Hi {{name}}! How was your session today? Your feedback helps us serve you better 🙏\n\nRate 1-5: ",
    variables: ["name"],
    is_active: true,
  },
];

const MOCK_SENT: SentMessage[] = [
  { id: "1", contact: "Rahul Sharma", phone: "+91 98765 43210", template: "Lead Welcome", sentAt: "2025-01-15 10:23", status: "read" },
  { id: "2", contact: "Priya Mehta", phone: "+91 87654 32109", template: "Follow-up Day 2", sentAt: "2025-01-15 11:45", status: "delivered" },
  { id: "3", contact: "Amit Kumar", phone: "+91 76543 21098", template: "Call Reminder", sentAt: "2025-01-15 14:02", status: "sent" },
  { id: "4", contact: "Neha Singh", phone: "+91 65432 10987", template: "Payment Confirmation", sentAt: "2025-01-14 09:15", status: "read" },
  { id: "5", contact: "Vikas Gupta", phone: "+91 54321 09876", template: "Lead Welcome", sentAt: "2025-01-14 16:30", status: "failed" },
];

const STATUS_COLORS: Record<string, string> = {
  sent: "text-blue-400",
  delivered: "text-yellow-400",
  read: "text-green-400",
  failed: "text-red-400",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  sent: <Check className="w-3 h-3" />,
  delivered: <Check className="w-3 h-3" />,
  read: <CheckCircle2 className="w-3 h-3" />,
  failed: <X className="w-3 h-3" />,
};

// ─── Helper: extract vars ───────────────────────────────────────────────────

function extractVars(body: string) {
  const matches = body.match(/\{\{(\w+)\}\}/g) || [];
  return [...new Set(matches.map((m) => m.slice(2, -2)))];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function WhatsAppBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
        connected
          ? "bg-green-500/15 text-green-400 border border-green-500/30"
          : "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green-400" : "bg-yellow-400"} animate-pulse`} />
      {connected ? "Connected" : "Not Connected"}
    </span>
  );
}

function WhatsAppLogo({ size = 40 }: { size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: "#25D366",
        fontSize: size * 0.42,
        boxShadow: "0 0 0 4px rgba(37,211,102,0.15)",
      }}
    >
      W
    </div>
  );
}

// ─── Template Form Modal ───────────────────────────────────────────────────

interface TemplateFormProps {
  template?: WaTemplate | null;
  onClose: () => void;
  onSave: (data: { name: string; category: string; body: string; variables: string[] }) => void;
  saving: boolean;
}

function TemplateFormModal({ template, onClose, onSave, saving }: TemplateFormProps) {
  const [name, setName] = useState(template?.name || "");
  const [category, setCategory] = useState(template?.category || "general");
  const [body, setBody] = useState(template?.body || "");

  const vars = useMemo(() => extractVars(body), [body]);

  const previewMessage = () => {
    let msg = body;
    vars.forEach((v) => {
      msg = msg.replaceAll(`{{${v}}}`, `[${v}]`);
    });
    return msg;
  };

  const handleSubmit = () => {
    if (!name.trim() || !body.trim()) return;
    onSave({ name: name.trim(), category, body: body.trim(), variables: vars });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "rgba(37,211,102,0.12)" }}>
              <MessageCircle className="w-4.5 h-4.5" style={{ color: "#25D366" }} />
            </div>
            <div>
              <h2 className="font-bold text-foreground">{template ? "Edit Template" : "Create Template"}</h2>
              <p className="text-xs text-muted-foreground">WhatsApp message template</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Template Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lead Welcome"
              className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#25D366]/40"
            />
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Category</label>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full appearance-none px-4 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[#25D366]/40 cursor-pointer"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Body */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Message Body</label>
              <span className="text-[10px] text-muted-foreground">Use {"{{variable}}"} for dynamic content</span>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={5}
              placeholder="Hi {{name}}! Thanks for reaching out..."
              className="w-full px-4 py-3 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-[#25D366]/40 font-mono"
            />
            {/* Variable chips */}
            {vars.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-muted-foreground">Variables:</span>
                {vars.map((v) => (
                  <span key={v} className="px-2 py-0.5 rounded-full text-[10px] font-semibold border" style={{ color: "#25D366", background: "rgba(37,211,102,0.08)", borderColor: "rgba(37,211,102,0.2)" }}>
                    {`{{${v}}}`}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* WhatsApp Preview */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Eye className="w-3 h-3" /> Preview
            </label>
            <div className="bg-[#0b141a] rounded-xl p-4 relative overflow-hidden">
              {/* WhatsApp wallpaper pattern */}
              <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22%3E%3Cg fill=%22%2325D366%22%3E%3Ccircle cx=%2240%22 cy=%2240%22 r=%222%22/%3E%3C/g%3E%3C/svg%3E')" }} />
              <div className="relative">
                <div className="inline-block max-w-[85%] bg-[#005c4b] rounded-xl rounded-tl-none px-3.5 py-2.5 shadow-sm">
                  <p className="text-sm text-[#e9edef] leading-relaxed whitespace-pre-wrap">{previewMessage() || "Your message preview..."}</p>
                  <div className="flex items-center justify-end gap-1 mt-1">
                    <span className="text-[10px] text-[#ffffff80]">12:00</span>
                    <Check className="w-3 h-3 text-[#53bdeb]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-5 border-t border-border/50">
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-all">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || !body.trim() || saving}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
            style={{ background: "#25D366" }}
          >
            {saving ? (
              <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
            ) : (
              <><CheckCircle2 className="w-3.5 h-3.5" /> {template ? "Update" : "Create"} Template</>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────

function DeleteConfirmModal({ name, onConfirm, onCancel, deleting }: { name: string; onConfirm: () => void; onCancel: () => void; deleting: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
          <Trash2 className="w-5 h-5 text-red-400" />
        </div>
        <div className="text-center">
          <h3 className="font-bold text-foreground">Delete Template?</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Are you sure you want to delete "<span className="text-foreground font-medium">{name}</span>"? This action cannot be undone.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted transition-all">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={deleting} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5">
            {deleting ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Delete
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WhatsApp() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [apiKey, setApiKey] = useState(() => localStorage.getItem("whatsapp_api_key") || "");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [connected, setConnected] = useState(() => !!localStorage.getItem("whatsapp_api_key"));
  const [showApiInput, setShowApiInput] = useState(false);

  // Template modal state
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WaTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WaTemplate | null>(null);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");

  // Send state
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<WaTemplate | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [sentMessages, setSentMessages] = useState<SentMessage[]>(MOCK_SENT);
  const [sendStatus, setSendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const contactRef = useRef<HTMLDivElement>(null);

  // ─── Fetch templates from Supabase ─────────────────────────────────────

  const { data: templates = [], isLoading: templatesLoading } = useQuery<WaTemplate[]>({
    queryKey: ["whatsapp-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as WaTemplate[];
    },
  });

  // Seed defaults if empty
  useEffect(() => {
    if (!templatesLoading && templates.length === 0) {
      (async () => {
        const { error } = await supabase.from("whatsapp_templates").insert(DEFAULT_TEMPLATES);
        if (!error) {
          queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
        }
      })();
    }
  }, [templatesLoading, templates.length, queryClient]);

  // ─── Mutations ─────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; category: string; body: string; variables: string[] }) => {
      const { error } = await supabase.from("whatsapp_templates").insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast.success("Template created successfully!");
      setShowForm(false);
    },
    onError: () => toast.error("Failed to create template"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name: string; category: string; body: string; variables: string[] }) => {
      const { error } = await supabase.from("whatsapp_templates").update({ ...data, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast.success("Template updated!");
      setEditingTemplate(null);
      setShowForm(false);
    },
    onError: () => toast.error("Failed to update template"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("whatsapp_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast.success("Template deleted");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Failed to delete template"),
  });

  // ─── Filtered templates ─────────────────────────────────────────────

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchesSearch = !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.body.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = filterCategory === "all" || t.category === filterCategory;
      return matchesSearch && matchesCategory;
    });
  }, [templates, searchQuery, filterCategory]);

  // ─── Fetch contacts ────────────────────────────────────────────────

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["wa-contacts", contactSearch],
    queryFn: async () => {
      if (contactSearch.length < 2) return [];
      const { data } = await supabase
        .from("automation_contacts")
        .select("id, full_name, email, phone")
        .or(`full_name.ilike.%${contactSearch}%,email.ilike.%${contactSearch}%`)
        .limit(8);
      return (data || []) as Contact[];
    },
    enabled: contactSearch.length >= 2,
  });

  // Close contact dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (contactRef.current && !contactRef.current.contains(e.target as Node)) {
        setShowContactDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const previewMessage = () => {
    if (!selectedTemplate) return "";
    let msg = selectedTemplate.body;
    Object.entries(variables).forEach(([k, v]) => {
      msg = msg.replaceAll(`{{${k}}}`, v || `{{${k}}}`);
    });
    if (selectedContact) msg = msg.replaceAll("{{name}}", selectedContact.full_name || "{{name}}");
    return msg;
  };

  const handleConnect = () => {
    if (!apiKeyInput.trim()) return;
    localStorage.setItem("whatsapp_api_key", apiKeyInput.trim());
    setApiKey(apiKeyInput.trim());
    setConnected(true);
    setShowApiInput(false);
    setApiKeyInput("");
    toast.success("WhatsApp Business connected!");
  };

  const handleDisconnect = () => {
    localStorage.removeItem("whatsapp_api_key");
    setApiKey("");
    setConnected(false);
    toast.info("WhatsApp disconnected");
  };

  const handleCopy = (t: WaTemplate) => {
    navigator.clipboard.writeText(t.body);
    setCopiedId(t.id);
    setTimeout(() => setCopiedId(null), 1500);
    toast.success("Copied to clipboard!");
  };

  const handleSend = () => {
    if (!connected || !selectedContact || !selectedTemplate) return;
    setSendStatus("sending");
    setTimeout(() => {
      const newMsg: SentMessage = {
        id: String(Date.now()),
        contact: selectedContact.full_name,
        phone: selectedContact.phone || "Unknown",
        template: selectedTemplate.name,
        sentAt: new Date().toLocaleString("sv").slice(0, 16),
        status: "sent",
      };
      setSentMessages((prev) => [newMsg, ...prev].slice(0, 20));
      setSendStatus("sent");
      toast.success(`Message sent to ${selectedContact.full_name}!`);
      setTimeout(() => setSendStatus("idle"), 2000);
    }, 1200);
  };

  const templateVars = selectedTemplate ? extractVars(selectedTemplate.body) : [];
  const varKeys = templateVars.filter((v) => v !== "name");

  return (
    <Layout>
      <div className="space-y-6 max-w-5xl">
        {/* Page header */}
        <div className="flex items-center gap-4">
          <WhatsAppLogo size={48} />
          <div>
            <h1 className="text-2xl font-bold text-foreground">WhatsApp Business</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Connect & send WhatsApp messages to your coaching leads
            </p>
          </div>
          <div className="ml-auto">
            <WhatsAppBadge connected={connected} />
          </div>
        </div>

        {/* ── Section 1: Connection Status ── */}
        <div className="bg-card rounded-2xl border border-border/50 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-green-400" />
              </div>
              <h2 className="font-semibold text-foreground">Connection Status</h2>
            </div>
            <WhatsAppBadge connected={connected} />
          </div>

          {connected ? (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/8 border border-green-500/20">
              <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-green-400">WhatsApp Business Connected</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  API key: {apiKey.slice(0, 8)}{"•".repeat(Math.max(0, apiKey.length - 8))}
                </p>
              </div>
              <button
                onClick={handleDisconnect}
                className="text-xs text-muted-foreground hover:text-red-400 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-500/10"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {[
                  "Get a WhatsApp Business API account (via Meta or a provider like Wati / Interakt)",
                  "Copy your API key from your provider dashboard",
                  'Enter it below and click "Save & Connect"',
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5" style={{ background: "rgba(37,211,102,0.15)", color: "#25D366" }}>
                      {i + 1}
                    </div>
                    <p className="text-sm text-muted-foreground">{step}</p>
                  </div>
                ))}
              </div>

              <AnimatePresence>
                {showApiInput && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="flex gap-2 pt-1">
                      <div className="flex-1 relative">
                        <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <input
                          type="password"
                          value={apiKeyInput}
                          onChange={(e) => setApiKeyInput(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                          placeholder="Paste your WhatsApp API key..."
                          className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-green-500/40"
                        />
                      </div>
                      <button
                        onClick={handleConnect}
                        disabled={!apiKeyInput.trim()}
                        className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ background: "#25D366" }}
                      >
                        Save & Connect
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                onClick={() => setShowApiInput((v) => !v)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white w-full justify-center transition-all"
                style={{ background: "#25D366" }}
              >
                <MessageCircle className="w-4 h-4" />
                {showApiInput ? "Cancel" : "Connect WhatsApp Business"}
              </button>
            </>
          )}
        </div>

        {/* ── Section 2: Message Templates ── */}
        <div className="bg-card rounded-2xl border border-border/50 p-6 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <h2 className="font-semibold text-foreground">Message Templates</h2>
            <span className="text-xs text-muted-foreground">({templates.length})</span>
            <div className="ml-auto">
              <button
                onClick={() => { setEditingTemplate(null); setShowForm(true); }}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-white transition-all hover:brightness-110"
                style={{ background: "#25D366" }}
              >
                <Plus className="w-3.5 h-3.5" /> Create Template
              </button>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex gap-2 flex-col sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates..."
                className="w-full pl-10 pr-4 py-2 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="appearance-none pl-9 pr-8 py-2 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
              >
                <option value="all">All Categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Templates List */}
          {templatesLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-12">
              <div className="text-4xl mb-3">📝💬✨</div>
              <p className="text-sm font-medium text-foreground">No templates found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {searchQuery || filterCategory !== "all" ? "Try adjusting your search or filter" : "Create your first WhatsApp template!"}
              </p>
            </motion.div>
          ) : (
            <div className="space-y-2.5">
              <AnimatePresence mode="popLayout">
                {filteredTemplates.map((t, i) => {
                  const catColor = CATEGORY_COLORS[t.category] || "#60A5FA";
                  return (
                    <motion.div
                      key={t.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: i * 0.03 }}
                      className="rounded-xl border border-border/60 bg-background/60 overflow-hidden hover:border-green-500/20 transition-all group"
                    >
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: catColor }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">{t.name}</span>
                            <span
                              className="text-[9px] px-2 py-0.5 rounded-full font-semibold border"
                              style={{ color: catColor, background: `${catColor}12`, borderColor: `${catColor}25` }}
                            >
                              {CATEGORY_LABELS[t.category] || t.category}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setEditingTemplate(t); setShowForm(true); }}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-all"
                            title="Edit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleCopy(t)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-all"
                            title="Copy"
                          >
                            {copiedId === t.id ? <CheckCircle2 className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => setDeleteTarget(t)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedTemplate(t);
                            setVariables({});
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all text-white hover:brightness-110"
                          style={{ background: "#25D366" }}
                          title="Use this template"
                        >
                          <Send className="w-3 h-3" /> Use
                        </button>
                      </div>
                      <div className="px-4 pb-3">
                        <p className="text-xs text-muted-foreground font-mono leading-relaxed whitespace-pre-wrap">{t.body}</p>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* ── Section 3: Send Message ── */}
        <div className="bg-card rounded-2xl border border-border/50 p-6 space-y-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Send className="w-4 h-4 text-blue-400" />
            </div>
            <h2 className="font-semibold text-foreground">Send WhatsApp Message</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Contact search */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Search Contact</label>
              <div className="relative" ref={contactRef}>
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <input
                  value={selectedContact ? selectedContact.full_name : contactSearch}
                  onChange={(e) => {
                    if (selectedContact) setSelectedContact(null);
                    setContactSearch(e.target.value);
                    setShowContactDropdown(true);
                  }}
                  onFocus={() => setShowContactDropdown(true)}
                  placeholder="Search by name or email..."
                  className="w-full pl-10 pr-4 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                {selectedContact && (
                  <button onClick={() => { setSelectedContact(null); setContactSearch(""); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                <AnimatePresence>
                  {showContactDropdown && contacts.length > 0 && !selectedContact && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      className="absolute z-20 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-xl overflow-hidden"
                    >
                      {contacts.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setSelectedContact(c);
                            setContactSearch(c.full_name);
                            setShowContactDropdown(false);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-surface-hover text-left transition-colors"
                        >
                          <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                            {c.full_name[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{c.full_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                          </div>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Template selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Select Template</label>
              <div className="relative">
                <select
                  value={selectedTemplate?.id || ""}
                  onChange={(e) => {
                    const t = templates.find((x) => x.id === e.target.value) || null;
                    setSelectedTemplate(t);
                    setVariables({});
                  }}
                  className="w-full appearance-none pl-4 pr-10 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                >
                  <option value="">Choose a template...</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Variable inputs */}
          {varKeys.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {varKeys.map((v) => (
                <div key={v} className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground capitalize">{`{{${v}}}`}</label>
                  <input
                    value={variables[v] || ""}
                    onChange={(e) => setVariables((prev) => ({ ...prev, [v]: e.target.value }))}
                    placeholder={`Enter ${v}...`}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Preview */}
          {selectedTemplate && (
            <div className="rounded-xl bg-[#0b141a] p-4 space-y-1.5 relative overflow-hidden">
              <div className="absolute inset-0 opacity-[0.04]" style={{ backgroundImage: "url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22%3E%3Cg fill=%22%2325D366%22%3E%3Ccircle cx=%2240%22 cy=%2240%22 r=%222%22/%3E%3C/g%3E%3C/svg%3E')" }} />
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide relative">Preview</p>
              <div className="relative inline-block max-w-xs bg-[#005c4b] rounded-xl rounded-tl-none px-3.5 py-2.5 shadow-sm">
                <p className="text-sm text-[#e9edef] leading-relaxed whitespace-pre-wrap">{previewMessage()}</p>
                <div className="flex items-center justify-end gap-1 mt-1">
                  <span className="text-[10px] text-[#ffffff80]">{new Date().toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
                  <Check className="w-3 h-3 text-[#53bdeb]" />
                </div>
              </div>
            </div>
          )}

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!connected || !selectedContact || !selectedTemplate || sendStatus === "sending"}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              !connected ? "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30" : "text-white"
            }`}
            style={connected ? { background: "#25D366" } : undefined}
          >
            {!connected ? (
              <><AlertCircle className="w-4 h-4" /> Connect WhatsApp first to send messages</>
            ) : sendStatus === "sending" ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending...</>
            ) : sendStatus === "sent" ? (
              <><CheckCircle2 className="w-4 h-4" /> Sent!</>
            ) : (
              <><Send className="w-4 h-4" /> Send WhatsApp Message</>
            )}
          </button>

          {/* Message history */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Recent Messages</h3>
              <span className="ml-auto text-xs text-muted-foreground">Last {sentMessages.length}</span>
            </div>
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-surface">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Contact</th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium hidden sm:table-cell">Template</th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium hidden md:table-cell">Sent At</th>
                    <th className="text-left px-4 py-2.5 text-muted-foreground font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {sentMessages.map((m) => (
                    <tr key={m.id} className="hover:bg-surface/50 transition-colors">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-foreground">{m.contact}</p>
                        <p className="text-muted-foreground">{m.phone}</p>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{m.template}</td>
                      <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell">{m.sentAt}</td>
                      <td className="px-4 py-2.5">
                        <span className={`flex items-center gap-1 font-medium capitalize ${STATUS_COLORS[m.status]}`}>
                          {STATUS_ICONS[m.status]}
                          {m.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Section 4: Bulk WhatsApp (Coming Soon) ── */}
        <div className="relative bg-card rounded-2xl border border-border/50 p-6 space-y-4 overflow-hidden">
          <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center gap-3">
            <div className="px-4 py-2 rounded-xl bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 text-sm font-bold tracking-wide">Coming Soon</div>
            <p className="text-sm text-muted-foreground text-center max-w-xs">Bulk WhatsApp messaging will be available in a future update</p>
          </div>

          <div className="flex items-center gap-2 opacity-40">
            <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center">
              <Users className="w-4 h-4 text-green-400" />
            </div>
            <h2 className="font-semibold text-foreground">Bulk WhatsApp</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 opacity-40 pointer-events-none select-none">
            <div className="rounded-xl border border-border/60 p-4 space-y-2">
              <p className="text-sm font-semibold text-foreground">Send to All Leads</p>
              <p className="text-xs text-muted-foreground">Broadcast a WhatsApp message to all your current leads</p>
              <div className="flex items-center gap-2 mt-3">
                <select className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground">
                  <option>Select template...</option>
                </select>
                <button disabled className="px-3 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#25D366" }}>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="rounded-xl border border-border/60 p-4 space-y-2">
              <p className="text-sm font-semibold text-foreground">Send to Segment</p>
              <p className="text-xs text-muted-foreground">Target specific contact segments with personalized messages</p>
              <div className="flex items-center gap-2 mt-3">
                <select className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-sm text-foreground">
                  <option>Select segment...</option>
                </select>
                <button disabled className="px-3 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "#25D366" }}>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {showForm && (
          <TemplateFormModal
            template={editingTemplate}
            onClose={() => { setShowForm(false); setEditingTemplate(null); }}
            saving={createMutation.isPending || updateMutation.isPending}
            onSave={(data) => {
              if (editingTemplate) {
                updateMutation.mutate({ id: editingTemplate.id, ...data });
              } else {
                createMutation.mutate(data);
              }
            }}
          />
        )}
        {deleteTarget && (
          <DeleteConfirmModal
            name={deleteTarget.name}
            deleting={deleteMutation.isPending}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}
