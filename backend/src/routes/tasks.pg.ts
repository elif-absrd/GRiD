import express, { Request, Response, NextFunction } from 'express';
import { Op } from 'sequelize';
import { Task, User, Submission } from '../models';
import { AuthenticatedRequest } from '../types';

const router = express.Router();

router.get('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  console.log('Received request with token header:', req.headers.authorization);
  try {
    if (req.user?.admin) {
      const tasks = await Task.findAll({
        order: [['createdAt', 'DESC']]
      });
      res.json(tasks);
      return;
    }

    if (!req.user?.uid) {
      console.error('No UID provided in request');
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    console.log(`Looking for user with UID: ${req.user.uid}`);
    
    // First find the user by Firebase UID
    const user = await User.findOne({ 
      where: { uid: req.user.uid }
    });
    
    console.log('User lookup result:', user);
    
    if (!user) {
      // If no user is found, create one (automatic onboarding)
      try {
        const newUser = await User.create({
          uid: req.user.uid,
          email: `user-${req.user.uid}@example.com`,
          name: req.user.uid,
          points: 0,
          tokens: 0,
          admin: false
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

    // Find submissions for this user
    const submissions = await Submission.findAll({
      where: { userId: user.id },
      attributes: ['taskId']
    });
    
    // Extract task IDs from submissions
    const submittedTaskIds = submissions.map((submission) => submission.taskId);
    
    // Find tasks that haven't been submitted yet
    const tasks = await Task.findAll({
      where: {
        id: {
          [Op.notIn]: submittedTaskIds.length > 0 ? submittedTaskIds : [0]
        }
      },
      order: [['createdAt', 'DESC']]
    });
    
    console.log(`User ${req.user.uid} fetched tasks:`, tasks);
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
    next(error);
  }
});

router.post('/', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.admin) {
      res.status(403).json({ error: 'Admin only' });
      return;
    }

    const task = await Task.create({
      title: req.body.title,
      description: req.body.description,
      points: req.body.points,
      createdBy: req.user.uid,
    });

    console.log('Task created:', task);
    res.json(task);
  } catch (error) {
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
    await Task.destroy({ where: {} });
    await Submission.destroy({ where: {} });
    res.json({ message: 'All tasks and submissions deleted' });
  } catch (error) {
    console.error('Error deleting all tasks:', error);
    next(error);
  }
});

// Delete single task endpoint
router.delete('/:id', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.admin) {
      res.status(403).json({ error: 'Admin only' });
      return;
    }

    const { id } = req.params;
    
    // Find task
    const task = await Task.findByPk(id);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    
    // Find approved submissions for this task
    const approvedSubmissions = await Submission.findAll({
      where: {
        taskId: id,
        status: 'approved'
      },
      include: [{ model: User }]
    });
    
    // Delete the task
    await task.destroy();
    
    // Delete all related submissions
    await Submission.destroy({
      where: { taskId: id }
    });
    
    console.log(`Task ${id} deleted by admin ${req.user.uid}`);
    res.json({ message: `Task ${id} deleted successfully` });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
    next(error);
  }
});

// Submit a task
router.post('/:taskId/submit', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.uid) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    
    // Check if user is admin
    if (req.user.admin) {
      res.status(403).json({ error: 'Admins cannot submit tasks' });
      return;
    }

    const { taskId } = req.params;
    const { mediaUrl } = req.body;

    // Find user
    const user = await User.findOne({ where: { uid: req.user.uid } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Check if task exists
    const task = await Task.findByPk(taskId);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    // Check if user has already submitted this task
    const existingSubmission = await Submission.findOne({
      where: {
        userId: user.id,
        taskId: task.id
      }
    });

    if (existingSubmission) {
      if (existingSubmission.status === 'rejected') {
        // Allow resubmission for rejected tasks
        await existingSubmission.update({
          status: 'pending',
          mediaUrl: mediaUrl || existingSubmission.mediaUrl,
          declineReason: undefined,
          submittedAt: new Date()
        });
        
        // Get populated submission for response
        const updatedSubmission = await Submission.findByPk(existingSubmission.id);
        
        // Get task details directly
        const task = await Task.findByPk(existingSubmission.taskId);
        
        // Format response to match frontend expectations
        const response = {
          _id: updatedSubmission?.id,
          taskId: {
            _id: task?.id,
            title: task?.title,
            description: task?.description,
            points: task?.points
          },
          status: updatedSubmission?.status,
          mediaUrl: updatedSubmission?.mediaUrl
        };
        
        console.log(`User ${req.user.uid} resubmitted task ${taskId}`);
        res.json(response);
        return;
      } else {
        res.status(400).json({ error: existingSubmission.status === 'approved' 
          ? 'This task has already been approved' 
          : 'You have already submitted this task and it is pending review'
        });
        return;
      }
    }

    // Create submission
    const submission = await Submission.create({
      taskId: task.id,
      userId: user.id,
      status: 'pending',
      mediaUrl: mediaUrl || null
    });

    // Get task details for the response
    const taskData = await Task.findByPk(task.id);
    
    // Format response to match frontend expectations
    const response = {
      _id: submission.id,
      taskId: {
        _id: taskData?.id,
        title: taskData?.title,
        description: taskData?.description,
        points: taskData?.points
      },
      status: submission.status,
      mediaUrl: submission.mediaUrl
    };

    console.log(`Task ${taskId} submitted by user ${req.user.uid}`);
    res.json(response);
  } catch (error) {
    console.error('Error submitting task:', error);
    res.status(500).json({ error: 'Failed to submit task' });
    next(error);
  }
});

// Get all pending submissions
router.get('/submissions/pending', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.admin) {
      res.status(403).json({ error: 'Admin only' });
      return;
    }

    const pendingSubmissions = await Submission.findAll({
      where: { status: 'pending' },
      include: [
        { model: Task, attributes: ['id', 'title', 'description', 'points'] },
        { model: User, attributes: ['id', 'uid', 'email', 'name'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Format the response to match the frontend expectations
    const formattedSubmissions = pendingSubmissions.map(submission => {
      // Use any to bypass TypeScript restriction
      const sub = submission.toJSON() as any;
      return {
        _id: sub.id, // Map id to _id for frontend compatibility
        taskId: {
          _id: sub.Task?.id || sub.taskId, // Map id to _id for frontend compatibility
          title: sub.Task?.title || 'Unknown Task',
          description: sub.Task?.description || '',
          points: sub.Task?.points || 0
        },
        userId: {
          _id: sub.User?.id || sub.userId, // Map id to _id for frontend compatibility
          uid: sub.User?.uid || 'Unknown',
          email: sub.User?.email || 'Unknown',
          name: sub.User?.name || 'Unknown'
        },
        status: sub.status,
        mediaUrl: sub.mediaUrl,
        submittedAt: sub.submittedAt
      };
    });

    console.log(`Admin ${req.user.uid} fetched pending submissions:`, formattedSubmissions.length);
    res.json(formattedSubmissions);
  } catch (error) {
    console.error('Error fetching pending submissions:', error);
    res.status(500).json({ error: 'Failed to fetch pending submissions' });
    next(error);
  }
});

// Get user submissions
router.get('/submissions/user', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.uid) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // For admin users, return empty array
    if (req.user.admin) {
      console.log('Admin user requested submissions, returning empty array');
      res.json([]);
      return;
    }

    // Find user by Firebase UID
    const user = await User.findOne({ where: { uid: req.user.uid } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Find all submissions for this user
    const submissions = await Submission.findAll({
      where: { userId: user.id },
      include: [
        { model: Task, attributes: ['id', 'title', 'description', 'points'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    // Format submissions for frontend
    const formattedSubmissions = submissions.map(submission => {
      // Use any to bypass TypeScript restriction
      const sub = submission.toJSON() as any;
      return {
        _id: sub.id, // Map id to _id for frontend compatibility
        taskId: {
          _id: sub.Task?.id || sub.taskId, // Map id to _id for frontend compatibility
          title: sub.Task?.title || 'Unknown Task',
          description: sub.Task?.description || '',
          points: sub.Task?.points || 0
        },
        userId: user.uid,
        status: sub.status,
        mediaUrl: sub.mediaUrl,
        submittedAt: sub.submittedAt,
        declineReason: sub.declineReason
      };
    });

    console.log(`User ${req.user.uid} fetched their submissions:`, formattedSubmissions.length);
    res.json(formattedSubmissions);
  } catch (error) {
    console.error('Error fetching user submissions:', error);
    res.status(500).json({ error: 'Failed to fetch user submissions' });
    next(error);
  }
});

// Add specific approve endpoint for frontend compatibility
router.post('/submissions/:submissionId/approve', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.admin) {
      res.status(403).json({ error: 'Admin only' });
      return;
    }

    const { submissionId } = req.params;

    // Find submission
    const submission = await Submission.findByPk(submissionId);
    if (!submission) {
      res.status(404).json({ error: 'Submission not found' });
      return;
    }

    // Check if already approved
    if (submission.status === 'approved') {
      res.status(400).json({ error: 'Submission already approved' });
      return;
    }

    // Update status to approved
    await submission.update({ status: 'approved' });

    // Add points to user
    const task = await Task.findByPk(submission.taskId);
    if (!task) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    const user = await User.findByPk(submission.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Add task points as tokens and points to user
    await user.update({
      points: user.points + task.points,
      tokens: user.tokens + task.points
    });

    console.log(`Submission ${submissionId} approved by admin ${req.user.uid}, added ${task.points} points to user ${user.uid}`);
    res.json({
      success: true,
      message: `Submission approved successfully. ${task.points} points added to user.`,
      submission: {
        _id: submission.id,
        taskId: {
          _id: task.id,
          title: task.title,
          description: task.description,
          points: task.points
        },
        status: 'approved'
      }
    });
  } catch (error) {
    console.error('Error approving submission:', error);
    res.status(500).json({ error: 'Failed to approve submission' });
    next(error);
  }
});

// Add specific reject endpoint for frontend compatibility
router.post('/submissions/:submissionId/reject', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.admin) {
      res.status(403).json({ error: 'Admin only' });
      return;
    }

    const { submissionId } = req.params;
    const { declineReason } = req.body;

    if (!declineReason) {
      res.status(400).json({ error: 'Decline reason is required' });
      return;
    }

    // Find submission
    const submission = await Submission.findByPk(submissionId);
    if (!submission) {
      res.status(404).json({ error: 'Submission not found' });
      return;
    }

    // Check if already rejected
    if (submission.status === 'rejected') {
      res.status(400).json({ error: 'Submission already rejected' });
      return;
    }

    // Update status to rejected and add reason
    await submission.update({ 
      status: 'rejected',
      declineReason: declineReason
    });

    console.log(`Submission ${submissionId} rejected by admin ${req.user.uid} with reason: ${declineReason}`);
    
    // Get user info for the response
    const user = await User.findByPk(submission.userId);
    const task = await Task.findByPk(submission.taskId);
    
    res.json({
      _id: submission.id,
      status: 'rejected',
      declineReason: declineReason,
      taskId: task ? {
        _id: task.id,
        title: task.title,
        description: task.description,
        points: task.points
      } : submission.taskId,
      userId: user ? {
        _id: user.id,
        uid: user.uid,
        email: user.email,
        name: user.name
      } : submission.userId
    });
  } catch (error) {
    console.error('Error rejecting submission:', error);
    res.status(500).json({ error: 'Failed to reject submission' });
    next(error);
  }
});

// General route for approve/reject - keep this for future API use
router.post('/submissions/:submissionId/:action', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.admin) {
      res.status(403).json({ error: 'Admin only' });
      return;
    }

    const { submissionId, action } = req.params;
    const { declineReason } = req.body;

    if (action !== 'approve' && action !== 'reject') {
      res.status(400).json({ error: 'Invalid action. Must be "approve" or "reject"' });
      return;
    }

    // Find submission
    const submission = await Submission.findByPk(submissionId);
    if (!submission) {
      res.status(404).json({ error: 'Submission not found' });
      return;
    }

    // Update submission status
    await submission.update({
      status: action === 'approve' ? 'approved' : 'rejected',
      declineReason: action === 'reject' ? declineReason : null
    });

    // If approved, add tokens to user
    if (action === 'approve') {
      const task = await Task.findByPk(submission.taskId);
      if (task) {
        const user = await User.findByPk(submission.userId);
        if (user) {
          // Add task points as tokens to user
          await user.update({
            tokens: user.tokens + task.points,
            points: user.points + task.points
          });
          console.log(`Added ${task.points} tokens to user ${user.uid}`);
        }
      }
    }

    console.log(`Submission ${submissionId} ${action === 'approve' ? 'approved' : 'rejected'} by admin ${req.user.uid}`);
    res.json({ message: `Submission ${action === 'approve' ? 'approved' : 'rejected'}` });
  } catch (error) {
    console.error(`Error ${req.params.action}ing submission:`, error);
    res.status(500).json({ error: `Failed to ${req.params.action} submission` });
    next(error);
  }
});

export default router;
