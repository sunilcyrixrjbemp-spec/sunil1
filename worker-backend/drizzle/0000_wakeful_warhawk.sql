CREATE TABLE `allowance_master` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`grade` text NOT NULL,
	`vehicle_type` text NOT NULL,
	`rate_per_km` real NOT NULL,
	`max_km_per_month` integer
);
--> statement-breakpoint
CREATE TABLE `approval_hierarchies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `approvals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`expense_id` integer NOT NULL,
	`approver_id` text NOT NULL,
	`level_number` integer NOT NULL,
	`status` text DEFAULT 'pending',
	`comments` text,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `asset_value_master` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`equipment_name` text NOT NULL,
	`rmsc_tender_cost` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `assets_inventory` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`district_name` text,
	`hospital_name` text,
	`department_name` text,
	`group_name` text,
	`equipment_name` text,
	`model_name` text,
	`serial_no` text,
	`equipment_category` text,
	`qr_code` text,
	`stock_register_page_no` text,
	`received_date` text,
	`installation_date` text,
	`inventory_entry_date` text,
	`moic_verified_date` text,
	`po_date` text,
	`po_cost` text,
	`inventory_status` text,
	`equipment_status` text,
	`supplier` text,
	`warranty_details` text,
	`asset_value` text,
	`parsed_asset_value` real,
	`di_name` text,
	`dm_name` text,
	`coordinator_name` text,
	`zone_name` text,
	`hospital_type` text,
	`facility_type` text,
	`equipment_type` text,
	`uploaded_at` text
);
--> statement-breakpoint
CREATE TABLE `expense_asset_taggings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`itinerary_id` text NOT NULL,
	`equipment_name` text NOT NULL,
	`quantity` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `expense_itineraries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`itinerary_id` text NOT NULL,
	`exp_id` text NOT NULL,
	`leg_number` integer NOT NULL,
	`from_district` text,
	`to_district` text,
	`from_location` text,
	`to_location` text,
	`travel_mode` text,
	`distance_km` real,
	`travel_amount` real,
	`sub_mode` text,
	`sub_km` real,
	`sub_amount` real,
	`da_amount` real,
	`hotel_amount` real,
	`local_purchase` real,
	`other_desc` text,
	`other_amount` real,
	`calls_assigned` integer,
	`calls_completed` integer,
	`pms_count` integer,
	`asset_tagging` integer,
	`visit_purpose` text,
	`activity_details` text,
	`original_distance_km` real,
	`original_travel_amount` real,
	`original_sub_amount` real,
	`original_da_amount` real,
	`original_hotel_amount` real,
	`original_other_amount` real,
	`original_local_purchase` real,
	`calibration_count` integer,
	`mobilise_count` integer
);
--> statement-breakpoint
CREATE TABLE `expense_master` (
	`exp_id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`total_amount` real,
	`status` text
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`month` text NOT NULL,
	`year` integer NOT NULL,
	`amount` real NOT NULL,
	`status` text DEFAULT 'draft',
	`travel_mode` text,
	`itinerary` text,
	`description` text,
	`expense_code` text,
	`da_amount` real DEFAULT 0,
	`hotel_amount` real DEFAULT 0,
	`other_expense_amount` real DEFAULT 0,
	`calls_assigned` integer DEFAULT 0,
	`calls_completed` integer DEFAULT 0,
	`pms_count` integer DEFAULT 0,
	`asset_tagging` integer DEFAULT 0,
	`local_purchase_amount` real DEFAULT 0,
	`original_amount` real,
	`original_da_amount` real,
	`original_hotel_amount` real,
	`original_other_expense_amount` real,
	`original_local_purchase_amount` real,
	`calibration_count` integer DEFAULT 0,
	`mobilise_count` integer DEFAULT 0,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `facility_details` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`district_name` text NOT NULL,
	`facility_name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hierarchy_approvers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`hierarchy_id` integer NOT NULL,
	`level_number` integer NOT NULL,
	`approver_id` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hierarchy_requesters` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`hierarchy_id` integer NOT NULL,
	`user_id` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `kpi_appraisals` (
	`user_id` text NOT NULL,
	`month` text NOT NULL,
	`year` integer NOT NULL,
	`self_achieved_values` text,
	`manager_achieved_values` text,
	`core_ratings` text,
	`submitted_by_self` integer DEFAULT 0,
	`submitted_by_manager` integer DEFAULT 0,
	`updated_at` text,
	PRIMARY KEY(`month`, `user_id`, `year`)
);
--> statement-breakpoint
CREATE TABLE `legacy_hash_mapping` (
	`hash_id` integer PRIMARY KEY NOT NULL,
	`exp_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `limit_approval_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`request_type` text NOT NULL,
	`requested_value` real NOT NULL,
	`approved_value` real,
	`status` text DEFAULT 'pending',
	`for_month` text NOT NULL,
	`manager_id` text NOT NULL,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `login_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text,
	`ip_address` text,
	`user_agent` text,
	`status` text,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `no_ta_da_hospitals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`hospital_name` text NOT NULL,
	`district_name` text NOT NULL,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `otps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`otp_code` text NOT NULL,
	`otp_type` text NOT NULL,
	`expires_at` text NOT NULL,
	`is_used` integer DEFAULT 0,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `password_histories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`hashed_password` text NOT NULL,
	`created_at` text
);
--> statement-breakpoint
CREATE TABLE `rj_penalties` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`district_name` text,
	`hospital_name` text,
	`coordinator_name` text,
	`month_text` text,
	`total_penalty` real
);
--> statement-breakpoint
CREATE TABLE `support_tickets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ticket_code` text NOT NULL,
	`created_by_id` integer,
	`created_by_name` text,
	`created_by_code` text,
	`concern_type` text NOT NULL,
	`expense_id` integer,
	`expense_code` text,
	`priority` text DEFAULT 'Medium',
	`description` text NOT NULL,
	`assigned_to_role` text,
	`assigned_to_name` text,
	`status` text DEFAULT 'Open',
	`comments` text,
	`needs_followup` integer DEFAULT 0,
	`closed_at` text,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `system_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`assigned_at` text
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`e_code` text,
	`name` text NOT NULL,
	`hashed_password` text NOT NULL,
	`user_status` text DEFAULT 'active',
	`designation` text,
	`grade` text,
	`district` text,
	`zone` text,
	`manager` text,
	`zonal_manager` text,
	`coordinator` text,
	`mobile_number` text,
	`mail_id` text,
	`role` text,
	`type` text,
	`date_of_joining` text,
	`date_of_birth` text,
	`e_upkaran_id` text,
	`base_reporting_location` text,
	`allowed_windows` text DEFAULT 'home,expense,help,profile',
	`created_at` text,
	`updated_at` text,
	`failed_attempt` integer DEFAULT 0,
	`active_session_id` text,
	`fcm_token` text,
	`profile_pic_url` text
);
--> statement-breakpoint
CREATE INDEX `idx_approvals_approver_status` ON `approvals` (`approver_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_approvals_expense_status` ON `approvals` (`expense_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `assets_inventory_qr_code_unique` ON `assets_inventory` (`qr_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `expense_itineraries_itinerary_id_unique` ON `expense_itineraries` (`itinerary_id`);--> statement-breakpoint
CREATE INDEX `idx_itineraries_exp_id` ON `expense_itineraries` (`exp_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `expenses_expense_code_unique` ON `expenses` (`expense_code`);--> statement-breakpoint
CREATE INDEX `idx_expenses_user_month_year` ON `expenses` (`user_id`,`month`,`year`);--> statement-breakpoint
CREATE INDEX `idx_expenses_status` ON `expenses` (`status`);--> statement-breakpoint
CREATE INDEX `idx_expenses_created_at` ON `expenses` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_hier_approvers_approver` ON `hierarchy_approvers` (`approver_id`);--> statement-breakpoint
CREATE INDEX `idx_hier_requesters_hierarchy` ON `hierarchy_requesters` (`hierarchy_id`);--> statement-breakpoint
CREATE INDEX `idx_hier_requesters_user` ON `hierarchy_requesters` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `legacy_hash_mapping_exp_id_unique` ON `legacy_hash_mapping` (`exp_id`);--> statement-breakpoint
CREATE INDEX `idx_limit_reqs_user_month` ON `limit_approval_requests` (`user_id`,`for_month`);--> statement-breakpoint
CREATE INDEX `idx_limit_reqs_manager` ON `limit_approval_requests` (`manager_id`,`status`);--> statement-breakpoint
CREATE UNIQUE INDEX `support_tickets_ticket_code_unique` ON `support_tickets` (`ticket_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_user_id_unique` ON `users` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_users_user_id` ON `users` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_users_status` ON `users` (`user_status`);--> statement-breakpoint
CREATE INDEX `idx_users_manager` ON `users` (`manager`);--> statement-breakpoint
CREATE INDEX `idx_users_zonal_manager` ON `users` (`zonal_manager`);--> statement-breakpoint
CREATE INDEX `idx_users_coordinator` ON `users` (`coordinator`);