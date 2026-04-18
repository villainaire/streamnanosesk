import React, { useState, useEffect } from "react";
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import { Trash2, Mail, BadgeCheck, AlertCircle, ShieldCheck, ArrowLeft, Disc, User as UserIcon } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Link } from "react-router-dom";

interface AppUser {
  id: string;
  email: string;
  role: 'admin' | 'editor';
  displayName?: string;
}

export default function UserManagement() {
  const { appUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "app_users"), (snap) => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() } as AppUser)));
    });
    return unsub;
  }, []);

  const updateUserRole = async (id: string, newRole: 'admin' | 'editor') => {
    if (id === appUser?.uid) return alert("You cannot change your own role.");
    await updateDoc(doc(db, "app_users", id), { role: newRole });
  };

  const removeUser = async (id: string) => {
    if (id === appUser?.uid) return alert("You cannot remove yourself.");
    if (!confirm("Remove this user's access?")) return;
    await deleteDoc(doc(db, "app_users", id));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col gap-8 mb-16">
        <Link 
          to="/admin" 
          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-white transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-0.5 bg-red-600" />
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-3 h-3 text-red-500" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">Security Clearance</span>
            </div>
          </div>
          <h1 className="text-6xl font-black italic uppercase tracking-tighter leading-none">
            Access <span className="text-zinc-600 italic">Control</span>
          </h1>
          <p className="max-w-xl text-zinc-500 font-medium">Authorize team members to manage your broadcast feeds. Permissions are granted per-email address.</p>
        </div>
      </div>

      <div className="bg-zinc-900/40 border border-white/5 rounded-[40px] overflow-hidden shadow-2xl backdrop-blur-sm">
        <div className="p-8 lg:p-10 border-b border-white/5 flex items-start gap-4 bg-white/5">
          <div className="bg-zinc-800 p-3 rounded-[16px]">
            <AlertCircle className="w-5 h-5 text-zinc-400" />
          </div>
          <div className="space-y-1">
             <h4 className="text-sm font-black uppercase tracking-widest text-white">Manual Authorization</h4>
             <p className="text-xs text-zinc-500 leading-relaxed font-medium">To add a new user, add their email to the `app_users` collection in Firestore manually.</p>
          </div>
        </div>

        <div className="divide-y divide-white/5">
          <AnimatePresence mode="popLayout">
            {users.length === 0 ? (
               <div className="p-20 text-center space-y-4">
                 <UserIcon className="w-12 h-12 text-zinc-800 mx-auto" />
                 <p className="text-zinc-600 font-black uppercase italic tracking-widest text-xs">Only bootstrap admin has access</p>
               </div>
            ) : (
              users.map((user) => (
                <motion.div 
                  layout
                  key={user.id} 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-6">
                    <div className="relative">
                       <div className="absolute inset-0 bg-red-600 blur-lg opacity-20" />
                       <div className="relative w-16 h-16 bg-zinc-800 rounded-[20px] flex items-center justify-center border border-white/5">
                          <Mail className="w-7 h-7 text-zinc-400" />
                       </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xl font-black italic uppercase tracking-tighter">{user.displayName || "Authorized User"}</h4>
                        {user.role === 'admin' && <BadgeCheck className="w-5 h-5 text-red-500" />}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                        <Disc className={`w-3 h-3 ${user.role === 'admin' ? 'text-red-500' : 'text-zinc-600'}`} /> {user.email}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="bg-black/40 border border-white/5 p-1.5 rounded-2xl flex items-center gap-1">
                       {(['admin', 'editor'] as const).map((role) => (
                         <button
                           key={role}
                           onClick={() => updateUserRole(user.id, role)}
                           disabled={user.id === appUser?.uid}
                           className={`px-5 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${user.role === role ? 'bg-red-600 text-white shadow-xl shadow-red-600/20' : 'text-zinc-500 hover:text-zinc-300 disabled:opacity-30'}`}
                         >
                           {role}
                         </button>
                       ))}
                    </div>

                    <button 
                      onClick={() => removeUser(user.id)}
                      disabled={user.id === appUser?.uid}
                      className="p-4 bg-zinc-900 border border-white/5 text-zinc-700 hover:text-red-500 rounded-2xl transition-all active:scale-95 disabled:opacity-0"
                      title="Revoke Access"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
