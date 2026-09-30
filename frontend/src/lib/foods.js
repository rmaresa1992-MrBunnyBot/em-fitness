// EM Fitness: a small catalog of common foods so the trainer doesn't type every macro (D18).
//
// Reference values per 100 g (per 100 ml for drinks, taken as ≈ 1 g/ml), rounded, from general
// food-composition tables (USDA-style figures, with foods common in México). They are
// approximations — brands and cooking change them — and the editor says so; the trainer can
// always overwrite a figure, which unlinks that row from the catalog.
//
// Each row: [id, name, kcal, protein g, carbs g, fat g, grams per piece (optional)].
// Ids are stored in the diet (`ref`), so never rename or reuse one.

const ROWS = [
  // proteínas
  ['pechuga-pollo', 'Pechuga de pollo (cocida)', 165, 31, 0, 3.6],
  ['pechuga-pollo-cruda', 'Pechuga de pollo (cruda)', 120, 22.5, 0, 2.6],
  ['muslo-pollo', 'Muslo de pollo sin piel (cocido)', 209, 26, 0, 10.9],
  ['pavo-pechuga', 'Pechuga de pavo (cocida)', 135, 30, 0, 1],
  ['jamon-pavo', 'Jamón de pavo', 110, 17, 3, 3, 20],
  ['salchicha-pavo', 'Salchicha de pavo', 160, 12, 4, 10, 30],
  ['res-magra', 'Carne de res magra (cocida)', 217, 26, 0, 11.8],
  ['bistec-res', 'Bistec de res (cocido)', 206, 29, 0, 9],
  ['molida-res-90', 'Carne molida de res 90/10 (cruda)', 176, 20, 0, 10],
  ['lomo-cerdo', 'Lomo de cerdo (cocido)', 143, 26, 0, 3.5],
  ['atun-agua', 'Atún en agua (escurrido)', 116, 26, 0, 0.8],
  ['atun-aceite', 'Atún en aceite (escurrido)', 198, 29, 0, 8.2],
  ['sardina-tomate', 'Sardinas en tomate', 160, 18, 2, 9],
  ['salmon', 'Salmón (cocido)', 206, 22, 0, 12.4],
  ['tilapia', 'Tilapia (cocida)', 128, 26, 0, 2.7],
  ['camaron', 'Camarón (cocido)', 99, 24, 0.2, 0.3],
  ['huevo', 'Huevo entero', 143, 12.6, 0.7, 9.5, 50],
  ['clara-huevo', 'Clara de huevo', 52, 10.9, 0.7, 0.2, 33],
  ['tofu', 'Tofu firme', 144, 17, 3, 8.7],
  ['proteina-suero', 'Proteína en polvo (suero)', 400, 80, 8, 6, 30],
  ['barra-proteina', 'Barra de proteína', 360, 30, 38, 10, 60],
  // lácteos
  ['leche-entera', 'Leche entera', 61, 3.2, 4.8, 3.3],
  ['leche-descremada', 'Leche descremada', 34, 3.4, 5, 0.1],
  ['leche-deslactosada-light', 'Leche deslactosada light', 42, 3.4, 4.8, 1],
  ['bebida-almendra', 'Bebida de almendra sin azúcar', 15, 0.6, 0.3, 1.2],
  ['yogur-griego', 'Yogur griego natural (sin grasa)', 59, 10, 3.6, 0.4],
  ['yogur-natural', 'Yogur natural', 61, 3.5, 4.7, 3.3],
  ['queso-panela', 'Queso panela', 240, 18, 3, 17],
  ['queso-fresco', 'Queso fresco', 299, 18, 3, 24],
  ['queso-oaxaca', 'Queso Oaxaca', 290, 22, 2, 22],
  ['queso-manchego', 'Queso manchego', 350, 24, 2, 28],
  ['queso-cottage', 'Queso cottage', 98, 11, 3.4, 4.3],
  ['requeson', 'Requesón', 174, 11, 3, 13],
  // leguminosas
  ['frijol-cocido', 'Frijoles cocidos', 132, 8.9, 23.7, 0.5],
  ['frijol-refrito', 'Frijoles refritos', 91, 5.4, 15.5, 1.2],
  ['lenteja', 'Lentejas (cocidas)', 116, 9, 20, 0.4],
  ['garbanzo', 'Garbanzos (cocidos)', 164, 8.9, 27.4, 2.6],
  ['hummus', 'Hummus', 166, 7.9, 14.3, 9.6],
  // cereales y tubérculos
  ['arroz-blanco', 'Arroz blanco (cocido)', 130, 2.7, 28, 0.3],
  ['arroz-blanco-crudo', 'Arroz blanco (crudo)', 365, 7.1, 80, 0.7],
  ['arroz-integral', 'Arroz integral (cocido)', 123, 2.7, 25.6, 1],
  ['avena', 'Avena en hojuelas', 379, 13.2, 67.7, 6.5],
  ['pasta-cocida', 'Pasta (cocida)', 158, 5.8, 31, 0.9],
  ['pasta-cruda', 'Pasta (cruda)', 371, 13, 75, 1.5],
  ['quinoa', 'Quinoa (cocida)', 120, 4.4, 21.3, 1.9],
  ['tortilla-maiz', 'Tortilla de maíz', 218, 5.7, 44.6, 2.9, 30],
  ['tortilla-harina', 'Tortilla de harina', 304, 8, 50, 8, 45],
  ['tostada-horneada', 'Tostada horneada', 410, 9, 78, 6, 12],
  ['pan-integral', 'Pan integral', 252, 12.5, 43, 3.5, 28],
  ['pan-blanco', 'Pan blanco de caja', 266, 8.9, 49, 3.3, 25],
  ['bolillo', 'Bolillo', 275, 9, 55, 2, 60],
  ['tortita-arroz', 'Tortitas de arroz inflado', 387, 8, 81, 2.8, 9],
  ['granola', 'Granola', 471, 10, 64, 20],
  ['hojuelas-maiz', 'Hojuelas de maíz (cereal)', 357, 7.5, 84, 0.4],
  ['palomitas', 'Palomitas naturales', 387, 13, 78, 4.5],
  ['elote', 'Elote (granos cocidos)', 96, 3.4, 21, 1.5],
  ['papa', 'Papa (cocida)', 87, 1.9, 20, 0.1],
  ['camote', 'Camote (cocido)', 90, 2, 20.7, 0.2],
  // frutas
  ['platano', 'Plátano', 89, 1.1, 22.8, 0.3, 120],
  ['manzana', 'Manzana', 52, 0.3, 13.8, 0.2, 180],
  ['naranja', 'Naranja', 47, 0.9, 11.8, 0.1, 140],
  ['mandarina', 'Mandarina', 53, 0.8, 13.3, 0.3, 90],
  ['pera', 'Pera', 57, 0.4, 15.2, 0.1, 170],
  ['durazno', 'Durazno', 39, 0.9, 9.5, 0.3, 150],
  ['mango', 'Mango', 60, 0.8, 15, 0.4, 200],
  ['guayaba', 'Guayaba', 68, 2.6, 14.3, 1, 55],
  ['kiwi', 'Kiwi', 61, 1.1, 14.7, 0.5, 75],
  ['fresa', 'Fresas', 32, 0.7, 7.7, 0.3],
  ['arandano', 'Arándanos', 57, 0.7, 14.5, 0.3],
  ['papaya', 'Papaya', 43, 0.5, 10.8, 0.3],
  ['pina', 'Piña', 50, 0.5, 13.1, 0.1],
  ['sandia', 'Sandía', 30, 0.6, 7.6, 0.2],
  ['melon', 'Melón', 34, 0.8, 8.2, 0.2],
  ['uva', 'Uvas', 69, 0.7, 18, 0.2],
  ['aguacate', 'Aguacate', 160, 2, 8.5, 14.7, 140],
  ['datil', 'Dátiles', 282, 2.5, 75, 0.4, 8],
  ['pasas', 'Pasas', 299, 3.1, 79, 0.5],
  ['jugo-naranja', 'Jugo de naranja', 45, 0.7, 10.4, 0.2],
  // verduras
  ['brocoli', 'Brócoli', 34, 2.8, 6.6, 0.4],
  ['coliflor', 'Coliflor', 25, 1.9, 5, 0.3],
  ['espinaca', 'Espinaca', 23, 2.9, 3.6, 0.4],
  ['lechuga', 'Lechuga', 15, 1.4, 2.9, 0.2],
  ['jitomate', 'Jitomate', 18, 0.9, 3.9, 0.2, 120],
  ['pepino', 'Pepino', 16, 0.7, 3.6, 0.1],
  ['zanahoria', 'Zanahoria', 41, 0.9, 9.6, 0.2, 60],
  ['calabacita', 'Calabacita', 17, 1.2, 3.1, 0.3, 150],
  ['chayote', 'Chayote', 19, 0.8, 4.5, 0.1],
  ['nopal', 'Nopales', 16, 1.3, 3.3, 0.1],
  ['cebolla', 'Cebolla', 40, 1.1, 9.3, 0.1],
  ['champinon', 'Champiñones', 22, 3.1, 3.3, 0.3],
  ['pimiento', 'Pimiento morrón', 31, 1, 6, 0.3],
  ['ejote', 'Ejotes', 31, 1.8, 7, 0.2],
  ['jalapeno', 'Chile jalapeño', 29, 0.9, 6.5, 0.4, 14],
  ['verdura-mixta', 'Verduras mixtas congeladas', 64, 2.9, 13, 0.5],
  // grasas, semillas y otros
  ['aceite-oliva', 'Aceite de oliva', 884, 0, 0, 100],
  ['aceite-vegetal', 'Aceite vegetal', 884, 0, 0, 100],
  ['mantequilla', 'Mantequilla', 717, 0.9, 0.1, 81],
  ['crema-cacahuate', 'Crema de cacahuate', 588, 25, 20, 50],
  ['almendra', 'Almendras', 579, 21, 21.6, 49.9],
  ['nuez', 'Nueces', 654, 15.2, 13.7, 65.2],
  ['cacahuate', 'Cacahuates', 567, 25.8, 16.1, 49.2],
  ['pistache', 'Pistaches', 560, 20, 27.2, 45.3],
  ['chia', 'Semillas de chía', 486, 16.5, 42, 30.7],
  ['linaza', 'Linaza', 534, 18.3, 28.9, 42.2],
  ['mayonesa', 'Mayonesa', 680, 1, 0.6, 75],
  ['crema-acida', 'Crema', 198, 2.4, 4.6, 19.4],
  ['chocolate-70', 'Chocolate oscuro 70 %', 598, 7.8, 45.9, 42.6],
  ['miel', 'Miel', 304, 0.3, 82.4, 0],
  ['azucar', 'Azúcar', 387, 0, 100, 0],
  ['mermelada', 'Mermelada', 278, 0.4, 69, 0.1],
  ['refresco-cola', 'Refresco de cola', 42, 0, 10.6, 0],
  ['cafe-negro', 'Café negro', 1, 0.1, 0, 0]
]

export const FOODS = ROWS.map(([id, name, kcal, p, c, f, piece]) => ({ id, name, kcal, p, c, f, ...(piece ? { piece } : {}) }))
const BY_ID = new Map(FOODS.map(f => [f.id, f]))
export const findFood = id => BY_ID.get(id) || null

// Search ignores case and accents: "platano" finds "Plátano".
const fold = s => (s || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()
const FOLDED = FOODS.map(f => [fold(f.name), f])

/** Up to `limit` foods whose name contains every word typed; names that start with it first. */
export function searchFoods(q, limit = 6) {
  const words = fold(q).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const hits = FOLDED.filter(([n]) => words.every(w => n.includes(w)))
  const first = fold(q)
  hits.sort((a, b) => (b[0].startsWith(first) - a[0].startsWith(first)) || a[0].length - b[0].length)
  return hits.slice(0, limit).map(([, f]) => f)
}

export const GRAM_UNITS = ['g', 'gr', 'grs', 'gramo', 'gramos', 'ml', 'mililitro', 'mililitros']
export const PIECE_UNITS = ['pieza', 'piezas', 'pz', 'pza', 'pzas', 'unidad', 'unidades', 'rebanada', 'rebanadas', 'scoop', 'scoops']

/** Grams a quantity stands for, or null when the unit can't be converted for this food. */
export function gramsOf(food, qty, unit) {
  if (!food || typeof qty !== 'number' || !Number.isFinite(qty) || qty < 0) return null
  const u = fold(unit)
  if (GRAM_UNITS.includes(u)) return qty
  if (PIECE_UNITS.includes(u) && food.piece) return qty * food.piece
  return null
}

/** kcal and macros of `qty` `unit` of a catalog food, or null when it can't be worked out. */
export function macrosFor(id, qty, unit) {
  const food = findFood(id)
  const g = gramsOf(food, qty, unit)
  if (g == null) return null
  const k = g / 100
  return { kcal: food.kcal * k, p: food.p * k, c: food.c * k, f: food.f * k }
}

/** What the editor puts in a row when a food is picked: a piece for foods counted in pieces, else 100 g. */
export const defaultPortion = food => (food.piece ? { qty: '1', unit: 'pieza' } : { qty: '100', unit: 'g' })
