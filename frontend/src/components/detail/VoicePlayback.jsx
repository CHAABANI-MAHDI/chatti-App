import { useEffect, useRef, useState } from "react";
import { formatDuration } from "./formatDuration";

function VoicePlayback({ src, className = "" }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [currentSeconds, setCurrentSeconds] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const handleLoadedMetadata = () => {
      const duration = Number(audio.duration || 0);
      setDurationSeconds(Number.isFinite(duration) ? duration : 0);
    };

    const handleTimeUpdate = () => {
      setCurrentSeconds(Number(audio.currentTime || 0));
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentSeconds(0);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("play", handlePlay);

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("play", handlePlay);
    };
  }, [src]);

  const togglePlay = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      try {
        await audio.play();
      } catch {
        setIsPlaying(false);
      }
      return;
    }

    audio.pause();
  };

  const onSeek = (event) => {
    const audio = audioRef.current;
    if (!audio) return;

    const nextSeconds = Number(event.target.value || 0);
    audio.currentTime = nextSeconds;
    setCurrentSeconds(nextSeconds);
  };

  const progressPercent =
    durationSeconds > 0
      ? Math.min(100, (currentSeconds / durationSeconds) * 100)
      : 0;
  const waveformBars = [22, 38, 30, 52, 28, 42, 35, 55, 33, 40, 26, 48, 34, 44];

  return (
    <div
      className={`rounded-xl border border-white/20 bg-black/25 p-2 ${className}`}
    >
      <audio ref={audioRef} preload="metadata" src={src} className="hidden" />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={togglePlay}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white/90 hover:bg-white/15"
          title={isPlaying ? "Pause voice" : "Play voice"}
        >
          {isPlaying ? (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6 4h3v12H6zM11 4h3v12h-3z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6 4l10 6-10 6V4z" />
            </svg>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex h-6 items-end gap-0.5">
            {waveformBars.map((height, index) => {
              const threshold = ((index + 1) / waveformBars.length) * 100;
              const isActive = progressPercent >= threshold;
              return (
                <span
                  key={`${height}-${index}`}
                  className={`w-1 rounded-full ${isActive ? "bg-lime-300/90" : "bg-white/35"}`}
                  style={{ height: `${height}%` }}
                />
              );
            })}
          </div>

          <input
            type="range"
            min={0}
            max={durationSeconds || 0}
            step={0.1}
            value={Math.min(currentSeconds, durationSeconds || 0)}
            onChange={onSeek}
            className="w-full accent-lime-300"
          />

          <div className="mt-0.5 flex items-center justify-between text-[10px] text-white/70">
            <span>{formatDuration(currentSeconds)}</span>
            <span>{formatDuration(durationSeconds)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VoicePlayback;
