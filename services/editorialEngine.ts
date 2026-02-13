import { NewsItem } from '../types';

/**
 * ═══════════════════════════════════════════════════════════════
 * EDITORIAL ENGINE
 * Smart duplicate detection, priority ranking, and buffer management
 * ═══════════════════════════════════════════════════════════════
 */

/**
 * Calculate similarity between two strings using Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    const len1 = s1.length;
    const len2 = s2.length;
    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }

    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

/**
 * Remove duplicate news items based on title similarity
 * Threshold: 80% similarity = duplicate
 */
export function deduplicateNews(items: NewsItem[]): NewsItem[] {
    const unique: NewsItem[] = [];
    const SIMILARITY_THRESHOLD = 0.8;

    for (const item of items) {
        const isDuplicate = unique.some(existing =>
            calculateSimilarity(item.title, existing.title) >= SIMILARITY_THRESHOLD
        );

        if (!isDuplicate) {
            unique.push(item);
        }
    }

    console.log(`📊 [Editorial] Deduplication: ${items.length} → ${unique.length} unique items`);
    return unique;
}

/**
 * Calculate priority score for a news item
 * Score = (recency * 0.3) + (credibility * 0.3) + (breaking * 0.4)
 */
function calculatePriority(item: NewsItem): number {
    const now = Date.now();
    const ageHours = (now - item.timestamp) / (1000 * 60 * 60);

    // Recency score (0-100): newer = higher
    const recencyScore = Math.max(0, 100 - (ageHours * 5));

    // Credibility score (0-100): based on source
    const credibilityScore = 70; // Default, can be enhanced with source reputation DB

    // Breaking keywords score (0-100)
    const breakingKeywords = ['breaking', 'urgent', 'alert', 'just in', 'developing'];
    const hasBreaking = breakingKeywords.some(kw =>
        item.title.toLowerCase().includes(kw) ||
        item.content?.toLowerCase().includes(kw)
    );
    const breakingScore = hasBreaking ? 100 : 50;

    // Weighted average
    const priority = (recencyScore * 0.3) + (credibilityScore * 0.3) + (breakingScore * 0.4);

    return Math.round(priority);
}

/**
 * Rank news items by priority (highest first)
 */
export function rankByPriority(items: NewsItem[]): NewsItem[] {
    const ranked = items.map(item => ({
        ...item,
        priority: calculatePriority(item)
    }));

    ranked.sort((a, b) => b.priority - a.priority);

    console.log(`📊 [Editorial] Ranked ${ranked.length} items by priority`);
    console.log(`📊 [Editorial] Top priority: ${ranked[0]?.priority || 0}, Lowest: ${ranked[ranked.length - 1]?.priority || 0}`);

    return ranked;
}

/**
 * Maintain rolling buffer with max size
 * Preserves breaking news, trims oldest non-breaking items
 */
export function maintainBuffer(items: NewsItem[], maxSize: number = 100): NewsItem[] {
    if (items.length <= maxSize) {
        return items;
    }

    // Separate breaking and non-breaking
    const breaking = items.filter(item =>
        item.priority && item.priority >= 90
    );
    const nonBreaking = items.filter(item =>
        !item.priority || item.priority < 90
    );

    // Keep all breaking news + fill remaining slots with non-breaking
    const remainingSlots = maxSize - breaking.length;
    const trimmedNonBreaking = nonBreaking.slice(0, Math.max(0, remainingSlots));

    const final = [...breaking, ...trimmedNonBreaking];

    console.log(`📊 [Editorial] Buffer maintained: ${items.length} → ${final.length} (${breaking.length} breaking preserved)`);

    return final;
}

/**
 * Full editorial pipeline: deduplicate → rank → maintain buffer
 */
export function processEditorial(items: NewsItem[], maxSize: number = 100): NewsItem[] {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📰 [Editorial Engine] Processing news items...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const deduplicated = deduplicateNews(items);
    const ranked = rankByPriority(deduplicated);
    const buffered = maintainBuffer(ranked, maxSize);

    console.log('✅ [Editorial Engine] Processing complete');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return buffered;
}
