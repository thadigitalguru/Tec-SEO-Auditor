import { PlaywrightCrawler } from 'crawlee'
import lighthouse from 'lighthouse'
import { generateText } from 'ai'

export async function auditSite(url: string) {
  // Stub: crawl + LH + AI
  const crawler = new PlaywrightCrawler()
  // ... impl later
  return { scores: {}, summary: 'Stub' }
}
