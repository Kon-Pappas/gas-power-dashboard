// ==========================================
// CONFIGURATION & CONSTANTS
// ==========================================
const CO2_COST_PER_MWH = 28.0; // Σταθερό κόστος ρύπων CO2 (€/MWh)

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

function formatEuro(amount) {
    return amount.toLocaleString('el-GR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Δημιουργία Seamless Diagonal Pattern για το SCADA
function createDiagonalPattern(colorHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 8;
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, 8, 8);
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2;
    
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(8, 0);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(-4, 4);
    ctx.lineTo(4, -4);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(4, 12);
    ctx.lineTo(12, 4);
    ctx.stroke();
    
    return ctx.createPattern(canvas, 'repeat');
}

// ΕΞΥΠΝΗ ΑΝΤΙΣΤΟΙΧΙΣΗ (Mapping) ΟΝΟΜΑΤΩΝ ΜΟΝΑΔΩΝ
function getCanonicalUnitName(rawName) {
    if (!rawName) return "UNKNOWN";
    let clean = String(rawName).trim().toUpperCase();
    clean = clean.replace(/\s*\((ST|GT\d+)\)/gi, '').trim();

    if (clean === "KOMOTINI_POWER") return "KOMOTINI_POWER";
    if (clean.includes("KOMOTINI") || clean.includes("ΚΟΜΟΤΗΝΗ")) {
        if (clean.includes("POWER")) return "KOMOTINI_POWER";
        return "ΚΟΜΟΤΗΝΗ";
    }
    
    if (clean.includes("AG_NIKOLAOS") || clean.includes("ΑΓ. ΝΙΚΟΛΑΟΣ") || clean.includes("AGIOS NIKOLAOS")) return "AG_NIKOLAOS2";
    if (clean.includes("PROTERGIA") || clean.includes("THESSALONIKI")) return "PROTERGIA_CC";
    if (clean.includes("HERON") || clean.includes("ΘΗΣ ΗΡΩΝ") || clean.includes("ΗΡΩΝ")) return "ΘΗΣ ΗΡΩΝ";
    if (clean.includes("MEGALOPOLI") || clean.includes("ΜΕΓΑΛΟΠΟΛΗ")) return "ΜΕΓΑΛΟΠΟΛΗ 5";
    if (clean.includes("THISVI") || clean.includes("ΘΗΣΒ")) return "ELPEDISON_THISVI";
    if (clean.includes("KORINTHOS") || clean.includes("ΚΟΡΙΝΘΟΣ")) return "KORINTHOS_POWER";
    if (clean.includes("THESS") && clean.includes("ELPEDISON")) return "ELPEDISON_THESS";
    if (clean.includes("ALIVERI") || clean.includes("ΑΛΙΒΕΡΙ")) return "ΑΛΙΒΕΡΙ 5";
    if (clean.includes("LAVRIO 5") || clean.includes("ΛΑΥΡΙΟ 5") || clean.includes("LAVRIO5")) return "ΛΑΥΡΙΟ 5";
    if (clean.includes("LAVRIO 4") || clean.includes("ΛΑΥΡΙΟ 4") || clean.includes("LAVRIO4") || clean.includes("ΛΑΥΡΙΟ") || clean.includes("LAVRIOS")) return "ΛΑΥΡΙΟ 4";
    if (clean.includes("ALOUMINIO") || clean.includes("ΑΛΟΥΜΙΝΙΟ") || clean.includes("ALUM")) return "ΑΛΟΥΜΙΝΙΟ";

    return clean;
}

// Διαβάζει το Class από το Thermal Efficiency data
function getUnitMetadata(unitName) {
    let result = { 
        class: 'Older Generation & Peakers', 
        eff: 0.50, 
        order: 3 
    };
    
    if (!rawData || !rawData.efficiency) return result;

    const canonical = getCanonicalUnitName(unitName);

    const record = rawData.efficiency.find(r => {
        const sheetUnit = String(Object.values(r)[1]).trim().toUpperCase();
        return sheetUnit === canonical || sheetUnit === unitName.toUpperCase();
    });

    if (record) {
        const rawClass = Object.values(record)[0];
        result.class = rawClass;
        result.eff = parseNum(Object.values(record)[2]);
        
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
    // Η νέα σειρά των tabs
    const tabs = ['overview', 'economics', 'ispScada', 'efficiency'];
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

    if (tabId === 'overview') updateOverviewTab();
    if (tabId === 'economics') updateEconomicsTab();
}

// ==========================================
// MASTER UPDATE TRIGGERS
// ==========================================
function updateDashboard() {
    // Επειδή πλέον το ημερολόγιο είναι global, ενημερώνουμε και τα 2 ενεργά views αμέσως.
    updateOverviewTab();
    updateEconomicsTab();
}

// ==========================================
// TAB 1: DAILY OVERVIEW (ISP vs SCADA)
// ==========================================
function updateOverviewTab() {
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
        let uName = String(Object.values(d)[1]).trim();
        const val = parseNum(Object.values(d)[2]);
        if (uName === "TOTAL GAS UNITS") {
            totalIsp = val;
            return;
        }
        uName = getCanonicalUnitName(uName);
        if (!unitMap[uName]) unitMap[uName] = { name: uName, isp: 0, scada: 0, meta: getUnitMetadata(uName) };
        unitMap[uName].isp += val;
    });

    scadaDay.forEach(d => {
        let uName = String(Object.values(d)[1].trim());
        const val = parseNum(Object.values(d)[2]);
        if (uName === "TOTAL GAS UNITS") {
            totalScada = val;
            return;
        }
        uName = getCanonicalUnitName(uName);
        if (!unitMap[uName]) unitMap[uName] = { name: uName, isp: 0, scada: 0, meta: getUnitMetadata(uName) };
        unitMap[uName].scada += val;
    });

    const kpiIspEl = document.getElementById('kpiTotalIsp');
    const kpiScadaEl = document.getElementById('kpiTotalScada');
    if (kpiIspEl) kpiIspEl.innerText = totalIsp.toLocaleString('en-US', {minimumFractionDigits: 1, maximumFractionDigits: 1});
    if (kpiScadaEl) kpiScadaEl.innerText = totalScada.toLocaleString('en-US', {minimumFractionDigits: 1, maximumFractionDigits: 1});

    const unitsArray = Object.values(unitMap);
    unitsArray.sort((a, b) => {
        if (a.meta.order !== b.meta.order) return a.meta.order - b.meta.order;
        return b.scada - a.scada;
    });

    const labels = [];
    const classLabels = [];
    const dataIsp = [];
    const dataScada = [];
    const ispColors = [];
    const scadaColors = [];

    const colorMap = {
        1: '#06b6d4', // Cyan
        2: '#3b82f6', // Blue
        3: '#f97316'  // Orange
    };

    unitsArray.forEach(u => {
        labels.push(u.name);
        classLabels.push(u.meta.class);
        dataIsp.push(u.isp);
        dataScada.push(u.scada);

        let baseColor = colorMap[u.meta.order] || '#64748b';
        ispColors.push(baseColor);
        scadaColors.push(createDiagonalPattern(baseColor));
    });

    renderOverviewChart(labels, classLabels, dataIsp, dataScada, ispColors, scadaColors);
}

function renderOverviewChart(labels, classLabels, dataIsp, dataScada, ispColors, scadaColors) {
    const canvas = document.getElementById('overviewChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (overviewChartInst) overviewChartInst.destroy();
    
    Chart.defaults.color = '#94a3b8';
    Chart.defaults.font.family = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

    const lang = (typeof currentLang !== 'undefined') ? currentLang : 'en';
    const labelIsp = (lang === 'el') ? 'Πρόγραμμα (ISP)' : 'Scheduled (ISP)';
    const labelScada = (lang === 'el') ? 'Πραγματικό (SCADA)' : 'Actual (SCADA)';

    overviewChartInst = new Chart(ctx, { 
        type: 'bar', 
        data: { 
            labels: labels, 
            datasets: [
                { 
                    label: labelIsp, 
                    data: dataIsp, 
                    backgroundColor: ispColors, 
                    borderRadius: 4,
                    barPercentage: 0.85,
                    categoryPercentage: 0.8
                }, 
                { 
                    label: labelScada, 
                    data: dataScada, 
                    backgroundColor: scadaColors, 
                    borderRadius: 4,
                    borderWidth: 1, 
                    borderColor: ispColors,
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

// ==========================================
// TAB 2: DAILY ECONOMICS
// ==========================================
function updateEconomicsTab() {
    const dateSelect = document.getElementById('dateSelect');
    if (!dateSelect || !rawData || !rawData.scada) return;
    
    const selectedDate = dateSelect.value;
    if (!selectedDate) return;

    let hgsida = 0;
    if (rawData.henex) {
        const henexDay = rawData.henex.find(d => parseDate(Object.values(d)[0]) === selectedDate);
        if (henexDay) {
            hgsida = parseNum(Object.values(henexDay)[1]); 
        }
    }

    const scadaDay = rawData.scada.filter(d => parseDate(Object.values(d)[0]) === selectedDate);
    
    const ecoMap = {};
    scadaDay.forEach(d => {
        let uName = String(Object.values(d)[1].trim());
        const val = parseNum(Object.values(d)[2]);
        if (uName === "TOTAL GAS UNITS" || val <= 0) return; 

        uName = getCanonicalUnitName(uName);
        if (!ecoMap[uName]) ecoMap[uName] = { name: uName, scada: 0, meta: getUnitMetadata(uName) };
        ecoMap[uName].scada += val;
    });

    const unitsArray = Object.values(ecoMap);
    unitsArray.sort((a, b) => {
        if (a.meta.order !== b.meta.order) return a.meta.order - b.meta.order;
        return b.scada - a.scada;
    });

    let totalMwh = 0;
    let totalTheoreticalFuel = 0;
    let totalCostFleet = 0;

    const tbody = document.getElementById('economicsTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    unitsArray.forEach(u => {
        totalMwh += u.scada;
        
        const efficiencyRatio = u.meta.eff; 
        const gasCostPerMwh = hgsida > 0 ? (hgsida / efficiencyRatio) + CO2_COST_PER_MWH : 0;
        const unitTotalCost = u.scada * gasCostPerMwh;
        
        totalCostFleet += unitTotalCost;
        totalTheoreticalFuel += (u.scada / efficiencyRatio);

        let borderClass = "border-l-4 border-slate-700";
        if (u.meta.order === 1) borderClass = "border-l-4 border-[#06b6d4]";
        if (u.meta.order === 2) borderClass = "border-l-4 border-[#3b82f6]";
        if (u.meta.order === 3) borderClass = "border-l-4 border-[#f97316]";

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-700/50 transition-colors group";
        tr.innerHTML = `
            <td class="p-3 text-xs text-slate-400 ${borderClass}">${u.meta.class}</td>
            <td class="p-3 font-bold text-slate-300 group-hover:text-white transition-colors">${u.name}</td>
            <td class="p-3 text-right font-mono">${u.scada.toLocaleString('en-US', {minimumFractionDigits: 1, maximumFractionDigits: 1})}</td>
            <td class="p-3 text-right text-emerald-400/90">${(efficiencyRatio * 100).toFixed(1)}%</td>
            <td class="p-3 text-right font-mono">${gasCostPerMwh > 0 ? gasCostPerMwh.toFixed(2) : '-'}</td>
            <td class="p-3 text-right font-semibold text-slate-300">${gasCostPerMwh > 0 ? formatEuro(unitTotalCost) : '-'}</td>
        `;
        tbody.appendChild(tr);
    });

    const fleetEfficiency = totalTheoreticalFuel > 0 ? (totalMwh / totalTheoreticalFuel) * 100 : 0;
    const avgGasCost = totalMwh > 0 ? (totalCostFleet / totalMwh) : 0;

    // Ενημέρωση Footer Table
    document.getElementById('ecoTableTotalMwh').innerText = totalMwh.toLocaleString('en-US', {minimumFractionDigits: 1, maximumFractionDigits: 1});
    document.getElementById('ecoTableAvgEff').innerText = fleetEfficiency.toFixed(2) + '%';
    document.getElementById('ecoTableAvgGasCost').innerText = avgGasCost > 0 ? avgGasCost.toFixed(2) : '-';
    document.getElementById('ecoTableTotalCost').innerText = formatEuro(totalCostFleet);

    // Ενημέρωση Top KPIs (Κάρτες)
    document.getElementById('kpiHgsida').innerText = hgsida > 0 ? hgsida.toFixed(2) : '-';
    document.getElementById('kpiEcoScada').innerText = totalMwh.toLocaleString('en-US', {minimumFractionDigits: 1, maximumFractionDigits: 1});
    document.getElementById('kpiAvgGasCost').innerText = avgGasCost > 0 ? avgGasCost.toFixed(2) : '-';
    document.getElementById('kpiTotalEcoCost').innerText = totalCostFleet > 0 ? formatEuro(totalCostFleet) : '-';
    document.getElementById('kpiFleetEff').innerText = fleetEfficiency.toFixed(2);
}
