// ΕΠΑΓΓΕΛΜΑΤΙΚΗ ΡΟΗ ΦΟΡΤΩΣΗΣ ΜΕ ΚΛΙΜΑΚΩΤΑ STEPS & DYNAMIC TAB TITLES
async function fetchMarketData() {
    const overlay = document.getElementById('loading-overlay');
    const progressBar = document.getElementById('loading-progress-bar');
    const progressPercentage = document.getElementById('loading-percentage');
    const loadingSubtitle = document.getElementById('loading-subtitle');

    function updateProgress(percent, text) {
        if (progressBar) progressBar.style.width = percent + '%';
        if (progressPercentage) progressPercentage.innerText = percent + '%';
        if (loadingSubtitle) loadingSubtitle.innerText = text;
    }

    const lang = currentLang || 'en';
    const texts = {
        en: [
            { p: 15, t: "Initializing Dashboard..." },
            { p: 30, t: `Loading Market Data (${i18n.en.tabOverview})` },
            { p: 45, t: `Loading Market Data (${i18n.en.tabEconomics})` },
            { p: 60, t: `Loading Market Data (${i18n.en.tabIspScada})` },
            { p: 75, t: `Loading Market Data (${i18n.en.tabSurplus})` },
            { p: 88, t: "Processing and normalizing datasets..." }
        ],
        el: [
            { p: 15, t: "Αρχικοποίηση Dashboard..." },
            { p: 30, t: `Φόρτωση Δεδομένων (${i18n.el.tabOverview})` },
            { p: 45, t: `Φόρτωση Δεδομένων (${i18n.el.tabEconomics})` },
            { p: 60, t: `Φόρτωση Δεδομένων (${i18n.el.tabIspScada})` },
            { p: 75, t: `Φόρτωση Δεδομένων (${i18n.el.tabSurplus})` },
            { p: 88, t: "Επεξεργασία & κανονικοποίηση δεδομένων..." }
        ]
    };

    let stepIndex = 0;
    let activeSteps = texts[lang];
    updateProgress(activeSteps[0].p, activeSteps[0].t);

    // Πιο αργός ρυθμός (800ms ανά βήμα) για να μοιάζει φυσική η αναμονή
    let progressInterval = setInterval(() => {
        stepIndex++;
        if (stepIndex < activeSteps.length) {
            updateProgress(activeSteps[stepIndex].p, activeSteps[stepIndex].t);
        } else {
            clearInterval(progressInterval);
        }
    }, 800);

    try {
        const response = await fetch(API_URL);
        clearInterval(progressInterval); // Σταματάμε το simulation αφού ήρθαν τα δεδομένα

        if (!response.ok) throw new Error("Network response was not ok");
        
        const json = await response.json();
        
        updateProgress(95, lang === 'el' ? "Τελικός συγχρονισμός γραφημάτων..." : "Finalizing chart datasets...");

        rawData.isp = json.isp_generation || [];
        rawData.scada = json.scada_generation || [];
        rawData.scadaHourly = json.scada_generation_hourly || [];
        rawData.henex = json.henex_indices || [];
        rawData.mcpHourly = json.dam_mcp_hourly || [];
        rawData.efficiency = json.thermal_efficiency || [];
        rawData.daily_surplus = json.daily_surplus || [];                
        rawData.daily_gas_constraints = json.daily_gas_constraints || []; 
        
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

        // 100% Ολοκλήρωση
        updateProgress(100, lang === 'el' ? "Ολοκλήρωση Dashboard..." : "Finalizing Dashboard...");

        if (overlay) {
            setTimeout(() => {
                overlay.classList.add('opacity-0');
                setTimeout(() => overlay.style.display = 'none', 500);
            }, 400);
        }
        
        setLang(currentLang);

    } catch (error) {
        clearInterval(progressInterval);
        console.error("Error loading market data:", error);
        if (loadingSubtitle) {
            loadingSubtitle.innerText = "Network Error or CORS issue.";
            loadingSubtitle.classList.add('text-rose-400');
        }
    }
}
