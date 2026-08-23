import React, { useMemo } from "react";
import { Table } from "antd";
import { Users } from "lucide-react";
import { getCardStatusClass, renderAntdStatusTag, formatDateDDMMMYY } from "./claimsColumns";

interface ClaimsTableProps {
  data: any[];
  loading: boolean;
  columns: any[];
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  onRowClick: (record: any) => void;
  emptyText?: string;
  tabType?: "my-claims" | "team-claims";
}

const rowClassName = (_record: any): string => {
  return "hover:bg-[#F8FAFC] cursor-pointer transition-colors duration-150 border-b border-[#E2E8F0]/70";
};

const muiHeaderCell = (props: any) => (
  <th
    {...props}
    className="bg-[#F8FAFC]! text-[#475569]! font-bold! text-[11px]! uppercase! tracking-wider! py-2.5! px-3! border-b! border-[#E2E8F0]! border-r! border-[#E2E8F0]/60! last:border-r-0! select-none!"
  />
);

const tableComponents = { header: { cell: muiHeaderCell } };

export const ClaimsTable = React.memo(function ClaimsTable({
  data,
  loading,
  columns,
  pageSize,
  onPageSizeChange,
  onRowClick,
  emptyText,
  tabType = "my-claims",
}: ClaimsTableProps) {
  const isEmpty = !loading && data.length === 0;

  const pagination = useMemo(() => ({
    pageSize,
    showSizeChanger: true,
    pageSizeOptions: ["15", "25", "50", "100", "200"],
    onChange: (_: number, size: number) => onPageSizeChange(size),
    onShowSizeChange: (_: number, size: number) => onPageSizeChange(size),
    size: "small" as const,
    showTotal: (total: number, range: [number, number]) => {
      return (
        <span className="text-xs font-mono font-medium text-slate-500 mr-2">
          {range[0]}–{range[1]} of {total} items
        </span>
      );
    },
  }), [pageSize, onPageSizeChange]);

  if (isEmpty) {
    return (
      <div className="py-12 text-center bg-white border border-[#E2E8F0] rounded-[4px]">
        <Users className="w-8 h-8 mx-auto mb-2 text-slate-400" />
        <p className="font-semibold text-slate-700 text-xs m-0">
          {emptyText || (tabType === "team-claims" ? "No team claims found matching criteria." : "No claims found matching criteria.")}
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop MUI X DataGrid Styled Table */}
      <div className="hidden md:block overflow-x-auto w-full border border-[#E2E8F0] shadow-2xs rounded-[4px] bg-white">
        <Table
          loading={loading && data.length === 0}
          dataSource={data}
          rowKey="id"
          rowClassName={rowClassName}
          components={tableComponents}
          pagination={pagination}
          size="small"
          sticky={true}
          scroll={{ x: "max-content" }}
          columns={columns}
          onRow={(record) => ({ onClick: () => onRowClick(record) })}
        />
      </div>

      {/* Mobile Card List (Matches ExpensePage mobile view) */}
      <div className="block md:hidden space-y-2">
        {data.map((exp: any) => (
          <div
            key={exp.id}
            onClick={() => onRowClick(exp)}
            className={`p-3 space-y-2 transition-all cursor-pointer text-xs rounded-[4px] ${getCardStatusClass(exp.status)}`}
          >
            <div className="flex justify-between items-center border-b border-slate-150 pb-1.5 flex-wrap gap-1">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold font-mono text-indigo-600 text-xs uppercase">
                  {exp.expense_code || exp.claim_id || `#${exp.id}`}
                </span>
                {tabType === "team-claims" && exp.submitter_name && (
                  <span className="text-[11px] font-bold text-slate-800">
                    • {exp.submitter_name}
                  </span>
                )}
              </div>
              {renderAntdStatusTag(exp.status)}
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div>
                <span className="text-slate-400 font-bold uppercase text-[9px] block">Date</span>
                <span className="text-slate-700 font-semibold">{formatDateDDMMMYY(exp.date || exp.itinerary)}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase text-[9px] block">
                  {tabType === "team-claims" ? "District" : "Travel Mode"}
                </span>
                <span className="text-slate-700 font-semibold">
                  {tabType === "team-claims"
                    ? (exp.district || exp.submitter_district || exp.zone || "—")
                    : (exp.travel_mode || exp.category || "Bike")}
                </span>
              </div>
              <div className="col-span-2 pt-1 border-t border-slate-150 flex items-center justify-between">
                <span className="text-slate-400 font-bold uppercase text-[9px]">Total Amount</span>
                <span className="text-blue-700 font-black font-mono text-sm">
                  ₹{Number(exp.amount || exp.total_amount || 0).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {exp.description && (
              <div className="border-t border-slate-150 pt-1 text-[10.5px]">
                <span className="text-slate-400 font-bold uppercase text-[8px] block">Purpose</span>
                <p className="text-slate-700 font-medium truncate m-0">{exp.description}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
});
