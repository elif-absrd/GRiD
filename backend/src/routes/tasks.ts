import express, { Request, Response } from 'express';
import Task from '../models/Task';
import Submission from '../models/Submission';
import User from '../models/User';

// Define an interface for the request with the user property
interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    admin?: boolean;
  };
}

const router = express.Router();

// Get all tasks (exclude tasks the user has already submitted)
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // If the user is an admin, return all tasks (admins don't submit tasks)
    if (req.user?.admin) {
      const tasks = await Task.find();
      res.json(tasks);
      return;
    }

    // For regular users, exclude tasks they have already submitted
    const userId = req.user?.uid;
    const submissions = await Submission.find({ userId }).select('taskId');
    const submittedTaskIds = submissions.map((submission) => submission.taskId.toString());

    // Find tasks that the user has not submitted
    const tasks = await Task.find({ _id: { $nin: submittedTaskIds } });
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

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

// Submit task completion
router.post('/:id/submit', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (req.user?.admin) {
    res.status(403).json({ error: 'Admins cannot submit tasks' });
    return;
  }

  const task = await Task.findById(req.params.id);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  try {
    const submission = new Submission({
      taskId: req.params.id,
      userId: req.user?.uid,
      status: 'pending',
    });

    await submission.save();
    res.json(submission);
  } catch (error: any) {
    if (error.code === 11000) { // MongoDB duplicate key error
      res.status(400).json({ error: 'You have already submitted this task.' });
      return;
    }
    console.error('Error submitting task:', error);
    res.status(500).json({ error: 'Failed to submit task' });
  }
});

// Get pending submissions (Admin only)
router.get('/submissions/pending', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user?.admin) {
    res.status(403).json({ error: 'Admin only' });
    return;
  }

  const submissions = await Submission.find({ status: 'pending' })
    .populate('taskId', 'title')
    .populate('userId', 'name');
  res.json(submissions);
});

// Get approved submissions for the current user
router.get('/submissions/approved', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (req.user?.admin) {
    res.status(403).json({ error: 'Admins do not have submissions' });
    return;
  }

  try {
    const submissions = await Submission.find({
      userId: req.user?.uid,
      status: 'approved',
    }).populate('taskId', 'title description points');
    console.log('Sending approved submissions:', JSON.stringify(submissions, null, 2));
    res.json(submissions);
  } catch (error) {
    console.error('Error fetching approved submissions:', error);
    res.status(500).json({ error: 'Failed to fetch approved submissions' });
  }
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

  const updatedUser = await User.updateOne(
    { uid: submission.userId },
    { $inc: { points: task.points, tokens: task.points } }
  );
  console.log(`Updated user ${submission.userId}: added ${task.points} points and tokens`);

  res.json(submission);
});

export default router;