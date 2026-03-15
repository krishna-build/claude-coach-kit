import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) setError(error.message);
    else navigate("/");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Gradient background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-gradient-to-br from-[#FFB433]/8 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-gradient-to-tl from-violet-500/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute top-[40%] right-[20%] w-[30%] h-[30%] bg-gradient-to-bl from-[#FFB433]/4 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative z-10">
        {/* Logo & Branding */}
        <div className="text-center mb-8">
          <div className="relative inline-block mb-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#FFB433] to-[#e6a02e] flex items-center justify-center shadow-xl shadow-[#FFB433]/20">
              <span className="text-3xl filter drop-shadow-sm">⚡</span>
            </div>
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-[#FFB433]/20 to-transparent blur-md -z-10" />
          </div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "'Montserrat', sans-serif" }}>
            ITA Automation
          </h1>
          <p className="text-sm text-[#FFB433]/70 mt-1.5 font-medium tracking-wide">
            Marketing Automation Platform
          </p>
          <p className="text-xs text-[#555] mt-1">Indian Transformation Academy</p>
        </div>

        {/* Login Card */}
        <div className="bg-[#16181f]/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-[#777] mb-1.5 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-11 px-4 rounded-xl bg-[#0f1117] border border-white/[0.08] text-white text-sm placeholder:text-[#444] focus:outline-none focus:border-[#FFB433]/50 focus:ring-1 focus:ring-[#FFB433]/20 transition-all"
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#777] mb-1.5 block">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 px-4 rounded-xl bg-[#0f1117] border border-white/[0.08] text-white text-sm placeholder:text-[#444] focus:outline-none focus:border-[#FFB433]/50 focus:ring-1 focus:ring-[#FFB433]/20 transition-all"
                required
              />
            </div>
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
                <p className="text-red-400 text-xs font-medium">{error}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-gradient-to-r from-[#FFB433] to-[#e6a02e] text-black font-semibold text-sm hover:shadow-lg hover:shadow-[#FFB433]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] text-[#444] mt-6 tracking-wide">
          Powered by <span className="text-[#555]">Your Business</span>
        </p>
      </div>
    </div>
  );
}
