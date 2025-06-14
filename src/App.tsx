import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import type { User } from 'firebase/auth';
import './App.css';

// Define a custom user type that includes the admin claim
interface CustomUser extends User {
  admin?: boolean;
}

// Initialize Firebase (Add your Firebase config here)
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
  userId: { _id: string; name: string };
  status: string;
}

// Interface for approved submissions (user view)
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
  const [isSignUp, setIsSignUp] = useState(false); // Toggle between login and sign-up forms
  const [errorMessage, setErrorMessage] = useState<string | null>(null); // For error feedback
  const [successMessage, setSuccessMessage] = useState<string | null>(null); // For success feedback

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const idTokenResult = await firebaseUser.getIdTokenResult(true);
          const customUser = {
            ...firebaseUser,
            admin: idTokenResult.claims.admin === true,
          };
          setUser(customUser);

          const token = await firebaseUser.getIdToken();
          if (!token) {
            console.error('No ID token available');
            return;
          }

          fetchTasks();
          if (customUser.admin) {
            fetchPendingSubmissions();
          } else {
            fetchApprovedSubmissions(); // Fetch approved submissions for non-admins
          }
          fetchShopItems();
          fetchLeaderboard();
        } catch (error) {
          console.error('Error in onAuthStateChanged:', error);
          setUser(null);
          setCurrentUserData(null);
        }
      } else {
        setUser(null);
        setCurrentUserData(null);
        setApprovedSubmissions([]); // Clear approved submissions on logout
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchTasks = async () => {
    const res = await fetch('http://localhost:3000/api/tasks', {
      headers: { Authorization: `Bearer ${await getAuth().currentUser?.getIdToken()}` },
    });
    setTasks(await res.json());
  };

  const fetchPendingSubmissions = async () => {
    const res = await fetch('http://localhost:3000/api/tasks/submissions/pending', {
      headers: { Authorization: `Bearer ${await getAuth().currentUser?.getIdToken()}` },
    });
    setSubmissions(await res.json());
  };

  const fetchApprovedSubmissions = async () => {
    const res = await fetch('http://localhost:3000/api/tasks/submissions/approved', {
      headers: { Authorization: `Bearer ${await getAuth().currentUser?.getIdToken()}` },
    });
      setApprovedSubmissions(await res.json());
  };

  const fetchShopItems = async () => {
    const res = await fetch('http://localhost:3000/api/shop', {
      headers: { Authorization: `Bearer ${await getAuth().currentUser?.getIdToken()}` },
    });
    setShopItems(await res.json());
  };

  const fetchLeaderboard = async () => {
    const res = await fetch('http://localhost:3000/api/leaderboard', {
      headers: { Authorization: `Bearer ${await getAuth().currentUser?.getIdToken()}` },
    });
    setLeaderboard(await res.json());
  };

  const handleLogin = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await signInWithEmailAndPassword(getAuth(), email, password);
      setSuccessMessage('Login successful!');
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to login. Please check your credentials.');
    }
  };

  const handleSignUp = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await createUserWithEmailAndPassword(getAuth(), email, password);
      setSuccessMessage('Sign-up successful! You can now log in.');
      setIsSignUp(false); // Switch back to login form after successful sign-up
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to sign up. Please try again.');
    }
  };

  const handleLogout = async () => {
    await signOut(getAuth());
  };

  const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await fetch('http://localhost:3000/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await getAuth().currentUser?.getIdToken()}`,
      },
      body: JSON.stringify({
        title: formData.get('title'),
        description: formData.get('description'),
        points: Number(formData.get('points')),
      }),
    });
    fetchTasks();
  };

  const handleSubmitTask = async (taskId: string) => {
      await fetch(`http://localhost:3000/api/tasks/${taskId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await getAuth().currentUser?.getIdToken()}` },
      });
      fetchTasks(); // Refresh the task list (submitted task will be removed)
  };

  const handleApproveSubmission = async (submissionId: string) => {
    await fetch(`http://localhost:3000/api/tasks/${submissionId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await getAuth().currentUser?.getIdToken()}` },
    });
    fetchPendingSubmissions();
    fetchLeaderboard();
  };

  const handleRedeemItem = async (itemId: string) => {
    await fetch('http://localhost:3000/api/shop/redeem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${await getAuth().currentUser?.getIdToken()}`,
      },
      body: JSON.stringify({ itemId }),
    });
    fetchShopItems();
    fetchLeaderboard();
  };

  if (!user) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">{isSignUp ? 'Sign Up' : 'Login'}</h1>
        {errorMessage && <p className="text-red-500 mb-4">{errorMessage}</p>}
        {successMessage && <p className="text-green-500 mb-4">{successMessage}</p>}
        <div className="mb-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="border p-2 mr-2"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="border p-2 mr-2"
          />
          {isSignUp ? (
            <button onClick={handleSignUp} className="bg-blue-500 text-white p-2 rounded">
              Sign Up
            </button>
          ) : (
            <button onClick={handleLogin} className="bg-blue-500 text-white p-2 rounded">
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
          className="text-blue-500 underline"
        >
          {isSignUp ? 'Already have an account? Login' : 'Need an account? Sign Up'}
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Task Completion App</h1>
      <div className="mb-4">
        <p className="text-lg">
          Welcome, {currentUserData?.uid || user.email}!
        </p>
      <button onClick={handleLogout} className="bg-red-500 text-white p-2 rounded mb-4">
        Logout
      </button></div>

      {user.admin && (
        <div className="mb-8">
          <h2 className="text-xl font-bold mb-2">Create Task</h2>
          <form onSubmit={handleCreateTask} className="mb-4">
            <input name="title" placeholder="Title" className="border p-2 mr-2" />
            <input name="description" placeholder="Description" className="border p-2 mr-2" />
            <input name="points" type="number" placeholder="Points" className="border p-2 mr-2" />
            <button type="submit" className="bg-green-500 text-white p-2 rounded">
              Create Task
            </button>
          </form>

          <h2 className="text-xl font-bold mb-2">Pending Submissions</h2>
          {submissions.map((submission) => (
            <div key={submission._id} className="border p-2 mb-2">
              <p>Task:{' '}
              {typeof submission.taskId === 'string'
                ? `Task ID: ${submission.taskId}`
                : submission.taskId.title}</p>
              <button
                onClick={() => handleApproveSubmission(submission._id)}
                className="bg-blue-500 text-white p-2 rounded"
              >
                Approve
              </button>
            </div>
          ))}
        </div>
      )}

      <h2 className="text-xl font-bold mb-2">Tasks</h2>
      {tasks.map((task) => (
        <div key={task._id} className="border p-2 mb-2">
          <h3 className="font-bold">{task.title}</h3>
          <p>{task.description}</p>
          <p>Points: {task.points}</p>
          {!user.admin && (
              <button
                onClick={() => handleSubmitTask(task._id)}
                className="bg-blue-500 text-white p-2 rounded"
              >
                Submit Completion
              </button>
            )}
        </div>
      ))}

      {!user.admin && (
        <div className="mt-8">
          <h2 className="text-xl font-bold mb-2">Previous Submissions</h2>
          {approvedSubmissions.length === 0 ? (
            <p>No approved submissions yet.</p>
          ) : (
            approvedSubmissions.map((submission) => (
              <div key={submission._id} className="border p-2 mb-2">
                {typeof submission.taskId === 'string' ? (
            <p>Task data unavailable (ID: {submission.taskId})</p>
          ) : (
            <>
                <h3 className="font-bold">{submission.taskId.title}</h3>
                <p>{submission.taskId.description}</p>
                <p>Points Earned: {submission.taskId.points}</p>
            </>
          )}
            </div>
            ))
          )}
        </div>
      )}

      <h2 className="text-xl font-bold mb-2">Shop</h2>
      {shopItems.map((item) => (
        <div key={item._id} className="border p-2 mb-2">
          <h3 className="font-bold">{item.name}</h3>
          <p>{item.description}</p>
          <p>Cost: {item.tokenCost} tokens</p>
          <button
            onClick={() => handleRedeemItem(item._id)}
            className="bg-purple-500 text-white p-2 rounded"
          >
            Redeem
          </button>
        </div>
      ))}

      <h2 className="text-xl font-bold mb-2">Leaderboard</h2>
      {leaderboard.map((user, index) => (
        <div key={user.uid} className="border p-2 mb-2">
          <p>Rank {index + 1}: User {user.uid} - {user.points} points, {user.tokens} tokens</p>
        </div>
      ))}
    </div>
  );
};

export default App;