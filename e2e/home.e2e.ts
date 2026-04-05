import { expect, test } from '@playwright/test'

test('home page smoke test', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveTitle('Tec SEO Auditor')
  await expect(page.getByRole('heading', { name: /crawl pages, run lighthouse/i })).toBeVisible()
  await expect(page.getByText(/real site crawl/i)).toBeVisible()
})
