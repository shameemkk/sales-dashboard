import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

export const runtime = "nodejs";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  const logoData = readFileSync(join(process.cwd(), "public/logo.jpg"));
  const base64 = logoData.toString("base64");

  return new ImageResponse(
    (
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "white",
        }}
      >
        <img
          src={`data:image/jpeg;base64,${base64}`}
          style={{ width: 32, height: 32, objectFit: "contain" }}
        />
      </div>
    ),
    { ...size }
  );
}
