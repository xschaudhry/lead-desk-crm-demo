# Case study: Lead Desk

**An HVAC lead-to-estimate CRM demo**

## Quick facts

- **Role:** Product design, requirements and front-end development (solo), built with AI coding assistance
- **Context:** Independent portfolio project. It is not client work and is not affiliated with any HVAC business.
- **Timeline:** Five milestones, from a written spec to a deploy-ready build
- **Stack:** Plain HTML, CSS and JavaScript; no framework, no build step, no runtime dependencies
- **Outcome:** A working, responsive, keyboard-accessible demo of the inquiry-to-estimate workflow, with every record fictional and every email simulated

> **Honesty note.** Lead Desk has not been used with real customers. It reports no conversion, response-time or revenue results, and none should be inferred from its sample data.

![The Lead Desk landing page](screenshots/01-landing.png)

---

## Overview

Service businesses that run ads for estimate bookings live or die on the minutes after an inquiry arrives. Lead Desk is a small CRM that shows what that step looks like when it's organized:

1. An inquiry comes in.
2. Anyone without heat is at the top of the list.
3. Every lead has a next action and a due date.
4. A follow-up email is one click away.

The emails are simulated: they are recorded on the lead and never sent.

I built it as the centerpiece of my automation portfolio. My existing demos each cover one piece: quoting, follow-up, calibration and a command center. Lead Desk ties those capabilities into one product a visitor can actually use.

## The problem

An HVAC company running a "free estimate" ad campaign gets inquiries from a Facebook survey, a website form, phone calls, its Google Business Profile and referrals. Three things go wrong:

- **Urgency gets lost.** A family with no heat in November sits in the same list as someone asking about a thermostat upgrade.
- **Follow-up depends on memory.** Nobody owns the next step, so leads quietly go cold between "contacted" and "estimate booked".
- **No one can see the pipeline.** Without stage counts, the team can't tell whether inquiries are piling up at first contact or at booking.

**Goal:** a demo that makes the inquiry → qualification → follow-up → booked-estimate workflow tangible for three kinds of visitor:

- recruiters and hiring managers
- implementation teams
- HVAC business owners

**Constraints I set before writing code:**

- **Fictional data, clearly labeled.** Phone numbers are in the 555-01xx range reserved for fiction, emails are at `example.com`, and a "Demo data" label appears on every screen.
- **Nothing leaves the browser.** There is no backend, no sign-in and no passwords.
- **Nothing is sent.** No email, SMS, calls, calendar connections or ad accounts.
- **No invented results anywhere,** including in this write-up.

## Process

### Requirements early

I started with a small read-only milestone to prove the layout and data model. Then I paused to write a [functional requirements document](FRD.md) before adding any editing: 61 numbered requirements across the screens, the lead-capture flow, email behavior, settings and accessibility, plus an acceptance checklist. It forced the questions a real project would raise:

- What does "Estimate Booked" require? A visit date and time.
- What happens to a lost lead? It must record a reason.
- Does recording an email move a lead's stage? Only New moves to Contacted.

The work ran in five reviewable milestones, each ending in a browser test:

1. Read-only desk: landing page, sample data, filters, detail panel
2. Editing: stages, notes, follow-ups, add lead, archive and restore
3. Sample inquiry form with a service-area check
4. Simulated follow-up emails and Settings
5. Accessibility audit, screenshots, README, deploy prep

### Key decisions

**Plain JavaScript instead of a framework.** The demo has six screens and one data object. A framework would have added a build step and a dependency tree without making the product better, and the whole app stays readable for a reviewer in one sitting. Every piece of user-entered text is escaped before it is rendered.

**Urgency and lateness are different colors.** The palette comes from an HVAC gauge manifold:

- **Red** (the high-pressure side) marks only leads without heat or cooling.
- **Blue** (the low-pressure side) marks actions.
- **Amber** marks overdue follow-ups.

Keeping "urgent" and "late" visually distinct means a red row always means "call now". Each state also has a text label, so color is never the only signal.

**The stage strip is both a dashboard and a filter.** Instead of a separate chart, the six stages sit in one continuous strip, drawn like a run of ductwork, with a count in each section. Clicking a stage filters the table, so seeing a bottleneck and acting on it is the same click.

**Simulated email has to stay honest.**

- The composer carries a striped "Simulated email. Nothing will be sent." banner.
- The action is labeled "Record simulated send", not "Send".
- Each recorded email is stored with "Not sent" in the lead's activity history.

The suggested template follows the lead's state: an urgent callback for no heat, an estimate confirmation once a visit is booked, a check-in when a follow-up is overdue.

**Missing details are visible.** If a template needs a detail the lead doesn't have, such as the estimate date, the draft shows a visible gap like "[estimate date]". Recording is blocked until it's filled in or removed. A silent blank would be the mistake that embarrasses a real business in front of a customer.

**Settings protect the fiction.** The business name is always shown with "(fictional)", and the business phone is rejected unless it's in the 555-01xx range. The constraints are built into the product, not left to good intentions.

**Deployment protects private files.** A static host publishes every file in the repository by default. Before deploying, I added rules to keep the planning brief and tooling folders off the live site. I also made the local server apply the same security headers as production, so the content-security policy was tested before anything went live.

## Solution

### The lead desk

![Lead desk with stage counts, urgent leads first and an overdue follow-up](screenshots/02-lead-desk.png)

- 14 fictional leads across six stages and five sources.
- Search covers name, phone, email, ZIP, service and notes, and combines with the source filter and stage strip.
- Sorting puts no-heat and no-cooling leads first, then overdue follow-ups, then the newest.
- Archive hides a lead without deleting it; restore brings it back.

### The lead record

![Lead detail panel with stage, follow-up and notes](screenshots/03-lead-detail.png)

- **Stages:** changes are validated; Estimate Booked asks for a visit time and Lost asks for a reason.
- **Editing, notes and follow-ups:** field-level error messages, and focus moves to the first problem.
- **Activity history:** each stage change, note, edit, follow-up, service-area check and simulated email is logged with when it happened.
- **Shareable state:** each lead has its own URL, so the panel survives a reload.

### Simulated follow-up email

![Estimate confirmation email suggested and filled in from the lead](screenshots/04-simulated-email.png)

- Six templates, with one suggested for the lead's stage and service.
- Fill-in fields such as the first name, the service written into a sentence ("heating outage"), and the estimate date and time.
- Editable before recording; a New lead moves to Contacted, and the next follow-up is offered automatically.

### Lead capture

![Inquiry confirmation with service-area result](screenshots/05-inquiry-confirmation.png)

- A customer-facing sample form with a "use made-up details" notice and a "Fill with sample details" button.
- The ZIP is checked against the service area. A lead from outside the area is still accepted, just flagged, because a lost lead is worse than a lead that needs checking.
- A confirmation screen explains what a real business would do next and hands the new lead to the desk.

### Built for every screen

<img src="screenshots/06-mobile-desk.png" alt="Lead desk on a phone" width="260">

- On phones, the table becomes labeled cards, and the stage strip becomes one row you can swipe through.
- The lead panel works as a proper dialog: focus moves into it and stays inside, the page behind is inert, and Escape closes it and returns focus to the lead you opened.

## Results

There are no customer results to report, because the demo hasn't met a customer. These are the things I can verify about the build:

| What | Result |
|---|---|
| Requirements | 61 numbered requirements written; all five milestones delivered and tested in the browser |
| Dependencies | None at runtime; no build step |
| Page weight | 108 KB uncompressed, 28 KB gzipped, excluding fonts. My own target was 100 KB uncompressed, so I missed it slightly; the gzipped download is well under. |
| Text contrast | Meets WCAG AA on every screen; lowest pair 4.65:1 |
| Control contrast | Input borders raised from 2.2:1 to 3.4:1 after the audit, to meet the 3:1 rule for controls |
| Privacy | The only network requests are the page's own files and Google Fonts; no lead data is ever sent |
| Phone layout | Works at 375px wide with no horizontal page scroll |

**What has not been tested:**

- conversion or response-time impact
- usability with HVAC office staff
- a full screen-reader pass with NVDA or VoiceOver

## Learnings

**What worked**

- **Writing the FRD early.** Most of the interesting decisions were made in writing, before the code that needed them: the estimate date, the lost reason, gaps in email drafts, the fictional phone range. Building then became a matter of following the document.
- **Small milestones with a browser test at the end of each.** Four of the five milestones caught a real bug before it shipped:
  - the desk opening scrolled halfway down, carried over from the landing page
  - a count that read "1 archived leads"
  - an email template that would have said "a AC replacement"
  - a sample email address mangled by an accented name
  - a stray notification and leftover test data in the screenshots
- **Building the honesty into the product.** Because the fictional labels, phone-range validation and "Not sent" records are part of the app, the demo can't be mistaken for real results, even out of context.

**What I'd do differently**

- **Accessibility from milestone one, not milestone five.** The contrast and dialog fixes were small, but they would have cost nothing if they'd been in the original design tokens.
- **Set the page-weight target with real numbers.** I set the 100 KB target before the email templates existed. Measuring after milestone two would have given a realistic budget.
- **Test with a screen reader as I go,** not as a later follow-up.

**Next steps**

- Usability sessions with people who run an HVAC office, to see whether the stage strip and urgency sorting match how they actually triage.
- A speed-to-lead workflow (the next project in the series), connecting the inquiry form to a simulated first response and team alert.
- An estimate-booking mini-app, which would replace the date-and-time field with real availability.

---

**Links:** [Live demo](#) (add after deploy) · [Source code](../README.md) · [Functional requirements](FRD.md)

*All names, phone numbers, emails and businesses shown are fictional. Screenshots are from the demo's sample data.*
