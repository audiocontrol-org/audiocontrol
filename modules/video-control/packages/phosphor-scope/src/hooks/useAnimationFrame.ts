import { useEffect, useRef } from 'react'

export function useAnimationFrame(callback: (deltaTime: number) => void) {
  const requestRef = useRef<number | null>(null)
  const previousTimeRef = useRef<number | null>(null)

  useEffect(() => {
    const animate = (time: number) => {
      if (previousTimeRef.current !== null) {
        const deltaTime = time - previousTimeRef.current
        callback(deltaTime)
      }
      previousTimeRef.current = time
      requestRef.current = requestAnimationFrame(animate)
    }

    requestRef.current = requestAnimationFrame(animate)

    return () => {
      if (requestRef.current !== null) {
        cancelAnimationFrame(requestRef.current)
      }
    }
  }, [callback])
}
