const THEME = new URL("../assets/sounds/theme.mp3", import.meta.url).href;
const CLICK_SOUND = new URL("../assets/sounds/click_003.mp3", import.meta.url).href;
const COLLECT_SOUND = new URL("../assets/sounds/popup_chest.mp3", import.meta.url).href;
const PLACE_SOUND = new URL("../assets/sounds/throw_spear.mp3", import.meta.url).href;

const COW_SOUND = new URL("../assets/sounds/cow.mp3", import.meta.url).href;
const CHICKEN_SOUND = new URL("../assets/sounds/chicken.mp3", import.meta.url).href;
const SHEEP_SOUND = new URL("../assets/sounds/sheep.mp3", import.meta.url).href;

const animalSounds = {
  "cow_1": COW_SOUND,
  "chicken_1": CHICKEN_SOUND,
  "sheep_1": SHEEP_SOUND,
};
export function playTheme() {
    const audio = new Audio(THEME);
    audio.volume = 0.4;
    audio.loop = true;
    void audio.play();
}

export function playTap() {
    const audio = new Audio(CLICK_SOUND);
    audio.volume = 0.5;
    void audio.play();
}

export function playObjectSound(name) {
    const audio = new Audio(animalSounds[name]);
    audio.volume = 0.5;
    void audio.play();
}

export function playCollect() {
    const audio = new Audio(COLLECT_SOUND);
    audio.volume = 1;
    void audio.play();
}

export function playPlacement() {
    const audio = new Audio(PLACE_SOUND);
    audio.volume = 0.4;
    void audio.play();
}