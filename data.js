// =========================================================================
// DATA FETCHING & NORMALIZATION (data.js)
// =========================================================================

const API_URL = "https://script.google.com/macros/s/AKfycbwiv88Zu0bIdiB_EBRIHHTYKbxfbBRtH--k2iX9r7W-AwaJek8acG2SjvzgtnoSFFuZwQ/exec"; 

let rawData = { 
    isp: [], 
    scada: [], 
    scadaHourly: [], 
    henex: [], 
    mcpHourly: [], 
    efficiency: [],
    daily_surplus: [],          // <--- ΠΡΟΣΘΗΚΗ
    daily_gas_constraints: []   // <--- ΠΡΟΣΘΗΚΗ
};

let currentLang = 'en'; 

const i18n = {
    en: {
        title: "Greek Gas-to-Power Market Analytics",
        source: "Data source: IPTO (ADMIE) & HEnEx official reports",
        scopeTooltip: "Refers exclusively to natural gas fired power plants (CCGT/OCGT) in the Greek Interconnected System.",
        lastUpdate: "Last Update:",
        nextUpdate: "Next Update:",
        dateLabel: "Date:",
        tabOverview: "Daily Overview",
        tabEconomics: "Daily Economics",
        tabIspScada: "Monthly Analytics",
        tabSurplus: "System Needs (Surplus)",
        btnMethodology: "Methodology & Assumptions",
        btnClose: "Close",
        modalTitle: "Methodology & Core Assumptions",
        modalBody: `
            <p class="mb-3">This Dashboard serves as an independent tool for monitoring and analyzing natural gas power plants in the Greek Energy Market.</p>
            <ul class="list-disc pl-5 space-y-2 mb-4 text-slate-400">
                <li><strong class="text-slate-200">Data Sources:</strong> Data is fetched daily from IPTO's (ADMIE) official reports (ISP & SCADA) and HEnEx (Day-Ahead Market & NGAS Indices).</li>
                <li><strong class="text-slate-200">Economics & Fuel Cost:</strong> Production cost is theoretically calculated using the daily HEnEx TTF (HGSIDA/HGSIWD) index, divided by the specific Thermal Efficiency of each unit class, plus the standardized CO2 emission cost.</li>
                <li><strong class="text-slate-200">Out-of-Merit Operation:</strong> Due to the "duck curve" and high RES penetration, IPTO frequently issues Generic Constraints. When a unit generates electricity while the Day-Ahead Market (MCP) price is lower than its marginal fuel cost, it is visualized as out-of-merit (constraint-driven) operation.</li>
            </ul>
        `
    },
    el: {
        title: "Ανάλυση Ελληνικής Αγοράς Φυσικού Αερίου",
        source: "Πηγή δεδομένων: Επίσημα αρχεία ΑΔΜΗΕ (IPTO) & ΕΧΕ (HEnEx)",
        scopeTooltip: "Αφορά αποκλειστικά τις μονάδες ηλεκτροπαραγωγής από Φυσικό Αέριο (CCGT/OCGT) στο Διασυνδεδεμένο Σύστημα.",
        lastUpdate: "Τελευταία Ενημέρωση:",
        nextUpdate: "Επόμενη Ενημέρωση:",
        dateLabel: "Ημερομηνία:",
        tabOverview: "Ημερήσια Επισκόπηση",
        tabEconomics: "Ημερήσια Οικονομικά",
        tabIspScada: "Μηνιαία Ανάλυση",
        tabSurplus: "Ανάγκες Συστήματος (Surplus)",
        btnMethodology: "Μεθοδολογία & Παραδοχές",
        btnClose: "Κλείσιμο",
        modalTitle: "Μεθοδολογία & Βασικές Παραδοχές",
        modalBody: `
            <p class="mb-3">Το παρόν Dashboard αποτελεί ένα ανεξάρτητο εργαλείο παρακολούθησης των μονάδων Φυσικού Αερίου στην Ελληνική Αγορά Ενέργειας.</p>
            <ul class="list-disc pl-5 space-y-2 mb-4 text-slate-400">
                <li><strong class="text-slate-200">Πηγές Δεδομένων:</strong> Αντλούνται καθημερινά από τον ΑΔΜΗΕ (ISP & SCADA) και το Ελληνικό Χρηματιστήριο Ενέργειας (DAM MCP & Δείκτες NGAS).</li>
                <li><strong class="text-slate-200">Κόστος Παραγωγής:</strong> Υπολογίζεται θεωρητικά βάσει του δείκτη HEnEx (HGSIDA/HGSIWD), διαιρούμενου με τον Βαθμό Απόδοσης της εκάστοτε κλάσης, προσθέτοντας το κόστος ρύπων CO2.</li>
                <li><strong class="text-slate-200">Λειτουργία Out-of-Merit:</strong> Λόγω υψηλής διείσδυσης ΑΠΕ, ο ΑΔΜΗΕ διατηρεί μονάδες συγχρονισμένες (Generic Constraints) για ευστάθεια. Η λειτουργία μονάδων σε ώρες όπου η Τιμή Εκκαθάρισης (MCP) είναι χαμηλότερη από το κόστος καυσίμου τους, αποτυπώνεται ως constraint-driven λειτουργία και όχι ως market-driven arbitrage.</li>
            </ul>
        `
    }
};

function setLang(lang) {
    currentLang = lang;
    const t = i18n[lang];
    
    document.getElementById('pageTitle').innerText = t.title;
    document.getElementById('mainTitle').innerText = t.title;
    document.getElementById('dataSourceText').innerText = t.source;
    document.getElementById('scopeBadge').title = t.scopeTooltip;
    document.getElementById('lastUpdateLabel').innerText = t.lastUpdate;
    document.getElementById('nextUpdateLabel').innerText = t.nextUpdate;
    
    if(document.getElementById('btnMethodologyText')) document.getElementById('btnMethodologyText').innerText = t.btnMethodology;
    if(document.getElementById('modalTitle')) document.getElementById('modalTitle').innerText = t.modalTitle;
    if(document.getElementById('modalBody')) document.getElementById('modalBody').innerHTML = t.modalBody;
    if(document.getElementById('btnClose')) document.getElementById('btnClose').innerText = t.btnClose;

    document.getElementById('tabBtnOverview').innerText = t.tabOverview;
    document.getElementById('tabBtnEconomics').innerText = t.tabEconomics;
    document.getElementById('tabBtnIspScada').innerText = t.tabIspScada;
    document.getElementById('tabBtnSurplus').innerText = t.tabSurplus;
    
    if(document.getElementById('dateLabel')) document.getElementById('dateLabel').innerText = t.dateLabel;

    if(lang === 'el') {
        document.getElementById('btnGr').className = "px-2 py-1 rounded bg-blue-600 text-white transition";
        document.getElementById('btnEn').className = "px-2 py-1 rounded text-slate-400 hover:text-white transition";
    } else {
        document.getElementById('btnEn').className = "px-2 py-1 rounded bg-blue-600 text-white transition";
        document.getElementById('btnGr').className = "px-2 py-1 rounded text-slate-400 hover:text-white transition";
    }

    if (typeof updateDashboard === "function") updateDashboard();
}

function updateFreshness(dates) {
    if (!dates || dates.length === 0) return;
    const latestDate = dates[0];
    let parts = latestDate.split('-');
    let formattedLatest = latestDate;
    let formattedNext = "-";
    
    if (parts.length === 3) {
        formattedLatest = `${parts[2]}/${parts[1]}/${parts[0]} 08:00`;
        let d = new Date(parts[0], parts[1] - 1, parseInt(parts[2]) + 1);
        let day = String(d.getDate()).padStart(2, '0');
        let month = String(d.getMonth() + 1).padStart(2, '0');
        let year = d.getFullYear();
        formattedNext = `${day}/${month}/${year} 08:00`;
    }
    
    document.getElementById('lastUpdateVal').innerText = formattedLatest;
    document.getElementById('nextUpdateVal').innerText = formattedNext;
}

// Λήψη δεδομένων από Google Apps Script
async function fetchMarketData() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error("Network response was not ok");
        
        const json = await response.json();
        
        rawData.isp = json.isp_generation || [];
        rawData.scada = json.scada_generation || [];
        rawData.scadaHourly = json.scada_generation_hourly || [];
        rawData.henex = json.henex_indices || [];
        rawData.mcpHourly = json.dam_mcp_hourly || [];
        rawData.efficiency = json.thermal_efficiency || [];
        rawData.daily_surplus = json.daily_surplus || [];                // <--- ΠΡΟΣΘΗΚΗ
        rawData.daily_gas_constraints = json.daily_gas_constraints || []; // <--- ΠΡΟΣΘΗΚΗ
        
        console.log("Data successfully loaded:", rawData);

        const dates = [...new Set([
            ...rawData.isp.map(d => Object.values(d)[0]),
            ...rawData.scada.map(d => Object.values(d)[0])
        ])].filter(d => d).sort().reverse();
        
        const dateSelect = document.getElementById('dateSelect');
        if(dateSelect) {
            dateSelect.innerHTML = dates.map(d => `<option value="${d}">${d}</option>`).join('');
        }

        updateFreshness(dates);

        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            document.getElementById('loading-percentage').innerText = "100%";
            document.getElementById('loading-progress-bar').style.width = "100%";
            setTimeout(() => {
                overlay.classList.add('opacity-0');
                setTimeout(() => overlay.style.display = 'none', 500);
            }, 800);
        }
        
        setLang('en');

    } catch (error) {
        console.error("Error loading market data:", error);
        document.getElementById('loading-subtitle').innerText = "Network Error or CORS issue.";
        document.getElementById('loading-subtitle').classList.add('text-rose-400');
    }
}

document.addEventListener('DOMContentLoaded', fetchMarketData);
