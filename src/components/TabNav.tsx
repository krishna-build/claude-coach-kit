import { useNavigate, useLocation } from "react-router-dom";

interface Tab {
  label: string;
  href: string;
  icon?: string;
}

export default function TabNav({ tabs }: { tabs: Tab[] }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="flex gap-1 bg-muted/30 p-1 rounded-xl mb-6 overflow-x-auto">
      {tabs.map((tab) => {
        const active = pathname === tab.href || (tab.href !== "/" && pathname.startsWith(tab.href));
        return (
          <button
            key={tab.href}
            onClick={() => navigate(tab.href)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all flex-shrink-0 ${
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-card/50"
            }`}
          >
            {tab.icon && <span>{tab.icon}</span>}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
