/**
 * Offline URL classification via the existing check.mjs, plus optional
 * evidence-only explanations from Groq. Never navigates to the checked URL.
 *
 * Usage:
 * node explain.mjs https://verifymydevice.gov.ng --no-ai
 * node explain.mjs secure-verifymydevice.ng --lang=pidgin
 *
 * GROQ_API_KEY must be set in the calling shell for AI explanations.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const offline = args.includes("--no-ai");
const language = args.includes("--lang=english") ? "English" : "Nigerian Pidgin";
const input = args.find((arg) => !arg.startsWith("--"));

if (!input || input.length > 2048 || args.some((arg) => arg.startsWith("--lang=") && !["--lang=english", "--lang=pidgin"].includes(arg))) {
  console.error("Usage: node explain.mjs <domain-or-URL> [--lang=pidgin|english] [--no-ai]");
  process.exit(2);
}

let evidence;
try {
  const checkPath = fileURLToPath(new URL("./check.mjs", import.meta.url));
  const raw = execFileSync(process.execPath, [checkPath, input], {
    encoding: "utf8", timeout: 5000, maxBuffer: 128 * 1024,
  });
  evidence = JSON.parse(raw);
} catch {
  console.error("The existing check.mjs could not be run or returned invalid JSON.");
  process.exit(1);
}

// A hostname on an official list does not establish page safety. Do not
// label an insecure scheme or unexpected port as an official URL match.
if (evidence.status === "official-domain-match") {
  try {
    const parsed = new URL(input.includes("://") ? input : `https://${input}`);
    if (parsed.protocol !== "https:" || parsed.port) {
      evidence = {
        status: "unverified",
        domain: evidence.domain,
        reason: "Unexpected URL scheme or port; this URL was not verified",
        note: "Use only the official HTTPS address published by the authority.",
      };
    }
  } catch {
    evidence = { status: "invalid", reason: "Invalid URL" };
  }
}

const verdicts = {
  "known-phishing": "KNOWN PHISHING — listed in NCC-CSIRT advisory",
  "official-domain-match": "OFFICIAL HOSTNAME MATCH — page safety not verified",
  unverified: "UNVERIFIED — no safety determination",
  invalid: "INVALID URL",
};

console.log(`Verdict: ${verdicts[evidence.status] ?? "UNVERIFIED"}`);
if (evidence.domain) console.log(`Domain: ${evidence.domain}`);
if (evidence.reason) console.log(`Evidence: ${evidence.reason}`);
if (evidence.source) console.log(`Source: ${evidence.source}`);
if (evidence.officialAlternative) console.log(`Official alternative: ${evidence.officialAlternative}`);
console.log("Scope: Local list check only. No website opened, redirect followed, or live reputation checked.");

if (offline) process.exit(0);

if (evidence.status !== "known-phishing" && evidence.status !== "official-domain-match") {
  console.log("AI explanation skipped: no authoritative match to explain.");
  process.exit(0);
}

const key = process.env.GROQ_API_KEY?.trim() ?? "";
if (!key) {
  console.log("AI explanation skipped: GROQ_API_KEY is not set. Deterministic result is still available.");
  process.exit(0);
}
if (!/^gsk_[A-Za-z0-9_-]+$/.test(key)) {
  console.error("Invalid Groq key format. No request made. Keep the key private.");
  process.exit(1);
}

const payload = {
  model: "openai/gpt-oss-120b",
  reasoning_effort: "low",
  include_reasoning: false,
  max_completion_tokens: 240,
  messages: [
    {
      role: "system",
      content: `You are explaining the results of a limited URL-checking rule engine in simple ${language}. Only explain supplied facts. You do not have live browsing. A hostname match never proves a webpage is safe. Never invent evidence, payment requests, or official URLs. Keep the response to 2–3 short sentences.`,
    },
    {
      role: "user",
      content: `Explain these verified local-data findings. Do not change the verdict. ${JSON.stringify(evidence)}`,
    },
  ],
};

// Pass the secret via curl's stdin config rather than command arguments,
// so it does not appear in shell history or the process argument list.
const result = spawnSync("curl", [
  "--silent", "--show-error", "--fail-with-body", "--max-time", "35",
  "--config", "-", "--header", "Content-Type: application/json",
  "--data-binary", JSON.stringify(payload),
  "https://api.groq.com/openai/v1/chat/completions",
], {
  input: `header = "Authorization: Bearer ${key}"\n`,
  encoding: "utf8", maxBuffer: 1024 * 1024, timeout: 40_000,
});

if (result.error || result.status !== 0) {
  console.error(`Groq explanation unavailable (request failed; exit ${result.status ?? "unknown"}). The local verdict above remains valid within its stated scope.`);
  process.exit(1);
}
let data;
try {
  data = JSON.parse(result.stdout);
} catch {
  console.error("Groq returned an unexpected response. No AI verdict was used.");
  process.exit(1);
}
const explanation = data.choices?.[0]?.message?.content;
if (!explanation || typeof explanation !== "string") {
  console.error("Groq produced no usable explanation.");
  process.exit(1);
}
console.log(`\nAI explanation (${language}; not a safety verdict):`);
console.log(explanation.trim());
