
export const PLANTS_CATEGORY_ID = "plants";
export const ANIMALS_CATEGORY_ID = "animals";
/**
 * Item catalog: each entry maps to a node inside bundled GLB files.
 * - source "objects" → assets/gltf/objects.glb
 * - source "ground"  → assets/gltf/ground.glb
 */
export const CATEGORIES = [
  {
    id: PLANTS_CATEGORY_ID,
    label: "Plants",
    items: [
      { id: "grape", label: "Grape vine", source: "objects", node: "grape_1" },
      { id: "corn", label: "Corn stalk", source: "objects", node: "corn_1" },
      { id: "tomato", label: "Tomato plant", source: "objects", node: "tomato_1" },
      { id: "strawberry", label: "Strawberry plant", source: "objects", node: "strawberry_1" },
    ],
  },
  {
    id: "furniture",
    label: "Furniture",
    items: [
      { id: "fence", label: "Fence panel", source: "objects", node: "fence" },
      { id: "trough", label: "Food", source: "ground", node: "trough" },
      { id: "storage", label: "Storage shed", source: "ground", node: "storage" },
    ],
  },
  {
    id: "decor",
    label: "Decor",
    items: [
      { id: "milk_can", label: "Milk can", source: "ground", node: "milk_can" },
      { id: "ground.ground1", label: "Ground", source: "objects", node: "ground" },
    ],
  },
  {
    id: ANIMALS_CATEGORY_ID,
    label: "Animals",
    items: [
      { id: "sheep", label: "Sheep", source: "objects", node: "sheep_1" },
      { id: "chicken", label: "Chicken", source: "objects", node: "chicken_1" },
      { id: "cow", label: "Cow", source: "objects", node: "cow_1" },
    ]
  }
];

export const NON_ROTARY_ITEMS = ["fence", "trough", "storage"];

/** Flat lookup by category id → items array */
export const categoryById = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c])
);


export function getPlantFamilySet() {
  const category = categoryById[PLANTS_CATEGORY_ID];
  if (!category) return new Set();
  return new Set(
    category.items.map((item) => {
      const base = item.node.replace(/_\d+$/i, "");
      return base.toLowerCase();
    })
  );
}

export function getAnimalFamilySet() {
  const category = categoryById[ANIMALS_CATEGORY_ID];
  if (!category) return new Set();
  return new Set(
    category.items.map((item) => {
      const base = item.node.replace(/_\d+$/i, "");
      return base.toLowerCase();
    })
  )
}

export function plantNodeForStage(family, stage) {
  return `${family.toLowerCase()}_${stage}`;
}
