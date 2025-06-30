import express, { Request, Response, NextFunction } from 'express';
import Task from '../models/Task';
import Submission from '../models/Submission';
import User from '../models/User';
import { Types } from 'mongoose';

interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    admin?: boolean;
    email?: string;
    name?: string;
  };
}

const router = express.Router();

router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  console.log('Received request with token header:', req.headers.authorization);
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
        next(createError);
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
    next(error);
  }
});


router.post('/', async (req: AuthenticatedRequest, res: Response,  next: NextFunction) => {
  try{
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
} catch(error){
  console.error('Error creating task:', error);
  next(error);
}
});

router.delete('/all', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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
    next(error);
  }
});

router.delete('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user?.admin) {
      res.status(403).json({ error: 'Admin only' });
      return;
    }

    if (!Types.ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: 'Invalid task ID' });
      return;
    }

    const task = await Task.findById(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Find all approved submissions for this task
    const approvedSubmissions = await Submission.find({ taskId: req.params.id, status: 'approved' });

    // For each user who had an approved submission, deduct points/tokens but prevent negative values
    for (const submission of approvedSubmissions) {
      const user = await User.findOne({ uid: submission.userId });
      if (user) {
        // Prevent negative values by using Math.max
        const newPoints = Math.max(0, user.points - task.points);
        const newTokens = Math.max(0, user.tokens - task.points);
        
        await User.updateOne(
          { uid: submission.userId },
          { $set: { points: newPoints, tokens: newTokens } }
        );
      }
    }


    // Optionally delete related submissions
    await Submission.deleteMany({ taskId: new Types.ObjectId(req.params.id) });

    await task.deleteOne();
    console.log(`Task ${req.params.id} deleted by ${req.user?.uid}`);
    res.json({ message: `Task ${req.params.id} deleted successfully` });
  } catch (error) {
    console.error('Error deleting task:', error);
    next(error);
  }
});

router.post('/:id/submit', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.admin) {
    res.status(403).json({ error: 'Admins cannot submit tasks' });
    return;
  }

  try {
    const task = await Task.findById(req.params.id);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Find or create user
    let user = await User.findOne({ uid: req.user.uid });
    if (!user) {
      user = await User.create({
        uid: req.user.uid,
        email: req.user.email || `user-${req.user.uid}@example.com`,
        name: req.user.name || req.user.email?.split('@')[0] || req.user.uid,
        points: 0,
        tokens: 0
      });
    }

    // Check for existing submission
    let submission = await Submission.findOne({ 
      taskId: task._id,
      userId: user._id
    });

    // Handle submission based on existing status
    if (submission) {
      if (submission.status === 'rejected') {
        // Allow resubmission if previously rejected
        submission.status = 'pending';
        submission.mediaUrl = req.body.mediaUrl || submission.mediaUrl;
        submission.declineReason = undefined; // Clear rejection reason
        submission.submittedAt = new Date();
        
        await submission.save();
        console.log(`User ${req.user.uid} resubmitted task ${task._id}:`, submission);
        
        const populatedSubmission = await Submission.findById(submission._id)
          .populate('taskId', 'title description points');
          
        res.json(populatedSubmission);
        return;
      } else if (submission.status === 'approved') {
        res.status(400).json({ error: 'This task has already been approved' });
        return;
      } else {
        res.status(400).json({ error: 'You have already submitted this task and it is pending review' });
        return;
      }
    }

    // Create new submission
    submission = new Submission({
      taskId: task._id,
      userId: user._id,
      status: 'pending',
      mediaUrl: req.body.mediaUrl || undefined,
      submittedAt: new Date()
    });

    await submission.save();
    
    const populatedSubmission = await Submission.findById(submission._id)
      .populate('taskId', 'title description points');
      
    console.log(`User ${req.user?.uid} submitted task ${req.params.id}:`, populatedSubmission);
    res.json(populatedSubmission);
  } catch (error: any) {
    console.error('Error submitting task:', error);
    res.status(500).json({ error: 'Failed to submit task' });
    next(error);
  }
});

router.get('/submissions/pending', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    
    if (req.user.admin) {
      console.log('Fetching pending submissions for admin');
      
      // Populate both taskId and userId with more details
      const submissions = await Submission.find({ status: 'pending' })
        .sort({ createdAt: -1 })
        .populate('taskId', 'title description points')
        .populate('userId', 'name email uid');
      
      // Transform data to ensure user info is properly formatted
      const formattedSubmissions = submissions.map(submission => {
        // Convert Mongoose document to plain object
        const submissionObj = submission.toObject();
        
        // Ensure userId contains proper user information
        const userInfo = submissionObj.userId || { email: 'Unknown', name: 'Unknown', uid: 'Unknown' };
        
        // Check if userInfo is an object and has the properties we need
        const isUserObject = typeof userInfo === 'object' && userInfo !== null;
        
        return {
          ...submissionObj,
          userId: {
            _id: isUserObject && '_id' in userInfo ? userInfo._id : null,
            uid: isUserObject && 'uid' in userInfo ? userInfo.uid : null,
            email: isUserObject && 'email' in userInfo ? userInfo.email : 'Unknown',
            name: isUserObject && 'name' in userInfo ? userInfo.name : 'Unknown'
          }
        };
      });
      
      console.log('Formatted pending submissions:', formattedSubmissions);
      res.json(formattedSubmissions);
    } else {
      // For regular users, only show their own pending submissions
      const user = await User.findOne({ uid: req.user.uid });
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }
      
      const submissions = await Submission.find({ 
        userId: user._id, 
        status: 'pending' 
      })
        .sort({ createdAt: -1 })
        .populate('taskId', 'title description points');
      
      res.json(submissions);
    }
  } catch (error) {
    console.error('Error fetching pending submissions:', error);
    res.status(500).json({ error: 'Failed to fetch pending submissions' });
    next(error);
  }
});

router.get('/submissions/approved', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
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
    next(error);
  }
});

// Add a new route for admin to view all submissions
router.get('/submissions/all', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user?.admin) {
      res.status(403).json({ error: 'Admin only' });
      return;
    }
    
    const submissions = await Submission.find({})
      .sort({ createdAt: -1 })
      .populate('taskId', 'title description points')
      .populate('userId', 'name email uid');
    
    res.json(submissions);
  } catch (error) {
    console.error('Error fetching all submissions:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
    next(error);
  }
});

// Fix the /submissions/user route to handle admins correctly
router.get('/submissions/user', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    
    // For admins, return empty array instead of error
    if (req.user.admin) {
      res.json([]);
      return;
    }
    
    // First find the user by Firebase UID
    const user = await User.findOne({ uid: req.user.uid });
    
    if (!user) {
      console.log(`User not found with uid: ${req.user.uid}`);
      res.json([]);
      return;
    }
    
    // Get all user submissions (approved, rejected, AND pending)
    const submissions = await Submission.find({
      userId: user._id,
      status: { $in: ['approved', 'rejected', 'pending'] }
    })
    .sort({ createdAt: -1 })
    .populate('taskId', 'title description points');

    console.log(`User submissions for ${req.user.uid}:`, submissions);
    res.json(submissions);
  } catch (error) {
    console.error('Error fetching user submissions:', error);
    res.status(500).json({ error: 'Failed to fetch user submissions' });
    next(error);
  }
});

// Fix the approve submission endpoint
router.post('/:id/approve', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  if (!req.user?.admin) {
    res.status(403).json({ error: 'Admin only' });
    return;
  }

  try {
    // First find the submission
    const submission = await Submission.findById(req.params.id);
    
    if (!submission) {
      console.error(`Submission ${req.params.id} not found`);
      res.status(404).json({ error: 'Submission not found' });
      return;
    }
    
    // Check if already approved
    if (submission.status === 'approved') {
      console.log(`Submission ${req.params.id} is already approved`);
      res.status(400).json({ error: 'Submission already approved' });
      return;
    }
    
    // Update submission status
    submission.status = 'approved';
    await submission.save();
    
    // Find the user document using the submission's userId
    const userDoc = await User.findById(submission.userId);
    if (!userDoc) {
      console.error(`User not found for submission ${req.params.id}`);
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Find the task document
    const task = await Task.findById(submission.taskId);
    if (!task) {
      console.error(`Task not found for submission ${req.params.id}`);
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    
    // Add points to user
    userDoc.points = (userDoc.points || 0) + task.points;
    userDoc.tokens = (userDoc.tokens || 0) + task.points;
    await userDoc.save();
    
    console.log(`Approved submission for user ${userDoc.email}: +${task.points} points/tokens`);
    
    res.json({
      success: true,
      message: `Submission approved successfully. ${task.points} points added to user.`,
      submission
    });
  } catch (error) {
    console.error('Error approving submission:', error);
    res.status(500).json({ error: 'Failed to approve submission' });
    next(error);
  }
});

// Fix decline submission endpoint
router.post('/:id/decline', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  if (!req.user?.admin) {
    res.status(403).json({ error: 'Admin only' });
    return;
  }

  try {
    const { reason } = req.body;
   
    if (!reason) {
      res.status(400).json({ error: 'Decline reason is required' });
      return;
    }

    const submission = await Submission.findById(req.params.id);
      
    if (!submission) {
      console.error(`Submission ${req.params.id} not found`);
      res.status(404).json({ error: 'Submission not found' });
      return;
    }

    if (submission.status === 'rejected') {
      console.log(`Submission ${req.params.id} is already rejected`);
      res.status(400).json({ error: 'Submission already rejected' });
      return;
    }

    submission.status = 'rejected';
    submission.declineReason = reason;
    await submission.save();
    
    // Get user email for logging
    const user = await User.findById(submission.userId);
    const userEmail = user ? user.email : 'Unknown user';
      
    console.log(`Submission ${req.params.id} declined for user ${userEmail}: ${reason}`);
    
    // Return populated submission
    const populatedSubmission = await Submission.findById(submission._id)
      .populate('taskId')
      .populate('userId');
      
    res.json(populatedSubmission);
  } catch (error) {
    console.error('Error declining submission:', error);
    res.status(500).json({ error: 'Failed to decline submission' });
    next(error);
  }
});

router.get('/debug/user', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
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
    next(error);
  }
});

router.get('/debug/db', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
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
    next(error);
  }
});


export default router;

function populate(arg0: string, arg1: string) {
  throw new Error('Function not implemented.');
}
