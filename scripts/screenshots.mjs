// Capture Lead Desk case-study screenshots with headless Edge over CDP.
// Usage: npm start (in another terminal), then: node scripts/screenshots.mjs docs/screenshots
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OUT = process.argv[2];
const BASE = "http://localhost:5173/";
// Path to a Chromium browser; override with the BROWSER env var.
const EDGE = process.env.BROWSER || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
const PORT = 9333;
mkdirSync(OUT, { recursive: true });

const profile = mkdtempSync(join(tmpdir(), "leaddesk-shots-"));
const edge = spawn(EDGE, ["--headless=new", `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  "--hide-scrollbars", "--no-first-run", "about:blank"], { stdio: "ignore" });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets;
for (let i = 0; i < 50; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); if (targets.length) break; } catch {}
  await sleep(200);
}
const page = targets.find((t) => t.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let id = 0; const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const run = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: `(async()=>{${expr}})()`, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
  return r.result?.result?.value;
};
const size = (w, h, mobile = false) => send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 2, mobile });
const go = async (hash) => { await run(`location.hash=${JSON.stringify(hash)}; await new Promise(r=>setTimeout(r,250));`); };
const shot = async (name) => {
  await run("await document.fonts.ready; document.getElementById('toast').classList.remove('show'); await new Promise(r=>setTimeout(r,400));");
  const r = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(OUT, name), Buffer.from(r.result.data, "base64"));
  console.log("saved", name);
};

await send("Page.enable");
await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
await size(1440, 900);
await send("Page.navigate", { url: BASE });
await sleep(1500);
await run("localStorage.clear(); location.reload();");
await sleep(1500);

await shot("01-landing.png");

await go("#/desk");
await shot("02-lead-desk.png");

await go("#/desk/L1009");
await shot("03-lead-detail.png");

await go("#/desk/L1004");
await run(`document.querySelector('.detail #p-email').click(); await new Promise(r=>setTimeout(r,100));
  const p=document.querySelector('.detail'); p.scrollTop = document.getElementById('h-email').offsetTop - 16;`);
await shot("04-simulated-email.png");

await go("#/inquiry");
await run(`document.getElementById('inq-fill').click();
  const set=(s,v)=>{document.querySelector(s).value=v};
  set('#inq-name','Rosa Delgado'); set('#inq-email','rosa.delgado@example.com'); set('#inq-phone','(614) 555-0142');
  set('#inq-zip','43209'); set('#inq-service','No heat'); set('#inq-best','Morning');
  set('#inq-notes','Furnace is blowing cold air since this morning.');
  document.querySelector('input[name=homeowner][value=Owner]').checked=true;
  document.querySelector('#f-inquiry button[type=submit]').click(); await new Promise(r=>setTimeout(r,300));`);
await shot("05-inquiry-confirmation.png");

await size(390, 844, true);
await run("localStorage.clear(); location.hash='#/desk'; location.reload();");
await sleep(1500);
await shot("06-mobile-desk.png");

ws.close();
edge.kill();
process.exit(0);
