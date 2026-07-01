interface Props {
  width?: number
  height?: number
  barColor?: string
}

export default function KineaLogo({ width = 26, height = 31, barColor = '#FAEEDA' }: Props) {
  return (
    <svg width={width} height={height} viewBox="0 0 86 104" fill="none" style={{ display: 'block', flexShrink: 0 }}>
      <rect x="0" y="0" width="14" height="100" rx="3" fill={barColor} />
      <rect x="22" y="38" width="50" height="14" rx="3" fill={barColor} transform="rotate(-28 22 45)" />
      <rect x="22" y="48" width="62" height="14" rx="3" fill="#E8542A" transform="rotate(28 22 55)" />
    </svg>
  )
}
