/**
 * Prime Signals — Prime Layer's own first-party search agent.
 *
 * A production-grade reference connector: it registers on the grid like any
 * external developer agent, receives research commands, performs REAL research
 * against free public sources (Google News RSS + GDELT), extracts companies
 * showing expansion/construction/opening signals, and submits graded-ready
 * claims with verifiable source URLs.
 *
 *   bun run agents/prime-signals/index.ts [--port 8790]
 *
 * Env:
 *   PRIME_ORCHESTRATOR  orchestrator base URL (default http://localhost:8081)
 *   CONNECTOR_PORT      listener port (default 8790)
 *   CONNECTOR_WALLET    settlement address; a fresh wallet is generated if unset
 *   SIGNALS_GDELT       "off" disables the GDELT source (default on)
 */

import { ethers } from "ethers";

const ORCHESTRATOR = process.env["PRIME_ORCHESTRATOR"] ?? "http://localhost:8081";
const PORT = Number(process.env["CONNECTOR_PORT"] ?? 8790);
const GDELT_ENABLED = (process.env["SIGNALS_GDELT"] ?? "on").toLowerCase() !== "off";

const NAME = "Prime Signals";
const SPECIALTY =
  "global news sweep: expansion, construction, opening and investment signals across hotels, manufacturing, logistics and retail";

const wallet =
  process.env["CONNECTOR_WALLET"] ??
  new ethers.Wallet(ethers.Wallet.createRandom().privateKey).address;

// ─── Signal vocabulary ──────────────────────────────────────────────────────

/** Title-level verbs/phrases that indicate a company's situation is CHANGING. */
const SIGNAL_RE =
  /\b(expansion|expand[s]?|opens?|opening|inaugurat\w*|commission\w*|groundbreak\w*|breaks ground|broke ground|construction|to build|building|set to open|new (hotel|factory|plant|facility|store|branch|warehouse|terminal|refinery|mill)|flagship|launch(es|ed)?|unveil\w*|acquir(es|ed)?|acquisition|merger|invest(s|ed|ment)?|funding|raise[sd]?|refurbish\w*|renovat\w*|fit-out|fitout)\b/i;

const STOPWORDS = new Set(
  (
    "a an and are as at be been by for find from has have how i in into is it its me my of on " +
    "or our sell selling show that the their them they this to us want was we what which who " +
    "will with you your become becoming likely need needs companies company business businesses " +
    "give tell looking show showing evidence real some just about across between more most new " +
    "can could should would were than then when where while who's let's"
  ).split(" "),
);

/**
 * Words that look like proper nouns in headlines but are places, people,
 * nationalities or news-desk furniture — never a company we can name.
 * Deliberately GLOBAL: the grid sources worldwide, not one region.
 */
const NOT_A_COMPANY = new Set(
  (
    "nigeria nigerian nigerians lagos abuja ghana ghanaian kenya kenyan nairobi africa african " +
    "egypt egyptian cairo southafrica johannesburg europe european america american british " +
    "london dubai asia asian ogun ogunstate ibadan kano abia rivers kaduna enugu anambra delta " +
    "oyo oyoState kwara osun ondo edo katsina sokoto borno yobe adamawa taraba benue plateau " +
    "nasarawa niger zamfara kebbi jigawa gombe ekiti china chinese chineseaided ecowas " +
    "tinubu obi atiku buhari president minister governor senate house government federal state " +
    "updated breaking exclusive analysis opinion report reports video photos watch " +
    "monday tuesday wednesday thursday friday saturday sunday january february march april " +
    "may june july august september october november december today yesterday tomorrow " +
    "usa uk britain france french germany german india indian brazil canadian canada " +
    "australia australian japan japanese indonesia indonesian vietnam vietnamese mexico " +
    "spain spanish italy italian turkey turkish uae saudi emirates russia russian ukraine " +
    "israel israeli gaza iran iraq syria pakistan bangladesh philippines malaysia singapore " +
    "texas california florida york jersey ceo cfo coo founder chairman director"
  ).split(" "),
);

/** Bare headline verbs — a candidate containing one is a fragment, not a name. */
const HEADLINE_VERBS = new Set(
  (
    "launches launched launch opens opened opening unveils unveiled moves moved says said " +
    "plans planned begins began begins signs signed gets got wins won hosts hosted faces faced " +
    "enhancing enhance expands expanded grows growing rises rising falls falling cuts cutting " +
    "approves approves rejects joins joins leads led takes took sets set targets targets"
  ).split(" "),
);

/** Generic nouns — alone, they are commodities or sectors, never a company. */
const GENERIC_SINGLE_NOUNS = new Set(
  (
    "oil gas gold power energy cement bank banks hotel hotels factory factories plant plants " +
    "sugar flour steel mine mines port ports road roads bridge bridges estate estates " +
    "government ministry agency authority commission council association union group"
  ).split(" "),
);

type Evidence = { item: string; source: string; observed: string };
type Claim = { company: string; claim: string; confidence: number; evidence: Evidence[] };
type ResearchCommand = {
  command_id: string;
  inquiry_id: string;
  question: string;
  scope: { category?: string; geography?: string };
  window_seconds: number;
  submit_url: string;
};

// ─── Query building ─────────────────────────────────────────────────────────

function buildQueries(cmd: ResearchCommand): string[] {
  const geo = cmd.scope.geography ?? "";
  const words = cmd.question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w));

  // Drop the geography word from the topic list so it isn't doubled up.
  const geoLower = geo.toLowerCase();
  const topicWords = words.filter((w) => w !== geoLower);
  const topic = Array.from(new Set(topicWords)).slice(0, 5).join(" ");

  const queries: string[] = [];
  if (topic && geo) queries.push(`${topic} ${geo}`);
  if (topic && !geo) queries.push(topic);
  if (geo) queries.push(`${geo} (new hotel OR factory OR plant OR warehouse OR headquarters)`);
  return Array.from(new Set(queries)).slice(0, 2);
}

// ─── Sources ────────────────────────────────────────────────────────────────

type RawSignal = {
  title: string;
  link: string;
  publisherUrl: string | null;
  publishedAt: string; // ISO date (yyyy-mm-dd)
};

async function fetchGoogleNews(query: string): Promise<RawSignal[]> {
  const url =
    `https://news.google.com/rss/search?q=${encodeURIComponent(query)}` +
    "&hl=en-US&gl=US&ceid=US:en";
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; PrimeSignals/1.0)" },
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`google news ${res.status}`);
  const xml = await res.text();

  const signals: RawSignal[] = [];
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  for (const item of items.slice(0, 15)) {
    const title = tag(item, "title");
    const link = tag(item, "link");
    const pubDate = tag(item, "pubDate");
    const sourceUrl = item.match(/<source[^>]*url="([^"]+)"/)?.[1] ?? null;
    if (!title || !link) continue;
    signals.push({
      title,
      link,
      publisherUrl: sourceUrl,
      publishedAt: toDate(pubDate) ?? new Date().toISOString().slice(0, 10),
    });
  }
  return signals;
}

async function fetchGdelt(query: string): Promise<RawSignal[]> {
  const url =
    "https://api.gdeltproject.org/api/v2/doc/doc?query=" +
    encodeURIComponent(query) +
    "&mode=ArtList&maxrecords=15&format=json&timespan=7d";
  await sleep(5_200); // GDELT asks for 1 request / 5s
  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`gdelt ${res.status}`);
  const text = await res.text();
  if (!text.startsWith("{")) throw new Error("gdelt rate limited");
  const data = JSON.parse(text) as {
    articles?: { title?: string; url?: string; seendate?: string; domain?: string }[];
  };
  return (data.articles ?? [])
    .filter((a) => a.title && a.url)
    .map((a) => ({
      title: a.title!,
      link: a.url!,
      publisherUrl: a.domain ? `https://${a.domain}` : null,
      // seendate format: 20260823T091500Z
      publishedAt: toDate(a.seendate ?? "") ?? new Date().toISOString().slice(0, 10),
    }));
}

// ─── Extraction ─────────────────────────────────────────────────────────────

/** Pull the company name out of a headline using common news patterns. */
function extractCompany(title: string): string | null {
  const head = title.replace(/\s+-\s+[^-]+$/, "").trim(); // drop "- Publisher"

  const patterns: RegExp[] = [
    /^(?:Nigeria's|Ghana's|Kenya's|South Africa's|Egypt's)?\s*(.{3,60}?)\s+(?:opens?|opened|inaugurates?|commissions?|unveils?|launches|launched|expands?|begins|started?|breaks ground|broke ground|debuts)\b/i,
    /^(.{3,60}?)\s+(?:to|set to|will)\s+(?:open|build|construct|launch|expand|commission|establish)\b/i,
    /\$(?:[\d,.]+)\s*(?:bn|billion|m|million)?\s+(?:investment|loan|facility|deal|fund)\s+(?:in|for|to)\s+(.{3,60}?)(?:\s*[,-–]|\s|$)/i,
    /^(.{3,60}?)\s+(?:has|have)\s+(?:opened|launched|started|begun|completed|announced)\b/i,
  ];
  for (const re of patterns) {
    const m = head.match(re);
    if (m?.[1]) {
      const name = cleanName(m[1]);
      if (name) return name;
    }
  }
  // Pattern verbs failed — only trust the capitalised-run fallback when a
  // strong signal verb is present in the headline.
  if (!SIGNAL_RE.test(head)) return null;
  const cap = head.match(/\b([A-Z][A-Za-z&.'-]+(?:\s+[A-Z][A-Za-z&.'-]+){0,3})/);
  return cap ? cleanName(cap[1]) : null;
}

function cleanName(raw: string): string | null {
  const name = raw
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/\s+(?:as|and|with|for|in|at|to|by|from)$/i, "")
    .replace(/[.,;:]$/, "")
    .trim();
  if (name.length < 3 || name.length > 70) return null;
  if (/^(news|update|report|weekly|daily|breaking)$/i.test(name)) return null;

  const tokens = name.toLowerCase().split(/\s+/);
  const meaningful = tokens.filter((t) => !/^(of|the|and|for|in|new)$/i.test(t) && t.length > 1);
  if (meaningful.length === 0) return null;
  // Every meaningful token is a place/person/news-desk word -> not a company.
  if (meaningful.every((t) => NOT_A_COMPANY.has(t.replace(/[^a-z]/g, "")))) return null;
  // A headline verb inside the candidate means we grabbed a clause fragment.
  if (meaningful.some((t) => HEADLINE_VERBS.has(t))) return null;
  // Possessive endings ("Nigeria's") betray a place-led fragment.
  if (/^[a-z]+'s$/i.test(tokens[0] ?? "")) return null;
  // A lone generic noun ("Oil", "Hotel") is a sector, not an operator.
  if (meaningful.length === 1 && GENERIC_SINGLE_NOUNS.has(meaningful[0]!.replace(/[^a-z]/g, ""))) {
    return null;
  }
  return name;
}

function scoreSignal(signal: RawSignal): number {
  let confidence = 0.58;
  const t = signal.title;
  // Concrete capacity or money mentioned -> stronger signal.
  if (
    /\$\s?[\d,.]+/.test(t) ||
    /\b\d{3,}\s*(rooms|beds|sqm|hectares|units|containers|tonnes)\b/i.test(t)
  ) {
    confidence += 0.12;
  }
  // Fresh observations score higher than stale ones.
  const ageDays = (Date.now() - Date.parse(signal.publishedAt)) / 86_400_000;
  if (Number.isFinite(ageDays)) {
    if (ageDays <= 2) confidence += 0.08;
    else if (ageDays <= 7) confidence += 0.04;
  }
  return Math.min(0.85, Number(confidence.toFixed(2)));
}

function toClaims(signals: RawSignal[], cmd: ResearchCommand): Claim[] {
  const seenClusters = new Set<string>();
  const claims: Claim[] = [];

  for (const s of signals) {
    if (!SIGNAL_RE.test(s.title)) continue;

    const company = extractCompany(s.title);
    // Quality gate: an unnameable operator is not intelligence. Skip it —
    // the story stays in the source, but we don't fabricate a company row.
    if (!company) continue;
    if (claims.some((c) => c.company === company)) continue;

    const source = s.publisherUrl ?? s.link; // publisher domain = true cluster key
    const cluster = sourceClusterKey(source);
    if (seenClusters.has(cluster)) continue; // one claim per source per run
    seenClusters.add(cluster);

    const confidence = scoreSignal(s);
    claims.push({
      company,
      claim: `News signal: ${s.title.replace(/\s+-\s+[^-]+$/, "")}`,
      confidence,
      evidence: [
        {
          item: s.title,
          source,
          observed: s.publishedAt,
        },
      ],
    });
    if (claims.length >= 8) break; // stay focused; quality over spam
  }

  void cmd;
  return claims;
}

export function sourceClusterKey(source: string): string {
  return source
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "");
}

// ─── Grid plumbing ──────────────────────────────────────────────────────────

let agentId: string | null = null;

async function register(): Promise<string> {
  const res = await fetch(`${ORCHESTRATOR}/api/agents/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name: NAME,
      specialty: SPECIALTY,
      endpoint: `http://localhost:${PORT}/claim`,
      wallet,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json()) as { agent_id?: string; error?: string };
  if (!res.ok || !body.agent_id) {
    throw new Error(`registration failed: ${body.error ?? res.status}`);
  }
  return body.agent_id;
}

async function researchAndSubmit(command: ResearchCommand) {
  try {
    const queries = buildQueries(command);
    console.log(`→ CMD ${command.command_id} · queries:`, queries);

    const signals: RawSignal[] = [];
    for (const q of queries) {
      try {
        signals.push(...(await fetchGoogleNews(q)));
      } catch (err) {
        console.warn("  google news failed:", err instanceof Error ? err.message : err);
      }
      if (GDELT_ENABLED) {
        try {
          signals.push(...(await fetchGdelt(q)));
        } catch (err) {
          console.warn("  gdelt failed:", err instanceof Error ? err.message : err);
        }
      }
    }
    console.log(`  raw signals: ${signals.length}`);

    const claims = toClaims(signals, command);
    if (claims.length === 0) {
      await decline(command);
      return;
    }

    const res = await fetch(command.submit_url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        command_id: command.command_id,
        inquiry_id: command.inquiry_id,
        agent_id: agentId,
        claims,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const body = await res.json();
    if (res.ok) {
      console.log(`✓ submitted ${claims.length} claim(s):`);
      for (const c of claims) {
        console.log(
          `    • ${c.company} @ ${(c.confidence * 100).toFixed(0)}% ← ${c.evidence[0]?.source}`,
        );
      }
    } else {
      console.warn("✗ submission rejected:", body);
    }
  } catch (err) {
    console.error("research failure:", err);
  }
}

async function decline(command: ResearchCommand) {
  await fetch(command.submit_url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      command_id: command.command_id,
      inquiry_id: command.inquiry_id,
      agent_id: agentId,
      claims: [],
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined);
  console.log("✗ declined (no qualifying signals)");
}

// ─── Utils ──────────────────────────────────────────────────────────────────

function tag(xml: string, name: string): string | null {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  if (!m?.[1]) return null;
  return m[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}

function toDate(raw: string): string | null {
  if (/^\d{8}T\d{6}Z$/.test(raw)) {
    const iso = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`;
    return iso;
  }
  const d = raw ? new Date(raw) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toISOString().slice(0, 10) : null;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Boot ───────────────────────────────────────────────────────────────────

await main();

async function main() {
  agentId = await register();
  console.log(`✓ ${NAME} registered · id=${agentId} · wallet=${wallet}`);

  Bun.serve({
    port: PORT,
    async fetch(request) {
      const url = new URL(request.url);
      if (request.method === "POST" && url.pathname === "/claim") {
        const command = (await request.json()) as ResearchCommand;
        void researchAndSubmit(command); // async; window stays open
        return Response.json({ accepted: true });
      }
      if (url.pathname === "/health") {
        return Response.json({ ok: true, agent: NAME, agentId });
      }
      return new Response("prime-signals connector", { status: 200 });
    },
  });

  console.log(`✓ listening on http://localhost:${PORT}/claim`);
}
