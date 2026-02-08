'use client'

import { Marker } from 'react-leaflet'
import L, { LatLngExpression, PointTuple } from 'leaflet'
import React, { useEffect, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { FlagTriangleRight, LucideProps } from 'lucide-react'

type Align = 'center' | 'bottom' | 'bottom-left' | 'bottom-right' | 'top' | 'top-left' | 'top-right' | 'left' | 'right'

type Props = {
  position: LatLngExpression
  size?: number
  color?: string
  align?: Align
  anchor?: PointTuple
  selected?: boolean
  onRightClick?: () => void
  onClick?: () => void
  onDragEnd?: (lat: number, lng: number) => void
  draggable?: boolean
  LucideIcon?: React.FC<LucideProps>
}

export default function LucideMarker({
  position,
  size = 24,
  color = 'red',
  align = 'center',
  anchor,
  selected = false,
  onRightClick,
  onClick,
  onDragEnd,
  draggable = false,
  LucideIcon = FlagTriangleRight,
}: Props) {
  const [icon, setIcon] = useState<L.DivIcon | null>(null)

  useEffect(() => {
    const scale = selected ? 1.5 : 1
    const effectiveSize = size * scale
    const iconMarkup = renderToStaticMarkup(<LucideIcon size={effectiveSize} color={color} />)

    // Padding added around the icon when selected (for the highlight ring)
    const pad = selected ? 6 : 0
    const outerSize = effectiveSize + pad * 2

    // When selected, center the icon inside a larger container with a highlight ring
    const html = selected
      ? `<div style="width:${outerSize}px;height:${outerSize}px;position:relative;">
           <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:${effectiveSize + 10}px;height:${effectiveSize + 10}px;border-radius:50%;background:rgba(37,99,235,0.15);border:2px solid #2563eb;"></div>
           <div style="position:absolute;left:${pad}px;top:${pad}px;">${iconMarkup}</div>
         </div>`
      : iconMarkup

    // Compute base anchor relative to the icon SVG
    const anchors: Record<Align, [number, number]> = {
      center: [effectiveSize / 2, effectiveSize / 2],
      bottom: [effectiveSize / 2, effectiveSize],
      top: [effectiveSize / 2, 0],
      left: [0, effectiveSize / 2],
      right: [effectiveSize, effectiveSize / 2],
      'bottom-left': [0, effectiveSize],
      'bottom-right': [effectiveSize, effectiveSize],
      'top-left': [0, 0],
      'top-right': [effectiveSize, 0],
    }

    // Base anchor is always relative to the icon SVG content
    const baseAnchor: PointTuple = anchor
      ? (anchor.map(it => it * effectiveSize) as PointTuple)
      : anchors[align]

    // When selected, offset the anchor by the padding so it still points to the
    // same spot on the icon SVG (which is now inset by `pad` within the container)
    const finalAnchor: PointTuple = [baseAnchor[0] + pad, baseAnchor[1] + pad]

    const leafletIcon = L.divIcon({
      html,
      className: '',
      iconSize: [outerSize, outerSize],
      iconAnchor: finalAnchor,
    })

    setIcon(leafletIcon)
  }, [align, anchor, size, color, LucideIcon, selected])

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
