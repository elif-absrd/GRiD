import express, { Request, Response } from 'express';
import Task from '../models/Task';
import Submission from '../models/Submission';
import User from '../models/User';
import { Types } from 'mongoose';

// Update the interface to include all needed properties
interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    admin?: boolean;
    email?: string;
    name?: string;
  };
}

const router = express.Router();

// Fix for the tasks route
router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (req.user?.admin) {
      const tasks = await Task.find().sort({ createdAt: -1 });
      res.json(tasks);
      return;
    }

    if (!req.user?.uid) {
      console.error('No UID provided in request');
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    console.log(`Looking for user with UID: ${req.user.uid}`);
    
    // First find the user document by Firebase UID
    const user = await User.findOne({ uid: req.user.uid });
    console.log('User lookup result:', user);
    
    if (!user) {
      // If no user is found, create one (automatic onboarding)
      try {
        const newUser = await User.create({
          uid: req.user.uid,
          email: req.user.email || `user-${req.user.uid}@example.com`,
          name: req.user.name || req.user.email?.split('@')[0] || req.user.uid,
          points: 0,
          tokens: 0
        });
        console.log('Created new user:', newUser);
        // Return empty tasks for new users
        res.json([]);
      } catch (createError) {
        console.error('Error creating user:', createError);
        res.json([]);
      }
      return;
    }

    // Then use the MongoDB ObjectId to find submissions
    const submissions = await Submission.find({ userId: user._id }).select('taskId');
    const submittedTaskIds = submissions.map((submission) => submission.taskId.toString());
    const tasks = await Task.find({ _id: { $nin: submittedTaskIds } }).sort({ createdAt: -1 });
    console.log(`User ${req.user.uid} fetched tasks:`, tasks);
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
    // Delete all tasks
    const deleteResult = await Task.deleteMany({});
    console.log(`Deleted ${deleteResult.deletedCount} tasks`);

    // Delete all submissions related to tasks
    const submissionsDeleteResult = await Submission.deleteMany({});
    console.log(`Deleted ${submissionsDeleteResult.deletedCount} submissions`);

    // Reset all users' points and tokens to 0
    const userUpdateResult = await User.updateMany({}, { $set: { points: 0, tokens: 0 } });
    console.log(`Reset points and tokens for ${userUpdateResult.modifiedCount} users`);

    res.json({ message: `Successfully deleted ${deleteResult.deletedCount} tasks and reset user points` });
  } catch (error) {
    console.error('Error deleting tasks:', error);
    res.status(500).json({ error: 'Failed to delete tasks' });
  }
});

router.post('/:id/submit', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.user || req.user.admin) {
    res.status(403).json({ error: 'Admins cannot submit tasks' });
    return;
  }

  const task = await Task.findById(req.params.id);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  try {
    // Find or create user document
    let user = await User.findOne({ uid: req.user.uid });
    if (!user) {
      user = await User.create({
        uid: req.user.uid,
        email: req.user.email || `user-${req.user.uid}@example.com`, // Provide default if email is undefined
        name: req.user.name || req.user.email?.split('@')[0] || req.user.uid, // Multiple fallbacks
        points: 0,
        tokens: 0
      });
    }
    
    // Create submission with reference to user
    const submission = new Submission({
      taskId: task._id,
      userId: user._id,  // Store ObjectId reference
      status: 'pending',
    });

    await submission.save();
    console.log(`User ${req.user.uid} submitted task ${req.params.id}:`, submission);
    res.json(submission);

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
  try {
    if (!req.user?.admin) {
      res.status(403).json({ error: 'Admin only' });
      return;
    }
    
    console.log('Fetching pending submissions for admin');
    
    // First, get submissions without population to see the raw data
    const rawSubmissions = await Submission.find({ status: 'pending' }).sort({ createdAt: -1 });
    console.log('Raw submissions (without population):', rawSubmissions);
    
    // Now try population
    const submissions = await Submission.find({ status: 'pending' })
      .sort({ createdAt: -1 })
      .populate('taskId', 'title')
      .populate('userId');
      
    console.log('Populated submissions:', 
      submissions.map(s => ({
        _id: s._id,
        taskId: s.taskId,
        userId: s.userId,
        status: s.status
      }))
    );
    
    res.json(submissions);
  } catch (error) {
    console.error('Error fetching pending submissions:', error);
    res.status(500).json({ error: 'Failed to fetch pending submissions' });
  }
});

// Fix for approved submissions
router.get('/submissions/approved', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    
    if (req.user.admin) {
      res.status(403).json({ error: 'Admins do not have submissions' });
      return;
    }

    console.log(`Looking for approved submissions for user with UID: ${req.user.uid}`);
    
    // First find the user by Firebase UID
    const user = await User.findOne({ uid: req.user.uid });
    
    if (!user) {
      console.log(`User not found with uid: ${req.user.uid}`);
      // Return empty array instead of error
      res.json([]);
      return;
    }

    console.log(`Found user for approved submissions:`, user);
    
    // Use the MongoDB ObjectId for query
    const submissions = await Submission.find({
      userId: user._id,
      status: 'approved',
    })
      .sort({ createdAt: -1 })
      .populate('taskId', 'title description points');
      
    console.log(`Approved submissions for user ${req.user.uid}:`, submissions);
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
    const submission = await Submission.findById(req.params.id);
    if (!submission) {
      console.error(`Submission ${req.params.id} not found`);
      res.status(404).json({ error: 'Submission not found' });
      return;
    }
    console.log('Submission to approve:', submission);

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

    // Get the user from the populated MongoDB document
    const userDoc = await User.findById(submission.userId);
    if (!userDoc) {
      console.error(`User with ID ${submission.userId} not found`);
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const userBeforeUpdate = await User.findById(userDoc._id);
    console.log('User before update:', userBeforeUpdate);

    if (!userBeforeUpdate) {
      console.error(`User with ID ${userDoc._id} not found`);
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const updateResult = await User.updateOne(
      { _id: userDoc._id },
      { $inc: { points: task.points, tokens: task.points } }
    );

    if (updateResult.matchedCount === 0) {
      console.error(`User with ID ${userDoc._id} not found during update`);
      res.status(500).json({ error: 'User not found during update' });
      return;
    }

    if (updateResult.modifiedCount === 0) {
      console.error(`User ${userDoc._id} points not updated - possible issue with update operation`);
    } else {
      console.log(`User ${userDoc._id}: Added ${task.points} points and tokens`);
    }

    const userAfterUpdate = await User.findById(userDoc._id);
    console.log('User after update:', userAfterUpdate);

    res.json(submission);
  } catch (error) {
    console.error('Error approving submission:', error);
    res.status(500).json({ error: 'Failed to approve submission' });
  }
});

// Add this to debug your issues
router.get('/debug/user', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    
    const user = await User.findOne({ uid: req.user.uid });
    const allUsers = await User.find({}).limit(10);
    
    res.json({
      requestUser: req.user,
      databaseUser: user,
      sampleUsers: allUsers,
    });
  } catch (error) {
    console.error('Error in debug route:', error);
    res.status(500).json({ error: 'Debug error' });
  }
});

// Add MongoDB connection check route
router.get('/debug/db', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Check collections
    const taskCount = await Task.countDocuments();
    const userCount = await User.countDocuments();
    const submissionCount = await Submission.countDocuments();
    
    // Check user existence
    const user = req.user ? await User.findOne({ uid: req.user.uid }) : null;
    
    res.json({
      databaseStatus: 'connected',
      collections: {
        tasks: taskCount,
        users: userCount,
        submissions: submissionCount
      },
      currentUser: user,
      requestUser: req.user
    });
  } catch (error: any) {
    console.error('Database debug error:', error);
    res.status(500).json({ 
      error: 'Database connection error',
      message: error.message,
      stack: error.stack
    });
  }
});

export default router;