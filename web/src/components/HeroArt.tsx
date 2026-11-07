import { useId } from "react";

/**
 * Immersive animated hero visual for Industry & Technology pages.
 *
 * Pure SVG + SMIL. Two tones:
 *   - "dark"  (default): frameless, light strokes - designed to bleed into a
 *              deep-blue gradient hero (no card, no border, no "box").
 *   - "light": soft panel device on a white background (legacy).
 * On-brand: blues + a single cyan accent. Decorative only (aria-hidden).
 */

interface Palette {
  strong: string; mid: string; light: string; faint: string; pale: string;
  cyan: string; body: string; grid: string;
}
const LIGHT: Palette = {
  strong: "#0d9488", mid: "#14b8a6", light: "#2dd4bf", faint: "#99f6e4", pale: "#ccfbf1",
  cyan: "#06b6d4", body: "#ffffff", grid: "#d7f5ef",
};
const DARK: Palette = {
  strong: "#ccfbf1", mid: "#5eead4", light: "#2dd4bf", faint: "#0f766e", pale: "#115e59",
  cyan: "#3ee0ff", body: "#042f2e", grid: "#0f766e",
};

function Blip({ P, cx, cy, begin = "0s", r = 3 }: { P: Palette; cx: number; cy: number; begin?: string; r?: number }) {
  return (
    <circle cx={cx} cy={cy} r={r} fill={P.cyan}>
      <animate attributeName="opacity" values="0.2;1;0.2" dur="2.4s" begin={begin} repeatCount="indefinite" />
      <animate attributeName="r" values={`${r};${r + 1.4};${r}`} dur="2.4s" begin={begin} repeatCount="indefinite" />
    </circle>
  );
}

function Gear(P: Palette, cx: number, cy: number, r: number, teeth: number, dir: 1 | -1, dur: string) {
  return (
    <g>
      <animateTransform attributeName="transform" type="rotate" from={`0 ${cx} ${cy}`} to={`${dir * 360} ${cx} ${cy}`} dur={dur} repeatCount="indefinite" />
      {Array.from({ length: teeth }).map((_, i) => (
        <rect key={i} x={cx - 3.5} y={cy - r - 9} width="7" height="11" rx="1.5" fill={P.mid} transform={`rotate(${(i * 360) / teeth} ${cx} ${cy})`} />
      ))}
      <circle cx={cx} cy={cy} r={r} fill={P.body} stroke={P.strong} strokeWidth="2.5" />
      <circle cx={cx} cy={cy} r={r * 0.42} fill="none" stroke={P.faint} strokeWidth="2" />
    </g>
  );
}

function renderMotif(slug: string, uid: string, P: Palette) {
  switch (slug) {
    // ============ INDUSTRIES ============
    case "aerospace-defense":
      return (
        <g>
          {[38, 68, 98].map((r) => <circle key={r} cx="200" cy="150" r={r} fill="none" stroke={P.faint} strokeWidth="1.2" />)}
          <line x1="102" y1="150" x2="298" y2="150" stroke={P.pale} strokeWidth="1" />
          <line x1="200" y1="52" x2="200" y2="248" stroke={P.pale} strokeWidth="1" />
          <g>
            <animateTransform attributeName="transform" type="rotate" from="0 200 150" to="360 200 150" dur="4s" repeatCount="indefinite" />
            <path d="M200 150 L298 150 A98 98 0 0 0 262 74 Z" fill={P.strong} fillOpacity="0.14" />
            <line x1="200" y1="150" x2="298" y2="150" stroke={P.strong} strokeWidth="2" />
          </g>
          <path d="M232 108 l14 -5 -4 8 10 3 -11 3 3 8 -12 -6 -6 4 1 -8 z" fill={P.mid} transform="rotate(35 240 112)" />
          <Blip P={P} cx={160} cy={120} /><Blip P={P} cx={244} cy={196} begin="0.8s" /><Blip P={P} cx={150} cy={182} begin="1.6s" />
        </g>
      );
    case "automotive-ev":
      return (
        <g>
          <rect x="120" y="96" width="150" height="86" rx="12" fill="none" stroke={P.strong} strokeWidth="2.5" />
          <rect x="270" y="120" width="12" height="38" rx="4" fill={P.strong} />
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <rect x={134 + i * 34} y="110" width="24" height="58" rx="4" fill={P.pale} />
              <rect x={134 + i * 34} y="110" width="24" height="58" rx="4" fill={P.mid}>
                <animate attributeName="height" values="0;58;58;0" keyTimes="0;0.4;0.8;1" dur="4s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
                <animate attributeName="y" values="168;110;110;168" keyTimes="0;0.4;0.8;1" dur="4s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
              </rect>
            </g>
          ))}
          <path d="M196 108 l-16 34 h14 l-6 30 24 -40 h-14 z" fill={P.cyan} stroke={P.body} strokeWidth="1"><animate attributeName="opacity" values="0.35;1;0.35" dur="1.6s" repeatCount="indefinite" /></path>
          <path d="M110 214 q22 -16 44 0 t44 0 t44 0 t44 0" fill="none" stroke={P.faint} strokeWidth="2">
            <animate attributeName="d" values="M110 214 q22 -16 44 0 t44 0 t44 0 t44 0;M110 214 q22 16 44 0 t44 0 t44 0 t44 0;M110 214 q22 -16 44 0 t44 0 t44 0 t44 0" dur="3s" repeatCount="indefinite" />
          </path>
        </g>
      );
    case "medical-life-sciences":
      return (
        <g>
          <defs><path id={`ecg-${uid}`} d="M40 160 H108 l7 -11 l6 20 l9 -64 l9 82 l7 -27 H214 l7 -11 l6 20 l9 -64 l9 82 l7 -27 H360" /></defs>
          <use href={`#ecg-${uid}`} fill="none" stroke={P.pale} strokeWidth="2" />
          <use href={`#ecg-${uid}`} fill="none" stroke={P.strong} strokeWidth="2.5" strokeLinejoin="round" strokeDasharray="90 640"><animate attributeName="stroke-dashoffset" from="730" to="0" dur="2.6s" repeatCount="indefinite" /></use>
          <circle r="4.5" fill={P.cyan}><animateMotion dur="2.6s" repeatCount="indefinite"><mpath href={`#ecg-${uid}`} /></animateMotion></circle>
          <g transform="translate(300 96)"><g><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="9s" repeatCount="indefinite" />
            {[0, 60, 120, 180, 240, 300].map((a) => { const x = 24 * Math.cos((a * Math.PI) / 180); const y = 24 * Math.sin((a * Math.PI) / 180); return <g key={a}><line x1="0" y1="0" x2={x} y2={y} stroke={P.faint} strokeWidth="1.2" /><circle cx={x} cy={y} r="4" fill={P.mid} /></g>; })}
            <circle r="5" fill={P.strong} /></g></g>
        </g>
      );
    case "electronics-semiconductors":
      return (
        <g>
          <defs><path id={`t1-${uid}`} d="M60 90 H150 V150" /><path id={`t2-${uid}`} d="M60 210 H140 V170" /><path id={`t3-${uid}`} d="M340 100 H250 V140" /><path id={`t4-${uid}`} d="M340 200 H250 V160" /></defs>
          {[`t1-${uid}`, `t2-${uid}`, `t3-${uid}`, `t4-${uid}`].map((id) => <use key={id} href={`#${id}`} fill="none" stroke={P.faint} strokeWidth="2" />)}
          {[[60, 90], [60, 210], [340, 100], [340, 200]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="5" fill="none" stroke={P.mid} strokeWidth="2" />)}
          <rect x="160" y="120" width="80" height="60" rx="6" fill={P.body} stroke={P.strong} strokeWidth="2.5" />
          {[0, 1, 2, 3].map((i) => <g key={i}><line x1={172 + i * 18} y1="112" x2={172 + i * 18} y2="120" stroke={P.mid} strokeWidth="2" /><line x1={172 + i * 18} y1="180" x2={172 + i * 18} y2="188" stroke={P.mid} strokeWidth="2" /></g>)}
          <rect x="184" y="142" width="32" height="16" rx="2" fill={P.pale} />
          {[`t1-${uid}`, `t2-${uid}`, `t3-${uid}`, `t4-${uid}`].map((id, i) => <circle key={id} r="3.5" fill={P.cyan}><animateMotion dur="2.2s" begin={`${i * 0.5}s`} repeatCount="indefinite"><mpath href={`#${id}`} /></animateMotion></circle>)}
        </g>
      );
    case "energy-power":
      return (
        <g>
          <g transform="translate(112 108)"><g><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="14s" repeatCount="indefinite" />
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <line key={a} x1="0" y1="-30" x2="0" y2="-40" stroke={P.mid} strokeWidth="2.5" strokeLinecap="round" transform={`rotate(${a})`} />)}</g>
            <circle r="20" fill={P.pale} stroke={P.strong} strokeWidth="2" /></g>
          <g transform="translate(292 176)"><line x1="0" y1="0" x2="0" y2="62" stroke={P.faint} strokeWidth="3" />
            <g><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="3.2s" repeatCount="indefinite" />{[0, 120, 240].map((a) => <path key={a} d="M0 0 L6 -46 L-6 -46 Z" fill={P.strong} transform={`rotate(${a})`} />)}</g>
            <circle r="5" fill={P.mid} /></g>
          <path d="M50 250 q20 -20 40 0 t40 0 t40 0 t40 0 t40 0 t40 0" fill="none" stroke={P.faint} strokeWidth="2" />
          <circle r="4" fill={P.cyan}><animateMotion dur="2.4s" repeatCount="indefinite" path="M50 250 q20 -20 40 0 t40 0 t40 0 t40 0 t40 0 t40 0" /></circle>
        </g>
      );
    case "industrial-manufacturing":
      return (
        <g>
          {Gear(P, 158, 148, 42, 11, 1, "7s")}{Gear(P, 246, 132, 30, 8, -1, "5s")}
          <g stroke={P.light} strokeWidth="1.5"><line x1="120" y1="222" x2="288" y2="222" /><path d="M120 222 l10 -5 v10 z" fill={P.light} stroke="none" /><path d="M288 222 l-10 -5 v10 z" fill={P.light} stroke="none" /><line x1="120" y1="214" x2="120" y2="230" /><line x1="288" y1="214" x2="288" y2="230" /></g>
          <Blip P={P} cx={204} cy={222} />
        </g>
      );
    case "academia-research":
      return (
        <g transform="translate(200 150)">
          {[0, 60, 120].map((a) => <g key={a} transform={`rotate(${a})`}><ellipse rx="72" ry="28" fill="none" stroke={P.faint} strokeWidth="1.4" /><circle r="4.5" fill={P.mid}><animateMotion dur={`${4 + a / 60}s`} repeatCount="indefinite" path="M72 0 A72 28 0 1 1 -72 0 A72 28 0 1 1 72 0" /></circle></g>)}
          <circle r="8" fill={P.strong} />
          {[0, 1, 2].map((i) => <circle key={i} r="10" fill="none" stroke={P.cyan} strokeWidth="1.5"><animate attributeName="r" values="10;92" dur="3s" begin={`${i}s`} repeatCount="indefinite" /><animate attributeName="opacity" values="0.5;0" dur="3s" begin={`${i}s`} repeatCount="indefinite" /></circle>)}
        </g>
      );
    case "robotics-drones": {
      const motors: [number, number][] = [[150, 112], [250, 112], [150, 188], [250, 188]];
      return (
        <g>
          <g><animateTransform attributeName="transform" type="translate" values="0 -6;0 6;0 -6" dur="3.4s" repeatCount="indefinite" />
            <line x1="150" y1="112" x2="250" y2="188" stroke={P.faint} strokeWidth="6" strokeLinecap="round" /><line x1="250" y1="112" x2="150" y2="188" stroke={P.faint} strokeWidth="6" strokeLinecap="round" />
            <rect x="180" y="132" width="40" height="36" rx="8" fill={P.body} stroke={P.strong} strokeWidth="2.5" /><circle cx="200" cy="150" r="5" fill={P.cyan} />
            {motors.map(([x, y]) => <g key={`${x}-${y}`}><circle cx={x} cy={y} r="15" fill="none" stroke={P.mid} strokeWidth="2" /><g><animateTransform attributeName="transform" type="rotate" from={`0 ${x} ${y}`} to={`360 ${x} ${y}`} dur="0.5s" repeatCount="indefinite" /><ellipse cx={x} cy={y} rx="15" ry="3" fill={P.strong} fillOpacity="0.55" /><ellipse cx={x} cy={y} rx="3" ry="15" fill={P.strong} fillOpacity="0.55" /></g><circle cx={x} cy={y} r="3" fill={P.strong} /></g>)}</g>
          <ellipse cx="200" cy="250" rx="70" ry="14" fill="none" stroke={P.pale} strokeWidth="1.5" />
          <ellipse cx="200" cy="250" rx="10" ry="2" fill="none" stroke={P.cyan} strokeWidth="1.5"><animate attributeName="rx" values="10;70" dur="2.6s" repeatCount="indefinite" /><animate attributeName="ry" values="2;14" dur="2.6s" repeatCount="indefinite" /><animate attributeName="opacity" values="0.6;0" dur="2.6s" repeatCount="indefinite" /></ellipse>
        </g>
      );
    }

    // ============ TECHNOLOGIES ============
    case "precision-machining":
      return (
        <g>
          {Gear(P, 150, 150, 40, 10, 1, "6.5s")}{Gear(P, 236, 132, 28, 8, -1, "4.6s")}
          <path id={`tp-${uid}`} d="M96 232 h120 a16 16 0 0 0 16 -16 v-30" fill="none" stroke={P.faint} strokeWidth="1.5" strokeDasharray="4 4" />
          <g><animateMotion dur="3s" repeatCount="indefinite"><mpath href={`#tp-${uid}`} /></animateMotion><path d="M0 -8 L5 4 L-5 4 Z" fill={P.strong} /><circle r="2" cy="6" fill={P.cyan} /></g>
        </g>
      );
    case "additive-manufacturing":
      return (
        <g>
          <rect x="130" y="216" width="140" height="8" rx="2" fill={P.faint} />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <rect key={i} x={148} y={208 - i * 15} width="104" height="12" rx="2" fill={i % 2 ? P.mid : P.light}>
              <animate attributeName="opacity" values="0;0;1;1" keyTimes={`0;${i / 7};${(i + 0.5) / 7};1`} dur="4s" repeatCount="indefinite" />
              <animate attributeName="width" values="0;0;104;104" keyTimes={`0;${i / 7};${(i + 0.5) / 7};1`} dur="4s" repeatCount="indefinite" />
              <animate attributeName="x" values="200;200;148;148" keyTimes={`0;${i / 7};${(i + 0.5) / 7};1`} dur="4s" repeatCount="indefinite" />
            </rect>
          ))}
          <g><animateTransform attributeName="transform" type="translate" values="-46 0;46 0;-46 0" dur="1.4s" repeatCount="indefinite" />
            <rect x="192" y="70" width="16" height="26" rx="3" fill={P.strong} /><path d="M194 96 h12 l-6 12 z" fill={P.mid} /><circle cx="200" cy="112" r="2.5" fill={P.cyan} /></g>
          <line x1="120" y1="72" x2="280" y2="72" stroke={P.pale} strokeWidth="3" />
        </g>
      );
    case "microscopy-imaging":
      return (
        <g>
          <g transform="translate(200 84)"><rect x="-14" y="-30" width="28" height="40" rx="6" fill={P.body} stroke={P.strong} strokeWidth="2.5" /><path d="M-10 10 L10 10 L4 24 L-4 24 Z" fill={P.mid} /></g>
          <path d="M196 108 L188 150 M204 108 L212 150" stroke={P.cyan} strokeWidth="1.5" opacity="0.5"><animate attributeName="opacity" values="0.2;0.6;0.2" dur="2s" repeatCount="indefinite" /></path>
          <rect x="120" y="150" width="160" height="86" rx="8" fill="none" stroke={P.faint} strokeWidth="1.5" />
          {[150, 172, 194, 216].map((y) => <line key={y} x1="120" y1={y} x2="280" y2={y} stroke={P.pale} strokeWidth="1" opacity="0.5" />)}
          {[152, 184, 216, 248].map((x) => <line key={x} x1={x} y1="150" x2={x} y2="236" stroke={P.pale} strokeWidth="1" opacity="0.5" />)}
          <line x1="120" x2="280" stroke={P.strong} strokeWidth="2"><animate attributeName="y1" values="152;234;152" dur="3s" repeatCount="indefinite" /><animate attributeName="y2" values="152;234;152" dur="3s" repeatCount="indefinite" /></line>
          {[0, 1].map((i) => <circle key={i} cx="200" cy="193" r="8" fill="none" stroke={P.cyan} strokeWidth="1.5"><animate attributeName="r" values="8;40" dur="2.6s" begin={`${i * 1.3}s`} repeatCount="indefinite" /><animate attributeName="opacity" values="0.6;0" dur="2.6s" begin={`${i * 1.3}s`} repeatCount="indefinite" /></circle>)}
        </g>
      );
    case "materials-characterization": {
      const peaks = [[70, 40], [110, 70], [150, 26], [190, 90], [230, 50], [270, 34], [310, 62]];
      return (
        <g>
          <g transform="translate(0 60)">
            {[0, 1, 2].map((i) => <circle key={i} cx="70" cy="70" r="8" fill="none" stroke={P.faint} strokeWidth="1.4"><animate attributeName="r" values="8;54" dur="3s" begin={`${i}s`} repeatCount="indefinite" /><animate attributeName="opacity" values="0.6;0" dur="3s" begin={`${i}s`} repeatCount="indefinite" /></circle>)}
            <circle cx="70" cy="70" r="6" fill={P.strong} />
          </g>
          <line x1="56" y1="228" x2="330" y2="228" stroke={P.pale} strokeWidth="1.5" />
          {peaks.map(([x, h], i) => (
            <line key={i} x1={x} y1="228" x2={x} y2={228 - h} stroke={P.mid} strokeWidth="3" strokeLinecap="round">
              <animate attributeName="y2" values={`228;${228 - h};${228 - h}`} keyTimes="0;0.5;1" dur="3s" begin={`${i * 0.12}s`} repeatCount="indefinite" />
            </line>
          ))}
          <circle r="3.5" fill={P.cyan}><animateMotion dur="3s" repeatCount="indefinite" path="M56 228 L330 228" /></circle>
        </g>
      );
    }
    case "mechanical-testing":
      return (
        <g>
          <rect x="150" y="228" width="100" height="12" rx="3" fill={P.faint} />
          <g><animateTransform attributeName="transform" type="translate" values="0 0;0 -14;0 0" dur="2.6s" repeatCount="indefinite" />
            <rect x="150" y="70" width="100" height="12" rx="3" fill={P.faint} />
            <path d="M188 82 h24 v40 l-10 12 v20 l10 12 v40 h-24 v-40 l10 -12 v-20 l-10 -12 z" fill={P.body} stroke={P.strong} strokeWidth="2.5" />
          </g>
          <path id={`ss-${uid}`} d="M286 232 q18 -6 30 -40 t22 -70" fill="none" stroke={P.faint} strokeWidth="2" />
          <path d="M286 232 q18 -6 30 -40 t22 -70" fill="none" stroke={P.strong} strokeWidth="2.5" strokeDasharray="120 200"><animate attributeName="stroke-dashoffset" from="120" to="-200" dur="3s" repeatCount="indefinite" /></path>
          <circle r="4" fill={P.cyan}><animateMotion dur="3s" repeatCount="indefinite"><mpath href={`#ss-${uid}`} /></animateMotion></circle>
        </g>
      );
    case "chemical-molecular":
      return (
        <g>
          <g transform="translate(150 130)"><g><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="10s" repeatCount="indefinite" />
            {[0, 60, 120, 180, 240, 300].map((a) => { const x = 40 * Math.cos((a * Math.PI) / 180); const y = 40 * Math.sin((a * Math.PI) / 180); return <g key={a}><line x1="0" y1="0" x2={x} y2={y} stroke={P.faint} strokeWidth="1.3" /><circle cx={x} cy={y} r="6" fill={a % 120 === 0 ? P.strong : P.mid} /></g>; })}
            <circle r="7" fill={P.strong} /></g></g>
          <path id={`wv-${uid}`} d="M60 232 q16 -30 32 0 t32 0 q10 -50 20 0 t30 0 t32 0 t32 0" fill="none" stroke={P.faint} strokeWidth="2" />
          <path d="M60 232 q16 -30 32 0 t32 0 q10 -50 20 0 t30 0 t32 0 t32 0" fill="none" stroke={P.strong} strokeWidth="2.5" strokeDasharray="70 400"><animate attributeName="stroke-dashoffset" from="470" to="0" dur="3s" repeatCount="indefinite" /></path>
          <circle r="3.5" fill={P.cyan}><animateMotion dur="3s" repeatCount="indefinite"><mpath href={`#wv-${uid}`} /></animateMotion></circle>
        </g>
      );

    default:
      return <g transform="translate(200 150)">{[0, 60, 120].map((a) => <g key={a} transform={`rotate(${a})`}><ellipse rx="70" ry="26" fill="none" stroke={P.faint} strokeWidth="1.4" /><circle cx="70" r="4" fill={P.mid} /></g>)}<circle r="7" fill={P.strong} /></g>;
  }
}

export default function HeroArt({ slug, className, tone = "dark" }: { slug: string; className?: string; tone?: "light" | "dark" }) {
  const uid = useId().replace(/[:]/g, "");
  const P = tone === "dark" ? DARK : LIGHT;

  return (
    <div className={className}>
      <svg viewBox="0 0 400 300" className="w-full" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
        <defs>
          <radialGradient id={`glow-${uid}`} cx="0.5" cy="0.46" r="0.55">
            <stop offset="0" stopColor={P.cyan} stopOpacity={tone === "dark" ? "0.12" : "0.14"} />
            <stop offset="1" stopColor={P.cyan} stopOpacity="0" />
          </radialGradient>
          {tone === "light" && (
            <>
              <linearGradient id={`panel-${uid}`} x1="0" y1="0" x2="0.4" y2="1">
                <stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#eef2ff" />
              </linearGradient>
              <pattern id={`grid-${uid}`} width="26" height="26" patternUnits="userSpaceOnUse">
                <circle cx="1.4" cy="1.4" r="1.4" fill={P.grid} />
              </pattern>
            </>
          )}
        </defs>

        {tone === "light" && (
          <>
            <rect x="4" y="4" width="392" height="292" rx="26" fill={`url(#panel-${uid})`} stroke="#e6ebf9" />
            <rect x="4" y="4" width="392" height="292" rx="26" fill={`url(#grid-${uid})`} opacity="0.7" />
          </>
        )}
        <circle cx="200" cy="146" r="150" fill={`url(#glow-${uid})`} />

        {/* drifting particles */}
        {[[54, 70, "0s"], [350, 96, "1.1s"], [330, 232, "2.2s"], [70, 224, "0.6s"]].map(([x, y, b], i) => (
          <circle key={i} cx={x as number} cy={y as number} r="2.6" fill={P.cyan} opacity="0.5">
            <animate attributeName="cy" values={`${y};${(y as number) - 10};${y}`} dur="6s" begin={b as string} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.12;0.55;0.12" dur="6s" begin={b as string} repeatCount="indefinite" />
          </circle>
        ))}

        {renderMotif(slug, uid, P)}
      </svg>
    </div>
  );
}
