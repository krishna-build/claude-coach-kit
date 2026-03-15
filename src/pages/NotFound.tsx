import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Zap, Home } from "lucide-react";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md"
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-gold-dark flex items-center justify-center shadow-2xl shadow-primary/30 mx-auto mb-6">
          <Zap className="w-8 h-8 text-black" />
        </div>
        <h1 className="text-8xl font-black gold-text mb-4">404</h1>
        <p className="text-xl font-bold text-foreground mb-2">Page not found</p>
        <p className="text-sm text-muted-foreground mb-8">
          Looks like this page got lost in the automation funnel. Let's get you back on track.
        </p>
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-black font-bold mx-auto hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
        >
          <Home className="w-4 h-4" />
          Back to Dashboard
        </button>
      </motion.div>
    </div>
  );
}
