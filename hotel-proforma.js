/* =====================================================================
   hotel-proforma.js
   Revenue + cost assumptions and NOI build-up for the Ojai boutique
   hotel & event space. Designed to feed the existing return model in
   index.html: computeProForma(...) returns a `noi` that replaces the
   single $300k NOI slider on the returns tab.

   All values are EDITABLE ESTIMATES, not market data. They were tuned so
   the MID scenario lands near $300k NOI (before FF&E reserve), matching
   the figure used elsewhere in the model. Conservative / strong presets
   bracket it. Adjust freely.

   Loads as a plain <script> (exposes window.HotelProForma) and also
   supports ES module / CommonJS import.
   ===================================================================== */
(function (root) {
  "use strict";

  /* ---------------------------------------------------------------
     FIXED PROPERTY FACTS
     --------------------------------------------------------------- */
  var PROPERTY = {
    rooms: 10,
    daysPerYear: 365
  };

  /* ---------------------------------------------------------------
     REVENUE DRIVERS — scenario presets
     RevPAR = ADR x occupancy. Rooms revenue = RevPAR x rooms x days.
     Event revenue = eventsPerYear x netFeePerEvent (+ optional F&B profit).
     "netFeePerEvent" is the facility/venue fee NET of F&B passthrough.
     --------------------------------------------------------------- */
  var SCENARIOS = {
    conservative: {
      adr: 275,            // average daily rate, $
      occupancy: 0.55,     // annual occupancy
      eventsPerYear: 30,
      netFeePerEvent: 4000,
      fbProfitPerEvent: 0  // optional catering margin kept; 0 = pure passthrough
    },
    mid: {
      adr: 350,
      occupancy: 0.62,
      eventsPerYear: 50,
      netFeePerEvent: 6000,
      fbProfitPerEvent: 0
    },
    strong: {
      adr: 425,
      occupancy: 0.68,
      eventsPerYear: 75,
      netFeePerEvent: 8000,
      fbProfitPerEvent: 0
    }
  };

  /* ---------------------------------------------------------------
     COST STRUCTURE (USALI-style build-up)
     Percentages are of the indicated base. Small (10-room) properties
     have weak labor leverage, so departmental and undistributed ratios
     run higher than large-hotel benchmarks. These defaults produce
     roughly a 28-30% NOI margin at the mid scenario.
     --------------------------------------------------------------- */
  var COSTS = {
    // Departmental — % of that department's revenue
    roomsCostPctOfRoomsRev: 0.30,   // housekeeping, supplies, OTA commissions, reservations
    eventsCostPctOfEventRev: 0.28,  // event labor, setup, coordination

    // Undistributed operating expenses — % of TOTAL revenue
    adminGeneralPct: 0.09,          // A&G: back office, accounting, licenses
    salesMarketingPct: 0.08,        // destination/boutique marketing, channel costs
    propertyOpsMaintPct: 0.055,     // R&M, grounds, oaks/landscape upkeep
    utilitiesPct: 0.045,            // power, water, gas, internet

    // Management fee — % of TOTAL revenue (set 0 if pure owner-operated)
    managementFeePct: 0.04,

    // Fixed charges
    propertyTaxRate: 0.011,         // ~1.1% of basis (Prop 13: basis = acq + improvements)
    insuranceAnnual: 55000,         // OJAI WILDFIRE ZONE — elevated & hard to place; verify a real quote
    ffeReservePct: 0.04             // FF&E reserve, % of total revenue (see note in computeProForma)
  };

  /* ---------------------------------------------------------------
     CAPITAL BASIS — used only for the property-tax line.
     Defaults mirror the deal you've been modeling.
     --------------------------------------------------------------- */
  var BASIS = {
    acquisitionPrice: 2900000,
    improvements: 1000000
  };

  /* =================================================================
     COMPUTE
     inputs: any subset of the driver/cost/basis fields above; missing
     fields fall back to the mid scenario + default costs/basis.
     Returns a fully itemized breakdown so the tab can render line items.

     `includeReserveInNOI` (default false): hotels often quote NOI BEFORE
     the FF&E reserve, then deduct it to reach cash flow. Set true to push
     the reserve above the NOI line (more conservative).
     ================================================================= */
  function computeProForma(inputs, opts) {
    inputs = inputs || {};
    opts = opts || {};
    var includeReserveInNOI = !!opts.includeReserveInNOI;

    var rooms = num(inputs.rooms, PROPERTY.rooms);
    var days = num(inputs.daysPerYear, PROPERTY.daysPerYear);

    var adr = num(inputs.adr, SCENARIOS.mid.adr);
    var occ = num(inputs.occupancy, SCENARIOS.mid.occupancy);
    var eventsPerYear = num(inputs.eventsPerYear, SCENARIOS.mid.eventsPerYear);
    var netFeePerEvent = num(inputs.netFeePerEvent, SCENARIOS.mid.netFeePerEvent);
    var fbProfitPerEvent = num(inputs.fbProfitPerEvent, SCENARIOS.mid.fbProfitPerEvent);

    var c = mergeCosts(inputs);
    var acq = num(inputs.acquisitionPrice, BASIS.acquisitionPrice);
    var imp = num(inputs.improvements, BASIS.improvements);

    // --- Revenue ---
    var revpar = adr * occ;
    var roomsRevenue = revpar * rooms * days;
    var eventRevenue = eventsPerYear * (netFeePerEvent + fbProfitPerEvent);
    var totalRevenue = roomsRevenue + eventRevenue;

    // --- Departmental costs ---
    var roomsCost = roomsRevenue * c.roomsCostPctOfRoomsRev;
    var eventsCost = eventRevenue * c.eventsCostPctOfEventRev;
    var departmentalCost = roomsCost + eventsCost;

    // --- Undistributed ---
    var adminGeneral = totalRevenue * c.adminGeneralPct;
    var salesMarketing = totalRevenue * c.salesMarketingPct;
    var propertyOpsMaint = totalRevenue * c.propertyOpsMaintPct;
    var utilities = totalRevenue * c.utilitiesPct;
    var undistributed = adminGeneral + salesMarketing + propertyOpsMaint + utilities;

    // --- GOP & management fee ---
    var grossOperatingProfit = totalRevenue - departmentalCost - undistributed;
    var managementFee = totalRevenue * c.managementFeePct;
    var incomeBeforeFixed = grossOperatingProfit - managementFee;

    // --- Fixed charges ---
    var propertyTax = (acq + imp) * c.propertyTaxRate;
    var insurance = c.insuranceAnnual;
    var fixedCharges = propertyTax + insurance;

    var ffeReserve = totalRevenue * c.ffeReservePct;

    // --- NOI ---
    var noiBeforeReserve = incomeBeforeFixed - fixedCharges;
    var noi = includeReserveInNOI ? noiBeforeReserve - ffeReserve : noiBeforeReserve;

    return {
      revenue: {
        adr: adr,
        occupancy: occ,
        revpar: revpar,
        rooms: roomsRevenue,
        events: eventRevenue,
        total: totalRevenue
      },
      departmental: { rooms: roomsCost, events: eventsCost, total: departmentalCost },
      undistributed: {
        adminGeneral: adminGeneral,
        salesMarketing: salesMarketing,
        propertyOpsMaint: propertyOpsMaint,
        utilities: utilities,
        total: undistributed
      },
      grossOperatingProfit: grossOperatingProfit,
      gopMargin: totalRevenue ? grossOperatingProfit / totalRevenue : 0,
      managementFee: managementFee,
      fixed: { propertyTax: propertyTax, insurance: insurance, total: fixedCharges },
      ffeReserve: ffeReserve,
      ffeReserveInNOI: includeReserveInNOI,
      noiBeforeReserve: noiBeforeReserve,
      noi: noi,                                   // <-- feed this to the returns tab
      noiMargin: totalRevenue ? noi / totalRevenue : 0
    };
  }

  /* Convenience: run a named preset (conservative | mid | strong),
     optionally overriding any fields (e.g. basis, insurance). */
  function computeScenario(name, overrides, opts) {
    var preset = SCENARIOS[name] || SCENARIOS.mid;
    var merged = {};
    for (var k in preset) merged[k] = preset[k];
    if (overrides) for (var j in overrides) merged[j] = overrides[j];
    return computeProForma(merged, opts);
  }

  /* ---------- helpers ---------- */
  function num(v, fallback) {
    return (typeof v === "number" && !isNaN(v)) ? v : fallback;
  }
  function mergeCosts(inputs) {
    var out = {};
    for (var k in COSTS) out[k] = num(inputs[k], COSTS[k]);
    return out;
  }
  function formatMoney(n) {
    if (Math.abs(n) >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
    return "$" + Math.round(n / 1000) + "k";
  }
  function formatPct(x, dp) {
    return (x * 100).toFixed(dp == null ? 1 : dp) + "%";
  }

  var API = {
    PROPERTY: PROPERTY,
    SCENARIOS: SCENARIOS,
    COSTS: COSTS,
    BASIS: BASIS,
    computeProForma: computeProForma,
    computeScenario: computeScenario,
    formatMoney: formatMoney,
    formatPct: formatPct
  };

  if (typeof module !== "undefined" && module.exports) module.exports = API; // CommonJS
  root.HotelProForma = API;                                                  // browser global
})(typeof globalThis !== "undefined" ? globalThis : this);
