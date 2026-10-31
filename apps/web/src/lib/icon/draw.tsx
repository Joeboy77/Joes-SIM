import { ImageResponse } from "next/og";

/**
 * The app icon, original to Joe's SIM: a wall of mailboxes with one lit up, the way the
 * simulator shows the instruction that is running. `padding` leaves room for maskable icons.
 */
export function drawIcon(size: number, padding = 0) {
  const inner = size - padding * 2;
  const cell = inner / 4.2;
  const gap = cell * 0.18;
  return new ImageResponse(
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#1d4ed8",
        borderRadius: padding ? 0 : size * 0.18,
      }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", width: cell * 3 + gap * 2, gap }}>
        {Array.from({ length: 9 }, (_, i) => (
          <div
            key={i}
            style={{
              width: cell,
              height: cell,
              borderRadius: cell * 0.18,
              background: i === 4 ? "#fbbf24" : "#ffffff",
              opacity: i === 4 ? 1 : 0.92,
            }}
          />
        ))}
      </div>
    </div>,
    { width: size, height: size },
  );
}
