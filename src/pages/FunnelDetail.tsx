import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Eye,
  Edit,
  Trash2,
  MoreVertical,
  Globe,
  Settings as SettingsIcon,
  FileText,
  ExternalLink,
  Copy,
  BarChart3,
  Share2,
  Search,
  Check,
  ChevronRight,
  X
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import Layout from "@/components/Layout";

interface FunnelProject {
  id: string;
  name: string;
  code: string;
  description: string;
  domain: string;
  status: "draft" | "published" | "archived";
  thumbnail_url?: string;
  settings?: any;
  created_at: string;
  updated_at: string;
}

interface FunnelPage {
  id: string;
  project_id: string;
  name: string;
  page_type: string;
  path: string;
  html_content?: string;
  grapejs_data?: any;
  css_content?: string;
  status: "draft" | "published";
  seo_title?: string;
  seo_description?: string;
  sort_order: number;
  thumbnail_url?: string;
  created_at: string;
  updated_at: string;
}

const PAGE_TYPES = ["DEFAULT", "LEAD", "SALES", "CHECKOUT", "THANKYOU", "UPSELL"];

export default function FunnelDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [showAddPage, setShowAddPage] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [newPage, setNewPage] = useState({ name: "", page_type: "DEFAULT", path: "/" });
  const [pageMenuOpen, setPageMenuOpen] = useState<string | null>(null);

  // Fetch project
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["funnel-project", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funnel_projects")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as FunnelProject;
    },
  });

  // Fetch pages
  const { data: pages = [], isLoading: pagesLoading } = useQuery({
    queryKey: ["funnel-pages", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funnel_pages")
        .select("*")
        .eq("project_id", id)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as FunnelPage[];
    },
  });

  // Add page mutation
  const addPageMutation = useMutation({
    mutationFn: async (pageData: { name: string; page_type: string; path: string }) => {
      const { data, error } = await supabase
        .from("funnel_pages")
        .insert({
          project_id: id,
          ...pageData,
          sort_order: pages.length,
          status: "draft",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["funnel-pages", id] });
      setShowAddPage(false);
      setNewPage({ name: "", page_type: "DEFAULT", path: "/" });
      setSelectedPageId(data.id);
    },
  });

  // Delete page mutation
  const deletePageMutation = useMutation({
    mutationFn: async (pageId: string) => {
      const { error } = await supabase.from("funnel_pages").delete().eq("id", pageId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnel-pages", id] });
      setSelectedPageId(null);
      setPageMenuOpen(null);
    },
  });

  const selectedPage = pages.find((p) => p.id === selectedPageId) || pages[0];
  const filteredPages = pages.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (projectLoading || pagesLoading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (!project) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-foreground mb-4">Project not found</h2>
            <button onClick={() => navigate("/funnels")} className="px-4 py-2 bg-primary text-white rounded-lg">
              Back to Projects
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex h-[calc(100vh-64px)]">
        {/* LEFT SIDEBAR — Page List (FlexiFunnels style) */}
        <div className="w-72 border-r border-border bg-card flex flex-col flex-shrink-0">
          {/* Project Name */}
          <div className="p-4 border-b border-border">
            <h2 className="font-bold text-lg text-foreground truncate">{project.name}</h2>
            {project.domain && (
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Globe className="w-3 h-3" /> {project.domain}
              </p>
            )}
          </div>

          {/* Add New Page Button */}
          <div className="p-3">
            <button
              onClick={() => setShowAddPage(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-foreground text-background rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" /> Add New Page
            </button>
          </div>

          {/* Pages Count + Search */}
          <div className="px-4 pb-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-foreground">Pages</span>
              <span className="text-xs font-bold text-primary">[{pages.length}]</span>
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by page name"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Page List */}
          <div className="flex-1 overflow-y-auto px-2">
            {filteredPages.map((page) => (
              <div
                key={page.id}
                onClick={() => setSelectedPageId(page.id)}
                className={`flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer mb-1 group transition-colors relative ${
                  selectedPage?.id === page.id
                    ? "bg-primary/10 border border-primary/30"
                    : "hover:bg-background border border-transparent"
                }`}
              >
                <FileText className={`w-4 h-4 flex-shrink-0 ${selectedPage?.id === page.id ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium text-foreground truncate flex-1">{page.name}</span>
                {page.status === "published" && (
                  <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                )}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setPageMenuOpen(pageMenuOpen === page.id ? null : page.id);
                    }}
                    className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-border transition-all"
                  >
                    <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  {pageMenuOpen === page.id && (
                    <div className="absolute right-0 top-8 z-50 bg-card border border-border rounded-lg shadow-lg py-1 w-36">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/funnels/${id}/pages/${page.id}/edit`);
                        }}
                        className="w-full px-3 py-2 text-sm text-left hover:bg-background flex items-center gap-2"
                      >
                        <Edit className="w-3.5 h-3.5" /> Edit Page
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Delete this page?")) deletePageMutation.mutate(page.id);
                        }}
                        className="w-full px-3 py-2 text-sm text-left hover:bg-background text-red-400 flex items-center gap-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {filteredPages.length === 0 && (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {searchQuery ? "No pages match your search" : "No pages yet. Add one above!"}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL — Overview (FlexiFunnels style) */}
        <div className="flex-1 overflow-y-auto">
          {/* Top Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <button onClick={() => navigate("/funnels")} className="hover:text-foreground transition-colors">
                {project.name}
              </button>
              <ChevronRight className="w-3.5 h-3.5" />
              <span className="text-foreground font-medium">{selectedPage?.name || "Overview"}</span>
              <ChevronRight className="w-3.5 h-3.5" />
              <span>Overview</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/funnels")}
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Back to My Projects
              </button>
              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <SettingsIcon className="w-4 h-4" /> Project Settings
              </button>
            </div>
          </div>

          {/* Page Preview */}
          {selectedPage ? (
            <div className="p-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Overview</h3>

              {/* Large Preview Card */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                key={selectedPage.id}
                className="bg-card border border-border rounded-xl overflow-hidden max-w-2xl"
              >
                {/* Preview Image */}
                <div className="aspect-video bg-background flex items-center justify-center overflow-hidden">
                  {selectedPage.thumbnail_url ? (
                    <img src={selectedPage.thumbnail_url} alt={selectedPage.name} className="w-full h-full object-cover" />
                  ) : selectedPage.html_content && selectedPage.html_content.length > 100 ? (
                    <iframe
                      srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;transform:scale(0.35);transform-origin:top left;width:285%;}</style></head><body>${selectedPage.html_content}</body></html>`}
                      className="w-full h-full border-0 pointer-events-none"
                      sandbox="allow-same-origin"
                      title={selectedPage.name}
                    />
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <FileText className="w-12 h-12 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No preview available</p>
                      <p className="text-xs mt-1">Edit this page to add content</p>
                    </div>
                  )}
                </div>

                {/* Action Toolbar (FlexiFunnels style) */}
                <div className="flex items-center gap-1 px-4 py-3 border-t border-border bg-card">
                  <button
                    onClick={() => navigate(`/funnels/${id}/pages/${selectedPage.id}/edit`)}
                    className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-background transition-colors text-foreground"
                    title="Edit Page"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      const html = selectedPage.html_content || "";
                      const css = selectedPage.css_content || "";
                      const win = window.open("", "_blank");
                      if (win) {
                        win.document.write(`<!DOCTYPE html><html><head><style>${css}</style></head><body>${html}</body></html>`);
                        win.document.close();
                      }
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-background transition-colors text-foreground"
                    title="Preview"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-background transition-colors text-foreground"
                    title="Share Link"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                  <button
                    className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-background transition-colors text-foreground"
                    title="Duplicate"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-background transition-colors text-foreground"
                    title="Analytics"
                  >
                    <BarChart3 className="w-4 h-4" />
                  </button>
                  <button
                    className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-background transition-colors text-foreground"
                    title="Settings"
                  >
                    <SettingsIcon className="w-4 h-4" />
                  </button>
                  <button className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg hover:bg-background transition-colors text-muted-foreground ml-auto">
                    <MoreVertical className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>

              {/* Page Info */}
              <div className="mt-6 grid grid-cols-3 gap-4 max-w-2xl">
                <div className="bg-card border border-border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Page Type</p>
                  <p className="text-sm font-semibold text-foreground">{selectedPage.page_type}</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Path</p>
                  <p className="text-sm font-semibold text-foreground">{selectedPage.path}</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-4">
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <p className={`text-sm font-semibold ${selectedPage.status === "published" ? "text-green-500" : "text-yellow-500"}`}>
                    {selectedPage.status === "published" ? "● Published" : "● Draft"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-12">
              <div className="text-center text-muted-foreground">
                <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-medium mb-2">No pages yet</h3>
                <p className="text-sm mb-4">Create your first page to get started</p>
                <button
                  onClick={() => setShowAddPage(true)}
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm"
                >
                  + Add New Page
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Page Modal */}
      {showAddPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowAddPage(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-xl p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Add New Page</h3>
              <button onClick={() => setShowAddPage(false)} className="p-1 hover:bg-background rounded-lg">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Page Name</label>
                <input
                  type="text"
                  value={newPage.name}
                  onChange={(e) => setNewPage({ ...newPage, name: e.target.value })}
                  placeholder="e.g., Sales Page"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Page Type</label>
                <select
                  value={newPage.page_type}
                  onChange={(e) => setNewPage({ ...newPage, page_type: e.target.value })}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                >
                  {PAGE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Path</label>
                <input
                  type="text"
                  value={newPage.path}
                  onChange={(e) => setNewPage({ ...newPage, path: e.target.value })}
                  placeholder="e.g., /sales"
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm focus:ring-1 focus:ring-primary focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddPage(false)}
                className="flex-1 py-2 border border-border rounded-lg text-sm text-foreground hover:bg-background"
              >
                Cancel
              </button>
              <button
                onClick={() => newPage.name && addPageMutation.mutate(newPage)}
                disabled={!newPage.name || addPageMutation.isPending}
                className="flex-1 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {addPageMutation.isPending ? "Creating..." : "Create Page"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Project Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setShowSettings(false)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-xl p-6 w-full max-w-lg mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">Project Settings</h3>
              <button onClick={() => setShowSettings(false)} className="p-1 hover:bg-background rounded-lg">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Project Name</label>
                <input type="text" defaultValue={project.name} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Domain</label>
                <input type="text" defaultValue={project.domain} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Description</label>
                <textarea defaultValue={project.description} rows={3} className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground text-sm resize-none" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Status</label>
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-2 h-2 rounded-full ${project.status === "published" ? "bg-green-500" : "bg-yellow-500"}`} />
                  <span className="text-sm text-foreground capitalize">{project.status}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button onClick={() => setShowSettings(false)} className="px-4 py-2 bg-primary text-white rounded-lg text-sm">
                Close
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </Layout>
  );
}
