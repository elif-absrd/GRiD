import express, { Router, Request, Response } from 'express';
import User from '../models/User';

const router: Router = express.Router();

// Fetch leaderboard (excluding admins)
router.get('/', async (req: Request, res: Response) => {
  try {
    const users = await User.find({ admin: { $ne: true } }).sort({ points: -1 }); // Exclude admins
    console.log('Leaderboard users fetched (excluding admins):', users);
    res.json(users);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

export default router;