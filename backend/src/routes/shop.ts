import express, { Router, Response } from 'express';
import ShopItem from '../models/ShopItem';
import { AuthenticatedRequest } from '../types';

const router: Router = express.Router();

// Fetch all shop items
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.uid;
    const shopItems = await ShopItem.find();
    console.log(`User ${userId} fetched shop items:`, shopItems);
    res.json(shopItems);
  } catch (error) {
    console.error('Error fetching shop items:', error);
    res.status(500).json({ error: 'Failed to fetch shop items' });
  }
});

export default router;