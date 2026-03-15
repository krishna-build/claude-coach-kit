import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import Layout from "@/components/Layout";
import { useToast } from "@/components/Toast";
import { motion } from "framer-motion";
import {
  CheckCircle, Link2, Clock, Mail, Webhook, CreditCard, BarChart3,
  FileSpreadsheet, Copy, Settings, Shield, Zap, Save, Server,
  Globe, AlertCircle, Eye, EyeOff, Send, ChevronDown, ChevronUp,
  Info, CheckSquare, XCircle
} from "lucide-react";

const cardVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.35 },
  }),
};

// ─── Integration Card ───────────────────────────────────────────
function IntegrationCard({ name, icon: Icon, connected, detail, index }: {
  name: string; icon: any; connected: boolean; detail: string; index: number;
}) {
  return (
    <motion.div
      custom={index}
      initial="hidden"
      animate="visible"
      variants={cardVariants}
      className="bg-card rounded-2xl border border-border/50 p-5 flex items-center gap-4 hover:border-primary/30 transition-all shadow-sm group"
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors ${connected ? "bg-gradient-to-br from-emerald-500/20 to-emerald-500/5" : "bg-muted/50"}`}>
        <Icon className={`w-5 h-5 ${connected ? "text-emerald-400" : "text-muted-foreground"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-foreground text-sm">{name}</p>
          {connected && <CheckCircle className="w-4 h-4 text-emerald-400" />}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{detail}</p>
      </div>
      <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${connected ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-muted/50 text-muted-foreground border-border/50"}`}>
        {connected ? "Connected" : "Not set up"}
      </span>
    </motion.div>
  );
}

// ─── Copyable URL box ────────────────────────────────────────────
function CopyableUrl({ label, url, description }: { label: string; url: string; description?: string }) {
  const { toast } = useToast();
  const copy = () => {
    navigator.clipboard.writeText(url);
    toast.success("Copied!");
  };
  return (
    <div className="rounded-xl border border-border/50 bg-background/40 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/30">
        <Webhook className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground">{label}</span>
        {description && <span className="text-[10px] text-muted-foreground ml-1">— {description}</span>}
        <button
          onClick={copy}
          className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-[10px] font-bold hover:bg-primary/20 transition-colors"
        >
          <Copy className="w-3 h-3" />Copy
        </button>
      </div>
      <div className="px-4 py-2.5 font-mono text-xs text-muted-foreground break-all">{url}</div>
    </div>
  );
}

// ─── Payload code block ──────────────────────────────────────────
function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="bg-black/40 rounded-xl border border-border/30 px-4 py-3 text-[11px] font-mono text-emerald-400/80 overflow-x-auto leading-relaxed">
      {code}
    </pre>
  );
}

// ─── SMTP Settings ───────────────────────────────────────────────
function SmtpSettings() {
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [testLoading, setTestLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    from_name: "Your Coach",
    from_email: "support@example.com",
    smtp_host: "smtp.hostinger.com",
    smtp_port: "587",
    smtp_user: "",
    smtp_password: "",
    use_tls: true,
  });

  // Load existing settings
  const { data: existingSettings } = useQuery({
    queryKey: ["smtp-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("automation_settings")
        .select("value")
        .eq("key", "smtp_config")
        .maybeSingle();
      return data?.value || null;
    },
  });

  useEffect(() => {
    if (existingSettings) {
      setForm(prev => ({ ...prev, ...existingSettings }));
    }
  }, [existingSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.from("automation_settings").upsert(
        { key: "smtp_config", value: form, updated_at: new Date().toISOString() },
        { onConflict: "key" }
      );
      if (error) throw error;
      toast.success("SMTP settings saved!");
    } catch (err: any) {
      toast.error("Failed to save: " + (err.message || "Unknown error"));
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await fetch(
        "https://YOUR_SUPABASE_REF.supabase.co/functions/v1/email-engine",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "test", to: testEmail }),
        }
      );
      const data = await res.json();
      if (res.ok && !data.error) {
        setTestResult({ ok: true, msg: "Test email sent!" });
      } else {
        setTestResult({ ok: false, msg: data.error || data.message || "Send failed" });
      }
    } catch (err: any) {
      setTestResult({ ok: false, msg: err.message || "Network error" });
    } finally {
      setTestLoading(false);
    }
  };

  const inputClass = "w-full h-10 px-3.5 rounded-xl bg-background border border-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 transition-colors";

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
      <h2 className="text-sm font-semibold text-foreground/80 mb-3 flex items-center gap-2">
        <Server className="w-4 h-4 text-primary" />
        SMTP Configuration
      </h2>
      <div className="bg-card rounded-2xl border border-border/50 p-5 shadow-sm space-y-4">
        {/* Row 1: From Name + From Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">From Name</label>
            <input
              type="text"
              value={form.from_name}
              onChange={e => setForm({ ...form, from_name: e.target.value })}
              placeholder="Your Coach"
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">From Email</label>
            <input
              type="email"
              value={form.from_email}
              onChange={e => setForm({ ...form, from_email: e.target.value })}
              placeholder="hello@example.com"
              className={inputClass}
            />
          </div>
        </div>

        {/* Row 2: SMTP Host + Port */}
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">SMTP Host</label>
            <input
              type="text"
              value={form.smtp_host}
              onChange={e => setForm({ ...form, smtp_host: e.target.value })}
              placeholder="smtp.hostinger.com"
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Port</label>
            <input
              type="text"
              value={form.smtp_port}
              onChange={e => setForm({ ...form, smtp_port: e.target.value })}
              placeholder="587"
              className={inputClass}
            />
          </div>
        </div>

        {/* Row 3: Username + Password */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Username</label>
            <input
              type="text"
              value={form.smtp_user}
              onChange={e => setForm({ ...form, smtp_user: e.target.value })}
              placeholder="your@email.com"
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={form.smtp_password}
                onChange={e => setForm({ ...form, smtp_password: e.target.value })}
                placeholder="••••••••"
                className={`${inputClass} pr-10`}
              />
              <button
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* TLS Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setForm({ ...form, use_tls: !form.use_tls })}
            className={`relative w-10 h-5 rounded-full transition-colors ${form.use_tls ? "bg-primary" : "bg-muted/60"}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.use_tls ? "translate-x-5" : "translate-x-0.5"}`} />
          </button>
          <span className="text-sm text-foreground font-medium">Use TLS / STARTTLS</span>
          <span className="text-xs text-muted-foreground">(recommended for port 587)</span>
        </div>

        {/* Actions row */}
        <div className="flex flex-col sm:flex-row gap-3 pt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-black text-sm font-bold hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save SMTP Settings"}
          </button>

          {/* Test email */}
          <div className="flex flex-1 gap-2">
            <input
              type="email"
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              placeholder="Send test to: you@example.com"
              className="flex-1 h-10 px-3.5 rounded-xl bg-background border border-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 transition-colors"
            />
            <button
              onClick={handleTestEmail}
              disabled={!testEmail || testLoading}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-muted/60 text-muted-foreground text-sm font-semibold hover:bg-primary/10 hover:text-primary disabled:opacity-40 transition-colors"
            >
              <Send className="w-3.5 h-3.5" />
              {testLoading ? "Sending..." : "Test"}
            </button>
          </div>
        </div>

        {/* Test result */}
        {testResult && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${
              testResult.ok
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}
          >
            {testResult.ok ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            {testResult.ok ? "✅ " : "❌ "}{testResult.msg}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Webhook Documentation ───────────────────────────────────────
function WebhookDocs() {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState<string | null>(null);

  const webhooks = [
    {
      id: "lead",
      label: "Lead Capture Webhook",
      url: "https://YOUR_SUPABASE_REF.supabase.co/functions/v1/lead-capture-webhook",
      description: "Typeform / Google Forms → capture new leads",
      method: "POST",
      payload: `{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+91 9876543210",
  "source": "typeform",
  "tags": ["lead", "webinar-july"],
  "custom_fields": {
    "city": "Mumbai",
    "age": "32"
  }
}`,
      example: "Add this URL in Typeform → Connect → Webhooks",
    },
    {
      id: "payment",
      label: "Payment Notification Webhook",
      url: "https://YOUR_SUPABASE_REF.supabase.co/functions/v1/payment-webhook",
      description: "Razorpay → capture ₹299 payment events",
      method: "POST",
      payload: `{
  "event": "payment.captured",
  "payload": {
    "payment": {
      "entity": {
        "id": "pay_xxxxx",
        "amount": 29900,
        "currency": "INR",
        "status": "captured",
        "email": "john@example.com",
        "contact": "+91 9876543210",
        "description": "Abundance Breakthrough"
      }
    }
  }
}`,
      example: "Add in Razorpay Dashboard → Settings → Webhooks",
    },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
      <h2 className="text-sm font-semibold text-foreground/80 mb-3 flex items-center gap-2">
        <Webhook className="w-4 h-4 text-primary" />
        Webhook Endpoints
      </h2>
      <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border/30">
          <p className="text-xs text-muted-foreground">
            Add these URLs to your <span className="text-foreground font-medium">Typeform / Google Forms / Razorpay</span> settings to automatically capture leads and payments.
          </p>
        </div>
        <div className="p-5 space-y-4">
          {webhooks.map((wh) => (
            <div key={wh.id} className="rounded-xl border border-border/40 overflow-hidden">
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3 bg-background/40">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Webhook className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground">{wh.label}</p>
                  <p className="text-[10px] text-muted-foreground">{wh.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{wh.method}</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(wh.url); toast.success("Copied!"); }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted/40 text-muted-foreground hover:bg-primary/10 hover:text-primary text-[10px] font-bold transition-colors"
                  >
                    <Copy className="w-3 h-3" />Copy URL
                  </button>
                </div>
              </div>

              {/* URL */}
              <div className="px-4 py-2.5 border-t border-border/20 font-mono text-[11px] text-muted-foreground bg-black/20 break-all">
                {wh.url}
              </div>

              {/* Expand payload */}
              <button
                onClick={() => setExpanded(expanded === wh.id ? null : wh.id)}
                className="w-full flex items-center gap-2 px-4 py-2.5 border-t border-border/20 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors"
              >
                <Info className="w-3 h-3" />
                Expected payload format
                {expanded === wh.id ? <ChevronUp className="w-3 h-3 ml-auto" /> : <ChevronDown className="w-3 h-3 ml-auto" />}
              </button>

              {expanded === wh.id && (
                <div className="border-t border-border/20 p-4 space-y-3">
                  <CodeBlock code={wh.payload} />
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/5 border border-amber-500/15">
                    <Info className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-400/80">{wh.example}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Deliverability Checker ──────────────────────────────────────
function DeliverabilityChecker() {
  const [domain, setDomain] = useState("");
  const [checked, setChecked] = useState(false);

  const handleCheck = () => {
    if (!domain) return;
    setChecked(true);
  };

  const records = domain ? [
    {
      type: "SPF",
      status: true,
      title: "SPF Record",
      description: "Tells receiving servers which IPs are allowed to send email for your domain.",
      value: `v=spf1 include:hostinger.com include:smtp.hostinger.com ~all`,
      where: "Add as a TXT record in your DNS (e.g. GoDaddy, Cloudflare, Namecheap):",
      dnsType: "TXT",
      dnsHost: "@",
    },
    {
      type: "DKIM",
      status: false,
      title: "DKIM Signature",
      description: "Cryptographic signature that proves your emails are authentic.",
      value: `Contact your email provider (Hostinger) to enable DKIM signing.\nIn Hostinger → Email Hosting → Domain → Advanced Settings → Enable DKIM`,
      where: "Steps to enable DKIM:",
      dnsType: "TXT",
      dnsHost: `mail._domainkey.${domain}`,
    },
    {
      type: "DMARC",
      status: true,
      title: "DMARC Policy",
      description: "Tells email providers what to do when SPF/DKIM checks fail.",
      value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}; ruf=mailto:dmarc@${domain}; fo=1`,
      where: "Add as a TXT record in DNS:",
      dnsType: "TXT",
      dnsHost: `_dmarc.${domain}`,
    },
  ] : [];

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
      <h2 className="text-sm font-semibold text-foreground/80 mb-3 flex items-center gap-2">
        <Globe className="w-4 h-4 text-primary" />
        Email Deliverability
      </h2>
      <div className="bg-card rounded-2xl border border-border/50 p-5 shadow-sm space-y-4">
        <p className="text-xs text-muted-foreground">
          Enter your sending domain to see what DNS records you need to configure for maximum deliverability.
        </p>

        <div className="flex gap-3">
          <input
            type="text"
            value={domain}
            onChange={e => { setDomain(e.target.value); setChecked(false); }}
            placeholder="yourcoach.com"
            className="flex-1 h-10 px-3.5 rounded-xl bg-background border border-border/50 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 transition-colors"
          />
          <button
            onClick={handleCheck}
            disabled={!domain}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-black text-sm font-bold hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            Check Setup
          </button>
        </div>

        {checked && records.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            {records.map((rec) => (
              <div key={rec.type} className="rounded-xl border border-border/40 overflow-hidden">
                {/* Status header */}
                <div className={`flex items-center gap-3 px-4 py-3 ${rec.status ? "bg-emerald-500/5" : "bg-orange-500/5"}`}>
                  {rec.status
                    ? <CheckSquare className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    : <XCircle className="w-4 h-4 text-orange-400 flex-shrink-0" />
                  }
                  <div className="flex-1">
                    <p className="text-sm font-bold text-foreground">{rec.title}</p>
                    <p className="text-[11px] text-muted-foreground">{rec.description}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                    rec.status
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-orange-500/10 text-orange-400 border border-orange-500/20"
                  }`}>
                    {rec.status ? "✅ Recommended" : "⚠️ Action needed"}
                  </span>
                </div>

                {/* Record details */}
                <div className="px-4 py-3 space-y-2 border-t border-border/20">
                  <p className="text-[11px] text-muted-foreground font-medium">{rec.where}</p>
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div className="bg-background/60 rounded-lg px-2.5 py-2">
                      <span className="text-muted-foreground block mb-0.5">Type</span>
                      <span className="text-foreground font-bold">{rec.dnsType}</span>
                    </div>
                    <div className="bg-background/60 rounded-lg px-2.5 py-2">
                      <span className="text-muted-foreground block mb-0.5">Host / Name</span>
                      <span className="text-foreground font-bold truncate block">{rec.dnsHost}</span>
                    </div>
                  </div>
                  <CodeBlock code={rec.value} />
                </div>
              </div>
            ))}

            <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-primary/5 border border-primary/15">
              <Info className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-primary/80">
                <strong>Note:</strong> DNS changes can take up to 24-48 hours to propagate. After making changes, use a tool like <strong>mail-tester.com</strong> to verify your setup.
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main Settings Page ─────────────────────────────────────────
export default function SettingsPage() {
  const { toast } = useToast();

  const { data: lastSync } = useQuery({
    queryKey: ["last-sync"],
    queryFn: async () => {
      const { data } = await supabase
        .from("automation_webhook_log")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1);
      return data?.[0]?.created_at || null;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["settings-stats"],
    queryFn: async () => {
      const [contacts, emails, webhooks] = await Promise.all([
        supabase.from("automation_contacts").select("id", { count: "exact", head: true }),
        supabase.from("automation_email_log").select("id", { count: "exact", head: true }),
        supabase.from("automation_webhook_log").select("id", { count: "exact", head: true }),
      ]);
      return {
        contacts: contacts.count || 0,
        emails: emails.count || 0,
        webhooks: webhooks.count || 0,
      };
    },
  });

  const baseUrl = "https://YOUR_SUPABASE_REF.supabase.co/functions/v1";

  const statsItems = [
    { label: "Contacts", value: stats?.contacts || 0, icon: "👤", gradient: "from-[#FFB433]/20 to-[#FFB433]/5" },
    { label: "Emails Sent", value: stats?.emails || 0, icon: "📧", gradient: "from-blue-500/20 to-blue-500/5" },
    { label: "Webhooks", value: stats?.webhooks || 0, icon: "🔗", gradient: "from-violet-500/20 to-violet-500/5" },
  ];

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-1">
            <Settings className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          </div>
          <p className="text-sm text-muted-foreground">System configuration, SMTP, webhooks, and deliverability</p>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {statsItems.map((s, i) => (
            <motion.div
              key={s.label}
              custom={i}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
              className={`bg-gradient-to-b ${s.gradient} rounded-2xl border border-border/30 p-5 text-center`}
            >
              <p className="text-2xl mb-1">{s.icon}</p>
              <p className="text-2xl font-bold text-foreground">{s.value.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">{s.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Integrations */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <h2 className="text-sm font-semibold text-foreground/80 mb-3 flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Connected Integrations
          </h2>
          <div className="space-y-3">
            <IntegrationCard index={0} name="Razorpay" icon={CreditCard} connected={true} detail="Webhook captures ₹299 payments and sends Meta CAPI events" />
            <IntegrationCard index={1} name="Meta Ads (CAPI)" icon={BarChart3} connected={true} detail="Purchase events sent server-side on payment.captured" />
            <IntegrationCard index={2} name="Google Sheet" icon={FileSpreadsheet} connected={true} detail="Master Sheet syncs contacts 3x daily (6AM, 12PM, 6PM UTC)" />
            <IntegrationCard index={3} name="SMTP Email" icon={Mail} connected={true} detail="support@example.com via Hostinger (smtp.hostinger.com:465)" />
          </div>
        </motion.div>

        {/* SMTP Settings */}
        <SmtpSettings />

        {/* Webhook Documentation */}
        <WebhookDocs />

        {/* Deliverability */}
        <DeliverabilityChecker />

        {/* System Webhook URLs */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
          <h2 className="text-sm font-semibold text-foreground/80 mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            System Webhook URLs
          </h2>
          <div className="bg-card rounded-2xl border border-border/50 p-5 shadow-sm space-y-3">
            {[
              { label: "Razorpay Webhook", url: `${baseUrl}/razorpay-webhook` },
              { label: "Google Sheet Webhook", url: `${baseUrl}/gsheet-webhook` },
              { label: "Email Engine", url: `${baseUrl}/email-engine` },
              { label: "Email Tracking", url: `${baseUrl}/email-track` },
              { label: "Master Sheet Sync", url: `${baseUrl}/sync-master-sheet` },
            ].map(({ label, url }) => {
              return (
                <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-background/40 border border-border/30 hover:border-primary/20 transition-all group">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Link2 className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">{label}</p>
                    <p className="text-[10px] text-muted-foreground font-mono truncate">{url}</p>
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(url); toast.success("Copied!"); }}
                    className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all opacity-50 group-hover:opacity-100"
                    title="Copy URL"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Last Sync */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="bg-card rounded-2xl border border-border/50 p-5 shadow-sm"
        >
          <div className="flex items-center gap-3 text-sm">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Clock className="w-4 h-4 text-primary" />
            </div>
            <div>
              <span className="text-muted-foreground text-xs block">Last webhook received</span>
              <span className="font-semibold text-foreground">
                {lastSync ? new Date(lastSync).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "No data yet"}
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
