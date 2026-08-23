import mapData from "./rajasthanSvgData.json";

// Major Field Operations Hubs in Rajasthan with coordinates
const FIELD_HUBS = [
  { name: "Jaipur", x: 575, y: 310 },
  { name: "Jodhpur", x: 330, y: 395 },
  { name: "Udaipur", x: 385, y: 585 },
  { name: "Kota", x: 580, y: 510 },
  { name: "Bikaner", x: 345, y: 220 },
  { name: "Ajmer", x: 470, y: 390 },
  { name: "Alwar", x: 655, y: 255 },
  { name: "Sikar", x: 520, y: 245 },
  { name: "Bhilwara", x: 475, y: 490 },
  { name: "Sri Ganganagar", x: 430, y: 75 },
  { name: "Barmer", x: 210, y: 485 },
  { name: "Jaisalmer", x: 140, y: 360 },
];

export default function RajasthanMapBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden flex items-center justify-center select-none z-0">
      <svg
        viewBox={`0 0 ${mapData.width} ${mapData.height}`}
        className="w-[96vw] max-w-[1300px] h-auto max-h-[92vh] opacity-[0.85] transition-all duration-700"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* District Boundaries with High-Contrast Fill */}
        <g stroke="#4338CA" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
          {mapData.paths.map((district, idx) => (
            <path
              key={district.name || idx}
              d={district.d}
              fill="url(#rajasthanFillGrad)"
              strokeOpacity="0.75"
              className="transition-colors hover:fill-[#DEE1FF]"
            />
          ))}
        </g>

        {/* Dynamic High-Legibility Gradient for Rajasthan State */}
        <defs>
          <linearGradient id="rajasthanFillGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#EEF2FF" stopOpacity="0.7" />
            <stop offset="50%" stopColor="#E0E7FF" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#E0F2FE" stopOpacity="0.65" />
          </linearGradient>
        </defs>

        {/* Connected Field Ops Route Lines Across Rajasthan */}
        <g stroke="#4338CA" strokeWidth="2.2" strokeDasharray="5 5" strokeOpacity="0.85">
          <line x1="575" y1="310" x2="470" y2="390" /> {/* Jaipur -> Ajmer */}
          <line x1="470" y1="390" x2="330" y2="395" /> {/* Ajmer -> Jodhpur */}
          <line x1="330" y1="395" x2="140" y2="360" /> {/* Jodhpur -> Jaisalmer */}
          <line x1="330" y1="395" x2="210" y2="485" /> {/* Jodhpur -> Barmer */}
          <line x1="470" y1="390" x2="475" y2="490" /> {/* Ajmer -> Bhilwara */}
          <line x1="475" y1="490" x2="385" y2="585" /> {/* Bhilwara -> Udaipur */}
          <line x1="475" y1="490" x2="580" y2="510" /> {/* Bhilwara -> Kota */}
          <line x1="575" y1="310" x2="520" y2="245" /> {/* Jaipur -> Sikar */}
          <line x1="520" y1="245" x2="345" y2="220" /> {/* Sikar -> Bikaner */}
          <line x1="345" y1="220" x2="430" y2="75" />  {/* Bikaner -> Sri Ganganagar */}
          <line x1="575" y1="310" x2="655" y2="255" /> {/* Jaipur -> Alwar */}
        </g>

        {/* Pulsating Field Hub Nodes with City Badges */}
        {FIELD_HUBS.map((hub) => (
          <g key={hub.name} transform={`translate(${hub.x}, ${hub.y})`}>
            {/* Glowing Outer Ripple */}
            <circle r="12" fill="#4338CA" opacity="0.35" className="animate-ping" />
            {/* Core Node */}
            <circle r="5" fill="#4338CA" />
            <circle r="2.2" fill="#FFFFFF" />
            {/* City Label Badge */}
            <rect
              x="9"
              y="-8"
              width={hub.name.length * 6.8 + 10}
              height="16"
              rx="4"
              fill="#FFFFFF"
              fillOpacity="0.95"
              stroke="#4338CA"
              strokeWidth="1"
              strokeOpacity="0.6"
            />
            <text
              x="14"
              y="3.5"
              fill="#1E1B4B"
              fontSize="9"
              fontFamily="'IBM Plex Mono', monospace"
              fontWeight="700"
              letterSpacing="0.05em"
            >
              {hub.name.toUpperCase()}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
