import mongoose from 'mongoose';
import ShopItem from './models/ShopItem';
import dotenv from 'dotenv';

dotenv.config({ path: '../.env'});

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error('MONGODB_URI is not defined in the .env file');
}

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    const shopItems = [
      { name: 'Reward 1', description: 'A cool reward', cost: 10, googleFormLink: 'https://forms.gle/yL5TgcVEwu2rezTs7' },
      { name: 'Reward 2', description: 'An awesome reward', cost: 20, googleFormLink: 'https://forms.gle/yL5TgcVEwu2rezTs7' },
      { name: 'Reward 3', description: 'A premium reward', cost: 50 },
    ];

    await ShopItem.deleteMany({}); // Clear existing items (optional)
    await ShopItem.insertMany(shopItems);
    console.log('Shop items added successfully');

    mongoose.connection.close();
  })
  .catch((err) => {
    console.error('Error:', err);
    mongoose.connection.close();
  });