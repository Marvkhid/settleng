import { cn } from "@/lib/utils";

/**
 * Lightweight inline SVG illustrations for the landing page. Each paints a scene from a small
 * Nigerian business's day — a market stall, a wallet of naira, an invoice with a debt, a rising
 * chart — so visitors see what SettleNG is about before reading a word. They inherit the palette
 * and scale fluidly, so they stay crisp on any screen.
 */

const E = "#0f9d6e"; // emerald
const EDEEP = "#086443";
const INK = "#0f1b33";
const PAPER = "#faf8f4";
const SAND = "#f3f0e9";
const AMBER = "#f0b429";

type P = { className?: string };

/** A market stall under an awning, with crates of goods — the shop SettleNG is built for. */
export function StallIllustration({ className }: P) {
  return (
    <svg viewBox="0 0 320 240" role="img" aria-label="Illustration of a small market stall" className={cn("h-auto w-full", className)}>
      <defs>
        <linearGradient id="stall-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e4f4ed" />
          <stop offset="1" stopColor={PAPER} />
        </linearGradient>
      </defs>
      <rect width="320" height="240" rx="24" fill="url(#stall-sky)" />
      {/* awning */}
      <path d="M40 78 L160 40 L280 78 L280 96 L40 96 Z" fill={E} />
      <path d="M40 96 h240 v10 H40 Z" fill={EDEEP} />
      {[...Array(6)].map((_, i) => (
        <path key={i} d={`M${40 + i * 40} 78 l20 -12 l20 12 Z`} fill={i % 2 ? PAPER : "#ffffff"} opacity="0.9" />
      ))}
      {/* posts */}
      <rect x="52" y="96" width="8" height="104" fill={INK} opacity="0.85" />
      <rect x="260" y="96" width="8" height="104" fill={INK} opacity="0.85" />
      {/* counter */}
      <rect x="60" y="150" width="200" height="16" rx="4" fill={INK} />
      {/* crates */}
      <rect x="74" y="166" width="56" height="38" rx="6" fill={AMBER} />
      <rect x="136" y="166" width="56" height="38" rx="6" fill={E} />
      <rect x="198" y="166" width="52" height="38" rx="6" fill="#b83227" opacity="0.85" />
      {/* goods on counter */}
      <circle cx="92" cy="140" r="9" fill={AMBER} />
      <circle cx="112" cy="140" r="9" fill="#e8663d" />
      <rect x="150" y="128" width="22" height="22" rx="4" fill={E} />
      <rect x="182" y="132" width="18" height="18" rx="3" fill={AMBER} />
      {/* ground */}
      <rect x="0" y="204" width="320" height="36" fill={SAND} />
    </svg>
  );
}

/** A wallet spilling naira notes — money coming in and going out, tracked. */
export function NairaIllustration({ className }: P) {
  return (
    <svg viewBox="0 0 320 240" role="img" aria-label="Illustration of a wallet with naira notes" className={cn("h-auto w-full", className)}>
      <defs>
        <linearGradient id="wal-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e4f4ed" />
          <stop offset="1" stopColor={PAPER} />
        </linearGradient>
      </defs>
      <rect width="320" height="240" rx="24" fill="url(#wal-bg)" />
      {/* flying notes */}
      <g className="float">
        <rect x="52" y="40" width="70" height="40" rx="6" fill="#ffffff" stroke={E} strokeWidth="3" transform="rotate(-12 87 60)" />
        <text x="87" y="66" textAnchor="middle" fontFamily="inherit" fontWeight="800" fontSize="20" fill={EDEEP} transform="rotate(-12 87 60)">₦</text>
      </g>
      <g className="float-slow">
        <rect x="196" y="30" width="70" height="40" rx="6" fill="#ffffff" stroke={E} strokeWidth="3" transform="rotate(10 231 50)" />
        <text x="231" y="56" textAnchor="middle" fontWeight="800" fontSize="20" fill={EDEEP} transform="rotate(10 231 50)">₦</text>
      </g>
      {/* wallet body */}
      <rect x="70" y="120" width="180" height="96" rx="16" fill={INK} />
      <rect x="70" y="150" width="180" height="16" fill={EDEEP} opacity="0.5" />
      <rect x="188" y="146" width="66" height="34" rx="10" fill={E} />
      <circle cx="214" cy="163" r="7" fill={PAPER} />
      {/* notes peeking out */}
      <rect x="92" y="104" width="86" height="30" rx="5" fill="#ffffff" stroke={E} strokeWidth="3" />
      <text x="135" y="126" textAnchor="middle" fontWeight="800" fontSize="18" fill={EDEEP}>₦</text>
    </svg>
  );
}

/** An invoice document with a red overdue tag and a checkmark paid stamp. */
export function InvoiceIllustration({ className }: P) {
  return (
    <svg viewBox="0 0 320 240" role="img" aria-label="Illustration of an invoice with a paid stamp" className={cn("h-auto w-full", className)}>
      <defs>
        <linearGradient id="inv-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbf0dc" />
          <stop offset="1" stopColor={PAPER} />
        </linearGradient>
      </defs>
      <rect width="320" height="240" rx="24" fill="url(#inv-bg)" />
      {/* paper */}
      <rect x="86" y="34" width="148" height="176" rx="10" fill="#ffffff" stroke={INK} strokeWidth="2" />
      <rect x="104" y="56" width="70" height="12" rx="3" fill={INK} />
      <rect x="104" y="78" width="112" height="8" rx="3" fill={SAND} />
      <rect x="104" y="94" width="112" height="8" rx="3" fill={SAND} />
      <rect x="104" y="110" width="88" height="8" rx="3" fill={SAND} />
      <line x1="104" y1="132" x2="216" y2="132" stroke={INK} strokeWidth="1.5" opacity="0.3" />
      <rect x="104" y="144" width="52" height="10" rx="3" fill={E} />
      <rect x="164" y="144" width="52" height="10" rx="3" fill={INK} opacity="0.7" />
      {/* paid stamp */}
      <g transform="rotate(-14 210 176)">
        <rect x="170" y="158" width="86" height="34" rx="8" fill={E} opacity="0.92" />
        <text x="213" y="181" textAnchor="middle" fontWeight="800" fontSize="17" fill={PAPER} letterSpacing="1">PAID</text>
      </g>
      {/* coin */}
      <circle cx="70" cy="180" r="22" fill={AMBER} stroke={EDEEP} strokeWidth="3" />
      <text x="70" y="188" textAnchor="middle" fontWeight="800" fontSize="22" fill={EDEEP}>₦</text>
    </svg>
  );
}

/** A rising bar chart with an upward arrow — simple reporting at a glance. */
export function ChartIllustration({ className }: P) {
  const bars = [
    { x: 40, h: 54, c: "#b9dcd0" },
    { x: 92, h: 82, c: "#8fc9b4" },
    { x: 144, h: 116, c: E },
    { x: 196, h: 96, c: "#8fc9b4" },
    { x: 248, h: 150, c: EDEEP },
  ];
  return (
    <svg viewBox="0 0 320 240" role="img" aria-label="Illustration of a rising sales chart" className={cn("h-auto w-full", className)}>
      <defs>
        <linearGradient id="chart-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e4f4ed" />
          <stop offset="1" stopColor={PAPER} />
        </linearGradient>
      </defs>
      <rect width="320" height="240" rx="24" fill="url(#chart-bg)" />
      <line x1="36" y1="200" x2="288" y2="200" stroke={INK} strokeWidth="2" opacity="0.25" />
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={200 - b.h} width="34" height={b.h} rx="8" fill={b.c} className="origin-bottom" style={{ transformBox: "fill-box", animation: `bar-grow 0.8s cubic-bezier(0.22,1,0.36,1) ${0.1 * i}s both` }} />
      ))}
      {/* trend arrow */}
      <path d="M44 150 L110 118 L168 138 L262 62" fill="none" stroke={AMBER} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M244 58 L266 58 L266 80" fill="none" stroke={AMBER} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="168" cy="138" r="6" fill="#ffffff" stroke={AMBER} strokeWidth="3" />
    </svg>
  );
}

/** Two overlapping receipts with a checkmark — reconciled records. */
export function ReceiptsIllustration({ className }: P) {
  return (
    <svg viewBox="0 0 320 240" role="img" aria-label="Illustration of two matching receipts" className={cn("h-auto w-full", className)}>
      <defs>
        <linearGradient id="rec-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e4f4ed" />
          <stop offset="1" stopColor={PAPER} />
        </linearGradient>
      </defs>
      <rect width="320" height="240" rx="24" fill="url(#rec-bg)" />
      {/* back receipt */}
      <g transform="rotate(-8 120 120)">
        <rect x="70" y="54" width="104" height="150" rx="8" fill="#ffffff" stroke={INK} strokeWidth="2" />
        {[0, 1, 2, 3].map((i) => <rect key={i} x="86" y={82 + i * 22} width="72" height="8" rx="3" fill={SAND} />)}
      </g>
      {/* front receipt */}
      <g transform="rotate(7 200 128)">
        <rect x="150" y="66" width="104" height="150" rx="8" fill="#ffffff" stroke={E} strokeWidth="2.5" />
        {[0, 1, 2, 3].map((i) => <rect key={i} x="166" y={94 + i * 22} width="72" height="8" rx="3" fill={i === 0 ? E : SAND} opacity={i === 0 ? 0.5 : 1} />)}
      </g>
      {/* check badge */}
      <circle cx="238" cy="176" r="26" fill={E} />
      <path d="M226 176 l8 8 l16 -18" fill="none" stroke={PAPER} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
