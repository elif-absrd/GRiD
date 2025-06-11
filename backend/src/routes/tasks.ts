import express, { Request, Response } from 'express';
import Task from '../models/Task';
import Submission from '../models/Submission';
import User from '../models/User';

// Extend the Request type to include the user property (added by your middleware)
interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    admin?: boolean;
  };
}

const router = express.Router();

// Create task (Admin only)
router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user?.admin) {
    res.status(403).json({ error: 'Admin only' });
    return;
  }

  const task = new Task({
    title: req.body.title,
    description: req.body.description,
    points: req.body.points,
    createdBy: req.user.uid,
  });

  await task.save();
  res.json(task);
});

// Get all tasks
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const tasks = await Task.find();
  res.json(tasks);
});

// Submit task completion
router.post('/:id/submit', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const submission = new Submission({
    taskId: req.params.id,
    userId: req.user?.uid,
  });

  await submission.save();
  res.json(submission);
});

// Approve submission (Admin only)
router.post('/:id/approve', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user?.admin) {
    res.status(403).json({ error: 'Admin only' });
    return;
  }

  const submission = await Submission.findById(req.params.id);
  if (!submission) {
    res.status(404).json({ error: 'Submission not found' });
    return;
  }

  submission.status = 'approved';
  await submission.save();

  const task = await Task.findById(submission.taskId);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  await User.updateOne(
    { uid: submission.userId },
    { $inc: { points: task.points, tokens: task.points } }
  );

  const updatedUser = await User.updateOne(
  { uid: submission.userId },
  { $inc: { points: task.points, tokens: task.points } }
);
console.log(`Updated user ${submission.userId}: added ${task.points} points and tokens`);

  res.json(submission);
});

// Get pending submissions (Admin only)
router.get('/submissions/pending', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user?.admin) {
    res.status(403).json({ error: 'Admin only' });
    return;
  }
  const submissions = await Submission.find({ status: 'pending' });
  res.json(submissions);
});

export default router;