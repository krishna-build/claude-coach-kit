import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { X, AlertTriangle, Merge, Trash2, CheckCircle, Users, Loader2 } from "lucide-react";
import { useToast } from "@/components/Toast";

interface Props {
  onClose: () => void;
}

interface DupGroup {
  email: string;
  contacts: any[];
}

export default function DuplicateContactsModal({ onClose }: Props) {
  const toast = useToast();
  const qc = useQueryClient();
  const [merging, setMerging] = useState<string | null>(null);

  const { data: dupGroups = [], isLoading } = useQuery<DupGroup[]>({
    queryKey: ["duplicate-contacts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("automation_contacts")
        .select("*")
        .order("email");
      if (!data) return [];
      const byEmail: Record<string, any[]> = {};
      data.forEach(c => {
        const key = c.email?.toLowerCase().trim();
        if (!key) return;
        if (!byEmail[key]) byEmail[key] = [];
        byEmail[key].push(c);
      });
      return Object.entries(byEmail)
        .filter(([, contacts]) => contacts.length > 1)
        .map(([email, contacts]) => ({ email, contacts }));
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async (group: DupGroup) => {
      // Keep the most complete record, delete the rest
      const sorted = [...group.contacts].sort((a, b) => {
        // Score completeness
        const score = (c: any) =>
          (c.first_name ? 1 : 0) + (c.phone ? 1 : 0) + (c.tags?.length || 0) +
          (c.paid_299 ? 2 : 0) + (c.purchased_50k ? 3 : 0) + (c.call_booked ? 1 : 0);
        return score(b) - score(a);
      });
      const [keep, ...rest] = sorted;
      // Merge tags
      const allTags = [...new Set([
        ...(keep.tags || []),
        ...rest.flatMap((c: any) => c.tags || []),
      ])];
      // Merge all fields — take non-null values
      const merged: Record<string, any> = { ...keep, tags: allTags };
      rest.forEach((c: any) => {
        Object.entries(c).forEach(([k, v]) => {
          if (!merged[k] && v) merged[k] = v;
        });
      });
      // Update keeper
      await supabase.from("automation_contacts").update({ ...merged, id: keep.id }).eq("id", keep.id);
      // Delete duplicates
      const idsToDelete = rest.map((c: any) => c.id);
      await supabase.from("automation_contacts").delete().in("id", idsToDelete);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["duplicate-contacts"] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Duplicates merged!");
      setMerging(null);
    },
    onError: () => {
      toast.error("Merge failed");
      setMerging(null);
    },
  });

  const handleMergeAll = async () => {
    for (const group of dupGroups) {
      setMerging(group.email);
      await mergeMutation.mutateAsync(group);
    }
    toast.success(`Merged all ${dupGroups.length} duplicate groups!`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-card border border-border/60 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-yellow-500/15 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Duplicate Contacts</p>
              <p className="text-[11px] text-muted-foreground">
                {isLoading ? "Scanning..." : `${dupGroups.length} duplicate group${dupGroups.length !== 1 ? "s" : ""} found`}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : dupGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-emerald-400" />
              </div>
              <p className="text-sm font-bold text-foreground">No duplicates found!</p>
              <p className="text-xs text-muted-foreground">Your contact list is clean.</p>
            </div>
          ) : (
            <>
              {dupGroups.map((group) => (
                <div key={group.email} className="border border-border/40 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-yellow-400" />
                      <span className="text-sm font-semibold text-foreground">{group.email}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 text-yellow-400 font-bold">
                        {group.contacts.length} copies
                      </span>
                    </div>
                    <button
                      onClick={() => { setMerging(group.email); mergeMutation.mutate(group); }}
                      disabled={merging === group.email || mergeMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-semibold hover:bg-primary/20 transition-colors disabled:opacity-40"
                    >
                      {merging === group.email ? <Loader2 className="w-3 h-3 animate-spin" /> : <Merge className="w-3 h-3" />}
                      Merge
                    </button>
                  </div>
                  <div className="divide-y divide-border/20">
                    {group.contacts.map((c, i) => (
                      <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                        {i === 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold flex-shrink-0">KEEP</span>
                        )}
                        {i > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 font-bold flex-shrink-0">DEL</span>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground">
                            {c.first_name ? `${c.first_name} ${c.last_name || ""}`.trim() : "No name"}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {c.phone && <span className="text-[10px] text-muted-foreground">{c.phone}</span>}
                            {c.tags?.length > 0 && (
                              <span className="text-[10px] text-muted-foreground">
                                {c.tags.slice(0, 3).join(", ")}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {c.paid_299 && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-full">₹299</span>}
                          {c.purchased_50k && <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/10 text-yellow-400 rounded-full">₹50K</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        {dupGroups.length > 0 && (
          <div className="flex items-center gap-2 px-5 py-4 border-t border-border/30 flex-shrink-0">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-muted/50 text-muted-foreground text-sm font-semibold hover:bg-muted transition-colors">
              Cancel
            </button>
            <button
              onClick={handleMergeAll}
              disabled={mergeMutation.isPending}
              className="flex-1 py-2.5 rounded-xl bg-primary text-black text-sm font-bold hover:bg-primary/90 transition-all flex items-center justify-center gap-1.5 disabled:opacity-40"
            >
              {mergeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Merge className="w-4 h-4" />}
              Merge All {dupGroups.length} Groups
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
