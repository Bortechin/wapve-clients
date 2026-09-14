'use client';

import { Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

const SPEEDS = [1, 1.5, 2, 0.75] as const;

export function VoiceMessagePlayer({ src, label }: { src: string; label?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(0);
  const bars = useMemo(
    () => [8, 13, 19, 11, 22, 27, 16, 31, 23, 12, 18, 28, 34, 20, 15, 25, 30, 17, 10, 21, 27, 14, 19, 9],
    [],
  );
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const update = () => {
      setCurrentTime(audio.currentTime);
      setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    };
    const stop = () => setPlaying(false);
    audio.addEventListener('timeupdate', update);
    audio.addEventListener('loadedmetadata', update);
    audio.addEventListener('durationchange', update);
    audio.addEventListener('ended', stop);
    audio.addEventListener('pause', stop);
    audio.addEventListener('play', () => setPlaying(true));
    return () => {
      audio.removeEventListener('timeupdate', update);
      audio.removeEventListener('loadedmetadata', update);
      audio.removeEventListener('durationchange', update);
      audio.removeEventListener('ended', stop);
      audio.removeEventListener('pause', stop);
    };
  }, []);

  async function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) await audio.play();
    else audio.pause();
  }

  function cycleSpeed() {
    const next = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(next);
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next]!;
  }

  return (
    <div className="voice-message-player" aria-label={label}>
      <audio ref={audioRef} src={src} preload="metadata" muted={muted} />
      <button
        type="button"
        className="voice-message-play"
        aria-label={playing ? 'Duraklat' : 'Oynat'}
        onClick={() => void togglePlayback()}
      >
        {playing ? <Pause size={16} /> : <Play size={17} fill="currentColor" />}
      </button>
      <div className="voice-message-wave-shell">
        <div className="voice-message-wave" aria-hidden="true">
          {bars.map((height, index) => (
            <i key={index} style={{ height }} />
          ))}
          <span style={{ width: `${progress}%` }}>
            {bars.map((height, index) => (
              <i key={index} style={{ height }} />
            ))}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max={Math.max(duration, 0.01)}
          step="0.01"
          value={Math.min(currentTime, Math.max(duration, 0.01))}
          aria-label="Sesli mesaj konumu"
          onChange={(event) => {
            const next = Number(event.target.value);
            if (audioRef.current) audioRef.current.currentTime = next;
            setCurrentTime(next);
          }}
        />
      </div>
      <time>{formatTime(duration > 0 ? Math.max(0, duration - currentTime) : 0)}</time>
      <button type="button" className="voice-message-speed" onClick={cycleSpeed}>
        {SPEEDS[speedIndex]}x
      </button>
      <button
        type="button"
        className="voice-message-volume"
        aria-label={muted ? 'Sesi aç' : 'Sesi kapat'}
        onClick={() => setMuted((value) => !value)}
      >
        {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
      </button>
    </div>
  );
}

function formatTime(value: number): string {
  if (!Number.isFinite(value)) return '0:00';
  const seconds = Math.max(0, Math.round(value));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
