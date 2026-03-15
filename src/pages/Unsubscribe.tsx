import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { CheckCircle, XCircle, Loader2, Zap } from "lucide-react";

type Status = "loading" | "success" | "already" | "error" | "resubscribed";

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const email = params.get("email") || "";
  const token = params.get("token") || "";

  const [status, setStatus] = useState<Status>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!email) {
      setStatus("error");
      setErrorMsg("No email address provided.");
      return;
    }
    handleUnsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleUnsubscribe() {
    setStatus("loading");
    try {
      // Update the contact
      const { data: contact, error: fetchErr } = await supabase
        .from("automation_contacts")
        .select("id, unsubscribed")
        .eq("email", email)
        .maybeSingle();

      if (fetchErr) throw fetchErr;

      if (!contact) {
        setStatus("error");
        setErrorMsg("We couldn't find an account with that email address.");
        return;
      }

      if (contact.unsubscribed) {
        setStatus("already");
        return;
      }

      const { error: updateErr } = await supabase
        .from("automation_contacts")
        .update({ unsubscribed: true, unsubscribed_at: new Date().toISOString() })
        .eq("email", email);

      if (updateErr) throw updateErr;

      // If a token was provided, also mark the email log entry
      if (token) {
        await supabase
          .from("automation_email_log")
          .update({ unsubscribed_via_email: true })
          .eq("unsubscribe_token", token);
      }

      setStatus("success");
    } catch (err: any) {
      console.error("Unsubscribe error:", err);
      setStatus("error");
      setErrorMsg(err?.message || "Something went wrong. Please try again.");
    }
  }

  async function handleResubscribe() {
    setStatus("loading");
    try {
      const { error } = await supabase
        .from("automation_contacts")
        .update({ unsubscribed: false, unsubscribed_at: null })
        .eq("email", email);

      if (error) throw error;
      setStatus("resubscribed");
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err?.message || "Failed to re-subscribe. Please try again.");
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "#1e2028" }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "#FFB433" }}>
              <Zap className="w-6 h-6 text-black" />
            </div>
            <span className="text-xl font-bold text-white">Your Coach</span>
          </div>
          <p className="text-sm" style={{ color: "#6b7280" }}>Life &amp; Abundance Coach</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border p-8 text-center" style={{ background: "#262830", borderColor: "rgba(255,255,255,0.08)" }}>

          {/* LOADING */}
          {status === "loading" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <Loader2 className="w-12 h-12 mx-auto animate-spin" style={{ color: "#FFB433" }} />
              <p className="text-white font-medium">Processing your request…</p>
            </motion.div>
          )}

          {/* SUCCESS */}
          {status === "success" && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ background: "rgba(239,68,68,0.12)" }}>
                <CheckCircle className="w-9 h-9" style={{ color: "#ef4444" }} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white mb-2">You've been unsubscribed</h1>
                <p className="text-sm leading-relaxed" style={{ color: "#9ca3af" }}>
                  You've been unsubscribed from Your Coach's emails.<br />
                  You won't receive any more emails from us.
                </p>
                {email && (
                  <p className="text-xs mt-3 font-mono px-3 py-1.5 rounded-lg inline-block" style={{ color: "#FFB433", background: "rgba(255,180,51,0.1)" }}>
                    {email}
                  </p>
                )}
              </div>
              <div className="pt-2">
                <p className="text-xs mb-3" style={{ color: "#6b7280" }}>Made a mistake?</p>
                <button
                  onClick={handleResubscribe}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold border transition-all hover:opacity-90"
                  style={{ borderColor: "#FFB433", color: "#FFB433", background: "rgba(255,180,51,0.08)" }}
                >
                  Re-subscribe to emails
                </button>
              </div>
            </motion.div>
          )}

          {/* ALREADY UNSUBSCRIBED */}
          {status === "already" && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ background: "rgba(255,180,51,0.12)" }}>
                <CheckCircle className="w-9 h-9" style={{ color: "#FFB433" }} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white mb-2">Already unsubscribed</h1>
                <p className="text-sm" style={{ color: "#9ca3af" }}>
                  This email address is already unsubscribed from our list.
                </p>
              </div>
              <button
                onClick={handleResubscribe}
                className="px-6 py-2.5 rounded-xl text-sm font-semibold border transition-all hover:opacity-90"
                style={{ borderColor: "#FFB433", color: "#FFB433", background: "rgba(255,180,51,0.08)" }}
              >
                Re-subscribe to emails
              </button>
            </motion.div>
          )}

          {/* RE-SUBSCRIBED */}
          {status === "resubscribed" && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ background: "rgba(34,197,94,0.12)" }}>
                <CheckCircle className="w-9 h-9" style={{ color: "#22c55e" }} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white mb-2">Welcome back! 🎉</h1>
                <p className="text-sm" style={{ color: "#9ca3af" }}>
                  You've been successfully re-subscribed to Your Coach's emails.
                  You'll continue receiving valuable content and updates.
                </p>
              </div>
            </motion.div>
          )}

          {/* ERROR */}
          {status === "error" && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5">
              <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center" style={{ background: "rgba(239,68,68,0.12)" }}>
                <XCircle className="w-9 h-9" style={{ color: "#ef4444" }} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white mb-2">Something went wrong</h1>
                <p className="text-sm" style={{ color: "#9ca3af" }}>
                  {errorMsg || "We couldn't process your request. Please try again or contact support."}
                </p>
              </div>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs mt-6" style={{ color: "#4b5563" }}>
          © {new Date().getFullYear()} Your Coach · Life &amp; Abundance Coach
        </p>
      </motion.div>
    </div>
  );
}
