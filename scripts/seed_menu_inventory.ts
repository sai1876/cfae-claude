import * as admin from 'firebase-admin';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

  if (!projectId || !clientEmail || !privateKey) {
    console.error("Missing Firebase Admin credentials in environment variables");
    process.exit(1);
  }
  
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      })
    });
  } catch (err) {
    console.error("Failed to initialize Firebase Admin", err);
    process.exit(1);
  }
}

const db = admin.firestore();

const seedData = [
  {
    menu: {
      item_id: 'menu_biryani_1',
      name: 'Hyderabadi Chicken Biryani',
      description: 'Authentic dum biryani cooked with fragrant basmati rice and tender chicken.',
      price: 150,
      category: 'Biryani',
      station: 'BIRYANI',
      is_available: true,
      is_featured: true,
      sort_order: 1,
      available_outlets: ['oasis', 'canopy'],
    },
    inventory: {
      stock_id: 'stock_biryani_1',
      name: 'Hyderabadi Chicken Biryani (Portions)',
      current_quantity: 50,
      unit: 'portions',
      low_threshold: 10,
      tracking_type: 'bulk'
    }
  },
  {
    menu: {
      item_id: 'menu_momo_1',
      name: 'Steamed Chicken Momos',
      description: 'Classic Tibetan style steamed dumplings filled with juicy minced chicken.',
      price: 80,
      category: 'Momos',
      station: 'GRILLED OR STEAMED',
      is_available: true,
      is_featured: false,
      sort_order: 2,
      available_outlets: ['oasis', 'canopy'],
    },
    inventory: {
      stock_id: 'stock_momo_1',
      name: 'Steamed Chicken Momos (Plates)',
      current_quantity: 100,
      unit: 'plates',
      low_threshold: 15,
      tracking_type: 'pack',
      pieces_per_pack: 1
    }
  },
  {
    menu: {
      item_id: 'menu_burger_1',
      name: 'Classic Chicken Burger',
      description: 'Crispy fried chicken patty with fresh lettuce and mayo in a toasted bun.',
      price: 120,
      category: 'Burgers',
      station: 'FASTFOOD',
      is_available: true,
      is_featured: true,
      sort_order: 3,
      available_outlets: ['oasis', 'canopy'],
    },
    inventory: {
      stock_id: 'stock_burger_1',
      name: 'Chicken Burger Buns & Patties',
      current_quantity: 30,
      unit: 'portions',
      low_threshold: 10,
      tracking_type: 'bulk'
    }
  },
  {
    menu: {
      item_id: 'menu_waffle_1',
      name: 'Belgian Chocolate Waffle',
      description: 'Warm and crispy waffle drizzled with rich dark Belgian chocolate.',
      price: 100,
      category: 'Waffles',
      station: 'FASTFOOD',
      is_available: true,
      is_featured: false,
      sort_order: 4,
      available_outlets: ['oasis', 'canopy'],
    },
    inventory: {
      stock_id: 'stock_waffle_1',
      name: 'Waffle Batter (Portions)',
      current_quantity: 40,
      unit: 'portions',
      low_threshold: 10,
      tracking_type: 'bulk'
    }
  },
  {
    menu: {
      item_id: 'menu_snack_1',
      name: 'Crispy French Fries',
      description: 'Golden, crispy, and perfectly salted french fries.',
      price: 60,
      category: 'Snacks',
      station: 'FRYER',
      is_available: true,
      is_featured: false,
      sort_order: 5,
      available_outlets: ['oasis', 'canopy'],
    },
    inventory: {
      stock_id: 'stock_snack_1',
      name: 'Frozen Fries (Servings)',
      current_quantity: 80,
      unit: 'servings',
      low_threshold: 20,
      tracking_type: 'bulk'
    }
  },
  {
    menu: {
      item_id: 'menu_bev_1',
      name: 'Classic Cold Coffee',
      description: 'Thick and creamy blended iced coffee.',
      price: 70,
      category: 'Beverages',
      station: 'BREWER',
      is_available: true,
      is_featured: true,
      sort_order: 6,
      available_outlets: ['oasis', 'canopy'],
    },
    inventory: {
      stock_id: 'stock_bev_1',
      name: 'Cold Coffee (Cups)',
      current_quantity: 60,
      unit: 'cups',
      low_threshold: 15,
      tracking_type: 'bulk'
    }
  }
];

async function seed() {
  console.log("Starting DB seeding...");
  
  const batch = db.batch();
  
  for (const item of seedData) {
    // Reference documents
    const menuRef = db.collection('menu').doc(item.menu.item_id);
    const inventoryRef = db.collection('inventory').doc(item.inventory.stock_id);

    // Prepare recipe linkage inside the menu item
    const menuItemData = {
      ...item.menu,
      recipe: [
        {
          stock_id: item.inventory.stock_id,
          name: item.inventory.name,
          quantity: 1,
          unit: item.inventory.unit
        }
      ]
    };

    // Prepare inventory data linked to menu
    const inventoryData = {
      ...item.inventory,
      menu_item_id: item.menu.item_id,
      outlet_id: 'oasis', // Seed into oasis outlet by default
      last_updated: Date.now(),
      updated_by: 'system_seeder',
    };

    batch.set(menuRef, menuItemData, { merge: true });
    batch.set(inventoryRef, inventoryData, { merge: true });
  }

  try {
    await batch.commit();
    console.log("Successfully seeded menu and inventory items!");
  } catch (error) {
    console.error("Failed to seed database:", error);
  }
}

seed().then(() => process.exit(0)).catch(() => process.exit(1));
