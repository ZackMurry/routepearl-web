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
    // Create a circle marker with number in the center
    const fontSize = number > 99 ? size * 0.38 : size * 0.48
    const html = `
      <div style="
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background-color: ${color};
        border: 2px solid #000000;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">
        <span style="
          font-size: ${fontSize}px;
          font-weight: bold;
          color: ${textColor};
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          line-height: 1;
        ">${number}</span>
      </div>
    `

    const leafletIcon = L.divIcon({
      html,
      className: '',
      iconSize: [size, size] as PointTuple,
      iconAnchor: [size / 2, size / 2] as PointTuple,
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
