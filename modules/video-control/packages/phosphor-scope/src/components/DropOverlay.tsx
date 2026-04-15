interface DropOverlayProps {
  isVisible: boolean
}

export function DropOverlay({ isVisible }: DropOverlayProps) {
  if (!isVisible) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="border-2 border-dashed border-phosphor-green p-16 rounded-lg">
        <div className="text-center">
          <div className="text-phosphor-green text-4xl mb-4 drop-shadow-[0_0_20px_#39ff14]">
            ◉
          </div>
          <p className="text-phosphor-green text-lg font-display uppercase tracking-wider">
            Drop Audio File
          </p>
        </div>
      </div>
    </div>
  )
}
