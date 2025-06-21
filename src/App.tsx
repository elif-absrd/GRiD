import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import type { User } from 'firebase/auth';
import './App.css';

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
  userId: { _id: string; name: string; email?: string; uid: string }; // Made email optional
  status: string;
}

interface ApprovedSubmission {
  _id: string;
  taskId: string | { _id: string; title: string; description: string; points: number };
  userId: string;
  status: string;
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
  const [activeTab, setActiveTab] = useState<'tasks' | 'shop' | 'leaderboard'>('tasks');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      console.log('Auth state changed, user:', firebaseUser?.uid);
      if (firebaseUser) {
        try {
          const idTokenResult = await firebaseUser.getIdTokenResult(true);
          (firebaseUser as CustomUser).admin = idTokenResult.claims.admin === true;
          setUser(firebaseUser as CustomUser);
          setIsAuthenticated(true); // Sync authentication state
        } catch (error) {
          console.error('Error in onAuthStateChanged:', error);
          setUser(null);
          setCurrentUserData(null);
          setApprovedSubmissions([]);
          setIsAuthenticated(false);
        }
      } else {
        setUser(null);
        setCurrentUserData(null);
        setApprovedSubmissions([]);
        setIsAuthenticated(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !isAuthenticated) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const token = await user.getIdToken(true);
        console.log('Firebase token:', token);
        if (!token) {
          console.error('No ID token available');
          setErrorMessage('Authentication token unavailable. Please log in again.');
          setIsLoading(false);
          return;
        }
        await Promise.all([
          fetchTasks(token),
          user.admin ? fetchPendingSubmissions(token) : fetchApprovedSubmissions(token),
          fetchShopItems(token),
          fetchLeaderboard(token),
        ]);
      } catch (error) {
        console.error('Error fetching data:', error);
        setErrorMessage('Failed to fetch data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [user, isAuthenticated]);

  const fetchTasks = async (token: string) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      console.log('Fetching tasks with URL:', `${apiUrl}/api/tasks`, 'Headers:', { Authorization: `Bearer ${token}` });
      const res = await fetch(`${apiUrl}/api/tasks`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Response status:', res.status, 'Response text:', errorText);
        throw new Error(`Failed to fetch tasks: ${res.status} - ${errorText}`);
      }
      const tasksData = await res.json();
      console.log('Fetched tasks:', tasksData);
      setTasks(tasksData);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      throw error;
    }
  };

  const fetchPendingSubmissions = async (token: string) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      console.log('Fetching pending submissions with URL:', `${apiUrl}/api/tasks/submissions/pending`, 'Headers:', { Authorization: `Bearer ${token}` });
      const res = await fetch(`${apiUrl}/api/tasks/submissions/pending`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Response status:', res.status, 'Response text:', errorText);
        throw new Error(`Failed to fetch submissions: ${res.status} - ${errorText}`);
      }
      const submissionsData = await res.json();
      console.log('Fetched pending submissions:', submissionsData);
      setSubmissions(submissionsData);
    } catch (error) {
      console.error('Error fetching submissions:', error);
      throw error;
    }
  };

  const fetchApprovedSubmissions = async (token: string) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      console.log('Fetching approved submissions with URL:', `${apiUrl}/api/tasks/submissions/approved`, 'Headers:', { Authorization: `Bearer ${token}` });
      const res = await fetch(`${apiUrl}/api/tasks/submissions/approved`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Response status:', res.status, 'Response text:', errorText);
        throw new Error(`Failed to fetch approved submissions: ${res.status} - ${errorText}`);
      }
      const approvedData = await res.json();
      console.log('Fetched approved submissions:', approvedData);
      setApprovedSubmissions(approvedData);
    } catch (error) {
      console.error('Error fetching approved submissions:', error);
      throw error;
    }
  };

  const fetchShopItems = async (token: string) => {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      console.log('Fetching shop items with URL:', `${apiUrl}/api/shop`, 'Headers:', { Authorization: `Bearer ${token}` });
      const res = await fetch(`${apiUrl}/api/shop`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Response status:', res.status, 'Response text:', errorText);
        throw new Error(`Failed to fetch shop items: ${res.status} - ${errorText}`);
      }
      const shopData = await res.json();
      console.log('Fetched shop items:', shopData);
      setShopItems(shopData);
    } catch (error) {
      console.error('Error fetching shop items:', error);
      throw error;
    }
  };

  const fetchLeaderboard = async (token: string) => {
    if (!user?.uid) {
      console.log('Skipping leaderboard fetch: user not fully authenticated yet');
      return;
    }

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      console.log('Fetching leaderboard with URL:', `${apiUrl}/api/leaderboard`, 'Headers:', { Authorization: `Bearer ${token}` });
      const res = await fetch(`${apiUrl}/api/leaderboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Response status:', res.status, 'Response text:', errorText);
        throw new Error(`Failed to fetch leaderboard: ${res.status} - ${errorText}`);
      }
      const leaderboardData = await res.json();
      console.log('Fetched leaderboard:', leaderboardData);
      setLeaderboard(leaderboardData);

      if (user.admin) {
        console.log('Skipping current user data fetch: user is an admin');
        setCurrentUserData({ uid: user.uid, email: user.email || '', points: 0, tokens: 0 });
        return;
      }

      const userData = leaderboardData.find((u: UserData) => u.email === user.email || u.uid === user.uid);
      if (!userData) {
        console.warn('Current user not found in leaderboard:', { email: user.email, uid: user.uid });
        setErrorMessage('You are not on the leaderboard yet. Complete tasks to earn points!');
        setCurrentUserData({ uid: user.uid, email: user.email || '', points: 0, tokens: 0 });
      } else {
        console.log('Current user data:', userData);
        setCurrentUserData(userData);
      }
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
      throw error;
    }
  };

  const handleLogin = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      if (!email || !password) {
        throw new Error('Email and password are required');
      }
      const auth = getAuth();
      await signInWithEmailAndPassword(auth, email, password);
      const currentUser = auth.currentUser;
      if (currentUser) {
        await currentUser.getIdToken(true);
        setIsAuthenticated(true);
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
      const auth = getAuth();
      await createUserWithEmailAndPassword(auth, email, password);
      setSuccessMessage('Sign-up successful! You can now log in.');
      setIsSignUp(false);
    } catch (error: any) {
      console.error('Sign-up error:', error);
      setErrorMessage(error.message || 'Failed to sign up. Please try again.');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(getAuth());
      setIsAuthenticated(false);
      setUser(null);
      setCurrentUserData(null);
      setTasks([]);
      setSubmissions([]);
      setApprovedSubmissions([]);
      setShopItems([]);
      setLeaderboard([]);
    } catch (error) {
      console.error('Logout error:', error);
      setErrorMessage('Failed to logout. Please try again.');
    }
  };

  const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const token = await getAuth().currentUser?.getIdToken(true);
      if (!token) {
        throw new Error('No token available');
      }
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await fetch(`${apiUrl}/api/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: taskTitle,
          description: taskDescription,
          points: Number(taskPoints),
        }),
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Response status:', res.status, 'Response text:', errorText);
        throw new Error(`Failed to create task: ${res.status} - ${errorText}`);
      }
      await fetchTasks(token);
      setTaskTitle('');
      setTaskDescription('');
      setTaskPoints('');
      setSuccessMessage('Task created successfully!');
    } catch (error) {
      console.error('Error creating task:', error);
      setErrorMessage('Failed to create task. Please try again.');
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
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await fetch(`${apiUrl}/api/tasks/all`, {
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
      await fetchTasks(token);
      await fetchPendingSubmissions(token);
      await fetchLeaderboard(token);
    } catch (error: any) {
      console.error('Error deleting all tasks:', error);
      setErrorMessage(error.message);
    }
  };

  const handleSubmitTask = async (taskId: string) => {
    try {
      const token = await getAuth().currentUser?.getIdToken(true);
      if (!token) {
        throw new Error('No token available');
      }
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      console.log('Submitting task with URL:', `${apiUrl}/api/tasks/${taskId}/submit`, 'Headers:', { Authorization: `Bearer ${token}` });
      const res = await fetch(`${apiUrl}/api/tasks/${taskId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to submit task');
      }
      await fetchTasks(token);
      await fetchLeaderboard(token);
      setSuccessMessage('Task submitted successfully!');
    } catch (error: any) {
      console.error('Error submitting task:', error);
      setErrorMessage(error.message || 'Failed to submit task.');
    }
  };

  const handleApproveSubmission = async (submissionId: string) => {
    setSubmissionError(null);
    try {
      const token = await getAuth().currentUser?.getIdToken(true);
      if (!token) {
        throw new Error('No token available');
      }
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await fetch(`${apiUrl}/api/tasks/${submissionId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to approve submission');
      }
      await fetchPendingSubmissions(token);
      await fetchLeaderboard(token);
      setSuccessMessage('Submission approved successfully!');
    } catch (error: any) {
      console.error('Error approving submission:', error);
      setSubmissionError(error.message);
    }
  };

  const handleRedeemItem = async (itemId: string) => {
    try {
      const token = await getAuth().currentUser?.getIdToken(true);
      if (!token) {
        throw new Error('No token available');
      }
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
      const res = await fetch(`${apiUrl}/api/shop/redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ itemId }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to redeem item');
      }
      await fetchShopItems(token);
      await fetchLeaderboard(token);
      setSuccessMessage('Item redeemed successfully!');
    } catch (error: any) {
      console.error('Error redeeming item:', error);
      setErrorMessage(error.message || 'Failed to redeem item.');
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
      <header className="app-header">
        <h1 className="app-title">
          <img 
            src="/images/img25-removebg-preview.png" 
            alt="GRiD Logo" 
            className="header-logo" 
          />
        </h1>
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
                  submissions.map((submission) => (
                    <div key={submission._id} className="card">
                      <p>
                        Task:{' '}
                        {typeof submission.taskId === 'string'
                          ? `Task ID: ${submission.taskId}`
                          : submission.taskId.title}
                      </p>
                      <p>User: {submission.userId.email || 'Unknown Email'} (ID: {submission.userId.uid || 'N/A'})</p>
                      <p>Status: {submission.status}</p>
                      <button
                        onClick={() => handleApproveSubmission(submission._id)}
                        className="button button-primary"
                        disabled={submission.status === 'approved'}
                      >
                        {submission.status === 'approved' ? 'Approved' : 'Approve'}
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            <h2 className="section-title">Tasks</h2>
            {tasks.length === 0 ? (
              <p className="empty-message">No tasks available.</p>
            ) : (
              tasks.map((task) => (
                <div key={task._id} className="card">
                  <h3 className="card-title">{task.title}</h3>
                  <p className="card-description">{task.description}</p>
                  <p className="card-points">Points: {task.points}</p>
                  {!user.admin && (
                    <button
                      onClick={() => handleSubmitTask(task._id)}
                      className="button button-primary"
                    >
                      Submit Completion
                    </button>
                  )}
                </div>
              ))
            )}

            {!user.admin && (
              <div className="submissions-section">
                <h2 className="section-title">Previous Submissions</h2>
                {approvedSubmissions.length === 0 ? (
                  <p className="empty-message">No approved submissions yet.</p>
                ) : (
                  approvedSubmissions.map((submission) => (
                    <div key={submission._id} className="card">
                      {typeof submission.taskId === 'string' ? (
                        <p>Task data unavailable (ID: {submission.taskId})</p>
                      ) : (
                        <>
                          <h3 className="card-title">{submission.taskId.title}</h3>
                          <p className="card-description">{submission.taskId.description}</p>
                          <p className="card-points">Points Earned: {submission.taskId.points}</p>
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
            {shopItems.length === 0 ? (
              <p className="empty-message">No shop items available.</p>
            ) : (
              shopItems.map((item) => (
                <div key={item._id} className="card">
                  <h3 className="card-title">{item.name}</h3>
                  <p className="card-description">{item.description}</p>
                  <p className="card-points">Cost: {item.tokenCost} tokens</p>
                  <button
                    onClick={() => handleRedeemItem(item._id)}
                    className="button button-secondary"
                  >
                    Redeem
                  </button>
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
              leaderboard.map((userData, index) => (
                <div key={userData.uid} className="card">
                  <p>
                    Rank {index + 1}: {userData.email} (ID: {userData.uid}) - {userData.points} points
                  </p>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
};
                
export default App;