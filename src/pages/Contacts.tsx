import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import Layout from "@/components/Layout";
import { useToast } from "@/components/Toast";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Download, ChevronLeft, ChevronRight, Users, Phone, Mail, Calendar, X, ArrowUpDown, CheckSquare, Square, Sparkles, Tag, Zap, ChevronDown, Upload, Copy } from "lucide-react";
import ImportContactsModal from "@/components/ImportContactsModal";
import DuplicateContactsModal from "@/components/DuplicateContactsModal";

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

function StatusBadge({ contact }: { contact: any }) {
  if (contact.purchased_50k) return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-gradient-to-r from-yellow-500/20 to-yellow-500/10 text-yellow-300 border border-yellow-500/20">₹50K ✓</span>;
  if (contact.call_booked) return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-gradient-to-r from-orange-500/20 to-orange-500/10 text-orange-400 border border-orange-500/20">Call Booked</span>;
  if (contact.paid_299) return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 text-emerald-400 border border-emerald-500/20">Paid ₹299</span>;
  return <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-muted/50 text-muted-foreground border border-border/50">Lead</span>;
}

function UnsubBadge({ contact }: { contact: any }) {
  if (!contact.unsubscribed) return null;
  return (
    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-500/15 text-red-400 border border-red-500/20 flex-shrink-0">
      Unsub
    </span>
  );
}

function LeadScore({ contact }: { contact: any }) {
  const score = (contact.paid_299 ? 50 : 0) + (contact.call_booked ? 75 : 0) + (contact.purchased_50k ? 200 : 0);
  const color = score >= 200 ? "text-primary" : score >= 75 ? "text-emerald-400" : score >= 50 ? "text-blue-400" : "text-muted-foreground/40";
  return <span className={`text-[11px] font-bold ${color}`}>{score}pts</span>;
}

function AvatarCircle({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "w-8 h-8 text-xs", md: "w-10 h-10 text-sm", lg: "w-12 h-12 text-base" };
  const colors = [
    "from-primary to-primary-dark",
    "from-emerald-500 to-emerald-600",
    "from-violet-500 to-violet-600",
    "from-blue-500 to-blue-600",
    "from-pink-500 to-pink-600",
    "from-amber-500 to-amber-600",
  ];
  const colorIdx = name.charCodeAt(0) % colors.length;
  return (
    <div className={`${sizes[size]} rounded-full bg-gradient-to-br ${colors[colorIdx]} flex items-center justify-center font-bold text-foreground shadow-md flex-shrink-0`}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

const filterChips = [
  { key: "all", label: "All" },
  { key: "paid-299", label: "Paid ₹299" },
  { key: "paid-50k", label: "Higher Ticket" },
  { key: "unpaid", label: "Unpaid" },
  { key: "unsubscribed", label: "Unsubscribed" },
];


export default function Contacts() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [showSequenceDropdown, setShowSequenceDropdown] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showDedupModal, setShowDedupModal] = useState(false);
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const seqDropdownRef = useRef<HTMLDivElement>(null);
  const PER_PAGE = 20;

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("contacts-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "automation_contacts" }, () => {
        queryClient.invalidateQueries({ queryKey: ["contacts"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) setShowTagDropdown(false);
      if (seqDropdownRef.current && !seqDropdownRef.current.contains(e.target as Node)) setShowSequenceDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data: tags } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data } = await supabase.from("automation_tags").select("*").order("name");
      return data || [];
    },
  });

  const { data: sequences } = useQuery({
    queryKey: ["sequences-list"],
    queryFn: async () => {
      const { data } = await supabase.from("automation_sequences").select("id, name, status").order("name");
      return data || [];
    },
  });

  // Bulk: Add Tag
  const addTagMutation = useMutation({
    mutationFn: async (tagName: string) => {
      const selectedContacts = (data?.contacts || []).filter((c: any) => selectedIds.has(c.id));
      for (const contact of selectedContacts) {
        const currentTags: string[] = contact.tags || [];
        if (!currentTags.includes(tagName)) {
          const { error } = await supabase
            .from("automation_contacts")
            .update({ tags: [...currentTags, tagName] })
            .eq("id", contact.id);
          if (error) throw error;
        }
      }
      return tagName;
    },
    onSuccess: (tagName) => {
      toast.success(`Tag "${tagName}" added to ${selectedIds.size} contacts`);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setSelectedIds(new Set());
      setShowTagDropdown(false);
    },
    onError: () => toast.error("Failed to add tag"),
  });

  // Bulk: Enroll in Sequence
  const enrollMutation = useMutation({
    mutationFn: async ({ sequenceId, sequenceName }: { sequenceId: string; sequenceName: string }) => {
      const insertData = Array.from(selectedIds).map((contactId) => ({
        sequence_id: sequenceId,
        contYOUR_AD_ACCOUNT_IDid: contactId,
        status: "active",
        step_index: 0,
      }));
      const { error } = await supabase
        .from("automation_sequence_enrollments")
        .upsert(insertData, { onConflict: "sequence_id,contYOUR_AD_ACCOUNT_IDid" });
      if (error) throw error;
      return sequenceName;
    },
    onSuccess: (sequenceName) => {
      toast.success(`Enrolled ${selectedIds.size} contacts in "${sequenceName}"`);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      setSelectedIds(new Set());
      setShowSequenceDropdown(false);
    },
    onError: () => toast.error("Failed to enroll contacts"),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["contacts", search, tagFilter, paymentFilter, page],
    queryFn: async () => {
      let q = supabase.from("automation_contacts").select("*", { count: "exact" });
      if (search) q = q.or(`email.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%,phone.ilike.%${search}%`);
      if (tagFilter !== "all") q = q.contains("tags", [tagFilter]);
      if (paymentFilter === "paid-299") q = q.eq("paid_299", true);
      if (paymentFilter === "paid-50k") q = q.eq("purchased_50k", true);
      if (paymentFilter === "unpaid") q = q.or("paid_299.is.null,paid_299.eq.false");
      if (paymentFilter === "unsubscribed") q = q.eq("unsubscribed", true);
      q = q.order("created_at", { ascending: false }).range(page * PER_PAGE, (page + 1) * PER_PAGE - 1);
      const { data, count } = await q;
      return { contacts: data || [], total: count || 0 };
    },
  });

  const exportCSV = (contactsToExport?: any[]) => {
    const exportData = contactsToExport ?? data?.contacts ?? [];
    if (!exportData.length) return;
    const headers = ["first_name", "last_name", "email", "phone", "tags", "paid_299", "call_booked", "purchased_50k", "created_at", "source", "utm_source", "utm_campaign"];
    const csvRows = [
      headers.join(","),
      ...exportData.map((c: any) =>
        headers.map((h) => {
          if (h === "tags") return `"${(c[h] || []).join("|")}"`;
          return `"${c[h] ?? ""}"`;
        }).join(",")
      ),
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contacts-${dateStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${exportData.length} contacts`);
  };

  const exportSelected = () => {
    const selected = (data?.contacts || []).filter((c: any) => selectedIds.has(c.id));
    exportCSV(selected);
  };

  const totalPages = Math.ceil((data?.total || 0) / PER_PAGE);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!data?.contacts) return;
    if (selectedIds.size === data.contacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.contacts.map((c: any) => c.id)));
    }
  };

  return (
    <Layout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-5 h-5 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Contacts</h1>
            </div>
            <p className="text-sm text-muted-foreground">{data?.total || 0} total contacts in your CRM</p>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate("/contacts/new")}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-primary text-black text-sm font-semibold hover:bg-primary/90 transition-all whitespace-nowrap"
            >
              <Users className="w-4 h-4" /> Add Contact
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowImportModal(true)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-card border border-border/50 text-foreground text-sm font-semibold hover:bg-surface-hover transition-all whitespace-nowrap"
            >
              <Upload className="w-4 h-4" /> Import
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowDedupModal(true)}
              className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-card border border-border/50 text-yellow-400 text-sm font-semibold hover:bg-surface-hover transition-all whitespace-nowrap"
            >
              <Copy className="w-4 h-4" /> Dedup
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={exportCSV}
              className="flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-primary to-gold-dark text-black text-sm font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow whitespace-nowrap"
            >
              <Download className="w-4 h-4" /> Export CSV
            </motion.button>
          </div>
        </div>

        {/* Search & Filter Chips */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search name, email, phone..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              className="w-full h-12 pl-11 pr-4 rounded-2xl border border-border/50 bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all shadow-sm"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          {/* Filter chips row */}
          <div className="flex flex-wrap gap-2">
            {filterChips.map((chip) => (
              <button
                key={chip.key}
                onClick={() => { setPaymentFilter(chip.key); setPage(0); }}
                className={`px-4 py-2 rounded-full text-xs font-semibold transition-all border ${
                  paymentFilter === chip.key
                    ? "bg-primary/15 text-primary border-primary/30 shadow-sm"
                    : "bg-surface text-muted-foreground border-border/50 hover:bg-surface-hover hover:text-foreground"
                }`}
              >
                {chip.label}
              </button>
            ))}
            {/* Tag filter chips */}
            {(tags || []).slice(0, 5).map((t: any) => (
              <button
                key={t.id}
                onClick={() => { setTagFilter(tagFilter === t.name ? "all" : t.name); setPage(0); }}
                className={`px-3 py-2 rounded-full text-xs font-semibold transition-all border flex items-center gap-1.5 ${
                  tagFilter === t.name
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "bg-surface text-muted-foreground border-border/50 hover:bg-surface-hover"
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color || "#6366f1" }} />
                {t.name}
                {tagFilter === t.name && <X className="w-3 h-3 ml-0.5" />}
              </button>
            ))}
          </div>
        </div>

        {/* Bulk action bar */}
        <AnimatePresence>
          {selectedIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-primary/10 border border-primary/20 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3"
            >
              <span className="text-sm font-semibold text-primary mr-1">
                {selectedIds.size} selected
              </span>

              {/* Add Tag */}
              <div ref={tagDropdownRef} className="relative">
                <button
                  onClick={() => { setShowTagDropdown(v => !v); setShowSequenceDropdown(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border/50 text-xs font-semibold text-foreground hover:bg-surface-hover transition-all"
                >
                  <Tag className="w-3.5 h-3.5" /> Add Tag <ChevronDown className="w-3 h-3" />
                </button>
                <AnimatePresence>
                  {showTagDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -4, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.97 }}
                      className="absolute bottom-full mb-2 left-0 z-50 bg-card border border-border rounded-2xl shadow-2xl min-w-[240px] p-3"
                    >
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">Add Tag to {selectedIds.size} contacts</p>
                      {(tags || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground/60 py-2">No tags available</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {(tags || []).map((t: any) => (
                            <button
                              key={t.id}
                              onClick={() => addTagMutation.mutate(t.name)}
                              disabled={addTagMutation.isPending}
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold bg-muted text-foreground border border-border hover:bg-primary/20 hover:text-primary hover:border-primary/40 transition-all active:scale-95 disabled:opacity-50"
                            >
                              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color || "#6366f1" }} />
                              {t.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Export Selected */}
              <button
                onClick={exportSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border/50 text-xs font-semibold text-foreground hover:bg-surface-hover transition-all"
              >
                <Download className="w-3.5 h-3.5" /> Export Selected
              </button>

              {/* Enroll in Sequence */}
              <div ref={seqDropdownRef} className="relative">
                <button
                  onClick={() => { setShowSequenceDropdown(v => !v); setShowTagDropdown(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border/50 text-xs font-semibold text-foreground hover:bg-surface-hover transition-all"
                >
                  <Zap className="w-3.5 h-3.5" /> Enroll in Sequence <ChevronDown className="w-3 h-3" />
                </button>
                <AnimatePresence>
                  {showSequenceDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: 4, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 4, scale: 0.97 }}
                      className="absolute top-full mt-1 left-0 z-50 bg-card border border-border/50 rounded-xl shadow-xl min-w-[200px] py-1 overflow-hidden"
                    >
                      {(sequences || []).length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">No sequences found</p>
                      ) : (
                        (sequences || []).map((s: any) => (
                          <button
                            key={s.id}
                            onClick={() => enrollMutation.mutate({ sequenceId: s.id, sequenceName: s.name })}
                            disabled={enrollMutation.isPending}
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-foreground hover:bg-surface-hover transition-colors disabled:opacity-50"
                          >
                            <Zap className="w-3 h-3 text-primary flex-shrink-0" />
                            <span className="truncate">{s.name}</span>
                            {s.status === "active" && <span className="ml-auto text-[9px] text-emerald-400 font-bold">ACTIVE</span>}
                          </button>
                        ))
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button
                onClick={() => setSelectedIds(new Set())}
                className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-semibold transition-colors"
              >
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mobile: Card View */}
        <div className="md:hidden space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-card rounded-2xl border border-border/50 p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-muted" />
                  <div className="flex-1">
                    <div className="h-4 bg-muted rounded w-32 mb-2" />
                    <div className="h-3 bg-muted/50 rounded w-48" />
                  </div>
                </div>
              </div>
            ))
          ) : (data?.contacts || []).length === 0 ? (
            <div className="bg-card rounded-2xl border border-border/50 p-12 text-center">
              <Users className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-foreground/60 font-medium">No contacts found</p>
              <p className="text-muted-foreground text-xs mt-1">Try adjusting your search or filters</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {(data?.contacts || []).map((c: any, idx: number) => (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ delay: idx * 0.03 }}
                  onClick={() => navigate(`/contacts/${c.id}`)}
                  className="bg-card rounded-2xl border border-border/50 p-4 active:scale-[0.98] transition-transform cursor-pointer hover:border-primary/30 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <AvatarCircle name={c.first_name || c.email || "?"} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1 gap-1 flex-wrap">
                        <p className="font-semibold text-sm text-foreground truncate">
                          {c.first_name ? `${c.first_name} ${c.last_name || ""}`.trim() : "—"}
                        </p>
                        <div className="flex items-center gap-1">
                          <UnsubBadge contact={c} />
                          <StatusBadge contact={c} />
                          <LeadScore contact={c} />
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                        <Mail className="w-3 h-3" />
                        <span className="truncate">{c.email}</span>
                      </div>
                      {c.phone && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                          <Phone className="w-3 h-3" />
                          <span>{c.phone}</span>
                        </div>
                      )}
                      <div className="flex gap-1.5 flex-wrap mt-1">
                        {(c.tags || []).slice(0, 3).map((t: string) => (
                          <span key={t} className={`px-2.5 py-1 rounded-full text-[11px] font-bold border backdrop-blur-sm ${getTagColor(t)}`}>{t}</span>
                        ))}
                        {(c.tags || []).length > 3 && (
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-gray-500/30 text-gray-300 border border-gray-500/40">+{c.tags.length - 3}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Desktop: Table View */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="hidden md:block bg-card rounded-2xl border border-border/50 overflow-hidden shadow-sm"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-surface/30">
                  <th className="text-left px-4 py-3.5 w-10">
                    <button onClick={toggleSelectAll} className="text-muted-foreground hover:text-foreground transition-colors">
                      {data?.contacts && selectedIds.size === data.contacts.length && data.contacts.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-primary" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Name</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden lg:table-cell">Phone</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tags</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden xl:table-cell">Source</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-4 py-3.5"><div className="h-4 bg-muted/30 rounded-lg animate-pulse" /></td>
                      ))}
                    </tr>
                  ))
                ) : (data?.contacts || []).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-16 text-center">
                      <Users className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                      <p className="text-foreground/60 font-medium">No contacts found</p>
                      <p className="text-muted-foreground text-xs mt-1">Try adjusting your search or filters</p>
                    </td>
                  </tr>
                ) : (
                  (data?.contacts || []).map((c: any) => (
                    <motion.tr
                      key={c.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-surface-hover/50 cursor-pointer transition-colors group"
                    >
                      <td className="px-4 py-3.5" onClick={(e) => { e.stopPropagation(); toggleSelect(c.id); }}>
                        {selectedIds.has(c.id) ? (
                          <CheckSquare className="w-4 h-4 text-primary" />
                        ) : (
                          <Square className="w-4 h-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
                        )}
                      </td>
                      <td className="px-4 py-3.5" onClick={() => navigate(`/contacts/${c.id}`)}>
                        <div className="flex items-center gap-3">
                          <AvatarCircle name={c.first_name || c.email || "?"} size="sm" />
                          <div>
                            <p className="font-medium text-foreground group-hover:text-primary transition-colors">{c.first_name ? `${c.first_name} ${c.last_name || ""}`.trim() : "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-foreground/70" onClick={() => navigate(`/contacts/${c.id}`)}>{c.email}</td>
                      <td className="px-4 py-3.5 text-muted-foreground hidden lg:table-cell" onClick={() => navigate(`/contacts/${c.id}`)}>{c.phone || "—"}</td>
                      <td className="px-4 py-3.5" onClick={() => navigate(`/contacts/${c.id}`)}>
                        <div className="flex gap-1 items-center">
                          {(c.tags || []).slice(0, 2).map((t: string) => (
                            <span key={t} className={`px-2.5 py-1 rounded-full text-[11px] font-bold border backdrop-blur-sm ${getTagColor(t)}`}>{t}</span>
                          ))}
                          {(c.tags || []).length > 2 && (
                            <span className="px-2 py-1 rounded-full text-[11px] font-bold bg-gray-500/30 text-gray-300 border border-gray-500/40">+{c.tags.length - 2}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5" onClick={() => navigate(`/contacts/${c.id}`)}><div className="flex items-center gap-1.5 flex-wrap"><UnsubBadge contact={c} /><StatusBadge contact={c} /><LeadScore contact={c} /></div></td>
                      <td className="px-4 py-3.5 text-muted-foreground text-xs hidden xl:table-cell" onClick={() => navigate(`/contacts/${c.id}`)}>{c.utm_campaign || c.source || "—"}</td>
                      <td className="px-4 py-3.5 text-muted-foreground text-xs" onClick={() => navigate(`/contacts/${c.id}`)}>
                        {c.created_at ? new Date(c.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
              <p className="text-xs text-muted-foreground">
                Showing {page * PER_PAGE + 1}–{Math.min((page + 1) * PER_PAGE, data?.total || 0)} of {data?.total || 0}
              </p>
              <div className="flex gap-1">
                <button
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                  className="p-2 rounded-xl hover:bg-surface-hover disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-foreground/60" />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                  const pageNum = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-9 h-9 rounded-xl text-xs font-semibold transition-all ${pageNum === page ? "bg-gradient-to-r from-primary to-gold-dark text-black shadow-sm" : "text-foreground/60 hover:bg-surface-hover"}`}
                    >
                      {pageNum + 1}
                    </button>
                  );
                })}
                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                  className="p-2 rounded-xl hover:bg-surface-hover disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-foreground/60" />
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {/* Mobile Pagination */}
        {totalPages > 1 && (
          <div className="md:hidden flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Page {page + 1} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
                className="px-4 py-2 rounded-xl bg-surface border border-border/50 text-sm font-medium disabled:opacity-30 transition-all"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
                className="px-4 py-2 rounded-xl bg-surface border border-border/50 text-sm font-medium disabled:opacity-30 transition-all"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Import CSV Modal */}
      {showImportModal && (
        <ImportContactsModal
          onClose={() => setShowImportModal(false)}
          onImported={() => {
            queryClient.invalidateQueries({ queryKey: ["contacts"] });
            setShowImportModal(false);
          }}
        />
      )}

      {showDedupModal && (
        <DuplicateContactsModal
          onClose={() => {
            setShowDedupModal(false);
            queryClient.invalidateQueries({ queryKey: ["contacts"] });
          }}
        />
      )}
    </Layout>
  );
}
