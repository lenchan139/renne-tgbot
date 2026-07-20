"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGoogleSearchUrl = getGoogleSearchUrl;
exports.yandereSearch = yandereSearch;
exports.getYandereSearchUrl = getYandereSearchUrl;
const cheerio = __importStar(require("cheerio"));
/**
 * Google reverse image search URL (opens in browser)
 */
function getGoogleSearchUrl(imageUrl) {
    return `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(imageUrl)}`;
}
/**
 * Yandere reverse image search
 */
async function yandereSearch(imageUrl) {
    try {
        // Yandex-like reverse image search via SauceNAO or direct Yandex
        const searchUrl = `https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(imageUrl)}`;
        const response = await fetch(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
            },
        });
        const html = await response.text();
        const $ = cheerio.load(html);
        const results = [];
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
    }
    catch (err) {
        console.error('Yandere search error:', err);
        return [];
    }
}
/**
 * Direct link to Yandex reverse image search page
 */
function getYandereSearchUrl(imageUrl) {
    return `https://yandex.com/images/search?rpt=imageview&url=${encodeURIComponent(imageUrl)}`;
}
//# sourceMappingURL=search.js.map