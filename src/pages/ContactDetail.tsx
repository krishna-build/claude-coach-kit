import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import Layout from "@/components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Save, X, Plus, Phone, Mail, CreditCard, Calendar, Globe, User, FileText, Loader2, ChevronRight, Inbox, Star } from "lucide-react";

const TAG_COLORS: Record<string, string> = {
  lead: "bg-blue-500/25 text-blue-300 border-blue-500/40",
  "paid-299": "bg-emerald-500/25 text-emerald-300 border-emerald-500/40",
  "call-booked": "bg-orange-500/25 text-orange-300 border-orange-500/40",
  purchased: "bg-yellow-500/25 text-yellow-200 border-yellow-500/40",
  "not-converted": "bg-red-500/25 text-red-300 border-red-500/40",
  "no-show": "bg-gray-500/25 text-gray-300 border-gray-500/40",
  default: "bg-primary/25 text-primary border-primary/40",
};

function getTagColor(tag: string) {
  return TAG_COLORS[tag.toLowerCase()] || TAG_COLORS.default;
}

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [notes, setNotes] = useState("");
  const [showTagDropdown, setShowTagDropdown] = useState(false);

  const { data: contact, isLoading } = useQuery({
    queryKey: ["contact", id],
    queryFn: async () => {
      const { data } = await supabase.from("automation_contacts").select("*").eq("id", id!).single();
      return data;
    },
    enabled: !!id,
  });

  const { data: allTags } = useQuery({
    queryKey: ["all-tags"],
    queryFn: async () => {
      const { data } = await supabase.from("automation_tags").select("*").order("name");
      return data || [];
    },
  });

  const { data: timeline } = useQuery({
    queryKey: ["contact-timeline", contact?.email],
    queryFn: async () => {
      if (!contact?.email) return [];
      const [emailLogs, webhookLogs] = await Promise.all([
        supabase.from("automation_email_log").select("*").eq("contYOUR_AD_ACCOUNT_IDid", contact.id).order("sent_at", { ascending: false }).limit(20),
        supabase.from("automation_webhook_log").select("*").ilike("payload::text", `%${contact.email}%`).order("created_at", { ascending: false }).limit(20),
      ]);
      const events: any[] = [];
      (emailLogs.data || []).forEach((e: any) => events.push({ type: "email", date: e.sent_at, title: `Email: ${e.subject || "No subject"}`, detail: e.status }));
      (webhookLogs.data || []).forEach((e: any) => events.push({ type: "webhook", date: e.created_at, title: `Webhook: ${e.source || "unknown"}`, detail: e.event_type }));
      return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },
    enabled: !!contact?.email,
  });

  if (contact && !editing && !editData.email) {
    setEditData({ first_name: contact.first_name || "", last_name: contact.last_name || "", email: contact.email || "", phone: contact.phone || "" });
    setNotes(contact.custom_fields?.notes || "");
  }

  const updateContact = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase.from("automation_contacts").update(updates).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact", id] });
      setEditing(false);
    },
  });

  const addTag = async (tagName: string) => {
    if (!contact) return;
    const currentTags = contact.tags || [];
    if (currentTags.includes(tagName)) return;
    const newTags = [...currentTags, tagName];
    await supabase.from("automation_contacts").update({ tags: newTags }).eq("id", id!);
    queryClient.invalidateQueries({ queryKey: ["contact", id] });
    setShowTagDropdown(false);
  };

  const removeTag = async (tagName: string) => {
    if (!contact) return;
    const newTags = (contact.tags || []).filter((t: string) => t !== tagName);
    await supabase.from("automation_contacts").update({ tags: newTags }).eq("id", id!);
    queryClient.invalidateQueries({ queryKey: ["contact", id] });
  };

  const saveNotes = async () => {
    if (!contact) return;
    const cf = { ...(contact.custom_fields || {}), notes };
    await supabase.from("automation_contacts").update({ custom_fields: cf }).eq("id", id!);
    queryClient.invalidateQueries({ queryKey: ["contact", id] });
  };

  if (isLoading) return (
    <Layout>
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading contact...</p>
      </div>
    </Layout>
  );

  if (!contact) return (
    <Layout>
      <div className="text-center py-20">
        <User className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
        <p className="text-foreground/60 font-medium">Contact not found</p>
      </div>
    </Layout>
  );

  const availableTags = (allTags || []).filter((t: any) => !(contact.tags || []).includes(t.name));

  const avatarColors = [
    "from-primary to-primary-dark",
    "from-emerald-500 to-emerald-600",
    "from-violet-500 to-violet-600",
    "from-blue-500 to-blue-600",
    "from-pink-500 to-pink-600",
  ];
  const avatarColor = avatarColors[(contact.first_name || contact.email || "A").charCodeAt(0) % avatarColors.length];

  // Lead Score calculation
  const leadScore = (() => {
    let score = 0;
    (timeline || []).forEach((e: any) => {
      if (e.type === "email") {
        if (e.detail === "opened") score += 10;
        if (e.detail === "clicked") score += 20;
      }
    });
    if (contact.paid_299) score += 50;
    if (contact.call_booked) score += 75;
    if (contact.purchased_50k) score += 200;
    return Math.min(score, 999);
  })();

  const scoreConfig = leadScore >= 200
    ? { label: "Hot 🔥", bg: "bg-primary/15 border-primary/30", text: "text-primary" }
    : leadScore >= 100
    ? { label: "Warm", bg: "bg-emerald-500/15 border-emerald-500/30", text: "text-emerald-400" }
    : leadScore >= 40
    ? { label: "Engaged", bg: "bg-blue-500/15 border-blue-500/30", text: "text-blue-400" }
    : { label: "Cold", bg: "bg-muted/40 border-border/50", text: "text-muted-foreground" };

  return (
    <Layout>
      <div className="space-y-5">
        {/* Back */}
        <motion.button
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          onClick={() => navigate("/contacts")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" /> Back to Contacts
        </motion.button>

        {/* Header Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative bg-card rounded-2xl border border-border/50 p-6 shadow-sm overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-primary/5 to-transparent rounded-full blur-2xl -translate-y-1/2 translate-x-1/4" />
          
          <div className="relative z-10 flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${avatarColor} flex items-center justify-center text-foreground font-bold text-2xl shadow-lg`}>
                {(contact.first_name || contact.email || "?")[0].toUpperCase()}
              </div>
              {editing ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input value={editData.first_name} onChange={e => setEditData({ ...editData, first_name: e.target.value })} placeholder="First name" className="h-10 px-4 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                    <input value={editData.last_name} onChange={e => setEditData({ ...editData, last_name: e.target.value })} placeholder="Last name" className="h-10 px-4 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                  </div>
                  <input value={editData.email} onChange={e => setEditData({ ...editData, email: e.target.value })} placeholder="Email" className="h-10 px-4 rounded-xl border border-border/50 bg-background text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                  <input value={editData.phone} onChange={e => setEditData({ ...editData, phone: e.target.value })} placeholder="Phone" className="h-10 px-4 rounded-xl border border-border/50 bg-background text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-xl font-bold text-foreground">{contact.first_name ? `${contact.first_name} ${contact.last_name || ""}`.trim() : contact.email}</h1>
                    {/* Lead Score Badge */}
                    <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold ${scoreConfig.bg} ${scoreConfig.text}`}>
                      <Star className="w-3 h-3" />
                      <span>{leadScore} pts · {scoreConfig.label}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {contact.email}</span>
                    {contact.phone && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {contact.phone}</span>}
                  </div>
                </div>
              )}
            </div>
            {editing ? (
              <div className="flex gap-2">
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => updateContact.mutate(editData)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-primary to-gold-dark text-black text-sm font-semibold shadow-lg shadow-primary/20"><Save className="w-3.5 h-3.5" /> Save</motion.button>
                <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-xl text-muted-foreground text-sm hover:bg-surface-hover transition-colors">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setEditing(true)} className="px-4 py-2 rounded-xl border border-border/50 text-sm text-foreground/70 hover:bg-surface-hover hover:border-primary/30 transition-all">Edit</button>
            )}
          </div>

          {/* Tags Section */}
          <div className="mt-5 space-y-3">
            {/* Current Tags */}
            <div className="flex items-center gap-2 flex-wrap">
              {(contact.tags || []).length === 0 && !showTagDropdown && (
                <span className="text-sm text-muted-foreground/60">No tags assigned</span>
              )}
              {(contact.tags || []).map((t: string) => (
                <span key={t} className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-bold border ${getTagColor(t)}`}>
                  {t}
                  <button onClick={() => removeTag(t)} className="ml-1 hover:opacity-70 transition-opacity"><X className="w-3.5 h-3.5" /></button>
                </span>
              ))}
              <button 
                onClick={() => setShowTagDropdown(!showTagDropdown)} 
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                  showTagDropdown 
                    ? 'bg-primary/20 text-primary border-primary/40' 
                    : 'bg-muted text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                }`}
              >
                <Plus className="w-4 h-4" /> {showTagDropdown ? 'Close' : 'Add Tag'}
              </button>
            </div>

            {/* Tag Selection Panel */}
            <AnimatePresence>
              {showTagDropdown && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-card border border-border rounded-xl p-4">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Available Tags</p>
                    {availableTags.length === 0 ? (
                      <p className="text-sm text-muted-foreground/60 py-2">All tags already assigned ✓</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {availableTags.map((t: any) => (
                          <button
                            key={t.id}
                            onClick={() => { addTag(t.name); }}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-muted text-foreground border border-border hover:bg-primary/20 hover:text-primary hover:border-primary/40 transition-all active:scale-95"
                          >
                            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: t.color || "#6366f1" }} />
                            {t.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: CreditCard, iconColor: "text-emerald-500", iconBg: "from-emerald-500/20 to-emerald-500/5", title: "Payment",
              content: (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">₹299</span>{contact.paid_299 ? <span className="text-success font-semibold">Paid ✓</span> : <span className="text-muted-foreground">Not paid</span>}</div>
                  {contact.paid_299_at && <p className="text-xs text-muted-foreground">{new Date(contact.paid_299_at).toLocaleDateString("en-IN")}</p>}
                  <div className="flex justify-between"><span className="text-muted-foreground">₹50K</span>{contact.purchased_50k ? <span className="text-warning font-semibold">Converted ✓</span> : <span className="text-muted-foreground">Not yet</span>}</div>
                  {contact.purchased_50k_at && <p className="text-xs text-muted-foreground">{new Date(contact.purchased_50k_at).toLocaleDateString("en-IN")}</p>}
                </div>
              ),
            },
            {
              icon: Calendar, iconColor: "text-orange-500", iconBg: "from-orange-500/20 to-orange-500/5", title: "Call",
              content: (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Status</span>{contact.call_booked ? <span className="text-orange-400 font-semibold">Booked ✓</span> : <span className="text-muted-foreground">Not booked</span>}</div>
                  {contact.call_booked_at && <p className="text-xs text-muted-foreground">{new Date(contact.call_booked_at).toLocaleDateString("en-IN")}</p>}
                </div>
              ),
            },
            {
              icon: Globe, iconColor: "text-blue-500", iconBg: "from-blue-500/20 to-blue-500/5", title: "Source",
              content: (
                <div className="space-y-1.5 text-sm">
                  <p className="text-foreground/70 font-medium">{contact.utm_source || contact.source || "Unknown"}</p>
                  {contact.utm_campaign && <p className="text-xs text-muted-foreground truncate" title={contact.utm_campaign}>Campaign: {contact.utm_campaign}</p>}
                  {contact.utm_content && <p className="text-xs text-muted-foreground truncate" title={contact.utm_content}>Content: {contact.utm_content}</p>}
                </div>
              ),
            },
            {
              icon: User, iconColor: "text-violet-500", iconBg: "from-violet-500/20 to-violet-500/5", title: "Profile",
              content: (
                <div className="space-y-1.5 text-sm text-foreground/70">
                  {contact.custom_fields?.age && <p>Age: {contact.custom_fields.age}</p>}
                  {contact.custom_fields?.earning && <p>Earning: {contact.custom_fields.earning}</p>}
                  {contact.custom_fields?.goal && <p>Goal: {contact.custom_fields.goal}</p>}
                  {!contact.custom_fields?.age && !contact.custom_fields?.earning && <p className="text-muted-foreground">No profile data</p>}
                </div>
              ),
            },
          ].map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.08 }}
              className="bg-card rounded-2xl border border-border/50 p-5 shadow-sm"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80 mb-3">
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${card.iconBg} flex items-center justify-center`}>
                  <card.icon className={`w-4 h-4 ${card.iconColor}`} />
                </div>
                {card.title}
              </div>
              {card.content}
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Notes */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card rounded-2xl border border-border/50 p-5 shadow-sm"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <FileText className="w-4 h-4 text-primary" />
              </div>
              Notes
            </div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={6}
              className="w-full rounded-xl border border-border/50 bg-background p-4 text-sm text-foreground/80 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 resize-none transition-all"
              placeholder="Add notes about this contact..."
            />
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={saveNotes}
              className="mt-3 px-5 py-2 rounded-xl bg-gradient-to-r from-primary to-gold-dark text-black text-sm font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow"
            >
              Save Notes
            </motion.button>
          </motion.div>

          {/* Timeline */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-2 bg-card rounded-2xl border border-border/50 p-5 shadow-sm"
          >
            <h3 className="text-sm font-semibold text-foreground/80 mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/5 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-blue-500" />
              </div>
              Activity Timeline
            </h3>
            {(timeline || []).length === 0 ? (
              <div className="text-center py-10">
                <Calendar className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No activity recorded yet</p>
              </div>
            ) : (
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {(timeline || []).map((event: any, i: number) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.03 }}
                    className="flex gap-3 px-2 py-2.5 rounded-xl hover:bg-surface-hover/50 transition-colors"
                  >
                    <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${event.type === "email" ? "bg-blue-400" : "bg-emerald-400"}`} />
                    <div>
                      <p className="text-sm text-foreground/80 font-medium">{event.title}</p>
                      <p className="text-xs text-muted-foreground">{event.detail} · {new Date(event.date).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Email History */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-card rounded-2xl border border-border/50 p-5 shadow-sm"
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground/80 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/5 flex items-center justify-center">
              <Mail className="w-4 h-4 text-blue-500" />
            </div>
            Email History
          </div>
          <div className="text-center py-10">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/10 flex items-center justify-center mx-auto mb-3">
              <Inbox className="w-7 h-7 text-blue-400/40" />
            </div>
            <p className="text-sm font-medium text-foreground/60">No email history yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              Campaign emails sent to this contact will appear here with open &amp; click tracking.
            </p>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
