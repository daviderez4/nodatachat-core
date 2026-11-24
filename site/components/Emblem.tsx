// The mark of the 10 principles: ten numbered points on a ring, around a shield
// holding a key ("possession is not access"). One simple drawing, used wherever the
// principles appear: the homepage, the consent window, the principles page, the nav.
export function Emblem({ size = 120, dark = false, label = "The 10 principles" }: { size?: number; dark?: boolean; label?: string }) {
  const ink = dark ? "#E8ECEF" : "#0D0F12";
  const ring = dark ? "#2DD4BF" : "#0B7A6E";
  // Small marks (the nav, the consent window) drop the numbers: ten points still read, digits would not.
  const small = size < 80;
  const dots = Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    return { x: 60 + Math.cos(a) * 46, y: 60 + Math.sin(a) * 46, n: i + 1 };
  });
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-label={label}>
      <circle cx="60" cy="60" r="46" fill="none" stroke={ring} strokeWidth="1.5" strokeDasharray="2 4" />
      {dots.map((d) => (
        <g key={d.n}>
          <circle cx={d.x} cy={d.y} r={small ? 6.5 : 9} fill={d.n === 7 ? ring : dark ? "#0F1418" : "#FFFFFF"} stroke={ring} strokeWidth="1.5" />
          {small ? null : <text x={d.x} y={d.y + 3.4} textAnchor="middle" fontSize="9.5" fontWeight="700" fontFamily="ui-monospace, monospace" fill={d.n === 7 ? (dark ? "#042F2A" : "#FFFFFF") : ink}>
            {d.n}
          </text>}
        </g>
      ))}
      {/* the shield */}
      <path d="M60 36l17 6v12c0 11-7.5 19-17 23-9.5-4-17-12-17-23V42z" fill={dark ? "#0E1A19" : "#F3FBFA"} stroke={ink} strokeWidth="2" strokeLinejoin="round" />
      {/* the key inside it */}
      <circle cx="55" cy="55" r="5" fill="none" stroke={ring} strokeWidth="2.2" />
      <path d="M59 58.5l9 9M64.5 64l2.5-2.5M67 66.5l2.5-2.5" stroke={ring} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
