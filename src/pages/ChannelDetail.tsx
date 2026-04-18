import React, { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Plus, Trash2, ArrowLeft, Youtube, Facebook, Save, Play, GripVertical, Power, ExternalLink, Radio, Disc, Edit2, RefreshCw } from "lucide-react";
import { motion, Reorder, AnimatePresence } from "motion/react";

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex flex-col gap-8 mb-16">
        <Link 
          to="/admin" 
          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-white transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Stations
        </Link>
        
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-0.5 bg-red-600" />
              <div className="flex items-center gap-1.5">
                <Radio className="w-3 h-3 text-red-500 animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-red-500">Managing Broadcast</span>
              </div>
            </div>
            <h1 className="text-6xl font-black italic uppercase tracking-tighter leading-none">
              {channel.name}
            </h1>
            <div className="flex items-center gap-4 text-xs font-bold text-zinc-500">
               <span className="bg-zinc-900 border border-white/5 py-1 px-3 rounded-full uppercase tracking-widest leading-none">/play/{channel.slug}</span>
               <a 
                 href={`/play/${channel.slug}`} 
                 target="_blank" 
                 className="flex items-center gap-2 hover:text-white transition-colors"
               >
                 <ExternalLink className="w-3.5 h-3.5" /> Open Public Feed
               </a>
            </div>
          </div>

          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-3 bg-white text-black font-black py-4 px-8 rounded-2xl transition-all shadow-2xl hover:scale-105 active:scale-95 group"
          >
            <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" /> Add Media Content
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2">
          <div className="bg-zinc-900/40 border border-white/5 rounded-[40px] p-8 lg:p-12 shadow-2xl backdrop-blur-sm">
            <div className="flex items-center justify-between mb-10">
               <h3 className="text-2xl font-black italic uppercase tracking-tighter">Live Sequence</h3>
               <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">
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
                    className={`group relative bg-black/40 border border-white/5 rounded-2xl p-4 flex items-center justify-between hover:bg-zinc-800/40 transition-all cursor-grab active:cursor-grabbing ${!video.active && 'opacity-40'}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-zinc-700 p-2 group-hover:text-zinc-500 transition-colors">
                        <GripVertical className="w-5 h-5" />
                      </div>
                      <div className={`p-2 rounded-lg ${video.type === 'yt' ? 'bg-red-600/10 text-red-600' : 'bg-blue-600/10 text-blue-600'}`}>
                        {video.type === 'yt' ? <Youtube className="w-5 h-5" /> : <Facebook className="w-5 h-5" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-black uppercase tracking-tighter text-zinc-200">{video.title}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest truncate max-w-[150px]">{video.url}</span>
                          {(video.startTime || video.endTime) ? (
                            <span className="text-[10px] text-red-500 font-black uppercase tracking-widest bg-red-500/10 px-2 py-0.5 rounded border border-red-500/20">
                              {fromSeconds(video.startTime || 0)} ➔ {fromSeconds(video.endTime || 0)} 
                              <span className="ml-2 opacity-50">({fromSeconds((video.endTime || 0) - (video.startTime || 0))} Play)</span>
                            </span>
                          ) : null}
                          {video.loopVideo && (
                            <span className="text-[10px] text-orange-500 font-black uppercase tracking-widest bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20 flex items-center gap-1">
                              <Disc className="w-2.5 h-2.5 animate-spin" /> Single Loop
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => handlePlayVideo(video)}
                        className="p-2.5 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white rounded-xl transition-all"
                        title="Play Now (Sync All)"
                      >
                        <Play className="w-4 h-4 fill-current" />
                      </button>
                      <button 
                        onClick={() => openEditModal(video)}
                        className="p-2.5 text-zinc-700 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                        title="Edit Source"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => toggleVideoLoop(video)}
                        className={`p-2.5 rounded-xl border transition-all ${video.loopVideo ? 'bg-orange-500 underline text-black border-orange-500/40 shadow-[0_0_15px_rgba(249,115,22,0.2)]' : 'bg-transparent text-zinc-600 border-white/5 hover:border-white/10'}`}
                        title={video.loopVideo ? "Disable Single Loop" : "Enable Single Loop"}
                      >
                        <Disc className={`w-4 h-4 ${video.loopVideo ? 'animate-spin' : ''}`} />
                      </button>
                      <button 
                        onClick={() => toggleActive(video)}
                        className={`p-2.5 rounded-xl border transition-all ${video.active ? 'bg-zinc-800 text-green-500 border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.1)]' : 'bg-zinc-950 text-zinc-600 border-white/5'}`}
                        title={video.active ? "Mute Video" : "Activate Video"}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => deleteVideo(video.id)}
                        className="p-2.5 text-zinc-700 hover:text-red-600 hover:bg-red-600/10 rounded-xl transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </Reorder.Item>
                ))
              )}
            </Reorder.Group>
          </div>
        </div>

        <div className="space-y-8">
           {channel?.masterControl && channel.playbackStatus && (
             <div className="bg-zinc-900 border border-blue-500/20 rounded-[32px] p-6 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-600" />
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 bg-red-600 rounded-full animate-pulse shadow-[0_0_8px_rgba(220,38,38,1)]" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white">Station Live Feed</span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-500">Master Sync Enabled</span>
                </div>
                
                <div className="aspect-video bg-black rounded-2xl overflow-hidden relative mb-4">
                  <LivePreview 
                    video={videos[channel.playbackStatus.index]} 
                    status={channel.playbackStatus} 
                    onSeek={handleMasterSeek}
                  />
                </div>
                
                <div className="flex items-center justify-between px-2">
                   <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase text-zinc-500 tracking-tighter">Current Source</span>
                      <span className="text-xs font-bold truncate max-w-[200px]">{videos[channel.playbackStatus.index]?.title || 'No Source'}</span>
                   </div>
                   <div className="text-right">
                      <span className="text-[10px] font-black uppercase text-zinc-500 tracking-tighter">Live Time</span>
                      <div className="text-sm font-black italic text-blue-500">{fromSeconds(Math.floor(channel.playbackStatus.time))}</div>
                   </div>
                </div>
             </div>
           )}

           <div className="bg-zinc-900 border border-white/5 rounded-[32px] p-8 shadow-2xl">
              <h3 className="text-xl font-black italic uppercase tracking-tighter mb-6">Quick Settings</h3>
              <div className="space-y-4">
                 <button 
                   onClick={toggleMasterControl}
                   className={`flex items-center justify-between w-full p-6 border rounded-[24px] transition-all group ${channel?.masterControl ? 'bg-blue-600/10 border-blue-500/40' : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06]'}`}
                 >
                    <div className="flex items-center gap-3">
                       <Radio className={`w-5 h-5 ${channel?.masterControl ? 'text-blue-500' : 'text-zinc-600'}`} />
                       <span className={`font-black text-sm uppercase italic tracking-tighter ${channel?.masterControl ? 'text-blue-500' : 'text-zinc-400'}`}>Master Control</span>
                    </div>
                    <div className={`w-10 h-5 rounded-full relative transition-colors ${channel?.masterControl ? 'bg-blue-600' : 'bg-zinc-800'}`}>
                       <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${channel?.masterControl ? 'right-1' : 'left-1'}`} />
                    </div>
                 </button>

                 <button 
                   onClick={toggleLoop}
                   className={`flex items-center justify-between w-full p-6 border rounded-[24px] transition-all group ${channel.loopPlaylist ? 'bg-red-600/10 border-red-500/40' : 'bg-white/[0.03] border-white/5 hover:bg-white/[0.06]'}`}
                 >
                    <div className="flex items-center gap-3">
                       <Disc className={`w-5 h-5 ${channel.loopPlaylist ? 'text-red-500 animate-spin' : 'text-zinc-600'}`} />
                       <span className={`font-black text-sm uppercase italic tracking-tighter ${channel.loopPlaylist ? 'text-red-500' : 'text-zinc-400'}`}>Loop Playlist</span>
                    </div>
                    <div className={`w-10 h-5 rounded-full relative transition-colors ${channel.loopPlaylist ? 'bg-red-600' : 'bg-zinc-800'}`}>
                       <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${channel.loopPlaylist ? 'right-1' : 'left-1'}`} />
                    </div>
                 </button>

                 <div className="grid grid-cols-2 gap-4">
                   <button 
                     onClick={handleRestartPlaylist}
                     className="flex flex-col items-center justify-center gap-2 p-6 bg-white/[0.03] border border-white/5 rounded-[24px] hover:bg-white/[0.06] transition-all group text-center"
                     title="Restart from first video"
                   >
                     <RefreshCw className="w-5 h-5 text-zinc-500 group-hover:text-white transition-colors" />
                     <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-white leading-tight">Restart List</span>
                   </button>
                   <button 
                     onClick={handleRestartVideo}
                     className="flex flex-col items-center justify-center gap-2 p-6 bg-white/[0.03] border border-white/5 rounded-[24px] hover:bg-white/[0.06] transition-all group text-center"
                     title="Restart current playing source"
                   >
                     <Play className="w-5 h-5 text-zinc-500 group-hover:text-red-500 transition-colors" />
                     <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-white leading-tight">Restart Source</span>
                   </button>
                 </div>

                 <Link 
                   to={`/play/${channel.slug}`}
                   target="_blank"
                   className="flex items-center justify-between w-full p-6 bg-white/[0.03] border border-white/5 rounded-[24px] hover:bg-white/[0.06] transition-all group"
                 >
                    <div className="flex items-center gap-3">
                       <Radio className="w-5 h-5 text-red-500 animate-pulse" />
                       <span className="font-black text-sm uppercase italic tracking-tighter">Live Player</span>
                    </div>
                    <ExternalLink className="w-4 h-4 text-zinc-600 group-hover:text-white transition-colors" />
                 </Link>
                 
                 <div className="p-6 bg-zinc-950 border border-white/5 rounded-[24px]">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2 block">Station ID</span>
                    <span className="text-xs font-mono text-zinc-300 break-all">{channel.id}</span>
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
}function LivePreview({ video, status, onSeek }: { video: Video, status: any, onSeek: (time: number) => void }) {
  const ytPlayerRef = useRef<any>(null);
  const fbPlayerRef = useRef<any>(null);
  const videoElementRef = useRef<HTMLVideoElement>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize YT API if needed
  useEffect(() => {
    if (window.YT) return;
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
  }, []);

  // Handle Playback Logic
  useEffect(() => {
    if (!video || !status) return;
    
    // YouTube Logic
    if (video.type === 'yt') {
      const initYT = () => {
        if (!window.YT || !window.YT.Player) return;
        
        if (ytPlayerRef.current) {
          try {
            ytPlayerRef.current.loadVideoById({
              videoId: video.val,
              startSeconds: status.time
            });
            ytPlayerRef.current.mute();
          } catch(e) {
            ytPlayerRef.current = null;
            initYT();
          }
        } else {
          ytPlayerRef.current = new window.YT.Player(`preview-player-${video.id}`, {
            height: '100%',
            width: '100%',
            videoId: video.val,
            playerVars: { 
              autoplay: 1, 
              controls: 0, 
              modestbranding: 1, 
              start: Math.floor(status.time),
              origin: window.location.origin
            },
            events: {
              onReady: (event: any) => { 
                event.target.mute();
                setPlayerReady(true);
              },
              onError: () => setError("YT Signal Error")
            }
          });
        }
      };

      if (window.YT && window.YT.Player) initYT();
      else {
        const timer = setInterval(() => {
          if (window.YT && window.YT.Player) {
            initYT();
            clearInterval(timer);
          }
        }, 500);
        return () => clearInterval(timer);
      }
    }

    // Generic Video Logic
    if (video.type === 'generic' && videoElementRef.current) {
      videoElementRef.current.load();
      videoElementRef.current.currentTime = status.time;
      videoElementRef.current.play().catch(() => {});
    }

    // Facebook / X logic usually requires a re-parse or iframe reload handled in render
  }, [video?.id, video?.type, video?.val]);

  return (
    <div className="w-full h-full relative group bg-black">
       {/* YouTube Container */}
       {video?.type === 'yt' && (
          <div className="w-full h-full">
            <div id={`preview-player-${video.id}`} className="w-full h-full" />
            {!playerReady && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
                <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
              </div>
            )}
          </div>
       )}
       
       {/* Facebook Container */}
       {video?.type === 'fb' && (
         <div className="w-full h-full flex items-center justify-center bg-black" key={`preview-fb-${video.id}`}>
           <div 
             className="fb-video" 
             data-href={video.val} 
             data-autoplay="true" 
             data-width="480"
             data-show-captions="false"
             style={{ width: '100%', height: '100%' }}
           />
           <div className="absolute inset-0 z-10" /> {/* Prevents interaction on preview */}
         </div>
       )}

       {/* X Container */}
       {video?.type === 'x' && (
         <div className="w-full h-full bg-black flex items-center justify-center" key={`preview-x-${video.id}`}>
           <iframe
             src={`https://twitframe.com/show?url=${encodeURIComponent(video.val)}`}
             className="w-full h-full border-none pointer-events-none"
             allow="autoplay; encrypted-media; fullscreen"
           />
         </div>
       )}
       
       {/* Generic Container */}
       {video?.type === 'generic' && (
         <video 
           ref={videoElementRef}
           src={video.val} 
           autoPlay 
           muted 
           className="w-full h-full object-contain"
           onLoadedMetadata={(e: any) => {
             e.target.currentTime = status.time;
           }}
         />
       )}

       {error && (
         <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/20 backdrop-blur-sm z-20">
            <Radio className="w-10 h-10 text-red-500 mb-2 opacity-50" />
            <span className="text-[10px] font-black uppercase text-red-500 tracking-[0.3em]">{error}</span>
         </div>
       )}

       {/* Control Overlay */}
       <div className="absolute inset-x-2 bottom-2 translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all z-30">
          <div className="bg-zinc-900/90 backdrop-blur-2xl border border-white/5 p-3 rounded-2xl shadow-2xl flex items-center justify-between gap-4">
             <div className="flex flex-col">
                <div className="flex items-center gap-1.5">
                   <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                   <span className="text-[8px] font-black uppercase text-blue-500 tracking-widest">Station Monitor</span>
                </div>
                <span className="text-[7px] font-black text-zinc-500 uppercase">Live Output</span>
             </div>
             <button 
               onClick={() => {
                 let currentTime = 0;
                 if (video?.type === 'yt' && ytPlayerRef.current) {
                   currentTime = ytPlayerRef.current.getCurrentTime();
                 } else if (video?.type === 'generic' && videoElementRef.current) {
                   currentTime = videoElementRef.current.currentTime;
                 }
                 if (currentTime > 0) onSeek(currentTime);
               }}
               className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-xl text-[8px] font-black uppercase transition-all shadow-lg active:scale-95"
             >
               Force Sync
             </button>
          </div>
       </div>
    </div>
  );
}
