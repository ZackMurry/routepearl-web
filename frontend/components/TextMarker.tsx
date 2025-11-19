import { Marker } from 'react-leaflet'
import * as L from 'leaflet'
import React from 'react'

interface TextMarkerProps {
  position: [number, number]
  text: string
  offset?: [number, number] // [x, y] offset in pixels
  style?: React.CSSProperties // Custom inline styles
}

export default function TextMarker({ position, text, offset = [0, 0], style = {} }: TextMarkerProps) {
  // Default styles
  const defaultStyles: React.CSSProperties = {
    color: 'black',
    whiteSpace: 'nowrap',
  }

  // Merge default and custom styles
  const mergedStyles = { ...defaultStyles, ...style }

  // Convert styles object to CSS string
  const styleString = Object.entries(mergedStyles)
    .map(([key, value]) => {
      // Convert camelCase to kebab-case
      const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
      return `${cssKey}: ${value}`
    })
    .join('; ')

  // Create a divIcon with custom text and styles
  const icon = L.divIcon({
    className: 'text-marker', // optional CSS class
    html: `<div style="${styleString}">${text}</div>`,
    iconSize: [50, 20], // width, height
    iconAnchor: [-offset[0], -offset[1]], // Apply offset (negated because iconAnchor works opposite)
  })

  return <Marker position={position} icon={icon} />
}
