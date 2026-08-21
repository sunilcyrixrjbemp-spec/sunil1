import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Package,
  Wrench,
  Search,
  ShieldCheck,
  Cog,
  Plus,
  RefreshCw,
  Send,
  ChevronRight,
  Activity,
  Layers,
  Check,
  Database,
  Truck,
  Download,
  CheckCircle2,
  Unlock,
  Clock,
  Filter,
  Building2,
  Zap
} from "lucide-react";
import {
  trcService,
  TRCMachine,
  TRCStats
} from "../services/trcService";
import MachineDetailsStickyCard from "../components/trc/MachineDetailsStickyCard";
import TRCTimeline from "../components/trc/TRCTimeline";
import MediaUploadSection from "../components/trc/MediaUploadSection";
import DiagnosisModal from "../components/trc/DiagnosisModal";
import SpareRequestModal from "../components/trc/SpareRequestModal";
import RepairFormModal from "../components/trc/RepairFormModal";
import QCInspectionModal from "../components/trc/QCInspectionModal";
import AssignmentModal from "../components/trc/AssignmentModal";
import DispatchModal from "../components/trc/DispatchModal";
import JobCardPrintModal from "../components/trc/JobCardPrintModal";
import { toast } from "react-hot-toast";
import { Tag } from "antd";

const ACCESSORY_OPTIONS = [
  "Adapter",
  "Probe",
  "Cable",
  "Battery",
  "Manual",
  "Others"
];

const CONDITION_OPTIONS = [
  { value: "Good", label: "Good / Intact", desc: "Chassis and ports intact" },
  { value: "Damaged", label: "Physical Damage", desc: "Casing cracked or bent ports" },
  { value: "Broken", label: "Severe Breakdown", desc: "Circuit burnt or heavy damage" },
  { value: "Missing Accessories", label: "Missing Accessories", desc: "Power cord / probes missing" }
];

const DEFAULT_EQUIPMENT_LIST = [
  "ECG Machine",
  "Multipara Monitor",
  "Defibrillator",
  "Ventilator",
  "Infusion Pump",
  "Syringe Pump",
  "Suction Apparatus",
  "Cautery / Electrosurgical Unit",
  "Nebulizer",
  "Pulse Oximeter",
  "Baby Warmer",
  "Phototherapy Unit",
  "Centrifuge",
  "Microscope",
  "Autoclave",
  "X-Ray Machine",
  "Ultrasound Machine",
  "Fogging Machine",
  "Biomedical Equipment Unit"
];

const DEFAULT_MAKE_LIST = [
  "BPL Medical",
  "Philips Healthcare",
  "GE Healthcare",
  "Mindray",
  "Nihon Kohden",
  "Contec",
  "Schiller",
  "Dräger",
  "Fresenius",
  "Olympus",
  "B-Braun",
  "Skanray",
  "Fisher & Paykel",
  "Trivitron",
  "Allengers",
  "Medtronic",
  "Siemens Healthineers",
  "Cyrix Biomedical"
];

const PRIOR_STATUS_OPTIONS = [
  { value: "Breakdown / Not Working", label: "🔴 Breakdown / Major Non-Functional" },
  { value: "Physical Damage / Broken Casing", label: "🟠 Physical Damage / Broken Casing" },
  { value: "Burnt Circuit / Component Fault", label: "🟡 Component Failure / Burnt Circuit" },
  { value: "Calibration Error / Inaccurate Readings", label: "🔵 Calibration Error / Inaccurate Readings" },
  { value: "Intermittent Power Fault / Trips", label: "🟣 Intermittent Power Fault / Trips" },
  { value: "Routine Preventive Maintenance / Overhaul", label: "🟢 Routine Preventive Maintenance / Overhaul" },
  { value: "Missing Accessories / Power Cord Issue", label: "⚪ Missing Accessories / Power Cord Issue" }
];

// Helper: Calculate Machine Days in TRC
export const calculateDaysInTRC = (receiveDate?: string) => {
  if (!receiveDate) return 0;
  try {
    const today = new Date().setHours(0, 0, 0, 0);
    const diff = today - new Date(receiveDate).setHours(0, 0, 0, 0);
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  } catch {
    return 0;
  }
};

// Helper: Get Badge Color for Aging
export const getAgingBadgeStyle = (days: number) => {
  if (days <= 3) return { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", label: "Fresh", dot: "bg-emerald-500" };
  if (days <= 7) return { bg: "bg-blue-50 text-blue-700 border-blue-200", label: "Normal", dot: "bg-blue-500" };
  if (days <= 14) return { bg: "bg-amber-50 text-amber-800 border-amber-300", label: "Aging", dot: "bg-amber-500" };
  return { bg: "bg-rose-50 text-rose-800 border-rose-300 animate-pulse font-bold", label: "Critical Delay", dot: "bg-rose-600" };
};

// TRC Status Tag (Expense-style Ant Design Tags)
const renderTRCStatusTag = (status: string) => {
  const s = (status || "").toLowerCase().trim();
  if (s.includes("received")) return <Tag color="processing" className="font-bold text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wide">Received</Tag>;
  if (s.includes("assigned")) return <Tag color="processing" className="font-bold text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wide">Assigned</Tag>;
  if (s.includes("diagnosis")) return <Tag color="purple" className="font-bold text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wide">Diagnosis</Tag>;
  if (s.includes("waiting")) return <Tag color="warning" className="font-bold text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wide">Waiting Spares</Tag>;
  if (s.includes("repair in")) return <Tag color="orange" className="font-bold text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wide">Repair Active</Tag>;
  if (s.includes("repair completed")) return <Tag color="cyan" className="font-bold text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wide">Repair Done</Tag>;
  if (s.includes("qc")) return <Tag color="geekblue" className="font-bold text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wide">QC Certified</Tag>;
  if (s.includes("ready") || s.includes("dispatch")) return <Tag color="success" className="font-bold text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wide">Ready Dispatch</Tag>;
  if (s.includes("dispatched")) return <Tag color="success" className="font-bold text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wide">Dispatched</Tag>;
  if (s.includes("closed")) return <Tag color="default" className="font-bold text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wide">Closed</Tag>;
  return <Tag className="font-bold text-xs px-2.5 py-0.5 rounded-full uppercase tracking-wide">{status || "Draft"}</Tag>;
};

export default function TRCModulePage() {
  let currentUser: any = {};
  try {
    currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  } catch (_) {}

  const isCoordinatorOrAdmin = [
    "Admin", "Coordinator", "Manager", "Division Manager", "Project Head", "VP"
  ].includes(currentUser.role || "");

  // Database-driven location hierarchy & equipment catalogue
  const [dbZones, setDbZones] = useState<string[]>([]);
  const [dbDistricts, setDbDistricts] = useState<string[]>([]);
  const [dbDistrictsByZone, setDbDistrictsByZone] = useState<Record<string, string[]>>({});
  const [dbFacilitiesByDistrict, setDbFacilitiesByDistrict] = useState<Record<string, string[]>>({});
  const [dbEquipments, setDbEquipments] = useState<string[]>(DEFAULT_EQUIPMENT_LIST);
  const [dbMakes, setDbMakes] = useState<string[]>(DEFAULT_MAKE_LIST);
  const [dbHospitalMapping, setDbHospitalMapping] = useState<Record<string, { di_name?: string; coordinator_name?: string; zone_name?: string; district_name?: string }>>({});
  const [dbDistrictMapping, setDbDistrictMapping] = useState<Record<string, { dm_name?: string; coordinator_name?: string; di_name?: string }>>({});
  const [isLoadingDistricts, setIsLoadingDistricts] = useState<boolean>(true);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<
    "receive" | "workbench" | "all" | "spares" | "qc_dispatch"
  >("receive");

  const [stats, setStats] = useState<TRCStats | null>(null);
  const [machines, setMachines] = useState<TRCMachine[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<TRCMachine | null>(null);
  const [machineBundle, setMachineBundle] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Multi-Level Filter State (Zone -> District -> Facility)
  const [selectedZoneFilter, setSelectedZoneFilter] = useState<string>("All");
  const [selectedDistrictFilter, setSelectedDistrictFilter] = useState<string>("All");
  const [selectedFacilityFilter, setSelectedFacilityFilter] = useState<string>("All");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>("All");
  const [selectedAgingFilter, setSelectedAgingFilter] = useState<string>("All");
  const [searchKeyword, setSearchKeyword] = useState<string>("");
  const [tableSortBy, setTableSortBy] = useState<"date" | "aging" | "status" | "district">("date");

  // Step 1: Barcode Verification & District State
  const [searchDistrict, setSearchDistrict] = useState<string>("");
  const [searchBarcode, setSearchBarcode] = useState<string>("");
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verifiedMachine, setVerifiedMachine] = useState<any>(null);
  const [barcodeLocked, setBarcodeLocked] = useState<boolean>(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const debounceTimerRef = useRef<any>(null);

  // Cascading Manual / Direct Registration Fields
  const [isManualMode, setIsManualMode] = useState<boolean>(false);
  const [manualHospital, setManualHospital] = useState<string>("");
  const [isCustomHospital, setIsCustomHospital] = useState<boolean>(false);
  const [manualEquipment, setManualEquipment] = useState<string>("");
  const [isCustomEquipment, setIsCustomEquipment] = useState<boolean>(false);
  const [manualMake, setManualMake] = useState<string>("");
  const [isCustomMake, setIsCustomMake] = useState<boolean>(false);
  const [manualModel, setManualModel] = useState<string>("");
  const [manualSerial, setManualSerial] = useState<string>("");
  const [manualComplaintId, setManualComplaintId] = useState<string>(""); // Optional now
  const [manualDiName, setManualDiName] = useState<string>("");
  const [manualCoordinatorName, setManualCoordinatorName] = useState<string>("");
  const [manualDmName, setManualDmName] = useState<string>("");
  const [manualPriorStatus, setManualPriorStatus] = useState<string>("Breakdown / Not Working");

  // Step 2: Receive Machine State (Warehouse arrival date & TRC intake date)
  const [warehouseReceiveDate, setWarehouseReceiveDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [warehouseReceiveTime, setWarehouseReceiveTime] = useState<string>(
    new Date().toLocaleTimeString("en-US", { hour12: false, timeZone: "Asia/Kolkata" })
  );
  const [receiveDate, setReceiveDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [receiveTime, setReceiveTime] = useState<string>(
    new Date().toLocaleTimeString("en-US", { hour12: false, timeZone: "Asia/Kolkata" })
  );
  const [conditionReceived, setConditionReceived] = useState<string>("Good");
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>(["Adapter", "Cable"]);
  const [receiveNotes, setReceiveNotes] = useState<string>("");
  const [receiveVideoUrl, setReceiveVideoUrl] = useState<string>("");
  const [frontPhotoUrl, setFrontPhotoUrl] = useState<string>("");
  const [backPhotoUrl, setBackPhotoUrl] = useState<string>("");
  const [damagePhotoUrl, setDamagePhotoUrl] = useState<string>("");
  const [isSubmittingReceive, setIsSubmittingReceive] = useState<boolean>(false);

  // Modals state
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // 1. Fetch Dynamic Location Hierarchy from Database
  useEffect(() => {
    const fetchLocationHierarchy = async () => {
      setIsLoadingDistricts(true);
      try {
        const res = await trcService.getDistricts();
        if (res.success) {
          const zones = res.zones && res.zones.length > 0 ? res.zones : ["Ajmer", "Bikaner", "Jaipur", "Jodhpur", "Kota", "Udaipur", "Bharatpur"];
          const districts = res.districts && res.districts.length > 0 ? res.districts : ["Ajmer", "Bikaner", "Jaipur", "Jodhpur", "Kota", "Udaipur"];
          
          setDbZones(zones);
          setDbDistricts(districts);
          setDbDistrictsByZone(res.districtsByZone || {});
          setDbFacilitiesByDistrict(res.facilitiesByDistrict || {});

          if (res.equipments && res.equipments.length > 0) {
            setDbEquipments(res.equipments);
          }
          if (res.makes && res.makes.length > 0) {
            setDbMakes(res.makes);
          }
          if (res.hospitalMapping) {
            setDbHospitalMapping(res.hospitalMapping);
          }
          if (res.districtMapping) {
            setDbDistrictMapping(res.districtMapping);
          }

          if (districts.length > 0) {
            setSearchDistrict(districts[0]);
          }
        }
      } catch {
        const fallback = ["Ajmer", "Bikaner", "Jaipur", "Jodhpur", "Kota", "Udaipur"];
        setDbDistricts(fallback);
        setSearchDistrict(fallback[0]);
      } finally {
        setIsLoadingDistricts(false);
      }
    };
    fetchLocationHierarchy();
  }, []);

  // Compute available facilities for the selected intake district
  const availableIntakeFacilities = useMemo(() => {
    if (!searchDistrict || !dbFacilitiesByDistrict[searchDistrict]) return [];
    return dbFacilitiesByDistrict[searchDistrict];
  }, [searchDistrict, dbFacilitiesByDistrict]);

  // Compute available districts for filter bar
  const availableFilterDistricts = useMemo(() => {
    if (selectedZoneFilter === "All" || !dbDistrictsByZone[selectedZoneFilter]) return dbDistricts;
    return dbDistrictsByZone[selectedZoneFilter];
  }, [selectedZoneFilter, dbDistrictsByZone, dbDistricts]);

  // Automatically map DI, Coordinator, and DM when hospital or district changes
  const applyHierarchyAutoMapping = useCallback((hName: string, dName: string) => {
    let mappedDi = "";
    let mappedCoord = "";
    let mappedDm = "";

    // 1. Hospital-specific mapping
    if (hName && dbHospitalMapping && dbHospitalMapping[hName]) {
      const hMap = dbHospitalMapping[hName];
      if (hMap.di_name) mappedDi = hMap.di_name;
      if (hMap.coordinator_name) mappedCoord = hMap.coordinator_name;
    }

    // 2. District-level mapping fallback
    if (dName && dbDistrictMapping && dbDistrictMapping[dName]) {
      const dMap = dbDistrictMapping[dName];
      if (dMap.dm_name) mappedDm = dMap.dm_name;
      if (!mappedCoord && dMap.coordinator_name) mappedCoord = dMap.coordinator_name;
      if (!mappedDi && dMap.di_name) mappedDi = dMap.di_name;
    }

    setManualDiName(mappedDi || "Assigned DI / Field Eng.");
    setManualCoordinatorName(mappedCoord || "TRC Lead Coordinator");
    setManualDmName(mappedDm || "Divisional Manager Office");
  }, [dbHospitalMapping, dbDistrictMapping]);

  // When searchDistrict changes, re-map
  useEffect(() => {
    if (searchDistrict) {
      applyHierarchyAutoMapping(manualHospital, searchDistrict);
    }
  }, [searchDistrict, manualHospital, applyHierarchyAutoMapping]);

  // 2. Load Stats & Machine Registry
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statsRes, machinesRes] = await Promise.all([
        trcService.getStats(),
        trcService.getMachines({
          zone: selectedZoneFilter !== "All" ? selectedZoneFilter : undefined,
          district: selectedDistrictFilter !== "All" ? selectedDistrictFilter : undefined,
          hospital: selectedFacilityFilter !== "All" ? selectedFacilityFilter : undefined,
          status: selectedStatusFilter !== "All" ? selectedStatusFilter : undefined,
          search: searchKeyword.trim() || undefined,
          tab:
            activeTab === "workbench"
              ? "mine"
              : activeTab === "spares"
              ? "waiting_spares"
              : activeTab === "qc_dispatch"
              ? "ready_dispatch"
              : undefined,
        }),
      ]);

      if (statsRes?.success && statsRes.stats) setStats(statsRes.stats);
      if (machinesRes?.success && machinesRes.machines) {
        setMachines(machinesRes.machines);
        if (selectedMachine) {
          const refreshed = machinesRes.machines.find((m: TRCMachine) => m.id === selectedMachine.id);
          if (refreshed) {
            setSelectedMachine(refreshed);
            loadMachineBundle(refreshed.id);
          }
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [selectedZoneFilter, selectedDistrictFilter, selectedFacilityFilter, selectedStatusFilter, searchKeyword, activeTab, selectedMachine]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load relations bundle
  const loadMachineBundle = async (trcId: number) => {
    try {
      const res = await trcService.getMachineDetails(trcId);
      if (res?.success) {
        setMachineBundle(res);
      }
    } catch {
      // fallback
    }
  };

  const handleSelectMachineForDetails = (m: TRCMachine) => {
    setSelectedMachine(m);
    loadMachineBundle(m.id);
  };

  // Step 1: Expense-style Barcode Auto-fetch Logic
  const handleVerifyBarcode = async (barcodeVal?: string, districtVal?: string, isAuto: boolean = false) => {
    const code = (barcodeVal !== undefined ? barcodeVal : searchBarcode).trim();
    const dist = (districtVal !== undefined ? districtVal : searchDistrict).trim();

    if (!code) {
      if (!isAuto) toast.error("Please enter a barcode number");
      return;
    }
    if (!dist) {
      if (!isAuto) toast.error("Please select a District");
      return;
    }

    setIsVerifying(true);
    setVerificationError(null);
    try {
      const res = await trcService.verifyBarcode(dist, code);
      if (res.success && res.found && res.machine) {
        setVerifiedMachine(res.machine);
        setBarcodeLocked(true);
        setIsManualMode(false);
        if (res.districtWarning) {
          toast(res.districtWarning, { icon: "⚠️", duration: 4000 });
        } else {
          toast.success("Machine verified from database!");
        }
      } else {
        setVerifiedMachine(null);
        setBarcodeLocked(false);
        setVerificationError(
          `Barcode "${code}" was not found under district "${dist}" in asset inventory.`
        );
        // Switch to cascading dropdown registration mode
        setIsManualMode(true);
        const initialHospital = availableIntakeFacilities.length > 0 ? availableIntakeFacilities[0] : "";
        if (!manualHospital && initialHospital) {
          setManualHospital(initialHospital);
          applyHierarchyAutoMapping(initialHospital, dist);
        }
        if (!manualEquipment && dbEquipments.length > 0) {
          setManualEquipment(dbEquipments[0]);
        }
        if (!manualMake && dbMakes.length > 0) {
          setManualMake(dbMakes[0]);
        }
        if (!isAuto) toast.error("Asset not cataloged. Please select from dropdowns below.");
      }
    } catch (err: any) {
      setVerificationError("Database lookup failed. Please check network connection.");
      setIsManualMode(true);
      if (!isAuto) toast.error(err.message || "Lookup failed");
    } finally {
      setIsVerifying(false);
    }
  };

  // Expense-style auto-fetch on typing 8+ characters
  const handleBarcodeChange = (val: string) => {
    setSearchBarcode(val);
    setVerificationError(null);

    const clean = val.trim();
    if (clean.length >= 8 && searchDistrict) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        handleVerifyBarcode(clean, searchDistrict, true);
      }, 350);
    } else {
      setVerifiedMachine(null);
      setBarcodeLocked(false);
    }
  };

  // Confirm manual cascading registration details & proceed to Step 2
  const handleConfirmManualAsset = (e: React.FormEvent) => {
    e.preventDefault();
    const finalHospital = manualHospital.trim();
    const finalEquipment = manualEquipment.trim();
    const finalMake = manualMake.trim() || "OEM Vendor";

    if (!searchDistrict) {
      toast.error("Please select a District");
      return;
    }
    if (!finalHospital) {
      toast.error("Please select or enter Facility/Hospital Name");
      return;
    }
    if (!finalEquipment) {
      toast.error("Please select or enter Equipment Type");
      return;
    }

    const manualAsset = {
      district_name: searchDistrict,
      zone_name: "Rajasthan",
      hospital_name: finalHospital,
      equipment_name: finalEquipment,
      oem_name: finalMake,
      equipment_model: manualModel.trim() || "Standard Model",
      equipment_barcode: searchBarcode.trim() || `MAN-${Date.now().toString().slice(-6)}`,
      serial_number: manualSerial.trim() || `SN-${searchBarcode.trim() || Date.now().toString().slice(-6)}`,
      complaint_id: manualComplaintId.trim() || "", // Optional
      di_name: manualDiName.trim() || "Assigned DI",
      coordinator_name: manualCoordinatorName.trim() || "TRC Lead Coordinator",
      dm_name: manualDmName.trim() || "Divisional Manager Office",
      complaint_date: new Date().toISOString().split("T")[0],
      machine_status_prior: manualPriorStatus || "Breakdown / Not Working",
    };

    setVerifiedMachine(manualAsset);
    setBarcodeLocked(true);
    setIsManualMode(false);
    setVerificationError(null);
    toast.success("Asset details registered! Proceed to Receive Machine (Step 2).");
  };

  // Step 2: Receive Machine Submission (Registers Work Order into TRC)
  const handleReceiveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedMachine) {
      toast.error("Please verify or register machine details first.");
      return;
    }

    setIsSubmittingReceive(true);
    try {
      const payload = {
        district: verifiedMachine.district_name || searchDistrict,
        zone: verifiedMachine.zone_name || "Rajasthan",
        hospital_name: verifiedMachine.hospital_name,
        equipment_name: verifiedMachine.equipment_name,
        equipment_model: verifiedMachine.equipment_model,
        barcode: verifiedMachine.equipment_barcode || searchBarcode,
        serial_number: verifiedMachine.serial_number,
        complaint_id: verifiedMachine.complaint_id || undefined, // Optional
        di_name: verifiedMachine.di_name,
        coordinator_name: verifiedMachine.coordinator_name,
        dm_name: verifiedMachine.dm_name,
        complaint_date: verifiedMachine.complaint_date,
        oem_name: verifiedMachine.oem_name,
        machine_status_prior: verifiedMachine.machine_status_prior,
        warehouse_receive_date: warehouseReceiveDate,
        warehouse_receive_time: warehouseReceiveTime,
        receive_date: receiveDate,
        receive_time: receiveTime,
        condition_received: conditionReceived as any,
        accessories_received: selectedAccessories,
        receive_notes: receiveNotes.trim(),
        video_url: receiveVideoUrl || undefined,
        front_photo_url: frontPhotoUrl || undefined,
        back_photo_url: backPhotoUrl || undefined,
        damage_photo_url: damagePhotoUrl || undefined,
      };

      const res = await trcService.receiveMachine(payload);
      if (res.success) {
        toast.success(`Work Order Issued: ${res.trcNumber}`);
        // Reset receive form
        setVerifiedMachine(null);
        setBarcodeLocked(false);
        setIsManualMode(false);
        setSearchBarcode("");
        setManualHospital("");
        setManualEquipment("");
        setManualMake("");
        setManualModel("");
        setManualSerial("");
        setManualComplaintId("");
        setReceiveNotes("");
        setReceiveVideoUrl("");
        setFrontPhotoUrl("");
        setBackPhotoUrl("");
        setDamagePhotoUrl("");
        // Reload data and switch to workbench
        loadData();
        setActiveTab("workbench");
      } else {
        toast.error(res.message || "Failed to receive machine");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || err.message || "Intake submission failed");
    } finally {
      setIsSubmittingReceive(false);
    }
  };

  const toggleAccessory = (item: string) => {
    setSelectedAccessories((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const handleMarkSpareReceived = async (spareId: number) => {
    try {
      const res = await trcService.updateSpareStatus({
        spare_id: spareId,
        status: "Received at TRC",
        remarks: "Component parts verified and staged in TRC inventory.",
      });
      if (res.success) {
        toast.success("Spare received! Machine moved to Repair In Progress.");
        loadData();
      }
    } catch {
      toast.error("Failed to update spare status");
    }
  };

  // Filtered & Sorted Machines with Aging
  const displayedMachines = useMemo(() => {
    return machines
      .filter((m) => {
        if (selectedAgingFilter !== "All") {
          const days = calculateDaysInTRC(m.receive_date);
          if (selectedAgingFilter === "0-3" && days > 3) return false;
          if (selectedAgingFilter === "4-7" && (days < 4 || days > 7)) return false;
          if (selectedAgingFilter === "8-14" && (days < 8 || days > 14)) return false;
          if (selectedAgingFilter === "15+" && days <= 14) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (tableSortBy === "aging") {
          return calculateDaysInTRC(b.receive_date) - calculateDaysInTRC(a.receive_date);
        }
        if (tableSortBy === "status") return a.current_status.localeCompare(b.current_status);
        if (tableSortBy === "district") return a.district.localeCompare(b.district);
        return new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime();
      });
  }, [machines, tableSortBy, selectedAgingFilter]);

  // Export CSV
  const handleExportCSV = () => {
    if (machines.length === 0) {
      toast.error("No data to export");
      return;
    }
    const headers = ["TRC Number", "Barcode", "Equipment", "Make/OEM", "Model", "Hospital", "District", "Zone", "Status", "Days in TRC", "Assigned To", "Receive Date"];
    const rows = machines.map(m => [
      m.trc_number,
      m.barcode,
      `"${m.equipment_name}"`,
      `"${m.oem_name || ''}"`,
      `"${m.equipment_model || ''}"`,
      `"${m.hospital_name}"`,
      m.district,
      m.zone || "Rajasthan",
      m.current_status,
      calculateDaysInTRC(m.receive_date),
      `"${m.assigned_engineer_name || 'Unassigned'}"`,
      m.receive_date
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `TRC_Master_Registry_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("TRC Master CSV Exported!");
  };

  return (
    <div className="space-y-6 animate-fadeIn text-[#212529] pb-32 md:pb-8 text-xs font-sans">

      {/* ─── TOP HEADER INFO BAR (Expense-Style) ─────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-none shadow-2xs p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-none bg-gradient-to-br from-[#4A6A8A] to-[#3b5876] flex items-center justify-center text-white shrink-0 shadow-2xs">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-black text-slate-900 uppercase tracking-wider m-0">
                  TRC Operations
                </h1>
                <span className="bg-[#4A6A8A] text-white font-extrabold py-0.5 px-2 rounded-none text-[9px] font-mono tracking-wide shadow-2xs">
                  ERP v3.0
                </span>
              </div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Database className="w-3 h-3 text-emerald-600" />
                {isLoadingDistricts ? "Loading..." : `${dbDistricts.length} Districts • ${dbZones.length} Zones Synced`}
                {" • "}Biomedical Equipment Repair Center
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab("receive");
                window.scrollTo({ top: 200, behavior: "smooth" });
              }}
              className="h-8 px-4 flex items-center justify-center gap-1.5 bg-[#4A6A8A] hover:bg-[#3b5876] text-white font-extrabold text-[10px] uppercase rounded-none border-0 cursor-pointer shadow-2xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Receive Machine
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="h-8 px-3 flex items-center justify-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 font-extrabold text-[10px] uppercase rounded-none border border-slate-300 cursor-pointer shadow-2xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" /> CSV
            </button>

            <button
              type="button"
              onClick={loadData}
              className="h-8 w-8 flex items-center justify-center bg-white hover:bg-slate-50 text-slate-600 rounded-none border border-slate-300 cursor-pointer shadow-2xs transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-[#4A6A8A]" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* ─── TOP 6 STAT CARDS (Expense Compact Style) ─────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-2">
        {[
          { label: "TOTAL INBOUND", value: stats?.total || 0, icon: Package, color: "from-[#4A6A8A] to-[#3b5876]", textColor: "text-[#4A6A8A]", borderColor: "border-t-[#4A6A8A]" },
          { label: "IN DIAGNOSIS", value: (stats?.received || 0) + (stats?.assigned || 0), icon: Search, color: "from-purple-600 to-purple-700", textColor: "text-purple-700", borderColor: "border-t-purple-500" },
          { label: "WAITING SPARES", value: stats?.waitingSpares || 0, icon: Cog, color: "from-amber-500 to-amber-600", textColor: "text-amber-700", borderColor: "border-t-amber-500" },
          { label: "IN REPAIR", value: (stats?.repairInProgress || 0) + (stats?.diagnosisCompleted || 0), icon: Wrench, color: "from-rose-500 to-rose-600", textColor: "text-rose-700", borderColor: "border-t-rose-500" },
          { label: "QC CERTIFIED", value: (stats?.readyDispatch || 0) + (stats?.qcCompleted || 0) + (stats?.repairCompleted || 0), icon: ShieldCheck, color: "from-emerald-600 to-green-600", textColor: "text-emerald-700", borderColor: "border-t-emerald-500" },
          { label: "DISPATCHED", value: (stats?.dispatched || 0) + (stats?.closed || 0), icon: Truck, color: "from-sky-500 to-blue-600", textColor: "text-sky-700", borderColor: "border-t-sky-500" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className={`bg-white border border-slate-200 rounded-none shadow-2xs p-2 sm:p-2.5 flex items-center gap-2 hover:border-slate-300 transition-all border-t-2 ${stat.borderColor}`}>
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-none bg-gradient-to-br ${stat.color} flex items-center justify-center text-white shrink-0 shadow-2xs`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-wider text-slate-400 leading-none">
                  {stat.label}
                </span>
                <span className={`text-sm sm:text-base font-black ${stat.textColor} font-mono leading-none`}>
                  {stat.value}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── NAVIGATION TABS (Expense Dashboard Style) ────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-none shadow-2xs overflow-hidden">
        <div className="px-4 py-2.5 bg-[#4A6A8A] text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-[#4A6A8A]">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-white" />
            <h3 className="text-xs font-black text-white uppercase tracking-wider m-0">TRC WORKFLOW NAVIGATION</h3>
          </div>
          <div className="flex gap-1 bg-black/20 p-1 rounded-md border border-white/10 overflow-x-auto">
            {[
              { key: "receive", label: "Receive & Intake", badge: undefined },
              { key: "workbench", label: "My Workbench", badge: machines.filter(m => m.assigned_engineer_name === currentUser.name).length || undefined },
              { key: "all", label: "Master Registry", badge: machines.length || undefined },
              { key: "spares", label: "Spare Parts", badge: stats?.waitingSpares || undefined },
              { key: "qc_dispatch", label: "QC & Dispatch", badge: (stats?.readyDispatch || 0) + (stats?.qcCompleted || 0) || undefined },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setActiveTab(t.key as any);
                  if (t.key === "receive") setSelectedMachine(null);
                }}
                className={`px-3 py-1 text-[10px] font-extrabold rounded-md transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                  activeTab === t.key
                    ? "bg-white text-[#4A6A8A] shadow-xs"
                    : "bg-transparent text-white/80 hover:bg-white/10"
                }`}
              >
                {t.label}
                {t.badge !== undefined && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-sm font-mono font-bold ${
                    activeTab === t.key ? "bg-[#4A6A8A] text-white" : "bg-white/20 text-white"
                  }`}>
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── TAB CONTENT 1: RECEIVE MACHINE (Step 1 & Step 2) ────────────── */}
      {activeTab === "receive" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Main Intake Column */}
          <div className="lg:col-span-8 space-y-4">

            {/* ── STEP 1: FOCUSED BARCODE SEARCH & DISTRICT SELECTOR ───────────── */}
            <div className="bg-white border border-slate-200 rounded-none shadow-2xs overflow-hidden border-t-4 border-t-[#4A6A8A]">
              {/* Step Header */}
              <div className="px-4 py-2.5 bg-[#4A6A8A] text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="h-5 px-2 rounded-none flex items-center justify-center text-[10px] font-black font-mono bg-white text-[#4A6A8A]">1</span>
                  <span className="text-xs font-black uppercase tracking-wider">Search & Verify Machine</span>
                </div>
                {barcodeLocked && verifiedMachine && (
                  <span className="text-[9px] font-black bg-emerald-500 text-white px-2 py-0.5 rounded-none flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> VERIFIED ASSET
                  </span>
                )}
              </div>

              {/* Step Body */}
              <div className="p-4 space-y-4">
                {/* 1. District & Barcode Focused Inputs */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  {/* District Selector */}
                  <div className="sm:col-span-5">
                    <label className="label-lte">
                      Choose District <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={searchDistrict}
                      disabled={barcodeLocked || isLoadingDistricts}
                      onChange={(e) => {
                        setSearchDistrict(e.target.value);
                        setManualHospital("");
                        if (searchBarcode.trim()) {
                          handleVerifyBarcode(searchBarcode, e.target.value, true);
                        }
                      }}
                      className="input-lte font-semibold pr-8 border-slate-300 rounded-none shadow-2xs disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                    >
                      {dbDistricts.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  {/* Barcode Input with Auto-Fetch */}
                  <div className="sm:col-span-7">
                    <label className="label-lte font-extrabold text-[8px] text-gray-500 uppercase flex items-center justify-between">
                      <span>Barcode (QR) <span className="text-red-500">*</span></span>
                      {isVerifying && (
                        <span className="text-[9px] font-bold text-amber-600 animate-pulse flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-none border border-amber-200">
                          ⏳ Checking database...
                        </span>
                      )}
                      {barcodeLocked && verifiedMachine && (
                        <span className="text-emerald-800 text-[8px] font-mono">
                          ✓ {verifiedMachine.equipment_name || 'Verified'}
                        </span>
                      )}
                    </label>

                    <div className="flex gap-1.5 items-center">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={searchBarcode}
                        disabled={barcodeLocked}
                        onChange={(e) => handleBarcodeChange(e.target.value)}
                        placeholder="8 digits (e.g. 80048906)"
                        className="input-lte font-mono h-8 py-1 text-xs border-blue-300 flex-1 min-w-0"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleVerifyBarcode();
                        }}
                      />

                      {!barcodeLocked ? (
                        <div
                          onClick={() => {
                            if (searchBarcode.trim().length >= 1) handleVerifyBarcode();
                          }}
                          className="h-8 px-4 flex items-center justify-center rounded-none text-[10px] font-extrabold uppercase select-none transition-colors shrink-0"
                          style={
                            searchBarcode.trim().length >= 1
                              ? { backgroundColor: '#10b981', color: '#000000', borderColor: '#0f172a', borderWidth: '1.5px', borderStyle: 'solid', cursor: 'pointer' }
                              : { backgroundColor: '#e2e8f0', color: '#94a3b8', borderColor: '#cbd5e1', borderWidth: '1px', borderStyle: 'solid', cursor: 'not-allowed' }
                          }
                        >
                          Verify
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setBarcodeLocked(false);
                            setVerifiedMachine(null);
                            setIsManualMode(false);
                          }}
                          className="h-8 px-3 flex items-center justify-center gap-1 rounded-none text-[10px] font-extrabold uppercase bg-white border border-slate-300 text-slate-600 hover:bg-slate-50 cursor-pointer transition-colors shrink-0"
                        >
                          <Unlock className="w-3 h-3" /> Unlock
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Option to open direct uncataloged intake if barcode doesn't exist */}
                {!barcodeLocked && !isManualMode && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <span className="text-[10px] text-slate-500">
                      Machine has no barcode or uncataloged asset?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsManualMode(true);
                        const initialHospital = availableIntakeFacilities.length > 0 ? availableIntakeFacilities[0] : "";
                        if (!manualHospital && initialHospital) {
                          setManualHospital(initialHospital);
                          applyHierarchyAutoMapping(initialHospital, searchDistrict);
                        }
                        if (!manualEquipment && dbEquipments.length > 0) {
                          setManualEquipment(dbEquipments[0]);
                        }
                        if (!manualMake && dbMakes.length > 0) {
                          setManualMake(dbMakes[0]);
                        }
                      }}
                      className="text-[10px] font-extrabold text-[#4A6A8A] hover:text-[#3b5876] bg-blue-50/60 border border-blue-200 px-2.5 py-1 rounded-none cursor-pointer flex items-center gap-1 uppercase tracking-wide transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Direct Register & Cascading Select →
                    </button>
                  </div>
                )}

                {/* Verified Machine Banner (Database Auto-Fill Preview) */}
                {verifiedMachine && !isManualMode && (
                  <div className="bg-green-50 border border-green-200 text-green-800 text-[10px] p-2.5 rounded-none flex flex-col gap-2">
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <span><strong>✓ Verified Asset:</strong> {verifiedMachine.equipment_name}</span>
                      <span><strong>Make/OEM:</strong> {verifiedMachine.oem_name || "N/A"}</span>
                      <span><strong>Model:</strong> {verifiedMachine.equipment_model || "Standard"}</span>
                      <span><strong>Hospital:</strong> {verifiedMachine.hospital_name}</span>
                      <span><strong>District:</strong> {verifiedMachine.district_name || searchDistrict}</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-white p-2 rounded-none border border-green-100">
                      <div>
                        <span className="text-[8px] uppercase font-black text-slate-400 block">Complaint ID</span>
                        <span className="font-mono font-bold text-blue-700">{verifiedMachine.complaint_id || "Optional / N/A"}</span>
                      </div>
                      <div>
                        <span className="text-[8px] uppercase font-black text-slate-400 block">Consignee DI</span>
                        <span className="font-bold text-slate-700">{verifiedMachine.di_name || "Assigned DI"}</span>
                      </div>
                      <div>
                        <span className="text-[8px] uppercase font-black text-slate-400 block">Area Coordinator</span>
                        <span className="font-bold text-slate-700">{verifiedMachine.coordinator_name || "TRC Coordinator"}</span>
                      </div>
                      <div>
                        <span className="text-[8px] uppercase font-black text-slate-400 block">Divisional Manager</span>
                        <span className="font-bold text-slate-700">{verifiedMachine.dm_name || "Divisional Manager"}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* ─── CASCADING DROPDOWNS (When Barcode Not Found or Manual Call Register) ─── */}
                {isManualMode && (
                  <form onSubmit={handleConfirmManualAsset} className="bg-slate-50 border border-slate-300 p-3.5 space-y-3.5 rounded-none animate-fadeIn">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
                        <Building2 className="w-4 h-4 text-[#4A6A8A]" />
                        <span>Select Facility & Equipment Details for <strong className="text-[#4A6A8A]">{searchDistrict} District</strong></span>
                      </div>
                      <span className="text-[9px] bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 font-bold uppercase font-mono">
                        Direct Registration
                      </span>
                    </div>

                    {/* Verification error / helper alert */}
                    {verificationError && (
                      <div className="text-[10px] text-amber-900 bg-amber-50 p-2 border border-amber-200">
                        ⚠️ {verificationError} — You can select or enter the details below to register the asset into TRC.
                      </div>
                    )}

                    {/* Cascading Row 1: Hospital / Facility Selector for this District */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="label-lte mb-0">
                          1. Facility / Hospital in {searchDistrict} <span className="text-red-500">*</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsCustomHospital(!isCustomHospital)}
                          className="text-[9px] font-extrabold text-blue-700 hover:text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-none cursor-pointer uppercase tracking-wider"
                        >
                          {isCustomHospital ? "📋 Select From District List" : "✍️ Type Custom Hospital"}
                        </button>
                      </div>

                      {!isCustomHospital ? (
                        <select
                          value={manualHospital}
                          onChange={(e) => {
                            setManualHospital(e.target.value);
                            applyHierarchyAutoMapping(e.target.value, searchDistrict);
                          }}
                          className="input-lte font-semibold pr-8 border-slate-300 rounded-none shadow-2xs"
                          required
                        >
                          <option value="">-- Select Hospital from {searchDistrict} ({availableIntakeFacilities.length} Facilities) --</option>
                          {availableIntakeFacilities.map((f) => (
                            <option key={f} value={f}>{f}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={manualHospital}
                          onChange={(e) => {
                            setManualHospital(e.target.value);
                            applyHierarchyAutoMapping(e.target.value, searchDistrict);
                          }}
                          placeholder="e.g. District Hospital, CHC, PHC, Sub-District Hospital..."
                          className="input-lte font-semibold border-slate-300 rounded-none shadow-2xs"
                          required
                        />
                      )}
                    </div>

                    {/* Cascading Row 2: Equipment Name, Make / OEM, and Model (3 Separate Columns) */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Equipment Name Dropdown */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="label-lte mb-0">
                            2. Equipment Type <span className="text-red-500">*</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setIsCustomEquipment(!isCustomEquipment)}
                            className="text-[9px] font-extrabold text-blue-700 hover:text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-none cursor-pointer uppercase tracking-wider"
                          >
                            {isCustomEquipment ? "📋 List" : "✍️ Custom"}
                          </button>
                        </div>

                        {!isCustomEquipment ? (
                          <select
                            value={manualEquipment}
                            onChange={(e) => setManualEquipment(e.target.value)}
                            className="input-lte font-semibold pr-8 border-slate-300 rounded-none shadow-2xs"
                            required
                          >
                            <option value="">-- Choose Equipment Type --</option>
                            {dbEquipments.map((eq) => (
                              <option key={eq} value={eq}>{eq}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={manualEquipment}
                            onChange={(e) => setManualEquipment(e.target.value)}
                            placeholder="e.g. Ventilator / Defibrillator / Suction..."
                            className="input-lte font-semibold border-slate-300 rounded-none shadow-2xs"
                            required
                          />
                        )}
                      </div>

                      {/* Make / Manufacturer (OEM) Dropdown */}
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="label-lte mb-0">
                            3. Make / OEM (Brand) <span className="text-red-500">*</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setIsCustomMake(!isCustomMake)}
                            className="text-[9px] font-extrabold text-blue-700 hover:text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-none cursor-pointer uppercase tracking-wider"
                          >
                            {isCustomMake ? "📋 List" : "✍️ Custom"}
                          </button>
                        </div>

                        {!isCustomMake ? (
                          <select
                            value={manualMake}
                            onChange={(e) => setManualMake(e.target.value)}
                            className="input-lte font-semibold pr-8 border-slate-300 rounded-none shadow-2xs"
                            required
                          >
                            <option value="">-- Choose Make / OEM --</option>
                            {dbMakes.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={manualMake}
                            onChange={(e) => setManualMake(e.target.value)}
                            placeholder="e.g. BPL / Philips / GE / Mindray..."
                            className="input-lte font-semibold border-slate-300 rounded-none shadow-2xs"
                            required
                          />
                        )}
                      </div>

                      {/* Equipment Model / Variant */}
                      <div>
                        <label className="label-lte">
                          4. Model / Variant
                        </label>
                        <input
                          type="text"
                          value={manualModel}
                          onChange={(e) => setManualModel(e.target.value)}
                          placeholder="e.g. Model 3000 / Deluxe"
                          className="input-lte font-semibold border-slate-300 rounded-none shadow-2xs"
                        />
                      </div>
                    </div>

                    {/* Cascading Row 3: Serial No, Complaint ID (Optional), and Descriptive Prior Status */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="label-lte">
                          5. Serial Number
                        </label>
                        <input
                          type="text"
                          value={manualSerial}
                          onChange={(e) => setManualSerial(e.target.value)}
                          placeholder="e.g. SN-89021"
                          className="input-lte font-mono font-semibold border-slate-300 rounded-none shadow-2xs"
                        />
                      </div>

                      <div>
                        <label className="label-lte">
                          6. Complaint / Problem ID <span className="text-slate-400 font-normal lowercase">(optional)</span>
                        </label>
                        <input
                          type="text"
                          value={manualComplaintId}
                          onChange={(e) => setManualComplaintId(e.target.value)}
                          placeholder="e.g. CMP-10294 (Optional)"
                          className="input-lte font-mono font-semibold border-slate-300 rounded-none shadow-2xs"
                        />
                      </div>

                      <div>
                        <label className="label-lte">
                          7. Prior Breakdown Status <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={manualPriorStatus}
                          onChange={(e) => setManualPriorStatus(e.target.value)}
                          className="input-lte font-semibold border-slate-300 rounded-none shadow-2xs pr-8"
                          required
                        >
                          {PRIOR_STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Cascading Row 4: Auto-Mapped Hierarchy (DI, Coordinator, DM mapped automatically based on Hospital) */}
                    <div className="bg-white p-3 border border-slate-200 rounded-none space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                          Auto-Mapped Hierarchy (Based on Hospital & District)
                        </span>
                        <span className="text-[8px] bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 px-2 py-0.5 rounded-none font-mono">
                          ✓ Auto-Synced
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="label-lte font-bold text-[8px] text-slate-500">
                            Consignee DI / Lead
                          </label>
                          <input
                            type="text"
                            value={manualDiName}
                            onChange={(e) => setManualDiName(e.target.value)}
                            placeholder="DI Name"
                            className="input-lte font-semibold bg-slate-50 border-slate-300 rounded-none shadow-2xs"
                          />
                        </div>

                        <div>
                          <label className="label-lte font-bold text-[8px] text-slate-500">
                            Area Coordinator
                          </label>
                          <input
                            type="text"
                            value={manualCoordinatorName}
                            onChange={(e) => setManualCoordinatorName(e.target.value)}
                            placeholder="Coordinator Name"
                            className="input-lte font-semibold bg-slate-50 border-slate-300 rounded-none shadow-2xs"
                          />
                        </div>

                        <div>
                          <label className="label-lte font-bold text-[8px] text-slate-500">
                            Divisional Manager (DM)
                          </label>
                          <input
                            type="text"
                            value={manualDmName}
                            onChange={(e) => setManualDmName(e.target.value)}
                            placeholder="DM Name"
                            className="input-lte font-semibold bg-slate-50 border-slate-300 rounded-none shadow-2xs"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Action buttons for manual confirmation */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => setIsManualMode(false)}
                        className="h-8 px-4 bg-white hover:bg-slate-50 text-slate-700 font-extrabold text-[10px] uppercase rounded-none border border-slate-300 cursor-pointer shadow-2xs"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="h-8 px-5 bg-[#4A6A8A] hover:bg-[#3b5876] text-white font-extrabold text-[10px] uppercase rounded-none border-0 cursor-pointer shadow-2xs flex items-center gap-1.5"
                      >
                        <Check className="w-3.5 h-3.5" /> Confirm Asset & Proceed to Intake
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>

            {/* ── STEP 2: RECEIVE MACHINE IN TRC WAREHOUSE ───────────────────── */}
            {barcodeLocked && verifiedMachine && (
              <form onSubmit={handleReceiveSubmit}>
                <div className="bg-white border border-slate-200 rounded-none shadow-2xs overflow-hidden border-t-4 border-t-[#4A6A8A]">
                  {/* Step 2 Header */}
                  <div className="px-4 py-2.5 bg-[#4A6A8A] text-white flex items-center gap-2">
                    <span className="h-5 px-2 rounded-none flex items-center justify-center text-[10px] font-black font-mono bg-white text-[#4A6A8A]">2</span>
                    <span className="text-xs font-black uppercase tracking-wider">Receive Machine in TRC Warehouse</span>
                  </div>

                  <div className="p-4 space-y-4">
                    {/* Warehouse Physical Receive Date & TRC Intake Registration Date (Both Shown Upfront) */}
                    <div className="bg-slate-50 border border-slate-300 p-3 rounded-none space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-[#4A6A8A]" />
                          Warehouse Arrival vs TRC Registration Dates
                        </span>
                        <span className="text-[8px] font-bold text-slate-400 font-mono">IST (Asia/Kolkata)</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        {/* 1. Warehouse Arrival Date */}
                        <div className="lg:col-span-2">
                          <label className="label-lte text-slate-800 font-black">
                            1. Warehouse Arrival Date & Time <span className="text-red-500">*</span>
                          </label>
                          <div className="grid grid-cols-2 gap-1.5">
                            <input
                              type="date"
                              value={warehouseReceiveDate}
                              onChange={(e) => setWarehouseReceiveDate(e.target.value)}
                              className="input-lte font-semibold border-slate-300 rounded-none shadow-2xs"
                              required
                            />
                            <input
                              type="text"
                              value={warehouseReceiveTime}
                              onChange={(e) => setWarehouseReceiveTime(e.target.value)}
                              className="input-lte font-mono font-semibold border-slate-300 rounded-none shadow-2xs"
                              required
                            />
                          </div>
                        </div>

                        {/* 2. TRC Work Order Date */}
                        <div className="lg:col-span-2">
                          <label className="label-lte text-slate-800 font-black">
                            2. TRC Registration Date & Time <span className="text-red-500">*</span>
                          </label>
                          <div className="grid grid-cols-2 gap-1.5">
                            <input
                              type="date"
                              value={receiveDate}
                              onChange={(e) => setReceiveDate(e.target.value)}
                              className="input-lte font-semibold border-slate-300 rounded-none shadow-2xs"
                              required
                            />
                            <input
                              type="text"
                              value={receiveTime}
                              onChange={(e) => setReceiveTime(e.target.value)}
                              className="input-lte font-mono font-semibold border-slate-300 rounded-none shadow-2xs"
                              required
                            />
                          </div>
                        </div>

                        {/* 3. Received By Engineer */}
                        <div className="lg:col-span-1">
                          <label className="label-lte text-slate-800 font-black">
                            3. Received By
                          </label>
                          <input
                            type="text"
                            value={currentUser.name || "TRC Engineer"}
                            disabled
                            className="input-lte text-[10px] font-extrabold h-8 py-1 px-2 bg-slate-200 border-slate-300 text-slate-800 cursor-not-allowed w-full shadow-inner truncate"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Condition While Receiving */}
                    <div>
                      <label className="label-lte">
                        Condition While Receiving <span className="text-red-500">*</span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        {CONDITION_OPTIONS.map((c) => (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => setConditionReceived(c.value)}
                            className={`p-2.5 rounded-none border text-left font-semibold transition-all ${
                              conditionReceived === c.value
                                ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                                : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-extrabold uppercase">{c.label}</span>
                              {conditionReceived === c.value && <Check className="w-3.5 h-3.5 text-white" />}
                            </div>
                            <span className={`text-[9px] block mt-0.5 ${conditionReceived === c.value ? "text-slate-300" : "text-slate-500"}`}>
                              {c.desc}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Accessories checklist */}
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="label-lte">
                          Accessories Received <span className="text-red-500">*</span>
                        </label>
                        <span className="text-[9px] font-extrabold text-slate-400 uppercase">{selectedAccessories.length} selected</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1.5">
                        {ACCESSORY_OPTIONS.map((acc) => {
                          const isSelected = selectedAccessories.includes(acc);
                          return (
                            <button
                              key={acc}
                              type="button"
                              onClick={() => toggleAccessory(acc)}
                              className={`py-1.5 px-2 rounded-none border font-bold text-[10px] text-center transition flex items-center justify-center gap-1.5 uppercase ${
                                isSelected
                                  ? "bg-[#4A6A8A] border-[#4A6A8A] text-white shadow-2xs"
                                  : "bg-white border-slate-300 text-slate-600 hover:bg-slate-50"
                              }`}
                            >
                              <span
                                className={`w-3.5 h-3.5 rounded-none flex items-center justify-center ${
                                  isSelected ? "bg-white text-[#4A6A8A]" : "border border-slate-300 bg-white"
                                }`}
                              >
                                {isSelected && <Check className="w-2.5 h-2.5" />}
                              </span>
                              {acc}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Physical notes */}
                    <div>
                      <label className="label-lte">Receive Notes & Physical Observations</label>
                      <textarea
                        rows={2}
                        value={receiveNotes}
                        onChange={(e) => setReceiveNotes(e.target.value)}
                        placeholder="e.g. Scratches on front bezel, adapter cable slightly frayed, packaging carton intact..."
                        className="w-full text-xs font-semibold text-slate-900 bg-white border border-slate-300 focus:border-[#4A6A8A] rounded-none p-2.5 shadow-2xs placeholder:text-slate-400 outline-none"
                      />
                    </div>

                    {/* Upload Media Section */}
                    <div className="border-t border-slate-200 pt-4 space-y-2">
                      <label className="label-lte font-extrabold text-[10px] uppercase tracking-wider text-slate-500 block mb-1.5">
                        Media Uploads (Cloudflare R2)
                      </label>
                      <MediaUploadSection
                        stage="Receive"
                        videoRequired
                        videoLabel="Machine Receive Video"
                        maxVideoSeconds={60}
                        videoUrl={receiveVideoUrl}
                        onVideoChange={setReceiveVideoUrl}
                        photos={[
                          { key: "front", label: "Front Photo", url: frontPhotoUrl, required: true },
                          { key: "back", label: "Back Photo", url: backPhotoUrl, required: true },
                          { key: "damage", label: "Damage Photo (Optional)", url: damagePhotoUrl },
                        ]}
                        onPhotoChange={(key, url) => {
                          if (key === "front") setFrontPhotoUrl(url);
                          if (key === "back") setBackPhotoUrl(url);
                          if (key === "damage") setDamagePhotoUrl(url);
                        }}
                      />
                    </div>

                    {/* Submit Action */}
                    <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                      <button
                        type="submit"
                        disabled={isSubmittingReceive}
                        className="h-10 px-6 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold uppercase tracking-wider text-[10px] rounded-none shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Package className="w-4 h-4 shrink-0" />
                        <span>RECEIVE MACHINE IN TRC WAREHOUSE</span>
                      </button>
                    </div>
                  </div>
                </div>
              </form>
            )}
          </div>

          {/* Right Column: Sticky Machine Details Card */}
          <div className="lg:col-span-4 space-y-4">
            <MachineDetailsStickyCard
              machine={
                verifiedMachine || {
                  district: searchDistrict,
                  barcode: searchBarcode,
                  equipment_name: "Awaiting Barcode Input",
                  hospital_name: "Select District & Enter Barcode",
                }
              }
              isCoordinator={isCoordinatorOrAdmin}
              onOpenActionModal={(act) => setActiveModal(act)}
            />
          </div>
        </div>
      )}

      {/* ─── TAB CONTENT 2, 3, 4, 5: REGISTRIES & WORKBENCH ───────────────── */}
      {activeTab !== "receive" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          {/* Main List Column */}
          <div className="lg:col-span-7 space-y-4">

            {/* Filter Bar (Expense-Style Sharp) */}
            <div className="bg-white border border-slate-200 rounded-none shadow-2xs p-3 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-[#4A6A8A]" />
                  <span className="text-[10px] font-black text-slate-700 uppercase tracking-wider">Advanced Filters & Aging SLA</span>
                </div>
                <span className="text-[9px] text-slate-500 font-mono font-bold">
                  {displayedMachines.length} / {machines.length} Machines
                </span>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="Search by Barcode, TRC Number, Equipment, Make, Model, or Hospital..."
                  className="input-lte pl-9 rounded-none border-slate-300 shadow-2xs"
                />
              </div>

              {/* Cascading Filter Selectors Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                <div>
                  <span className="text-[8px] font-extrabold uppercase text-slate-500 tracking-wider block mb-0.5">Zone</span>
                  <select
                    value={selectedZoneFilter}
                    onChange={(e) => {
                      setSelectedZoneFilter(e.target.value);
                      setSelectedDistrictFilter("All");
                      setSelectedFacilityFilter("All");
                    }}
                    className="w-full bg-white border border-slate-300 rounded-none px-2 py-1 text-[10px] font-semibold text-slate-800 shadow-2xs focus:outline-none focus:border-[#4A6A8A] cursor-pointer"
                  >
                    <option value="All">All Zones ({dbZones.length})</option>
                    {dbZones.map((z) => (
                      <option key={z} value={z}>{z}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="text-[8px] font-extrabold uppercase text-slate-500 tracking-wider block mb-0.5">District</span>
                  <select
                    value={selectedDistrictFilter}
                    onChange={(e) => {
                      setSelectedDistrictFilter(e.target.value);
                      setSelectedFacilityFilter("All");
                    }}
                    className="w-full bg-white border border-slate-300 rounded-none px-2 py-1 text-[10px] font-semibold text-slate-800 shadow-2xs focus:outline-none focus:border-[#4A6A8A] cursor-pointer"
                  >
                    <option value="All">All Districts</option>
                    {availableFilterDistricts.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="text-[8px] font-extrabold uppercase text-slate-500 tracking-wider block mb-0.5">Facility</span>
                  <select
                    value={selectedFacilityFilter}
                    onChange={(e) => setSelectedFacilityFilter(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-none px-2 py-1 text-[10px] font-semibold text-slate-800 shadow-2xs focus:outline-none focus:border-[#4A6A8A] cursor-pointer"
                  >
                    <option value="All">All Facilities</option>
                    {(selectedDistrictFilter !== "All" ? dbFacilitiesByDistrict[selectedDistrictFilter] || [] : []).map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <span className="text-[8px] font-extrabold uppercase text-slate-500 tracking-wider block mb-0.5">Status</span>
                  <select
                    value={selectedStatusFilter}
                    onChange={(e) => setSelectedStatusFilter(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-none px-2 py-1 text-[10px] font-semibold text-slate-800 shadow-2xs focus:outline-none focus:border-[#4A6A8A] cursor-pointer"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Machine Received in TRC">Machine Received</option>
                    <option value="Assigned to Engineer">Assigned to Engineer</option>
                    <option value="Diagnosis Completed">Diagnosis Completed</option>
                    <option value="Waiting Spare Part">Waiting Spare Part</option>
                    <option value="Repair In Progress">Repair In Progress</option>
                    <option value="Repair Completed">Repair Completed</option>
                    <option value="Ready for Warehouse Dispatch">Ready for Dispatch</option>
                    <option value="Dispatched">Dispatched</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>

                <div>
                  <span className="text-[8px] font-extrabold uppercase text-slate-500 tracking-wider block mb-0.5">Aging / Days</span>
                  <select
                    value={selectedAgingFilter}
                    onChange={(e) => setSelectedAgingFilter(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-none px-2 py-1 text-[10px] font-semibold text-slate-800 shadow-2xs focus:outline-none focus:border-[#4A6A8A] cursor-pointer"
                  >
                    <option value="All">All Durations</option>
                    <option value="0-3">🟢 0-3 Days (Fresh)</option>
                    <option value="4-7">🔵 4-7 Days (Normal)</option>
                    <option value="8-14">🟡 8-14 Days (Aging)</option>
                    <option value="15+">🔴 &gt;14 Days (Critical)</option>
                  </select>
                </div>

                <div>
                  <span className="text-[8px] font-extrabold uppercase text-slate-500 tracking-wider block mb-0.5">Sort By</span>
                  <select
                    value={tableSortBy}
                    onChange={(e) => setTableSortBy(e.target.value as any)}
                    className="w-full bg-white border border-slate-300 rounded-none px-2 py-1 text-[10px] font-semibold text-slate-800 shadow-2xs focus:outline-none focus:border-[#4A6A8A] cursor-pointer"
                  >
                    <option value="date">Date: Newest</option>
                    <option value="aging">Aging: Highest</option>
                    <option value="status">Status</option>
                    <option value="district">District</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ─── MACHINE TABLE (Desktop) + CARDS (Mobile) ────────────────── */}
            {displayedMachines.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-none shadow-2xs p-8 text-center">
                <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <h3 className="text-sm font-bold text-slate-800">No Machines Match Filter Criteria</h3>
                <p className="text-[10px] text-slate-400 mt-1">Try adjusting Zone, District, Status, or Aging filters.</p>
              </div>
            ) : (
              <>
                {/* Desktop Table */}
                <div className="overflow-x-auto w-full border border-slate-200 shadow-2xs rounded-none hidden md:block">
                  <table className="w-full text-xs min-w-[900px]">
                    <thead>
                      <tr className="bg-slate-800 text-slate-100 text-[9px] uppercase font-black tracking-wider border-b border-slate-700">
                        <th className="py-2.5 px-3 text-left">TRC No.</th>
                        <th className="py-2.5 px-3 text-left">Barcode</th>
                        <th className="py-2.5 px-3 text-left">Equipment & Make</th>
                        <th className="py-2.5 px-3 text-left">Hospital</th>
                        <th className="py-2.5 px-3 text-left">Status</th>
                        <th className="py-2.5 px-3 text-center">Days</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {displayedMachines.map((m) => {
                        const isSelected = selectedMachine?.id === m.id;
                        const daysInTRC = calculateDaysInTRC(m.receive_date);
                        const agingStyle = getAgingBadgeStyle(daysInTRC);

                        return (
                          <tr
                            key={m.id}
                            onClick={() => handleSelectMachineForDetails(m)}
                            className={`hover:bg-slate-50 cursor-pointer transition-colors ${isSelected ? "bg-blue-50/50" : ""}`}
                          >
                            <td className="py-2.5 px-3 font-semibold font-mono text-[#4A6A8A] uppercase whitespace-nowrap text-[10px]">
                              {m.trc_number}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-800 text-[10px] whitespace-nowrap">
                              {m.barcode}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-800 truncate max-w-[200px] whitespace-nowrap">
                              {m.equipment_name}
                              <span className="text-[9px] text-slate-400 block font-normal">
                                {m.oem_name ? `${m.oem_name} • ` : ""}{m.district} • {m.assigned_engineer_name || "Unassigned"}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-slate-600 truncate max-w-[150px] whitespace-nowrap text-[10px]">
                              {m.hospital_name}
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              {renderTRCStatusTag(m.current_status)}
                            </td>
                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                              <span className={`px-1.5 py-0.5 rounded-none font-bold text-[9px] uppercase border ${agingStyle.bg}`}>
                                {daysInTRC}d
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {isCoordinatorOrAdmin && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedMachine(m);
                                      setActiveModal("assign");
                                    }}
                                    className="text-[9px] font-extrabold px-2 py-1 rounded-none border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer transition-colors"
                                  >
                                    Assign
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectMachineForDetails(m);
                                  }}
                                  className="text-[9px] font-extrabold px-2 py-1 rounded-none bg-[#4A6A8A] text-white border border-[#3b5876] hover:bg-[#3b5876] cursor-pointer transition-colors flex items-center gap-0.5"
                                >
                                  Inspect <ChevronRight className="w-3 h-3" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card List */}
                <div className="md:hidden space-y-2">
                  {displayedMachines.map((m) => {
                    const isSelected = selectedMachine?.id === m.id;
                    const daysInTRC = calculateDaysInTRC(m.receive_date);
                    const agingStyle = getAgingBadgeStyle(daysInTRC);

                    return (
                      <div
                        key={m.id}
                        onClick={() => handleSelectMachineForDetails(m)}
                        className={`border-l-4 border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer transition-all shadow-xs rounded-none p-3 space-y-2 ${
                          isSelected ? "border-l-[#4A6A8A] bg-blue-50/30" : "border-l-slate-400"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="bg-[#4A6A8A] text-white font-extrabold py-0.5 px-2 rounded-none text-[9px] font-mono">{m.trc_number}</span>
                            <h4 className="text-[11px] font-bold text-slate-900 mt-1">{m.equipment_name}</h4>
                            <p className="text-[9px] text-slate-500">{m.hospital_name}, {m.district}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <span className={`px-1.5 py-0.5 rounded-none font-bold text-[8px] uppercase border ${agingStyle.bg}`}>
                              {daysInTRC}d — {agingStyle.label}
                            </span>
                            <div className="mt-1">{renderTRCStatusTag(m.current_status)}</div>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[9px] bg-slate-50 p-1.5 rounded-none border border-slate-100">
                          <div>
                            <span className="text-[7px] uppercase font-black text-slate-400 block">Barcode</span>
                            <span className="font-mono font-bold text-slate-800">{m.barcode}</span>
                          </div>
                          <div>
                            <span className="text-[7px] uppercase font-black text-slate-400 block">Engineer</span>
                            <span className="font-semibold text-slate-700">{m.assigned_engineer_name || "—"}</span>
                          </div>
                          <div>
                            <span className="text-[7px] uppercase font-black text-slate-400 block">Received</span>
                            <span className="font-semibold text-slate-700">{m.receive_date}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Right Column: Selected Machine Detail & Timeline */}
          <div className="lg:col-span-5 space-y-4 sticky top-4">
            {selectedMachine ? (
              <>
                <MachineDetailsStickyCard
                  machine={selectedMachine}
                  isCoordinator={isCoordinatorOrAdmin}
                  onPrintJobCard={() => setActiveModal("print")}
                  onOpenActionModal={(act) => setActiveModal(act)}
                />

                {/* TAT & Aging Widget */}
                <div className="bg-white border border-slate-200 rounded-none shadow-2xs overflow-hidden">
                  <div className="px-3 py-2 bg-slate-800 text-white flex items-center justify-between">
                    <span className="text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> TRC TAT & Bench Duration
                    </span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-none border font-bold ${getAgingBadgeStyle(calculateDaysInTRC(selectedMachine.receive_date)).bg}`}>
                      {getAgingBadgeStyle(calculateDaysInTRC(selectedMachine.receive_date)).label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-0 border-t border-slate-200">
                    <div className="p-3 border-r border-slate-200">
                      <span className="text-[8px] text-slate-400 block uppercase font-black">Total Days in TRC</span>
                      <span className="text-lg font-black text-slate-900 font-mono">
                        {calculateDaysInTRC(selectedMachine.receive_date)}
                      </span>
                    </div>
                    <div className="p-3">
                      <span className="text-[8px] text-slate-400 block uppercase font-black">Received Date</span>
                      <span className="text-xs font-bold text-slate-800">
                        {selectedMachine.receive_date}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Workflow Actions (Expense-style sharp buttons) */}
                <div className="bg-white border border-slate-200 rounded-none shadow-2xs overflow-hidden">
                  <div className="px-3 py-2 bg-slate-100 border-b border-slate-200">
                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Workflow Actions</span>
                  </div>
                  <div className="p-3 grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setActiveModal("diagnosis")}
                      className="p-2 rounded-none bg-white hover:bg-purple-50 text-purple-800 border border-purple-200 font-extrabold text-[10px] flex items-center gap-1.5 transition uppercase"
                    >
                      <Search className="w-3.5 h-3.5 text-purple-600" />
                      Diagnosis
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveModal("spare")}
                      className="p-2 rounded-none bg-white hover:bg-amber-50 text-amber-800 border border-amber-200 font-extrabold text-[10px] flex items-center gap-1.5 transition uppercase"
                    >
                      <Cog className="w-3.5 h-3.5 text-amber-600" />
                      Spare Request
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveModal("repair")}
                      className="p-2 rounded-none bg-white hover:bg-orange-50 text-orange-800 border border-orange-200 font-extrabold text-[10px] flex items-center gap-1.5 transition uppercase"
                    >
                      <Wrench className="w-3.5 h-3.5 text-orange-600" />
                      Repair Module
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveModal("qc")}
                      className="p-2 rounded-none bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-200 font-extrabold text-[10px] flex items-center gap-1.5 transition uppercase"
                    >
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      Quality Check
                    </button>

                    {selectedMachine.current_status === "Waiting Spare Part" && (
                      <button
                        type="button"
                        onClick={() => {
                          const spareId = machineBundle?.spareRequests?.[0]?.id || selectedMachine.id;
                          handleMarkSpareReceived(spareId);
                        }}
                        className="p-2 rounded-none bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-[10px] flex items-center justify-center gap-1.5 transition col-span-2 shadow-xs uppercase"
                      >
                        <Check className="w-4 h-4" />
                        Mark Spare Received
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => setActiveModal("dispatch")}
                      className="p-2 rounded-none bg-white hover:bg-sky-50 text-sky-800 border border-sky-200 font-extrabold text-[10px] flex items-center gap-1.5 transition col-span-2 uppercase"
                    >
                      <Send className="w-3.5 h-3.5 text-sky-600" />
                      Warehouse Dispatch
                    </button>
                  </div>
                </div>

                {/* Timeline */}
                <TRCTimeline
                  currentStatus={selectedMachine.current_status}
                  history={machineBundle?.statusHistory || []}
                  onSelectStage={(stage) => {
                    if (stage === "assign") setActiveModal("assign");
                    if (stage === "diagnosis") setActiveModal("diagnosis");
                    if (stage === "spare") setActiveModal("spare");
                    if (stage === "repair" || stage === "repair_in_progress") setActiveModal("repair");
                    if (stage === "qc" || stage === "dispatch_ready") setActiveModal("qc");
                    if (stage === "dispatched") setActiveModal("dispatch");
                  }}
                />
              </>
            ) : (
              <div className="bg-white border border-slate-200 rounded-none shadow-2xs p-8 text-center">
                <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <h4 className="text-sm font-bold text-slate-800">Select Machine to Inspect</h4>
                <p className="text-[10px] text-slate-400 mt-1">
                  Click on any machine in the table to view specifications, test reports, and 11-step audit timeline.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── ALL WORKFLOW MODALS ────────────────────────────────────────────── */}
      {activeModal === "assign" && selectedMachine && (
        <AssignmentModal
          isOpen={activeModal === "assign"}
          onClose={() => setActiveModal(null)}
          machine={selectedMachine}
          onSuccess={() => loadData()}
        />
      )}

      {activeModal === "diagnosis" && selectedMachine && (
        <DiagnosisModal
          isOpen={activeModal === "diagnosis"}
          onClose={() => setActiveModal(null)}
          machine={selectedMachine}
          onSuccess={() => loadData()}
        />
      )}

      {activeModal === "spare" && selectedMachine && (
        <SpareRequestModal
          isOpen={activeModal === "spare"}
          onClose={() => setActiveModal(null)}
          machine={selectedMachine}
          onSuccess={() => loadData()}
        />
      )}

      {activeModal === "repair" && selectedMachine && (
        <RepairFormModal
          isOpen={activeModal === "repair"}
          onClose={() => setActiveModal(null)}
          machine={selectedMachine}
          onSuccess={() => loadData()}
        />
      )}

      {activeModal === "qc" && selectedMachine && (
        <QCInspectionModal
          isOpen={activeModal === "qc"}
          onClose={() => setActiveModal(null)}
          machine={selectedMachine}
          onSuccess={() => loadData()}
        />
      )}

      {activeModal === "dispatch" && selectedMachine && (
        <DispatchModal
          isOpen={activeModal === "dispatch"}
          onClose={() => setActiveModal(null)}
          machine={selectedMachine}
          onSuccess={() => loadData()}
        />
      )}

      {activeModal === "print" && selectedMachine && (
        <JobCardPrintModal
          isOpen={activeModal === "print"}
          onClose={() => setActiveModal(null)}
          machine={selectedMachine}
          diagnosis={machineBundle?.diagnosis}
          repair={machineBundle?.repair}
          qc={machineBundle?.qc}
        />
      )}
    </div>
  );
}
