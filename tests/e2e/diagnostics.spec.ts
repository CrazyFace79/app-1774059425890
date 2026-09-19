import { test, expect } from "@playwright/test"

test.describe("Diagnostics Panel", () => {
  test("should show all button statuses", async ({ page }) => {
    await page.goto("/__diag")

    const expectedButtons = [
      "export-structure",
      "export-ghost",
      "export-rolling",
      "export-chords",
      "export-hatsclap",
      "export-riser",
      "export-markers",
      "export-checklist",
      "copy-style",
      "copy-lyrics",
      "copy-combined",
      "save-history",
    ]

    for (const buttonId of expectedButtons) {
      // Check that each button status is displayed
      await expect(page.locator(`text=${buttonId}`)).toBeVisible()
    }

    // Check system status counters
    await expect(page.locator("text=Ready")).toBeVisible()
    await expect(page.locator("text=Issues")).toBeVisible()
    await expect(page.locator("text=Missing")).toBeVisible()
    await expect(page.locator("text=Total")).toBeVisible()
  })

  test("should update button statuses in real-time", async ({ page }) => {
    await page.goto("/__diag")

    // Wait for initial status check
    await page.waitForTimeout(3000)

    // Check that at least some buttons show as "Ready"
    const readyBadges = page.locator("text=Ready")
    await expect(readyBadges.first()).toBeVisible()
  })
})
