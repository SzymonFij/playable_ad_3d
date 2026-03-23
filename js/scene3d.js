import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import {
  CATEGORIES,
  getPlantFamilySet,
  getAnimalFamilySet,
  plantNodeForStage,
  NON_ROTARY_ITEMS,
} from "./catalog.js";
import { playObjectSound } from "./sounds.js";
import { ParticleBurst } from "./particle.js";

const GROUND_URL = new URL("../assets/gltf/ground2.glb", import.meta.url).href;
const OBJECTS_URL = new URL("../assets/gltf/objects.glb", import.meta.url).href;

let templateAnimations = [];
let mixers = [];
let gameTime = 0;
export const DAY_LENGTH = 20;
let dayIndex = 0;

const MONEY_PER_HARVEST = 25;
const MONEY_FROM_ANIMALS = 10;

const _cDay = new THREE.Color();
const _cNight = new THREE.Color();
const _cOut = new THREE.Color();

const DAY = {
  bg: 0x9bd4ff,
  fog: 0xcfefff,
  ambientColor: 0xbfe6ff,
  ambientIntensity: 0.55,
  sunColor: 0xfff1dc,
  sunIntensity: 1.15,
  sunPos: new THREE.Vector3(18, 26, 10),
  hemiColor: 0x8fd6ff,
  hemiGround: 0x2b3f2e,
  hemiIntensity: 0.35,
  exposure: 1.05,
};

const NIGHT = {
  bg: 0x5c6a62,
  fog: 0x4a5a52,
  ambientColor: 0x7b8fff,
  ambientIntensity: 0.32,
  sunColor: 0xb8d0ff,
  sunIntensity: 0.52,
  sunPos: new THREE.Vector3(-14, 14, 18),
  hemiColor: 0x5a78ff,
  hemiGround: 0x4a5c4e,
  hemiIntensity: 0.28,
  exposure: 0.88,
};

function cloneForPlacement(template) {
  let skinned = false;
  template.traverse((o) => {
    if (o.isSkinnedMesh) skinned = true;
  });
  return skinned ? cloneSkinned(template) : template.clone(true);
}

function snapObjectOntoGround(object, groundY) {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return;
  object.position.y += groundY - box.min.y;
  object.updateMatrixWorld(true);
}

const ROTATE_STEP = Math.PI / 4;

function fitTemplateScale(template, targetSize = 1.35) {
  const box = new THREE.Box3().setFromObject(template);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxAxis = Math.max(size.x, size.y, size.z, 1e-4);
  const s = targetSize / maxAxis;
  template.scale.multiplyScalar(s);
  template.updateMatrixWorld(true);
}

/**
 * @param {HTMLElement} mount
 */
export async function createScene(mount) {
  const clock = new THREE.Clock();
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  mount.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(DAY.bg);
  scene.fog = new THREE.Fog(DAY.fog, 24, 90);

  const camera = new THREE.PerspectiveCamera(52, 1, 0.1, 250);
  camera.position.set(9.2, 7.4, 11.2);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 6;
  controls.maxDistance = 32;
  controls.maxPolarAngle = Math.PI * 0.43;
  controls.target.set(0, 0.35, -1.2);
  controls.enableRotate = true;
  controls.enablePan = false;
  controls.autoRotate = false;
  controls.autoRotateSpeed = 0.28;

  const IDLE_MS = 10_000;
  let lastViewActivityTime = performance.now();
  function bumpViewActivity() {
    lastViewActivityTime = performance.now();
  }
  const canvas = renderer.domElement;
  canvas.addEventListener("pointerdown", bumpViewActivity);
  canvas.addEventListener("pointermove", bumpViewActivity);
  canvas.addEventListener("wheel", bumpViewActivity, { passive: true });

  const ambient = new THREE.AmbientLight(0xbfe6ff, 0.55);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff1dc, 1.15);
  sun.position.set(18, 26, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 80;
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  sun.shadow.bias = -0.0002;
  scene.add(sun);

  const hemi = new THREE.HemisphereLight(0x8fd6ff, 0x2b3f2e, 0.35);
  scene.add(hemi);

  /** @type {THREE.Mesh[]} */
  let groundMeshes = [];
  /** @type {Map<string, THREE.Object3D>} */
  const templates = new Map();

  /** @type {THREE.Object3D[]} */
  const placed = [];

  /** @type {{ source: string, node: string } | null} */
  let activeTool = null;

  let isNight = false;
  let lightingManualLock = false;

  let score = 0;
  let pendingMoney = 0;
  /** @type {THREE.Object3D[]} */
  const moneyMarkers = [];

  const plantFamilySet = getPlantFamilySet();
  const animalFamilySet = getAnimalFamilySet();

  const placementAnimations = [];

  const burst = new ParticleBurst(scene);

  function templateKey(source, node) {
    return `${source}:${node}`;
  }

  function extractNodeFromScene(rootScene, nodeName) {
    const obj = rootScene.getObjectByName(nodeName);
    if (!obj) return null;
    const tpl = cloneForPlacement(obj);
    obj.removeFromParent();
    tpl.visible = true;
    tpl.traverse((o) => {
      o.frustumCulled = true;
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return tpl;
  }

  // Load environment
  const loader = new GLTFLoader();
  const groundGltf = await new Promise((resolve, reject) =>
    loader.load(GROUND_URL, resolve, undefined, reject)
  );

  const envRoot = groundGltf.scene;
  envRoot.traverse((o) => {
    if (o.isMesh) {
      o.receiveShadow = true;
      o.castShadow = o.name.toLowerCase().includes("tree");
    }
  });

  scene.add(envRoot);

  const groundNodeNames = new Set();
  for (const cat of CATEGORIES) {
    for (const it of cat.items) {
      if (it.source === "ground") groundNodeNames.add(it.node);
    }
  }
  for (const name of groundNodeNames) {
    const tpl = extractNodeFromScene(envRoot, name);
    if (tpl) {
      fitTemplateScale(tpl, name === "storage" ? 4 : 1.25);
      templates.set(templateKey("ground", name), tpl);
    }
  }

  const objectsGltf = await new Promise((resolve, reject) =>
    loader.load(OBJECTS_URL, resolve, undefined, reject)
  );
  const objectsRoot = objectsGltf.scene;
  scene.add(objectsRoot);
  objectsRoot.visible = false;

  templateAnimations = objectsGltf.animations;

  const objectNodeNames = new Set();
  for (const category of CATEGORIES) {
    for (const item of category.items) {
      if (item.source === "objects") objectNodeNames.add(item.node);
    }
  }
  for (const fam of plantFamilySet) {
    objectNodeNames.add(plantNodeForStage(fam, 2));
    objectNodeNames.add(plantNodeForStage(fam, 3));
  }

  for (const name of objectNodeNames) {
    const srcObject = objectsRoot.getObjectByName(name);
    if (!srcObject) {
      console.warn("Missing objects.glb node:", name);
      continue;
    }
    const newObject = cloneForPlacement(srcObject);
    srcObject.removeFromParent();
    newObject.visible = true;
    newObject.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    let target;
    switch (name) {
      case "fence":
        target = 7;
        break;
      case "sheep_1":
        target = 1.7;
        break;
      case "cow_1":
        target = 2.3;
        break;
      case "ground":
        target = 2;
        break;
      default:
        target = 1;
        break;
    }
    fitTemplateScale(newObject, target);
    templates.set(templateKey("objects", name), newObject);
  }

  objectsRoot.removeFromParent();

  for (const cat of CATEGORIES) {
    for (const it of cat.items) {
      const k = templateKey(it.source, it.node);
      if (!templates.has(k)) console.warn("Missing GLB template:", k);
    }
  }

  function refreshGroundPickMeshes() {
    groundMeshes.length = 0;
    envRoot.updateMatrixWorld(true);
    envRoot.traverse((o) => {
      if (o.isMesh && o.visible) groundMeshes.push(o);
    });
  }
  refreshGroundPickMeshes();

  const groundBounds = new THREE.Box3();
  for (const m of groundMeshes) groundBounds.expandByObject(m);
  if (!groundBounds.isEmpty()) {
    const alignDy = -groundBounds.min.y;
    envRoot.position.y += alignDy;
    envRoot.updateMatrixWorld(true);
    camera.position.y += alignDy;
    controls.target.y += alignDy;
    refreshGroundPickMeshes();
  }

  function applyTimeOfDay() {
    const src = !isNight ? DAY : NIGHT;
    scene.background.setHex(src.bg);
    scene.fog.color.setHex(src.fog);
    scene.fog.near = !isNight ? 24 : 18;
    scene.fog.far = !isNight ? 90 : 78;
    ambient.color.setHex(src.ambientColor);
    ambient.intensity = src.ambientIntensity;
    sun.color.setHex(src.sunColor);
    sun.intensity = src.sunIntensity;
    sun.position.copy(src.sunPos);
    hemi.color.setHex(src.hemiColor);
    hemi.groundColor.setHex(src.hemiGround);
    hemi.intensity = src.hemiIntensity;
    renderer.toneMappingExposure = src.exposure;
  }

  function setNightMode(v) {
    isNight = !!v;
    lightingManualLock = true;
    applyTimeOfDay();
  }

  function setActiveTool(sel) {
    activeTool = sel
      ? { source: sel.source, node: sel.node }
      : null;
  }

  function clearPlacements() {
    for (const object of placed) {
      scene.remove(object);
    }
    placed.length = 0;
    placementAnimations.length = 0;
    for (const m of moneyMarkers) {
      scene.remove(m);
    }
    moneyMarkers.length = 0;
    pendingMoney = 0;
    for (let i = mixers.length - 1; i >= 0; i--) {
      mixers.splice(i, 1);
    }
  }

  function placedRootFromObject(obj) {
    let o = obj;
    while (o) {
      if (placed.includes(o)) return o;
      o = o.parent;
    }
    return null;
  }

  function collectPlacedPickMeshes() {
    const list = [];
    for (const root of placed) {
      root.updateMatrixWorld(true);
      root.traverse((ch) => {
        if (ch.isMesh && ch.visible) list.push(ch);
      });
    }
    return list;
  }

  function resnapPlacedToGround(obj) {
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return;
    const center = new THREE.Vector3();
    box.getCenter(center);
    const rayDown = new THREE.Raycaster(
      new THREE.Vector3(center.x, box.max.y + 80, center.z),
      new THREE.Vector3(0, -1, 0)
    );
    const downHits = rayDown.intersectObjects(groundMeshes, false);
    if (downHits.length) snapObjectOntoGround(obj, downHits[0].point.y);
  }

  function removeMixersForRoot(root) {
    for (let i = mixers.length - 1; i >= 0; i--) {
      if (mixers[i].getRoot() === root) {
        mixers.splice(i, 1);
      }
    }
  }

  function plantFamilyFromToolNode(node) {
    const m = /^([a-z]+)_(\d+)$/i.exec(node);
    if (!m) return null;
    const fam = m[1].toLowerCase();
    if (plantFamilySet.has(fam)) {
      return fam;
    }
    if (animalFamilySet.has(fam)) {
      return fam;
    }
    return null;
  }

  function swapPlacedPlant(oldRoot, newNodeName) {
    const k = templateKey("objects", newNodeName);
    const proto = templates.get(k);
    if (!proto) {
      console.warn("Missing plant stage template:", k);
      return;
    }
    const idx = placed.indexOf(oldRoot);
    if (idx < 0) return;
    const growth = oldRoot.userData.plantGrowth;
    removeMixersForRoot(oldRoot);
    scene.remove(oldRoot);
    const inst = cloneForPlacement(proto);
    inst.position.copy(oldRoot.position);
    inst.rotation.copy(oldRoot.rotation);
    inst.scale.copy(oldRoot.scale);
    inst.userData.plantGrowth = growth;
    scene.add(inst);
    placed[idx] = inst;
    if (templateAnimations.length > 0) {
      const mixer = new THREE.AnimationMixer(inst);
      const prefix = newNodeName.split("_")[0];
      templateAnimations.forEach((clip) => {
        if (clip.name.includes(prefix)) {
          mixer.clipAction(clip).play();
        }
      });
      mixers.push(mixer);
    }
    resnapPlacedToGround(inst);
  }

  function spawnMoneyVisual(at) {
    const key = templateKey("objects", "money");
    const proto = templates.get(key);
    let root;
    if (proto) {
      root = cloneForPlacement(proto);
      root.position.copy(at);
      root.position.y += 0.08;
      scene.add(root);
    } else {
      const g = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({
        color: 0xf2c14e,
        metalness: 0.55,
        roughness: 0.38,
      });
      const coin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.05, 18),
        mat
      );
      coin.rotation.x = Math.PI / 2;
      coin.castShadow = true;
      g.add(coin);
      const c2 = coin.clone();
      c2.position.set(0.1, 0.05, 0.05);
      g.add(c2);
      g.position.copy(at);
      g.position.y += 0.12;
      scene.add(g);
      root = g;
    }
    moneyMarkers.push(root);
  }

  function harvestPlant(root) {
    const idx = placed.indexOf(root);
    if (idx < 0) return;
    const pos = new THREE.Vector3();
    root.getWorldPosition(pos);
    removeMixersForRoot(root);
    scene.remove(root);
    placed.splice(idx, 1);
    pendingMoney += MONEY_PER_HARVEST;
    spawnMoneyVisual(pos);
  }

  function animalGrowthIncome(root) {
    const pos = new THREE.Vector3();
    root.getWorldPosition(pos);
    pendingMoney += MONEY_FROM_ANIMALS;
    spawnMoneyVisual(pos);
  }

  function tryPlace(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.firstHitOnly = true;
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
    const pickMeshes = [...collectPlacedPickMeshes(), ...groundMeshes];
    const hits = raycaster.intersectObjects(pickMeshes, false);
    if (!hits.length) return { ok: false, reason: "no-hit" };

    const hit = hits[0];
    const existing = placedRootFromObject(hit.object);
    if (existing) {
      if (!existing.name.includes("ground")) {
        existing.rotation.y += ROTATE_STEP;
      }
      resnapPlacedToGround(existing);
      return { ok: true, action: "rotate" };
    }

    if (!activeTool) return { ok: false, reason: "no-tool" };

    const key = templateKey(activeTool.source, activeTool.node);
    let proto = templates.get(key);
    playObjectSound(activeTool.node); 

    if (!proto) return { ok: false, reason: "no-template" };

    if (activeTool.node === "ground") {
      const index = Math.round(Math.random() * 6);
      proto = proto.children[index];
    }

    const inst = cloneForPlacement(proto);
    inst.position.copy(hit.point);
    if (!NON_ROTARY_ITEMS.includes(activeTool.node)) {
      inst.rotation.y = Math.random() * Math.PI * 2;
    }
    scene.add(inst);
    
    const particlePos = new THREE.Vector3();
    inst.getWorldPosition(particlePos);
    burst.trigger(particlePos);

    if (templateAnimations.length > 0) {
      const mixer = new THREE.AnimationMixer(inst);
      templateAnimations.forEach(clip => {
        if (clip.name.includes(activeTool.node.split("_")[0])) {
          const action = mixer.clipAction(clip);
          action.play();
        }
      });
      mixers.push(mixer);
    }

    snapObjectOntoGround(inst, hit.point.y);
    placed.push(inst);

    const plantFam = plantFamilyFromToolNode(activeTool.node);
    if (plantFam) {
      if (plantFam !== "sheep" && plantFam !== "cow" && plantFam !== "chicken") {
        inst.userData.plantGrowth = {
          family: plantFam,
          stage: 1,
          stage3SinceDay: -1,
        };
      } else {
        inst.userData.animalGrowth = true;
      }
    }

    const endScale = inst.scale.clone();
    const startScale = endScale.clone().multiplyScalar(0.06);
    inst.scale.copy(startScale);

    placementAnimations.push({
      t: 0,
      obj: inst,
      startS: startScale.clone(),
      endS: endScale.clone(),
      baseY: inst.position.y,
      lift: 0.55,
    });

    return { ok: true, action: "place" };
  }

  function resize() {
    const w = mount.clientWidth || window.innerWidth;
    const h = mount.clientHeight || window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    /* updateStyle: true keeps CSS pixel size aligned with drawing buffer for picking */
    renderer.setSize(w, h, true);
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function updateDayNight(t) {
    const nightBlend = (1 - Math.cos(t * Math.PI)) * 0.5;

    _cDay.setHex(DAY.bg);
    _cNight.setHex(NIGHT.bg);
    scene.background.copy(_cOut.copy(_cDay).lerp(_cNight, nightBlend));

    _cDay.setHex(DAY.fog);
    _cNight.setHex(NIGHT.fog);
    scene.fog.color.copy(_cOut.copy(_cDay).lerp(_cNight, nightBlend));
    scene.fog.near = lerp(24, 18, nightBlend);
    scene.fog.far = lerp(90, 78, nightBlend);

    _cDay.setHex(DAY.ambientColor);
    _cNight.setHex(NIGHT.ambientColor);
    ambient.color.copy(_cOut.copy(_cDay).lerp(_cNight, nightBlend));
    ambient.intensity = lerp(
      DAY.ambientIntensity,
      NIGHT.ambientIntensity,
      nightBlend
    );

    _cDay.setHex(DAY.sunColor);
    _cNight.setHex(NIGHT.sunColor);
    sun.color.copy(_cOut.copy(_cDay).lerp(_cNight, nightBlend));
    sun.intensity = lerp(DAY.sunIntensity, NIGHT.sunIntensity, nightBlend);
    sun.position.lerpVectors(DAY.sunPos, NIGHT.sunPos, nightBlend);

    _cDay.setHex(DAY.hemiColor);
    _cNight.setHex(NIGHT.hemiColor);
    hemi.color.copy(_cOut.copy(_cDay).lerp(_cNight, nightBlend));
    _cDay.setHex(DAY.hemiGround);
    _cNight.setHex(NIGHT.hemiGround);
    hemi.groundColor.copy(_cOut.copy(_cDay).lerp(_cNight, nightBlend));
    hemi.intensity = lerp(
      DAY.hemiIntensity,
      NIGHT.hemiIntensity,
      nightBlend
    );

    renderer.toneMappingExposure = lerp(
      DAY.exposure,
      NIGHT.exposure,
      nightBlend
    );

    isNight = nightBlend > 0.52;
  }

  function onNewDay(day) {
    lightingManualLock = false;
    for (const root of [...placed]) {
      const animalGrowth = root.userData.animalGrowth;
      if (animalGrowth) {
        animalGrowthIncome(root);
      }
      const growth = root.userData.plantGrowth;
      if (!growth) continue;
      if (
        growth.stage === 3 &&
        growth.stage3SinceDay >= 0 &&
        growth.stage3SinceDay < day &&
        day % 2 === 0
      ) {
        harvestPlant(root);
        continue;
      }
      if (growth.stage < 3) {
        const next = growth.stage + 1;
        const nm = plantNodeForStage(growth.family, next);
        if (!templates.has(templateKey("objects", nm))) {
          console.warn("Missing plant stage model:", nm);
          continue;
        }
        growth.stage = next;
        swapPlacedPlant(root, nm);
        if (next === 3) {
          growth.stage3SinceDay = day;
        }
      }
    }
  }

  function updateGameTime(dt) {
    gameTime += dt;
    while (gameTime >= DAY_LENGTH) {
      gameTime -= DAY_LENGTH;
      dayIndex++;
      onNewDay(dayIndex);
    }
  }

  function collectPendingMoney() {
    const moneyToPick = pendingMoney;
    if (moneyToPick <= 0) return 0;
    score += moneyToPick;
    pendingMoney = 0;
    for (const m of moneyMarkers) {
      scene.remove(m);
    }
    moneyMarkers.length = 0;
    return moneyToPick;
  }

  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05);
    controls.autoRotate = performance.now() - lastViewActivityTime >= IDLE_MS;
    controls.update();
    updateGameTime(dt);
    burst.update(dt);
    if (lightingManualLock) {
      applyTimeOfDay();
    } else {
      updateDayNight(gameTime / DAY_LENGTH);
    }

    for (let i = placementAnimations.length - 1; i >= 0; i--) {
      const a = placementAnimations[i];
      a.t += dt * 4.2;
      const u = Math.min(1, a.t);
      const k = 1 - Math.pow(1 - u, 3);
      a.obj.scale.lerpVectors(a.startS, a.endS, k);
      const bounce = Math.sin(u * Math.PI) * a.lift * (1 - u);
      a.obj.position.y = a.baseY + bounce;
      if (u >= 1) {
        a.obj.position.y = a.baseY;
        placementAnimations.splice(i, 1);
      }
    }
    mixers.forEach(mixer => mixer.update(dt));

    renderer.render(scene, camera);
  }

  return {
    renderer,
    scene,
    camera,
    controls,
    resize,
    tick,
    tryPlace,
    setActiveTool,
    setNightMode,
    clearPlacements,
    getNightMode: () => isNight,
    bumpViewActivity,
    collectPendingMoney,
    getHudState: () => ({
      dayNumber: dayIndex + 1,
      gameTime,
      dayLength: DAY_LENGTH,
      pendingMoney,
      score,
    }),
  };
}
