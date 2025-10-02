const ANIMAL_EMOJIS = [
  "🦊",
  "🐻",
  "🐼",
  "🦁",
  "🐯",
  "🐮",
  "🐸",
  "🐵",
  "🐶",
  "🐱",
  "🦄",
  "🦉",
  "🦜",
  "🦇",
  "🐢",
  "🐙",
  "🐳",
  "🐬",
  "🦕",
  "🦓",
] as const;

const SYMBOL_EMOJIS = [
  "🎭",
  "🎲",
  "🕵️",
  "🩺",
  "🛡️",
  "🧠",
  "🔮",
  "🧥",
  "🕶️",
  "🎩",
  "🗡️",
  "🚬",
] as const;

export const FRIEND_AVATAR_OPTIONS = [...ANIMAL_EMOJIS, ...SYMBOL_EMOJIS];

export const RANDOM_ANIMAL_POOL = [...ANIMAL_EMOJIS];

export const getRandomAnimalAvatar = () => {
  if (RANDOM_ANIMAL_POOL.length === 0) {
    return "🦊";
  }
  const index = Math.floor(Math.random() * RANDOM_ANIMAL_POOL.length);
  return RANDOM_ANIMAL_POOL[index];
};

export const getRandomFriendAvatar = () => {
  if (FRIEND_AVATAR_OPTIONS.length === 0) {
    return "🎭";
  }
  const index = Math.floor(Math.random() * FRIEND_AVATAR_OPTIONS.length);
  return FRIEND_AVATAR_OPTIONS[index];
};

export const normalizeAvatar = (value?: string | null) => value?.trim() || null;
