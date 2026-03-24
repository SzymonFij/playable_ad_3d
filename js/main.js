import { CATEGORIES, categoryById } from "./catalog.js";
import { createScene } from "./scene3d.js";
import { createPixiUI } from "./uiPixi.js";
import { playTap, playTheme, playCollect, playPlacement } from "./sounds.js";

const hintBar = document.getElementById("hint-bar-inner");
const threeMount = document.getElementById("three-root");
const pixiMount = document.getElementById("pixi-root");
const hudTime = document.getElementById("hud-time");
const hudScore = document.getElementById("hud-score");
const hudCollect = document.getElementById("hud-collect");

function hint(msg) {
  if (hintBar) hintBar.textContent = msg;
}

const world = await createScene(threeMount);
world.resize();

let selectedCategoryId = CATEGORIES[0].id;
/** @type {import('./catalog.js').CATEGORIES[number]['items'][number]} */
let selectedItem = CATEGORIES[0].items[0];
world.setActiveTool({
  source: selectedItem.source,
  node: selectedItem.node,
});

const ui = await createPixiUI(pixiMount, {
  onCategory(id) {
    selectedCategoryId = id;
    const cat = categoryById[id];
    selectedItem = cat.items[0];
    world.setActiveTool({
      source: selectedItem.source,
      node: selectedItem.node,
    });
    hint(`Pick a ${cat.label.toLowerCase()} style, then tap the lawn to place — tap a piece to rotate.`);
    playTap();
  },
  onItem(item) {
    selectedItem = item;
    world.setActiveTool({ source: item.source, node: item.node });
    hint(`Tap the grass to place: ${item.label}. Tap any placed piece to spin it 45°.`);
    playTap();
  },
  onReset() {
    world.clearPlacements();
    hint("Garden cleared — keep dreaming up your makeover!");
    playTap();
  },
  onDayNight() {
    world.setNightMode(!world.getNightMode());
    hint(
      world.getNightMode()
        ? "Night mode — cozy garden vibes."
        : "Day mode — bright and fresh."
    );
    playTap();
  },
});

ui.setSelection(selectedCategoryId, selectedItem);

function refreshHud() {
  if (!hudTime || !hudScore || !hudCollect) return;
  const hudState = world.getHudState();
  const gameTime = Math.floor(hudState.gameTime);
  const cap = Math.floor(hudState.dayLength);
  hudTime.textContent = `Day ${hudState.dayNumber} · ${gameTime}s / ${cap}s`;
  hudScore.textContent = `$${hudState.score}`;
  const pending = hudState.pendingMoney;
  hudCollect.disabled = pending <= 0;
  hudCollect.textContent =
    pending > 0 ? `Collect $${pending}` : "Collect";
}

if (hudCollect) {
  hudCollect.addEventListener("click", () => {
    const got = world.collectPendingMoney();
    if (got > 0) {
      hint(`Collected $${got} — total $${world.getHudState().score}.`);
      playTap();
      playCollect();
      refreshHud();
    }
  });
}

function isOverPixiBar(clientY) {
  const r = pixiMount.getBoundingClientRect();
  return clientY >= r.top;
}

function handleGardenPointer(clientX, clientY) {
  if (isOverPixiBar(clientY)) return;
  const res = world.tryPlace(clientX, clientY);
  if (res.ok) {
    if (res.action === "rotate") {
      hint("Rotated 45°. Tap the same piece again to keep turning, or tap grass to place.");
    } else {
      hint("Placed! Tap any piece to rotate it, or tap grass to add more.");
    }
    playPlacement();
  } else if (res.reason === "no-hit") {
    hint("Aim for the lawn or an existing piece.");
  } else if (res.reason === "no-tool") {
    hint("Pick an item in the bar first, then tap the grass to place it.");
  }
}

/** Swipe/drag rotates the camera (OrbitControls); short tap still places/rotates props. */
const TAP_DRAG_THRESHOLD_PX = 14;
/** @type {{ pointerId: number; x: number; y: number; dragged: boolean } | null} */
let tapGesture = null;
const canvasEl = world.renderer.domElement;

canvasEl.addEventListener(
  "pointerdown",
  (e) => {
    world.bumpViewActivity();
    if (isOverPixiBar(e.clientY)) {
      tapGesture = null;
      return;
    }
    tapGesture = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      dragged: false,
    };
  },
  { capture: true }
);

canvasEl.addEventListener(
  "pointermove",
  (e) => {
    if (!tapGesture || tapGesture.pointerId !== e.pointerId) return;
    const dx = e.clientX - tapGesture.x;
    const dy = e.clientY - tapGesture.y;
    if (dx * dx + dy * dy > TAP_DRAG_THRESHOLD_PX * TAP_DRAG_THRESHOLD_PX) {
      tapGesture.dragged = true;
    }
  },
  { capture: true }
);

function finishTapGesture(e) {
  if (!tapGesture || tapGesture.pointerId !== e.pointerId) return;
  const dragged = tapGesture.dragged;
  tapGesture = null;
  if (e.type === "pointercancel" || dragged || isOverPixiBar(e.clientY)) return;
  handleGardenPointer(e.clientX, e.clientY);
}

canvasEl.addEventListener("pointerup", finishTapGesture, { capture: true });
canvasEl.addEventListener("pointercancel", finishTapGesture, { capture: true });
canvasEl.addEventListener("click", playTheme, { once: true });

pixiMount.addEventListener("pointerdown", () => world.bumpViewActivity());

window.addEventListener("resize", () => {
  world.resize();
  ui.resize();
});

function loop() {
  world.tick();
  refreshHud();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

hint(
  "Swipe the garden to orbit. Tap grass to place, tap props to spin. After 10s idle the view orbits on its own."
);
