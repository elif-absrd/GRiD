import express, { Router, Request, Response } from 'express';
import { User } from '../models';
import { Op } from 'sequelize';

const router: Router = express.Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    // Find all non-admin users
    const users = await User.findAll({
      where: {
        admin: {
          [Op.ne]: true
        }
      },
      attributes: ['uid', 'email', 'points', 'tokens']
    });
    
    // Format and sort by points
    const leaderboardData = users.map((user) => ({
      uid: user.uid,
      email: user.email || 'Unknown',
      points: user.points || 0,
      tokens: user.tokens || 0,
    })).sort((a, b) => b.points - a.points);
    
    console.log('Leaderboard users fetched (excluding admins):', leaderboardData);
    res.json(leaderboardData);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

export default router;
