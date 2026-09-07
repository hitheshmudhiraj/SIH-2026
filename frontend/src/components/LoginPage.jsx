import React, { useState } from "react";
import BlurText from "./BlurText";

const DEMO_USERS = [
  { username: "admin",   password: "railblock@2026", role: "Senior Planning Officer",  zone: "Central Railway" },
  { username: "planner", password: "planner123",     role: "Block Planning Engineer",  zone: "Western Railway" },
  { username: "demo",    password: "demo",            role: "Demo User",               zone: "Indian Railways" },
];

export default function LoginPage({ onLogin }) {
  const [empId,    setEmpId]    = useState("");
  const [password, setPassword] = useState("");
  const [zone,     setZone]     = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [focused,  setFocused]  = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    setTimeout(() => {
      const user = DEMO_USERS.find(
        (u) => u.username === empId.trim() && u.password === password
      );
      if (user) {
        onLogin({ ...user, zone: zone || user.zone });
      } else {
        setError("Invalid credentials. Try  admin / railblock@2026");
        setLoading(false);
      }
    }, 900);
  };

  const fieldBox = (field) => ({
    display: "flex",
    alignItems: "center",
    gap: "12px",
    background: "rgba(255,255,255,0.04)",
    border: focused === field
      ? "1.5px solid rgba(251,191,36,0.8)"
      : "1.5px solid rgba(255,255,255,0.10)",
    borderRadius: "6px",
    padding: "0 16px",
    height: "50px",
    boxShadow: focused === field ? "0 0 0 3px rgba(251,191,36,0.07)" : "none",
    transition: "border 0.2s, box-shadow 0.2s",
  });

  return (
    <div style={{
      display: "flex",
      width: "100vw",
      height: "100vh",
      overflow: "hidden",
      fontFamily: "'Inter','Segoe UI',Arial,sans-serif",
    }}>

      {/* ══════════════════════════════════════
          LEFT — CLEAN TRAIN IMAGE  (60%)
      ══════════════════════════════════════ */}
      <div style={{
        position: "relative",
        width: "60%",
        height: "100%",
        overflow: "hidden",
        flexShrink: 0,
      }}>
        {/* Full clear image — portrait crop centred on the loco */}
        <img
          src="/train_hero.jpg"
          alt="WAP-7 30272 with buffer stop"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center 30%",   /* keeps loco + buffer stop visible */
          }}
        />

      </div>

      {/* ══════════════════════════════════════
          RIGHT — DARK NAVY LOGIN PANEL  (40%)
      ══════════════════════════════════════ */}
      <div style={{
        position: "relative",
        width: "40%",
        height: "100%",
        background: "#0b0f1a",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "36px 44px",
        boxSizing: "border-box",
        overflow: "hidden",
      }}>
        {/* Decorative rings */}
        <div style={{ position:"absolute", bottom:-80,  right:-80,  width:340, height:340, border:"1px solid rgba(251,191,36,0.06)", borderRadius:"50%", pointerEvents:"none" }} />
        <div style={{ position:"absolute", bottom:-130, right:-130, width:520, height:520, border:"1px solid rgba(251,191,36,0.04)", borderRadius:"50%", pointerEvents:"none" }} />

        {/* FORM AREA */}
        <div style={{ position:"relative", zIndex:1, flex:1, display:"flex", flexDirection:"column", justifyContent:"center" }}>

          {/* Title with React Bits BlurText */}
          <div style={{ marginBottom: 4, display: "flex", flexDirection: "column", gap: 0 }}>
            <BlurText
              text="TRAIN"
              delay={60}
              delayOffset={0}
              animateBy="letters"
              direction="top"
              className="text-white font-black"
              style={{
                fontSize: "46px",
                fontWeight: 900,
                color: "#fff",
                lineHeight: 1,
                letterSpacing: "-1.5px",
                margin: 0
              }}
            />
            <BlurText
              text="BLOCK"
              delay={60}
              delayOffset={200}
              animateBy="letters"
              direction="top"
              className="font-black"
              style={{
                fontSize: "46px",
                fontWeight: 900,
                color: "#fbbf24",
                lineHeight: 1,
                letterSpacing: "-1.5px",
                margin: 0
              }}
            />
            <BlurText
              text="SYSTEM"
              delay={60}
              delayOffset={400}
              animateBy="letters"
              direction="top"
              className="text-white font-black"
              style={{
                fontSize: "46px",
                fontWeight: 900,
                color: "#fff",
                lineHeight: 1,
                letterSpacing: "-1.5px",
                margin: 0
              }}
            />
          </div>

          <div style={{ width:44, height:3, background:"#fbbf24", borderRadius:2, margin:"14px 0" }} />

          <p style={{ color:"rgba(255,255,255,0.45)", fontSize:13.5, lineHeight:1.65, margin:"0 0 28px" }}>
            Manage train blocks. Ensure safety.<br/>
            Keep operations on track.
          </p>

          <form onSubmit={handleSubmit} style={{ display:"flex", flexDirection:"column", gap:16 }}>

            {/* Employee ID */}
            <div>
              <div style={{ color:"rgba(255,255,255,0.50)", fontSize:11, fontWeight:700, letterSpacing:"0.14em", marginBottom:8, textTransform:"uppercase" }}>
                Employee ID / Username
              </div>
              <div style={fieldBox("empId")}>
                <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="#fbbf24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                </svg>
                <input
                  type="text" value={empId}
                  onChange={(e) => setEmpId(e.target.value)}
                  onFocus={() => setFocused("empId")}
                  onBlur={() => setFocused(null)}
                  placeholder="Enter station / section"
                  required
                  style={{ flex:1, background:"none", border:"none", outline:"none", color:"#fff", fontSize:14 }}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div style={{ color:"rgba(255,255,255,0.50)", fontSize:11, fontWeight:700, letterSpacing:"0.14em", marginBottom:8, textTransform:"uppercase" }}>
                Password
              </div>
              <div style={fieldBox("pass")}>
                <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="#fbbf24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                </svg>
                <input
                  type={showPass ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocused("pass")}
                  onBlur={() => setFocused(null)}
                  placeholder="Search destination station"
                  required
                  style={{ flex:1, background:"none", border:"none", outline:"none", color:"#fff", fontSize:14 }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{ background:"none", border:"none", cursor:"pointer", color:"rgba(255,255,255,0.30)", display:"flex", padding:0 }}>
                  {showPass
                    ? <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                    : <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                  }
                </button>
              </div>
            </div>

            {/* Zone */}
            <div>
              <div style={{ color:"rgba(255,255,255,0.50)", fontSize:11, fontWeight:700, letterSpacing:"0.14em", marginBottom:8, textTransform:"uppercase" }}>
                Zone / Division
              </div>
              <div style={fieldBox("zone")}>
                <svg width="17" height="17" fill="none" viewBox="0 0 24 24" stroke="#fbbf24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                <select
                  value={zone}
                  onChange={(e) => setZone(e.target.value)}
                  onFocus={() => setFocused("zone")}
                  onBlur={() => setFocused(null)}
                  style={{ flex:1, background:"none", border:"none", outline:"none", color: zone ? "#fff" : "rgba(255,255,255,0.28)", fontSize:14, cursor:"pointer", appearance:"none" }}
                >
                  <option value="" disabled style={{ background:"#0b0f1a", color:"rgba(255,255,255,0.4)" }}>Select date</option>
                  <option value="CR"  style={{ background:"#0b0f1a", color:"#fff" }}>Central Railway (CR)</option>
                  <option value="WR"  style={{ background:"#0b0f1a", color:"#fff" }}>Western Railway (WR)</option>
                  <option value="NR"  style={{ background:"#0b0f1a", color:"#fff" }}>Northern Railway (NR)</option>
                  <option value="SR"  style={{ background:"#0b0f1a", color:"#fff" }}>Southern Railway (SR)</option>
                  <option value="ER"  style={{ background:"#0b0f1a", color:"#fff" }}>Eastern Railway (ER)</option>
                  <option value="SCR" style={{ background:"#0b0f1a", color:"#fff" }}>South Central Railway (SCR)</option>
                </select>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.3)" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                </svg>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ background:"rgba(239,68,68,0.10)", border:"1.5px solid rgba(239,68,68,0.35)", borderRadius:"6px", padding:"10px 14px", color:"#fca5a5", fontSize:12.5, display:"flex", alignItems:"center", gap:8 }}>
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                </svg>
                {error}
              </div>
            )}

            <LoginBtn loading={loading} />
            <DemoBtn onFill={() => { setEmpId("admin"); setPassword("railblock@2026"); setError(""); }} />
          </form>
        </div>

        {/* FOOTER */}
        <div style={{ position:"relative", zIndex:1, display:"flex", alignItems:"center", justifyContent:"space-between", borderTop:"1px solid rgba(255,255,255,0.07)", paddingTop:18 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <svg width="15" height="15" viewBox="0 0 28 28" fill="none">
              <rect x="3" y="14" width="22" height="10" rx="1.5" stroke="#fbbf24" strokeWidth="1.8"/>
              <path d="M3 14 Q3 6 14 6 Q25 6 25 14" stroke="#fbbf24" strokeWidth="1.8" fill="none"/>
              <circle cx="8"  cy="22" r="2" fill="#fbbf24"/>
              <circle cx="20" cy="22" r="2" fill="#fbbf24"/>
            </svg>
            <span style={{ color:"rgba(255,255,255,0.35)", fontSize:11.5, fontWeight:600 }}>Train Block System</span>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center", color:"rgba(255,255,255,0.20)", fontSize:9.5, letterSpacing:"0.1em", fontWeight:600 }}>
            <span>EFFICIENCY</span><span>|</span><span>SAFETY</span><span>|</span><span>RELIABILITY</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder  { color: rgba(255,255,255,0.28) !important; }
        input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 1000px #0b0f1a inset !important;
          -webkit-text-fill-color: #fff !important;
        }
      `}</style>
    </div>
  );
}

function LoginBtn({ loading }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="submit" disabled={loading}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width:"100%", height:54,
        background: loading ? "#a16207" : (hover ? "#fcd34d" : "#fbbf24"),
        color:"#0a0a0a",
        border:"none", borderRadius:"6px",
        fontWeight:800, fontSize:15, letterSpacing:"0.14em",
        cursor: loading ? "not-allowed" : "pointer",
        display:"flex", alignItems:"center", justifyContent:"center", gap:10,
        boxShadow: hover && !loading ? "0 6px 28px rgba(251,191,36,0.40)" : "0 4px 18px rgba(251,191,36,0.18)",
        transition:"background 0.18s, box-shadow 0.18s, transform 0.12s",
        transform: hover && !loading ? "translateY(-1px)" : "none",
        marginTop:6,
      }}
    >
      {loading ? (
        <>
          <svg width="18" height="18" style={{ animation:"spin 0.9s linear infinite" }} fill="none" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" stroke="#0a0a0a" strokeWidth="4" strokeOpacity="0.25"/>
            <path fill="#0a0a0a" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Authenticating…
        </>
      ) : (
        <>
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
          </svg>
          LOGIN
        </>
      )}
    </button>
  );
}

function DemoBtn({ onFill }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button" onClick={onFill}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background:"none",
        border: hover ? "1px solid rgba(251,191,36,0.35)" : "1px solid rgba(255,255,255,0.10)",
        borderRadius:"6px", padding:"10px",
        color: hover ? "#fbbf24" : "rgba(255,255,255,0.35)",
        fontSize:12, cursor:"pointer",
        transition:"all 0.2s", width:"100%",
      }}
    >
      ⚡ Fill Demo Credentials
    </button>
  );
}
