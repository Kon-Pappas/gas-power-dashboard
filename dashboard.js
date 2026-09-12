// ==========================================
// GLOBAL CHART INSTANCES & STATE
// ==========================================
let overviewChartInst = null;

// ==========================================
// HELPERS
// ==========================================
function parseDate(dateObj) {
    if (!dateObj) return "";
    if (dateObj instanceof Date) return dateObj.toISOString().split('T')[0];
    return String(dateObj).split('T')[0].trim();
}

function parseNum(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    let str = String(val).replace(',', '.').replace(/[^0-9.-]/g, '');
    let n = parseFloat(str);
    return isNaN(n) ? 0 : n;
}

// Διαβάζει το Class από το Thermal Efficiency data
function getUnitMetadata(unitName) {
    let result = { 
        class: 'Older Generation & Peakers', 
        eff: 0.50, 
        order: 3 
    };
    
    if (!rawData || !rawData.efficiency) return result;

    const record = rawData.efficiency.find(r => 
        String(Object.values(r)[1]).trim().toUpperCase() === unitName.toUpperCase()
    );

    if (record) {
        const rawClass = Object.values(record)[0];
        result.class = rawClass;
        result.eff = parseNum(Object.values(record)[2]);
        
        // Ιεράρχηση (Merit Order Proxy)
        if (rawClass.includes('Super-Efficient')) result.order = 1;
        else if (rawClass.includes('Standard')) result.order = 2;
        else result.order = 3;
    }
    
    if (result.order === 3) {
        result.class = (typeof currentLang !== 'undefined' && currentLang === 'el') 
            ? 'Παλαιότερη Γενιά & Peakers' 
            : 'Older Generation & Peakers';
    }

    return result;
}

// ==========================================
// TAB SWITCHING CONTROLLER
// ==========================================
function switchTab(tabId) {
    const tabs = ['overview', 'ispScada', 'economics', 'efficiency'];
    tabs.forEach(t => {
        const btn = document.getElementById('tabBtn' + t.charAt(0).toUpperCase() + t.slice(1));
        const view = document.getElementById('view' + t.charAt(0).toUpperCase() + t.slice(1));
        
        if (t === tabId) {
            btn.className = "text-blue-400 font-bold border-b-2 border-blue-400 pb-2 px-2 transition whitespace-nowrap";
            view.classList.remove('hidden');
        } else {
            btn.className = "text-slate-500 hover:text-blue-300 pb-2 px-2 transition whitespace-nowrap";
            view.classList.add('hidden');
        }
    });

    if (tabId === 'overview' && typeof updateDashboard === "function") updateDashboard();
}

// ==========================================
// TAB: DAILY OVERVIEW (ISP vs SCADA)
// ==========================================
function updateDashboard() {
    const dateSelect = document.getElementById('dateSelect');
    if (!dateSelect || !rawData || !rawData.isp) return;
    
    const selectedDate = dateSelect.value;
    if (!selectedDate) return;

    const ispDay = rawData.isp.filter(d => parseDate(Object.values(d)[0]) === selectedDate);
    const scadaDay = rawData.scada.filter(d => parseDate(Object.values(d)[0]) === selectedDate);

    let totalIsp = 0;
    let totalScada = 0;
    const unitMap = {};

    ispDay.forEach(d => {
        const uName = String(Object.values(d)[1]).trim();
        const val = parseNum(Object.values(d)[2]);
        if (uName === "TOTAL GAS UNITS") {
            totalIsp = val;
            return;
        }
        if (!unitMap[uName]) unitMap[uName] = { name: uName, isp: 0, scada: 0, meta: getUnitMetadata(uName) };
        unitMap[uName].isp += val;
    });

    scadaDay.forEach(d => {
        const uName = String(Object.values(d)[1]).trim();
        const val = parseNum(Object.values(d)[2]);
        if (uName === "TOTAL GAS UNITS") {
            totalScada = val;
            return;
        }
        if (!unitMap[uName]) unitMap[uName] = { name: uName, isp: 0, scada: 0, meta: getUnitMetadata(uName) };
        unitMap[uName].scada += val;
    });

    // Ενημέρωση KPIs
    const kpiIspEl = document.getElementById('kpiTotalIsp');
    const kpiScadaEl = document.getElementById('kpiTotalScada');
    if (kpiIspEl) kpiIspEl.innerText = totalIsp.toLocaleString('en-US', {minimumFractionDigits: 1, maximumFractionDigits: 1});
    if (kpiScadaEl) kpiScadaEl.innerText = totalScada.toLocaleString('en-US', {minimumFractionDigits: 1, maximumFractionDigits: 1});

    // Ταξινόμηση: Πρώτα βάσει Class Order (1: H-Class, 2: F-Class, 3: Peakers), έπειτα βάσει παραγωγής SCADA
    const unitsArray = Object.values(unitMap);
    unitsArray.sort((a, b) => {
        if (a.meta.order !== b.meta.order) return a.meta.order - b.meta.order;
        return b.scada - a.scada;
    });

    const labels = [];
    const classLabels = [];
    const dataIsp = [];
    const dataScada = [];

    unitsArray.forEach(u => {
        labels.push(u.name);
        classLabels.push(u.meta.class);
        dataIsp.push(u.isp);
        dataScada.push(u.scada);
    });

    renderOverviewChart(labels, classLabels, dataIsp, dataScada);
}

function renderOverviewChart(labels, classLabels, dataIsp, dataScada) {
    const canvas = document.getElementById('overviewChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (overviewChartInst) overviewChartInst.destroy();
    
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

    overviewChartInst = new Chart(ctx, { 
        type: 'bar', 
        data: { 
            labels: labels, 
            datasets: [
                { 
                    label: 'ISP (MWh)', 
                    data: dataIsp, 
                    backgroundColor: '#3b82f6', 
                    borderRadius: 4,
                    barPercentage: 0.85,
                    categoryPercentage: 0.8
                }, 
                { 
                    label: 'SCADA (MWh)', 
                    data: dataScada, 
                    backgroundColor: '#fb923c', 
                    borderRadius: 4,
                    barPercentage: 0.85,
                    categoryPercentage: 0.8
                }
            ] 
        }, 
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { 
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        beforeTitle: function(context) {
                            return classLabels[context[0].dataIndex];
                        },
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            label += context.parsed.y.toLocaleString('en-US', {minimumFractionDigits: 1, maximumFractionDigits: 1}) + ' MWh';
                            return label;
                        }
                    }
                }
            }, 
            scales: { 
                x: { 
                    grid: { display: false },
                    ticks: {
                        maxRotation: 45,
                        minRotation: 45
                    }
                }, 
                y: { 
                    grid: { color: '#334155' },
                    title: { display: true, text: 'MWh' }
                } 
            } 
        } 
    });
}
