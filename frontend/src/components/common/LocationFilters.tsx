import React from "react";
import { Col, Select } from "antd";

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
  labelClassName?: string;
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

  colProps = { xs: 12, sm: 6, md: 4, lg: 3 },
  selectClassName = "w-full bg-white border border-slate-300 rounded px-2 py-0.5 text-[11px] font-semibold text-slate-800 shadow-2xs focus:outline-none focus:border-blue-600 hover:border-slate-400 transition-colors cursor-pointer",
  labelClassName = "text-[9.5px] uppercase font-bold text-slate-200/90 tracking-wider",
  selectStyle = { minHeight: "28px", height: "28px" }
}) => {
  return (
    <>
      {/* 1. Zone Filter */}
      {showZone && (
        <Col {...colProps}>
          <div className="flex flex-col gap-0.5">
            <span className={labelClassName}>ZONE</span>
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
        <div className="flex flex-col gap-0.5">
          <span className={labelClassName}>DISTRICT</span>
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

      {/* 3. Engineer Filter (Searchable) */}
      <Col {...colProps}>
        <div className="flex flex-col gap-0.5">
          <span className={labelClassName}>ENGINEER</span>
          <Select
            showSearch
            size="small"
            value={selectedEngineer}
            onChange={(val) => onEngineerChange(val)}
            className="w-full text-xs font-semibold"
            style={{ minHeight: "28px", height: "28px" }}
            optionFilterProp="label"
            filterOption={(input, option) =>
              (option?.label ?? "").toLowerCase().includes(input.toLowerCase())
            }
            options={[
              { value: "all", label: "All Engineers" },
              ...engineers.map((emp) => ({
                value: emp.code,
                label: `${emp.name} (${emp.code})`,
              })),
            ]}
          />
        </div>
      </Col>
    </>
  );
};

export default LocationFilters;
