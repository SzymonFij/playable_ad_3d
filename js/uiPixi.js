import * as PIXI from "pixi.js";
import { CATEGORIES } from "./catalog.js";

/**
 * @typedef {import('./catalog.js').CATEGORIES[number]['items'][number]} CatalogItem
 */

function sizePixiToMount(app, mount) {
  const w = mount.clientWidth || 320;
  const h = mount.clientHeight || 220;
  app.renderer.resize(w, h);
}

/**
 * Mobile-style bottom UI: categories, item chips, reset, day/night.
 * @param {HTMLElement} mount
 * @param {object} handlers
 * @param {(id: string) => void} handlers.onCategory
 * @param {(item: CatalogItem) => void} handlers.onItem
 * @param {() => void} handlers.onReset
 * @param {() => void} handlers.onDayNight
 */
export async function createPixiUI(mount, handlers) {
  const app = new PIXI.Application({
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    width: mount.clientWidth || 320,
    height: mount.clientHeight || 220,
  });

  mount.appendChild(app.view);

  const root = new PIXI.Container();
  app.stage.addChild(root);

  let selectedCategoryId = CATEGORIES[0].id;
  /** @type {CatalogItem | null} */
  let selectedItem = CATEGORIES[0].items[0];

  const categoryRow = new PIXI.Container();
  const itemRow = new PIXI.Container();
  const utilRow = new PIXI.Container();
  root.addChild(categoryRow);
  root.addChild(itemRow);
  root.addChild(utilRow);

  function makeLabel(str, size = 13, bold = false) {
    return new PIXI.Text(str, {
      fontFamily: "DM Sans, system-ui, sans-serif",
      fontSize: size,
      fontWeight: bold ? "700" : "600",
      fill: 0xf4fff8,
      align: "center",
    });
  }

  function pillBackground(w, h, active, mode) {
    const g = new PIXI.Graphics();
    const fill = active
      ? mode === "cat"
        ? 0x40916c
        : 0x52b788
      : 0x1b4332;
    const stroke = active ? 0xd8f3dc : 0x2d6a4f;
    const lw = active ? 2 : 1;
    g.lineStyle(lw, stroke, 0.9);
    g.beginFill(fill, 0.95);
    g.drawRoundedRect(0, 0, w, h, 14);
    g.endFill();
    return g;
  }

  function touchButton(w, h, onTap) {
    const c = new PIXI.Container();
    c.interactive = true;
    c.cursor = "pointer";
    c.hitArea = new PIXI.Rectangle(0, 0, w, h);
    c.on("pointertap", () => onTap());
    return c;
  }

  function layout() {
    categoryRow.removeChildren();
    itemRow.removeChildren();
    utilRow.removeChildren();
    for (const ch of [...root.children]) {
      if (ch !== categoryRow && ch !== itemRow && ch !== utilRow) root.removeChild(ch);
    }

    sizePixiToMount(app, mount);

    const w = app.renderer.width;
    const pad = Math.max(10, Math.min(14, w * 0.03));
    const gap = 8;

    let x = pad;
    const yCat = pad;
    const catH = 40;
    for (const cat of CATEGORIES) {
      const active = cat.id === selectedCategoryId;
      const lab = makeLabel(cat.label.toUpperCase(), 11, true);
      const pw = Math.max(92, lab.width + 26);
      const wrap = touchButton(pw, catH, () => {
        selectedCategoryId = cat.id;
        selectedItem = cat.items[0];
        handlers.onCategory(cat.id);
        layout();
      });
      const bg = pillBackground(pw, catH, active, "cat");
      lab.anchor.set(0.5);
      lab.position.set(pw / 2, catH / 2);
      wrap.addChild(bg, lab);
      wrap.position.set(x, yCat);
      categoryRow.addChild(wrap);
      x += pw + gap;
    }

    const cat = CATEGORIES.find((c) => c.id === selectedCategoryId) || CATEGORIES[0];
    let xi = pad;
    const yIt = yCat + catH + gap + 4;
    const chipH = 44;
    const n = Math.max(1, cat.items.length);
    const rowInner = w - pad * 2;
    const iw = Math.max(92, Math.min(132, (rowInner - gap * (n - 1)) / n));
    for (const it of cat.items) {
      const active = selectedItem?.id === it.id;
      const lab = makeLabel(it.label, 11, active);
      const wrap = touchButton(iw, chipH, () => {
        selectedItem = it;
        handlers.onItem(it);
        layout();
      });
      const bg = pillBackground(iw, chipH, active, "item");
      lab.anchor.set(0.5);
      lab.position.set(iw / 2, chipH / 2);
      wrap.addChild(bg, lab);
      wrap.position.set(xi, yIt);
      itemRow.addChild(wrap);
      xi += iw + gap;
    }

    const yU = yIt + chipH + gap + 6;
    const half = (w - pad * 2 - gap) / 2;
    const uh = 40;

    const resetWrap = touchButton(half, uh, () => handlers.onReset());
    const resetBg = pillBackground(half, uh, false, "item");
    const resetTx = makeLabel("Clear garden", 12, false);
    resetTx.anchor.set(0.5);
    resetTx.position.set(half / 2, uh / 2);
    resetWrap.addChild(resetBg, resetTx);
    resetWrap.position.set(pad, yU);

    const dnWrap = touchButton(half, uh, () => handlers.onDayNight());
    const dnBg = pillBackground(half, uh, false, "item");
    const dnTx = makeLabel("Day / Night", 12, false);
    dnTx.anchor.set(0.5);
    dnTx.position.set(half / 2, uh / 2);
    dnWrap.addChild(dnBg, dnTx);
    dnWrap.position.set(pad + half + gap, yU);

    utilRow.addChild(resetWrap, dnWrap);

    const strap = makeLabel("DESIGN YOUR DREAM GARDEN", 9, false);
    strap.alpha = 0.78;
    strap.position.set(pad, yU + uh + 6);
    root.addChild(strap);
  }

  layout();

  function resize() {
    layout();
  }

  function setSelection(categoryId, item) {
    selectedCategoryId = categoryId;
    selectedItem = item;
    layout();
  }

  return {
    app,
    resize,
    setSelection,
    getSelection: () => ({ categoryId: selectedCategoryId, item: selectedItem }),
  };
}
