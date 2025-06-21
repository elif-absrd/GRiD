import mongoose from 'mongoose';
import ShopItem from './models/ShopItem';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/taskApp';

mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');

    const shopItems = [
      { name: 'Reward 1', description: 'A cool reward', tokenCost: 10 },
      { name: 'Reward 2', description: 'An awesome reward', tokenCost: 20 },
      { name: 'Reward 3', description: 'A premium reward', tokenCost: 50 },
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