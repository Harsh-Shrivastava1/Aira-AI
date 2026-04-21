import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/config/firebase";
import { syncUserDoc } from "./hooks/useFirestore";
import Login from "./pages/Login";
import Agent from "./pages/Agent";

function App() {
  const [user, setUser] = useState(undefined); // undefined = still resolving

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser ?? null);
      if (currentUser) {
        syncUserDoc(currentUser);
      }
    });
    return () => unsubscribe();
  }, []);

  // Show spinner until Firebase tells us definitively who the user is
  if (user === undefined) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#050508]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
          <p className="text-slate-500 text-xs tracking-widest uppercase font-mono">
            Initializing AIRA...
          </p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/agent" replace /> : <Login />} />
        <Route path="/agent" element={user ? <Agent user={user} /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
