import { ImageResponse } from "next/og";
import { SITE_NAME, SITE_URL } from "@/lib/site";

/** The card WhatsApp, X, LinkedIn and Slack show when the site is shared. */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${SITE_NAME} — free money tracking for Nigerian traders and small businesses`;

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0f1b33",
          padding: 64,
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -160,
            right: -120,
            width: 560,
            height: 560,
            borderRadius: 560,
            background: "rgba(47,191,139,0.22)",
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div
            style={{
              width: 96,
              height: 96,
              borderRadius: 24,
              background: "#086443",
              border: "4px solid rgba(15,157,110,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontSize: 62,
              fontWeight: 700,
            }}
          >
            S
          </div>
          <div style={{ display: "flex", color: "#ffffff", fontSize: 54, fontWeight: 700, letterSpacing: -1.5 }}>
            Settle<span style={{ color: "#2fbf8b" }}>NG</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", color: "#ffffff", fontSize: 66, fontWeight: 700, lineHeight: 1.1, letterSpacing: -2, maxWidth: 900 }}>
            Know where your money actually goes.
          </div>
          <div style={{ display: "flex", marginTop: 24, color: "rgba(255,255,255,0.72)", fontSize: 32, maxWidth: 880 }}>
            Sales, expenses and customer debts for Nigerian traders — free, no card, no bank connection.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "2px solid rgba(255,255,255,0.14)", paddingTop: 26 }}>
          <div style={{ display: "flex", color: "rgba(255,255,255,0.6)", fontSize: 26 }}>{SITE_URL.replace(/^https?:\/\//, "")}</div>
          <div style={{ display: "flex", color: "#2fbf8b", fontSize: 26, fontWeight: 600 }}>Free for small businesses</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
