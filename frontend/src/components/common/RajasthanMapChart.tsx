import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  MapPin, 
  Users, 
  AlertTriangle, 
  Search, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Layers, 
  DollarSign, 
  Sparkles, 
  Info, 
  X, 
  ChevronRight,
  ShieldCheck,
  BarChart3,
  Globe
} from "lucide-react";
import { Card, Badge } from "antd";

interface ExpenseRecord {
  id?: string | number;
  amount?: number;
  status?: string;
  district?: string;
  submitter_district?: string;
  home_district?: string;
  submitter_name?: string;
  user_name?: string;
  category?: string;
  nature?: string;
  date?: string;
  [key: string]: any;
}

interface GeoFeature {
  type: string;
  properties: {
    dt_code?: string;
    district?: string;
    dt_nm?: string;
    st_code?: string;
    st_nm?: string;
    [key: string]: any;
  };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: any[];
  };
}

interface GeoJSONData {
  type: string;
  features: GeoFeature[];
}

interface RajasthanMapChartProps {
  expenses: ExpenseRecord[];
  onSelectDistrict?: (districtName: string | null) => void;
  selectedDistrictFilter?: string | null;
}

type MetricType = "amount" | "count" | "approvalRate" | "engineers";

// Standardize district name matching
const normalizeDistrict = (name?: string): string => {
  if (!name) return "";
  const cleaned = name.trim().toLowerCase().replace(/^(sri|shri)\s+|^sri-/, "");
  if (cleaned.includes("ganganagar")) return "Ganganagar";
  if (cleaned.includes("madhopur")) return "Sawai Madhopur";
  if (cleaned.includes("chittor")) return "Chittorgarh";
  if (cleaned.includes("jhunjh")) return "Jhunjhunu";
  if (cleaned.includes("jaisal")) return "Jaisalmer";
  if (cleaned.includes("bharat")) return "Bharatpur";
  if (cleaned.includes("dungar")) return "Dungarpur";
  if (cleaned.includes("bansw")) return "Banswara";
  if (cleaned.includes("rajsam")) return "Rajsamand";
  if (cleaned.includes("hanuman")) return "Hanumangarh";
  if (cleaned.includes("pratap")) return "Pratapgarh";
  if (cleaned.includes("jhalaw")) return "Jhalawar";
  if (cleaned.includes("jaipur")) return "Jaipur";
  if (cleaned.includes("jodhpur")) return "Jodhpur";
  if (cleaned.includes("udaipur")) return "Udaipur";
  if (cleaned.includes("kota")) return "Kota";
  if (cleaned.includes("bikaner")) return "Bikaner";
  if (cleaned.includes("churu")) return "Churu";
  if (cleaned.includes("alwar")) return "Alwar";
  if (cleaned.includes("sikar")) return "Sikar";
  if (cleaned.includes("ajmer")) return "Ajmer";
  if (cleaned.includes("pali")) return "Pali";
  if (cleaned.includes("nagaur")) return "Nagaur";
  if (cleaned.includes("bhilwara")) return "Bhilwara";
  if (cleaned.includes("barmer")) return "Barmer";
  if (cleaned.includes("jalore")) return "Jalore";
  if (cleaned.includes("sirohi")) return "Sirohi";
  if (cleaned.includes("bundi")) return "Bundi";
  if (cleaned.includes("baran")) return "Baran";
  if (cleaned.includes("tonk")) return "Tonk";
  if (cleaned.includes("dausa")) return "Dausa";
  if (cleaned.includes("karauli")) return "Karauli";
  if (cleaned.includes("dholpur")) return "Dholpur";
  return name.trim();
};

export const RajasthanMapChart: React.FC<RajasthanMapChartProps> = ({
  expenses = [],
  onSelectDistrict,
  selectedDistrictFilter = null
}) => {
  const [geoData, setGeoData] = useState<GeoJSONData | null>(null);
  const [loadingMap, setLoadingMap] = useState<boolean>(true);
  const [errorMap, setErrorMap] = useState<string | null>(null);
  const [activeMetric, setActiveMetric] = useState<MetricType>("amount");
  const [hoveredDistrict, setHoveredDistrict] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(selectedDistrictFilter);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const svgRef = useRef<SVGSVGElement | null>(null);

  // Sync prop filter with internal state
  useEffect(() => {
    setSelectedDistrict(selectedDistrictFilter);
  }, [selectedDistrictFilter]);

  // Load GeoJSON map
  useEffect(() => {
    let isMounted = true;
    setLoadingMap(true);
    fetch("/map.geojson")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load map data");
        return res.json();
      })
      .then((data) => {
        if (isMounted) {
          setGeoData(data);
          setLoadingMap(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setErrorMap(err.message || "Error loading GeoJSON map");
          setLoadingMap(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, []);

  // Compute bounding box for projection
  const bounds = useMemo(() => {
    if (!geoData || !geoData.features || geoData.features.length === 0) {
      return { minLng: 69.5, maxLng: 78.5, minLat: 23.0, maxLat: 30.5 };
    }

    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    const processCoord = (lng: number, lat: number) => {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    };

    geoData.features.forEach((feature) => {
      const { type, coordinates } = feature.geometry;
      if (type === "Polygon") {
        coordinates.forEach((ring: number[][]) => ring.forEach(([lng, lat]) => processCoord(lng, lat)));
      } else if (type === "MultiPolygon") {
        coordinates.forEach((poly: number[][][]) =>
          poly.forEach((ring: number[][]) => ring.forEach(([lng, lat]) => processCoord(lng, lat)))
        );
      }
    });

    return { minLng, maxLng, minLat, maxLat };
  }, [geoData]);

  // Aggregate expenses per district
  const districtStats = useMemo(() => {
    const stats: Record<
      string,
      {
        totalAmount: number;
        approvedAmount: number;
        pendingAmount: number;
        rejectedAmount: number;
        claimCount: number;
        approvedCount: number;
        engineers: Set<string>;
        engineerAmounts: Record<string, number>;
        categories: Record<string, number>;
      }
    > = {};

    expenses.forEach((e) => {
      const rawDist = e.district || e.submitter_district || e.home_district || "Ganganagar";
      const dist = normalizeDistrict(rawDist);
      if (!dist) return;

      if (!stats[dist]) {
        stats[dist] = {
          totalAmount: 0,
          approvedAmount: 0,
          pendingAmount: 0,
          rejectedAmount: 0,
          claimCount: 0,
          approvedCount: 0,
          engineers: new Set(),
          engineerAmounts: {},
          categories: {}
        };
      }

      const amt = e.amount || 0;
      const status = (e.status || "pending").toLowerCase();
      const engName = e.submitter_name || e.user_name || "Unassigned";
      const cat = e.category || e.nature || "General";

      stats[dist].totalAmount += amt;
      stats[dist].claimCount += 1;
      stats[dist].engineers.add(engName);
      stats[dist].engineerAmounts[engName] = (stats[dist].engineerAmounts[engName] || 0) + amt;
      stats[dist].categories[cat] = (stats[dist].categories[cat] || 0) + amt;

      if (status === "approved") {
        stats[dist].approvedAmount += amt;
        stats[dist].approvedCount += 1;
      } else if (status === "rejected") {
        stats[dist].rejectedAmount += amt;
      } else {
        stats[dist].pendingAmount += amt;
      }
    });

    return stats;
  }, [expenses]);

  // Compute max values for choropleth scale calculation
  const maxMetrics = useMemo(() => {
    let maxAmt = 0;
    let maxCnt = 0;
    let maxEng = 0;

    Object.values(districtStats).forEach((s) => {
      if (s.totalAmount > maxAmt) maxAmt = s.totalAmount;
      if (s.claimCount > maxCnt) maxCnt = s.claimCount;
      if (s.engineers.size > maxEng) maxEng = s.engineers.size;
    });

    return {
      amount: maxAmt || 1,
      count: maxCnt || 1,
      approvalRate: 100,
      engineers: maxEng || 1
    };
  }, [districtStats]);

  // Color generator for Choropleth
  const getDistrictColor = (districtName: string, isSelected: boolean, isHovered: boolean) => {
    const norm = normalizeDistrict(districtName);
    const stat = districtStats[norm];

    if (isSelected) return "#3b82f6"; // Bright Primary Blue highlight
    if (isHovered) return "#6366f1"; // Indigo highlight on hover

    if (!stat || stat.totalAmount === 0) {
      return "#1e293b"; // Dark slate for empty districts
    }

    let ratio = 0;
    if (activeMetric === "amount") {
      ratio = Math.min(1, stat.totalAmount / maxMetrics.amount);
      // Slate to Emerald-Amber gradient
      if (ratio < 0.25) return "#064e3b"; // Dark Emerald
      if (ratio < 0.5) return "#059669"; // Medium Emerald
      if (ratio < 0.75) return "#10b981"; // Bright Emerald
      return "#f59e0b"; // Vibrant Amber/Gold for top spending
    } else if (activeMetric === "count") {
      ratio = Math.min(1, stat.claimCount / maxMetrics.count);
      if (ratio < 0.25) return "#312e81";
      if (ratio < 0.5) return "#4338ca";
      if (ratio < 0.75) return "#6366f1";
      return "#8b5cf6";
    } else if (activeMetric === "approvalRate") {
      const rate = stat.claimCount > 0 ? (stat.approvedCount / stat.claimCount) * 100 : 0;
      if (rate >= 80) return "#10b981"; // High approval: Green
      if (rate >= 50) return "#f59e0b"; // Medium: Amber
      return "#ef4444"; // Low: Red
    } else {
      ratio = Math.min(1, stat.engineers.size / maxMetrics.engineers);
      if (ratio < 0.25) return "#1e3a8a";
      if (ratio < 0.5) return "#2563eb";
      if (ratio < 0.75) return "#3b82f6";
      return "#38bdf8";
    }
  };

  // Projection helper: Lng/Lat -> SVG (x, y)
  const project = (lng: number, lat: number, width = 760, height = 660, padding = 30) => {
    const { minLng, maxLng, minLat, maxLat } = bounds;
    const innerW = width - padding * 2;
    const innerH = height - padding * 2;

    const x = padding + ((lng - minLng) / (maxLng - minLng || 1)) * innerW;
    const y = height - (padding + ((lat - minLat) / (maxLat - minLat || 1)) * innerH);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  };

  // Convert GeoJSON polygon to SVG Path string
  const renderPath = (feature: GeoFeature, width = 760, height = 660, padding = 30) => {
    const { type, coordinates } = feature.geometry;
    if (!coordinates) return "";

    const processRing = (ring: number[][]) => {
      return (
        "M " +
        ring.map(([lng, lat]) => project(lng, lat, width, height, padding)).join(" L ") +
        " Z"
      );
    };

    if (type === "Polygon") {
      return coordinates.map(processRing).join(" ");
    } else if (type === "MultiPolygon") {
      return coordinates.map((poly: number[][][]) => poly.map(processRing).join(" ")).join(" ");
    }
    return "";
  };

  // Calculate visual center of feature for label placement
  const getFeatureCenter = (feature: GeoFeature, width = 760, height = 660, padding = 30) => {
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    const addRing = (ring: number[][]) => {
      ring.forEach(([lng, lat]) => {
        const [xStr, yStr] = project(lng, lat, width, height, padding).split(",");
        sumX += parseFloat(xStr);
        sumY += parseFloat(yStr);
        count++;
      });
    };

    if (feature.geometry.type === "Polygon") {
      feature.geometry.coordinates.forEach(addRing);
    } else if (feature.geometry.type === "MultiPolygon") {
      feature.geometry.coordinates.forEach((poly: any) => poly.forEach(addRing));
    }

    if (count === 0) return { x: width / 2, y: height / 2 };
    return { x: sumX / count, y: sumY / count };
  };

  // Handle District Selection
  const handleDistrictClick = (districtName: string) => {
    const norm = normalizeDistrict(districtName);
    const newSel = selectedDistrict === norm ? null : norm;
    setSelectedDistrict(newSel);
    if (onSelectDistrict) {
      onSelectDistrict(newSel);
    }
  };

  // Active district metrics for detailed side panel
  const activeDistrictDetails = useMemo(() => {
    if (!selectedDistrict) return null;
    const stat = districtStats[selectedDistrict];
    if (!stat) {
      return {
        name: selectedDistrict,
        totalAmount: 0,
        claimCount: 0,
        approvedAmount: 0,
        pendingAmount: 0,
        rejectedAmount: 0,
        approvalRate: 0,
        engineersCount: 0,
        topEngineers: [],
        topCategories: []
      };
    }

    const appRate = stat.claimCount > 0 ? Math.round((stat.approvedCount / stat.claimCount) * 100) : 0;
    const topEngs = Object.entries(stat.engineerAmounts)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    const topCats = Object.entries(stat.categories)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    return {
      name: selectedDistrict,
      totalAmount: stat.totalAmount,
      claimCount: stat.claimCount,
      approvedAmount: stat.approvedAmount,
      pendingAmount: stat.pendingAmount,
      rejectedAmount: stat.rejectedAmount,
      approvalRate: appRate,
      engineersCount: stat.engineers.size,
      topEngineers: topEngs,
      topCategories: topCats
    };
  }, [selectedDistrict, districtStats]);

  // Overall totals across all districts
  const grandTotalAmount = useMemo(() => {
    return Object.values(districtStats).reduce((sum, d) => sum + d.totalAmount, 0);
  }, [districtStats]);

  return (
    <Card
      className="border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl rounded-2xl overflow-hidden"
      bodyStyle={{ padding: 0 }}
    >
      {/* Header Bar */}
      <div className="p-4 md:p-6 bg-slate-900/90 border-b border-slate-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="w-6 h-6 text-emerald-400 animate-pulse" />
            <h2 className="text-lg md:text-xl font-black tracking-tight text-white m-0">
              Rajasthan District GeoJSON Analytics Map
            </h2>
            <Badge count="LIVE MAP" style={{ backgroundColor: "#10b981", fontWeight: "bold" }} />
          </div>
          <p className="text-xs text-slate-400 mt-1 m-0">
            Interactive heatmap analysis for 33 districts of Rajasthan • Click any district for deep-dive metrics
          </p>
        </div>

        {/* Metric Switcher Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-950/80 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
            <button
              onClick={() => setActiveMetric("amount")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeMetric === "amount"
                  ? "bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              Total Amount (₹)
            </button>
            <button
              onClick={() => setActiveMetric("count")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeMetric === "count"
                  ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Claim Count
            </button>
            <button
              onClick={() => setActiveMetric("approvalRate")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeMetric === "approvalRate"
                  ? "bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Approval Rate %
            </button>
            <button
              onClick={() => setActiveMetric("engineers")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeMetric === "engineers"
                  ? "bg-sky-500 text-slate-950 shadow-lg shadow-sky-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Engineers
            </button>
          </div>
        </div>
      </div>

      {/* Map Content Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 relative">
        {/* Main Map Viewer Canvas */}
        <div className="lg:col-span-8 p-4 md:p-6 bg-slate-950 min-h-[550px] flex flex-col justify-between relative overflow-hidden">
          {/* Top Floating Tools: Search + Zoom */}
          <div className="flex justify-between items-center z-10 mb-2 gap-2">
            <div className="relative w-48 md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search district..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-900/90 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Map Controls */}
            <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.8, z - 0.25))}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  setZoomLevel(1);
                  setPanOffset({ x: 0, y: 0 });
                  setSelectedDistrict(null);
                  if (onSelectDistrict) onSelectDistrict(null);
                }}
                className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
                title="Reset View"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* SVG Map Render */}
          {loadingMap ? (
            <div className="flex flex-col items-center justify-center h-[460px] text-slate-400 space-y-3">
              <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
              <p className="text-xs font-semibold">Loading Rajasthan GeoJSON Map Data...</p>
            </div>
          ) : errorMap ? (
            <div className="flex flex-col items-center justify-center h-[460px] text-rose-400 space-y-2">
              <AlertTriangle className="w-8 h-8" />
              <p className="text-xs font-bold">{errorMap}</p>
            </div>
          ) : (
            <div className="relative w-full h-[480px] flex items-center justify-center overflow-hidden rounded-xl border border-slate-900 bg-slate-950/60">
              <svg
                ref={svgRef}
                viewBox="0 0 760 660"
                className="w-full h-full cursor-grab active:cursor-grabbing transition-transform duration-300"
                style={{
                  transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`
                }}
                onMouseMove={(e) => {
                  if (svgRef.current) {
                    const rect = svgRef.current.getBoundingClientRect();
                    setTooltipPos({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top
                    });
                  }
                }}
              >
                <defs>
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                  </filter>
                  <linearGradient id="selectedGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#1d4ed8" />
                  </linearGradient>
                </defs>

                {/* Map Paths */}
                <g>
                  {geoData?.features.map((feature, idx) => {
                    const distName = feature.properties.district || feature.properties.dt_nm || `District-${idx}`;
                    const norm = normalizeDistrict(distName);
                    const isSelected = selectedDistrict === norm;
                    const isHovered = hoveredDistrict === norm;
                    const isMatchingSearch =
                      searchQuery.trim().length > 0 &&
                      distName.toLowerCase().includes(searchQuery.toLowerCase());

                    const pathD = renderPath(feature, 760, 660, 30);
                    const center = getFeatureCenter(feature, 760, 660, 30);
                    const fillColor = getDistrictColor(distName, isSelected, isHovered);

                    return (
                      <g key={idx} className="transition-all duration-200">
                        <path
                          d={pathD}
                          fill={fillColor}
                          stroke={
                            isSelected
                              ? "#60a5fa"
                              : isHovered
                              ? "#ffffff"
                              : isMatchingSearch
                              ? "#f59e0b"
                              : "#0f172a"
                          }
                          strokeWidth={isSelected ? 3 : isHovered ? 2.5 : isMatchingSearch ? 2.5 : 1}
                          strokeLinejoin="round"
                          className="transition-all duration-200 cursor-pointer"
                          style={{
                            filter: isSelected
                              ? "drop-shadow(0 0 12px rgba(59, 130, 246, 0.8))"
                              : isHovered
                              ? "drop-shadow(0 0 8px rgba(99, 102, 241, 0.6))"
                              : isMatchingSearch
                              ? "drop-shadow(0 0 8px rgba(245, 158, 11, 0.8))"
                              : "none"
                          }}
                          onMouseEnter={() => setHoveredDistrict(norm)}
                          onMouseLeave={() => setHoveredDistrict(null)}
                          onClick={() => handleDistrictClick(distName)}
                        />

                        {/* District Labels */}
                        {zoomLevel >= 0.9 && center.x > 0 && (
                          <text
                            x={center.x}
                            y={center.y}
                            textAnchor="middle"
                            dominantBaseline="central"
                            className="pointer-events-none text-[9px] font-extrabold fill-slate-200 uppercase tracking-tighter select-none"
                            style={{
                              textShadow: "0 1px 3px rgba(0,0,0,0.9)",
                              fill: isSelected ? "#ffffff" : isHovered ? "#60a5fa" : "#cbd5e1"
                            }}
                          >
                            {distName}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              </svg>

              {/* Floating Glassmorphic Tooltip */}
              {hoveredDistrict && (
                <div
                  className="absolute pointer-events-none z-50 bg-slate-900/95 backdrop-blur-md border border-slate-700 p-3 rounded-xl shadow-2xl text-xs text-white max-w-xs transition-all duration-150"
                  style={{
                    left: Math.min(520, Math.max(10, tooltipPos.x + 15)),
                    top: Math.min(400, Math.max(10, tooltipPos.y - 15))
                  }}
                >
                  <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-1.5 mb-2">
                    <span className="font-black text-sm text-emerald-400 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {hoveredDistrict}
                    </span>
                    <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-mono">
                      District
                    </span>
                  </div>

                  {districtStats[hoveredDistrict] ? (
                    <div className="space-y-1.5 font-sans">
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-[11px]">Total Spending:</span>
                        <span className="font-mono font-bold text-emerald-400">
                          ₹{districtStats[hoveredDistrict].totalAmount.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-[11px]">Total Claims:</span>
                        <span className="font-mono font-bold text-indigo-300">
                          {districtStats[hoveredDistrict].claimCount}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-[11px]">Approval Rate:</span>
                        <span className="font-mono font-bold text-amber-400">
                          {districtStats[hoveredDistrict].claimCount > 0
                            ? Math.round(
                                (districtStats[hoveredDistrict].approvedCount /
                                  districtStats[hoveredDistrict].claimCount) *
                                  100
                              )
                            : 0}
                          %
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 text-[11px]">Active Engineers:</span>
                        <span className="font-mono font-bold text-sky-300">
                          {districtStats[hoveredDistrict].engineers.size}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 italic mt-2 m-0 text-right">
                        Click district to inspect detail panel
                      </p>
                    </div>
                  ) : (
                    <p className="text-slate-400 text-[11px] m-0">No expense records found for this district.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Bottom Choropleth Color Legend */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-300 flex items-center gap-1 text-[11px]">
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                Heatmap Legend ({activeMetric === "amount" ? "₹ Spend" : activeMetric === "count" ? "Claims" : activeMetric === "approvalRate" ? "% Approved" : "Engineers"}):
              </span>
            </div>

            {/* Gradient Bar */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-mono">Min</span>
              <div className="w-32 h-2.5 rounded-full overflow-hidden flex">
                {activeMetric === "amount" ? (
                  <>
                    <div className="w-1/4 h-full bg-[#064e3b]" />
                    <div className="w-1/4 h-full bg-[#059669]" />
                    <div className="w-1/4 h-full bg-[#10b981]" />
                    <div className="w-1/4 h-full bg-[#f59e0b]" />
                  </>
                ) : activeMetric === "count" ? (
                  <>
                    <div className="w-1/4 h-full bg-[#312e81]" />
                    <div className="w-1/4 h-full bg-[#4338ca]" />
                    <div className="w-1/4 h-full bg-[#6366f1]" />
                    <div className="w-1/4 h-full bg-[#8b5cf6]" />
                  </>
                ) : activeMetric === "approvalRate" ? (
                  <>
                    <div className="w-1/3 h-full bg-[#ef4444]" />
                    <div className="w-1/3 h-full bg-[#f59e0b]" />
                    <div className="w-1/3 h-full bg-[#10b981]" />
                  </>
                ) : (
                  <>
                    <div className="w-1/4 h-full bg-[#1e3a8a]" />
                    <div className="w-1/4 h-full bg-[#2563eb]" />
                    <div className="w-1/4 h-full bg-[#3b82f6]" />
                    <div className="w-1/4 h-full bg-[#38bdf8]" />
                  </>
                )}
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Max</span>
            </div>
          </div>
        </div>

        {/* Right Side District Deep-Dive & Analytics Panel */}
        <div className="lg:col-span-4 p-4 md:p-6 bg-slate-900/60 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col justify-between">
          <div>
            {selectedDistrict ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Selected District Analysis
                    </span>
                    <h3 className="text-xl font-black text-white m-0 flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-blue-400" />
                      {selectedDistrict}
                    </h3>
                  </div>
                  <button
                    onClick={() => handleDistrictClick(selectedDistrict)}
                    className="p-1.5 text-slate-400 hover:text-white bg-slate-800 rounded-lg text-xs"
                    title="Close selection"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {activeDistrictDetails ? (
                  <div className="space-y-4">
                    {/* Stat Grid */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">
                          Total Expense
                        </span>
                        <span className="text-base font-black text-emerald-400 font-mono">
                          ₹{activeDistrictDetails.totalAmount.toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">
                          Total Claims
                        </span>
                        <span className="text-base font-black text-indigo-300 font-mono">
                          {activeDistrictDetails.claimCount}
                        </span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">
                          Approval Rate
                        </span>
                        <span className="text-base font-black text-amber-400 font-mono">
                          {activeDistrictDetails.approvalRate}%
                        </span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase">
                          Engineers
                        </span>
                        <span className="text-base font-black text-sky-300 font-mono">
                          {activeDistrictDetails.engineersCount}
                        </span>
                      </div>
                    </div>

                    {/* Status Breakdown Bar */}
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                      <span className="text-[11px] font-bold text-slate-300 block">
                        Approval Status Breakdown
                      </span>
                      <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden flex">
                        {activeDistrictDetails.totalAmount > 0 ? (
                          <>
                            <div
                              style={{
                                width: `${(activeDistrictDetails.approvedAmount / activeDistrictDetails.totalAmount) * 100}%`
                              }}
                              className="h-full bg-emerald-500"
                              title="Approved"
                            />
                            <div
                              style={{
                                width: `${(activeDistrictDetails.pendingAmount / activeDistrictDetails.totalAmount) * 100}%`
                              }}
                              className="h-full bg-amber-500"
                              title="Pending"
                            />
                            <div
                              style={{
                                width: `${(activeDistrictDetails.rejectedAmount / activeDistrictDetails.totalAmount) * 100}%`
                              }}
                              className="h-full bg-rose-500"
                              title="Rejected"
                            />
                          </>
                        ) : (
                          <div className="w-full h-full bg-slate-800" />
                        )}
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 font-mono pt-1">
                        <span className="text-emerald-400">
                          Appr: ₹{activeDistrictDetails.approvedAmount.toLocaleString()}
                        </span>
                        <span className="text-amber-400">
                          Pend: ₹{activeDistrictDetails.pendingAmount.toLocaleString()}
                        </span>
                        <span className="text-rose-400">
                          Rej: ₹{activeDistrictDetails.rejectedAmount.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Top Engineers in District */}
                    <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                      <span className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                        <span>Top Engineers in {selectedDistrict}</span>
                        <Users className="w-3.5 h-3.5 text-sky-400" />
                      </span>
                      {activeDistrictDetails.topEngineers.length > 0 ? (
                        <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                          {activeDistrictDetails.topEngineers.slice(0, 4).map((eng, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs">
                              <span className="text-slate-300 font-medium truncate max-w-[140px]">
                                {eng.name}
                              </span>
                              <span className="font-mono font-bold text-emerald-400">
                                ₹{eng.amount.toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 m-0">No active engineers in district</p>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              /* Overview Leaderboard when no single district is selected */
              <div className="space-y-4">
                <div className="border-b border-slate-800 pb-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Regional Overview
                  </span>
                  <h3 className="text-lg font-black text-white m-0 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    Top Spending Districts
                  </h3>
                </div>

                <div className="space-y-2">
                  {Object.entries(districtStats)
                    .map(([name, s]) => ({ name, amount: s.totalAmount, count: s.claimCount }))
                    .sort((a, b) => b.amount - a.amount)
                    .slice(0, 6)
                    .map((item, idx) => {
                      const pct = grandTotalAmount > 0 ? Math.round((item.amount / grandTotalAmount) * 100) : 0;
                      return (
                        <div
                          key={idx}
                          onClick={() => handleDistrictClick(item.name)}
                          className="bg-slate-950 hover:bg-slate-900 p-2.5 rounded-xl border border-slate-800 cursor-pointer transition flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="w-5 h-5 rounded-full bg-slate-900 border border-slate-800 text-[10px] font-extrabold text-emerald-400 flex items-center justify-center font-mono">
                              #{idx + 1}
                            </span>
                            <div>
                              <span className="text-xs font-bold text-slate-200 group-hover:text-emerald-400 transition block">
                                {item.name}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {item.count} claims ({pct}% of total)
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-mono font-bold text-emerald-400">
                              ₹{item.amount.toLocaleString()}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 transition" />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          {/* Quick Help Footer */}
          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-slate-500" />
              Interactive GeoJSON Map
            </span>
            <span className="font-mono text-emerald-400 font-bold">33 Districts</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default RajasthanMapChart;
