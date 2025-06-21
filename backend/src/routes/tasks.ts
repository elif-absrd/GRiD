import express, { Request, Response } from 'express';
import Task from '../models/Task';
import Submission from '../models/Submission';
import User from '../models/User';
import { Types } from 'mongoose';

interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    admin?: boolean;
  };
}

const router = express.Router();

router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.admin) {
      const tasks = await Task.find().sort({ createdAt: -1 });
      res.json(tasks);
      return;
    }

    const userId = req.user?.uid;
    const submissions = await Submission.find({ userId }).select('taskId');
    const submittedTaskIds = submissions.map((submission) => submission.taskId.toString());
    const tasks = await Task.find({ _id: { $nin: submittedTaskIds } }).sort({ createdAt: -1 });
    console.log(`User ${userId} fetched tasks:`, tasks);
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

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
  console.log('Task created:', task);
  res.json(task);
});

router.delete('/all', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user?.admin) {
    res.status(403).json({ error: 'Admin only' });
    return;
  }

  try {
    const deleteResult = await Task.deleteMany({});
    console.log(`Deleted ${deleteResult.deletedCount} tasks`);

    const submissionsDeleteResult = await Submission.deleteMany({});
    console.log(`Deleted ${submissionsDeleteResult.deletedCount} submissions`);

    const userUpdateResult = await User.updateMany({}, { $set: { points: 0, tokens: 0 } });
    console.log(`Reset points and tokens for ${userUpdateResult.modifiedCount} users`);

    res.json({ message: `Successfully deleted ${deleteResult.deletedCount} tasks and reset user points` });
  } catch (error) {
    console.error('Error deleting tasks:', error);
    res.status(500).json({ error: 'Failed to delete tasks' });
  }
});

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
      taskId: new Types.ObjectId(req.params.id),
      userId: req.user?.uid,
      status: 'pending',
    });

    await submission.save();
    // Fetch user details to include in response
    const user = await User.findOne({ uid: req.user?.uid }).select('name email uid');
    const submissionWithUser = {
      ...submission.toObject(),
      userId: user || { _id: req.user?.uid, name: 'Unknown', email: 'Unknown', uid: req.user?.uid },
    };
    console.log(`User ${req.user?.uid} submitted task ${req.params.id}:`, submissionWithUser);
    res.json(submissionWithUser);
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(400).json({ error: 'You have already submitted this task.' });
      return;
    }
    console.error('Error submitting task:', error);
    res.status(500).json({ error: 'Failed to submit task' });
  }
});

router.get('/submissions/pending', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user?.admin) {
    res.status(403).json({ error: 'Admin only' });
    return;
  }

  try {
    const submissions = await Submission.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .populate('taskId', 'title')
      .populate('userId', 'name email uid');
    console.log('Fetched pending submissions with user details:', submissions);
    res.json(submissions);
  } catch (error) {
    console.error('Error fetching pending submissions:', error);
    res.status(500).json({ error: 'Failed to fetch pending submissions' });
  }
});

router.get('/submissions/approved', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (req.user?.admin) {
    res.status(403).json({ error: 'Admins do not have submissions' });
    return;
  }

  try {
    const submissions = await Submission.find({
      userId: req.user?.uid,
      status: 'approved',
    })
      .sort({ createdAt: -1 })
      .populate('taskId', 'title description points');
    console.log(`Approved submissions for user ${req.user?.uid}:`, submissions);
    res.json(submissions);
  } catch (error) {
    console.error('Error fetching approved submissions:', error);
    res.status(500).json({ error: 'Failed to fetch approved submissions' });
  }
});

router.post('/:id/approve', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user?.admin) {
    res.status(403).json({ error: 'Admin only' });
    return;
  }

  try {
    const submission = await Submission.findById(req.params.id).populate('userId', 'name email uid');
    if (!submission) {
      console.error(`Submission ${req.params.id} not found`);
      res.status(404).json({ error: 'Submission not found' });
      return;
    }
    console.log('Submission to approve with user details:', submission);

    if (submission.status === 'approved') {
      console.log(`Submission ${req.params.id} is already approved`);
      res.status(400).json({ error: 'Submission already approved' });
      return;
    }

    submission.status = 'approved';
    await submission.save();
    console.log('Submission approved:', submission);

    const task = await Task.findById(submission.taskId);
    if (!task) {
      console.error(`Task ${submission.taskId} not found`);
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    console.log('Task for submission:', task);

    const userId = submission.userId.toString();
    console.log(`User ID to update: ${userId}`);

    const userBeforeUpdate = await User.findOne({ uid: userId });
    console.log('User before update:', userBeforeUpdate);

    if (!userBeforeUpdate) {
      console.error(`User with uid ${userId} not found`);
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const updateResult = await User.updateOne(
      { uid: userId },
      { $inc: { points: task.points, tokens: task.points } }
    );

    if (updateResult.matchedCount === 0) {
      console.error(`User with uid ${userId} not found during update`);
      res.status(500).json({ error: 'User not found during update' });
      return;
    }

    if (updateResult.modifiedCount === 0) {
      console.error(`User ${userId} points not updated - possible issue with update operation`);
    } else {
      console.log(`User ${userId}: Added ${task.points} points and tokens`);
    }

    const userAfterUpdate = await User.findOne({ uid: userId });
    console.log('User after update:', userAfterUpdate);

    // Return submission with populated userId
    const updatedSubmission = await Submission.findById(req.params.id).populate('userId', 'name email uid');
    res.json(updatedSubmission);
  } catch (error) {
    console.error('Error approving submission:', error);
    res.status(500).json({ error: 'Failed to approve submission' });
  }
});

export default router;