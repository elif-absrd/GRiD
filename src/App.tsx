import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword} from 'firebase/auth';
import type { User } from 'firebase/auth';
import './App.css';
import grid from './assets/img25-removebg-preview.png';
import aic from './assets/img24-removebg-preview.png';
import abs from './assets/img23-removebg-preview.png';

// Define a custom user type that includes the admin claim
interface CustomUser extends User {
  admin?: boolean;
}

// Initialize Firebase
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};
initializeApp(firebaseConfig);

interface Task {
  _id: string;
  title: string;
  description: string;
  points: number;
}

interface PendingSubmission {
  _id: string;
  taskId: string | { _id: string; title: string };
  userId: string;
  status: string;
  mediaUrl?: string;
}

interface ApprovedSubmission {
  _id: string;
  taskId: string | { _id: string; title: string; description: string; points: number };
  userId: string;
  status: string;
  declineReason?: string;
}

interface ShopItem {
  _id: string;
  name: string;
  description: string;
  tokenCost: number;
}

interface UserData {
  uid: string;
  email: string;
  points: number;
  tokens: number;
}

const App: React.FC = () => {
  const [user, setUser] = useState<CustomUser | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submissions, setSubmissions] = useState<PendingSubmission[]>([]);
  const [approvedSubmissions, setApprovedSubmissions] = useState<ApprovedSubmission[]>([]);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<UserData[]>([]);
  const [currentUserData, setCurrentUserData] = useState<UserData | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [taskPoints, setTaskPoints] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [taskMediaUrls, setTaskMediaUrls] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<'tasks' | 'shop' | 'leaderboard'>('tasks');
  const [isLoading, setIsLoading] = useState(false);
  const [redemptionPending, setRedemptionPending] = useState<{ itemId: string; googleFormLink?: string; formLinkSubmitted?: boolean; actionTaken?:boolean } | null>(null);
  const [pendingUserSubmissions, setPendingUserSubmissions] = useState<ApprovedSubmission[]>([]);

  const fetchDataTimeout = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
      const auth = getAuth();
      const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
        console.log('Auth state changed, user:', firebaseUser?.uid);
        setIsLoading(true);
        if (firebaseUser) {
          try {
            const idTokenResult = await firebaseUser.getIdTokenResult(true);
            const customUser = {
              ...firebaseUser,
              admin: idTokenResult.claims.admin === true,
            };
            setUser(customUser);
            setIsAuthenticated(true);
            await fetchData();
          } catch (error) {
            console.error('Error in onAuthStateChanged:', error);
            setUser(null);
            setIsAuthenticated(false);
            setCurrentUserData(null);
            setApprovedSubmissions([]);
            setErrorMessage('Authentication error. Please try logging in again.');
          }
        } else {
          setUser(null);
          setIsAuthenticated(false);
          setCurrentUserData(null);
          setApprovedSubmissions([]);
        }
        setIsLoading(false);
      });

      return () => unsubscribe();
    }, []);

  useEffect(() => {
    // Debounced polling for real-time updates
    if (fetchDataTimeout.current) {
      clearTimeout(fetchDataTimeout.current);
    }
    if (user && isAuthenticated) {
      fetchDataTimeout.current = setTimeout(() => {
        fetchData().catch((error) => console.error('Polling error:', error));
      }, 5000);
    }
    return () => {
      if (fetchDataTimeout.current) {
        clearTimeout(fetchDataTimeout.current);
      }
    };
  }, [user, isAuthenticated]);

  useEffect(() => {
  if (successMessage || errorMessage) {
    const timeout = setTimeout(() => {
      setSuccessMessage(null);
      setErrorMessage(null);
    }, 3000); // 3 seconds
    return () => clearTimeout(timeout); // Cleanup on unmount or state change
    }
  }, [successMessage, errorMessage]);

  // Fix the fetchData method to use appropriate endpoint based on role
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // For admins, use the pending submissions endpoint instead
      const promises = [
        fetchTasks(),
        user?.admin ? fetchPendingSubmissions() : fetchApprovedSubmissions().catch(err => {
          console.error('Error fetching user submissions:', err);
          return [];
        }),
        fetchShopItems(),
      ];

      // Only fetch leaderboard if user is authenticated
      if (user && isAuthenticated) {
        promises.push(fetchLeaderboard().catch(err => {
          console.error('Error fetching leaderboard:', err);
          return [];
        }));
      }

      await Promise.all(promises);
    } catch (error) {
      console.error('Error fetching data:', error);
      // Don't re-throw the error here to prevent full app failure
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTasks = async () => {
    try {
      const token = await getAuth().currentUser?.getIdToken();
      console.log('Fetching tasks with headers:', token);
      const res = await fetch('http://localhost:3000/api/tasks', {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Tasks response status:', res.status);
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const tasksData = await res.json();
      console.log('Fetched tasks:', tasksData);
      
      // Transform tasks to maintain compatibility with the frontend
      const transformedTasks = tasksData.map((task: any) => ({
        _id: task.id || task._id, // Support both MongoDB _id and PostgreSQL id
        title: task.title,
        description: task.description,
        points: task.points
      }));
      
      setTasks(transformedTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }
  };

  const fetchPendingSubmissions = async () => {
    try {
      const token = await getAuth().currentUser?.getIdToken();
      console.log('Fetching pending submissions with headers:', token);
      const res = await fetch('http://localhost:3000/api/tasks/submissions/pending', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch submissions');
      const submissionsData = await res.json();
      console.log('Fetched pending submissions:', submissionsData);
      setSubmissions(submissionsData);
    } catch (error) {
      console.error('Error fetching submissions:', error);
      throw error;
    }
  };

  // Modify the fetchApprovedSubmissions to handle the admin case properly
  const fetchApprovedSubmissions = async () => {
    // Return early for admin users without making the API call
    if (user?.admin) {
      console.log('Admin users do not have personal submissions');
      setApprovedSubmissions([]);
      setPendingUserSubmissions([]);
      return [];
    }
    
    try {
      const token = await getAuth().currentUser?.getIdToken();
      console.log('Fetching user submissions with headers:', token);
      
      const res = await fetch('http://localhost:3000/api/tasks/submissions/user', {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.log('Error response data:', errorData);
        throw new Error(errorData.error || `Failed to fetch submissions: ${res.status} - ${res.statusText}`);
      }
      
      const allSubmissions = await res.json();
      console.log('Fetched all user submissions:', allSubmissions);
      
      // Split submissions by status
      const approved = allSubmissions.filter((s: ApprovedSubmission) => s.status === 'approved');
      const rejected = allSubmissions.filter((s: ApprovedSubmission) => s.status === 'rejected');
      const pending = allSubmissions.filter((s: ApprovedSubmission) => s.status === 'pending');
      
      // Store both approved and rejected in approvedSubmissions
      setApprovedSubmissions([...approved, ...rejected]);
      // Store pending submissions
      setPendingUserSubmissions(pending);
      
      return allSubmissions;
    } catch (error) {
      console.error('Error fetching user submissions:', error);
      throw error;
    }
  };

  const fetchShopItems = async () => {
    try {
      const token = await getAuth().currentUser?.getIdToken();
      console.log('Fetching shop items with token:', token);
      const res = await fetch('http://localhost:3000/api/shop', {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log('Shop items response status:', res.status);
      if (!res.ok) throw new Error('Failed to fetch shop items');
      const shopData = await res.json();
      // Map cost to tokenCost for consistency with frontend and handle PostgreSQL id field
      const mappedShopItems = shopData.map((item: any) => ({
        _id: item.id || item._id, // Support both MongoDB _id and PostgreSQL id
        name: item.name,
        description: item.description,
        tokenCost: item.cost || 0, // Map cost to tokenCost
      }));
      console.log('Fetched shop items:', mappedShopItems);
      setShopItems(mappedShopItems);
    } catch (error) {
      console.error('Error fetching shop items:', error);
      throw error;
    }
  };

  const fetchLeaderboard = async () => {
  if (!user?.uid) {
    console.log('Skipping leaderboard fetch: user not fully authenticated yet');
    return;
  }
  try {
    const token = await getAuth().currentUser?.getIdToken();
    console.log('Fetching leaderboard with token:', token);
    const res = await fetch('http://localhost:3000/api/leaderboard', { headers: { Authorization: `Bearer ${token}` } });
    console.log('Leaderboard response status:', res.status);
    if (!res.ok) throw new Error(`Failed to fetch leaderboard: ${res.status}`);
    const leaderboardData = await res.json();
    console.log('Fetched leaderboard data:', leaderboardData);
    setLeaderboard(leaderboardData);
    const userData = leaderboardData.find((u: UserData) => u.uid === user?.uid);
    setCurrentUserData(userData || { uid: user?.uid || '', email: user?.email || '', points: 0, tokens: 0 });
    if (!userData && !user?.admin) {
      console.warn('Current user not found in leaderboard:', { email: user?.email, uid: user?.uid });
      setErrorMessage('You are not on the leaderboard yet. Complete tasks to earn points!');
      setCurrentUserData({ uid: user?.uid || '', email: user?.email || '', points: 0, tokens: 0 });
    } else {
      console.log('Current user data:', userData);
      setCurrentUserData(userData);
    }
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    throw error;
  }
};

  const updateLeaderboard = (submissions: ApprovedSubmission[]) => {
    const userPoints = submissions.reduce((acc, sub) => {
      const points = typeof sub.taskId === 'object' && sub.taskId.points ? sub.taskId.points : 0;
      acc[sub.userId] = (acc[sub.userId] || 0) + points;
      return acc;
    }, {} as { [key: string]: number });

    const leaderboardData = Object.entries(userPoints).map(([uid, points]) => ({
      uid,
      email: '', // Placeholder; fetch email if needed from User model
      points,
      tokens: 0, // Assuming tokens mirror points for simplicity
    })).sort((a, b) => b.points - a.points);

    setLeaderboard(leaderboardData);
  };

  const handleLogin = async () => {
  setErrorMessage(null);
  setSuccessMessage(null);
  try {
    if (!email || !password) {
      throw new Error('Email and password are required');
    }
    const authResult = await signInWithEmailAndPassword(getAuth(), email, password);
    const currentUser = authResult.user;
    if (currentUser) {
      await currentUser.getIdToken(true);
      setIsAuthenticated(true);
      // Remove sync fetch since middleware handles it
    } else {
      throw new Error('Authentication failed, no user returned');
    }
    setSuccessMessage('Login successful!');
  } catch (error: any) {
    console.error('Login error:', error);
    setErrorMessage(error.message || 'Failed to login. Please check your credentials.');
  }
};

  const handleSignUp = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      if (!email || !password) {
        throw new Error('Email and password are required');
      }
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }
      if (!/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email)) {
        throw new Error('Invalid email format');
      }
      await createUserWithEmailAndPassword(getAuth(), email, password);
      setSuccessMessage('Sign-up successful! You can now log in.');
      setIsSignUp(false);
      setIsAuthenticated(false);
    } catch (error: any) {
      console.error('Sign-up error:', error);
      setErrorMessage(error.message || 'Failed to sign up. Please try again.');
      setIsAuthenticated(false);
    }
  };

  const handleLogout = async () => {
    await signOut(getAuth());
    setIsAuthenticated(false);
  };

  const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:3000/api/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await getAuth().currentUser?.getIdToken()}`,
        },
        body: JSON.stringify({
          title: taskTitle,
          description: taskDescription,
          points: Number(taskPoints),
        }),
      });
      if (!res.ok) throw new Error('Failed to create task');
      await fetchTasks();
      setTaskTitle('');
      setTaskDescription('');
      setTaskPoints('');
    } catch (error) {
      console.error('Error creating task:', error);
      setErrorMessage('Failed to create task. Please try again.');
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const token = await getAuth().currentUser?.getIdToken();
      const res = await fetch(`http://localhost:3000/api/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to delete task');
      }
      await fetchTasks();
      if (user?.admin) {
        fetchPendingSubmissions();
      }
      const updatedSubmissions = approvedSubmissions.filter(
      (sub) => typeof sub.taskId === 'object' && sub.taskId._id !== taskId
      );
      updateLeaderboard(updatedSubmissions);
    } catch (error: any) {
      console.error('Error deleting task:', error.message);
      alert(error.message);
    }
  };

  const handleDeleteAllTasks = async () => {
    if (!window.confirm('Are you sure you want to delete all tasks? This action cannot be undone.')) {
      return;
    }

    try {
      const token = await getAuth().currentUser?.getIdToken(true);
      if (!token) {
        throw new Error('No token available');
      }
      const res = await fetch('http://localhost:3000/api/tasks/all', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to delete all tasks');
      }
      const result = await res.json();
      console.log(result.message);
      setSuccessMessage('All tasks deleted and points reset successfully!');
      await fetchTasks();
      await fetchPendingSubmissions();
      await fetchLeaderboard();
    } catch (error: any) {
      console.error('Error deleting all tasks:', error);
      setErrorMessage(error.message);
    }
  };

  const handleMediaUrlChange = (taskId: string, value: string) => {
    setTaskMediaUrls((prev) => ({ ...prev, [taskId]: value }));
  };

  const handleSubmitTask = async (taskId: string) => {
  try {
    const mediaUrl = taskMediaUrls[taskId] || undefined;
    const token = await getAuth().currentUser?.getIdToken();
    console.log('Submitting task with token, taskId, and mediaUrl:', token, taskId, mediaUrl);
    const res = await fetch(`http://localhost:3000/api/tasks/${taskId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ mediaUrl }),
    });
    console.log('Submit task response status:', res.status);
    if (!res.ok) {
      // Handle different error response formats
      try {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to submit task');
      } catch (jsonError) {
        throw new Error(`Failed to submit task: ${res.status} ${res.statusText}`);
      }
    }
    setTaskMediaUrls((prev) => ({ ...prev, [taskId]: '' })); // Reset only for this task
    await fetchTasks();
    
    // Only fetch pending submissions for admin users
    if (user?.admin) {
      await fetchPendingSubmissions();
    } else {
      await fetchApprovedSubmissions();
    }
    
    // Show success message
    setSuccessMessage('Task submitted successfully!');
  } catch (error: any) {
    console.error('Error submitting task:', error.message);
    setErrorMessage(error.message);
  }
};

  const handleApproveSubmission = async (submissionId: string) => {
    setSubmissionError(null);
    try {
      const token = await getAuth().currentUser?.getIdToken(true);
      if (!token) {
        throw new Error('Authentication token unavailable');
      }
      
      console.log(`Approving submission: ${submissionId}`);
      const apiUrl = 'http://localhost:3000';
      const res = await fetch(`${apiUrl}/api/tasks/submissions/${submissionId}/approve`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `HTTP error: ${res.status}` }));
        throw new Error(errorData.error || 'Failed to approve submission');
      }
      
      const result = await res.json();
      console.log('Approval result:', result);

      // Refresh the pending submissions list
      await fetchPendingSubmissions();
      
      // Update leaderboard after a short delay to allow server processing
      setTimeout(async () => {
        try {
          await fetchLeaderboard();
        } catch (error) {
          console.error('Error updating leaderboard after approval:', error);
        }
      }, 500);

      setSuccessMessage('Submission approved successfully!');
    } catch (error: any) {
      console.error('Error approving submission:', error.message);
      setSubmissionError(error.message);
    }
  };

  const handleDeclineSubmission = async (submissionId: string) => {
    setSubmissionError(null);
    try {
      const reason = prompt('Enter reason for declining this submission:');
      if (!reason) {
        // User cancelled or didn't enter a reason
        return;
      }
      
      const token = await getAuth().currentUser?.getIdToken(true);
      if (!token) {
        throw new Error('Authentication token unavailable');
      }
      
      const apiUrl = 'http://localhost:3000';
      const res = await fetch(`${apiUrl}/api/tasks/submissions/${submissionId}/reject`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ declineReason: reason })
      });
      
      if (!res.ok) {
        if (res.headers.get('content-type')?.includes('application/json')) {
          const errorData = await res.json();
          throw new Error(errorData.error || `Failed to decline submission: ${res.status}`);
        } else {
          throw new Error(`Server error: ${res.status}`);
        }
      }

      await fetchPendingSubmissions();
      setSuccessMessage('Submission declined successfully!');
    } catch (error: any) {
      console.error('Error declining submission:', error.message);
      setSubmissionError(error.message);
    }
  };

  const handleRedeemItem = async (itemId: string) => {
    console.log('handleRedeemItem called for itemId:', itemId);
    try {
      const shop = shopItems.find(s => s._id === itemId);
      if (!shop) throw new Error('Service not found');
      const token = await getAuth().currentUser?.getIdToken();
      console.log('Sending redeem request with token:', token?.substring(0, 10) + '...');
      const res = await fetch('http://localhost:3000/api/shop/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await getAuth().currentUser?.getIdToken()}`,
        },
        body: JSON.stringify({ itemId }),
      });
      console.log('Fetch response status:', res.status);
      
      if (!res.ok) {
        // Try to parse error JSON, but handle case where response is not JSON
        try {
          const result = await res.json();
          throw new Error(result.error || `Failed to redeem item (status: ${res.status})`);
        } catch (jsonError) {
          throw new Error(`Failed to redeem item (status: ${res.status})`);
        }
      }
      
      // Try to parse result JSON
      const result = await res.json();
      console.log('Redeem response data:', result);
      
      setSuccessMessage(`Successfully redeemed ${shop.name}!`);
      if (result.googleFormLink) {
        setRedemptionPending({ itemId, googleFormLink: result.googleFormLink, formLinkSubmitted: false, actionTaken: false });
        window.open(result.googleFormLink, '_blank');
      } else {
        console.warn('No googleFormLink returned for item:', itemId);
      }
      return result;
    } catch (error: any) {
      console.error('Error redeeming item:', error);
      setErrorMessage(error.message || 'Failed to redeem item.');
      throw error; 
    }
  };

  const handleAddShopItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const user = getAuth().currentUser;
    if (!user) {
      setErrorMessage('User not authenticated. Please log in.');
      return;
    }

    try {
      const idToken = await user.getIdToken();
      const googleFormLink = taskMediaUrls['googleFormLink'] || '';
      console.log('Sending ID token:', idToken);
      const res = await fetch('http://localhost:3000/api/shop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          name: taskTitle, // Reuse taskTitle for shop item name
          description: taskDescription,
          cost: Number(taskPoints), // Reuse taskPoints for token cost
          googleFormLink,
        }),
      });
      if (!res.ok) throw new Error('Failed to add shop item');
      await fetchShopItems(); // Refresh shop items list
      setTaskTitle('');
      setTaskDescription('');
      setTaskPoints('');
      setTaskMediaUrls((prev) => ({ ...prev, googleFormLink: '' }));
      setSuccessMessage('Shop item added successfully!');
    } catch (error) {
      console.error('Error adding shop item:', error);
      setErrorMessage('Failed to add shop item. Please ensure you have admin privileges.');
    }
  };

  const handleConfirmRedemption = async (itemId: string) => {
  try {
    const token = await getAuth().currentUser?.getIdToken();
    const res = await fetch('http://localhost:3000/api/shop/redeem/confirm', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId, userId: user?.uid }),
    });
    if (!res.ok) throw new Error('Failed to confirm redemption');
    const result = await res.json();
    setCurrentUserData((prev) => prev ? { ...prev, tokens: result.remainingTokens } : null);
    setSuccessMessage('Redemption confirmed!');
    setRedemptionPending((prev) => prev ? { ...prev, formLinkSubmitted: true, actionTaken: true } : null); // Mark as submitted
    setTimeout(() => setRedemptionPending(null), 2000); 
  } catch (error) {
    setErrorMessage( 'Failed to confirm redemption');
  }
};

  const handleCancelRedemption = async (itemId: string) => {
    console.log('handleCancelRedemption called for itemId:', itemId);
    try {
      const token = await getAuth().currentUser?.getIdToken();
      const res = await fetch('http://localhost:3000/api/shop/redeem/cancel', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, userId: user?.uid }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        console.error('Cancel redemption error:', errorData);
        throw new Error(errorData.error || 'Failed to cancel redemption');
      }
      const result = await res.json();
      setSuccessMessage('Redemption canceled. No tokens deducted.');
      setRedemptionPending((prev) => (prev ? { ...prev, actionTaken: true } : null));
      setTimeout(() => setRedemptionPending(null), 2000);
    } catch (error) {
      setErrorMessage('Failed to cancel redemption');
    }
  };

  const handleMarkAsSubmitted = (itemId: string) => {
    console.log('handleMarkAsSubmitted called for itemId:', itemId);
    if (redemptionPending?.itemId === itemId && !redemptionPending.formLinkSubmitted) {
      setRedemptionPending((prev) => (prev ? { ...prev, formLinkSubmitted: true } : prev));
      setSuccessMessage('Please confirm redemption to deduct tokens.');
    }
  };

  const handleResubmitTask = async (submission: ApprovedSubmission) => {
    try {
      const taskId = typeof submission.taskId === 'object' ? submission.taskId._id : submission.taskId;
      const mediaUrl = taskMediaUrls[taskId] || undefined;
      
      const token = await getAuth().currentUser?.getIdToken();
      const apiUrl = 'http://localhost:3000';
      
      console.log('Resubmitting task with URL:', `${apiUrl}/api/tasks/${taskId}/submit`);
      const res = await fetch(`${apiUrl}/api/tasks/${taskId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mediaUrl }),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to resubmit task');
      }
      
      const responseData = await res.json();
      console.log('Resubmit response:', responseData);

      setTaskMediaUrls((prev) => ({ ...prev, [taskId]: '' }));
      
      await fetchTasks();
      await fetchApprovedSubmissions();
      
      setSuccessMessage('Task resubmitted successfully!');
    } catch (error: any) {
      console.error('Error resubmitting task:', error.message);
      alert(error.message);
    }
  };

  if (!user) {
    return (
      <div className="auth-container">
        <h1 className="auth-title">{isSignUp ? 'Sign Up' : 'Login'}</h1>
        {errorMessage && <p className="error-message">{errorMessage}</p>}
        {successMessage && <p className="success-message">{successMessage}</p>}
        <div className="auth-form">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="auth-input"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="auth-input"
          />
          {isSignUp ? (
            <button onClick={handleSignUp} className="auth-button auth-button-primary">
              Sign Up
            </button>
          ) : (
            <button onClick={handleLogin} className="auth-button auth-button-primary">
              Login
            </button>
          )}
        </div>
        <button
          onClick={() => {
            setIsSignUp(!isSignUp);
            setErrorMessage(null);
            setSuccessMessage(null);
          }}
          className="auth-toggle"
        >
          {isSignUp ? 'Already have an account? Login' : 'Need an account? Sign Up'}
        </button>
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="logo-container">
        <img src={grid} alt="Logo 1" className="logo left-logo" />
        <div className="right-logos">
        <img src={aic} alt="Logo 2" className="logo right-logo logo2" />
        <img src={abs} alt="Logo 3" className="logo right-logo logo3" />
        </div>
      </div>
      <header className="app-header">
        <h1 className="app-title">Welcome</h1>
        <div className="user-info">
          <span>{currentUserData?.email || user.email}!</span>
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </div>
      </header>

      <nav className="tabs">
        <button
          className={`tab ${activeTab === 'tasks' ? 'active' : ''}`}
          onClick={() => setActiveTab('tasks')}
        >
          Tasks
        </button>
        <button
          className={`tab ${activeTab === 'shop' ? 'active' : ''}`}
          onClick={() => setActiveTab('shop')}
        >
          Shop
        </button>
        <button
          className={`tab ${activeTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaderboard')}
        >
          Leaderboard
        </button>
      </nav>

      <main className="tab-content">
        {isLoading && <p>Loading...</p>}
        {errorMessage && <p className="error-message">{errorMessage}</p>}
        {successMessage && <p className="success-message">{successMessage}</p>}
        {activeTab === 'tasks' && (
          <div>
            {user.admin && (
              <div className="admin-section">
                <h2 className="section-title">Create Task</h2>
                <form onSubmit={handleCreateTask} className="task-form">
                  <input
                    name="title"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="Title"
                    className="task-input"
                  />
                  <input
                    name="description"
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    placeholder="Description"
                    className="task-input"
                  />
                  <input
                    name="points"
                    type="number"
                    value={taskPoints}
                    onChange={(e) => setTaskPoints(e.target.value)}
                    placeholder="Points"
                    className="task-input"
                  />
                  <button type="submit" className="button button-primary">
                    Create Task
                  </button>
                </form>

                <h2 className="section-title">Manage Tasks</h2>
                <button
                  onClick={handleDeleteAllTasks}
                  className="button button-danger"
                  style={{ backgroundColor: '#ff4d4f', color: 'white', marginBottom: '20px' }}
                >
                  Delete All Tasks
                </button>

                <h2 className="section-title">Pending Submissions</h2>
                {submissionError && <p className="error-message">{submissionError}</p>}
                {submissions.length === 0 ? (
                  <p className="empty-message">No pending submissions.</p>
                ) : (
                  submissions.map((submission) => {
                    const taskTitle = typeof submission.taskId === 'object' && submission.taskId !== null && 'title' in submission.taskId
                      ? (submission.taskId as { title: string }).title
                      : typeof submission.taskId === 'string'
                        ? `Task ID: ${submission.taskId}`
                        : 'Unknown Task';
                    // Extract user info properly from the userId object or string
                    const userEmail = typeof submission.userId === 'object' && submission.userId !== null && 'email' in submission.userId
                      ? (submission.userId as { email: string }).email
                      : typeof submission.userId === 'string'
                        ? submission.userId
                        : 'Unknown User';
                    
                    // Extract user ID for display
                    const userId = typeof submission.userId === 'object' && submission.userId !== null && ('uid' in submission.userId || '_id' in submission.userId)
                      ? (submission.userId as { uid?: string; _id?: string }).uid || (submission.userId as { _id?: string })._id
                      : typeof submission.userId === 'string'
                        ? submission.userId
                        : 'Unknown ID';
                    
                    return (
                      <div key={submission._id} className="card">
                        {/* <p>
                          Task:{' '}
                          {typeof submission.taskId === 'string'
                            ? `Task ID: ${submission.taskId}`
                            : submission.taskId.title}
                        </p> */}
                        <p>Task: {taskTitle}</p>
                        <p>User: {userEmail} (ID: {userId})</p>
                        <p>Status: {submission.status}</p>
                        {submission.mediaUrl && (
                          <p>Media URL: <a href={submission.mediaUrl} target="_blank" rel="noopener noreferrer">{submission.mediaUrl}</a></p>
                        )}
                        <div className="button-group">
                          <button
                            onClick={() => handleApproveSubmission(submission._id)}
                            className="button button-primary"
                            disabled={submission.status !== 'pending'}
                          >
                            {submission.status === 'approved' ? 'Approved' : 'Approve'}
                          </button>
                          <button
                            onClick={() => handleDeclineSubmission(submission._id)}
                            className="button button-danger"
                            disabled={submission.status !== 'pending'}
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            <h2 className="section-title">Tasks</h2>
            {tasks.length === 0 ? (
              <p className="empty-message">No tasks available.</p>
            ) : (
              tasks
              .filter((task) => {
                const userSubmission = approvedSubmissions.find(
                  (sub) =>
                    sub.userId === user?.uid &&
                    (sub.taskId === task._id || (typeof sub.taskId === 'object' && sub.taskId._id === task._id))
                );
                return !userSubmission || (userSubmission && userSubmission.status === 'rejected');
              })
              .map((task) => (
                <div key={task._id} className="card">
                  <div>
                  <h3 className="card-title">{task.title}</h3>
                  <p className="card-description">{task.description}</p>
                  <p className="card-points">Points: {task.points}</p>
                  </div>
                  <div className="flex items-center">
                    {!user.admin && (
                      <>
                        <input
                          type="text"
                          value={taskMediaUrls[task._id] || ''}
                          onChange={(e) => handleMediaUrlChange(task._id, e.target.value)}
                          placeholder="Media URL"
                          className="border p-2 mr-2 w-64"
                        />
                        <button
                          onClick={() => handleSubmitTask(task._id)}
                          className="button button-primary"
                        >
                          Submit Completion
                        </button>
                      </>
                  )}
                  {user.admin && (
                    <button
                      onClick={() => handleDeleteTask(task._id)}
                      className="bg-red-500 text-white p-2 rounded"
                    >
                      Delete
                    </button>
                  )}
                  </div>
                </div>
              ))
            )}
            
            {!user.admin && (
              <div className="submissions-section">
                <h2 className="section-title">Your Submissions</h2>
                <p className="points-display">Total Tokens: {currentUserData?.tokens || 0}</p>
                <p className="points-display">Total Points: {currentUserData?.points || 0}</p>
                
                {/* Pending Submissions */}
                {pendingUserSubmissions.length > 0 && (
                  <>
                    <h3 className="sub-section-title">Pending Submissions</h3>
                    {pendingUserSubmissions.map((submission) => (
                      <div key={submission._id} className="card">
                        {typeof submission.taskId === 'string' ? (
                          <p>Task data unavailable (ID: {submission.taskId})</p>
                        ) : (
                          <>
                            <h3 className="card-title">{submission.taskId.title}</h3>
                            <p className="card-description">{submission.taskId.description}</p>
                            <p className="card-status">Status: <span className="status-pending">Pending Review</span></p>
                          </>
                        )}
                      </div>
                    ))}
                  </>
                )}
                
                {/* Approved/Rejected Submissions */}
                <h3 className="sub-section-title">Completed/Rejected Submissions</h3>
                {approvedSubmissions.length === 0 ? (
                  <p className="empty-message">No approved or rejected submissions yet.</p>
                ) : (
                  approvedSubmissions.map((submission) => (
                    <div key={submission._id} className="card">
                      {typeof submission.taskId === 'string' ? (
                        <p>Task data unavailable (ID: {submission.taskId})</p>
                      ) : (
                        <>
                          <h3 className="card-title">{submission.taskId.title}</h3>
                          <p className="card-description">{submission.taskId.description}</p>
                          {submission.status === 'approved' ? (
                            <p className="card-points">Points Earned: {submission.taskId.points}</p>
                          ) : submission.status === 'rejected' && (
                            <>
                              <p className="card-decline-reason">
                                <strong>Declined:</strong> {submission.declineReason || 'No reason provided'}
                              </p>
                              <div className="resubmit-section">
                                <input
                                  type="text"
                                  value={taskMediaUrls[typeof submission.taskId === 'object' ? submission.taskId._id : submission.taskId] || ''}
                                  onChange={(e) => handleMediaUrlChange(
                                    typeof submission.taskId === 'object' ? submission.taskId._id : submission.taskId,
                                    e.target.value
                                  )}
                                  placeholder="Media URL (optional)"
                                  className="resubmit-input"
                                />
                                <button
                                  onClick={() => handleResubmitTask(submission)}
                                  className="button button-primary"
                                >
                                  Resubmit
                                </button>
                              </div>
                            </>
                          )}
                          <p className="card-status">Status: {submission.status}</p>
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'shop' && (
          <div>
            <h2 className="section-title">Shop</h2>
            {user.admin && (
              <div className="admin-section">
                <h2 className="section-subtitle" style={{marginBottom: '15px'}}>Add New Shop Item</h2>
                <form onSubmit={handleAddShopItem} className="task-form">
                  <input
                    name="name"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    placeholder="Name"
                    className="task-input"
                  />
                  <input
                    name="description"
                    value={taskDescription}
                    onChange={(e) => setTaskDescription(e.target.value)}
                    placeholder="Description"
                    className="task-input"
                  />
                  <input
                    name="cost"
                    type="number"
                    value={taskPoints}
                    onChange={(e) => setTaskPoints(e.target.value)}
                    placeholder="Cost (tokens)"
                    className="task-input"
                  />
                  <input
                    name="googleFormLink"
                    value={taskMediaUrls['googleFormLink'] || ''} // Reuse taskMediaUrls for simplicity
                    onChange={(e) => setTaskMediaUrls((prev) => ({ ...prev, googleFormLink: e.target.value }))}
                    placeholder="Google Form Link"
                    className="task-input"
                  />
                  <button type="submit" className="button button-primary">
                    Add Shop Item
                  </button>
                </form>
                <h2 className="section-subtitle" style={{marginBottom: '15px'}}>Previous Services</h2>
              </div>
            )}
            {!user.admin && (
                <p className="points-display" style={{ marginBottom: '15px' }}>Total Tokens: {currentUserData?.tokens || 0} <br />Total Points: {currentUserData?.points || 0} </p>
            )}
            {shopItems.length === 0 ? (
              <p className="empty-message">No shop items available.</p>
            ) : (
              shopItems.map((item) => (
                <div key={item._id} className="card">
                  <h3 className="card-title">{item.name}</h3>
                  <p className="card-description">{item.description}</p>
                  <p className="card-points">Cost: {item.tokenCost} tokens</p>
                  {!user.admin && (
                    <div>
                    <button
                      onClick={() => {
                        handleRedeemItem(item._id).then((result) => {
                          if (result && result.googleFormLink) {
                            window.open(result.googleFormLink, '_blank');
                        }
                      }).catch((error) => {
                        console.error('Redemption error:', error);
                        setErrorMessage(error.message || 'Failed to redeem item.');
                      });
                    }}
                      className={`button button-secondary ${!currentUserData || currentUserData.tokens < item.tokenCost ? 'disabled' : ''}`}
                      disabled={!currentUserData || currentUserData.tokens < item.tokenCost}
                    >
                      Redeem
                    </button>
                    {redemptionPending?.itemId === item._id && (
                      <div className="button-group">
                        {!redemptionPending.formLinkSubmitted && !redemptionPending.actionTaken && (
                          <button
                            onClick={() => handleMarkAsSubmitted(item._id)}
                            className="button button-primary"
                            disabled={redemptionPending.actionTaken}
                          >
                            Mark as Submitted
                          </button>
                        )}
                        <button
                          onClick={() => handleConfirmRedemption(item._id)}
                          className="button button-secondary"
                          disabled={!redemptionPending.formLinkSubmitted || redemptionPending.actionTaken}
                        >
                          Confirm Redemption
                        </button>
                        <button
                          onClick={() => handleCancelRedemption(item._id)}
                          className="button button-danger"
                          disabled={redemptionPending.formLinkSubmitted || redemptionPending.actionTaken}
                        >
                          Cancel Redemption
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}


        {activeTab === 'leaderboard' && (
          <div>
            <h2 className="section-title">Leaderboard</h2>
            {leaderboard.length === 0 ? (
              <p className="empty-message">No users on the leaderboard yet.</p>
            ) : (
              <>
                {!user?.admin && currentUserData && currentUserData.points === 0 && currentUserData.tokens === 0 && (
                  <p className="warning-message">Not yet on leaderboard. Earn points to join the leaderboard!</p>
              )}
              {leaderboard.map((userData, index) => (
                <div key={userData.uid} className="card">
                  <p>
                    Rank {index + 1}: {userData.email || 'Unknown'} - {userData.tokens} tokens, {userData.points} points
                  </p>
                </div>
              ))}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;