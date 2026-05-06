import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 320,
          background: "linear-gradient(135deg, #2563eb 0%, #db2777 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontWeight: 800,
          letterSpacing: -10,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        SB
      </div>
    ),
    { width: 512, height: 512 }
  );
}
