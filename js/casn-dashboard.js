(function(){
    document.documentElement.classList.add('dark-mode');

    const SLA_TARGET = { CRITICAL: 8, HIGH: 12, MEDIUM: 24, LOW: 48 };
    const FINISHED_STATUSES = new Set(['close', 'resolved', 'return']);
    const PRIORITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    const ESCALATION_TARGET_HOURS = 0.25;
    const ESCALATION_ELIGIBLE = new Set(['close', 'resolved', 'return', 'open', 'on progress']);
    const ESCALATION_CHANNELS = new Set(['email', 'whatsapp']);
    const COMBINED_VALUE = 'COMBINED:E-Meterai|Perisai';
    const PIN_STORAGE_KEY = 'casn_admin_pin_session';
    const AGENT_MAP_STORAGE_KEY = 'casn_agent_map_v1';
    const AGENT_COL_CANDIDATES = [
        'created_by_name', 'create_by_name', 'created by name', 'create by name',
        'agent_name', 'agent', 'nama_agent', 'created_by', 'creator_name',
        'pic', 'handled_by', 'operator', 'username', 'user_name', 'owner',
        'assigned_to', 'first_response_by'
    ];

    const DURATION_BUCKETS = [
        { label: '8 Jam', max: 8 },
        { label: '12 Jam', max: 12 },
        { label: '24 Jam', max: 24 },
        { label: '36 Jam', max: 36 },
        { label: '48 Jam', max: 48 },
        { label: '<4 Hari', max: 96 },
        { label: '4-10 Hari', max: 240 },
        { label: '11-20 Hari', max: 480 },
        { label: '21-30 Hari', max: 720 },
        { label: '>30 Hari', max: Infinity },
    ];

    let allInteractions = [];
    let ticketsMap = new Map();
    let slaViewMode = 'exclude';
    let selectedProduct = 'ALL';
    let selectedCategory = 'ALL';
    let selectedMonth = 'ALL';
    let selectedSharedProducts = new Set();
    let sharedProductSearch = '';
    let availableSubcategoryProducts = [];
    let currentScopedRows = [];
    let isDark = true;
    let lastCapturedBlob = null;
    let adminPin = sessionStorage.getItem(PIN_STORAGE_KEY) || '';
    let statusTimer = null;

    let agentProductScope = 'ALL';
    let selectedAgentNames = new Set();
    let agentFilterSearch = '';
    let lastAvailableAgents = [];
    let lastAgentSummaryRows = [];

    function loadLocalAgentMap(){
        try {
            const raw = localStorage.getItem(AGENT_MAP_STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (_) {
            return {};
        }
    }

    function saveLocalAgentMap(records){
        try {
            const existing = loadLocalAgentMap();
            records.forEach(r => {
                if(r && r.id && r.agent) existing[r.id] = r.agent;
            });
            localStorage.setItem(AGENT_MAP_STORAGE_KEY, JSON.stringify(existing));
        } catch (_) {}
    }

    function clearLocalAgentMap(){
        try { localStorage.removeItem(AGENT_MAP_STORAGE_KEY); } catch (_) {}
    }

    function escapeHtml(str){
        return String(str == null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function injectProStyles(){
        if(document.getElementById('casnProUiStyle')) return;
        const css = `
            :root {
                --ops-bg: #f5f6f8;
                --ops-surface: #ffffff;
                --ops-surface-subtle: #f9fafb;
                --ops-border: #e2e5ea;
                --ops-text: #111827;
                --ops-muted: #6b7280;
                --ops-accent: #1d4ed8;
            }
            html.dark-mode {
                --ops-bg: #101113;
                --ops-surface: #17181c;
                --ops-surface-subtle: #1d1f24;
                --ops-border: #282b32;
                --ops-text: #eceef2;
                --ops-muted: #8e95a2;
                --ops-accent: #3b82f6;
            }

            body,
            #layoutSidenav_content {
                background-color: var(--ops-bg) !important;
                color: var(--ops-text) !important;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
            }

            .sb-topnav {
                position: sticky !important;
                top: 0;
                z-index: 1035;
                min-height: 48px;
                padding: 0.3rem 1rem !important;
                background-color: var(--ops-surface) !important;
                border-bottom: 1px solid var(--ops-border) !important;
                box-shadow: none !important;
            }
            .sb-topnav .navbar-brand {
                font-size: 0.94rem !important;
                font-weight: 600 !important;
                letter-spacing: -0.015em;
                color: var(--ops-text) !important;
                white-space: nowrap;
            }
            #navControlsWrap {
                display: flex !important;
                align-items: center !important;
                flex-wrap: nowrap !important;
                gap: 0.35rem !important;
                margin-left: auto !important;
            }
            #navControlsWrap .btn,
            #navControlsWrap .form-select {
                font-size: 0.75rem !important;
                font-weight: 500 !important;
                line-height: 1.2 !important;
                padding: 0.25rem 0.55rem !important;
                border-radius: 5px !important;
                white-space: nowrap !important;
                height: 28px !important;
                display: inline-flex;
                align-items: center;
                box-shadow: none !important;
            }
            #navControlsWrap .form-select {
                padding-right: 1.55rem !important;
            }
            #adminControlsGroup {
                display: inline-flex;
                align-items: center;
                gap: 0.28rem;
                padding: 2px 4px;
                border-radius: 5px;
                background: var(--ops-surface-subtle);
                border: 1px solid var(--ops-border);
            }
            #adminControlsGroup .btn,
            #adminControlsGroup .form-select {
                height: 24px !important;
                padding: 0.15rem 0.45rem !important;
                font-size: 0.72rem !important;
            }
            #adminControlsGroup .form-select {
                padding-right: 1.45rem !important;
            }
            .nav-sep {
                width: 1px;
                height: 16px;
                background: var(--ops-border);
                margin: 0 3px;
            }

            #pageHeading {
                font-size: 1.28rem !important;
                font-weight: 600 !important;
                letter-spacing: -0.02em;
                color: var(--ops-text) !important;
            }
            .breadcrumb {
                font-size: 0.75rem !important;
                color: var(--ops-muted) !important;
            }
            #metaBadge {
                font-size: 0.73rem !important;
                font-weight: 500 !important;
                padding: 0.28rem 0.6rem !important;
                border-radius: 4px !important;
                white-space: nowrap !important;
                background: var(--ops-surface) !important;
                color: var(--ops-muted) !important;
                border: 1px solid var(--ops-border) !important;
            }

            #statusAlert {
                font-size: 0.78rem !important;
                padding: 0.45rem 0.8rem !important;
                border-radius: 5px !important;
                margin-bottom: 0.85rem !important;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.5rem;
                transition: opacity 0.2s ease;
            }
            html.dark-mode #statusAlert.alert-info {
                background: #181a20 !important;
                color: #cbd5e1 !important;
                border: 1px solid #2b2f3a !important;
            }
            html.dark-mode #statusAlert.alert-success {
                background: #13221c !important;
                color: #6ee7b7 !important;
                border: 1px solid #1f3d31 !important;
            }
            html.dark-mode #statusAlert.alert-warning {
                background: #231e14 !important;
                color: #fcd34d !important;
                border: 1px solid #3f341d !important;
            }
            html.dark-mode #statusAlert.alert-danger {
                background: #241618 !important;
                color: #fca5a5 !important;
                border: 1px solid #422226 !important;
            }

            #sharedDailyControls,
            #slaPageControls {
                background-color: var(--ops-surface) !important;
                border: 1px solid var(--ops-border) !important;
                border-radius: 6px !important;
                margin-bottom: 1rem !important;
                box-shadow: none !important;
                overflow: visible !important;
            }
            #sharedDailyControls .card-body,
            #slaPageControls .card-body {
                display: flex !important;
                flex-wrap: wrap !important;
                align-items: center !important;
                justify-content: flex-start !important;
                gap: 0.5rem 0.7rem !important;
                padding: 0.5rem 0.8rem !important;
                overflow: visible !important;
            }
            #sharedDailyControls label,
            #sharedDailyControls .fw-bold,
            #sharedDailyControls > .card-body > span,
            #slaPageControls label {
                font-size: 0.74rem !important;
                font-weight: 500 !important;
                color: var(--ops-muted);
                white-space: nowrap !important;
                margin: 0 !important;
            }
            #sharedDailyControls .form-select,
            #slaPageControls .form-select {
                font-size: 0.76rem !important;
                padding: 0.2rem 1.6rem 0.2rem 0.5rem !important;
                height: 28px !important;
                border-radius: 4px !important;
                background-color: var(--ops-surface-subtle) !important;
                border-color: var(--ops-border) !important;
                color: var(--ops-text) !important;
            }
            .shared-filter-sep {
                width: 1px;
                height: 16px;
                background: var(--ops-border);
                margin: 0 2px;
                flex-shrink: 0;
            }
            #dailySourceBadge,
            #slaModePill {
                white-space: nowrap !important;
                font-size: 0.72rem !important;
                font-weight: 500 !important;
                padding: 0.2rem 0.55rem !important;
                border-radius: 4px !important;
                background: var(--ops-surface-subtle) !important;
                color: var(--ops-muted) !important;
                border: 1px solid var(--ops-border) !important;
                margin-left: auto;
            }

            .casn-kpi-card {
                background: var(--ops-surface) !important;
                border: 1px solid var(--ops-border) !important;
                border-radius: 6px !important;
                box-shadow: none !important;
            }
            .casn-kpi-label {
                font-size: 0.74rem;
                font-weight: 500;
                color: var(--ops-muted);
                display: flex;
                align-items: center;
                gap: 0.4rem;
            }
            .kpi-dot {
                width: 7px;
                height: 7px;
                border-radius: 50%;
                display: inline-block;
                flex-shrink: 0;
            }
            .kpi-dot.neutral { background: #64748b; }
            .kpi-dot.blue { background: #3b82f6; }
            .kpi-dot.green { background: #10b981; }
            .kpi-dot.amber { background: #f59e0b; }
            .kpi-dot.red { background: #ef4444; }
            .casn-kpi-val {
                font-size: 1.42rem;
                font-weight: 600;
                line-height: 1.2;
                letter-spacing: -0.02em;
                color: var(--ops-text);
                font-variant-numeric: tabular-nums;
            }
            .casn-kpi-sub {
                font-size: 0.72rem;
                color: var(--ops-muted);
                font-variant-numeric: tabular-nums;
            }

            .card {
                background-color: var(--ops-surface) !important;
                border: 1px solid var(--ops-border) !important;
                border-radius: 6px !important;
                box-shadow: none !important;
            }
            .card-header {
                background-color: var(--ops-surface) !important;
                border-bottom: 1px solid var(--ops-border) !important;
                color: var(--ops-text) !important;
                font-size: 0.82rem !important;
                font-weight: 600 !important;
                padding: 0.58rem 0.85rem !important;
                letter-spacing: -0.01em;
            }
            .row > [class*="col-"] > .card {
                height: calc(100% - 1rem);
                margin-bottom: 1rem !important;
            }

            .report-tbl,
            .sla-tbl {
                width: 100% !important;
                table-layout: auto !important;
                font-size: 0.76rem !important;
                border-collapse: collapse;
                color: var(--ops-text) !important;
            }
            .report-tbl th,
            .report-tbl td,
            .sla-tbl th,
            .sla-tbl td {
                padding: 0.44rem 0.55rem !important;
                border-bottom: 1px solid var(--ops-border) !important;
                font-variant-numeric: tabular-nums;
                vertical-align: middle !important;
            }
            .report-tbl thead th,
            .sla-tbl thead th {
                background-color: var(--ops-surface-subtle) !important;
                color: var(--ops-muted) !important;
                font-size: 0.71rem !important;
                font-weight: 600 !important;
                white-space: nowrap !important;
            }
            .report-tbl tbody tr:hover,
            .sla-tbl tbody tr:hover {
                background-color: var(--ops-surface-subtle) !important;
            }
            .report-tbl td.row-title {
                font-weight: 500 !important;
                white-space: nowrap !important;
                text-align: left !important;
            }
            .report-tbl td.big-num {
                font-size: 0.82rem !important;
                font-weight: 600 !important;
                text-align: center !important;
            }
            .report-tbl td.num {
                font-size: 0.76rem !important;
                text-align: right !important;
            }
            .report-tbl tr.total-row td {
                background-color: var(--ops-surface-subtle) !important;
                font-weight: 600 !important;
                border-top: 1px solid var(--ops-border) !important;
            }
            .rank-num {
                color: var(--ops-muted);
                font-weight: 500;
            }
            .rank-num.top5 {
                color: var(--ops-text);
                font-weight: 700;
            }
            .tbl-grp-border {
                border-left: 1px solid var(--ops-border) !important;
            }
            .ops-split-col {
                border-right: 1px solid var(--ops-border);
            }
            @media (max-width: 767.98px) {
                .ops-split-col {
                    border-right: none;
                    border-bottom: 1px solid var(--ops-border);
                }
            }
            .ops-subhdr {
                font-size: 0.72rem;
                font-weight: 600;
                color: var(--ops-muted);
                padding: 0.42rem 0.6rem;
                background-color: var(--ops-surface-subtle);
                border-bottom: 1px solid var(--ops-border);
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            .case-cell-wrap {
                max-width: 270px;
                white-space: normal !important;
                line-height: 1.3;
            }
            .case-cell-title {
                font-weight: 500;
                color: var(--ops-text);
                font-size: 0.75rem;
            }
            .case-cell-meta {
                font-size: 0.69rem;
                color: var(--ops-muted);
                margin-top: 2px;
                font-variant-numeric: tabular-nums;
            }
            .agent-toolbar-ctrl {
                font-size: 0.74rem !important;
                height: 27px !important;
                padding: 0.18rem 0.55rem !important;
                border-radius: 4px !important;
                background-color: var(--ops-surface-subtle) !important;
                border: 1px solid var(--ops-border) !important;
                color: var(--ops-text) !important;
            }
            select.agent-toolbar-ctrl {
                padding-right: 1.55rem !important;
            }

            /* Multi-select Checkbox Dropdown */
            .agent-multiselect-wrap {
                position: relative;
                display: inline-block;
            }
            .agent-multiselect-btn {
                display: inline-flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.5rem;
                min-width: 175px;
                max-width: 260px;
                height: 28px !important;
                cursor: pointer;
                text-align: left;
            }
            .agent-multiselect-btn.has-selection {
                border-color: var(--ops-accent) !important;
            }
            .agent-multiselect-btn-text {
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                font-size: 0.76rem !important;
                color: var(--ops-text) !important;
            }
            .agent-multiselect-menu {
                position: absolute;
                right: 0;
                top: calc(100% + 4px);
                z-index: 1060;
                min-width: 255px;
                max-width: 310px;
                background-color: var(--ops-surface);
                border: 1px solid var(--ops-border);
                border-radius: 6px;
                box-shadow: 0 10px 25px rgba(0, 0, 0, 0.38);
                padding: 0.45rem;
                display: none;
            }
            .agent-multiselect-menu.align-left {
                right: auto;
                left: 0;
            }
            .agent-multiselect-menu.open {
                display: block;
            }
            .agent-multiselect-search {
                width: 100%;
                font-size: 0.74rem;
                height: 27px;
                padding: 0.2rem 0.5rem;
                border-radius: 4px;
                background-color: var(--ops-surface-subtle);
                border: 1px solid var(--ops-border);
                color: var(--ops-text);
                margin-bottom: 0.35rem;
            }
            .agent-multiselect-search:focus {
                outline: none;
                border-color: var(--ops-accent);
            }
            .agent-multiselect-actions {
                display: flex;
                align-items: center;
                justify-content: space-between;
                font-size: 0.71rem;
                padding: 0.15rem 0.2rem 0.35rem;
                border-bottom: 1px solid var(--ops-border);
                margin-bottom: 0.25rem;
                color: var(--ops-muted);
            }
            .agent-multiselect-actions button {
                background: none;
                border: none;
                padding: 0;
                font-size: 0.71rem;
                font-weight: 500;
                color: var(--ops-accent);
                cursor: pointer;
            }
            .agent-multiselect-actions button:hover {
                text-decoration: underline;
            }
            .agent-multiselect-list {
                max-height: 235px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 1px;
            }
            .agent-multiselect-item {
                display: flex !important;
                align-items: center;
                gap: 0.45rem;
                padding: 0.3rem 0.4rem;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.75rem !important;
                font-weight: 400 !important;
                color: var(--ops-text) !important;
                margin: 0;
                user-select: none;
            }
            .agent-multiselect-item:hover {
                background-color: var(--ops-surface-subtle);
            }
            .agent-multiselect-item input[type="checkbox"] {
                margin: 0;
                cursor: pointer;
                flex-shrink: 0;
                accent-color: var(--ops-accent);
            }
            .agent-multiselect-item-name {
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            .agent-multiselect-item-count {
                font-size: 0.69rem;
                color: var(--ops-muted);
                font-variant-numeric: tabular-nums;
            }

            .badge {
                border-radius: 4px !important;
                font-weight: 500 !important;
                font-size: 0.7rem !important;
                padding: 0.22rem 0.45rem !important;
            }
            html.dark-mode .badge.bg-success {
                background-color: rgba(16, 185, 129, 0.14) !important;
                color: #34d399 !important;
                border: 1px solid rgba(16, 185, 129, 0.28);
            }
            html.dark-mode .badge.bg-danger {
                background-color: rgba(239, 68, 68, 0.14) !important;
                color: #f87171 !important;
                border: 1px solid rgba(239, 68, 68, 0.28);
            }
            html.dark-mode .badge.bg-warning {
                background-color: rgba(245, 158, 11, 0.14) !important;
                color: #fbbf24 !important;
                border: 1px solid rgba(245, 158, 11, 0.28);
            }
            html.dark-mode .badge.bg-info {
                background-color: rgba(59, 130, 246, 0.14) !important;
                color: #60a5fa !important;
                border: 1px solid rgba(59, 130, 246, 0.28);
            }
            html.dark-mode .badge.bg-secondary {
                background-color: rgba(148, 163, 184, 0.14) !important;
                color: #94a3b8 !important;
                border: 1px solid rgba(148, 163, 184, 0.24);
            }

            #sidenavAccordion {
                background-color: var(--ops-surface) !important;
                border-right: 1px solid var(--ops-border) !important;
            }
            #sidenavAccordion .nav-link {
                font-size: 0.81rem !important;
                color: var(--ops-muted) !important;
                padding: 0.52rem 0.9rem !important;
                border-left: 2px solid transparent;
                transition: color 0.12s ease, background-color 0.12s ease;
            }
            #sidenavAccordion .nav-link:hover {
                color: var(--ops-text) !important;
                background: var(--ops-surface-subtle) !important;
            }
            #sidenavAccordion .nav-link.active {
                color: var(--ops-text) !important;
                border-left-color: var(--ops-accent) !important;
                background: var(--ops-surface-subtle) !important;
                font-weight: 600 !important;
            }
        `;
        const styleEl = document.createElement('style');
        styleEl.id = 'casnProUiStyle';
        styleEl.textContent = css;
        document.head.appendChild(styleEl);
    }

    function relocateSlaFiltersToPage(){
        const sidebarBox = document.getElementById('sidebarSlaFilters');
        const actualDash = document.getElementById('actualDashboard');
        const prodSel = document.getElementById('productFilter');
        const catSel = document.getElementById('categoryFilter');
        const monthSel = document.getElementById('monthFilter');

        if(actualDash && prodSel && catSel && monthSel && !document.getElementById('slaPageControls')){
            const bar = document.createElement('div');
            bar.id = 'slaPageControls';
            bar.className = 'card mb-3';
            bar.innerHTML =
                '<div class="card-body">' +
                  '<label for="productFilter">Produk:</label>' +
                  '<span id="slotSlaProd"></span>' +
                  '<span class="shared-filter-sep"></span>' +
                  '<label for="categoryFilter">Kategori:</label>' +
                  '<span id="slotSlaCat"></span>' +
                  '<span class="shared-filter-sep"></span>' +
                  '<label for="monthFilter">Bulan:</label>' +
                  '<span id="slotSlaMonth"></span>' +
                  '<button type="button" id="resetSlaFiltersBtn" class="btn btn-outline-secondary btn-sm py-0 px-2" style="height:28px;font-size:0.74rem;display:none;">Reset Filter</button>' +
                  '<span id="slaModePill">SLA: Internal (Excl. Pending)</span>' +
                '</div>';

            actualDash.insertBefore(bar, actualDash.firstChild);

            [prodSel, catSel, monthSel].forEach(sel => {
                sel.className = 'form-select form-select-sm';
                sel.style.width = 'auto';
                sel.style.maxWidth = '230px';
            });

            document.getElementById('slotSlaProd').appendChild(prodSel);
            document.getElementById('slotSlaCat').appendChild(catSel);
            document.getElementById('slotSlaMonth').appendChild(monthSel);

            document.getElementById('resetSlaFiltersBtn').addEventListener('click', () => {
                selectedProduct = 'ALL';
                selectedCategory = 'ALL';
                selectedMonth = 'ALL';
                renderActual();
            });
        }

        if(sidebarBox){
            sidebarBox.remove();
        }
    }

    function ensureAgentNavigationAndSection(){
        const navWrap = document.querySelector('#sidenavAccordion .nav');
        if(navWrap && !navWrap.querySelector('[data-target="agent"]')){
            const refLink = navWrap.querySelector('[data-target="ticketing"]') || navWrap.querySelector('[data-target="daily"]');
            const a = document.createElement('a');
            a.className = 'nav-link';
            a.href = '#';
            a.dataset.target = 'agent';
            a.dataset.title = 'Produktivitas Agent';
            a.innerHTML = '<div class="sb-nav-link-icon"><i class="fas fa-user-check"></i></div>Produktivitas Agent';
            a.addEventListener('click', (e) => {
                e.preventDefault();
                switchSection('agent', 'Produktivitas Agent');
            });
            if(refLink && refLink.parentElement === navWrap){
                refLink.insertAdjacentElement('afterend', a);
            } else {
                navWrap.appendChild(a);
            }
        }

        if(!document.getElementById('sec-agent')){
            const refSec = document.getElementById('sec-ticketing') || document.getElementById('sec-daily');
            if(!refSec) return;
            const sec = document.createElement('div');
            sec.id = 'sec-agent';
            sec.className = 'tab-section';
            sec.innerHTML =
                '<div id="agentMissingColNotice" class="alert alert-warning py-2 px-3 small mb-3" style="display:none;"></div>' +
                '<div id="agentKpiStrip" class="row g-3 mb-2"></div>' +
                '<div class="card mb-3">' +
                  '<div class="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">' +
                    '<div>' +
                      '<span>Rekap Produktivitas Agent (Interaksi &amp; Ticket Dibuat)</span>' +
                      '<span id="agentPeriodCaption" class="small text-muted fw-normal ms-2"></span>' +
                    '</div>' +
                    '<div class="d-flex align-items-center flex-wrap gap-2">' +
                      '<div id="agentMultiFilterWrap" class="agent-multiselect-wrap">' +
                        '<button type="button" id="agentMultiFilterBtn" class="agent-toolbar-ctrl agent-multiselect-btn" title="Ceklist satu atau beberapa agent">' +
                          '<span id="agentMultiFilterBtnText" class="agent-multiselect-btn-text">Filter Agent: Semua</span>' +
                          '<span style="font-size:0.65rem;opacity:0.75;">&#9662;</span>' +
                        '</button>' +
                        '<div id="agentMultiFilterMenu" class="agent-multiselect-menu">' +
                          '<input type="text" id="agentMultiSearchInput" class="agent-multiselect-search" placeholder="Cari nama agent..." autocomplete="off" />' +
                          '<div class="agent-multiselect-actions">' +
                            '<div class="d-flex gap-2">' +
                              '<button type="button" id="agentSelectAllBtn">Pilih Semua</button>' +
                              '<span>·</span>' +
                              '<button type="button" id="agentClearAllBtn">Reset</button>' +
                            '</div>' +
                            '<span id="agentSelectedCountLbl">Semua</span>' +
                          '</div>' +
                          '<div id="agentCheckboxList" class="agent-multiselect-list"></div>' +
                        '</div>' +
                      '</div>' +
                      '<select id="agentScopeSelect" class="form-select form-select-sm agent-toolbar-ctrl" style="width:auto;" title="Scope Produk Agent">' +
                        '<option value="ALL">Sesuai Filter Produk</option>' +
                        '<option value="CASN">CASN (Tag CASN)</option>' +
                      '</select>' +
                      '<button type="button" id="copyAgentReportBtn" class="btn btn-outline-primary btn-sm py-0 px-2" style="height:27px;font-size:0.74rem;">Copy Rekap</button>' +
                      '<button type="button" id="exportAgentCsvBtn" class="btn btn-outline-secondary btn-sm py-0 px-2" style="height:27px;font-size:0.74rem;">Export CSV</button>' +
                    '</div>' +
                  '</div>' +
                  '<div class="card-body p-0">' +
                    '<div class="table-responsive">' +
                      '<table class="report-tbl">' +
                        '<thead>' +
                          '<tr>' +
                            '<th rowspan="2" class="text-end" style="width:38px;">No</th>' +
                            '<th rowspan="2" class="text-start">Nama Agent</th>' +
                            '<th colspan="3" class="text-center tbl-grp-border" id="thGrpDaily">Per Hari (Daily)</th>' +
                            '<th colspan="4" class="text-center tbl-grp-border" id="thGrpMonthly">Per Bulan / MTD</th>' +
                          '</tr>' +
                          '<tr>' +
                            '<th class="text-end tbl-grp-border">Interaksi</th>' +
                            '<th class="text-end">FCR</th>' +
                            '<th class="text-end">Ticket</th>' +
                            '<th class="text-end tbl-grp-border">Interaksi</th>' +
                            '<th class="text-end">FCR</th>' +
                            '<th class="text-end">Ticket</th>' +
                            '<th class="text-end">Rasio Ticket</th>' +
                          '</tr>' +
                        '</thead>' +
                        '<tbody id="agentProdBody"></tbody>' +
                      '</table>' +
                    '</div>' +
                  '</div>' +
                '</div>' +
                '<div class="row g-3">' +
                  '<div class="col-lg-5">' +
                    '<div class="card">' +
                      '<div class="card-header">Distribusi Channel Agent (MTD)</div>' +
                      '<div class="card-body p-0">' +
                        '<div class="table-responsive">' +
                          '<table class="report-tbl">' +
                            '<thead><tr>' +
                              '<th class="text-start">Nama Agent</th>' +
                              '<th class="text-end">Chat</th>' +
                              '<th class="text-end">WA</th>' +
                              '<th class="text-end">Email</th>' +
                              '<th class="text-end">Call</th>' +
                              '<th class="text-end">MTD Int</th>' +
                              '<th class="text-end">MTD Tkt</th>' +
                            '</tr></thead>' +
                            '<tbody id="agentChannelBody"></tbody>' +
                          '</table>' +
                        '</div>' +
                      '</div>' +
                    '</div>' +
                  '</div>' +
                  '<div class="col-lg-7">' +
                    '<div class="card">' +
                      '<div class="card-header d-flex justify-content-between align-items-center flex-wrap gap-1">' +
                        '<span>Kategori Top Pickup Agent — Interaksi &amp; Ticket (MTD)</span>' +
                        '<span class="small text-muted fw-normal">Top 5 Peringkat</span>' +
                      '</div>' +
                      '<div class="card-body p-0">' +
                        '<div class="row g-0">' +
                          '<div class="col-md-6 ops-split-col">' +
                            '<div class="ops-subhdr"><span>Top Pickup Interaksi</span><span class="badge bg-info">MTD (Daily)</span></div>' +
                            '<div class="table-responsive">' +
                              '<table class="report-tbl">' +
                                '<thead><tr>' +
                                  '<th class="text-end" style="width:32px;">#</th>' +
                                  '<th class="text-start">Nama Agent</th>' +
                                  '<th class="text-end">Interaksi</th>' +
                                  '<th class="text-end">Porsi</th>' +
                                '</tr></thead>' +
                                '<tbody id="agentTopPickupIntBody"></tbody>' +
                              '</table>' +
                            '</div>' +
                          '</div>' +
                          '<div class="col-md-6">' +
                            '<div class="ops-subhdr"><span>Top Pembuat Ticket (N-FCR)</span><span class="badge bg-warning">MTD (Daily)</span></div>' +
                            '<div class="table-responsive">' +
                              '<table class="report-tbl">' +
                                '<thead><tr>' +
                                  '<th class="text-end" style="width:32px;">#</th>' +
                                  '<th class="text-start">Nama Agent</th>' +
                                  '<th class="text-end">Ticket</th>' +
                                  '<th class="text-end">Rasio</th>' +
                                '</tr></thead>' +
                                '<tbody id="agentTopPickupTktBody"></tbody>' +
                              '</table>' +
                            '</div>' +
                          '</div>' +
                        '</div>' +
                      '</div>' +
                    '</div>' +
                  '</div>' +
                '</div>' +
                '<div class="card mt-0 mb-3">' +
                  '<div class="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">' +
                    '<span>Dominasi Case / Kategori yang Dihandle per Agent (MTD)</span>' +
                    '<span id="agentCaseScopeCaption" class="small text-muted fw-normal">Top 3 Kategori Case per Agent</span>' +
                  '</div>' +
                  '<div class="card-body p-0">' +
                    '<div class="table-responsive">' +
                      '<table class="report-tbl">' +
                        '<thead><tr>' +
                          '<th class="text-end" style="width:38px;">No</th>' +
                          '<th class="text-start">Nama Agent</th>' +
                          '<th class="text-end">MTD Int / Tkt</th>' +
                          '<th class="text-start tbl-grp-border">Top 1 Case Dominan</th>' +
                          '<th class="text-start tbl-grp-border">Top 2 Case</th>' +
                          '<th class="text-start tbl-grp-border">Top 3 Case</th>' +
                        '</tr></thead>' +
                        '<tbody id="agentTopCasesBody"></tbody>' +
                      '</table>' +
                    '</div>' +
                  '</div>' +
                '</div>';
            refSec.insertAdjacentElement('afterend', sec);

            const filterWrap = document.getElementById('agentMultiFilterWrap');
            const filterBtn = document.getElementById('agentMultiFilterBtn');
            const filterMenu = document.getElementById('agentMultiFilterMenu');
            const searchInput = document.getElementById('agentMultiSearchInput');

            filterBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const willOpen = !filterMenu.classList.contains('open');
                filterMenu.classList.toggle('open', willOpen);
                if(willOpen){
                    setTimeout(() => searchInput.focus(), 20);
                }
            });

            filterMenu.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            document.addEventListener('click', (e) => {
                if(filterWrap && !filterWrap.contains(e.target)){
                    filterMenu.classList.remove('open');
                }
            });

            searchInput.addEventListener('input', (e) => {
                agentFilterSearch = e.target.value || '';
                renderAgentCheckboxDropdown(lastAvailableAgents);
            });

            document.getElementById('agentSelectAllBtn').addEventListener('click', () => {
                const q = agentFilterSearch.trim().toLowerCase();
                const targets = q
                    ? lastAvailableAgents.filter(a => a.name.toLowerCase().includes(q))
                    : lastAvailableAgents;
                targets.forEach(a => selectedAgentNames.add(a.name));
                renderAgentProductivity();
            });

            document.getElementById('agentClearAllBtn').addEventListener('click', () => {
                selectedAgentNames.clear();
                agentFilterSearch = '';
                searchInput.value = '';
                renderAgentProductivity();
            });

            document.getElementById('agentScopeSelect').addEventListener('change', (e) => {
                agentProductScope = e.target.value;
                renderAgentProductivity();
            });
            document.getElementById('copyAgentReportBtn').addEventListener('click', copyAgentSummaryToClipboard);
            document.getElementById('exportAgentCsvBtn').addEventListener('click', exportAgentCsv);
        }
    }

    function renderAgentCheckboxDropdown(availableAgents){
        const listEl = document.getElementById('agentCheckboxList');
        const btnEl = document.getElementById('agentMultiFilterBtn');
        const btnTextEl = document.getElementById('agentMultiFilterBtnText');
        const countLblEl = document.getElementById('agentSelectedCountLbl');
        if(!listEl || !btnEl || !btnTextEl) return;

        const totalCount = availableAgents.length;
        const selCount = selectedAgentNames.size;

        if(selCount === 0){
            btnEl.classList.remove('has-selection');
            btnTextEl.textContent = totalCount ? 'Filter Agent: Semua (' + totalCount + ')' : 'Filter Agent: Semua';
            if(countLblEl) countLblEl.textContent = 'Semua';
        } else if(selCount === 1){
            const onlyName = Array.from(selectedAgentNames)[0];
            btnEl.classList.add('has-selection');
            btnTextEl.textContent = 'Agent: ' + onlyName;
            if(countLblEl) countLblEl.textContent = '1 / ' + totalCount;
        } else {
            btnEl.classList.add('has-selection');
            btnTextEl.textContent = 'Filter Agent: ' + selCount + ' dipilih';
            if(countLblEl) countLblEl.textContent = selCount + ' / ' + totalCount;
        }

        if(!totalCount){
            listEl.innerHTML = '<div class="text-center text-muted small py-2">Belum ada nama agent</div>';
            return;
        }

        const q = agentFilterSearch.trim().toLowerCase();
        const sortedForDropdown = [...availableAgents].sort((a, b) => a.name.localeCompare(b.name));
        const filtered = q
            ? sortedForDropdown.filter(a => a.name.toLowerCase().includes(q))
            : sortedForDropdown;

        if(!filtered.length){
            listEl.innerHTML = '<div class="text-center text-muted small py-2">Tidak cocok</div>';
            return;
        }

        listEl.innerHTML = filtered.map(a => {
            const checked = selectedAgentNames.has(a.name) ? 'checked' : '';
            return '<label class="agent-multiselect-item" title="' + escapeHtml(a.name) + '">' +
                '<input type="checkbox" value="' + escapeHtml(a.name) + '" ' + checked + ' />' +
                '<span class="agent-multiselect-item-name">' + escapeHtml(a.name) + '</span>' +
                '<span class="agent-multiselect-item-count">' + a.mInt.toLocaleString('id-ID') + '</span>' +
            '</label>';
        }).join('');

        listEl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const nm = e.target.value;
                if(e.target.checked) selectedAgentNames.add(nm);
                else selectedAgentNames.delete(nm);
                renderAgentProductivity();
            });
        });
    }

    function setupSharedSubcategoryFilter(){
        const scopeSel = document.getElementById('dailyCasnScope');
        if(!scopeSel) return;

        scopeSel.style.display = 'none';
        const lblByFor = document.querySelector('label[for="dailyCasnScope"]');
        if(lblByFor) lblByFor.style.display = 'none';
        const prevEl = scopeSel.previousElementSibling;
        if(prevEl && (prevEl.tagName === 'LABEL' || prevEl.tagName === 'SPAN') && !prevEl.querySelector('select')){
            prevEl.style.display = 'none';
        }

        const cardBody = scopeSel.parentElement;
        if(cardBody){
            Array.from(cardBody.childNodes).forEach(node => {
                if(node.nodeType === Node.TEXT_NODE && /scope\s*produk/i.test(node.textContent || '')){
                    node.remove();
                }
            });
        }

        if(!document.getElementById('sharedProductFilterWrap')){
            const sep = document.createElement('span');
            sep.className = 'shared-filter-sep';

            const lbl = document.createElement('label');
            lbl.textContent = 'Produk:';

            const wrap = document.createElement('div');
            wrap.id = 'sharedProductFilterWrap';
            wrap.className = 'agent-multiselect-wrap';
            wrap.innerHTML =
                '<button type="button" id="sharedProductFilterBtn" class="agent-toolbar-ctrl agent-multiselect-btn" title="Ceklist satu atau beberapa produk (kolom raw subcategory)">' +
                  '<span id="sharedProductFilterBtnText" class="agent-multiselect-btn-text">Semua Produk</span>' +
                  '<span style="font-size:0.65rem;opacity:0.75;">&#9662;</span>' +
                '</button>' +
                '<div id="sharedProductFilterMenu" class="agent-multiselect-menu align-left">' +
                  '<input type="text" id="sharedProductSearchInput" class="agent-multiselect-search" placeholder="Cari produk..." autocomplete="off" />' +
                  '<div class="agent-multiselect-actions">' +
                    '<div class="d-flex gap-2">' +
                      '<button type="button" id="sharedProductSelectAllBtn">Pilih Semua</button>' +
                      '<span>·</span>' +
                      '<button type="button" id="sharedProductClearAllBtn">Reset</button>' +
                    '</div>' +
                    '<span id="sharedProductSelectedCountLbl">Semua</span>' +
                  '</div>' +
                  '<div id="sharedProductCheckboxList" class="agent-multiselect-list"></div>' +
                '</div>';

            scopeSel.parentElement.insertBefore(sep, scopeSel);
            scopeSel.parentElement.insertBefore(lbl, scopeSel);
            scopeSel.parentElement.insertBefore(wrap, scopeSel);

            const btn = document.getElementById('sharedProductFilterBtn');
            const menu = document.getElementById('sharedProductFilterMenu');
            const searchInput = document.getElementById('sharedProductSearchInput');

            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const willOpen = !menu.classList.contains('open');
                menu.classList.toggle('open', willOpen);
                if(willOpen){
                    setTimeout(() => searchInput.focus(), 20);
                }
            });

            menu.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            document.addEventListener('click', (e) => {
                if(wrap && !wrap.contains(e.target)){
                    menu.classList.remove('open');
                }
            });

            document.addEventListener('keydown', (e) => {
                if(e.key === 'Escape'){
                    menu.classList.remove('open');
                }
            });

            searchInput.addEventListener('input', (e) => {
                sharedProductSearch = e.target.value || '';
                renderSharedProductCheckboxDropdown();
            });

            document.getElementById('sharedProductSelectAllBtn').addEventListener('click', () => {
                const q = sharedProductSearch.trim().toLowerCase();
                const targets = q
                    ? availableSubcategoryProducts.filter(p => p.name.toLowerCase().includes(q))
                    : availableSubcategoryProducts;
                targets.forEach(p => selectedSharedProducts.add(p.name));
                onSharedProductsChanged();
            });

            document.getElementById('sharedProductClearAllBtn').addEventListener('click', () => {
                selectedSharedProducts.clear();
                sharedProductSearch = '';
                searchInput.value = '';
                onSharedProductsChanged();
            });
        }
    }

    function onSharedProductsChanged(){
        agentProductScope = 'ALL';
        const agSel = document.getElementById('agentScopeSelect');
        if(agSel) agSel.value = 'ALL';

        renderSharedProductCheckboxDropdown();
        if(allInteractions.length) renderDailyAndTicketingFromUploaded();
        else renderAgentProductivity();
    }

    function renderSharedProductCheckboxDropdown(){
        const listEl = document.getElementById('sharedProductCheckboxList');
        const btnEl = document.getElementById('sharedProductFilterBtn');
        const btnTextEl = document.getElementById('sharedProductFilterBtnText');
        const countLblEl = document.getElementById('sharedProductSelectedCountLbl');
        if(!listEl || !btnEl || !btnTextEl) return;

        const totalCount = availableSubcategoryProducts.length;
        const selCount = selectedSharedProducts.size;

        if(selCount === 0){
            btnEl.classList.remove('has-selection');
            btnTextEl.textContent = 'Semua Produk';
            btnEl.title = 'Semua Produk (' + totalCount + ' subcategory)';
            if(countLblEl) countLblEl.textContent = 'Semua';
        } else if(selCount === 1){
            const onlyProd = Array.from(selectedSharedProducts)[0];
            btnEl.classList.add('has-selection');
            btnTextEl.textContent = onlyProd;
            btnEl.title = onlyProd;
            if(countLblEl) countLblEl.textContent = '1 / ' + totalCount;
        } else {
            const joined = Array.from(selectedSharedProducts).join(', ');
            btnEl.classList.add('has-selection');
            btnTextEl.textContent = selCount + ' Produk dipilih';
            btnEl.title = joined;
            if(countLblEl) countLblEl.textContent = selCount + ' / ' + totalCount;
        }

        if(!totalCount){
            listEl.innerHTML = '<div class="text-center text-muted small py-2">Belum ada data produk</div>';
            return;
        }

        const q = sharedProductSearch.trim().toLowerCase();
        const filtered = q
            ? availableSubcategoryProducts.filter(p => p.name.toLowerCase().includes(q))
            : availableSubcategoryProducts;

        if(!filtered.length){
            listEl.innerHTML = '<div class="text-center text-muted small py-2">Produk tidak ditemukan</div>';
            return;
        }

        listEl.innerHTML = filtered.map(p => {
            const checked = selectedSharedProducts.has(p.name) ? 'checked' : '';
            return '<label class="agent-multiselect-item" title="' + escapeHtml(p.name) + '">' +
                '<input type="checkbox" value="' + escapeHtml(p.name) + '" ' + checked + ' />' +
                '<span class="agent-multiselect-item-name">' + escapeHtml(p.name) + '</span>' +
                '<span class="agent-multiselect-item-count">' + p.count.toLocaleString('id-ID') + '</span>' +
            '</label>';
        }).join('');

        listEl.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const prodName = e.target.value;
                if(e.target.checked) selectedSharedProducts.add(prodName);
                else selectedSharedProducts.delete(prodName);
                onSharedProductsChanged();
            });
        });
    }

    function populateSubcategoryProductOptions(){
        setupSharedSubcategoryFilter();
        const countMap = new Map();
        allInteractions.forEach(r => {
            const p = safeStr(r.sc || r.subCategory);
            if(!p) return;
            countMap.set(p, (countMap.get(p) || 0) + 1);
        });

        availableSubcategoryProducts = Array.from(countMap.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => a.name.localeCompare(b.name));

        const validSet = new Set(availableSubcategoryProducts.map(p => p.name));
        for(const p of Array.from(selectedSharedProducts)){
            if(!validSet.has(p)) selectedSharedProducts.delete(p);
        }

        renderSharedProductCheckboxDropdown();
    }

    function matchesSharedProduct(r){
        if(selectedSharedProducts.size === 0) return true;
        return selectedSharedProducts.has(safeStr(r.sc || r.subCategory));
    }

    function getSharedProductLabel(){
        if(selectedSharedProducts.size === 0) return 'Semua Produk';
        const arr = Array.from(selectedSharedProducts);
        if(arr.length === 1) return arr[0];
        if(arr.length === 2) return arr[0] + ' + ' + arr[1];
        return arr.length + ' Produk Terpilih';
    }

    function isCasnRecord(r){
        const sc = (r.sc || '').toLowerCase();
        const dsc = (r.dsc || '').toLowerCase();
        const sj = (r.sj || '').toLowerCase();
        const hasCasnTag =
            dsc.includes('casn') ||
            dsc.includes('sscasn') ||
            sc.includes('casn') ||
            sc.includes('sscasn') ||
            sj.includes('casn') ||
            sj.includes('sscasn');
        if(!hasCasnTag) return false;
        if(sc && !sc.includes('meterai') && !sc.includes('casn') && !sc.includes('sscasn')){
            return false;
        }
        return true;
    }

    function formatYMDLocal(d){
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function formatShortIndoDate(ymd){
        if(!ymd || ymd === 'EMPTY') return '-';
        const [y, m, d] = ymd.split('-').map(Number);
        return new Date(y, m - 1, d).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
    }

    function getTopCasesForAgent(agentObj, limit = 3){
        if(!agentObj || !agentObj.casesMtd) return [];
        return Array.from(agentObj.casesMtd.entries())
            .map(([caseName, counts]) => ({
                caseName,
                int: counts.int,
                tkt: counts.tkt,
                pct: agentObj.mInt ? ((counts.int / agentObj.mInt) * 100).toFixed(1) + '%' : '0.0%'
            }))
            .sort((a, b) => (b.int - a.int) || (b.tkt - a.tkt) || a.caseName.localeCompare(b.caseName))
            .slice(0, limit);
    }

    function renderAgentProductivity(){
        ensureAgentNavigationAndSection();
        const kpiEl = document.getElementById('agentKpiStrip');
        const bodyEl = document.getElementById('agentProdBody');
        const chBodyEl = document.getElementById('agentChannelBody');
        const topIntBodyEl = document.getElementById('agentTopPickupIntBody');
        const topTktBodyEl = document.getElementById('agentTopPickupTktBody');
        const topCasesBodyEl = document.getElementById('agentTopCasesBody');
        const noticeEl = document.getElementById('agentMissingColNotice');
        const capEl = document.getElementById('agentPeriodCaption');
        if(!kpiEl || !bodyEl) return;

        const selDateEl = document.getElementById('dailyDateSelect');
        const activeDate = selDateEl ? selDateEl.value : 'EMPTY';

        if(!allInteractions.length || !activeDate || activeDate === 'EMPTY'){
            noticeEl.style.display = 'none';
            capEl.textContent = '';
            lastAvailableAgents = [];
            renderAgentCheckboxDropdown([]);
            kpiEl.innerHTML = [
                { dot: 'blue', label: 'Total Interaksi (Daily)', val: '0', sub: 'MTD: 0' },
                { dot: 'amber', label: 'Total Ticket Dibuat (Daily)', val: '0', sub: 'MTD: 0' },
                { dot: 'green', label: 'Rata-rata Interaksi / Agent', val: '0', sub: 'Daily: 0 · MTD: 0' },
                { dot: 'neutral', label: 'Total Agent Terdata', val: '0', sub: 'Rasio Ticket MTD: 0.0%' }
            ].map(c =>
                '<div class="col-xl-3 col-md-6"><div class="card casn-kpi-card"><div class="card-body py-2 px-3">' +
                  '<div class="casn-kpi-label mb-1"><span class="kpi-dot ' + c.dot + '"></span>' + c.label + '</div>' +
                  '<div class="casn-kpi-val mb-1">' + c.val + '</div>' +
                  '<div class="casn-kpi-sub">' + c.sub + '</div>' +
                '</div></div></div>'
            ).join('');
            bodyEl.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">Belum ada data interaksi. Upload file Excel/CSV melalui Mode Admin.</td></tr>';
            chBodyEl.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">Belum ada data.</td></tr>';
            topIntBodyEl.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">Belum ada data.</td></tr>';
            topTktBodyEl.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">Belum ada data.</td></tr>';
            topCasesBodyEl.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">Belum ada data.</td></tr>';
            lastAgentSummaryRows = [];
            return;
        }

        const hStart = parseInt(document.getElementById('dailyHourStart').value || '0', 10);
        const hEnd = parseInt(document.getElementById('dailyHourEnd').value || '23', 10);
        const [ay, am, ad] = activeDate.split('-').map(Number);
        const activeObj = new Date(ay, am - 1, ad);
        const monthPrefix = activeDate.slice(0, 7);

        const dailyLabel = formatShortIndoDate(activeDate);
        const monthlyLabel = activeObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

        document.getElementById('thGrpDaily').textContent = 'Per Hari (' + dailyLabel + ')';
        document.getElementById('thGrpMonthly').textContent = 'Per Bulan / MTD (' + monthlyLabel + ')';
        capEl.textContent = '· Jam Daily: ' + hStart + ':00–' + hEnd + ':59 WIB';

        const scopedRecords = agentProductScope === 'CASN'
            ? allInteractions.filter(r => isCasnRecord(r))
            : allInteractions.filter(r => matchesSharedProduct(r));

        const hasAnyNamedAgent = scopedRecords.some(r => Boolean((r.agent || '').trim()));
        if(!hasAnyNamedAgent && scopedRecords.length > 0){
            noticeEl.style.display = 'block';
            noticeEl.innerHTML =
                '<strong>Kolom <code>created_by_name</code> belum terdeteksi pada data tersimpan.</strong> ' +
                'Silakan upload ulang file raw melalui Mode Admin (mode Replace) agar nama agent terbaca. ' +
                'Saat ini seluruh interaksi dikelompokkan ke <em>(Tanpa Nama Agent)</em>.';
        } else {
            noticeEl.style.display = 'none';
        }

        const agentStats = new Map();
        const ensureAgent = (name) => {
            if(!agentStats.has(name)){
                agentStats.set(name, {
                    name,
                    dInt: 0, dFcr: 0, dTkt: 0,
                    mInt: 0, mFcr: 0, mTkt: 0,
                    chChat: 0, chWa: 0, chEmail: 0, chCall: 0,
                    casesMtd: new Map()
                });
            }
            return agentStats.get(name);
        };

        scopedRecords.forEach(r => {
            const iso = r.doStart || r.doOpen;
            if(!iso) return;
            const d = new Date(iso);
            const dKey = formatYMDLocal(d);
            const hr = d.getHours();

            const inMonth = dKey.startsWith(monthPrefix) && dKey <= activeDate;
            const inDaily = dKey === activeDate && hr >= hStart && hr <= hEnd;

            if(!inMonth && !inDaily) return;

            const name = (r.agent || '').trim() || '(Tanpa Nama Agent)';
            const st = ensureAgent(name);
            const isTkt = Boolean(r.isEscalated);

            if(inDaily){
                st.dInt++;
                if(isTkt) st.dTkt++;
                else st.dFcr++;
            }
            if(inMonth){
                st.mInt++;
                if(isTkt) st.mTkt++;
                else st.mFcr++;

                const ch = (r.ch || '').toLowerCase();
                if(ch.includes('chat')) st.chChat++;
                else if(ch.includes('whatsapp') || ch === 'wa') st.chWa++;
                else if(ch.includes('email')) st.chEmail++;
                else if(ch.includes('call') || ch.includes('telp') || ch.includes('voice')) st.chCall++;

                const caseLabel = (r.dsc || r.sc || '(Lainnya)').trim();
                if(!st.casesMtd.has(caseLabel)){
                    st.casesMtd.set(caseLabel, { int: 0, tkt: 0 });
                }
                const cObj = st.casesMtd.get(caseLabel);
                cObj.int++;
                if(isTkt) cObj.tkt++;
            }
        });

        const allAgentsSorted = Array.from(agentStats.values())
            .sort((a, b) => (b.mInt - a.mInt) || (b.dInt - a.dInt) || a.name.localeCompare(b.name));

        lastAvailableAgents = allAgentsSorted;

        const validNameSet = new Set(allAgentsSorted.map(a => a.name));
        for(const nm of Array.from(selectedAgentNames)){
            if(!validNameSet.has(nm)) selectedAgentNames.delete(nm);
        }

        renderAgentCheckboxDropdown(allAgentsSorted);

        const isSubsetSelected = selectedAgentNames.size > 0;
        const rows = isSubsetSelected
            ? allAgentsSorted.filter(a => selectedAgentNames.has(a.name))
            : allAgentsSorted;

        lastAgentSummaryRows = rows;

        const tot = rows.reduce((acc, a) => {
            acc.dInt += a.dInt; acc.dFcr += a.dFcr; acc.dTkt += a.dTkt;
            acc.mInt += a.mInt; acc.mFcr += a.mFcr; acc.mTkt += a.mTkt;
            acc.chChat += a.chChat; acc.chWa += a.chWa; acc.chEmail += a.chEmail; acc.chCall += a.chCall;
            return acc;
        }, { dInt: 0, dFcr: 0, dTkt: 0, mInt: 0, mFcr: 0, mTkt: 0, chChat: 0, chWa: 0, chEmail: 0, chCall: 0 });

        const namedActiveDaily = rows.filter(a => a.dInt > 0).length || 1;
        const namedActiveMtd = rows.filter(a => a.mInt > 0).length || 1;
        const avgDailyInt = rows.length ? (tot.dInt / namedActiveDaily).toFixed(1) : '0.0';
        const avgMtdInt = rows.length ? (tot.mInt / namedActiveMtd).toFixed(1) : '0.0';
        const mtdTicketRatio = tot.mInt ? ((tot.mTkt / tot.mInt) * 100).toFixed(1) + '%' : '0.0%';
        const mtdFcrRate = tot.mInt ? ((tot.mFcr / tot.mInt) * 100).toFixed(1) + '%' : '0.0%';
        const selectedNamesPreview = Array.from(selectedAgentNames).join(', ');

        kpiEl.innerHTML = [
            {
                dot: 'blue',
                label: 'Total Interaksi (Daily)',
                val: tot.dInt.toLocaleString('id-ID'),
                sub: 'FCR: ' + tot.dFcr.toLocaleString('id-ID') + ' · MTD: ' + tot.mInt.toLocaleString('id-ID')
            },
            {
                dot: 'amber',
                label: 'Total Ticket Dibuat (Daily)',
                val: tot.dTkt.toLocaleString('id-ID'),
                sub: 'MTD: ' + tot.mTkt.toLocaleString('id-ID') + ' · Rasio MTD: ' + mtdTicketRatio
            },
            {
                dot: 'green',
                label: rows.length === 1 ? 'FCR Rate MTD' : 'Rata-rata Interaksi / Agent',
                val: rows.length === 1 ? mtdFcrRate : avgDailyInt,
                sub: rows.length === 1
                    ? 'FCR MTD: ' + tot.mFcr.toLocaleString('id-ID') + ' dari ' + tot.mInt.toLocaleString('id-ID') + ' int'
                    : 'Daily (' + namedActiveDaily + ' aktif) · MTD: ' + avgMtdInt + '/agent'
            },
            {
                dot: 'neutral',
                label: !isSubsetSelected ? 'Total Agent Terdata' : 'Agent Dipilih',
                val: !isSubsetSelected
                    ? rows.length.toLocaleString('id-ID')
                    : rows.length + ' / ' + allAgentsSorted.length,
                sub: !isSubsetSelected
                    ? 'Aktif MTD: ' + rows.filter(a => a.mInt > 0).length + ' agent'
                    : selectedNamesPreview
            }
        ].map(c =>
            '<div class="col-xl-3 col-md-6"><div class="card casn-kpi-card"><div class="card-body py-2 px-3">' +
              '<div class="casn-kpi-label mb-1"><span class="kpi-dot ' + c.dot + '"></span>' + c.label + '</div>' +
              '<div class="casn-kpi-val mb-1">' + c.val + '</div>' +
              '<div class="casn-kpi-sub text-truncate" title="' + escapeHtml(c.sub) + '">' + escapeHtml(c.sub) + '</div>' +
            '</div></div></div>'
        ).join('');

        if(!rows.length){
            bodyEl.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">Tidak ada data agent pada filter yang dipilih.</td></tr>';
            chBodyEl.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-3">Tidak ada data.</td></tr>';
            topIntBodyEl.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">Tidak ada data.</td></tr>';
            topTktBodyEl.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-3">Tidak ada data.</td></tr>';
            topCasesBodyEl.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">Tidak ada data.</td></tr>';
            return;
        }

        const totRatio = tot.mInt ? ((tot.mTkt / tot.mInt) * 100).toFixed(1) + '%' : '0.0%';
        const totalRowLabel = !isSubsetSelected ? 'Total Tim' : 'Total (' + rows.length + ' Agent)';

        bodyEl.innerHTML = rows.map((a, idx) => {
            const ratio = a.mInt ? ((a.mTkt / a.mInt) * 100).toFixed(1) + '%' : '0.0%';
            return '<tr>' +
                '<td class="num rank-num">' + (idx + 1) + '</td>' +
                '<td class="row-title">' + escapeHtml(a.name) + '</td>' +
                '<td class="num fw-semibold tbl-grp-border">' + a.dInt.toLocaleString('id-ID') + '</td>' +
                '<td class="num">' + a.dFcr.toLocaleString('id-ID') + '</td>' +
                '<td class="num fw-semibold">' + a.dTkt.toLocaleString('id-ID') + '</td>' +
                '<td class="num fw-semibold tbl-grp-border">' + a.mInt.toLocaleString('id-ID') + '</td>' +
                '<td class="num">' + a.mFcr.toLocaleString('id-ID') + '</td>' +
                '<td class="num fw-semibold">' + a.mTkt.toLocaleString('id-ID') + '</td>' +
                '<td class="num">' + ratio + '</td>' +
            '</tr>';
        }).join('') +
        '<tr class="total-row">' +
            '<td colspan="2" class="text-center">' + totalRowLabel + '</td>' +
            '<td class="num tbl-grp-border">' + tot.dInt.toLocaleString('id-ID') + '</td>' +
            '<td class="num">' + tot.dFcr.toLocaleString('id-ID') + '</td>' +
            '<td class="num">' + tot.dTkt.toLocaleString('id-ID') + '</td>' +
            '<td class="num tbl-grp-border">' + tot.mInt.toLocaleString('id-ID') + '</td>' +
            '<td class="num">' + tot.mFcr.toLocaleString('id-ID') + '</td>' +
            '<td class="num">' + tot.mTkt.toLocaleString('id-ID') + '</td>' +
            '<td class="num">' + totRatio + '</td>' +
        '</tr>';

        chBodyEl.innerHTML = rows.map(a =>
            '<tr>' +
                '<td class="row-title">' + escapeHtml(a.name) + '</td>' +
                '<td class="num">' + a.chChat.toLocaleString('id-ID') + '</td>' +
                '<td class="num">' + a.chWa.toLocaleString('id-ID') + '</td>' +
                '<td class="num">' + a.chEmail.toLocaleString('id-ID') + '</td>' +
                '<td class="num">' + a.chCall.toLocaleString('id-ID') + '</td>' +
                '<td class="num fw-semibold">' + a.mInt.toLocaleString('id-ID') + '</td>' +
                '<td class="num fw-semibold">' + a.mTkt.toLocaleString('id-ID') + '</td>' +
            '</tr>'
        ).join('') +
        '<tr class="total-row">' +
            '<td class="text-center">' + totalRowLabel + '</td>' +
            '<td class="num">' + tot.chChat.toLocaleString('id-ID') + '</td>' +
            '<td class="num">' + tot.chWa.toLocaleString('id-ID') + '</td>' +
            '<td class="num">' + tot.chEmail.toLocaleString('id-ID') + '</td>' +
            '<td class="num">' + tot.chCall.toLocaleString('id-ID') + '</td>' +
            '<td class="num">' + tot.mInt.toLocaleString('id-ID') + '</td>' +
            '<td class="num">' + tot.mTkt.toLocaleString('id-ID') + '</td>' +
        '</tr>';

        const topIntAgents = [...rows]
            .filter(a => a.mInt > 0)
            .sort((a, b) => (b.mInt - a.mInt) || (b.dInt - a.dInt))
            .slice(0, 5);
        const intDenom = tot.mInt || 1;
        topIntBodyEl.innerHTML = topIntAgents.map((a, idx) => {
            const share = ((a.mInt / intDenom) * 100).toFixed(1) + '%';
            return '<tr>' +
                '<td class="num rank-num ' + (idx < 3 ? 'top5' : '') + '">' + (idx + 1) + '</td>' +
                '<td class="row-title">' + escapeHtml(a.name) + '</td>' +
                '<td class="num fw-semibold">' + a.mInt.toLocaleString('id-ID') + ' <span class="text-muted fw-normal">(' + a.dInt + ')</span></td>' +
                '<td class="num">' + share + '</td>' +
            '</tr>';
        }).join('') || '<tr><td colspan="4" class="text-center text-muted py-3">Belum ada interaksi MTD.</td></tr>';

        const topTktAgents = [...rows]
            .filter(a => a.mTkt > 0)
            .sort((a, b) => (b.mTkt - a.mTkt) || (b.dTkt - a.dTkt))
            .slice(0, 5);
        topTktBodyEl.innerHTML = topTktAgents.map((a, idx) => {
            const ratio = a.mInt ? ((a.mTkt / a.mInt) * 100).toFixed(1) + '%' : '0.0%';
            return '<tr>' +
                '<td class="num rank-num ' + (idx < 3 ? 'top5' : '') + '">' + (idx + 1) + '</td>' +
                '<td class="row-title">' + escapeHtml(a.name) + '</td>' +
                '<td class="num fw-semibold">' + a.mTkt.toLocaleString('id-ID') + ' <span class="text-muted fw-normal">(' + a.dTkt + ')</span></td>' +
                '<td class="num">' + ratio + '</td>' +
            '</tr>';
        }).join('') || '<tr><td colspan="4" class="text-center text-muted py-3">Belum ada ticket MTD.</td></tr>';

        const caseCapEl = document.getElementById('agentCaseScopeCaption');
        if(caseCapEl){
            caseCapEl.textContent = isSubsetSelected
                ? 'Menampilkan ' + rows.length + ' agent terpilih (Top 3 Case MTD)'
                : 'Urutan pickup terbanyak · Top 3 Kategori Case MTD';
        }

        const renderCaseCell = (cObj) => {
            if(!cObj) return '<td class="tbl-grp-border text-muted">—</td>';
            return '<td class="tbl-grp-border case-cell-wrap">' +
                '<div class="case-cell-title" title="' + escapeHtml(cObj.caseName) + '">' + escapeHtml(cObj.caseName) + '</div>' +
                '<div class="case-cell-meta">' + cObj.int.toLocaleString('id-ID') + ' int (' + cObj.pct + ') · ' + cObj.tkt.toLocaleString('id-ID') + ' tkt</div>' +
            '</td>';
        };

        const activeCaseRows = rows.filter(a => a.mInt > 0);
        topCasesBodyEl.innerHTML = activeCaseRows.map((a, idx) => {
            const top3 = getTopCasesForAgent(a, 3);
            return '<tr>' +
                '<td class="num rank-num ' + (idx < 5 ? 'top5' : '') + '">' + (idx + 1) + '</td>' +
                '<td class="row-title">' + escapeHtml(a.name) + '</td>' +
                '<td class="num fw-semibold">' + a.mInt.toLocaleString('id-ID') + ' <span class="text-muted fw-normal">/ ' + a.mTkt.toLocaleString('id-ID') + '</span></td>' +
                renderCaseCell(top3[0]) +
                renderCaseCell(top3[1]) +
                renderCaseCell(top3[2]) +
            '</tr>';
        }).join('') || '<tr><td colspan="6" class="text-center text-muted py-3">Belum ada data kategori case pada periode MTD ini.</td></tr>';
    }

    async function copyAgentSummaryToClipboard(){
        if(!lastAgentSummaryRows.length) return;
        const activeDate = document.getElementById('dailyDateSelect').value;
        const [ay, am, ad] = activeDate.split('-').map(Number);
        const indoDate = new Date(ay, am - 1, ad).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        const scopeLbl = agentProductScope === 'CASN'
            ? 'CASN (Tag CASN)'
            : (selectedSharedProducts.size === 0 ? 'Semua Produk' : Array.from(selectedSharedProducts).join(', '));
        const agentLbl = selectedAgentNames.size === 0
            ? 'Semua Agent'
            : Array.from(selectedAgentNames).join(', ');
        const lines = [
            `*Rekap Produktivitas Agent — ${indoDate}*`,
            `Produk: ${scopeLbl} | Agent: ${agentLbl}`,
            ``
        ];
        lastAgentSummaryRows.forEach((a, i) => {
            const topCases = getTopCasesForAgent(a, 2)
                .map(c => `${c.caseName} (${c.int})`)
                .join(', ');
            const caseSuffix = topCases ? ` | Top Case: ${topCases}` : '';
            lines.push(`${i + 1}. *${a.name}* — Daily: ${a.dInt} int (${a.dTkt} tkt) | MTD: ${a.mInt} int (${a.mTkt} tkt)${caseSuffix}`);
        });
        const text = lines.join('\n');
        const btn = document.getElementById('copyAgentReportBtn');
        try {
            await navigator.clipboard.writeText(text);
            btn.textContent = 'Tersalin';
            setTimeout(() => { btn.textContent = 'Copy Rekap'; }, 2000);
        } catch (_) {
            alert(text);
        }
    }

    function exportAgentCsv(){
        if(!lastAgentSummaryRows.length) return;
        const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
        const header = [
            'No', 'Nama Agent',
            'Daily Interaksi', 'Daily FCR', 'Daily Ticket Dibuat',
            'MTD Interaksi', 'MTD FCR', 'MTD Ticket Dibuat', 'Rasio Ticket MTD (%)',
            'Top 1 Case MTD', 'Top 2 Case MTD', 'Top 3 Case MTD'
        ];
        const lines = [header.join(',')];
        lastAgentSummaryRows.forEach((a, i) => {
            const ratio = a.mInt ? ((a.mTkt / a.mInt) * 100).toFixed(2) : '0.00';
            const top3 = getTopCasesForAgent(a, 3);
            const fmtC = (c) => c ? `${c.caseName} (${c.int} int / ${c.tkt} tkt)` : '';
            lines.push([
                i + 1, a.name,
                a.dInt, a.dFcr, a.dTkt,
                a.mInt, a.mFcr, a.mTkt, ratio,
                fmtC(top3[0]), fmtC(top3[1]), fmtC(top3[2])
            ].map(esc).join(','));
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'produktivitas_agent_' + new Date().toISOString().slice(0, 10) + '.csv';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function splitStackedTopCard(dailyTbodyId, mtdTbodyId, dailyTitle, mtdTitle){
        const dailyTbl = document.getElementById(dailyTbodyId)?.closest('table');
        const mtdTbl = document.getElementById(mtdTbodyId)?.closest('table');
        if(!dailyTbl || !mtdTbl) return [null, null];

        const cardA = document.createElement('div');
        cardA.className = 'card';
        cardA.innerHTML = '<div class="card-header">' + dailyTitle + '</div><div class="card-body p-0"><div class="table-responsive"></div></div>';
        cardA.querySelector('.table-responsive').appendChild(dailyTbl);

        const cardB = document.createElement('div');
        cardB.className = 'card';
        cardB.innerHTML = '<div class="card-header">' + mtdTitle + '</div><div class="card-body p-0"><div class="table-responsive"></div></div>';
        cardB.querySelector('.table-responsive').appendChild(mtdTbl);

        return [cardA, cardB];
    }

    function cleanCardHeaders(container){
        if(!container) return;
        container.querySelectorAll('.card-header i.fas, .card-header i.far').forEach(ic => ic.remove());
        container.querySelectorAll('.card-body.p-2').forEach(cb => {
            cb.classList.remove('p-2');
            cb.classList.add('p-0');
        });
    }

    function applyNoChartLayout(){
        ensureChannelSummaryCard();
        polishSummaryTableHeaders();

        const secDaily = document.getElementById('sec-daily');
        if(secDaily && !secDaily.dataset.noChartApplied){
            const cardSummary = document.getElementById('dailySummaryBody')?.closest('.card');
            const cardTopDailyCasn = document.getElementById('topDailyCasnBody')?.closest('.card');
            const cardTopMtdCasn = document.getElementById('topMtdCasnBody')?.closest('.card');
            let cardTopDailyAll = document.getElementById('topDailyAllBody')?.closest('.card');
            let cardTopMtdAll = document.getElementById('topMtdAllBody')?.closest('.card');
            const cardChannel = document.getElementById('channelBreakdownCard');

            if(cardTopDailyAll && cardTopMtdAll && cardTopDailyAll === cardTopMtdAll){
                [cardTopDailyAll, cardTopMtdAll] = splitStackedTopCard(
                    'topDailyAllBody',
                    'topMtdAllBody',
                    'Top 10 Interaksi — Semua Produk (Daily)',
                    'Top 10 Interaksi — Semua Produk (Month to Date)'
                );
            }

            Array.from(secDaily.children).forEach(el => { el.style.display = 'none'; });

            const grid = document.createElement('div');
            grid.id = 'dailyNoChartGrid';

            const makeRow = (cols) => {
                const row = document.createElement('div');
                row.className = 'row g-3';
                cols.forEach(({ cls, el }) => {
                    if(!el) return;
                    cleanCardHeaders(el);
                    const col = document.createElement('div');
                    col.className = cls;
                    col.appendChild(el);
                    row.appendChild(col);
                });
                grid.appendChild(row);
            };

            makeRow([{ cls: 'col-12', el: cardSummary }]);
            makeRow([
                { cls: 'col-lg-6', el: cardTopDailyCasn },
                { cls: 'col-lg-6', el: cardTopMtdCasn }
            ]);
            makeRow([
                { cls: 'col-lg-6', el: cardTopDailyAll },
                { cls: 'col-lg-6', el: cardTopMtdAll }
            ]);
            makeRow([{ cls: 'col-12', el: cardChannel }]);

            secDaily.appendChild(grid);
            secDaily.dataset.noChartApplied = '1';
        }

        const secTkt = document.getElementById('sec-ticketing');
        if(secTkt && !secTkt.dataset.noChartApplied){
            const cardTktSummary = document.getElementById('tktSummaryBody')?.closest('.card');
            const cardTopDailyTktCasn = document.getElementById('topDailyTktCasnBody')?.closest('.card');
            const cardTopMtdTktCasn = document.getElementById('topMtdTktCasnBody')?.closest('.card');
            let cardTopDailyTktAll = document.getElementById('topDailyTktAllBody')?.closest('.card');
            let cardTopMtdTktAll = document.getElementById('topMtdTktAllBody')?.closest('.card');

            if(cardTopDailyTktAll && cardTopMtdTktAll && cardTopDailyTktAll === cardTopMtdTktAll){
                [cardTopDailyTktAll, cardTopMtdTktAll] = splitStackedTopCard(
                    'topDailyTktAllBody',
                    'topMtdTktAllBody',
                    'Top 10 Tiket — Semua Produk (Daily)',
                    'Top 10 Tiket — Semua Produk (Month to Date)'
                );
            }

            Array.from(secTkt.children).forEach(el => { el.style.display = 'none'; });

            const grid = document.createElement('div');
            grid.id = 'tktNoChartGrid';

            const tktKpiRow = document.createElement('div');
            tktKpiRow.id = 'tktKpiStrip';
            tktKpiRow.className = 'row g-3 mb-2';
            grid.appendChild(tktKpiRow);

            const makeRow = (cols) => {
                const row = document.createElement('div');
                row.className = 'row g-3';
                cols.forEach(({ cls, el }) => {
                    if(!el) return;
                    cleanCardHeaders(el);
                    const col = document.createElement('div');
                    col.className = cls;
                    col.appendChild(el);
                    row.appendChild(col);
                });
                grid.appendChild(row);
            };

            makeRow([{ cls: 'col-12', el: cardTktSummary }]);
            makeRow([
                { cls: 'col-lg-6', el: cardTopDailyTktCasn },
                { cls: 'col-lg-6', el: cardTopMtdTktCasn }
            ]);
            makeRow([
                { cls: 'col-lg-6', el: cardTopDailyTktAll },
                { cls: 'col-lg-6', el: cardTopMtdTktAll }
            ]);

            secTkt.appendChild(grid);
            secTkt.dataset.noChartApplied = '1';
        }

        ['achievedChart', 'top10Chart'].forEach(canvasId => {
            const col = document.getElementById(canvasId)?.closest('[class*="col-"]');
            if(col){
                const parentRow = col.parentElement;
                col.style.display = 'none';
                if(parentRow){
                    const visibleCols = Array.from(parentRow.children).filter(c => c !== col && c.style.display !== 'none');
                    if(visibleCols.length === 1){
                        visibleCols[0].className = 'col-12';
                    } else if(visibleCols.length === 0){
                        parentRow.style.display = 'none';
                    }
                }
            }
        });
    }

    function setCardHeaderTitle(tbodyId, title){
        const hdr = document.getElementById(tbodyId)?.closest('.card')?.querySelector('.card-header');
        if(hdr) hdr.textContent = title;
    }

    function renderTicketingKpiCards(sDailyCasn, sMtdCasn, sMtdAll, activeCasnQueue, activeCasnPending, prodLabel = 'Semua Produk'){
        const el = document.getElementById('tktKpiStrip');
        if(!el) return;
        const queueDisplay = activeCasnQueue >= 1000
            ? '1.000+ <span class="fs-6 fw-normal text-muted">(' + activeCasnQueue.toLocaleString('id-ID') + ')</span>'
            : activeCasnQueue.toLocaleString('id-ID');
        const cards = [
            {
                dot: 'blue',
                label: 'Tiket CASN Created (MTD)',
                val: sMtdCasn.created.toLocaleString('id-ID'),
                sub: 'Daily: ' + sDailyCasn.created.toLocaleString('id-ID') + ' · ' + prodLabel + ' MTD: ' + sMtdAll.created.toLocaleString('id-ID')
            },
            {
                dot: 'green',
                label: 'Tiket CASN Resolved (MTD)',
                val: sMtdCasn.resolved.toLocaleString('id-ID'),
                sub: 'Daily: ' + sDailyCasn.resolved.toLocaleString('id-ID') + ' · ' + prodLabel + ' MTD: ' + sMtdAll.resolved.toLocaleString('id-ID')
            },
            {
                dot: 'amber',
                label: 'Tiket CASN Outstanding (MTD)',
                val: sMtdCasn.outstanding.toLocaleString('id-ID'),
                sub: 'Pending MTD: ' + sMtdCasn.pending.toLocaleString('id-ID') + ' · ' + prodLabel + ' MTD: ' + sMtdAll.outstanding.toLocaleString('id-ID')
            },
            {
                dot: activeCasnQueue >= 1000 ? 'red' : 'neutral',
                label: 'Antrian Tiket Helpdesk SSCASN',
                val: queueDisplay,
                sub: 'Antrian Aktif CASN · Pending: ' + activeCasnPending.toLocaleString('id-ID')
            }
        ];
        el.innerHTML = cards.map(c =>
            '<div class="col-xl-3 col-md-6">' +
              '<div class="card casn-kpi-card">' +
                '<div class="card-body py-2 px-3">' +
                  '<div class="casn-kpi-label mb-1"><span class="kpi-dot ' + c.dot + '"></span>' + c.label + '</div>' +
                  '<div class="casn-kpi-val mb-1">' + c.val + '</div>' +
                  '<div class="casn-kpi-sub">' + c.sub + '</div>' +
                '</div>' +
              '</div>' +
            '</div>'
        ).join('');
    }

    function showStatus(type, message, autoHideMs = 0){
        const alertEl = document.getElementById('statusAlert');
        if(!alertEl) return;
        if(statusTimer){
            clearTimeout(statusTimer);
            statusTimer = null;
        }
        alertEl.style.display = 'flex';
        alertEl.style.opacity = '1';
        alertEl.className = 'alert alert-' + type;
        alertEl.innerHTML =
            '<span>' + message + '</span>' +
            '<button type="button" class="btn-close btn-close-white ms-2" style="font-size:0.65rem;" aria-label="Close"></button>';
        const closeBtn = alertEl.querySelector('.btn-close');
        if(closeBtn){
            closeBtn.addEventListener('click', () => {
                alertEl.style.display = 'none';
            });
        }
        if(autoHideMs > 0){
            statusTimer = setTimeout(() => {
                alertEl.style.opacity = '0';
                setTimeout(() => { alertEl.style.display = 'none'; }, 220);
            }, autoHideMs);
        }
    }

    function isAdminUnlocked(){
        return Boolean(adminPin);
    }

    function updateRoleUI(){
        const unlocked = isAdminUnlocked();
        const roleBtn = document.getElementById('roleToggleBtn');
        const adminGroup = document.getElementById('adminControlsGroup');

        if(roleBtn){
            roleBtn.className = unlocked ? 'btn btn-outline-warning btn-sm' : 'btn btn-outline-secondary btn-sm';
            roleBtn.textContent = unlocked ? 'Mode: Admin' : 'Mode: Viewer';
            roleBtn.title = unlocked ? 'Klik untuk mengunci kembali ke Mode Viewer' : 'Klik untuk membuka akses Upload & Reset D1 dengan PIN';
        }
        if(adminGroup){
            adminGroup.style.display = unlocked ? 'inline-flex' : 'none';
        }
    }

    async function promptAdminUnlock(){
        if(isAdminUnlocked()){
            if(confirm('Kunci kembali dashboard ke Mode Viewer (sembunyikan akses Upload & Reset D1)?')){
                adminPin = '';
                sessionStorage.removeItem(PIN_STORAGE_KEY);
                updateRoleUI();
                showStatus('info', 'Dashboard dikunci ke Mode Viewer.', 4000);
            }
            return false;
        }
        const input = prompt('Masukkan PIN Admin Helpdesk untuk membuka fitur Upload & Reset D1:');
        if(!input) return false;
        try {
            const res = await fetch('/api/auth/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin: input.trim() })
            });
            const data = await res.json().catch(() => ({}));
            if(res.ok && data.ok){
                adminPin = input.trim();
                sessionStorage.setItem(PIN_STORAGE_KEY, adminPin);
                updateRoleUI();
                showStatus('success', 'Akses Admin aktif.', 4000);
                return true;
            } else {
                showStatus('danger', 'PIN Admin tidak sesuai.', 4500);
                return false;
            }
        } catch (err) {
            showStatus('danger', 'Gagal memverifikasi PIN: ' + err.message);
            return false;
        }
    }

    function injectD1Controls(){
        const fileInput = document.getElementById('fileInput');
        if(!fileInput || document.getElementById('uploadSyncMode')) return;
        const wrap = fileInput.parentElement;
        wrap.id = 'navControlsWrap';
        const uploadLbl = document.querySelector('label[for="fileInput"]');
        const slaBtn = document.getElementById('slaViewToggle');
        const themeBtn = document.getElementById('themeToggleBtn');

        if(uploadLbl){
            uploadLbl.textContent = 'Upload Data';
            uploadLbl.title = 'Upload file CSV / Excel ke Cloudflare D1';
        }
        if(slaBtn){
            slaBtn.textContent = 'SLA: Internal (Excl. Pending)';
        }
        if(themeBtn){
            themeBtn.textContent = 'Tema: Gelap';
        }

        const roleBtn = document.createElement('button');
        roleBtn.id = 'roleToggleBtn';
        roleBtn.type = 'button';
        roleBtn.addEventListener('click', promptAdminUnlock);

        const adminGroup = document.createElement('div');
        adminGroup.id = 'adminControlsGroup';

        const modeSel = document.createElement('select');
        modeSel.id = 'uploadSyncMode';
        modeSel.className = 'form-select form-select-sm bg-dark text-light border-secondary';
        modeSel.title = 'Mode penyimpanan ke database Cloudflare D1 saat upload file';
        modeSel.innerHTML =
            '<option value="replace">Replace</option>' +
            '<option value="upsert">Upsert</option>';

        const clearBtn = document.createElement('button');
        clearBtn.id = 'clearD1Btn';
        clearBtn.type = 'button';
        clearBtn.className = 'btn btn-outline-danger btn-sm';
        clearBtn.title = 'Kosongkan seluruh data di Cloudflare D1';
        clearBtn.textContent = 'Reset';
        clearBtn.addEventListener('click', async () => {
            if(!isAdminUnlocked()){
                const ok = await promptAdminUnlock();
                if(!ok) return;
            }
            if(!confirm('Hapus seluruh data tiket tersimpan di Cloudflare D1 dan reset semua angka ke 0?')) return;
            try {
                const res = await fetch('/api/tickets', {
                    method: 'DELETE',
                    headers: { 'X-Admin-Pin': adminPin }
                });
                const json = await res.json().catch(() => ({}));
                if(!res.ok || !json.ok) throw new Error(json.reason || ('HTTP ' + res.status));
                allInteractions = [];
                ticketsMap = new Map();
                clearLocalAgentMap();
                selectedSharedProducts.clear();
                agentProductScope = 'ALL';
                populateSubcategoryProductOptions();
                document.getElementById('metaBadge').textContent = 'Cloudflare D1 · 0 interaksi';
                document.getElementById('dailySourceBadge').textContent = 'Database Kosong (0)';
                showStatus('warning', 'Data di Cloudflare D1 berhasil dikosongkan.', 4500);
                renderZeroReports();
                renderActual();
            } catch (err) {
                showStatus('danger', 'Gagal menghapus data D1: ' + err.message);
            }
        });

        const sep = document.createElement('span');
        sep.className = 'nav-sep';

        const copyDashBtn = document.createElement('button');
        copyDashBtn.id = 'copyDashboardBtn';
        copyDashBtn.type = 'button';
        copyDashBtn.className = 'btn btn-primary btn-sm';
        copyDashBtn.textContent = 'Copy Report';
        copyDashBtn.title = 'Salin teks report SSCASN & tangkapan layar dashboard';
        copyDashBtn.addEventListener('click', handleCopyDashboardAndSummary);

        wrap.insertBefore(roleBtn, uploadLbl);
        wrap.insertBefore(adminGroup, uploadLbl);
        adminGroup.appendChild(uploadLbl);
        adminGroup.appendChild(fileInput);
        adminGroup.appendChild(modeSel);
        adminGroup.appendChild(clearBtn);
        wrap.insertBefore(sep, adminGroup.nextSibling);
        wrap.insertBefore(copyDashBtn, sep.nextSibling);

        updateRoleUI();
    }

    function polishSummaryTableHeaders(){
        const dailyTable = document.getElementById('dailySummaryBody')?.closest('table');
        if(dailyTable){
            const ths = dailyTable.querySelectorAll('thead th');
            if(ths.length >= 7){
                ths[0].textContent = 'Kelompok Interaksi';
                ths[1].textContent = 'Total';
                ths[2].textContent = 'FCR';
                ths[3].textContent = 'N-FCR';
                ths[4].textContent = 'Informasi';
                ths[5].textContent = 'Keluhan';
                ths[6].textContent = 'Permintaan';
            }
        }
    }

    function ensureChannelSummaryCard(){
        const secDaily = document.getElementById('sec-daily');
        if(!secDaily || document.getElementById('channelBreakdownCard')) return;
        const cardHtml =
            '<div class="card" id="channelBreakdownCard">' +
              '<div class="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">' +
                '<span id="channelBreakdownTitle">Distribusi Interaksi CASN & Waktu Dispatch per Channel</span>' +
                '<span class="small text-muted">Target Dispatch N-FCR Email & WhatsApp: ≤ 15 Menit</span>' +
              '</div>' +
              '<div class="card-body p-0">' +
                '<div class="table-responsive">' +
                  '<table class="report-tbl">' +
                    '<thead><tr>' +
                      '<th class="text-start">Channel</th>' +
                      '<th class="text-end" id="thChDaily">Daily CASN</th>' +
                      '<th class="text-end">Porsi</th>' +
                      '<th class="text-end">FCR</th>' +
                      '<th class="text-end">N-FCR</th>' +
                      '<th class="text-end" id="thChMtd">MTD CASN</th>' +
                      '<th class="text-end">Avg Dispatch N-FCR</th>' +
                    '</tr></thead>' +
                    '<tbody id="channelBreakdownBody"></tbody>' +
                  '</table>' +
                '</div>' +
              '</div>' +
            '</div>';
        secDaily.insertAdjacentHTML('beforeend', cardHtml);
    }

    function ensureAtRiskRadarCard(){
        const overviewEl = document.getElementById('overviewCards');
        if(!overviewEl || document.getElementById('atRiskRadarCard')) return;
        const radarHtml =
            '<div class="card mb-4" id="atRiskRadarCard">' +
              '<div class="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">' +
                '<span>Tiket Aktif Mendekati / Melewati Batas SLA (Top 5)</span>' +
                '<button type="button" class="btn btn-outline-secondary btn-sm py-0 px-2" id="copyAtRiskBtn">Salin Daftar Tiket</button>' +
              '</div>' +
              '<div class="card-body p-0">' +
                '<div class="table-responsive">' +
                  '<table class="sla-tbl">' +
                    '<thead><tr>' +
                      '<th>Ticket ID</th>' +
                      '<th>Produk</th>' +
                      '<th>Subject / Kategori</th>' +
                      '<th>Priority</th>' +
                      '<th>Status</th>' +
                      '<th>Durasi Berjalan</th>' +
                      '<th>Sisa Waktu SLA</th>' +
                    '</tr></thead>' +
                    '<tbody id="atRiskRadarBody"></tbody>' +
                  '</table>' +
                '</div>' +
              '</div>' +
            '</div>';
        overviewEl.insertAdjacentHTML('afterend', radarHtml);

        document.getElementById('copyAtRiskBtn').addEventListener('click', async () => {
            const rows = Array.from(document.querySelectorAll('#atRiskRadarBody tr[data-ticket-id]'));
            if(!rows.length) return;
            const lines = ['*MONITORING SLA TIKET AKTIF (PRIORITAS TINDAK LANJUT)*'];
            rows.forEach((tr, idx) => {
                lines.push(`${idx + 1}. *${tr.dataset.ticketId}* [${tr.dataset.priority}] - ${tr.dataset.subject} (${tr.dataset.countdown})`);
            });
            const text = lines.join('\n');
            const btn = document.getElementById('copyAtRiskBtn');
            try {
                await navigator.clipboard.writeText(text);
                btn.textContent = 'Tersalin';
                setTimeout(() => { btn.textContent = 'Salin Daftar Tiket'; }, 2000);
            } catch (e) {
                alert(text);
            }
        });
    }

    function ensureHtml2Canvas(){
        if(window.html2canvas) return Promise.resolve(window.html2canvas);
        return new Promise((resolve, reject) => {
            const existing = document.getElementById('html2canvasCdn');
            if(existing){
                existing.addEventListener('load', () => resolve(window.html2canvas));
                existing.addEventListener('error', () => reject(new Error('Gagal memuat html2canvas')));
                return;
            }
            const s = document.createElement('script');
            s.id = 'html2canvasCdn';
            s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
            s.onload = () => resolve(window.html2canvas);
            s.onerror = () => reject(new Error('Gagal memuat html2canvas'));
            document.head.appendChild(s);
        });
    }

    function ensureCopyModal(){
        if(document.getElementById('copySummaryModal')) return;
        const modalHtml =
            '<div class="modal fade" id="copySummaryModal" tabindex="-1" aria-hidden="true">' +
              '<div class="modal-dialog modal-xl modal-dialog-scrollable">' +
                '<div class="modal-content bg-dark text-light border-secondary">' +
                  '<div class="modal-header border-secondary py-2">' +
                    '<h6 class="modal-title fw-semibold">Report Monitoring SSCASN & Screenshot Dashboard</h6>' +
                    '<button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>' +
                  '</div>' +
                  '<div class="modal-body">' +
                    '<div id="copyModalToast" class="alert alert-success py-2 px-3 small mb-3"></div>' +
                    '<div class="row g-3">' +
                      '<div class="col-lg-5">' +
                        '<div class="d-flex justify-content-between align-items-center mb-1">' +
                          '<label class="small fw-semibold text-muted">Teks Report SSCASN (WhatsApp / Email)</label>' +
                          '<button type="button" class="btn btn-primary btn-sm py-0 px-2" id="modalCopyTextBtn">Copy Teks</button>' +
                        '</div>' +
                        '<textarea id="modalSummaryTextarea" class="form-control form-control-sm font-monospace bg-black text-light border-secondary" rows="20" style="font-size:0.78rem;line-height:1.45;"></textarea>' +
                      '</div>' +
                      '<div class="col-lg-7">' +
                        '<div class="d-flex justify-content-between align-items-center mb-1 flex-wrap gap-1">' +
                          '<label class="small fw-semibold text-muted">Preview Screenshot Dashboard</label>' +
                          '<div class="d-flex gap-1">' +
                            '<button type="button" class="btn btn-outline-light btn-sm py-0 px-2" id="modalCopyImgBtn">Copy Gambar</button>' +
                            '<button type="button" class="btn btn-outline-secondary btn-sm py-0 px-2" id="modalDownloadImgBtn">Download PNG</button>' +
                          '</div>' +
                        '</div>' +
                        '<div id="modalImgPreviewWrap" class="border border-secondary rounded p-2 text-center bg-black" style="max-height:430px;overflow:auto;">' +
                          '<div class="text-muted small py-5">Menyiapkan tangkapan layar dashboard...</div>' +
                        '</div>' +
                      '</div>' +
                    '</div>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>';
        document.body.insertAdjacentHTML('beforeend', modalHtml);

        document.getElementById('modalCopyTextBtn').addEventListener('click', async () => {
            const txt = document.getElementById('modalSummaryTextarea').value;
            const toast = document.getElementById('copyModalToast');
            try {
                await navigator.clipboard.writeText(txt);
                toast.className = 'alert alert-success py-2 px-3 small mb-3';
                toast.textContent = 'Teks report disalin ke clipboard.';
            } catch (e) {
                document.getElementById('modalSummaryTextarea').select();
                document.execCommand('copy');
                toast.className = 'alert alert-success py-2 px-3 small mb-3';
                toast.textContent = 'Teks report disalin.';
            }
        });

        document.getElementById('modalCopyImgBtn').addEventListener('click', async () => {
            const toast = document.getElementById('copyModalToast');
            if(!lastCapturedBlob){
                toast.className = 'alert alert-warning py-2 px-3 small mb-3';
                toast.textContent = 'Gambar dashboard belum siap.';
                return;
            }
            try {
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': lastCapturedBlob })]);
                toast.className = 'alert alert-success py-2 px-3 small mb-3';
                toast.textContent = 'Gambar disalin ke clipboard. Langsung Paste (Ctrl+V) di WhatsApp/Email.';
            } catch (err) {
                toast.className = 'alert alert-warning py-2 px-3 small mb-3';
                toast.textContent = 'Browser memblokir copy gambar langsung (' + err.message + '). Silakan klik Download PNG.';
            }
        });

        document.getElementById('modalDownloadImgBtn').addEventListener('click', () => {
            if(!lastCapturedBlob) return;
            const url = URL.createObjectURL(lastCapturedBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'dashboard_sscasn_' + new Date().toISOString().slice(0, 10) + '.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    function buildDashboardSummaryText(){
        const selDateEl = document.getElementById('dailyDateSelect');
        const hStart = document.getElementById('dailyHourStart').value || '0';
        const hEnd = document.getElementById('dailyHourEnd').value || '23';
        const prodTitle = selectedSharedProducts.size === 0
            ? 'All Produk (Semua Layanan)'
            : 'Produk: ' + Array.from(selectedSharedProducts).join(', ');

        if(!allInteractions.length){
            return [
                `*Report Akumulasi Interaksi Terpickup SSCASN -*`,
                `• Interaksi CASN Daily : 0 (FCR: 0 | N-FCR: 0)`,
                `• Interaksi CASN MTD : 0 (FCR: 0 | N-FCR: 0)`,
                ``,
                `*Top 5 Interaction (CASN):*`,
                `1. -`,
                ``,
                `*Monitoring Tiket Date: -*`,
                `Interval : ${hStart}:00 - ${hEnd}:59 WIB`,
                `• Total tiket created MTD: 0 (Daily: 0)`,
                `• Total tiket resolved MTD: 0 (Daily: 0)`,
                `• Total Tiket outstanding MTD: 0 (Daily: 0)`,
                `• Total Tiket pending : 0`,
                ``,
                `*Antrian Tiket Helpdesk SSCASN*`,
                `• Total Antrian : 0`,
                ``,
                `*Ringkasan ${prodTitle}*`,
                `• Interaksi Daily : 0 | MTD : 0`,
                `• Tiket Created MTD : 0 | Resolved MTD : 0 | Outstanding MTD : 0`
            ].join('\n');
        }

        const activeDate = selDateEl.value;
        const [ay, am, ad] = activeDate.split('-').map(Number);
        const indoDateLabel = new Date(ay, am - 1, ad).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        const monthPrefix = activeDate.slice(0, 7);
        const hStartNum = parseInt(hStart, 10);
        const hEndNum = parseInt(hEnd, 10);

        const intMeta = allInteractions.map(r => {
            const iso = r.doStart || r.doOpen;
            if(!iso) return null;
            const d = new Date(iso);
            const dKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            return { r, dKey, hour: d.getHours() };
        }).filter(Boolean);

        const dailyAllInt = intMeta.filter(x => x.dKey === activeDate && x.hour >= hStartNum && x.hour <= hEndNum && matchesSharedProduct(x.r));
        const dailyCasnInt = intMeta.filter(x => x.dKey === activeDate && x.hour >= hStartNum && x.hour <= hEndNum && isCasnRecord(x.r));
        const mtdAllInt = intMeta.filter(x => x.dKey.startsWith(monthPrefix) && x.dKey <= activeDate && matchesSharedProduct(x.r));
        const mtdCasnInt = intMeta.filter(x => x.dKey.startsWith(monthPrefix) && x.dKey <= activeDate && isCasnRecord(x.r));

        const sumInt = (list) => {
            let fcr = 0, nfcr = 0;
            list.forEach(x => { if(x.r.isEscalated) nfcr++; else fcr++; });
            return { total: list.length, fcr, nfcr };
        };

        const sDailyCasnInt = sumInt(dailyCasnInt);
        const sMtdCasnInt = sumInt(mtdCasnInt);
        const sDailyAllInt = sumInt(dailyAllInt);
        const sMtdAllInt = sumInt(mtdAllInt);
        const fcrRateDaily = sDailyCasnInt.total ? ((sDailyCasnInt.fcr / sDailyCasnInt.total) * 100).toFixed(2) + '%' : '0.00%';

        const getTop5Lines = (list) => {
            const counts = new Map();
            list.forEach(x => {
                const k = x.r.dsc || x.r.sc || '(Lainnya)';
                counts.set(k, (counts.get(k) || 0) + 1);
            });
            const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
            if(!sorted.length) return ['1. Tidak ada data CASN pada interval ini'];
            return sorted.map((it, idx) => {
                const pct = list.length ? ((it[1] / list.length) * 100).toFixed(2) + '%' : '0.00%';
                return `${idx + 1}. ${it[0]} (${it[1].toLocaleString('id-ID')} | ${pct})`;
            });
        };

        const tktMeta = Array.from(ticketsMap.values()).map(r => {
            const iso = r.doOpen || r.doStart;
            if(!iso) return null;
            const d = new Date(iso);
            const dKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            return { r, dKey, hour: d.getHours() };
        }).filter(Boolean);

        const dailyAllTkt = tktMeta.filter(x => x.dKey === activeDate && x.hour >= hStartNum && x.hour <= hEndNum && matchesSharedProduct(x.r));
        const dailyCasnTkt = tktMeta.filter(x => x.dKey === activeDate && x.hour >= hStartNum && x.hour <= hEndNum && isCasnRecord(x.r));
        const mtdAllTkt = tktMeta.filter(x => x.dKey.startsWith(monthPrefix) && x.dKey <= activeDate && matchesSharedProduct(x.r));
        const mtdCasnTkt = tktMeta.filter(x => x.dKey.startsWith(monthPrefix) && x.dKey <= activeDate && isCasnRecord(x.r));

        const sumTkt = (list) => {
            let resolved = 0, outstanding = 0, pending = 0;
            list.forEach(x => {
                const st = (x.r.st || '').toLowerCase();
                if(FINISHED_STATUSES.has(st)) resolved++;
                else {
                    outstanding++;
                    if(st === 'pending') pending++;
                }
            });
            return { created: list.length, resolved, outstanding, pending };
        };

        const sDailyCasnTkt = sumTkt(dailyCasnTkt);
        const sMtdCasnTkt = sumTkt(mtdCasnTkt);
        const sMtdAllTkt = sumTkt(mtdAllTkt);

        const casnTicketsAll = Array.from(ticketsMap.values()).filter(r => isCasnRecord(r));
        const activeCasnQueue = casnTicketsAll.filter(r => !FINISHED_STATUSES.has((r.st || '').toLowerCase()));
        const activeCasnPending = activeCasnQueue.filter(r => (r.st || '').toLowerCase() === 'pending').length;
        const queueText = activeCasnQueue.length >= 1000
            ? `1000+ (${activeCasnQueue.length.toLocaleString('id-ID')} tiket aktif | Pending: ${activeCasnPending.toLocaleString('id-ID')})`
            : `${activeCasnQueue.length.toLocaleString('id-ID')} tiket aktif (Pending: ${activeCasnPending.toLocaleString('id-ID')})`;

        return [
            `*Report Akumulasi Interaksi Terpickup SSCASN ${indoDateLabel}*`,
            `• Interaksi CASN Daily : *${sDailyCasnInt.total.toLocaleString('id-ID')}* (FCR: ${sDailyCasnInt.fcr.toLocaleString('id-ID')} | N-FCR: ${sDailyCasnInt.nfcr.toLocaleString('id-ID')} | FCR Rate: ${fcrRateDaily})`,
            `• Interaksi CASN MTD : *${sMtdCasnInt.total.toLocaleString('id-ID')}* (FCR: ${sMtdCasnInt.fcr.toLocaleString('id-ID')} | N-FCR: ${sMtdCasnInt.nfcr.toLocaleString('id-ID')})`,
            ``,
            `*Top 5 Interaction (CASN):*`,
            ...getTop5Lines(dailyCasnInt),
            ``,
            `*Monitoring Tiket Date: ${indoDateLabel}*`,
            `Interval : ${hStart}:00 - ${hEnd}:59 WIB`,
            `• Total tiket created MTD: *${sMtdCasnTkt.created.toLocaleString('id-ID')}* (Daily: ${sDailyCasnTkt.created.toLocaleString('id-ID')})`,
            `• Total tiket resolved MTD: *${sMtdCasnTkt.resolved.toLocaleString('id-ID')}* (Daily: ${sDailyCasnTkt.resolved.toLocaleString('id-ID')})`,
            `• Total Tiket outstanding MTD: *${sMtdCasnTkt.outstanding.toLocaleString('id-ID')}* (Daily: ${sDailyCasnTkt.outstanding.toLocaleString('id-ID')})`,
            `• Total Tiket pending : *${sMtdCasnTkt.pending.toLocaleString('id-ID')}* (Daily: ${sDailyCasnTkt.pending.toLocaleString('id-ID')})`,
            ``,
            `*Antrian Tiket Helpdesk SSCASN*`,
            `• Total Antrian : *${queueText}*`,
            ``,
            `*Ringkasan ${prodTitle}*`,
            `• Interaksi Daily : *${sDailyAllInt.total.toLocaleString('id-ID')}* (FCR: ${sDailyAllInt.fcr.toLocaleString('id-ID')} | N-FCR: ${sDailyAllInt.nfcr.toLocaleString('id-ID')})`,
            `• Interaksi MTD : *${sMtdAllInt.total.toLocaleString('id-ID')}* (FCR: ${sMtdAllInt.fcr.toLocaleString('id-ID')} | N-FCR: ${sMtdAllInt.nfcr.toLocaleString('id-ID')})`,
            `• Tiket MTD : Created *${sMtdAllTkt.created.toLocaleString('id-ID')}* | Resolved *${sMtdAllTkt.resolved.toLocaleString('id-ID')}* | Outstanding *${sMtdAllTkt.outstanding.toLocaleString('id-ID')}*`
        ].join('\n');
    }

    async function handleCopyDashboardAndSummary(){
        ensureCopyModal();
        const summaryText = buildDashboardSummaryText();
        const textarea = document.getElementById('modalSummaryTextarea');
        const toast = document.getElementById('copyModalToast');
        const previewWrap = document.getElementById('modalImgPreviewWrap');

        textarea.value = summaryText;
        lastCapturedBlob = null;
        previewWrap.innerHTML = '<div class="text-muted small py-5">Menyiapkan tangkapan layar dashboard...</div>';

        if(window.bootstrap && window.bootstrap.Modal){
            const modal = window.bootstrap.Modal.getOrCreateInstance(document.getElementById('copySummaryModal'));
            modal.show();
        }

        let textCopied = false;
        try {
            await navigator.clipboard.writeText(summaryText);
            textCopied = true;
        } catch (e) {
            try {
                textarea.focus();
                textarea.select();
                textCopied = document.execCommand('copy');
            } catch (_) {
                textCopied = false;
            }
        }

        toast.className = 'alert alert-success py-2 px-3 small mb-3';
        toast.textContent = textCopied
            ? 'Teks report SSCASN tersalin ke clipboard. Tinggal Paste (Ctrl+V) di WhatsApp atau Email.'
            : 'Report siap disalin. Klik tombol Copy Teks di bawah.';

        try {
            const h2c = await ensureHtml2Canvas();
            const targetEl = document.querySelector('#layoutSidenav_content main .container-fluid') || document.body;
            const canvas = await h2c(targetEl, {
                backgroundColor: isDark ? '#101113' : '#f5f6f8',
                scale: 1.5,
                useCORS: true,
                logging: false
            });
            canvas.toBlob((blob) => {
                if(!blob) return;
                lastCapturedBlob = blob;
                const imgUrl = URL.createObjectURL(blob);
                previewWrap.innerHTML = '<img src="' + imgUrl + '" alt="Dashboard Preview" class="img-fluid rounded border border-secondary" />';
            }, 'image/png');
        } catch (err) {
            previewWrap.innerHTML = '<div class="text-warning small py-4">Gagal merender screenshot otomatis (' + err.message + '), namun teks report tetap siap digunakan.</div>';
        }
    }

    function safeStr(v){
        if(v === null || v === undefined) return '';
        return String(v).trim();
    }

    function toISO(v){
        if(v instanceof Date && !isNaN(v.getTime())) return v.toISOString();
        if(typeof v === 'number' && isFinite(v)){
            const ms = Math.round((v - 25569) * 86400 * 1000);
            const d = new Date(ms);
            if(!isNaN(d.getTime())) return d.toISOString();
        }
        if(typeof v === 'string'){
            const s = v.trim();
            if(s && s !== '-'){
                const d = new Date(s);
                if(!isNaN(d.getTime())) return d.toISOString();
            }
        }
        return null;
    }

    function toYMD(iso){
        if(!iso) return null;
        const d = new Date(iso);
        if(isNaN(d.getTime())) return null;
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }

    function findHeaderRowIndex(aoa){
        for(let r = 0; r < Math.min(aoa.length, 20); r++){
            const row = aoa[r] || [];
            for(let c = 0; c < row.length; c++){
                if(safeStr(row[c]).toLowerCase() === 'ticket_id') return r;
            }
        }
        return -1;
    }

    function extractAgentName(row, colIndex){
        for(const cand of AGENT_COL_CANDIDATES){
            if(colIndex[cand] !== undefined){
                const val = safeStr(row[colIndex[cand]]).replace(/\s+/g, ' ');
                if(val && val !== '-') return val;
            }
        }
        return '';
    }

    function parseWorkbook(fileBuffer, fileName){
        const isCsv = /\.csv$/i.test(fileName || '');
        const wb = isCsv
            ? XLSX.read(new TextDecoder('utf-8').decode(fileBuffer), { type: 'string', cellDates: true })
            : XLSX.read(fileBuffer, { type: 'array', cellDates: true });
        const sheetName = wb.SheetNames.includes('Dbase') ? 'Dbase' : wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
        const headerIdx = findHeaderRowIndex(aoa);
        if(headerIdx === -1) throw new Error('Kolom "ticket_id" tidak ditemukan di sheet "' + sheetName + '".');

        const header = aoa[headerIdx];
        const colIndex = {};
        header.forEach((h, i) => {
            const k = safeStr(h).toLowerCase().replace(/\s+/g, ' ');
            if(k) colIndex[k] = i;
        });
        const col = (row, name) => { const idx = colIndex[name]; return idx !== undefined ? row[idx] : null; };

        const escalatedOut = new Map();
        const interactionsOut = [];
        let skippedNotEscalated = 0;

        for(let r = headerIdx + 1; r < aoa.length; r++){
            const row = aoa[r];
            if(!row) continue;
            const id = safeStr(col(row, 'ticket_id'));
            if(!id) continue;

            const escRaw = colIndex['is_escalated'] !== undefined ? safeStr(col(row, 'is_escalated')).toLowerCase() : 'escalated';
            const isNotEscalated = (escRaw.indexOf('not') === 0 || escRaw === 'no' || escRaw === '0' || escRaw === 'false' || escRaw === '');

            let doRes = toISO(col(row, 'date_resolved'));
            if(!doRes) doRes = toISO(col(row, 'date_last_update'));
            const doStart = toISO(col(row, 'date_start_interaction')) || toISO(col(row, 'date_origin_interaction')) || toISO(col(row, 'date_created_at'));
            const doOpen = toISO(col(row, 'date_open'));
            const scVal = safeStr(col(row, 'subcategory'));
            const dscVal = safeStr(col(row, 'detailsubcategory'));
            const stVal = safeStr(col(row, 'ticket_status_name'));
            const chVal = safeStr(col(row, 'channel_name'));
            const agentVal = extractAgentName(row, colIndex);

            const rec = {
                id: id,
                agent: agentVal,
                sj: safeStr(col(row, 'subject')),
                sc: scVal,
                mc: safeStr(col(row, 'maincategory')),
                dsc: dscVal,
                pr: safeStr(col(row, 'priority_name')).toUpperCase(),
                st: stVal,
                ch: chVal,
                isEscalated: !isNotEscalated,
                doStart: doStart,
                doOpen: doOpen,
                doRes: doRes,
                doPending: toISO(col(row, 'date_pending')),
                ticketDateYMD: toYMD(doOpen || doStart),
                interactionDateYMD: toYMD(doStart),
                subCategory: scVal,
                detailCategory: dscVal,
                statusName: stVal,
                channel: chVal,
            };

            interactionsOut.push(rec);
            if(isNotEscalated){ skippedNotEscalated++; continue; }
            escalatedOut.set(id, rec);
        }
        escalatedOut._skippedNotEscalated = skippedNotEscalated;
        return { escalated: escalatedOut, interactions: interactionsOut };
    }

    async function syncToD1(records, mode){
        const CHUNK_SIZE = 500;
        for(let i = 0; i < records.length; i += CHUNK_SIZE){
            const chunk = records.slice(i, i + CHUNK_SIZE);
            const chunkMode = (i === 0 && mode === 'replace') ? 'replace' : 'upsert';
            const res = await fetch('/api/tickets', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-Pin': adminPin
                },
                body: JSON.stringify({ mode: chunkMode, records: chunk })
            });
            const json = await res.json().catch(() => ({}));
            if(!res.ok || !json.ok){
                throw new Error(json.reason || ('HTTP ' + res.status));
            }
        }
    }

    async function loadFromD1(){
        try {
            const res = await fetch('/api/tickets');
            if(!res.ok) return;
            const data = await res.json();
            if(!data.ok || !Array.isArray(data.records) || data.records.length === 0){
                allInteractions = [];
                ticketsMap = new Map();
                populateSubcategoryProductOptions();
                document.getElementById('metaBadge').textContent = 'Cloudflare D1 · 0 interaksi';
                document.getElementById('dailySourceBadge').textContent = 'Database Kosong (0)';
                renderZeroReports();
                renderActual();
                return;
            }

            const localAgentMap = loadLocalAgentMap();
            const escalatedOut = new Map();
            let skippedNotEscalated = 0;
            data.records.forEach(r => {
                if(!r || !r.id) return;
                r.sc = safeStr(r.sc || r.subCategory || '');
                r.agent = safeStr(r.agent || r.created_by_name || r.agent_name || localAgentMap[r.id] || '').replace(/\s+/g, ' ');
                if(!r.isEscalated) skippedNotEscalated++;
                else escalatedOut.set(r.id, r);
            });
            escalatedOut._skippedNotEscalated = skippedNotEscalated;

            allInteractions = data.records;
            ticketsMap = escalatedOut;
            populateSubcategoryProductOptions();
            document.getElementById('metaBadge').textContent =
                'D1 · ' + allInteractions.length.toLocaleString('id-ID') + ' interaksi (' + ticketsMap.size.toLocaleString('id-ID') + ' N-FCR)';
            renderDailyAndTicketingFromUploaded();
            renderActual();
        } catch (err) {
            console.warn('D1 load skipped:', err);
        }
    }

    function initHourSelectors(){
        const sStart = document.getElementById('dailyHourStart');
        const sEnd = document.getElementById('dailyHourEnd');
        let hOpts = '';
        for(let h = 0; h < 24; h++) hOpts += '<option value="' + h + '">' + h + ':00</option>';
        sStart.innerHTML = hOpts;
        sEnd.innerHTML = hOpts;
        sStart.value = '0';
        sEnd.value = '23';
    }

    function fillTopTable(tbodyId, items, sumTotal, sumPct){
        document.getElementById(tbodyId).innerHTML = (items.map((it, i) => {
            const rankCls = i < 5 ? 'rank-num top5' : 'rank-num';
            return '<tr><td class="num ' + rankCls + '">' + (i + 1) + '</td><td>' + it[0] + '</td><td class="num fw-semibold">' + it[1] + '</td><td class="num">' + it[2] + '</td></tr>';
        }).join('') || '<tr><td colspan="4" class="text-center text-muted py-3">Belum ada data pada interval ini.</td></tr>') +
        '<tr class="total-row"><td colspan="2" class="text-center">Jumlah</td><td class="num">' + sumTotal + '</td><td class="num">' + sumPct + '</td></tr>';
    }

    function renderZeroReports(){
        applyNoChartLayout();

        const zeroTkt = { created: 0, resolved: 0, outstanding: 0, pending: 0 };
        renderTicketingKpiCards(zeroTkt, zeroTkt, zeroTkt, 0, 0, 'Semua Produk');

        document.getElementById('dailyDateSelect').innerHTML = '<option value="EMPTY">Belum ada data</option>';
        document.getElementById('dailyHourStart').value = '0';
        document.getElementById('dailyHourEnd').value = '23';

        document.getElementById('tblDateVal').textContent = '-';
        document.getElementById('tblHourStart').textContent = '0:00';
        document.getElementById('tblHourEnd').textContent = '23:59';
        document.getElementById('pctInfo').textContent = '0.00%';
        document.getElementById('pctKeluhan').textContent = '0.00%';
        document.getElementById('pctPermintaan').textContent = '0.00%';

        document.getElementById('dailySummaryBody').innerHTML = [
            'Daily Interaction CASN (E-Meterai)',
            'Month to Date CASN (E-Meterai)',
            'Daily All Interaction (Semua Produk)',
            'MTD All Interaction (Semua Produk)',
        ].map(label =>
            '<tr><td class="row-title">' + label + '</td><td class="big-num">0</td><td class="big-num">0</td>' +
            '<td class="big-num">0</td><td class="big-num">0</td><td class="big-num">0</td><td class="big-num">0</td></tr>'
        ).join('');

        document.getElementById('channelBreakdownBody').innerHTML =
            '<tr><td colspan="7" class="text-center text-muted py-3">Belum ada data interaksi. Upload file CSV/Excel melalui Mode Admin.</td></tr>';

        setCardHeaderTitle('topDailyAllBody', 'Top 10 Interaksi — Semua Produk (Daily)');
        setCardHeaderTitle('topMtdAllBody', 'Top 10 Interaksi — Semua Produk (Month to Date)');
        fillTopTable('topDailyCasnBody', [], 0, '0.00%');
        fillTopTable('topMtdCasnBody', [], 0, '0.00%');
        fillTopTable('topDailyAllBody', [], 0, '0.00%');
        fillTopTable('topMtdAllBody', [], 0, '0.00%');

        document.getElementById('tktDateVal').textContent = '-';
        document.getElementById('tktHourStart').textContent = '0:00';
        document.getElementById('tktHourEnd').textContent = '23:59';

        document.getElementById('tktSummaryBody').innerHTML = [
            'Daily Ticket CASN (E-Meterai)',
            'MTD Ticket CASN (E-Meterai)',
            'Daily All Ticket (Semua Produk)',
            'MTD All Ticket (Semua Produk)',
        ].map(label =>
            '<tr><td class="row-title">' + label + '</td><td class="big-num">0</td><td class="big-num">0</td>' +
            '<td class="big-num">0</td><td class="big-num">0</td></tr>'
        ).join('');

        setCardHeaderTitle('topDailyTktAllBody', 'Top 10 Tiket — Semua Produk (Daily)');
        setCardHeaderTitle('topMtdTktAllBody', 'Top 10 Tiket — Semua Produk (Month to Date)');
        fillTopTable('topDailyTktCasnBody', [], 0, '0.00%');
        fillTopTable('topMtdTktCasnBody', [], 0, '0.00%');
        fillTopTable('topDailyTktAllBody', [], 0, '0.00%');
        fillTopTable('topMtdTktAllBody', [], 0, '0.00%');

        renderAgentProductivity();
    }

    function renderDailyAndTicketingFromUploaded(){
        applyNoChartLayout();
        if(!allInteractions.length){ renderZeroReports(); return; }

        const dateSet = new Set();
        allInteractions.forEach(r => {
            const iso = r.doStart || r.doOpen;
            if(!iso) return;
            const d = new Date(iso);
            const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            dateSet.add(key);
        });
        const dates = Array.from(dateSet).sort();
        const selDateEl = document.getElementById('dailyDateSelect');
        const prevVal = selDateEl.value;
        selDateEl.innerHTML = dates.map(dt => {
            const [y, m, d] = dt.split('-').map(Number);
            const lbl = new Date(y, m - 1, d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
            return '<option value="' + dt + '">' + lbl + '</option>';
        }).join('');
        if(dates.includes(prevVal)) selDateEl.value = prevVal;
        else if(dates.length) selDateEl.value = dates[dates.length - 1];

        const activeDate = selDateEl.value;
        const hStart = parseInt(document.getElementById('dailyHourStart').value, 10);
        const hEnd = parseInt(document.getElementById('dailyHourEnd').value, 10);

        const [ay, am, ad] = activeDate.split('-').map(Number);
        const activeDateLabel = new Date(ay, am - 1, ad).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        const monthPrefix = activeDate.slice(0, 7);
        const isAllProd = selectedSharedProducts.size === 0;
        const prodDisplayLabel = getSharedProductLabel();

        document.getElementById('tblDateVal').textContent = activeDateLabel;
        document.getElementById('tblHourStart').textContent = hStart + ':00';
        document.getElementById('tblHourEnd').textContent = hEnd + ':59';

        document.getElementById('tktDateVal').textContent = activeDateLabel;
        document.getElementById('tktHourStart').textContent = hStart + ':00';
        document.getElementById('tktHourEnd').textContent = hEnd + ':59';

        const buildTop10 = (list, tbodyId) => {
            const counts = new Map();
            list.forEach(x => {
                const k = x.r.dsc || x.r.sc || '(Lainnya)';
                counts.set(k, (counts.get(k) || 0) + 1);
            });
            const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
            const top10 = sorted.slice(0, 10);
            const topSum = top10.reduce((s, x) => s + x[1], 0);
            const allSum = list.length || 1;
            const topPct = list.length ? ((topSum / allSum) * 100).toFixed(2) + '%' : '0.00%';
            fillTopTable(tbodyId, top10.map(it => [it[0], it[1], ((it[1] / allSum) * 100).toFixed(2) + '%']), topSum, topPct);
        };

        const intMeta = allInteractions.map(r => {
            const iso = r.doStart || r.doOpen;
            if(!iso) return null;
            const d = new Date(iso);
            const dKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            return { r: r, dKey: dKey, hour: d.getHours() };
        }).filter(Boolean);

        const dailyAllInt = intMeta.filter(x => x.dKey === activeDate && x.hour >= hStart && x.hour <= hEnd && matchesSharedProduct(x.r));
        const dailyCasnInt = intMeta.filter(x => x.dKey === activeDate && x.hour >= hStart && x.hour <= hEnd && isCasnRecord(x.r));
        const mtdAllInt = intMeta.filter(x => x.dKey.startsWith(monthPrefix) && x.dKey <= activeDate && matchesSharedProduct(x.r));
        const mtdCasnInt = intMeta.filter(x => x.dKey.startsWith(monthPrefix) && x.dKey <= activeDate && isCasnRecord(x.r));

        const summarizeInt = (list) => {
            let fcr = 0, nfcr = 0, info = 0, kel = 0, perm = 0;
            list.forEach(x => {
                if(x.r.isEscalated) nfcr++; else fcr++;
                const mc = (x.r.mc || '').toLowerCase();
                if(mc === 'informasi') info++;
                else if(mc === 'keluhan') kel++;
                else if(mc === 'permintaan') perm++;
            });
            return { total: list.length, fcr, nfcr, info, kel, perm };
        };

        const sDailyCasnInt = summarizeInt(dailyCasnInt);
        const sMtdCasnInt = summarizeInt(mtdCasnInt);
        const sDailyAllInt = summarizeInt(dailyAllInt);
        const sMtdAllInt = summarizeInt(mtdAllInt);

        const intDenom = sDailyCasnInt.total || 1;
        document.getElementById('pctInfo').textContent = sDailyCasnInt.total ? ((sDailyCasnInt.info / intDenom) * 100).toFixed(2) + '%' : '0.00%';
        document.getElementById('pctKeluhan').textContent = sDailyCasnInt.total ? ((sDailyCasnInt.kel / intDenom) * 100).toFixed(2) + '%' : '0.00%';
        document.getElementById('pctPermintaan').textContent = sDailyCasnInt.total ? ((sDailyCasnInt.perm / intDenom) * 100).toFixed(2) + '%' : '0.00%';

        document.getElementById('dailySummaryBody').innerHTML = [
            { label: 'Daily Interaction CASN (E-Meterai)', ...sDailyCasnInt },
            { label: 'Month to Date CASN (E-Meterai)', ...sMtdCasnInt },
            { label: isAllProd ? 'Daily All Interaction (Semua Produk)' : 'Daily Interaction — ' + prodDisplayLabel, ...sDailyAllInt },
            { label: isAllProd ? 'MTD All Interaction (Semua Produk)' : 'MTD Interaction — ' + prodDisplayLabel, ...sMtdAllInt },
        ].map(r =>
            '<tr><td class="row-title">' + escapeHtml(r.label) + '</td><td class="big-num">' + r.total + '</td><td class="big-num">' + r.fcr + '</td>' +
            '<td class="big-num">' + r.nfcr + '</td><td class="big-num">' + r.info + '</td><td class="big-num">' + r.kel + '</td><td class="big-num">' + r.perm + '</td></tr>'
        ).join('');

        const chDailyList = isAllProd ? dailyCasnInt : dailyAllInt;
        const chMtdList = isAllProd ? mtdCasnInt : mtdAllInt;
        const chTitleEl = document.getElementById('channelBreakdownTitle');
        const thChDailyEl = document.getElementById('thChDaily');
        const thChMtdEl = document.getElementById('thChMtd');
        if(chTitleEl) chTitleEl.textContent = isAllProd
            ? 'Distribusi Interaksi CASN & Waktu Dispatch per Channel'
            : 'Distribusi Interaksi ' + prodDisplayLabel + ' & Waktu Dispatch per Channel';
        if(thChDailyEl) thChDailyEl.textContent = isAllProd ? 'Daily CASN' : 'Daily';
        if(thChMtdEl) thChMtdEl.textContent = isAllProd ? 'MTD CASN' : 'MTD';

        const chMap = new Map();
        chDailyList.forEach(x => {
            const ch = x.r.ch || '(Tanpa Channel)';
            if(!chMap.has(ch)) chMap.set(ch, { daily: 0, fcr: 0, nfcr: 0, mtd: 0, escHrs: [] });
            const g = chMap.get(ch);
            g.daily++;
            if(x.r.isEscalated){
                g.nfcr++;
                if(x.r.doOpen && x.r.doStart){
                    const hrs = (new Date(x.r.doOpen).getTime() - new Date(x.r.doStart).getTime()) / 3600000;
                    if(hrs >= 0) g.escHrs.push(hrs);
                }
            } else {
                g.fcr++;
            }
        });
        chMtdList.forEach(x => {
            const ch = x.r.ch || '(Tanpa Channel)';
            if(!chMap.has(ch)) chMap.set(ch, { daily: 0, fcr: 0, nfcr: 0, mtd: 0, escHrs: [] });
            chMap.get(ch).mtd++;
        });
        const chTotalDaily = chDailyList.length || 1;
        document.getElementById('channelBreakdownBody').innerHTML = Array.from(chMap.entries())
            .sort((a, b) => b[1].daily - a[1].daily)
            .map(([ch, g]) => {
                const pct = chDailyList.length ? ((g.daily / chTotalDaily) * 100).toFixed(2) + '%' : '0.00%';
                let avgCell = '—';
                if(g.escHrs.length){
                    const avgMins = (g.escHrs.reduce((s, h) => s + h, 0) / g.escHrs.length) * 60;
                    const badgeCls = avgMins > 15 ? 'bg-danger' : 'bg-success';
                    avgCell = '<span class="badge ' + badgeCls + '">' + avgMins.toFixed(1) + ' mnt</span>';
                }
                return '<tr><td class="row-title">' + escapeHtml(ch) + '</td><td class="num fw-semibold">' + g.daily + '</td><td class="num">' + pct + '</td>' +
                    '<td class="num">' + g.fcr + '</td><td class="num">' + g.nfcr + '</td><td class="num">' + g.mtd + '</td><td class="num">' + avgCell + '</td></tr>';
            }).join('') || '<tr><td colspan="7" class="text-center text-muted py-3">Tidak ada data channel pada interval ini.</td></tr>';

        setCardHeaderTitle('topDailyAllBody', 'Top 10 Interaksi — ' + prodDisplayLabel + ' (Daily)');
        setCardHeaderTitle('topMtdAllBody', 'Top 10 Interaksi — ' + prodDisplayLabel + ' (Month to Date)');
        buildTop10(dailyCasnInt, 'topDailyCasnBody');
        buildTop10(mtdCasnInt, 'topMtdCasnBody');
        buildTop10(dailyAllInt, 'topDailyAllBody');
        buildTop10(mtdAllInt, 'topMtdAllBody');

        const tktMeta = Array.from(ticketsMap.values()).map(r => {
            const iso = r.doOpen || r.doStart;
            if(!iso) return null;
            const d = new Date(iso);
            const dKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            return { r: r, dKey: dKey, hour: d.getHours() };
        }).filter(Boolean);

        const dailyAllTkt = tktMeta.filter(x => x.dKey === activeDate && x.hour >= hStart && x.hour <= hEnd && matchesSharedProduct(x.r));
        const dailyCasnTkt = tktMeta.filter(x => x.dKey === activeDate && x.hour >= hStart && x.hour <= hEnd && isCasnRecord(x.r));
        const mtdAllTkt = tktMeta.filter(x => x.dKey.startsWith(monthPrefix) && x.dKey <= activeDate && matchesSharedProduct(x.r));
        const mtdCasnTkt = tktMeta.filter(x => x.dKey.startsWith(monthPrefix) && x.dKey <= activeDate && isCasnRecord(x.r));

        const summarizeTkt = (list) => {
            let resolved = 0, outstanding = 0, pending = 0;
            list.forEach(x => {
                const st = (x.r.st || '').toLowerCase();
                if(FINISHED_STATUSES.has(st)) resolved++;
                else {
                    outstanding++;
                    if(st === 'pending') pending++;
                }
            });
            return { created: list.length, resolved, outstanding, pending };
        };

        const sDailyCasnTkt = summarizeTkt(dailyCasnTkt);
        const sMtdCasnTkt = summarizeTkt(mtdCasnTkt);
        const sDailyAllTkt = summarizeTkt(dailyAllTkt);
        const sMtdAllTkt = summarizeTkt(mtdAllTkt);

        const casnAllTickets = Array.from(ticketsMap.values()).filter(r => isCasnRecord(r));
        const activeCasnQueueList = casnAllTickets.filter(r => !FINISHED_STATUSES.has((r.st || '').toLowerCase()));
        const activeCasnPendingCount = activeCasnQueueList.filter(r => (r.st || '').toLowerCase() === 'pending').length;

        renderTicketingKpiCards(sDailyCasnTkt, sMtdCasnTkt, sMtdAllTkt, activeCasnQueueList.length, activeCasnPendingCount, prodDisplayLabel);

        document.getElementById('dailySourceBadge').textContent =
            'CASN MTD: ' + sMtdCasnInt.total.toLocaleString('id-ID') + ' · ' + prodDisplayLabel + ' MTD: ' + sMtdAllInt.total.toLocaleString('id-ID') +
            ' · Antrian CASN: ' + (activeCasnQueueList.length >= 1000 ? '1000+' : activeCasnQueueList.length.toLocaleString('id-ID'));

        document.getElementById('tktSummaryBody').innerHTML = [
            { label: 'Daily Ticket CASN (E-Meterai)', ...sDailyCasnTkt },
            { label: 'MTD Ticket CASN (E-Meterai)', ...sMtdCasnTkt },
            { label: isAllProd ? 'Daily All Ticket (Semua Produk)' : 'Daily Ticket — ' + prodDisplayLabel, ...sDailyAllTkt },
            { label: isAllProd ? 'MTD All Ticket (Semua Produk)' : 'MTD Ticket — ' + prodDisplayLabel, ...sMtdAllTkt },
        ].map(r =>
            '<tr><td class="row-title">' + escapeHtml(r.label) + '</td><td class="big-num">' + r.created + '</td><td class="big-num">' + r.resolved + '</td>' +
            '<td class="big-num">' + r.outstanding + '</td><td class="big-num">' + r.pending + '</td></tr>'
        ).join('');

        setCardHeaderTitle('topDailyTktAllBody', 'Top 10 Tiket — ' + prodDisplayLabel + ' (Daily)');
        setCardHeaderTitle('topMtdTktAllBody', 'Top 10 Tiket — ' + prodDisplayLabel + ' (Month to Date)');
        buildTop10(dailyCasnTkt, 'topDailyTktCasnBody');
        buildTop10(mtdCasnTkt, 'topMtdTktCasnBody');
        buildTop10(dailyAllTkt, 'topDailyTktAllBody');
        buildTop10(mtdAllTkt, 'topMtdTktAllBody');

        renderAgentProductivity();
    }

    function getPendingCutoff(rec){
        if(!rec.doPending) return null;
        const openT = rec.doOpen ? new Date(rec.doOpen).getTime() : null;
        const pendingT = new Date(rec.doPending).getTime();
        if(openT !== null && pendingT <= openT) return null;
        return pendingT;
    }

    function classifyPct(pct){
        if(pct >= 100) return 'breach';
        if(pct >= 90) return 'warning';
        return 'aman';
    }

    function computeSla(rec, nowMs){
        const target = SLA_TARGET[rec.pr] || null;
        const isFinished = FINISHED_STATUSES.has((rec.st || '').toLowerCase());
        const pendingCutoff = getPendingCutoff(rec);

        if(isFinished && rec.doOpen && rec.doRes && target){
            const openT = new Date(rec.doOpen).getTime();
            const resT = new Date(rec.doRes).getTime();
            const usesPending = pendingCutoff !== null && pendingCutoff < resT;
            const pendingHours = usesPending ? (resT - pendingCutoff) / 3600000 : 0;
            const hoursExclude = ((usesPending ? pendingCutoff : resT) - openT) / 3600000;
            const hoursInclude = (resT - openT) / 3600000;
            const resultExclude = hoursExclude <= target ? 'aman' : 'breach';
            const resultInclude = hoursInclude <= target ? 'aman' : 'breach';
            const hours = slaViewMode === 'include' ? hoursInclude : hoursExclude;
            const result = slaViewMode === 'include' ? resultInclude : resultExclude;

            return {
                finished: true, target, pendingExcluded: usesPending, pendingHours,
                hours, pct: (hours / target) * 100, result,
                hoursExclude, hoursInclude, resultExclude, resultInclude
            };
        }
        if(!isFinished && rec.doOpen && target){
            const openT = new Date(rec.doOpen).getTime();
            const isCurrentlyPending = (rec.st || '').toLowerCase() === 'pending';
            const usesPending = pendingCutoff !== null && isCurrentlyPending;
            const pendingHours = usesPending ? (nowMs - pendingCutoff) / 3600000 : 0;
            const hoursExclude = ((usesPending ? pendingCutoff : nowMs) - openT) / 3600000;
            const hoursInclude = (nowMs - openT) / 3600000;
            const pctExclude = (hoursExclude / target) * 100;
            const pctInclude = (hoursInclude / target) * 100;
            const resultExclude = classifyPct(pctExclude);
            const resultInclude = classifyPct(pctInclude);
            const hours = slaViewMode === 'include' ? hoursInclude : hoursExclude;
            const pct = slaViewMode === 'include' ? pctInclude : pctExclude;
            const result = slaViewMode === 'include' ? resultInclude : resultExclude;

            return {
                finished: false, target, pendingExcluded: usesPending, pendingHours,
                hours, pct, result,
                hoursExclude, hoursInclude, resultExclude, resultInclude
            };
        }
        return { finished: isFinished, hours: null, target, pct: null, result: 'unknown' };
    }

    function computeEscalation(rec){
        const eligible = ESCALATION_ELIGIBLE.has((rec.st || '').toLowerCase());
        const channelOk = ESCALATION_CHANNELS.has((rec.ch || '').toLowerCase());
        if(eligible && channelOk && rec.doOpen && rec.doStart){
            const hrs = (new Date(rec.doOpen).getTime() - new Date(rec.doStart).getTime()) / 3600000;
            return { hours: hrs, result: hrs <= ESCALATION_TARGET_HOURS ? 'aman' : 'breach' };
        }
        return { hours: null, result: 'unknown' };
    }

    function bucketOf(hours){
        for(const b of DURATION_BUCKETS){ if(hours <= b.max) return b.label; }
        return DURATION_BUCKETS[DURATION_BUCKETS.length - 1].label;
    }

    function monthKeyOf(iso){
        const d = new Date(iso);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    }

    function monthLabel(key){
        const [y, m] = key.split('-').map(Number);
        return new Date(y, m - 1, 1).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
    }

    function fmtHours(hrs){
        if(hrs === null || hrs === undefined || isNaN(hrs)) return '—';
        if(hrs < 24) return hrs.toFixed(2) + ' jam';
        return hrs.toFixed(2) + ' jam (' + (hrs / 24).toFixed(1) + ' hari)';
    }

    function fmtCountdown(remHours){
        if(remHours === null || remHours === undefined || isNaN(remHours)) return '—';
        const abs = Math.abs(remHours);
        const label = abs < 1 ? Math.round(abs * 60) + ' menit' : abs.toFixed(1) + ' jam';
        return remHours >= 0 ? 'Sisa ' + label : 'Lewat ' + label;
    }

    function applyProductFilter(list, sel){
        if(sel === 'ALL') return list;
        if(sel.indexOf('COMBINED:') === 0){
            const names = sel.slice(9).split('|');
            return list.filter(c => names.includes(c.rec.sc));
        }
        return list.filter(c => c.rec.sc === sel);
    }

    function updateFilters(allComputed){
        const products = Array.from(new Set(allComputed.map(c => c.rec.sc).filter(Boolean))).sort();
        let pHtml = '<option value="ALL">Semua Produk (' + allComputed.length + ')</option>';
        if(products.includes('E-Meterai') && products.includes('Perisai')){
            pHtml += '<option value="' + COMBINED_VALUE + '">E-Meterai + Perisai (Gabungan)</option>';
        }
        pHtml += products.map(p => '<option value="' + p + '">' + p + '</option>').join('');
        document.getElementById('productFilter').innerHTML = pHtml;
        if(['ALL', COMBINED_VALUE].concat(products).includes(selectedProduct)) document.getElementById('productFilter').value = selectedProduct;
        else selectedProduct = 'ALL';

        const byProd = applyProductFilter(allComputed, selectedProduct);
        const cats = Array.from(new Set(byProd.map(c => c.rec.dsc).filter(Boolean))).sort();
        document.getElementById('categoryFilter').innerHTML = '<option value="ALL">Semua Kategori</option>' +
            cats.map(cat => '<option value="' + cat + '">' + cat + '</option>').join('');
        if(selectedCategory === 'ALL' || cats.includes(selectedCategory)) document.getElementById('categoryFilter').value = selectedCategory;
        else selectedCategory = 'ALL';

        const months = Array.from(new Set(byProd.filter(c => c.rec.doOpen).map(c => monthKeyOf(c.rec.doOpen)))).sort().reverse();
        document.getElementById('monthFilter').innerHTML = '<option value="ALL">Semua Bulan</option>' +
            months.map(m => '<option value="' + m + '">' + monthLabel(m) + '</option>').join('');
        if(selectedMonth === 'ALL' || months.includes(selectedMonth)) document.getElementById('monthFilter').value = selectedMonth;
        else selectedMonth = 'ALL';

        const resetBtn = document.getElementById('resetSlaFiltersBtn');
        if(resetBtn){
            const hasActive = selectedProduct !== 'ALL' || selectedCategory !== 'ALL' || selectedMonth !== 'ALL';
            resetBtn.style.display = hasActive ? '' : 'none';
        }
    }

    function renderActual(){
        relocateSlaFiltersToPage();
        ensureAtRiskRadarCard();
        applyNoChartLayout();
        if(ticketsMap.size === 0){
            document.getElementById('emptyState').style.display = '';
            document.getElementById('actualDashboard').style.display = 'none';
            return;
        }
        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('actualDashboard').style.display = '';
        const modeTxt = slaViewMode === 'include'
            ? 'Mode Aktif: User (Include Pending — Waktu Kalender Penuh)'
            : 'Mode Aktif: Internal (Exclude Pending — Performa Solver)';
        document.getElementById('modeSubtitle').textContent = modeTxt;
        const modePill = document.getElementById('slaModePill');
        if(modePill){
            modePill.textContent = slaViewMode === 'include'
                ? 'SLA: User (Incl. Pending)'
                : 'SLA: Internal (Excl. Pending)';
        }

        const now = Date.now();
        const allComputed = Array.from(ticketsMap.values()).map(rec => ({ rec, sla: computeSla(rec, now) }));
        updateFilters(allComputed);

        let scoped = applyProductFilter(allComputed, selectedProduct);
        if(selectedCategory !== 'ALL') scoped = scoped.filter(c => c.rec.dsc === selectedCategory);
        if(selectedMonth !== 'ALL') scoped = scoped.filter(c => c.rec.doOpen && monthKeyOf(c.rec.doOpen) === selectedMonth);
        currentScopedRows = scoped;

        const finished = scoped.filter(c => c.sla.finished);
        const outstanding = scoped.filter(c => !c.sla.finished);
        const compliant = finished.filter(c => c.sla.result === 'aman').length;
        const breachFinished = finished.filter(c => c.sla.result === 'breach').length;
        const compliancePct = finished.length ? ((compliant / finished.length) * 100).toFixed(1) : '—';
        const outWarning = outstanding.filter(c => c.sla.result === 'warning').length;
        const outBreach = outstanding.filter(c => c.sla.result === 'breach').length;
        const reopenCount = scoped.filter(c => (c.rec.st || '').toLowerCase().includes('reopen')).length;
        const reopenPct = scoped.length ? ((reopenCount / scoped.length) * 100).toFixed(1) + '%' : '0.0%';

        const kpiCards = [
            { label: 'Total Tiket', value: scoped.length.toLocaleString('id-ID'), dot: 'blue' },
            { label: 'SLA Compliance', value: compliancePct + (compliancePct !== '—' ? '%' : ''), dot: compliancePct !== '—' && +compliancePct >= 90 ? 'green' : 'amber' },
            { label: 'Breach (Selesai)', value: breachFinished.toLocaleString('id-ID'), dot: breachFinished > 0 ? 'red' : 'green' },
            { label: 'Outstanding Warning', value: outWarning.toLocaleString('id-ID'), dot: outWarning > 0 ? 'amber' : 'green' },
            { label: 'Outstanding Breach', value: outBreach.toLocaleString('id-ID'), dot: outBreach > 0 ? 'red' : 'green' },
            { label: 'Reopen Rate', value: reopenPct + ' (' + reopenCount + ')', dot: reopenCount > 0 ? 'amber' : 'neutral' },
        ];
        document.getElementById('overviewCards').innerHTML = kpiCards.map(c =>
            '<div class="col-xl-2 col-md-4 col-sm-6"><div class="card casn-kpi-card mb-3"><div class="card-body py-2 px-3">' +
              '<div class="casn-kpi-label mb-1"><span class="kpi-dot ' + c.dot + '"></span>' + c.label + '</div>' +
              '<div class="casn-kpi-val">' + c.value + '</div>' +
            '</div></div></div>'
        ).join('');

        const atRisk = outstanding
            .filter(c => c.sla.target !== null && c.sla.hours !== null)
            .map(c => ({ ...c, remHours: c.sla.target - c.sla.hours }))
            .sort((a, b) => a.remHours - b.remHours)
            .slice(0, 5);

        document.getElementById('atRiskRadarBody').innerHTML = atRisk.map(c => {
            const cdText = fmtCountdown(c.remHours);
            const badgeCls = c.remHours < 0 ? 'bg-danger' : (c.remHours <= 2 ? 'bg-warning' : 'bg-info');
            const subj = (c.rec.sj || c.rec.dsc || '—').replace(/"/g, '&quot;');
            return '<tr data-ticket-id="' + c.rec.id + '" data-priority="' + (c.rec.pr || '-') + '" data-subject="' + subj + '" data-countdown="' + cdText + '">' +
                '<td class="font-monospace fw-semibold">' + c.rec.id + '</td>' +
                '<td>' + (c.rec.sc || '—') + '</td>' +
                '<td>' + (c.rec.sj || c.rec.dsc || '—') + '</td>' +
                '<td><strong>' + (c.rec.pr || '—') + '</strong></td>' +
                '<td>' + (c.rec.st || '—') + '</td>' +
                '<td>' + fmtHours(c.sla.hours) + ' / ' + c.sla.target + 'j</td>' +
                '<td><span class="badge ' + badgeCls + '">' + cdText + '</span></td>' +
            '</tr>';
        }).join('') || '<tr><td colspan="7" class="text-center text-muted py-3">Tidak ada tiket aktif (Outstanding) pada filter ini.</td></tr>';

        let totFin = 0, totComp = 0, totBreach = 0;
        const allValidHrs = [];
        const achRows = PRIORITY_ORDER.map(pr => {
            const items = finished.filter(c => c.rec.pr === pr);
            const comp = items.filter(c => c.sla.result === 'aman').length;
            const br = items.filter(c => c.sla.result === 'breach').length;
            const validHrs = items.filter(c => c.sla.hours !== null && c.sla.hours >= 0).map(c => c.sla.hours);
            validHrs.forEach(h => allValidHrs.push(h));
            const mttr = validHrs.length ? (validHrs.reduce((s, h) => s + h, 0) / validHrs.length).toFixed(2) + ' jam' : '—';
            totFin += items.length; totComp += comp; totBreach += br;
            const pct = items.length ? ((comp / items.length) * 100).toFixed(1) : '—';
            const badgeCls = pct === '—' ? 'bg-secondary' : (+pct >= 90 ? 'bg-success' : 'bg-danger');
            return '<tr><td><strong>' + pr + '</strong></td><td>' + items.length + '</td><td>' + comp + '</td><td>' + br + '</td>' +
                '<td><span class="badge ' + badgeCls + '">' + pct + (pct !== '—' ? '%' : '') + '</span></td><td>' + mttr + '</td></tr>';
        }).join('');
        const totPct = totFin ? ((totComp / totFin) * 100).toFixed(1) : '—';
        const totMttr = allValidHrs.length ? (allValidHrs.reduce((s, h) => s + h, 0) / allValidHrs.length).toFixed(2) + ' jam' : '—';
        document.getElementById('achievementBody').innerHTML = achRows +
            '<tr class="fw-semibold total-row"><td>Total</td><td>' + totFin + '</td><td>' + totComp + '</td><td>' + totBreach + '</td><td>' + totPct + (totPct !== '—' ? '%' : '') + '</td><td>' + totMttr + '</td></tr>';

        const finWithHours = finished.filter(c => c.sla.hours !== null);
        document.getElementById('distTableHead').innerHTML = '<th>Priority</th>' + DURATION_BUCKETS.map(b => '<th>' + b.label + '</th>').join('') + '<th>Total</th>';
        const distRows = PRIORITY_ORDER.map(pr => {
            const items = finWithHours.filter(c => c.rec.pr === pr);
            const counts = DURATION_BUCKETS.map(b => items.filter(c => bucketOf(c.sla.hours) === b.label).length);
            return '<tr><td><strong>' + pr + '</strong></td>' + counts.map(n => '<td>' + n + '</td>').join('') + '<td><strong>' + items.length + '</strong></td></tr>';
        }).join('');
        const distTotals = DURATION_BUCKETS.map(b => finWithHours.filter(c => bucketOf(c.sla.hours) === b.label).length);
        document.getElementById('distTableBody').innerHTML = distRows +
            '<tr class="fw-semibold total-row"><td>Total</td>' + distTotals.map(n => '<td>' + n + '</td>').join('') + '<td>' + finWithHours.length + '</td></tr>';

        const escItems = scoped.map(c => ({ rec: c.rec, esc: computeEscalation(c.rec) })).filter(x => x.esc.hours !== null);
        const escAman = escItems.filter(x => x.esc.result === 'aman').length;
        const escBreach = escItems.filter(x => x.esc.result === 'breach').length;
        const escAvgMin = escItems.length ? (escItems.reduce((s, x) => s + x.esc.hours, 0) / escItems.length) * 60 : null;
        document.getElementById('escalationCards').innerHTML = [
            { label: 'Rata-rata Dispatch N-FCR', value: escAvgMin !== null ? escAvgMin.toFixed(1) + ' mnt' : '—', dot: 'blue' },
            { label: 'Dalam Target (≤15m)', value: escAman, dot: 'green' },
            { label: 'Breach (>15m)', value: escBreach, dot: escBreach > 0 ? 'red' : 'green' },
        ].map(c => '<div class="col-4"><div class="card casn-kpi-card mb-0"><div class="card-body p-2"><div class="casn-kpi-label"><span class="kpi-dot ' + c.dot + '"></span>' + c.label + '</div><div class="h5 mb-0 fw-semibold mt-1">' + c.value + '</div></div></div></div>').join('');

        const escByChannel = new Map();
        escItems.forEach(x => {
            const p = (x.rec.ch || '(Lainnya)') + ' · ' + (x.rec.sc || '-');
            if(!escByChannel.has(p)) escByChannel.set(p, { total: 0, aman: 0, sumHrs: 0 });
            const g = escByChannel.get(p);
            g.total++;
            g.sumHrs += Math.max(0, x.esc.hours);
            if(x.esc.result === 'aman') g.aman++;
        });
        const maxEsc = Math.max(1, ...Array.from(escByChannel.values()).map(g => g.total));
        document.getElementById('escalationByProduct').innerHTML = Array.from(escByChannel.entries()).sort((a, b) => b[1].total - a[1].total).map(([name, g]) => {
            const pct = g.total ? ((g.aman / g.total) * 100).toFixed(0) : '0';
            const avgM = g.total ? ((g.sumHrs / g.total) * 60).toFixed(1) + 'm' : '-';
            return '<div class="breakdown-item"><div class="breakdown-name" title="' + name + '">' + name + '</div><div class="breakdown-bar"><div class="breakdown-fill" style="width:' + (g.total / maxEsc * 100) + '%"></div></div><div class="breakdown-val" style="flex:0 0 135px;">' + g.total + ' · ' + avgM + ' (' + pct + '%)</div></div>';
        }).join('') || '<p class="small text-muted mb-0">Tidak ada data N-FCR Email/WhatsApp.</p>';

        const prods = Array.from(new Set(scoped.map(c => c.rec.sc).filter(Boolean))).sort();
        document.getElementById('productPriorityTables').innerHTML = prods.map(prod => {
            const rows = PRIORITY_ORDER.map(pr => {
                const inGroup = scoped.filter(c => c.rec.sc === prod && c.rec.pr === pr);
                const eValid = inGroup.map(c => computeEscalation(c.rec)).filter(e => e.hours !== null && e.hours >= 0);
                const avgResp = eValid.length ? ((eValid.reduce((s, e) => s + e.hours, 0) / eValid.length) * 60).toFixed(2) + ' Menit' : '-';
                const rValid = inGroup.filter(c => c.sla.finished && c.sla.hours !== null && c.sla.hours >= 0);
                const avgRes = rValid.length ? (rValid.reduce((s, c) => s + c.sla.hours, 0) / rValid.length).toFixed(2) + ' Jam' : '-';
                return '<tr><td><strong>' + pr + '</strong></td><td>15 menit</td><td>' + SLA_TARGET[pr] + ' jam</td><td>' + avgResp + '</td><td>' + avgRes + '</td></tr>';
            }).join('');
            return '<div class="mb-3"><div class="small fw-semibold mb-2">' + prod + '</div>' +
                '<div class="table-responsive"><table class="sla-tbl"><thead><tr><th>Priority</th><th>Target Respons</th><th>Target Resolusi</th><th>Rata-rata Respons Aktual</th><th>Rata-rata Resolusi Aktual</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>';
        }).join('');

        drawTicketTable();
    }

    function getFilteredTickets(){
        const q = (document.getElementById('ticketSearch').value || '').toLowerCase().trim();
        const st = document.getElementById('ticketStatusFilter').value;
        const pr = document.getElementById('ticketPriorityFilter').value;
        return currentScopedRows.filter(c => {
            if(st === 'achieved' && !(c.sla.finished && c.sla.result === 'aman')) return false;
            if(st === 'not_achieved' && !(c.sla.finished && c.sla.result === 'breach')) return false;
            if(st === 'outstanding' && c.sla.finished) return false;
            if(pr !== 'ALL' && c.rec.pr !== pr) return false;
            if(q && !(c.rec.id + ' ' + c.rec.sj + ' ' + c.rec.dsc + ' ' + c.rec.sc + ' ' + (c.rec.agent || '')).toLowerCase().includes(q)) return false;
            return true;
        });
    }

    function drawTicketTable(){
        const list = getFilteredTickets();
        const shown = list.slice(0, 300);
        document.getElementById('ticketListBody').innerHTML = shown.map(c => {
            let badge = '<span class="badge bg-secondary">—</span>';
            if(c.sla.finished){
                badge = c.sla.result === 'aman' ? '<span class="badge bg-success">Achieved</span>' : '<span class="badge bg-danger">Not Achieved</span>';
            } else if(c.sla.result !== 'unknown'){
                const cls = c.sla.result === 'breach' ? 'bg-danger' : (c.sla.result === 'warning' ? 'bg-warning' : 'bg-success');
                const lbl = c.sla.result === 'breach' ? 'Outstanding — Breach' : (c.sla.result === 'warning' ? 'Outstanding — Warning' : 'Outstanding — Aman');
                badge = '<span class="badge ' + cls + '">' + lbl + '</span>';
            }
            const pendingBadge = c.sla.pendingExcluded ? '<span class="pending-tag" title="Pending ' + c.sla.pendingHours.toFixed(2) + ' jam">pending</span>' : '';
            const exclCls = c.sla.resultExclude === 'breach' ? ' class="text-danger fw-semibold"' : '';
            const inclCls = c.sla.resultInclude === 'breach' ? ' class="text-danger fw-semibold"' : '';
            return '<tr><td class="font-monospace fw-semibold">' + c.rec.id + '</td><td>' + (c.rec.sc || '—') + '</td><td>' + (c.rec.sj || '—') + '</td><td>' + (c.rec.dsc || '—') + '</td>' +
                '<td><strong>' + (c.rec.pr || '—') + '</strong></td><td>' + (c.rec.st || '—') + '</td>' +
                '<td' + exclCls + '>' + fmtHours(c.sla.hoursExclude) + pendingBadge + '</td>' +
                '<td' + inclCls + '>' + fmtHours(c.sla.hoursInclude) + '</td><td>' + badge + '</td></tr>';
        }).join('') || '<tr><td colspan="9" class="text-center text-muted py-4">Tidak ada tiket yang cocok.</td></tr>';

        document.getElementById('ticketListCount').textContent = list.length + ' tiket';
        document.getElementById('ticketListNote').textContent = 'Menampilkan ' + shown.length + ' dari ' + list.length + ' tiket. Kolom "Internal" mengecualikan durasi pending; kolom "User" menghitung waktu penuh.';
    }

    function runSimulation(){
        const vol = +document.getElementById('inVolume').value;
        const agents = +document.getElementById('inAgents').value;
        const baseAht = +document.getElementById('inAht').value;
        const escRate = +document.getElementById('inEscRate').value / 100;
        const useSegment = document.getElementById('chkSegment').checked;
        const useCanned = document.getElementById('chkCanned').checked;
        const useLifo = document.getElementById('chkLifo').checked;
        const highSev = document.getElementById('chkSeverity').checked;

        const otAgents = Math.max(0, agents - 6);
        document.getElementById('valVolume').textContent = vol.toLocaleString('id-ID') + ' interaksi/hari';
        document.getElementById('valAgents').textContent = agents + ' agent (' + otAgents + ' OT)';
        document.getElementById('valAht').textContent = baseAht.toFixed(1) + ' menit';
        document.getElementById('valEscRate').textContent = Math.round(escRate * 100) + '%';

        const effAht = useCanned ? baseAht * 0.75 : baseAht;
        const capInteractions = Math.floor((agents * 480) / effAht);
        const backlog = Math.max(0, vol - capInteractions);
        const estTickets = Math.round(vol * escRate);

        const loadRatio = vol / Math.max(1, capInteractions);
        let emetSla = 95 - Math.max(0, (loadRatio - 0.85) * 48);
        if(useLifo) emetSla += 4.5;
        if(useCanned) emetSla += 3.0;
        if(highSev) emetSla -= 6.5;
        emetSla = Math.max(18.7, Math.min(98.5, emetSla));

        let perisaiSla = useSegment
            ? Math.max(91.0, 98.0 - Math.max(0, (loadRatio - 1.2) * 3.5))
            : Math.max(68.5, emetSla + 8.0);

        const recAgents = Math.ceil((vol * effAht) / (480 * 0.88));

        document.getElementById('simCards').innerHTML = [
            { label: 'Kapasitas Layan / Hari', value: capInteractions.toLocaleString('id-ID'), hint: 'AHT: ' + effAht.toFixed(1) + 'm · Backlog: ' + backlog, dot: backlog === 0 ? 'green' : 'amber' },
            { label: 'Proyeksi Tiket N-FCR', value: estTickets + ' tiket', hint: highSev ? 'Critical/High (8j–12j)' : 'Medium Standar (24j)', dot: 'blue' },
            { label: 'Proyeksi SLA E-Meterai', value: emetSla.toFixed(1) + '%', hint: emetSla >= 85 ? 'Terkendali (≥85%)' : 'Risiko Breach Tinggi', dot: emetSla >= 85 ? 'green' : (emetSla >= 70 ? 'amber' : 'red') },
            { label: 'Proyeksi SLA Perisai', value: perisaiSla.toFixed(1) + '%', hint: useSegment ? 'VIP Terisolasi' : 'Tercampur (Ideal: ' + recAgents + ' agt)', dot: perisaiSla >= 90 ? 'green' : 'amber' }
        ].map(c =>
            '<div class="col-md-3 col-sm-6"><div class="card casn-kpi-card mb-3"><div class="card-body py-2 px-3">' +
              '<div class="casn-kpi-label mb-1"><span class="kpi-dot ' + c.dot + '"></span>' + c.label + '</div>' +
              '<div class="casn-kpi-val mb-1">' + c.value + '</div>' +
              '<div class="casn-kpi-sub">' + c.hint + '</div>' +
            '</div></div></div>'
        ).join('');
    }

    function renderHistoricalTable(){
        const histCanvas = document.getElementById('histChart');
        if(!histCanvas) return;
        const wrap = histCanvas.parentElement;
        wrap.style.height = 'auto';

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const rowsData = [
            { year: '2024', emet: [79.8,48.6,53.0,61.3,69.0,72.5,47.7,55.2,18.7,45.9,39.2,26.3], perisai: [95.0,95.2,94.8,92.2,93.4,83.6,68.5,88.6,86.2,92.2,96.1,95.4] },
            { year: '2025', emet: [36.0,42.7,77.1,81.1,65.9,57.6,61.5,65.2,70.3,68.4,57.9,74.3], perisai: [97.9,97.8,99.3,98.4,99.0,97.8,95.5,98.3,97.4,96.6,97.5,98.1] },
            { year: '2026', emet: [70.1,70.9,63.4,73.0,78.1,70.7,75.7,null,null,null,null,null], perisai: [97.6,98.2,98.1,99.0,97.9,99.4,98.3,null,null,null,null,null] }
        ];

        const makeRowHtml = (label, arr) =>
            '<tr><td class="row-title">' + label + '</td>' +
            arr.map(v => '<td class="num">' + (v !== null ? v.toFixed(1) + '%' : '—') + '</td>').join('') +
            '</tr>';

        wrap.innerHTML =
            '<div class="table-responsive"><table class="report-tbl">' +
            '<thead><tr><th class="text-start">Produk / Tahun</th>' + months.map(m => '<th class="text-end">' + m + '</th>').join('') + '</tr></thead>' +
            '<tbody>' +
            rowsData.map(r => makeRowHtml('E-Meterai ' + r.year, r.emet) + makeRowHtml('Perisai ' + r.year, r.perisai)).join('') +
            '</tbody></table></div>';
    }

    function switchSection(target, title){
        document.querySelectorAll('#sidenavAccordion .nav-link').forEach(link => {
            link.classList.toggle('active', link.dataset.target === target);
        });
        document.querySelectorAll('.tab-section').forEach(sec => {
            sec.classList.toggle('active', sec.id === 'sec-' + target);
        });
        document.getElementById('pageHeading').textContent = title;
        document.getElementById('pageBreadcrumb').textContent = title;
        document.getElementById('sharedDailyControls').style.display = (target === 'daily' || target === 'ticketing' || target === 'agent') ? '' : 'none';
        if(target === 'agent') renderAgentProductivity();
    }

    document.querySelectorAll('#sidenavAccordion .nav-link[data-target]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchSection(link.dataset.target, link.dataset.title);
        });
    });

    document.getElementById('fileInput').addEventListener('change', async (ev) => {
        const file = ev.target.files[0];
        if(!file) return;
        const syncMode = (document.getElementById('uploadSyncMode') || {}).value || 'replace';
        showStatus('info', 'Membaca file "' + file.name + '"...');
        try{
            const buf = await file.arrayBuffer();
            const parsed = parseWorkbook(buf, file.name);
            if(parsed.interactions.length === 0) throw new Error('Tidak ada baris interaksi valid yang ditemukan.');

            if(syncMode === 'replace' || allInteractions.length === 0){
                clearLocalAgentMap();
                allInteractions = parsed.interactions;
                ticketsMap = parsed.escalated;
            } else {
                const mergedInt = new Map(allInteractions.map(r => [r.id, r]));
                parsed.interactions.forEach(r => mergedInt.set(r.id, r));
                allInteractions = Array.from(mergedInt.values());
                parsed.escalated.forEach((rec, id) => ticketsMap.set(id, rec));
            }
            saveLocalAgentMap(parsed.interactions);
            populateSubcategoryProductOptions();

            document.getElementById('dailyHourStart').value = '0';
            document.getElementById('dailyHourEnd').value = '23';
            renderDailyAndTicketingFromUploaded();
            renderActual();

            showStatus('info', 'Menyimpan ' + parsed.interactions.length.toLocaleString('id-ID') + ' baris ke Cloudflare D1 (' + syncMode + ')...');
            try {
                await syncToD1(parsed.interactions, syncMode);
                document.getElementById('metaBadge').textContent =
                    'D1 · ' + allInteractions.length.toLocaleString('id-ID') + ' interaksi (' + ticketsMap.size.toLocaleString('id-ID') + ' N-FCR)';
                showStatus('success', 'Berhasil memuat & menyimpan ' + parsed.interactions.length.toLocaleString('id-ID') + ' interaksi ke Cloudflare D1.', 5000);
            } catch (syncErr) {
                document.getElementById('metaBadge').textContent =
                    file.name + ' (Lokal) · ' + allInteractions.length + ' interaksi (' + ticketsMap.size + ' N-FCR)';
                showStatus('warning', 'Data tampil di layar, namun gagal sync ke D1 (' + syncErr.message + ').');
            }
        }catch(e){
            showStatus('danger', 'Gagal membaca file: ' + e.message);
        }
        ev.target.value = '';
    });

    ['dailyDateSelect', 'dailyHourStart', 'dailyHourEnd'].forEach(id => {
        document.getElementById(id).addEventListener('change', () => {
            if(allInteractions.length) renderDailyAndTicketingFromUploaded();
            else renderAgentProductivity();
        });
    });

    document.getElementById('slaViewToggle').addEventListener('click', () => {
        slaViewMode = slaViewMode === 'exclude' ? 'include' : 'exclude';
        document.getElementById('slaViewToggle').textContent = slaViewMode === 'include'
            ? 'SLA: User (Incl. Pending)'
            : 'SLA: Internal (Excl. Pending)';
        if(ticketsMap.size > 0) renderActual();
    });

    document.getElementById('themeToggleBtn').addEventListener('click', () => {
        isDark = !isDark;
        const sidenav = document.getElementById('sidenavAccordion');
        if(isDark){
            document.documentElement.classList.add('dark-mode');
            document.documentElement.setAttribute('data-bs-theme', 'dark');
            sidenav.classList.remove('sb-sidenav-light');
            sidenav.classList.add('sb-sidenav-dark');
            document.getElementById('themeToggleBtn').textContent = 'Tema: Gelap';
        } else {
            document.documentElement.classList.remove('dark-mode');
            document.documentElement.removeAttribute('data-bs-theme');
            sidenav.classList.remove('sb-sidenav-dark');
            sidenav.classList.add('sb-sidenav-light');
            document.getElementById('themeToggleBtn').textContent = 'Tema: Terang';
        }
    });

    document.getElementById('productFilter').addEventListener('change', (e) => { selectedProduct = e.target.value; renderActual(); });
    document.getElementById('categoryFilter').addEventListener('change', (e) => { selectedCategory = e.target.value; renderActual(); });
    document.getElementById('monthFilter').addEventListener('change', (e) => { selectedMonth = e.target.value; renderActual(); });

    document.getElementById('ticketSearch').addEventListener('input', drawTicketTable);
    document.getElementById('ticketStatusFilter').addEventListener('change', drawTicketTable);
    document.getElementById('ticketPriorityFilter').addEventListener('change', drawTicketTable);

    document.getElementById('exportCsvBtn').addEventListener('click', () => {
        const list = getFilteredTickets();
        if(!list.length) return;
        const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
        const header = ['Ticket ID','Produk','Subject','Kategori','Priority','Status','Durasi Internal (Jam)','Durasi User (Jam)','Hasil SLA'];
        const lines = [header.join(',')];
        list.forEach(c => {
            const resLbl = c.sla.finished ? (c.sla.result === 'aman' ? 'Achieved' : 'Not Achieved') : c.sla.result;
            lines.push([
                c.rec.id, c.rec.sc, c.rec.sj, c.rec.dsc, c.rec.pr, c.rec.st,
                c.sla.hoursExclude != null ? c.sla.hoursExclude.toFixed(2) : '',
                c.sla.hoursInclude != null ? c.sla.hoursInclude.toFixed(2) : '',
                resLbl
            ].map(esc).join(','));
        });
        const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'evaluasi_sla_' + new Date().toISOString().slice(0,10) + '.csv';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    ['inVolume','inAgents','inAht','inEscRate','chkSegment','chkCanned','chkLifo','chkSeverity'].forEach(id => {
        document.getElementById(id).addEventListener('input', runSimulation);
        document.getElementById(id).addEventListener('change', runSimulation);
    });

    document.getElementById('simResetBtn').addEventListener('click', () => {
        document.getElementById('inVolume').value = 1800;
        document.getElementById('inAgents').value = 12;
        document.getElementById('inAht').value = 6.5;
        document.getElementById('inEscRate').value = 18;
        document.getElementById('chkSegment').checked = true;
        document.getElementById('chkCanned').checked = true;
        document.getElementById('chkLifo').checked = true;
        document.getElementById('chkSeverity').checked = false;
        runSimulation();
    });

    injectProStyles();
    injectD1Controls();
    relocateSlaFiltersToPage();
    ensureAgentNavigationAndSection();
    setupSharedSubcategoryFilter();
    initHourSelectors();
    renderZeroReports();
    runSimulation();
    renderHistoricalTable();
    loadFromD1();
})();
