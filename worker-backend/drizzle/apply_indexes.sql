-- Performance Indexes Migration for Cloudflare D1
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(user_status);
CREATE INDEX IF NOT EXISTS idx_users_manager ON users(manager);
CREATE INDEX IF NOT EXISTS idx_users_zonal_manager ON users(zonal_manager);
CREATE INDEX IF NOT EXISTS idx_users_coordinator ON users(coordinator);

CREATE INDEX IF NOT EXISTS idx_expenses_user_month_year ON expenses(user_id, month, year);
CREATE INDEX IF NOT EXISTS idx_expenses_status ON expenses(status);
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at);

CREATE INDEX IF NOT EXISTS idx_itineraries_exp_id ON expense_itineraries(exp_id);

CREATE INDEX IF NOT EXISTS idx_approvals_approver_status ON approvals(approver_id, status);
CREATE INDEX IF NOT EXISTS idx_approvals_expense_status ON approvals(expense_id, status);

CREATE INDEX IF NOT EXISTS idx_hier_approvers_approver ON hierarchy_approvers(approver_id);
CREATE INDEX IF NOT EXISTS idx_hier_requesters_hierarchy ON hierarchy_requesters(hierarchy_id);
CREATE INDEX IF NOT EXISTS idx_hier_requesters_user ON hierarchy_requesters(user_id);

CREATE INDEX IF NOT EXISTS idx_limit_reqs_user_month ON limit_approval_requests(user_id, for_month);
CREATE INDEX IF NOT EXISTS idx_limit_reqs_manager ON limit_approval_requests(manager_id, status);
