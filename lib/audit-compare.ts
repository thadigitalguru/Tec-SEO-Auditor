import type { StoredAudit } from './audit-store'

export interface ScoreComparison {
  label: string
  base: number
  comparison: number
  delta: number
}

export interface MetricComparison {
  label: string
  base: number | null
  comparison: number | null
  delta: number | null
}

export interface AuditComparison {
  baseAudit: StoredAudit
  comparisonAudit: StoredAudit
  scoreComparisons: ScoreComparison[]
  metricComparisons: MetricComparison[]
  sharedPriorities: string[]
  baseOnlyPriorities: string[]
  comparisonOnlyPriorities: string[]
  sharedCrawlSignals: {
    pages: number
    discoveredUrls: number
  }
}

const SCORE_LABELS = [
  ['Performance', 'performance'],
  ['Accessibility', 'accessibility'],
  ['Best practices', 'bestPractices'],
  ['SEO', 'seo'],
] as const

const METRIC_LABELS = [
  ['LCP', 'lcp'],
  ['CLS', 'cls'],
  ['INP', 'inp'],
  ['TBT', 'tbt'],
] as const

export function buildAuditComparison(
  baseAudit: StoredAudit,
  comparisonAudit: StoredAudit,
): AuditComparison {
  const baseReport = baseAudit.results
  const comparisonReport = comparisonAudit.results

  return {
    baseAudit,
    comparisonAudit,
    scoreComparisons: SCORE_LABELS.map(([label, key]) => ({
      label,
      base: baseReport.lighthouse.scores[key],
      comparison: comparisonReport.lighthouse.scores[key],
      delta: comparisonReport.lighthouse.scores[key] - baseReport.lighthouse.scores[key],
    })),
    metricComparisons: METRIC_LABELS.map(([label, key]) => ({
      label,
      base: baseReport.lighthouse.metrics[key],
      comparison: comparisonReport.lighthouse.metrics[key],
      delta: numericDelta(
        comparisonReport.lighthouse.metrics[key],
        baseReport.lighthouse.metrics[key],
      ),
    })),
    sharedPriorities: sharedItems(
      baseReport.summary.priorities.map((priority) => priority.title),
      comparisonReport.summary.priorities.map((priority) => priority.title),
    ),
    baseOnlyPriorities: baseReport.summary.priorities
      .map((priority) => priority.title)
      .filter((title) => !comparisonReport.summary.priorities.some((priority) => priority.title === title)),
    comparisonOnlyPriorities: comparisonReport.summary.priorities
      .map((priority) => priority.title)
      .filter((title) => !baseReport.summary.priorities.some((priority) => priority.title === title)),
    sharedCrawlSignals: {
      pages: Math.min(baseReport.crawl.pages.length, comparisonReport.crawl.pages.length),
      discoveredUrls: Math.min(
        baseReport.crawl.discoveredUrls.length,
        comparisonReport.crawl.discoveredUrls.length,
      ),
    },
  }
}

function numericDelta(comparison: number | null, base: number | null) {
  if (comparison === null || base === null) {
    return null
  }

  return comparison - base
}

function sharedItems(left: string[], right: string[]) {
  const rightSet = new Set(right)
  return left.filter((item) => rightSet.has(item))
}

export function comparisonHeadline(comparison: AuditComparison) {
  const scoreDelta = comparison.scoreComparisons.reduce((sum, item) => sum + item.delta, 0)
  const direction = scoreDelta > 0 ? 'improved' : scoreDelta < 0 ? 'regressed' : 'held steady'

  return `The compared report ${direction} by ${Math.abs(scoreDelta)} total score points.`
}
