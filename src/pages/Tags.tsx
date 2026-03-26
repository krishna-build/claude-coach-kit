import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import Layout from "@/components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pencil, Trash2, Check, X, Tags as TagsIcon, Users, Sparkles } from "lucide-react";

const PRESET_COLORS = [
  { name: "Blue", value: "#3b82f6" },
  { name: "Green", value: "#10b981" },
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Purple", value: "#8b5cf6" },
  { name: "Pink", value: "#ec4899" },
  { name: "Yellow", value: "#eab308" },
  { name: "Gray", value: "#6b7280" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Teal", value: "#14b8a6" },
];


export default function Tags() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366f1");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const { data: tags, isLoading } = useQuery({
    queryKey: ["tags-manager"],
    queryFn: async () => {
      const { data: tagsData } = await supabase.from("automation_tags").select("*").order("name");
      const { data: contacts } = await supabase.from("automation_contacts").select("tags");
      const counts: Record<string, number> = {};
      (contacts || []).forEach((c: any) => {
        (c.tags || []).forEach((t: string) => {
          counts[t] = (counts[t] || 0) + 1;
        });
      });
      return (tagsData || []).map((t: any) => ({ ...t, contactCount: counts[t.name] || 0 }));
    },
  });

  const createTag = async () => {
    if (!newName.trim()) return;
    const { error } = await supabase.from("automation_tags").insert({ name: newName.trim().toLowerCase(), color: newColor });
    if (error) return alert("Failed to create tag: " + error.message);
    setNewName("");
    queryClient.invalidateQueries({ queryKey: ["tags-manager"] });
  };

  const updateTag = async (id: string) => {
    if (!editName.trim()) return;
    await supabase.from("automation_tags").update({ name: editName.trim().toLowerCase(), color: editColor }).eq("id", id);
    setEditingId(null);
    queryClient.invalidateQueries({ queryKey: ["tags-manager"] });
  };

  const deleteTag = async (id: string) => {
    await supabase.from("automation_tags").delete().eq("id", id);
    setDeleting(null);
    queryClient.invalidateQueries({ queryKey: ["tags-manager"] });
  };

  return (
    <Layout>
      <div className="space-y-6 max-w-3xl">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-1">
            <TagsIcon className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Tags</h1>
          </div>
          <p className="text-sm text-muted-foreground">Manage contact tags and categories</p>
        </motion.div>

        {/* Create New Tag */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-2xl border border-border/50 p-6 shadow-sm mt-2"
        >
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
              <Plus className="w-4 h-4 text-primary" />
            </div>
            Create New Tag
          </h3>
          <div className="flex flex-col sm:flex-row gap-4 sm:items-end">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Tag Name</label>
              <input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && createTag()}
                placeholder="e.g. vip-client"
                className="w-full h-11 px-4 rounded-xl border border-border/50 bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Color</label>
              <div className="flex gap-1.5 flex-wrap">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c.value}
                    onClick={() => setNewColor(c.value)}
                    className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${newColor === c.value ? "border-foreground scale-110 shadow-lg" : "border-transparent"}`}
                    style={{ backgroundColor: c.value }}
                    title={c.name}
                  />
                ))}
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={createTag}
              className="h-11 px-6 rounded-xl bg-gradient-to-r from-primary to-gold-dark text-black text-sm font-semibold shadow-lg shadow-primary/20 hover:shadow-primary/30 flex items-center gap-1.5 whitespace-nowrap transition-shadow"
            >
              <Plus className="w-4 h-4" /> Add Tag
            </motion.button>
          </div>
        </motion.div>

        {/* Tags List — Card Grid on mobile, table on desktop */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {isLoading ? (
            <div className="bg-card rounded-2xl border border-border/50 p-12 text-center">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Loading tags...</p>
            </div>
          ) : (tags || []).length === 0 ? (
            <div className="bg-card rounded-2xl border border-border/50 p-12 text-center shadow-sm mt-2">
              <TagsIcon className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-foreground/60 font-medium">No tags yet</p>
              <p className="text-muted-foreground text-xs mt-1">Create your first tag above</p>
            </div>
          ) : (
            <>
              {/* Mobile: Card view */}
              <div className="sm:hidden space-y-3">
                <AnimatePresence>
                  {(tags || []).map((tag: any, idx: number) => (
                    <motion.div
                      key={tag.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-card rounded-2xl border border-border/50 p-4 shadow-sm"
                    >
                      {editingId === tag.id ? (
                        <div className="space-y-3">
                          <input value={editName} onChange={e => setEditName(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                          <div className="flex gap-1.5 flex-wrap">
                            {PRESET_COLORS.map(c => (
                              <button key={c.value} onClick={() => setEditColor(c.value)} className={`w-7 h-7 rounded-full border-2 transition-all ${editColor === c.value ? "border-foreground scale-110" : "border-transparent"}`} style={{ backgroundColor: c.value }} />
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => updateTag(tag.id)} className="px-4 py-2 rounded-xl bg-success/15 text-success text-sm font-medium flex items-center gap-1"><Check className="w-4 h-4" /> Save</button>
                            <button onClick={() => setEditingId(null)} className="px-4 py-2 rounded-xl bg-muted/50 text-muted-foreground text-sm">Cancel</button>
                          </div>
                        </div>
                      ) : deleting === tag.id ? (
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-danger font-medium flex-1">Delete "{tag.name}"?</span>
                          <button onClick={() => deleteTag(tag.id)} className="px-3 py-1.5 rounded-xl bg-danger/15 text-danger text-sm font-medium">Delete</button>
                          <button onClick={() => setDeleting(null)} className="px-3 py-1.5 rounded-xl bg-muted/50 text-muted-foreground text-sm">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: tag.color || "#6366f1" }} />
                          <div className="flex-1">
                            <p className="font-semibold text-foreground">{tag.name}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Users className="w-3 h-3" /> {tag.contactCount} contacts</p>
                          </div>
                          <div className="flex gap-1">
                            <button onClick={() => { setEditingId(tag.id); setEditName(tag.name); setEditColor(tag.color || "#6366f1"); }} className="p-2 rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"><Pencil className="w-4 h-4" /></button>
                            <button onClick={() => setDeleting(tag.id)} className="p-2 rounded-xl text-muted-foreground hover:bg-danger/10 hover:text-danger transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Desktop: Table view */}
              <div className="hidden sm:block bg-card rounded-2xl border border-border/50 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-surface/30 border-b border-border/50">
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tag</th>
                      <th className="text-left px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contacts</th>
                      <th className="text-right px-5 py-3.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {(tags || []).map((tag: any) => (
                      <tr key={tag.id} className="hover:bg-surface-hover/50 transition-colors group">
                        <td className="px-5 py-4">
                          {editingId === tag.id ? (
                            <div className="flex items-center gap-3">
                              <input value={editName} onChange={e => setEditName(e.target.value)} className="h-9 px-3 rounded-xl border border-border/50 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/40" />
                              <div className="flex gap-1">
                                {PRESET_COLORS.slice(0, 5).map(c => (
                                  <button key={c.value} onClick={() => setEditColor(c.value)} className={`w-6 h-6 rounded-full transition-all ${editColor === c.value ? "ring-2 ring-primary scale-110" : ""}`} style={{ backgroundColor: c.value }} />
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <span className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: tag.color || "#6366f1" }} />
                              <span className="font-semibold text-foreground">{tag.name}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Users className="w-3.5 h-3.5" />
                            <span className="font-medium">{tag.contactCount}</span>
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          {editingId === tag.id ? (
                            <div className="flex gap-1 justify-end">
                              <button onClick={() => updateTag(tag.id)} className="p-2 rounded-xl text-success hover:bg-success/10 transition-colors"><Check className="w-4 h-4" /></button>
                              <button onClick={() => setEditingId(null)} className="p-2 rounded-xl text-muted-foreground hover:bg-muted/50 transition-colors"><X className="w-4 h-4" /></button>
                            </div>
                          ) : deleting === tag.id ? (
                            <div className="flex gap-1 justify-end items-center">
                              <span className="text-xs text-danger mr-2 font-medium">Delete?</span>
                              <button onClick={() => deleteTag(tag.id)} className="p-2 rounded-xl text-danger hover:bg-danger/10 transition-colors"><Check className="w-4 h-4" /></button>
                              <button onClick={() => setDeleting(null)} className="p-2 rounded-xl text-muted-foreground hover:bg-muted/50 transition-colors"><X className="w-4 h-4" /></button>
                            </div>
                          ) : (
                            <div className="flex gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditingId(tag.id); setEditName(tag.name); setEditColor(tag.color || "#6366f1"); }} className="p-2 rounded-xl text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"><Pencil className="w-4 h-4" /></button>
                              <button onClick={() => setDeleting(tag.id)} className="p-2 rounded-xl text-muted-foreground hover:bg-danger/10 hover:text-danger transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </Layout>
  );
}
