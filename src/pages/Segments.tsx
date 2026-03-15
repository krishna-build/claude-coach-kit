import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import Layout from "@/components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import { Users2, Plus, Trash2, Filter, Play, Save, X, ChevronDown, Tag } from "lucide-react";
import { useToast } from "@/components/Toast";

/* ─── Types ─── */
type FieldKey = "email" | "first_name" | "tags" | "paid_299" | "call_booked" | "purchased_50k" | "source" | "utm_source";
type Operator = "contains" | "equals" | "starts_with" | "is_true" | "is_false" | "includes" | "not_includes";
type MatchMode = "all" | "any";

interface Condition {
  id: string;
  field: FieldKey;
  operator: Operator;
  value: string;
}

interface Segment {
  id: string;
  name: string;
  conditions: Condition[];
  matchMode: MatchMode;
  createdAt: string;
}

const FIELDS: { key: FieldKey; label: string; type: "text" | "boolean" | "array" }[] = [
  { key: "email", label: "Email", type: "text" },
  { key: "first_name", label: "First Name", type: "text" },
  { key: "tags", label: "Tags", type: "array" },
  { key: "paid_299", label: "Paid ₹299", type: "boolean" },
  { key: "call_booked", label: "Call Booked", type: "boolean" },
  { key: "purchased_50k", label: "Purchased ₹50K", type: "boolean" },
  { key: "source", label: "Source", type: "text" },
  { key: "utm_source", label: "UTM Source", type: "text" },
];

const OPERATORS_FOR: Record<string, { key: Operator; label: string }[]> = {
  text: [
    { key: "contains", label: "contains" },
    { key: "equals", label: "equals" },
    { key: "starts_with", label: "starts with" },
  ],
  boolean: [
    { key: "is_true", label: "is Yes" },
    { key: "is_false", label: "is No" },
  ],
  array: [
    { key: "includes", label: "includes tag" },
    { key: "not_includes", label: "does not include tag" },
  ],
};

const STORAGE_KEY = "ita_contYOUR_AD_ACCOUNT_IDsegments";

function loadSegments(): Segment[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
}

function saveSegments(segs: Segment[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(segs));
}

function matchContact(contact: Record<string, any>, conditions: Condition[], matchMode: MatchMode): boolean {
  if (conditions.length === 0) return true;
  const results = conditions.map(c => {
    const val = contact[c.field];
    switch (c.operator) {
      case "contains": return typeof val === "string" && val.toLowerCase().includes(c.value.toLowerCase());
      case "equals": return String(val || "").toLowerCase() === c.value.toLowerCase();
      case "starts_with": return typeof val === "string" && val.toLowerCase().startsWith(c.value.toLowerCase());
      case "is_true": return val === true;
      case "is_false": return !val || val === false;
      case "includes": return Array.isArray(val) && val.some((t: string) => t?.toLowerCase().includes(c.value.toLowerCase()));
      case "not_includes": return !Array.isArray(val) || !val.some((t: string) => t?.toLowerCase().includes(c.value.toLowerCase()));
      default: return false;
    }
  });
  return matchMode === "all" ? results.every(Boolean) : results.some(Boolean);
}

export default function Segments() {
  const toast = useToast();
  const [segments, setSegments] = useState<Segment[]>(loadSegments);
  const [selected, setSelected] = useState<Segment | null>(null);
  const [editing, setEditing] = useState<Segment | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);

  // All contacts for preview
  const { data: allContacts = [] } = useQuery({
    queryKey: ["segments-contacts"],
    queryFn: async () => {
      const { data } = await supabase.from("automation_contacts").select("*").limit(1000);
      return data || [];
    },
  });

  // Count matches for a segment
  const countMatches = (seg: Segment) =>
    allContacts.filter(c => matchContact(c as any, seg.conditions, seg.matchMode)).length;

  // Preview contacts for current editing segment
  const previewContacts = editing
    ? allContacts.filter(c => matchContact(c as any, editing.conditions, editing.matchMode)).slice(0, 10)
    : [];

  function newSegment() {
    const seg: Segment = {
      id: crypto.randomUUID(),
      name: "New Segment",
      conditions: [],
      matchMode: "all",
      createdAt: new Date().toISOString(),
    };
    setEditing(seg);
    setShowBuilder(true);
  }

  function saveSegment() {
    if (!editing) return;
    const updated = segments.find(s => s.id === editing.id)
      ? segments.map(s => s.id === editing.id ? editing : s)
      : [...segments, editing];
    setSegments(updated);
    saveSegments(updated);
    setSelected(editing);
    setShowBuilder(false);
    toast.success(`Segment "${editing.name}" saved`);
  }

  function deleteSegment(id: string) {
    const updated = segments.filter(s => s.id !== id);
    setSegments(updated);
    saveSegments(updated);
    if (selected?.id === id) setSelected(null);
    toast.success("Segment deleted");
  }

  function addCondition() {
    if (!editing) return;
    setEditing({
      ...editing,
      conditions: [
        ...editing.conditions,
        { id: crypto.randomUUID(), field: "email", operator: "contains", value: "" },
      ],
    });
  }

  function updateCondition(id: string, patch: Partial<Condition>) {
    if (!editing) return;
    setEditing({
      ...editing,
      conditions: editing.conditions.map(c => {
        if (c.id !== id) return c;
        const updated = { ...c, ...patch };
        // Auto-fix operator when field changes
        if (patch.field) {
          const fieldDef = FIELDS.find(f => f.key === patch.field);
          const ops = OPERATORS_FOR[fieldDef?.type || "text"];
          updated.operator = ops[0].key;
          updated.value = "";
        }
        return updated;
      }),
    });
  }

  function removeCondition(id: string) {
    if (!editing) return;
    setEditing({ ...editing, conditions: editing.conditions.filter(c => c.id !== id) });
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Filter className="w-5 h-5 text-primary" /> Contact Segments
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Create smart audiences based on behavior & tags</p>
          </div>
          <button
            onClick={newSegment}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-black rounded-xl text-sm font-bold hover:bg-primary/90 transition-all"
          >
            <Plus className="w-4 h-4" /> New Segment
          </button>
        </div>

        {segments.length === 0 && !showBuilder ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center min-h-[40vh] text-center gap-4"
          >
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Users2 className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">No segments yet</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Create segments to target specific groups — paid leads, cold contacts, high-engagement subscribers
              </p>
            </div>
            <button
              onClick={newSegment}
              className="mt-2 flex items-center gap-2 px-5 py-2.5 bg-primary text-black rounded-xl text-sm font-bold hover:bg-primary/90 transition-all"
            >
              <Plus className="w-4 h-4" /> Create First Segment
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Segment list */}
            <div className="space-y-3">
              {segments.map((seg, i) => (
                <motion.div
                  key={seg.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => { setSelected(seg); setShowBuilder(false); }}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    selected?.id === seg.id
                      ? "border-primary/50 bg-primary/5"
                      : "border-border/40 bg-card hover:border-border/70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{seg.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {seg.conditions.length} condition{seg.conditions.length !== 1 ? "s" : ""} · Match {seg.matchMode}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="text-lg font-black text-primary">{countMatches(seg)}</span>
                      <p className="text-[10px] text-muted-foreground">contacts</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3">
                    <button
                      onClick={e => { e.stopPropagation(); setEditing(seg); setShowBuilder(true); }}
                      className="text-xs text-primary hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); deleteSegment(seg.id); }}
                      className="p-1 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Right: Builder or Preview */}
            <div className="lg:col-span-2">
              <AnimatePresence mode="wait">
                {showBuilder && editing ? (
                  <motion.div
                    key="builder"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    className="bg-card border border-border/50 rounded-2xl p-6 space-y-5"
                  >
                    {/* Name + match mode */}
                    <div className="flex items-center gap-3">
                      <input
                        value={editing.name}
                        onChange={e => setEditing({ ...editing, name: e.target.value })}
                        className="flex-1 bg-background border border-border/50 rounded-xl px-3 py-2 text-sm font-semibold text-foreground focus:outline-none focus:border-primary/40"
                        placeholder="Segment name"
                      />
                      <button
                        onClick={() => setEditing({ ...editing, matchMode: editing.matchMode === "all" ? "any" : "all" })}
                        className="flex items-center gap-1.5 px-3 py-2 bg-muted/50 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Match <span className="text-primary font-bold">{editing.matchMode.toUpperCase()}</span>
                        <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Conditions */}
                    <div className="space-y-3">
                      {editing.conditions.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border/30 rounded-xl">
                          No conditions yet — all contacts will match
                        </p>
                      )}
                      {editing.conditions.map((cond) => {
                        const fieldDef = FIELDS.find(f => f.key === cond.field)!;
                        const ops = OPERATORS_FOR[fieldDef.type];
                        const needsValue = !["is_true", "is_false"].includes(cond.operator);
                        return (
                          <div key={cond.id} className="flex items-center gap-2">
                            <select
                              value={cond.field}
                              onChange={e => updateCondition(cond.id, { field: e.target.value as FieldKey })}
                              className="flex-1 bg-background border border-border/40 rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/40"
                            >
                              {FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                            </select>
                            <select
                              value={cond.operator}
                              onChange={e => updateCondition(cond.id, { operator: e.target.value as Operator })}
                              className="flex-1 bg-background border border-border/40 rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/40"
                            >
                              {ops.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
                            </select>
                            {needsValue && (
                              <input
                                value={cond.value}
                                onChange={e => updateCondition(cond.id, { value: e.target.value })}
                                placeholder="value"
                                className="flex-1 bg-background border border-border/40 rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary/40"
                              />
                            )}
                            <button
                              onClick={() => removeCondition(cond.id)}
                              className="p-1.5 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                      <button
                        onClick={addCondition}
                        className="flex items-center gap-1.5 text-xs text-primary hover:underline"
                      >
                        <Plus className="w-3.5 h-3.5" /> Add condition
                      </button>
                    </div>

                    {/* Preview */}
                    <div className="border-t border-border/30 pt-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preview</p>
                        <span className="text-sm font-bold text-primary">{previewContacts.length} contacts match</span>
                      </div>
                      {previewContacts.length > 0 ? (
                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                          {previewContacts.map((c: any) => (
                            <div key={c.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-background/50">
                              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                {(c.first_name || c.email)?.[0]?.toUpperCase() || "?"}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-foreground truncate">
                                  {c.first_name ? `${c.first_name} ${c.last_name || ""}`.trim() : c.email}
                                </p>
                                <p className="text-[10px] text-muted-foreground truncate">{c.email}</p>
                              </div>
                              {c.tags?.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <Tag className="w-3 h-3 text-muted-foreground/50" />
                                  <span className="text-[10px] text-muted-foreground">{c.tags[0]}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground text-center py-3">No contacts match these conditions</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={() => { setShowBuilder(false); setEditing(null); }}
                        className="flex-1 py-2.5 rounded-xl bg-muted/50 text-muted-foreground text-sm font-semibold hover:bg-muted transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveSegment}
                        className="flex-1 py-2.5 rounded-xl bg-primary text-black text-sm font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5"
                      >
                        <Save className="w-4 h-4" /> Save Segment
                      </button>
                    </div>
                  </motion.div>
                ) : selected ? (
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="bg-card border border-border/50 rounded-2xl p-6 space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-lg font-bold text-foreground">{selected.name}</h2>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {selected.conditions.length} conditions · Match {selected.matchMode}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-black text-primary">{countMatches(selected)}</p>
                        <p className="text-xs text-muted-foreground">contacts</p>
                      </div>
                    </div>

                    {/* Condition summary */}
                    <div className="space-y-2">
                      {selected.conditions.map(c => {
                        const fieldDef = FIELDS.find(f => f.key === c.field)!;
                        const opLabel = OPERATORS_FOR[fieldDef.type].find(o => o.key === c.operator)?.label;
                        return (
                          <div key={c.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-background/50 text-xs">
                            <span className="text-muted-foreground">{fieldDef.label}</span>
                            <span className="text-primary font-medium">{opLabel}</span>
                            {c.value && <span className="text-foreground font-semibold">{c.value}</span>}
                          </div>
                        );
                      })}
                    </div>

                    {/* Matching contacts preview */}
                    <div className="border-t border-border/30 pt-4">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Matching Contacts</p>
                      <div className="space-y-1.5 max-h-60 overflow-y-auto">
                        {allContacts.filter(c => matchContact(c as any, selected.conditions, selected.matchMode)).slice(0, 15).map((c: any) => (
                          <div key={c.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-background/50 transition-colors">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                              {(c.first_name || c.email)?.[0]?.toUpperCase() || "?"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground truncate">
                                {c.first_name ? `${c.first_name} ${c.last_name || ""}`.trim() : c.email}
                              </p>
                              <p className="text-[10px] text-muted-foreground">{c.email}</p>
                            </div>
                            {c.paid_299 && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full">paid</span>}
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => { setEditing(selected); setShowBuilder(true); }}
                      className="w-full py-2.5 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors"
                    >
                      Edit Segment
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center h-60 text-center gap-3 bg-card/30 border border-dashed border-border/30 rounded-2xl"
                  >
                    <Play className="w-8 h-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">Select a segment to preview contacts</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
