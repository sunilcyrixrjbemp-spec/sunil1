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
  Table as TableIcon
} from "lucide-react";
import { Card, Badge, Table, Input } from "antd";

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
  const [tableSearch, setTableSearch] = useState<string>("");

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
      const facName = e.facility || e.facility_name || e.hospital || e.site || e.work_location || e.location || e.destination || e.itinerary || `Site #${idx + 1}`;

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

    if (isSelected) return "#3b82f6"; // Bright Primary Blue highlight
    if (isHovered) return "#6366f1"; // Indigo highlight on hover

    if (!stat || stat.totalAmount === 0) {
      return "#1e293b"; // Dark slate for empty districts
    }

    let ratio = 0;
    if (activeMetric === "amount") {
      ratio = Math.min(1, stat.totalAmount / maxMetrics.amount);
      if (ratio < 0.25) return "#064e3b";
      if (ratio < 0.5) return "#059669";
      if (ratio < 0.75) return "#10b981";
      return "#f59e0b";
    } else if (activeMetric === "facilities") {
      ratio = Math.min(1, stat.facilities.size / maxMetrics.facilities);
      if (ratio < 0.25) return "#065f46";
      if (ratio < 0.5) return "#0d9488";
      if (ratio < 0.75) return "#14b8a6";
      return "#2dd4bf";
    } else if (activeMetric === "engineers") {
      ratio = Math.min(1, stat.engineers.size / maxMetrics.engineers);
      if (ratio < 0.25) return "#1e3a8a";
      if (ratio < 0.5) return "#2563eb";
      if (ratio < 0.75) return "#3b82f6";
      return "#38bdf8";
    } else if (activeMetric === "count") {
      ratio = Math.min(1, stat.claimCount / maxMetrics.count);
      if (ratio < 0.25) return "#312e81";
      if (ratio < 0.5) return "#4338ca";
      if (ratio < 0.75) return "#6366f1";
      return "#8b5cf6";
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

  // Active district metrics for detailed side panel
  const activeDistrictDetails = useMemo(() => {
    if (!selectedDistrict) return null;
    const stat = districtStats[selectedDistrict];
    if (!stat) {
      return {
        name: selectedDistrict,
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
      name: selectedDistrict,
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
  }, [selectedDistrict, districtStats]);

  // Unified District Table Data for all 33 districts
  const districtTableData = useMemo(() => {
    if (!geoData || !geoData.features) return [];
    
    return geoData.features
      .map((f, idx) => {
        const rawName = f.properties.district || f.properties.dt_nm || `District-${idx}`;
        const norm = normalizeDistrict(rawName);
        const stat = districtStats[norm];

        const totalAmount = stat ? stat.totalAmount : 0;
        const claimCount = stat ? stat.claimCount : 0;
        const facilitiesCount = stat ? stat.facilities.size : 0;
        const engineersCount = stat ? stat.engineers.size : 0;
        const approvedAmount = stat ? stat.approvedAmount : 0;
        const approvalRate = stat && stat.claimCount > 0 ? Math.round((stat.approvedCount / stat.claimCount) * 100) : 0;

        return {
          key: norm,
          district: norm,
          rawName,
          facilitiesCount,
          engineersCount,
          totalAmount,
          claimCount,
          approvedAmount,
          approvalRate
        };
      })
      .filter((row) => {
        if (!tableSearch.trim()) return true;
        return row.district.toLowerCase().includes(tableSearch.toLowerCase());
      })
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [geoData, districtStats, tableSearch]);

  const tableColumns = [
    {
      title: "District (जिला)",
      dataIndex: "district",
      key: "district",
      render: (text: string) => (
        <span
          onClick={() => handleDistrictClick(text)}
          className="font-bold text-white cursor-pointer hover:text-blue-400 flex items-center gap-1.5"
        >
          <MapPin className="w-3.5 h-3.5 text-blue-400" />
          {text}
        </span>
      )
    },
    {
      title: "Facilities (सुविधाएं)",
      dataIndex: "facilitiesCount",
      key: "facilitiesCount",
      align: "center" as const,
      render: (val: number) => (
        <span className="font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
          🏢 {val}
        </span>
      )
    },
    {
      title: "Engineers (इंजीनियर)",
      dataIndex: "engineersCount",
      key: "engineersCount",
      align: "center" as const,
      render: (val: number) => (
        <span className="font-mono font-bold text-sky-400 bg-sky-950/60 px-2 py-0.5 rounded border border-sky-800/60">
          👥 {val}
        </span>
      )
    },
    {
      title: "Total Expense (कुल खर्च)",
      dataIndex: "totalAmount",
      key: "totalAmount",
      align: "right" as const,
      render: (val: number) => (
        <span className="font-mono font-black text-amber-400">
          ₹{val.toLocaleString()}
        </span>
      )
    },
    {
      title: "Total Claims",
      dataIndex: "claimCount",
      key: "claimCount",
      align: "center" as const,
      render: (val: number) => <span className="font-mono text-slate-300 font-bold">{val}</span>
    },
    {
      title: "Approved (₹)",
      dataIndex: "approvedAmount",
      key: "approvedAmount",
      align: "right" as const,
      render: (val: number) => (
        <span className="font-mono text-emerald-300 font-bold">₹{val.toLocaleString()}</span>
      )
    },
    {
      title: "Approval %",
      dataIndex: "approvalRate",
      key: "approvalRate",
      align: "center" as const,
      render: (val: number) => (
        <span
          className={`font-mono text-xs font-black px-2 py-0.5 rounded ${
            val >= 80 ? "bg-emerald-950 text-emerald-400" : val >= 50 ? "bg-amber-950 text-amber-400" : "bg-rose-950 text-rose-400"
          }`}
        >
          {val}%
        </span>
      )
    }
  ];

  return (
    <Card
      className="border border-slate-800 bg-slate-950 text-slate-100 shadow-2xl rounded-2xl overflow-hidden mt-6"
      bodyStyle={{ padding: 0 }}
    >
      {/* Header Bar */}
      <div className="p-4 md:p-6 bg-slate-900/90 border-b border-slate-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="w-6 h-6 text-emerald-400 animate-pulse" />
            <h2 className="text-lg md:text-xl font-black tracking-tight text-white m-0">
              Rajasthan District GeoJSON Analytics & Filter Map
            </h2>
            <Badge count="LIVE DATA" style={{ backgroundColor: "#10b981", fontWeight: "bold" }} />
          </div>
          <p className="text-xs text-slate-400 mt-1 m-0">
            Total Facilities, Engineers & Expense at a glance for 33 Rajasthan Districts • Strictly synchronized with active filters
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
              onClick={() => setActiveMetric("facilities")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeMetric === "facilities"
                  ? "bg-teal-500 text-slate-950 shadow-lg shadow-teal-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              Facilities
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
            <button
              onClick={() => setActiveMetric("count")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeMetric === "count"
                  ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Claims
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
              Approval %
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
                placeholder="Search district on map..."
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

              {/* Floating Glassmorphic Tooltip showing ALL Metrics at once */}
              {hoveredDistrict && (
                <div
                  className="absolute pointer-events-none z-50 bg-slate-900/95 backdrop-blur-md border border-slate-700 p-3.5 rounded-xl shadow-2xl text-xs text-white max-w-xs transition-all duration-150"
                  style={{
                    left: Math.min(520, Math.max(10, tooltipPos.x + 15)),
                    top: Math.min(400, Math.max(10, tooltipPos.y - 15))
                  }}
                >
                  <div className="flex items-center justify-between gap-3 border-b border-slate-800 pb-2 mb-2">
                    <span className="font-black text-sm text-emerald-400 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      {hoveredDistrict}
                    </span>
                    <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-mono">
                      Filtered District Data
                    </span>
                  </div>

                  {districtStats[hoveredDistrict] ? (
                    <div className="space-y-2 font-sans">
                      <div className="flex justify-between items-center bg-slate-950 p-1.5 rounded border border-slate-800">
                        <span className="text-slate-400 text-[11px] flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-teal-400" />
                          Facilities (सुविधाएं):
                        </span>
                        <span className="font-mono font-bold text-teal-300">
                          {districtStats[hoveredDistrict].facilities.size}
                        </span>
                      </div>

                      <div className="flex justify-between items-center bg-slate-950 p-1.5 rounded border border-slate-800">
                        <span className="text-slate-400 text-[11px] flex items-center gap-1">
                          <Users className="w-3 h-3 text-sky-400" />
                          Engineers (इंजीनियर):
                        </span>
                        <span className="font-mono font-bold text-sky-300">
                          {districtStats[hoveredDistrict].engineers.size}
                        </span>
                      </div>

                      <div className="flex justify-between items-center bg-slate-950 p-1.5 rounded border border-slate-800">
                        <span className="text-slate-400 text-[11px] flex items-center gap-1">
                          <DollarSign className="w-3 h-3 text-emerald-400" />
                          Total Expense (खर्च):
                        </span>
                        <span className="font-mono font-bold text-emerald-400">
                          ₹{districtStats[hoveredDistrict].totalAmount.toLocaleString()}
                        </span>
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
                        <span>Claims: {districtStats[hoveredDistrict].claimCount}</span>
                        <span>
                          Approval:{" "}
                          <strong className="text-amber-400">
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
                    <p className="text-slate-400 text-[11px] m-0">No records found for active filters.</p>
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
                Heatmap Legend ({activeMetric.toUpperCase()}):
              </span>
            </div>

            {/* Gradient Bar */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-400 font-mono">Min</span>
              <div className="w-32 h-2.5 rounded-full overflow-hidden flex">
                <div className="w-1/4 h-full bg-[#064e3b]" />
                <div className="w-1/4 h-full bg-[#059669]" />
                <div className="w-1/4 h-full bg-[#10b981]" />
                <div className="w-1/4 h-full bg-[#f59e0b]" />
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Max</span>
            </div>
          </div>
        </div>

        {/* Right Side District Deep-Dive & Overview Panel */}
        <div className="lg:col-span-4 p-4 md:p-6 bg-slate-900/60 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col justify-between">
          <div>
            {selectedDistrict ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Selected District Overview
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
                    {/* Stat Grid with Facilities, Engineers, Expense at once */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-teal-400" />
                          Facilities
                        </span>
                        <span className="text-base font-black text-teal-300 font-mono">
                          {activeDistrictDetails.facilitiesCount}
                        </span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase flex items-center gap-1">
                          <Users className="w-3 h-3 text-sky-400" />
                          Engineers
                        </span>
                        <span className="text-base font-black text-sky-300 font-mono">
                          {activeDistrictDetails.engineersCount}
                        </span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase flex items-center gap-1">
                          <DollarSign className="w-3 h-3 text-emerald-400" />
                          Total Expense
                        </span>
                        <span className="text-base font-black text-emerald-400 font-mono">
                          ₹{activeDistrictDetails.totalAmount.toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 block uppercase flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3 text-amber-400" />
                          Approval %
                        </span>
                        <span className="text-base font-black text-amber-400 font-mono">
                          {activeDistrictDetails.approvalRate}%
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
                        <p className="text-xs text-slate-500 m-0">No active engineers for current filters</p>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              /* Overview Leaderboard showing all 3 metrics simultaneously */
              <div className="space-y-4">
                <div className="border-b border-slate-800 pb-3">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    District Highlights
                  </span>
                  <h3 className="text-lg font-black text-white m-0 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" />
                    Top Districts Breakdown
                  </h3>
                </div>

                <div className="space-y-2">
                  {Object.entries(districtStats)
                    .map(([name, s]) => ({ 
                      name, 
                      amount: s.totalAmount, 
                      count: s.claimCount,
                      facilitiesCount: s.facilities.size,
                      engineersCount: s.engineers.size
                    }))
                    .sort((a, b) => b.amount - a.amount)
                    .slice(0, 5)
                    .map((item, idx) => (
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
                            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                              <span className="text-teal-400">🏢 {item.facilitiesCount} Fac</span>
                              <span>•</span>
                              <span className="text-sky-400">👥 {item.engineersCount} Eng</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-xs font-mono font-bold text-emerald-400">
                            ₹{item.amount.toLocaleString()}
                          </span>
                          <ChevronRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-slate-300 transition" />
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>

          {/* Quick Help Footer */}
          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Info className="w-3.5 h-3.5 text-slate-500" />
              Synced with Active Page Filters
            </span>
            <span className="font-mono text-emerald-400 font-bold">33 Districts</span>
          </div>
        </div>
      </div>

      {/* District Analytics Master Table (SABSE NICHE) */}
      <div className="p-4 md:p-6 bg-slate-900/90 border-t border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <TableIcon className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-black text-white m-0">
              Complete District Data Table (सभी जिलों का संपूर्ण डेटा)
            </h3>
          </div>
          <div className="w-full sm:w-64">
            <Input
              placeholder="Search table district..."
              prefix={<Search className="w-3.5 h-3.5 text-slate-400 mr-1" />}
              value={tableSearch}
              onChange={(e) => setTableSearch(e.target.value)}
              className="bg-slate-950 border-slate-800 text-xs text-white placeholder-slate-500 rounded-xl"
            />
          </div>
        </div>

        <Table
          dataSource={districtTableData}
          columns={tableColumns}
          pagination={{ pageSize: 8, showSizeChanger: false }}
          size="small"
          className="ant-table-dark border border-slate-800 rounded-xl overflow-hidden"
          rowClassName="bg-slate-950 text-slate-200 hover:bg-slate-900 transition"
        />
      </div>
    </Card>
  );
};

export default RajasthanMapChart;
