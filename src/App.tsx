import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ToastProvider } from "@/components/Toast";
import { supabase } from "@/lib/supabase";
import { checkScheduledCampaigns } from "@/lib/campaignScheduler";

const queryClient = new QueryClient();

const Login = lazy(() => import("@/pages/Login"));
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Contacts = lazy(() => import("@/pages/Contacts"));
const ContactDetail = lazy(() => import("@/pages/ContactDetail"));
const Sequences = lazy(() => import("@/pages/Sequences"));
const Pipeline = lazy(() => import("@/pages/Pipeline"));
const MetaAds = lazy(() => import("@/pages/MetaAds"));
const Tags = lazy(() => import("@/pages/Tags"));
const EmailCampaigns = lazy(() => import("@/pages/EmailCampaigns"));
const CampaignEditor = lazy(() => import("@/pages/CampaignEditor"));
const SettingsPage = lazy(() => import("@/pages/Settings"));
const AutomationWorkflows = lazy(() => import("@/pages/AutomationWorkflows"));
const WorkflowBuilder = lazy(() => import("@/pages/WorkflowBuilder"));
const Attribution = lazy(() => import("@/pages/Attribution"));
const Analytics = lazy(() => import("@/pages/Analytics"));
const Templates = lazy(() => import("@/pages/Templates"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const Unsubscribe = lazy(() => import("@/pages/Unsubscribe"));
const Segments = lazy(() => import("@/pages/Segments"));
const WhatsApp = lazy(() => import("@/pages/WhatsApp"));
const EmailReports = lazy(() => import("@/pages/EmailReports"));
const Bookings = lazy(() => import("@/pages/Bookings"));
const BookingEventWizard = lazy(() => import("@/pages/BookingEventWizard"));
const PublicBookingPage = lazy(() => import("@/pages/PublicBookingPage"));
const BookingDetail = lazy(() => import("@/pages/BookingDetail"));
const BookingManagePage = lazy(() => import("@/pages/BookingManagePage"));
const AddContact = lazy(() => import("@/pages/AddContact"));
const Funnels = lazy(() => import("@/pages/Funnels"));
const FunnelDetail = lazy(() => import("@/pages/FunnelDetail"));
const PageEditor = lazy(() => import("@/pages/PageEditor"));

const Loader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, profile } = useAuth();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" replace />;
  if (profile && profile.role !== "admin") return <div className="min-h-screen bg-background flex items-center justify-center text-foreground text-sm">Admin access required</div>;
  return <>{children}</>;
}

/** Runs campaign scheduler in the background every 5 minutes when authenticated */
function CampaignSchedulerRunner() {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) return;

    // Run once immediately on mount
    checkScheduledCampaigns(supabase, qc).catch(console.error);

    // Then every 5 minutes
    const interval = setInterval(() => {
      checkScheduledCampaigns(supabase, qc).catch(console.error);
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user, qc]);

  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
        <BrowserRouter>
          <CampaignSchedulerRunner />
          <Suspense fallback={<Loader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/unsubscribe" element={<Unsubscribe />} />
              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
              <Route path="/contacts/new" element={<ProtectedRoute><AddContact /></ProtectedRoute>} />
              <Route path="/contacts/:id" element={<ProtectedRoute><ContactDetail /></ProtectedRoute>} />
              <Route path="/pipeline" element={<ProtectedRoute><Pipeline /></ProtectedRoute>} />
              <Route path="/sequences" element={<ProtectedRoute><Sequences /></ProtectedRoute>} />
              <Route path="/campaigns" element={<ProtectedRoute><EmailCampaigns /></ProtectedRoute>} />
              <Route path="/campaigns/:id" element={<ProtectedRoute><CampaignEditor /></ProtectedRoute>} />
              <Route path="/meta-ads" element={<ProtectedRoute><MetaAds /></ProtectedRoute>} />
              <Route path="/attribution" element={<ProtectedRoute><Attribution /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
              <Route path="/email-reports" element={<ProtectedRoute><EmailReports /></ProtectedRoute>} />
              <Route path="/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
              <Route path="/tags" element={<ProtectedRoute><Tags /></ProtectedRoute>} />
              <Route path="/workflows" element={<ProtectedRoute><AutomationWorkflows /></ProtectedRoute>} />
              <Route path="/workflows/:id" element={<ProtectedRoute><WorkflowBuilder /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="/segments" element={<ProtectedRoute><Segments /></ProtectedRoute>} />
              <Route path="/whatsapp" element={<ProtectedRoute><WhatsApp /></ProtectedRoute>} />
              <Route path="/bookings" element={<ProtectedRoute><Bookings /></ProtectedRoute>} />
              <Route path="/bookings/new" element={<ProtectedRoute><BookingEventWizard /></ProtectedRoute>} />
              <Route path="/bookings/:eventId/edit" element={<ProtectedRoute><BookingEventWizard /></ProtectedRoute>} />
              <Route path="/bookings/detail/:id" element={<ProtectedRoute><BookingDetail /></ProtectedRoute>} />
              <Route path="/book/:slug" element={<PublicBookingPage />} />
              <Route path="/book/manage/:token" element={<BookingManagePage />} />
              <Route path="/funnels" element={<ProtectedRoute><Funnels /></ProtectedRoute>} />
              <Route path="/funnels/:id" element={<ProtectedRoute><FunnelDetail /></ProtectedRoute>} />
              <Route path="/funnels/:id/pages/:pageId/edit" element={<ProtectedRoute><PageEditor /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
