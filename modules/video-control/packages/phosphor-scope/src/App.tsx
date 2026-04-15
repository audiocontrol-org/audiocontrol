import { useState, useCallback, useEffect } from 'react'
import { TopBar, ControlPanel, ScopeDisplay, DropOverlay } from '@/components'
import { useKeyboardShortcuts } from '@/hooks'
import { useAudioStore } from '@/stores'

export function App() {
  const [isDragging, setIsDragging] = useState(false)
  const { loadFile } = useAudioStore()

  // Keyboard shortcuts (Space: play/pause, 1/2/3: mode, R: record)
  useKeyboardShortcuts()

  // Drag counter to handle nested elements
  let dragCounter = 0

  const handleDragEnter = useCallback((e: DragEvent) => {
    e.preventDefault()
    dragCounter++
    if (e.dataTransfer?.types.includes('Files')) {
      setIsDragging(true)
    }
  }, [])

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault()
    dragCounter--
    if (dragCounter === 0) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault()
  }, [])

  const handleDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault()
      dragCounter = 0
      setIsDragging(false)

      const file = e.dataTransfer?.files[0]
      if (file && file.type.startsWith('audio/')) {
        await loadFile(file)
      }
    },
    [loadFile]
  )

  useEffect(() => {
    // Add drag-drop event listeners
    document.addEventListener('dragenter', handleDragEnter)
    document.addEventListener('dragleave', handleDragLeave)
    document.addEventListener('dragover', handleDragOver)
    document.addEventListener('drop', handleDrop)

    return () => {
      document.removeEventListener('dragenter', handleDragEnter)
      document.removeEventListener('dragleave', handleDragLeave)
      document.removeEventListener('dragover', handleDragOver)
      document.removeEventListener('drop', handleDrop)
    }
  }, [handleDragEnter, handleDragLeave, handleDragOver, handleDrop])

  return (
    <div className="flex h-screen flex-col bg-black text-gray-400 overflow-hidden">
      <TopBar />

      <main className="flex flex-1 overflow-hidden">
        <ScopeDisplay />
        <ControlPanel />
      </main>

      <DropOverlay isVisible={isDragging} />
    </div>
  )
}
