import { NewsItem } from '../types';
import { OPENING_SCRIPT, CLOSING_SCRIPT, LEAD_ANCHOR_NAME, STATION_NAME } from '../constants';

/**
 * ═══════════════════════════════════════════════════════════════
 * BULLETIN COMPOSER
 * Sara Obosa newsroom script generation with structured formatting
 * ═══════════════════════════════════════════════════════════════
 */

export interface BulletinScript {
    opening: string;
    headlines: string[];
    mainStories: string[];
    diasporaSegment: string;
    closing: string;
    fullScript: string;
}

/**
 * Generate professional newsroom bulletin script for Sara Obosa
 */
export function generateBulletinScript(news: NewsItem[]): BulletinScript {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 [Bulletin Composer] Generating Sara Obosa script...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Handle empty news case
    if (news.length === 0) {
        const fallbackScript = `${OPENING_SCRIPT} There are no major breaking developments at this hour. We will continue to monitor the situation and bring you updates as they become available. ${CLOSING_SCRIPT}`;

        console.log('⚠️ [Bulletin Composer] No news available, using fallback script');

        return {
            opening: OPENING_SCRIPT,
            headlines: [],
            mainStories: ["There are no major breaking developments at this hour."],
            diasporaSegment: "",
            closing: CLOSING_SCRIPT,
            fullScript: fallbackScript
        };
    }

    // Extract top stories
    const top5 = news.slice(0, 5);
    const diasporaNews = news.filter(n =>
        n.category === 'Diaspora' ||
        n.title.toLowerCase().includes('diaspora') ||
        n.content?.toLowerCase().includes('diaspora')
    ).slice(0, 2);

    console.log(`📋 [Bulletin Composer] Top 5 stories selected`);
    console.log(`📋 [Bulletin Composer] ${diasporaNews.length} diaspora stories found`);

    // Generate headlines (short, punchy)
    const headlines = top5.map(item => {
        const cleanTitle = item.title.replace(/[.!?]+$/, ''); // Remove trailing punctuation
        return `${cleanTitle}.`;
    });

    // Generate main stories with clear verbal transitions
    const mainStories = top5.map((item, index) => {
        const cleanTitle = item.title.replace(/[.!?]+$/, '');
        const summary = item.content || item.summary || '';
        const cleanSummary = summary.slice(0, 300); // Slightly more depth

        // Varied transition phrases to avoid "mashing"
        let transition = "";
        if (index === 0) transition = "Starting with our lead story.";
        else if (index === 1) transition = "In other major developments.";
        else if (index === 2) transition = "Turning our attention to the economy.";
        else if (index === 3) transition = "Moving forward.";
        else if (index === 4) transition = "Across the border.";

        return `${transition} ${cleanTitle}. ${cleanSummary}. [PAUSE] `;
    });

    // Generate diaspora segment with specific India focus if present
    let diasporaSegment = "";
    if (diasporaNews.length > 0) {
        const hasIndia = diasporaNews.some(n => n.category?.toLowerCase() === 'india' || n.content?.toLowerCase().includes('india'));
        const diasporaIntro = hasIndia ? "Now to the diaspora, with a special focus on the Nigerian community in India." : "Now, turning to news from the Nigerian diaspora.";

        const diasporaStories = diasporaNews.map(item => {
            const summary = item.content || item.summary || item.title;
            return `${summary.slice(0, 200)}. [PAUSE] `;
        }).join(' ');

        diasporaSegment = `${diasporaIntro} ${diasporaStories}`;
    }

    // Assemble full script with natural flow
    const fullScript = [
        OPENING_SCRIPT,
        "First, the headlines.",
        headlines.join(' ... '),
        "Now for the detailed reports.",
        mainStories.join(' '),
        diasporaSegment,
        CLOSING_SCRIPT
    ].filter(Boolean).join(' ').replace(/\[PAUSE\]/g, ' ... ');

    console.log(`✅ [Bulletin Composer] Script generated (${fullScript.length} characters)`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    return {
        opening: OPENING_SCRIPT,
        headlines,
        mainStories,
        diasporaSegment,
        closing: CLOSING_SCRIPT,
        fullScript
    };
}

/**
 * Generate bulletin script using AI for natural language processing
 * (Optional enhancement - uses Gemini to polish the script)
 */
export async function generateAIBulletinScript(news: NewsItem[]): Promise<string> {
    const basicScript = generateBulletinScript(news);

    // TODO: Optionally enhance with Gemini API for grammar correction and natural flow
    // For now, return the structured script

    return basicScript.fullScript;
}
