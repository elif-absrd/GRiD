import dotenv from 'dotenv';
import { ShopItem, syncDatabase } from './models';

dotenv.config({ path: '../.env'});

async function seedShop() {
  try {
    // Make sure we're connected to the database
    await syncDatabase();
    console.log('Connected to PostgreSQL');

    const shopItems = [
      { name: 'Reward 1', description: 'A cool reward', cost: 10, googleFormLink: 'https://forms.gle/yL5TgcVEwu2rezTs7' },
      { name: 'Reward 2', description: 'An awesome reward', cost: 20, googleFormLink: 'https://forms.gle/yL5TgcVEwu2rezTs7' },
      { name: 'Reward 3', description: 'A premium reward', cost: 50 },
    ];

    // Clear existing items
    await ShopItem.destroy({ where: {} });
    console.log('Cleared existing shop items');
    
    // Add new items
    await ShopItem.bulkCreate(shopItems);
    console.log('Shop items added successfully');

    // Exit the process after seeding
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

seedShop();
