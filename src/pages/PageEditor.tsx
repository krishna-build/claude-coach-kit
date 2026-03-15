import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Save, Eye, Globe } from "lucide-react";
import grapesjs from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import gjsPresetWebpage from "grapesjs-preset-webpage";
import gjsBlocksBasic from "grapesjs-blocks-basic";
import { supabase } from "@/lib/supabase";

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
  updated_at: string;
}

export default function PageEditor() {
  const { id: projectId, pageId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const editorRef = useRef<HTMLDivElement>(null);
  const grapesRef = useRef<any>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch page data
  const { data: page, isLoading: pageLoading, isError, error: queryError } = useQuery({
    queryKey: ["funnel-page", pageId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("funnel_pages")
        .select("*")
        .eq("id", pageId)
        .single();

      if (error) throw error;
      return data;
    },
    retry: 1,
  });

  // Initialize GrapeJS
  useEffect(() => {
    if (!editorRef.current || pageLoading) return;

    const editor = grapesjs.init({
      container: editorRef.current,
      width: "100%",
      height: "calc(100vh - 64px)",
      storageManager: false,
      plugins: [gjsPresetWebpage, gjsBlocksBasic],
      pluginsOpts: {
        [gjsPresetWebpage as any]: {
          modalImportTitle: "Import Template",
          modalImportLabel: '<div style="margin-bottom: 10px; font-size: 13px;">Paste here your HTML/CSS and click Import</div>',
        }
      },
      blockManager: {
        appendTo: "#blocks"
      },
      panels: {
        defaults: [
          {
            id: "layers",
            el: ".panel__right",
            resizable: {
              maxDim: 350,
              minDim: 200,
              tc: 0,
              cl: 1,
              cr: 0,
              bc: 0
            }
          },
          {
            id: "panel-switcher",
            el: ".panel__switcher",
            buttons: [
              {
                id: "show-layers",
                active: true,
                label: "Layers",
                command: "show-layers"
              },
              {
                id: "show-style",
                active: false,
                label: "Styles",
                command: "show-styles"
              },
              {
                id: "show-traits",
                active: false,
                label: "Settings",
                command: "show-traits"
              }
            ]
          }
        ]
      },
      layerManager: {
        appendTo: ".layers-container"
      },
      selectorManager: {
        appendTo: ".styles-container"
      },
      styleManager: {
        appendTo: ".styles-container",
        sectors: [
          {
            name: "Dimension",
            open: false,
            buildProps: ["width", "min-height", "padding"],
            properties: [
              {
                type: "integer",
                name: "The width",
                property: "width",
                units: ["px", "%"],
                defaults: "auto",
                min: 0
              }
            ]
          },
          {
            name: "Extra",
            open: false,
            buildProps: ["background-color", "box-shadow", "custom"],
            properties: [
              {
                id: "custom",
                name: "Custom",
                property: "custom",
                type: "stack",
                sectors: [
                  {
                    name: "Effects",
                    properties: ["filter", "backdrop-filter"]
                  }
                ]
              }
            ]
          }
        ]
      },
      traitManager: {
        appendTo: ".traits-container"
      },
      canvas: {
        styles: [
          "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css"
        ]
      }
    });

    // Load existing content
    if (page.grapejs_data) {
      editor.loadProjectData(page.grapejs_data);
    } else if (page.html_content) {
      editor.setComponents(page.html_content);
      if (page.css_content) {
        editor.setStyle(page.css_content);
      }
    }

    // Custom blocks
    editor.BlockManager.add("lead-form", {
      label: "Lead Form",
      category: "Forms",
      content: `
        <form class="lead-form" style="max-width: 400px; margin: 0 auto; padding: 20px; background: #f9f9f9; border-radius: 8px;">
          <h3 style="text-align: center; margin-bottom: 20px; color: #333;">Get Your Free Guide</h3>
          <div style="margin-bottom: 15px;">
            <input type="text" name="name" placeholder="Your Name" required 
                   style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
          </div>
          <div style="margin-bottom: 15px;">
            <input type="email" name="email" placeholder="Your Email" required 
                   style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
          </div>
          <button type="submit" 
                  style="width: 100%; padding: 15px; background: #007cba; color: white; border: none; border-radius: 4px; font-size: 16px; font-weight: bold; cursor: pointer;">
            Download Now
          </button>
        </form>
      `
    });

    editor.BlockManager.add("cta-button", {
      label: "CTA Button", 
      category: "Basic",
      content: `
        <a href="#" class="cta-button" 
           style="display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                  color: white; text-decoration: none; border-radius: 50px; font-weight: bold; text-align: center; 
                  transition: transform 0.3s; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
          Get Started Today
        </a>
      `
    });

    editor.BlockManager.add("video-embed", {
      label: "Video Embed",
      category: "Media",
      content: `
        <div class="video-container" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 8px;">
          <iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" 
                  style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;"
                  allowfullscreen>
          </iframe>
        </div>
      `
    });

    editor.BlockManager.add("testimonial", {
      label: "Testimonial",
      category: "Content",
      content: `
        <div class="testimonial" style="max-width: 500px; margin: 0 auto; padding: 30px; background: white; border-radius: 12px; box-shadow: 0 8px 30px rgba(0,0,0,0.1); text-align: center;">
          <img src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face" 
               alt="Customer" style="width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; object-fit: cover;">
          <blockquote style="font-size: 18px; font-style: italic; color: #555; margin: 0 0 20px; line-height: 1.6;">
            "This product completely transformed my business. I couldn't be happier with the results!"
          </blockquote>
          <div style="font-weight: bold; color: #333; margin-bottom: 5px;">Sarah Johnson</div>
          <div style="color: #888; font-size: 14px;">CEO, TechStart Inc.</div>
        </div>
      `
    });

    // Commands for panel switching
    editor.Commands.add("show-layers", {
      getRowEl(editor: any) { return editor.getContainer().closest(".editor-row"); },
      getLayersEl(row: any) { return row.querySelector(".layers-container"); },
      getStyleEl(row: any) { return row.querySelector(".styles-container"); },
      getTraitsEl(row: any) { return row.querySelector(".traits-container"); },

      run(editor: any, sender: any) {
        const row = this.getRowEl(editor);
        const layersEl = this.getLayersEl(row);
        const styleEl = this.getStyleEl(row);
        const traitsEl = this.getTraitsEl(row);
        
        layersEl.style.display = "";
        styleEl.style.display = "none";
        traitsEl.style.display = "none";
      }
    });

    editor.Commands.add("show-styles", {
      getRowEl(editor: any) { return editor.getContainer().closest(".editor-row"); },
      getLayersEl(row: any) { return row.querySelector(".layers-container"); },
      getStyleEl(row: any) { return row.querySelector(".styles-container"); },
      getTraitsEl(row: any) { return row.querySelector(".traits-container"); },

      run(editor: any, sender: any) {
        const row = this.getRowEl(editor);
        const layersEl = this.getLayersEl(row);
        const styleEl = this.getStyleEl(row);
        const traitsEl = this.getTraitsEl(row);
        
        layersEl.style.display = "none";
        styleEl.style.display = "";
        traitsEl.style.display = "none";
      }
    });

    editor.Commands.add("show-traits", {
      getRowEl(editor: any) { return editor.getContainer().closest(".editor-row"); },
      getLayersEl(row: any) { return row.querySelector(".layers-container"); },
      getStyleEl(row: any) { return row.querySelector(".styles-container"); },
      getTraitsEl(row: any) { return row.querySelector(".traits-container"); },

      run(editor: any, sender: any) {
        const row = this.getRowEl(editor);
        const layersEl = this.getLayersEl(row);
        const styleEl = this.getStyleEl(row);
        const traitsEl = this.getTraitsEl(row);
        
        layersEl.style.display = "none";
        styleEl.style.display = "none";
        traitsEl.style.display = "";
      }
    });

    grapesRef.current = editor;
    setEditorReady(true);

    return () => {
      if (grapesRef.current) {
        grapesRef.current.destroy();
        grapesRef.current = null;
        setEditorReady(false);
      }
    };
  }, [page, pageLoading]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!grapesRef.current) throw new Error("Editor not initialized");

      const editor = grapesRef.current;
      const html = editor.getHtml();
      const css = editor.getCss();
      const projectData = editor.getProjectData();

      const { error } = await supabase
        .from("funnel_pages")
        .update({
          html_content: html,
          css_content: css,
          grapejs_data: projectData,
          updated_at: new Date().toISOString()
        })
        .eq("id", pageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnel-page", pageId] });
    }
  });

  // Publish mutation
  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!grapesRef.current) throw new Error("Editor not initialized");

      const editor = grapesRef.current;
      const html = editor.getHtml();
      const css = editor.getCss();
      const projectData = editor.getProjectData();

      const { error } = await supabase
        .from("funnel_pages")
        .update({
          html_content: html,
          css_content: css,
          grapejs_data: projectData,
          status: "published",
          updated_at: new Date().toISOString()
        })
        .eq("id", pageId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["funnel-page", pageId] });
    }
  });

  const handleSave = () => {
    setIsSaving(true);
    saveMutation.mutate();
    setTimeout(() => setIsSaving(false), 1000);
  };

  const handlePublish = () => {
    publishMutation.mutate();
  };

  const handlePreview = () => {
    if (!grapesRef.current) return;
    
    const html = grapesRef.current.getHtml();
    const css = grapesRef.current.getCss();
    
    const previewWindow = window.open("", "_blank");
    if (previewWindow) {
      previewWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Preview - ${page?.name}</title>
            <style>${css}</style>
          </head>
          <body>
            ${html}
          </body>
        </html>
      `);
      previewWindow.document.close();
    }
  };

  if (pageLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading editor...</p>
        </div>
      </div>
    );
  }

  if (isError || (!pageLoading && !page)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">Page not found</h2>
          <p className="text-muted-foreground mb-4 text-sm">{queryError?.message || "Could not load the page data"}</p>
          <button
            onClick={() => navigate(`/funnels/${projectId}`)}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Back to Project
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Toolbar */}
      <div className="h-16 bg-card border-b border-border flex items-center justify-between px-4 flex-shrink-0 z-50">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/funnels/${projectId}`)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Project
          </button>
          
          <div className="w-px h-6 bg-border" />
          
          <div>
            <h1 className="font-semibold text-foreground">{page.name}</h1>
            <p className="text-xs text-muted-foreground">{page.path}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePreview}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Eye className="w-4 h-4" />
            Preview
          </button>
          
          <button
            onClick={handleSave}
            disabled={isSaving || saveMutation.isPending}
            className="flex items-center gap-2 px-4 py-1.5 bg-surface text-foreground rounded-lg hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {isSaving ? "Saving..." : "Save"}
          </button>
          
          <button
            onClick={handlePublish}
            disabled={publishMutation.isPending}
            className="flex items-center gap-2 px-4 py-1.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Globe className="w-4 h-4" />
            {publishMutation.isPending ? "Publishing..." : "Publish"}
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex min-h-0">
        {/* Left Panel - Blocks */}
        <div className="w-64 bg-card border-r border-border flex-shrink-0 overflow-hidden">
          <div className="p-4 border-b border-border">
            <h3 className="font-medium text-foreground">Blocks</h3>
          </div>
          <div id="blocks" className="flex-1 overflow-y-auto p-2"></div>
        </div>

        {/* Main Editor */}
        <div className="flex-1 editor-row flex min-w-0">
          <div ref={editorRef} className="flex-1" />
          
          {/* Right Panel */}
          <div className="panel__right w-64 bg-card border-l border-border flex-shrink-0 overflow-hidden">
            <div className="panel__switcher flex border-b border-border">
              <button className="flex-1 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground border-r border-border">
                Layers
              </button>
              <button className="flex-1 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground border-r border-border">
                Styles
              </button>
              <button className="flex-1 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                Settings
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <div className="layers-container p-2"></div>
              <div className="styles-container p-2" style={{ display: "none" }}></div>
              <div className="traits-container p-2" style={{ display: "none" }}></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}