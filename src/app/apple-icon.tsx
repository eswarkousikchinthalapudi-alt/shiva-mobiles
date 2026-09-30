import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon for phones ("Add to Home Screen"). */
export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#1F2A7C" }}>
      <div
        style={{
          width: 68,
          height: 112,
          borderRadius: 18,
          border: "11px solid #FFFFFF",
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "center",
          paddingBottom: 12,
        }}
      >
        <div style={{ width: 22, height: 22, borderRadius: 22, background: "#F5B301" }} />
      </div>
    </div>,
    size,
  );
}
