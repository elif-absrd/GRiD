import express, { Request, Response } from 'express';
import ShopItem from '../models/ShopItem';
import User from '../models/User';

// Define an interface for the request with the user property
interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    admin?: boolean;
  };
}

const router = express.Router();

// Redeem shop item
router.post('/redeem', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { itemId } = req.body;
  const user = await User.findOne({ uid: req.user?.uid });
  const item = await ShopItem.findById(itemId);

  if (!user || !item) {
    res.status(404).json({ error: 'User or item not found' });
    return;
  }
  if (user.tokens < item.tokenCost) {
    res.status(400).json({ error: 'Insufficient tokens' });
    return;
  }

  user.tokens -= item.tokenCost;
  await user.save();
  res.json({ message: 'Item redeemed successfully' });
});

// Get shop items
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const items = await ShopItem.find();
  res.json(items);
});

export default router;