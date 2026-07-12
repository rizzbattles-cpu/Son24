// TCMB scraper — PLACEHOLDER.
//
// The public duyurular pages are fully SPA-rendered (Adobe Experience
// Manager / IBM WPS) and their content only appears after client-side
// JavaScript executes. Static HTML fetch returns an empty shell.
//
// Options for Stage 3+:
//   1. Register for the EVDS API (evds2.tcmb.gov.tr) and pull rate / policy
//      data as structured metrics. Announce "rate changed X → Y" as an event.
//   2. Add Playwright to CI/GitHub Actions and drive a headless browser to
//      the duyurular page to capture rendered content.
//   3. Subscribe to TCMB PPK decision emails and parse those instead.
//
// Deferred until we have Playwright infra or EVDS API key.
console.log('[tcmb] scraper deferred — needs Playwright or EVDS API');
process.exit(0);
