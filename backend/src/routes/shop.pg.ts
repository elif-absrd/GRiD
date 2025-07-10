import express, { Router, Response } from 'express';
import { ShopItem, User } from '../models';
import { AuthenticatedRequest } from '../types';

const router: Router = express.Router();

// Fetch all shop items
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.uid;
    const shopItems = await ShopItem.findAll();
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
    const shopItem = await ShopItem.create({
      name,
      description,
      cost: Number(cost),
      googleFormLink: googleFormLink || '',
    });
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

    const shopItem = await ShopItem.findByPk(itemId);
    if (!shopItem) {
      res.status(404).json({ error: 'Shop item not found' });
      return;
    }
    
    let user = await User.findOne({ where: { uid: req.user.uid } });
    if (!user) {
      console.log(`POST /api/shop/redeem - User ${req.user.uid} not found, creating new user`);
      user = await User.create({ 
        uid: req.user.uid, 
        tokens: 0,
        points: 0,
        admin: false
      });
    }
    
    console.log(`POST /api/shop/redeem - User ${req.user.uid} initial tokens from DB: ${user.tokens}`);
    
    // Force refresh to ensure latest data
    await user.reload();
    console.log(`POST /api/shop/redeem - User ${req.user.uid} refreshed tokens: ${user.tokens}, cost = ${shopItem.cost}`);
    
    if (user.tokens < shopItem.cost) {
      console.log(`POST /api/shop/redeem - Insufficient tokens for ${req.user.uid}`);
      res.status(400).json({ error: 'Insufficient tokens' });
      return;
    }
    
    // Return shop item with modified fields to match frontend expectations
    res.json({
      googleFormLink: shopItem.googleFormLink || '',
      _id: shopItem.id,
      name: shopItem.name,
      description: shopItem.description,
      tokenCost: shopItem.cost // Map cost to tokenCost for frontend
    });
  } catch (error) {
    console.error('Error redeeming shop item:', error);
    res.status(500).json({ error: 'Failed to redeem shop item' });
  }
});

router.post('/redeem/confirm', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Allow both users and admins to confirm redemption
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const { itemId, userId } = req.body;
    
    // Make sure we have required fields
    if (!itemId || !userId) {
      res.status(400).json({ error: 'Item ID and User ID are required' });
      return;
    }
    
    const user = await User.findOne({ where: { uid: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    const shopItem = await ShopItem.findByPk(itemId);
    if (!shopItem) {
      res.status(404).json({ error: 'Shop item not found' });
      return;
    }
    
    if (user.tokens < shopItem.cost) {
      res.status(400).json({ error: 'Insufficient tokens' });
      return;
    }
    
    // Check if user is allowed to confirm
    if (!req.user.admin && req.user.uid !== userId) {
      res.status(403).json({ error: 'You can only confirm your own redemptions' });
      return;
    }
    
    // Deduct tokens
    const newBalance = user.tokens - shopItem.cost;
    await user.update({
      tokens: newBalance
    });
    
    console.log(`User ${userId} confirmed redemption for ${shopItem.name} for ${shopItem.cost} tokens`);
    
    // Return remaining tokens for frontend update
    res.json({ 
      success: true,
      remainingTokens: newBalance 
    });
  } catch (error) {
    console.error('Error confirming redemption:', error);
    res.status(500).json({ error: 'Failed to confirm redemption' });
  }
});

// Add cancel redemption endpoint
router.post('/redeem/cancel', async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    const { itemId, userId } = req.body;
    
    if (!itemId || !userId) {
      res.status(400).json({ error: 'Item ID and User ID are required' });
      return;
    }
    
    // Verify user exists
    const user = await User.findOne({ where: { uid: userId } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    
    // Check if user is allowed to cancel
    if (!req.user.admin && req.user.uid !== userId) {
      res.status(403).json({ error: 'You can only cancel your own redemptions' });
      return;
    }
    
    console.log(`User ${userId} canceled redemption for item ${itemId}`);
    
    // No tokens were deducted during redeem, so no update needed
    res.json({ 
      success: true,
      message: 'Redemption canceled successfully'
    });
  } catch (error) {
    console.error('Error canceling redemption:', error);
    res.status(500).json({ error: 'Failed to cancel redemption' });
  }
});

export default router;
