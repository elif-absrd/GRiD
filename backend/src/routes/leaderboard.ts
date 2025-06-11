import express, { Request, Response } from 'express';
import User from '../models/User';

// Define an interface for the request with the user property
interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    admin?: boolean;
  };
}

const router = express.Router();

// Get leaderboard
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const users = await User.find({}, 'uid email points tokens').sort({ points: -1 }); // Include email
  res.json(users);
});

export default router;