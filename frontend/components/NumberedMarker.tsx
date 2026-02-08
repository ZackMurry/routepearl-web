'use client'

import { Marker } from 'react-leaflet'
import L, { LatLngExpression, PointTuple } from 'leaflet'
import { useEffect, useState } from 'react'

type Props = {
  position: LatLngExpression
  number: number
  size?: number
  color?: string
  textColor?: string
  selected?: boolean
  onRightClick?: () => void
  onClick?: () => void
  onDragEnd?: (lat: number, lng: number) => void
  draggable?: boolean
}

export default function NumberedMarker({
  position,
  number,
  size = 28,
  color = '#10b981',
  textColor = 'white',
  selected = false,
  onRightClick,
  onClick,
  onDragEnd,
  draggable = false,
}: Props) {
  const [icon, setIcon] = useState<L.DivIcon | null>(null)

  useEffect(() => {
    const scale = selected ? 1.45 : 1
    const effectiveSize = size * scale
    const pinWidth = effectiveSize
    const pinHeight = effectiveSize * 1.4
    const circleR = effectiveSize * 0.42
    const fontSize = number > 99 ? effectiveSize * 0.32 : effectiveSize * 0.4
    const cx = pinWidth / 2
    const circleY = circleR + 1
    const tipY = pinHeight - 1

    const strokeColor = selected ? '#2563eb' : '#000000'
    const strokeWidth = selected ? 2.5 : 1.5
    const glow = selected
      ? `<filter id="glow"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>`
      : ''
    const filterAttr = selected ? ' filter="url(#glow)"' : ''

    const html = `
      <svg width="${pinWidth}" height="${pinHeight}" viewBox="0 0 ${pinWidth} ${pinHeight}" xmlns="http://www.w3.org/2000/svg">
        ${glow ? `<defs>${glow}</defs>` : ''}
        <path d="M${cx},${tipY} C${cx - circleR * 0.6},${circleY + circleR * 1.1} ${cx - circleR},${circleY + circleR * 0.4} ${cx - circleR},${circleY}
          A${circleR},${circleR} 0 1,1 ${cx + circleR},${circleY}
          C${cx + circleR},${circleY + circleR * 0.4} ${cx + circleR * 0.6},${circleY + circleR * 1.1} ${cx},${tipY}Z"
          fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}"${filterAttr}/>
        <text x="${cx}" y="${circleY + fontSize * 0.35}" text-anchor="middle"
          font-size="${fontSize}px" font-weight="bold" fill="${textColor}"
          font-family="-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"
        >${number}</text>
      </svg>
    `

    const leafletIcon = L.divIcon({
      html,
      className: '',
      iconSize: [pinWidth, pinHeight] as PointTuple,
      iconAnchor: [cx, tipY] as PointTuple,
    })

    setIcon(leafletIcon)
  }, [size, color, textColor, number, selected])

  if (!icon) return null

  return (
    <Marker
      position={position}
      icon={icon}
      draggable={draggable}
      zIndexOffset={selected ? 1000 : 0}
      eventHandlers={{
        click: () => {
          onClick?.()
        },
        contextmenu: e => {
          e.originalEvent.preventDefault()
          onRightClick?.()
        },
        dragend: e => {
          const marker = e.target
          const newPos = marker.getLatLng()
          onDragEnd?.(newPos.lat, newPos.lng)
        },
      }}
    />
  )
}
