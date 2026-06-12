#!/usr/bin/env node
// CheatBook QA Agent — self-contained HTML report generator.
// Usage:  node generate-report.mjs <reportDir>
// Reads   <reportDir>/meta.json  and  <reportDir>/findings.jsonl
// Inlines each referenced screenshot from <reportDir>/ as a base64 data URI.
// Writes  <reportDir>/report.html  (single portable file, no external assets).
//
// Defensive by design: a missing/malformed meta or findings file still yields a
// (partial) report so a cut-off run is never lost.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

const dir = process.argv[2];
if (!dir) {
  console.error("Usage: node generate-report.mjs <reportDir>");
  process.exit(1);
}

const SEV_ORDER = ["Blocker", "Critical", "Major", "Minor", "Cosmetic", "UX-suggestion", "Positive"];
const SEV_COLOR = {
  Blocker: "#ff453a", Critical: "#ff6b35", Major: "#ffab00", Minor: "#ffd166",
  Cosmetic: "#8ecae6", "UX-suggestion": "#b794f6", Positive: "#34d399",
};
const CAT_DEFAULT = "General";

function esc(s) {
  if (s === undefined || s === null) return "";
  return String(s)
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
function nl2br(s) { return esc(s).replaceAll("\n", "<br>"); }

function readMeta() {
  const p = join(dir, "meta.json");
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, "utf8")); }
  catch (e) { console.warn("meta.json parse error:", e.message); return {}; }
}
function readFindings() {
  const p = join(dir, "findings.jsonl");
  if (!existsSync(p)) return [];
  const out = [];
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); }
    catch (e) { console.warn("skipping malformed finding line:", e.message); }
  }
  return out;
}
function readChanges() {
  const p = join(dir, "changes.jsonl");
  if (!existsSync(p)) return [];
  const out = [];
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t) continue;
    try { out.push(JSON.parse(t)); } catch { /* skip */ }
  }
  return out;
}

const MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };
function dataUri(rel) {
  if (!rel) return null;
  for (const p of [join(dir, rel), rel]) {
    try {
      if (existsSync(p)) {
        const mime = MIME[extname(p).toLowerCase()] || "image/png";
        return `data:${mime};base64,${readFileSync(p).toString("base64")}`;
      }
    } catch { /* try next candidate */ }
  }
  return null;
}

const meta = readMeta();
const findings = readFindings();
const changes = readChanges();

// ---- counts ----
const counts = Object.fromEntries(SEV_ORDER.map((s) => [s, 0]));
for (const f of findings) {
  const s = SEV_ORDER.includes(f.severity) ? f.severity : "Minor";
  counts[s]++;
}
const defects = findings.filter((f) => f.severity !== "Positive" && f.severity !== "UX-suggestion").length;

// ---- sort: severity rank, then timestamp ----
const rank = (f) => { const i = SEV_ORDER.indexOf(f.severity); return i === -1 ? 3 : i; };
const sorted = [...findings].sort((a, b) => rank(a) - rank(b) || String(a.ts || "").localeCompare(String(b.ts || "")));

function chip(sev, n) {
  const c = SEV_COLOR[sev] || "#9aa";
  const dim = n ? "" : "opacity:.35;";
  return `<span class="chip" style="--c:${c};${dim}"><b>${n}</b> ${esc(sev)}</span>`;
}

function locLine(loc) {
  if (!loc) return "";
  const bits = [];
  if (loc.route) bits.push(`<code>${esc(loc.route)}</code>`);
  if (loc.url) bits.push(`<a href="${esc(loc.url)}">${esc(loc.url)}</a>`);
  if (loc.role) bits.push(`role: ${esc(loc.role)}`);
  if (loc.viewport) bits.push(`viewport: ${esc(loc.viewport)}`);
  return bits.length ? `<div class="loc">${bits.join(" &middot; ")}</div>` : "";
}

function findingCard(f) {
  const sev = SEV_ORDER.includes(f.severity) ? f.severity : "Minor";
  const c = SEV_COLOR[sev];
  const steps = Array.isArray(f.steps) && f.steps.length
    ? `<div class="row"><span class="k">Steps</span><ol class="steps">${f.steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol></div>` : "";
  const ea = (f.expected || f.actual)
    ? `<div class="row ea"><div><span class="k">Expected</span><div>${nl2br(f.expected)}</div></div><div><span class="k">Actual</span><div>${nl2br(f.actual)}</div></div></div>` : "";
  const complaint = f.userComplaint ? `<div class="row"><span class="k">User says</span><blockquote>${nl2br(f.userComplaint)}</blockquote></div>` : "";
  const sugg = f.suggestion ? `<div class="row"><span class="k">Fix</span><div class="sugg">${nl2br(f.suggestion)}</div></div>` : "";
  const ev = f.evidence || {};
  const img = dataUri(ev.screenshot);
  const shot = img ? `<a class="shot" href="${img}" target="_blank"><img loading="lazy" src="${img}" alt="${esc(f.title)}"></a>`
    : (ev.screenshot ? `<div class="noshot">screenshot missing: ${esc(ev.screenshot)}</div>` : "");
  const con = ev.console ? `<div class="row"><span class="k">Console</span><pre>${esc(ev.console)}</pre></div>` : "";
  const net = ev.network ? `<div class="row"><span class="k">Network</span><pre>${esc(ev.network)}</pre></div>` : "";
  const freq = f.frequency ? `<span class="freq">${esc(f.frequency)}</span>` : "";
  return `
  <article class="card" style="--c:${c}" id="${esc(f.id || "")}">
    <header>
      <span class="sev" style="background:${c}">${esc(sev)}</span>
      <span class="cat">${esc(f.category || CAT_DEFAULT)}</span>
      ${f.id ? `<span class="fid">${esc(f.id)}</span>` : ""}
      ${freq}
      <h3>${esc(f.title || "(untitled)")}</h3>
    </header>
    ${locLine(f.location)}
    <div class="body">
      <div class="meatcol">${steps}${ea}${complaint}${sugg}${con}${net}</div>
      ${shot ? `<div class="shotcol">${shot}</div>` : ""}
    </div>
  </article>`;
}

function coverageRows() {
  const cov = Array.isArray(meta.featureCoverage) ? meta.featureCoverage : [];
  if (!cov.length) return "";
  const dot = { done: "#34d399", partial: "#ffab00", blocked: "#ff453a", skipped: "#7a8" };
  return `<table class="cov"><thead><tr><th>Feature / flow</th><th>Status</th><th>Note</th></tr></thead><tbody>${
    cov.map((c) => `<tr><td>${esc(c.feature || c.step)}</td><td><span class="status" style="--d:${dot[c.status] || "#7a8"}">${esc(c.status || "")}</span></td><td>${esc(c.note || "")}</td></tr>`).join("")
  }</tbody></table>`;
}

function teardownRow(t) {
  const items = [
    ["Cleanup ran at", t.ranAt || "—"],
    ["Notebooks created", t.notebooksCreated ?? "—"],
    ["Notebooks deleted", t.notebooksDeleted ?? "—"],
    ["Notes created", t.notesCreated ?? "—"],
    ["Notes deleted (cascade)", t.notesDeleted ?? "—"],
    ["Images deleted", t.imagesDeleted ?? "—"],
    ["Test rows remaining", t.testRowsRemaining ?? "—"],
    ["Profile restored", t.profileRestored ?? "—"],
  ];
  const grid = items.map(([k, v]) => `<div class="kv"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join("");
  const ok = (t.testRowsRemaining === 0 || t.testRowsRemaining === "0");
  const banner = `<div class="teardown-banner ${ok ? "ok" : "warn"}">${ok ? "✓ All test data removed — database clean." : "⚠ Some test data may remain — review the note below."}</div>`;
  return `${banner}<div class="grid">${grid}</div>${t.note ? `<p class="sub" style="margin-top:10px">${nl2br(t.note)}</p>` : ""}`;
}

function changesTable() {
  if (!changes.length) return "";
  return `<table class="cov"><thead><tr><th>Type</th><th>ID</th><th>Title / detail</th><th>Created</th><th>Cleaned</th></tr></thead><tbody>${
    changes.map((c) => `<tr><td>${esc(c.type)}</td><td><code>${esc(c.id || "")}</code></td><td>${esc(c.title || c.detail || "")}</td><td>${esc(c.ts || "")}</td><td>${c.cleaned ? "✓" : "—"}</td></tr>`).join("")
  }</tbody></table>`;
}

function screensList() {
  const sv = Array.isArray(meta.screensVisited) ? meta.screensVisited : [];
  if (!sv.length) return "";
  return `<ul class="screens">${sv.map((s) => {
    if (typeof s === "string") return `<li><code>${esc(s)}</code></li>`;
    return `<li><code>${esc(s.route || s.url || "")}</code>${s.note ? ` — ${esc(s.note)}` : ""}</li>`;
  }).join("")}</ul>`;
}

const defectFindings = sorted.filter((f) => f.severity !== "Positive");
const positives = sorted.filter((f) => f.severity === "Positive");

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>QA Report — CheatBook — ${esc(meta.startedAt || "")}</title>
<style>
  :root{--bg:#0a0a0b;--panel:#111113;--panel2:#0e0e10;--line:#27272a;--txt:#e4e4e7;--mut:#a1a1aa;--brand:#d4a574;}
  *{box-sizing:border-box}
  body{margin:0;background:radial-gradient(1200px 600px at 70% -10%,#18181b00,#0a0a0b),var(--bg);color:var(--txt);
    font:15px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased}
  a{color:#d4a574}
  .wrap{max-width:1080px;margin:0 auto;padding:32px 22px 80px}
  h1{font-size:24px;margin:0 0 2px} h2{font-size:18px;margin:34px 0 12px;color:var(--brand);letter-spacing:.2px}
  .sub{color:var(--mut);margin:0 0 18px}
  .panel{background:linear-gradient(180deg,var(--panel),var(--panel2));border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin:14px 0}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}
  .kv{background:#0d0d0f;border:1px solid var(--line);border-radius:10px;padding:10px 12px}
  .kv .k{display:block;color:var(--mut);font-size:11px;text-transform:uppercase;letter-spacing:.6px}
  .kv .v{font-size:15px;margin-top:2px;word-break:break-word}
  .chips{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 2px}
  .chip{border:1px solid var(--c);color:var(--txt);border-radius:999px;padding:4px 11px;font-size:13px;background:color-mix(in srgb,var(--c) 14%,transparent)}
  .chip b{color:var(--c)}
  .summary{white-space:pre-wrap}
  .teardown-banner{border-radius:10px;padding:10px 14px;margin-bottom:12px;font-weight:600}
  .teardown-banner.ok{background:color-mix(in srgb,#34d399 14%,transparent);border:1px solid #34d399;color:#9ff0cf}
  .teardown-banner.warn{background:color-mix(in srgb,#ffab00 14%,transparent);border:1px solid #ffab00;color:#ffd98a}
  table.cov{width:100%;border-collapse:collapse;margin-top:6px}
  table.cov th,table.cov td{text-align:left;padding:7px 10px;border-bottom:1px solid var(--line);font-size:14px;vertical-align:top}
  table.cov th{color:var(--mut);font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.5px}
  .status::before{content:"";display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--d);margin-right:7px;vertical-align:middle}
  ul.screens{columns:2;margin:4px 0;padding-left:18px} ul.screens li{margin:2px 0}
  code{background:#0d0d0f;border:1px solid var(--line);border-radius:5px;padding:1px 6px;font:12.5px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}
  .card{background:linear-gradient(180deg,var(--panel),var(--panel2));border:1px solid var(--line);border-left:4px solid var(--c);
    border-radius:12px;padding:14px 16px;margin:12px 0}
  .card header{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .card header h3{flex:1 1 100%;margin:8px 0 0;font-size:16px}
  .sev{color:#0a0a0b;font-weight:700;font-size:11px;text-transform:uppercase;letter-spacing:.5px;padding:3px 8px;border-radius:6px}
  .cat{color:var(--mut);font-size:12px;border:1px solid var(--line);border-radius:6px;padding:2px 7px}
  .fid{color:var(--mut);font-size:12px;font-family:ui-monospace,monospace}
  .freq{color:var(--mut);font-size:12px;font-style:italic}
  .loc{color:var(--mut);font-size:12.5px;margin:8px 0 2px}
  .body{display:grid;grid-template-columns:1fr;gap:14px;margin-top:8px}
  @media(min-width:760px){.body:has(.shotcol){grid-template-columns:1.25fr .75fr}}
  .row{margin:9px 0} .k{display:block;color:var(--mut);font-size:11px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:2px}
  .ea{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  ol.steps{margin:2px 0 0;padding-left:20px} ol.steps li{margin:1px 0}
  blockquote{margin:2px 0;padding:6px 12px;border-left:3px solid var(--brand);background:#0d0d0f;border-radius:4px;color:#e9d9af;font-style:italic}
  .sugg{color:#cfe9d6}
  pre{background:#0d0d0f;border:1px solid var(--line);border-radius:8px;padding:9px 11px;overflow:auto;font:12px/1.45 ui-monospace,monospace;color:#ffd1cf}
  .shot img{width:100%;border:1px solid var(--line);border-radius:8px;display:block}
  .noshot{color:var(--mut);font-size:12px;border:1px dashed var(--line);border-radius:8px;padding:10px}
  footer{color:var(--mut);font-size:12px;margin-top:40px;border-top:1px solid var(--line);padding-top:14px}
  .empty{color:var(--mut);font-style:italic}
</style></head>
<body><div class="wrap">
  <h1>QA Report — CheatBook</h1>
  <p class="sub">Autonomous exploratory test &middot; ${esc(meta.environment || "")} &middot; account: <b>${esc(meta.account || "?")}</b></p>

  <div class="panel">
    <div class="grid">
      <div class="kv"><span class="k">Requested</span><span class="v">${esc(meta.requestedDuration || (meta.requestedMinutes ? meta.requestedMinutes + " min" : "—"))}</span></div>
      <div class="kv"><span class="k">Actual run</span><span class="v">${esc(meta.actualMinutes != null ? meta.actualMinutes + " min" : "—")}</span></div>
      <div class="kv"><span class="k">Started</span><span class="v">${esc(meta.startedAt || "—")}</span></div>
      <div class="kv"><span class="k">Ended</span><span class="v">${esc(meta.endedAt || "—")}</span></div>
      <div class="kv"><span class="k">Run tag</span><span class="v">${esc(meta.runTag || "—")}</span></div>
      <div class="kv"><span class="k">Findings</span><span class="v">${findings.length} (${defects} defects)</span></div>
    </div>
    <div class="chips">${SEV_ORDER.map((s) => chip(s, counts[s])).join("")}</div>
  </div>

  <h2>Executive summary</h2>
  <div class="panel summary">${meta.summary ? nl2br(meta.summary) : '<span class="empty">No summary recorded.</span>'}</div>

  <h2>Where it got to</h2>
  <div class="panel">${meta.whereItGotTo ? nl2br(meta.whereItGotTo) : '<span class="empty">Not recorded.</span>'}
    ${coverageRows()}
  </div>

  ${meta.teardown ? `<h2>Teardown — database cleanup</h2><div class="panel">${teardownRow(meta.teardown)}</div>` : ""}

  ${changes.length ? `<h2>Data created this run &middot; ${changes.length}</h2><div class="panel">${changesTable()}</div>` : ""}

  ${(Array.isArray(meta.screensVisited) && meta.screensVisited.length) ? `<h2>Screens visited</h2><div class="panel">${screensList()}</div>` : ""}

  <h2>Findings &middot; ${defectFindings.length}</h2>
  ${defectFindings.length ? defectFindings.map(findingCard).join("") : '<div class="panel empty">No defects or suggestions logged.</div>'}

  ${positives.length ? `<h2>What worked well &middot; ${positives.length}</h2>${positives.map(findingCard).join("")}` : ""}

  <footer>
    Generated by the CheatBook QA Agent &middot; ${findings.length} findings &middot; screenshots embedded inline.
    Source: <code>${esc(dir)}</code>
  </footer>
</div>
</body></html>`;

const outPath = join(dir, "report.html");
writeFileSync(outPath, html, "utf8");
console.log("Wrote", outPath, `(${findings.length} findings, ${defects} defects)`);
