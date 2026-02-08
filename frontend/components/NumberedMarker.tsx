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
  onRightClick,
  onClick,
  onDragEnd,
  draggable = false,
}: Props) {
  const [icon, setIcon] = useState<L.DivIcon | null>(null)

  useEffect(() => {
    // Create a pin/teardrop marker with number in the center circle
    const pinWidth = size
    const pinHeight = size * 1.4
    const circleR = size * 0.42
    const fontSize = number > 99 ? size * 0.32 : size * 0.4
    const cx = pinWidth / 2
    const circleY = circleR + 1
    const tipY = pinHeight - 1

    const html = `
      <svg width="${pinWidth}" height="${pinHeight}" viewBox="0 0 ${pinWidth} ${pinHeight}" xmlns="http://www.w3.org/2000/svg">
        <path d="M${cx},${tipY} C${cx - circleR * 0.6},${circleY + circleR * 1.1} ${cx - circleR},${circleY + circleR * 0.4} ${cx - circleR},${circleY}
          A${circleR},${circleR} 0 1,1 ${cx + circleR},${circleY}
          C${cx + circleR},${circleY + circleR * 0.4} ${cx + circleR * 0.6},${circleY + circleR * 1.1} ${cx},${tipY}Z"
          fill="${color}" stroke="#000000" stroke-width="1.5"/>
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
  }, [size, color, textColor, number])

  if (!icon) return null

  return (
    <Marker
      position={position}
      icon={icon}
      draggable={draggable}
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
