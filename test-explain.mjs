import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const script = fileURLToPath(new URL("./explain.mjs", import.meta.url));
const examples = [
  ["secure-verifymydevice.ng", "KNOWN PHISHING"],
  ["verifymydevice.gov.ng", "OFFICIAL HOSTNAME MATCH"],
  ["https://verifymydevice.gov.ng.evil.example", "UNVERIFIED"],
  ["http://verifymydevice.gov.ng", "UNVERIFIED"],
  ["https://verifymydevice.gov.ng:8443", "UNVERIFIED"],
];
let pass = 0;
for (const [url, expected] of examples) {
  const p = spawnSync(process.execPath, [script, url, "--no-ai"], {
    encoding: "utf8", timeout: 5000,
  });
  const ok = p.status === 0 && p.stdout.includes(`Verdict: ${expected}`);
  console.log(`${ok ? "PASS" : "FAIL"} ${url} -> ${expected}`);
  if (!ok) console.log(p.stderr || p.stdout);
  else pass++;
}
console.log(`${pass}/${examples.length} tests passed`);
process.exit(pass === examples.length ? 0 : 1);
