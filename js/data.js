/* Lead Desk — fictional sample data.
   Every name, phone number, email, address and business here is invented.
   Phone numbers use the 555-01xx range reserved for fiction; emails use example.com. */
(function () {
  "use strict";

  var STAGES = ["New", "Contacted", "Qualified", "Estimate Booked", "Won", "Lost"];

  var SOURCES = [
    "Facebook ad survey",
    "Website form",
    "Phone call",
    "Google Business Profile",
    "Referral"
  ];

  var SERVICES = [
    "No heat",
    "No cooling",
    "Furnace replacement quote",
    "AC replacement quote",
    "Heat pump install",
    "Seasonal tune-up",
    "Thermostat upgrade",
    "Duct cleaning"
  ];

  // Service needs that mean someone is without heating or cooling right now.
  var URGENT_SERVICES = ["No heat", "No cooling"];

  var HOMEOWNER = ["Owner", "Renter", "Landlord"];

  var LOST_REASONS = ["No response", "Chose another company", "Outside service area", "Not ready", "Other"];

  var BUSINESS = "Northline Heating & Air (fictional)";

  // Follow-up email templates. Emails are only ever simulated: previewed and
  // logged on the lead, never sent. Merge fields are listed in MERGE_FIELDS.
  var SIGN = "\n\n{{sender_name}}\n{{business_name}}";
  var TEMPLATES = [
    {
      id: "urgent", name: "Urgent callback",
      when: "No heat or no cooling, stage New",
      subject: "We got your urgent request: {{service}}",
      body: "Hi {{first_name}},\n\nThanks for reaching out to {{business_name}}. Because you're dealing with a {{service_lower}}, " +
        "we're treating your request as a priority. A technician will call you shortly to arrange a visit.\n\n" +
        "If you need us sooner, call {{business_phone}}." + SIGN
    },
    {
      id: "first", name: "First reply",
      when: "Stage New",
      subject: "Thanks for contacting {{business_name}}",
      body: "Hi {{first_name}},\n\nThanks for your {{service_lower}} request. We'd like to learn a little more about " +
        "your system so we can recommend the right next step. When is a good time for a quick call?\n\n" +
        "You can also reach us at {{business_phone}}." + SIGN
    },
    {
      id: "invite", name: "Estimate invitation",
      when: "Stage Contacted or Qualified",
      subject: "Let's schedule your free in-home estimate",
      body: "Hi {{first_name}},\n\nThanks for talking with us about your {{service_lower}}. The next step is a free in-home " +
        "estimate: a technician looks at your current system, answers your questions and leaves you a written quote.\n\n" +
        "Reply with two or three times that suit you and we'll confirm one." + SIGN
    },
    {
      id: "confirm", name: "Estimate confirmation",
      when: "Stage Estimate Booked",
      subject: "Your estimate visit on {{estimate_date}}",
      body: "Hi {{first_name}},\n\nThis confirms your in-home estimate on {{estimate_date}} at {{estimate_time}} for your " +
        "{{service_lower}}. The visit usually takes about an hour.\n\n" +
        "If you need to change the time, call us at {{business_phone}}." + SIGN
    },
    {
      id: "checkin", name: "Check-in",
      when: "Follow-up due today or overdue",
      subject: "Checking in on your {{service_lower}}",
      body: "Hi {{first_name}},\n\nJust checking in on your {{service_lower}} request. Are you still looking for help? " +
        "Reply here or call {{business_phone}} and we'll pick up where we left off." + SIGN
    },
    {
      id: "thanks", name: "Thank you",
      when: "Stage Won",
      subject: "Thank you for choosing {{business_name}}",
      body: "Hi {{first_name}},\n\nThank you for choosing {{business_name}} for your {{service_lower}}. If anything about " +
        "the work isn't right, call us at {{business_phone}}.\n\nWe'll send a reminder when your next seasonal tune-up is due." + SIGN
    }
  ];

  var MERGE_FIELDS = [
    ["first_name", "Lead's first name"],
    ["service", "Service need, e.g. No heat"],
    ["service_lower", "Service need in a sentence, e.g. heating outage"],
    ["zip", "ZIP code"],
    ["business_name", "Business name, with (fictional)"],
    ["sender_name", "Sender name"],
    ["business_phone", "Business phone"],
    ["estimate_date", "Estimate visit date"],
    ["estimate_time", "Estimate visit time"]
  ];

  // How each service need reads inside a sentence.
  var SERVICE_PHRASE = {
    "No heat": "heating outage",
    "No cooling": "cooling outage",
    "Furnace replacement quote": "furnace replacement",
    "AC replacement quote": "AC replacement",
    "Heat pump install": "heat pump install",
    "Seasonal tune-up": "seasonal tune-up",
    "Thermostat upgrade": "thermostat upgrade",
    "Duct cleaning": "duct cleaning"
  };

  function defaultTemplates() {
    var out = {};
    TEMPLATES.forEach(function (t) { out[t.id] = { subject: t.subject, body: t.body }; });
    return out;
  }

  // Workspace settings, editable on the Settings screen.
  var DEFAULT_SETTINGS = {
    businessName: "Northline Heating & Air", // always shown with "(fictional)"
    senderName: "Jordan",
    businessPhone: "(614) 555-0199",          // must stay in the fictional 555-01xx range
    serviceArea: "43004-43235",                // comma-separated ZIPs or ZIP ranges
    followupDelay: 2,                          // days after a simulated send
    templates: defaultTemplates()
  };

  var FOLLOWUP_DELAYS = [[0, "Same day"], [1, "1 day"], [2, "2 days"], [3, "3 days"], [7, "1 week"]];

  var BEST_TIMES = ["Morning", "Afternoon", "Evening"];

  // Pools for "Fill with sample details" on the inquiry form. All invented.
  var SAMPLE_FIRST = ["Rosa", "Theo", "Imani", "Felix", "Noor", "Grant", "Yuki", "Bea", "Omar", "Celia", "Desmond", "Kira"];
  var SAMPLE_LAST = ["Delgado", "Marsh", "Okafor", "Lindgren", "Haddad", "Pruitt", "Tanaka", "Quill", "Farouk", "Navarro", "Ashby", "Rourke"];
  var SAMPLE_NOTES = {
    "No heat": "Furnace is blowing cold air since this morning.",
    "No cooling": "AC runs but the house will not drop below 80°F.",
    "Furnace replacement quote": "Furnace is about 20 years old and getting loud.",
    "AC replacement quote": "Want a quote before next summer.",
    "Heat pump install": "Curious whether a heat pump would work for a two-storey house.",
    "Seasonal tune-up": "Have not had the system checked in two years.",
    "Thermostat upgrade": "Would like a programmable thermostat installed.",
    "Duct cleaning": "Lots of dust coming from the vents."
  };
  // Inside the default area, plus two outside it so the check has something to show.
  var SAMPLE_ZIPS = ["43017", "43065", "43081", "43123", "43147", "43209", "43214", "43228", "45202", "44114"];

  // Seed timestamps are relative to "now", so the demo always looks current.
  function daysAgo(d, h) {
    var t = new Date();
    t.setDate(t.getDate() - d);
    t.setHours(h == null ? 10 : h, 15, 0, 0);
    return t.toISOString();
  }
  function daysAhead(d) {
    var t = new Date();
    t.setDate(t.getDate() + d);
    return t.toISOString().slice(0, 10);
  }

  function seedLeads() {
    var raw = [
      ["Dana Whitlock", "No heat", "Facebook ad survey", "New", "43207", "Owner", 0, 8,
        "Furnace stopped overnight; two kids at home.", "Call back within 15 minutes", 0],
      ["Marcus Feld", "Furnace replacement quote", "Website form", "Contacted", "43215", "Owner", 1, 14,
        "Unit is 19 years old. Wants options for financing.", "Send replacement options", 1],
      ["Priya Raman", "Heat pump install", "Google Business Profile", "Qualified", "43085", "Owner", 3, 11,
        "Asked about rebates for cold-climate heat pumps.", "Book in-home estimate", 2],
      ["Tomás Ortega", "Seasonal tune-up", "Referral", "Estimate Booked", "43204", "Owner", 4, 9,
        "Referred by a neighbour. Prefers mornings.", "Estimate visit", 2],
      ["Hannah Lindqvist", "No cooling", "Phone call", "Won", "43221", "Owner", 9, 16,
        "Server room unit in home office. Capacitor replaced.", "Schedule spring tune-up", 120],
      ["Reggie Coleman", "Thermostat upgrade", "Facebook ad survey", "Lost", "43229", "Renter", 6, 13,
        "Landlord approval required; tenant chose to wait.", "No further action", null],
      ["Ines Moreau", "AC replacement quote", "Website form", "New", "43016", "Owner", 0, 12,
        "Condenser is noisy. Comparing three quotes.", "First call", 0],
      ["Caleb Sutherland", "Duct cleaning", "Facebook ad survey", "Contacted", "43230", "Owner", 2, 17,
        "Recently moved in; dust from vents.", "Follow up by text", -1],
      ["Mei-Lin Zhao", "No heat", "Google Business Profile", "Qualified", "43201", "Landlord", 1, 7,
        "Rental duplex, upstairs unit cold. Tenant on site.", "Book emergency visit", 0],
      ["Abdul Karimi", "Furnace replacement quote", "Phone call", "Estimate Booked", "43123", "Owner", 5, 10,
        "Wants high-efficiency unit. Has a quote from another company.", "Estimate visit", 3],
      ["Shauna Brennan", "Seasonal tune-up", "Website form", "Won", "43068", "Owner", 8, 15,
        "Annual maintenance plan signed in the demo.", "Next tune-up reminder", 180],
      ["Victor Adeyemi", "Heat pump install", "Referral", "New", "43235", "Owner", 0, 15,
        "Interested in replacing an oil furnace.", "First call", 0],
      ["Lucy Paterson", "No cooling", "Facebook ad survey", "Lost", "43220", "Renter", 11, 12,
        "Could not reach after three attempts.", "No further action", null],
      ["Gabriel Novak", "AC replacement quote", "Google Business Profile", "Contacted", "43026", "Owner", 2, 10,
        "Asked whether old ductwork can be reused.", "Send ductwork explainer", 2]
    ];

    return raw.map(function (r, i) {
      var first = r[0].split(" ")[0].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
      var lead = {
        id: "L" + String(1001 + i),
        name: r[0],
        service: r[1],
        source: r[2],
        stage: r[3],
        zip: r[4],
        homeowner: r[5],
        createdAt: daysAgo(r[6], r[7]),
        phone: "(614) 555-01" + String(10 + i),
        email: first + "." + (i + 1) + "@example.com",
        notes: r[8],
        nextAction: r[9],
        nextActionDate: r[10] == null ? "" : daysAhead(r[10]),
        estimateAt: r[3] === "Estimate Booked" ? daysAhead(r[10]) + "T09:00" : "",
        lostReason: r[3] === "Lost" ? (r[0] === "Lucy Paterson" ? "No response" : "Not ready") : "",
        archived: false,
        sample: true,
        activity: [
          { at: daysAgo(r[6], r[7]), kind: "created", text: "Inquiry received via " + r[2] + "." }
        ]
      };
      var idx = STAGES.indexOf(r[3]);
      if (idx > 0) {
        lead.activity.unshift({
          at: daysAgo(Math.max(r[6] - 1, 0), r[7] + 1),
          kind: "stage",
          text: "Stage set to " + r[3] + "."
        });
      }
      return lead;
    });
  }

  window.LeadDeskData = {
    STAGES: STAGES,
    SOURCES: SOURCES,
    SERVICES: SERVICES,
    URGENT_SERVICES: URGENT_SERVICES,
    HOMEOWNER: HOMEOWNER,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    TEMPLATES: TEMPLATES,
    MERGE_FIELDS: MERGE_FIELDS,
    SERVICE_PHRASE: SERVICE_PHRASE,
    FOLLOWUP_DELAYS: FOLLOWUP_DELAYS,
    BEST_TIMES: BEST_TIMES,
    SAMPLE_FIRST: SAMPLE_FIRST,
    SAMPLE_LAST: SAMPLE_LAST,
    SAMPLE_NOTES: SAMPLE_NOTES,
    SAMPLE_ZIPS: SAMPLE_ZIPS,
    LOST_REASONS: LOST_REASONS,
    BUSINESS: BUSINESS,
    seedLeads: seedLeads
  };
})();
