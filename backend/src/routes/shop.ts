import express, { Router, Response } from 'express';
import ShopItem from '../models/ShopItem';
import User from '../models/User';
import { AuthenticatedRequest } from '../types';

const router: Router = express.Router();

// Fetch all shop items
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.uid;
    const shopItems = await ShopItem.find();
    console.log(`User ${userId} fetched shop items:`, shopItems.length, shopItems);
    res.json(shopItems);
  } catch (error) {
    console.error('Error fetching shop items:', error);
    res.status(500).json({ error: 'Failed to fetch shop items' });
  }
});

router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user?.admin) {
      res.status(403).json({ error: 'Forbidden: Admin access required' });
      return;
    }
    const { name, description, cost, googleFormLink } = req.body;
    if (!name || !description || !cost) {
      res.status(400).json({ error: 'Name, description, and cost are required' });
      return;
    }
    const shopItem = new ShopItem({
      name,
      description,
      cost: Number(cost),
      googleFormLink: googleFormLink || '', 
    });
    await shopItem.save();
    console.log(`Admin ${req.user.uid} added shop item:`, shopItem);
    res.status(201).json(shopItem);
  } catch (error) {
    console.error('Error adding shop item:', error);
    res.status(500).json({ error: 'Failed to add shop item' });
  }
});

router.post('/redeem', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { itemId } = req.body;
    if (!itemId) {
        console.log('POST /api/shop/redeem - Missing itemId');
        res.status(400).json({ error: 'Missing itemId' });
        return;
      }
    const shopItem = await ShopItem.findById(itemId).lean();
    if (!shopItem) {
      res.status(404).json({ error: 'Shop item not found' });
      return;
    }
    let user = await User.findOne({ uid: req.user.uid });
    if (!user) {
        console.log(`POST /api/shop/redeem - User ${req.user.uid} not found, creating new user`);
        user = new User({ uid: req.user.uid, tokens: 0 });
        await user.save();
      }
      console.log(`POST /api/shop/redeem - User ${req.user.uid} initial tokens from DB: ${user.tokens}`);
      // Force refresh to ensure latest data
      user = await User.findOne({ uid: req.user.uid }).exec();
      if (!user) {
        console.log(`POST /api/shop/redeem - User ${req.user.uid} not found after refresh`);
        res.status(404).json({ error: 'User not found' });
        return;
      }
      console.log(`POST /api/shop/redeem - User ${req.user.uid} refreshed tokens: ${user.tokens}, cost = ${shopItem.cost}`);
      if (user.tokens < shopItem.cost) {
        console.log(`POST /api/shop/redeem - Insufficient tokens for ${req.user.uid}`);
        res.status(400).json({ error: 'Insufficient tokens' });
        return;
      }

    // DEDUCT THE TOKENS HERE - this was missing!
    const newTokenBalance = Math.max(0, user.tokens - shopItem.cost);
    user.tokens = newTokenBalance;
    await user.save();

    console.log(`User ${req.user.uid} redeemed ${shopItem.name}, remaining tokens: ${newTokenBalance}`);
    res.json({  
      googleFormLink: shopItem.googleFormLink || '',
      remainingTokens: newTokenBalance, // Return the new balance
    });
  } catch (error) {
    console.error('Error redeeming shop item:', error);
    res.status(500).json({ error: 'Failed to redeem shop item' });
  }
});

router.post('/redeem/confirm', async (req, res) => {
  try {
    const { itemId, userId } = req.body; // Sent from Google Form callback or manual confirmation
    const user = await User.findOne({ uid: userId });
    if (!user) throw new Error('User not found');
    const shopItem = await ShopItem.findById(itemId);
    if (!shopItem) throw new Error('Service not found');
    
    // Check if user has enough tokens and prevent negative balance
    if (user.tokens >= shopItem.cost) {
      const newTokenBalance = Math.max(0, user.tokens - shopItem.cost);
      user.tokens = newTokenBalance;
      await user.save();
      res.json({ success: true, remainingTokens: newTokenBalance });
    } else {
      res.status(400).json({ error: 'Insufficient tokens' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to confirm redemption' });
  }
});

export default router;