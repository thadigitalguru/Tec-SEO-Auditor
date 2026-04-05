import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

export interface AuditOptions {
  maxPages?: number
  crawlTimeoutMs?: number
  lighthouseTimeoutMs?: number
  aiModel?: string
  openAiApiKey?: string
}

export interface CrawledPage {
  url: string
  title: string
  status: number
  links: string[]
}

export interface CrawlResult {
  startUrl: string
  sitemapUrls: string[]
  discoveredUrls: string[]
  pages: CrawledPage[]
}

export interface LighthouseScores {
  performance: number
  accessibility: number
  bestPractices: number
  seo: number
}

export interface LighthouseMetrics {
  lcp: number | null
  cls: number | null
  inp: number | null
  tbt: number | null
}

export interface LighthouseAudit {
  url: string
  scores: LighthouseScores
  metrics: LighthouseMetrics
  opportunities: string[]
}

export interface AuditPriority {
  title: string
  impact: string
  reason: string
}

export interface AuditSummary {
  source: 'heuristic' | 'openai'
  headline: string
  summary: string
  priorities: AuditPriority[]
}

export interface AuditReport {
  targetUrl: string
  crawl: CrawlResult
  lighthouse: LighthouseAudit
  summary: AuditSummary
  generatedAt: string
}

export interface AuditDependencies {
  crawlSite: typeof crawlSite
  runLighthouseAudit: typeof runLighthouseAudit
  summarizeAudit: typeof summarizeAudit
}

let lighthouseLoader: Promise<typeof import('lighthouse')> | null = null
let playwrightLoader: Promise<typeof import('@playwright/test')> | null = null

export function createAuditSite(dependencies: Partial<AuditDependencies> = {}) {
  const resolved: AuditDependencies = {
    crawlSite,
    runLighthouseAudit,
    summarizeAudit,
    ...dependencies,
  }

  return async function auditSite(url: string, options: AuditOptions = {}): Promise<AuditReport> {
    const targetUrl = normalizeTargetUrl(url)
    const crawl = await resolved.crawlSite(targetUrl.href, options)
    const lighthouseResult = await resolved.runLighthouseAudit(targetUrl.href, options)
    const summary = await resolved.summarizeAudit(
      {
        targetUrl: targetUrl.href,
        crawl,
        lighthouse: lighthouseResult,
      },
      options,
    )

    return {
      targetUrl: targetUrl.href,
      crawl,
      lighthouse: lighthouseResult,
      summary,
      generatedAt: new Date().toISOString(),
    }
  }
}

export const auditSite = createAuditSite()

export async function crawlSite(url: string, options: AuditOptions = {}): Promise<CrawlResult> {
  const targetUrl = normalizeTargetUrl(url)
  const maxPages = clampInt(options.maxPages, 1, 25, 10)
  const timeoutMs = clampInt(options.crawlTimeoutMs, 1000, 60_000, 10_000)
  const queue: string[] = [targetUrl.href]
  const seen = new Set<string>()
  const discovered = new Set<string>()
  const pages: CrawledPage[] = []
  const { sitemapUrls, pageUrls } = await collectSitemapUrls(targetUrl, timeoutMs)

  for (const pageUrl of pageUrls) {
    queue.push(pageUrl)
  }

  while (queue.length > 0 && pages.length < maxPages) {
    const currentUrl = queue.shift()

    if (!currentUrl || seen.has(currentUrl)) {
      continue
    }

    seen.add(currentUrl)

    const response = await fetchText(currentUrl, timeoutMs)
    if (!response.ok || !response.body) {
      continue
    }

    const page = parseHtmlPage(currentUrl, response.body, response.status)
    pages.push(page)

    for (const link of page.links) {
      if (!discovered.has(link)) {
        discovered.add(link)
      }

      if (!seen.has(link) && pages.length + queue.length < maxPages) {
        queue.push(link)
      }
    }
  }

  return {
    startUrl: targetUrl.href,
    sitemapUrls,
    discoveredUrls: Array.from(discovered),
    pages,
  }
}

export async function runLighthouseAudit(url: string, options: AuditOptions = {}): Promise<LighthouseAudit> {
  const targetUrl = normalizeTargetUrl(url)
  const timeoutMs = clampInt(options.lighthouseTimeoutMs, 10_000, 180_000, 60_000)
  const browser = await launchChromeForLighthouse()
  const lighthouse = await loadLighthouse()

  try {
    const result = await Promise.race([
      lighthouse(targetUrl.href, {
        port: browser.port,
        logLevel: 'error',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      }),
      timeoutPromise(timeoutMs, 'Lighthouse run timed out'),
    ])

    if (!result) {
      throw new Error('Lighthouse did not return a result')
    }

    const lhr = result.lhr
    const categories = lhr.categories
    const audits = lhr.audits

    return {
      url: targetUrl.href,
      scores: {
        performance: scoreToPercent(categories.performance?.score),
        accessibility: scoreToPercent(categories.accessibility?.score),
        bestPractices: scoreToPercent(categories['best-practices']?.score),
        seo: scoreToPercent(categories.seo?.score),
      },
      metrics: {
        lcp: metricValue(audits['largest-contentful-paint']),
        cls: metricValue(audits['cumulative-layout-shift']),
        inp: metricValue(audits['interaction-to-next-paint']),
        tbt: metricValue(audits['total-blocking-time']),
      },
      opportunities: buildOpportunityList(lhr),
    }
  } finally {
    await browser.close()
  }
}

export async function summarizeAudit(
  input: {
    targetUrl: string
    crawl: CrawlResult
    lighthouse: LighthouseAudit
  },
  options: AuditOptions = {},
): Promise<AuditSummary> {
  const apiKey = options.openAiApiKey ?? process.env.OPENAI_API_KEY
  if (apiKey) {
    const model = options.aiModel ?? process.env.OPENAI_MODEL ?? 'gpt-4.1-mini'
    const summary = await summarizeWithOpenAI(input, apiKey, model).catch(() => null)
    if (summary) {
      return summary
    }
  }

  return summarizeHeuristically(input)
}

function normalizeTargetUrl(url: string): URL {
  let targetUrl: URL

  try {
    targetUrl = new URL(url)
  } catch {
    throw new Error(`Invalid URL: ${url}`)
  }

  if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
    throw new Error(`Unsupported URL protocol: ${targetUrl.protocol}`)
  }

  return targetUrl
}

async function loadLighthouse() {
  lighthouseLoader ??= import(/* webpackIgnore: true */ 'lighthouse')
  const lighthouseModule = await lighthouseLoader
  return lighthouseModule.default
}

async function loadPlaywright() {
  playwrightLoader ??= import(/* webpackIgnore: true */ '@playwright/test')
  return await playwrightLoader
}

async function collectSitemapUrls(targetUrl: URL, timeoutMs: number): Promise<{ sitemapUrls: string[]; pageUrls: string[] }> {
  const sitemapCandidates = [
    new URL('/sitemap.xml', targetUrl).href,
    new URL('/sitemap_index.xml', targetUrl).href,
  ]

  const robotsUrl = new URL('/robots.txt', targetUrl).href
  const robotsResponse = await fetchText(robotsUrl, timeoutMs)
  if (robotsResponse.ok && robotsResponse.body) {
    for (const line of robotsResponse.body.split(/\r?\n/)) {
      const match = /^sitemap:\s*(.+)$/i.exec(line.trim())
      if (match) {
        sitemapCandidates.push(match[1].trim())
      }
    }
  }

  const sitemapUrls = new Set<string>()
  const pageUrls = new Set<string>()
  const sitemapQueue = [...sitemapCandidates]

  while (sitemapQueue.length > 0) {
    const candidate = sitemapQueue.shift()
    if (!candidate || sitemapUrls.has(candidate)) {
      continue
    }

    const sitemapResponse = await fetchText(candidate, timeoutMs)
    if (!sitemapResponse.ok || !sitemapResponse.body) {
      continue
    }

    sitemapUrls.add(candidate)

    for (const loc of sitemapResponse.body.match(/<loc>(.*?)<\/loc>/gi) ?? []) {
      const value = loc.replace(/<\/?loc>/gi, '').trim()
      const resolved = toSameOriginUrl(value, targetUrl)
      if (!resolved) {
        continue
      }

      if (resolved.pathname.endsWith('.xml')) {
        sitemapQueue.push(resolved.href)
      } else {
        pageUrls.add(resolved.href)
      }
    }
  }

  return {
    sitemapUrls: Array.from(sitemapUrls),
    pageUrls: Array.from(pageUrls),
  }
}

async function fetchText(url: string, timeoutMs: number): Promise<{ ok: boolean; status: number; body: string | null }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'user-agent': 'Tec SEO Auditor',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })

    return {
      ok: response.ok,
      status: response.status,
      body: await response.text(),
    }
  } catch {
    return {
      ok: false,
      status: 0,
      body: null,
    }
  } finally {
    clearTimeout(timeout)
  }
}

function parseHtmlPage(url: string, html: string, status: number): CrawledPage {
  const links = extractLinks(html, url)
  return {
    url,
    title: extractTitle(html),
    status,
    links,
  }
}

function extractTitle(html: string): string {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  return match ? stripTags(match[1]).trim() : ''
}

function extractLinks(html: string, baseUrl: string): string[] {
  const links = new Set<string>()
  const regex = /<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>/gi

  for (const match of html.matchAll(regex)) {
    const href = match[1]?.trim()
    if (!href) {
      continue
    }

    const resolved = toSameOriginUrl(href, new URL(baseUrl))
    if (resolved) {
      links.add(resolved.href)
    }
  }

  return Array.from(links)
}

function toSameOriginUrl(value: string, baseUrl: URL): URL | null {
  if (!value || value.startsWith('mailto:') || value.startsWith('tel:') || value.startsWith('javascript:')) {
    return null
  }

  try {
    const resolved = new URL(value, baseUrl)
    if (resolved.origin !== baseUrl.origin) {
      return null
    }

    resolved.hash = ''
    return resolved
  } catch {
    return null
  }
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ')
}

function scoreToPercent(score: number | null | undefined): number {
  if (typeof score !== 'number') {
    return 0
  }

  return Math.round(score * 100)
}

function metricValue(audit: { numericValue?: number | null } | undefined): number | null {
  if (!audit || typeof audit.numericValue !== 'number' || Number.isNaN(audit.numericValue)) {
    return null
  }

  return Math.round(audit.numericValue)
}

function buildOpportunityList(result: { audits: Record<string, { title?: string; scoreDisplayMode?: string; score?: number | null }> }): string[] {
  return Object.values(result.audits)
    .filter((audit) => audit.scoreDisplayMode === 'numeric' || audit.scoreDisplayMode === 'binary')
    .filter((audit) => typeof audit.score === 'number' && audit.score < 1)
    .map((audit) => audit.title?.trim())
    .filter((title): title is string => Boolean(title))
    .slice(0, 5)
}

async function summarizeWithOpenAI(
  input: {
    targetUrl: string
    crawl: CrawlResult
    lighthouse: LighthouseAudit
  },
  apiKey: string,
  model: string,
): Promise<AuditSummary | null> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You are a technical SEO auditor. Return only valid JSON with keys headline, summary, and priorities. priorities must be an array of objects with title, impact, and reason.',
        },
        {
          role: 'user',
          content: JSON.stringify(
            {
              targetUrl: input.targetUrl,
              pagesCrawled: input.crawl.pages.length,
              sitemapUrls: input.crawl.sitemapUrls.length,
              lighthouseScores: input.lighthouse.scores,
              lighthouseMetrics: input.lighthouse.metrics,
              opportunities: input.lighthouse.opportunities,
              pageTitles: input.crawl.pages.slice(0, 5).map((page) => page.title),
            },
            null,
            2,
          ),
        },
      ],
    }),
  })

  if (!response.ok) {
    return null
  }

  const payload = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null
      }
    }>
  }

  const raw = payload.choices?.[0]?.message?.content?.trim()
  if (!raw) {
    return null
  }

  const parsed = safeJsonParse<Partial<AuditSummary>>(raw)
  if (!parsed || typeof parsed.headline !== 'string' || typeof parsed.summary !== 'string' || !Array.isArray(parsed.priorities)) {
    return null
  }

  return {
    source: 'openai',
    headline: parsed.headline,
    summary: parsed.summary,
    priorities: parsed.priorities
      .map((priority) => ({
        title: typeof priority?.title === 'string' ? priority.title : '',
        impact: typeof priority?.impact === 'string' ? priority.impact : '',
        reason: typeof priority?.reason === 'string' ? priority.reason : '',
      }))
      .filter((priority) => priority.title && priority.impact && priority.reason),
  }
}

function summarizeHeuristically(input: {
  targetUrl: string
  crawl: CrawlResult
  lighthouse: LighthouseAudit
}): AuditSummary {
  const pages = input.crawl.pages.length
  const discovered = input.crawl.discoveredUrls.length
  const scores = input.lighthouse.scores
  const orderedScores = Object.entries(scores).sort((left, right) => left[1] - right[1])
  const weakestScore = orderedScores[0]
  const headline = weakestScore
    ? `${weakestScore[0]} is the weakest area`
    : 'Audit completed with no Lighthouse data'
  const summary = `Crawled ${pages} page${pages === 1 ? '' : 's'} and discovered ${discovered} internal URL${discovered === 1 ? '' : 's'}. Lighthouse scores are performance ${scores.performance}, accessibility ${scores.accessibility}, best practices ${scores.bestPractices}, and SEO ${scores.seo}.`

  const priorities: AuditPriority[] = []
  if (scores.performance < 90) {
    priorities.push({
      title: 'Improve performance',
      impact: 'Higher perceived speed and better Core Web Vitals',
      reason: 'Lighthouse performance is below the ideal threshold.',
    })
  }

  if (scores.seo < 90) {
    priorities.push({
      title: 'Tighten on-page SEO',
      impact: 'Better crawlability and indexation',
      reason: 'The SEO score suggests metadata or structural gaps.',
    })
  }

  if (scores.accessibility < 90) {
    priorities.push({
      title: 'Fix accessibility issues',
      impact: 'Improved usability and fewer automated audit failures',
      reason: 'Accessibility checks still have room to improve.',
    })
  }

  if (input.lighthouse.opportunities.length > 0 && priorities.length < 4) {
    priorities.push({
      title: 'Address Lighthouse opportunities',
      impact: 'Reduce avoidable regressions',
      reason: input.lighthouse.opportunities.slice(0, 3).join(', '),
    })
  }

  if (priorities.length === 0) {
    priorities.push({
      title: 'Expand crawl coverage',
      impact: 'Broader page discovery for the next audit pass',
      reason: 'The crawl completed cleanly, so the next gain is more coverage.',
    })
  }

  return {
    source: 'heuristic',
    headline,
    summary,
    priorities: priorities.slice(0, 4),
  }
}

async function launchChromeForLighthouse(): Promise<{ port: number; close: () => Promise<void> }> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tec-seo-auditor-'))
  const { chromium } = await loadPlaywright()
  const executablePath = chromium.executablePath()
  const browser = spawn(
    executablePath,
    [
      '--headless=new',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-default-browser-check',
      '--no-sandbox',
      `--user-data-dir=${tempDir}`,
      '--remote-debugging-port=0',
      'about:blank',
    ],
    {
      stdio: ['ignore', 'ignore', 'pipe'],
    },
  )

  const wsEndpoint = await waitForDevToolsEndpoint(browser)
  const { port } = new URL(wsEndpoint)

  return {
    port: Number(port),
    close: async () => {
      browser.kill('SIGKILL')
      await fs.rm(tempDir, { recursive: true, force: true })
    },
  }
}

function waitForDevToolsEndpoint(browser: ReturnType<typeof spawn>): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('Timed out waiting for Chromium to expose DevTools'))
    }, 15_000)

    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      cleanup()
      reject(new Error(`Chromium exited before DevTools was ready (${code ?? 'null'}, ${signal ?? 'null'})`))
    }

    const onData = (chunk: Buffer) => {
      const text = chunk.toString('utf8')
      const match = /DevTools listening on (ws:\/\/[^\s]+)/.exec(text)
      if (match?.[1]) {
        cleanup()
        resolve(match[1])
      }
    }

    const cleanup = () => {
      clearTimeout(timeout)
      browser.stderr?.off('data', onData)
      browser.off('exit', onExit)
    }

    browser.stderr?.on('data', onData)
    browser.once('exit', onExit)
  })
}

function timeoutPromise(timeoutMs: number, message: string): Promise<never> {
  return new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(message)), timeoutMs)
  })
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function clampInt(value: number | undefined, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return fallback
  }

  return Math.min(max, Math.max(min, Math.floor(value)))
}
