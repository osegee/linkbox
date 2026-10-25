import * as cheerio from "cheerio";

export const scrapeUrlMetadata = async (url: string) => {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; LinkBoxBot/1.0)",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch webpage: ${response.status}`);
  }

  const html = await response.text();

  
  const $ = cheerio.load(html);

  
  const title =
    $('meta[property="og:title"]').attr("content") ||
    $("title").text() ||
    null;

  const description =
    $('meta[property="og:description"]').attr("content") ||
    $('meta[name="description"]').attr("content") ||
    null;

  const imageUrl =
    $('meta[property="og:image"]').attr("content") || null;

  const siteName =
    $('meta[property="og:site_name"]').attr("content") || null;

  return {
    title: title ? title.trim() : null,
    description: description ? description.trim() : null,
    imageUrl,
    siteName: siteName ? siteName.trim() : null,
  };
};