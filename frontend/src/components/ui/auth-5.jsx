import React, { useState } from "react";
import { motion } from "motion/react";
import {
  Train,
  Lock,
  User,
  Building2,
  ArrowRight,
  RefreshCw,
  Eye,
  EyeOff,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function Auth5({
  onLogin,
  demoUsers = [],
  defaultZone = "CR",
  className = ""
}) {
  const [empId, setEmpId] = useState("");
  const [password, setPassword] = useState("");
  const [zone, setZone] = useState(defaultZone);
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
          zone: zone || user.zone
        });
      } else {
        setError("Invalid credentials. Try: admin / railblock@2026");
        setLoading(false);
      }
    }, 800);
  };

  const handleQuickDemoFill = () => {
    setEmpId("admin");
    setPassword("railblock@2026");
    setZone("CR");
    setError("");
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn(
        "w-full max-w-[450px] rounded-3xl p-7 sm:p-9 transition-all",
        "bg-white/70 backdrop-blur-xl border border-white/80 shadow-[0_20px_50px_rgba(15,23,42,0.16)]",
        className
      )}
      style={{
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
      }}
    >
      {/* Header Branding */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-[#0066CC] mb-3 shadow-inner">
          <Train className="w-6 h-6 text-[#0066CC]" />
        </div>
        <h1 className="text-2xl sm:text-[25px] font-bold text-[#0F294D] tracking-tight m-0">
          Sign In to Train Block System
        </h1>
        <p className="text-xs sm:text-[13px] text-[#475569] mt-1.5 leading-relaxed font-normal">
          AI-powered railway maintenance block planning system
        </p>
      </div>

      <form onSubmit={handleCredentialsSubmit} className="space-y-4">
        {/* Employee ID */}
        <div>
          <label className="block text-[11px] font-bold text-[#334155] mb-1.5 uppercase tracking-wider">
            EMPLOYEE ID / USERNAME
          </label>
          <div
            className={cn(
              "flex items-center gap-3 px-3.5 h-12 rounded-xl bg-white/90 border transition-all",
              focusedField === "empId"
                ? "border-[#0066CC] ring-3 ring-[#0066CC]/20 bg-white"
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
              className="w-full bg-transparent text-sm text-[#0F294D] placeholder-[#94A3B8] font-medium outline-none"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-[11px] font-bold text-[#334155] uppercase tracking-wider">
              PASSWORD
            </label>
            <span className="text-[11px] font-medium text-[#64748B]">Protected</span>
          </div>
          <div
            className={cn(
              "flex items-center gap-3 px-3.5 h-12 rounded-xl bg-white/90 border transition-all",
              focusedField === "password"
                ? "border-[#0066CC] ring-3 ring-[#0066CC]/20 bg-white"
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
              className="w-full bg-transparent text-sm text-[#0F294D] placeholder-[#94A3B8] font-medium outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPass(!showPass)}
              className="text-[#64748B] hover:text-[#0F294D] p-1 rounded transition-colors"
              title={showPass ? "Hide password" : "Show password"}
            >
              {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Railway Zone / Division */}
        <div>
          <label className="block text-[11px] font-bold text-[#334155] mb-1.5 uppercase tracking-wider">
            RAILWAY ZONE / DIVISION
          </label>
          <div
            className={cn(
              "flex items-center gap-3 px-3.5 h-12 rounded-xl bg-white/90 border transition-all",
              focusedField === "zone"
                ? "border-[#0066CC] ring-3 ring-[#0066CC]/20 bg-white"
                : "border-slate-200/80 hover:border-slate-300"
            )}
          >
            <Building2 className="w-4 h-4 text-[#64748B] shrink-0" />
            <select
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              onFocus={() => setFocusedField("zone")}
              onBlur={() => setFocusedField(null)}
              className="w-full bg-transparent text-sm text-[#0F294D] font-medium outline-none cursor-pointer"
            >
              <option value="CR">Central Railway (CR - HQ Mumbai CSMT)</option>
              <option value="WR">Western Railway (WR - HQ Churchgate)</option>
              <option value="NR">Northern Railway (NR - HQ New Delhi)</option>
              <option value="SR">Southern Railway (SR - HQ Chennai)</option>
              <option value="ER">Eastern Railway (ER - HQ Kolkata)</option>
              <option value="SCR">South Central Railway (SCR - HQ Secunderabad)</option>
            </select>
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
          className="w-full h-12 rounded-xl bg-[#0066CC] hover:bg-[#0052A3] active:bg-[#004080] text-white font-semibold text-sm tracking-wide transition-all shadow-[0_4px_14px_rgba(0,102,204,0.35)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed mt-2"
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

        {/* Demo Credentials Button */}
        <button
          type="button"
          onClick={handleQuickDemoFill}
          className="w-full py-2 px-3 text-[#0066CC] hover:text-[#004080] text-xs font-semibold transition-all text-center cursor-pointer"
        >
          ⚡ Fill Demo Credentials (admin / railblock@2026)
        </button>
      </form>
    </motion.div>
  );
}