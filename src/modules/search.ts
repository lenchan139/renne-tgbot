import * as cheerio from 'cheerio';

export interface SearchResult {
  url: string;
  title: string;
  thumbnail?: string;
  source: 'google' | 'yandere';
}

/**
 * Google reverse image search URL (opens in browser)
 */
export function getGoogleSearchUrl(imageUrl: string): string {
  return `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageUrl)}`;
}

/**
 * Yandere reverse image search
 */
export async function yandereSearch(imageUrl: string): Promise<SearchResult[]> {
  try {
    // Yandex-like reverse image search via SauceNAO or direct Yandex
    const searchUrl = `https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(imageUrl)}`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      },
    });

    const html = await response.text();
    const $ = cheerio.load(html);
    const results: SearchResult[] = [];

    // Parse Yandex image search results
    $('.serp-item').each((_, el) => {
      const link = $(el).find('a').attr('href');
      const title = $(el).find('.serp-item__title').text().trim();
      const thumb = $(el).find('img').attr('src');
      if (link) {
        results.push({
          url: link,
          title: title || link,
          thumbnail: thumb,
          source: 'yandere',
        });
      }
    });

    return results.slice(0, 5);
  } catch (err) {
    console.error('Yandere search error:', err);
    return [];
  }
}

/**
 * Direct link to Yandex reverse image search page
 */
export function getYandereSearchUrl(imageUrl: string): string {
  return `https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(imageUrl)}`;
}
