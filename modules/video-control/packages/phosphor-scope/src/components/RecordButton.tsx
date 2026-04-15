import { useRecordingStore, useAudioStore } from '@/stores'
import { useRecording } from '@/hooks/useRecording'

export function RecordButton() {
  const { isLoaded } = useAudioStore()
  const { isRecording, elapsedTime } = useRecordingStore()
  const { toggleRecording } = useRecording()

  const formatTime = (seconds: number) => {
    const m = String(Math.floor(seconds / 60)).padStart(2, '0')
    const s = String(seconds % 60).padStart(2, '0')
    return `${m}:${s}`
  }

  return (
    <button
      onClick={toggleRecording}
      disabled={!isLoaded}
      className={`
        px-4 py-1.5 text-xs font-medium uppercase tracking-wide
        border transition-all flex items-center gap-2
        ${
          isRecording
            ? 'border-red-500 text-red-500 bg-red-500/10'
            : 'border-crt-border text-gray-500 hover:border-red-500 hover:text-red-500'
        }
        disabled:opacity-30 disabled:cursor-not-allowed
      `}
      title={isRecording ? 'Stop Recording (R)' : 'Start Recording (R)'}
    >
      {isRecording ? (
        <>
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span>{formatTime(elapsedTime)}</span>
          <span>Stop</span>
        </>
      ) : (
        <>
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span>Record</span>
        </>
      )}
    </button>
  )
}
