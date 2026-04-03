// @ts-nocheck
import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import * as THREE from "three";

/* ═══════════════════════════════════════════════════════════
   WORKFORCE IQ — LANDING PAGE
   Inspired by homunculus.jp: WebGL fluid distortion shader
   with mouse-driven liquid simulation
   ═══════════════════════════════════════════════════════════ */

// ─── GLSL Shaders ───

const VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}`;

const FRAGMENT_SHADER = `
precision highp float;
uniform float uTime;
uniform vec2 uMouse;
uniform vec2 uResolution;
uniform sampler2D uFluid;
uniform float uScrollY;
varying vec2 vUv;

vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec2 mod289(vec2 x){return x-floor(x*(1.0/289.0))*289.0;}
vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}

float snoise(vec2 v){
  const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i=floor(v+dot(v,C.yy));
  vec2 x0=v-i+dot(i,C.xx);
  vec2 i1;i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
  vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;
  i=mod289(i);
  vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);
  m=m*m;m=m*m;
  vec3 x=2.0*fract(p*C.www)-1.0;
  vec3 h=abs(x)-0.5;
  vec3 ox=floor(x+0.5);
  vec3 a0=x-ox;
  m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
  vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;
  return 130.0*dot(m,g);
}

float fbm(vec2 p){
  float f=0.0,w=0.5;
  for(int i=0;i<6;i++){f+=w*snoise(p);p*=2.02;w*=0.49;}
  return f;
}

float fbm3(vec2 p){
  float f=0.0,w=0.5;
  for(int i=0;i<3;i++){f+=w*snoise(p);p*=2.0;w*=0.5;}
  return f;
}

void main(){
  vec2 uv=vUv;
  vec2 aspect=vec2(uResolution.x/uResolution.y,1.0);

  // ── Fluid distortion from mouse interaction ──
  vec4 fluid=texture2D(uFluid,uv);
  vec2 distort=fluid.rg*0.12;
  vec2 duv=uv+distort;

  float t=uTime*0.08;
  float scroll=uScrollY*0.0003;

  // ── Layered organic noise (the "liquid" feel) ──
  float n1=fbm(duv*2.0+vec2(t,t*0.6+scroll));
  float n2=fbm(duv*3.5+vec2(-t*0.4,t*0.2)+n1*0.6);
  float n3=fbm3(duv*1.2+vec2(t*0.15,-t*0.3)+n2*0.3);
  float warp=fbm(duv*1.8+vec2(n1*0.3,n2*0.3)+t*0.05);

  float pattern=n1*0.4+n2*0.25+n3*0.15+warp*0.2;

  // ── Metaball-like blobs that flow ──
  float blobs=0.0;
  for(int i=0;i<5;i++){
    float fi=float(i);
    vec2 blobPos=vec2(
      0.5+0.35*sin(t*0.7+fi*1.7),
      0.5+0.35*cos(t*0.5+fi*2.1)
    );
    blobPos+=distort*2.0;
    float d=length((uv-blobPos)*aspect);
    blobs+=0.015/max(d,0.01);
  }
  blobs=smoothstep(0.3,1.8,blobs);

  // ── Color composition ──
  vec3 deep=vec3(0.027,0.027,0.035);
  vec3 dark=vec3(0.055,0.035,0.025);
  vec3 warm=vec3(0.6,0.25,0.08);
  vec3 orange=vec3(1.0,0.54,0.3);
  vec3 bright=vec3(1.0,0.85,0.72);

  float intensity=smoothstep(-0.3,0.9,pattern);
  vec3 color=mix(deep,dark,intensity);
  color=mix(color,warm*0.5,smoothstep(0.25,0.55,intensity)*0.6);
  color+=orange*smoothstep(0.5,0.85,intensity)*0.2;
  color+=bright*smoothstep(0.75,1.0,intensity)*0.08;

  // Blob glow
  color+=orange*blobs*0.25;
  color+=bright*blobs*blobs*0.1;

  // ── Mouse proximity radiance ──
  float mouseDist=length((uv-uMouse)*aspect);
  float glow=smoothstep(0.5,0.0,mouseDist);
  color+=orange*glow*0.15;
  color+=bright*glow*glow*0.06;

  // ── Fluid trail luminance ──
  float fluidStrength=length(fluid.rg);
  color+=orange*fluidStrength*0.4;

  // ── Vignette ──
  float vig=1.0-smoothstep(0.3,1.5,length((uv-0.5)*1.6));
  color*=vig;

  // ── Film grain ──
  float grain=fract(sin(dot(gl_FragCoord.xy+uTime*100.0,vec2(12.9898,78.233)))*43758.5453);
  color+=grain*0.015-0.0075;

  gl_FragColor=vec4(max(color,0.0),1.0);
}`;

// ─── Fluid Simulation (CPU-side, uploaded as DataTexture) ───
const GRID = 96;

function createFluidSim() {
  const size = GRID * GRID;
  const data = new Float32Array(size * 4);
  const prev = new Float32Array(size * 4);
  return {
    data, prev, size,
    addForce(mx, my, vx, vy) {
      const gx = Math.floor(mx * GRID);
      const gy = Math.floor(my * GRID);
      const radius = 6;
      const strength = 0.6;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const px = gx + dx, py = gy + dy;
          if (px < 0 || px >= GRID || py < 0 || py >= GRID) continue;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > radius) continue;
          const f = (1 - dist / radius) * strength;
          const idx = (py * GRID + px) * 4;
          data[idx] += vx * f;
          data[idx + 1] += vy * f;
          data[idx + 2] += Math.sqrt(vx * vx + vy * vy) * f;
        }
      }
    },
    step() {
      prev.set(data);
      for (let y = 1; y < GRID - 1; y++) {
        for (let x = 1; x < GRID - 1; x++) {
          const i = (y * GRID + x) * 4;
          for (let c = 0; c < 3; c++) {
            const avg = (
              prev[((y - 1) * GRID + x) * 4 + c] +
              prev[((y + 1) * GRID + x) * 4 + c] +
              prev[(y * GRID + x - 1) * 4 + c] +
              prev[(y * GRID + x + 1) * 4 + c]
            ) * 0.25;
            data[i + c] = prev[i + c] * 0.92 + avg * 0.06;
          }
          data[i + 3] = 1.0;
        }
      }
    }
  };
}

// ─── WebGL Background Component ───
function FluidCanvas() {
  const mountRef = useRef(null);
  const mouseRef = useRef({ x: 0.5, y: 0.5, px: 0.5, py: 0.5 });
  const scrollRef = useRef(0);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.Camera();

    const fluid = createFluidSim();
    const fluidTex = new THREE.DataTexture(fluid.data, GRID, GRID, THREE.RGBAFormat, THREE.FloatType);
    fluidTex.needsUpdate = true;

    const uniforms = {
      uTime: { value: 0 },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uFluid: { value: fluidTex },
      uScrollY: { value: 0 },
    };

    const material = new THREE.ShaderMaterial({
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });

    const plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    scene.add(plane);

    const onMouseMove = (e) => {
      const m = mouseRef.current;
      m.px = m.x; m.py = m.y;
      m.x = e.clientX / window.innerWidth;
      m.y = 1 - e.clientY / window.innerHeight;
    };

    const onScroll = () => { scrollRef.current = window.scrollY; };

    const onResize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
      uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);

    let frame = 0;
    let frameId = 0;
    const animate = () => {
      frame++;
      uniforms.uTime.value = frame * 0.016;
      uniforms.uScrollY.value = scrollRef.current;

      const m = mouseRef.current;
      uniforms.uMouse.value.set(m.x, m.y);

      const vx = (m.x - m.px) * 8;
      const vy = (m.y - m.py) * 8;
      if (Math.abs(vx) > 0.001 || Math.abs(vy) > 0.001) {
        fluid.addForce(m.x, m.y, vx, vy);
      }

      fluid.step();
      fluidTex.needsUpdate = true;

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      material.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} style={{ position: "fixed", inset: 0, zIndex: 0 }} />;
}

// ─── Scroll Reveal Hook ───
function useReveal(threshold = 0.12): [React.RefObject<HTMLDivElement | null>, boolean] {
  const ref = useRef<HTMLDivElement>(null);
  const [vis, setVis] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVis(true); obs.disconnect(); } }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, vis];
}

// ─── Animated Counter ───
function Counter({ value, suffix = "", prefix = "", decimals = 0 }: { value: number; suffix?: string; prefix?: string; decimals?: number }) {
  const [d, setD] = useState(0);
  const [ref, vis] = useReveal(0.3);
  useEffect(() => {
    if (!vis) return;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / 2200, 1);
      setD(value * (1 - Math.pow(1 - p, 4)));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [vis, value]);
  return <span ref={ref}>{prefix}{decimals > 0 ? d.toFixed(decimals) : Math.round(d).toLocaleString()}{suffix}</span>;
}

// ─── Glass Card ───
function Glass({ children, style, delay = 0 }: { children: React.ReactNode; style?: React.CSSProperties; delay?: number }) {
  const [ref, vis] = useReveal();
  const [hov, setHov] = useState(false);
  return (
    <div ref={ref}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
        backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
        border: `1px solid ${hov ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.07)"}`,
        borderRadius: 24, padding: 32,
        boxShadow: hov ? "0 8px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)" : "0 4px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.04)",
        opacity: vis ? 1 : 0, transform: vis ? "translateY(0)" : "translateY(40px)",
        transition: `opacity 0.9s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.9s cubic-bezier(0.16,1,0.3,1) ${delay}ms, background 0.4s, border-color 0.4s, box-shadow 0.4s`,
        ...style,
      }}
    >{children}</div>
  );
}

// ─── Section Label ───
function Label({ children, color = "#FF8A4C" }: { children: React.ReactNode; color?: string }) {
  return <p style={{ color, fontSize: 12, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 16 }}>{children}</p>;
}

// ─── Fire Orb (CSS) ───
function Orb({ size = 100 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", margin: "0 auto", position: "relative",
      background: "radial-gradient(circle at 36% 36%, #FFD4B8 0%, #FFB88C 15%, #FF8A4C 40%, #E85D04 65%, #9A3412 100%)",
      boxShadow: "0 0 60px rgba(255,138,76,0.5), 0 0 120px rgba(255,138,76,0.25), 0 0 200px rgba(255,138,76,0.1), inset 0 -15px 30px rgba(154,52,18,0.6)",
      animation: "orbFloat 6s ease-in-out infinite, orbBreath 3s ease-in-out infinite",
    }}>
      <div style={{ position: "absolute", inset: "12%", borderRadius: "50%", background: "radial-gradient(circle at 32% 28%, rgba(255,255,255,0.4), transparent 55%)" }} />
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", animation: "orbRing 4s ease-in-out infinite alternate",
        boxShadow: "0 0 40px rgba(255,138,76,0.3), inset 0 0 40px rgba(255,138,76,0.15)" }} />
    </div>
  );
}

// ─── Data ───
const TEAM = [
  { name: "Chirag Verma", role: "Project Lead · Full-Stack", li: "https://www.linkedin.com/in/vkin/", init: "CV", col: "#FF8A4C" },
  { name: "Arav Pandey", role: "Data Science · ML", li: "https://www.linkedin.com/in/aravpandey/", init: "AP", col: "#a78bfa" },
  { name: "Rohan Reddy Kolla", role: "Backend · Analytics", li: "https://www.linkedin.com/in/rohan-reddy-kolla/", init: "RK", col: "#34d399" },
];

const FEATURES = [
  { icon: "◈", title: "Recognition Taxonomy", desc: "LLM-powered behavioral classification. 4 categories, 25 subcategories — built inductively using grounded theory methodology.", col: "#FF8A4C" },
  { icon: "◇", title: "NLP Quality Engine", desc: "Specificity scoring, action verb detection, cliché analysis. Know which teams write meaningful recognition.", col: "#a78bfa" },
  { icon: "△", title: "Inequality Analytics", desc: "Gini coefficients and Lorenz curves reveal who gets recognized — and who gets systematically overlooked.", col: "#fb7185" },
  { icon: "◎", title: "Social Network Graph", desc: "PageRank on the recognition network. Find hidden connectors, isolated roles, cross-functional bridges.", col: "#60a5fa" },
  { icon: "◉", title: "AI Fire Orb Agent", desc: "RAG-powered assistant with voice input, file upload, streaming responses, and live dashboard navigation.", col: "#FF8A4C" },
  { icon: "⬡", title: "Live Data Pipeline", desc: "Upload → Taxonomy → Annotate → Compute. The entire dashboard refreshes with new data in real-time.", col: "#34d399" },
];

// ─── Main Component ───
// Reveal heading sub-component to avoid hooks-in-IIFE violation
function RevealHeading({ label, heading, sub, labelColor }: { label: string; heading: React.ReactNode; sub?: string; labelColor?: string }) {
  const [r, v] = useReveal();
  return (
    <div ref={r} style={{ textAlign: "center", marginBottom: 64, opacity: v ? 1 : 0, transform: v ? "none" : "translateY(30px)", transition: "all 1s cubic-bezier(0.16,1,0.3,1)" }}>
      <Label color={labelColor}>{label}</Label>
      <h2 style={{ fontSize: "clamp(36px, 5vw, 56px)", fontWeight: 400, letterSpacing: "-0.03em", lineHeight: 1.1 }}>{heading}</h2>
      {sub && <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: "#52525b", maxWidth: 440, margin: "20px auto 0", lineHeight: 1.6 }}>{sub}</p>}
    </div>
  );
}

function RevealPills() {
  const [r, v] = useReveal();
  return (
    <div ref={r} style={{ padding: "40px 24px 80px", maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", opacity: v ? 1 : 0, transition: "all 1s ease" }}>
      {["React 18", "TypeScript", "FastAPI", "Tailwind", "Recharts", "shadcn/ui", "Three.js", "GPT-4o", "Claude 3.7", "Firebase"].map((t, i) => (
        <span key={i} style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: "#52525b", padding: "6px 16px", borderRadius: 9999, border: "1px solid rgba(255,255,255,0.06)", fontWeight: 500 }}>{t}</span>
      ))}
    </div>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [heroRef, heroVis] = useReveal(0.05);
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div style={{ background: "#09090b", color: "#fafafa", fontFamily: "'Instrument Serif', 'Playfair Display', Georgia, serif", minHeight: "100vh", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700;800;900&family=Instrument+Serif:ital@0;1&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}html{scroll-behavior:smooth}
        ::selection{background:rgba(255,138,76,0.3)}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,138,76,0.15);border-radius:10px}
        @keyframes orbFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
        @keyframes orbBreath{0%,100%{box-shadow:0 0 60px rgba(255,138,76,0.4),0 0 120px rgba(255,138,76,0.2),0 0 200px rgba(255,138,76,0.1)}50%{box-shadow:0 0 80px rgba(255,138,76,0.55),0 0 160px rgba(255,138,76,0.3),0 0 240px rgba(255,138,76,0.12)}}
        @keyframes orbRing{from{opacity:0.4}to{opacity:0.9}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(30px)}to{opacity:1;transform:translateY(0)}}
        @keyframes gradShift{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        @keyframes pulseBar{0%,100%{opacity:0.4}50%{opacity:1}}
        body{overflow-x:hidden}
      `}</style>

      <FluidCanvas />

      {/* ─── NAV ─── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, height: 64,
        display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 40px",
        background: scrollY > 60 ? "rgba(9,9,11,0.8)" : "transparent",
        backdropFilter: scrollY > 60 ? "blur(20px)" : "none",
        borderBottom: scrollY > 60 ? "1px solid rgba(255,255,255,0.06)" : "none",
        transition: "all 0.5s ease",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "radial-gradient(circle at 36% 36%, #FFB88C, #FF8A4C, #E85D04)", boxShadow: "0 0 12px rgba(255,138,76,0.4)" }} />
          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 800, letterSpacing: "-0.03em", color: "#fafafa" }}>
            Workforce<span style={{ color: "#FF8A4C" }}> IQ</span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {["platform", "features", "metrics", "team"].map(s => (
            <a key={s} href={`#${s}`} style={{ fontFamily: "'DM Sans',sans-serif", color: "#71717a", fontSize: 13, fontWeight: 500, textDecoration: "none", textTransform: "capitalize", letterSpacing: "0.02em", transition: "color 0.3s" }}
              onMouseEnter={e => e.target.style.color = "#fafafa"} onMouseLeave={e => e.target.style.color = "#71717a"}>{s}</a>
          ))}
          <a href="/app" onClick={(e: React.MouseEvent) => { e.preventDefault(); navigate('/app'); }} style={{
            fontFamily: "'DM Sans',sans-serif", padding: "8px 22px", borderRadius: 9999, background: "#FF8A4C", color: "#fff", fontSize: 13, fontWeight: 700, textDecoration: "none",
            boxShadow: "0 0 24px rgba(255,138,76,0.3)", transition: "all 0.3s",
          }} onMouseEnter={e => { e.target.style.transform = "scale(1.05)"; e.target.style.boxShadow = "0 0 36px rgba(255,138,76,0.5)"; }}
             onMouseLeave={e => { e.target.style.transform = "scale(1)"; e.target.style.boxShadow = "0 0 24px rgba(255,138,76,0.3)"; }}>
            Launch App
          </a>
        </div>
      </nav>

      {/* ─── CONTENT LAYER ─── */}
      <div style={{ position: "relative", zIndex: 1 }}>

        {/* ═══ HERO ═══ */}
        <section ref={heroRef} style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 24px", position: "relative" }}>
          <div style={{ opacity: heroVis ? 1 : 0, transform: heroVis ? "none" : "translateY(40px)", transition: "all 1.4s cubic-bezier(0.16,1,0.3,1)" }}>
            <Orb size={90} />
            <p style={{ fontFamily: "'DM Sans',sans-serif", marginTop: 48, color: "#FF8A4C", fontSize: 12, fontWeight: 700, letterSpacing: "0.2em" }}>NORTHEASTERN  ×  WORKHUMAN</p>
            <h1 style={{ marginTop: 20, fontSize: "clamp(52px, 8vw, 96px)", fontWeight: 400, letterSpacing: "-0.04em", lineHeight: 1.0 }}>
              Recognition<br />
              <em style={{
                fontStyle: "italic",
                background: "linear-gradient(135deg, #FF8A4C, #FFD4B8, #FF8A4C, #E85D04)",
                backgroundSize: "300% 300%", animation: "gradShift 5s ease infinite",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>Intelligence</em>
            </h1>
            <p style={{ fontFamily: "'DM Sans',sans-serif", marginTop: 28, fontSize: 17, color: "#a1a1aa", lineHeight: 1.75, maxWidth: 560, marginLeft: "auto", marginRight: "auto", fontWeight: 400 }}>
              Transform unanalyzed employee recognition messages into executive-grade behavioral analytics — powered by LLM taxonomy, NLP quality scoring, and social network analysis.
            </p>
            <div style={{ marginTop: 44, display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              <a href="/app" onClick={(e: React.MouseEvent) => { e.preventDefault(); navigate('/app'); }} style={{
                fontFamily: "'DM Sans',sans-serif", padding: "15px 40px", borderRadius: 9999, background: "#FF8A4C", color: "#fff", fontSize: 15, fontWeight: 700, textDecoration: "none",
                boxShadow: "0 0 40px rgba(255,138,76,0.35), 0 4px 16px rgba(0,0,0,0.3)", transition: "all 0.3s",
              }} onMouseEnter={e => { e.target.style.transform = "translateY(-3px)"; e.target.style.boxShadow = "0 0 56px rgba(255,138,76,0.5), 0 8px 32px rgba(0,0,0,0.4)"; }}
                 onMouseLeave={e => { e.target.style.transform = "translateY(0)"; e.target.style.boxShadow = "0 0 40px rgba(255,138,76,0.35), 0 4px 16px rgba(0,0,0,0.3)"; }}>
                Enter Platform →
              </a>
              <a href="https://github.com/vkinnnnn/HR-ANALYTICS" target="_blank" rel="noopener noreferrer" style={{
                fontFamily: "'DM Sans',sans-serif", padding: "15px 40px", borderRadius: 9999, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#a1a1aa", fontSize: 15, fontWeight: 500, textDecoration: "none", transition: "all 0.3s",
              }} onMouseEnter={e => { e.target.style.borderColor = "rgba(255,255,255,0.25)"; e.target.style.color = "#fafafa"; }}
                 onMouseLeave={e => { e.target.style.borderColor = "rgba(255,255,255,0.1)"; e.target.style.color = "#a1a1aa"; }}>
                View Source
              </a>
            </div>
          </div>
          {/* Scroll cue */}
          <div style={{ position: "absolute", bottom: 36, left: "50%", transform: "translateX(-50%)", opacity: 0.4 }}>
            <div style={{ width: 20, height: 34, borderRadius: 10, border: "1.5px solid rgba(255,255,255,0.25)", display: "flex", justifyContent: "center", paddingTop: 7 }}>
              <div style={{ width: 2.5, height: 7, borderRadius: 2, background: "#FF8A4C", animation: "orbFloat 2.5s ease-in-out infinite" }} />
            </div>
          </div>
        </section>

        {/* ═══ PLATFORM ═══ */}
        <section id="platform" style={{ padding: "160px 24px", maxWidth: 1100, margin: "0 auto" }}>
          <RevealHeading label="The Platform" heading={<>Bloomberg Terminal<br />for <em style={{ fontStyle: "italic" }}>People Data</em></>} sub="Companies collect thousands of recognition messages every quarter and leave them as unanalyzed text. We turn those messages into actionable intelligence." />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <Glass delay={0} style={{ gridRow: "1 / 3", padding: 36 }}>
              <Label>How It Works</Label>
              <div style={{ display: "flex", flexDirection: "column", gap: 32, marginTop: 8 }}>
                {[
                  { n: "01", t: "Ingest", d: "Upload raw recognition CSVs — messages, job titles, award metadata." },
                  { n: "02", t: "Classify", d: "LLM builds a behavioral taxonomy inductively. No predefined categories." },
                  { n: "03", t: "Enrich", d: "NLP extracts specificity, seniority, function, direction from every message." },
                  { n: "04", t: "Analyze", d: "73 KPIs across inequality, quality, networks, and fairness — computed instantly." },
                ].map((s, i) => (
                  <div key={i} style={{ display: "flex", gap: 16 }}>
                    <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 36, fontWeight: 900, color: "rgba(255,138,76,0.1)", lineHeight: 1, flexShrink: 0, width: 52 }}>{s.n}</span>
                    <div>
                      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 700, color: "#fafafa", marginBottom: 3 }}>{s.t}</div>
                      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "#52525b", lineHeight: 1.6 }}>{s.d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Glass>

            <Glass delay={150}>
              <Label color="#a78bfa">Taxonomy</Label>
              {[
                { cat: "Organizational & Team", pct: 49.4, col: "#FF8A4C" },
                { cat: "Operational Excellence", pct: 29.8, col: "#a78bfa" },
                { cat: "Strategic Outcomes", pct: 16.0, col: "#60a5fa" },
                { cat: "Creative & Brand", pct: 4.8, col: "#34d399" },
              ].map((c, i) => (
                <div key={i} style={{ marginTop: i === 0 ? 4 : 14 }}>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: "#71717a" }}>{c.cat}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: c.col }}>{c.pct}%</span>
                  </div>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.03)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${c.pct}%`, background: `linear-gradient(90deg, ${c.col}, ${c.col}80)`, borderRadius: 2, transition: "width 2s cubic-bezier(0.16,1,0.3,1)" }} />
                  </div>
                </div>
              ))}
            </Glass>

            <Glass delay={300}>
              <Label color="#fb7185">Key Insight</Label>
              <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 20, fontWeight: 800, color: "#fafafa", letterSpacing: "-0.02em", lineHeight: 1.35, marginTop: 4 }}>
                49.4% of recognition is<br />Team Enablement.
              </p>
              <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "#52525b", marginTop: 10, lineHeight: 1.6 }}>
                Innovation and Creative work are systematically under-recognized — a cultural blind spot most CHROs don't see.
              </p>
            </Glass>
          </div>
        </section>

        {/* ═══ FEATURES ═══ */}
        <section id="features" style={{ padding: "80px 24px 160px", maxWidth: 1100, margin: "0 auto" }}>
          <RevealHeading label="Capabilities" heading={<>Every Angle. Every <em style={{ fontStyle: "italic" }}>Signal.</em></>} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {FEATURES.map((f, i) => (
              <Glass key={i} delay={i * 80} style={{ padding: 28 }}>
                <span style={{ fontSize: 26, display: "block", marginBottom: 14, filter: `drop-shadow(0 0 10px ${f.col}50)`, color: f.col }}>{f.icon}</span>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 16, fontWeight: 700, color: "#fafafa", marginBottom: 8, letterSpacing: "-0.01em" }}>{f.title}</div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "#52525b", lineHeight: 1.65 }}>{f.desc}</div>
              </Glass>
            ))}
          </div>
        </section>

        {/* ═══ METRICS ═══ */}
        <section id="metrics" style={{ padding: "80px 24px 160px", maxWidth: 1100, margin: "0 auto" }}>
          <RevealHeading label="By The Numbers" heading={<>Data Speaks <em style={{ fontStyle: "italic" }}>Louder</em></>} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {[
              { v: 1000, l: "Recognition Awards", s: "", col: "#FF8A4C" },
              { v: 0.463, l: "Gini Inequality", s: "", col: "#a78bfa", d: 3 },
              { v: 69.6, l: "Zero Action Verbs", s: "%", col: "#fb7185" },
              { v: 40.2, l: "Cross-Function", s: "%", col: "#34d399" },
            ].map((m, i) => (
              <Glass key={i} delay={i * 100} style={{ textAlign: "center", padding: "44px 20px" }}>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 48, fontWeight: 900, letterSpacing: "-0.04em", color: m.col, lineHeight: 1 }}>
                  <Counter value={m.v} suffix={m.s} decimals={m.d || 0} />
                </div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#52525b", marginTop: 14, letterSpacing: "0.06em", textTransform: "uppercase" }}>{m.l}</div>
              </Glass>
            ))}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginTop: 14 }}>
            {[{ v: 314, l: "Unique Recipient Roles" }, { v: 25, l: "Behavioral Subcategories" }, { v: 91, l: "Reciprocal Pairs" }].map((m, i) => (
              <Glass key={i} delay={i * 100 + 400} style={{ textAlign: "center", padding: "32px 20px" }}>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 36, fontWeight: 800, color: "#fafafa", letterSpacing: "-0.03em" }}><Counter value={m.v} /></div>
                <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: "#52525b", marginTop: 10, letterSpacing: "0.06em", textTransform: "uppercase" }}>{m.l}</div>
              </Glass>
            ))}
          </div>
        </section>

        {/* ═══ TECH PILLS ═══ */}
        <RevealPills />

        {/* ═══ TEAM ═══ */}
        <section id="team" style={{ padding: "80px 24px 180px", maxWidth: 900, margin: "0 auto" }}>
          <RevealHeading label="The Team" heading={<>Built by Engineers,<br />for <em style={{ fontStyle: "italic" }}>HR Leaders</em></>} sub="Northeastern University MS Capstone (IE 7945) in partnership with Workhuman — Spring 2026" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {TEAM.map((m, i) => (
              <Glass key={i} delay={i * 140} style={{ textAlign: "center", padding: "44px 24px", borderRadius: 28 }}>
                <a href={m.li} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
                  <div style={{
                    width: 88, height: 88, borderRadius: "50%", margin: "0 auto 24px",
                    background: `radial-gradient(circle at 40% 40%, ${m.col}40, ${m.col}15)`,
                    border: `2px solid ${m.col}35`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: `0 0 30px ${m.col}15`,
                    transition: "all 0.5s ease",
                  }} onMouseEnter={e => { e.currentTarget.style.boxShadow = `0 0 50px ${m.col}30`; e.currentTarget.style.borderColor = `${m.col}70`; }}
                     onMouseLeave={e => { e.currentTarget.style.boxShadow = `0 0 30px ${m.col}15`; e.currentTarget.style.borderColor = `${m.col}35`; }}>
                    <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 22, fontWeight: 800, color: m.col }}>{m.init}</span>
                  </div>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 18, fontWeight: 700, color: "#fafafa" }}>{m.name}</div>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: "#52525b", marginTop: 6 }}>{m.role}</div>
                  <div style={{
                    fontFamily: "'DM Sans',sans-serif", marginTop: 18, display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "7px 16px", borderRadius: 9999, background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)", fontSize: 11, color: "#71717a", fontWeight: 500,
                    transition: "all 0.4s",
                  }} onMouseEnter={e => { e.currentTarget.style.borderColor = "#0A66C2"; e.currentTarget.style.color = "#0A66C2"; e.currentTarget.style.background = "rgba(10,102,194,0.08)"; }}
                     onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "#71717a"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                    LinkedIn
                  </div>
                </a>
              </Glass>
            ))}
          </div>
        </section>

        {/* ═══ FOOTER ═══ */}
        <footer style={{ padding: "32px 40px 48px", borderTop: "1px solid rgba(255,255,255,0.05)", position: "relative", zIndex: 1 }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            <div style={{ fontFamily: "'DM Sans',sans-serif", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", background: "radial-gradient(circle, #FF8A4C, #E85D04)", boxShadow: "0 0 8px rgba(255,138,76,0.3)" }} />
              <span style={{ color: "#52525b", fontSize: 12, fontWeight: 500 }}>Workforce IQ</span>
              <span style={{ color: "#3f3f46", fontSize: 11 }}>·  IE 7945 · Spring 2026</span>
            </div>
            <div style={{ fontFamily: "'DM Sans',sans-serif", display: "flex", gap: 20 }}>
              {[["Northeastern", "https://www.northeastern.edu"], ["Workhuman", "https://www.workhuman.com"], ["GitHub", "https://github.com/vkinnnnn/HR-ANALYTICS"]].map(([t, u]) => (
                <a key={t} href={u} target="_blank" rel="noopener noreferrer" style={{ color: "#3f3f46", fontSize: 12, textDecoration: "none", transition: "color 0.3s" }}
                  onMouseEnter={e => e.target.style.color = "#a1a1aa"} onMouseLeave={e => e.target.style.color = "#3f3f46"}>{t}</a>
              ))}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
