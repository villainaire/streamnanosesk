import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import { Plus, Trash2, ExternalLink, Tv, Radio, Edit2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";

interface Channel {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: any;
}

export default function AdminDashboard() {
  const { user, appUser } = useAuth();
  const navigate = useNavigate();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [editChannelName, setEditChannelName] = useState("");

  useEffect(() => {
    if (!user) return;

    // ALL users can see ALL channels
    const q = query(collection(db, "channels"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setChannels(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Channel)));
    });

    return unsubscribe;
  }, [user]);

  const handleCreateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChannelName || !user || appUser?.role !== 'admin') return;

    const slug = newChannelName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    try {
      await addDoc(collection(db, "channels"), {
        name: newChannelName,
        slug,
        ownerId: user.uid,
        createdAt: serverTimestamp()
      });
      setNewChannelName("");
      setIsAdding(false);
    } catch (err) {
      console.error("Create channel error:", err);
    }
  };

  const handleUpdateChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editChannelName || !user || !editingChannel || appUser?.role !== 'admin') return;

    const slug = editChannelName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    
    try {
      await updateDoc(doc(db, "channels", editingChannel.id), {
        name: editChannelName,
        slug,
        updatedAt: serverTimestamp()
      });
      setEditChannelName("");
      setEditingChannel(null);
    } catch (err) {
      console.error("Update channel error:", err);
    }
  };

  const handleDeleteChannel = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this channel? All videos will be lost.")) return;
    
    try {
      await deleteDoc(doc(db, "channels", id));
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
             <div className="w-12 h-0.5 bg-red-600" />
             <span className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">Dashboard Area</span>
          </div>
          <h1 className="text-6xl font-black italic uppercase tracking-tighter leading-none">
            Active <span className="text-zinc-600 italic">Stations</span>
          </h1>
        </div>
        
        {appUser?.role === 'admin' && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-3 bg-white text-black font-black py-4 px-8 rounded-2xl transition-all shadow-2xl hover:scale-105 active:scale-95 group"
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" /> Create New Feed
          </button>
        )}
      </div>

      <AnimatePresence>
        {isAdding && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-zinc-900 border border-white/5 p-10 rounded-[32px] max-w-md w-full shadow-2xl"
            >
              <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-8">Channel Identity</h2>
              <form onSubmit={handleCreateChannel} className="space-y-8">
                <div>
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-3 block">Station Name</label>
                  <input
                    autoFocus
                    type="text"
                    value={newChannelName}
                    onChange={(e) => setNewChannelName(e.target.value)}
                    placeholder="e.g. NEWS GLOBAL"
                    className="w-full bg-black border border-white/5 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all text-xl font-bold placeholder:text-zinc-800"
                  />
                </div>
                <div className="flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 px-6 py-4 bg-zinc-800 hover:bg-zinc-700 rounded-2xl font-black uppercase text-xs tracking-widest transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-4 bg-red-600 hover:bg-red-500 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-red-600/20"
                  >
                    Launch
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
        {editingChannel && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-white/5 p-10 rounded-[32px] max-w-md w-full shadow-2xl relative overflow-hidden"
            >
               <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 blur-[100px] -mr-32 -mt-32" />
               
               <div className="relative space-y-8">
                  <div className="space-y-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-500">Configuration</span>
                    <h2 className="text-3xl font-black italic uppercase tracking-tighter">Edit Station</h2>
                  </div>

                  <form onSubmit={handleUpdateChannel} className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 ml-1">New Broadcast Name</label>
                      <input
                        autoFocus
                        type="text"
                        value={editChannelName}
                        onChange={(e) => setEditChannelName(e.target.value)}
                        placeholder="ENTER STATION NAME..."
                        className="w-full bg-black border border-white/5 p-6 rounded-2xl text-xl font-black uppercase tracking-tight focus:border-blue-600 outline-none transition-all placeholder:text-zinc-800"
                        required
                      />
                      <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider mt-2">Warning: Changing name will update the public link slug.</p>
                    </div>
                    
                    <div className="flex gap-4">
                       <button
                         type="button"
                         onClick={() => setEditingChannel(null)}
                         className="flex-1 py-4 px-6 rounded-2xl font-black uppercase tracking-widest text-[10px] bg-zinc-800 hover:bg-zinc-700 transition-all shadow-xl"
                       >
                         Abort
                       </button>
                       <button
                         type="submit"
                         className="flex-[2] py-4 px-6 rounded-2xl font-black uppercase tracking-widest text-[10px] bg-blue-600 text-white hover:bg-blue-500 transition-all shadow-[0_0_30px_rgba(59,130,246,0.3)] shadow-blue-600/20 active:scale-95"
                       >
                         Commit Changes
                       </button>
                    </div>
                  </form>
               </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {channels.map((channel) => (
          <motion.div
            layout
            key={channel.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="group relative bg-zinc-900/40 border border-white/5 rounded-[32px] p-2 hover:bg-zinc-900/60 transition-all duration-500"
          >
            <div 
              onClick={() => navigate(`/admin/channel/${channel.id}`)} 
              className="block p-6 space-y-6 cursor-pointer"
            >
              <div className="relative aspect-[16/10] bg-zinc-950 rounded-[24px] flex items-center justify-center overflow-hidden group-hover:shadow-[0_0_40px_rgba(220,38,38,0.1)] transition-all">
                 <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(220,38,38,0.15),transparent)] opacity-0 group-hover:opacity-100 transition-opacity" />
                 <Tv className="w-16 h-16 text-zinc-900 group-hover:text-red-600/20 transition-all duration-700 transform group-hover:scale-110" />
                 
                 <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full border border-white/5">
                   <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse shadow-[0_0_8px_rgba(220,38,38,1)]" />
                   <span className="text-[8px] font-black uppercase tracking-widest text-white">Live Broadcast</span>
                 </div>

                 <div className="absolute bottom-4 right-4 group-hover:translate-x-0 translate-x-12 opacity-0 group-hover:opacity-100 transition-all duration-500">
                    <div className="bg-red-600 p-3 rounded-full shadow-xl">
                      <Radio className="w-4 h-4 text-white animate-spin-slow" />
                    </div>
                 </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black italic uppercase tracking-tighter truncate leading-none">{channel.name}</h3>
                <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono tracking-tighter opacity-60">
                   <span className="px-2 py-0.5 bg-zinc-800 rounded">SLUG</span>
                   <span>/play/{channel.slug}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-white/5">
                <Link 
                  to={`/play/${channel.slug}`} 
                  target="_blank"
                  onClick={(e) => e.stopPropagation()}
                  className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-red-500 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Public Link
                </Link>
                {appUser?.role === 'admin' && (
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingChannel(channel);
                        setEditChannelName(channel.name);
                      }}
                      className="p-2 text-zinc-700 hover:text-blue-500 transition-colors"
                      title="Edit Name"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => handleDeleteChannel(channel.id, e)}
                      className="p-2 text-zinc-700 hover:text-red-600 transition-colors"
                      title="Delete Station"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
        
        {appUser?.role === 'admin' && (
          <button
            onClick={() => setIsAdding(true)}
            className="group relative h-full min-h-[400px] border-2 border-dashed border-white/5 rounded-[32px] p-8 flex flex-col items-center justify-center gap-6 hover:border-red-600/40 hover:bg-red-600/5 transition-all duration-500"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-zinc-800 blur-2xl group-hover:bg-red-600/20 transition-all" />
              <div className="relative w-20 h-20 bg-zinc-900 border border-white/5 rounded-full flex items-center justify-center group-hover:scale-110 group-hover:bg-red-600 transition-all">
                <Plus className="w-8 h-8 text-zinc-700 group-hover:text-white transition-colors" />
              </div>
            </div>
            <div className="text-center space-y-1">
              <span className="block font-black uppercase italic tracking-tighter text-xl text-zinc-500 group-hover:text-white transition-colors">Add Station</span>
              <span className="text-[10px] text-zinc-700 font-bold uppercase tracking-widest">New broadcast stream</span>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
