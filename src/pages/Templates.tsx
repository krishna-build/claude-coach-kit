import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/components/Toast";
import Layout from "@/components/Layout";
import { motion, AnimatePresence } from "framer-motion";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import {
  FileText,
  Zap,
  Mail,
  Heart,
  Star,
  AlertCircle,
  Gift,
  RefreshCw,
  Copy,
  CheckCircle,
  Plus,
  Search,
  Filter,
  ChevronDown,
  Edit3,
  Trash2,
  X,
  Eye,
  Code,
  Send,
  Layers,
  Sparkles,
  ArrowLeft,
  Tag,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  subject: string;
  body_html: string;
  body_blocks: unknown[];
  description: string | null;
  thumbnail_url: string | null;
  preview_text: string | null;
  is_default: boolean;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = ["All", "Sales", "Nurture", "Onboarding", "Post-Purchase", "Custom"] as const;

const CATEGORY_COLORS: Record<string, string> = {
  Sales: "#F87171",
  Nurture: "#60A5FA",
  Onboarding: "#22C55E",
  "Post-Purchase": "#FFB433",
  Custom: "#A78BFA",
  general: "#60A5FA",
};

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  Sales: AlertCircle,
  Nurture: Heart,
  Onboarding: CheckCircle,
  "Post-Purchase": Star,
  Custom: Sparkles,
  general: FileText,
};

const AVAILABLE_VARIABLES = [
  { label: "First Name", token: "{{first_name}}" },
  { label: "Email", token: "{{email}}" },
  { label: "Phone", token: "{{phone}}" },
  { label: "Tag", token: "{{tag}}" },
  { label: "Company", token: "{{company}}" },
  { label: "Date", token: "{{date}}" },
];

// ─── System Templates (for seeding) ─────────────────────────────────────────

const SYSTEM_TEMPLATES = [
  {
    name: "Welcome Email",
    category: "Onboarding",
    subject: "Welcome {{first_name}}! Here's what happens next 🙏",
    description: "Thank you for taking the first step. Here's what you can expect from us...",
    body_html: `<p>Hi {{first_name}},</p><p>Thank you for reaching out. You've just taken the most important step — acknowledging that something needs to change.</p><p>Over the next few days, I'll be sharing with you exactly how people like you have transformed their relationship with money and success.</p><p>But first, I want to make sure you get the most out of this journey. Click the link below to book your <strong>Abundance Breakthrough Call</strong> — a 45-minute deep dive that has helped 14,000+ professionals break free from invisible money blocks.</p><p>The call is just ₹299. But what you'll discover is priceless.</p>`,
    is_system: true,
    is_default: true,
    is_active: true,
  },
  {
    name: "Payment Reminder",
    category: "Sales",
    subject: "{{first_name}}, your spot is still available ⏰",
    description: "You started the process but didn't complete your booking. Here's a gentle reminder...",
    body_html: `<p>Hi {{first_name}},</p><p>I noticed you started booking your Abundance Breakthrough Call but didn't complete it.</p><p>That's okay — life gets busy. But I don't want you to miss this opportunity.</p><p>Thousands of professionals just like you — MDs, CEOs, Directors — have used this call to identify the ONE invisible block that's been capping their income for years.</p><p>Your spot is still available. The call is just ₹299.</p><p>Click below to secure your spot before it's gone.</p>`,
    is_system: true,
    is_default: true,
    is_active: true,
  },
  {
    name: "Follow-up #1",
    category: "Nurture",
    subject: "A quick story about Rahul's ₹1L → ₹12L journey",
    description: "Let me share what happened when Rahul discovered his money block...",
    body_html: `<p>Hi {{first_name}},</p><p>Rahul was earning ₹1 lakh a month. He'd been doing so for 3 years despite promotions, side projects, and working 14 hours a day.</p><p>In our breakthrough session, we discovered ONE thing: a deep-seated belief he inherited from his father that "wanting more money is greedy."</p><p>That belief was invisible to him. But it was running his financial decisions every single day.</p><p>Two weeks after removing that block, he signed two new clients he'd been "meaning to follow up with" for months. His income jumped to ₹12 lakhs.</p><p>What's your hidden block? Let's find out together.</p>`,
    is_system: true,
    is_default: true,
    is_active: true,
  },
  {
    name: "Follow-up #2",
    category: "Nurture",
    subject: "The real reason talented people stay stuck at the same income",
    description: "It's not skills. It's not effort. It's something most people never look at...",
    body_html: `<p>Hi {{first_name}},</p><p>You're talented. You work hard. You've done everything "right."</p><p>So why is your income still where it was 2 years ago?</p><p>The answer isn't what most people expect. It's not a skill gap. It's not lack of effort. It's not your network.</p><p>It's a hidden program running in your subconscious — one that was installed before you were 10 years old — that quietly vetoes every attempt you make to earn more.</p><p>In 45 minutes, we can find yours. And once you see it, it can't hide anymore.</p><p>Book your Abundance Breakthrough Call for just ₹299.</p>`,
    is_system: true,
    is_default: true,
    is_active: true,
  },
  {
    name: "Urgency / Last Chance",
    category: "Sales",
    subject: "{{first_name}}, last chance — spots filling up",
    description: "This is the last reminder I'll send. I don't want to be pushy, but I care about your growth...",
    body_html: `<p>Hi {{first_name}},</p><p>This is the last email I'll send about this, because I respect your inbox and your time.</p><p>But I'd be doing you a disservice if I didn't send this one final reminder.</p><p>The Abundance Breakthrough Call isn't just a coaching session. It's a 45-minute investment that has given thousands of people the clarity they needed to finally break through their income ceiling.</p><p>At ₹299, it's the most leveraged investment you can make right now.</p><p>If you're ready, book your spot below. If not, I completely understand — and I wish you all the best on your journey.</p><p>With love and respect,<br/>Your Coach</p>`,
    is_system: true,
    is_default: true,
    is_active: true,
  },
  {
    name: "Call Preparation",
    category: "Onboarding",
    subject: "Your call is confirmed! Here's how to prepare 📋",
    description: "Congratulations on booking your call! To get the most out of our time together...",
    body_html: `<p>Hi {{first_name}},</p><p>Your Abundance Breakthrough Call is confirmed! I'm looking forward to our conversation.</p><p>To make the most of our 45 minutes together, here's how to prepare:</p><ul><li>Write down 3 income goals you haven't been able to achieve despite trying</li><li>Note any patterns you've noticed in your relationship with money</li><li>Come with an open mind — the answers are often surprising</li></ul><p>Find a quiet, private space for the call. What we discover together can be life-changing.</p><p>See you soon!</p>`,
    is_system: true,
    is_default: true,
    is_active: true,
  },
  {
    name: "Testimonial Request",
    category: "Post-Purchase",
    subject: "{{first_name}}, can I share your story?",
    description: "Your transformation matters — not just for you, but for the thousands still searching...",
    body_html: `<p>Hi {{first_name}},</p><p>It's been a few weeks since our work together, and I hope you're experiencing the shifts we talked about.</p><p>I have a small request: would you be willing to share your experience in a short video or written testimonial?</p><p>Your story could be the thing that convinces someone else — someone who's been stuck for years — to finally take the first step.</p><p>It would mean a lot to me, and even more to the people who need to hear it.</p><p>Just reply to this email with a few lines, or we can set up a quick 10-minute recording session.</p><p>Thank you for trusting me with your growth journey. 🙏</p>`,
    is_system: true,
    is_default: true,
    is_active: true,
  },
  {
    name: "Re-engagement",
    category: "Nurture",
    subject: "{{first_name}}, checking in 👋",
    description: "It's been a while. I just wanted to check in and see how things are going...",
    body_html: `<p>Hi {{first_name}},</p><p>It's been a while since we last connected, and I just wanted to check in.</p><p>How are things going? Have you made any progress toward the goals you had in mind when you first reached out?</p><p>If life got busy (it always does), I completely understand. But if you're still looking for that breakthrough — if the income ceiling is still there — I want you to know that support is available.</p><p>Just reply to this email and let me know where you are. No pressure, no sales pitch — just a genuine check-in.</p><p>Rooting for you always.</p>`,
    is_system: true,
    is_default: true,
    is_active: true,
  },
  {
    name: "Special Offer",
    category: "Sales",
    subject: "{{first_name}}, a special invitation just for you",
    description: "Because you've been on this journey with us, I wanted to offer something exclusive...",
    body_html: `<p>Hi {{first_name}},</p><p>Because you've been a part of our community, I want to extend a special invitation.</p><p>For the next 48 hours, the Abundance Breakthrough Call is available at a special rate — exclusively for people like you who've shown they're serious about change.</p><p>This isn't a gimmick. It's my way of saying thank you for being here, and for giving me the opportunity to serve you.</p><p>Click below to claim your spot. This offer expires in 48 hours.</p><p>With gratitude,<br/>Your Coach</p>`,
    is_system: true,
    is_default: true,
    is_active: true,
  },
  {
    name: "Course Welcome",
    category: "Post-Purchase",
    subject: "Welcome to the program, {{first_name}}! 🎉",
    description: "Your journey begins now. Here's how to access everything...",
    body_html: `<p>Hi {{first_name}},</p><p>Welcome to the program! I'm so excited to have you here.</p><p>You've made a powerful decision — one that will ripple through every area of your life.</p><p>Here's how to get started:</p><ol><li>Login to your member portal using the credentials below</li><li>Watch Module 1 before our first session</li><li>Complete the intake form so I can personalize your journey</li></ol><p>If you have any questions, just reply to this email. I personally read every message.</p><p>Here's to your transformation! 🙏</p>`,
    is_system: true,
    is_default: true,
    is_active: true,
  },
];

// ─── Template Editor Component ──────────────────────────────────────────────

interface EditorProps {
  template?: EmailTemplate | null;
  onClose: () => void;
  onSave: (data: { name: string; category: string; subject: string; body_html: string; description: string; preview_text: string }) => void;
  saving: boolean;
}

function TemplateEditor({ template, onClose, onSave, saving }: EditorProps) {
  const [name, setName] = useState(template?.name || "");
  const [category, setCategory] = useState(template?.category || "Custom");
  const [subject, setSubject] = useState(template?.subject || "");
  const [bodyHtml, setBodyHtml] = useState(template?.body_html || "");
  const [description, setDescription] = useState(template?.description || "");
  const [previewText, setPreviewText] = useState(template?.preview_text || "");
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [showVarHelper, setShowVarHelper] = useState(false);

  // Rich text editor
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-primary underline" } }),
      Placeholder.configure({ placeholder: "Write your email content here..." }),
    ],
    content: template?.body_html || "",
    onUpdate: ({ editor: e }) => {
      setBodyHtml(e.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-sm prose-invert max-w-none px-3 md:px-4 py-3 min-h-[200px] focus:outline-none text-sm leading-relaxed",
      },
    },
  });

  const insertVariable = useCallback((token: string, target: "subject" | "body") => {
    if (target === "subject") {
      setSubject((prev) => prev + token);
    } else if (editor) {
      editor.chain().focus().insertContent(token).run();
    }
    setShowVarHelper(false);
  }, [editor]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 overflow-y-auto"
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="min-h-screen bg-card max-w-5xl mx-auto border-x border-border shadow-2xl"
      >
        {/* Top bar */}
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur border-b border-border/50 px-4 md:px-6 py-3 md:py-4 flex items-center gap-2 md:gap-3">
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-all flex-shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-foreground text-sm md:text-base truncate">{template ? "Edit Template" : "Create Email Template"}</h2>
            <p className="text-[10px] md:text-xs text-muted-foreground hidden sm:block">Design your email template with variable support</p>
          </div>
          <button
            onClick={() => {
              if (!name.trim() || !subject.trim() || !bodyHtml.trim()) return;
              onSave({ name, category, subject, body_html: bodyHtml, description, preview_text: previewText });
            }}
            disabled={!name.trim() || !subject.trim() || !bodyHtml.trim() || saving}
            className="flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-xl text-xs font-semibold text-white bg-primary hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            {saving ? (
              <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> <span className="hidden sm:inline">Saving...</span></>
            ) : (
              <><CheckCircle className="w-3.5 h-3.5" /> <span className="hidden sm:inline">{template ? "Update" : "Save"}</span></>
            )}
          </button>
        </div>

        {/* Mobile: Tab switcher between Edit and Preview */}
        <div className="sticky top-[57px] md:top-[65px] z-[5] bg-card/95 backdrop-blur border-b border-border/30 px-4 md:px-6">
          <div className="flex gap-1 py-2">
            <button onClick={() => setActiveTab("edit")}
              className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "edit" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}>
              ✏️ Edit
            </button>
            <button onClick={() => setActiveTab("preview")}
              className={`flex-1 md:flex-none px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "preview" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}>
              👁️ Preview
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
          {/* Editor Panel — always visible on desktop, tab-controlled on mobile */}
          <div className={`p-4 md:p-6 space-y-4 md:space-y-5 border-r border-border/30 ${activeTab !== "edit" ? "hidden lg:block" : ""}`}>
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Template Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Welcome Email"
                className="w-full px-3 md:px-4 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Category</label>
                <div className="relative">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full appearance-none px-3 md:px-4 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
                  >
                    {CATEGORIES.filter((c) => c !== "All").map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Variable Helper */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Insert Variable</label>
                <div className="relative">
                  <button
                    onClick={() => setShowVarHelper(!showVarHelper)}
                    className="w-full flex items-center gap-2 px-3 md:px-4 py-2.5 bg-background border border-border rounded-xl text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
                  >
                    <Code className="w-3.5 h-3.5" />
                    <span className="truncate">{"{{variables}}"}</span>
                    <ChevronDown className="w-3.5 h-3.5 ml-auto flex-shrink-0" />
                  </button>
                  <AnimatePresence>
                    {showVarHelper && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        className="absolute z-20 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-xl overflow-hidden"
                      >
                        <div className="p-2 border-b border-border/50">
                          <p className="text-[10px] text-muted-foreground font-medium">Click to insert into body</p>
                        </div>
                        {AVAILABLE_VARIABLES.map((v) => (
                          <button
                            key={v.token}
                            onClick={() => insertVariable(v.token, "body")}
                            className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-surface-hover transition-colors"
                          >
                            <span className="text-foreground">{v.label}</span>
                            <span className="font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded text-[10px]">{v.token}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Subject Line</label>
                <span className="text-[10px] text-muted-foreground hidden sm:inline">Supports {"{{variables}}"}</span>
              </div>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Welcome {{first_name}}!"
                className="w-full px-3 md:px-4 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {/* Preview text */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Preview Text <span className="opacity-50">(optional)</span></label>
              <input
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                placeholder="Short preview shown in email clients..."
                className="w-full px-3 md:px-4 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description <span className="opacity-50">(internal note)</span></label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What is this template for?"
                className="w-full px-3 md:px-4 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {/* Body — Rich Text Editor */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between flex-wrap gap-1">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email Body</label>
                <div className="flex gap-1 flex-wrap">
                  {AVAILABLE_VARIABLES.slice(0, 3).map((v) => (
                    <button
                      key={v.token}
                      onClick={() => insertVariable(v.token, "body")}
                      className="text-[9px] px-1.5 py-0.5 rounded font-mono bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                      title={`Insert ${v.label}`}
                    >
                      {v.token}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toolbar */}
              {editor && (
                <div className="flex items-center gap-0.5 flex-wrap bg-background border border-border border-b-0 rounded-t-xl px-2 py-1.5">
                  <button type="button" onClick={() => editor.chain().focus().toggleBold().run()}
                    className={`p-1.5 rounded-md text-xs font-bold transition-colors ${editor.isActive("bold") ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
                    title="Bold">B</button>
                  <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={`p-1.5 rounded-md text-xs italic transition-colors ${editor.isActive("italic") ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
                    title="Italic">I</button>
                  <div className="w-px h-4 bg-border mx-1" />
                  <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={`p-1.5 rounded-md text-xs transition-colors ${editor.isActive("bulletList") ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
                    title="Bullet List">• List</button>
                  <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={`p-1.5 rounded-md text-xs transition-colors ${editor.isActive("orderedList") ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
                    title="Numbered List">1. List</button>
                  <div className="w-px h-4 bg-border mx-1" />
                  <button type="button" onClick={() => {
                    const url = window.prompt("Enter link URL:");
                    if (url) editor.chain().focus().setLink({ href: url }).run();
                  }}
                    className={`p-1.5 rounded-md text-xs transition-colors ${editor.isActive("link") ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
                    title="Add Link">🔗</button>
                  {editor.isActive("link") && (
                    <button type="button" onClick={() => editor.chain().focus().unsetLink().run()}
                      className="p-1.5 rounded-md text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Remove Link">✕</button>
                  )}
                  <div className="w-px h-4 bg-border mx-1" />
                  <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()}
                    className="p-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    title="Horizontal Line">—</button>
                  <button type="button" onClick={() => editor.chain().focus().undo().run()}
                    className="p-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors ml-auto"
                    title="Undo">↩️</button>
                  <button type="button" onClick={() => editor.chain().focus().redo().run()}
                    className="p-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    title="Redo">↪️</button>
                </div>
              )}

              {/* Editor area */}
              <div className={`bg-background border border-border ${editor ? "rounded-b-xl border-t-0" : "rounded-xl"} overflow-hidden min-h-[200px] focus-within:ring-2 focus-within:ring-primary/40`}>
                <EditorContent editor={editor} />
              </div>
            </div>
          </div>

          {/* Preview Panel — always visible on desktop, tab-controlled on mobile */}
          <div className={`p-4 md:p-6 bg-background/50 ${activeTab !== "preview" ? "hidden lg:block" : ""}`}>
            <div className="sticky top-28 md:top-32">
              {/* Preview header with device toggle */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Email Preview</h3>
                </div>
                <div className="flex gap-1 bg-muted/30 rounded-lg p-0.5">
                  <button onClick={() => setPreviewDevice("desktop")}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                      previewDevice === "desktop" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}>
                    🖥️ Desktop
                  </button>
                  <button onClick={() => setPreviewDevice("mobile")}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-all ${
                      previewDevice === "mobile" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}>
                    📱 Mobile
                  </button>
                </div>
              </div>

              {/* Device frame */}
              <div className={`mx-auto transition-all duration-300 ${previewDevice === "mobile" ? "max-w-[320px]" : "max-w-full"}`}>

                {/* ─── MOBILE: Realistic iPhone frame ─── */}
                {previewDevice === "mobile" && (
                  <div className="relative">
                    {/* Phone outer shell */}
                    <div style={{ background: "#1a1a1a", borderRadius: "40px", padding: "12px", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)" }}>
                      {/* Dynamic Island */}
                      <div className="flex justify-center" style={{ paddingTop: "6px", paddingBottom: "8px" }}>
                        <div style={{ width: "80px", height: "22px", background: "#000", borderRadius: "20px" }} />
                      </div>
                      {/* Screen */}
                      <div style={{ borderRadius: "28px", overflow: "hidden", background: "#fff" }}>
                        {/* Status bar */}
                        <div style={{ background: "#fff", padding: "6px 20px 4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "11px", fontWeight: 600, color: "#000" }}>9:41</span>
                          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                            <span style={{ fontSize: "10px", color: "#000" }}>●●●●</span>
                            <span style={{ fontSize: "10px", color: "#000" }}>📶</span>
                            <span style={{ fontSize: "10px", color: "#000" }}>🔋</span>
                          </div>
                        </div>
                        {/* Gmail-style mail header */}
                        <div style={{ borderBottom: "1px solid #e5e7eb", padding: "10px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                            <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#FFB433", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "13px", fontWeight: 700, flexShrink: 0 }}>A</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: "13px", fontWeight: 600, color: "#111" }}>Your Coach</div>
                              <div style={{ fontSize: "10px", color: "#6b7280" }}>to me</div>
                            </div>
                            <span style={{ fontSize: "10px", color: "#9ca3af" }}>10:30 AM</span>
                          </div>
                          <p style={{ fontSize: "13px", fontWeight: 600, color: "#111", margin: "0 0 2px" }}>{subject || "No subject"}</p>
                        </div>
                        {/* Email content — scrollable */}
                        <div className="overflow-y-auto" style={{ maxHeight: "420px", background: "#f4f4f4" }}>
                          <div style={{ margin: "8px 6px", borderRadius: "8px", overflow: "hidden" }}>
                            <div style={{ background: "#000" }}>
                              <img src="https://YOUR_SUPABASE_REF.supabase.co/storage/v1/object/public/course-covers/automation/coach-Coach-profile.png" alt="Your Coach" style={{ width: "100%", display: "block" }} />
                            </div>
                            <div style={{ background: "#FFB433", height: "3px" }} />
                            <div
                              style={{ fontFamily: "'Inter', sans-serif", padding: "20px 16px 12px", background: "#fff", color: "#333", fontSize: "13px", lineHeight: "1.6" }}
                              dangerouslySetInnerHTML={{ __html: bodyHtml || '<p style="color:#999">Email body will appear here...</p>' }}
                            />
                            <div style={{ textAlign: "center" as const, padding: "4px 16px 22px", background: "#fff" }}>
                              <a href="#" style={{ display: "inline-block", background: "#FFB433", color: "#fff", padding: "11px 22px", borderRadius: "6px", textDecoration: "none", fontWeight: 600, fontSize: "12px" }}>BOOK YOUR LIFE UPGRADE CALL</a>
                            </div>
                            <div style={{ background: "#f7f7f7", borderTop: "1px solid #eee", padding: "12px 16px", textAlign: "center" }}>
                              <p style={{ margin: "0 0 2px", fontSize: "10px", color: "#888" }}>Indian Transformation Academy</p>
                              <p style={{ margin: 0, fontSize: "9px", color: "#aaa" }}>Coach Your Coach · <a href="#" style={{ color: "#999" }}>Unsubscribe</a></p>
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Home indicator */}
                      <div className="flex justify-center" style={{ paddingTop: "8px", paddingBottom: "4px" }}>
                        <div style={{ width: "100px", height: "4px", background: "#666", borderRadius: "4px" }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── DESKTOP: Gmail-style email client ─── */}
                {previewDevice === "desktop" && (
                  <div style={{ borderRadius: "12px", overflow: "hidden", boxShadow: "0 20px 40px -12px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)" }}>
                    {/* Browser chrome */}
                    <div style={{ background: "#dee1e6", padding: "8px 12px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ display: "flex", gap: "5px" }}>
                        <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ff5f57" }} />
                        <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#febd2e" }} />
                        <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#28c840" }} />
                      </div>
                      <div style={{ flex: 1, background: "#fff", borderRadius: "6px", padding: "4px 12px", fontSize: "11px", color: "#5f6368" }}>
                        mail.google.com
                      </div>
                    </div>
                    {/* Gmail toolbar */}
                    <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "8px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ fontSize: "11px", color: "#5f6368", cursor: "pointer" }}>← Back</span>
                      <span style={{ fontSize: "11px", color: "#5f6368" }}>Archive</span>
                      <span style={{ fontSize: "11px", color: "#5f6368" }}>Delete</span>
                      <span style={{ fontSize: "11px", color: "#5f6368" }}>⋯</span>
                    </div>
                    {/* Email subject line */}
                    <div style={{ background: "#fff", padding: "16px 20px 0" }}>
                      <h2 style={{ fontSize: "18px", fontWeight: 400, color: "#202124", margin: "0 0 12px", fontFamily: "Google Sans, Inter, sans-serif" }}>{subject || "No subject"}</h2>
                    </div>
                    {/* Sender info */}
                    <div style={{ background: "#fff", padding: "0 20px 16px", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid #e5e7eb" }}>
                      <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: "#FFB433", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "16px", fontWeight: 700, flexShrink: 0 }}>A</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
                          <span style={{ fontSize: "13px", fontWeight: 600, color: "#202124" }}>Your Coach</span>
                          <span style={{ fontSize: "11px", color: "#5f6368" }}>&lt;support@example.com&gt;</span>
                        </div>
                        <div style={{ fontSize: "11px", color: "#5f6368" }}>to me</div>
                      </div>
                      <span style={{ fontSize: "11px", color: "#5f6368" }}>10:30 AM (2 hours ago)</span>
                    </div>
                    {/* Email body — the actual email content */}
                    <div style={{ background: "#f4f4f4", padding: "16px" }}>
                      <div style={{ maxWidth: "600px", margin: "0 auto", borderRadius: "8px", overflow: "hidden" }}>
                        <div style={{ background: "#000" }}>
                          <img src="https://YOUR_SUPABASE_REF.supabase.co/storage/v1/object/public/course-covers/automation/coach-Coach-profile.png" alt="Your Coach" style={{ width: "100%", maxWidth: "600px", display: "block" }} />
                        </div>
                        <div style={{ background: "#FFB433", height: "4px" }} />
                        <div
                          className="prose prose-sm max-w-none"
                          style={{ fontFamily: "'Inter', sans-serif", background: "#fff", padding: "32px 24px 20px", color: "#333", fontSize: "15px", lineHeight: "1.6" }}
                          dangerouslySetInnerHTML={{ __html: bodyHtml || '<p style="color:#999">Email body will appear here...</p>' }}
                        />
                        <div style={{ background: "#fff", textAlign: "center" as const, padding: "8px 24px 36px" }}>
                          <a href="#" style={{ display: "inline-block", background: "#FFB433", color: "#fff", padding: "14px 32px", borderRadius: "6px", textDecoration: "none", fontWeight: 600, fontSize: "15px" }}>BOOK YOUR LIFE UPGRADE CALL</a>
                        </div>
                        <div style={{ background: "#f7f7f7", borderTop: "1px solid #eee", padding: "20px 24px", textAlign: "center" }}>
                          <p style={{ margin: "0 0 4px", fontSize: "12px", color: "#888" }}>Indian Transformation Academy</p>
                          <p style={{ margin: "0 0 10px", fontSize: "11px", color: "#aaa" }}>Coach Your Coach</p>
                          <p style={{ margin: 0, fontSize: "11px" }}><a href="#" style={{ color: "#999", textDecoration: "underline" }}>Unsubscribe</a></p>
                        </div>
                      </div>
                    </div>
                    {/* Gmail reply bar */}
                    <div style={{ background: "#fff", borderTop: "1px solid #e5e7eb", padding: "12px 20px", display: "flex", gap: "8px" }}>
                      <div style={{ flex: 1, border: "1px solid #dadce0", borderRadius: "20px", padding: "8px 16px", fontSize: "13px", color: "#5f6368" }}>Click here to Reply</div>
                      <div style={{ border: "1px solid #dadce0", borderRadius: "20px", padding: "8px 16px", fontSize: "13px", color: "#5f6368" }}>Forward</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────

function DeleteConfirmModal({ name, onConfirm, onCancel, deleting }: { name: string; onConfirm: () => void; onCancel: () => void; deleting: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-card border border-border rounded-2xl w-full max-w-sm p-6 space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
          <Trash2 className="w-5 h-5 text-red-400" />
        </div>
        <div className="text-center">
          <h3 className="font-bold text-foreground">Delete Template?</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Are you sure you want to delete "<span className="text-foreground font-medium">{name}</span>"? This cannot be undone.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted transition-all">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={deleting} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-red-500 hover:bg-red-600 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5">
            {deleting ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Delete
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Templates() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);

  // ─── Fetch templates ─────────────────────────────────────────────────

  const { data: templates = [], isLoading } = useQuery<EmailTemplate[]>({
    queryKey: ["email-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .eq("is_active", true)
        .order("is_system", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as EmailTemplate[];
    },
  });

  // Seed system templates if empty
  useEffect(() => {
    if (!isLoading && templates.length === 0) {
      (async () => {
        const { error } = await supabase.from("email_templates").insert(SYSTEM_TEMPLATES);
        if (!error) {
          queryClient.invalidateQueries({ queryKey: ["email-templates"] });
        }
      })();
    }
  }, [isLoading, templates.length, queryClient]);

  // ─── Mutations ─────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; category: string; subject: string; body_html: string; description: string; preview_text: string }) => {
      const { error } = await supabase.from("email_templates").insert({
        ...data,
        is_system: false,
        is_default: false,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast.success("Template created successfully!");
      setShowEditor(false);
    },
    onError: () => toast.error("Failed to create template"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name: string; category: string; subject: string; body_html: string; description: string; preview_text: string }) => {
      const { error } = await supabase.from("email_templates").update({ ...data, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast.success("Template updated!");
      setEditingTemplate(null);
      setShowEditor(false);
    },
    onError: () => toast.error("Failed to update template"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("email_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast.success("Template deleted");
      setDeleteTarget(null);
    },
    onError: () => toast.error("Failed to delete template"),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (template: EmailTemplate) => {
      const { error } = await supabase.from("email_templates").insert({
        name: `${template.name} (Copy)`,
        category: template.category,
        subject: template.subject,
        body_html: template.body_html,
        body_blocks: template.body_blocks,
        description: template.description,
        preview_text: template.preview_text,
        is_system: false,
        is_default: false,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      toast.success("Template duplicated!");
    },
    onError: () => toast.error("Failed to duplicate template"),
  });

  // ─── Filtered templates ─────────────────────────────────────────────

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchesSearch = !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase()) || (t.subject || "").toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === "All" || t.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [templates, searchQuery, activeCategory]);

  const systemTemplates = filteredTemplates.filter((t) => t.is_system);
  const customTemplates = filteredTemplates.filter((t) => !t.is_system);

  // ─── Actions ────────────────────────────────────────────────────────

  const copySubject = (t: EmailTemplate) => {
    navigator.clipboard.writeText(t.subject || "");
    setCopiedId(t.id);
    toast.success("Subject line copied!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const useInCampaign = (t: EmailTemplate) => {
    sessionStorage.setItem("template_draft", JSON.stringify({ subject: t.subject, body: t.body_html }));
    navigate("/campaigns");
  };

  const stripHtml = (html: string) => html?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || "";

  // ─── Template Card ────────────────────────────────────────────────

  const TemplateCard = ({ t, i, isSystem }: { t: EmailTemplate; i: number; isSystem: boolean }) => {
    const color = CATEGORY_COLORS[t.category] || "#60A5FA";
    const Icon = CATEGORY_ICONS[t.category] || FileText;
    const isCopied = copiedId === t.id;

    return (
      <motion.div
        key={t.id}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.04 }}
        className="bg-card border border-border/50 rounded-2xl overflow-hidden hover:border-primary/20 transition-all group"
      >
        {/* Color accent top bar */}
        <div className="h-1 w-full" style={{ background: `linear-gradient(90deg, ${color}, ${color}80)` }} />

        {/* Card Header */}
        <div className="p-4 flex items-start gap-3 border-b border-border/30">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${color}18` }}
          >
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-foreground">{t.name}</p>
              <span
                className="text-[9px] px-2 py-0.5 rounded-full font-semibold border"
                style={{ color, background: `${color}12`, borderColor: `${color}25` }}
              >
                {t.category}
              </span>
              {isSystem && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  System
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">📧 {t.subject || "No subject"}</p>
          </div>
        </div>

        {/* Preview */}
        <div className="px-4 py-3">
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
            {t.description || stripHtml(t.body_html || "").slice(0, 120) || "No preview available"}
          </p>
        </div>

        {/* Actions */}
        <div className="px-4 pb-4 flex gap-2 flex-wrap">
          <button
            onClick={() => copySubject(t)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-muted/50 text-muted-foreground text-xs font-semibold hover:bg-muted hover:text-foreground transition-all"
          >
            {isCopied ? (
              <><CheckCircle className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400">Copied!</span></>
            ) : (
              <><Copy className="w-3.5 h-3.5" />Copy Subject</>
            )}
          </button>
          <button
            onClick={() => useInCampaign(t)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition-all"
          >
            <Mail className="w-3.5 h-3.5" /> Use in Campaign
          </button>
          <button
            onClick={() => { setEditingTemplate(t); setShowEditor(true); }}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-muted/50 text-muted-foreground text-xs font-semibold hover:bg-muted hover:text-foreground transition-all"
            title="Preview"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => duplicateMutation.mutate(t)}
            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-muted/50 text-muted-foreground text-xs font-semibold hover:bg-muted hover:text-foreground transition-all"
            title="Duplicate"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
          {!isSystem && (
            <>
              <button
                onClick={() => { setEditingTemplate(t); setShowEditor(true); }}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-muted/50 text-muted-foreground text-xs font-semibold hover:bg-muted hover:text-foreground transition-all"
                title="Edit"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setDeleteTarget(t)}
                className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-red-500/5 text-red-400/70 text-xs font-semibold hover:bg-red-500/10 hover:text-red-400 transition-all"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Email Templates</h1>
              <p className="text-sm text-muted-foreground">
                {templates.length} templates — {systemTemplates.length + customTemplates.length} showing
              </p>
            </div>
          </div>
          <button
            onClick={() => { setEditingTemplate(null); setShowEditor(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
          >
            <Plus className="w-4 h-4" /> Create Template
          </button>
        </div>

        {/* Search & Filter */}
        <div className="flex gap-3 flex-col sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-10 pr-4 py-2.5 bg-card border border-border/50 rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeCategory === cat
                  ? "bg-primary text-black shadow-lg shadow-primary/20"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredTemplates.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-20">
            <div className="text-5xl mb-4">📧✨📝</div>
            <p className="text-lg font-semibold text-foreground">No templates found</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              {searchQuery || activeCategory !== "All"
                ? "Try adjusting your search or category filter"
                : "Create your first email template to get started!"}
            </p>
            <button
              onClick={() => { setEditingTemplate(null); setShowEditor(true); }}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary hover:bg-primary/90 transition-all"
            >
              <Plus className="w-4 h-4" /> Create Template
            </button>
          </motion.div>
        ) : (
          <div className="space-y-8">
            {/* Custom Templates Section */}
            {customTemplates.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Your Templates</h2>
                  <span className="text-xs text-muted-foreground">({customTemplates.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customTemplates.map((t, i) => (
                    <TemplateCard key={t.id} t={t} i={i} isSystem={false} />
                  ))}
                </div>
              </div>
            )}

            {/* System Templates Section */}
            {systemTemplates.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">System Templates</h2>
                  <span className="text-xs text-muted-foreground">({systemTemplates.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {systemTemplates.map((t, i) => (
                    <TemplateCard key={t.id} t={t} i={i} isSystem={true} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {showEditor && (
          <TemplateEditor
            template={editingTemplate}
            onClose={() => { setShowEditor(false); setEditingTemplate(null); }}
            saving={createMutation.isPending || updateMutation.isPending}
            onSave={(data) => {
              if (editingTemplate) {
                updateMutation.mutate({ id: editingTemplate.id, ...data });
              } else {
                createMutation.mutate(data);
              }
            }}
          />
        )}
        {deleteTarget && (
          <DeleteConfirmModal
            name={deleteTarget.name}
            deleting={deleteMutation.isPending}
            onCancel={() => setDeleteTarget(null)}
            onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}
