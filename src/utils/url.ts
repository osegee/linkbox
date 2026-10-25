const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "si",
  "ref",
];

export const parseAndCleanUrl = (rawUrl: string) => {
  const parsed = new URL(rawUrl);

  const domain = parsed.hostname.toLowerCase().replace(/^www\./, "");

  TRACKING_PARAMS.forEach((param) => parsed.searchParams.delete(param));

  parsed.hash = "";
  parsed.hostname = domain;

  const canonicalUrl = parsed.toString().replace(/\/$/, "");

  return {
    originalUrl: rawUrl,
    canonicalUrl,
    domain,
  };
};
