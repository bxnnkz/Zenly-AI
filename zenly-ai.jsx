import { useState, useRef, useEffect } from "react";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const SUPABASE_URL      = "https://fdtsngrythbgsayunevr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZkdHNuZ3J5dGhiZ3NheXVuZXZyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMjc1ODcsImV4cCI6MjA5MTcwMzU4N30.yzqgHSVroiEU6kGvA33DXgwSmLYo028OCpJBq7be_bc";
const STRIPE_PAYMENT_LINK = "https://buy.stripe.com/3cIaERc3Q4IbfLl9HdbZe00";
const STRIPE_PORTAL_LINK  = "https://billing.stripe.com/p/login/3cIaERc3Q4IbfLl9HdbZe00";

const TOOLS = [
  { id: "chat",      icon: "✦", label: "Ask Anything", color: "#7FFFD4", desc: "Your personal AI for any question" },
  { id: "write",     icon: "✐", label: "Write For Me",  color: "#FFD700", desc: "Emails, messages, essays, bios" },
  { id: "plan",      icon: "◈", label: "Daily Planner", color: "#FF8C69", desc: "Organize your day with AI" },
  { id: "summarize", icon: "◎", label: "Summarize",     color: "#DDA0FF", desc: "Paste any text, get the key points" },
];

const SYSTEM_PROMPTS = {
  chat:      "You are Zenly AI, a warm, smart, and concise daily assistant. Help the user with any question they have. Keep answers clear and practical. Never be verbose.",
  write:     "You are Zenly AI writing assistant. Help the user write anything — emails, messages, captions, bios, cover letters, etc. Always produce clean, ready-to-use text.",
  plan:      "You are Zenly AI daily planner. Help the user organize their day, prioritize tasks, and create a practical schedule. Be structured, use time blocks, keep it actionable.",
  summarize: "You are Zenly AI summarizer. The user will paste text. Summarize it into 3-5 clear bullet points highlighting only the most important information. Be concise and accurate.",
};

const PLACEHOLDERS = {
  chat:      "Ask me anything...",
  write:     "What do you need written? (e.g. 'a thank you email to my boss')",
  plan:      "Tell me your tasks for today and I'll build your plan...",
  summarize: "Paste any text here and I'll extract the key points...",
};

const SUGGESTIONS = {
  chat:      ["What should I eat for more energy?", "Help me make a tough decision", "Explain something simply"],
  write:     ["Write a professional thank-you email", "Write my Instagram bio", "Write a job application intro"],
  plan:      ["Plan my day: meetings, gym, emails", "I have 3 big projects due this week", "Build me a morning routine"],
  summarize: ["Paste an article to summarize", "Summarize a long email thread", "Condense my meeting notes"],
};

const FREE_LIMIT  = 25;
const STORAGE_KEY = "zenly_usage_v2";

// ─── SUPABASE CLIENT ──────────────────────────────────────────────────────────
const sb = {
  async signUp(email, password, name) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password, data: { full_name: name } }),
    });
    return r.json();
  },
  async signIn(email, password) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY },
      body: JSON.stringify({ email, password }),
    });
    return r.json();
  },
  async getUser(token) {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    });
    return r.json();
  },
  async getProStatus(token, userId) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/subscriptions?user_id=eq.${userId}&status=eq.active&select=*`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    const data = await r.json();
    return Array.isArray(data) && data.length > 0;
  },
};

// ─── USAGE ────────────────────────────────────────────────────────────────────
function usageKey(uid) { return `${STORAGE_KEY}_${uid}`; }
function loadUsage(uid) {
  try {
    const raw = localStorage.getItem(usageKey(uid));
    if (!raw) { const f={count:0,resetAt:Date.now()+86400000}; localStorage.setItem(usageKey(uid),JSON.stringify(f)); return f; }
    const d = JSON.parse(raw);
    if (Date.now()>d.resetAt) { const f={count:0,resetAt:Date.now()+86400000}; localStorage.setItem(usageKey(uid),JSON.stringify(f)); return f; }
    return d;
  } catch { return {count:0,resetAt:Date.now()+86400000}; }
}
function saveUsage(uid, count, resetAt) { try { localStorage.setItem(usageKey(uid), JSON.stringify({count,resetAt})); } catch {} }
function formatTimeLeft(resetAt) {
  const ms=resetAt-Date.now(); if (ms<=0) return "soon";
  const h=Math.floor(ms/3600000), m=Math.floor((ms%3600000)/60000);
  return h>0 ? `${h}h ${m}m` : `${m}m`;
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.25}}
  @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
  @keyframes glow{0%,100%{box-shadow:0 0 20px rgba(127,255,212,0.15)}50%{box-shadow:0 0 40px rgba(127,255,212,0.4)}}
  textarea,input{resize:none;outline:none;}
  ::-webkit-scrollbar{width:3px;}
  ::-webkit-scrollbar-thumb{background:#1e1e1e;border-radius:4px;}
  button{transition:all 0.18s;cursor:pointer;}
  button:active{transform:scale(0.96);}
  input::placeholder{color:#333;}
  input:-webkit-autofill{-webkit-box-shadow:0 0 0 100px #111 inset;-webkit-text-fill-color:#ddd;}
`;

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
function Logo({ size=34 }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
      <div style={{ width:size, height:size, borderRadius:size*0.27, background:"linear-gradient(135deg,#7FFFD4,#4fc3a1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:size*0.44, color:"#000", fontWeight:"900", flexShrink:0 }}>✦</div>
      <div>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:size*0.58, fontWeight:"900", letterSpacing:"-0.3px", lineHeight:1, color:"#fff" }}>Zenly <span style={{ color:"#7FFFD4" }}>AI</span></div>
        <div style={{ fontSize:"8px", color:"#2a2a2a", fontFamily:"'Space Mono',monospace", letterSpacing:"2px", marginTop:"2px" }}>DAILY ASSISTANT</div>
      </div>
    </div>
  );
}

function Field({ label, type="text", value, onChange, placeholder, error, onKeyDown }) {
  return (
    <div style={{ marginBottom:"18px" }}>
      <label style={{ display:"block", fontSize:"11px", color:"#555", fontFamily:"'Space Mono',monospace", letterSpacing:"1px", marginBottom:"8px" }}>{label}</label>
      <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} onKeyDown={onKeyDown}
        style={{ width:"100%", padding:"13px 16px", borderRadius:"12px", background:"#111", border:error?"1px solid #c0392b":"1px solid #1e1e1e", color:"#ddd", fontSize:"15px", fontFamily:"'DM Sans',sans-serif" }} />
      {error && <div style={{ color:"#e74c3c", fontSize:"12px", marginTop:"5px", fontFamily:"'DM Sans',sans-serif" }}>{error}</div>}
    </div>
  );
}

function AuthBtn({ children, onClick, loading }) {
  return (
    <button onClick={onClick} disabled={loading} style={{ width:"100%", padding:"14px", borderRadius:"12px", border:"none", background:"linear-gradient(135deg,#7FFFD4,#4fc3a1)", color:"#000", fontWeight:"800", fontSize:"15px", fontFamily:"'Space Mono',monospace", letterSpacing:"0.5px", boxShadow:"0 6px 24px rgba(127,255,212,0.18)", opacity:loading?0.7:1, display:"flex", alignItems:"center", justifyContent:"center", gap:"8px" }}>
      {loading && <div style={{ width:"14px", height:"14px", border:"2px solid #00000030", borderTop:"2px solid #000", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />}
      {children}
    </button>
  );
}

function ErrorBox({ msg }) {
  if (!msg) return null;
  return <div style={{ background:"#2a0d0d", border:"1px solid #5a1a1a", borderRadius:"10px", padding:"12px 16px", marginBottom:"18px", color:"#e74c3c", fontSize:"13px", fontFamily:"'DM Sans',sans-serif" }}>{msg}</div>;
}

// ─── SPLASH ───────────────────────────────────────────────────────────────────
function SplashScreen({ onLogin, onSignup }) {
  return (
    <div style={{ minHeight:"100vh", background:"#080808", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"32px 24px", animation:"fadeIn 0.5s ease" }}>
      <style>{CSS}</style>
      <div style={{ textAlign:"center", maxWidth:"340px", width:"100%" }}>
        <div style={{ width:"80px", height:"80px", borderRadius:"24px", margin:"0 auto 28px", background:"linear-gradient(135deg,#7FFFD4,#4fc3a1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"36px", color:"#000", boxShadow:"0 0 60px rgba(127,255,212,0.2)" }}>✦</div>
        <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:"38px", fontWeight:"900", color:"#fff", letterSpacing:"-1px", marginBottom:"10px", lineHeight:1.1 }}>Zenly <span style={{ color:"#7FFFD4" }}>AI</span></h1>
        <p style={{ color:"#444", fontSize:"15px", lineHeight:1.8, marginBottom:"48px", fontFamily:"'DM Sans',sans-serif" }}>Your smart daily assistant.<br/>Write, plan, ask, and summarize — powered by AI.</p>
        <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
          <button onClick={onSignup} style={{ padding:"15px", borderRadius:"14px", border:"none", background:"linear-gradient(135deg,#7FFFD4,#4fc3a1)", color:"#000", fontWeight:"800", fontSize:"15px", fontFamily:"'Space Mono',monospace", letterSpacing:"0.5px", boxShadow:"0 8px 32px rgba(127,255,212,0.22)" }}>GET STARTED — FREE</button>
          <button onClick={onLogin}  style={{ padding:"15px", borderRadius:"14px", border:"1px solid #1e1e1e", background:"transparent", color:"#555", fontWeight:"600", fontSize:"14px", fontFamily:"'DM Sans',sans-serif" }}>I already have an account</button>
        </div>
        <div style={{ marginTop:"40px", display:"flex", justifyContent:"center", gap:"24px" }}>
          {[["✦","Ask Anything"],["✐","Write For Me"],["◈","Plan My Day"],["◎","Summarize"]].map(([icon,label]) => (
            <div key={label} style={{ textAlign:"center" }}>
              <div style={{ fontSize:"20px", color:"#7FFFD4", marginBottom:"4px" }}>{icon}</div>
              <div style={{ fontSize:"9px", color:"#333", fontFamily:"'Space Mono',monospace", letterSpacing:"0.5px" }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:"40px", fontSize:"11px", color:"#1e1e1e", fontFamily:"'Space Mono',monospace", letterSpacing:"1.5px" }}>ZENLY AI · POWERED BY CLAUDE</div>
      </div>
    </div>
  );
}

// ─── SIGN UP ──────────────────────────────────────────────────────────────────
function SignupScreen({ onSuccess, onLogin }) {
  const [name,setName]=useState(""); const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
  const [errors,setErrors]=useState({}); const [loading,setLoading]=useState(false); const [notice,setNotice]=useState("");

  const validate = () => {
    const e={};
    if (!name.trim()) e.name="Name is required";
    if (!email.includes("@")) e.email="Enter a valid email";
    if (password.length<6) e.password="Min. 6 characters";
    return e;
  };

  const handleSignup = async () => {
    const e=validate(); if (Object.keys(e).length){setErrors(e);return;}
    setLoading(true); setErrors({});
    try {
      const data = await sb.signUp(email,password,name);
      if (data.error){setErrors({general:data.error.message||"Sign up failed."});return;}
      if (data.access_token) onSuccess({token:data.access_token,user:{id:data.user.id,email,name,createdAt:data.user.created_at}});
      else setNotice("✅ Check your email to confirm your account, then log in.");
    } catch { setErrors({general:"Network error. Please try again."}); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:"100vh", background:"#080808", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"32px 20px", animation:"fadeUp 0.35s ease" }}>
      <style>{CSS}</style>
      <div style={{ maxWidth:"380px", width:"100%" }}>
        <div style={{ textAlign:"center", marginBottom:"32px" }}>
          <Logo size={40} />
          <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"26px", color:"#fff", marginTop:"24px", marginBottom:"6px" }}>Create your account</h2>
          <p style={{ color:"#3a3a3a", fontSize:"14px", fontFamily:"'DM Sans',sans-serif" }}>25 free AI requests every day</p>
        </div>
        {notice ? (
          <div style={{ background:"#0d2a1a", border:"1px solid #1a5a2a", borderRadius:"14px", padding:"28px", textAlign:"center" }}>
            <p style={{ color:"#7FFFD4", fontSize:"15px", fontFamily:"'DM Sans',sans-serif", lineHeight:1.7 }}>{notice}</p>
            <button onClick={onLogin} style={{ marginTop:"20px", background:"none", border:"none", color:"#555", fontSize:"13px", fontFamily:"'Space Mono',monospace" }}>Go to login →</button>
          </div>
        ) : (
          <>
            <ErrorBox msg={errors.general} />
            <Field label="FULL NAME" value={name}     onChange={setName}     placeholder="Your name"         error={errors.name} />
            <Field label="EMAIL"     value={email}    onChange={setEmail}    placeholder="you@email.com"     error={errors.email}    type="email" />
            <Field label="PASSWORD"  value={password} onChange={setPassword} placeholder="Min. 6 characters" error={errors.password} type="password" />
            <div style={{ marginBottom:"20px" }} />
            <AuthBtn onClick={handleSignup} loading={loading}>CREATE ACCOUNT</AuthBtn>
            <div style={{ marginTop:"16px", textAlign:"center" }}>
              <button onClick={onLogin} style={{ background:"none", border:"none", color:"#444", fontSize:"13px", fontFamily:"'DM Sans',sans-serif" }}>
                Already have an account? <span style={{ color:"#7FFFD4" }}>Log in</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── LOG IN ───────────────────────────────────────────────────────────────────
function LoginScreen({ onSuccess, onSignup }) {
  const [email,setEmail]=useState(""); const [password,setPassword]=useState("");
  const [error,setError]=useState(""); const [loading,setLoading]=useState(false);

  const handleLogin = async () => {
    if (!email||!password){setError("Please fill in all fields.");return;}
    setLoading(true); setError("");
    try {
      const data = await sb.signIn(email,password);
      if (data.error||!data.access_token){setError(data.error?.message||"Invalid email or password.");return;}
      const user = await sb.getUser(data.access_token);
      onSuccess({token:data.access_token,user:{id:user.id,email:user.email,name:user.user_metadata?.full_name||user.email.split("@")[0],createdAt:user.created_at}});
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight:"100vh", background:"#080808", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"32px 20px", animation:"fadeUp 0.35s ease" }}>
      <style>{CSS}</style>
      <div style={{ maxWidth:"380px", width:"100%" }}>
        <div style={{ textAlign:"center", marginBottom:"32px" }}>
          <Logo size={40} />
          <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"26px", color:"#fff", marginTop:"24px", marginBottom:"6px" }}>Welcome back</h2>
          <p style={{ color:"#3a3a3a", fontSize:"14px", fontFamily:"'DM Sans',sans-serif" }}>Sign in to your Zenly AI account</p>
        </div>
        <ErrorBox msg={error} />
        <Field label="EMAIL"    value={email}    onChange={setEmail}    placeholder="you@email.com" type="email"    onKeyDown={e=>e.key==="Enter"&&handleLogin()} />
        <Field label="PASSWORD" value={password} onChange={setPassword} placeholder="Your password" type="password" onKeyDown={e=>e.key==="Enter"&&handleLogin()} />
        <div style={{ marginBottom:"20px" }} />
        <AuthBtn onClick={handleLogin} loading={loading}>LOG IN</AuthBtn>
        <div style={{ marginTop:"16px", textAlign:"center" }}>
          <button onClick={onSignup} style={{ background:"none", border:"none", color:"#444", fontSize:"13px", fontFamily:"'DM Sans',sans-serif" }}>
            Don't have an account? <span style={{ color:"#7FFFD4" }}>Sign up free</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── UPGRADE MODAL ────────────────────────────────────────────────────────────
function UpgradeModal({ onClose, resetAt, userEmail }) {
  const handleCheckout = () => {
    const url = `${STRIPE_PAYMENT_LINK}?prefilled_email=${encodeURIComponent(userEmail||"")}`;
    window.open(url, "_blank");
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.93)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px", animation:"fadeUp 0.25s ease" }}>
      <div style={{ background:"#0a0a0a", border:"1px solid #222", borderRadius:"28px", padding:"40px 28px", maxWidth:"400px", width:"100%", textAlign:"center", boxShadow:"0 0 100px rgba(127,255,212,0.08),0 40px 80px rgba(0,0,0,0.7)" }}>
        <div style={{ display:"inline-block", padding:"4px 14px", borderRadius:"20px", background:"#0d2a1a", border:"1px solid #1a5a2a", color:"#7FFFD4", fontSize:"11px", fontFamily:"'Space Mono',monospace", marginBottom:"20px" }}>ZENLY PRO</div>
        <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"28px", color:"#fff", margin:"0 0 10px", lineHeight:1.2 }}>Unlock unlimited AI</h2>
        <p style={{ color:"#555", fontSize:"14px", marginBottom:"28px", lineHeight:1.7, fontFamily:"'DM Sans',sans-serif" }}>
          {resetAt ? <>Resets in <span style={{ color:"#7FFFD4" }}>{formatTimeLeft(resetAt)}</span> · or upgrade for unlimited every day.</> : "Get unlimited AI requests every single day."}
        </p>
        <div style={{ background:"#0f0f0f", border:"1px solid #1e1e1e", borderRadius:"20px", padding:"24px 20px", marginBottom:"24px" }}>
          <div style={{ display:"flex", alignItems:"baseline", justifyContent:"center", gap:"4px", marginBottom:"6px" }}>
            <span style={{ fontFamily:"'Playfair Display',serif", fontSize:"48px", fontWeight:"900", color:"#fff" }}>$7</span>
            <span style={{ fontFamily:"'Playfair Display',serif", fontSize:"28px", color:"#7FFFD4" }}>.99</span>
            <span style={{ color:"#444", fontSize:"14px", fontFamily:"'DM Sans',sans-serif", marginLeft:"4px" }}>/month</span>
          </div>
          <div style={{ color:"#333", fontSize:"12px", fontFamily:"'DM Sans',sans-serif", marginBottom:"20px" }}>Cancel anytime · No commitments</div>
          <div style={{ display:"flex", flexDirection:"column", gap:"10px", textAlign:"left" }}>
            {[["⚡","Unlimited daily AI requests"],["🚀","Priority response speed"],["🔓","All 4 tools, forever"],["✨","Early access to new features"],["🎯","No ads, ever"]].map(([icon,text]) => (
              <div key={text} style={{ display:"flex", gap:"12px", alignItems:"center", color:"#aaa", fontSize:"14px", fontFamily:"'DM Sans',sans-serif" }}>
                <span style={{ fontSize:"16px" }}>{icon}</span>{text}
              </div>
            ))}
          </div>
        </div>
        <button onClick={handleCheckout} style={{ width:"100%", padding:"16px", borderRadius:"14px", border:"none", background:"linear-gradient(135deg,#7FFFD4,#4fc3a1)", color:"#000", fontWeight:"800", fontSize:"16px", cursor:"pointer", fontFamily:"'Space Mono',monospace", letterSpacing:"0.5px", marginBottom:"10px", boxShadow:"0 8px 32px rgba(127,255,212,0.25)", animation:"glow 2s ease-in-out infinite" }}>
          START PRO — $7.99/mo →
        </button>
        <div style={{ color:"#2a2a2a", fontSize:"11px", marginBottom:"14px", fontFamily:"'DM Sans',sans-serif" }}>🔒 Secure checkout via Stripe · Cancel anytime</div>
        <button onClick={onClose} style={{ background:"none", border:"none", color:"#333", cursor:"pointer", fontSize:"13px", fontFamily:"'Space Mono',monospace" }}>
          {resetAt ? "Wait for reset" : "Maybe later"}
        </button>
      </div>
    </div>
  );
}

// ─── SUCCESS MODAL ────────────────────────────────────────────────────────────
function SuccessModal({ onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.93)", zIndex:100, display:"flex", alignItems:"center", justifyContent:"center", padding:"20px", animation:"fadeUp 0.3s ease" }}>
      <div style={{ background:"#0a0a0a", border:"1px solid #1a5a2a", borderRadius:"28px", padding:"48px 32px", maxWidth:"360px", width:"100%", textAlign:"center", boxShadow:"0 0 80px rgba(127,255,212,0.12)" }}>
        <div style={{ fontSize:"56px", marginBottom:"20px" }}>🎉</div>
        <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"28px", color:"#fff", marginBottom:"12px" }}>Welcome to Pro!</h2>
        <p style={{ color:"#555", fontSize:"15px", lineHeight:1.7, fontFamily:"'DM Sans',sans-serif", marginBottom:"32px" }}>Your account has been upgraded. You now have unlimited AI every day.</p>
        <button onClick={onClose} style={{ width:"100%", padding:"14px", borderRadius:"12px", border:"none", background:"linear-gradient(135deg,#7FFFD4,#4fc3a1)", color:"#000", fontWeight:"800", fontSize:"15px", fontFamily:"'Space Mono',monospace", boxShadow:"0 6px 24px rgba(127,255,212,0.2)" }}>
          START USING PRO ✦
        </button>
      </div>
    </div>
  );
}

// ─── PROFILE DRAWER ───────────────────────────────────────────────────────────
function ProfileDrawer({ user, usage, isPro, onUpgrade, onLogout, onClose }) {
  const initial = (user.name||"?")[0].toUpperCase();
  const joined  = user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US",{month:"long",year:"numeric"}) : "—";

  return (
    <div style={{ position:"fixed", inset:0, zIndex:50, animation:"fadeIn 0.2s ease" }} onClick={onClose}>
      <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.7)" }} />
      <div onClick={e=>e.stopPropagation()} style={{ position:"absolute", top:0, right:0, bottom:0, width:"min(300px,100vw)", background:"#0a0a0a", borderLeft:"1px solid #161616", display:"flex", flexDirection:"column", padding:"32px 22px", overflowY:"auto" }}>
        <style>{`@keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>
        <button onClick={onClose} style={{ position:"absolute", top:"18px", right:"18px", background:"none", border:"none", color:"#333", fontSize:"22px" }}>×</button>
        <div style={{ textAlign:"center", marginBottom:"24px" }}>
          <div style={{ width:"68px", height:"68px", borderRadius:"50%", margin:"0 auto 12px", background:"linear-gradient(135deg,#7FFFD4,#4fc3a1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"26px", fontWeight:"900", color:"#000", fontFamily:"'Playfair Display',serif" }}>{initial}</div>
          <div style={{ color:"#fff", fontSize:"16px", fontWeight:"600", fontFamily:"'DM Sans',sans-serif" }}>{user.name}</div>
          <div style={{ color:"#333", fontSize:"12px", marginTop:"3px", fontFamily:"'DM Sans',sans-serif" }}>{user.email}</div>
          {isPro
            ? <div style={{ display:"inline-flex", alignItems:"center", gap:"6px", marginTop:"10px", padding:"5px 14px", borderRadius:"20px", background:"linear-gradient(135deg,#0d2a1a,#0a1f14)", border:"1px solid #1a5a2a", color:"#7FFFD4", fontSize:"12px", fontFamily:"'Space Mono',monospace" }}>✦ PRO MEMBER</div>
            : <div style={{ display:"inline-block", marginTop:"8px", padding:"3px 12px", borderRadius:"20px", background:"#111", border:"1px solid #1e1e1e", color:"#444", fontSize:"11px", fontFamily:"'Space Mono',monospace" }}>FREE PLAN</div>
          }
        </div>
        <div style={{ background:"#0f0f0f", border:"1px solid #161616", borderRadius:"14px", padding:"16px", marginBottom:"16px" }}>
          <div style={{ fontSize:"10px", color:"#2a2a2a", fontFamily:"'Space Mono',monospace", letterSpacing:"1.5px", marginBottom:"12px" }}>ACCOUNT</div>
          {[["Member since",joined],["Plan",isPro?"Zenly Pro ✦":"Free"],["Daily usage",`${usage.count} / ${isPro?"∞":FREE_LIMIT}`],["Resets in",formatTimeLeft(usage.resetAt)]].map(([label,val]) => (
            <div key={label} style={{ display:"flex", justifyContent:"space-between", marginBottom:"10px" }}>
              <span style={{ color:"#3a3a3a", fontSize:"13px", fontFamily:"'DM Sans',sans-serif" }}>{label}</span>
              <span style={{ color:val.includes("✦")?"#7FFFD4":"#666", fontSize:"13px", fontWeight:"600", fontFamily:"'DM Sans',sans-serif" }}>{val}</span>
            </div>
          ))}
        </div>
        {isPro ? (
          <button onClick={()=>window.open(STRIPE_PORTAL_LINK,"_blank")} style={{ width:"100%", padding:"12px", borderRadius:"12px", border:"1px solid #1a5a2a", background:"#0d2a1a", color:"#7FFFD4", fontSize:"12px", fontFamily:"'Space Mono',monospace", marginBottom:"10px" }}>
            MANAGE BILLING →
          </button>
        ) : (
          <button onClick={onUpgrade} style={{ width:"100%", padding:"13px", borderRadius:"12px", border:"none", background:"linear-gradient(135deg,#7FFFD4,#4fc3a1)", color:"#000", fontWeight:"800", fontSize:"12px", fontFamily:"'Space Mono',monospace", letterSpacing:"0.5px", boxShadow:"0 6px 20px rgba(127,255,212,0.18)", marginBottom:"10px" }}>
            ⚡ UPGRADE TO PRO — $7.99/mo
          </button>
        )}
        <div style={{ flex:1 }} />
        <button onClick={onLogout} style={{ width:"100%", padding:"12px", borderRadius:"12px", border:"1px solid #1e1e1e", background:"transparent", color:"#3a3a3a", fontSize:"13px", fontFamily:"'DM Sans',sans-serif" }}>Sign out</button>
      </div>
    </div>
  );
}

// ─── MESSAGE ──────────────────────────────────────────────────────────────────
function Message({ msg }) {
  const isUser = msg.role==="user";
  return (
    <div style={{ display:"flex", justifyContent:isUser?"flex-end":"flex-start", marginBottom:"16px", animation:"fadeUp 0.3s ease" }}>
      {!isUser && <div style={{ width:"30px", height:"30px", borderRadius:"50%", background:"linear-gradient(135deg,#7FFFD4,#4fc3a1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"13px", marginRight:"10px", flexShrink:0, marginTop:"3px", color:"#000" }}>✦</div>}
      <div style={{ maxWidth:"78%", padding:"13px 17px", borderRadius:isUser?"18px 18px 4px 18px":"18px 18px 18px 4px", background:isUser?"linear-gradient(135deg,#162d1f,#112419)":"#111", border:isUser?"1px solid #1e4a2a":"1px solid #1c1c1c", color:isUser?"#9dffc8":"#ddd", fontSize:"15px", lineHeight:"1.7", fontFamily:"'DM Sans',sans-serif", whiteSpace:"pre-wrap" }}>{msg.content}</div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
function AppScreen({ session, onLogout }) {
  const { token, user } = session;
  const [activeTool,    setActiveTool]    = useState("chat");
  const [conversations, setConversations] = useState({ chat:[], write:[], plan:[], summarize:[] });
  const [input,         setInput]         = useState("");
  const [loading,       setLoading]       = useState(false);
  const [showUpgrade,   setShowUpgrade]   = useState(false);
  const [showProfile,   setShowProfile]   = useState(false);
  const [showSuccess,   setShowSuccess]   = useState(false);
  const [isPro,         setIsPro]         = useState(false);
  const [usage,         setUsage]         = useState(()=>loadUsage(user.id));
  const bottomRef   = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("payment")==="success") {
      setShowSuccess(true); setIsPro(true);
      window.history.replaceState({},"",window.location.pathname);
    }
    sb.getProStatus(token,user.id).then(pro=>{if(pro)setIsPro(true);}).catch(()=>{});
  }, [token, user.id]);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[conversations,loading]);
  useEffect(()=>{ const iv=setInterval(()=>setUsage(loadUsage(user.id)),30000); return ()=>clearInterval(iv); },[user.id]);

  const messages       = conversations[activeTool];
  const isLimitReached = !isPro && usage.count>=FREE_LIMIT;
  const tool           = TOOLS.find(t=>t.id===activeTool);
  const initial        = (user.name||"?")[0].toUpperCase();

  const sendMessage = async () => {
    const text=input.trim(); if (!text||loading) return;
    if (isLimitReached) { setShowUpgrade(true); return; }
    const userMsg={role:"user",content:text};
    const newMessages=[...messages,userMsg];
    setConversations(p=>({...p,[activeTool]:newMessages}));
    setInput(""); setLoading(true);
    if (textareaRef.current) textareaRef.current.style.height="auto";
    const newCount=usage.count+1;
    setUsage({count:newCount,resetAt:usage.resetAt});
    saveUsage(user.id,newCount,usage.resetAt);
    try {
      const res  = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1000,system:SYSTEM_PROMPTS[activeTool],messages:newMessages.map(m=>({role:m.role,content:m.content}))}),
      });
      const data = await res.json();
      const reply= data.content?.map(b=>b.text||"").join("")||"Something went wrong.";
      setConversations(p=>({...p,[activeTool]:[...newMessages,{role:"assistant",content:reply}]}));
    } catch {
      setConversations(p=>({...p,[activeTool]:[...newMessages,{role:"assistant",content:"Connection error. Please try again."}]}));
    } finally { setLoading(false); }
  };

  const handleKey=(e)=>{ if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendMessage();} };

  return (
    <div style={{ minHeight:"100vh", background:"#080808", color:"#fff", fontFamily:"'DM Sans',sans-serif", display:"flex", flexDirection:"column" }}>
      <style>{CSS}</style>
      {showUpgrade && <UpgradeModal onClose={()=>setShowUpgrade(false)} resetAt={isLimitReached?usage.resetAt:null} userEmail={user.email} />}
      {showProfile  && <ProfileDrawer user={user} usage={usage} isPro={isPro} onUpgrade={()=>{setShowProfile(false);setShowUpgrade(true);}} onLogout={onLogout} onClose={()=>setShowProfile(false)} />}
      {showSuccess  && <SuccessModal onClose={()=>setShowSuccess(false)} />}

      {/* Header */}
      <div style={{ padding:"14px 16px 12px", borderBottom:"1px solid #0f0f0f", display:"flex", alignItems:"center", justifyContent:"space-between", background:"rgba(8,8,8,0.97)", backdropFilter:"blur(16px)", position:"sticky", top:0, zIndex:10 }}>
        <Logo size={32} />
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          {isPro
            ? <div style={{ padding:"5px 12px", borderRadius:"8px", background:"#0d2a1a", border:"1px solid #1a5a2a", color:"#7FFFD4", fontSize:"11px", fontFamily:"'Space Mono',monospace" }}>✦ PRO</div>
            : <button onClick={()=>setShowUpgrade(true)} style={{ padding:"7px 14px", borderRadius:"8px", background:"linear-gradient(135deg,#7FFFD4,#4fc3a1)", border:"none", color:"#000", fontWeight:"800", fontSize:"11px", fontFamily:"'Space Mono',monospace", letterSpacing:"0.5px", boxShadow:"0 3px 12px rgba(127,255,212,0.18)" }}>⚡ PRO</button>
          }
          <button onClick={()=>setShowProfile(true)} style={{ width:"34px", height:"34px", borderRadius:"50%", background:"linear-gradient(135deg,#7FFFD4,#4fc3a1)", border:"none", color:"#000", fontSize:"14px", fontWeight:"900", fontFamily:"'Playfair Display',serif", display:"flex", alignItems:"center", justifyContent:"center" }}>{initial}</button>
        </div>
      </div>

      {/* Tool Tabs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:"5px", padding:"10px 10px 0", maxWidth:"800px", margin:"0 auto", width:"100%" }}>
        {TOOLS.map(t=>(
          <button key={t.id} onClick={()=>setActiveTool(t.id)} style={{ padding:"9px 4px 8px", borderRadius:"11px", background:activeTool===t.id?"#0d0d0d":"transparent", border:activeTool===t.id?`1px solid ${t.color}35`:"1px solid #0f0f0f", textAlign:"center" }}>
            <div style={{ fontSize:"18px", marginBottom:"3px", color:activeTool===t.id?t.color:"#282828" }}>{t.icon}</div>
            <div style={{ fontSize:"9px", fontFamily:"'Space Mono',monospace", color:activeTool===t.id?t.color:"#282828", fontWeight:"700", letterSpacing:"0.3px", lineHeight:1.3 }}>{t.label}</div>
          </button>
        ))}
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:"auto", padding:"20px 12px 6px", maxWidth:"800px", margin:"0 auto", width:"100%" }}>
        {messages.length===0 && (
          <div style={{ textAlign:"center", paddingTop:"28px", animation:"fadeUp 0.4s ease" }}>
            <div style={{ fontSize:"46px", marginBottom:"12px", color:tool.color, filter:`drop-shadow(0 0 16px ${tool.color}33)` }}>{tool.icon}</div>
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:"22px", marginBottom:"7px", color:"#fff", letterSpacing:"-0.3px" }}>{tool.label}</h2>
            <p style={{ color:"#333", fontSize:"14px", maxWidth:"240px", margin:"0 auto", lineHeight:1.7 }}>{tool.desc}</p>
            <div style={{ marginTop:"22px", display:"flex", flexDirection:"column", gap:"6px", alignItems:"center" }}>
              {SUGGESTIONS[activeTool].map(s=>(
                <button key={s} onClick={()=>{setInput(s);setTimeout(()=>textareaRef.current?.focus(),50);}} style={{ padding:"9px 16px", borderRadius:"18px", border:"1px solid #141414", background:"#0a0a0a", color:"#3a3a3a", fontSize:"13px", fontFamily:"'DM Sans',sans-serif", maxWidth:"300px", lineHeight:1.4 }}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((msg,i)=><Message key={i} msg={msg} />)}
        {loading && (
          <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"14px", animation:"fadeUp 0.3s ease" }}>
            <div style={{ width:"30px", height:"30px", borderRadius:"50%", background:"linear-gradient(135deg,#7FFFD4,#4fc3a1)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"13px", color:"#000" }}>✦</div>
            <div style={{ display:"flex", gap:"5px" }}>
              {[0,1,2].map(i=><div key={i} style={{ width:"6px", height:"6px", borderRadius:"50%", background:"#7FFFD4", animation:`pulse 1.1s ease-in-out ${i*0.17}s infinite` }} />)}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ padding:"6px 10px 16px", maxWidth:"800px", margin:"0 auto", width:"100%" }}>
        {isLimitReached ? (
          <div style={{ background:"#0a0a0a", border:"1px solid #161616", borderRadius:"14px", padding:"16px", textAlign:"center" }}>
            <p style={{ color:"#333", fontSize:"13px", fontFamily:"'DM Sans',sans-serif", marginBottom:"10px" }}>Daily limit reached · Resets in <span style={{ color:"#4a4a4a" }}>{formatTimeLeft(usage.resetAt)}</span></p>
            <button onClick={()=>setShowUpgrade(true)} style={{ padding:"9px 22px", borderRadius:"9px", background:"linear-gradient(135deg,#7FFFD4,#4fc3a1)", border:"none", color:"#000", fontWeight:"800", fontSize:"12px", fontFamily:"'Space Mono',monospace", boxShadow:"0 4px 14px rgba(127,255,212,0.18)" }}>⚡ UNLOCK UNLIMITED</button>
          </div>
        ) : (
          <div style={{ display:"flex", gap:"9px", alignItems:"flex-end", background:"#0d0d0d", border:"1px solid #181818", borderRadius:"14px", padding:"10px 12px", boxShadow:"0 4px 24px rgba(0,0,0,0.5)" }}>
            <textarea ref={textareaRef} value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey} placeholder={PLACEHOLDERS[activeTool]} rows={1}
              style={{ flex:1, background:"none", border:"none", color:"#ddd", fontSize:"15px", fontFamily:"'DM Sans',sans-serif", lineHeight:"1.55", maxHeight:"110px", overflowY:"auto", caretColor:"#7FFFD4" }}
              onInput={e=>{e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,110)+"px";}} />
            <button onClick={sendMessage} disabled={!input.trim()||loading} style={{ width:"34px", height:"34px", borderRadius:"8px", flexShrink:0, background:input.trim()&&!loading?"linear-gradient(135deg,#7FFFD4,#4fc3a1)":"#141414", border:"none", cursor:input.trim()&&!loading?"pointer":"default", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"15px", color:input.trim()&&!loading?"#000":"#1e1e1e", fontWeight:"900", boxShadow:input.trim()&&!loading?"0 4px 14px rgba(127,255,212,0.22)":"none" }}>
              {loading?<div style={{ width:"13px", height:"13px", border:"2px solid #1e1e1e", borderTop:"2px solid #7FFFD4", borderRadius:"50%", animation:"spin 0.7s linear infinite" }} />:"↑"}
            </button>
          </div>
        )}
        <div style={{ textAlign:"center", marginTop:"6px", fontSize:"9px", color:"#161616", fontFamily:"'Space Mono',monospace", letterSpacing:"1.5px" }}>ZENLY AI · POWERED BY CLAUDE</div>
      </div>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function ZenlyAI() {
  const [screen,  setScreen]  = useState("splash");
  const [session, setSession] = useState(null);

  useEffect(() => {
    try {
      const raw=localStorage.getItem("zenly_session");
      if (raw) { const s=JSON.parse(raw); if (s?.token&&s?.user){setSession(s);setScreen("app");} }
    } catch {}
  }, []);

  const handleAuthSuccess = (s) => {
    localStorage.setItem("zenly_session",JSON.stringify(s));
    setSession(s); setScreen("app");
  };

  const handleLogout = () => {
    localStorage.removeItem("zenly_session");
    setSession(null); setScreen("splash");
  };

  if (screen==="splash") return <SplashScreen onLogin={()=>setScreen("login")} onSignup={()=>setScreen("signup")} />;
  if (screen==="signup") return <SignupScreen  onSuccess={handleAuthSuccess} onLogin={()=>setScreen("login")} />;
  if (screen==="login")  return <LoginScreen   onSuccess={handleAuthSuccess} onSignup={()=>setScreen("signup")} />;
  return <AppScreen session={session} onLogout={handleLogout} />;
}
