import { useEffect, useRef } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'

// Scan code-barres réel via caméra (ZXing). Marche en HTTPS (getUserMedia) sur
// Chrome/Android et Safari/iOS. En cas d'échec (permission refusée, pas de caméra)
// -> onError, et l'appelant propose la saisie manuelle du code.
export default function BarcodeScanner({
  onDetected,
  onError,
}: {
  onDetected: (code: string) => void
  onError?: (e: unknown) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const reader = new BrowserMultiFormatReader()
    let controls: { stop: () => void } | undefined
    let done = false

    reader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
        if (result && !done) {
          done = true
          onDetected(result.getText())
          try {
            controls?.stop()
          } catch {
            /* noop */
          }
        }
      })
      .then((c) => {
        controls = c
      })
      .catch((e) => onError?.(e))

    return () => {
      done = true
      try {
        controls?.stop()
      } catch {
        /* noop */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <video
      ref={videoRef}
      muted
      playsInline
      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
    />
  )
}
