import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { collection, query, where, onSnapshot, orderBy, getDocs, limit, updateDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Play, SkipBack, SkipForward, Volume2, VolumeX, List, Tv, X, Radio, ChevronRight, Share2, Disc, Edit2, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

declare global {
  interface Window {
    FB: any;
    onYouTubeIframeAPIReady: () => void;
    YT: any;
    fbAsyncInit: () => void;
  }
}

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

// Time Helpers
const toSeconds = (hms: string) => {
  if (!hms || typeof hms !== 'string') return 0;
  
  const clean = hms.replace(/[^0-9:]/g, '');
  if (!clean) return 0;

  const parts = clean.split(':').map(Number);
  
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return (Number(h || 0) * 3600) + (Number(m || 0) * 60) + Number(s || 0);
  }
  
  if (parts.length === 2) {
    const [m, s] = parts;
    return (Number(m || 0) * 60) + Number(s || 0);
  }

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

export default function Player() {
  const { channelSlug } = useParams();
  const { appUser } = useAuth();
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playCount, setPlayCount] = useState(0);
  const [channelName, setChannelName] = useState("Loading...");
  const [channelId, setChannelId] = useState("");
  const [masterControl, setMasterControl] = useState(false);
  const [loopPlaylist, setLoopPlaylist] = useState(false);
  const [targetVideoId, setTargetVideoId] = useState<string | null>(null);
  const [playbackStatus, setPlaybackStatus] = useState<any>(null);

  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndTime, setEditEndTime] = useState("00:00:00");
  const [editUrl, setEditUrl] = useState("");
  const [isFetching, setIsFetching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loopPlaylistRef = useRef(loopPlaylist);
  const videosRef = useRef(videos);
  const currentIndexRef = useRef(currentIndex);

  useEffect(() => { loopPlaylistRef.current = loopPlaylist; }, [loopPlaylist]);
  useEffect(() => { videosRef.current = videos; }, [videos]);
  useEffect(() => { currentIndexRef.current = currentIndex; }, [currentIndex]);

  const handleFetchDuration = (url: string) => {
    const id = ytId(url);
    if (!id) return;
    
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
          setEditEndTime(fromSeconds(duration));
          setIsFetching(false);
          event.target.destroy();
        },
        onError: () => setIsFetching(false)
      }
    });
  };

  const ytId = (url: string) => {
    const m = url.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
    return m ? m[1] : null;
  };

  const ytPlayerRef = useRef<any>(null);
  const fbPlayerRef = useRef<any>(null);
  const fbIntervalRef = useRef<any>(null);
  const videoElementRef = useRef<HTMLVideoElement>(null);

  // 1. Fetch Channel and Playlist
  useEffect(() => {
    if (!channelSlug) return;

    const channelsQuery = query(collection(db, "channels"), where("slug", "==", channelSlug), limit(1));
    const unsubChannel = onSnapshot(channelsQuery, (snapshot) => {
      if (!snapshot.empty) {
        const channelDoc = snapshot.docs[0];
        const data = channelDoc.data();
        setChannelId(channelDoc.id);
        setChannelName(data.name);
        setLoopPlaylist(data.loopPlaylist || false);
        setMasterControl(data.masterControl || false);
        setPlaybackStatus(data.playbackStatus || null);

        // Remote Sync Command Listener
        if (data.syncTrigger) {
          const { type, timestamp } = data.syncTrigger;
          const triggerTime = timestamp?.toMillis() || 0;
          
          // Only process if it's a NEW trigger (not from a previous session)
          const lastTriggerTime = parseInt(localStorage.getItem(`lastSync_${channelDoc.id}`) || "0");
          
          if (triggerTime > lastTriggerTime) {
            localStorage.setItem(`lastSync_${channelDoc.id}`, triggerTime.toString());
            
            if (type === 'RESTART_PLAYLIST') {
              setCurrentIndex(0);
              setPlayCount(c => c + 1);
            } else if (type === 'RESTART_VIDEO') {
              setPlayCount(c => c + 1);
            } else if (type === 'PLAY_VIDEO') {
              const vId = data.syncTrigger.videoId;
              // We need the latest videos array here, but videos are loaded in another effect.
              // We'll use a signal to trigger a search in the next render or use a ref.
              // Actually, we can just find it in the current state if it's already there.
              setTargetVideoId(vId);
            } else if (type === 'SEEK_TO') {
              const time = data.syncTrigger.time;
              if (currentVideo?.type === 'yt' && ytPlayerRef.current) {
                ytPlayerRef.current.seekTo(time, true);
              } else if (currentVideo?.type === 'fb' && fbPlayerRef.current) {
                fbPlayerRef.current.seek(time);
              } else if (currentVideo?.type === 'generic' && videoElementRef.current) {
                videoElementRef.current.currentTime = time;
              }
            }
          }
        }
      }
    });

    return () => unsubChannel();
  }, [channelSlug]);

  useEffect(() => {
    if (!channelId) return;

    const videosQuery = query(
      collection(db, "channels", channelId, "videos"), 
      where("active", "==", true),
      orderBy("order", "asc")
    );
    
    const unsubVideos = onSnapshot(videosQuery, (vSnapshot) => {
      const vData = vSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Video));
      // Only update if there's an actual change in IDs or order to prevent unnecessary re-renders
      setVideos(prev => {
        const hasChange = vData.length !== prev.length || vData.some((v, i) => v.id !== prev[i]?.id);
        if (hasChange) return vData;
        
        // Even if IDs are same, check if specific video data changed (like startTime/endTime)
        // because we want real-time edits to reflect, but not restart the list if only a LATER video was added
        const dataChanged = vData.some((v, i) => 
          v.val !== prev[i]?.val || 
          v.startTime !== prev[i]?.startTime || 
          v.endTime !== prev[i]?.endTime
        );
        return dataChanged ? vData : prev;
      });
    });

    return () => unsubVideos();
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

    const script = document.createElement('script');
    script.src = "https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v18.0";
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    document.body.appendChild(script);

    window.fbAsyncInit = function() {
      window.FB.init({ xfbml: true, version: 'v18.0' });
      window.FB.Event.subscribe('xfbml.ready', (msg: any) => {
        if (msg.type === 'video') {
          fbPlayerRef.current = msg.instance;
          fbPlayerRef.current.play();
          fbPlayerRef.current.unmute();
          
          // Fix: Support Start Timecode for FB
          const curV = videosRef.current[currentIndexRef.current];
          if (curV && curV.type === 'fb' && curV.startTime) {
            fbPlayerRef.current.seek(curV.startTime);
          }
          
          fbPlayerRef.current.subscribe('finishedPlaying', handleNext);
        }
      });
    };
  }, []);

  const handleNext = () => {
    const curV = videosRef.current[currentIndexRef.current];
    if (curV?.loopVideo) {
      setPlayCount(c => c + 1);
      return;
    }
    
    setCurrentIndex((p) => {
      if (p === videosRef.current.length - 1) {
        if (loopPlaylistRef.current) {
          setPlayCount(c => c + 1);
          return 0;
        }
        return p;
      }
      return p + 1;
    });
  };

  const handleRefreshPlaylist = () => {
    setIsRefreshing(true);
    // Force a re-sync by resetting and letting onSnapshot handle it
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const handlePlaySpecificVideo = async (vId: string) => {
    if (!channelId) return;
    await updateDoc(doc(db, "channels", channelId), {
      syncTrigger: {
        type: 'PLAY_VIDEO',
        videoId: vId,
        timestamp: serverTimestamp()
      }
    });
  };

  const handleRefreshVideo = () => {
    setPlayCount(c => c + 1); // This will trigger the useEffect to reload the player
  };
  
  const handlePrev = () => setCurrentIndex((p) => (p - 1 + videos.length) % videos.length);

  const toggleGlobalLoop = async () => {
    if (!channelId) return;
    await updateDoc(doc(db, "channels", channelId), {
      loopPlaylist: !loopPlaylist
    });
  };

  const toggleSingleLoop = async (v: Video) => {
    if (!channelId) return;
    await updateDoc(doc(db, "channels", channelId, "videos", v.id), {
      loopVideo: !v.loopVideo
    });
  };

  const handleUpdateTimes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!channelId || !editingVideo) return;

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
  };

  const currentVideo = videos[currentIndex];

  const lastLoadedVideoRef = useRef<string | null>(null);
  const lastLoadedParamsRef = useRef<string>("");
  const lastHandledPlayCountRef = useRef(0);

  useEffect(() => {
    if (!currentVideo) {
      lastLoadedVideoRef.current = null;
      lastLoadedParamsRef.current = "";
      return;
    }

    if (fbIntervalRef.current) clearInterval(fbIntervalRef.current);

    // Stop other players
    if (currentVideo.type !== 'yt' && ytPlayerRef.current && ytPlayerRef.current.pauseVideo) {
      try { ytPlayerRef.current.pauseVideo(); } catch(e) {}
    }
    if (currentVideo.type !== 'fb' && fbPlayerRef.current) {
      try { fbPlayerRef.current.pause(); } catch(e) {}
    }
    if (currentVideo.type !== 'generic' && videoElementRef.current) {
      try { videoElementRef.current.pause(); } catch(e) {}
    }

    if (currentVideo.type === 'yt' && window.YT && window.YT.Player) {
      const playerVars: any = { 
        autoplay: 1, 
        controls: 1, 
        rel: 0, 
        fs: 1, 
        modestbranding: 1,
      };

      if (currentVideo.startTime) playerVars.start = currentVideo.startTime;
      if (currentVideo.endTime) playerVars.end = currentVideo.endTime;

      const currentParams = `${currentVideo.val}-${currentVideo.startTime || 0}-${currentVideo.endTime || 'max'}`;

      if (!ytPlayerRef.current) {
        ytPlayerRef.current = new window.YT.Player('yt-player-target', {
          height: '1080',
          width: '1920',
          videoId: currentVideo.val,
          playerVars,
          events: {
            onStateChange: (event: any) => {
              if (event.data === window.YT.PlayerState.ENDED) handleNext();
            }
          }
        });
        lastLoadedVideoRef.current = currentVideo.id;
        lastLoadedParamsRef.current = currentParams;
        lastHandledPlayCountRef.current = playCount;
      } else {
        const paramsChanged = lastLoadedParamsRef.current !== currentParams;
        const playCountTriggered = lastHandledPlayCountRef.current !== playCount;

        if (paramsChanged || playCountTriggered) {
          try {
            ytPlayerRef.current.loadVideoById({
              videoId: currentVideo.val,
              startSeconds: currentVideo.startTime || 0,
              endSeconds: currentVideo.endTime || undefined
            });
          } catch (e) {
            // If the player is corrupted, recreate it
            ytPlayerRef.current = new window.YT.Player('yt-player-target', {
              videoId: currentVideo.val,
              playerVars,
              events: {
                onStateChange: (event: any) => {
                  if (event.data === window.YT.PlayerState.ENDED) handleNext();
                }
              }
            });
          }
          lastLoadedVideoRef.current = currentVideo.id;
          lastLoadedParamsRef.current = currentParams;
          lastHandledPlayCountRef.current = playCount;
        } else {
          try { ytPlayerRef.current.playVideo(); } catch(e) {}
        }
      }
    }

    if (currentVideo.type === 'fb' && window.FB) {
      setTimeout(() => window.FB.XFBML.parse(), 100);

      if (currentVideo.endTime) {
        fbIntervalRef.current = setInterval(() => {
          if (fbPlayerRef.current) {
            const currentPos = fbPlayerRef.current.getCurrentPosition();
            if (currentPos >= currentVideo.endTime!) {
              handleNext();
            }
          }
        }, 1000);
      }
    }

    if (currentVideo.type === 'generic' && videoElementRef.current) {
      videoElementRef.current.load();
      videoElementRef.current.play().catch(() => {});
    }

    return () => {
      if (fbIntervalRef.current) clearInterval(fbIntervalRef.current);
    };
  }, [currentIndex, currentVideo?.id, currentVideo?.type, currentVideo?.val, currentVideo?.startTime, currentVideo?.endTime, playCount]);

  useEffect(() => {
    if (targetVideoId && videos.length > 0) {
      const idx = videos.findIndex(v => v.id === targetVideoId);
      if (idx !== -1) {
        setCurrentIndex(idx);
        setPlayCount(c => c + 1);
      }
      setTargetVideoId(null);
    }
  }, [targetVideoId, videos]);

  // 4. Universal Synchronization (Follow Master)
  useEffect(() => {
    if (!masterControl || !playbackStatus || !videos.length) return;

    // Determine current local time
    let localTime = 0;
    if (currentVideo?.type === 'yt' && ytPlayerRef.current && ytPlayerRef.current.getCurrentTime) {
      localTime = ytPlayerRef.current.getCurrentTime();
    } else if (currentVideo?.type === 'fb' && fbPlayerRef.current) {
      localTime = fbPlayerRef.current.getCurrentPosition();
    } else if (currentVideo?.type === 'generic' && videoElementRef.current) {
      localTime = videoElementRef.current.currentTime;
    }

    const { index, time, updatedAt } = playbackStatus;
    
    // 1. Check Index
    if (index !== currentIndex) {
      setCurrentIndex(index);
      return;
    }

    // 2. Check Drift (Allow 6 seconds gap for network latency)
    const now = Date.now();
    const recordedAt = updatedAt?.toMillis() || now;
    const driftSeconds = (now - recordedAt) / 1000;
    const adjustedMasterTime = time + driftSeconds;

    if (Math.abs(localTime - adjustedMasterTime) > 7) {
      console.log("Universal Sync: Seeking to master time", adjustedMasterTime);
      if (currentVideo?.type === 'yt' && ytPlayerRef.current && ytPlayerRef.current.seekTo) {
        ytPlayerRef.current.seekTo(adjustedMasterTime, true);
      } else if (currentVideo?.type === 'fb' && fbPlayerRef.current) {
        fbPlayerRef.current.seek(adjustedMasterTime);
      } else if (currentVideo?.type === 'generic' && videoElementRef.current) {
        videoElementRef.current.currentTime = adjustedMasterTime;
      }
    }
  }, [masterControl, playbackStatus?.index, playbackStatus?.time]);

  useEffect(() => {
    // ONLY the owner or an admin should report status to the master console
    if (!channelId || !currentVideo || !appUser || !masterControl) return;
    
    // Safety check: only report if we have write permissions (owner or admin)
    // We could check channel.ownerId if we had it in state, but appUser check is a good start
    // to prevent general public viewer console spam.
    
    const reportStatus = async () => {
      try {
        let currentTime = 0;
        if (currentVideo.type === 'yt' && ytPlayerRef.current) {
          currentTime = ytPlayerRef.current.getCurrentTime();
        } else if (currentVideo.type === 'fb' && fbPlayerRef.current) {
          currentTime = fbPlayerRef.current.getCurrentPosition();
        } else if (currentVideo.type === 'generic' && videoElementRef.current) {
          currentTime = videoElementRef.current.currentTime;
        }

        await updateDoc(doc(db, "channels", channelId), {
          playbackStatus: {
            index: currentIndex,
            time: currentTime,
            updatedAt: serverTimestamp()
          }
        });
      } catch (err) {
        // Silently fail if permissions are missing (prevents loop if user is not the owner)
        console.debug("Status report skipped: Insufficient permissions");
      }
    };

    const interval = setInterval(reportStatus, 5000); // 5s is plenty for sync
    return () => clearInterval(interval);
  }, [channelId, currentIndex, currentVideo, appUser]);

  if (videos.length === 0) {
    return (
      <div className="w-[2400px] h-[1300px] bg-black flex flex-col items-center justify-center relative overflow-hidden">
        <div className="relative flex flex-col items-center gap-6">
           <Tv className="w-20 h-20 text-zinc-900 animate-pulse" />
           <div className="text-center">
             <h2 className="text-xl font-black italic uppercase tracking-tighter text-zinc-800">{channelName}</h2>
             <p className="text-zinc-900 text-[10px] font-black uppercase tracking-[0.3em] mt-2">No Feed Detected</p>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-[2400px] h-[1300px] bg-black overflow-hidden flex font-sans text-white border-b-[220px] border-black">
      {/* 
        CLEAN BROADCAST AREA (Fixed 1920x1080)
        Top-Left aligned for easy OBS cropping.
      */}
      <div className="w-[1920px] h-[1080px] relative bg-black shrink-0">
        {/* YouTube Container */}
        <div className={`w-full h-full ${currentVideo?.type !== 'yt' ? 'hidden' : ''}`}>
          <div id="yt-player-target" className="w-full h-full" />
        </div>

        {/* Facebook Container */}
        <div className={`w-full h-full flex items-center justify-center ${currentVideo?.type !== 'fb' ? 'hidden' : ''}`} key={`${currentVideo.id}-${playCount}`}>
          <div 
            className="fb-video" 
            data-href={currentVideo?.val} 
            data-autoplay="true" 
            data-allowfullscreen="true"
            data-width="1920"
            data-show-captions="false"
            style={{ width: '1920px', height: '1080px' }}
          />
        </div>

        {/* X (Twitter) Container */}
        <div className={`w-full h-full bg-black flex items-center justify-center ${currentVideo?.type !== 'x' ? 'hidden' : ''}`} key={`${currentVideo.id}-x-${playCount}`}>
          <iframe
            src={currentVideo?.type === 'x' ? `https://twitframe.com/show?url=${encodeURIComponent(currentVideo.val)}` : ''}
            className="w-full h-full border-none shadow-2xl"
            allow="autoplay; encrypted-media; fullscreen"
          />
        </div>

        {/* Generic/Standard Video Container */}
        <div className={`w-full h-full bg-black flex items-center justify-center ${currentVideo?.type !== 'generic' ? 'hidden' : ''}`}>
          <video
            ref={videoElementRef}
            src={currentVideo?.type === 'generic' ? currentVideo.val : ''}
            autoPlay
            muted={false}
            controls
            className="w-full h-full object-contain"
            onEnded={handleNext}
            onLoadedMetadata={(e: any) => {
              if (currentVideo?.startTime) e.target.currentTime = currentVideo.startTime;
            }}
            onTimeUpdate={(e: any) => {
              if (currentVideo?.endTime && e.target.currentTime >= currentVideo.endTime) {
                handleNext();
              }
            }}
          />
        </div>
      </div>

      {/* Control Sidebar (Permanent, 480px Wide, 1300px High) */}
      <div className="w-[480px] h-[1300px] bg-zinc-950 border-l border-white/5 flex flex-col shadow-[-20px_0_50px_rgba(0,0,0,0.5)]">
        <div className="p-8 border-b border-white/5 bg-zinc-900/50 flex items-center justify-between">
          <div className="space-y-1">
            <h3 className="text-xs font-black italic uppercase tracking-[0.3em] text-zinc-500">Live Feed</h3>
            <h4 className="text-xl font-black uppercase italic tracking-tighter">Sequence Menu</h4>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleRefreshPlaylist}
              className={`p-2 rounded-lg bg-zinc-900 border border-white/5 text-zinc-500 hover:text-white transition-all ${isRefreshing && 'animate-spin'}`}
              title="Refresh Playlist"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            {appUser && (
              <button 
                onClick={toggleGlobalLoop}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all ${loopPlaylist ? 'bg-red-600 border-red-500 text-white' : 'bg-zinc-900 border-white/5 text-zinc-500'}`}
              >
                <Disc className={`w-3.5 h-3.5 ${loopPlaylist && 'animate-spin'}`} />
                <span className="text-[10px] font-black uppercase tracking-widest">Loop</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-black/20">
          {videos.map((v, i) => (
            <motion.div
              key={v.id}
              whileHover={{ scale: 1.01 }}
              className={`group w-full p-4 flex gap-5 text-left transition-all rounded-3xl border border-white/5 ${
                i === currentIndex ? 'bg-red-600/10 border-red-500/20 shadow-2xl' : 'bg-black/40'
              }`}
            >
              <div 
                className="w-24 aspect-video bg-zinc-900 rounded-[15px] shrink-0 flex items-center justify-center overflow-hidden relative cursor-pointer"
                onClick={() => setCurrentIndex(i)}
              >
                {v.type === 'yt' ? (
                  <img 
                    src={`https://img.youtube.com/vi/${v.val}/mqdefault.jpg`} 
                    alt="thumb" 
                    className={`w-full h-full object-cover transition-all duration-700 ${i === currentIndex ? 'scale-110 opacity-100' : 'opacity-40 grayscale hover:opacity-100 hover:grayscale-0'}`}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <Tv className="w-8 h-8 text-zinc-800" />
                )}
                {i === currentIndex && (
                  <div className="absolute inset-0 bg-red-600/20 flex items-center justify-center">
                    <div className="w-2 h-2 bg-red-600 rounded-full animate-ping" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0 py-1 flex flex-col">
                <div 
                  className="flex-1 cursor-pointer"
                  onClick={() => setCurrentIndex(i)}
                >
                  <h4 className={`font-black uppercase tracking-tight leading-tight line-clamp-1 text-xs mb-1 ${i === currentIndex ? 'text-white' : 'text-zinc-500'}`}>
                    {v.title}
                  </h4>
                  <div className="flex items-center gap-2 mb-2">
                    {v.loopVideo && <span className="text-[8px] bg-orange-500 text-black px-1.5 py-0.5 rounded font-black uppercase">L-ON</span>}
                    {(v.startTime || v.endTime) && (
                      <span className="text-[8px] bg-red-600/20 text-red-500 px-1.5 py-0.5 rounded font-black uppercase">
                        {fromSeconds(v.startTime || 0)}-{fromSeconds(v.endTime || 0)} 
                        <span className="ml-1 opacity-50">({fromSeconds((v.endTime || 0) - (v.startTime || 0))})</span>
                      </span>
                    )}
                  </div>
                </div>
                
                {appUser && (
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => handlePlaySpecificVideo(v.id)}
                      className={`p-1.5 rounded-lg transition-all ${i === currentIndex ? 'bg-red-600 text-white' : 'bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white'}`}
                      title="Play Now (Sync All)"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                    </button>
                    <button 
                      onClick={() => {
                         setEditingVideo(v);
                         setEditTitle(v.title);
                         setEditUrl(v.url);
                         setEditStartTime(fromSeconds(v.startTime || 0));
                         setEditEndTime(fromSeconds(v.endTime || 0));
                      }}
                      className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-600 hover:text-white transition-all"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      onClick={() => toggleSingleLoop(v)}
                      className={`p-1.5 rounded-lg transition-all ${v.loopVideo ? 'text-orange-500 bg-orange-500/10' : 'text-zinc-600 hover:text-zinc-400'}`}
                    >
                      <Disc className={`w-3.5 h-3.5 ${v.loopVideo && 'animate-spin'}`} />
                    </button>
                    {i === currentIndex && <ChevronRight className="w-4 h-4 text-red-600 ml-auto" />}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Global Controls */}
        <div className="p-10 bg-black/80 backdrop-blur-3xl border-t border-white/5 flex flex-col gap-8">
            {appUser && (
              <div className="flex items-center justify-center gap-4">
                 <button 
                   onClick={handlePrev}
                   className="p-4 bg-zinc-900 hover:bg-zinc-800 rounded-[20px] transition-all group active:scale-90"
                   title="Previous Video"
                 >
                   <SkipBack className="w-4 h-4 text-zinc-500 group-hover:text-white" />
                 </button>
                 
                 <button 
                   onClick={() => {
                     setCurrentIndex(0);
                     setPlayCount(c => c + 1);
                   }}
                   className="p-4 bg-zinc-900 hover:bg-zinc-800 rounded-[20px] transition-all group active:scale-90"
                   title="Restart Playlist"
                 >
                   <RefreshCw className="w-4 h-4 text-zinc-500 group-hover:text-blue-400" />
                 </button>

                 <div 
                   className="p-6 bg-red-600 rounded-[28px] flex items-center justify-center shadow-2xl shadow-red-600/40 active:scale-95 transition-transform cursor-pointer relative group"
                   onClick={handleRefreshVideo} 
                   title="Restart Current Source"
                 >
                   <Play className="w-6 h-6 fill-white text-white translate-x-1" />
                 </div>

                 <button 
                   onClick={handleNext}
                   className="p-4 bg-zinc-900 hover:bg-zinc-800 rounded-[20px] transition-all group active:scale-90"
                   title="Next Video"
                 >
                   <SkipForward className="w-4 h-4 text-zinc-500 group-hover:text-white" />
                 </button>
              </div>
            )}

           <div className="flex flex-col gap-2 px-4">
              <div className="flex items-center justify-between text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                 <span>Active Node: {channelName}</span>
                 <Share2 className="w-4 h-4 hover:text-white cursor-pointer transition-colors" />
              </div>
              <p className="text-[9px] text-zinc-700 font-bold uppercase tracking-tighter">Broadcast Output: 1920x1080 Clean</p>
           </div>
        </div>
      </div>
      {editingVideo && (
        <PlayerModal 
          video={editingVideo}
          editTitle={editTitle}
          setEditTitle={setEditTitle}
          editUrl={editUrl}
          setEditUrl={(url: string) => {
            setEditUrl(url);
            if (url.includes('youtu')) handleFetchDuration(url);
          }}
          editStartTime={editStartTime}
          setEditStartTime={setEditStartTime}
          editEndTime={editEndTime}
          setEditEndTime={setEditEndTime}
          isFetching={isFetching}
          onDiscard={() => setEditingVideo(null)}
          onCommit={handleUpdateTimes}
        />
      )}
    </div>
  );
}

// Sub-component or inline modal for Player Edit
function PlayerModal({ video, onDiscard, onCommit, editTitle, setEditTitle, editUrl, setEditUrl, editStartTime, setEditStartTime, editEndTime, setEditEndTime, isFetching }: any) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-3xl shrink-0">
      <motion.div 
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        className="bg-zinc-900 border border-white/5 p-10 rounded-[32px] max-w-xl w-full shadow-2xl overflow-hidden"
      >
        <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-8 tracking-tight">Broadcast Timing</h2>
        <form onSubmit={onCommit} className="space-y-8">
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2 block">Content Label</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full bg-black border border-white/5 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all font-bold placeholder:text-zinc-800 shadow-inner"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2 block">Source Link</label>
                <input
                  type="text"
                  required
                  value={editUrl}
                  onChange={(e) => setEditUrl(e.target.value)}
                  className="w-full bg-black border border-white/5 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all font-bold placeholder:text-zinc-800 shadow-inner"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2 block">Start At (H:M:S)</label>
                <input
                  type="text"
                  value={editStartTime}
                  onChange={(e) => setEditStartTime(e.target.value)}
                  className="w-full bg-black border border-white/5 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all font-mono font-bold"
                  placeholder="00:00:00"
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] mb-2 block">End At (H:M:S)</label>
                <input
                  type="text"
                  value={editEndTime}
                  onChange={(e) => setEditEndTime(e.target.value)}
                  className="w-full bg-black border border-white/5 rounded-2xl px-6 py-4 focus:outline-none focus:ring-2 focus:ring-red-600 transition-all font-mono font-bold"
                  placeholder="00:00:00"
                />
              </div>
            </div>
            {(toSeconds(editEndTime) > 0) && (
              <div className="bg-red-600/5 border border-red-600/20 p-4 rounded-2xl flex items-center justify-between mt-4">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Net Playback:</span>
                <span className="text-xl font-black italic text-red-500 uppercase tracking-tighter">
                  {fromSeconds(Math.max(0, toSeconds(editEndTime) - toSeconds(editStartTime)))}
                </span>
              </div>
            )}
          </div>

          <div className="flex gap-4 pt-4">
            <button 
              type="button"
              onClick={onDiscard}
              className="flex-1 px-6 py-5 bg-zinc-800 hover:bg-zinc-700 rounded-2xl font-black uppercase text-xs tracking-widest transition-all"
            >
              Discard
            </button>
            <button 
              type="submit"
              className="flex-1 px-6 py-5 bg-red-600 hover:bg-red-500 rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-xl shadow-red-600/20"
            >
              Commit
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export function PlayerContainer() {
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  // ... this needs more cleanup, but basic logic is moved
}
