export interface SearchResult {
    url: string;
    title: string;
    thumbnail?: string;
    source: 'google' | 'yandere';
}
/**
 * Google reverse image search URL (opens in browser)
 */
export declare function getGoogleSearchUrl(imageUrl: string): string;
/**
 * Yandere reverse image search
 */
export declare function yandereSearch(imageUrl: string): Promise<SearchResult[]>;
/**
 * Direct link to Yandex reverse image search page
 */
export declare function getYandereSearchUrl(imageUrl: string): string;
//# sourceMappingURL=search.d.ts.map