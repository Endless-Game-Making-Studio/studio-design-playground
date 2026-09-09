export interface AmbienceSound {
  id: string
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
      { id: 'babbling-brook', name: 'Babbling brook', file: 'water/babbling_brook.mp3', seconds: 4 },
      { id: 'drip', name: 'Dripping', file: 'water/drip.mp3', seconds: 4 },
      { id: 'rain-puddle', name: 'Rain on a puddle', file: 'water/rain_puddle.mp3', seconds: 4 },
      { id: 'underwater', name: 'Bubbles', file: 'water/underwater.mp3', seconds: 4 },
      { id: 'water-pour', name: 'Pouring water', file: 'water/water_pour.mp3', seconds: 4 }
    ]
  },
  {
    id: 'fire',
    name: 'Fire',
    icon: 'lucide:flame',
    sounds: [
      { id: 'crackling-campfire', name: 'Campfire', file: 'fire/crackling_campfire.mp3', seconds: 4 },
      { id: 'small-campfire', name: 'Small campfire', file: 'fire/roaring_flames.mp3', seconds: 4 },
      { id: 'matchstick-strike', name: 'Struck match', file: 'fire/matchstick_strike.mp3', seconds: 4 },
      { id: 'lava-bubble', name: 'Bubbling lava', file: 'fire/lava_bubble.mp3', seconds: 4 },
      { id: 'roaring-flames', name: 'Roaring flames', file: 'fire/fire_hiss.mp3', seconds: 4 }
    ]
  },
  {
    id: 'wind',
    name: 'Wind',
    icon: 'lucide:wind',
    sounds: [
      { id: 'gentle-breeze', name: 'Gentle breeze', file: 'wind/gentle_breeze.mp3', seconds: 4 },
      { id: 'howling-wind', name: 'Howling wind', file: 'wind/howling_wind.mp3', seconds: 4 },
      { id: 'whistling-wind', name: 'Whistling wind', file: 'wind/whistling_wind.mp3', seconds: 4 },
      { id: 'wind-in-trees', name: 'Wind in the trees', file: 'wind/wind_in_trees.mp3', seconds: 4 },
      { id: 'wind-woosh', name: 'Gust', file: 'wind/wind_woosh.mp3', seconds: 4 }
    ]
  },
  {
    id: 'earth',
    name: 'Earth',
    icon: 'lucide:mountain',
    sounds: [
      { id: 'earthquake', name: 'Earthquake', file: 'earth/earthquake.mp3', seconds: 4 },
      { id: 'pebbles', name: 'Pebbles', file: 'earth/pebbles.mp3', seconds: 4 },
      { id: 'rocks-grinding', name: 'Grinding rocks', file: 'earth/rocks_grinding.mp3', seconds: 4 },
      { id: 'rocks-cracking', name: 'Cracking rocks', file: 'earth/rocks_cracking.mp3', seconds: 1.97 },
      { id: 'cave', name: 'Cave', file: 'earth/cave.mp3', seconds: 4 }
    ]
  },
  {
    id: 'fabric',
    name: 'Fabric',
    icon: 'lucide:shirt',
    sounds: [
      { id: 'fabric-folding', name: 'Folding', file: 'fabric/folding.mp3', seconds: 3.74 },
      { id: 'fabric-tearing', name: 'Tearing', file: 'fabric/tearing.mp3', seconds: 4 },
      { id: 'fabric-soft', name: 'Soft rustle', file: 'fabric/soft.mp3', seconds: 4 },
      { id: 'fabric-rough', name: 'Rough rustle', file: 'fabric/rough.mp3', seconds: 4 },
      { id: 'fabric-flap', name: 'Flapping', file: 'fabric/flap.mp3', seconds: 4 }
    ]
  },
  {
    id: 'storm',
    name: 'Storm',
    icon: 'lucide:cloud-lightning',
    sounds: [
      { id: 'lightning-1', name: 'Lightning 1', file: 'storm/lightning1.mp3', seconds: 4 },
      { id: 'lightning-2', name: 'Lightning 2', file: 'storm/lightning2.mp3', seconds: 4 },
      { id: 'thunder-1', name: 'Thunder 1', file: 'storm/thunder1.mp3', seconds: 4 },
      { id: 'thunder-2', name: 'Thunder 2', file: 'storm/thunder2.mp3', seconds: 4 },
      { id: 'heavy-rain', name: 'Heavy rain', file: 'storm/heavy_rain.mp3', seconds: 4 }
    ]
  },
  {
    id: 'dogs',
    name: 'Dogs',
    icon: 'lucide:dog',
    sounds: [
      { id: 'dog-barking', name: 'Barking', file: 'animals/dog_barking.mp3', seconds: 4 },
      { id: 'dog-yelping', name: 'Yelping', file: 'animals/dog_yelping.mp3', seconds: 1.11 },
      { id: 'dog-whining', name: 'Whining', file: 'animals/dog_whining.mp3', seconds: 4 },
      { id: 'dog-panting', name: 'Panting', file: 'animals/dog_panting.mp3', seconds: 4 },
      { id: 'dog-howling', name: 'Howling', file: 'animals/dog_howling.mp3', seconds: 4 },
      { id: 'dogs-pack', name: 'A pack of dogs', file: 'animals/dogs.mp3', seconds: 4 }
    ]
  },
  {
    id: 'cats',
    name: 'Cats',
    icon: 'lucide:cat',
    sounds: [
      { id: 'cats-meowing', name: 'Meowing', file: 'animals/cats.mp3', seconds: 4 }
    ]
  },
  {
    id: 'horses',
    name: 'Horses',
    icon: 'lucide:paw-print',
    sounds: [
      { id: 'horse-whinny', name: 'Whinny', file: 'animals/horses.mp3', seconds: 1.67 },
      { id: 'horse-gallop', name: 'Galloping', file: 'animals/horse_gallop.mp3', seconds: 4 },
      { id: 'horse-trot', name: 'Trotting', file: 'animals/horse_trot.mp3', seconds: 4 },
      { id: 'horse-snort', name: 'Snorting', file: 'animals/horse_snort.mp3', seconds: 0.86 },
      { id: 'horse-eating', name: 'Eating', file: 'animals/horse_eating.mp3', seconds: 4 }
    ]
  },
  {
    id: 'birds',
    name: 'Birds',
    icon: 'lucide:bird',
    sounds: [
      { id: 'bird-blackbird', name: 'Blackbird', file: 'animals/birds.mp3', seconds: 3.11 },
      { id: 'bird-crows', name: 'Crows', file: 'animals/crows.mp3', seconds: 4 },
      { id: 'bird-parrot', name: 'Parrot', file: 'animals/parrot.mp3', seconds: 4 },
      { id: 'bird-ducks', name: 'Ducks', file: 'animals/ducks.mp3', seconds: 4 },
      { id: 'bird-chorus', name: 'Dawn chorus', file: 'animals/chorus.mp3', seconds: 4 }
    ]
  },
  {
    id: 'insects',
    name: 'Insects',
    icon: 'lucide:bug',
    sounds: [
      { id: 'insects-crickets', name: 'Crickets', file: 'animals/insects.mp3', seconds: 4 },
      { id: 'insects-bee', name: 'Bee', file: 'animals/bee.mp3', seconds: 4 },
      { id: 'insects-flies', name: 'Flies', file: 'animals/flies.mp3', seconds: 4 }
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
