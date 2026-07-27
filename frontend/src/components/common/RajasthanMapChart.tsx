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
  Globe,
  Building2,
  PieChart
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
  facility?: string;
  facility_name?: string;
  hospital?: string;
  site?: string;
  work_location?: string;
  location?: string;
  destination?: string;
  itinerary?: string;
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

type MetricType = "amount" | "facilities" | "engineers" | "count" | "approvalRate";

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
        facilities: Set<string>;
        engineers: Set<string>;
        engineerAmounts: Record<string, number>;
        categories: Record<string, number>;
      }
    > = {};

    expenses.forEach((e, idx) => {
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
          facilities: new Set(),
          engineers: new Set(),
          engineerAmounts: {},
          categories: {}
        };
      }

      const amt = e.amount || 0;
      const status = (e.status || "pending").toLowerCase();
      const engName = e.submitter_name || e.user_name || "Unassigned";
      const cat = e.category || e.nature || "General";
      const facName = e.facility || e.facility_name || e.hospital || e.site || e.work_location || e.location || e.destination || e.itinerary || `Facility #${idx + 1}`;

      stats[dist].totalAmount += amt;
      stats[dist].claimCount += 1;
      stats[dist].facilities.add(facName);
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

  // Overall Statewide Aggregates
  const stateSummary = useMemo(() => {
    let totalExpense = 0;
    let approvedExpense = 0;
    let totalClaims = 0;
    let approvedClaims = 0;
    const allFacilities = new Set<string>();
    const allEngineers = new Set<string>();

    Object.values(districtStats).forEach((s) => {
      totalExpense += s.totalAmount;
      approvedExpense += s.approvedAmount;
      totalClaims += s.claimCount;
      approvedClaims += s.approvedCount;
      s.facilities.forEach((f) => allFacilities.add(f));
      s.engineers.forEach((eng) => allEngineers.add(eng));
    });

    const approvalRate = totalClaims > 0 ? Math.round((approvedClaims / totalClaims) * 100) : 0;

    return {
      totalExpense,
      approvedExpense,
      totalClaims,
      approvalRate,
      facilitiesCount: allFacilities.size,
      engineersCount: allEngineers.size,
      activeDistrictsCount: Object.keys(districtStats).length
    };
  }, [districtStats]);

  // Compute max values for choropleth scale calculation
  const maxMetrics = useMemo(() => {
    let maxAmt = 0;
    let maxFac = 0;
    let maxEng = 0;
    let maxCnt = 0;

    Object.values(districtStats).forEach((s) => {
      if (s.totalAmount > maxAmt) maxAmt = s.totalAmount;
      if (s.facilities.size > maxFac) maxFac = s.facilities.size;
      if (s.engineers.size > maxEng) maxEng = s.engineers.size;
      if (s.claimCount > maxCnt) maxCnt = s.claimCount;
    });

    return {
      amount: maxAmt || 1,
      facilities: maxFac || 1,
      engineers: maxEng || 1,
      count: maxCnt || 1,
      approvalRate: 100
    };
  }, [districtStats]);

  // Color generator for Choropleth
  const getDistrictColor = (districtName: string, isSelected: boolean, isHovered: boolean) => {
    const norm = normalizeDistrict(districtName);
    const stat = districtStats[norm];

    if (isSelected) return "#3b82f6"; // Primary Blue highlight
    if (isHovered) return "#6366f1"; // Indigo highlight on hover

    if (!stat || stat.totalAmount === 0) {
      return "#e2e8f0"; // Soft light slate for empty districts
    }

    let ratio = 0;
    if (activeMetric === "amount") {
      ratio = Math.min(1, stat.totalAmount / maxMetrics.amount);
      if (ratio < 0.25) return "#a7f3d0";
      if (ratio < 0.5) return "#34d399";
      if (ratio < 0.75) return "#059669";
      return "#d97706";
    } else if (activeMetric === "facilities") {
      ratio = Math.min(1, stat.facilities.size / maxMetrics.facilities);
      if (ratio < 0.25) return "#99f6e4";
      if (ratio < 0.5) return "#2dd4bf";
      if (ratio < 0.75) return "#0d9488";
      return "#0f766e";
    } else if (activeMetric === "engineers") {
      ratio = Math.min(1, stat.engineers.size / maxMetrics.engineers);
      if (ratio < 0.25) return "#bfdbfe";
      if (ratio < 0.5) return "#60a5fa";
      if (ratio < 0.75) return "#2563eb";
      return "#1d4ed8";
    } else if (activeMetric === "count") {
      ratio = Math.min(1, stat.claimCount / maxMetrics.count);
      if (ratio < 0.25) return "#c7d2fe";
      if (ratio < 0.5) return "#818cf8";
      if (ratio < 0.75) return "#4f46e5";
      return "#3730a3";
    } else {
      const rate = stat.claimCount > 0 ? (stat.approvedCount / stat.claimCount) * 100 : 0;
      if (rate >= 80) return "#10b981";
      if (rate >= 50) return "#f59e0b";
      return "#ef4444";
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

  // Active district metrics for detailed panel
  const activeDistrictDetails = useMemo(() => {
    const targetDist = selectedDistrict || hoveredDistrict;
    if (!targetDist) return null;
    const stat = districtStats[targetDist];
    if (!stat) {
      return {
        name: targetDist,
        totalAmount: 0,
        claimCount: 0,
        facilitiesCount: 0,
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
      name: targetDist,
      totalAmount: stat.totalAmount,
      claimCount: stat.claimCount,
      facilitiesCount: stat.facilities.size,
      approvedAmount: stat.approvedAmount,
      pendingAmount: stat.pendingAmount,
      rejectedAmount: stat.rejectedAmount,
      approvalRate: appRate,
      engineersCount: stat.engineers.size,
      topEngineers: topEngs,
      topCategories: topCats
    };
  }, [selectedDistrict, hoveredDistrict, districtStats]);

  return (
    <Card
      className="border border-gray-200 bg-white text-gray-800 shadow-sm rounded-xl overflow-hidden mt-6"
      bodyStyle={{ padding: 0 }}
    >
      {/* Header Bar (Light Theme) */}
      <div className="p-4 md:p-6 bg-slate-50 border-b border-gray-200 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-600 animate-pulse" />
            <h2 className="text-base md:text-lg font-bold tracking-tight text-gray-800 uppercase m-0">
              Rajasthan District GeoJSON Analytics Map
            </h2>
            <Badge count="LIVE DATA" style={{ backgroundColor: "#10b981", fontWeight: "bold" }} />
          </div>
          <p className="text-xs text-gray-500 mt-1 m-0">
            Total Facilities, Engineers & Expense for 33 Rajasthan Districts • Synchronized with active page filters
          </p>
        </div>

        {/* Metric Switcher Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-white p-1 rounded-xl border border-gray-200 shadow-2xs flex items-center gap-1">
            <button
              onClick={() => setActiveMetric("amount")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeMetric === "amount"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              Total Amount (₹)
            </button>
            <button
              onClick={() => setActiveMetric("facilities")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeMetric === "facilities"
                  ? "bg-teal-600 text-white shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Facilities
            </button>
            <button
              onClick={() => setActiveMetric("engineers")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeMetric === "engineers"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Engineers
            </button>
            <button
              onClick={() => setActiveMetric("count")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeMetric === "count"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Claims
            </button>
            <button
              onClick={() => setActiveMetric("approvalRate")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeMetric === "approvalRate"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Approval %
            </button>
          </div>
        </div>
      </div>

      {/* Embedded Statewide Executive KPI Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-slate-100/60 border-b border-gray-200">
        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block">
              Total Facilities
            </span>
            <span className="text-base font-black text-teal-700 font-mono">
              {stateSummary.facilitiesCount}
            </span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block">
              Total Engineers
            </span>
            <span className="text-base font-black text-blue-700 font-mono">
              {stateSummary.engineersCount}
            </span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block">
              Total State Expense
            </span>
            <span className="text-base font-black text-emerald-600 font-mono">
              ₹{stateSummary.totalExpense.toLocaleString()}
            </span>
          </div>
        </div>

        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide block">
              Total Claims (Rate)
            </span>
            <div className="flex items-center gap-1.5 font-mono">
              <span className="text-base font-black text-indigo-700">
                {stateSummary.totalClaims}
              </span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                {stateSummary.approvalRate}% Appr
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Map Content Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 relative">
        {/* Main Map Viewer Canvas */}
        <div className="lg:col-span-8 p-4 md:p-6 bg-white min-h-[550px] flex flex-col justify-between relative overflow-hidden">
          {/* Top Floating Tools: Search + Zoom */}
          <div className="flex justify-between items-center z-10 mb-2 gap-2">
            <div className="relative w-48 md:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search district on map..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-gray-300 rounded-xl text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition shadow-2xs"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Map Controls */}
            <div className="flex items-center gap-1 bg-white border border-gray-200 p-1 rounded-xl shadow-2xs">
              <button
                onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
                className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-slate-100 rounded-lg transition"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.8, z - 0.25))}
                className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-slate-100 rounded-lg transition"
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
                className="p-1.5 text-gray-600 hover:text-gray-900 hover:bg-slate-100 rounded-lg transition"
                title="Reset View"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* SVG Map Render */}
          {loadingMap ? (
            <div className="flex flex-col items-center justify-center h-[460px] text-gray-400 space-y-3">
              <div className="w-10 h-10 border-4 border-emerald-500/30 border-t-emerald-600 rounded-full animate-spin" />
              <p className="text-xs font-semibold">Loading Rajasthan GeoJSON Map Data...</p>
            </div>
          ) : errorMap ? (
            <div className="flex flex-col items-center justify-center h-[460px] text-rose-500 space-y-2">
              <AlertTriangle className="w-8 h-8" />
              <p className="text-xs font-bold">{errorMap}</p>
            </div>
          ) : (
            <div className="relative w-full h-[480px] flex items-center justify-center overflow-hidden rounded-xl border border-gray-200 bg-slate-50/60">
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
                              ? "#1d4ed8"
                              : isHovered
                              ? "#312e81"
                              : isMatchingSearch
                              ? "#d97706"
                              : "#94a3b8"
                          }
                          strokeWidth={isSelected ? 3 : isHovered ? 2.5 : isMatchingSearch ? 2.5 : 1}
                          strokeLinejoin="round"
                          className="transition-all duration-200 cursor-pointer"
                          style={{
                            filter: isSelected
                              ? "drop-shadow(0 2px 8px rgba(37, 99, 235, 0.4))"
                              : isHovered
                              ? "drop-shadow(0 2px 6px rgba(99, 102, 241, 0.3))"
                              : isMatchingSearch
                              ? "drop-shadow(0 2px 6px rgba(217, 119, 6, 0.4))"
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
                            className="pointer-events-none text-[9px] font-extrabold fill-slate-800 uppercase tracking-tighter select-none"
                            style={{
                              textShadow: "0 1px 2px rgba(255,255,255,0.9)",
                              fill: isSelected ? "#ffffff" : isHovered ? "#1e1b4b" : "#334155"
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

              {/* Floating Glassmorphic Light Tooltip (100% English) */}
              {hoveredDistrict && (
                <div
                  className="absolute pointer-events-none z-50 bg-white/95 backdrop-blur-md border border-gray-300 p-3.5 rounded-xl shadow-xl text-xs text-gray-800 max-w-xs transition-all duration-150"
                  style={{
                    left: Math.min(520, Math.max(10, tooltipPos.x + 15)),
                    top: Math.min(400, Math.max(10, tooltipPos.y - 15))
                  }}
                >
                  <div className="flex items-center justify-between gap-3 border-b border-gray-200 pb-2 mb-2">
                    <span className="font-bold text-sm text-gray-900 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-blue-600" />
                      {hoveredDistrict}
                    </span>
                    <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-mono border border-slate-200">
                      District Info
                    </span>
                  </div>

                  {districtStats[hoveredDistrict] ? (
                    <div className="space-y-1.5 font-sans">
                      <div className="flex justify-between items-center bg-slate-50 p-1.5 rounded border border-slate-200">
                        <span className="text-gray-600 text-[11px] flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-teal-600" />
                          Facilities:
                        </span>
                        <span className="font-mono font-bold text-teal-700">
                          {districtStats[hoveredDistrict].facilities.size}
                        </span>
                      </div>

                      <div className="flex justify-between items-center bg-slate-50 p-1.5 rounded border border-slate-200">
                        <span className="text-gray-600 text-[11px] flex items-center gap-1">
                          <Users className="w-3 h-3 text-blue-600" />
                          Engineers:
                        </span>
                        <span className="font-mono font-bold text-blue-700">
                          {districtStats[hoveredDistrict].engineers.size}
                        </span>
                      </div>

                      <div className="flex justify-between items-center bg-slate-50 p-1.5 rounded border border-slate-200">
                        <span className="text-gray-600 text-[11px] flex items-center gap-1">
                          <DollarSign className="w-3 h-3 text-emerald-600" />
                          Total Expense:
                        </span>
                        <span className="font-mono font-bold text-emerald-600">
                          ₹{districtStats[hoveredDistrict].totalAmount.toLocaleString()}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-gray-500 pt-1">
                        <span>Claims: {districtStats[hoveredDistrict].claimCount}</span>
                        <span>
                          Approval Rate:{" "}
                          <strong className="text-amber-600">
                            {districtStats[hoveredDistrict].claimCount > 0
                              ? Math.round(
                                  (districtStats[hoveredDistrict].approvedCount /
                                    districtStats[hoveredDistrict].claimCount) *
                                    100
                                )
                              : 0}
                            %
                          </strong>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-[11px] m-0">No records found for active filters.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Bottom Choropleth Color Legend */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 rounded-xl border border-gray-200 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-gray-700 flex items-center gap-1 text-[11px]">
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                Heatmap Scale ({activeMetric.toUpperCase()}):
              </span>
            </div>

            {/* Light Gradient Bar */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 font-mono">Min</span>
              <div className="w-32 h-2.5 rounded-full overflow-hidden flex border border-gray-300">
                <div className="w-1/4 h-full bg-[#a7f3d0]" />
                <div className="w-1/4 h-full bg-[#34d399]" />
                <div className="w-1/4 h-full bg-[#059669]" />
                <div className="w-1/4 h-full bg-[#d97706]" />
              </div>
              <span className="text-[10px] text-gray-500 font-mono">Max</span>
            </div>
          </div>
        </div>

        {/* Right Side District Deep-Dive & Leaderboard Panel */}
        <div className="lg:col-span-4 p-4 md:p-6 bg-slate-50/50 border-t lg:border-t-0 lg:border-l border-gray-200 flex flex-col justify-between">
          <div>
            {activeDistrictDetails ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                      {selectedDistrict ? "Selected District Metrics" : "Hovered District Insights"}
                    </span>
                    <h3 className="text-lg font-bold text-gray-800 m-0 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-600" />
                      {activeDistrictDetails.name}
                    </h3>
                  </div>
                  {selectedDistrict && (
                    <button
                      onClick={() => handleDistrictClick(selectedDistrict)}
                      className="p-1.5 text-gray-400 hover:text-gray-700 bg-white border border-gray-200 rounded-lg text-xs"
                      title="Clear selection"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {/* Enterprise Stat Cards (Facilities, Engineers, Expense at once) */}
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
                      <span className="text-[10px] font-bold text-gray-500 block uppercase flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-teal-600" />
                        Facilities
                      </span>
                      <span className="text-base font-bold text-teal-700 font-mono">
                        {activeDistrictDetails.facilitiesCount}
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs">
                      <span className="text-[10px] font-bold text-gray-500 block uppercase flex items-center gap-1">
                        <Users className="w-3 h-3 text-blue-600" />
                        Engineers
                      </span>
                      <span className="text-base font-bold text-blue-700 font-mono">
                        {activeDistrictDetails.engineersCount}
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs col-span-2">
                      <span className="text-[10px] font-bold text-gray-500 block uppercase flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3 text-emerald-600" />
                          Total District Expense
                        </span>
                        <span className="font-mono text-amber-600 text-[10px]">
                          {activeDistrictDetails.approvalRate}% Approved
                        </span>
                      </span>
                      <span className="text-lg font-black text-emerald-600 font-mono block mt-0.5">
                        ₹{activeDistrictDetails.totalAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Financial Status Breakdown */}
                  <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs space-y-2">
                    <span className="text-[11px] font-bold text-gray-700 flex items-center justify-between">
                      <span>Expense Status Split</span>
                      <PieChart className="w-3.5 h-3.5 text-gray-400" />
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono pt-1">
                      <div className="bg-emerald-50/80 p-2 rounded-lg border border-emerald-100">
                        <span className="text-[9px] text-emerald-700 block font-sans font-semibold">Approved</span>
                        <span className="font-bold text-emerald-700 text-[11px]">₹{activeDistrictDetails.approvedAmount.toLocaleString()}</span>
                      </div>
                      <div className="bg-amber-50/80 p-2 rounded-lg border border-amber-100">
                        <span className="text-[9px] text-amber-700 block font-sans font-semibold">Pending</span>
                        <span className="font-bold text-amber-700 text-[11px]">₹{activeDistrictDetails.pendingAmount.toLocaleString()}</span>
                      </div>
                      <div className="bg-rose-50/80 p-2 rounded-lg border border-rose-100">
                        <span className="text-[9px] text-rose-700 block font-sans font-semibold">Rejected</span>
                        <span className="font-bold text-rose-700 text-[11px]">₹{activeDistrictDetails.rejectedAmount.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Top Engineers in District */}
                  <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs space-y-2">
                    <span className="text-[11px] font-bold text-gray-700 flex items-center justify-between">
                      <span>Top Engineers ({activeDistrictDetails.name})</span>
                      <Users className="w-3.5 h-3.5 text-blue-600" />
                    </span>
                    {activeDistrictDetails.topEngineers.length > 0 ? (
                      <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                        {activeDistrictDetails.topEngineers.slice(0, 4).map((eng, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs">
                            <span className="text-gray-700 font-medium truncate max-w-[140px]">
                              {eng.name}
                            </span>
                            <span className="font-mono font-bold text-emerald-600">
                              ₹{eng.amount.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 m-0">No active engineers for current filters</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Overview Leaderboard showing all metrics simultaneously */
              <div className="space-y-4">
                <div className="border-b border-gray-200 pb-3">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                    District Highlights
                  </span>
                  <h3 className="text-base font-bold text-gray-800 m-0 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                    Top Districts Breakdown
                  </h3>
                </div>

                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                  {Object.entries(districtStats)
                    .map(([name, s]) => ({ 
                      name, 
                      amount: s.totalAmount, 
                      count: s.claimCount,
                      facilitiesCount: s.facilities.size,
                      engineersCount: s.engineers.size,
                      approvalRate: s.claimCount > 0 ? Math.round((s.approvedCount / s.claimCount) * 100) : 0
                    }))
                    .sort((a, b) => b.amount - a.amount)
                    .map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleDistrictClick(item.name)}
                        className="bg-white hover:bg-slate-50 p-2.5 rounded-xl border border-gray-200 shadow-2xs cursor-pointer transition flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 text-[10px] font-extrabold text-emerald-600 flex items-center justify-center font-mono shrink-0">
                            #{idx + 1}
                          </span>
                          <div>
                            <span className="text-xs font-bold text-gray-800 group-hover:text-blue-600 transition block">
                              {item.name}
                            </span>
                            <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono mt-0.5">
                              <span className="text-teal-600">🏢 {item.facilitiesCount} Fac</span>
                              <span>•</span>
                              <span className="text-blue-600">👥 {item.engineersCount} Eng</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-right">
                          <div>
                            <span className="text-xs font-mono font-bold text-emerald-600 block">
                              ₹{item.amount.toLocaleString()}
                            </span>
                            <span className="text-[9px] font-mono text-gray-400 block">
                              {item.count} claims
                            </span>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 transition ml-1" />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Help Footer */}
          <div className="mt-4 pt-3 border-t border-gray-200 text-[11px] text-gray-500 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-gray-400" />
              Synced with Active Page Filters
            </span>
            <span className="font-mono text-emerald-600 font-bold">33 Districts</span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default RajasthanMapChart;
