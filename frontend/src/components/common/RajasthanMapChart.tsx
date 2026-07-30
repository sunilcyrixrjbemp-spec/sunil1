import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  MapPin, 
  Users, 
  UserCheck,
  Search, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Layers, 
  DollarSign, 
  Sparkles, 
  X, 
  ChevronRight,
  Globe,
  Building2,
  PhoneCall,
  CheckCircle2,
  Wrench,
  Gauge,
  Calculator,
  AlertTriangle
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
  submitter_role?: string;
  role?: string;
  designation?: string;
  submitter_designation?: string;
  manager_name?: string;
  manager?: string;
  coordinator_name?: string;
  coordinator?: string;
  submitter_coordinator?: string;
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
  calls_assigned?: number;
  calls_completed?: number;
  pms_count?: number;
  calibration_count?: number;
  zone?: string;
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
  selectedZoneFilter?: string | null;
}

// Zone to district names mapping for Rajasthan
const ZONE_MAP: Record<string, string[]> = {
  "ajmer": ["ajmer", "beawar", "beawer", "bhilwara", "nagaur", "tonk"],
  "bikaner": ["bikaner", "churu", "ganganagar", "sri ganganagar", "hanumangarh"],
  "jaipur": ["jaipur", "alwar", "dausa", "jhunjhunu", "sikar", "bharatpur", "dholpur", "karauli", "sawai madhopur"],
  "jodhpur": ["jodhpur", "barmer", "balotra", "jaisalmer", "jalore", "pali", "phalodi", "sirohi"],
  "udaipur": ["udaipur", "banswara", "chittorgarh", "dungarpur", "rajsamand", "pratapgarh", "kota", "baran", "bundi", "jhalawar"]
};

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

const isDistrictInZone = (distName: string, zoneName?: string | null): boolean => {
  if (!zoneName || zoneName === "all") return true;
  const cleanZ = zoneName.trim().toLowerCase().replace(/\s*[zZ]one\s*$/, "");
  const normDist = normalizeDistrict(distName).toLowerCase();
  const list = ZONE_MAP[cleanZ] || [];
  return list.some(item => normDist.includes(item) || item.includes(normDist));
};

export const RajasthanMapChart: React.FC<RajasthanMapChartProps> = ({
  expenses = [],
  onSelectDistrict,
  selectedDistrictFilter = null,
  selectedZoneFilter = null
}) => {
  const [geoData, setGeoData] = useState<GeoJSONData | null>(null);
  const [loadingMap, setLoadingMap] = useState<boolean>(true);
  const [errorMap, setErrorMap] = useState<string | null>(null);
  const [hoveredDistrict, setHoveredDistrict] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string | null>(selectedDistrictFilter);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const svgRef = useRef<SVGSVGElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (svgRef.current && tooltipRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const x = Math.min(500, Math.max(10, e.clientX - rect.left + 15));
      const y = Math.min(380, Math.max(10, e.clientY - rect.top - 15));
      tooltipRef.current.style.left = `${x}px`;
      tooltipRef.current.style.top = `${y}px`;
    }
  };

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

  // Filter features to focus on based on active Zone or District filter
  // Compute target features for SVG Bounding Box based on Zone or Full Rajasthan State
  // (Stable bounds so clicking a district never causes SVG projection to shrink/jump under cursor)
  const targetFeatures = useMemo(() => {
    if (!geoData?.features) return [];
    
    const cleanZone = selectedZoneFilter && selectedZoneFilter !== "all" 
      ? selectedZoneFilter.trim().toLowerCase().replace(/\s*[zZ]one\s*$/, "") 
      : null;

    if (cleanZone) {
      const match = geoData.features.filter(f => {
        const d = f.properties.district || f.properties.dt_nm || "";
        return isDistrictInZone(d, cleanZone);
      });
      if (match.length > 0) return match;
    }

    return geoData.features;
  }, [geoData, selectedZoneFilter]);

  // Compute bounding box dynamically from target features to zoom into Zone/District
  const bounds = useMemo(() => {
    const featuresToBound = targetFeatures.length > 0 ? targetFeatures : (geoData?.features || []);
    if (!featuresToBound || featuresToBound.length === 0) {
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

    featuresToBound.forEach((feature) => {
      const { type, coordinates } = feature.geometry;
      if (type === "Polygon") {
        coordinates.forEach((ring: number[][]) => ring.forEach(([lng, lat]) => processCoord(lng, lat)));
      } else if (type === "MultiPolygon") {
        coordinates.forEach((poly: number[][][]) =>
          poly.forEach((ring: number[][]) => ring.forEach(([lng, lat]) => processCoord(lng, lat)))
        );
      }
    });

    const lngSpan = (maxLng - minLng) || 1;
    const latSpan = (maxLat - minLat) || 1;
    const padLng = lngSpan * 0.08;
    const padLat = latSpan * 0.08;

    return {
      minLng: minLng - padLng,
      maxLng: maxLng + padLng,
      minLat: minLat - padLat,
      maxLat: maxLat + padLat
    };
  }, [targetFeatures, geoData]);

  // Aggregate expenses and activity metrics per district from live database records
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
        callsAssigned: number;
        callsCompleted: number;
        pmsCount: number;
        calibrationCount: number;
        facilities: Set<string>;
        engineers: Set<string>;
        managers: Set<string>;
        engineerAmounts: Record<string, number>;
        managerAmounts: Record<string, number>;
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
          callsAssigned: 0,
          callsCompleted: 0,
          pmsCount: 0,
          calibrationCount: 0,
          facilities: new Set(),
          engineers: new Set(),
          managers: new Set(),
          engineerAmounts: {},
          managerAmounts: {}
        };
      }

      const amt = Number(e.amount || 0);
      const status = (e.status || "pending").toLowerCase();
      const userName = e.submitter_name || e.user_name || "Unassigned";
      const userRole = String(e.submitter_role || e.role || e.designation || e.submitter_designation || "").toLowerCase();
      const mgrName = e.manager_name || e.manager || e.coordinator_name || e.coordinator || e.submitter_coordinator;

      const facName = e.facility || e.facility_name || e.hospital || e.site || e.work_location || e.location || e.destination || e.itinerary || `Facility #${idx + 1}`;

      stats[dist].totalAmount += amt;
      stats[dist].claimCount += 1;
      stats[dist].callsAssigned += Number(e.calls_assigned || 0);
      stats[dist].callsCompleted += Number(e.calls_completed || 0);
      stats[dist].pmsCount += Number(e.pms_count || 0);
      stats[dist].calibrationCount += Number(e.calibration_count || 0);

      if (facName && facName !== "—") stats[dist].facilities.add(facName);

      // Classify user as Manager vs Engineer
      const isManager = userRole.includes("manager") || userRole.includes("lead") || userRole.includes("head") || userRole.includes("vp") || userRole.includes("director") || userRole.includes("coordinator");

      if (userName && userName !== "Unassigned") {
        if (isManager) {
          stats[dist].managers.add(userName);
          stats[dist].managerAmounts[userName] = (stats[dist].managerAmounts[userName] || 0) + amt;
        } else {
          stats[dist].engineers.add(userName);
          stats[dist].engineerAmounts[userName] = (stats[dist].engineerAmounts[userName] || 0) + amt;
        }
      }

      if (mgrName && typeof mgrName === "string" && mgrName.trim() && mgrName !== "—" && mgrName !== "Unassigned") {
        stats[dist].managers.add(mgrName.trim());
      }

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

  // Overall Statewide / Zone Aggregates for Top KPI Bar
  const summaryStats = useMemo(() => {
    let totalExpense = 0;
    let totalCallsAssigned = 0;
    let totalCallsCompleted = 0;
    let totalPms = 0;
    let totalCalibration = 0;
    const allFacilities = new Set<string>();
    const allEngineers = new Set<string>();
    const allManagers = new Set<string>();

    Object.entries(districtStats).forEach(([distName, s]) => {
      if (selectedZoneFilter && selectedZoneFilter !== "all") {
        if (!isDistrictInZone(distName, selectedZoneFilter)) return;
      }
      totalExpense += s.totalAmount;
      totalCallsAssigned += s.callsAssigned;
      totalCallsCompleted += s.callsCompleted;
      totalPms += s.pmsCount;
      totalCalibration += s.calibrationCount;
      s.facilities.forEach((f) => allFacilities.add(f));
      s.engineers.forEach((eng) => allEngineers.add(eng));
      s.managers.forEach((mgr) => allManagers.add(mgr));
    });

    const totalEngineers = allEngineers.size;
    const totalManagers = allManagers.size;
    const totalStaff = totalEngineers + totalManagers;
    const avgExpensePerEngineer = totalStaff > 0 ? Math.round(totalExpense / totalStaff) : 0;

    return {
      totalFacilities: allFacilities.size,
      totalCallsAssigned,
      totalCallsCompleted,
      totalPms,
      totalCalibration,
      totalEngineers,
      totalManagers,
      totalExpense,
      avgExpensePerEngineer
    };
  }, [districtStats, selectedZoneFilter]);

  // Compute max expense amount for district color choropleth
  const maxExpense = useMemo(() => {
    let maxAmt = 0;
    Object.values(districtStats).forEach((s) => {
      if (s.totalAmount > maxAmt) maxAmt = s.totalAmount;
    });
    return maxAmt || 1;
  }, [districtStats]);

  // Color generator for Choropleth Map (Lighter/Softer Cyrix Blue Heatmap Scale)
  const getDistrictColor = (districtName: string, isSelected: boolean, isHovered: boolean, isTargetZone: boolean) => {
    const norm = normalizeDistrict(districtName);
    const stat = districtStats[norm];

    if (isSelected) return "#2563eb"; // Rich Cyrix Primary Blue highlight
    if (isHovered) return "#4f46e5"; // Deep Indigo highlight on hover

    if (!isTargetZone) return "#f1f5f9"; // Dimmed out for non-zone districts

    if (!stat || stat.totalAmount === 0) {
      return "#f8fafc"; // Soft light slate for empty districts
    }

    const ratio = Math.min(1, stat.totalAmount / maxExpense);
    if (ratio < 0.25) return "#e0f2fe"; // Soft sky blue (Lightest Cyrix Blue)
    if (ratio < 0.5) return "#bae6fd";  // Soft cyan/sky blue
    if (ratio < 0.75) return "#7dd3fc"; // Light Cyrix blue
    return "#38bdf8";                   // Vibrant light Cyrix blue
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

  // Calculate geometric centroid / visual center of feature for accurate label placement
  const getFeatureCenter = (feature: GeoFeature, width = 760, height = 660, padding = 30) => {
    const distName = normalizeDistrict(feature.properties.district || feature.properties.dt_nm || "");

    // Precise manual visual centers in Lng/Lat for irregular/elongated district polygons
    const MANUAL_CENTERS: Record<string, [number, number]> = {
      "Ganganagar": [73.55, 29.55],
      "Hanumangarh": [74.45, 29.50],
      "Chittorgarh": [74.63, 24.88],
      "Jaisalmer": [70.90, 26.90],
      "Barmer": [71.40, 25.75],
      "Bikaner": [72.85, 28.00],
      "Jodhpur": [73.00, 26.30],
      "Nagaur": [73.90, 27.00],
      "Ajmer": [74.65, 26.45],
      "Pali": [73.30, 25.78],
      "Udaipur": [73.70, 24.58],
      "Jaipur": [75.80, 26.90],
      "Alwar": [76.60, 27.56],
      "Bhilwara": [74.64, 25.35],
      "Churu": [74.60, 28.30],
      "Sikar": [75.15, 27.60],
      "Jhunjhunu": [75.40, 28.12],
      "Dungarpur": [73.72, 23.84],
      "Banswara": [74.43, 23.54],
      "Pratapgarh": [74.78, 24.03],
      "Rajsamand": [73.88, 25.07],
      "Kota": [75.85, 25.18],
      "Bundi": [75.64, 25.44],
      "Baran": [76.51, 25.10],
      "Jhalawar": [76.15, 24.60],
      "Tonk": [75.78, 26.16],
      "Dausa": [76.33, 26.88],
      "Sawai Madhopur": [76.40, 26.00],
      "Karauli": [77.02, 26.50],
      "Dholpur": [77.88, 26.70],
      "Bharatpur": [77.49, 27.22],
      "Jalore": [72.60, 25.35],
      "Sirohi": [72.86, 24.88]
    };

    if (MANUAL_CENTERS[distName]) {
      const [lng, lat] = MANUAL_CENTERS[distName];
      const [xStr, yStr] = project(lng, lat, width, height, padding).split(",");
      return { x: parseFloat(xStr), y: parseFloat(yStr) };
    }

    // Fallback: Largest polygon ring bounding center
    let maxArea = -1;
    let bestCenterLng = 0;
    let bestCenterLat = 0;

    const processRing = (ring: number[][]) => {
      if (!ring || ring.length === 0) return;
      let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
      ring.forEach(([lng, lat]) => {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      });
      const area = (maxLng - minLng) * (maxLat - minLat);
      if (area > maxArea) {
        maxArea = area;
        bestCenterLng = (minLng + maxLng) / 2;
        bestCenterLat = (minLat + maxLat) / 2;
      }
    };

    if (feature.geometry.type === "Polygon") {
      feature.geometry.coordinates.forEach(processRing);
    } else if (feature.geometry.type === "MultiPolygon") {
      feature.geometry.coordinates.forEach((poly: any) => poly.forEach(processRing));
    }

    if (maxArea > 0) {
      const [xStr, yStr] = project(bestCenterLng, bestCenterLat, width, height, padding).split(",");
      return { x: parseFloat(xStr), y: parseFloat(yStr) };
    }

    return { x: width / 2, y: height / 2 };
  };

  const lastClickTimeRef = useRef<number>(0);

  // Handle District Selection
  const handleDistrictClick = (districtName: string) => {
    const now = Date.now();
    if (now - lastClickTimeRef.current < 250) return;
    lastClickTimeRef.current = now;

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
        callsAssigned: 0,
        callsCompleted: 0,
        pmsCount: 0,
        calibrationCount: 0,
        approvedAmount: 0,
        pendingAmount: 0,
        rejectedAmount: 0,
        approvalRate: 0,
        engineersCount: 0,
        managersCount: 0,
        avgExpensePerStaff: 0,
        topEngineers: [],
        topManagers: []
      };
    }

    const appRate = stat.claimCount > 0 ? Math.round((stat.approvedCount / stat.claimCount) * 100) : 0;
    const engCount = stat.engineers.size;
    const mgrCount = stat.managers.size;
    const totalStaffCount = engCount + mgrCount;
    const avgExpense = totalStaffCount > 0 ? Math.round(stat.totalAmount / totalStaffCount) : 0;

    const topEngs = Object.entries(stat.engineerAmounts)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);

    const topMgrs = Array.from(stat.managers).map(name => ({
      name,
      amount: stat.managerAmounts[name] || 0
    })).sort((a, b) => b.amount - a.amount);

    return {
      name: targetDist,
      totalAmount: stat.totalAmount,
      claimCount: stat.claimCount,
      facilitiesCount: stat.facilities.size,
      callsAssigned: stat.callsAssigned,
      callsCompleted: stat.callsCompleted,
      pmsCount: stat.pmsCount,
      calibrationCount: stat.calibrationCount,
      approvedAmount: stat.approvedAmount,
      pendingAmount: stat.pendingAmount,
      rejectedAmount: stat.rejectedAmount,
      approvalRate: appRate,
      engineersCount: engCount,
      managersCount: mgrCount,
      avgExpensePerStaff: avgExpense,
      topEngineers: topEngs,
      topManagers: topMgrs
    };
  }, [selectedDistrict, hoveredDistrict, districtStats]);

  return (
    <Card
      className="border border-gray-200 bg-white text-gray-800 shadow-sm rounded-xl overflow-hidden mt-6"
      bodyStyle={{ padding: 0 }}
    >
      {/* Header Bar */}
      <div className="p-4 md:p-6 bg-slate-50 border-b border-gray-200 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-600 animate-pulse" />
            <h2 className="text-base md:text-lg font-bold tracking-tight text-gray-800 uppercase m-0">
              Rajasthan District GeoJSON Analytics Map
            </h2>
            <Badge count="LIVE DATA" style={{ backgroundColor: "#10b981", fontWeight: "bold" }} />
          </div>
          <p className="text-xs text-gray-500 mt-1 m-0">
            {selectedZoneFilter && selectedZoneFilter !== "all" ? `${selectedZoneFilter} Zone View` : "All Rajasthan Districts"} • Synchronized with active page filters
          </p>
        </div>
      </div>

      {/* Statewide / Zone KPI Summary Bar (8 Live Metrics) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 p-3 bg-slate-100/60 border-b border-gray-200">
        {/* 1. Total Facilities */}
        <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 shrink-0">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wide block">
              Facilities
            </span>
            <span className="text-sm font-black text-teal-700 font-mono">
              {summaryStats.totalFacilities}
            </span>
          </div>
        </div>

        {/* 2. Total Calls */}
        <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 shrink-0">
            <PhoneCall className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wide block">
              Total Calls
            </span>
            <span className="text-sm font-black text-blue-700 font-mono">
              {summaryStats.totalCallsAssigned}
            </span>
          </div>
        </div>

        {/* 3. Closed Calls */}
        <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wide block">
              Closed Calls
            </span>
            <span className="text-sm font-black text-emerald-700 font-mono">
              {summaryStats.totalCallsCompleted}
            </span>
          </div>
        </div>

        {/* 4. PMS Count */}
        <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0">
            <Wrench className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wide block">
              PMS Done
            </span>
            <span className="text-sm font-black text-indigo-700 font-mono">
              {summaryStats.totalPms}
            </span>
          </div>
        </div>

        {/* 5. Calibration Count */}
        <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shrink-0">
            <Gauge className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wide block">
              Calibration
            </span>
            <span className="text-sm font-black text-purple-700 font-mono">
              {summaryStats.totalCalibration}
            </span>
          </div>
        </div>

        {/* 6. Total Engineers */}
        <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-600 shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wide block">
              Engineers
            </span>
            <span className="text-sm font-black text-cyan-700 font-mono">
              {summaryStats.totalEngineers}
            </span>
          </div>
        </div>

        {/* 7. Total Managers */}
        <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-50 border border-violet-200 flex items-center justify-center text-violet-600 shrink-0">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wide block">
              Managers
            </span>
            <span className="text-sm font-black text-violet-700 font-mono">
              {summaryStats.totalManagers}
            </span>
          </div>
        </div>

        {/* 8. Per Staff Avg Expense */}
        <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wide block">
              Avg / Staff
            </span>
            <span className="text-xs font-black text-amber-700 font-mono">
              ₹{summaryStats.avgExpensePerEngineer.toLocaleString()}
            </span>
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
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoveredDistrict(null)}
              >
                {/* Map Paths */}
                <g>
                  {geoData?.features.map((feature, idx) => {
                    const distName = feature.properties.district || feature.properties.dt_nm || `District-${idx}`;
                    const norm = normalizeDistrict(distName);
                    const isSelected = selectedDistrict === norm;
                    const isHovered = hoveredDistrict === norm;
                    const isTargetZone = isDistrictInZone(distName, selectedZoneFilter);
                    const isMatchingSearch =
                      searchQuery.trim().length > 0 &&
                      distName.toLowerCase().includes(searchQuery.toLowerCase());

                    const pathD = renderPath(feature, 760, 660, 30);
                    const center = getFeatureCenter(feature, 760, 660, 30);
                    const fillColor = getDistrictColor(distName, isSelected, isHovered, isTargetZone);

                    return (
                      <g 
                        key={idx} 
                        className="transition-all duration-200"
                        style={{ opacity: !isTargetZone ? 0.35 : 1 }}
                      >
                        <path
                          d={pathD}
                          fill={fillColor}
                          stroke={
                            isMatchingSearch
                              ? "#d97706"
                              : isTargetZone
                              ? "#94a3b8"
                              : "#cbd5e1"
                          }
                          strokeWidth={1}
                          strokeLinejoin="round"
                          className="cursor-pointer"
                          style={{
                            pointerEvents: "visiblePainted"
                          }}
                          onMouseEnter={() => setHoveredDistrict(norm)}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleDistrictClick(distName);
                          }}
                        />

                        {/* Non-interactive Overlay for Hover / Selection Highlight (Prevents Border Stroke Oscillation Flicker) */}
                        {(isSelected || isHovered) && (
                          <path
                            d={pathD}
                            fill="none"
                            stroke={isSelected ? "#1d4ed8" : "#312e81"}
                            strokeWidth={isSelected ? 3 : 2.5}
                            strokeLinejoin="round"
                            style={{
                              pointerEvents: "none",
                              filter: isSelected
                                ? "drop-shadow(0 2px 8px rgba(37, 99, 235, 0.4))"
                                : "drop-shadow(0 2px 6px rgba(99, 102, 241, 0.3))"
                            }}
                          />
                        )}

                        {/* District Labels */}
                        {zoomLevel >= 0.8 && isTargetZone && center.x > 0 && (
                          <text
                            x={center.x}
                            y={center.y}
                            textAnchor="middle"
                            dominantBaseline="central"
                            className="pointer-events-none text-[9px] font-black uppercase tracking-tighter select-none"
                            style={{
                              fill: isSelected || isHovered ? "#ffffff" : "#0f172a",
                              textShadow: isSelected || isHovered
                                ? "0 1px 4px rgba(0, 0, 0, 0.85)"
                                : "0 1px 3px rgba(255, 255, 255, 0.95)"
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

              {/* Floating Tooltip */}
              {hoveredDistrict && (
                <div
                  ref={tooltipRef}
                  className="absolute pointer-events-none select-none z-50 bg-white/95 backdrop-blur-md border border-gray-300 p-3 rounded-xl shadow-xl text-xs text-gray-800 max-w-xs transition-all duration-75"
                  style={{
                    pointerEvents: "none",
                    left: "15px",
                    top: "15px"
                  }}
                >
                  <div className="flex items-center justify-between gap-3 border-b border-gray-200 pb-1.5 mb-1.5">
                    <span className="font-bold text-sm text-gray-900 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-blue-600" />
                      {hoveredDistrict}
                    </span>
                  </div>

                  {districtStats[hoveredDistrict] ? (
                    <div className="space-y-1 font-sans text-[11px]">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Facilities:</span>
                        <span className="font-mono font-bold text-teal-700">{districtStats[hoveredDistrict].facilities.size}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Total Calls:</span>
                        <span className="font-mono font-bold text-blue-700">{districtStats[hoveredDistrict].callsAssigned}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Closed Calls:</span>
                        <span className="font-mono font-bold text-emerald-700">{districtStats[hoveredDistrict].callsCompleted}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">PMS / Calibration:</span>
                        <span className="font-mono font-bold text-indigo-700">{districtStats[hoveredDistrict].pmsCount} / {districtStats[hoveredDistrict].calibrationCount}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Engineers:</span>
                        <span className="font-mono font-bold text-cyan-700">{districtStats[hoveredDistrict].engineers.size}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Managers:</span>
                        <span className="font-mono font-bold text-violet-700">{districtStats[hoveredDistrict].managers.size}</span>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                        <span className="text-gray-600">Total Expense:</span>
                        <span className="font-mono font-bold text-amber-700">₹{districtStats[hoveredDistrict].totalAmount.toLocaleString()}</span>
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
                Heatmap Scale (EXPENSE):
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 font-mono">Min</span>
              <div className="w-32 h-2.5 rounded-full overflow-hidden flex border border-gray-300">
                <div className="w-1/4 h-full bg-[#e0f2fe]" />
                <div className="w-1/4 h-full bg-[#bae6fd]" />
                <div className="w-1/4 h-full bg-[#7dd3fc]" />
                <div className="w-1/4 h-full bg-[#38bdf8]" />
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

                <div className="space-y-3">
                  {/* Detailed Stat Cards */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs">
                      <span className="text-[9px] font-bold text-gray-500 block uppercase flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-teal-600" />
                        Facilities
                      </span>
                      <span className="text-sm font-bold text-teal-700 font-mono">
                        {activeDistrictDetails.facilitiesCount}
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs">
                      <span className="text-[9px] font-bold text-gray-500 block uppercase flex items-center gap-1">
                        <PhoneCall className="w-3 h-3 text-blue-600" />
                        Total Calls
                      </span>
                      <span className="text-sm font-bold text-blue-700 font-mono">
                        {activeDistrictDetails.callsAssigned}
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs">
                      <span className="text-[9px] font-bold text-gray-500 block uppercase flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Closed Calls
                      </span>
                      <span className="text-sm font-bold text-emerald-700 font-mono">
                        {activeDistrictDetails.callsCompleted}
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs">
                      <span className="text-[9px] font-bold text-gray-500 block uppercase flex items-center gap-1">
                        <Wrench className="w-3 h-3 text-indigo-600" />
                        PMS / Calibration
                      </span>
                      <span className="text-xs font-bold text-indigo-700 font-mono">
                        {activeDistrictDetails.pmsCount} / {activeDistrictDetails.calibrationCount}
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs">
                      <span className="text-[9px] font-bold text-gray-500 block uppercase flex items-center gap-1">
                        <Users className="w-3 h-3 text-cyan-600" />
                        Engineers
                      </span>
                      <span className="text-sm font-bold text-cyan-700 font-mono">
                        {activeDistrictDetails.engineersCount}
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs">
                      <span className="text-[9px] font-bold text-gray-500 block uppercase flex items-center gap-1">
                        <UserCheck className="w-3 h-3 text-violet-600" />
                        Managers
                      </span>
                      <span className="text-sm font-bold text-violet-700 font-mono">
                        {activeDistrictDetails.managersCount}
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs">
                      <span className="text-[9px] font-bold text-gray-500 block uppercase flex items-center gap-1">
                        <DollarSign className="w-3 h-3 text-amber-600" />
                        Total Expense
                      </span>
                      <span className="text-sm font-bold text-amber-700 font-mono">
                        ₹{activeDistrictDetails.totalAmount.toLocaleString()}
                      </span>
                    </div>

                    <div className="bg-white p-2.5 rounded-xl border border-gray-200 shadow-2xs">
                      <span className="text-[9px] font-bold text-gray-500 block uppercase flex items-center gap-1">
                        <Calculator className="w-3 h-3 text-amber-600" />
                        Avg / Staff
                      </span>
                      <span className="text-xs font-bold text-amber-700 font-mono">
                        ₹{activeDistrictDetails.avgExpensePerStaff.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Engineers in District */}
                  <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs space-y-2">
                    <span className="text-[11px] font-bold text-gray-700 flex items-center justify-between">
                      <span className="flex items-center gap-1 text-cyan-700">
                        <Users className="w-3.5 h-3.5" />
                        Engineers ({activeDistrictDetails.engineersCount})
                      </span>
                    </span>
                    {activeDistrictDetails.topEngineers.length > 0 ? (
                      <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                        {activeDistrictDetails.topEngineers.map((eng, idx) => (
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
                      <p className="text-xs text-gray-400 m-0">No engineers assigned for active filters</p>
                    )}
                  </div>

                  {/* Managers in District */}
                  <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs space-y-2">
                    <span className="text-[11px] font-bold text-gray-700 flex items-center justify-between">
                      <span className="flex items-center gap-1 text-violet-700">
                        <UserCheck className="w-3.5 h-3.5" />
                        Managers / Coordinators ({activeDistrictDetails.managersCount})
                      </span>
                    </span>
                    {activeDistrictDetails.topManagers.length > 0 ? (
                      <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                        {activeDistrictDetails.topManagers.map((mgr, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs">
                            <span className="text-gray-700 font-medium truncate max-w-[140px]">
                              {mgr.name}
                            </span>
                            <span className="font-mono font-bold text-violet-600">
                              {mgr.amount > 0 ? `₹${mgr.amount.toLocaleString()}` : "Assigned"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 m-0">No managers listed for active filters</p>
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
                    Districts Live Metrics Breakdown
                  </h3>
                </div>

                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                  {Object.entries(districtStats)
                    .filter(([name]) => {
                      if (selectedZoneFilter && selectedZoneFilter !== "all") {
                        return isDistrictInZone(name, selectedZoneFilter);
                      }
                      return true;
                    })
                    .map(([name, s]) => {
                      const engCount = s.engineers.size;
                      const mgrCount = s.managers.size;
                      const totalStaff = engCount + mgrCount;
                      const avgExp = totalStaff > 0 ? Math.round(s.totalAmount / totalStaff) : 0;
                      return {
                        name,
                        amount: s.totalAmount,
                        claimCount: s.claimCount,
                        facilitiesCount: s.facilities.size,
                        engineersCount: engCount,
                        managersCount: mgrCount,
                        callsAssigned: s.callsAssigned,
                        callsCompleted: s.callsCompleted,
                        pmsCount: s.pmsCount,
                        calibrationCount: s.calibrationCount,
                        avgExpensePerStaff: avgExp
                      };
                    })
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
                            <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-mono mt-0.5">
                              <span className="text-teal-600">🏢 {item.facilitiesCount} Fac</span>
                              <span>•</span>
                              <span className="text-cyan-600">👥 {item.engineersCount} Eng</span>
                              <span>•</span>
                              <span className="text-violet-600">👔 {item.managersCount} Mgr</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-right">
                          <div>
                            <span className="text-xs font-mono font-bold text-emerald-600 block">
                              ₹{item.amount.toLocaleString()}
                            </span>
                            <span className="text-[9px] font-mono text-amber-600 block">
                              Avg ₹{item.avgExpensePerStaff.toLocaleString()}/staff
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

          {/* Footer Info */}
          <div className="mt-4 pt-3 border-t border-gray-200 text-[11px] text-gray-500 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Globe className="w-3.5 h-3.5 text-emerald-600" />
              Synced with Active Page Filters
            </span>
            <span className="font-mono text-emerald-600 font-bold">
              {Object.keys(districtStats).length} Active Districts
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default RajasthanMapChart;
