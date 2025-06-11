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

interface Submission {
  _id: string;
  taskId: string;
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
  email: string; // Add email field
  points: number;
  tokens: number;
}

const App: React.FC = () => {
  const [user, setUser] = useState<CustomUser | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [shopItems, setShopItems] = useState<ShopItem[]>([]);
  const [leaderboard, setLeaderboard] = useState<UserData[]>([]);
  const [currentUserData, setCurrentUserData] = useState<UserData | null>(null); // Store logged-in user's data
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        const idTokenResult = await firebaseUser.getIdTokenResult();
        const customUser = {
          ...firebaseUser,
          admin: idTokenResult.claims.admin === true,
        };
        setUser(customUser);
        fetchTasks();
        if (customUser.admin) fetchPendingSubmissions();
        fetchShopItems();
        fetchLeaderboard();
      } else {
        setUser(null);
        setCurrentUserData(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/tasks', {
        headers: { Authorization: `Bearer ${await getAuth().currentUser?.getIdToken()}` },
      });
      if (!res.ok) throw new Error('Failed to fetch tasks');
      setTasks(await res.json());
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const fetchPendingSubmissions = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/tasks/submissions/pending', {
        headers: { Authorization: `Bearer ${await getAuth().currentUser?.getIdToken()}` },
      });
      if (!res.ok) throw new Error('Failed to fetch submissions');
      setSubmissions(await res.json());
    } catch (error) {
      console.error('Error fetching submissions:', error);
    }
  };

  const fetchShopItems = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/shop', {
        headers: { Authorization: `Bearer ${await getAuth().currentUser?.getIdToken()}` },
      });
      if (!res.ok) throw new Error('Failed to fetch shop items');
      setShopItems(await res.json());
    } catch (error) {
      console.error('Error fetching shop items:', error);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/leaderboard', {
        headers: { Authorization: `Bearer ${await getAuth().currentUser?.getIdToken()}` },
      });
      if (!res.ok) throw new Error('Failed to fetch leaderboard');
      const leaderboardData = await res.json();
      console.log('Leaderboard data:', leaderboardData); // Debug log
      setLeaderboard(leaderboardData);
      const userData = leaderboardData.find((u: UserData) => u.uid === user?.uid);
      console.log('Current user data:', userData); // Debug log
      setCurrentUserData(userData || { uid: user?.uid || '', points: 0, tokens: 0 });
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
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
      setIsSignUp(false);
    } catch (error: any) {
      setErrorMessage(error.message || 'Failed to sign up. Please try again.');
    }
  };

  const handleLogout = async () => {
    await signOut(getAuth());
  };

  const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      const formData = new FormData(e.currentTarget);
      const res = await fetch('http://localhost:3000/api/tasks', {
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
      if (!res.ok) throw new Error('Failed to create task');
      fetchTasks();
    } catch (error) {
      console.error('Error creating task:', error);
    }
  };

  const handleSubmitTask = async (taskId: string) => {
    try {
      const res = await fetch(`http://localhost:3000/api/tasks/${taskId}/submit`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await getAuth().currentUser?.getIdToken()}` },
      });
      if (!res.ok) throw new Error('Failed to submit task');
      fetchTasks();
    } catch (error) {
      console.error('Error submitting task:', error);
    }
  };

  const handleApproveSubmission = async (submissionId: string) => {
    try {
      const res = await fetch(`http://localhost:3000/api/tasks/${submissionId}/approve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${await getAuth().currentUser?.getIdToken()}` },
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to approve submission');
      }
      // Fetch both pending submissions and leaderboard to update the UI
      await Promise.all([fetchPendingSubmissions(), fetchLeaderboard()]);
    } catch (error: any) {
      console.error('Error approving submission:', error.message);
      alert(error.message);
    }
  };

  const handleRedeemItem = async (itemId: string) => {
    try {
      const res = await fetch('http://localhost:3000/api/shop/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${await getAuth().currentUser?.getIdToken()}`,
        },
        body: JSON.stringify({ itemId }),
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to redeem item');
      }
      fetchShopItems();
      fetchLeaderboard();
    } catch (error: any) {
      console.error('Error redeeming item:', error.message);
      alert(error.message); // Show error to user
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto p-4 max-w-md">
        <h1 className="text-2xl font-bold mb-4">{isSignUp ? 'Sign Up' : 'Login'}</h1>
        {errorMessage && <p className="text-red-500 mb-4 p-2 bg-red-100 rounded">{errorMessage}</p>}
        {successMessage && <p className="text-green-500 mb-4 p-2 bg-green-100 rounded">{successMessage}</p>}
        <div className="mb-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="border p-2 mr-2 w-full mb-2 rounded"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="border p-2 mr-2 w-full mb-2 rounded"
          />
          {isSignUp ? (
            <button onClick={handleSignUp} className="bg-blue-500 text-white p-2 rounded w-full">
              Sign Up
            </button>
          ) : (
            <button onClick={handleLogin} className="bg-blue-500 text-white p-2 rounded w-full">
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
          Welcome, {user.email}! Your Score: {currentUserData?.points || 0} points, {currentUserData?.tokens || 0} tokens
        </p>
        <button onClick={handleLogout} className="bg-red-500 text-white p-2 rounded">
          Logout
        </button>
      </div>

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
              <p>Task ID: {submission.taskId}</p>
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
            {/* Only show the Submit Completion button for non-admin users */}
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

      <h2 className="text-xl font-bold mb-2">Shop</h2>
      {shopItems.length === 0 ? (
        <p>No shop items available.</p>
      ) : (
        shopItems.map((item) => (
          <div key={item._id} className="border p-2 mb-2">
            <h3 className="font-bold">{item.name}</h3>
            <p>{item.description}</p>
            <p>Cost: {item.tokenCost} tokens</p>
            <button
              onClick={() => handleRedeemItem(item._id)}
              className="bg-purple-500 text-white p-2 rounded"
              disabled={(currentUserData?.tokens || 0) < item.tokenCost}
            >
              Redeem
            </button>
          </div>
        ))
      )}

        <h2 className="text-xl font-bold mb-2">Leaderboard</h2>
        {leaderboard.length === 0 ? (
          <p>No users on the leaderboard yet.</p>
        ) : (
          leaderboard.map((user, index) => (
            <div
              key={user.uid}
              className="border p-2 mb-2 cursor-pointer hover:bg-gray-100"
              onClick={() => alert(`Clicked on ${user.email}! Points: ${user.points}, Tokens: ${user.tokens}`)}
            >
              <p>Rank {index + 1}: {user.email} - {user.points} points, {user.tokens} tokens</p>
            </div>
          ))
        )}
    </div>
  );
};

export default App;