/* Lead Desk — browser-local storage.
   Nothing leaves the browser: data lives in localStorage under one key.
   If storage is unavailable (private mode, blocked site data) the demo
   still works in memory for the current visit. */
(function () {
  "use strict";

  var KEY = "leaddesk.demo.v1";
  var VERSION = 4;
  var memory = null;

  function read() {
    try {
      var raw = window.localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return memory;
    }
  }

  function write(state) {
    memory = state;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      /* storage blocked: keep the in-memory copy */
    }
  }

  function fresh() {
    return {
      version: VERSION,
      demoStarted: false,
      settings: defaults(),
      leads: window.LeadDeskData.seedLeads()
    };
  }

  function defaults() {
    return JSON.parse(JSON.stringify(window.LeadDeskData.DEFAULT_SETTINGS));
  }

  // Bring data saved by an earlier version up to the current shape.
  function migrate(s) {
    if (s.version === VERSION) return s;
    s.leads.forEach(function (l) {
      if (l.estimateAt == null) {
        l.estimateAt = l.stage === "Estimate Booked" && l.nextActionDate ? l.nextActionDate + "T09:00" : "";
      }
      if (l.lostReason == null) l.lostReason = l.stage === "Lost" ? "Not ready" : "";
      if (!Array.isArray(l.activity)) l.activity = [];
    });
    // v3: workspace settings; keep any values already saved
    var d = defaults();
    s.settings = s.settings || {};
    Object.keys(d).forEach(function (k) { if (s.settings[k] == null) s.settings[k] = d[k]; });
    // v4: email templates; add any template the saved copy is missing
    Object.keys(d.templates).forEach(function (id) {
      if (!s.settings.templates[id]) s.settings.templates[id] = d.templates[id];
    });
    s.version = VERSION;
    return s;
  }

  function load() {
    var s = read();
    if (!s || !Array.isArray(s.leads)) s = fresh();
    s = migrate(s);
    write(s);
    return s;
  }

  function reset() {
    var s = fresh();
    s.demoStarted = true;
    write(s);
    return s;
  }

  function nextId(state) {
    var max = state.leads.reduce(function (m, l) {
      var n = parseInt(String(l.id).replace(/\D/g, ""), 10);
      return n > m ? n : m;
    }, 1000);
    return "L" + (max + 1);
  }

  window.LeadDeskStore = { load: load, save: write, reset: reset, nextId: nextId, defaultSettings: defaults };
})();
