import { useRef } from 'react'
import { useAudioStore, useRecordingStore } from '@/stores'
import { RecordButton } from './RecordButton'

export function TopBar() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { isLoaded, isPlaying, fileName, loadFile, togglePlayback, stop } =
    useAudioStore()
  const { isRecording, elapsedTime } = useRecordingStore()

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      await loadFile(file)
    }
  }

  const formatTime = (seconds: number) => {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0')
    const s = String(seconds % 60).padStart(2, '0')
    return `${m}:${s}`
  }

  return (
    <header className="flex items-center justify-between px-5 py-2.5 bg-crt-panel border-b border-crt-border flex-shrink-0">
      {/* Brand */}
      <div className="font-display text-sm font-bold uppercase tracking-[3px] text-gray-300">
        <span className="text-phosphor-green drop-shadow-[0_0_10px_#39ff14]">
          ◉
        </span>{' '}
        Phosphor
      </div>

      {/* File controls */}
      <div className="flex items-center gap-3">
        {/* Recording indicator */}
        {isRecording && (
          <div className="flex items-center gap-2 text-red-500">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="font-mono text-xs">{formatTime(elapsedTime)}</span>
          </div>
        )}

        {/* Track name */}
        {fileName && (
          <span className="text-xs text-gray-500 max-w-[200px] truncate">
            {fileName}
          </span>
        )}

        {/* Transport controls */}
        <div className="flex gap-1">
          <button
            onClick={togglePlayback}
            disabled={!isLoaded}
            className={`
              px-3 py-1.5 text-sm border transition-all
              ${
                isPlaying
                  ? 'border-phosphor-green text-phosphor-green bg-phosphor-green/5'
                  : 'border-crt-border text-gray-500 hover:border-gray-500'
              }
              disabled:opacity-30 disabled:cursor-not-allowed
            `}
            title="Play/Pause (Space)"
          >
            {isPlaying ? '❚❚' : '▶'}
          </button>
          <button
            onClick={stop}
            disabled={!isLoaded}
            className="px-3 py-1.5 text-sm border border-crt-border text-gray-500
              hover:border-gray-500 transition-all
              disabled:opacity-30 disabled:cursor-not-allowed"
            title="Stop"
          >
            ■
          </button>
        </div>

        {/* Record button */}
        <RecordButton />

        {/* File picker */}
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-1.5 text-xs font-medium uppercase tracking-wide
            border border-crt-border text-gray-500
            hover:border-phosphor-green hover:text-phosphor-green
            transition-all"
        >
          Load Audio
        </button>
      </div>
    </header>
  )
}
