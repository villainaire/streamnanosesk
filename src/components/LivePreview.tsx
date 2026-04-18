import React, { useState, useEffect, useRef } from "react";
import { RefreshCw, Radio } from "lucide-react";

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

interface LivePreviewProps {
  video: Video;
  status: {
    index: number;
    time: number;
    updatedAt: any;
  };
  onSeek?: (time: number) => void;
  onTimeUpdate?: (time: number) => void;
  showControls?: boolean;
}

export default function LivePreview({ video, status, onSeek, onTimeUpdate, showControls = true }: LivePreviewProps) {
  const ytPlayerRef = useRef<any>(null);
  const videoElementRef = useRef<HTMLVideoElement>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasInteracted, setHasInteracted] = useState(false);

  // Initialize YT API if needed
  useEffect(() => {
    if ((window as any).YT) return;
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
        const YT = (window as any).YT;
        if (!YT || !YT.Player) return;
        
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
          ytPlayerRef.current = new YT.Player(`preview-player-${video.id}`, {
            height: '100%',
            width: '100%',
            videoId: video.val,
            playerVars: { 
              autoplay: 1, 
              controls: 0, 
              modestbranding: 1, 
              mute: 1,
              playsinline: 1,
              start: Math.floor(status.time),
              origin: window.location.origin
            },
            events: {
              onReady: (event: any) => { 
                event.target.mute();
                event.target.playVideo();
                setPlayerReady(true);
              },
              onError: () => setError("YT Signal Error")
            }
          });
        }
      };

      if ((window as any).YT && (window as any).YT.Player) initYT();
      else {
        const timer = setInterval(() => {
          if ((window as any).YT && (window as any).YT.Player) {
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
      videoElementRef.current.play().catch((err) => {
        console.warn("Autoplay blocked:", err);
      });
    }

    // Force re-parse for Facebook XFBML
    if (video.type === 'fb' && (window as any).FB) {
      setTimeout(() => (window as any).FB.XFBML.parse(), 100);
    }

  }, [video?.id, video?.type, video?.val]);

  // Handle User Interaction to Force Play
  const handleActivate = () => {
    setHasInteracted(true);
    if (video?.type === 'yt' && ytPlayerRef.current) {
      ytPlayerRef.current.playVideo();
      ytPlayerRef.current.mute();
    } else if (video?.type === 'generic' && videoElementRef.current) {
      videoElementRef.current.play();
      videoElementRef.current.muted = true;
    }
  };

  // Status Reporting Loop (for Master Control Room)
  useEffect(() => {
    if (!onTimeUpdate) return;

    const report = () => {
      let currentTime = 0;
      if (video?.type === 'yt' && ytPlayerRef.current && ytPlayerRef.current.getCurrentTime) {
        currentTime = ytPlayerRef.current.getCurrentTime();
      } else if (video?.type === 'generic' && videoElementRef.current) {
        currentTime = videoElementRef.current.currentTime;
      }
      
      if (currentTime > 0) {
        onTimeUpdate(currentTime);
      }
    };

    const interval = setInterval(report, 2000);
    return () => clearInterval(interval);
  }, [video?.id, onTimeUpdate]);

  return (
    <div 
      className="w-full h-full relative group bg-black cursor-pointer"
      onClick={handleActivate}
    >
       {/* YouTube Container */}
       {video?.type === 'yt' && (
          <div className="w-full h-full">
            <div id={`preview-player-${video.id}`} className="w-full h-full pointer-events-none" />
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
           <div className="absolute inset-0 z-10" />
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
           playsInline
           className="w-full h-full object-contain pointer-events-none"
           onLoadedMetadata={(e: any) => {
             e.target.currentTime = status.time;
           }}
         />
       )}

       {playerReady && !hasInteracted && (
          <div className="absolute inset-0 z-40 bg-black/60 backdrop-blur-md flex flex-col items-center justify-center gap-4 transition-all group-hover:bg-black/40 pointer-events-none">
             <div className="w-16 h-16 rounded-full bg-red-600/20 border border-red-500/40 flex items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.2)]">
                <Play className="w-8 h-8 text-white fill-current animate-pulse" />
             </div>
             <div className="flex flex-col items-center">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white">Tap to Sync Monitor</span>
                <span className="text-[8px] font-medium uppercase tracking-widest text-zinc-500 mt-1">Browser blocked autoplay</span>
             </div>
          </div>
       )}

       {error && (
         <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-950/20 backdrop-blur-sm z-20">
            <Radio className="w-10 h-10 text-red-500 mb-2 opacity-50" />
            <span className="text-[10px] font-black uppercase text-red-500 tracking-[0.3em]">{error}</span>
         </div>
       )}

       {/* Control Overlay */}
       {showControls && (
         <div className="absolute inset-x-2 bottom-2 translate-y-1 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all z-30">
            <div className="bg-zinc-900/90 backdrop-blur-2xl border border-white/5 p-3 rounded-2xl shadow-2xl flex items-center justify-between gap-4">
               <div className="flex flex-col">
                  <div className="flex items-center gap-1.5">
                     <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />
                     <span className="text-[8px] font-black uppercase text-blue-500 tracking-widest">Station Monitor</span>
                  </div>
                  <span className="text-[7px] font-black text-zinc-500 uppercase">Live Output</span>
               </div>
               {onSeek && (
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
               )}
            </div>
         </div>
       )}
    </div>
  );
}
