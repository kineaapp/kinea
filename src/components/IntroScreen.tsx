import { useRef, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

export default function IntroScreen({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [fading, setFading] = useState(false)

  function finish() {
    if (fading) return
    setFading(true)
    setTimeout(onDone, 600)
  }

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.play().catch(() => finish())
  }, [])

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#000',
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.6s ease',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <video
        ref={videoRef}
        src="/intro.mp4"
        playsInline
        muted
        onEnded={finish}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <button
        onClick={finish}
        style={{
          position: 'absolute', bottom: 40, right: 24,
          background: 'rgba(255,255,255,0.18)',
          border: '1px solid rgba(255,255,255,0.3)',
          color: '#fff',
          borderRadius: 20,
          padding: '8px 18px',
          fontSize: 13,
          fontFamily: '"Libre Franklin", sans-serif',
          fontWeight: 600,
          cursor: 'pointer',
          backdropFilter: 'blur(6px)',
          letterSpacing: '.2px',
        }}
      >
        {t('common.skip')}
      </button>
    </div>
  )
}
