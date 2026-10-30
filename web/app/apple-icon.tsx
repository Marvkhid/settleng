import { ImageResponse } from "next/og";

/** iOS "add to home screen" icon. iOS applies its own mask, so this is full-bleed. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";
export const alt = "SettleNG";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#086443",
          color: "#ffffff",
          fontSize: 122,
          fontWeight: 700,
          letterSpacing: -6,
          paddingBottom: 8,
        }}
      >
        S
      </div>
    ),
    { ...size },
  );
}
