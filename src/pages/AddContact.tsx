import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import Layout from "@/components/Layout";
import { useToast } from "@/components/Toast";
import { motion } from "framer-motion";
import { ArrowLeft, Save, User, Mail, Phone, MapPin, Building, StickyNote, Tag } from "lucide-react";

const SEGMENT_OPTIONS = [
  { value: "lead", label: "Lead" },
  { value: "paid-299", label: "Paid ₹299" },
  { value: "call-booked", label: "Call Booked" },
  { value: "purchased", label: "Higher Ticket" },
  { value: "not-converted", label: "Not Converted" },
];

const SOURCE_OPTIONS = [
  { value: "manual", label: "Manual Entry" },
  { value: "meta-ads", label: "Meta Ads" },
  { value: "referral", label: "Referral" },
  { value: "organic", label: "Organic" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "webinar", label: "Webinar" },
  { value: "other", label: "Other" },
];

export default function AddContact() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    city: "",
    region: "",
    source: "manual",
    status: "active",
    tags: [] as string[],
    segment: "lead",
    notes: "",
    utm_source: "",
    utm_medium: "",
    utm_campaign: "",
  });

  const [tagInput, setTagInput] = useState("");

  const update = (field: string, value: any) => setForm(prev => ({ ...prev, [field]: value }));

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (t && !form.tags.includes(t)) {
      setForm(prev => ({ ...prev, tags: [...prev.tags, t] }));
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => setForm(prev => ({ ...prev, tags: [...prev.tags.filter(t => t !== tag)] }));

  const handleSave = async () => {
    if (!form.first_name.trim() || !form.email.trim()) {
      addToast("First name and email are required", "error");
      return;
    }

    setSaving(true);
    try {
      const tags = [...form.tags];
      if (form.segment && !tags.includes(form.segment)) tags.push(form.segment);

      const { error } = await supabase.from("automation_contacts").insert({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim() || null,
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || null,
        city: form.city.trim() || null,
        region: form.region.trim() || null,
        source: form.source,
        status: form.status,
        tags,
        utm_source: form.utm_source.trim() || null,
        utm_medium: form.utm_medium.trim() || null,
        utm_campaign: form.utm_campaign.trim() || null,
        custom_fields: form.notes ? { notes: form.notes } : null,
      });

      if (error) throw error;
      addToast("Contact added successfully", "success");
      navigate("/contacts");
    } catch (err: any) {
      if (err.message?.includes("duplicate")) {
        addToast("A contact with this email already exists", "error");
      } else {
        addToast(err.message || "Failed to save contact", "error");
      }
    } finally {
      setSaving(false);
    }
  };

  const InputField = ({ label, icon: Icon, value, onChange, placeholder, type = "text", required = false }: any) => (
    <div>
      <label className="block text-[10px] text-muted-foreground/50 uppercase tracking-[0.1em] mb-1.5">{label}{required && <span className="text-primary ml-0.5">*</span>}</label>
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/30" />}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full ${Icon ? 'pl-9' : 'pl-3'} pr-3 py-2.5 rounded-lg bg-surface border border-border/15 text-sm text-foreground placeholder:text-muted-foreground/25 focus:outline-none focus:border-primary/30 focus:ring-1 focus:ring-primary/10 transition-all`}
        />
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/contacts")}
              className="w-8 h-8 rounded-lg bg-card border border-border/15 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <p className="text-[10px] text-muted-foreground/40">Contacts → Add Contact</p>
              <h1 className="text-lg font-semibold text-foreground">Add New Contact</h1>
              <p className="text-xs text-muted-foreground/50">Create a new contact profile in your directory</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/contacts")}
              className="px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-black text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? "Saving..." : "Save Contact"}
            </button>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left Column — Personal Info */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-2 space-y-5"
          >
            {/* Personal Information */}
            <div className="rounded-xl border border-border/15 bg-card p-5">
              <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.12em] mb-4">Personal Information</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField label="First Name" icon={User} value={form.first_name} onChange={(v: string) => update("first_name", v)} placeholder="e.g. John" required />
                <InputField label="Last Name" icon={User} value={form.last_name} onChange={(v: string) => update("last_name", v)} placeholder="e.g. Doe" />
                <InputField label="Email Address" icon={Mail} value={form.email} onChange={(v: string) => update("email", v)} placeholder="john@example.com" type="email" required />
                <InputField label="Phone Number" icon={Phone} value={form.phone} onChange={(v: string) => update("phone", v)} placeholder="+91 98765 43210" />
              </div>
            </div>

            {/* Location */}
            <div className="rounded-xl border border-border/15 bg-card p-5">
              <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.12em] mb-4">Location</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField label="City" icon={MapPin} value={form.city} onChange={(v: string) => update("city", v)} placeholder="e.g. Mumbai" />
                <InputField label="State / Region" icon={MapPin} value={form.region} onChange={(v: string) => update("region", v)} placeholder="e.g. Maharashtra" />
              </div>
            </div>

            {/* UTM / Attribution */}
            <div className="rounded-xl border border-border/15 bg-card p-5">
              <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.12em] mb-4">Attribution (Optional)</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <InputField label="UTM Source" value={form.utm_source} onChange={(v: string) => update("utm_source", v)} placeholder="e.g. facebook" />
                <InputField label="UTM Medium" value={form.utm_medium} onChange={(v: string) => update("utm_medium", v)} placeholder="e.g. cpc" />
                <InputField label="UTM Campaign" value={form.utm_campaign} onChange={(v: string) => update("utm_campaign", v)} placeholder="e.g. abundance_feb" />
              </div>
            </div>
          </motion.div>

          {/* Right Column — Segment, Tags, Notes */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-5"
          >
            {/* Segment & Source */}
            <div className="rounded-xl border border-border/15 bg-card p-5">
              <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.12em] mb-4">Classification</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] text-muted-foreground/50 uppercase tracking-[0.1em] mb-1.5">Customer Segment</label>
                  <select
                    value={form.segment}
                    onChange={(e) => update("segment", e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg bg-surface border border-border/15 text-sm text-foreground focus:outline-none focus:border-primary/30 transition-all appearance-none"
                  >
                    {SEGMENT_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] text-muted-foreground/50 uppercase tracking-[0.1em] mb-1.5">Source</label>
                  <div className="relative">
                    <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/30" />
                    <select
                      value={form.source}
                      onChange={(e) => update("source", e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-surface border border-border/15 text-sm text-foreground focus:outline-none focus:border-primary/30 transition-all appearance-none"
                    >
                      {SOURCE_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className="rounded-xl border border-border/15 bg-card p-5">
              <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.12em] mb-4">Tags</p>
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/30" />
                  <input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                    placeholder="Add a tag..."
                    className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-surface border border-border/15 text-sm text-foreground placeholder:text-muted-foreground/25 focus:outline-none focus:border-primary/30 transition-all"
                  />
                </div>
                <button onClick={addTag} className="px-3 py-2.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors">Add</button>
              </div>
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {form.tags.map(tag => (
                    <span key={tag} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 text-primary text-[11px] font-medium">
                      {tag}
                      <button onClick={() => removeTag(tag)} className="text-primary/50 hover:text-primary ml-0.5">×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="rounded-xl border border-border/15 bg-card p-5">
              <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.12em] mb-4">Internal Notes</p>
              <div className="relative">
                <StickyNote className="absolute left-3 top-3 w-3.5 h-3.5 text-muted-foreground/30" />
                <textarea
                  value={form.notes}
                  onChange={(e) => update("notes", e.target.value)}
                  placeholder="Add any notes about this contact..."
                  rows={4}
                  className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-surface border border-border/15 text-sm text-foreground placeholder:text-muted-foreground/25 focus:outline-none focus:border-primary/30 resize-none transition-all"
                />
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}
