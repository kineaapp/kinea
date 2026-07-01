import type { CSSProperties } from 'react'
import KineaLogo from './KineaLogo'
import { useSettingsStore } from '../store/settings'

interface Props {
  width?: number
  height?: number
  barColor?: string
  style?: CSSProperties
}

export default function BrandLogo({ width, height, barColor, style }: Props) {
  const { customLogoDataUrl } = useSettingsStore()

  if (customLogoDataUrl) {
    return (
      <img
        src={customLogoDataUrl}
        alt="Logo"
        style={{
          height: height ?? 36,
          width: 'auto',
          maxWidth: width ?? 160,
          objectFit: 'contain',
          display: 'block',
          flexShrink: 0,
          ...style,
        }}
      />
    )
  }

  return <KineaLogo width={width} height={height} barColor={barColor} />
}
