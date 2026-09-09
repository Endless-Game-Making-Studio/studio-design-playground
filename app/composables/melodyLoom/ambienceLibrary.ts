export interface AmbienceSound {
  id: string
  categoryId: string
  name: string
  /** Path under `public/sounds`, so the served URL is `/sounds/{file}`. */
  file: string
  /** Measured with ffprobe against the files in `public/sounds` — shown before anything is decoded. */
  seconds: number
}

export interface AmbienceCategory {
  id: string
  name: string
  icon: string
  sounds: AmbienceSound[]
}

/**
 * The pre-recorded clips shipped in `public/sounds` — CC0 samples from
 * BigSoundBank.com, ported from the source project's catalogue.
 *
 * Names stay plain English rather than i18n keys: they label individual audio
 * files, so translating them would leave the picker and the folder of samples
 * describing the same clip differently.
 *
 * Dogs, cats, horses, birds and insects each get their own category even though
 * their files all live under `animals/` — one 20-entry "Animals" list is harder
 * to scan than five short ones.
 */
export const AMBIENCE_CATEGORIES: AmbienceCategory[] = [
  {
    id: 'water',
    name: 'Water',
    icon: 'lucide:droplets',
    sounds: [
      { id: 'babbling-brook', categoryId: 'water', name: 'Babbling brook', file: 'water/babbling_brook.mp3', seconds: 4 },
      { id: 'drip', categoryId: 'water', name: 'Dripping', file: 'water/drip.mp3', seconds: 4 },
      { id: 'rain-puddle', categoryId: 'water', name: 'Rain on a puddle', file: 'water/rain_puddle.mp3', seconds: 4 },
      { id: 'underwater', categoryId: 'water', name: 'Bubbles', file: 'water/underwater.mp3', seconds: 4 },
      { id: 'water-pour', categoryId: 'water', name: 'Pouring water', file: 'water/water_pour.mp3', seconds: 4 }
    ]
  },
  {
    id: 'fire',
    name: 'Fire',
    icon: 'lucide:flame',
    sounds: [
      { id: 'crackling-campfire', categoryId: 'fire', name: 'Campfire', file: 'fire/crackling_campfire.mp3', seconds: 4 },
      { id: 'small-campfire', categoryId: 'fire', name: 'Small campfire', file: 'fire/roaring_flames.mp3', seconds: 4 },
      { id: 'matchstick-strike', categoryId: 'fire', name: 'Struck match', file: 'fire/matchstick_strike.mp3', seconds: 4 },
      { id: 'lava-bubble', categoryId: 'fire', name: 'Bubbling lava', file: 'fire/lava_bubble.mp3', seconds: 4 },
      { id: 'roaring-flames', categoryId: 'fire', name: 'Roaring flames', file: 'fire/fire_hiss.mp3', seconds: 4 }
    ]
  },
  {
    id: 'wind',
    name: 'Wind',
    icon: 'lucide:wind',
    sounds: [
      { id: 'gentle-breeze', categoryId: 'wind', name: 'Gentle breeze', file: 'wind/gentle_breeze.mp3', seconds: 4 },
      { id: 'howling-wind', categoryId: 'wind', name: 'Howling wind', file: 'wind/howling_wind.mp3', seconds: 4 },
      { id: 'whistling-wind', categoryId: 'wind', name: 'Whistling wind', file: 'wind/whistling_wind.mp3', seconds: 4 },
      { id: 'wind-in-trees', categoryId: 'wind', name: 'Wind in the trees', file: 'wind/wind_in_trees.mp3', seconds: 4 },
      { id: 'wind-woosh', categoryId: 'wind', name: 'Gust', file: 'wind/wind_woosh.mp3', seconds: 4 }
    ]
  },
  {
    id: 'earth',
    name: 'Earth',
    icon: 'lucide:mountain',
    sounds: [
      { id: 'earthquake', categoryId: 'earth', name: 'Earthquake', file: 'earth/earthquake.mp3', seconds: 4 },
      { id: 'pebbles', categoryId: 'earth', name: 'Pebbles', file: 'earth/pebbles.mp3', seconds: 4 },
      { id: 'rocks-grinding', categoryId: 'earth', name: 'Grinding rocks', file: 'earth/rocks_grinding.mp3', seconds: 4 },
      { id: 'rocks-cracking', categoryId: 'earth', name: 'Cracking rocks', file: 'earth/rocks_cracking.mp3', seconds: 1.97 },
      { id: 'cave', categoryId: 'earth', name: 'Cave', file: 'earth/cave.mp3', seconds: 4 }
    ]
  },
  {
    id: 'fabric',
    name: 'Fabric',
    icon: 'lucide:shirt',
    sounds: [
      { id: 'fabric-folding', categoryId: 'fabric', name: 'Folding', file: 'fabric/folding.mp3', seconds: 3.74 },
      { id: 'fabric-tearing', categoryId: 'fabric', name: 'Tearing', file: 'fabric/tearing.mp3', seconds: 4 },
      { id: 'fabric-soft', categoryId: 'fabric', name: 'Soft rustle', file: 'fabric/soft.mp3', seconds: 4 },
      { id: 'fabric-rough', categoryId: 'fabric', name: 'Rough rustle', file: 'fabric/rough.mp3', seconds: 4 },
      { id: 'fabric-flap', categoryId: 'fabric', name: 'Flapping', file: 'fabric/flap.mp3', seconds: 4 }
    ]
  },
  {
    id: 'storm',
    name: 'Storm',
    icon: 'lucide:cloud-lightning',
    sounds: [
      { id: 'lightning-1', categoryId: 'storm', name: 'Lightning 1', file: 'storm/lightning1.mp3', seconds: 4 },
      { id: 'lightning-2', categoryId: 'storm', name: 'Lightning 2', file: 'storm/lightning2.mp3', seconds: 4 },
      { id: 'thunder-1', categoryId: 'storm', name: 'Thunder 1', file: 'storm/thunder1.mp3', seconds: 4 },
      { id: 'thunder-2', categoryId: 'storm', name: 'Thunder 2', file: 'storm/thunder2.mp3', seconds: 4 },
      { id: 'heavy-rain', categoryId: 'storm', name: 'Heavy rain', file: 'storm/heavy_rain.mp3', seconds: 4 }
    ]
  },
  {
    id: 'dogs',
    name: 'Dogs',
    icon: 'lucide:dog',
    sounds: [
      { id: 'dog-barking', categoryId: 'dogs', name: 'Barking', file: 'animals/dog_barking.mp3', seconds: 4 },
      { id: 'dog-yelping', categoryId: 'dogs', name: 'Yelping', file: 'animals/dog_yelping.mp3', seconds: 1.11 },
      { id: 'dog-whining', categoryId: 'dogs', name: 'Whining', file: 'animals/dog_whining.mp3', seconds: 4 },
      { id: 'dog-panting', categoryId: 'dogs', name: 'Panting', file: 'animals/dog_panting.mp3', seconds: 4 },
      { id: 'dog-howling', categoryId: 'dogs', name: 'Howling', file: 'animals/dog_howling.mp3', seconds: 4 },
      { id: 'dogs-pack', categoryId: 'dogs', name: 'A pack of dogs', file: 'animals/dogs.mp3', seconds: 4 }
    ]
  },
  {
    id: 'cats',
    name: 'Cats',
    icon: 'lucide:cat',
    sounds: [
      { id: 'cats-meowing', categoryId: 'cats', name: 'Meowing', file: 'animals/cats.mp3', seconds: 4 }
    ]
  },
  {
    id: 'horses',
    name: 'Horses',
    icon: 'lucide:paw-print',
    sounds: [
      { id: 'horse-whinny', categoryId: 'horses', name: 'Whinny', file: 'animals/horses.mp3', seconds: 1.67 },
      { id: 'horse-gallop', categoryId: 'horses', name: 'Galloping', file: 'animals/horse_gallop.mp3', seconds: 4 },
      { id: 'horse-trot', categoryId: 'horses', name: 'Trotting', file: 'animals/horse_trot.mp3', seconds: 4 },
      { id: 'horse-snort', categoryId: 'horses', name: 'Snorting', file: 'animals/horse_snort.mp3', seconds: 0.86 },
      { id: 'horse-eating', categoryId: 'horses', name: 'Eating', file: 'animals/horse_eating.mp3', seconds: 4 }
    ]
  },
  {
    id: 'birds',
    name: 'Birds',
    icon: 'lucide:bird',
    sounds: [
      { id: 'bird-blackbird', categoryId: 'birds', name: 'Blackbird', file: 'animals/birds.mp3', seconds: 3.11 },
      { id: 'bird-crows', categoryId: 'birds', name: 'Crows', file: 'animals/crows.mp3', seconds: 4 },
      { id: 'bird-parrot', categoryId: 'birds', name: 'Parrot', file: 'animals/parrot.mp3', seconds: 4 },
      { id: 'bird-ducks', categoryId: 'birds', name: 'Ducks', file: 'animals/ducks.mp3', seconds: 4 },
      { id: 'bird-chorus', categoryId: 'birds', name: 'Dawn chorus', file: 'animals/chorus.mp3', seconds: 4 }
    ]
  },
  {
    id: 'insects',
    name: 'Insects',
    icon: 'lucide:bug',
    sounds: [
      { id: 'insects-crickets', categoryId: 'insects', name: 'Crickets', file: 'animals/insects.mp3', seconds: 4 },
      { id: 'insects-bee', categoryId: 'insects', name: 'Bee', file: 'animals/bee.mp3', seconds: 4 },
      { id: 'insects-flies', categoryId: 'insects', name: 'Flies', file: 'animals/flies.mp3', seconds: 4 }
    ]
  }
]

const SOUNDS_BY_ID = new Map(
  AMBIENCE_CATEGORIES.flatMap(category => category.sounds).map(sound => [sound.id, sound])
)

export function findAmbienceSound(id: string): AmbienceSound | undefined {
  return SOUNDS_BY_ID.get(id)
}

export function findAmbienceCategory(id: string): AmbienceCategory | undefined {
  return AMBIENCE_CATEGORIES.find(category => category.id === id)
}

export function ambienceSoundUrl(sound: AmbienceSound): string {
  return `/sounds/${sound.file}`
}
