import React, { useState } from "react";
import { motion } from "motion/react";
import {
  Train,
  Lock,
  User,
  ArrowRight,
  RefreshCw,
  Eye,
  EyeOff,
  AlertCircle,
  ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function Auth5({
  onLogin,
  demoUsers = [],
  className = ""
}) {
  const [empId, setEmpId] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  const handleCredentialsSubmit = (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    setTimeout(() => {
      const trimmedEmp = empId.trim();
      const user = demoUsers.find(
        (u) => u.username === trimmedEmp && u.password === password
      );

      if (user) {
        onLogin({
          ...user,
          zone: user.zone || "Central Railway"
        });
      } else {
        setError("Invalid credentials. Try: admin / railblock@2026");
        setLoading(false);
      }
    }, 700);
  };

  const handleQuickDemoFill = () => {
    setEmpId("admin");
    setPassword("railblock@2026");
    setError("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn(
        "w-full max-w-[420px] rounded-[26px] p-7 sm:p-8 transition-all",
        "bg-white/70 backdrop-blur-2xl border border-white/80",
        "shadow-[0_24px_50px_-12px_rgba(15,35,65,0.18),inset_0_1px_1px_rgba(255,255,255,0.9)]",
        className
      )}
      style={{
        backdropFilter: "blur(26px) saturate(170%)",
        WebkitBackdropFilter: "blur(26px) saturate(170%)",
      }}
    >
      {/* Header Branding */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#17537A]/10 border border-[#17537A]/20 text-[#17537A] mb-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.8)]">
          {/* Centralized Block Planning Icon: Central hub coordinating maintenance blocks across corridors */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-6 h-6 text-[#17537A]"
          >
            {/* 4 Modular Maintenance Blocks */}
            <rect x="3" y="3.5" width="5.5" height="5" rx="1.5" />
            <rect x="15.5" y="3.5" width="5.5" height="5" rx="1.5" />
            <rect x="3" y="15.5" width="5.5" height="5" rx="1.5" />
            <rect x="15.5" y="15.5" width="5.5" height="5" rx="1.5" />
            {/* Central Coordination Core */}
            <circle cx="12" cy="12" r="2.25" fill="currentColor" />
            {/* Centralized Interlocking & Synchronization Lines */}
            <path d="M8.5 6h2.5a1 1 0 0 1 1 1v2.5" />
            <path d="M15.5 6h-2.5a1 1 0 0 0-1 1v2.5" />
            <path d="M8.5 18h2.5a1 1 0 0 0 1-1v-2.5" />
            <path d="M15.5 18h-2.5a1 1 0 0 1-1-1v-2.5" />
          </svg>
        </div>
        <h1 className="text-[20px] sm:text-[22px] font-bold text-[#1E293B] tracking-tight m-0 leading-snug">
          Centralized Block Planning System
        </h1>
        <p className="text-xs sm:text-[12px] text-[#475569] mt-1.5 leading-relaxed font-normal">
          AI-powered railway maintenance block planning platform
        </p>
      </div>

      <form onSubmit={handleCredentialsSubmit} className="space-y-4">
        {/* Employee ID / Username */}
        <div>
          <label className="block text-[11px] font-semibold text-[#334155] mb-1.5 uppercase tracking-wider">
            EMPLOYEE ID / USERNAME
          </label>
          <div
            className={cn(
              "flex items-center gap-3 px-3.5 h-[46px] rounded-xl bg-white/75 border transition-all",
              "shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]",
              focusedField === "empId"
                ? "border-[#17537A] ring-3 ring-[#17537A]/15 bg-white/95"
                : "border-slate-200/80 hover:border-slate-300"
            )}
          >
            <User className="w-4 h-4 text-[#64748B] shrink-0" />
            <input
              type="text"
              value={empId}
              onChange={(e) => setEmpId(e.target.value)}
              onFocus={() => setFocusedField("empId")}
              onBlur={() => setFocusedField(null)}
              placeholder="Enter Employee ID (e.g. admin)"
              required
              className="w-full bg-transparent text-sm text-[#1E293B] placeholder-[#94A3B8] font-medium outline-none"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[11px] font-semibold text-[#334155] uppercase tracking-wider">
              PASSWORD
            </label>
            <span className="text-[10.5px] font-medium text-[#64748B] bg-slate-100/80 px-2 py-0.5 rounded-md border border-slate-200/50">
              Protected
            </span>
          </div>
          <div
            className={cn(
              "flex items-center gap-3 px-3.5 h-[46px] rounded-xl bg-white/75 border transition-all",
              "shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]",
              focusedField === "password"
                ? "border-[#17537A] ring-3 ring-[#17537A]/15 bg-white/95"
                : "border-slate-200/80 hover:border-slate-300"
            )}
          >
            <Lock className="w-4 h-4 text-[#64748B] shrink-0" />
            <input
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocusedField("password")}
              onBlur={() => setFocusedField(null)}
              placeholder="Enter system password"
              required
              className="w-full bg-transparent text-sm text-[#1E293B] placeholder-[#94A3B8] font-medium outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="text-[#64748B] hover:text-[#1E293B] p-1 rounded transition-colors cursor-pointer"
              title={showPass ? "Hide password" : "Show password"}
            >
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-red-50/90 border border-red-200 text-red-700 text-xs font-medium">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Sign In Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-[46px] rounded-xl bg-[#17537A] hover:bg-[#124363] active:bg-[#0D344E] text-white font-semibold text-sm tracking-wide transition-all shadow-[0_4px_16px_rgba(23,83,122,0.25)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed mt-3"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>AUTHENTICATING...</span>
            </>
          ) : (
            <>
              <span>SIGN IN</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        {/* Quick Demo Credentials Fill Button */}
        <button
          type="button"
          onClick={handleQuickDemoFill}
          className="w-full py-1 text-[#17537A] hover:text-[#0F324B] text-[11.5px] font-medium transition-all text-center cursor-pointer"
        >
          ⚡ Fill Demo Credentials (admin / railblock@2026)
        </button>

        {/* Subtle Security / Authorized System Indicator */}
        <div className="pt-3 border-t border-slate-200/60 flex items-center justify-center gap-1.5 text-[11px] text-[#64748B] font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-[#17537A]" />
          <span>Restricted • Indian Railways Engineering System</span>
        </div>
      </form>
    </motion.div>
  );
}