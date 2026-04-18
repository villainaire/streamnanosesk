/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import Player from "./pages/Player";
import ChannelDetail from "./pages/ChannelDetail";
import UserManagement from "./pages/UserManagement";
import Navbar from "./components/Navbar";

function AppContent() {
  const { appUser, loading } = useAuth();
  const location = useLocation();
  
  // Explicit check to hide Navbar on the broadcast page
  const isPlayerPage = location.pathname.includes('/play/');

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-white">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-red-600"></div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-zinc-950 text-white font-sans selection:bg-red-500/30 ${isPlayerPage ? 'overflow-hidden' : ''}`}>
      {!isPlayerPage && <Navbar />}
      <main>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          {/* Player route is public */}
          <Route path="/play/:channelSlug" element={<Player />} />

          {/* Admin routes protected */}
          <Route 
            path="/admin" 
            element={appUser ? <AdminDashboard /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/admin/channel/:channelId" 
            element={appUser ? <ChannelDetail /> : <Navigate to="/login" />} 
          />
          <Route 
            path="/admin/users" 
            element={appUser?.role === 'admin' ? <UserManagement /> : <Navigate to="/admin" />} 
          />

          <Route path="*" element={<Navigate to="/admin" />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

