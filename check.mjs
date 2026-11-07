const ADVISORY =
  "https://csirt.ncc.gov.ng/index.php/resources/security-advisories/452-phishing-campaign-impersonating-official-verifymydevice-gov-ng-device-verification-portal";

const official = new Set([
  "verifymydevice.gov.ng",
  "www.verifymydevice.gov.ng",
  "ncc.gov.ng",
  "www.ncc.gov.ng",
  "csirt.ncc.gov.ng",
]);

const knownPhishing = new Set([
  "secure-verifymydevice.ng",
  "verifymydevice.com.ng",
  "embed-ncc.registrmydevice.ng",
  "verifymydevice.ng",
]);

function check(input) {
  try {
    const url = new URL(
      input.includes("://") ? input : `https://${input}`
    );

    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    ) {
      return { status: "invalid", reason: "Unsupported URL" };
    }

    const host = url.hostname.toLowerCase().replace(/\.$/, "");

    if (knownPhishing.has(host)) {
      return {
        status: "known-phishing",
        domain: host,
        reason: "Identified in the NCC-CSIRT advisory",
        source: ADVISORY,
        officialAlternative: "https://www.ncc.gov.ng/devicechecker"
      };
    }

    if (official.has(host)) {
      return {
        status: "official-domain-match",
        domain: host,
        reason: "Matches a documented official NCC domain",
        source: ADVISORY,
        note: "A domain match alone cannot guarantee page safety."
      };
    }

    return {
      status: "unverified",
      domain: host,
      reason: "Not present in this limited verified dataset",
      note: "Unknown does not mean safe. Further investigation needed."
    };
  } catch {
    return { status: "invalid", reason: "Could not parse URL" };
  }
}

console.log(JSON.stringify(
  check(process.argv[2] || ""),
  null,
  2
));
