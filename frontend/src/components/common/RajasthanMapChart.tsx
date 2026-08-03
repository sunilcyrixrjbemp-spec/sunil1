import React, { useState, useEffect, useMemo, useRef } from "react";
import api from "../../services/api";
import { getFacilitiesForDistrict, ASSETS_INVENTORY_DISTRICT_FACILITIES } from "../../utils/assetsInventoryMaster";
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
  Globe,
  Building2,
  PhoneCall,
  CheckCircle2,
  Wrench,
  Gauge,
  Calculator,
  AlertTriangle
} from "lucide-react";


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
  const [dynamicFacilitiesMap, setDynamicFacilitiesMap] = useState<Record<string, string[]>>({});

  useEffect(() => {
    api.get("/api/reports/district-facilities-summary")
      .then(res => {
        if (res.data && res.data.success && res.data.facilities_by_district) {
          setDynamicFacilitiesMap(res.data.facilities_by_district);
        }
      })
      .catch(err => {
        console.warn("Could not fetch live district facilities summary from backend:", err);
      });
  }, []);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;

    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (tooltipRef.current) {
      const x = Math.min(500, Math.max(10, mouseX + 15));
      const y = Math.min(380, Math.max(10, mouseY - 15));
      tooltipRef.current.style.left = `${x}px`;
      tooltipRef.current.style.top = `${y}px`;
    }

    // Convert mouse pixel coordinates to SVG viewBox coordinates (760 x 660)
    const svgX = (mouseX / (rect.width || 1)) * 760;
    const svgY = (mouseY / (rect.height || 1)) * 660;

    // Unproject SVG viewBox coordinates back to GeoJSON Lng/Lat
    const [lng, lat] = unproject(svgX, svgY);

    // Test point against all district feature geometries
    let foundDistrict: string | null = null;
    if (geoData?.features) {
      for (const feature of geoData.features) {
        if (isPointInFeatureGeometry([lng, lat], feature.geometry)) {
          const rawDistName = feature.properties.district || feature.properties.dt_nm || "";
          foundDistrict = normalizeDistrict(rawDistName);
          break;
        }
      }
    }

    // Requirement 2d: If point falls in thin gap between polygons (no feature contains it),
    // do NOT clear hoveredDistrict immediately — keep previously hovered district until cursor enters another feature.
    if (foundDistrict) {
      setHoveredDistrict(foundDistrict);
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

    expenses.forEach((e) => {
      const rawDist = e.district || e.submitter_district || e.home_district || e.work_location || e.location || e.destination || e.city;
      if (!rawDist) return;
      const dist = normalizeDistrict(rawDist);
      if (!dist) return;

      if (!stats[dist]) {
        const liveBackendFacs = dynamicFacilitiesMap[dist] || dynamicFacilitiesMap[normalizeDistrict(dist)] || getFacilitiesForDistrict(dist);
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
          facilities: new Set(liveBackendFacs),
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

      stats[dist].totalAmount += amt;
      stats[dist].claimCount += 1;
      stats[dist].callsAssigned += Number(e.calls_assigned || 0);
      stats[dist].callsCompleted += Number(e.calls_completed || 0);
      stats[dist].pmsCount += Number(e.pms_count || 0);
      stats[dist].calibrationCount += Number(e.calibration_count || 0);

      // Authentic Comprehensive Database Facility Extraction
      const addFacIfValid = (str: any) => {
        if (typeof str !== "string") return;
        const clean = str.trim();
        if (!clean) return;
        const lower = clean.toLowerCase();
        if (
          lower === "—" ||
          lower === "-" ||
          lower === "n/a" ||
          lower === "na" ||
          lower === "none" ||
          lower === "null" ||
          lower === "undefined" ||
          lower === dist.toLowerCase() ||
          lower === "all" ||
          lower === "unassigned" ||
          lower === "base"
        ) {
          return;
        }
        stats[dist].facilities.add(clean);
      };

      // 1. Direct Facility / Hospital / Destination Fields
      addFacIfValid(e.facility);
      addFacIfValid(e.facility_name);
      addFacIfValid(e.hospital_name);
      addFacIfValid(e.hospital);
      addFacIfValid(e.location_visited);
      addFacIfValid(e.site);
      addFacIfValid(e.place);
      addFacIfValid(e.destination);
      addFacIfValid(e.to);
      addFacIfValid(e.work_location);

      // 2. Travel Legs / Itinerary Details Sub-Arrays
      const legs = Array.isArray(e.itinerary_details) ? e.itinerary_details : (Array.isArray(e.travel_legs) ? e.travel_legs : (Array.isArray(e.legs) ? e.legs : []));
      legs.forEach((leg: any) => {
        if (!leg) return;
        addFacIfValid(leg.destination);
        addFacIfValid(leg.to);
        addFacIfValid(leg.hospital);
        addFacIfValid(leg.hospital_name);
        addFacIfValid(leg.facility);
        addFacIfValid(leg.facility_name);
        addFacIfValid(leg.location);
      });

      // 3. Asset Tagging & Call Asset Sub-Arrays
      if (Array.isArray(e.tagging_details)) {
        e.tagging_details.forEach((td: any) => {
          if (!td) return;
          addFacIfValid(td.hospital);
          addFacIfValid(td.hospital_name);
          addFacIfValid(td.facility);
          addFacIfValid(td.facility_name);
          addFacIfValid(td.site);
        });
      }
      if (Array.isArray(e.calls_details)) {
        e.calls_details.forEach((cd: any) => {
          if (!cd) return;
          addFacIfValid(cd.hospital_name);
          addFacIfValid(cd.hospital);
          addFacIfValid(cd.facility);
        });
      }

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

  // Overall Statewide / Zone / District Aggregates for Top KPI Bar
  const summaryStats = useMemo(() => {
    let totalExpense = 0;
    let totalCallsAssigned = 0;
    let totalCallsCompleted = 0;
    let totalPms = 0;
    let totalCalibration = 0;
    const allFacilities = new Set<string>();
    const allEngineers = new Set<string>();
    const allManagers = new Set<string>();

    // 1. Add all master inventory facilities according to active zone & district filters
    const masterSource = Object.keys(dynamicFacilitiesMap).length > 0 ? dynamicFacilitiesMap : ASSETS_INVENTORY_DISTRICT_FACILITIES;
    Object.entries(masterSource).forEach(([distName, facs]) => {
      if (selectedZoneFilter && selectedZoneFilter !== "all") {
        if (!isDistrictInZone(distName, selectedZoneFilter)) return;
      }
      if (selectedDistrictFilter && selectedDistrictFilter !== "all") {
        if (normalizeDistrict(distName) !== normalizeDistrict(selectedDistrictFilter)) return;
      }
      facs.forEach(f => allFacilities.add(f));
    });

    // 2. Add live district stats & expense facilities
    Object.entries(districtStats).forEach(([distName, s]) => {
      if (selectedZoneFilter && selectedZoneFilter !== "all") {
        if (!isDistrictInZone(distName, selectedZoneFilter)) return;
      }
      if (selectedDistrictFilter && selectedDistrictFilter !== "all") {
        if (normalizeDistrict(distName) !== normalizeDistrict(selectedDistrictFilter)) return;
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
  }, [districtStats, dynamicFacilitiesMap, selectedZoneFilter, selectedDistrictFilter]);

  // Compute max expense amount for district color choropleth
  const maxExpense = useMemo(() => {
    let maxAmt = 0;
    Object.values(districtStats).forEach((s) => {
      if (s.totalAmount > maxAmt) maxAmt = s.totalAmount;
    });
    return maxAmt || 1;
  }, [districtStats]);

  // Color generator for Choropleth Map (Premium gradient blue heatmap)
  const getDistrictColor = (districtName: string, isSelected: boolean, isHovered: boolean, isTargetZone: boolean) => {
    const norm = normalizeDistrict(districtName);
    const stat = districtStats[norm];

    if (isSelected) return "#1d4ed8"; // Strong royal blue for selected
    if (isHovered) return "#3b82f6"; // Bright sky blue on hover

    if (!isTargetZone) return "#e2e8f0"; // Subtle grey for out-of-zone

    if (!stat || stat.totalAmount === 0) {
      return "#f0f9ff"; // Very light azure for zero districts
    }

    const ratio = Math.min(1, stat.totalAmount / maxExpense);
    if (ratio < 0.2)  return "#dbeafe"; // Pale indigo-blue
    if (ratio < 0.4)  return "#bfdbfe"; // Soft blue
    if (ratio < 0.6)  return "#93c5fd"; // Medium blue
    if (ratio < 0.8)  return "#60a5fa"; // Sky blue
    return "#2563eb";                   // Deep primary blue – max spend
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

  // Inverse Projection helper: SVG (x, y) -> Lng/Lat
  const unproject = (svgX: number, svgY: number, width = 760, height = 660, padding = 30) => {
    const { minLng, maxLng, minLat, maxLat } = bounds;
    const innerW = width - padding * 2;
    const innerH = height - padding * 2;

    const lng = minLng + ((svgX - padding) / (innerW || 1)) * (maxLng - minLng);
    const lat = minLat + ((height - svgY - padding) / (innerH || 1)) * (maxLat - minLat);
    return [lng, lat];
  };

  // Ray-Casting Point-in-Polygon helper for GeoJSON geometries
  const isPointInRing = (pt: [number, number], ring: number[][]): boolean => {
    const [x, y] = pt;
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];

      const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-10) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const isPointInFeatureGeometry = (pt: [number, number], geometry: any): boolean => {
    const { type, coordinates } = geometry;
    if (!coordinates || coordinates.length === 0) return false;

    if (type === "Polygon") {
      const outerRing = coordinates[0];
      if (!isPointInRing(pt, outerRing)) return false;
      for (let h = 1; h < coordinates.length; h++) {
        if (isPointInRing(pt, coordinates[h])) return false;
      }
      return true;
    } else if (type === "MultiPolygon") {
      for (let p = 0; p < coordinates.length; p++) {
        const poly = coordinates[p];
        const outerRing = poly[0];
        if (isPointInRing(pt, outerRing)) {
          let inHole = false;
          for (let h = 1; h < poly.length; h++) {
            if (isPointInRing(pt, poly[h])) {
              inHole = true;
              break;
            }
          }
          if (!inHole) return true;
        }
      }
    }
    return false;
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
      className="border-0 bg-white text-gray-800 shadow-lg rounded-none overflow-hidden"
      style={{ boxShadow: "0 4px 32px 0 rgba(30,64,175,0.08), 0 1px 4px 0 rgba(0,0,0,0.06)" }}
      bodyStyle={{ padding: 0 }}
    >
      {/* Premium Header Bar */}
      <div
        style={{
          background: "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 45%, #0ea5e9 100%)",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-none bg-white/20 flex items-center justify-center">
            <Globe className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-blue-200 uppercase tracking-widest m-0">Rajasthan State</p>
            <h2 className="text-base font-extrabold text-white m-0 leading-tight">District Analytics Map</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold text-blue-100 bg-white/15 px-2.5 py-1 rounded-none border border-white/20">
            {Object.keys(districtStats).length} Active Districts
          </span>
          <span className="text-[11px] font-semibold text-white bg-emerald-500/80 px-2.5 py-1 rounded-none">
            Live Data
          </span>
        </div>
      </div>


      {/* Statewide / Zone KPI Summary Bar (8 Live Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3.5 bg-slate-50/90 border-b border-slate-200">
        {/* 1. Total Facilities */}
        <div className="bg-white p-3 rounded-none border border-slate-200 shadow-2xs hover:shadow-md transition-all duration-200 flex items-center justify-between gap-3">
          <div className="w-10 h-10 rounded-none bg-teal-600 flex items-center justify-center text-white shrink-0 shadow-xs">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Facilities</span>
              <span className="text-[8.5px] font-bold text-teal-700 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded-none font-mono shrink-0">Locations</span>
            </div>
            <span className="text-lg font-mono font-extrabold text-slate-900 leading-none block">{summaryStats.totalFacilities}</span>
          </div>
        </div>

        {/* 2. Total Calls */}
        <div className="bg-white p-3 rounded-none border border-slate-200 shadow-2xs hover:shadow-md transition-all duration-200 flex items-center justify-between gap-3">
          <div className="w-10 h-10 rounded-none bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-xs">
            <PhoneCall className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Calls</span>
              <span className="text-[8.5px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-none font-mono shrink-0">Assigned</span>
            </div>
            <span className="text-lg font-mono font-extrabold text-slate-900 leading-none block">{summaryStats.totalCallsAssigned}</span>
          </div>
        </div>

        {/* 3. Closed Calls */}
        <div className="bg-white p-3 rounded-none border border-slate-200 shadow-2xs hover:shadow-md transition-all duration-200 flex items-center justify-between gap-3">
          <div className="w-10 h-10 rounded-none bg-emerald-600 flex items-center justify-center text-white shrink-0 shadow-xs">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Closed Calls</span>
              <span className="text-[8.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-none font-mono shrink-0">Completed</span>
            </div>
            <span className="text-lg font-mono font-extrabold text-emerald-700 leading-none block">{summaryStats.totalCallsCompleted}</span>
          </div>
        </div>

        {/* 4. PMS Count */}
        <div className="bg-white p-3 rounded-none border border-slate-200 shadow-2xs hover:shadow-md transition-all duration-200 flex items-center justify-between gap-3">
          <div className="w-10 h-10 rounded-none bg-indigo-600 flex items-center justify-center text-white shrink-0 shadow-xs">
            <Wrench className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">PMS Done</span>
              <span className="text-[8.5px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-none font-mono shrink-0">PMS Calls</span>
            </div>
            <span className="text-lg font-mono font-extrabold text-indigo-700 leading-none block">{summaryStats.totalPms}</span>
          </div>
        </div>

        {/* 5. Calibration */}
        <div className="bg-white p-3 rounded-none border border-slate-200 shadow-2xs hover:shadow-md transition-all duration-200 flex items-center justify-between gap-3">
          <div className="w-10 h-10 rounded-none bg-purple-600 flex items-center justify-center text-white shrink-0 shadow-xs">
            <Gauge className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Calibration</span>
              <span className="text-[8.5px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded-none font-mono shrink-0">Calibrations</span>
            </div>
            <span className="text-lg font-mono font-extrabold text-purple-700 leading-none block">{summaryStats.totalCalibration}</span>
          </div>
        </div>

        {/* 6. Engineers */}
        <div className="bg-white p-3 rounded-none border border-slate-200 shadow-2xs hover:shadow-md transition-all duration-200 flex items-center justify-between gap-3">
          <div className="w-10 h-10 rounded-none bg-cyan-600 flex items-center justify-center text-white shrink-0 shadow-xs">
            <Users className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Engineers</span>
              <span className="text-[8.5px] font-bold text-cyan-700 bg-cyan-50 border border-cyan-200 px-1.5 py-0.5 rounded-none font-mono shrink-0">Field Staff</span>
            </div>
            <span className="text-lg font-mono font-extrabold text-slate-900 leading-none block">{summaryStats.totalEngineers}</span>
          </div>
        </div>

        {/* 7. Managers */}
        <div className="bg-white p-3 rounded-none border border-slate-200 shadow-2xs hover:shadow-md transition-all duration-200 flex items-center justify-between gap-3">
          <div className="w-10 h-10 rounded-none bg-violet-600 flex items-center justify-center text-white shrink-0 shadow-xs">
            <UserCheck className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Managers</span>
              <span className="text-[8.5px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-1.5 py-0.5 rounded-none font-mono shrink-0">Team Leads</span>
            </div>
            <span className="text-lg font-mono font-extrabold text-slate-900 leading-none block">{summaryStats.totalManagers}</span>
          </div>
        </div>

        {/* 8. Avg / Staff */}
        <div className="bg-white p-3 rounded-none border border-slate-200 shadow-2xs hover:shadow-md transition-all duration-200 flex items-center justify-between gap-3">
          <div className="w-10 h-10 rounded-none bg-amber-600 flex items-center justify-center text-white shrink-0 shadow-xs">
            <Calculator className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Avg / Staff</span>
              <span className="text-[8.5px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-none font-mono shrink-0">Per Staff</span>
            </div>
            <span className="text-[15px] font-mono font-extrabold text-amber-700 leading-none block">₹{summaryStats.avgExpensePerEngineer.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Map Content Body */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 relative">
        {/* Main Map Viewer Canvas */}
        <div
          className="lg:col-span-8 flex flex-col relative overflow-hidden"
          style={{ background: "linear-gradient(160deg, #f0f6ff 0%, #f8fafc 60%, #eef2ff 100%)" }}
        >
          {/* Top Floating Tools: Search + Zoom */}
          <div className="flex justify-between items-center px-4 pt-4 pb-2 gap-2">
            <div className="relative w-52 md:w-72">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-blue-400" />
              <input
                type="text"
                placeholder="Search district..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-blue-200 rounded-none text-gray-800 placeholder-gray-400 focus:outline-none focus:border-blue-500 transition shadow-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Map Controls */}
            <div className="flex items-center gap-0.5 bg-white border border-blue-200 shadow-sm">
              <button
                onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
                className="p-2 text-blue-600 hover:bg-blue-50 transition"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <div className="w-px h-5 bg-blue-100" />
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.8, z - 0.25))}
                className="p-2 text-blue-600 hover:bg-blue-50 transition"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <div className="w-px h-5 bg-blue-100" />
              <button
                onClick={() => {
                  setZoomLevel(1);
                  setPanOffset({ x: 0, y: 0 });
                  setSelectedDistrict(null);
                  if (onSelectDistrict) onSelectDistrict(null);
                }}
                className="p-2 text-slate-500 hover:bg-slate-50 transition"
                title="Reset View"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* SVG Map Render */}
          {loadingMap ? (
            <div className="flex flex-col items-center justify-center" style={{ height: 540 }}>
              <div
                className="w-12 h-12 mb-4"
                style={{
                  border: "4px solid #dbeafe",
                  borderTopColor: "#1d4ed8",
                  borderRadius: "0",
                  animation: "spin 0.8s linear infinite"
                }}
              />
              <p className="text-sm font-semibold text-blue-700">Loading Rajasthan Map...</p>
              <p className="text-xs text-gray-400 mt-1">Fetching GeoJSON District Boundaries</p>
            </div>
          ) : errorMap ? (
            <div className="flex flex-col items-center justify-center" style={{ height: 540 }}>
              <AlertTriangle className="w-10 h-10 text-rose-500 mb-2" />
              <p className="text-sm font-bold text-rose-600">{errorMap}</p>
            </div>
          ) : (
            <div
              className="relative mx-4 mb-2 overflow-hidden"
              style={{
                height: 540,
                border: "1px solid #dbeafe",
                background: "linear-gradient(135deg, #eff6ff 0%, #f8fafc 50%, #f0fdf4 100%)"
              }}
            >
              <svg
                ref={svgRef}
                viewBox="0 0 760 520"
                className="w-full h-full cursor-grab active:cursor-grabbing"
                style={{
                  transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`,
                  transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)"
                }}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoveredDistrict(null)}
              >
                {/* Subtle grid / watermark */}
                <defs>
                  <filter id="districtShadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#1e40af" floodOpacity="0.15" />
                  </filter>
                </defs>

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

                    const pathD = renderPath(feature, 760, 520, 20);
                    const center = getFeatureCenter(feature, 760, 520, 20);
                    const fillColor = getDistrictColor(distName, isSelected, isHovered, isTargetZone);

                    return (
                      <g
                        key={idx}
                        style={{
                          opacity: !isTargetZone ? 0.3 : 1,
                          transition: "opacity 0.2s ease"
                        }}
                      >
                        <path
                          d={pathD}
                          fill={fillColor}
                          stroke={
                            isMatchingSearch
                              ? "#f59e0b"
                              : isSelected
                              ? "#1e40af"
                              : isHovered
                              ? "#3b82f6"
                              : isTargetZone
                              ? "#93c5fd"
                              : "#cbd5e1"
                          }
                          strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 0.8}
                          strokeLinejoin="round"
                          className="cursor-pointer"
                          style={{
                            pointerEvents: "visiblePainted",
                            transition: "fill 0.18s ease, stroke-width 0.15s ease",
                            filter: isSelected
                              ? "drop-shadow(0 3px 10px rgba(29,78,216,0.35))"
                              : isHovered
                              ? "drop-shadow(0 2px 7px rgba(59,130,246,0.3))"
                              : "none"
                          }}
                          onMouseEnter={() => setHoveredDistrict(norm)}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.preventDefault();
                            handleDistrictClick(distName);
                          }}
                        />

                        {/* District Labels */}
                        {zoomLevel >= 0.8 && isTargetZone && center.x > 0 && (
                          <text
                            x={center.x}
                            y={center.y}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fontSize={isSelected || isHovered ? 9.5 : 8.5}
                            fontWeight={isSelected || isHovered ? "900" : "700"}
                            letterSpacing="0.3"
                            className="pointer-events-none select-none"
                            style={{
                              fill: isSelected
                                ? "#ffffff"
                                : isHovered
                                ? "#1e3a8a"
                                : districtStats[norm]?.totalAmount > 0
                                ? "#1e3a8a"
                                : "#64748b",
                              textShadow: isSelected
                                ? "0 1px 5px rgba(0,0,0,0.8)"
                                : "0 1px 2px rgba(255,255,255,0.9)",
                              transition: "font-size 0.1s ease"
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
                  className="absolute pointer-events-none select-none z-50 text-xs"
                  style={{
                    pointerEvents: "none",
                    left: "16px",
                    top: "16px",
                    background: "rgba(255,255,255,0.97)",
                    backdropFilter: "blur(12px)",
                    border: "1px solid #bfdbfe",
                    boxShadow: "0 8px 32px rgba(29,78,216,0.15)",
                    minWidth: 180,
                    maxWidth: 230,
                    padding: "10px 12px"
                  }}
                >
                  <div
                    style={{
                      background: "linear-gradient(90deg, #1d4ed8, #3b82f6)",
                      margin: "-10px -12px 8px -12px",
                      padding: "6px 12px",
                      display: "flex",
                      alignItems: "center",
                      gap: 6
                    }}
                  >
                    <MapPin className="w-3.5 h-3.5 text-white" />
                    <span className="font-bold text-white text-[11px] tracking-wide">{hoveredDistrict}</span>
                  </div>

                  {districtStats[hoveredDistrict] ? (
                    <div className="space-y-1 text-[10.5px]">
                      {[
                        { label: "Facilities", val: districtStats[hoveredDistrict].facilities.size, color: "text-teal-700" },
                        { label: "Total Calls", val: districtStats[hoveredDistrict].callsAssigned, color: "text-blue-700" },
                        { label: "Closed Calls", val: districtStats[hoveredDistrict].callsCompleted, color: "text-emerald-700" },
                        { label: "PMS / Calibration", val: `${districtStats[hoveredDistrict].pmsCount} / ${districtStats[hoveredDistrict].calibrationCount}`, color: "text-indigo-700" },
                        { label: "Engineers", val: districtStats[hoveredDistrict].engineers.size, color: "text-cyan-700" },
                        { label: "Managers", val: districtStats[hoveredDistrict].managers.size, color: "text-violet-700" },
                      ].map((row, ri) => (
                        <div key={ri} className="flex justify-between items-center">
                          <span className="text-gray-500">{row.label}:</span>
                          <span className={`font-mono font-bold ${row.color}`}>{row.val}</span>
                        </div>
                      ))}
                      <div className="flex justify-between items-center pt-1 mt-1" style={{ borderTop: "1px solid #e2e8f0" }}>
                        <span className="text-gray-500">Total Expense:</span>
                        <span className="font-mono font-bold text-amber-700">₹{districtStats[hoveredDistrict].totalAmount.toLocaleString()}</span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-400 text-[10px] m-0">No records for active filters.</p>
                  )}
                </div>
              )}

              {/* Zoom Level Badge */}
              <div
                className="absolute bottom-3 right-3 text-[10px] font-mono font-bold text-blue-600 bg-white border border-blue-200 px-2 py-0.5 select-none"
                style={{ boxShadow: "0 1px 4px rgba(29,78,216,0.12)" }}
              >
                {Math.round(zoomLevel * 100)}%
              </div>
            </div>
          )}

          {/* Choropleth Legend */}
          <div
            className="mx-4 mb-4 flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
            style={{
              background: "linear-gradient(to right, #f8fafc, #f0f6ff)",
              border: "1px solid #dbeafe"
            }}
          >
            <span className="text-[10px] font-bold text-slate-600 flex items-center gap-1.5 uppercase tracking-wider">
              <Layers className="w-3 h-3 text-blue-500" />
              Expense Heatmap
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-gray-400 font-mono">Low</span>
              <div className="flex overflow-hidden border border-blue-200" style={{ width: 120, height: 10 }}>
                <div style={{ flex: 1, background: "#dbeafe" }} />
                <div style={{ flex: 1, background: "#bfdbfe" }} />
                <div style={{ flex: 1, background: "#93c5fd" }} />
                <div style={{ flex: 1, background: "#60a5fa" }} />
                <div style={{ flex: 1, background: "#2563eb" }} />
              </div>
              <span className="text-[9px] text-gray-400 font-mono">High</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div style={{ width: 10, height: 10, background: "#e2e8f0", border: "1px solid #cbd5e1" }} />
                <span className="text-[9px] text-gray-400">No Activity</span>
              </div>
              <div className="flex items-center gap-1">
                <div style={{ width: 10, height: 10, background: "#1d4ed8", border: "1px solid #1e40af" }} />
                <span className="text-[9px] text-gray-400">Selected</span>
              </div>
              <div className="flex items-center gap-1">
                <div style={{ width: 10, height: 10, background: "#f59e0b", border: "1px solid #d97706" }} />
                <span className="text-[9px] text-gray-400">Search Match</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side District Deep-Dive & Leaderboard Panel */}
        <div
          className="lg:col-span-4 flex flex-col"
          style={{ background: "#f8faff", borderLeft: "1px solid #dbeafe" }}
        >
          {/* Panel Header */}
          <div
            style={{
              background: "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)",
              padding: "12px 16px"
            }}
          >
            {activeDistrictDetails ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-bold text-blue-200 uppercase tracking-widest m-0">
                    {selectedDistrict ? "Selected District" : "Hovered District"}
                  </p>
                  <h3 className="text-sm font-extrabold text-white m-0 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-300" />
                    {activeDistrictDetails.name}
                  </h3>
                </div>
                {selectedDistrict && (
                  <button
                    onClick={() => handleDistrictClick(selectedDistrict)}
                    className="p-1 text-blue-200 hover:text-white hover:bg-white/10 transition"
                    title="Clear selection"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-blue-300" />
                <div>
                  <p className="text-[9px] font-bold text-blue-200 uppercase tracking-widest m-0">District Intelligence</p>
                  <h3 className="text-sm font-extrabold text-white m-0">Live Metrics Leaderboard</h3>
                </div>
              </div>
            )}
          </div>

          {/* Panel Scroll Body */}
          <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: "calc(540px + 68px)" }}>
            {activeDistrictDetails ? (
              <div className="space-y-3">
                {/* Stat Grid */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Facilities", val: activeDistrictDetails.facilitiesCount, icon: <Building2 className="w-3 h-3" />, color: "teal" },
                    { label: "Total Calls", val: activeDistrictDetails.callsAssigned, icon: <PhoneCall className="w-3 h-3" />, color: "blue" },
                    { label: "Closed Calls", val: activeDistrictDetails.callsCompleted, icon: <CheckCircle2 className="w-3 h-3" />, color: "emerald" },
                    { label: "PMS / Cal", val: `${activeDistrictDetails.pmsCount}/${activeDistrictDetails.calibrationCount}`, icon: <Wrench className="w-3 h-3" />, color: "indigo" },
                    { label: "Engineers", val: activeDistrictDetails.engineersCount, icon: <Users className="w-3 h-3" />, color: "cyan" },
                    { label: "Managers", val: activeDistrictDetails.managersCount, icon: <UserCheck className="w-3 h-3" />, color: "violet" },
                    { label: "Total Expense", val: `₹${activeDistrictDetails.totalAmount.toLocaleString()}`, icon: <DollarSign className="w-3 h-3" />, color: "amber" },
                    { label: "Avg / Staff", val: `₹${activeDistrictDetails.avgExpensePerStaff.toLocaleString()}`, icon: <Calculator className="w-3 h-3" />, color: "orange" },
                  ].map((stat, si) => (
                    <div
                      key={si}
                      className="bg-white p-2.5 border border-blue-100 hover:border-blue-300 transition-all duration-150"
                      style={{ boxShadow: "0 1px 3px rgba(29,78,216,0.06)" }}
                    >
                      <span className={`text-[9px] font-bold text-${stat.color}-600 flex items-center gap-1 uppercase tracking-wider mb-1`}>
                        {stat.icon}{stat.label}
                      </span>
                      <span className={`text-sm font-extrabold font-mono text-${stat.color}-700 leading-none block`}>
                        {stat.val}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Engineers */}
                <div className="bg-white border border-blue-100 p-3">
                  <p className="text-[10px] font-bold text-cyan-700 flex items-center gap-1 uppercase tracking-wider mb-2 m-0">
                    <Users className="w-3 h-3" /> Engineers ({activeDistrictDetails.engineersCount})
                  </p>
                  {activeDistrictDetails.topEngineers.length > 0 ? (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {activeDistrictDetails.topEngineers.map((eng, idx) => (
                        <div key={idx} className="flex justify-between items-center text-[11px]">
                          <span className="text-gray-700 font-medium truncate max-w-[130px]">{eng.name}</span>
                          <span className="font-mono font-bold text-emerald-600 shrink-0">₹{eng.amount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-400 m-0">No engineers for active filters</p>
                  )}
                </div>

                {/* Managers */}
                <div className="bg-white border border-blue-100 p-3">
                  <p className="text-[10px] font-bold text-violet-700 flex items-center gap-1 uppercase tracking-wider mb-2 m-0">
                    <UserCheck className="w-3 h-3" /> Managers ({activeDistrictDetails.managersCount})
                  </p>
                  {activeDistrictDetails.topManagers.length > 0 ? (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {activeDistrictDetails.topManagers.map((mgr, idx) => (
                        <div key={idx} className="flex justify-between items-center text-[11px]">
                          <span className="text-gray-700 font-medium truncate max-w-[130px]">{mgr.name}</span>
                          <span className="font-mono font-bold text-violet-600 shrink-0">
                            {mgr.amount > 0 ? `₹${mgr.amount.toLocaleString()}` : "Assigned"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[10px] text-gray-400 m-0">No managers for active filters</p>
                  )}
                </div>
              </div>
            ) : (
              /* District Leaderboard */
              <div className="space-y-2">
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
                      facilitiesCount: s.facilities.size,
                      engineersCount: engCount,
                      managersCount: mgrCount,
                      callsAssigned: s.callsAssigned,
                      callsCompleted: s.callsCompleted,
                      avgExpensePerStaff: avgExp
                    };
                  })
                  .sort((a, b) => b.amount - a.amount)
                  .map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleDistrictClick(item.name)}
                      className="bg-white cursor-pointer group transition-all duration-150"
                      style={{
                        border: "1px solid #dbeafe",
                        padding: "10px 12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        boxShadow: "0 1px 3px rgba(29,78,216,0.05)"
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#93c5fd"; e.currentTarget.style.background = "#f0f6ff"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#dbeafe"; e.currentTarget.style.background = "#ffffff"; }}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="text-[10px] font-extrabold font-mono text-white flex items-center justify-center shrink-0"
                          style={{
                            width: 20, height: 20,
                            background: idx < 3
                              ? ["#1d4ed8", "#2563eb", "#3b82f6"][idx]
                              : "#94a3b8"
                          }}
                        >
                          {idx + 1}
                        </span>
                        <div>
                          <span className="text-[11px] font-bold text-slate-800 group-hover:text-blue-700 transition block">
                            {item.name}
                          </span>
                          <div className="flex items-center gap-1 text-[9px] text-gray-500 font-mono mt-0.5">
                            <span className="text-teal-600">{item.facilitiesCount}F</span>
                            <span className="text-gray-300">•</span>
                            <span className="text-cyan-600">{item.engineersCount}E</span>
                            <span className="text-gray-300">•</span>
                            <span className="text-violet-600">{item.managersCount}M</span>
                            <span className="text-gray-300">•</span>
                            <span className="text-emerald-600">{item.callsCompleted}/{item.callsAssigned} Calls</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] font-mono font-bold text-blue-700 block">
                          ₹{item.amount.toLocaleString()}
                        </span>
                        <span className="text-[9px] font-mono text-amber-600">
                          ₹{item.avgExpensePerStaff.toLocaleString()}/staff
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Panel Footer */}
          <div
            className="px-4 py-2.5 text-[10px] flex items-center justify-between"
            style={{ borderTop: "1px solid #dbeafe", background: "#f0f6ff" }}
          >
            <span className="flex items-center gap-1 text-blue-600 font-semibold">
              <Globe className="w-3 h-3" />
              Synced with Page Filters
            </span>
            <span className="font-mono font-bold text-blue-700">
              {Object.keys(districtStats).length} Districts
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default RajasthanMapChart;
