/**
 * Decode HTML entities commonly found in scraped LCS data.
 * Also strips the " – Local Content Register" suffix from titles.
 */
export function decodeHtml(s: string): string {
  return s
    .replace(/&#038;/g, "&")
    .replace(/&#8211;/g, "\u2013")
    .replace(/&#8217;/g, "\u2019")
    .replace(/&#8220;/g, "\u201C")
    .replace(/&#8221;/g, "\u201D")
    .replace(/&#8216;/g, "\u2018")
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s*[\u2013\-]\s*Local Content Register$/i, "");
}
