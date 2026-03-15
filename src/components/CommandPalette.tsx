import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import {
  Search,
  LayoutDashboard,
  Users,
  GitBranch,
  Zap,
  Mail,
  FileText,
  BarChart2,
  PieChart,
  Smartphone,
  Workflow,
  Tags,
  Settings,
  Filter,
  MessageCircle,
  User,
  X,
} from "lucide-react";

// ─── All app pages ────────────────────────────────────────────────────────────

const NAV_PAGES = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, type: "page" },
  { name: "All Contacts", href: "/contacts", icon: Users, type: "page" },
  { name: "Pipeline", href: "/pipeline", icon: GitBranch, type: "page" },
  { name: "Segments", href: "/segments", icon: Filter, type: "page" },
  { name: "Sequences", href: "/sequences", icon: Zap, type: "page" },
  { name: "Email Campaigns", href: "/campaigns", icon: Mail, type: "page" },
  { name: "Templates", href: "/templates", icon: FileText, type: "page" },
  { name: "Analytics", href: "/analytics", icon: BarChart2, type: "page" },
  { name: "Attribution", href: "/attribution", icon: PieChart, type: "page" },
  { name: "Meta Ads", href: "/meta-ads", icon: Smartphone, type: "page" },
  { name: "Automations", href: "/workflows", icon: Workflow, type: "page" },
  { name: "Tags", href: "/tags", icon: Tags, type: "page" },
  { name: "WhatsApp", href: "/whatsapp", icon: MessageCircle, type: "page" },
  { name: "Settings", href: "/settings", icon: Settings, type: "page" },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface ResultItem {
  id: string;
  name: string;
  sub?: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CommandPalette({ isOpen, onClose }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounced query for Supabase (only when 2+ chars)
  const [debouncedQuery, setDebouncedQuery] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 200);
    return () => clearTimeout(t);
  }, [query]);

  const canSearch = debouncedQuery.length >= 2;

  // Contacts search
  const { data: contacts = [] } = useQuery({
    queryKey: ["cmd-contacts", debouncedQuery],
    queryFn: async () => {
      const { data } = await supabase
        .from("automation_contacts")
        .select("id, full_name, email")
        .or(`full_name.ilike.%${debouncedQuery}%,email.ilike.%${debouncedQuery}%`)
        .limit(5);
      return data || [];
    },
    enabled: canSearch,
    staleTime: 10_000,
  });

  // Campaigns search
  const { data: campaigns = [] } = useQuery({
    queryKey: ["cmd-campaigns", debouncedQuery],
    queryFn: async () => {
      const { data } = await supabase
        .from("automation_campaigns")
        .select("id, name, status")
        .ilike("name", `%${debouncedQuery}%`)
        .limit(5);
      return data || [];
    },
    enabled: canSearch,
    staleTime: 10_000,
  });

  // Sequences search
  const { data: sequences = [] } = useQuery({
    queryKey: ["cmd-sequences", debouncedQuery],
    queryFn: async () => {
      const { data } = await supabase
        .from("automation_sequences")
        .select("id, name")
        .ilike("name", `%${debouncedQuery}%`)
        .limit(5);
      return data || [];
    },
    enabled: canSearch,
    staleTime: 10_000,
  });

  // Build flat results list
  const results: ResultItem[] = [];

  // Navigation pages (always shown, filtered by query)
  const q = query.toLowerCase();
  const filteredPages = query
    ? NAV_PAGES.filter((p) => p.name.toLowerCase().includes(q))
    : NAV_PAGES;

  filteredPages.forEach((p) => {
    results.push({
      id: `page-${p.href}`,
      name: p.name,
      sub: "Page",
      href: p.href,
      icon: p.icon,
      category: "Navigation",
    });
  });

  if (canSearch) {
    (contacts as Array<{ id: string; full_name: string; email: string }>).forEach((c) => {
      results.push({
        id: `contact-${c.id}`,
        name: c.full_name,
        sub: c.email,
        href: `/contacts/${c.id}`,
        icon: User,
        category: "Contacts",
      });
    });

    (campaigns as Array<{ id: string; name: string; status?: string }>).forEach((c) => {
      results.push({
        id: `campaign-${c.id}`,
        name: c.name,
        sub: `Campaign · ${c.status || "draft"}`,
        href: `/campaigns/${c.id}`,
        icon: Mail,
        category: "Campaigns",
      });
    });

    (sequences as Array<{ id: string; name: string }>).forEach((s) => {
      results.push({
        id: `seq-${s.id}`,
        name: s.name,
        sub: "Sequence",
        href: `/sequences`,
        icon: Zap,
        category: "Sequences",
      });
    });
  }

  // Group by category
  const grouped: Record<string, ResultItem[]> = {};
  for (const r of results) {
    if (!grouped[r.category]) grouped[r.category] = [];
    grouped[r.category].push(r);
  }

  const flatResults = results; // for index mapping

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIdx((i) => Math.min(i + 1, flatResults.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIdx((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter") {
        const item = flatResults[activeIdx];
        if (item) { navigate(item.href); onClose(); }
      }
    },
    [isOpen, flatResults, activeIdx, navigate, onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Reset active index when results change
  useEffect(() => { setActiveIdx(0); }, [query]);

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const handleSelect = (item: ResultItem) => {
    navigate(item.href);
    onClose();
  };

  if (!isOpen) return null;

  let globalIdx = 0;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[9999] flex items-start justify-center pt-[12vh] px-4"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/60">
              <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pages, contacts, campaigns..."
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <kbd className="hidden sm:flex items-center gap-0.5 text-[10px] text-muted-foreground border border-border/60 rounded px-1.5 py-0.5">
                esc
              </kbd>
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-[420px] overflow-y-auto dark-scrollbar">
              {flatResults.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Search className="w-8 h-8 mb-3 opacity-40" />
                  <p className="text-sm">No results found</p>
                </div>
              ) : (
                Object.entries(grouped).map(([category, items]) => (
                  <div key={category}>
                    <div className="px-4 pt-3 pb-1">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {category}
                      </p>
                    </div>
                    {items.map((item) => {
                      const idx = globalIdx++;
                      const Icon = item.icon;
                      const isActive = activeIdx === idx;
                      return (
                        <button
                          key={item.id}
                          data-idx={idx}
                          onClick={() => handleSelect(item)}
                          onMouseEnter={() => setActiveIdx(idx)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left ${
                            isActive ? "bg-primary/10" : "hover:bg-surface-hover"
                          }`}
                        >
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            isActive ? "bg-primary/20" : "bg-surface"
                          }`}>
                            <Icon className={`w-3.5 h-3.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium truncate ${isActive ? "text-primary" : "text-foreground"}`}>
                              {item.name}
                            </p>
                            {item.sub && (
                              <p className="text-[11px] text-muted-foreground truncate">{item.sub}</p>
                            )}
                          </div>
                          {isActive && (
                            <kbd className="text-[10px] text-muted-foreground border border-border/60 rounded px-1.5 py-0.5 flex-shrink-0">
                              ↵
                            </kbd>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
              <div className="h-2" />
            </div>

            {/* Footer */}
            <div className="border-t border-border/40 px-4 py-2 flex items-center gap-4 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><kbd className="border border-border/60 rounded px-1">↑↓</kbd> navigate</span>
              <span className="flex items-center gap-1"><kbd className="border border-border/60 rounded px-1">↵</kbd> select</span>
              <span className="flex items-center gap-1"><kbd className="border border-border/60 rounded px-1">esc</kbd> close</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
