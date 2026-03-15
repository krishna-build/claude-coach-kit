import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  FolderOpen,
  Globe,
  Eye,
  Edit,
  Trash2,
  MoreVertical,
  Image as ImageIcon,
  FileText,
  Settings
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
  page_count?: number;
}

interface CreateProjectData {
  name: string;
  description: string;
  domain: string;
}

const CreateProjectModal = ({ 
  isOpen, 
  onClose, 
  onCreate 
}: { 
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: CreateProjectData) => void;
}) => {
  const [formData, setFormData] = useState<CreateProjectData>({
    name: "",
    description: "",
    domain: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    onCreate(formData);
    setFormData({ name: "", description: "", domain: "" });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-6"
      >
        <h2 className="text-xl font-bold text-foreground mb-4">Create New Funnel Project</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Project Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="e.g., Lead Generation Funnel"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Brief description of this funnel"
              rows={3}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Domain (optional)
            </label>
            <input
              type="text"
              value={formData.domain}
              onChange={(e) => setFormData(prev => ({ ...prev, domain: e.target.value }))}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="e.g., mysite.com"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-surface text-foreground rounded-lg hover:bg-surface-hover transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Create Project
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const ProjectCard = ({ project }: { project: FunnelProject }) => {
  const navigate = useNavigate();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const statusColors = {
    draft: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    published: "bg-green-500/10 text-green-500 border-green-500/20",
    archived: "bg-gray-500/10 text-gray-500 border-gray-500/20"
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="bg-card border border-border rounded-xl overflow-hidden shadow-lg shadow-black/5 group cursor-pointer"
      onClick={() => navigate(`/funnels/${project.id}`)}
    >
      {/* Thumbnail */}
      <div className="h-40 bg-gradient-to-br from-surface to-surface-hover relative overflow-hidden">
        {project.thumbnail_url ? (
          <img 
            src={project.thumbnail_url} 
            alt={project.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-12 h-12 text-muted-foreground" />
          </div>
        )}
        
        {/* Status badge */}
        <div className={`absolute top-3 left-3 px-2 py-1 rounded-full text-xs font-medium border ${statusColors[project.status]}`}>
          {project.status}
        </div>

        {/* Dropdown */}
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsDropdownOpen(!isDropdownOpen);
              }}
              className="w-8 h-8 bg-black/20 backdrop-blur-sm rounded-lg flex items-center justify-center text-white hover:bg-black/40 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>
            
            {isDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-32 bg-card border border-border rounded-lg shadow-xl z-10">
                <button className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover transition-colors flex items-center gap-2">
                  <Eye className="w-3 h-3" />
                  Preview
                </button>
                <button className="w-full px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover transition-colors flex items-center gap-2">
                  <Settings className="w-3 h-3" />
                  Settings
                </button>
                <button className="w-full px-3 py-2 text-left text-sm text-danger hover:bg-danger/10 transition-colors flex items-center gap-2">
                  <Trash2 className="w-3 h-3" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-1">
            {project.name}
          </h3>
        </div>

        {project.description && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {project.description}
          </p>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              <span>{project.page_count || 0} pages</span>
            </div>
            {project.domain && (
              <div className="flex items-center gap-1">
                <Globe className="w-3 h-3" />
                <span className="truncate max-w-20">{project.domain}</span>
              </div>
            )}
          </div>
          <span>{new Date(project.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    </motion.div>
  );
};

export default function Funnels() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch funnel projects with page count
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["funnel-projects"],
    queryFn: async () => {
      const { data: projectsData, error: projectsError } = await supabase
        .from("funnel_projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (projectsError) throw projectsError;

      // Get page counts for each project
      const projectsWithPageCount = await Promise.all(
        projectsData.map(async (project) => {
          const { count } = await supabase
            .from("funnel_pages")
            .select("*", { count: "exact", head: true })
            .eq("project_id", project.id);

          return { ...project, page_count: count || 0 };
        })
      );

      return projectsWithPageCount;
    }
  });

  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async (data: CreateProjectData) => {
      // Generate unique code
      const code = data.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') + '-' + Date.now();
      
      const { data: project, error } = await supabase
        .from("funnel_projects")
        .insert([{
          name: data.name,
          code,
          description: data.description,
          domain: data.domain,
          status: "draft"
        }])
        .select()
        .single();

      if (error) throw error;
      return project;
    },
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["funnel-projects"] });
      setIsCreateModalOpen(false);
      navigate(`/funnels/${project.id}`);
    }
  });

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Funnel Projects</h1>
            <p className="text-muted-foreground">Build and manage your marketing funnels</p>
          </div>
          
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Project
          </button>
        </div>

        {/* Projects Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-xl overflow-hidden animate-pulse">
                <div className="h-40 bg-surface" />
                <div className="p-4 space-y-3">
                  <div className="h-4 bg-surface rounded w-3/4" />
                  <div className="h-3 bg-surface rounded w-full" />
                  <div className="h-3 bg-surface rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mx-auto mb-4">
              <FolderOpen className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No funnel projects yet</h3>
            <p className="text-muted-foreground mb-6">Create your first funnel project to get started</p>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Your First Project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}

        {/* Create Project Modal */}
        <CreateProjectModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreate={(data) => createProjectMutation.mutate(data)}
        />
      </div>
    </Layout>
  );
}