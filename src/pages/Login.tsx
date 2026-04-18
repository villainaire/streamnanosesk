import React, { useState } from "react";
import { Tv, ExternalLink, AlertCircle, ShieldCheck } from "lucide-react";
import { signIn } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import { motion, AnimatePresence } from "motion/react";
import { Navigate } from "react-router-dom";

export default function Login() {
  const { user, appUser } = useAuth();
  const [error, setError] = useState<string | null>(null);

  if (user && appUser) {
    return <Navigate to="/admin" />;
  }

  const handleSignIn = async () => {
    setError(null);
    try {
      await signIn();
    } catch (err: any) {
      console.error("Sign in failed:", err);
      if (err.code === "auth/popup-blocked") {
        setError("Popup blocked! Please allow popups or open in a new tab.");
      } else if (err.code === "auth/unauthorized-domain") {
        setError("Domain not authorized. Please add this URL to Firebase Settings.");
      } else {
        setError(err.message || "Sign in failed. Please try again.");
      }
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] relative flex items-center justify-center p-4 overflow-hidden">
      {/* Immersive Background Elements */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-zinc-600/10 rounded-full blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", damping: 20, stiffness: 100 }}
        className="relative z-10 max-w-md w-full bg-zinc-900/40 border border-white/5 p-8 rounded-[32px] backdrop-blur-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)]"
      >
        <div className="flex flex-col items-center text-center space-y-8">
          <motion.div 
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            className="relative"
          >
            <div className="absolute inset-0 bg-red-600 blur-2xl opacity-40 rounded-full" />
            <div className="relative bg-gradient-to-br from-red-500 to-red-700 p-5 rounded-[24px] shadow-2xl">
              <Tv className="w-10 h-10 text-white" />
            </div>
          </motion.div>
          
          <div className="space-y-2">
            <h1 className="text-4xl font-black italic uppercase tracking-tighter leading-tight">
              Control <span className="text-red-500">Center</span>
            </h1>
            <p className="text-zinc-400 font-medium text-sm">Sign in to manage broadcast feeds and live playlists</p>
          </div>

          <AnimatePresence mode="wait">
            {user && !appUser && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="w-full p-4 bg-red-500/5 border border-red-500/10 rounded-2xl flex items-start gap-3 text-left overflow-hidden"
              >
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-red-500">Access Restricted</p>
                  <p className="text-[11px] leading-relaxed text-zinc-400">
                    Aapka account ({user.email}) authorize nahi hai. Admin se sampark karein.
                  </p>
                </div>
              </motion.div>
            )}

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full p-4 bg-zinc-800/80 border border-white/5 rounded-2xl text-[11px] font-mono text-red-400/90 leading-relaxed text-left"
              >
                <div className="flex items-center gap-2 mb-1">
                   <AlertCircle className="w-3 h-3" />
                   <span className="font-bold uppercase tracking-wider">System Error</span>
                </div>
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="w-full space-y-4">
            <button
              onClick={handleSignIn}
              className="w-full flex items-center justify-center gap-3 bg-white text-black font-black py-4 px-6 rounded-2xl hover:bg-zinc-100 transition-all active:scale-[0.98] group shadow-xl"
            >
              <img 
                src="https://www.google.com/favicon.ico" 
                alt="Google" 
                className="w-5 h-5 group-hover:rotate-12 transition-transform" 
                referrerPolicy="no-referrer"
              />
              Continue with Google
            </button>

            <a
              href={window.location.href}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 text-zinc-500 hover:text-white text-xs font-bold uppercase tracking-widest py-2 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open in New Tab
            </a>
          </div>

          <div className="flex items-center gap-2 pt-4 opacity-30 select-none">
            <ShieldCheck className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-widest">Authorized Access Only</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
