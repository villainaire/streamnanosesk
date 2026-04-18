import { Link, useNavigate } from "react-router-dom";
import { LogOut, Tv, Settings, LogIn, Disc } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { logOut } from "../lib/firebase";

export default function Navbar() {
  const { user, appUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logOut();
    navigate("/login");
  };

  return (
    <nav className="border-b border-white/5 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-2">
            <Link to="/admin" className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-red-600 blur-lg opacity-30 group-hover:opacity-60 transition-opacity" />
                <div className="relative bg-gradient-to-br from-red-500 to-red-600 p-2 rounded-xl">
                  <Tv className="w-5 h-5 text-white" />
                </div>
              </div>
              <span className="font-black text-xl italic uppercase tracking-tighter hidden sm:block">
                Stream<span className="text-red-500">Link</span>
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-6">
            {user ? (
              <>
                <div className="hidden md:flex items-center gap-6 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
                  <Link to="/admin" className="hover:text-red-500 transition-colors py-1">Stations</Link>
                  {appUser?.role === 'admin' && (
                    <Link to="/admin/users" className="hover:text-red-500 transition-colors flex items-center gap-2 py-1">
                      <Settings className="w-3.5 h-3.5" /> Access Control
                    </Link>
                  )}
                </div>
                
                <div className="flex items-center gap-3 pl-6 border-l border-white/5">
                  <div className="flex flex-col items-end hidden sm:flex">
                    <span className="text-sm font-bold tracking-tight">{user.displayName || (appUser?.role === 'admin' ? "Super Admin" : "User")}</span>
                    <div className="flex items-center gap-1.5">
                       <Disc className={`w-3 h-3 ${appUser?.role === 'admin' ? 'text-red-500 animate-pulse' : 'text-blue-500'}`} />
                       <span className="text-[9px] text-zinc-500 uppercase font-bold tracking-wider">{appUser?.role || 'user'}</span>
                    </div>
                  </div>
                  <button 
                    onClick={handleLogout}
                    className="p-2.5 rounded-xl bg-zinc-900 border border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all active:scale-95"
                    title="Logout"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <Link 
                to="/login"
                className="flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-xl text-xs font-black uppercase tracking-wider transition-all hover:scale-105 active:scale-95"
              >
                <LogIn className="w-4 h-4" /> Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
