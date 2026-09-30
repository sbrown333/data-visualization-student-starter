// Subtle neoclassical bank building, used as a fixed page backdrop across
// the whole site. Pure SVG, no external assets. Sits behind all content at
// very low opacity so it adds atmosphere without ever competing with a
// chart's contrast or legibility.
export function BankBackdrop() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        pointerEvents: 'none',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg viewBox="0 0 1000 620" style={{ width: '85vw', maxWidth: 1400, height: 'auto', opacity: 0.05 }}>
        <line x1="0" y1="560" x2="1000" y2="560" stroke="#1e3a8a" strokeWidth="2" />

        {/* steps */}
        <polygon points="220,560 780,560 810,590 190,590" fill="#1e3a8a" />
        <polygon points="190,590 810,590 840,620 160,620" fill="#1e3a8a" />

        {/* base platform */}
        <rect x="230" y="530" width="540" height="30" fill="#1e3a8a" />

        {/* columns */}
        <g fill="#2563eb">
          {[255, 345, 435, 531, 621, 711].map((x) => (
            <rect key={x} x={x} y="230" width="34" height="300" />
          ))}
        </g>
        {/* column capitals */}
        <g fill="#1d4ed8">
          {[248, 338, 428, 524, 614, 704].map((x) => (
            <rect key={x} x={x} y="218" width="48" height="16" />
          ))}
        </g>

        {/* entablature */}
        <rect x="210" y="188" width="580" height="30" fill="#1e3a8a" />

        {/* pediment */}
        <polygon points="500,80 190,188 810,188" fill="#2563eb" />
        <polygon points="500,80 810,188 780,188" fill="#1e3a8a" opacity="0.4" />

        {/* emblem */}
        <circle cx="500" cy="150" r="26" fill="#f9fafb" opacity="0.9" />
        <circle cx="500" cy="150" r="26" fill="none" stroke="#1e3a8a" strokeWidth="3" />
        <circle cx="500" cy="150" r="5" fill="#1e3a8a" />
        <g stroke="#1e3a8a" strokeWidth="2.5">
          <line x1="500" y1="132" x2="500" y2="140" />
          <line x1="500" y1="160" x2="500" y2="168" />
          <line x1="482" y1="150" x2="490" y2="150" />
          <line x1="510" y1="150" x2="518" y2="150" />
          <line x1="487.3" y1="137.3" x2="493" y2="143" />
          <line x1="507" y1="157" x2="512.7" y2="162.7" />
          <line x1="512.7" y1="137.3" x2="507" y2="143" />
          <line x1="493" y1="157" x2="487.3" y2="162.7" />
        </g>
      </svg>
    </div>
  );
}
