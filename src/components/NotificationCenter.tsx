import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Mail, UserPlus, CreditCard, Tag, X } from "lucide-react";

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
}

interface Notification {
  id: string;
  type: "email_open" | "email_click" | "new_contact" | "payment" | "tag";
  message: string;
  time: string;
}

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Recent email activity
  const { data: recentEmails } = useQuery({
    queryKey: ["notif-emails"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("automation_email_log")
        .select("id, status, contYOUR_AD_ACCOUNT_IDid, sent_at, subject")
        .in("status", ["opened", "clicked"])
        .gte("sent_at", since)
        .order("sent_at", { ascending: false })
        .limit(10);
      return data || [];
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Recent new contacts
  const { data: recentContacts } = useQuery({
    queryKey: ["notif-contacts"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("automation_contacts")
        .select("id, first_name, last_name, email, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Recent payments
  const { data: recentPayments } = useQuery({
    queryKey: ["notif-payments"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("automation_webhook_log")
        .select("id, payload, created_at, source")
        .eq("source", "razorpay")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Build notifications list
  const notifications: Notification[] = [];

  (recentEmails || []).forEach(e => {
    const id = `email-${e.id}`;
    const name = e.subject ? `"${(e.subject as string).slice(0, 20)}"` : "Someone";
    notifications.push({
      id,
      type: e.status === "clicked" ? "email_click" : "email_open",
      message: e.status === "clicked"
        ? `${name} clicked a link in "${(e.subject || "your email").slice(0, 30)}"`
        : `${name} opened "${(e.subject || "your email").slice(0, 30)}"`,
      time: e.sent_at,
    });
  });

  (recentContacts || []).forEach(c => {
    notifications.push({
      id: `contact-${c.id}`,
      type: "new_contact",
      message: `New lead: ${c.first_name || c.email?.split("@")[0] || "Unknown"} joined`,
      time: c.created_at,
    });
  });

  (recentPayments || []).forEach(p => {
    let amount = "₹299";
    try {
      const pl = typeof p.payload === "string" ? JSON.parse(p.payload) : p.payload;
      const amt = pl?.payload?.payment?.entity?.amount;
      if (amt) amount = `₹${amt / 100}`;
    } catch {}
    notifications.push({
      id: `payment-${p.id}`,
      type: "payment",
      message: `New payment received: ${amount}`,
      time: p.created_at,
    });
  });

  // Sort by time
  notifications.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  const visible = notifications.filter(n => !dismissed.has(n.id));
  const unread = visible.length;

  const iconFor = (type: Notification["type"]) => {
    switch (type) {
      case "email_open": return <Mail className="w-3.5 h-3.5 text-blue-400" />;
      case "email_click": return <Mail className="w-3.5 h-3.5 text-primary" />;
      case "new_contact": return <UserPlus className="w-3.5 h-3.5 text-green-400" />;
      case "payment": return <CreditCard className="w-3.5 h-3.5 text-primary" />;
      case "tag": return <Tag className="w-3.5 h-3.5 text-purple-400" />;
    }
  };

  const bgFor = (type: Notification["type"]) => {
    switch (type) {
      case "email_open": return "bg-blue-400/10";
      case "email_click": return "bg-primary/10";
      case "new_contact": return "bg-green-400/10";
      case "payment": return "bg-primary/10";
      case "tag": return "bg-purple-400/10";
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative w-8 h-8 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-all"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-black text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-10 w-80 bg-card border border-border/50 rounded-2xl shadow-2xl shadow-black/30 overflow-hidden z-50"
          >
            <div className="px-4 py-3 border-b border-border/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Activity</span>
                {unread > 0 && (
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
                    {unread} new
                  </span>
                )}
              </div>
              {unread > 0 && (
                <button
                  onClick={() => setDismissed(new Set(notifications.map(n => n.id)))}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  Clear all
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {visible.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-sm">
                  <Bell className="w-6 h-6 mx-auto mb-2 opacity-30" />
                  All caught up!
                </div>
              ) : (
                visible.slice(0, 15).map(n => (
                  <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-surface-hover/50 transition-colors border-b border-border/10 last:border-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${bgFor(n.type)}`}>
                      {iconFor(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground leading-snug">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(n.time)}</p>
                    </div>
                    <button
                      onClick={() => setDismissed(d => new Set([...d, n.id]))}
                      className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
