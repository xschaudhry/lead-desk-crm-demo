/* Lead Desk — app
   Milestone 1: landing, demo entry, lead desk, read-only detail.
   Milestone 2: stage changes, editing, notes, follow-ups, add lead,
                archive / restore, overdue marking.
   Hash routes:  #/            landing
                 #/desk        lead desk
                 #/desk/L1001  lead desk with a lead's detail panel open
                 #/desk/new    lead desk with the add-lead panel open */
(function () {
  "use strict";

  var D = window.LeadDeskData;
  var Store = window.LeadDeskStore;
  var state = Store.load();

  var STAGE_VAR = {
    "New": "--st-new",
    "Contacted": "--st-contacted",
    "Qualified": "--st-qualified",
    "Estimate Booked": "--st-booked",
    "Won": "--st-won",
    "Lost": "--st-lost"
  };

  var STAGE_HELP = {
    "New": "Inquiry just arrived; nobody has replied yet.",
    "Contacted": "First reply made; waiting on details.",
    "Qualified": "In the service area and a real job.",
    "Estimate Booked": "In-home estimate is on the schedule.",
    "Won": "Job sold.",
    "Lost": "Closed without a job."
  };

  // Stages a manually added lead can start in (later stages need extra details).
  var ADD_STAGES = ["New", "Contacted", "Qualified"];

  var FIELD_LABELS = {
    name: "name", phone: "phone", email: "email", zip: "ZIP code",
    service: "service need", homeowner: "homeowner status", source: "source", notes: "intake notes"
  };

  // filters persist for the visit, not across reloads
  function freshFilters() { return { q: "", stage: "all", source: "all", archived: false }; }
  var filters = freshFilters();
  var lastFocus = null;
  var editing = false;   // detail panel shows the edit form
  var emailOpen = false; // detail panel shows the email composer
  var postSend = false;  // detail panel offers "Set next follow-up" after a simulated send
  var settingsDirty = false;

  var main = document.getElementById("main");
  var actions = document.getElementById("topbar-actions");

  /* ---------- helpers ---------- */

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function stageColor(stage) { return "var(" + STAGE_VAR[stage] + ")"; }
  function isClosed(lead) { return lead.stage === "Won" || lead.stage === "Lost"; }
  function isUrgent(lead) { return D.URGENT_SERVICES.indexOf(lead.service) !== -1 && !isClosed(lead); }
  function byId(id) { return state.leads.filter(function (l) { return l.id === id; })[0]; }
  function save() { Store.save(state); }

  function todayYmd() {
    var t = new Date();
    return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");
  }
  function addDaysYmd(n) {
    var t = new Date(); t.setDate(t.getDate() + n);
    return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");
  }
  function isOverdue(lead) {
    return !!lead.nextActionDate && !isClosed(lead) && lead.nextActionDate < todayYmd();
  }

  function relTime(iso) {
    var mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + " min ago";
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + " hr ago";
    var days = Math.round(hrs / 24);
    return days === 1 ? "yesterday" : days + " days ago";
  }
  function fmtDateTime(iso) {
    return new Date(iso).toLocaleString(undefined, {
      weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
    });
  }
  function parseYmd(ymd) { var p = ymd.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function fmtDay(ymd) {
    return parseYmd(ymd).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  }
  function fmtDate(ymd) {
    if (!ymd) return "No date set";
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var diff = Math.round((parseYmd(ymd) - today) / 86400000);
    if (diff === 0) return "Today, " + fmtDay(ymd);
    if (diff === 1) return "Tomorrow, " + fmtDay(ymd);
    if (diff < 0) return "Overdue, " + fmtDay(ymd);
    return fmtDay(ymd);
  }
  function fmtPhone(p) {
    var d = String(p).replace(/\D/g, "");
    if (d.length === 11 && d[0] === "1") d = d.slice(1);
    return d.length === 10 ? "(" + d.slice(0, 3) + ") " + d.slice(3, 6) + "-" + d.slice(6) : p;
  }

  function log(lead, kind, text) {
    lead.activity.unshift({ at: new Date().toISOString(), kind: kind, text: text });
  }

  var toastTimer;
  function toast(msg) {
    var t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  function options(list, selected) {
    return list.map(function (v) {
      return '<option value="' + esc(v) + '"' + (v === selected ? " selected" : "") + ">" + esc(v) + "</option>";
    }).join("");
  }

  /* ---------- forms: validation and errors ---------- */

  function validateLead(v) {
    var e = {};
    var name = (v.name || "").trim();
    if (name.length < 2 || name.length > 60) e.name = "Enter a name (any made-up name is fine).";
    if ((v.phone || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "").length !== 10) {
      e.phone = "Enter a 10-digit phone number, for example (614) 555-0142.";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v.email || "").trim())) e.email = "Enter an email like name@example.com.";
    if (!/^\d{5}$/.test((v.zip || "").trim())) e.zip = "Enter a 5-digit ZIP code.";
    if (D.SERVICES.indexOf(v.service) === -1) e.service = "Choose a service.";
    if (D.HOMEOWNER.indexOf(v.homeowner) === -1) e.homeowner = "Choose one.";
    if ((v.notes || "").length > 500) e.notes = "Keep notes under 500 characters.";
    return e;
  }

  function readForm(form) {
    var out = {};
    new FormData(form).forEach(function (val, key) { out[key] = String(val); });
    return out;
  }

  function clearErrors(form) {
    Array.prototype.forEach.call(form.querySelectorAll(".error"), function (n) { n.remove(); });
    Array.prototype.forEach.call(form.querySelectorAll("[aria-invalid]"), function (n) {
      n.removeAttribute("aria-invalid");
      var d = (n.getAttribute("aria-describedby") || "").split(" ").filter(function (x) { return x.indexOf("err-") !== 0; });
      if (d.length) n.setAttribute("aria-describedby", d.join(" ")); else n.removeAttribute("aria-describedby");
    });
  }

  // errors: { fieldName: message }. Returns true when there were errors.
  function showErrors(form, errors) {
    clearErrors(form);
    var first = null;
    Object.keys(errors).forEach(function (key) {
      var inputs = form.querySelectorAll('[name="' + key + '"]');
      if (!inputs.length) return;
      var errId = "err-" + form.id + "-" + key;
      var p = document.createElement("p");
      p.className = "error"; p.id = errId; p.textContent = errors[key];
      var host = inputs[0].type === "radio" ? inputs[0].closest("fieldset") : inputs[0].closest(".field");
      host.appendChild(p);
      Array.prototype.forEach.call(inputs, function (inp) {
        inp.setAttribute("aria-invalid", "true");
        var d = inp.getAttribute("aria-describedby");
        inp.setAttribute("aria-describedby", (d ? d + " " : "") + errId);
      });
      if (!first) first = inputs[0];
    });
    if (first) first.focus();
    return !!first;
  }

  function field(id, label, control, hint) {
    return '<div class="field"><label for="' + id + '">' + esc(label) + "</label>" +
      (hint ? '<p class="hint" id="' + id + '-hint">' + esc(hint) + "</p>" : "") + control + "</div>";
  }

  // Shared lead fields for the edit form and the add-lead form.
  function leadFieldsHtml(prefix, l, withSourceStage) {
    var radios = D.HOMEOWNER.map(function (h) {
      return '<label class="radio"><input type="radio" name="homeowner" value="' + esc(h) + '"' +
        (l.homeowner === h ? " checked" : "") + "> " + esc(h) + "</label>";
    }).join("");
    return '<div class="form-grid">' +
      field(prefix + "-name", "Full name",
        '<input id="' + prefix + '-name" name="name" type="text" autocomplete="off" maxlength="60" value="' + esc(l.name) + '">') +
      field(prefix + "-phone", "Phone",
        '<input id="' + prefix + '-phone" name="phone" type="tel" autocomplete="off" value="' + esc(l.phone) + '">') +
      field(prefix + "-email", "Email",
        '<input id="' + prefix + '-email" name="email" type="email" autocomplete="off" value="' + esc(l.email) + '">') +
      field(prefix + "-zip", "ZIP code",
        '<input id="' + prefix + '-zip" name="zip" type="text" inputmode="numeric" maxlength="5" autocomplete="off" value="' + esc(l.zip) + '">') +
      '<div class="span-2">' + field(prefix + "-service", "Service need",
        '<select id="' + prefix + '-service" name="service">' +
          (l.service ? "" : '<option value="">Choose a service</option>') + options(D.SERVICES, l.service) + "</select>") + "</div>" +
      '<fieldset class="span-2 radio-group"><legend>Homeowner status</legend>' + radios + "</fieldset>" +
      (withSourceStage
        ? field(prefix + "-source", "Source", '<select id="' + prefix + '-source" name="source">' + options(D.SOURCES, l.source) + "</select>") +
          field(prefix + "-stage", "Starting stage", '<select id="' + prefix + '-stage" name="stage">' + options(ADD_STAGES, l.stage) + "</select>")
        : field(prefix + "-source", "Source", '<select id="' + prefix + '-source" name="source">' + options(D.SOURCES, l.source) + "</select>")) +
      '<div class="span-2">' + field(prefix + "-notes", "Intake notes",
        '<textarea id="' + prefix + '-notes" name="notes" rows="3" maxlength="500">' + esc(l.notes) + "</textarea>") + "</div>" +
    "</div>";
  }

  /* ---------- landing ---------- */

  function renderLanding() {
    document.title = "Lead Desk — HVAC CRM demo";
    actions.innerHTML = state.demoStarted
      ? '<a class="btn btn-quiet" href="#/desk">Open lead desk</a>'
      : "";

    var runItems = D.STAGES.map(function (s) {
      return '<li style="--c:' + stageColor(s) + '"><strong>' + esc(s) + "</strong><span>" +
        esc(STAGE_HELP[s]) + "</span></li>";
    }).join("");

    main.innerHTML =
      '<div class="landing">' +
        '<section class="hero" aria-labelledby="hero-title">' +
          "<div>" +
            '<h1 id="hero-title">Every heating and cooling inquiry, from first ring to booked estimate.</h1>' +
            '<p class="lede">Lead Desk is a working CRM demo for an HVAC service desk. Review new inquiries, ' +
              "see who is without heat right now, and move each lead toward an estimate visit.</p>" +
            '<div class="hero-actions">' +
              '<button class="btn" type="button" id="start-demo">Continue as demo</button>' +
              '<a class="btn btn-quiet" href="#/inquiry">Try the sample inquiry form</a>' +
            "</div>" +
            '<p class="hero-note">No sign-in and no password. Sample leads are fictional and stay in this browser. ' +
              "Nothing is emailed, texted or called.</p>" +
          "</div>" +
          '<article class="ticket" aria-label="Example lead, fictional">' +
            '<div class="ticket-head"><span class="ticket-id">Sample lead L1001</span>' +
              '<span class="need urgent">No heat</span></div>' +
            "<h2>Dana Whitlock</h2>" +
            '<p class="ticket-meta">Facebook ad survey, received today</p>' +
            "<dl>" +
              "<dt>ZIP code</dt><dd>43207</dd>" +
              "<dt>Homeowner</dt><dd>Owner</dd>" +
              "<dt>Notes</dt><dd>Furnace stopped overnight; two kids at home.</dd>" +
            "</dl>" +
            '<div class="ticket-next"><span>Call back within 15 minutes</span>' +
              '<span class="stage-pill" style="--c:' + stageColor("New") + '">New</span></div>' +
          "</article>" +
        "</section>" +

        '<section class="run-section" id="how" aria-labelledby="how-title">' +
          '<h2 id="how-title">Six stages, one direction</h2>' +
          "<p>Each lead moves left to right. The desk counts every stage so the team can see where " +
            "inquiries are piling up before they go cold.</p>" +
          '<ol class="run-explain">' + runItems + "</ol>" +
        "</section>" +

        '<footer class="landing-foot">' +
          "<p>Lead Desk is an independent portfolio demonstration by Chaudhry Usman. " + esc(bizName()) +
            " and every lead, name, phone number and email in it are invented. The demo shows a workflow; " +
            "it has not been measured with real customers and reports no real results.</p>" +
        "</footer>" +
      "</div>";

    document.getElementById("start-demo").addEventListener("click", function () {
      state.demoStarted = true;
      save();
      location.hash = "#/desk";
    });
  }

  /* ---------- desk ---------- */

  function viewLeads() {
    return state.leads.filter(function (l) { return !!l.archived === filters.archived; });
  }

  function filtered() {
    var q = filters.q.trim().toLowerCase();
    return viewLeads()
      .filter(function (l) {
        if (filters.stage !== "all" && l.stage !== filters.stage) return false;
        if (filters.source !== "all" && l.source !== filters.source) return false;
        if (!q) return true;
        return [l.name, l.service, l.zip, l.email, l.phone, l.notes, l.id]
          .join(" ").toLowerCase().indexOf(q) !== -1;
      })
      .sort(function (a, b) {
        // people without heat/cooling first, then overdue, then newest
        return (isUrgent(b) - isUrgent(a)) || (isOverdue(b) - isOverdue(a)) ||
          new Date(b.createdAt) - new Date(a.createdAt);
      });
  }

  function renderDesk(openId) {
    document.title = "Lead desk — Lead Desk demo";
    actions.innerHTML =
      '<button class="btn btn-quiet" type="button" id="reset-demo">Reset demo data</button>' +
      '<a class="btn btn-quiet" href="#/settings">Settings</a>' +
      '<a class="btn btn-quiet" href="#/">Overview</a>';
    document.getElementById("reset-demo").addEventListener("click", function () {
      if (!window.confirm("Reset the demo? This restores the original sample leads in this browser and removes any changes.")) return;
      state = Store.reset();
      filters = freshFilters();
      lastView = null;
      if (location.hash === "#/desk") route(); else location.hash = "#/desk";
      toast("Demo data reset");
    });

    main.innerHTML =
      '<div class="desk">' +
        '<div class="desk-head">' +
          '<div><h1 id="desk-title"></h1>' +
          "<p>" + esc(bizName()) + ". Sample leads only, stored in this browser.</p></div>" +
          '<div class="desk-head-actions">' +
            '<button class="btn btn-quiet" type="button" id="toggle-archived" aria-pressed="false"></button>' +
            '<a class="btn btn-quiet" href="#/inquiry">Add sample inquiry</a>' +
            '<button class="btn" type="button" id="add-lead">Add lead</button>' +
          "</div>" +
        "</div>" +
        '<div class="duct" role="group" aria-label="Filter by stage" id="duct"></div>' +
        '<div class="toolbar">' +
          '<div class="field field-search"><label for="q">Search leads</label>' +
            '<input id="q" type="search" placeholder="Name, ZIP, service need, phone" value="' + esc(filters.q) + '" autocomplete="off"></div>' +
          '<div class="field"><label for="source">Source</label><select id="source">' +
            '<option value="all">All sources</option>' + options(D.SOURCES, filters.source) + "</select></div>" +
          '<p class="result-count" id="count" aria-live="polite"></p>' +
        "</div>" +
        '<div class="table-wrap" id="table"></div>' +
      "</div>";

    document.getElementById("q").addEventListener("input", function (e) {
      filters.q = e.target.value; paintDuct(); paintTable();
    });
    document.getElementById("source").addEventListener("change", function (e) {
      filters.source = e.target.value; paintDuct(); paintTable();
    });
    document.getElementById("toggle-archived").addEventListener("click", function () {
      filters.archived = !filters.archived;
      filters.stage = "all";
      paintAll();
      document.getElementById("toggle-archived").focus();
    });
    document.getElementById("add-lead").addEventListener("click", function () {
      lastFocus = "add";
      location.hash = "#/desk/new";
    });

    paintAll();
    closePanel(true);
    if (openId) openPanel(openId);
  }

  function paintHead() {
    var archivedCount = state.leads.filter(function (l) { return l.archived; }).length;
    document.getElementById("desk-title").textContent = filters.archived ? "Archived leads" : "Lead desk";
    var t = document.getElementById("toggle-archived");
    t.setAttribute("aria-pressed", String(filters.archived));
    t.textContent = filters.archived ? "Back to active leads" : "Archived leads (" + archivedCount + ")";
  }

  function paintAll() { paintHead(); paintDuct(); paintTable(); }

  function paintDuct() {
    var leads = viewLeads();
    var cells = [{ key: "all", label: filters.archived ? "All archived" : "All leads", n: leads.length, c: "var(--ink)" }].concat(
      D.STAGES.map(function (s) {
        return {
          key: s, label: s, c: stageColor(s),
          n: leads.filter(function (l) { return l.stage === s; }).length
        };
      })
    );
    var duct = document.getElementById("duct");
    duct.innerHTML = cells.map(function (c) {
      return '<button type="button" data-stage="' + esc(c.key) + '" style="--c:' + c.c + '" aria-pressed="' +
        (filters.stage === c.key) + '"><span class="n">' + c.n + '</span><span class="l">' + esc(c.label) +
        "</span></button>";
    }).join("");
    Array.prototype.forEach.call(duct.querySelectorAll("button"), function (b) {
      b.addEventListener("click", function () {
        filters.stage = b.getAttribute("data-stage");
        paintDuct(); paintTable();
        duct.querySelector('[data-stage="' + filters.stage + '"]').focus();
      });
    });
  }

  function paintTable() {
    var rows = filtered();
    var total = viewLeads().length;
    var noun = (filters.archived ? " archived lead" : " lead") + (total === 1 ? "" : "s");
    document.getElementById("count").textContent =
      rows.length === total ? total + noun : rows.length + " of " + total + noun;

    var wrap = document.getElementById("table");
    if (!rows.length) {
      var filteredOut = total > 0;
      wrap.innerHTML = '<div class="empty"><p>' +
        (filteredOut ? "No leads match these filters." :
          filters.archived ? "No archived leads. Archiving a lead hides it from the desk without deleting it." :
          "No active leads. Add a lead to get started.") + "</p>" +
        (filteredOut ? '<button class="btn btn-quiet" type="button" id="clear">Clear filters</button>' : "") + "</div>";
      var clear = document.getElementById("clear");
      if (clear) clear.addEventListener("click", function () {
        var arch = filters.archived;
        filters = freshFilters(); filters.archived = arch;
        renderDesk();
      });
      return;
    }

    var openId = currentOpenId();
    wrap.innerHTML =
      '<table class="leads"><caption class="visually-hidden">' + (filters.archived ? "Archived sample HVAC leads" : "Sample HVAC leads") +
      "</caption><thead><tr>" +
        '<th scope="col">Lead</th><th scope="col">Service need</th><th scope="col">Stage</th>' +
        '<th scope="col">Source</th><th scope="col">ZIP</th><th scope="col">Received</th>' +
        '<th scope="col">Next action</th>' +
        (filters.archived ? '<th scope="col"><span class="visually-hidden">Restore</span></th>' : "") +
      "</tr></thead><tbody>" +
      rows.map(function (l) {
        var over = isOverdue(l);
        return "<tr" + (l.id === openId ? ' class="is-open"' : "") + ">" +
          '<td data-label="Lead"><button class="lead-name" type="button" aria-haspopup="dialog" data-id="' + esc(l.id) + '">' +
            esc(l.name) + '</button><span class="sub">' + esc(l.phone) + "</span></td>" +
          '<td data-label="Service need"><span class="need' + (isUrgent(l) ? " urgent" : "") + '">' +
            esc(l.service) + "</span></td>" +
          '<td data-label="Stage"><span class="stage-pill" style="--c:' + stageColor(l.stage) + '">' +
            esc(l.stage) + "</span></td>" +
          '<td data-label="Source">' + esc(l.source) + "</td>" +
          '<td data-label="ZIP">' + esc(l.zip) + "</td>" +
          '<td data-label="Received"><time datetime="' + esc(l.createdAt) + '" title="' +
            esc(fmtDateTime(l.createdAt)) + '">' + esc(relTime(l.createdAt)) + "</time></td>" +
          '<td data-label="Next action">' + esc(l.nextAction || "None set") +
            (l.nextActionDate ? '<span class="sub' + (over ? " overdue" : "") + '">' + esc(fmtDate(l.nextActionDate)) + "</span>" : "") + "</td>" +
          (filters.archived
            ? '<td><button class="btn btn-quiet btn-sm" type="button" data-restore="' + esc(l.id) + '">Restore<span class="visually-hidden"> ' + esc(l.name) + "</span></button></td>"
            : "") +
        "</tr>";
      }).join("") +
      "</tbody></table>";

    Array.prototype.forEach.call(wrap.querySelectorAll(".lead-name"), function (b) {
      b.addEventListener("click", function () {
        lastFocus = b.getAttribute("data-id");
        location.hash = "#/desk/" + lastFocus;
      });
    });
    Array.prototype.forEach.call(wrap.querySelectorAll("[data-restore]"), function (b) {
      b.addEventListener("click", function () { restoreLead(byId(b.getAttribute("data-restore"))); });
    });
  }

  /* ---------- lead actions ---------- */

  function archiveLead(lead) {
    if (!window.confirm("Archive " + lead.name + "? The lead is hidden from the desk and can be restored from Archived leads.")) return;
    lead.archived = true;
    log(lead, "archived", "Lead archived.");
    save();
    toast("Lead archived");
    lastFocus = null;
    location.hash = "#/desk";
    setTimeout(function () { document.getElementById("toggle-archived").focus(); }, 0);
  }

  function restoreLead(lead) {
    if (!lead) return;
    lead.archived = false;
    log(lead, "restored", "Lead restored from the archive.");
    save();
    toast("Lead restored");
    if (currentOpenId() === lead.id) {
      paintAll(); renderPanel(lead, "#detail-title");
    } else {
      paintAll();
      var t = document.getElementById("toggle-archived");
      if (t) t.focus();
    }
  }

  /* ---------- panel shell ---------- */

  function currentOpenId() {
    var m = location.hash.match(/^#\/desk\/(L\d+|new)$/);
    return m ? m[1] : null;
  }

  function openPanel(id) {
    if (id !== "new" && !byId(id)) { location.hash = "#/desk"; return; }
    editing = false; emailOpen = false; postSend = false;

    var scrim = document.createElement("div");
    scrim.className = "scrim";
    scrim.addEventListener("click", function () { location.hash = "#/desk"; });

    var panel = document.createElement("aside");
    panel.className = "detail";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "detail-title");
    panel.addEventListener("keydown", trapFocus);

    document.body.appendChild(scrim);
    document.body.appendChild(panel);
    setBackgroundInert(true);

    if (id === "new") renderAddPanel(); else renderPanel(byId(id));
    document.getElementById("detail-title").focus();
  }

  function trapFocus(e) {
    if (e.key === "Escape") { location.hash = "#/desk"; return; }
    if (e.key !== "Tab") return;
    var f = Array.prototype.filter.call(
      this.querySelectorAll("button, a[href], input, select, textarea, [tabindex]:not([tabindex='-1'])"),
      function (n) { return !n.disabled && n.offsetParent !== null; }
    );
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function closePanel(silent) {
    var p = document.querySelector(".detail"), s = document.querySelector(".scrim");
    if (p) p.remove();
    setBackgroundInert(false);
    if (s) s.remove();
    editing = false; emailOpen = false; postSend = false;
    if (!silent && lastFocus) {
      var b = lastFocus === "add"
        ? document.getElementById("add-lead")
        : document.querySelector('.lead-name[data-id="' + lastFocus + '"]');
      if (b) b.focus();
    }
  }

  // While the panel is open, the page behind it cannot be reached by keyboard or screen reader.
  function setBackgroundInert(on) {
    [main, document.querySelector(".topbar"), document.querySelector(".skip")].forEach(function (el) {
      if (!el) return;
      if (on) el.setAttribute("inert", ""); else el.removeAttribute("inert");
    });
  }

  function panelEl() { return document.querySelector(".detail"); }

  /* ---------- lead detail panel ---------- */

  function renderPanel(lead, focusSel) {
    var panel = panelEl();
    if (!panel) return;
    var over = isOverdue(lead);
    var acts = lead.activity.slice().sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
    var defaultEstimate = lead.estimateAt || addDaysYmd(1) + "T09:00";

    panel.innerHTML =
      '<div class="detail-top"><h2 id="detail-title" tabindex="-1">' + esc(lead.name) + "</h2>" +
        '<button class="close" type="button" aria-label="Close lead details">&times;</button></div>' +
      '<p class="detail-sample">' + esc(lead.id) + (lead.sample ? ", fictional sample lead" : ", added in this browser") + "</p>" +
      (lead.archived
        ? '<div class="archived-banner"><p>This lead is archived and hidden from the desk.</p>' +
            '<button class="btn btn-quiet btn-sm" type="button" id="p-restore">Restore lead</button></div>'
        : "") +
      '<div class="detail-stage"><span class="stage-pill" style="--c:' + stageColor(lead.stage) + '">' +
        esc(lead.stage) + '</span><span class="need' + (isUrgent(lead) ? " urgent" : "") + '">' +
        esc(lead.service) + "</span></div>" +
      '<div class="next-box' + (over ? " is-overdue" : "") + '"><strong>Next action: ' + esc(lead.nextAction || "None set") + "</strong>" +
        "<span>" + esc(fmtDate(lead.nextActionDate)) + "</span>" +
        (lead.stage === "Estimate Booked" && lead.estimateAt ? "<span>Estimate visit " + esc(fmtDateTime(lead.estimateAt)) + "</span>" : "") +
        (lead.stage === "Lost" && lead.lostReason ? "<span>Lost reason: " + esc(lead.lostReason) + "</span>" : "") +
      "</div>" +

      // stage
      '<section class="p-sec" aria-labelledby="h-stage"><h3 id="h-stage">Stage</h3>' +
        '<form id="f-stage" novalidate>' +
          field("stage-sel", "Move this lead to", '<select id="stage-sel" name="stage">' + options(D.STAGES, lead.stage) + "</select>") +
          '<div id="stage-extra"></div>' +
          '<button class="btn btn-sm" type="submit">Update stage</button>' +
        "</form>" +
      "</section>" +

      // follow-up email (simulated)
      (lead.archived ? "" : emailSectionHtml(lead)) +

      // follow-up
      '<section class="p-sec" aria-labelledby="h-follow"><h3 id="h-follow">Follow-up</h3>' +
        '<form id="f-follow" novalidate><div class="form-grid">' +
          '<div class="span-2">' + field("follow-text", "What happens next",
            '<input id="follow-text" name="nextAction" type="text" maxlength="80" value="' + esc(lead.nextAction) + '">') + "</div>" +
          field("follow-date", "Due date",
            '<input id="follow-date" name="nextActionDate" type="date" value="' + esc(lead.nextActionDate) + '">') +
          '<div class="field field-end"><button class="btn btn-sm" type="submit">Save follow-up</button></div>' +
        "</div></form>" +
      "</section>" +

      // notes
      '<section class="p-sec" aria-labelledby="h-note"><h3 id="h-note">Add a note</h3>' +
        '<form id="f-note" novalidate>' +
          field("note-text", "Note", '<textarea id="note-text" name="note" rows="2" maxlength="500" placeholder="For example: Left voicemail, will try again after 4 pm."></textarea>') +
          '<button class="btn btn-sm" type="submit">Add note</button>' +
        "</form>" +
      "</section>" +

      // details
      '<section class="p-sec" aria-labelledby="h-details"><div class="sec-head"><h3 id="h-details">Lead details</h3>' +
        (editing ? "" : '<button class="btn btn-quiet btn-sm" type="button" id="p-edit">Edit details</button>') + "</div>" +
        (editing
          ? '<form id="f-edit" novalidate>' + leadFieldsHtml("ed", lead, false) +
              '<div class="form-actions"><button class="btn btn-sm" type="submit">Save changes</button>' +
              '<button class="btn btn-quiet btn-sm" type="button" id="p-cancel">Cancel</button></div></form>'
          : "<dl>" +
              "<dt>Service need</dt><dd>" + esc(lead.service) + "</dd>" +
              "<dt>ZIP code</dt><dd>" + esc(lead.zip) + ' <span class="area ' + (inServiceArea(lead.zip) ? "in" : "out") + '">' +
                (inServiceArea(lead.zip) ? "Inside the service area" : "Outside the service area") + "</span></dd>" +
              "<dt>Homeowner status</dt><dd>" + esc(lead.homeowner) + "</dd>" +
              "<dt>Source</dt><dd>" + esc(lead.source) + "</dd>" +
              "<dt>Phone</dt><dd>" + esc(lead.phone) + "</dd>" +
              (lead.bestTime ? "<dt>Best time to reach</dt><dd>" + esc(lead.bestTime) + "</dd>" : "") +
              "<dt>Email</dt><dd>" + esc(lead.email) + "</dd>" +
              "<dt>Received</dt><dd>" + esc(fmtDateTime(lead.createdAt)) + "</dd>" +
              "<dt>Intake notes</dt><dd>" + esc(lead.notes || "None") + "</dd>" +
            "</dl>") +
      "</section>" +

      // activity
      '<section class="p-sec" aria-labelledby="h-activity"><h3 id="h-activity">Activity</h3>' +
        '<ol class="timeline">' + acts.map(function (a) {
          return '<li class="k-' + esc(a.kind) + '"><time datetime="' + esc(a.at) + '">' + esc(fmtDateTime(a.at)) + "</time>" +
            (a.kind === "note" ? '<span class="note-text">' + esc(a.text) + "</span>" : esc(a.text)) +
            (a.kind === "email-simulated" && a.email
              ? '<details class="sim-email"><summary>View simulated email</summary>' +
                  '<dl class="email-meta"><dt>To</dt><dd>' + esc(a.email.to) + "</dd><dt>From</dt><dd>" + esc(a.email.from) +
                  "</dd><dt>Subject</dt><dd>" + esc(a.email.subject) + "</dd></dl>" +
                  '<pre class="email-body">' + esc(a.email.body) + "</pre>" +
                  '<p class="sim-tag">Simulated. This email was not sent.</p></details>'
              : "") + "</li>";
        }).join("") + "</ol>" +
      "</section>" +

      (lead.archived ? "" :
        '<div class="p-foot"><button class="btn btn-quiet btn-sm" type="button" id="p-archive">Archive lead</button></div>');

    // wiring
    panel.querySelector(".close").addEventListener("click", function () { location.hash = "#/desk"; });

    var stageSel = panel.querySelector("#stage-sel");
    function paintStageExtra() {
      var v = stageSel.value, box = panel.querySelector("#stage-extra");
      if (v === "Estimate Booked") {
        box.innerHTML = field("stage-estimate", "Estimate visit date and time",
          '<input id="stage-estimate" name="estimateAt" type="datetime-local" value="' + esc(defaultEstimate) + '">');
      } else if (v === "Lost") {
        box.innerHTML = field("stage-lost", "Why was it lost?",
          '<select id="stage-lost" name="lostReason">' +
            (lead.lostReason ? "" : '<option value="">Choose a reason</option>') +
            options(D.LOST_REASONS, lead.lostReason) + "</select>");
      } else {
        box.innerHTML = "";
      }
    }
    stageSel.addEventListener("change", paintStageExtra);
    paintStageExtra();

    panel.querySelector("#f-stage").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target, v = readForm(f), errs = {};
      if (v.stage === lead.stage && v.stage !== "Estimate Booked" && v.stage !== "Lost") errs.stage = "This lead is already in " + lead.stage + ". Choose a different stage.";
      if (v.stage === "Estimate Booked" && !v.estimateAt) errs.estimateAt = "Choose the estimate visit date and time.";
      if (v.stage === "Lost" && !v.lostReason) errs.lostReason = "Choose a reason.";
      if (showErrors(f, errs)) return;

      var from = lead.stage, parts = [];
      if (v.stage !== from) parts.push("Stage changed from " + from + " to " + v.stage + ".");
      if (v.stage === "Estimate Booked") {
        if (v.estimateAt !== lead.estimateAt || v.stage !== from) parts.push("Estimate visit set for " + fmtDateTime(v.estimateAt) + ".");
        lead.estimateAt = v.estimateAt;
        lead.nextAction = "Estimate visit";
        lead.nextActionDate = v.estimateAt.slice(0, 10);
      }
      if (v.stage === "Lost") {
        if (v.lostReason !== lead.lostReason || v.stage !== from) parts.push("Lost reason: " + v.lostReason + ".");
        lead.lostReason = v.lostReason;
        lead.nextAction = "No further action";
        lead.nextActionDate = "";
      }
      if (!parts.length) { showErrors(f, { stage: "Nothing changed. Pick a different stage, date or reason." }); return; }
      lead.stage = v.stage;
      log(lead, "stage", parts.join(" "));
      save();
      paintDuct(); paintTable();
      renderPanel(lead, "#stage-sel");
      toast("Stage updated");
    });

    panel.querySelector("#f-follow").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target, v = readForm(f), errs = {};
      var text = v.nextAction.trim();
      if (!text) errs.nextAction = "Describe the next step, for example: Call back.";
      if (showErrors(f, errs)) return;
      if (text === lead.nextAction && v.nextActionDate === lead.nextActionDate) {
        showErrors(f, { nextAction: "Nothing changed. Edit the step or the date first." }); return;
      }
      lead.nextAction = text;
      lead.nextActionDate = v.nextActionDate;
      log(lead, "followup-scheduled", v.nextActionDate
        ? "Follow-up set for " + fmtDay(v.nextActionDate) + ": " + text + "."
        : "Follow-up set with no date: " + text + ".");
      save();
      paintTable();
      renderPanel(lead, "#follow-text");
      toast("Follow-up saved");
    });

    panel.querySelector("#f-note").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target, text = readForm(f).note.trim();
      if (showErrors(f, text ? {} : { note: "Write a note before adding it." })) return;
      log(lead, "note", text);
      save();
      renderPanel(lead, "#note-text");
      toast("Note added");
    });

    var editBtn = panel.querySelector("#p-edit");
    if (editBtn) editBtn.addEventListener("click", function () { editing = true; renderPanel(lead, "#ed-name"); });

    var editForm = panel.querySelector("#f-edit");
    if (editForm) {
      panel.querySelector("#p-cancel").addEventListener("click", function () { editing = false; renderPanel(lead, "#p-edit"); });
      editForm.addEventListener("submit", function (e) {
        e.preventDefault();
        var v = readForm(editForm);
        if (showErrors(editForm, validateLead(v))) return;
        v.name = v.name.trim(); v.email = v.email.trim(); v.zip = v.zip.trim(); v.notes = v.notes.trim();
        v.phone = fmtPhone(v.phone);
        var changed = Object.keys(FIELD_LABELS).filter(function (k) { return (lead[k] || "") !== (v[k] || ""); });
        editing = false;
        if (!changed.length) { renderPanel(lead, "#p-edit"); toast("No changes to save"); return; }
        changed.forEach(function (k) { lead[k] = v[k]; });
        log(lead, "edit", "Lead details edited: " + changed.map(function (k) { return FIELD_LABELS[k]; }).join(", ") + ".");
        save();
        paintDuct(); paintTable();
        renderPanel(lead, "#p-edit");
        toast("Changes saved");
      });
    }

    var arch = panel.querySelector("#p-archive");
    if (arch) arch.addEventListener("click", function () { archiveLead(lead); });
    var rest = panel.querySelector("#p-restore");
    if (rest) rest.addEventListener("click", function () { restoreLead(lead); });

    if (!lead.archived) wireEmail(panel, lead);

    if (focusSel) {
      var target = panel.querySelector(focusSel);
      if (target) target.focus();
    }
  }

  /* ---------- add lead panel ---------- */

  function renderAddPanel() {
    var panel = panelEl();
    var blank = { name: "", phone: "", email: "", zip: "", service: "", homeowner: "", source: "Phone call", stage: "New", notes: "" };
    panel.innerHTML =
      '<div class="detail-top"><h2 id="detail-title" tabindex="-1">Add lead</h2>' +
        '<button class="close" type="button" aria-label="Close add lead">&times;</button></div>' +
      '<p class="demo-notice">Log a lead the way a team member would after a phone call. Use made-up details: ' +
        "what you enter stays in this browser and is never sent.</p>" +
      '<form id="f-add" novalidate>' + leadFieldsHtml("add", blank, true) +
        '<div class="form-actions"><button class="btn" type="submit">Add lead</button>' +
        '<button class="btn btn-quiet" type="button" id="add-cancel">Cancel</button></div>' +
      "</form>";

    panel.querySelector(".close").addEventListener("click", function () { location.hash = "#/desk"; });
    panel.querySelector("#add-cancel").addEventListener("click", function () { location.hash = "#/desk"; });

    var form = panel.querySelector("#f-add");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = readForm(form);
      if (showErrors(form, validateLead(v))) return;
      var now = new Date().toISOString();
      var stage = ADD_STAGES.indexOf(v.stage) === -1 ? "New" : v.stage;
      var lead = {
        id: Store.nextId(state),
        name: v.name.trim(), phone: fmtPhone(v.phone), email: v.email.trim(), zip: v.zip.trim(),
        service: v.service, homeowner: v.homeowner, source: v.source, stage: stage,
        notes: v.notes.trim(), nextAction: stage === "New" ? "First call" : "", nextActionDate: stage === "New" ? todayYmd() : "",
        estimateAt: "", lostReason: "", archived: false, sample: false, createdAt: now,
        activity: [{ at: now, kind: "created", text: "Lead added by hand. Source: " + v.source + "." }]
      };
      if (stage !== "New") lead.activity.unshift({ at: now, kind: "stage", text: "Stage set to " + stage + "." });
      state.leads.push(lead);
      save();
      filters.archived = false;
      lastFocus = lead.id;
      toast("Lead added");
      location.hash = "#/desk/" + lead.id;
    });
  }

  /* ---------- service area ---------- */

  // "43004-43235, 43240" -> [["43004","43235"], ["43240","43240"]]
  function parseArea(str) {
    return String(str || "").split(",").map(function (t) { return t.trim(); }).filter(Boolean)
      .map(function (t) {
        var m = t.match(/^(\d{5})\s*-\s*(\d{5})$/);
        if (m) return m[1] <= m[2] ? [m[1], m[2]] : [m[2], m[1]];
        return /^\d{5}$/.test(t) ? [t, t] : null;
      })
      .filter(Boolean);
  }
  function inServiceArea(zip) {
    return parseArea(state.settings.serviceArea).some(function (r) { return zip >= r[0] && zip <= r[1]; });
  }

  /* ---------- sample inquiry form (Milestone 3) ---------- */

  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  function sampleInquiry() {
    var first = pick(D.SAMPLE_FIRST), last = pick(D.SAMPLE_LAST), service = pick(D.SERVICES);
    return {
      name: first + " " + last,
      phone: "(614) 555-01" + String(Math.floor(Math.random() * 100)).padStart(2, "0"),
      email: (first + "." + last).toLowerCase() + "@example.com",
      zip: pick(D.SAMPLE_ZIPS),
      service: service,
      homeowner: pick(["Owner", "Owner", "Owner", "Renter", "Landlord"]),
      bestTime: pick(D.BEST_TIMES),
      notes: D.SAMPLE_NOTES[service] || ""
    };
  }

  function renderInquiry() {
    document.title = "Sample inquiry form — Lead Desk demo";
    actions.innerHTML =
      '<a class="btn btn-quiet" href="#/desk">Open lead desk</a>' +
      '<a class="btn btn-quiet" href="#/">Overview</a>';

    var homeownerOpts = [["Owner", "Yes, I own it"], ["Renter", "No, I rent"], ["Landlord", "I'm the landlord"]];

    main.innerHTML =
      '<div class="inquiry">' +
        '<div class="inquiry-intro">' +
          '<h1 id="inq-title" tabindex="-1">Request a heating or cooling visit</h1>' +
          "<p>A sample customer inquiry form for " + esc(bizName()) + ". Submit it to see the inquiry arrive on the lead desk as a new lead.</p>" +
        "</div>" +
        '<div class="inquiry-grid">' +
          '<form id="f-inquiry" class="inquiry-form" novalidate aria-describedby="inq-notice">' +
            '<p class="demo-notice" id="inq-notice">This is a demo form. Use made-up details. What you enter stays in this browser and is never sent.</p>' +
            '<div class="inq-fill"><button class="btn btn-quiet btn-sm" type="button" id="inq-fill">Fill with sample details</button></div>' +
            '<div class="form-grid">' +
              '<div class="span-2">' + field("inq-name", "Full name", '<input id="inq-name" name="name" type="text" autocomplete="off" maxlength="60">') + "</div>" +
              field("inq-phone", "Phone", '<input id="inq-phone" name="phone" type="tel" autocomplete="off">') +
              field("inq-email", "Email", '<input id="inq-email" name="email" type="email" autocomplete="off">') +
              field("inq-zip", "ZIP code", '<input id="inq-zip" name="zip" type="text" inputmode="numeric" maxlength="5" autocomplete="off">') +
              field("inq-best", "Best time to reach you (optional)",
                '<select id="inq-best" name="bestTime"><option value="">No preference</option>' + options(D.BEST_TIMES, "") + "</select>") +
              '<div class="span-2">' + field("inq-service", "What do you need help with?",
                '<select id="inq-service" name="service"><option value="">Choose a service</option>' + options(D.SERVICES, "") + "</select>") +
                '<p class="urgent-note" id="urgent-note" aria-live="polite"></p></div>' +
              '<fieldset class="span-2 radio-group"><legend>Do you own the home?</legend>' +
                homeownerOpts.map(function (o) {
                  return '<label class="radio"><input type="radio" name="homeowner" value="' + o[0] + '"> ' + esc(o[1]) + "</label>";
                }).join("") +
              "</fieldset>" +
              '<div class="span-2">' + field("inq-notes", "Anything else we should know? (optional)",
                '<textarea id="inq-notes" name="notes" rows="3" maxlength="500"></textarea>') + "</div>" +
            "</div>" +
            '<div class="form-actions"><button class="btn" type="submit">Add inquiry to demo desk</button></div>' +
          "</form>" +
          '<aside class="inquiry-steps" aria-labelledby="steps-title">' +
            '<h2 id="steps-title">What happens when you submit</h2>' +
            "<ol>" +
              "<li>A new lead is created in the <strong>New</strong> stage, with the source set to Website form.</li>" +
              "<li>The ZIP code is checked against the service area and the result is noted on the lead.</li>" +
              "<li>The lead appears on the desk with its first next action: a callback.</li>" +
            "</ol>" +
            "<p>A real business would also call or text the customer right away. In this demo nothing is called, texted or emailed.</p>" +
          "</aside>" +
        "</div>" +
      "</div>";

    var form = document.getElementById("f-inquiry");
    var serviceSel = document.getElementById("inq-service");
    function paintUrgent() {
      var n = document.getElementById("urgent-note");
      n.textContent = D.URGENT_SERVICES.indexOf(serviceSel.value) !== -1
        ? "In a real business this would trigger an immediate callback. In this demo, the lead is marked urgent."
        : "";
    }
    serviceSel.addEventListener("change", paintUrgent);

    document.getElementById("inq-fill").addEventListener("click", function () {
      var s = sampleInquiry();
      ["name", "phone", "email", "zip", "service", "bestTime", "notes"].forEach(function (k) {
        form.querySelector('[name="' + k + '"]').value = s[k];
      });
      form.querySelector('input[name="homeowner"][value="' + s.homeowner + '"]').checked = true;
      clearErrors(form);
      paintUrgent();
      toast("Sample details filled in");
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = readForm(form);
      if (showErrors(form, validateLead(v))) return;

      var now = new Date();
      var zip = v.zip.trim();
      var urgent = D.URGENT_SERVICES.indexOf(v.service) !== -1;
      var inside = inServiceArea(zip);
      var lead = {
        id: Store.nextId(state),
        name: v.name.trim(), phone: fmtPhone(v.phone), email: v.email.trim(), zip: zip,
        service: v.service, homeowner: v.homeowner, source: "Website form", stage: "New",
        bestTime: D.BEST_TIMES.indexOf(v.bestTime) !== -1 ? v.bestTime : "",
        notes: v.notes.trim(),
        nextAction: urgent ? "Call back within 15 minutes" : "First call",
        nextActionDate: todayYmd(),
        estimateAt: "", lostReason: "", archived: false, sample: false,
        serviceArea: inside ? "inside" : "outside",
        createdAt: now.toISOString(),
        activity: [
          {
            at: new Date(now.getTime() + 1).toISOString(), kind: "check",
            text: inside
              ? "ZIP " + zip + " is inside the service area."
              : "ZIP " + zip + " is outside the service area (" + state.settings.serviceArea + "). Check before booking an estimate."
          },
          { at: now.toISOString(), kind: "created", text: "Inquiry received via Website form (demo form)." }
        ]
      };
      state.leads.push(lead);
      save();
      location.hash = "#/inquiry/added/" + lead.id;
    });
  }

  function renderInquiryDone(id) {
    var lead = byId(id);
    if (!lead) { location.hash = "#/inquiry"; return; }
    document.title = "Inquiry added — Lead Desk demo";
    actions.innerHTML =
      '<a class="btn btn-quiet" href="#/desk">Open lead desk</a>' +
      '<a class="btn btn-quiet" href="#/">Overview</a>';
    var urgent = D.URGENT_SERVICES.indexOf(lead.service) !== -1;
    var inside = lead.serviceArea ? lead.serviceArea === "inside" : inServiceArea(lead.zip);
    var first = lead.name.split(" ")[0];

    main.innerHTML =
      '<div class="inquiry inquiry-done">' +
        '<h1 id="done-title" tabindex="-1">Inquiry added to the demo lead desk</h1>' +
        "<p>" + esc(lead.name) + "’s inquiry is now lead " + esc(lead.id) + ", in the New stage.</p>" +
        '<article class="ticket' + (urgent ? "" : " ticket-calm") + '" aria-label="New lead summary">' +
          '<div class="ticket-head"><span class="ticket-id">Lead ' + esc(lead.id) + ", added in this browser</span>" +
            '<span class="need' + (urgent ? " urgent" : "") + '">' + esc(lead.service) + "</span></div>" +
          "<h2>" + esc(lead.name) + "</h2>" +
          '<p class="ticket-meta">Website form, received just now</p>' +
          "<dl>" +
            "<dt>ZIP code</dt><dd>" + esc(lead.zip) + ' <span class="area ' + (inside ? "in" : "out") + '">' +
              (inside ? "Inside the service area" : "Outside the service area") + "</span></dd>" +
            "<dt>Homeowner</dt><dd>" + esc(lead.homeowner) + "</dd>" +
            (lead.bestTime ? "<dt>Best time</dt><dd>" + esc(lead.bestTime) + "</dd>" : "") +
            (lead.notes ? "<dt>Notes</dt><dd>" + esc(lead.notes) + "</dd>" : "") +
          "</dl>" +
          '<div class="ticket-next"><span>' + esc(lead.nextAction) + "</span>" +
            '<span class="stage-pill" style="--c:' + stageColor("New") + '">New</span></div>' +
        "</article>" +
        '<h2 class="done-sub">What a real business would do next</h2>' +
        '<ol class="done-steps">' +
          "<li>" + (urgent ? "Call " + esc(first) + " back within 15 minutes, because they are without " +
            (lead.service === "No heat" ? "heat" : "cooling") + "." : "Call " + esc(first) + " back" +
            (lead.bestTime ? " in the " + esc(lead.bestTime.toLowerCase()) : "") + " to talk through the job.") + "</li>" +
          "<li>Send a text confirming the request was received.</li>" +
          "<li>" + (inside ? "Qualify the job and book an in-home estimate." :
            "Confirm whether the address can be served before booking an estimate.") + "</li>" +
        "</ol>" +
        '<p class="hint">Simulated: in this demo nothing is called, texted or emailed.</p>' +
        '<div class="form-actions">' +
          '<a class="btn" href="#/desk/' + esc(lead.id) + '" id="view-lead">View this lead on the desk</a>' +
          '<a class="btn btn-quiet" href="#/inquiry">Add another inquiry</a>' +
        "</div>" +
      "</div>";

    document.getElementById("view-lead").addEventListener("click", function () {
      filters = freshFilters();
      lastFocus = lead.id;
    });
  }

  /* ---------- follow-up emails: always simulated (Milestone 4) ---------- */

  function bizName() { return (state.settings.businessName || D.DEFAULT_SETTINGS.businessName) + " (fictional)"; }
  function senderLine() { return state.settings.senderName + " at " + bizName(); }
  function tplMeta(id) { return D.TEMPLATES.filter(function (t) { return t.id === id; })[0]; }

  // Which template fits this lead best (FRD §6.2).
  function suggestTemplate(lead) {
    if (lead.stage === "New") return D.URGENT_SERVICES.indexOf(lead.service) !== -1 ? "urgent" : "first";
    if (lead.stage === "Estimate Booked") return "confirm";
    if (lead.stage === "Won") return "thanks";
    var due = lead.nextActionDate && lead.nextActionDate <= todayYmd();
    if (due || lead.stage === "Lost") return "checkin";
    return "invite";
  }

  function mergeVars(lead) {
    var est = lead.estimateAt;
    return {
      first_name: lead.name.split(" ")[0],
      service: lead.service,
      service_lower: D.SERVICE_PHRASE[lead.service] || String(lead.service).toLowerCase(),
      zip: lead.zip,
      business_name: bizName(),
      sender_name: state.settings.senderName,
      business_phone: state.settings.businessPhone,
      estimate_date: est ? fmtDay(est.slice(0, 10)) : "",
      estimate_time: est ? new Date(est).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : ""
    };
  }

  // A field with no value becomes a visible gap like "[estimate date]".
  function fillTemplate(text, vars) {
    return text.replace(/\{\{\s*(\w+)\s*\}\}/g, function (m, k) {
      if (!(k in vars)) return m;
      return vars[k] ? vars[k] : "[" + k.replace(/_/g, " ") + "]";
    });
  }
  var GAP_RE = new RegExp("\\[(" + D.MERGE_FIELDS.map(function (f) { return f[0].replace(/_/g, " "); }).join("|") + ")\\]", "g");
  function gapsIn(text) {
    var out = [], m;
    GAP_RE.lastIndex = 0;
    while ((m = GAP_RE.exec(text))) if (out.indexOf(m[1]) === -1) out.push(m[1]);
    return out;
  }
  function unknownFields(text) {
    var known = D.MERGE_FIELDS.map(function (f) { return f[0]; }), out = [], m, re = /\{\{\s*(\w+)\s*\}\}/g;
    while ((m = re.exec(text))) if (known.indexOf(m[1]) === -1 && out.indexOf(m[1]) === -1) out.push(m[1]);
    return out;
  }
  function draftFor(lead, id) {
    var t = state.settings.templates[id], v = mergeVars(lead);
    return { subject: fillTemplate(t.subject, v), body: fillTemplate(t.body, v) };
  }

  function emailSectionHtml(lead) {
    var head = '<section class="p-sec" aria-labelledby="h-email"><h3 id="h-email">Follow-up email</h3>';
    if (postSend) {
      return head +
        '<form id="f-post" class="post-send" novalidate>' +
          '<p class="sim-banner" role="status">Simulated email recorded. Nothing was sent.</p>' +
          "<p>Set the next follow-up?</p>" +
          '<div class="form-grid">' +
            '<div class="span-2">' + field("post-text", "What happens next",
              '<input id="post-text" name="nextAction" type="text" maxlength="80" value="Check for a reply">') + "</div>" +
            field("post-date", "Due date",
              '<input id="post-date" name="nextActionDate" type="date" value="' + esc(addDaysYmd(+state.settings.followupDelay || 0)) + '">') +
          "</div>" +
          '<div class="form-actions"><button class="btn btn-sm" type="submit">Set follow-up</button>' +
            '<button class="btn btn-quiet btn-sm" type="button" id="post-skip">Not now</button></div>' +
        "</form></section>";
    }
    if (!emailOpen) {
      return head +
        '<p class="hint">Draft a follow-up from a template and record a simulated send. Nothing is emailed.</p>' +
        '<button class="btn btn-quiet btn-sm" type="button" id="p-email">Preview follow-up email</button></section>';
    }
    var sid = suggestTemplate(lead), d = draftFor(lead, sid);
    return head +
      '<form id="f-email" class="composer" novalidate>' +
        '<p class="sim-banner">Simulated email. Nothing will be sent.</p>' +
        field("em-tpl", "Template", '<select id="em-tpl" name="template">' + D.TEMPLATES.map(function (t) {
          return '<option value="' + t.id + '"' + (t.id === sid ? " selected" : "") + ">" + esc(t.name) +
            (t.id === sid ? " (suggested)" : "") + "</option>";
        }).join("") + "</select>") +
        '<dl class="email-meta"><dt>To</dt><dd>' + esc(lead.email) + "</dd><dt>From</dt><dd>" + esc(senderLine()) + "</dd></dl>" +
        field("em-subject", "Subject", '<input id="em-subject" name="subject" type="text" maxlength="120" value="' + esc(d.subject) + '">') +
        field("em-body", "Message", '<textarea id="em-body" name="body" rows="11" maxlength="3000">' + esc(d.body) + "</textarea>") +
        '<p class="gap-note" id="em-gaps" aria-live="polite"></p>' +
        '<div class="form-actions"><button class="btn btn-sm" type="submit">Record simulated send</button>' +
          '<button class="btn btn-quiet btn-sm" type="button" id="em-cancel">Cancel</button></div>' +
      "</form></section>";
  }

  function wireEmail(panel, lead) {
    var openBtn = panel.querySelector("#p-email");
    if (openBtn) openBtn.addEventListener("click", function () { emailOpen = true; renderPanel(lead, "#em-tpl"); });

    var f = panel.querySelector("#f-email");
    if (f) {
      var tpl = f.querySelector("#em-tpl"), subj = f.querySelector("#em-subject"), body = f.querySelector("#em-body");
      var gapsEl = f.querySelector("#em-gaps");
      var paintGaps = function () {
        var g = gapsIn(subj.value + "\n" + body.value);
        gapsEl.textContent = g.length
          ? "This lead has no " + g.join(" or ") + " yet. Fill in or remove " +
            g.map(function (x) { return "[" + x + "]"; }).join(", ") + " before recording."
          : "";
      };
      tpl.addEventListener("change", function () {
        var d = draftFor(lead, tpl.value);
        subj.value = d.subject; body.value = d.body;
        clearErrors(f); paintGaps();
      });
      subj.addEventListener("input", paintGaps);
      body.addEventListener("input", paintGaps);
      paintGaps();

      f.querySelector("#em-cancel").addEventListener("click", function () { emailOpen = false; renderPanel(lead, "#p-email"); });

      f.addEventListener("submit", function (e) {
        e.preventDefault();
        var v = readForm(f), errs = {};
        if (!v.subject.trim()) errs.subject = "Add a subject.";
        if (!v.body.trim()) errs.body = "Write a message.";
        var g = gapsIn(v.subject + "\n" + v.body);
        if (g.length) {
          var msg = "Fill in or remove " + g.map(function (x) { return "[" + x + "]"; }).join(", ") + " before recording.";
          if (gapsIn(v.subject).length) errs.subject = msg; else errs.body = msg;
        }
        if (showErrors(f, errs)) return;

        var now = Date.now();
        var email = { to: lead.email, from: senderLine(), subject: v.subject.trim(), body: v.body.trim(), templateId: v.template };
        lead.activity.unshift({
          at: new Date(now).toISOString(), kind: "email-simulated",
          text: "Simulated email recorded: “" + email.subject + "”. Not sent.", email: email
        });
        if (lead.stage === "New") {
          lead.stage = "Contacted";
          lead.activity.unshift({
            at: new Date(now + 1).toISOString(), kind: "stage",
            text: "Stage changed from New to Contacted after the simulated email."
          });
        }
        save();
        emailOpen = false; postSend = true;
        paintDuct(); paintTable();
        renderPanel(lead, "#post-text");
        toast("Simulated email recorded");
      });
    }

    var pf = panel.querySelector("#f-post");
    if (pf) {
      pf.querySelector("#post-skip").addEventListener("click", function () { postSend = false; renderPanel(lead, "#p-email"); });
      pf.addEventListener("submit", function (e) {
        e.preventDefault();
        var v = readForm(pf), text = v.nextAction.trim();
        if (showErrors(pf, text ? {} : { nextAction: "Describe the next step, for example: Call back." })) return;
        lead.nextAction = text;
        lead.nextActionDate = v.nextActionDate;
        log(lead, "followup-scheduled", v.nextActionDate
          ? "Follow-up set for " + fmtDay(v.nextActionDate) + ": " + text + "."
          : "Follow-up set with no date: " + text + ".");
        save();
        postSend = false;
        paintTable();
        renderPanel(lead, "#p-email");
        toast("Follow-up saved");
      });
    }
  }

  /* ---------- settings (Milestone 4) ---------- */

  function validateBusiness(v) {
    var e = {};
    var name = (v.businessName || "").replace(/\s*\(fictional\)\s*$/i, "").trim();
    if (name.length < 2 || name.length > 60) e.businessName = "Enter a business name between 2 and 60 characters.";
    var sender = (v.senderName || "").trim();
    if (!sender || sender.length > 40) e.senderName = "Enter a sender name of up to 40 characters.";
    var d = (v.businessPhone || "").replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
    if (d.length !== 10 || d.slice(3, 6) !== "555" || d.slice(6, 8) !== "01") {
      e.businessPhone = "Use a fictional number from (xxx) 555-0100 to (xxx) 555-0199.";
    }
    var tokens = String(v.serviceArea || "").split(",").map(function (t) { return t.trim(); }).filter(Boolean);
    var bad = tokens.filter(function (t) { return !/^\d{5}(\s*-\s*\d{5})?$/.test(t); });
    if (!tokens.length) e.serviceArea = "Enter at least one ZIP code or range.";
    else if (bad.length) e.serviceArea = "These are not ZIP codes or ranges: " + bad.join(", ") + ". Use entries like 43215 or 43004-43235.";
    return e;
  }

  function templateErrors(t) {
    var e = {};
    if (!t.subject.trim()) e.tplSubject = "Add a subject.";
    else if (unknownFields(t.subject).length) e.tplSubject = "Unknown merge field: {{" + unknownFields(t.subject).join("}}, {{") + "}}.";
    if (!t.body.trim()) e.tplBody = "Write a message.";
    else if (unknownFields(t.body).length) e.tplBody = "Unknown merge field: {{" + unknownFields(t.body).join("}}, {{") + "}}.";
    return e;
  }

  function renderSettings() {
    document.title = "Settings — Lead Desk demo";
    actions.innerHTML =
      '<a class="btn btn-quiet" href="#/desk">Open lead desk</a>' +
      '<a class="btn btn-quiet" href="#/">Overview</a>';
    var s = state.settings;
    var draft = JSON.parse(JSON.stringify(s.templates));
    var current = D.TEMPLATES[0].id;
    settingsDirty = false;

    main.innerHTML =
      '<div class="settings">' +
        '<h1 id="set-title" tabindex="-1">Settings</h1>' +
        '<p class="lede-sm">These settings shape the demo workspace in this browser. There are no email accounts, ' +
          "phone lines or integrations to connect, by design.</p>" +
        '<form id="f-settings" novalidate>' +
          '<section class="set-sec" aria-labelledby="set-biz"><h2 id="set-biz">Business</h2><div class="form-grid">' +
            field("set-name", "Business name",
              '<input id="set-name" name="businessName" type="text" maxlength="72" aria-describedby="set-name-hint" value="' + esc(s.businessName) + '">',
              "Always shown with “(fictional)” after it.") +
            field("set-sender", "Sender name",
              '<input id="set-sender" name="senderName" type="text" maxlength="40" aria-describedby="set-sender-hint" value="' + esc(s.senderName) + '">',
              "Used in the From line and sign-off of simulated emails.") +
            field("set-phone", "Business phone",
              '<input id="set-phone" name="businessPhone" type="tel" aria-describedby="set-phone-hint" value="' + esc(s.businessPhone) + '">',
              "A fictional number from 555-0100 to 555-0199.") +
            field("set-delay", "Next follow-up after a simulated email",
              '<select id="set-delay" name="followupDelay" aria-describedby="set-delay-hint">' + D.FOLLOWUP_DELAYS.map(function (o) {
                return '<option value="' + o[0] + '"' + (+s.followupDelay === o[0] ? " selected" : "") + ">" + esc(o[1]) + "</option>";
              }).join("") + "</select>",
              "Pre-fills the due date offered after recording a send.") +
            '<div class="span-2">' + field("set-area", "Service-area ZIP codes",
              '<input id="set-area" name="serviceArea" type="text" aria-describedby="set-area-hint" value="' + esc(s.serviceArea) + '">',
              "Comma-separated ZIP codes or ranges, for example 43004-43235, 43240. Used by the inquiry form's service-area check.") + "</div>" +
          "</div></section>" +

          '<section class="set-sec" aria-labelledby="set-tpls"><h2 id="set-tpls">Follow-up email templates</h2>' +
            '<p class="hint">Lead Desk suggests a template based on the lead\'s stage and service. Emails made from these are only ever simulated.</p>' +
            '<div class="tpl-grid"><div class="tpl-edit">' +
              field("set-tpl", "Template", '<select id="set-tpl">' + D.TEMPLATES.map(function (t) {
                return '<option value="' + t.id + '">' + esc(t.name) + "</option>";
              }).join("") + "</select>") +
              '<p class="hint" id="tpl-when"></p>' +
              field("set-tsubject", "Subject", '<input id="set-tsubject" name="tplSubject" type="text" maxlength="120">') +
              field("set-tbody", "Message", '<textarea id="set-tbody" name="tplBody" rows="12" maxlength="3000"></textarea>') +
              '<button class="btn btn-quiet btn-sm" type="button" id="tpl-restore">Restore default for this template</button>' +
            "</div>" +
            '<aside class="merge-list" aria-labelledby="merge-title"><h3 id="merge-title">Merge fields</h3>' +
              "<p class=\"hint\">Type these into a subject or message. Each is replaced with the lead's details.</p><dl>" +
              D.MERGE_FIELDS.map(function (m) { return "<dt><code>{{" + m[0] + "}}</code></dt><dd>" + esc(m[1]) + "</dd>"; }).join("") +
            "</dl></aside></div>" +
          "</section>" +

          '<div class="set-actions"><button class="btn" type="submit">Save settings</button>' +
            '<span class="hint" id="dirty-note" aria-live="polite"></span></div>' +
        "</form>" +

        '<section class="set-sec set-reset" aria-labelledby="set-reset"><h2 id="set-reset">Reset demo data</h2>' +
          "<p>Restores the 14 sample leads and the default settings in this browser. Leads you added or changed are removed.</p>" +
          '<button class="btn btn-quiet" type="button" id="set-reset-btn">Reset demo data</button>' +
        "</section>" +
      "</div>";

    var form = document.getElementById("f-settings");
    var tplSel = document.getElementById("set-tpl");
    var tSubj = document.getElementById("set-tsubject");
    var tBody = document.getElementById("set-tbody");
    var dirtyNote = document.getElementById("dirty-note");

    function markDirty() { settingsDirty = true; dirtyNote.textContent = "Unsaved changes"; }
    function loadTemplate(id) {
      current = id;
      tplSel.value = id;
      tSubj.value = draft[id].subject;
      tBody.value = draft[id].body;
      document.getElementById("tpl-when").textContent = "Suggested when: " + tplMeta(id).when + ".";
    }
    function stashTemplate() { draft[current] = { subject: tSubj.value, body: tBody.value }; }

    loadTemplate(current);
    form.addEventListener("input", function (e) { if (e.target !== tplSel) markDirty(); });
    form.addEventListener("change", function (e) { if (e.target !== tplSel) markDirty(); });
    tplSel.addEventListener("change", function () { stashTemplate(); clearErrors(form); loadTemplate(tplSel.value); });

    document.getElementById("tpl-restore").addEventListener("click", function () {
      var def = Store.defaultSettings().templates[current];
      tSubj.value = def.subject; tBody.value = def.body;
      stashTemplate(); markDirty();
      toast("Default restored. Save settings to keep it.");
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      stashTemplate();
      var v = readForm(form);
      var errs = validateBusiness(v);
      if (Object.keys(errs).length) { showErrors(form, errs); return; }
      for (var i = 0; i < D.TEMPLATES.length; i++) {
        var id = D.TEMPLATES[i].id, te = templateErrors(draft[id]);
        if (Object.keys(te).length) {
          clearErrors(form);
          if (id !== current) loadTemplate(id);
          showErrors(form, te);
          return;
        }
      }
      clearErrors(form);
      var tokens = v.serviceArea.split(",").map(function (t) { return t.trim().replace(/\s*-\s*/, "-"); }).filter(Boolean);
      state.settings = {
        businessName: v.businessName.replace(/\s*\(fictional\)\s*$/i, "").trim(),
        senderName: v.senderName.trim(),
        businessPhone: fmtPhone(v.businessPhone),
        serviceArea: tokens.join(", "),
        followupDelay: +v.followupDelay,
        templates: JSON.parse(JSON.stringify(draft))
      };
      save();
      settingsDirty = false;
      dirtyNote.textContent = "";
      document.getElementById("set-name").value = state.settings.businessName;
      document.getElementById("set-phone").value = state.settings.businessPhone;
      document.getElementById("set-area").value = state.settings.serviceArea;
      toast("Settings saved");
    });

    document.getElementById("set-reset-btn").addEventListener("click", function () {
      if (!window.confirm("Reset the demo? This restores the original sample leads and default settings in this browser, and removes any changes.")) return;
      state = Store.reset();
      filters = freshFilters();
      renderSettings();
      document.getElementById("set-title").focus();
      toast("Demo data reset");
    });
  }

  window.addEventListener("beforeunload", function (e) {
    if (settingsDirty) { e.preventDefault(); e.returnValue = ""; }
  });

  /* ---------- router ---------- */

  var lastView = null;
  var suppressRoute = false;
  function route() {
    var h = location.hash || "#/";
    if (suppressRoute) { suppressRoute = false; if (h === "#/settings" && lastView === "settings") return; }
    if (lastView === "settings" && settingsDirty && h !== "#/settings") {
      if (!window.confirm("Leave Settings without saving? Your changes will be lost.")) {
        suppressRoute = true;
        location.hash = "#/settings";
        return;
      }
      settingsDirty = false;
    }
    if (h === "#/settings") {
      closePanel(true);
      renderSettings();
      lastView = "settings";
      window.scrollTo(0, 0);
      document.getElementById("set-title").focus({ preventScroll: true });
    } else if (h.indexOf("#/desk") === 0) {
      if (!state.demoStarted) { state.demoStarted = true; save(); }
      var id = currentOpenId();
      if (lastView === "desk") {
        // stay on the desk: only swap the panel so filters and scroll survive
        paintAll();
        closePanel(!!id);
        if (id) openPanel(id);
      } else {
        window.scrollTo(0, 0);
        renderDesk(id);
        if (!id) main.focus({ preventScroll: true });
      }
      lastView = "desk";
    } else if (h.indexOf("#/inquiry") === 0) {
      closePanel(true);
      var m = h.match(/^#\/inquiry\/added\/(L\d+)$/);
      if (m) renderInquiryDone(m[1]); else renderInquiry();
      lastView = "inquiry";
      window.scrollTo(0, 0);
      var t = document.getElementById(m ? "done-title" : "inq-title");
      if (t) t.focus({ preventScroll: true });
    } else if (h === "#how") {
      if (lastView !== "landing") { closePanel(true); renderLanding(); lastView = "landing"; }
      var how = document.getElementById("how");
      if (how) how.scrollIntoView();
    } else {
      closePanel(true);
      renderLanding();
      lastView = "landing";
      main.focus();
      window.scrollTo(0, 0);
    }
  }

  window.addEventListener("hashchange", route);
  route();
})();
