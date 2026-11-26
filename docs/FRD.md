# Lead Desk — Functional Requirements Document (FRD)

**Product:** Lead Desk — HVAC Lead-to-Estimate CRM Demo
**Status:** Draft for review, 26 November 2026
**Source:** `PROJECT_BRIEF.md` (Project 1) and the Milestone 1 build already in this folder

> Lead Desk is an independent portfolio demonstration. Every business, lead, name, phone number, email and address in it is fictional. No email, SMS, call or ad is ever sent, and no entered data leaves the visitor's browser.

---

## 1. Purpose

### 1.1 Problem
HVAC service businesses lose jobs between the first inquiry and the estimate visit. Inquiries come from many channels, urgent "no heat" calls sit next to routine tune-ups, and follow-ups depend on someone remembering to make them.

### 1.2 What the demo shows
A small, polished CRM that walks one lead from inquiry to booked estimate:

1. An inquiry is captured (sample form).
2. It appears on a lead desk, with urgent needs marked first.
3. A team member reviews it, qualifies it, and moves it through stages.
4. A follow-up email is previewed and **simulated** — logged, never sent.
5. Stage counts show where leads are piling up.

### 1.3 Audience
| Viewer | What they should take away |
|---|---|
| Recruiters / hiring managers | Chaudhry Usman can design and ship a clean, working product end to end. |
| Implementation teams (e.g. TRXmode) | Understanding of the lead-to-estimate workflow and its handoffs. |
| HVAC / service-business owners | What an organized lead desk feels like, without a sales pitch or invented results. |

### 1.4 Goals and non-goals
**Goals**
- Demonstrate lead intake, qualification, pipeline visibility, follow-up, and the estimate-booking handoff.
- Run fully in the browser with fictional sample data.
- Be responsive, keyboard-accessible and clearly labeled as a demo.

**Non-goals (version one)**
- Real authentication, user accounts or passwords.
- A backend, database or API.
- Sending real email, SMS or calls; connecting to calendars, ad accounts, CRMs or phone systems.
- AI-generated content, analytics claims, or conversion figures.

---

## 2. Constraints and principles

| ID | Constraint |
|---|---|
| C-1 | All data is stored in the visitor's browser (`localStorage`); if storage is blocked, the demo works in memory for the visit. |
| C-2 | No network requests carry demo data. The only external request is the Google Fonts stylesheet. |
| C-3 | Every screen shows a visible **Demo data** label. |
| C-4 | Sample contact details use fictional formats: phone numbers in the 555-0100–0199 range, emails at `example.com`. |
| C-5 | Results and records are described as simulated. No fictional conversion lifts or client outcomes. |
| C-6 | No secrets, keys or credentials in the repository. |
| C-7 | Static site, no build step, no runtime dependencies; deployable to Vercel or any static host. |

---

## 3. Data model

### 3.1 Lead
| Field | Type | Notes |
|---|---|---|
| `id` | string | `L1001`, `L1002`, … New leads continue the sequence. |
| `name` | string | Required. |
| `phone` | string | Required on the form; fictional. |
| `email` | string | Required on the form; fictional. |
| `zip` | string | 5 digits. Used for the service-area check. |
| `service` | enum | No heat, No cooling, Furnace replacement quote, AC replacement quote, Heat pump install, Seasonal tune-up, Thermostat upgrade, Duct cleaning. |
| `homeowner` | enum | Owner, Renter, Landlord. |
| `source` | enum | Facebook ad survey, Website form, Phone call, Google Business Profile, Referral. |
| `stage` | enum | New, Contacted, Qualified, Estimate Booked, Won, Lost. |
| `notes` | string | Free text. |
| `nextAction` | string | Short description, e.g. "Book in-home estimate". |
| `nextActionDate` | date | Optional. Shown as Today / Tomorrow / Overdue. |
| `estimateAt` | datetime | Optional; set when stage becomes Estimate Booked. |
| `lostReason` | enum | Optional; set when stage becomes Lost (No response, Chose another company, Outside service area, Not ready, Other). |
| `archived` | boolean | Archived leads are hidden from the desk, not deleted. |
| `sample` | boolean | `true` for seeded leads, `false` for leads added by the visitor. |
| `createdAt` | datetime | |
| `activity` | Activity[] | Newest first in the UI. |

**Urgent** = service is *No heat* or *No cooling* and stage is not Won or Lost.

### 3.2 Activity entry
| Field | Notes |
|---|---|
| `at` | Timestamp. |
| `kind` | `created`, `stage`, `note`, `edit`, `followup-scheduled`, `email-simulated`, `archived`, `restored`. |
| `text` | Human-readable summary, e.g. "Stage changed from New to Contacted." |
| `email` | For `email-simulated` only: `{ to, subject, body, templateId }`. |

### 3.3 Settings
Stored alongside leads; see §7.

### 3.4 Seed data
14 fictional leads spread across all six stages and all five sources, including at least two urgent leads in New/Qualified and at least one Won and one Lost. Seed timestamps are relative to "now" so the demo always looks current.

---

## 4. Screens

### 4.1 Screen map
```
Landing (#/)
  ├─ Continue as demo ─────────────► Lead desk (#/desk)
  └─ Try the sample inquiry form ──► Inquiry form (#/inquiry)
                                         └─ Submit ─► Lead desk, new lead open
Lead desk (#/desk)
  ├─ Lead detail panel (#/desk/L1001)
  │    ├─ Edit lead
  │    ├─ Change stage
  │    ├─ Add note / set follow-up
  │    └─ Follow-up email preview ─► Simulated send
  ├─ Add lead (manual)  
  ├─ Archived leads (#/desk?view=archived)
  └─ Settings (#/settings)
```

### 4.2 Landing page — *built in Milestone 1*
| ID | Requirement |
|---|---|
| FR-L1 | Shows the product name, a one-sentence description, and the **Demo data** label. |
| FR-L2 | Primary action **Continue as demo** opens the lead desk. No sign-in or password is requested. |
| FR-L3 | Secondary action opens the sample inquiry form (§5). |
| FR-L4 | Shows an example lead card and the six stages with one-line explanations. |
| FR-L5 | Footer states the demo is independent, fictional, and reports no real results. |

### 4.3 Lead desk — *read-only version built in Milestone 1*
| ID | Requirement |
|---|---|
| FR-D1 | **Stage strip** shows the count of active (non-archived) leads per stage plus "All leads". Selecting a stage filters the table; the selected stage is marked (`aria-pressed`). |
| FR-D2 | **Search** matches name, phone, email, ZIP, service need, notes and lead ID, case-insensitive, as the user types. |
| FR-D3 | **Source filter** dropdown: All sources or one source. Filters combine with stage and search. |
| FR-D4 | Result count reads "14 leads" or "3 of 14 leads" and is announced to screen readers. |
| FR-D5 | Table columns: Lead (name + phone), Service need, Stage, Source, ZIP, Received (relative time), Next action (+ date). |
| FR-D6 | Sort: urgent leads first, then newest. |
| FR-D7 | Empty result shows "No leads match these filters" and a **Clear filters** action. |
| FR-D8 | Header actions: **Add lead**, **Settings**, **Reset demo data** (with confirmation), **Overview**. |
| FR-D9 | **Archived** toggle shows archived leads, each with **Restore**. |
| FR-D10 | Overdue next-action dates are visibly marked in the table. |
| FR-D11 | On screens under 720px the table becomes stacked cards with labels; no horizontal page scroll. |

### 4.4 Lead detail panel
| ID | Requirement |
|---|---|
| FR-P1 | Opens as a side panel (full width on phones) from a lead's name; URL becomes `#/desk/<id>` so it can be linked and reloaded. *(built)* |
| FR-P2 | Shows stage, urgency, next action, all lead fields, and the activity timeline. *(built)* |
| FR-P3 | Closes with the close button, Escape, or clicking outside; focus returns to the lead's name; focus is trapped while open. *(built)* |
| FR-P4 | **Stage control**: a select or segmented control for the six stages. Changing it logs "Stage changed from X to Y." |
| FR-P5 | Moving to **Estimate Booked** asks for an estimate date and time (required) and sets the next action to "Estimate visit" on that date. |
| FR-P6 | Moving to **Lost** asks for a lost reason (required). |
| FR-P7 | **Edit lead** switches the details to a form (same validation as §5.3); **Save changes** logs "Lead details edited." **Cancel** discards. |
| FR-P8 | **Add note**: free-text field and **Add note** button; note is appended to `notes` history and logged. |
| FR-P9 | **Set follow-up**: next-action text + date; logged as "Follow-up set for Fri, Nov 28: Call back." |
| FR-P10 | **Preview follow-up email** opens the email preview (§6). |
| FR-P11 | **Archive lead** (with confirmation) hides it from the desk and logs it. Archived leads can be restored. Nothing is permanently deleted except via Reset demo data. |
| FR-P12 | Each lead shows whether it is a fictional sample or a lead added in this browser. |

### 4.5 Add lead (manual)
| ID | Requirement |
|---|---|
| FR-A1 | Same fields and validation as the inquiry form, plus Source and Stage selects. Represents a team member logging a phone call. |
| FR-A2 | On save, the lead opens in the detail panel and a toast reads "Lead added". |

### 4.6 Settings — see §7

---

## 5. Lead-capture flow (sample inquiry form)

### 5.1 Purpose
Show how a homeowner's inquiry becomes a lead record — the first step in TRXmode's workflow — without collecting any real data.

### 5.2 Flow
```
Visitor opens sample inquiry form
   │   (warning: "Use made-up details. Nothing leaves this browser.")
   ├─ optional: "Fill with sample details" pre-fills a fictional homeowner
   ▼
Visitor submits
   ▼
Validation ──fail──► inline errors, focus moves to first error
   │ pass
   ▼
Lead created: stage New, source "Website form", sample = false
Activity: "Inquiry received via Website form (demo form)."
Service-area check on ZIP → activity note "ZIP 43207 is inside the service area"
   or "ZIP 90210 is outside the service area" (does not block the lead)
   ▼
Confirmation screen: "Inquiry added to the demo lead desk" + what a real
business would do next (call back, text confirmation) — all labeled simulated
   ▼
"View this lead on the desk" → #/desk/<new id>, row highlighted, panel open
```

### 5.3 Form fields and validation
| Field | Control | Rule | Error message |
|---|---|---|---|
| Full name | text | Required, 2–60 characters | "Enter a name (any made-up name is fine)." |
| Phone | tel | Required, 10 digits after removing formatting | "Enter a 10-digit phone number, for example (614) 555-0142." |
| Email | email | Required, valid format | "Enter an email like name@example.com." |
| ZIP code | text, numeric | Required, exactly 5 digits | "Enter a 5-digit ZIP code." |
| What do you need help with? | select | Required, one service | "Choose a service." |
| Do you own the home? | radio | Required: Owner, Renter, Landlord | "Choose one." |
| Anything else we should know? | textarea | Optional, max 500 characters | — |
| Best time to reach you | select | Optional: Morning, Afternoon, Evening | — |

| ID | Requirement |
|---|---|
| FR-F1 | A persistent notice above the form: "This is a demo form. Use made-up details. What you enter stays in this browser and is never sent." |
| FR-F2 | **Fill with sample details** fills every field with a random fictional homeowner (555-01xx phone, `example.com` email). |
| FR-F3 | Submit button reads **Add inquiry to demo desk**. |
| FR-F4 | Urgent services (No heat / No cooling) show a note: "In a real business this would trigger an immediate callback. In this demo, the lead is marked urgent." |
| FR-F5 | The form is reachable from the landing page and from the desk ("Add sample inquiry"). |
| FR-F6 | No data is sent over the network; the form has no `action` URL. |

---

## 6. Follow-up email behavior (simulated)

### 6.1 Principle
Lead Desk drafts and previews follow-up emails and records a **simulated send** in the lead's activity. It never opens a mail client, never uses `mailto:`, and makes no network request. Every place the email appears says it was not sent.

### 6.2 Templates
Default templates, editable in Settings (§7). Lead Desk suggests a template based on stage and service:

| Template | Suggested when | Subject (default) |
|---|---|---|
| Urgent callback | Service is No heat / No cooling and stage is New | We got your urgent request: {{service}} |
| First reply | Stage is New | Thanks for contacting {{business_name}} |
| Estimate invitation | Stage is Contacted or Qualified | Let's schedule your free in-home estimate |
| Estimate confirmation | Stage is Estimate Booked | Your estimate visit on {{estimate_date}} |
| Check-in | Next-action date is today or overdue | Checking in on your {{service_lower}} |
| Thank you | Stage is Won | Thank you for choosing {{business_name}} |

**Merge fields:** `{{first_name}}`, `{{service}}`, `{{service_lower}}`, `{{zip}}`, `{{business_name}}`, `{{sender_name}}`, `{{business_phone}}`, `{{estimate_date}}`, `{{estimate_time}}`. An empty field renders as a highlighted gap (e.g. "[estimate date]") in the preview so the user sees what's missing.

### 6.3 Preview and simulated send
| ID | Requirement |
|---|---|
| FR-E1 | **Preview follow-up email** opens a preview inside the detail panel showing To, From (fictional sender from Settings), Subject and Body, with the suggested template selected. |
| FR-E2 | A template picker lets the user switch templates; subject and body re-render. |
| FR-E3 | Subject and body are editable before sending; edits apply only to this email. |
| FR-E4 | A banner on the preview reads: "Simulated email. Nothing will be sent." |
| FR-E5 | The action button reads **Record simulated send**. On click: an `email-simulated` activity entry is added ("Simulated email recorded: <subject>. Not sent."), with the full email viewable from the timeline. Toast: "Simulated email recorded". |
| FR-E6 | If the lead is in **New**, recording a simulated send moves it to **Contacted** and logs the stage change. Other stages are unchanged. |
| FR-E7 | After recording, the user is offered **Set next follow-up** with a default date from Settings (e.g. 2 days later). |
| FR-E8 | Cancel closes the preview without logging anything. |
| FR-E9 | Lead Desk never schedules emails to be sent later, and never sends automatically. |
| FR-E10 | The email body is plain text; user-entered content is escaped when displayed. |

### 6.4 Example (rendered with sample data)
> **To:** dana.1@example.com
> **From:** Jordan at Northline Heating & Air (fictional)
> **Subject:** We got your urgent request: No heat
>
> Hi Dana,
>
> Thanks for reaching out about your furnace. Because you're without heat, we treat this as a priority. A technician will call you at (614) 555-0110 shortly to arrange a visit.
>
> — Jordan, Northline Heating & Air
>
> *Simulated email. Nothing was sent.*

---

## 7. Settings

Settings shape the demo workspace and are stored in the browser with the leads.

| ID | Setting | Default | Effect |
|---|---|---|---|
| FR-S1 | Business name | Northline Heating & Air (fictional) | Shown on the desk and in email merge fields. Always displayed with "(fictional)". |
| FR-S2 | Sender name | Jordan | Email "From" line and sign-off. |
| FR-S3 | Business phone | (614) 555-0199 | Email merge field. Must be a 555-01xx number. |
| FR-S4 | Service-area ZIP codes | List of sample ZIPs (e.g. 43004–43235) | Used by the inquiry form's service-area check. Comma-separated; invalid entries flagged. |
| FR-S5 | Default follow-up delay | 2 days | Prefills the next follow-up date after a simulated send. Options: same day, 1, 2, 3, 7 days. |
| FR-S6 | Email templates | §6.2 defaults | Edit subject and body per template; **Restore default** per template. Merge-field list shown beside the editor. |
| FR-S7 | Reset demo data | — | Restores sample leads **and** default settings after confirmation. |
| FR-S8 | Save settings | — | **Save settings** button; toast "Settings saved". Leaving with unsaved changes asks for confirmation. |

There are no settings for real email accounts, SMTP, phone numbers, calendars or integrations, by design.

---

## 8. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | **Accessibility:** WCAG 2.2 AA target. All controls reachable and operable by keyboard; visible focus; dialogs trap focus and restore it; form errors linked to fields with `aria-describedby`; live regions for counts and toasts; color is never the only signal (urgent leads also carry text). |
| NFR-2 | **Responsive:** works from 360px to wide desktop with no horizontal page scroll. |
| NFR-3 | **Reduced motion:** animations disabled under `prefers-reduced-motion`. |
| NFR-4 | **Performance:** first load under 100 KB excluding fonts; no framework. |
| NFR-5 | **Resilience:** corrupt or missing storage falls back to fresh seed data without errors. |
| NFR-6 | **Security:** all user text is escaped before rendering; no `eval`; no inline event handlers from user data. |
| NFR-7 | **Browser support:** current Chrome, Edge, Firefox and Safari. |

---

## 9. Milestones

| # | Scope | Status |
|---|---|---|
| 1 | Landing, Continue as demo, seeded leads, stage strip, search and source filters, read-only detail panel, reset | **Done** |
| 2 | Lead editing: stage changes (with estimate date and lost reason), edit, notes, follow-up date, add lead, archive/restore, overdue marking | **Done** |
| 3 | Sample inquiry form and confirmation; service-area check | **Done** |
| 4 | Follow-up email templates, preview, simulated send; Settings screen | **Done** |
| 5 | README (setup, limitations, architecture), accessibility audit, screenshots for the case study, deploy prep | **Done** (deploy itself pending) |

---

## 10. Acceptance checklist (version one)
- [ ] A visitor can reach the desk without any sign-in.
- [ ] Every screen shows the Demo data label.
- [ ] Submitting the sample form adds a New lead visible on the desk in the same browser only.
- [ ] Stage, search and source filters combine correctly; counts match the table.
- [ ] A lead can be edited, moved through all six stages, noted, scheduled, archived and restored.
- [ ] A follow-up email can be previewed, edited and recorded as a simulated send; the timeline says it was not sent.
- [ ] Network panel shows no request containing lead data.
- [ ] Reset demo data restores the 14 sample leads and default settings.
- [ ] Keyboard-only and 375px-wide walkthroughs succeed.

---

## 11. Open questions for review
1. **Settings scope:** is the list in §7 right, or should Settings be lighter (e.g. business name and templates only)?
2. **Auto-advance on send:** should a simulated send move a New lead to Contacted automatically (FR-E6), or should the user always change stages by hand?
3. **Estimate booking:** is a date-and-time field enough for "Estimate Booked", or do you want a simple slot picker as a preview of Project 4 (Booking Mini-App)?
4. **Sender persona:** is "Jordan at Northline Heating & Air (fictional)" acceptable as the default sender?
5. **Export:** should visitors be able to download their demo leads as CSV? (Not included in this draft.)
