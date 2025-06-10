import { z } from "zod";
import { ToolUtils, PerformanceTracker } from "../agents/mcp.js";

/**
 * 🌐 Web Intelligence
 * Smart web scraping with content analysis and AI processing
 */

const WebActionSchema = z.object({
  action: z.enum([
    "fetch",
    "analyze", 
    "extract",
    "monitor",
    "search",
    "scrape_links",
    "get_metadata",
    "check_status",
    "compare_pages"
  ]),
  url: z.string().url(),
  analysis_depth: z.enum(["basic", "comprehensive"]).optional(),
  extract_type: z.enum(["text", "links", "images", "structured", "code", "tables"]).optional(),
  selectors: z.array(z.string()).optional(),
  follow_links: z.boolean().optional(),
  max_depth: z.number().max(3).optional(),
  include_metadata: z.boolean().optional(),
  compare_url: z.string().url().optional(),
  timeout_ms: z.number().max(30000).optional()
});

export class WebIntelligence {
  private ai: any;
  private kv: any;

  constructor(ai: any, kv: any) {
    this.ai = ai;
    this.kv = kv;
  }

  async execute(args: z.infer<typeof WebActionSchema>) {
    const validArgs = ToolUtils.validateArgs(WebActionSchema, args);
    
    return PerformanceTracker.trackExecution(
      () => this.performAction(validArgs),
      `web_${validArgs.action}`
    );
  }

  private async performAction(args: z.infer<typeof WebActionSchema>) {
    const timeout = args.timeout_ms || 10000;

    switch (args.action) {
      case "fetch":
        return this.fetchPage(args.url, timeout);
      
      case "analyze":
        return this.analyzePage(args.url, args.analysis_depth || "basic", timeout);
      
      case "extract":
        return this.extractContent(args.url, args.extract_type || "text", args.selectors, timeout);
      
      case "monitor":
        return this.monitorPage(args.url, timeout);
      
      case "search":
        return this.searchInPage(args.url, timeout);
      
      case "scrape_links":
        return this.scrapeLinks(args.url, args.max_depth || 1, timeout);
      
      case "get_metadata":
        return this.getMetadata(args.url, timeout);
      
      case "check_status":
        return this.checkStatus(args.url, timeout);
      
      case "compare_pages":
        if (!args.compare_url) throw new Error("compare_url is required for compare_pages");
        return this.comparePages(args.url, args.compare_url, timeout);
      
      default:
        throw new Error(`Unknown web action: ${args.action}`);
    }
  }

  private async fetchPage(url: string, timeout: number) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'ZEO-WebIntelligence/2.1.0 (AI Content Analyzer)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate',
          'Connection': 'keep-alive'
        }
      });

      clearTimeout(timeoutId);

      const content = await response.text();
      const contentType = response.headers.get('content-type') || '';

      return {
        action: "fetch",
        url,
        status: response.status,
        status_text: response.statusText,
        content_type: contentType,
        content_length: content.length,
        content: content.substring(0, 10000), // Limit content size
        headers: Object.fromEntries(response.headers.entries()),
        is_html: contentType.includes('text/html'),
        is_json: contentType.includes('application/json'),
        fetch_time: new Date().toISOString()
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      
      throw new Error(`Fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async analyzePage(url: string, depth: string, timeout: number) {
    const fetchResult = await this.fetchPage(url, timeout);
    
    if (!fetchResult.is_html) {
      return {
        action: "analyze",
        url,
        error: "Not an HTML page",
        content_type: fetchResult.content_type
      };
    }

    const analysis = {
      basic: await this.basicAnalysis(fetchResult.content, url),
      comprehensive: depth === "comprehensive" ? await this.comprehensiveAnalysis(fetchResult.content, url) : null
    };

    // AI-powered content analysis
    if (this.ai && depth === "comprehensive") {
      try {
        const aiAnalysis = await this.aiContentAnalysis(fetchResult.content, url);
        analysis.ai_insights = aiAnalysis;
      } catch (error) {
        console.warn('AI analysis failed:', error);
      }
    }

    return {
      action: "analyze",
      url,
      depth,
      status: fetchResult.status,
      analysis,
      analyzed_at: new Date().toISOString()
    };
  }

  private async extractContent(url: string, extractType: string, selectors?: string[], timeout: number = 10000) {
    const fetchResult = await this.fetchPage(url, timeout);

    if (!fetchResult.is_html) {
      throw new Error("Content extraction only works with HTML pages");
    }

    let extracted;
    switch (extractType) {
      case "text":
        extracted = this.extractText(fetchResult.content);
        break;
      case "links":
        extracted = this.extractLinks(fetchResult.content, url);
        break;
      case "images":
        extracted = this.extractImages(fetchResult.content, url);
        break;
      case "structured":
        extracted = this.extractStructuredData(fetchResult.content);
        break;
      case "code":
        extracted = this.extractCode(fetchResult.content);
        break;
      case "tables":
        extracted = this.extractTables(fetchResult.content);
        break;
      default:
        throw new Error(`Unknown extract type: ${extractType}`);
    }

    // Custom selector extraction
    if (selectors && selectors.length > 0) {
      extracted.custom_selectors = this.extractBySelectors(fetchResult.content, selectors);
    }

    return {
      action: "extract",
      url,
      extract_type: extractType,
      extracted,
      selectors_used: selectors,
      extracted_at: new Date().toISOString()
    };
  }

  private async monitorPage(url: string, timeout: number) {
    const cacheKey = `web_monitor:${Buffer.from(url).toString('base64')}`;
    
    // Get previous snapshot
    const previousData = await this.kv.get(cacheKey, 'json');
    
    // Get current snapshot
    const currentResult = await this.fetchPage(url, timeout);
    const currentHash = await this.hashContent(currentResult.content);
    
    const changes = {
      url,
      current_hash: currentHash,
      previous_hash: previousData?.hash,
      has_changed: previousData ? currentHash !== previousData.hash : true,
      checked_at: new Date().toISOString(),
      status_changed: previousData ? currentResult.status !== previousData.status : false
    };

    // Store current snapshot
    await this.kv.put(cacheKey, JSON.stringify({
      hash: currentHash,
      status: currentResult.status,
      content_length: currentResult.content_length,
      last_check: changes.checked_at
    }), { expirationTtl: 86400 * 7 }); // 7 days

    if (changes.has_changed && previousData) {
      // Analyze what changed
      changes.change_analysis = await this.analyzeChanges(
        previousData.content_length,
        currentResult.content_length,
        previousData.status,
        currentResult.status
      );
    }

    return {
      action: "monitor",
      ...changes
    };
  }

  private async searchInPage(url: string, timeout: number) {
    const fetchResult = await this.fetchPage(url, timeout);
    const textContent = this.extractText(fetchResult.content);

    return {
      action: "search",
      url,
      content_analysis: {
        word_count: textContent.content.split(/\s+/).length,
        character_count: textContent.content.length,
        paragraph_count: textContent.content.split(/\n\s*\n/).length,
        heading_count: textContent.headings?.length || 0
      },
      searchable_content: textContent.content.substring(0, 5000), // First 5k chars
      headings: textContent.headings,
      searched_at: new Date().toISOString()
    };
  }

  private async scrapeLinks(url: string, maxDepth: number, timeout: number) {
    const visited = new Set<string>();
    const results = [];

    await this.scrapeLinksRecursive(url, maxDepth, 0, visited, results, timeout);

    return {
      action: "scrape_links",
      start_url: url,
      max_depth: maxDepth,
      total_pages: results.length,
      unique_domains: [...new Set(results.map(r => new URL(r.url).hostname))],
      results: results.slice(0, 50), // Limit results
      scraped_at: new Date().toISOString()
    };
  }

  private async getMetadata(url: string, timeout: number) {
    const fetchResult = await this.fetchPage(url, timeout);

    if (!fetchResult.is_html) {
      return {
        action: "get_metadata",
        url,
        error: "Not an HTML page",
        content_type: fetchResult.content_type
      };
    }

    const metadata = this.extractMetadata(fetchResult.content);

    return {
      action: "get_metadata",
      url,
      metadata,
      extracted_at: new Date().toISOString()
    };
  }

  private async checkStatus(url: string, timeout: number) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const start = Date.now();
      const response = await fetch(url, {
        method: 'HEAD',
        signal: controller.signal,
        headers: {
          'User-Agent': 'ZEO-WebIntelligence/2.1.0 (Status Checker)'
        }
      });

      clearTimeout(timeoutId);
      const duration = Date.now() - start;

      return {
        action: "check_status",
        url,
        status: response.status,
        status_text: response.statusText,
        response_time_ms: duration,
        headers: Object.fromEntries(response.headers.entries()),
        is_accessible: response.ok,
        checked_at: new Date().toISOString()
      };
    } catch (error) {
      clearTimeout(timeoutId);
      
      return {
        action: "check_status",
        url,
        error: error instanceof Error ? error.message : 'Unknown error',
        is_accessible: false,
        checked_at: new Date().toISOString()
      };
    }
  }

  private async comparePages(url1: string, url2: string, timeout: number) {
    const [page1, page2] = await Promise.all([
      this.fetchPage(url1, timeout),
      this.fetchPage(url2, timeout)
    ]);

    const [content1, content2] = await Promise.all([
      this.extractText(page1.content),
      this.extractText(page2.content)
    ]);

    const comparison = {
      urls: { primary: url1, comparison: url2 },
      status_comparison: {
        primary_status: page1.status,
        comparison_status: page2.status,
        both_accessible: page1.status === 200 && page2.status === 200
      },
      content_comparison: {
        length_diff: content1.content.length - content2.content.length,
        length_ratio: content1.content.length / Math.max(1, content2.content.length),
        word_count_diff: content1.content.split(/\s+/).length - content2.content.split(/\s+/).length
      },
      similarity: await this.calculateSimilarity(content1.content, content2.content),
      compared_at: new Date().toISOString()
    };

    return {
      action: "compare_pages",
      comparison
    };
  }

  // Helper Methods
  private basicAnalysis(content: string, url: string) {
    const textContent = this.extractText(content);
    const links = this.extractLinks(content, url);
    const images = this.extractImages(content, url);

    return {
      page_size: content.length,
      text_content_length: textContent.content.length,
      word_count: textContent.content.split(/\s+/).length,
      paragraph_count: textContent.content.split(/\n\s*\n/).length,
      heading_count: textContent.headings?.length || 0,
      link_count: links.length,
      image_count: images.length,
      has_forms: content.includes('<form'),
      has_scripts: content.includes('<script'),
      has_styles: content.includes('<style') || content.includes('stylesheet')
    };
  }

  private async comprehensiveAnalysis(content: string, url: string) {
    const basic = this.basicAnalysis(content, url);
    const metadata = this.extractMetadata(content);
    const structured = this.extractStructuredData(content);

    return {
      ...basic,
      metadata,
      structured_data: structured,
      seo_analysis: this.analyzeSEO(content, metadata),
      performance_hints: this.analyzePerformance(content),
      accessibility_check: this.checkAccessibility(content)
    };
  }

  private async aiContentAnalysis(content: string, url: string) {
    try {
      const textContent = this.extractText(content);
      const prompt = `Analyze this web page content and provide insights:
URL: ${url}
Content: ${textContent.content.substring(0, 2000)}

Provide analysis on:
1. Content quality and readability
2. Main topics and themes
3. Target audience
4. Content structure
5. Key takeaways`;

      // This would use the AI model to analyze content
      // Implementation depends on the specific AI service
      return {
        content_quality: "analysis_placeholder",
        main_topics: ["topic1", "topic2"],
        target_audience: "general",
        structure_score: 85,
        key_takeaways: ["takeaway1", "takeaway2"]
      };
    } catch (error) {
      throw new Error(`AI analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private extractText(html: string) {
    // Simple HTML text extraction (in production, would use proper HTML parser)
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const headings = html.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi)?.map(h => 
      h.replace(/<[^>]+>/g, '').trim()
    ) || [];

    return {
      content: text,
      headings,
      preview: text.substring(0, 300) + (text.length > 300 ? "..." : "")
    };
  }

  private extractLinks(html: string, baseUrl: string) {
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi;
    const links = [];
    let match;

    while ((match = linkRegex.exec(html)) !== null) {
      let url = match[1];
      const text = match[2].replace(/<[^>]+>/g, '').trim();

      // Convert relative URLs to absolute
      if (url.startsWith('/')) {
        const base = new URL(baseUrl);
        url = `${base.protocol}//${base.host}${url}`;
      } else if (!url.startsWith('http')) {
        const base = new URL(baseUrl);
        url = `${base.protocol}//${base.host}/${url}`;
      }

      links.push({ url, text, type: this.classifyLink(url) });
    }

    return links;
  }

  private extractImages(html: string, baseUrl: string) {
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    const images = [];
    let match;

    while ((match = imgRegex.exec(html)) !== null) {
      let src = match[1];
      const altMatch = match[0].match(/alt=["']([^"']*)["']/i);
      const alt = altMatch ? altMatch[1] : '';

      // Convert relative URLs to absolute
      if (src.startsWith('/')) {
        const base = new URL(baseUrl);
        src = `${base.protocol}//${base.host}${src}`;
      }

      images.push({ src, alt });
    }

    return images;
  }

  private extractStructuredData(html: string) {
    const jsonLdRegex = /<script[^>]+type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gi;
    const structured = [];
    let match;

    while ((match = jsonLdRegex.exec(html)) !== null) {
      try {
        const data = JSON.parse(match[1]);
        structured.push(data);
      } catch (error) {
        // Invalid JSON-LD, skip
      }
    }

    return structured;
  }

  private extractCode(html: string) {
    const codeBlocks = html.match(/<code[^>]*>(.*?)<\/code>/gi)?.map(block => 
      block.replace(/<[^>]+>/g, '').trim()
    ) || [];

    const preBlocks = html.match(/<pre[^>]*>(.*?)<\/pre>/gi)?.map(block => 
      block.replace(/<[^>]+>/g, '').trim()
    ) || [];

    return {
      inline_code: codeBlocks,
      code_blocks: preBlocks,
      total_code_snippets: codeBlocks.length + preBlocks.length
    };
  }

  private extractTables(html: string) {
    const tableRegex = /<table[^>]*>(.*?)<\/table>/gi;
    const tables = [];
    let match;

    while ((match = tableRegex.exec(html)) !== null) {
      const rows = match[1].match(/<tr[^>]*>(.*?)<\/tr>/gi) || [];
      tables.push({
        row_count: rows.length,
        estimated_columns: rows[0] ? (rows[0].match(/<t[hd][^>]*>/gi) || []).length : 0,
        has_headers: match[1].includes('<th')
      });
    }

    return tables;
  }

  private extractBySelectors(html: string, selectors: string[]) {
    // Simplified selector extraction (in production, would use proper CSS selector engine)
    const results: Record<string, string[]> = {};

    selectors.forEach(selector => {
      if (selector.startsWith('#')) {
        // ID selector
        const id = selector.substring(1);
        const regex = new RegExp(`<[^>]+id=["']${id}["'][^>]*>(.*?)<\/[^>]+>`, 'gi');
        const matches = html.match(regex)?.map(m => m.replace(/<[^>]+>/g, '').trim()) || [];
        results[selector] = matches;
      } else if (selector.startsWith('.')) {
        // Class selector
        const className = selector.substring(1);
        const regex = new RegExp(`<[^>]+class=["'][^"']*${className}[^"']*["'][^>]*>(.*?)<\/[^>]+>`, 'gi');
        const matches = html.match(regex)?.map(m => m.replace(/<[^>]+>/g, '').trim()) || [];
        results[selector] = matches;
      } else {
        // Tag selector
        const regex = new RegExp(`<${selector}[^>]*>(.*?)<\/${selector}>`, 'gi');
        const matches = html.match(regex)?.map(m => m.replace(/<[^>]+>/g, '').trim()) || [];
        results[selector] = matches;
      }
    });

    return results;
  }

  private extractMetadata(html: string) {
    const metadata: Record<string, string> = {};

    // Title
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    if (titleMatch) metadata.title = titleMatch[1].trim();

    // Meta tags
    const metaRegex = /<meta[^>]+(?:name|property)=["']([^"']+)["'][^>]+content=["']([^"']+)["'][^>]*>/gi;
    let match;

    while ((match = metaRegex.exec(html)) !== null) {
      metadata[match[1]] = match[2];
    }

    return metadata;
  }

  private async scrapeLinksRecursive(
    url: string, 
    maxDepth: number, 
    currentDepth: number, 
    visited: Set<string>, 
    results: any[], 
    timeout: number
  ) {
    if (currentDepth >= maxDepth || visited.has(url)) {
      return;
    }

    visited.add(url);

    try {
      const fetchResult = await this.fetchPage(url, timeout);
      
      results.push({
        url,
        depth: currentDepth,
        status: fetchResult.status,
        title: this.extractMetadata(fetchResult.content).title || '',
        content_length: fetchResult.content_length
      });

      if (currentDepth < maxDepth - 1 && fetchResult.is_html) {
        const links = this.extractLinks(fetchResult.content, url);
        const internalLinks = links.filter(link => 
          new URL(link.url).hostname === new URL(url).hostname
        ).slice(0, 5); // Limit to 5 links per page

        for (const link of internalLinks) {
          await this.scrapeLinksRecursive(
            link.url, 
            maxDepth, 
            currentDepth + 1, 
            visited, 
            results, 
            timeout
          );
        }
      }
    } catch (error) {
      results.push({
        url,
        depth: currentDepth,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private analyzeSEO(content: string, metadata: Record<string, string>) {
    return {
      has_title: !!metadata.title,
      title_length: metadata.title?.length || 0,
      has_description: !!metadata.description,
      description_length: metadata.description?.length || 0,
      has_keywords: !!metadata.keywords,
      has_og_tags: Object.keys(metadata).some(key => key.startsWith('og:')),
      has_twitter_tags: Object.keys(metadata).some(key => key.startsWith('twitter:')),
      h1_count: (content.match(/<h1[^>]*>/gi) || []).length,
      alt_text_coverage: this.calculateAltTextCoverage(content)
    };
  }

  private analyzePerformance(content: string) {
    return {
      html_size: content.length,
      script_count: (content.match(/<script[^>]*>/gi) || []).length,
      style_count: (content.match(/<style[^>]*>/gi) || []).length,
      image_count: (content.match(/<img[^>]*>/gi) || []).length,
      has_inline_styles: content.includes('style='),
      has_external_scripts: content.includes('src='),
      potential_issues: this.identifyPerformanceIssues(content)
    };
  }

  private checkAccessibility(content: string) {
    return {
      images_with_alt: (content.match(/<img[^>]+alt=/gi) || []).length,
      images_without_alt: (content.match(/<img(?![^>]+alt=)[^>]*>/gi) || []).length,
      has_skip_links: content.includes('skip'),
      heading_structure: this.analyzeHeadingStructure(content),
      form_labels: (content.match(/<label[^>]*>/gi) || []).length,
      aria_attributes: (content.match(/aria-\w+=/gi) || []).length
    };
  }

  private classifyLink(url: string): string {
    if (url.includes('mailto:')) return 'email';
    if (url.includes('tel:')) return 'phone';
    if (url.includes('#')) return 'anchor';
    if (url.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/i)) return 'document';
    if (url.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) return 'image';
    return 'page';
  }

  private async hashContent(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  private async analyzeChanges(prevLength: number, currLength: number, prevStatus: number, currStatus: number) {
    return {
      content_change: {
        size_diff: currLength - prevLength,
        size_change_percent: ((currLength - prevLength) / prevLength) * 100
      },
      status_change: {
        previous: prevStatus,
        current: currStatus,
        changed: prevStatus !== currStatus
      }
    };
  }

  private async calculateSimilarity(text1: string, text2: string): Promise<number> {
    // Simple similarity calculation (in production, would use more sophisticated algorithms)
    const words1 = new Set(text1.toLowerCase().split(/\s+/));
    const words2 = new Set(text2.toLowerCase().split(/\s+/));
    
    const intersection = new Set([...words1].filter(x => words2.has(x)));
    const union = new Set([...words1, ...words2]);
    
    return intersection.size / union.size;
  }

  private calculateAltTextCoverage(content: string): number {
    const totalImages = (content.match(/<img[^>]*>/gi) || []).length;
    const imagesWithAlt = (content.match(/<img[^>]+alt=/gi) || []).length;
    
    return totalImages > 0 ? imagesWithAlt / totalImages : 1;
  }

  private identifyPerformanceIssues(content: string): string[] {
    const issues = [];
    
    if (content.length > 1000000) issues.push('Large HTML size');
    if ((content.match(/<script[^>]*>/gi) || []).length > 10) issues.push('Too many scripts');
    if (content.includes('style=')) issues.push('Inline styles detected');
    if ((content.match(/<img[^>]*>/gi) || []).length > 50) issues.push('Many images without lazy loading');
    
    return issues;
  }

  private analyzeHeadingStructure(content: string): any {
    const headings = content.match(/<h[1-6][^>]*>/gi) || [];
    const structure = headings.map(h => {
      const level = parseInt(h.match(/h([1-6])/)?.[1] || '1');
      return { level, tag: h };
    });

    return {
      total: headings.length,
      by_level: structure.reduce((acc, h) => {
        acc[`h${h.level}`] = (acc[`h${h.level}`] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      has_h1: structure.some(h => h.level === 1),
      proper_nesting: this.checkHeadingNesting(structure)
    };
  }

  private checkHeadingNesting(headings: Array<{level: number}>): boolean {
    for (let i = 1; i < headings.length; i++) {
      const prevLevel = headings[i - 1].level;
      const currLevel = headings[i].level;
      
      if (currLevel > prevLevel + 1) {
        return false; // Skipped heading level
      }
    }
    return true;
  }
}