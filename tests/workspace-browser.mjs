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
  const desktop = (page.viewportSize()?.width ?? 1440) >= 768;
  await expect(desktop ? rail : page.getByRole("navigation", {name:"Mobile map navigation"})).toBeVisible();
  if (desktop) {
    if (name === "Saved Views") {
      const settings = page.locator(".desktop-workspace-settings");
      if ((await settings.getAttribute("open")) === null)
        await settings.locator("summary").click();
      await settings.getByRole("button", { name, exact: true }).click();
    } else await rail.getByRole("button", { name, exact: true }).click();
  } else {
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
export async function openTools(page) {
  if (
    await page
      .getByRole("button", { name: "Move Spatial Tools", exact: true })
      .isVisible()
  ) {
    const toggle = page.locator(".floating-map-widget-header").getByRole("button", {name:"Spatial Tools",exact:true});
    if(await toggle.getAttribute("aria-expanded")==="false") await toggle.click();
    return;
  }
  const rail = page.getByRole("navigation", { name: "Map tools", exact: true });
  const desktop = (page.viewportSize()?.width ?? 1440) >= 768;
  await expect(desktop ? rail : page.getByRole("navigation", {name:"Mobile map navigation"})).toBeVisible();
  if (desktop)
    await rail.getByRole("button", { name: "Tools", exact: true }).click();
  else {
    await page
      .locator(".mobile-map-nav")
      .getByRole("button", { name: "More", exact: true })
      .click();
    await page
      .locator(".mobile-more-menu")
      .getByRole("button", { name: "Tools", exact: true })
      .click();
  }
  await expect(
    page.getByRole("button", { name: "Move Spatial Tools", exact: true }),
  ).toBeVisible();
}
export async function openCustomLayers(page) {
  await openWorkspaceLibrary(page, "Layers");
  const details = page.locator(".workspace-library details").filter({
    has: page.locator("summary", { hasText: "Custom Data Layers" }),
  });
  if ((await details.getAttribute("open")) === null)
    await details.locator("summary").click();
  return details;
}
export async function openMapSearch(page) {
  const search = page.getByLabel("Search address", { exact: true });
  if (await search.isVisible()) return;
  await openTools(page);
  await page
    .getByRole("button", { name: "Parcel search and identify", exact: true })
    .click();
  await expect(search).toBeVisible();
}
export async function openWorkspaceSettings(page) {
  const settings = page.locator(".map-header .desktop-workspace-settings");
  if ((await settings.getAttribute("open")) === null)
    await settings.locator("summary").click();
  return settings;
}
export async function enableReferenceLayer(page, name) {
  await openWorkspaceLibrary(page, "Layers");
  await page.locator(".workspace-library .maplibre-official-row")
    .filter({has:page.getByText(name,{exact:true})})
    .getByRole("checkbox").check();
}
export async function prepareDrawingSave(page) {
  const drawing = page.getByLabel("Completed drawing", { exact: true });
  if (
    await drawing.getByRole("button", { name: "Save", exact: true }).isVisible()
  )
    await drawing.getByRole("button", { name: "Save", exact: true }).click();
  const destination = drawing.getByLabel("Drawing destination", {
    exact: true,
  });
  if (await destination.count()) await destination.selectOption("layer");
}
export async function confirmDrawingSave(page) {
  await prepareDrawingSave(page);
  await page
    .getByLabel("Completed drawing", { exact: true })
    .getByRole("button", { name: "Confirm save", exact: true })
    .click();
}
export async function selectBasemap(page, style) {
  const labels = { light: "Light", dark: "Dark", streets: "Streets" };
  const picker = page.getByLabel("Basemap previews");
  const group = page.getByRole("group", {
    name: "Basemap styles",
    exact: true,
  });
  if (!(await group.isVisible())) await picker.click();
  await group.getByRole("button", { name: labels[style], exact: true }).click();
  await expect(page.locator(".map-canvas")).toHaveAttribute(
    "data-basemap",
    style,
  );
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

export async function selectListedLayerFeature(page, name) {
  const details=page.locator(".drawer-layer-features");
  await expect(details).toBeVisible();
  if(await details.getAttribute("open")===null) await details.locator(":scope > summary").click();
  const target=details.getByRole("button",{name,exact:true});
  for(let pageIndex=0;pageIndex<100;pageIndex++) {
    await expect(details.getByRole("button",{name:"Loading…",exact:true})).toHaveCount(0);
    if(await target.isVisible()) {await target.click();return;}
    const more=details.getByRole("button",{name:"Load more features",exact:true});
    await expect(more).toBeVisible();
    await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==="/api/layers"&&new URL(r.url()).searchParams.get("list")==="1"),more.click()]);
  }
  throw new Error(`Feature not found after all supported pages: ${name}`);
}
