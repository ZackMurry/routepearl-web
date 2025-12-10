'use client'

import React from 'react'
import { Flex, Text } from '@radix-ui/themes'
import { Plane, Truck } from 'lucide-react'
import { TimelineViewFilter } from './timeline.types'

interface TimelineViewToggleProps {
  value: TimelineViewFilter
  onChange: (value: TimelineViewFilter) => void
  counts: {
    all: number
    drones: number
    trucks: number
  }
}

export function TimelineViewToggle({ value, onChange, counts }: TimelineViewToggleProps) {
  const options: { key: TimelineViewFilter; label: string; icon?: React.ReactNode }[] = [
    { key: 'all', label: 'All' },
    { key: 'drones', label: 'Drones', icon: <Plane size={14} /> },
    { key: 'trucks', label: 'Trucks', icon: <Truck size={14} /> },
  ]

  return (
    <div className="mb-4">
      <Flex className="bg-gray-100 p-1 rounded-lg" gap="1">
        {options.map((option) => {
          const isActive = value === option.key
          const count = counts[option.key]

          return (
            <button
              key={option.key}
              onClick={() => onChange(option.key)}
              className={`
                flex-1 px-3 py-2 rounded-md transition-all duration-200
                flex items-center justify-center gap-2
                ${
                  isActive
                    ? 'bg-white shadow-sm text-blue-600'
                    : 'text-gray-600 hover:bg-gray-200'
                }
              `}
            >
              {option.icon && (
                <span className={isActive ? 'text-blue-500' : 'text-gray-500'}>
                  {option.icon}
                </span>
              )}
              <Text size="2" weight={isActive ? 'medium' : 'regular'}>
                {option.label}
              </Text>
              <span
                className={`
                  text-xs px-1.5 py-0.5 rounded-full
                  ${isActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'}
                `}
              >
                {count}
              </span>
            </button>
          )
        })}
      </Flex>
    </div>
  )
}
