'use client'

import { Marker } from 'react-leaflet'
import L, { LatLngExpression } from 'leaflet'
import React, { useEffect, useState } from 'react'

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
    // Create a teardrop/pin-shaped marker with number - black border, clear fill
    const html = `
      <div style="
        position: relative;
        width: ${size}px;
        height: ${size * 1.4}px;
      ">
        <svg width="${size}" height="${size * 1.4}" viewBox="0 0 24 34" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 1C5.925 1 1 5.925 1 12c0 8.5 11 20.5 11 20.5s11-12 11-20.5c0-6.075-4.925-11-11-11z" fill="none" stroke="#000000" stroke-width="2"/>
          <circle cx="12" cy="12" r="8" fill="none" stroke="#000000" stroke-width="1.5"/>
        </svg>
        <div style="
          position: absolute;
          top: ${size * 0.15}px;
          left: 0;
          width: ${size}px;
          height: ${size * 0.7}px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: ${number > 99 ? size * 0.35 : size * 0.45}px;
          font-weight: bold;
          color: #000000;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        ">${number}</div>
      </div>
    `

    const leafletIcon = L.divIcon({
      html,
      className: '',
      iconSize: [size, size * 1.4],
      iconAnchor: [size / 2, size * 1.4], // Point at bottom center
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
