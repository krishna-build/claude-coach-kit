import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import Layout from "@/components/Layout";
import { motion } from "framer-motion";
import { Loader2, Phone, Kanban, Mail, Clock, ChevronRight, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";

const COLUMNS = [
  { id: "lead", label: "Lead", color: "from-blue-500 to-blue-400", bgColor: "bg-blue-500/10", textColor: "text-blue-400", borderColor: "border-t-blue-500" },
  { id: "paid-299", label: "Paid ₹299", color: "from-emerald-500 to-emerald-400", bgColor: "bg-emerald-500/10", textColor: "text-emerald-400", borderColor: "border-t-emerald-500" },
  { id: "call-booked", label: "Call Booked", color: "from-orange-500 to-orange-400", bgColor: "bg-orange-500/10", textColor: "text-orange-400", borderColor: "border-t-orange-500" },
  { id: "converted", label: "Higher Ticket", color: "from-yellow-500 to-yellow-400", bgColor: "bg-yellow-500/10", textColor: "text-yellow-300", borderColor: "border-t-yellow-500" },
  { id: "not-converted", label: "Not Converted", color: "from-red-500 to-red-400", bgColor: "bg-red-500/10", textColor: "text-red-400", borderColor: "border-t-red-500" },
];

function getColumn(c: any): string {
  if (c.purchased_50k) return "converted";
  if (c.status === "not-converted" || (c.tags || []).includes("not-converted")) return "not-converted";
  if (c.call_booked) return "call-booked";
  if (c.paid_299) return "paid-299";
  return "lead";
}

function daysSince(date: string) {
  if (!date) return 0;
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
}


export default function Pipeline() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["pipeline-contacts"],
    queryFn: async () => {
      const { data } = await supabase.from("automation_contacts").select("*").order("created_at", { ascending: false });
      return data || [];
    },
  });

  const grouped = COLUMNS.reduce((acc, col) => {
    acc[col.id] = (contacts || []).filter(c => getColumn(c) === col.id);
    return acc;
  }, {} as Record<string, any[]>);

  const onDragEnd = async (result: DropResult) => {
    const { draggableId, destination } = result;
    if (!destination) return;
    const destCol = destination.droppableId;
    const contactId = draggableId.replace("contact-", "");

    const updates: any = {};
    if (destCol === "lead") { updates.paid_299 = false; updates.call_booked = false; updates.purchased_50k = false; updates.status = "lead"; }
    if (destCol === "paid-299") { updates.paid_299 = true; updates.paid_299_at = new Date().toISOString(); updates.call_booked = false; updates.purchased_50k = false; updates.status = "paid-299"; }
    if (destCol === "call-booked") { updates.paid_299 = true; updates.call_booked = true; updates.call_booked_at = new Date().toISOString(); updates.purchased_50k = false; updates.status = "call-booked"; }
    if (destCol === "converted") { updates.paid_299 = true; updates.call_booked = true; updates.purchased_50k = true; updates.purchased_50k_at = new Date().toISOString(); updates.status = "converted"; }
    if (destCol === "not-converted") { updates.status = "not-converted"; }

    await supabase.from("automation_contacts").update(updates).eq("id", contactId);
    queryClient.invalidateQueries({ queryKey: ["pipeline-contacts"] });
  };

  if (isLoading) return (
    <Layout>
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading pipeline...</p>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="space-y-5">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Kanban className="w-5 h-5 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">Pipeline</h1>
            </div>
            <p className="text-sm text-muted-foreground">{(contacts || []).length} contacts across {COLUMNS.length} stages</p>
          </div>
          {/* Stage summary pills */}
          <div className="flex gap-2 flex-wrap">
            {COLUMNS.map(col => (
              <div key={col.id} className={`px-3 py-1.5 rounded-full ${col.bgColor} ${col.textColor} text-xs font-semibold flex items-center gap-1.5`}>
                <span className={`w-2 h-2 rounded-full bg-gradient-to-r ${col.color}`} />
                {grouped[col.id]?.length || 0}
              </div>
            ))}
          </div>
        </motion.div>

        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory md:snap-none pt-2">
            {COLUMNS.map((col, colIdx) => (
              <Droppable droppableId={col.id} key={col.id}>
                {(provided, snapshot) => (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: colIdx * 0.08 }}
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={`min-w-[280px] w-[280px] flex-shrink-0 snap-center rounded-2xl border border-border/50 overflow-hidden transition-all ${
                      snapshot.isDraggingOver ? "bg-primary/5 border-primary/30 shadow-lg shadow-primary/5" : "bg-card/50"
                    }`}
                  >
                    {/* Gradient top bar */}
                    <div className={`h-1.5 bg-gradient-to-r ${col.color}`} />
                    
                    {/* Stage header */}
                    <div className="px-4 py-3 flex items-center justify-between border-b border-border/30">
                      <h3 className="text-sm font-bold text-foreground">{col.label}</h3>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${col.bgColor} ${col.textColor}`}>
                        {grouped[col.id]?.length || 0}
                      </span>
                    </div>

                    {/* Cards */}
                    <div className="px-2 py-2 space-y-2 min-h-[120px] max-h-[calc(100vh-260px)] overflow-y-auto">
                      {(grouped[col.id] || []).map((c: any, i: number) => (
                        <Draggable key={c.id} draggableId={`contact-${c.id}`} index={i}>
                          {(dragProvided, dragSnapshot) => (
                            <motion.div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              onClick={() => navigate(`/contacts/${c.id}`)}
                              className={`bg-card rounded-xl p-3.5 shadow-sm border cursor-pointer transition-all group ${
                                dragSnapshot.isDragging
                                  ? "border-primary shadow-xl shadow-primary/10 scale-[1.02] rotate-1"
                                  : "border-border/50 hover:border-primary/40 hover:shadow-md"
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                {/* Avatar */}
                                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${col.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm`}>
                                  {(c.first_name || c.email || "?")[0].toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                                    {c.first_name ? `${c.first_name} ${c.last_name || ""}`.trim() : c.email}
                                  </p>
                                  {c.email && (
                                    <p className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5 truncate">
                                      <Mail className="w-3 h-3 flex-shrink-0" /> {c.email}
                                    </p>
                                  )}
                                  {c.phone && (
                                    <p className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                                      <Phone className="w-3 h-3 flex-shrink-0" /> {c.phone}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border/30">
                                <div className="flex gap-1">
                                  {(c.tags || []).slice(0, 2).map((t: string) => (
                                    <span key={t} className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-muted/50 text-muted-foreground">{t}</span>
                                  ))}
                                </div>
                                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                  <Clock className="w-3 h-3" />
                                  {daysSince(c.created_at)}d
                                </span>
                              </div>
                            </motion.div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {(grouped[col.id] || []).length === 0 && (
                        <div className="py-8 text-center">
                          <p className="text-xs text-muted-foreground/50">No contacts</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </Droppable>
            ))}
          </div>
        </DragDropContext>
      </div>
    </Layout>
  );
}
