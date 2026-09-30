// EM Fitness: what the capybara can wear or live in (fase 6). Bought with coins earned by
// training (lib/pet.js). `name` is an English source string for t(); the drawing of each item
// lives in components/Capybara.jsx under the same id.

export const SLOTS = ['head', 'eyes', 'neck', 'body', 'house', 'bg']
export const SLOT_NAME = { head: 'Head', eyes: 'Eyes', neck: 'Neck', body: 'Body', house: 'House', bg: 'Place' }

export const ITEMS = [
  { id: 'cap', slot: 'head', name: 'Cap', price: 40 },
  { id: 'beanie', slot: 'head', name: 'Beanie', price: 60 },
  { id: 'flowers', slot: 'head', name: 'Flower crown', price: 90 },
  { id: 'crown', slot: 'head', name: 'Crown', price: 400 },
  { id: 'round', slot: 'eyes', name: 'Round glasses', price: 50 },
  { id: 'shades', slot: 'eyes', name: 'Sunglasses', price: 80 },
  { id: 'bow', slot: 'neck', name: 'Bow tie', price: 40 },
  { id: 'scarf', slot: 'neck', name: 'Scarf', price: 70 },
  { id: 'medal', slot: 'neck', name: 'Gold medal', price: 250 },
  { id: 'tee', slot: 'body', name: 'EM Fitness tee', price: 60 },
  { id: 'hoodie', slot: 'body', name: 'Hoodie', price: 120 },
  { id: 'cape', slot: 'body', name: 'Hero cape', price: 300 },
  { id: 'hut', slot: 'house', name: 'Wooden hut', price: 150 },
  { id: 'cabin', slot: 'house', name: 'Lake cabin', price: 350 },
  { id: 'castle', slot: 'house', name: 'Castle', price: 800 },
  { id: 'park', slot: 'bg', name: 'Park', price: 60 },
  { id: 'beach', slot: 'bg', name: 'Beach', price: 150 },
  { id: 'gym', slot: 'bg', name: 'Gym', price: 200 },
  { id: 'space', slot: 'bg', name: 'Outer space', price: 500 }
]
export const ITEM = Object.fromEntries(ITEMS.map(i => [i.id, i]))
