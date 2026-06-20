# Pro forma assumptions & integration spec

This documents `hotel-proforma.js` — the revenue and cost build-up that produces the NOI consumed by the returns tab in `index.html`. Hand this to Claude Code along with the `.js` file to add a second tab.

## What it does

The returns tab currently treats NOI as a single input (~$300k). This module builds that NOI from the ground up:

```
Rooms revenue   = (ADR × occupancy) × rooms × 365
Event revenue   = events/yr × net facility fee per event
Total revenue   = rooms + events
        − departmental costs   (rooms %, events %)
        − undistributed costs  (A&G, sales/marketing, R&M, utilities)
        = gross operating profit
        − management fee
        − fixed charges        (property tax, insurance)
        = NOI   ← feeds the returns tab
        − FF&E reserve         (optional, see below)
```

## The assumptions (all editable in the module)

| Driver | Conservative | Mid | Strong |
|---|---|---|---|
| ADR | $275 | $350 | $425 |
| Occupancy | 55% | 62% | 68% |
| Events / year | 30 | 50 | 75 |
| Net fee / event | $4,000 | $6,000 | $8,000 |

Net fee per event is the venue fee **net of F&B passthrough**; `fbProfitPerEvent` (default 0) is there if you want to capture catering margin.

Cost ratios (tuned so the mid case lands near $300k NOI to match the returns tab):

| Line | Value | Base |
|---|---|---|
| Rooms department cost | 30% | rooms revenue |
| Events department cost | 28% | event revenue |
| Admin & general | 9% | total revenue |
| Sales & marketing | 8% | total revenue |
| Property ops & maintenance | 5.5% | total revenue |
| Utilities | 4.5% | total revenue |
| Management fee | 4% | total revenue (set 0 if owner-operated) |
| Property tax | 1.1% | of (acquisition + improvements) basis |
| Insurance | $55,000 | flat annual |
| FF&E reserve | 4% | total revenue |

## Two Ojai-specific flags worth surfacing in the UI

- **Property tax is basis-driven, not a flat number.** It's `1.1% × (acquisition + improvements)` under Prop 13. If the user changes the purchase price on the returns tab, this line should move with it — wire `acquisitionPrice` and `improvements` through from the same inputs.
- **Insurance is elevated and a real risk line.** Ojai is a high wildfire zone; hospitality coverage is expensive and hard to place. It's a flat dollar input, defaulted high ($55k), and should be flagged in the UI as "verify with a real quote," not buried as a percentage.

## FF&E reserve placement

By default the reserve sits **below** the NOI line (NOI is quoted before reserve, the lender/market convention). Pass `{ includeReserveInNOI: true }` for the conservative treatment that deducts it before NOI. Make this a toggle on the tab so the user sees both.

## Wiring it as a tab

1. Include the script before the inline logic in `index.html`:
   ```html
   <script src="hotel-proforma.js"></script>
   ```
2. Build the revenue tab UI (sliders for ADR, occupancy, events/yr, net fee + the cost ratios). On any change:
   ```js
   const pf = HotelProForma.computeProForma(inputs, { includeReserveInNOI: false });
   // render pf.revenue, pf.departmental, pf.undistributed, pf.fixed, pf.noi ...
   ```
3. Feed the result to the returns tab: set the existing `noi` slider's value (and the `noi0` used by `render()`) to `pf.noi`, then call the returns `render()`. The cleanest integration makes the returns tab read NOI from the pro forma rather than its own slider — keep the slider as a manual override if you want both.
4. Share `acquisitionPrice` / `improvements` between the two tabs so property tax stays consistent.

## Honest caveats to keep visible

These are modeling estimates, not market comps or a valuation. The mid case lands around $300–335k NOI depending on how insurance and occupancy are set. A 10-room property has weak labor leverage, so the cost ratios are deliberately heavier than large-hotel benchmarks — but a real operator's budget should replace them before this goes to anyone making a decision.
