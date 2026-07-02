/**
 * shared-nav.js — Cyrix Field Report App
 * Injects sidebar (desktop) + mobile bottom nav + mobile header
 * Usage: <script src="shared-nav.js" data-active="dashboard"><\/script>
 */
(function () {
    const API = '/api';
    const token = localStorage.getItem('cx_token');
    const userRaw = localStorage.getItem('cx_user');
    let user = {};

    // Auth guard — redirect to login if no token
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    try { user = JSON.parse(userRaw) || {}; } catch (e) { user = {}; }

    const active = document.currentScript?.dataset?.active || '';
    const role = user.role || 'field_engineer';

    // ── Role-based nav items ────────────────────────────────────
    const ALL_NAV = {
        main: [
            {
                id: 'dashboard', label: 'Dashboard', href: '/dashboard.html',
                roles: ['field_engineer', 'manager', 'area_manager', 'admin', 'super_admin'],
                icon: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`
            },
            {
                id: 'submit-expense', label: 'Submit Expense', href: '/submit-expense.html',
                roles: ['field_engineer', 'manager', 'area_manager'],
                icon: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`
            },
            {
                id: 'expense-status', label: 'Expense Status', href: '/expense-status.html',
                roles: ['field_engineer', 'manager', 'area_manager'],
                icon: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`
            },
            {
                id: 'approval-center', label: 'Approval Center', href: '/approval-center.html',
                roles: ['manager', 'area_manager', 'admin', 'super_admin'],
                badge: 'pending_approvals',
                icon: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
            },
            {
                id: 'additional-km', label: 'Additional KM', href: '/additional-km.html',
                roles: ['field_engineer', 'manager', 'area_manager'],
                icon: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>`
            },
        ],
        reports: [
            {
                id: 'monthly-report', label: 'Monthly Report', href: '/monthly-report.html',
                roles: ['field_engineer', 'manager', 'area_manager', 'admin', 'super_admin'],
                icon: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`
            },
            {
                id: 'penalty-report', label: 'Penalty Report', href: '/penalty-report.html',
                roles: ['field_engineer', 'manager', 'area_manager', 'admin', 'super_admin'],
                icon: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
            },
        ],
        account: [
            {
                id: 'profile', label: 'My Profile', href: '/profile.html',
                roles: ['field_engineer', 'manager', 'area_manager', 'admin', 'super_admin'],
                icon: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`
            },
        ],
        admin: [
            {
                id: 'admin-users', label: 'User Management', href: '/admin/users.html',
                roles: ['admin', 'super_admin'],
                icon: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>`
            },
            {
                id: 'admin-roles', label: 'Role Management', href: '/admin/roles.html',
                roles: ['admin', 'super_admin'],
                icon: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`
            },
            {
                id: 'admin-hierarchy', label: 'Approval Hierarchy', href: '/admin/hierarchy.html',
                roles: ['admin', 'super_admin'],
                icon: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`
            },
            {
                id: 'admin-facilities', label: 'Facility Master', href: '/admin/facilities.html',
                roles: ['admin', 'super_admin'],
                icon: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`
            },
            {
                id: 'admin-districts', label: 'District Master', href: '/admin/districts.html',
                roles: ['admin', 'super_admin'],
                icon: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>`
            },
            {
                id: 'admin-assets', label: 'Asset Master', href: '/admin/assets.html',
                roles: ['admin', 'super_admin'],
                icon: `<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`
            },
        ]
    };

    // ── Filter nav by role ──────────────────────────────
    function hasAccess(item) {
        return item.roles.includes(role);
    }

    function buildNavItems(items) {
        return items.filter(hasAccess).map(item => `
      <a class="nav-item ${item.id === active ? 'active' : ''}" href="${item.href}" id="nav_${item.id}">
        ${item.icon}
        <span>${item.label}</span>
        ${item.badge ? `<span class="nav-badge" id="badge_${item.badge}" style="display:none;">0</span>` : ''}
      </a>
    `).join('');
    }

    // ── Mobile nav items (max 5 most important) ──────────
    const MOBILE_NAV = [
        {
            id: 'dashboard', label: 'Home', href: '/dashboard.html',
            icon: `<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
            roles: ['field_engineer', 'manager', 'area_manager', 'admin', 'super_admin']
        },
        {
            id: 'submit-expense', label: 'Expense', href: '/submit-expense.html',
            icon: `<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>`,
            roles: ['field_engineer', 'manager', 'area_manager']
        },
        {
            id: 'approval-center', label: 'Approvals', href: '/approval-center.html',
            icon: `<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
            badge: 'pending_approvals',
            roles: ['manager', 'area_manager', 'admin', 'super_admin']
        },
        {
            id: 'monthly-report', label: 'Reports', href: '/monthly-report.html',
            icon: `<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
            roles: ['field_engineer', 'manager', 'area_manager', 'admin', 'super_admin']
        },
        {
            id: 'profile', label: 'Profile', href: '/profile.html',
            icon: `<svg width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
            roles: ['field_engineer', 'manager', 'area_manager', 'admin', 'super_admin']
        },
    ];

    // ── Build Sidebar HTML ──────────────────────────────
    const initials = (user.full_name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

    const adminSection = ALL_NAV.admin.filter(hasAccess).length > 0 ? `
    <div class="nav-section-label">Administration</div>
    ${buildNavItems(ALL_NAV.admin)}
  ` : '';

    const sidebarHTML = `
    <aside class="sidebar" id="cx-sidebar">
      <div class="sidebar-brand">
        <img src="/logo.png" alt="Cyrix" class="sidebar-logo" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
        <div style="width:38px;height:38px;background:linear-gradient(135deg,#1d4ed8,#0ea5e9);border-radius:8px;align-items:center;justify-content:center;font-weight:900;font-size:14px;color:white;display:none;flex-shrink:0;">CH</div>
        <div class="sidebar-brand-text">
          <div class="sidebar-brand-name">Cyrix Healthcare</div>
          <div class="sidebar-brand-sub">Field Report App</div>
        </div>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section-label">Main Menu</div>
        ${buildNavItems(ALL_NAV.main)}

        <div class="nav-section-label">Reports</div>
        ${buildNavItems(ALL_NAV.reports)}

        <div class="nav-section-label">Account</div>
        ${buildNavItems(ALL_NAV.account)}

        ${adminSection}
      </nav>

      <div class="sidebar-footer">
        <div class="sidebar-user" onclick="window.location.href='/profile.html'">
          <div class="sidebar-avatar">${initials}</div>
          <div class="sidebar-user-info">
            <div class="sidebar-user-name">${user.full_name || 'User'}</div>
            <div class="sidebar-user-role">${formatRole(role)}</div>
          </div>
        </div>
        <div style="height:8px;"></div>
        <a class="nav-item" href="#" onclick="doLogout()">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          <span>Sign Out</span>
        </a>
      </div>
    </aside>
  `;

    // ── Mobile Header ───────────────────────────────────
    const mobileHeaderHTML = `
    <div class="mobile-header">
      <div class="mobile-header-logo">
        <img src="/logo.png" alt="Cyrix" onerror="this.style.display='none'">
        <span>Cyrix Field</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <div class="topbar-btn" style="width:34px;height:34px;" onclick="window.location.href='/profile.html'">
          <div style="width:28px;height:28px;background:linear-gradient(135deg,#1d4ed8,#0ea5e9);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:white;">${initials}</div>
        </div>
      </div>
    </div>
  `;

    // ── Mobile Bottom Nav ───────────────────────────────
    const mobileNavItems = MOBILE_NAV.filter(hasAccess).map(item => `
    <a class="mob-nav-item ${item.id === active ? 'active' : ''}" href="${item.href}">
      ${item.icon}
      <span>${item.label}</span>
      ${item.badge ? `<span class="mob-nav-badge" id="mob_badge_${item.badge}" style="display:none;">0</span>` : ''}
    </a>
  `).join('');

    const mobileNavHTML = `
    <nav class="mobile-bottom-nav">${mobileNavItems}</nav>
  `;

    // ── Toast Container ─────────────────────────────────
    const toastHTML = `<div id="toast-container"></div>`;

    // ── Inject into DOM ─────────────────────────────────
    const layout = document.getElementById('cx-layout');
    if (layout) {
        layout.insertAdjacentHTML('afterbegin', sidebarHTML);
    } else {
        document.body.insertAdjacentHTML('afterbegin', sidebarHTML);
    }

    const mainContainer = document.getElementById('mainContainer');
    if (mainContainer) {
        mainContainer.insertAdjacentHTML('afterbegin', mobileHeaderHTML);
        mainContainer.style.display = '';
        mainContainer.style.flexDirection = 'column';
    }

    document.body.insertAdjacentHTML('beforeend', mobileNavHTML + toastHTML);

    // ── Fetch pending badges ────────────────────────────
    if (['manager', 'area_manager', 'admin', 'super_admin'].includes(role)) {
        fetchPendingCount();
    }

    async function fetchPendingCount() {
        try {
            const res = await fetch(`${API}/approvals/pending-count`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success && data.count > 0) {
                ['badge_pending_approvals', 'mob_badge_pending_approvals'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) { el.textContent = data.count > 99 ? '99+' : data.count; el.style.display = 'flex'; }
                });
            }
        } catch (e) { }
    }

    // ── Logout ──────────────────────────────────────────
    window.doLogout = async function () {
        if (!confirm('Are you sure you want to sign out?')) return;
        try {
            await fetch(`${API}/auth/logout`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (e) { }
        localStorage.removeItem('cx_token');
        localStorage.removeItem('cx_user');
        window.location.href = '/login.html';
    };

    // ── Toast system ─────────────────────────────────────
    window.showToast = function (msg, type = 'info', duration = 4000) {
        const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'toast-out 0.3s forwards';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    };

    // ── Helpers ──────────────────────────────────────────
    function formatRole(r) {
        const map = {
            field_engineer: 'Field Engineer',
            manager: 'Manager',
            area_manager: 'Area Manager',
            admin: 'Administrator',
            super_admin: 'Super Admin'
        };
        return map[r] || r;
    }

    // ── API helper (global) ─────────────────────────────
    window.CxAPI = {
        get: (url) => fetch(`${API}${url}`, { headers: { 'Authorization': `Bearer ${token}` } }).then(r => r.json()),
        post: (url, body) => fetch(`${API}${url}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(r => r.json()),
        put: (url, body) => fetch(`${API}${url}`, {
            method: 'PUT',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(r => r.json()),
        delete: (url) => fetch(`${API}${url}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        }).then(r => r.json()),
        upload: (url, formData) => fetch(`${API}${url}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        }).then(r => r.json()),
        token, user, role
    };

    // ── Token expiry check ──────────────────────────────
    window.CxAPI.get('/auth/me').then(data => {
        if (!data.success) {
            localStorage.removeItem('cx_token');
            localStorage.removeItem('cx_user');
            window.location.href = '/login.html';
        }
    }).catch(() => { });

})();