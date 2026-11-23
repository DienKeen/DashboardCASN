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
    let currentScopedRows = [];
    let isDark = true;
    let lastCapturedBlob = null;
    let adminPin = sessionStorage.getItem(PIN_STORAGE_KEY) || '';
    let statusTimer = null;

    function injectProStyles(){
        if(document.getElementById('casnProUiStyle')) return;
        const css = `
            /* Sticky & Single-Row Clean Top Navbar */
            .sb-topnav {
                position: sticky !important;
                top: 0;
                z-index: 1035;
                min-height: 52px;
                padding: 0.35rem 0.9rem !important;
                border-bottom: 1px solid rgba(148, 163, 184, 0.14);
                backdrop-filter: blur(10px);
            }
            .sb-topnav .navbar-brand {
                font-size: 1rem !important;
                letter-spacing: -0.01em;
                white-space: nowrap;
            }
            #navControlsWrap {
                display: flex !important;
                align-items: center !important;
                flex-wrap: nowrap !important;
                gap: 0.4rem !important;
                margin-left: auto !important;
            }
            #navControlsWrap .btn,
            #navControlsWrap .form-select {
                font-size: 0.76rem !important;
                line-height: 1.25 !important;
                padding: 0.28rem 0.58rem !important;
                border-radius: 6px !important;
                white-space: nowrap !important;
                height: 30px !important;
                display: inline-flex;
                align-items: center;
            }
            #navControlsWrap .form-select {
                padding-right: 1.65rem !important;
            }
            #adminControlsGroup {
                display: inline-flex;
                align-items: center;
                gap: 0.3rem;
                padding: 2px 4px;
                border-radius: 7px;
                background: rgba(245, 158, 11, 0.08);
                border: 1px solid rgba(245, 158, 11, 0.28);
            }
            #adminControlsGroup .btn,
            #adminControlsGroup .form-select {
                height: 25px !important;
                padding: 0.18rem 0.5rem !important;
                font-size: 0.73rem !important;
            }
            #adminControlsGroup .form-select {
                padding-right: 1.5rem !important;
            }
            .nav-sep {
                width: 1px;
                height: 18px;
                background: rgba(148, 163, 184, 0.22);
                margin: 0 2px;
            }

            /* Page Header & Metadata Pill */
            #pageHeading {
                font-size: 1.5rem !important;
                font-weight: 700 !important;
                letter-spacing: -0.02em;
            }
            #metaBadge {
                font-size: 0.75rem !important;
                font-weight: 600 !important;
                padding: 0.38rem 0.75rem !important;
                border-radius: 999px !important;
                white-space: nowrap !important;
                background: rgba(59, 130, 246, 0.14) !important;
                color: #93c5fd !important;
                border: 1px solid rgba(59, 130, 246, 0.3) !important;
            }
            html:not(.dark-mode) #metaBadge {
                background: #eff6ff !important;
                color: #1d4ed8 !important;
                border-color: #bfdbfe !important;
            }

            /* Slim Toast-Style Status Alert */
            #statusAlert {
                font-size: 0.79rem !important;
                padding: 0.45rem 0.85rem !important;
                border-radius: 8px !important;
                margin-bottom: 0.85rem !important;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 0.5rem;
                transition: opacity 0.25s ease;
            }
            html.dark-mode #statusAlert.alert-info {
                background: rgba(30, 41, 59, 0.85) !important;
                color: #cbd5e1 !important;
                border: 1px solid rgba(148, 163, 184, 0.2) !important;
            }
            html.dark-mode #statusAlert.alert-success {
                background: rgba(16, 185, 129, 0.14) !important;
                color: #6ee7b7 !important;
                border: 1px solid rgba(16, 185, 129, 0.32) !important;
            }
            html.dark-mode #statusAlert.alert-warning {
                background: rgba(245, 158, 11, 0.14) !important;
                color: #fcd34d !important;
                border: 1px solid rgba(245, 158, 11, 0.32) !important;
            }
            html.dark-mode #statusAlert.alert-danger {
                background: rgba(239, 68, 68, 0.15) !important;
                color: #fca5a5 !important;
                border: 1px solid rgba(239, 68, 68, 0.35) !important;
            }

            /* Clean Single-Line Filter Toolbar */
            #sharedDailyControls {
                border-radius: 10px !important;
                margin-bottom: 1rem !important;
            }
            #sharedDailyControls .card-body {
                display: flex !important;
                flex-wrap: nowrap !important;
                align-items: center !important;
                justify-content: flex-start !important;
                gap: 0.5rem 0.75rem !important;
                padding: 0.55rem 0.85rem !important;
                overflow-x: auto;
            }
            #sharedDailyControls label,
            #sharedDailyControls .fw-bold,
            #sharedDailyControls span {
                font-size: 0.73rem !important;
                letter-spacing: 0.02em;
                white-space: nowrap !important;
            }
            #sharedDailyControls .form-select {
                font-size: 0.76rem !important;
                padding: 0.22rem 1.65rem 0.22rem 0.5rem !important;
                height: 29px !important;
                border-radius: 6px !important;
            }
            #dailySourceBadge {
                white-space: nowrap !important;
                font-size: 0.72rem !important;
                font-weight: 600 !important;
                padding: 0.25rem 0.65rem !important;
                border-radius: 999px !important;
                background: rgba(14, 165, 233, 0.12);
                color: #7dd3fc;
                border: 1px solid rgba(14, 165, 233, 0.26);
                margin-left: auto;
            }
            html:not(.dark-mode) #dailySourceBadge {
                background: #f0f9ff;
                color: #0369a1;
                border-color: #bae6fd;
            }

            /* Hero Metric Strip Cards */
            .casn-kpi-card {
                border-radius: 10px !important;
                border: 1px solid rgba(148, 163, 184, 0.16) !important;
                background: linear-gradient(145deg, rgba(30, 41, 59, 0.75), rgba(15, 23, 42, 0.9)) !important;
                transition: transform 0.15s ease, border-color 0.15s ease;
            }
            html:not(.dark-mode) .casn-kpi-card {
                background: linear-gradient(145deg, #ffffff, #f8fafc) !important;
                border-color: #e2e8f0 !important;
            }
            .casn-kpi-card:hover {
                transform: translateY(-1px);
                border-color: rgba(59, 130, 246, 0.45) !important;
            }
            .casn-kpi-label {
                font-size: 0.71rem;
                font-weight: 700;
                letter-spacing: 0.04em;
                text-transform: uppercase;
                opacity: 0.78;
            }
            .casn-kpi-val {
                font-size: 1.45rem;
                font-weight: 800;
                line-height: 1.15;
                font-variant-numeric: tabular-nums;
            }
            .casn-kpi-sub {
                font-size: 0.72rem;
                opacity: 0.8;
            }

            /* Card Polish & Equal Height Alignment */
            .card {
                border-radius: 10px !important;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.14);
            }
            .card-header {
                font-size: 0.84rem !important;
                font-weight: 600 !important;
                padding: 0.6rem 0.9rem !important;
                letter-spacing: -0.01em;
            }
            .row > [class*="col-"] > .card {
                height: calc(100% - 1rem);
                margin-bottom: 1rem !important;
            }

            /* Compact Zero-Cutoff Summary Tables */
            .report-tbl {
                width: 100% !important;
                table-layout: auto !important;
                font-size: 0.74rem !important;
                border-collapse: collapse;
            }
            .report-tbl th,
            .report-tbl td {
                padding: 0.42rem 0.4rem !important;
                font-variant-numeric: tabular-nums;
                vertical-align: middle !important;
            }
            .report-tbl th {
                font-size: 0.69rem !important;
                font-weight: 700 !important;
                white-space: nowrap !important;
            }
            .report-tbl td.row-title {
                font-weight: 600 !important;
                white-space: nowrap !important;
                text-align: left !important;
                padding-left: 0.55rem !important;
            }
            .report-tbl td.big-num {
                font-size: 0.82rem !important;
                font-weight: 700 !important;
                text-align: center !important;
            }
            .report-tbl td.num {
                font-size: 0.75rem !important;
                text-align: right !important;
                padding-right: 0.55rem !important;
            }
            .top5-row {
                background: rgba(59, 130, 246, 0.06);
            }
            .top5-pill {
                display: inline-block;
                font-size: 0.62rem;
                font-weight: 700;
                padding: 1px 5px;
                border-radius: 4px;
                background: rgba(59, 130, 246, 0.2);
                color: #93c5fd;
                margin-right: 4px;
            }
            html:not(.dark-mode) .top5-pill {
                background: #dbeafe;
                color: #1d4ed8;
            }
            .sla-tbl {
                font-size: 0.78rem !important;
            }
            .sla-tbl th,
            .sla-tbl td {
                padding: 0.45rem 0.55rem !important;
                font-variant-numeric: tabular-nums;
            }

            /* Sidebar Polish */
            #sidenavAccordion .nav-link {
                font-size: 0.83rem !important;
                padding: 0.55rem 0.9rem !important;
                border-left: 3px solid transparent;
                transition: all 0.15s ease;
            }
            #sidenavAccordion .nav-link.active {
                border-left-color: #3b82f6 !important;
                background: rgba(59, 130, 246, 0.14) !important;
                font-weight: 600 !important;
            }
        `;
        const styleEl = document.createElement('style');
        styleEl.id = 'casnProUiStyle';
        styleEl.textContent = css;
        document.head.appendChild(styleEl);
    }

    function simplifyScopeControl(){
        const scopeSel = document.getElementById('dailyCasnScope');
        if(!scopeSel) return;

        // Sembunyikan dropdown scope agar tidak membingungkan, karena tabel otomatis menampilkan CASN & All Produk
        scopeSel.style.display = 'none';
        const lblByFor = document.querySelector('label[for="dailyCasnScope"]');
        if(lblByFor) lblByFor.style.display = 'none';
        const prevEl = scopeSel.previousElementSibling;
        if(prevEl && (prevEl.tagName === 'LABEL' || prevEl.tagName === 'SPAN') && !prevEl.querySelector('select')){
            prevEl.style.display = 'none';
        }

        if(!document.getElementById('casnDefinitionPill')){
            const pill = document.createElement('span');
            pill.id = 'casnDefinitionPill';
            pill.className = 'badge bg-primary bg-opacity-25 text-info border border-info border-opacity-25';
            pill.innerHTML = '<i class="fas fa-layer-group me-1"></i>CASN (Produk E-Meterai) & All Produk';
            scopeSel.parentElement.insertBefore(pill, scopeSel);
        }
    }

    // CASN adalah layanan yang menggunakan produk E-Meterai dengan kategori/detail CASN atau SSCASN
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

    function splitStackedTopCard(dailyTbodyId, mtdTbodyId, dailyTitle, mtdTitle){
        const dailyTbl = document.getElementById(dailyTbodyId)?.closest('table');
        const mtdTbl = document.getElementById(mtdTbodyId)?.closest('table');
        if(!dailyTbl || !mtdTbl) return [null, null];

        const cardA = document.createElement('div');
        cardA.className = 'card';
        cardA.innerHTML = '<div class="card-header"><i class="fas fa-list-ol me-1 text-primary"></i> ' + dailyTitle + '</div><div class="card-body p-2"><div class="table-responsive"></div></div>';
        cardA.querySelector('.table-responsive').appendChild(dailyTbl);

        const cardB = document.createElement('div');
        cardB.className = 'card';
        cardB.innerHTML = '<div class="card-header"><i class="fas fa-list-ol me-1 text-primary"></i> ' + mtdTitle + '</div><div class="card-body p-2"><div class="table-responsive"></div></div>';
        cardB.querySelector('.table-responsive').appendChild(mtdTbl);

        return [cardA, cardB];
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
                    'TOP 10 All Interaction — Semua Produk (Daily)',
                    'TOP 10 All Interaction — Semua Produk (Month to Date)'
                );
            }

            Array.from(secDaily.children).forEach(el => { el.style.display = 'none'; });

            const grid = document.createElement('div');
            grid.id = 'dailyNoChartGrid';

            const kpiRow = document.createElement('div');
            kpiRow.id = 'dailyKpiStrip';
            kpiRow.className = 'row g-3 mb-1';
            grid.appendChild(kpiRow);

            const makeRow = (cols) => {
                const row = document.createElement('div');
                row.className = 'row g-3';
                cols.forEach(({ cls, el }) => {
                    if(!el) return;
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
                    'TOP 10 All Ticket — Semua Produk (Daily)',
                    'TOP 10 All Ticket — Semua Produk (Month to Date)'
                );
            }

            Array.from(secTkt.children).forEach(el => { el.style.display = 'none'; });

            const grid = document.createElement('div');
            grid.id = 'tktNoChartGrid';

            const tktKpiRow = document.createElement('div');
            tktKpiRow.id = 'tktKpiStrip';
            tktKpiRow.className = 'row g-3 mb-1';
            grid.appendChild(tktKpiRow);

            const makeRow = (cols) => {
                const row = document.createElement('div');
                row.className = 'row g-3';
                cols.forEach(({ cls, el }) => {
                    if(!el) return;
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

    function renderDailyKpiCards(sDailyCasn, sMtdCasn, sDailyAll, sMtdAll){
        const el = document.getElementById('dailyKpiStrip');
        if(!el) return;
        const fcrRate = sDailyCasn.total ? ((sDailyCasn.fcr / sDailyCasn.total) * 100).toFixed(1) + '%' : '0.0%';
        const nfcrRate = sDailyCasn.total ? ((sDailyCasn.nfcr / sDailyCasn.total) * 100).toFixed(1) + '%' : '0.0%';
        const cards = [
            {
                label: 'Interaksi CASN (Daily)',
                val: sDailyCasn.total.toLocaleString('id-ID'),
                sub: 'FCR: ' + sDailyCasn.fcr.toLocaleString('id-ID') + ' (' + fcrRate + ') · N-FCR: ' + sDailyCasn.nfcr.toLocaleString('id-ID') + ' (' + nfcrRate + ')',
                accent: 'border-start border-4 border-primary'
            },
            {
                label: 'Akumulasi CASN (MTD)',
                val: sMtdCasn.total.toLocaleString('id-ID'),
                sub: 'FCR: ' + sMtdCasn.fcr.toLocaleString('id-ID') + ' · N-FCR: ' + sMtdCasn.nfcr.toLocaleString('id-ID'),
                accent: 'border-start border-4 border-info'
            },
            {
                label: 'All Interaksi Semua Produk (Daily)',
                val: sDailyAll.total.toLocaleString('id-ID'),
                sub: 'FCR: ' + sDailyAll.fcr.toLocaleString('id-ID') + ' · N-FCR: ' + sDailyAll.nfcr.toLocaleString('id-ID'),
                accent: 'border-start border-4 border-success'
            },
            {
                label: 'All Interaksi Semua Produk (MTD)',
                val: sMtdAll.total.toLocaleString('id-ID'),
                sub: 'FCR: ' + sMtdAll.fcr.toLocaleString('id-ID') + ' · N-FCR: ' + sMtdAll.nfcr.toLocaleString('id-ID'),
                accent: 'border-start border-4 border-warning'
            }
        ];
        el.innerHTML = cards.map(c =>
            '<div class="col-xl-3 col-md-6">' +
              '<div class="card casn-kpi-card ' + c.accent + '">' +
                '<div class="card-body py-2 px-3">' +
                  '<div class="casn-kpi-label mb-1">' + c.label + '</div>' +
                  '<div class="casn-kpi-val mb-1">' + c.val + '</div>' +
                  '<div class="casn-kpi-sub">' + c.sub + '</div>' +
                '</div>' +
              '</div>' +
            '</div>'
        ).join('');
    }

    function renderTicketingKpiCards(sDailyCasn, sMtdCasn, sMtdAll, activeCasnQueue, activeCasnPending){
        const el = document.getElementById('tktKpiStrip');
        if(!el) return;
        const queueDisplay = activeCasnQueue >= 1000
            ? '1.000+ <span class="fs-6 text-danger">(' + activeCasnQueue.toLocaleString('id-ID') + ')</span>'
            : activeCasnQueue.toLocaleString('id-ID');
        const cards = [
            {
                label: 'Tiket CASN Created (MTD)',
                val: sMtdCasn.created.toLocaleString('id-ID'),
                sub: 'Daily CASN: ' + sDailyCasn.created.toLocaleString('id-ID') + ' · All Produk MTD: ' + sMtdAll.created.toLocaleString('id-ID'),
                accent: 'border-start border-4 border-primary'
            },
            {
                label: 'Tiket CASN Resolved (MTD)',
                val: sMtdCasn.resolved.toLocaleString('id-ID'),
                sub: 'Daily CASN: ' + sDailyCasn.resolved.toLocaleString('id-ID') + ' · All Produk MTD: ' + sMtdAll.resolved.toLocaleString('id-ID'),
                accent: 'border-start border-4 border-success'
            },
            {
                label: 'Tiket CASN Outstanding (MTD)',
                val: sMtdCasn.outstanding.toLocaleString('id-ID'),
                sub: 'Pending MTD: ' + sMtdCasn.pending.toLocaleString('id-ID') + ' · All Produk MTD: ' + sMtdAll.outstanding.toLocaleString('id-ID'),
                accent: 'border-start border-4 border-warning'
            },
            {
                label: 'Antrian Tiket Helpdesk SSCASN',
                val: queueDisplay,
                sub: 'Antrian Aktif CASN (Pending: ' + activeCasnPending.toLocaleString('id-ID') + ')',
                accent: activeCasnQueue >= 1000 ? 'border-start border-4 border-danger' : 'border-start border-4 border-info'
            }
        ];
        el.innerHTML = cards.map(c =>
            '<div class="col-xl-3 col-md-6">' +
              '<div class="card casn-kpi-card ' + c.accent + '">' +
                '<div class="card-body py-2 px-3">' +
                  '<div class="casn-kpi-label mb-1">' + c.label + '</div>' +
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
        const iconMap = {
            info: 'fa-info-circle',
            success: 'fa-check-circle',
            warning: 'fa-exclamation-triangle',
            danger: 'fa-times-circle'
        };
        const icon = iconMap[type] || 'fa-info-circle';
        alertEl.style.display = 'flex';
        alertEl.style.opacity = '1';
        alertEl.className = 'alert alert-' + type;
        alertEl.innerHTML =
            '<span><i class="fas ' + icon + ' me-2"></i>' + message + '</span>' +
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
                setTimeout(() => { alertEl.style.display = 'none'; }, 260);
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
            roleBtn.className = unlocked ? 'btn btn-outline-warning btn-sm fw-semibold' : 'btn btn-outline-secondary btn-sm';
            roleBtn.innerHTML = unlocked
                ? '<i class="fas fa-shield-alt me-1"></i>Admin'
                : '<i class="fas fa-lock me-1"></i>Viewer';
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
                showStatus('info', 'Dashboard dikunci ke Mode Viewer (Read-Only).', 4500);
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
                showStatus('success', 'Akses Admin aktif. Fitur Upload CSV/Excel & Reset D1 terbuka.', 5000);
                return true;
            } else {
                showStatus('danger', 'PIN Admin tidak sesuai. Akses tetap dalam Mode Viewer.', 5000);
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
            uploadLbl.innerHTML = '<i class="fas fa-upload me-1"></i>Upload';
            uploadLbl.title = 'Upload file CSV / Excel ke Cloudflare D1';
        }
        if(slaBtn){
            slaBtn.innerHTML = '<i class="fas fa-sliders-h me-1"></i>Internal (Excl. Pending)';
        }
        if(themeBtn){
            themeBtn.innerHTML = '<i class="fas fa-moon me-1"></i>Gelap';
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
            '<option value="replace">Mode: Replace</option>' +
            '<option value="upsert">Mode: Upsert</option>';

        const clearBtn = document.createElement('button');
        clearBtn.id = 'clearD1Btn';
        clearBtn.type = 'button';
        clearBtn.className = 'btn btn-outline-danger btn-sm';
        clearBtn.title = 'Kosongkan seluruh data di Cloudflare D1';
        clearBtn.innerHTML = '<i class="fas fa-trash-alt me-1"></i>Reset';
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
                document.getElementById('metaBadge').textContent = 'Cloudflare D1 · 0 interaksi (0 N-FCR)';
                document.getElementById('dailySourceBadge').textContent = 'Database Kosong · 0 interaksi · 0 tiket N-FCR';
                showStatus('warning', 'Data di Cloudflare D1 berhasil dikosongkan (0).', 5000);
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
        copyDashBtn.className = 'btn btn-success btn-sm fw-semibold';
        copyDashBtn.innerHTML = '<i class="fas fa-copy me-1"></i>Copy Report';
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
                '<span><i class="fas fa-headset me-1 text-info"></i> Distribusi Interaksi CASN (FCR / N-FCR) & Kecepatan Dispatch per Channel</span>' +
                '<span class="badge bg-secondary bg-opacity-25 text-info border border-info border-opacity-25">Target Dispatch N-FCR Email & WhatsApp: ≤ 15 Menit</span>' +
              '</div>' +
              '<div class="card-body p-2">' +
                '<div class="table-responsive">' +
                  '<table class="report-tbl">' +
                    '<thead><tr>' +
                      '<th class="text-start ps-2">Channel</th>' +
                      '<th class="text-end pe-2">Daily CASN</th>' +
                      '<th class="text-end pe-2">Porsi (%)</th>' +
                      '<th class="text-end pe-2">FCR</th>' +
                      '<th class="text-end pe-2">N-FCR</th>' +
                      '<th class="text-end pe-2">MTD CASN</th>' +
                      '<th class="text-end pe-2">Avg Dispatch N-FCR</th>' +
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
            '<div class="card mb-4 border-start border-4 border-danger" id="atRiskRadarCard">' +
              '<div class="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">' +
                '<span class="text-danger fw-bold"><i class="fas fa-exclamation-triangle me-1"></i> Radar Prioritas: Top 5 Tiket Aktif Mendekati / Melewati Breach SLA</span>' +
                '<button type="button" class="btn btn-outline-danger btn-sm py-1 px-2" id="copyAtRiskBtn">' +
                  '<i class="fas fa-copy me-1"></i> Copy ID Tiket Kritis' +
                '</button>' +
              '</div>' +
              '<div class="card-body p-2">' +
                '<div class="table-responsive">' +
                  '<table class="sla-tbl">' +
                    '<thead><tr>' +
                      '<th>Ticket ID</th>' +
                      '<th>Produk</th>' +
                      '<th>Subject / Kategori</th>' +
                      '<th>Priority</th>' +
                      '<th>Status</th>' +
                      '<th>Durasi Berjalan</th>' +
                      '<th>Countdown Sisa SLA</th>' +
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
            const lines = ['*ALERT MONITORING SLA TIKET AKTIF (PRIORITAS TINDAK LANJUT)*'];
            rows.forEach((tr, idx) => {
                lines.push(`${idx + 1}. *${tr.dataset.ticketId}* [${tr.dataset.priority}] - ${tr.dataset.subject} (${tr.dataset.countdown})`);
            });
            const text = lines.join('\n');
            const btn = document.getElementById('copyAtRiskBtn');
            try {
                await navigator.clipboard.writeText(text);
                btn.innerHTML = '<i class="fas fa-check me-1"></i> Tersalin!';
                setTimeout(() => { btn.innerHTML = '<i class="fas fa-copy me-1"></i> Copy ID Tiket Kritis'; }, 2000);
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
                    '<h6 class="modal-title fw-bold"><i class="fas fa-clipboard-check text-success me-2"></i>Report Monitoring SSCASN & Screenshot Dashboard</h6>' +
                    '<button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>' +
                  '</div>' +
                  '<div class="modal-body">' +
                    '<div id="copyModalToast" class="alert alert-success py-2 px-3 small mb-3"></div>' +
                    '<div class="row g-3">' +
                      '<div class="col-lg-5">' +
                        '<div class="d-flex justify-content-between align-items-center mb-1">' +
                          '<label class="small fw-bold text-uppercase text-info">Teks Report SSCASN (Siap Paste WA / Email)</label>' +
                          '<button type="button" class="btn btn-primary btn-sm py-0 px-2" id="modalCopyTextBtn"><i class="fas fa-copy me-1"></i> Copy Teks</button>' +
                        '</div>' +
                        '<textarea id="modalSummaryTextarea" class="form-control form-control-sm font-monospace bg-black text-light border-secondary" rows="20" style="font-size:0.78rem;line-height:1.45;"></textarea>' +
                      '</div>' +
                      '<div class="col-lg-7">' +
                        '<div class="d-flex justify-content-between align-items-center mb-1 flex-wrap gap-1">' +
                          '<label class="small fw-bold text-uppercase text-info">Preview Screenshot Dashboard</label>' +
                          '<div class="d-flex gap-1">' +
                            '<button type="button" class="btn btn-success btn-sm py-0 px-2" id="modalCopyImgBtn"><i class="fas fa-image me-1"></i> Copy Gambar Dashboard</button>' +
                            '<button type="button" class="btn btn-outline-light btn-sm py-0 px-2" id="modalDownloadImgBtn"><i class="fas fa-download me-1"></i> Download PNG</button>' +
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
                toast.textContent = 'Teks report berhasil disalin ke clipboard!';
            } catch (e) {
                document.getElementById('modalSummaryTextarea').select();
                document.execCommand('copy');
                toast.className = 'alert alert-success py-2 px-3 small mb-3';
                toast.textContent = 'Teks report berhasil disalin!';
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
                toast.textContent = 'Gambar dashboard berhasil disalin ke clipboard! Langsung Paste (Ctrl+V) di WhatsApp/Email.';
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
                `*Ringkasan All Produk (Semua Layanan)*`,
                `• All Interaksi Daily : 0 | MTD : 0`,
                `• All Tiket Created MTD : 0 | Resolved MTD : 0 | Outstanding MTD : 0`
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

        const dailyAllInt = intMeta.filter(x => x.dKey === activeDate && x.hour >= hStartNum && x.hour <= hEndNum);
        const dailyCasnInt = dailyAllInt.filter(x => isCasnRecord(x.r));
        const mtdAllInt = intMeta.filter(x => x.dKey.startsWith(monthPrefix) && x.dKey <= activeDate);
        const mtdCasnInt = mtdAllInt.filter(x => isCasnRecord(x.r));

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

        const dailyAllTkt = tktMeta.filter(x => x.dKey === activeDate && x.hour >= hStartNum && x.hour <= hEndNum);
        const dailyCasnTkt = dailyAllTkt.filter(x => isCasnRecord(x.r));
        const mtdAllTkt = tktMeta.filter(x => x.dKey.startsWith(monthPrefix) && x.dKey <= activeDate);
        const mtdCasnTkt = mtdAllTkt.filter(x => isCasnRecord(x.r));

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
            `*Ringkasan All Produk (Semua Layanan)*`,
            `• All Interaksi Daily : *${sDailyAllInt.total.toLocaleString('id-ID')}* (FCR: ${sDailyAllInt.fcr.toLocaleString('id-ID')} | N-FCR: ${sDailyAllInt.nfcr.toLocaleString('id-ID')})`,
            `• All Interaksi MTD : *${sMtdAllInt.total.toLocaleString('id-ID')}* (FCR: ${sMtdAllInt.fcr.toLocaleString('id-ID')} | N-FCR: ${sMtdAllInt.nfcr.toLocaleString('id-ID')})`,
            `• All Tiket MTD : Created *${sMtdAllTkt.created.toLocaleString('id-ID')}* | Resolved *${sMtdAllTkt.resolved.toLocaleString('id-ID')}* | Outstanding *${sMtdAllTkt.outstanding.toLocaleString('id-ID')}*`
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
        previewWrap.innerHTML = '<div class="text-muted small py-5"><i class="fas fa-spinner fa-spin me-2"></i>Mengambil gambar dashboard...</div>';

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
            ? 'Teks report SSCASN otomatis tersalin ke Clipboard! Tinggal Paste (Ctrl+V) di WhatsApp/Email.'
            : 'Report siap disalin. Klik "Copy Teks" atau "Copy Gambar Dashboard" di bawah.';

        try {
            const h2c = await ensureHtml2Canvas();
            const targetEl = document.querySelector('#layoutSidenav_content main .container-fluid') || document.body;
            const canvas = await h2c(targetEl, {
                backgroundColor: isDark ? '#07090d' : '#f4f6f9',
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
        header.forEach((h, i) => { const k = safeStr(h).toLowerCase(); if(k) colIndex[k] = i; });
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

            const rec = {
                id: id,
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
                document.getElementById('metaBadge').textContent = 'Cloudflare D1 · 0 interaksi (0 N-FCR)';
                document.getElementById('dailySourceBadge').textContent = 'Database Kosong · 0 interaksi · 0 tiket N-FCR';
                renderZeroReports();
                renderActual();
                return;
            }

            const escalatedOut = new Map();
            let skippedNotEscalated = 0;
            data.records.forEach(r => {
                if(!r || !r.id) return;
                if(!r.isEscalated) skippedNotEscalated++;
                else escalatedOut.set(r.id, r);
            });
            escalatedOut._skippedNotEscalated = skippedNotEscalated;

            allInteractions = data.records;
            ticketsMap = escalatedOut;
            document.getElementById('metaBadge').textContent =
                'Cloudflare D1 · ' + allInteractions.length.toLocaleString('id-ID') + ' interaksi (' + ticketsMap.size.toLocaleString('id-ID') + ' N-FCR)';
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
            const isTop5 = i < 5;
            const rowCls = isTop5 ? ' class="top5-row"' : '';
            const badge = isTop5 ? '<span class="top5-pill">TOP 5</span>' : '';
            return '<tr' + rowCls + '><td class="num fw-bold">' + (i + 1) + '</td><td>' + badge + it[0] + '</td><td class="num fw-semibold">' + it[1] + '</td><td class="num">' + it[2] + '</td></tr>';
        }).join('') || '<tr><td colspan="4" class="text-center text-muted py-2">Belum ada data pada interval ini (0).</td></tr>') +
        '<tr class="total-row"><td colspan="2" class="text-center">Jumlah</td><td class="num">' + sumTotal + '</td><td class="num">' + sumPct + '</td></tr>';
    }

    function renderZeroReports(){
        applyNoChartLayout();

        const zeroStats = { total: 0, fcr: 0, nfcr: 0, info: 0, kel: 0, perm: 0 };
        renderDailyKpiCards(zeroStats, zeroStats, zeroStats, zeroStats);

        const zeroTkt = { created: 0, resolved: 0, outstanding: 0, pending: 0 };
        renderTicketingKpiCards(zeroTkt, zeroTkt, zeroTkt, 0, 0);

        document.getElementById('dailyDateSelect').innerHTML = '<option value="EMPTY">Belum ada data (0)</option>';
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
            '<tr><td colspan="7" class="text-center text-muted py-3">Belum ada data interaksi (0). Silakan upload file CSV/Excel melalui menu Admin.</td></tr>';

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

        fillTopTable('topDailyTktCasnBody', [], 0, '0.00%');
        fillTopTable('topMtdTktCasnBody', [], 0, '0.00%');
        fillTopTable('topDailyTktAllBody', [], 0, '0.00%');
        fillTopTable('topMtdTktAllBody', [], 0, '0.00%');
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

        const dailyAllInt = intMeta.filter(x => x.dKey === activeDate && x.hour >= hStart && x.hour <= hEnd);
        const dailyCasnInt = dailyAllInt.filter(x => isCasnRecord(x.r));
        const mtdAllInt = intMeta.filter(x => x.dKey.startsWith(monthPrefix) && x.dKey <= activeDate);
        const mtdCasnInt = mtdAllInt.filter(x => isCasnRecord(x.r));

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

        renderDailyKpiCards(sDailyCasnInt, sMtdCasnInt, sDailyAllInt, sMtdAllInt);

        const intDenom = sDailyCasnInt.total || 1;
        document.getElementById('pctInfo').textContent = sDailyCasnInt.total ? ((sDailyCasnInt.info / intDenom) * 100).toFixed(2) + '%' : '0.00%';
        document.getElementById('pctKeluhan').textContent = sDailyCasnInt.total ? ((sDailyCasnInt.kel / intDenom) * 100).toFixed(2) + '%' : '0.00%';
        document.getElementById('pctPermintaan').textContent = sDailyCasnInt.total ? ((sDailyCasnInt.perm / intDenom) * 100).toFixed(2) + '%' : '0.00%';

        document.getElementById('dailySummaryBody').innerHTML = [
            { label: 'Daily Interaction CASN (E-Meterai)', ...sDailyCasnInt },
            { label: 'Month to Date CASN (E-Meterai)', ...sMtdCasnInt },
            { label: 'Daily All Interaction (Semua Produk)', ...sDailyAllInt },
            { label: 'MTD All Interaction (Semua Produk)', ...sMtdAllInt },
        ].map(r =>
            '<tr><td class="row-title">' + r.label + '</td><td class="big-num">' + r.total + '</td><td class="big-num text-success">' + r.fcr + '</td>' +
            '<td class="big-num text-warning">' + r.nfcr + '</td><td class="big-num">' + r.info + '</td><td class="big-num">' + r.kel + '</td><td class="big-num">' + r.perm + '</td></tr>'
        ).join('');

        const chMap = new Map();
        dailyCasnInt.forEach(x => {
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
        mtdCasnInt.forEach(x => {
            const ch = x.r.ch || '(Tanpa Channel)';
            if(!chMap.has(ch)) chMap.set(ch, { daily: 0, fcr: 0, nfcr: 0, mtd: 0, escHrs: [] });
            chMap.get(ch).mtd++;
        });
        const chTotalDaily = dailyCasnInt.length || 1;
        document.getElementById('channelBreakdownBody').innerHTML = Array.from(chMap.entries())
            .sort((a, b) => b[1].daily - a[1].daily)
            .map(([ch, g]) => {
                const pct = dailyCasnInt.length ? ((g.daily / chTotalDaily) * 100).toFixed(2) + '%' : '0.00%';
                let avgCell = '—';
                if(g.escHrs.length){
                    const avgMins = (g.escHrs.reduce((s, h) => s + h, 0) / g.escHrs.length) * 60;
                    const badgeCls = avgMins > 15 ? 'bg-danger' : 'bg-success';
                    avgCell = '<span class="badge ' + badgeCls + '">' + avgMins.toFixed(1) + ' Menit</span>';
                }
                return '<tr><td class="row-title">' + ch + '</td><td class="num fw-bold">' + g.daily + '</td><td class="num">' + pct + '</td>' +
                    '<td class="num text-success fw-semibold">' + g.fcr + '</td><td class="num text-warning fw-semibold">' + g.nfcr + '</td><td class="num">' + g.mtd + '</td><td class="num">' + avgCell + '</td></tr>';
            }).join('') || '<tr><td colspan="7" class="text-center text-muted py-3">Tidak ada data channel CASN pada interval ini.</td></tr>';

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

        const dailyAllTkt = tktMeta.filter(x => x.dKey === activeDate && x.hour >= hStart && x.hour <= hEnd);
        const dailyCasnTkt = dailyAllTkt.filter(x => isCasnRecord(x.r));
        const mtdAllTkt = tktMeta.filter(x => x.dKey.startsWith(monthPrefix) && x.dKey <= activeDate);
        const mtdCasnTkt = mtdAllTkt.filter(x => isCasnRecord(x.r));

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

        renderTicketingKpiCards(sDailyCasnTkt, sMtdCasnTkt, sMtdAllTkt, activeCasnQueueList.length, activeCasnPendingCount);

        document.getElementById('dailySourceBadge').textContent =
            'CASN MTD: ' + sMtdCasnInt.total.toLocaleString('id-ID') + ' · All MTD: ' + sMtdAllInt.total.toLocaleString('id-ID') +
            ' · Antrian CASN: ' + (activeCasnQueueList.length >= 1000 ? '1000+' : activeCasnQueueList.length.toLocaleString('id-ID'));

        document.getElementById('tktSummaryBody').innerHTML = [
            { label: 'Daily Ticket CASN (E-Meterai)', ...sDailyCasnTkt },
            { label: 'MTD Ticket CASN (E-Meterai)', ...sMtdCasnTkt },
            { label: 'Daily All Ticket (Semua Produk)', ...sDailyAllTkt },
            { label: 'MTD All Ticket (Semua Produk)', ...sMtdAllTkt },
        ].map(r =>
            '<tr><td class="row-title">' + r.label + '</td><td class="big-num">' + r.created + '</td><td class="big-num text-success">' + r.resolved + '</td>' +
            '<td class="big-num text-warning">' + r.outstanding + '</td><td class="big-num">' + r.pending + '</td></tr>'
        ).join('');

        buildTop10(dailyCasnTkt, 'topDailyTktCasnBody');
        buildTop10(mtdCasnTkt, 'topMtdTktCasnBody');
        buildTop10(dailyAllTkt, 'topDailyTktAllBody');
        buildTop10(mtdAllTkt, 'topMtdTktAllBody');
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
    }

    function renderActual(){
        ensureAtRiskRadarCard();
        applyNoChartLayout();
        if(ticketsMap.size === 0){
            document.getElementById('emptyState').style.display = '';
            document.getElementById('actualDashboard').style.display = 'none';
            return;
        }
        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('actualDashboard').style.display = '';
        document.getElementById('sidebarSlaFilters').style.display = '';
        document.getElementById('modeSubtitle').textContent = slaViewMode === 'include'
            ? 'Mode Aktif: User (Include Pending — Waktu Kalender Penuh)'
            : 'Mode Aktif: Internal (Exclude Pending — Performa Solver)';

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
            { label: 'Total Tiket', value: scoped.length, bg: 'bg-primary' },
            { label: 'SLA Compliance', value: compliancePct + (compliancePct !== '—' ? '%' : ''), bg: compliancePct !== '—' && +compliancePct >= 90 ? 'bg-success' : 'bg-warning text-dark' },
            { label: 'Breach (Selesai)', value: breachFinished, bg: breachFinished > 0 ? 'bg-danger' : 'bg-success' },
            { label: 'Outstanding Warning', value: outWarning, bg: outWarning > 0 ? 'bg-warning text-dark' : 'bg-success' },
            { label: 'Outstanding Breach', value: outBreach, bg: outBreach > 0 ? 'bg-danger' : 'bg-success' },
            { label: 'Reopen Rate', value: reopenPct + ' (' + reopenCount + ')', bg: reopenCount > 0 ? 'bg-warning text-dark' : 'bg-secondary' },
        ];
        document.getElementById('overviewCards').innerHTML = kpiCards.map(c =>
            '<div class="col-xl-2 col-md-4 col-sm-6"><div class="card ' + c.bg + ' text-white mb-4"><div class="card-body py-3"><div class="small text-uppercase fw-bold opacity-75">' + c.label + '</div><div class="h4 mb-0 fw-bold mt-1">' + c.value + '</div></div></div></div>'
        ).join('');

        const atRisk = outstanding
            .filter(c => c.sla.target !== null && c.sla.hours !== null)
            .map(c => ({ ...c, remHours: c.sla.target - c.sla.hours }))
            .sort((a, b) => a.remHours - b.remHours)
            .slice(0, 5);

        document.getElementById('atRiskRadarBody').innerHTML = atRisk.map(c => {
            const cdText = fmtCountdown(c.remHours);
            const badgeCls = c.remHours < 0 ? 'bg-danger' : (c.remHours <= 2 ? 'bg-warning text-dark' : 'bg-info text-dark');
            const subj = (c.rec.sj || c.rec.dsc || '—').replace(/"/g, '&quot;');
            return '<tr data-ticket-id="' + c.rec.id + '" data-priority="' + (c.rec.pr || '-') + '" data-subject="' + subj + '" data-countdown="' + cdText + '">' +
                '<td class="font-monospace fw-bold">' + c.rec.id + '</td>' +
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
            '<tr class="fw-bold table-active"><td>Total</td><td>' + totFin + '</td><td>' + totComp + '</td><td>' + totBreach + '</td><td>' + totPct + (totPct !== '—' ? '%' : '') + '</td><td>' + totMttr + '</td></tr>';

        const finWithHours = finished.filter(c => c.sla.hours !== null);
        document.getElementById('distTableHead').innerHTML = '<th>Priority</th>' + DURATION_BUCKETS.map(b => '<th>' + b.label + '</th>').join('') + '<th>Total</th>';
        const distRows = PRIORITY_ORDER.map(pr => {
            const items = finWithHours.filter(c => c.rec.pr === pr);
            const counts = DURATION_BUCKETS.map(b => items.filter(c => bucketOf(c.sla.hours) === b.label).length);
            return '<tr><td><strong>' + pr + '</strong></td>' + counts.map(n => '<td>' + n + '</td>').join('') + '<td><strong>' + items.length + '</strong></td></tr>';
        }).join('');
        const distTotals = DURATION_BUCKETS.map(b => finWithHours.filter(c => bucketOf(c.sla.hours) === b.label).length);
        document.getElementById('distTableBody').innerHTML = distRows +
            '<tr class="fw-bold table-active"><td>Total</td>' + distTotals.map(n => '<td>' + n + '</td>').join('') + '<td>' + finWithHours.length + '</td></tr>';

        const escItems = scoped.map(c => ({ rec: c.rec, esc: computeEscalation(c.rec) })).filter(x => x.esc.hours !== null);
        const escAman = escItems.filter(x => x.esc.result === 'aman').length;
        const escBreach = escItems.filter(x => x.esc.result === 'breach').length;
        const escAvgMin = escItems.length ? (escItems.reduce((s, x) => s + x.esc.hours, 0) / escItems.length) * 60 : null;
        document.getElementById('escalationCards').innerHTML = [
            { label: 'Rata-rata Dispatch N-FCR', value: escAvgMin !== null ? escAvgMin.toFixed(1) + ' mnt' : '—', cls: 'border-primary' },
            { label: 'Dalam Target (≤15m)', value: escAman, cls: 'border-success' },
            { label: 'Breach (>15m)', value: escBreach, cls: escBreach > 0 ? 'border-danger' : 'border-success' },
        ].map(c => '<div class="col-4"><div class="card border-start border-4 ' + c.cls + ' mb-0"><div class="card-body p-2"><div class="small text-muted">' + c.label + '</div><div class="h5 mb-0 fw-bold">' + c.value + '</div></div></div></div>').join('');

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
            return '<div class="mb-3"><h6 class="fw-bold text-primary mb-2">' + prod + '</h6>' +
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
            if(q && !(c.rec.id + ' ' + c.rec.sj + ' ' + c.rec.dsc + ' ' + c.rec.sc).toLowerCase().includes(q)) return false;
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
                const cls = c.sla.result === 'breach' ? 'bg-danger' : (c.sla.result === 'warning' ? 'bg-warning text-dark' : 'bg-success');
                const lbl = c.sla.result === 'breach' ? 'Outstanding — Breach' : (c.sla.result === 'warning' ? 'Outstanding — Warning' : 'Outstanding — Aman');
                badge = '<span class="badge ' + cls + '">' + lbl + '</span>';
            }
            const pendingBadge = c.sla.pendingExcluded ? '<span class="pending-tag" title="Pending ' + c.sla.pendingHours.toFixed(2) + ' jam">pending</span>' : '';
            const exclCls = c.sla.resultExclude === 'breach' ? ' class="text-danger fw-bold"' : '';
            const inclCls = c.sla.resultInclude === 'breach' ? ' class="text-danger fw-bold"' : '';
            return '<tr><td class="font-monospace fw-bold">' + c.rec.id + '</td><td>' + (c.rec.sc || '—') + '</td><td>' + (c.rec.sj || '—') + '</td><td>' + (c.rec.dsc || '—') + '</td>' +
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
            { label: 'Kapasitas Layan / Hari', value: capInteractions.toLocaleString('id-ID'), hint: 'AHT: ' + effAht.toFixed(1) + 'm · Backlog: ' + backlog, bg: backlog === 0 ? 'bg-success' : 'bg-warning text-dark' },
            { label: 'Proyeksi Tiket N-FCR', value: estTickets + ' tiket', hint: highSev ? 'Critical/High (8j–12j)' : 'Medium Standar (24j)', bg: 'bg-primary' },
            { label: 'Proyeksi SLA E-Meterai', value: emetSla.toFixed(1) + '%', hint: emetSla >= 85 ? 'Terkendali (≥85%)' : 'Risiko Breach Tinggi!', bg: emetSla >= 85 ? 'bg-success' : (emetSla >= 70 ? 'bg-warning text-dark' : 'bg-danger') },
            { label: 'Proyeksi SLA Perisai', value: perisaiSla.toFixed(1) + '%', hint: useSegment ? 'VIP Terisolasi' : 'Tercampur! Ideal: ' + recAgents + ' agt', bg: perisaiSla >= 90 ? 'bg-success' : 'bg-warning text-dark' }
        ].map(c =>
            '<div class="col-md-3 col-sm-6"><div class="card ' + c.bg + ' text-white mb-4"><div class="card-body py-3"><div class="small text-uppercase fw-bold opacity-75">' + c.label + '</div><div class="h4 mb-1 fw-bold">' + c.value + '</div><div class="small opacity-75">' + c.hint + '</div></div></div></div>'
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
            '<thead><tr><th class="text-start ps-2">Produk / Tahun</th>' + months.map(m => '<th class="text-end pe-2">' + m + '</th>').join('') + '</tr></thead>' +
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
        document.getElementById('sharedDailyControls').style.display = (target === 'daily' || target === 'ticketing') ? '' : 'none';
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
                allInteractions = parsed.interactions;
                ticketsMap = parsed.escalated;
            } else {
                const mergedInt = new Map(allInteractions.map(r => [r.id, r]));
                parsed.interactions.forEach(r => mergedInt.set(r.id, r));
                allInteractions = Array.from(mergedInt.values());
                parsed.escalated.forEach((rec, id) => ticketsMap.set(id, rec));
            }

            document.getElementById('dailyHourStart').value = '0';
            document.getElementById('dailyHourEnd').value = '23';
            renderDailyAndTicketingFromUploaded();
            renderActual();

            showStatus('info', 'Menyimpan ' + parsed.interactions.length.toLocaleString('id-ID') + ' baris ke Cloudflare D1 (' + syncMode + ')...');
            try {
                await syncToD1(parsed.interactions, syncMode);
                document.getElementById('metaBadge').textContent =
                    'Cloudflare D1 · ' + allInteractions.length.toLocaleString('id-ID') + ' interaksi (' + ticketsMap.size.toLocaleString('id-ID') + ' N-FCR)';
                showStatus('success', 'Berhasil memuat & menyimpan ' + parsed.interactions.length.toLocaleString('id-ID') + ' interaksi ke Cloudflare D1.', 6000);
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
        });
    });

    document.getElementById('slaViewToggle').addEventListener('click', () => {
        slaViewMode = slaViewMode === 'exclude' ? 'include' : 'exclude';
        document.getElementById('slaViewToggle').innerHTML = slaViewMode === 'include'
            ? '<i class="fas fa-sliders-h me-1"></i>User (Incl. Pending)'
            : '<i class="fas fa-sliders-h me-1"></i>Internal (Excl. Pending)';
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
            document.getElementById('themeToggleBtn').innerHTML = '<i class="fas fa-moon me-1"></i>Gelap';
        } else {
            document.documentElement.classList.remove('dark-mode');
            document.documentElement.removeAttribute('data-bs-theme');
            sidenav.classList.remove('sb-sidenav-dark');
            sidenav.classList.add('sb-sidenav-light');
            document.getElementById('themeToggleBtn').innerHTML = '<i class="fas fa-sun me-1"></i>Terang';
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
    simplifyScopeControl();
    initHourSelectors();
    renderZeroReports();
    runSimulation();
    renderHistoricalTable();
    loadFromD1();
})();
