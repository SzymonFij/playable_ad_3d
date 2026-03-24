import * as PIXI from "pixi.js";
import { CATEGORIES } from "./catalog.js";

function sizePixiToMount(app, mount) {
  const width = mount.clientWidth || 320;
  const height = mount.clientHeight || 220;
  app.renderer.resize(width, height);
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
      wordWrap: true,
      wordWrapWidth: 90
    });
  }

  function pillBackground(width, height, active, mode) {
    const graphics = new PIXI.Graphics();
    const fill = active
      ? mode === "cat"
        ? 0x40916c
        : 0x52b788
      : 0x1b4332;
    const stroke = active ? 0xd8f3dc : 0x2d6a4f;
    const lineWidth = active ? 2 : 1;
    graphics.lineStyle(lineWidth, stroke, 0.9);
    graphics.beginFill(fill, 0.95);
    graphics.drawRoundedRect(0, 0, width, height, 14);
    graphics.endFill();
    return graphics;
  }

  function touchButton(width, height, onTap) {
    const container = new PIXI.Container();
    container.interactive = true;
    container.cursor = "pointer";
    container.hitArea = new PIXI.Rectangle(0, 0, width, height);
    container.on("pointertap", () => onTap());
    return container;
  }

  function layout() {
    categoryRow.removeChildren();
    itemRow.removeChildren();
    utilRow.removeChildren();
    for (const child of [...root.children]) {
      if (child !== categoryRow && child !== itemRow && child !== utilRow) root.removeChild(child);
    }

    sizePixiToMount(app, mount);

    const screenWidth = app.renderer.width;
    const pad = Math.max(10, Math.min(14, screenWidth * 0.03));
    const gap = 8;

    let x = pad;
    const categoryPositionY = pad;
    const categoryHeight = 40;
    for (const category of CATEGORIES) {
      const active = category.id === selectedCategoryId;
      const label = makeLabel(category.label.toUpperCase(), 11, true);
      const buttonWidth = Math.max(92, label.width + 26);
      const wrap = touchButton(buttonWidth, categoryHeight, () => {
        selectedCategoryId = category.id;
        selectedItem = category.items[0];
        handlers.onCategory(category.id);
        layout();
      });
      const bg = pillBackground(buttonWidth, categoryHeight, active, "cat");
      label.anchor.set(0.5);
      label.position.set(buttonWidth / 2, categoryHeight / 2);
      wrap.addChild(bg, label);
      wrap.position.set(x, categoryPositionY);
      categoryRow.addChild(wrap);
      x += buttonWidth + gap;
    }

    const maxWidth = app.screen.width - pad - gap;
    if (categoryRow.width > maxWidth) {
      const scale = maxWidth / categoryRow.width;
      categoryRow.scale.set(scale);
    }

    const category = CATEGORIES.find((c) => c.id === selectedCategoryId) || CATEGORIES[0];
    let itemPositionX = pad;
    const itemPositionY = categoryPositionY + categoryHeight + gap + 4;
    const labelHeight = 44;
    const index = Math.max(1, category.items.length);
    const rowInner = screenWidth - pad * 2;
    const buttonWidth = Math.min(132, (maxWidth - pad - gap) / CATEGORIES.length, (rowInner - gap * (index - 1)) / index);
    for (const it of category.items) {
      const active = selectedItem?.id === it.id;
      const label = makeLabel(it.label, 11, active);
      const wrap = touchButton(buttonWidth, labelHeight, () => {
        selectedItem = it;
        handlers.onItem(it);
        layout();
      });
      const bg = pillBackground(buttonWidth, labelHeight, active, "item");
      label.anchor.set(0.5);
      label.position.set(buttonWidth / 2, labelHeight / 2);
      wrap.addChild(bg, label);
      wrap.position.set(itemPositionX, itemPositionY);
      itemRow.addChild(wrap);
      itemPositionX += buttonWidth + gap;
    }

    // if (itemRow.width > maxWidth) {
    //   const scale = maxWidth / itemRow.width;
    //   itemRow.scale.set(scale);
    // }
    itemRow.maxWidth = maxWidth;
    itemRow.wrap = true;

    const wrapPositionY = itemPositionY + labelHeight + gap + 6;
    const wrapPositionCenterX = (maxWidth - pad) / 2;
    const textHeight = 40;

    const resetWrap = touchButton(wrapPositionCenterX, textHeight, () => handlers.onReset());
    const resetBg = pillBackground(wrapPositionCenterX, textHeight, false, "item");
    const resetTx = makeLabel("Clear garden", 12, false);
    resetTx.anchor.set(0.5);
    resetTx.position.set(wrapPositionCenterX / 2, textHeight / 2);
    resetWrap.addChild(resetBg, resetTx);
    resetWrap.position.set(pad, wrapPositionY);

    const dayNightButton = touchButton(wrapPositionCenterX, textHeight, () => handlers.onDayNight());
    const dayNightButtonBackgroung = pillBackground(wrapPositionCenterX, textHeight, false, "item");
    const dayNightButtonLabel = makeLabel("Day / Night", 12, false);
    dayNightButtonLabel.anchor.set(0.5);
    dayNightButtonLabel.position.set(wrapPositionCenterX / 2, textHeight / 2);
    dayNightButton.addChild(dayNightButtonBackgroung, dayNightButtonLabel);
    dayNightButton.position.set(pad + wrapPositionCenterX + gap, wrapPositionY);

    utilRow.addChild(resetWrap, dayNightButton);

    const additionalInfoLabel = makeLabel("DESIGN YOUR DREAM GARDEN", 9, false);
    additionalInfoLabel.alpha = 0.78;
    additionalInfoLabel.position.set(pad, wrapPositionY + textHeight + 6);
    root.addChild(additionalInfoLabel);
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
