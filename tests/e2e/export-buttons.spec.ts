import { test, expect } from "@playwright/test"

test.describe("Export Buttons Smoke Test", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/")
    // Navigate to Export tab
    await page.click("text=Export")
    await page.waitForTimeout(1000)
  })

  test("should have all export buttons mounted and enabled", async ({ page }) => {
    const buttons = [
      "export-structure",
      "export-ghost",
      "export-rolling",
      "export-chords",
      "export-hatsclap",
      "export-riser",
      "export-markers",
      "export-checklist",
    ]

    for (const testId of buttons) {
      const button = page.getByTestId(testId)
      await expect(button).toBeVisible()
      await expect(button).toBeEnabled()
    }
  })

  test("should download MIDI files when export buttons are clicked", async ({ page }) => {
    const midiButtons = [
      "export-structure",
      "export-ghost",
      "export-rolling",
      "export-chords",
      "export-hatsclap",
      "export-riser",
    ]

    for (const testId of midiButtons) {
      const downloadPromise = page.waitForEvent("download")
      await page.getByTestId(testId).click()
      const download = await downloadPromise

      // Verify download has content
      expect(download.suggestedFilename()).toMatch(/\.mid$/)

      // Save and check file size
      const path = await download.path()
      if (path) {
        const fs = require("fs")
        const stats = fs.statSync(path)
        expect(stats.size).toBeGreaterThan(0)
      }
    }
  })

  test("should download text files when FL shortcuts are clicked", async ({ page }) => {
    const textButtons = [
      { testId: "export-markers", extension: ".txt" },
      { testId: "export-checklist", extension: ".txt" },
    ]

    for (const { testId, extension } of textButtons) {
      const downloadPromise = page.waitForEvent("download")
      await page.getByTestId(testId).click()
      const download = await downloadPromise

      expect(download.suggestedFilename()).toMatch(new RegExp(`\\${extension}$`))

      const path = await download.path()
      if (path) {
        const fs = require("fs")
        const stats = fs.statSync(path)
        expect(stats.size).toBeGreaterThan(0)
      }
    }
  })
})

test.describe("Copy Buttons Test", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/")
    // Navigate to Result tab
    await page.click("text=Result")
    await page.waitForTimeout(1000)
  })

  test("should copy content to clipboard", async ({ page }) => {
    const copyButtons = ["copy-style", "copy-lyrics", "copy-combined"]

    for (const testId of copyButtons) {
      const button = page.getByTestId(testId)
      await expect(button).toBeVisible()
      await expect(button).toBeEnabled()

      await button.click()

      // Check clipboard content is not empty
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText())
      expect(clipboardText.length).toBeGreaterThan(0)
    }
  })
})

test.describe("History Test", () => {
  test("should save and restore history entries", async ({ page }) => {
    await page.goto("/")

    // Navigate to Generator tab and save to history
    await page.click("text=Generator")
    await page.waitForTimeout(1000)

    const saveButton = page.getByTestId("save-history")
    await expect(saveButton).toBeVisible()
    await expect(saveButton).toBeEnabled()

    await saveButton.click()

    // Navigate to History tab
    await page.click("text=History")
    await page.waitForTimeout(1000)

    // Check that history entries exist
    const historyEntries = page.locator('[data-testid^="history-entry-"]')
    await expect(historyEntries.first()).toBeVisible()

    // Test restore functionality
    const restoreButton = historyEntries.first().locator('button:has-text("Restore")')
    if (await restoreButton.isVisible()) {
      await restoreButton.click()

      // Navigate to Editor tab to verify restore
      await page.click("text=Editor")
      await page.waitForTimeout(1000)

      // Check that lyrics were restored (should have content)
      const lyricsContent = page.locator("textarea, [contenteditable]").first()
      const content = await lyricsContent.inputValue().catch(() => lyricsContent.textContent())
      expect(content?.length || 0).toBeGreaterThan(0)
    }
  })
})
