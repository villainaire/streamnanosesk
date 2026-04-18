import React, { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Plus, Trash2, ArrowLeft, Youtube, Facebook, Save, Play, GripVertical, Power, ExternalLink, Radio, Disc, Edit2, RefreshCw } from "lucide-react";
import { motion, Reorder, AnimatePresence } from "motion/react";
import LivePreview from "../components/LivePreview";

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
  loopPlaylist?: boolean;
  masterControl?: boolean;
  playbackStatus?: {
    index: number;
    time: number;
    updatedAt: any;
  };
}

// Time Helpers
const toSeconds = (hms: string) => {
  if (!hms || typeof hms !== 'string') return 0;
  
  // Clean the string (remove non-digits and colons)
  const clean = hms.replace(/[^0-9:]/g, '');
  if (!clean) return 0;

  const parts = clean.split(':').map(Number);
  
  // Standard H:M:S format support
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return (Number(h || 0) * 3600) + (Number(m || 0) * 60) + Number(s || 0);
  }
  
  // M:S format support
  if (parts.length === 2) {
    const [m, s] = parts;
    return (Number(m || 0) * 60) + Number(s || 0);
  }

  // Single number (assume seconds)
  if (parts.length === 1) {
    return Number(parts[0] || 0);
  }

  return 0;
};

const fromSeconds = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map(v => v.toString().padStart(2, '0')).join(':');
};

export default function ChannelDetail() {
  const { channelId } = useParams();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [newVideoTitle, setNewVideoTitle] = useState("");
  const [newStartTime, setNewStartTime] = useState("00:00:00");
  const [newEndTime, setNewEndTime] = useState("00:00:00");
  const [totalDuration, setTotalDuration] = useState(0);
  const [isFetching, setIsFetching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editStartTime, setEditStartTime] = useState("00:00:00");
  const [editEndTime, setEditEndTime] = useState("00:00:00");
  const [editTotalDuration, setEditTotalDuration] = useState(0);
  const [currentMasterTime, setCurrentMasterTime] = useState(0);

  useEffect(() => {
    if (!channelId) return;

    const unsubChannel = onSnapshot(doc(db, "channels", channelId), (snapshot) => {
      if (snapshot.exists()) {
        setChannel({ id: snapshot.id, ...snapshot.data() } as Channel);
      }
    });

    const q = query(collection(db, "channels", channelId, "videos"), orderBy("order", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setVideos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Video)));
    });

    return () => {
      unsubChannel();
      unsubscribe();
    };
  }, [channelId]);

  // 2. Load YouTube API
  useEffect(() => {
    if (window.YT) return;
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    
    window.onYouTubeIframeAPIReady = () => console.log("YT READY");
  }, []);

  // 3. Load Facebook SDK
  useEffect(() => {
    const fbRoot = document.getElementById('fb-root');
    if (!fbRoot) {
      const div = document.createElement('div');
      div.id = 'fb-root';
      document.body.appendChild(div);
    }

    if (document.getElementById('facebook-jssdk')) return;
    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = "https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v18.0";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    document.body.appendChild(script);

    window.fbAsyncInit = function() {
      window.FB.init({ xfbml: true, version: 'v18.0' });
    };
  }, []);

  const ytId = (url: string) => {
    const m = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
    return m ? m[1] : null;
  };

  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelId || !newVideoUrl) return;

    let type: 'yt' | 'fb' | 'x' | 'generic' = 'yt';
    let val = '';

    if (newVideoUrl.includes('youtu')) {
      const id = ytId(newVideoUrl);
      if (!id) return alert("Invalid YouTube URL");
      type = 'yt';
      val = id;
    } else if (newVideoUrl.includes('facebook')) {
      type = 'fb';
      val = newVideoUrl;
    } else if (newVideoUrl.includes('twitter.com') || newVideoUrl.includes('x.com')) {
      type = 'x';
      val = newVideoUrl;
    } else {
      type = 'generic';
      val = newVideoUrl;
    }

    try {
      setIsSubmitting(true);
      await addDoc(collection(db, "channels", channelId, "videos"), {
        title: newVideoTitle || (type === 'yt' ? "YouTube Video" : type === 'fb' ? "Facebook Video" : type === 'x' ? "X/Twitter Video" : "External Video"),
        url: newVideoUrl,
        type,
        val,
        order: videos.length,
        active: true,
        startTime: toSeconds(newStartTime),
        endTime: toSeconds(newEndTime),
        loopVideo: false,
        updatedAt: serverTimestamp()
      });
      setNewVideoUrl("");
      setNewVideoTitle("");
      setNewStartTime("00:00:00");
      setNewEndTime("00:00:00");
      setTotalDuration(0);
      setIsAdding(false);
    } catch (err) {
      console.error("Add video error:", err);
      alert("Failed to integrate source. Please check your connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFetchDuration = (url: string, isEdit = false) => {
    const id = ytId(url);
    if (id) {
      if (!window.YT || !window.YT.Player) return;
      
      setIsFetching(true);
      let fetcher = document.getElementById('temp-duration-fetcher');
      if (!fetcher) {
        fetcher = document.createElement('div');
        fetcher.id = 'temp-duration-fetcher';
        fetcher.style.display = 'none';
        document.body.appendChild(fetcher);
      }

      new window.YT.Player('temp-duration-fetcher', {
        height: '0',
        width: '0',
        videoId: id,
        events: {
          onReady: (event: any) => {
            const duration = Math.floor(event.target.getDuration());
            if (isEdit) {
              setEditEndTime(fromSeconds(duration));
            } else {
              setTotalDuration(duration);
              setNewEndTime(fromSeconds(duration));
            }
            setIsFetching(true);
            setTimeout(() => {
              setIsFetching(false);
              event.target.destroy();
            }, 100);
          },
          onError: () => setIsFetching(false)
        }
      });
    } else if (url.match(/\.(mp4|webm|ogg|mov)$|^https?:\/\/.*(video|stream).*/i)) {
      // Generic video duration fetch
      setIsFetching(true);
      const v = document.createElement('video');
      v.src = url;
      v.onloadedmetadata = () => {
        const duration = Math.floor(v.duration);
        if (isEdit) {
          setEditEndTime(fromSeconds(duration));
        } else {
          setTotalDuration(duration);
          setNewEndTime(fromSeconds(duration));
        }
        setIsFetching(false);
      };
      v.onerror = () => setIsFetching(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (newVideoUrl && newVideoUrl.includes('youtu')) {
        handleFetchDuration(newVideoUrl, false);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [newVideoUrl]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (editUrl && editUrl.includes('youtu')) {
        handleFetchDuration(editUrl, true);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [editUrl]);

  const handleUpdateVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelId || !editingVideo || !editUrl) return;

    let type: 'yt' | 'fb' | 'x' | 'generic' = 'yt';
    let val = '';

    if (editUrl.includes('youtu')) {
      const id = ytId(editUrl);
      if (!id) return alert("Invalid YouTube URL");
      type = 'yt';
      val = id;
    } else if (editUrl.includes('facebook')) {
      type = 'fb';
      val = editUrl;
    } else if (editUrl.includes('twitter.com') || editUrl.includes('x.com')) {
      type = 'x';
      val = editUrl;
    } else {
      type = 'generic';
      val = editUrl;
    }

    try {
      setIsSubmitting(true);
      await updateDoc(doc(db, "channels", channelId, "videos", editingVideo.id), {
        title: editTitle,
        url: editUrl,
        type,
        val,
        startTime: toSeconds(editStartTime),
        endTime: toSeconds(editEndTime),
        updatedAt: serverTimestamp()
      });
      setEditingVideo(null);
    } catch (err) {
      console.error("Update video error:", err);
      alert("Failed to commit changes.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (v: Video) => {
    setEditingVideo(v);
    setEditTitle(v.title);
    setEditUrl(v.url);
    setEditStartTime(fromSeconds(v.startTime || 0));
    setEditEndTime(fromSeconds(v.endTime || 0));
  };

  const toggleLoop = async () => {
    if (!channelId || !channel) return;
    await updateDoc(doc(db, "channels", channelId), {
      loopPlaylist: !channel.loopPlaylist
    });
    setChannel({ ...channel, loopPlaylist: !channel.loopPlaylist });
  };

  const handleRestartPlaylist = async () => {
    if (!channelId) return;
    await updateDoc(doc(db, "channels", channelId), {
      syncTrigger: {
        type: 'RESTART_PLAYLIST',
        timestamp: serverTimestamp()
      }
    });
  };

  const handleRestartVideo = async () => {
    if (!channelId) return;
    await updateDoc(doc(db, "channels", channelId), {
      syncTrigger: {
        type: 'RESTART_VIDEO',
        timestamp: serverTimestamp()
      }
    });
  };

  const toggleActive = async (v: Video) => {
    if (!channelId) return;
    await updateDoc(doc(db, "channels", channelId, "videos", v.id), {
      active: !v.active
    });
  };

  const toggleVideoLoop = async (v: Video) => {
    if (!channelId) return;
    await updateDoc(doc(db, "channels", channelId, "videos", v.id), {
      loopVideo: !v.loopVideo
    });
  };

  const handlePlayVideo = async (v: Video) => {
    if (!channelId) return;
    await updateDoc(doc(db, "channels", channelId), {
      syncTrigger: {
        type: 'PLAY_VIDEO',
        videoId: v.id,
        timestamp: serverTimestamp()
      }
    });
  };

  const handleMasterSeek = async (time: number) => {
    if (!channelId || !channel?.masterControl) return;
    await updateDoc(doc(db, "channels", channelId), {
      syncTrigger: {
        type: 'SEEK_TO',
        time,
        timestamp: serverTimestamp()
      }
    });
  };

  const handleMasterTimeUpdate = async (time: number) => {
    if (!channelId || !channel?.masterControl) return;
    // Debounce or only update if masterControl is really on
    // The LivePreview loop runs every 2s, which is perfect for sync reporting
    await updateDoc(doc(db, "channels", channelId), {
      playbackStatus: {
        index: channel.playbackStatus?.index || 0,
        time,
        updatedAt: serverTimestamp()
      }
    });
  };

  const toggleMasterControl = async () => {
    if (!channel || !channelId) return;
    await updateDoc(doc(db, "channels", channelId), {
      masterControl: !channel.masterControl
    });
  };

  const deleteVideo = async (id: string) => {
    if (!channelId || !confirm("Delete this video?")) return;
    await deleteDoc(doc(db, "channels", channelId, "videos", id));
  };

  const handleReorder = async (newOrder: Video[]) => {
    setVideos(newOrder);
    if (!channelId) return;
    newOrder.forEach((v, index) => {
      if (v.order !== index) {
        updateDoc(doc(db, "channels", channelId, "videos", v.id), { order: index });
      }
    });
  };

  if (!channel) return null;

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-8 py-8 md:py-12 space-y-8 md:space-y-12">
      <div className="flex flex-col gap-6 md:gap-8 mb-8 md:mb-16">
        <Link 
          to="/admin" 
          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-white transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Stations
        </Link>
        
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 md:gap-8 bg-zinc-900/40 p-6 md:p-10 rounded-[32px] md:rounded-[40px] border border-white/5 backdrop-blur-md">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 md:w-12 h-0.5 bg-red-600" />
              <div className="flex items-center gap-1.5">
                <Radio className="w-3 h-3 text-red-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">Managing Broadcast</span>
              </div>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black italic uppercase tracking-tighter leading-none break-words">
              {channel.name}
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-zinc-500">
               <span className="bg-zinc-950 border border-white/5 py-1.5 px-4 rounded-full uppercase tracking-widest leading-none font-black text-[9px] text-zinc-400">/play/{channel.slug}</span>
               <a 
                 href={`/play/${channel.slug}`} 
                 target="_blank" 
                 className="flex items-center gap-2 hover:text-white transition-colors group"
               >
                 <ExternalLink className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" /> Open Public Feed
               </a>
            </div>
          </div>

          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center justify-center gap-3 bg-red-600 text-white font-black py-4 md:py-5 px-8 md:px-10 rounded-2xl md:rounded-[28px] transition-all shadow-2xl shadow-red-600/20 hover:scale-105 active:scale-95 group w-full lg:w-auto"
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" /> Add Media Content
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 pb-12 items-start">
        {/* Left Column: List (Order 2 on mobile, Order 2 on Desktop) */}
        <div className="lg:col-span-12 xl:col-span-8 order-2">
          <div className="bg-zinc-900/40 border border-white/5 rounded-[32px] md:rounded-[40px] p-6 sm:p-8 lg:p-12 shadow-2xl backdrop-blur-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
               <div className="flex flex-col">
                  <h3 className="text-xl sm:text-2xl font-black italic uppercase tracking-tighter">Live Sequence</h3>
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Playlist Orchestrator</span>
               </div>
               <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 pb-2 sm:pb-0 border-b sm:border-0 border-white/5">
                 <GripVertical className="w-4 h-4" /> Drag to Reorder
               </div>
            </div>

            <Reorder.Group axis="y" values={videos} onReorder={handleReorder} className="space-y-4">
              {videos.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-white/5 rounded-[32px]">
                  <div className="bg-zinc-800/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                     <Play className="w-6 h-6 text-zinc-600" />
                  </div>
                  <p className="text-zinc-500 font-bold uppercase tracking-widest text-xs italic">Playlist is currently empty</p>
                </div>
              ) : (
                videos.map((video) => (
                  <Reorder.Item 
                    key={video.id} 
                    value={video}
                    className={`group relative bg-black/40 border border-white/5 rounded-[24px] md:rounded-3xl p-4 md:p-5 flex flex-col md:flex-row md:items-center justify-between hover:bg-zinc-800/40 transition-all cursor-grab active:cursor-grabbing gap-4 ${!video.active && 'opacity-40'}`}
                  >
                    <div className="flex items-center gap-4 md:gap-5">
                      <div className="text-zinc-700 p-2 group-hover:text-zinc-500 transition-colors hidden sm:block">
                        <GripVertical className="w-5 h-5" />
                      </div>
                      <div className={`w-12 h-12 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center border shadow-inner shrink-0 ${video.type === 'yt' ? 'bg-red-600/10 text-red-600 border-red-600/20' : 'bg-blue-600/10 text-blue-600 border-blue-600/20'}`}>
                        {video.type === 'yt' ? <Youtube className="w-6 h-6 md:w-7 md:h-7" /> : <Facebook className="w-6 h-6 md:w-7 md:h-7" />}
                      </div>
                      <div className="flex flex-col gap-1 min-w-0">
                        <span className="font-black uppercase tracking-tighter text-lg md:text-xl text-zinc-100 italic leading-none truncate">{video.title}</span>
                        <div className="flex flex-wrap items-center gap-2 md:gap-3">
                          <span className="text-[9px] md:text-[10px] text-zinc-500 font-bold uppercase tracking-widest truncate max-w-[120px] sm:max-w-[150px] opacity-50">{video.url}</span>
                          {(video.startTime || video.endTime) ? (
                            <span className="text-[8px] md:text-[9px] text-red-500 font-black uppercase tracking-widest bg-red-500/10 px-2 md:px-3 py-0.5 md:py-1 rounded-full border border-red-500/20 leading-none">
                              {fromSeconds(video.startTime || 0)} ➔ {fromSeconds(video.endTime || 0)} 
                            </span>
                          ) : null}
                          {video.loopVideo && (
                            <span className="text-[8px] md:text-[9px] text-orange-500 font-black uppercase tracking-widest bg-orange-500/10 px-2 md:px-3 py-0.5 md:py-1 rounded-full border border-orange-500/20 flex items-center gap-1.5 leading-none">
                              <Disc className="w-2.5 h-2.5 md:w-3 h-3 animate-spin" /> Single Loop
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 md:gap-3 ml-0 md:ml-0">
                      <button 
                        onClick={() => handlePlayVideo(video)}
                        className="p-2 md:p-3 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white rounded-xl md:rounded-2xl transition-all shadow-lg hover:shadow-red-600/20"
                        title="Force Immediate Play (Sync All)"
                      >
                        <Play className="w-4 h-4 md:w-5 md:h-5 fill-current" />
                      </button>
                      <button 
                        onClick={() => openEditModal(video)}
                        className="p-2 md:p-3 bg-white/5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl md:rounded-2xl transition-all"
                      >
                        <Edit2 className="w-4 h-4 md:w-5 md:h-5" />
                      </button>
                      <button 
                        onClick={() => toggleVideoLoop(video)}
                        className={`p-2 md:p-3 rounded-xl md:rounded-2xl border transition-all ${video.loopVideo ? 'bg-orange-500 text-black border-orange-500/40 shadow-[0_0_20px_rgba(249,115,22,0.3)]' : 'bg-transparent text-zinc-600 border-white/5 hover:border-white/10'}`}
                        title={video.loopVideo ? "Disable Single Loop" : "Enable Single Loop"}
                      >
                        <Disc className={`w-4 h-4 md:w-5 md:h-5 ${video.loopVideo ? 'animate-spin' : ''}`} />
                      </button>
                      <button 
                        onClick={() => toggleActive(video)}
                        className={`p-2 md:p-3 rounded-xl md:rounded-2xl border transition-all ${video.active ? 'bg-zinc-800 text-green-500 border-green-500/20 shadow-[0_0_20px_rgba(34,197,94,0.1)]' : 'bg-zinc-950 text-zinc-600 border-white/5'}`}
                      >
                        <Power className="w-4 h-4 md:w-5 md:h-5" />
                      </button>
                      <button 
                        onClick={() => deleteVideo(video.id)}
                        className="p-2 md:p-3 text-zinc-700 hover:text-red-500 hover:bg-red-600/10 rounded-xl md:rounded-2xl transition-all"
                      >
                        <Trash2 className="w-4 h-4 md:w-5 md:h-5" />
                      </button>
                    </div>
                  </Reorder.Item>
                ))
              )}
            </Reorder.Group>
          </div>
        </div>

        {/* Right Column: Master Station Control (Order 1 on mobile, Order 1 on Desktop but sticky) */}
        <div className="lg:col-span-12 xl:col-span-4 space-y-6 md:space-y-8 order-1 xl:sticky xl:top-28">
           <div className="bg-zinc-900 border border-white/5 rounded-[40px] shadow-2xl overflow-hidden flex flex-col">
              {/* MINI MASTER PLAYER */}
              <div className="aspect-video w-full bg-black relative group shadow-2xl">
                 {channel.playbackStatus && videos[channel.playbackStatus.index] ? (
                   <LivePreview 
                     video={videos[channel.playbackStatus.index]} 
                     status={channel.playbackStatus}
                     onSeek={handleMasterSeek}
                     onTimeUpdate={handleMasterTimeUpdate}
                     showControls={false}
                   />
                 ) : (
                   <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-950">
                      <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center border border-white/5">
                        <Play className="w-8 h-8 text-zinc-800" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-800">No Signal Detected</span>
                   </div>
                 )}
                 <div className="absolute top-4 left-4 z-10">
                    <div className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                       <div className={`w-2 h-2 rounded-full ${channel.masterControl ? 'bg-blue-500 animate-pulse' : 'bg-zinc-700'}`} />
                       <span className="text-[9px] font-black uppercase tracking-widest text-white">Live Monitor</span>
                    </div>
                 </div>
              </div>

              <div className="p-6 md:p-8 space-y-6 md:space-y-8">
                 <div className="flex items-center justify-between">
                    <div className="space-y-1">
                       <h3 className="text-lg md:text-xl font-black italic uppercase tracking-tighter leading-none">Broadcast <span className="text-zinc-600">Console</span></h3>
                       <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Station Mission Control</p>
                    </div>
                    {channel.masterControl && (
                       <div className="flex items-center gap-2 bg-blue-600/10 px-3 py-1.5 rounded-xl border border-blue-500/20">
                          <Radio className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
                          <span className="text-[10px] font-black uppercase text-blue-500 shrink-0">Syncing...</span>
                       </div>
                    )}
                 </div>

                 <div className="grid grid-cols-2 gap-3 md:gap-4">
                    <div className="bg-zinc-950 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-white/5 relative group overflow-hidden">
                       <div className="absolute bottom-0 right-0 p-2 opacity-5 pointer-events-none group-hover:opacity-20 transition-opacity">
                          <Radio className="w-8 md:w-12 h-8 md:h-12" />
                       </div>
                       <span className="text-[8px] font-black uppercase text-zinc-600 tracking-widest mb-2 block">Active Source</span>
                       <span className="text-[10px] md:text-xs font-black uppercase italic tracking-tighter text-zinc-200 truncate block">
                         {channel.playbackStatus && videos[channel.playbackStatus.index] ? videos[channel.playbackStatus.index].title : 'Standby'}
                       </span>
                    </div>
                    <div className="bg-zinc-950 p-4 md:p-6 rounded-2xl md:rounded-3xl border border-white/5 relative group overflow-hidden">
                       <div className="absolute bottom-0 right-0 p-2 opacity-5 pointer-events-none group-hover:opacity-20 transition-opacity">
                          <RefreshCw className="w-8 md:w-12 h-8 md:h-12" />
                       </div>
                       <span className="text-[8px] font-black uppercase text-zinc-600 tracking-widest mb-2 block">Sync Clock</span>
                       <span className="text-[10px] md:text-xs font-black text-blue-500 block">
                         {channel.playbackStatus ? fromSeconds(Math.floor(channel.playbackStatus.time)) : '00:00:00'}
                       </span>
                    </div>
                 </div>

                 <div className="space-y-3 md:space-y-4 pt-4 border-t border-white/5">
                   <button 
                     onClick={toggleMasterControl}
                     className={`flex items-center justify-between w-full p-4 md:p-6 border rounded-2xl md:rounded-[28px] transition-all group ${channel?.masterControl ? 'bg-blue-600 text-white border-blue-500' : 'bg-zinc-950 border-white/5 hover:border-white/10'}`}
                   >
                      <div className="flex items-center gap-3 md:gap-4">
                         <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl flex items-center justify-center border ${channel?.masterControl ? 'bg-white/20 border-white/30' : 'bg-zinc-900 border-white/5'}`}>
                            <Radio className={`w-4 h-4 md:w-5 md:h-5 ${channel?.masterControl ? 'text-white' : 'text-zinc-600'}`} />
                         </div>
                         <div className="flex flex-col items-start min-w-0">
                            <span className={`font-black text-xs md:text-sm uppercase italic tracking-tighter truncate ${channel?.masterControl ? 'text-white' : 'text-zinc-400'}`}>Master Control</span>
                            <span className={`text-[8px] font-bold uppercase tracking-widest ${channel?.masterControl ? 'text-white/60' : 'text-zinc-600'}`}>Toggle Universal Sync</span>
                         </div>
                      </div>
                      <div className={`w-10 h-5 md:w-12 md:h-6 rounded-full relative transition-colors shrink-0 ${channel?.masterControl ? 'bg-white/20' : 'bg-zinc-800'}`}>
                         <div className={`absolute top-0.5 md:top-1 w-4 h-4 rounded-full transition-all shadow-lg ${channel?.masterControl ? 'right-0.5 md:right-1 bg-white' : 'left-0.5 md:left-1 bg-zinc-600'}`} />
                      </div>
                   </button>

                   <div className="grid grid-cols-2 gap-3 md:gap-4">
                     <button 
                       onClick={handleRestartPlaylist}
                       className="flex items-center gap-2 md:gap-3 p-4 md:p-5 bg-zinc-950 border border-white/5 rounded-2xl md:rounded-[28px] hover:bg-zinc-900 transition-all group overflow-hidden"
                     >
                       <RefreshCw className="w-3.5 md:w-4 h-3.5 md:h-4 text-zinc-600 group-hover:rotate-180 transition-transform duration-500 shrink-0" />
                       <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-white truncate">Restart List</span>
                     </button>
                     <button 
                       onClick={handleRestartVideo}
                       className="flex items-center gap-2 md:gap-3 p-4 md:p-5 bg-zinc-950 border border-white/5 rounded-2xl md:rounded-[28px] hover:bg-zinc-900 transition-all group overflow-hidden"
                     >
                       <Play className="w-3.5 md:w-4 h-3.5 md:h-4 text-zinc-600 group-hover:scale-110 transition-transform shrink-0" />
                       <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-white truncate">Restart Source</span>
                     </button>
                   </div>

                   <button 
                     onClick={toggleLoop}
                     className={`flex items-center justify-between w-full p-4 md:p-6 border rounded-2xl md:rounded-[28px] transition-all group ${channel.loopPlaylist ? 'bg-red-600/10 border-red-500/40' : 'bg-zinc-950 border-white/5 hover:border-white/10'}`}
                   >
                      <div className="flex items-center gap-3 md:gap-4">
                         <div className={`w-8 h-8 md:w-10 md:h-10 rounded-xl md:rounded-2xl flex items-center justify-center border ${channel.loopPlaylist ? 'bg-red-500/10 border-red-500/20' : 'bg-zinc-900 border-white/5'}`}>
                            <Disc className={`w-4 h-4 md:w-5 md:h-5 ${channel.loopPlaylist ? 'text-red-500 animate-spin' : 'text-zinc-600'}`} />
                         </div>
                         <div className="flex flex-col items-start min-w-0">
                            <span className={`font-black text-xs md:text-sm uppercase italic tracking-tighter truncate ${channel.loopPlaylist ? 'text-red-500' : 'text-zinc-400'}`}>Loop Playlist</span>
                            <span className={`text-[8px] font-bold uppercase tracking-widest ${channel.loopPlaylist ? 'text-red-500/60' : 'text-zinc-600'}`}>Auto-loop Station</span>
                         </div>
                      </div>
                      <div className={`w-10 h-5 md:w-12 md:h-6 rounded-full relative transition-colors shrink-0 ${channel.loopPlaylist ? 'bg-red-600' : 'bg-zinc-800'}`}>
                         <div className={`absolute top-0.5 md:top-1 w-4 h-4 rounded-full transition-all shadow-lg ${channel.loopPlaylist ? 'right-0.5 md:right-1 bg-white' : 'left-0.5 md:left-1 bg-zinc-600'}`} />
                      </div>
                   </button>
                 </div>
              </div>
           </div>

           <div className="bg-zinc-900/40 border border-white/5 rounded-3xl md:rounded-[32px] p-6 md:p-8 shadow-2xl backdrop-blur-md">
              <h3 className="text-lg md:text-xl font-black italic uppercase tracking-tighter mb-4 md:mb-6 flex items-center gap-3">
                 <ExternalLink className="w-5 h-5 text-zinc-600" /> Connection Details
              </h3>
              <div className="space-y-3 md:space-y-4">
                 <div className="p-4 md:p-6 bg-black/40 border border-white/5 rounded-2xl md:rounded-3xl space-y-2 md:space-y-3">
                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] block">Public Output Address</span>
                    <div className="flex items-center justify-between gap-4">
                       <span className="text-[10px] md:text-xs font-mono text-zinc-400 truncate break-all">ais.stream/play/{channel.slug}</span>
                       <button className="text-[8px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-400 transition-colors shrink-0">Copy</button>
                    </div>
                 </div>
                 <div className="p-4 md:p-6 bg-black/40 border border-white/5 rounded-2xl md:rounded-3xl">
                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-2 block">Station ID</span>
                    <span className="text-[10px] md:text-xs font-mono text-zinc-500 break-all">{channel.id}</span>
                 </div>
              </div>
           </div>
        </div>
      </div>

      <AnimatePresence>
        {isAdding && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              className="bg-zinc-900 border border-white/5 p-10 rounded-[32px] max-w-xl w-full shadow-2xl"
            >
              <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-8 tracking-tight">Source Integration</h2>
              <form onSubmit={handleAddVideo} className="space-y-8">
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2 block">Content Label (Optional)</label>
                    <input
                      type="text"
                      value={newVideoTitle}
                      onChange={(e) => setNewVideoTitle(e.target.value)}
                      className="w-full bg-black border border-white/5 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all font-bold placeholder:text-zinc-800"
                      placeholder="e.g. BREAKING NEWS FEED"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2 block">Media URL (YouTube/Facebook)</label>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={newVideoUrl}
                      onChange={(e) => setNewVideoUrl(e.target.value)}
                      className="w-full bg-black border border-white/5 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all font-bold placeholder:text-zinc-800"
                      placeholder="Paste link here..."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] block">Start At (H:M:S)</label>
                      </div>
                      <input
                        type="text"
                        value={newStartTime}
                        onChange={(e) => setNewStartTime(e.target.value)}
                        className="w-full bg-black border border-white/5 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all font-mono font-bold"
                        placeholder="00:00:00"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] block">End At (H:M:S)</label>
                        {isFetching && <span className="text-[8px] text-red-500 animate-pulse font-black uppercase">Fetching...</span>}
                      </div>
                      <input
                        type="text"
                        value={newEndTime}
                        onChange={(e) => setNewEndTime(e.target.value)}
                        className="w-full bg-black border border-white/5 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all font-mono font-bold"
                        placeholder="00:00:00"
                      />
                    </div>
                  </div>
                  {(toSeconds(newEndTime) > 0) && (
                    <div className="bg-red-600/5 border border-red-600/20 p-4 rounded-2xl flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Total Playback:</span>
                      <span className="text-xl font-black italic text-red-500 uppercase tracking-tighter">
                        {fromSeconds(Math.max(0, toSeconds(newEndTime) - toSeconds(newStartTime)))}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="flex-1 px-6 py-5 bg-zinc-800 hover:bg-zinc-700 rounded-2xl font-black uppercase text-xs tracking-widest transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-6 py-5 bg-red-600 hover:bg-red-500 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-xl shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Integrating...' : 'Integrate'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {editingVideo && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              className="bg-zinc-900 border border-white/5 p-10 rounded-[32px] max-w-xl w-full shadow-2xl"
            >
              <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-8 tracking-tight">Modify Source</h2>
              <form onSubmit={handleUpdateVideo} className="space-y-8">
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2 block">Content Label (Optional)</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full bg-black border border-white/5 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all font-bold placeholder:text-zinc-800"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] block">Media URL</label>
                      {isFetching && <span className="text-[8px] text-red-500 animate-pulse font-black uppercase">Fetching...</span>}
                    </div>
                    <input
                      type="text"
                      required
                      value={editUrl}
                      onChange={(e) => setEditUrl(e.target.value)}
                      className="w-full bg-black border border-white/5 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all font-bold placeholder:text-zinc-800"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2 block">Start At (H:M:S)</label>
                      <input
                        type="text"
                        value={editStartTime}
                        onChange={(e) => setEditStartTime(e.target.value)}
                        className="w-full bg-black border border-white/5 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2 block">End At (H:M:S)</label>
                      <input
                        type="text"
                        value={editEndTime}
                        onChange={(e) => setEditEndTime(e.target.value)}
                        className="w-full bg-black border border-white/5 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all font-mono font-bold"
                      />
                    </div>
                  </div>
                  {(toSeconds(editEndTime) > 0) && (
                    <div className="bg-red-600/5 border border-red-600/20 p-4 rounded-2xl flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Duration Adjustment:</span>
                      <span className="text-xl font-black italic text-red-500 uppercase tracking-tighter">
                        {fromSeconds(Math.max(0, toSeconds(editEndTime) - toSeconds(editStartTime)))}
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setEditingVideo(null)}
                    className="flex-1 px-6 py-5 bg-zinc-800 hover:bg-zinc-700 rounded-2xl font-black uppercase text-xs tracking-widest transition-all"
                  >
                    Discard
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-6 py-5 bg-red-600 hover:bg-red-500 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-xl shadow-red-600/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Saving...' : 'Commit Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}