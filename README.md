# prime layer

B2B demand intelligence platform

Working name used below: prime intelligence network. It fits because the whole product is about detecting demand forming beneath the surface, before a company has posted "we are buying." Keep the identity fully separate from any other product or brand you have built. Do not reference, reuse, or echo any prior brand's colors, layout, or voice. This is a new company with its own visual language.

What this product is

Build the marketing and product-preview site for a B2B demand intelligence platform, as a small multi-page site, not a single long scroll. The core idea, stated plainly:

"We don't find leads. We detect markets moving."

A supplier tells the system what they sell (for example: 5,000 TVs available in Nigeria, minimum order 20 units). Instead of returning thousands of generic companies, the system returns a short list of companies that are showing real signals of an emerging need (a hotel opening 150 rooms, a restaurant chain expanding, a developer furnishing serviced apartments), before that company has posted a formal buying request. Every match comes with the evidence behind it, a confidence score, and a likely timing window.

Underneath, the system runs on a "Demand Graph": company, event, changing situation, likely need, timing, evidence. Multiple intelligence agents (the company's own crawlers plus outside contributors) can each surface evidence independently. The system clusters evidence so five agents citing the same article count as one source, not five. It reasons over disagreement instead of just tallying votes. It tracks predictions against real outcomes and improves over time.

This is a serious, fundable product, not a toy demo. The design needs to read as something a cautious enterprise buyer, or a VC doing diligence, would trust immediately.

Design direction

Do not default to generic AI-startup visual language: no glowing gradient orbs, no "Powered by AI" badges, no purple-to-blue hero gradient, no stock rocket or lightbulb icons, no generic dashboard screenshot floating at an angle. This product's entire value proposition is rigor and evidence, so the design itself has to feel evidentiary, not decorative.

Think in two registers that map to the product's real duality: a dark, control-room register for where signals are detected and reasoned over, and a light, paper-trail register for where evidence is laid out and audited. Moving between them across the page should feel intentional, like moving from the situation room to the case file.

Color tokens

Ink #12151B (primary dark surface, hero and nav)

Slate #2B3038 (secondary dark surface, cards on dark)

Vellum #EFF1EF (light surface for evidence and proof sections, cool and slightly grey, not a warm cream)

Signal Teal #3E8E88 (the one live accent, used for active signals, links, and the ledger pulse. Use it sparingly and consistently)

Verified Green #4C7A5E (functional only, marks high-confidence or verified evidence, never decorative)

Flag Rust #A6543C (functional only, marks contradiction or low confidence, never decorative)

Type tokens

Display: Fraunces, set large and slightly tight, used only for headlines and section titles. It gives the page institutional gravity without tipping into generic corporate sans.

Body and UI: IBM Plex Sans, clean and neutral, carries all running copy and interface text.

Data: IBM Plex Mono, used exclusively for anything that is literally data: confidence percentages, timestamps, evidence IDs, source counts. This is what makes the ledger feel like a real read-out instead of a mockup.

Load all three from Google Fonts.

Signature element

The one thing this page should be remembered for: a live-feeling "Evidence Ledger" in the hero. Not a static image. A vertically stacked feed of entries that appear and update on a slow, deliberate cadence (a few seconds apart, not frantic), each row in Plex Mono, structured like:

SIGNAL   Lagos, hotel permit filed, 150 rooms
EVIDENCE 3 independent sources, clustered
CONFIDENCE 82%
LIKELY NEED  televisions, HVAC, networking, within 45 days


Rows fade in, hold, then get replaced. Keep the animation restrained: this is a signature moment, not ambient decoration. Respect reduced-motion settings.

Site map

Keep it tight, five pages total. Every page shares the same nav and the same minimal footer.

Home — the landing page. The pitch, the signature element, and just enough to make someone want the next page. Not a dumping ground for every section.

How it works — the full four-step loop and the evidence-clustering explanation.

Product — the interactive query demo.

Trust — the evidentiary-rigor page aimed at enterprise buyers and diligence-minded readers.

Request access — a short form. No free self-serve sign-up.

Nav: Home / How it works / Product / Trust, with "Request access" as a persistent button rather than a nav link buried among the rest.

Page structure and copy

Write all copy in plain, active, specific language. No hype adjectives, no "revolutionary" or "game-changing." State what the product does and let the specificity carry the weight.

Home (Ink background)

Headline: "We don't find leads. We detect markets moving."

Subhead, one or two sentences: tell the system what you sell, it finds the companies developing a real reason to buy it, before they have said so publicly.

The Evidence Ledger signature element, described above, as the visual centerpiece.

One short paragraph teasing the four-step loop by name only (Signal, Evidence, Prediction, Outcome), linking through to How it works rather than explaining it here.

One proof line pulled from Trust, for example "Every prediction ships with its evidence trail," linking through to Trust.

Primary CTA: Request access.

How it works (Vellum background)

This is a genuine four-step sequence, so numbered markers are earned here: 01 Signal, 02 Evidence, 03 Prediction, 04 Outcome. One short paragraph each, grounded in the hotel-and-TVs example from the brief. Include the evidence-clustering diagram here in full: several small source icons converging into one labeled evidence cluster, with a note like "5 agents, 3 independent sources." Close the page by noting predictions are checked against what actually happens, and the system learns from both hits and misses.

Product (Vellum or Ink, your call)

A working-feeling interactive mockup of the core query. An input pre-filled with something like "I have 5,000 TCL TVs available in Nigeria, minimum order 20 units" and a "Find demand" action that reveals a short list of result cards. Each card: company name, one-line signal description, confidence percentage in Plex Mono, and an expandable evidence trail. This should feel like the actual product, not a marketing illustration of it.

Trust (Ink background)

The evidentiary-rigor page for enterprise buyers and diligence-minded readers: every prediction ships with its evidence trail, confidence is never asserted without a source behind it, and disagreement between sources is shown rather than hidden. Keep this page quiet and factual, it should read like a compliance page, not a sales pitch.

Request access (Vellum background)

A short form: name, company, email, one line on what they're looking to move. One confirming sentence after submit, nothing more. No marketing copy on this page beyond that.

Footer (all pages)

Minimal. Company name, one-line description, Request access, contact. Do not clutter it with social icons or a large sitemap. Restraint here matters as much as anywhere else on the site.

Technical requirements

Fully responsive down to mobile, the Evidence Ledger should degrade gracefully to a simpler static or slower feed on small screens.

Visible keyboard focus states throughout.

Respect prefers-reduced-motion.

The Product page's query demo should be genuinely interactive (state changes on submit), not a static image.

Nav and footer stay identical across all five pages, no per-page variation in structure.

Keep the whole site to the two-register palette above. Do not introduce new accent colors on any page, reuse Signal Teal, Verified Green, and Flag Rust for their defined functional purposes only.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/859c4852-d42e-4fab-878d-b98cff2b7374).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
