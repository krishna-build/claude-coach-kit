import { type ReactNode, useState, useEffect } from "react";
import NotificationCenter from "@/components/NotificationCenter";
import { CommandPalette } from "@/components/CommandPalette";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import packageJson from "../../package.json";

const APP_VERSION = packageJson.version;

import {
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
  LogOut,
  Menu,
  X,
  ChevronDown,
  Sun,
  Moon,
  Filter,
  MessageCircle,
  CalendarDays,
  Search,
  Layers,
} from "lucide-react";

interface NavSubItem {
  label: string;
  href: string;
  icon: any;
}

interface NavGroup {
  label: string;
  icon: any;
  single?: string; // if set, clicking the group navigates here directly
  items?: NavSubItem[];
  matchPaths?: string[];
}

const navGroups: NavGroup[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    single: "/",
    matchPaths: ["/"],
  },
  {
    label: "Contacts",
    icon: Users,
    matchPaths: ["/contacts", "/pipeline", "/segments"],
    items: [
      { label: "All Contacts", href: "/contacts", icon: Users },
      { label: "Pipeline", href: "/pipeline", icon: GitBranch },
      { label: "Segments", href: "/segments", icon: Filter },
    ],
  },
  {
    label: "Bookings",
    icon: CalendarDays,
    matchPaths: ["/bookings"],
    items: [
      { label: "All Events", href: "/bookings", icon: CalendarDays },
    ],
  },
  {
    label: "Funnels",
    icon: Layers,
    matchPaths: ["/funnels"],
    items: [
      { label: "All Projects", href: "/funnels", icon: Layers },
    ],
  },
  {
    label: "Messaging",
    icon: Mail,
    matchPaths: ["/sequences", "/campaigns", "/templates", "/whatsapp"],
    items: [
      { label: "Sequences", href: "/sequences", icon: Zap },
      { label: "Campaigns", href: "/campaigns", icon: Mail },
      { label: "Templates", href: "/templates", icon: FileText },
      { label: "WhatsApp", href: "/whatsapp", icon: MessageCircle },
    ],
  },
  {
    label: "Reports",
    icon: BarChart2,
    matchPaths: ["/analytics", "/attribution", "/meta-ads", "/email-reports"],
    items: [
      { label: "Analytics", href: "/analytics", icon: BarChart2 },
      { label: "Email Reports", href: "/email-reports", icon: Mail },
      { label: "Attribution", href: "/attribution", icon: PieChart },
      { label: "Meta Ads", href: "/meta-ads", icon: Smartphone },
    ],
  },
  {
    label: "Settings",
    icon: Settings,
    matchPaths: ["/settings", "/workflows", "/tags"],
    items: [
      { label: "Automations", href: "/workflows", icon: Workflow },
      { label: "Tags", href: "/tags", icon: Tags },
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("crm-theme") as "dark" | "light") || "dark";
    }
    return "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("crm-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return { theme, toggleTheme };
}

export default function Layout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  // Which group is active based on current path
  const getActiveGroup = () => {
    const p = location.pathname;
    for (const g of navGroups) {
      if (g.matchPaths?.some((m) => m === "/" ? p === "/" : p.startsWith(m))) {
        return g.label;
      }
    }
    return "";
  };

  const activeGroup = getActiveGroup();

  // Expanded groups (accordion state) — active group always expanded
  const [expanded, setExpanded] = useState<string[]>(() => [activeGroup]);

  // Keep active group expanded when route changes
  useEffect(() => {
    setExpanded((prev) => prev.includes(activeGroup) ? prev : [...prev, activeGroup]);
  }, [activeGroup]);

  const toggleGroup = (label: string) => {
    setExpanded((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]
    );
  };

  const handleNav = (href: string) => {
    navigate(href);
    setSidebarOpen(false);
  };

  const isSubActive = (href: string) =>
    href === "/" ? location.pathname === "/" : location.pathname.startsWith(href);

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-16 flex items-center px-5 border-b border-border/40 flex-shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-gold-dark flex items-center justify-center shadow-lg shadow-primary/20 flex-shrink-0">
            <Zap className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground tracking-tight leading-tight">ITA Automation</p>
            <p className="text-[10px] text-muted-foreground font-medium">Marketing CRM</p>
          </div>
        </div>
        {mobile && (
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-3 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-hover transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto dark-scrollbar space-y-0.5">
        {navGroups.map((group) => {
          const GroupIcon = group.icon;
          const isGroupActive = activeGroup === group.label;
          const isOpen = expanded.includes(group.label);

          // Single item (Dashboard)
          if (group.single) {
            return (
              <motion.button
                key={group.label}
                onClick={() => handleNav(group.single!)}
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative ${
                  isGroupActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                }`}
              >
                {isGroupActive && <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-primary" />}
                <GroupIcon className={`w-[18px] h-[18px] flex-shrink-0 ${isGroupActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground/70"}`} />
                <span>{group.label}</span>
              </motion.button>
            );
          }

          // Accordion group
          return (
            <div key={group.label}>
              {/* Group header */}
              <button
                onClick={() => toggleGroup(group.label)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative ${
                  isGroupActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                }`}
              >
                {isGroupActive && <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-primary" />}
                <GroupIcon className={`w-[18px] h-[18px] flex-shrink-0 ${isGroupActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground/70"}`} />
                <span className="flex-1 text-left">{group.label}</span>
                <motion.div
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex-shrink-0"
                >
                  <ChevronDown className={`w-3.5 h-3.5 ${isGroupActive ? "text-primary" : "text-muted-foreground"}`} />
                </motion.div>
              </button>

              {/* Sub-items */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="ml-4 pl-3 border-l border-border/40 mt-0.5 mb-1 space-y-0.5">
                      {group.items?.map((item) => {
                        const SubIcon = item.icon;
                        const subActive = isSubActive(item.href);
                        return (
                          <motion.button
                            key={item.href}
                            onClick={() => handleNav(item.href)}
                            whileHover={{ x: 2 }}
                            whileTap={{ scale: 0.97 }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-normal transition-all ${
                              subActive
                                ? "text-foreground"
                                : "text-muted-foreground hover:text-foreground hover:bg-surface-hover"
                            }`}
                          >
                            <SubIcon className={`w-3.5 h-3.5 flex-shrink-0 ${subActive ? "text-primary" : ""}`} />
                            <span>{item.label}</span>
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      {/* Bottom: theme + user + signout */}
      <div className="p-4 border-t border-border/40 flex-shrink-0 space-y-3">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-all"
        >
          <div className="relative w-[40px] h-[22px] rounded-full bg-muted flex-shrink-0" style={theme === "light" ? { background: "var(--color-primary)" } : {}}>
            <motion.div
              className="absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white shadow flex items-center justify-center"
              animate={{ x: theme === "light" ? 18 : 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              {theme === "dark" ? <Moon className="w-2.5 h-2.5 text-slate-600" /> : <Sun className="w-2.5 h-2.5 text-amber-500" />}
            </motion.div>
          </div>
          <span className="text-xs font-medium">{theme === "dark" ? "Dark mode" : "Light mode"}</span>
        </button>

        {/* User row */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-gold-dark flex items-center justify-center text-xs font-bold text-white shadow flex-shrink-0">
            {profile?.full_name?.[0]?.toUpperCase() || "A"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">{profile?.full_name || "Admin"}</p>
            <p className="text-[10px] text-muted-foreground truncate capitalize">{profile?.role || "admin"}</p>
          </div>
          <button
            onClick={signOut}
            title="Sign out"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-danger hover:bg-danger/10 transition-all flex-shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/40 text-center">v{APP_VERSION}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex overflow-x-hidden w-full">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 z-50 w-60 flex-col bg-sidebar border-r border-border/50 shadow-xl shadow-black/5">
        <SidebarContent />
      </aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mobile sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.aside
            initial={{ x: -260 }}
            animate={{ x: 0 }}
            exit={{ x: -260 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 left-0 z-50 w-60 bg-sidebar flex flex-col shadow-2xl lg:hidden"
          >
            <SidebarContent mobile />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col lg:ml-60">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 bg-card/95 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center gap-3 shadow-sm">
          <button onClick={() => setSidebarOpen(true)} className="text-foreground/70 hover:text-foreground transition-colors">
            <Menu className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-gold-dark flex items-center justify-center shadow-sm">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <p className="text-sm font-bold gold-text">ITA Automation</p>
          </div>
          <NotificationCenter />
          <button
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-surface hover:bg-surface-hover transition-colors"
          >
            {theme === "dark" ? <Sun className="w-4 h-4 text-muted-foreground" /> : <Moon className="w-4 h-4 text-muted-foreground" />}
          </button>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-x-hidden overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="max-w-7xl mx-auto"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
