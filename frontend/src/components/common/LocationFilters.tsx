import React from "react";
import { Col } from "antd";

export interface EngineerOption {
  code: string;
  name: string;
}

export interface LocationFiltersProps {
  // Zone
  selectedZone: string;
  onZoneChange: (zone: string) => void;
  zones: string[];
  showZone?: boolean;
  isGlobalAdmin?: boolean;

  // District
  selectedDistrict: string;
  onDistrictChange: (district: string) => void;
  districts: string[];

  // Engineer
  selectedEngineer: string;
  onEngineerChange: (engineer: string) => void;
  engineers: EngineerOption[];

  // Layout / Styling customization
  colProps?: { xs?: number; sm?: number; md?: number; lg?: number };
  selectClassName?: string;
  selectStyle?: React.CSSProperties;
}

export const LocationFilters: React.FC<LocationFiltersProps> = ({
  selectedZone,
  onZoneChange,
  zones,
  showZone = true,
  isGlobalAdmin = true,

  selectedDistrict,
  onDistrictChange,
  districts,

  selectedEngineer,
  onEngineerChange,
  engineers,

  colProps = { xs: 12, sm: 6 },
  selectClassName = "w-full bg-white border border-gray-300 rounded px-2 py-1 text-xs font-semibold text-gray-800 shadow-2xs focus:outline-none focus:border-indigo-500 cursor-pointer",
  selectStyle = { minHeight: "34px", height: "34px", borderRadius: "6px", fontSize: "11px", lineHeight: "1.2" }
}) => {
  return (
    <>
      {/* 1. Zone Filter */}
      {showZone && (
        <Col {...colProps}>
          <div className="flex flex-col gap-1">
            <span className="text-[9px] uppercase font-bold text-gray-500 tracking-wider">Zone</span>
            <select
              value={selectedZone}
              onChange={(e) => onZoneChange(e.target.value)}
              className={selectClassName}
              style={selectStyle}
            >
              {isGlobalAdmin && <option value="all">All Zones</option>}
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>
        </Col>
      )}

      {/* 2. District Filter */}
      <Col {...colProps}>
        <div className="flex flex-col gap-1">
          <span className="text-[9px] uppercase font-bold text-gray-500 tracking-wider">District</span>
          <select
            value={selectedDistrict}
            onChange={(e) => onDistrictChange(e.target.value)}
            className={selectClassName}
            style={selectStyle}
          >
            <option value="all">All Districts</option>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </Col>

      {/* 3. Engineer Filter */}
      <Col {...colProps}>
        <div className="flex flex-col gap-1">
          <span className="text-[9px] uppercase font-bold text-gray-500 tracking-wider">Engineer</span>
          <select
            value={selectedEngineer}
            onChange={(e) => onEngineerChange(e.target.value)}
            className={selectClassName}
            style={selectStyle}
          >
            <option value="all">All Engineers</option>
            {engineers.map((emp) => (
              <option key={emp.code} value={emp.code}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>
      </Col>
    </>
  );
};

export default LocationFilters;
