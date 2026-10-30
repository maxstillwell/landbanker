import { expect } from "@playwright/test";

// Exercise the current public controls at each viewport. No app state injection.
export async function openWorkspaceLibrary(page, name) {
  const library = page.getByRole("complementary", {
    name: "Workspace library",
    exact: true,
  });
  if (
    (await library.isVisible()) &&
    (await library.locator(".workspace-library-head strong").textContent()) ===
      name.toUpperCase()
  )
    return;
  const rail = page.getByRole("navigation", { name: "Map tools", exact: true });
  if (await rail.isVisible())
    await rail.getByRole("button", { name, exact: true }).click();
  else {
    const nav = page.getByRole("navigation", { name: "Mobile map navigation" });
    if (["Layers", "Properties"].includes(name))
      await nav.getByRole("button", { name, exact: true }).click();
    else {
      await nav.getByRole("button", { name: "More", exact: true }).click();
      await page
        .locator(".mobile-more-menu")
        .getByRole("button", { name, exact: true })
        .click();
    }
  }
  await expect(library).toBeVisible();
}
export async function addObservation(page) {
  await openWorkspaceLibrary(page, "Observations");
  await page
    .locator(".workspace-library")
    .getByRole("button", { name: /Add observation/ })
    .click();
  await expect(page.getByLabel("Title", { exact: true })).toBeVisible();
}
export async function resumeObservation(page, title) {
  await openWorkspaceLibrary(page, "Observations");
  const drafts = page.getByLabel("Observation drafts on this device", {
    exact: true,
  });
  if ((await drafts.getAttribute("open")) === null)
    await drafts.locator("summary").click();
  await drafts
    .locator(".drawer-record")
    .filter({ hasText: title })
    .getByRole("button", { name: "Resume", exact: true })
    .click();
  await expect(page.getByLabel("Title", { exact: true })).toHaveValue(title);
}
