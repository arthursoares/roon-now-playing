const ADJECTIVES = [
  'amber', 'bold', 'bright', 'calm', 'clever',
  'coral', 'crisp', 'daring', 'eager', 'fading',
  'fierce', 'gentle', 'golden', 'happy', 'hushed',
  'ivory', 'jade', 'keen', 'kind', 'lively',
  'lucky', 'mellow', 'misty', 'noble', 'olive',
  'pastel', 'patient', 'quiet', 'rapid', 'rosy',
  'rustic', 'serene', 'sharp', 'silver', 'sleek',
  'smooth', 'snowy', 'soft', 'steady', 'still',
  'stormy', 'sunny', 'swift', 'tawny', 'tidal',
  'velvet', 'vivid', 'warm', 'wild', 'wise',
];

const ANIMALS = [
  'badger', 'bear', 'crane', 'deer', 'dove',
  'eagle', 'elk', 'falcon', 'finch', 'fox',
  'hawk', 'heron', 'horse', 'ibis', 'jay',
  'koala', 'lark', 'lion', 'lynx', 'mink',
  'moose', 'newt', 'otter', 'owl', 'panda',
  'puma', 'quail', 'raven', 'robin', 'seal',
  'shrike', 'snake', 'sparrow', 'stork', 'swan',
  'swift', 'tiger', 'trout', 'viper', 'whale',
  'wolf', 'wren', 'yak', 'zebra', 'hare',
  'crane', 'gecko', 'bison', 'coyote', 'osprey',
];

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateFriendlyName(existingNames: Set<string>): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    const adj = randomItem(ADJECTIVES);
    const animal = randomItem(ANIMALS);
    const num = Math.floor(Math.random() * 99) + 1;
    const name = `${adj}-${animal}-${num}`;
    if (!existingNames.has(name)) {
      return name;
    }
  }
  // Fallback: append timestamp fragment to guarantee uniqueness
  const adj = randomItem(ADJECTIVES);
  const animal = randomItem(ANIMALS);
  const suffix = Date.now().toString(36).slice(-4);
  return `${adj}-${animal}-${suffix}`;
}
