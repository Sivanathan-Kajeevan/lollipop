import { db } from './db';

export const DEFAULT_LOGO_URL = '/assets/aistudio/image_0b3be71d.png';
export const ACTIVE_SCOPE = 'prod' as const;

interface SeedCategory {
  name: string;
  displayOrder: number;
  isVisible: number;
}

interface SeedFood {
  categoryName: string;
  name: string;
  description: string;
  priceLkr: number;
  imageUrl: string;
  isAvailable: number;
  isVegetarian: number;
  isSpicy: number;
  isSpecial: number;
  displayOrder: number;
}

const INITIAL_CATEGORIES: SeedCategory[] = [
  { name: 'Breakfast', displayOrder: 1, isVisible: 1 },
  { name: 'Lunch', displayOrder: 2, isVisible: 1 },
  { name: 'Dinner', displayOrder: 3, isVisible: 1 },
  { name: 'Special', displayOrder: 4, isVisible: 1 },
];

const INITIAL_FOODS: SeedFood[] = [
  // Breakfast
  {
    categoryName: 'Breakfast',
    name: 'Egg Hoppers',
    description:
      'Crisp fermented rice-flour bowl hoppers with a soft-set egg centre, served with fiery onion and chilli lunu miris.',
    priceLkr: 180,
    imageUrl: '/seed-images/food_egg_hoppers_1794642009867.jpg',
    isAvailable: 1,
    isVegetarian: 0,
    isSpicy: 0,
    isSpecial: 0,
    displayOrder: 1,
  },
  {
    categoryName: 'Breakfast',
    name: 'String Hoppers with Curry',
    description:
      'Steamed red and white rice-flour idiyappam nests paired with creamy turmeric coconut gravy and fresh coconut sambol.',
    priceLkr: 450,
    imageUrl: '/seed-images/food_string_hoppers_1794642010108.jpg',
    isAvailable: 1,
    isVegetarian: 1,
    isSpicy: 0,
    isSpecial: 0,
    displayOrder: 2,
  },
  {
    categoryName: 'Breakfast',
    name: 'Milk Rice with Lunu Miris',
    description:
      'Traditional coconut-simmered kiribath wedges served alongside stone-ground red chilli and onion sambol.',
    priceLkr: 350,
    imageUrl: '/seed-images/food_milk_rice_1794642011124.jpg',
    isAvailable: 1,
    isVegetarian: 1,
    isSpicy: 1,
    isSpecial: 0,
    displayOrder: 3,
  },
  {
    categoryName: 'Breakfast',
    name: 'Pol Roti with Dhal',
    description:
      'Griddle-toasted grated coconut flatbreads served warm with mustard-tempered yellow lentil parippu curry.',
    priceLkr: 300,
    imageUrl: '/seed-images/food_pol_roti_1794642011787.jpg',
    isAvailable: 1,
    isVegetarian: 1,
    isSpicy: 0,
    isSpecial: 0,
    displayOrder: 4,
  },

  // Lunch
  {
    categoryName: 'Lunch',
    name: 'Chicken Rice and Curry',
    description:
      'Steamed basmati rice served with slow-roasted Sri Lankan black-spiced chicken curry, dhal, fresh greens mallum, and crisp papadam.',
    priceLkr: 850,
    imageUrl: '/seed-images/food_chicken_curry_1794642011577.jpg',
    isAvailable: 1,
    isVegetarian: 0,
    isSpicy: 1,
    isSpecial: 0,
    displayOrder: 1,
  },
  {
    categoryName: 'Lunch',
    name: 'Vegetable Rice and Curry',
    description:
      'Wholesome steamed rice accompanied by beetroot curry, tempered green beans, okra, yellow dhal, and crispy papadam.',
    priceLkr: 550,
    imageUrl: '/seed-images/food_veg_curry_1794642013236.jpg',
    isAvailable: 1,
    isVegetarian: 1,
    isSpicy: 0,
    isSpecial: 0,
    displayOrder: 2,
  },
  {
    categoryName: 'Lunch',
    name: 'Chicken Fried Rice',
    description:
      'Wok-tossed basmati fried rice with tender spiced chicken strips, egg, spring onions, and house-made chilli paste.',
    priceLkr: 950,
    imageUrl: '/seed-images/food_chicken_fried_rice_1794642012516.jpg',
    isAvailable: 1,
    isVegetarian: 0,
    isSpicy: 0,
    isSpecial: 0,
    displayOrder: 3,
  },
  {
    categoryName: 'Lunch',
    name: 'Fish Rice and Curry',
    description:
      'Fluffy steamed rice plated with aromatic Sri Lankan spiced tuna curry, creamy lentil dhal, and fresh cucumber salad.',
    priceLkr: 800,
    imageUrl: '/seed-images/food_fish_curry_1794642013012.jpg',
    isAvailable: 1,
    isVegetarian: 0,
    isSpicy: 1,
    isSpecial: 0,
    displayOrder: 4,
  },

  // Dinner
  {
    categoryName: 'Dinner',
    name: 'Chicken Kottu',
    description:
      'Chopped flaky godamba roti rhythmically tossed on a hot iron griddle with shredded spiced chicken, egg, leeks, and curry gravy.',
    priceLkr: 1000,
    imageUrl: '/seed-images/food_chicken_kottu_1794642013164.jpg',
    isAvailable: 1,
    isVegetarian: 0,
    isSpicy: 1,
    isSpecial: 0,
    displayOrder: 1,
  },
  {
    categoryName: 'Dinner',
    name: 'Cheese Kottu',
    description:
      'Griddle-chopped godamba roti folded with spiced chicken, egg, crisp vegetables, and a generous velvety cheddar cheese sauce.',
    priceLkr: 1250,
    imageUrl: '/seed-images/food_cheese_kottu_1794642014145.jpg',
    isAvailable: 1,
    isVegetarian: 0,
    isSpicy: 0,
    isSpecial: 0,
    displayOrder: 2,
  },
  {
    categoryName: 'Dinner',
    name: 'Egg Fried Rice',
    description:
      'Fragrant wok-fried basmati rice tossed with golden scrambled egg ribbons, carrots, green leeks, and mild soy seasoning.',
    priceLkr: 750,
    imageUrl: '/seed-images/food_egg_fried_rice_1794642013877.jpg',
    isAvailable: 1,
    isVegetarian: 0,
    isSpicy: 0,
    isSpecial: 0,
    displayOrder: 3,
  },
  {
    categoryName: 'Dinner',
    name: 'Vegetable Noodles',
    description:
      'Eggless stir-fried noodles tossed over high heat with julienned carrots, cabbage, bell peppers, and spring onions.',
    priceLkr: 650,
    imageUrl: '/seed-images/food_veg_noodles_1794642015172.jpg',
    isAvailable: 1,
    isVegetarian: 1,
    isSpicy: 0,
    isSpecial: 0,
    displayOrder: 4,
  },

  // Special
  {
    categoryName: 'Special',
    name: 'Lollipop Special Chicken Biryani',
    description:
      'Aromatic saffron-layered basmati biryani crowned with spiced roast chicken, golden cashews, plump sultanas, boiled egg, and cucumber raita.',
    priceLkr: 1400,
    imageUrl: '/seed-images/food_chicken_biryani_1794642014837.jpg',
    isAvailable: 1,
    isVegetarian: 0,
    isSpicy: 1,
    isSpecial: 1,
    displayOrder: 1,
  },
  {
    categoryName: 'Special',
    name: 'Seafood Fried Rice',
    description:
      'High-flame wok-fried basmati rice loaded with grilled prawns, tender calamari rings, crispy garlic flakes, and spring onions.',
    priceLkr: 1500,
    imageUrl: '/seed-images/food_seafood_fried_rice_1794642016694.jpg',
    isAvailable: 1,
    isVegetarian: 0,
    isSpicy: 0,
    isSpecial: 1,
    displayOrder: 2,
  },
  {
    categoryName: 'Special',
    name: 'Grilled Chicken with Rice',
    description:
      'Char-grilled herb and Sri Lankan black-pepper chicken quarter served over buttered yellow rice with charred vegetables and pepper jus.',
    priceLkr: 1650,
    imageUrl: '/seed-images/food_grilled_chicken_rice_1794642015778.jpg',
    isAvailable: 1,
    isVegetarian: 0,
    isSpicy: 0,
    isSpecial: 1,
    displayOrder: 3,
  },
  {
    categoryName: 'Special',
    name: 'Family Kottu Platter',
    description:
      'Generous sharing platter of sizzling chicken and cheese kottu topped with roast chicken pieces, served with rich curry gravy and chilli sambol.',
    priceLkr: 2800,
    imageUrl: '/seed-images/food_kottu_platter_1794642019194.jpg',
    isAvailable: 1,
    isVegetarian: 0,
    isSpicy: 1,
    isSpecial: 1,
    displayOrder: 4,
  },
];

export function ensureInitialData(): void {
  const seed = db.transaction(() => {
    const existingSettings = db
      .prepare('SELECT scope FROM restaurant_settings WHERE scope = ?')
      .get(ACTIVE_SCOPE);

    if (!existingSettings) {
      db.prepare(`
        INSERT INTO restaurant_settings (
          scope, restaurant_name, logo_url, logo_includes_name, welcome_message, whatsapp_number, address, opening_hours, public_menu_url,
          provider_name, provider_logo_url, provider_contact, provider_website
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        ACTIVE_SCOPE,
        'Lollipop',
        DEFAULT_LOGO_URL,
        1,
        'Fresh flavours. Happy moments.',
        '0728044969',
        '',
        '',
        '',
        'Shop Grow Media',
        '',
        '',
        ''
      );
    }

    const categoryRows = db
      .prepare('SELECT id, name FROM categories WHERE scope = ?')
      .all(ACTIVE_SCOPE) as Array<{ id: number; name: string }>;

    const categoryIds = new Map<string, number>(
      categoryRows.map((c) => [c.name, Number(c.id)])
    );

    const insertCat = db.prepare(`
      INSERT INTO categories (scope, name, display_order, is_visible)
      VALUES (?, ?, ?, ?)
    `);

    if (categoryIds.size === 0) {
      for (const cat of INITIAL_CATEGORIES) {
        const res = insertCat.run(
          ACTIVE_SCOPE,
          cat.name,
          cat.displayOrder,
          cat.isVisible
        );
        categoryIds.set(cat.name, Number(res.lastInsertRowid));
      }
    }

    const foodCountRow = db
      .prepare('SELECT COUNT(*) AS cnt FROM foods WHERE scope = ?')
      .get(ACTIVE_SCOPE) as { cnt: number };

    if (Number(foodCountRow?.cnt ?? 0) === 0) {
      const insertFood = db.prepare(`
        INSERT INTO foods (
          scope, category_id, name, description, price_lkr, image_url,
          is_available, is_vegetarian, is_spicy, is_special, display_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const food of INITIAL_FOODS) {
        let catId = categoryIds.get(food.categoryName);
        if (!catId) {
          const catSeed = INITIAL_CATEGORIES.find(
            (c) => c.name === food.categoryName
          );
          const res = insertCat.run(
            ACTIVE_SCOPE,
            food.categoryName,
            catSeed?.displayOrder ?? categoryIds.size + 1,
            1
          );
          catId = Number(res.lastInsertRowid);
          categoryIds.set(food.categoryName, catId);
        }
        insertFood.run(
          ACTIVE_SCOPE,
          catId,
          food.name,
          food.description,
          food.priceLkr,
          food.imageUrl,
          food.isAvailable,
          food.isVegetarian,
          food.isSpicy,
          food.isSpecial,
          food.displayOrder
        );
      }
    }
  });

  seed();
}
