'use client'

import { Marker } from 'react-leaflet'
import L, { LatLngExpression } from 'leaflet'
import { useEffect, useState } from 'react'

type Props = {
  position: LatLngExpression
  number: number
  color?: string
  size?: number
  onRightClick?: () => void
  onClick?: () => void
  onDragEnd?: (lat: number, lng: number) => void
  draggable?: boolean
}

export default function NumberedMarker({
  position,
  number,
  color = '#3b82f6',
  size = 28,
  onRightClick,
  onClick,
  onDragEnd,
  draggable = false,
}: Props) {
  const [icon, setIcon] = useState<L.DivIcon | null>(null)

  useEffect(() => {
    const html = `
      <div style="
        width: ${size}px;
        height: ${size}px;
        background-color: ${color};
        border: 2px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: ${size * 0.5}px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">${number}</div>
    `

    const leafletIcon = L.divIcon({
      html,
      className: '',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    })

    setIcon(leafletIcon)
  }, [number, color, size])

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
