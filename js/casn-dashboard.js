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

    let achievedChart = null, top10Chart = null, histChart = null;
    let dailyChart1 = null, dailyChart2 = null, dailyChart3 = null, dailyChart4 = null;
    let tktChart1 = null, tktChart2 = null, tktChart3 = null, tktChart4 = null;

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
                flex-wrap: wrap !important;
                align-items: center !important;
                justify-content: space-between !important;
                gap: 0.65rem 1rem !important;
                padding: 0.6rem 0.9rem !important;
            }
            #sharedDailyControls label,
            #sharedDailyControls .fw-bold,
            #sharedDailyControls span {
                font-size: 0.74rem !important;
                letter-spacing: 0.02em;
                white-space: nowrap !important;
            }
            #sharedDailyControls .form-select {
                font-size: 0.78rem !important;
                padding: 0.24rem 1.75rem 0.24rem 0.55rem !important;
                height: 30px !important;
                border-radius: 6px !important;
            }
            #dailySourceBadge {
                white-space: nowrap !important;
                font-size: 0.74rem !important;
                font-weight: 600 !important;
                padding: 0.28rem 0.72rem !important;
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
                height: calc(100% - 1.25rem);
                margin-bottom: 1.25rem !important;
            }

            /* Compact Zero-Cutoff Summary Tables */
            .report-tbl {
                width: 100% !important;
                table-layout: auto !important;
                font-size: 0.75rem !important;
                border-collapse: collapse;
            }
            .report-tbl th,
            .report-tbl td {
                padding: 0.4rem 0.32rem !important;
                font-variant-numeric: tabular-nums;
                vertical-align: middle !important;
            }
            .report-tbl th {
                font-size: 0.7rem !important;
                font-weight: 700 !important;
                white-space: nowrap !important;
                letter-spacing: 0.01em;
            }
            .report-tbl td.row-title {
                font-weight: 600 !important;
                white-space: nowrap !important;
                text-align: left !important;
                padding-left: 0.45rem !important;
            }
            .report-tbl td.big-num {
                font-size: 0.82rem !important;
                font-weight: 700 !important;
                text-align: center !important;
            }
            .report-tbl td.num {
                font-size: 0.76rem !important;
                text-align: right !important;
                padding-right: 0.45rem !important;
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
            if(!confirm('Hapus seluruh data tiket tersimpan di Cloudflare D1?')) return;
            try {
                const res = await fetch('/api/tickets', {
                    method: 'DELETE',
                    headers: { 'X-Admin-Pin': adminPin }
                });
                const json = await res.json().catch(() => ({}));
                if(!res.ok || !json.ok) throw new Error(json.reason || ('HTTP ' + res.status));
                allInteractions = [];
                ticketsMap = new Map();
                document.getElementById('metaBadge').textContent = 'Mode Preview Data Referensi CASN';
                document.getElementById('dailySourceBadge').textContent = 'Data Referensi CASN (Upload CSV/Excel untuk data real)';
                showStatus('warning', 'Data di Cloudflare D1 berhasil dikosongkan.', 5000);
                renderReferenceReports();
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
        copyDashBtn.title = 'Salin teks summary & tangkapan layar dashboard';
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
                ths[0].textContent = 'Interaksi CASN';
                ths[1].textContent = 'Total';
                ths[2].textContent = 'Escalated';
                ths[3].textContent = 'Not Esc.';
                ths[3].title = 'Not Escalated';
                ths[4].textContent = 'Informasi';
                ths[5].textContent = 'Keluhan';
                ths[6].textContent = 'Permintaan';
            }
        }
    }

    function getChartCommonOptions(){
        const tickColor = isDark ? '#94a3b8' : '#475569';
        const gridColor = isDark ? 'rgba(148, 163, 184, 0.11)' : 'rgba(15, 23, 42, 0.08)';
        return {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: {
                    ticks: { color: tickColor, font: { size: 10.5 } },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: tickColor, font: { size: 10.5 }, precision: 0 },
                    grid: { color: gridColor }
                }
            },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: tickColor,
                        boxWidth: 10,
                        boxHeight: 10,
                        padding: 12,
                        font: { size: 10.5 }
                    }
                }
            }
        };
    }

    function ensureChannelSummaryCard(){
        const secDaily = document.getElementById('sec-daily');
        if(!secDaily || document.getElementById('channelBreakdownCard')) return;
        const cardHtml =
            '<div class="card mb-4" id="channelBreakdownCard">' +
              '<div class="card-header d-flex justify-content-between align-items-center flex-wrap gap-2">' +
                '<span><i class="fas fa-headset me-1 text-info"></i> Distribusi Interaksi & Kecepatan Eskalasi per Channel</span>' +
                '<span class="badge bg-secondary bg-opacity-25 text-info border border-info border-opacity-25">Target Eskalasi Email & WhatsApp: ≤ 15 Menit</span>' +
              '</div>' +
              '<div class="card-body p-2">' +
                '<div class="table-responsive">' +
                  '<table class="report-tbl">' +
                    '<thead><tr>' +
                      '<th class="text-start ps-2">Channel</th>' +
                      '<th class="text-end pe-2">Daily Interaksi</th>' +
                      '<th class="text-end pe-2">Porsi (%)</th>' +
                      '<th class="text-end pe-2">Escalated</th>' +
                      '<th class="text-end pe-2">Not Esc.</th>' +
                      '<th class="text-end pe-2">MTD Interaksi</th>' +
                      '<th class="text-end pe-2">Avg Kecepatan Eskalasi</th>' +
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
                    '<h6 class="modal-title fw-bold"><i class="fas fa-clipboard-check text-success me-2"></i>Summary Laporan & Screenshot Dashboard</h6>' +
                    '<button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>' +
                  '</div>' +
                  '<div class="modal-body">' +
                    '<div id="copyModalToast" class="alert alert-success py-2 px-3 small mb-3"></div>' +
                    '<div class="row g-3">' +
                      '<div class="col-lg-5">' +
                        '<div class="d-flex justify-content-between align-items-center mb-1">' +
                          '<label class="small fw-bold text-uppercase text-info">Teks Summary (Siap Paste WA / Email)</label>' +
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
                toast.textContent = 'Teks summary berhasil disalin ke clipboard!';
            } catch (e) {
                document.getElementById('modalSummaryTextarea').select();
                document.execCommand('copy');
                toast.className = 'alert alert-success py-2 px-3 small mb-3';
                toast.textContent = 'Teks summary berhasil disalin!';
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
            a.download = 'dashboard_casn_' + new Date().toISOString().slice(0, 10) + '.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    function buildDashboardSummaryText(){
        const selDateEl = document.getElementById('dailyDateSelect');
        const dateLabel = selDateEl && selDateEl.selectedOptions[0]
            ? selDateEl.selectedOptions[0].textContent
            : (document.getElementById('tblDateVal').textContent || '-');
        const hStart = document.getElementById('dailyHourStart').value || '0';
        const hEnd = document.getElementById('dailyHourEnd').value || '23';
        const scopeVal = document.getElementById('dailyCasnScope').value;
        const scopeLabel = scopeVal === 'ALL' ? 'Semua Produk' : 'E-Meterai / CASN';

        if(!allInteractions.length){
            const intRows = Array.from(document.querySelectorAll('#dailySummaryBody tr')).map(tr =>
                Array.from(tr.children).map(td => td.textContent.trim())
            );
            const tktRows = Array.from(document.querySelectorAll('#tktSummaryBody tr')).map(tr =>
                Array.from(tr.children).map(td => td.textContent.trim())
            );
            const topInt = Array.from(document.querySelectorAll('#topDailyCasnBody tr:not(.total-row)')).slice(0, 3).map(tr => {
                const c = tr.children;
                return c.length >= 4 ? `  ${c[0].textContent.trim()}. ${c[1].textContent.trim()} (${c[2].textContent.trim()} | ${c[3].textContent.trim()})` : '';
            }).filter(Boolean);
            const topTkt = Array.from(document.querySelectorAll('#topDailyTktCasnBody tr:not(.total-row)')).slice(0, 3).map(tr => {
                const c = tr.children;
                return c.length >= 4 ? `  ${c[0].textContent.trim()}. ${c[1].textContent.trim()} (${c[2].textContent.trim()} | ${c[3].textContent.trim()})` : '';
            }).filter(Boolean);

            const dInt = intRows[0] || ['-', '0', '0', '0', '0', '0', '0'];
            const mInt = intRows[1] || ['-', '0', '0', '0', '0', '0', '0'];
            const dTkt = tktRows[0] || ['-', '0', '0', '0', '0'];
            const mTkt = tktRows[1] || ['-', '0', '0', '0', '0'];

            return [
                `*REPORT DAILY OPERATIONAL HELPDESK CASN*`,
                `Tanggal : ${dateLabel}`,
                `Interval : ${hStart}:00 - ${hEnd}:59 WIB`,
                `Scope : ${scopeLabel} (Data Referensi)`,
                ``,
                `*1. RINGKASAN INTERAKSI*`,
                `• Daily Interaction : *${dInt[1]}* (Escalated: ${dInt[2]} | Not Escalated: ${dInt[3]})`,
                `  - Komposisi: Informasi ${document.getElementById('pctInfo').textContent} (${dInt[4]}), Keluhan ${document.getElementById('pctKeluhan').textContent} (${dInt[5]}), Permintaan ${document.getElementById('pctPermintaan').textContent} (${dInt[6]})`,
                `• MTD Interaction : *${mInt[1]}* (Escalated: ${mInt[2]} | Not Escalated: ${mInt[3]})`,
                `• Top 3 Interaksi Harian:`,
                ...(topInt.length ? topInt : ['  - Belum ada data']),
                ``,
                `*2. RINGKASAN TICKETING (ESKALASI)*`,
                `• Daily Ticket Created : *${dTkt[1]}* (Resolved: ${dTkt[2]} | Outstanding: ${dTkt[3]} | Pending: ${dTkt[4]})`,
                `• MTD Ticket Created : *${mTkt[1]}* (Resolved: ${mTkt[2]} | Outstanding: ${mTkt[3]} | Pending: ${mTkt[4]})`,
                `• Top 3 Tiket Eskalasi Harian:`,
                ...(topTkt.length ? topTkt : ['  - Belum ada data'])
            ].join('\n');
        }

        const activeDate = selDateEl.value;
        const monthPrefix = activeDate.slice(0, 7);
        const hStartNum = parseInt(hStart, 10);
        const hEndNum = parseInt(hEnd, 10);

        const isCasn = (r) => {
            if(scopeVal === 'ALL') return true;
            const sc = (r.sc || '').toLowerCase();
            const dsc = (r.dsc || '').toLowerCase();
            return sc === 'e-meterai' || dsc.includes('casn') || dsc.includes('sscasn') || dsc.includes('e-meterai');
        };

        const intMeta = allInteractions.map(r => {
            const iso = r.doStart || r.doOpen;
            if(!iso) return null;
            const d = new Date(iso);
            const dKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            return { r, dKey, hour: d.getHours() };
        }).filter(Boolean);

        const dailyInt = intMeta.filter(x => x.dKey === activeDate && x.hour >= hStartNum && x.hour <= hEndNum && isCasn(x.r));
        const mtdInt = intMeta.filter(x => x.dKey.startsWith(monthPrefix) && x.dKey <= activeDate && isCasn(x.r));

        const sumInt = (list) => {
            let esc = 0, notEsc = 0, info = 0, kel = 0, perm = 0;
            list.forEach(x => {
                if(x.r.isEscalated) esc++; else notEsc++;
                const mc = (x.r.mc || '').toLowerCase();
                if(mc === 'informasi') info++;
                else if(mc === 'keluhan') kel++;
                else if(mc === 'permintaan') perm++;
            });
            return { total: list.length, esc, notEsc, info, kel, perm };
        };

        const sDailyInt = sumInt(dailyInt);
        const sMtdInt = sumInt(mtdInt);
        const denomInt = sDailyInt.total || 1;
        const pctInfo = sDailyInt.total ? ((sDailyInt.info / denomInt) * 100).toFixed(2) + '%' : '0.00%';
        const pctKel = sDailyInt.total ? ((sDailyInt.kel / denomInt) * 100).toFixed(2) + '%' : '0.00%';
        const pctPerm = sDailyInt.total ? ((sDailyInt.perm / denomInt) * 100).toFixed(2) + '%' : '0.00%';

        const chCounts = new Map();
        dailyInt.forEach(x => {
            const ch = x.r.ch || '(Tanpa Channel)';
            chCounts.set(ch, (chCounts.get(ch) || 0) + 1);
        });
        const chSummary = Array.from(chCounts.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([ch, cnt]) => `${ch}: ${cnt.toLocaleString('id-ID')}`)
            .join(' | ') || '-';

        const getTop3Lines = (list) => {
            const counts = new Map();
            list.forEach(x => {
                const k = x.r.dsc || x.r.sc || '(Lainnya)';
                counts.set(k, (counts.get(k) || 0) + 1);
            });
            const sorted = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
            if(!sorted.length) return ['  - Tidak ada data pada interval ini'];
            return sorted.map((it, idx) => {
                const pct = list.length ? ((it[1] / list.length) * 100).toFixed(2) + '%' : '0.00%';
                return `  ${idx + 1}. ${it[0]} (${it[1].toLocaleString('id-ID')} | ${pct})`;
            });
        };

        const tktMeta = Array.from(ticketsMap.values()).map(r => {
            const iso = r.doOpen || r.doStart;
            if(!iso) return null;
            const d = new Date(iso);
            const dKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            return { r, dKey, hour: d.getHours() };
        }).filter(Boolean);

        const dailyTkt = tktMeta.filter(x => x.dKey === activeDate && x.hour >= hStartNum && x.hour <= hEndNum && isCasn(x.r));
        const mtdTkt = tktMeta.filter(x => x.dKey.startsWith(monthPrefix) && x.dKey <= activeDate && isCasn(x.r));

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

        const sDailyTkt = sumTkt(dailyTkt);
        const sMtdTkt = sumTkt(mtdTkt);

        const now = Date.now();
        const scopeTickets = Array.from(ticketsMap.values()).filter(r => isCasn(r));
        const slaList = scopeTickets.map(r => computeSla(r, now));
        const slaFin = slaList.filter(s => s.finished);
        const slaComp = slaFin.filter(s => s.result === 'aman').length;
        const slaBreach = slaFin.filter(s => s.result === 'breach').length;
        const slaOut = slaList.filter(s => !s.finished).length;
        const reopenCount = scopeTickets.filter(r => (r.st || '').toLowerCase().includes('reopen')).length;
        const reopenRate = scopeTickets.length ? ((reopenCount / scopeTickets.length) * 100).toFixed(1) + '%' : '0.0%';
        const slaPct = slaFin.length ? ((slaComp / slaFin.length) * 100).toFixed(1) + '%' : '—';
        const modeLabel = slaViewMode === 'include' ? 'User / Include Pending' : 'Internal / Exclude Pending';

        return [
            `*REPORT DAILY OPERATIONAL HELPDESK CASN*`,
            `Tanggal : ${dateLabel}`,
            `Interval : ${hStart}:00 - ${hEnd}:59 WIB`,
            `Scope : ${scopeLabel}`,
            ``,
            `*1. RINGKASAN INTERAKSI*`,
            `• Daily Interaction : *${sDailyInt.total.toLocaleString('id-ID')}* (Escalated: ${sDailyInt.esc.toLocaleString('id-ID')} | Not Escalated: ${sDailyInt.notEsc.toLocaleString('id-ID')})`,
            `  - Channel Daily : ${chSummary}`,
            `  - Komposisi: Informasi ${pctInfo} (${sDailyInt.info}), Keluhan ${pctKel} (${sDailyInt.kel}), Permintaan ${pctPerm} (${sDailyInt.perm})`,
            `• MTD Interaction : *${sMtdInt.total.toLocaleString('id-ID')}* (Escalated: ${sMtdInt.esc.toLocaleString('id-ID')} | Not Escalated: ${sMtdInt.notEsc.toLocaleString('id-ID')})`,
            `• Top 3 Interaksi Harian:`,
            ...getTop3Lines(dailyInt),
            ``,
            `*2. RINGKASAN TICKETING (ESKALASI)*`,
            `• Daily Ticket Created : *${sDailyTkt.created.toLocaleString('id-ID')}* (Resolved: ${sDailyTkt.resolved.toLocaleString('id-ID')} | Outstanding: ${sDailyTkt.outstanding.toLocaleString('id-ID')} | Pending: ${sDailyTkt.pending.toLocaleString('id-ID')})`,
            `• MTD Ticket Created : *${sMtdTkt.created.toLocaleString('id-ID')}* (Resolved: ${sMtdTkt.resolved.toLocaleString('id-ID')} | Outstanding: ${sMtdTkt.outstanding.toLocaleString('id-ID')} | Pending: ${sMtdTkt.pending.toLocaleString('id-ID')})`,
            `• Top 3 Tiket Eskalasi Harian:`,
            ...getTop3Lines(dailyTkt),
            ``,
            `*3. PERFORMA SLA & KUALITAS (${modeLabel})*`,
            `• Total Tiket Scope : *${slaList.length.toLocaleString('id-ID')}* (Selesai: ${slaFin.length.toLocaleString('id-ID')} | Outstanding: ${slaOut.toLocaleString('id-ID')})`,
            `• SLA Compliance : *${slaPct}* (Achieved: ${slaComp.toLocaleString('id-ID')} | Breach: ${slaBreach.toLocaleString('id-ID')} | Reopen Rate: ${reopenRate})`
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
            ? 'Teks summary otomatis tersalin ke Clipboard! Tinggal Paste (Ctrl+V) di WhatsApp/Email.'
            : 'Summary siap disalin. Klik "Copy Teks" atau "Copy Gambar Dashboard" di bawah.';

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
            previewWrap.innerHTML = '<div class="text-warning small py-4">Gagal merender screenshot otomatis (' + err.message + '), namun teks summary tetap siap digunakan.</div>';
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
            if(!data.ok || !Array.isArray(data.records) || data.records.length === 0) return;

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
                'Cloudflare D1 · ' + allInteractions.length.toLocaleString('id-ID') + ' interaksi (' + ticketsMap.size.toLocaleString('id-ID') + ' eskalasi)';
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
        document.getElementById(tbodyId).innerHTML = (items.map((it, i) =>
            '<tr><td class="num">' + (i + 1) + '</td><td>' + it[0] + '</td><td class="num">' + it[1] + '</td><td class="num">' + it[2] + '</td></tr>'
        ).join('') || '<tr><td colspan="4" class="text-center text-muted">Tidak ada data pada interval ini.</td></tr>') +
        '<tr class="total-row"><td colspan="2" class="text-center">Jumlah</td><td class="num">' + sumTotal + '</td><td class="num">' + sumPct + '</td></tr>';
    }

    function renderReferenceReports(){
        ensureChannelSummaryCard();
        polishSummaryTableHeaders();
        document.getElementById('dailyDateSelect').innerHTML = '<option value="REF">September 6, 2024 (Referensi)</option>';
        document.getElementById('dailyHourStart').value = '0';
        document.getElementById('dailyHourEnd').value = '23';

        const palette = ['#3B82F6', '#F97316', '#94A3B8', '#FACC15', '#38BDF8'];
        const hours = Array.from({ length: 24 }, (_, h) => h + ':00');
        const daysRef = ['19-Aug','21-Aug','23-Aug','25-Aug','27-Aug','29-Aug','31-Aug','2-Sep','4-Sep','6-Sep'];
        const commonOpts = getChartCommonOptions();

        document.getElementById('tblDateVal').textContent = 'September 6, 2024';
        document.getElementById('tblHourStart').textContent = '0:00';
        document.getElementById('tblHourEnd').textContent = '11:00';
        document.getElementById('pctInfo').textContent = '7.48%';
        document.getElementById('pctKeluhan').textContent = '80.52%';
        document.getElementById('pctPermintaan').textContent = '11.91%';

        document.getElementById('dailySummaryBody').innerHTML = [
            { label: 'Daily Interaction CASN', total: 1083, esc: 118, notEsc: 965, info: 81, kel: 872, perm: 129 },
            { label: 'Month to Date', total: 14144, esc: 1214, notEsc: 12930, info: 1773, kel: 12071, perm: 273 },
            { label: 'Daily All Interaction', total: 2092, esc: 139, notEsc: 1953, info: 680, kel: 1211, perm: 147 },
            { label: 'MTD All Interaction', total: 35639, esc: 1872, notEsc: 33767, info: 14205, kel: 20346, perm: 608 },
        ].map(r =>
            '<tr><td class="row-title">' + r.label + '</td><td class="big-num">' + r.total + '</td><td class="big-num">' + r.esc + '</td>' +
            '<td class="big-num">' + r.notEsc + '</td><td class="big-num">' + r.info + '</td><td class="big-num">' + r.kel + '</td><td class="big-num">' + r.perm + '</td></tr>'
        ).join('');

        document.getElementById('channelBreakdownBody').innerHTML = [
            { ch: 'WhatsApp', daily: 782, pct: '72.21%', esc: 76, notEsc: 706, mtd: 10240, avgEsc: '8.4 Menit' },
            { ch: 'Email', daily: 268, pct: '24.75%', esc: 38, notEsc: 230, mtd: 3490, avgEsc: '11.2 Menit' },
            { ch: 'Web / Live Chat', daily: 33, pct: '3.05%', esc: 4, notEsc: 29, mtd: 414, avgEsc: '6.9 Menit' }
        ].map(r =>
            '<tr><td class="row-title">' + r.ch + '</td><td class="num">' + r.daily + '</td><td class="num">' + r.pct + '</td>' +
            '<td class="num">' + r.esc + '</td><td class="num">' + r.notEsc + '</td><td class="num">' + r.mtd + '</td><td class="num">' + r.avgEsc + '</td></tr>'
        ).join('');

        fillTopTable('topDailyCasnBody', [
            ['CASN METEL-Pembayaran berhasil, kuota tidak bertambah', 424, '44.54%'],
            ['CASN-Pembayaran berhasil, kuota tidak bertambah', 219, '23.00%'],
            ['CASN-Failed Upload Document PDF', 70, '7.35%'],
            ['CASN-Panduan penggunaan e-Meterai', 46, '4.83%'],
            ['CASN METEL-Tidak bisa Reset Password', 27, '2.84%'],
            ['CASN METEL-Error Download File', 25, '2.63%'],
            ['CASN-Pengembalian Kuota', 20, '2.10%'],
            ['CASN-Informasi seputar E-Meterai SSCASN', 16, '1.68%'],
            ['CASN METEL-Failed Login E-Meterai', 16, '1.68%'],
            ['CASN-Error Download File', 11, '1.16%'],
        ], 952, '91.81%');

        fillTopTable('topMtdCasnBody', [
            ['CASN-Pembayaran berhasil, kuota tidak bertambah', 4898, '36.81%'],
            ['CASN METEL-Pembayaran berhasil, kuota tidak bertambah', 2703, '20.32%'],
            ['CASN-Failed Upload Document PDF', 1375, '10.33%'],
            ['CASN-Informasi seputar E-Meterai SSCASN', 772, '5.80%'],
            ['CASN-Panduan penggunaan e-Meterai', 540, '4.06%'],
            ['CASN-Failed Login E-Meterai', 385, '2.89%'],
            ['CASN-Pembubuhan Gagal, Kuota berkurang', 287, '2.16%'],
            ['CASN-Tanya Progress', 240, '1.80%'],
            ['CASN METEL-Failed Login E-Meterai', 222, '1.67%'],
            ['CASN METEL-Tidak bisa Reset Password', 208, '1.56%'],
        ], 13305, '87.41%');

        fillTopTable('topDailyAllBody', [
            ['CASN METEL-Pembayaran berhasil, kuota tidak bertambah', 424, '25.98%'],
            ['Deskripsi dan Panduan Produk E-Meterai', 393, '24.08%'],
            ['CASN-Pembayaran berhasil, kuota tidak bertambah', 219, '13.42%'],
            ['Deskripsi Produk', 112, '6.86%'],
            ['Maintenance Layanan E-Meterai', 107, '6.56%'],
            ['CASN-Failed Upload Document PDF', 70, '4.29%'],
            ['CASN-Panduan penggunaan e-Meterai', 46, '2.82%'],
            ['CASN-Panduan penggunaan e-Meterai', 46, '2.82%'],
            ['CASN METEL-Tidak bisa Reset Password', 27, '1.65%'],
            ['CASN METEL-Error Download File', 25, '1.53%'],
        ], 1632, '90.01%');

        fillTopTable('topMtdAllBody', [
            ['Deskripsi dan Panduan Produk E-Meterai', 8619, '27.07%'],
            ['CASN-Pembayaran berhasil, kuota tidak bertambah', 4898, '15.38%'],
            ['CASN METEL-Pembayaran berhasil, kuota tidak bertambah', 2703, '8.49%'],
            ['Deskripsi Produk', 1503, '4.72%'],
            ['Maintenance Layanan E-Meterai', 1437, '4.51%'],
            ['CASN-Failed Upload Document PDF', 1375, '4.32%'],
            ['CASN-Informasi seputar E-Meterai SSCASN', 772, '2.42%'],
            ['CASN-Informasi seputar E-Meterai SSCASN', 772, '2.42%'],
            ['CASN-Panduan penggunaan e-Meterai', 540, '1.70%'],
            ['CASN-Panduan penggunaan e-Meterai', 540, '1.70%'],
        ], 31843, '72.73%');

        if(dailyChart1) dailyChart1.destroy();
        dailyChart1 = new Chart(document.getElementById('dailyChart1'), {
            type: 'bar',
            data: {
                labels: hours,
                datasets: [
                    { label: 'CASN METEL-Pembayaran berhasil', data: [4,5,6,8,12,18,35,88,122,110,95,82,0,0,0,0,0,0,0,0,0,0,0,0], backgroundColor: palette[0], borderRadius: 3 },
                    { label: 'CASN-Pembayaran berhasil', data: [2,3,4,5,8,14,26,52,74,68,58,49,0,0,0,0,0,0,0,0,0,0,0,0], backgroundColor: palette[1], borderRadius: 3 },
                    { label: 'CASN-Failed Upload Document PDF', data: [1,1,1,2,3,5,9,16,22,19,15,12,0,0,0,0,0,0,0,0,0,0,0,0], backgroundColor: palette[2], borderRadius: 3 },
                    { label: 'CASN-Panduan penggunaan e-Meterai', data: [0,1,1,1,2,3,6,11,15,13,10,8,0,0,0,0,0,0,0,0,0,0,0,0], backgroundColor: palette[3], borderRadius: 3 },
                    { label: 'CASN METEL-Tidak bisa Reset Password', data: [0,0,1,1,1,2,4,7,9,8,6,5,0,0,0,0,0,0,0,0,0,0,0,0], backgroundColor: palette[4], borderRadius: 3 },
                ]
            },
            options: commonOpts
        });

        if(dailyChart2) dailyChart2.destroy();
        dailyChart2 = new Chart(document.getElementById('dailyChart2'), {
            type: 'bar',
            data: {
                labels: daysRef,
                datasets: [
                    { label: 'CASN-Pembayaran berhasil', data: [40,65,90,110,145,180,220,580,1120,980], backgroundColor: palette[0], borderRadius: 3 },
                    { label: 'CASN METEL-Pembayaran berhasil', data: [20,35,50,75,95,120,160,340,680,610], backgroundColor: palette[1], borderRadius: 3 },
                    { label: 'CASN-Failed Upload Document PDF', data: [15,22,30,45,60,80,110,190,340,290], backgroundColor: palette[2], borderRadius: 3 },
                    { label: 'CASN-Informasi seputar E-Meterai', data: [10,18,25,32,45,55,75,130,210,185], backgroundColor: palette[3], borderRadius: 3 },
                    { label: 'CASN-Panduan penggunaan e-Meterai', data: [8,12,18,24,30,42,58,95,160,140], backgroundColor: palette[4], borderRadius: 3 },
                ]
            },
            options: commonOpts
        });

        if(dailyChart3) dailyChart3.destroy();
        dailyChart3 = new Chart(document.getElementById('dailyChart3'), {
            type: 'line',
            data: {
                labels: hours,
                datasets: [
                    { label: 'CASN METEL-Pembayaran berhasil', data: [4,5,6,8,12,18,35,88,122,110,95,82,0,0,0,0,0,0,0,0,0,0,0,0], borderColor: palette[0], tension: 0.3, fill: false },
                    { label: 'Deskripsi dan Panduan Produk E-Meterai', data: [12,10,8,11,15,24,42,68,85,79,66,54,0,0,0,0,0,0,0,0,0,0,0,0], borderColor: palette[1], tension: 0.3, fill: false },
                    { label: 'CASN-Pembayaran berhasil', data: [2,3,4,5,8,14,26,52,74,68,58,49,0,0,0,0,0,0,0,0,0,0,0,0], borderColor: palette[2], tension: 0.3, fill: false },
                    { label: 'Deskripsi Produk', data: [3,4,3,5,7,11,18,25,31,28,22,19,0,0,0,0,0,0,0,0,0,0,0,0], borderColor: palette[3], tension: 0.3, fill: false },
                    { label: 'Maintenance Layanan E-Meterai', data: [2,2,3,4,6,9,15,22,29,26,21,17,0,0,0,0,0,0,0,0,0,0,0,0], borderColor: palette[4], tension: 0.3, fill: false },
                ]
            },
            options: commonOpts
        });

        if(dailyChart4) dailyChart4.destroy();
        dailyChart4 = new Chart(document.getElementById('dailyChart4'), {
            type: 'bar',
            data: {
                labels: daysRef,
                datasets: [
                    { label: 'Deskripsi dan Panduan Produk E-Meterai', data: [180,240,310,390,480,590,740,1280,2150,1890], backgroundColor: palette[0], borderRadius: 3 },
                    { label: 'CASN-Pembayaran berhasil', data: [40,65,90,110,145,180,220,580,1120,980], backgroundColor: palette[1], borderRadius: 3 },
                    { label: 'CASN METEL-Pembayaran berhasil', data: [20,35,50,75,95,120,160,340,680,610], backgroundColor: palette[2], borderRadius: 3 },
                    { label: 'Deskripsi Produk', data: [45,60,75,95,120,145,180,260,410,370], backgroundColor: palette[3], borderRadius: 3 },
                    { label: 'Maintenance Layanan E-Meterai', data: [35,48,62,80,105,130,165,240,390,350], backgroundColor: palette[4], borderRadius: 3 },
                ]
            },
            options: commonOpts
        });

        document.getElementById('tktDateVal').textContent = 'September 6, 2024';
        document.getElementById('tktHourStart').textContent = '0:00';
        document.getElementById('tktHourEnd').textContent = '23:59';

        document.getElementById('tktSummaryBody').innerHTML = [
            { label: 'Daily Ticket CASN', created: 119, resolved: 7, outstanding: 112, pending: 0 },
            { label: 'MTD Ticket CASN', created: 1214, resolved: 310, outstanding: 904, pending: 0 },
            { label: 'Daily All Ticket', created: 140, resolved: 8, outstanding: 132, pending: 0 },
            { label: 'MTD All Ticket', created: 1872, resolved: 534, outstanding: 1338, pending: 0 },
        ].map(r =>
            '<tr><td class="row-title">' + r.label + '</td><td class="big-num">' + r.created + '</td><td class="big-num">' + r.resolved + '</td>' +
            '<td class="big-num">' + r.outstanding + '</td><td class="big-num">' + r.pending + '</td></tr>'
        ).join('');

        fillTopTable('topDailyTktCasnBody', [
            ['CASN METEL-Pembayaran berhasil, kuota tidak bertambah', 53, '58.24%'],
            ['CASN-Pembayaran berhasil, kuota tidak bertambah', 24, '26.37%'],
            ['CASN METEL-Tidak bisa Reset Password', 5, '5.49%'],
            ['CASN METEL-Error Download File', 3, '3.30%'],
            ['CASN-Tidak bisa Reset Password', 2, '2.20%'],
            ['CASN METEL-Failed Login E-Meterai', 1, '1.10%'],
            ['CASN-Error Download File', 1, '1.10%'],
            ['(CASN_E-METERAI) ERROR DOWNLOAD FILE (EKS-PORTAL)', 1, '1.10%'],
            ['CASN METEL-Error Kuota', 1, '1.10%'],
            ['CASN METEL-Informasi seputar E-Meterai SSCASN', 0, '0.00%'],
        ], 91, '100.00%');

        fillTopTable('topMtdTktCasnBody', [
            ['CASN METEL-Pembayaran berhasil, kuota tidak bertambah', 509, '44.65%'],
            ['CASN-Pembayaran berhasil, kuota tidak bertambah', 504, '44.21%'],
            ['CASN METEL-Tidak bisa Reset Password', 47, '4.12%'],
            ['CASN-Tidak bisa Reset Password', 20, '1.75%'],
            ['CASN METEL-Error Download File', 16, '1.40%'],
            ['CASN-Error Download File', 11, '0.96%'],
            ['CASN METEL-Failed Login E-Meterai', 7, '0.61%'],
            ['CASN-Pembubuhan Gagal, Kuota berkurang', 5, '0.44%'],
            ['CASN METEL-Pembubuhan Gagal, Kuota berkurang', 5, '0.44%'],
            ['CASN-Pengembalian Kuota', 4, '0.35%'],
        ], 1140, '98.95%');

        fillTopTable('topDailyTktAllBody', [
            ['Pembayaran Berhasil Kuota Tidak Bertambah', 10, '11.90%'],
            ['Error Download File', 2, '2.38%'],
            ['API-Error Generate SN', 1, '1.19%'],
            ['Pengembalian Kuota e-Meterai', 1, '1.19%'],
            ['Certificate Expired - Keterangan CA-19 (Renewal)', 1, '1.19%'],
            ['Tidak bisa membubuhkan tanda tangan', 1, '1.19%'],
            ['Mutasi Data Usage User', 1, '1.19%'],
            ['Failed Login', 1, '1.19%'],
            ['Gagal Upload Dokumen', 1, '1.19%'],
            ['OTP tidak terkirim', 1, '1.19%'],
        ], 84, '23.81%');

        fillTopTable('topMtdTktAllBody', [
            ['Pembayaran Berhasil Kuota Tidak Bertambah', 326, '50.78%'],
            ['Rekonsiliasi Data', 98, '15.26%'],
            ['Pengembalian Kuota e-Meterai', 63, '9.81%'],
            ['Mutasi Data Usage User', 19, '2.96%'],
            ['Error Download File', 17, '2.65%'],
            ['Error Kuota (kuota tidak sesuai/selisih)', 13, '2.02%'],
            ['API-Error Generate SN', 11, '1.71%'],
            ['Failed Login', 11, '1.71%'],
            ['Tidak bisa membubuhkan Tanda Tangan', 9, '1.40%'],
            ['Pembubuhan Gagal, Kuota berkurang', 9, '1.40%'],
        ], 642, '89.72%');

        if(tktChart1) tktChart1.destroy();
        tktChart1 = new Chart(document.getElementById('tktChart1'), {
            type: 'line',
            data: {
                labels: hours,
                datasets: [
                    { label: 'CASN METEL-Pembayaran berhasil', data: [0,0,1,0,0,0,2,8,19,14,9,0,0,0,0,0,0,0,0,0,0,0,0,0], borderColor: palette[0], tension: 0.3, fill: false },
                    { label: 'CASN-Pembayaran berhasil', data: [0,0,0,0,1,0,1,4,9,6,3,0,0,0,0,0,0,0,0,0,0,0,0,0], borderColor: palette[1], tension: 0.3, fill: false },
                    { label: 'CASN METEL-Tidak bisa Reset Password', data: [0,0,0,0,0,0,0,1,2,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0], borderColor: palette[2], tension: 0.3, fill: false },
                    { label: 'CASN METEL-Error Download File', data: [0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0], borderColor: palette[3], tension: 0.3, fill: false },
                    { label: 'CASN-Tidak bisa Reset Password', data: [0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0], borderColor: palette[4], tension: 0.3, fill: false },
                ]
            },
            options: commonOpts
        });

        if(tktChart2) tktChart2.destroy();
        tktChart2 = new Chart(document.getElementById('tktChart2'), {
            type: 'bar',
            data: {
                labels: daysRef,
                datasets: [
                    { label: 'CASN METEL-Pembayaran berhasil', data: [5,12,18,24,35,48,62,98,142,65], backgroundColor: palette[0], borderRadius: 3 },
                    { label: 'CASN-Pembayaran berhasil', data: [4,10,16,22,32,45,60,95,138,82], backgroundColor: palette[1], borderRadius: 3 },
                    { label: 'CASN METEL-Tidak bisa Reset Password', data: [1,2,3,4,5,6,8,10,8,0], backgroundColor: palette[2], borderRadius: 3 },
                    { label: 'CASN-Tidak bisa Reset Password', data: [0,1,1,2,2,3,4,4,3,0], backgroundColor: palette[3], borderRadius: 3 },
                    { label: 'CASN METEL-Error Download File', data: [0,1,1,1,2,2,3,3,3,0], backgroundColor: palette[4], borderRadius: 3 },
                ]
            },
            options: commonOpts
        });

        if(tktChart3) tktChart3.destroy();
        tktChart3 = new Chart(document.getElementById('tktChart3'), {
            type: 'line',
            data: {
                labels: hours,
                datasets: [
                    { label: 'Pembayaran Berhasil Kuota Tidak Bertambah', data: [0,0,0,0,0,0,0,1,4,3,2,0,0,0,0,0,0,0,0,0,0,0,0,0], borderColor: palette[0], tension: 0.3, fill: false },
                    { label: 'Error Download File', data: [0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0], borderColor: palette[1], tension: 0.3, fill: false },
                    { label: 'API-Error Generate SN', data: [0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0], borderColor: palette[2], tension: 0.3, fill: false },
                    { label: 'Pengembalian Kuota e-Meterai', data: [0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], borderColor: palette[3], tension: 0.3, fill: false },
                    { label: 'Certificate Expired - Keterangan CA-19', data: [0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0], borderColor: palette[4], tension: 0.3, fill: false },
                ]
            },
            options: commonOpts
        });

        if(tktChart4) tktChart4.destroy();
        tktChart4 = new Chart(document.getElementById('tktChart4'), {
            type: 'bar',
            data: {
                labels: daysRef,
                datasets: [
                    { label: 'Pembayaran Berhasil Kuota Tidak Bertambah', data: [12,24,38,54,75,98,132,245,380,210], backgroundColor: palette[0], borderRadius: 3 },
                    { label: 'Rekonsiliasi Data', data: [8,12,18,22,28,35,48,72,95,62], backgroundColor: palette[1], borderRadius: 3 },
                    { label: 'Pengembalian Kuota e-Meterai', data: [5,8,12,15,20,26,34,52,68,44], backgroundColor: palette[2], borderRadius: 3 },
                    { label: 'Mutasi Data Usage User', data: [2,3,5,7,9,11,14,20,25,18], backgroundColor: palette[3], borderRadius: 3 },
                    { label: 'Error Download File', data: [2,3,4,6,8,10,12,18,22,15], backgroundColor: palette[4], borderRadius: 3 },
                ]
            },
            options: commonOpts
        });
    }

    function renderDailyAndTicketingFromUploaded(){
        ensureChannelSummaryCard();
        polishSummaryTableHeaders();
        if(!allInteractions.length){ renderReferenceReports(); return; }

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
            const lbl = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
            return '<option value="' + dt + '">' + lbl + '</option>';
        }).join('');
        if(dates.includes(prevVal)) selDateEl.value = prevVal;
        else if(dates.length) selDateEl.value = dates[dates.length - 1];

        const activeDate = selDateEl.value;
        const hStart = parseInt(document.getElementById('dailyHourStart').value, 10);
        const hEnd = parseInt(document.getElementById('dailyHourEnd').value, 10);
        const casnScope = document.getElementById('dailyCasnScope').value;

        const [ay, am, ad] = activeDate.split('-').map(Number);
        const activeDateLabel = new Date(ay, am - 1, ad).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        const monthPrefix = activeDate.slice(0, 7);

        document.getElementById('tblDateVal').textContent = activeDateLabel;
        document.getElementById('tblHourStart').textContent = hStart + ':00';
        document.getElementById('tblHourEnd').textContent = hEnd + ':00';
        document.getElementById('chart1Title').textContent = 'Pergerakan TOP 5 Interaksi CASN — ' + activeDateLabel;

        document.getElementById('tktDateVal').textContent = activeDateLabel;
        document.getElementById('tktHourStart').textContent = hStart + ':00';
        document.getElementById('tktHourEnd').textContent = hEnd + ':59';
        document.getElementById('tktChart1Title').textContent = 'Pergerakan TOP 5 Tiket Eskalasi per Interval — ' + activeDateLabel;
        document.getElementById('dailySourceBadge').textContent = 'Data Aktual · ' + allInteractions.length.toLocaleString('id-ID') + ' interaksi · ' + ticketsMap.size.toLocaleString('id-ID') + ' tiket eskalasi';

        const isCasn = (r) => {
            if(casnScope === 'ALL') return true;
            const sc = (r.sc || '').toLowerCase();
            const dsc = (r.dsc || '').toLowerCase();
            return sc === 'e-meterai' || dsc.includes('casn') || dsc.includes('sscasn') || dsc.includes('e-meterai');
        };

        const palette = ['#3B82F6', '#F97316', '#94A3B8', '#FACC15', '#38BDF8'];
        const hours = Array.from({ length: 24 }, (_, h) => h + ':00');
        const mtdDates = dates.filter(dt => dt.startsWith(monthPrefix) && dt <= activeDate);
        const mtdDateLabels = mtdDates.map(dt => {
            const [y, m, d] = dt.split('-').map(Number);
            return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        });
        const commonOpts = getChartCommonOptions();

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
            return top10.slice(0, 5).map(x => x[0]);
        };

        const makeHourlySets = (list, topCats) => topCats.map((cat, idx) => ({
            label: cat,
            data: Array.from({ length: 24 }, (_, h) => list.filter(x => x.hour === h && (x.r.dsc || x.r.sc || '(Lainnya)') === cat).length),
            backgroundColor: palette[idx % palette.length],
            borderColor: palette[idx % palette.length],
            borderRadius: 3,
            barPercentage: 0.85,
            categoryPercentage: 0.8,
            tension: 0.3,
            fill: false
        }));

        const makeDailySets = (list, topCats) => topCats.map((cat, idx) => ({
            label: cat,
            data: mtdDates.map(dt => list.filter(x => x.dKey === dt && (x.r.dsc || x.r.sc || '(Lainnya)') === cat).length),
            backgroundColor: palette[idx % palette.length],
            borderRadius: 3
        }));

        const intMeta = allInteractions.map(r => {
            const iso = r.doStart || r.doOpen;
            if(!iso) return null;
            const d = new Date(iso);
            const dKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            return { r: r, dKey: dKey, hour: d.getHours() };
        }).filter(Boolean);

        const dailyAllInt = intMeta.filter(x => x.dKey === activeDate && x.hour >= hStart && x.hour <= hEnd);
        const dailyCasnInt = dailyAllInt.filter(x => isCasn(x.r));
        const mtdAllInt = intMeta.filter(x => x.dKey.startsWith(monthPrefix) && x.dKey <= activeDate);
        const mtdCasnInt = mtdAllInt.filter(x => isCasn(x.r));

        const summarizeInt = (list) => {
            let esc = 0, notEsc = 0, info = 0, kel = 0, perm = 0;
            list.forEach(x => {
                if(x.r.isEscalated) esc++; else notEsc++;
                const mc = (x.r.mc || '').toLowerCase();
                if(mc === 'informasi') info++;
                else if(mc === 'keluhan') kel++;
                else if(mc === 'permintaan') perm++;
            });
            return { total: list.length, esc, notEsc, info, kel, perm };
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
            { label: 'Daily Interaction CASN', ...sDailyCasnInt },
            { label: 'Month to Date', ...sMtdCasnInt },
            { label: 'Daily All Interaction', ...sDailyAllInt },
            { label: 'MTD All Interaction', ...sMtdAllInt },
        ].map(r =>
            '<tr><td class="row-title">' + r.label + '</td><td class="big-num">' + r.total + '</td><td class="big-num">' + r.esc + '</td>' +
            '<td class="big-num">' + r.notEsc + '</td><td class="big-num">' + r.info + '</td><td class="big-num">' + r.kel + '</td><td class="big-num">' + r.perm + '</td></tr>'
        ).join('');

        const chMap = new Map();
        dailyCasnInt.forEach(x => {
            const ch = x.r.ch || '(Tanpa Channel)';
            if(!chMap.has(ch)) chMap.set(ch, { daily: 0, esc: 0, notEsc: 0, mtd: 0, escHrs: [] });
            const g = chMap.get(ch);
            g.daily++;
            if(x.r.isEscalated){
                g.esc++;
                if(x.r.doOpen && x.r.doStart){
                    const hrs = (new Date(x.r.doOpen).getTime() - new Date(x.r.doStart).getTime()) / 3600000;
                    if(hrs >= 0) g.escHrs.push(hrs);
                }
            } else {
                g.notEsc++;
            }
        });
        mtdCasnInt.forEach(x => {
            const ch = x.r.ch || '(Tanpa Channel)';
            if(!chMap.has(ch)) chMap.set(ch, { daily: 0, esc: 0, notEsc: 0, mtd: 0, escHrs: [] });
            chMap.get(ch).mtd++;
        });
        const chTotalDaily = dailyCasnInt.length || 1;
        document.getElementById('channelBreakdownBody').innerHTML = Array.from(chMap.entries())
            .sort((a, b) => b[1].daily - a[1].daily)
            .map(([ch, g]) => {
                const pct = dailyCasnInt.length ? ((g.daily / chTotalDaily) * 100).toFixed(2) + '%' : '0.00%';
                const avgMin = g.escHrs.length
                    ? ((g.escHrs.reduce((s, h) => s + h, 0) / g.escHrs.length) * 60).toFixed(1) + ' Menit'
                    : '—';
                return '<tr><td class="row-title">' + ch + '</td><td class="num">' + g.daily + '</td><td class="num">' + pct + '</td>' +
                    '<td class="num">' + g.esc + '</td><td class="num">' + g.notEsc + '</td><td class="num">' + g.mtd + '</td><td class="num">' + avgMin + '</td></tr>';
            }).join('') || '<tr><td colspan="7" class="text-center text-muted py-3">Tidak ada data channel pada interval ini.</td></tr>';

        const top5DailyCasnInt = buildTop10(dailyCasnInt, 'topDailyCasnBody');
        const top5MtdCasnInt = buildTop10(mtdCasnInt, 'topMtdCasnBody');
        const top5DailyAllInt = buildTop10(dailyAllInt, 'topDailyAllBody');
        const top5MtdAllInt = buildTop10(mtdAllInt, 'topMtdAllBody');

        if(dailyChart1) dailyChart1.destroy();
        dailyChart1 = new Chart(document.getElementById('dailyChart1'), { type: 'bar', data: { labels: hours, datasets: makeHourlySets(dailyCasnInt, top5DailyCasnInt) }, options: commonOpts });
        if(dailyChart2) dailyChart2.destroy();
        dailyChart2 = new Chart(document.getElementById('dailyChart2'), { type: 'bar', data: { labels: mtdDateLabels, datasets: makeDailySets(mtdCasnInt, top5MtdCasnInt) }, options: commonOpts });
        if(dailyChart3) dailyChart3.destroy();
        dailyChart3 = new Chart(document.getElementById('dailyChart3'), { type: 'line', data: { labels: hours, datasets: makeHourlySets(dailyAllInt, top5DailyAllInt) }, options: commonOpts });
        if(dailyChart4) dailyChart4.destroy();
        dailyChart4 = new Chart(document.getElementById('dailyChart4'), { type: 'bar', data: { labels: mtdDateLabels, datasets: makeDailySets(mtdAllInt, top5MtdAllInt) }, options: commonOpts });

        const tktMeta = Array.from(ticketsMap.values()).map(r => {
            const iso = r.doOpen || r.doStart;
            if(!iso) return null;
            const d = new Date(iso);
            const dKey = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            return { r: r, dKey: dKey, hour: d.getHours() };
        }).filter(Boolean);

        const dailyAllTkt = tktMeta.filter(x => x.dKey === activeDate && x.hour >= hStart && x.hour <= hEnd);
        const dailyCasnTkt = dailyAllTkt.filter(x => isCasn(x.r));
        const mtdAllTkt = tktMeta.filter(x => x.dKey.startsWith(monthPrefix) && x.dKey <= activeDate);
        const mtdCasnTkt = mtdAllTkt.filter(x => isCasn(x.r));

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

        document.getElementById('tktSummaryBody').innerHTML = [
            { label: 'Daily Ticket CASN', ...summarizeTkt(dailyCasnTkt) },
            { label: 'MTD Ticket CASN', ...summarizeTkt(mtdCasnTkt) },
            { label: 'Daily All Ticket', ...summarizeTkt(dailyAllTkt) },
            { label: 'MTD All Ticket', ...summarizeTkt(mtdAllTkt) },
        ].map(r =>
            '<tr><td class="row-title">' + r.label + '</td><td class="big-num">' + r.created + '</td><td class="big-num">' + r.resolved + '</td>' +
            '<td class="big-num">' + r.outstanding + '</td><td class="big-num">' + r.pending + '</td></tr>'
        ).join('');

        const top5DailyCasnTkt = buildTop10(dailyCasnTkt, 'topDailyTktCasnBody');
        const top5MtdCasnTkt = buildTop10(mtdCasnTkt, 'topMtdTktCasnBody');
        const top5DailyAllTkt = buildTop10(dailyAllTkt, 'topDailyTktAllBody');
        const top5MtdAllTkt = buildTop10(mtdAllTkt, 'topMtdTktAllBody');

        if(tktChart1) tktChart1.destroy();
        tktChart1 = new Chart(document.getElementById('tktChart1'), { type: 'line', data: { labels: hours, datasets: makeHourlySets(dailyCasnTkt, top5DailyCasnTkt) }, options: commonOpts });
        if(tktChart2) tktChart2.destroy();
        tktChart2 = new Chart(document.getElementById('tktChart2'), { type: 'bar', data: { labels: mtdDateLabels, datasets: makeDailySets(mtdCasnTkt, top5MtdCasnTkt) }, options: commonOpts });
        if(tktChart3) tktChart3.destroy();
        tktChart3 = new Chart(document.getElementById('tktChart3'), { type: 'line', data: { labels: hours, datasets: makeHourlySets(dailyAllTkt, top5DailyAllTkt) }, options: commonOpts });
        if(tktChart4) tktChart4.destroy();
        tktChart4 = new Chart(document.getElementById('tktChart4'), { type: 'bar', data: { labels: mtdDateLabels, datasets: makeDailySets(mtdAllTkt, top5MtdAllTkt) }, options: commonOpts });
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

        const achData = PRIORITY_ORDER.map(pr => finished.filter(c => c.rec.pr === pr && c.sla.result === 'aman').length);
        const breachData = PRIORITY_ORDER.map(pr => finished.filter(c => c.rec.pr === pr && c.sla.result === 'breach').length);
        const chartTheme = getChartCommonOptions();
        if(achievedChart) achievedChart.destroy();
        achievedChart = new Chart(document.getElementById('achievedChart'), {
            type: 'bar',
            data: {
                labels: PRIORITY_ORDER,
                datasets: [
                    { label: 'Achieved', data: achData, backgroundColor: '#198754', borderRadius: 4 },
                    { label: 'Not Achieved (Breach)', data: breachData, backgroundColor: '#dc3545', borderRadius: 4 }
                ]
            },
            options: {
                ...chartTheme,
                onClick: (evt, els) => {
                    if(!els.length) return;
                    document.getElementById('ticketPriorityFilter').value = PRIORITY_ORDER[els[0].index];
                    document.getElementById('ticketStatusFilter').value = els[0].datasetIndex === 0 ? 'achieved' : 'not_achieved';
                    drawTicketTable();
                    document.getElementById('ticketListPanel').scrollIntoView({ behavior: 'smooth' });
                }
            }
        });

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

        const catCounts = new Map();
        scoped.forEach(c => {
            const lbl = (c.rec.mc || '-') + ' - ' + (c.rec.sc || '-') + ' - ' + (c.rec.dsc || '-');
            catCounts.set(lbl, (catCounts.get(lbl) || 0) + 1);
        });
        const top10 = Array.from(catCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
        if(top10Chart) top10Chart.destroy();
        top10Chart = new Chart(document.getElementById('top10Chart'), {
            type: 'bar',
            data: {
                labels: top10.map(x => x[0]),
                datasets: [{ label: 'Jumlah Tiket', data: top10.map(x => x[1]), backgroundColor: '#3b82f6', borderRadius: 4 }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { beginAtZero: true, ticks: chartTheme.scales.x.ticks, grid: chartTheme.scales.y.grid },
                    y: { ticks: chartTheme.scales.x.ticks, grid: { display: false } }
                }
            }
        });

        const escItems = scoped.map(c => ({ rec: c.rec, esc: computeEscalation(c.rec) })).filter(x => x.esc.hours !== null);
        const escAman = escItems.filter(x => x.esc.result === 'aman').length;
        const escBreach = escItems.filter(x => x.esc.result === 'breach').length;
        const escAvgMin = escItems.length ? (escItems.reduce((s, x) => s + x.esc.hours, 0) / escItems.length) * 60 : null;
        document.getElementById('escalationCards').innerHTML = [
            { label: 'Rata-rata Eskalasi', value: escAvgMin !== null ? escAvgMin.toFixed(1) + ' mnt' : '—', cls: 'border-primary' },
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
        }).join('') || '<p class="small text-muted mb-0">Tidak ada data eskalasi Email/WhatsApp.</p>';

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
            { label: 'Proyeksi Tiket Eskalasi', value: estTickets + ' tiket', hint: highSev ? 'Critical/High (8j–12j)' : 'Medium Standar (24j)', bg: 'bg-primary' },
            { label: 'Proyeksi SLA E-Meterai', value: emetSla.toFixed(1) + '%', hint: emetSla >= 85 ? 'Terkendali (≥85%)' : 'Risiko Breach Tinggi!', bg: emetSla >= 85 ? 'bg-success' : (emetSla >= 70 ? 'bg-warning text-dark' : 'bg-danger') },
            { label: 'Proyeksi SLA Perisai', value: perisaiSla.toFixed(1) + '%', hint: useSegment ? 'VIP Terisolasi' : 'Tercampur! Ideal: ' + recAgents + ' agt', bg: perisaiSla >= 90 ? 'bg-success' : 'bg-warning text-dark' }
        ].map(c =>
            '<div class="col-md-3 col-sm-6"><div class="card ' + c.bg + ' text-white mb-4"><div class="card-body py-3"><div class="small text-uppercase fw-bold opacity-75">' + c.label + '</div><div class="h4 mb-1 fw-bold">' + c.value + '</div><div class="small opacity-75">' + c.hint + '</div></div></div></div>'
        ).join('');
    }

    function renderHistoricalChart(){
        const labels = [
            'Jan 24','Feb 24','Mar 24','Apr 24','Mei 24','Jun 24','Jul 24','Agu 24','Sep 24 (CASN)','Okt 24','Nov 24','Des 24',
            'Jan 25','Feb 25','Mar 25','Apr 25','Mei 25','Jun 25','Jul 25','Agu 25','Sep 25','Okt 25','Nov 25','Des 25',
            'Jan 26','Feb 26','Mar 26','Apr 26','Mei 26','Jun 26','Jul 26'
        ];
        const emetData = [
            79.8,48.6,53.0,61.3,69.0,72.5,47.7,55.2,18.7,45.9,39.2,26.3,
            36.0,42.7,77.1,81.1,65.9,57.6,61.5,65.2,70.3,68.4,57.9,74.3,
            70.1,70.9,63.4,73.0,78.1,70.7,75.7
        ];
        const perisaiData = [
            95.0,95.2,94.8,92.2,93.4,83.6,68.5,88.6,86.2,92.2,96.1,95.4,
            97.9,97.8,99.3,98.4,99.0,97.8,95.5,98.3,97.4,96.6,97.5,98.1,
            97.6,98.2,98.1,99.0,97.9,99.4,98.3
        ];
        const chartTheme = getChartCommonOptions();
        if(histChart) histChart.destroy();
        histChart = new Chart(document.getElementById('histChart'), {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: 'E-Meterai SLA %', data: emetData, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.12)', tension: 0.25, fill: true },
                    { label: 'Perisai SLA %', data: perisaiData, borderColor: '#a855f7', backgroundColor: 'transparent', tension: 0.25 }
                ]
            },
            options: {
                ...chartTheme,
                scales: {
                    x: chartTheme.scales.x,
                    y: { min: 0, max: 100, ticks: chartTheme.scales.y.ticks, grid: chartTheme.scales.y.grid, title: { display: true, text: 'SLA Achievement %', color: chartTheme.scales.y.ticks.color } }
                }
            }
        });
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

        setTimeout(() => {
            [dailyChart1, dailyChart2, dailyChart3, dailyChart4, tktChart1, tktChart2, tktChart3, tktChart4, achievedChart, top10Chart, histChart].forEach(ch => {
                if(ch) ch.resize();
            });
        }, 40);
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
                    'Cloudflare D1 · ' + allInteractions.length.toLocaleString('id-ID') + ' interaksi (' + ticketsMap.size.toLocaleString('id-ID') + ' eskalasi)';
                showStatus('success', 'Berhasil memuat & menyimpan ' + parsed.interactions.length.toLocaleString('id-ID') + ' interaksi ke Cloudflare D1.', 6000);
            } catch (syncErr) {
                document.getElementById('metaBadge').textContent =
                    file.name + ' (Lokal) · ' + allInteractions.length + ' interaksi (' + ticketsMap.size + ' eskalasi)';
                showStatus('warning', 'Data tampil di layar, namun gagal sync ke D1 (' + syncErr.message + ').');
            }
        }catch(e){
            showStatus('danger', 'Gagal membaca file: ' + e.message);
        }
        ev.target.value = '';
    });

    ['dailyDateSelect', 'dailyHourStart', 'dailyHourEnd', 'dailyCasnScope'].forEach(id => {
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
        if(allInteractions.length) renderDailyAndTicketingFromUploaded();
        else renderReferenceReports();
        if(ticketsMap.size > 0) renderActual();
        renderHistoricalChart();
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
    initHourSelectors();
    renderReferenceReports();
    runSimulation();
    renderHistoricalChart();
    loadFromD1();
})();
