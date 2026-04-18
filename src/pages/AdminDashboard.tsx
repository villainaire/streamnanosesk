import React, { useState, useEffect } from "react";
import { db } from "../lib/firebase";
import { useAuth } from "../hooks/useAuth";
import { Plus, Trash2, ExternalLink, Tv, Radio, Edit2, LayoutGrid, Monitor, LayoutList } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "motion/react";
import LivePreview from "../components/LivePreview";
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, orderBy, limit, getDocs } from "firebase/firestore";

interface Video {
  id: string;
  title: string;
  url: string;
  type: 'yt' | 'fb' | 'x' | 'generic';
  val: string;
  order: number;
  active: boolean;
  startTime?: number;
  endTime?: number;
  loopVideo?: boolean;
}

interface Channel {
  id: string;
  name: string;
  slug: string;
  ownerId: string;
  createdAt: any;
  playbackStatus?: {
    index: number;
    time: number;
    updatedAt: any;
  };
}

export default function AdminDashboard() {
  const { user, appUser } = useAuth();
  const navigate = useNavigate();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null);
  const [editChannelName, setEditChannelName] = useState("");
  const [viewMode, setViewMode] = useState<'grid' | 'command'>('grid');

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
    <div className="max-w-[1600px] mx-auto px-4 sm:px-8 py-8 md:py-12">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12 md:mb-16">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
             <div className="w-8 md:w-12 h-0.5 bg-red-600" />
             <span className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">Dashboard Area</span>
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black italic uppercase tracking-tighter leading-none">
            {viewMode === 'grid' ? 'Active ' : 'Command '}
            <span className="text-zinc-600 italic">{viewMode === 'grid' ? 'Stations' : 'Center'}</span>
          </h1>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full lg:w-auto">
          {/* View Toggle */}
          <div className="bg-zinc-900/50 p-1.5 rounded-2xl border border-white/5 flex items-center gap-1 w-full sm:w-auto">
             <button 
               onClick={() => setViewMode('grid')}
               className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'grid' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-zinc-500 hover:text-white'}`}
             >
               <LayoutList className="w-3.5 h-3.5" /> Station List
             </button>
             <button 
               onClick={() => setViewMode('command')}
               className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'command' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-zinc-500 hover:text-white'}`}
             >
               <Monitor className="w-3.5 h-3.5" /> Command Center
             </button>
          </div>

          {appUser?.role === 'admin' && (
            <button
              onClick={() => setIsAdding(true)}
              className="flex items-center justify-center gap-3 bg-white text-black font-black py-4 px-8 rounded-2xl transition-all shadow-2xl hover:scale-105 active:scale-95 group w-full sm:w-auto shrink-0"
            >
              <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" /> Create New Feed
            </button>
          )}
        </div>
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

      <AnimatePresence mode="wait">
        {viewMode === 'grid' ? (
          <motion.div 
            key="grid-view"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8"
          >
            {channels.map((channel) => (
              <motion.div
                layout
                key={channel.id}
                className="group relative bg-zinc-900/40 border border-white/5 rounded-[32px] p-2 hover:bg-zinc-900/60 transition-all duration-500"
              >
                <div 
                  onClick={() => navigate(`/admin/channel/${channel.id}`)} 
                  className="block p-6 space-y-6 cursor-pointer"
                >
                  <div className="relative aspect-[16/10] bg-zinc-950 rounded-[24px] flex items-center justify-center overflow-hidden group-hover:shadow-[0_0_40px_rgba(220,38,38,0.15)] transition-all">
                     <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(220,38,38,0.15),transparent)] opacity-0 group-hover:opacity-100 transition-opacity" />
                     <Tv className="w-12 h-12 text-zinc-900 group-hover:text-red-600/20 transition-all duration-700 transform group-hover:scale-110" />
                     
                     <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full border border-white/5">
                       <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse shadow-[0_0_8px_rgba(220,38,38,1)]" />
                       <span className="text-[8px] font-black uppercase tracking-widest text-white">Live Broadcast</span>
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
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => handleDeleteChannel(channel.id, e)}
                          className="p-2 text-zinc-700 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
            
            {/* Create Card */}
            {appUser?.role === 'admin' && (
              <button
                onClick={() => setIsAdding(true)}
                className="group relative h-full min-h-[300px] border-2 border-dashed border-white/5 rounded-[32px] p-8 flex flex-col items-center justify-center gap-6 hover:border-red-600/40 hover:bg-red-600/5 transition-all duration-500"
              >
                <div className="relative w-16 h-16 bg-zinc-900 border border-white/5 rounded-full flex items-center justify-center group-hover:scale-110 group-hover:bg-red-600 transition-all">
                  <Plus className="w-6 h-6 text-zinc-700 group-hover:text-white transition-colors" />
                </div>
                <div className="text-center">
                  <span className="block font-black uppercase italic tracking-tighter text-xl text-zinc-500 group-hover:text-white transition-colors">Add Station</span>
                </div>
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="command-view"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-10"
          >
            {channels.map((channel) => (
              <ChannelMonitor key={channel.id} channel={channel} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChannelMonitor({ channel }: { channel: Channel }) {
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!channel.playbackStatus) {
      setLoading(false);
      return;
    }

    const fetchVideo = async () => {
      try {
        const vq = query(
          collection(db, "channels", channel.id, "videos"),
          orderBy("order", "asc")
        );
        const snap = await getDocs(vq);
        const videos = snap.docs.map(d => ({ id: d.id, ...d.data() } as Video));
        
        if (videos.length > 0) {
          const index = channel.playbackStatus?.index || 0;
          setCurrentVideo(videos[index] || videos[0]);
        }
      } catch (err) {
        console.error("Monitor fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchVideo();
  }, [channel.id, channel.playbackStatus?.index]);

  return (
    <div className="bg-zinc-900 border border-white/5 rounded-[32px] md:rounded-[40px] overflow-hidden flex flex-col shadow-2xl">
      <div className="p-4 md:p-6 border-b border-white/5 flex items-center justify-between bg-zinc-900/80 backdrop-blur-md">
        <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
           <div className="w-8 h-8 md:w-10 md:h-10 bg-black rounded-xl md:rounded-2xl flex items-center justify-center border border-white/5 shrink-0">
             <Tv className="w-4 h-4 md:w-5 md:h-5 text-red-600" />
           </div>
           <div className="min-w-0">
             <h3 className="text-base md:text-lg font-black italic uppercase tracking-tighter leading-none truncate">{channel.name}</h3>
             <p className="text-[8px] md:text-[9px] font-black uppercase text-zinc-500 tracking-widest mt-1">Live Feed v1.4</p>
           </div>
        </div>
        <Link 
          to={`/admin/channel/${channel.id}`}
          className="p-2 md:p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg md:rounded-xl transition-all shrink-0"
        >
          <Edit2 className="w-3.5 h-3.5 md:w-4 md:h-4 text-zinc-400" />
        </Link>
      </div>

      <div className="aspect-video bg-black relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Radio className="w-8 h-8 text-zinc-800 animate-pulse" />
          </div>
        ) : currentVideo && channel.playbackStatus ? (
          <LivePreview 
            video={currentVideo} 
            status={channel.playbackStatus} 
            showControls={false}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 opacity-20">
            <Radio className="w-12 h-12" />
            <span className="text-[10px] font-black uppercase tracking-widest">No Signal</span>
          </div>
        )}
      </div>

      <div className="p-4 bg-zinc-950/50 flex items-center justify-between text-[10px] font-mono text-zinc-500">
         <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            SYNC ACTIVE
         </span>
         <span>{currentVideo?.title || 'STANDBY'}</span>
      </div>
    </div>
  );
}
