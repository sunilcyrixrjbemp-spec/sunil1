import { sqliteTable, integer, text, real, primaryKey } from "drizzle-orm/sqlite-core";

// 1. Users Table
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").unique().notNull(),
  eCode: text("e_code"),
  name: text("name").notNull(),
  hashedPassword: text("hashed_password").notNull(),
  userStatus: text("user_status").default("active"),
  designation: text("designation"),
  grade: text("grade"),
  district: text("district"),
  zone: text("zone"),
  manager: text("manager"),
  zonalManager: text("zonal_manager"),
  coordinator: text("coordinator"),
  mobileNumber: text("mobile_number"),
  mailId: text("mail_id"),
  role: text("role"),
  type: text("type"),
  dateOfJoining: text("date_of_joining"),
  dateOfBirth: text("date_of_birth"),
  eUpkaranId: text("e_upkaran_id"),
  allowedWindows: text("allowed_windows").default("home,expense,help,profile"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
  profilePhoto: text("profile_photo"),
});

// 2. User Roles Table
export const userRoles = sqliteTable("user_roles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  role: text("role").notNull(),
  assignedAt: text("assigned_at"),
});

// 3. OTPs Table
export const otps = sqliteTable("otps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  otpCode: text("otp_code").notNull(),
  otpType: text("otp_type").notNull(),
  expiresAt: text("expires_at").notNull(),
  isUsed: integer("is_used").default(0),
  createdAt: text("created_at"),
});

// 4. Login Logs Table
export const loginLogs = sqliteTable("login_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  status: text("status"),
  createdAt: text("created_at"),
});

// 5. Support Tickets Table
export const supportTickets = sqliteTable("support_tickets", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ticketCode: text("ticket_code").unique().notNull(),
  createdById: integer("created_by_id"),
  createdByName: text("created_by_name"),
  createdByCode: text("created_by_code"),
  concernType: text("concern_type").notNull(),
  expenseId: integer("expense_id"),
  expenseCode: text("expense_code"),
  priority: text("priority").default("Medium"),
  description: text("description").notNull(),
  assignedToRole: text("assigned_to_role"),
  assignedToName: text("assigned_to_name"),
  status: text("status").default("Open"),
  comments: text("comments"),
  needsFollowup: integer("needs_followup").default(0),
  closedAt: text("closed_at"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

// 6. System Settings Table
export const systemSettings = sqliteTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

// 7. Asset Value Master Table
export const assetValueMaster = sqliteTable("asset_value_master", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  equipmentName: text("equipment_name").notNull(),
  rmscTenderCost: real("rmsc_tender_cost").notNull(),
});

// 8. Assets Inventory Table
export const assetsInventory = sqliteTable("assets_inventory", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  districtName: text("district_name"),
  hospitalName: text("hospital_name"),
  departmentName: text("department_name"),
  groupName: text("group_name"),
  equipmentName: text("equipment_name"),
  modelName: text("model_name"),
  serialNo: text("serial_no"),
  equipmentCategory: text("equipment_category"),
  qrCode: text("qr_code").unique(),
  stockRegisterPageNo: text("stock_register_page_no"),
  receivedDate: text("received_date"),
  installationDate: text("installation_date"),
  inventoryEntryDate: text("inventory_entry_date"),
  moicVerifiedDate: text("moic_verified_date"),
  poDate: text("po_date"),
  poCost: text("po_cost"),
  inventoryStatus: text("inventory_status"),
  equipmentStatus: text("equipment_status"),
  supplier: text("supplier"),
  warrantyDetails: text("warranty_details"),
  assetValue: text("asset_value"),
  parsedAssetValue: real("parsed_asset_value"),
  diName: text("di_name"),
  dmName: text("dm_name"),
  coordinatorName: text("coordinator_name"),
  zoneName: text("zone_name"),
  hospitalType: text("hospital_type"),
  facilityType: text("facility_type"),
  equipmentType: text("equipment_type"),
  uploadedAt: text("uploaded_at"),
});

// 9. KPI Appraisals Table
export const kpiAppraisals = sqliteTable("kpi_appraisals", {
  userId: text("user_id").notNull(),
  month: text("month").notNull(),
  year: integer("year").notNull(),
  selfAchievedValues: text("self_achieved_values"),
  managerAchievedValues: text("manager_achieved_values"),
  coreRatings: text("core_ratings"),
  submittedBySelf: integer("submitted_by_self").default(0),
  submittedByManager: integer("submitted_by_manager").default(0),
  updatedAt: text("updated_at"),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.month, table.year] }),
}));

// 10. Legacy Hash Mapping Table
export const legacyHashMapping = sqliteTable("legacy_hash_mapping", {
  hashId: integer("hash_id").primaryKey(),
  expId: text("exp_id").unique().notNull(),
});

// 11. Password Histories Table
export const passwordHistories = sqliteTable("password_histories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  hashedPassword: text("hashed_password").notNull(),
  createdAt: text("created_at"),
});

// 12. Expenses Table
export const expenses = sqliteTable("expenses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").notNull(),
  month: text("month").notNull(),
  year: integer("year").notNull(),
  amount: real("amount").notNull(),
  status: text("status").default("draft"),
  travelMode: text("travel_mode"),
  itinerary: text("itinerary"),
  description: text("description"),
  expenseCode: text("expense_code").unique(),
  daAmount: real("da_amount").default(0.0),
  hotelAmount: real("hotel_amount").default(0.0),
  otherExpenseAmount: real("other_expense_amount").default(0.0),
  callsAssigned: integer("calls_assigned").default(0),
  callsCompleted: integer("calls_completed").default(0),
  pmsCount: integer("pms_count").default(0),
  assetTagging: integer("asset_tagging").default(0),
  localPurchaseAmount: real("local_purchase_amount").default(0.0),
  originalAmount: real("original_amount"),
  originalDaAmount: real("original_da_amount"),
  originalHotelAmount: real("original_hotel_amount"),
  originalOtherExpenseAmount: real("original_other_expense_amount"),
  originalLocalPurchaseAmount: real("original_local_purchase_amount"),
  calibrationCount: integer("calibration_count").default(0),
  mobiliseCount: integer("mobilise_count").default(0),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

// 13. Expense Master Table (Legacy)
export const expenseMaster = sqliteTable("expense_master", {
  expId: text("exp_id").primaryKey(),
  userId: text("user_id"),
  totalAmount: real("total_amount"),
  status: text("status"),
});

// 14. Expense Itineraries Table
export const expenseItineraries = sqliteTable("expense_itineraries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  itineraryId: text("itinerary_id").unique().notNull(),
  expId: text("exp_id").notNull(),
  legNumber: integer("leg_number").notNull(),
  fromDistrict: text("from_district"),
  toDistrict: text("to_district"),
  fromLocation: text("from_location"),
  toLocation: text("to_location"),
  travelMode: text("travel_mode"),
  distanceKm: real("distance_km"),
  travelAmount: real("travel_amount"),
  subMode: text("sub_mode"),
  subKm: real("sub_km"),
  subAmount: real("sub_amount"),
  daAmount: real("da_amount"),
  hotelAmount: real("hotel_amount"),
  localPurchase: real("local_purchase"),
  otherDesc: text("other_desc"),
  otherAmount: real("other_amount"),
  callsAssigned: integer("calls_assigned"),
  callsCompleted: integer("calls_completed"),
  pmsCount: integer("pms_count"),
  assetTagging: integer("asset_tagging"),
  visitPurpose: text("visit_purpose"),
  activityDetails: text("activity_details"),
  originalDistanceKm: real("original_distance_km"),
  originalTravelAmount: real("original_travel_amount"),
  originalSubAmount: real("original_sub_amount"),
  originalDaAmount: real("original_da_amount"),
  originalHotelAmount: real("original_hotel_amount"),
  originalOtherAmount: real("original_other_amount"),
  originalLocalPurchase: real("original_local_purchase"),
  calibrationCount: integer("calibration_count"),
  mobiliseCount: integer("mobilise_count"),
});

// 15. Expense Asset Taggings Table
export const expenseAssetTaggings = sqliteTable("expense_asset_taggings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  itineraryId: text("itinerary_id").notNull(),
  equipmentName: text("equipment_name").notNull(),
  quantity: integer("quantity").notNull(),
});

// 16. Approvals Table
export const approvals = sqliteTable("approvals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  expenseId: integer("expense_id").notNull(),
  approverId: text("approver_id").notNull(),
  levelNumber: integer("level_number").notNull(),
  status: text("status").default("pending"),
  comments: text("comments"),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

// 17. Approval Hierarchies Table
export const approvalHierarchies = sqliteTable("approval_hierarchies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
});

// 18. Hierarchy Requesters Table
export const hierarchyRequesters = sqliteTable("hierarchy_requesters", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  hierarchyId: integer("hierarchy_id").notNull(),
  userId: integer("user_id").notNull(),
});

// 19. Hierarchy Approvers Table
export const hierarchyApprovers = sqliteTable("hierarchy_approvers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  hierarchyId: integer("hierarchy_id").notNull(),
  levelNumber: integer("level_number").notNull(),
  approverId: integer("approver_id").notNull(),
});

// 20. Limit Approval Requests Table
export const limitApprovalRequests = sqliteTable("limit_approval_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").notNull(),
  requestType: text("request_type").notNull(),
  requestedValue: real("requested_value").notNull(),
  approvedValue: real("approved_value"),
  status: text("status").default("pending"),
  forMonth: text("for_month").notNull(),
  managerId: text("manager_id").notNull(),
  createdAt: text("created_at"),
  updatedAt: text("updated_at"),
});

// 21. Allowance Master Table
export const allowanceMaster = sqliteTable("allowance_master", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  grade: text("grade").notNull(),
  vehicleType: text("vehicle_type").notNull(),
  ratePerKm: real("rate_per_km").notNull(),
  maxKmPerMonth: integer("max_km_per_month"),
});

// 22. Facility Details Table
export const facilityDetails = sqliteTable("facility_details", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  districtName: text("district_name").notNull(),
  facilityName: text("facility_name").notNull(),
});

// 23. RJ Penalties Table
export const rjPenalties = sqliteTable("rj_penalties", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  districtName: text("district_name"),
  hospitalName: text("hospital_name"),
  coordinatorName: text("coordinator_name"),
  monthText: text("month_text"),
  totalPenalty: real("total_penalty"),
});
