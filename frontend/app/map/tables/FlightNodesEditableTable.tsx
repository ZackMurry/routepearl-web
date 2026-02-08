'use client'

import React, { FC, useMemo } from 'react'
import { Flex, IconButton, TextField, Button, Select, ScrollArea } from '@radix-ui/themes'
import { Trash2, Search } from 'lucide-react'
import { FlightNode } from '@/lib/types'

interface Props {
  nodes: FlightNode[]
  selectedNodeId: string | null
  onSelectNode?: (id: string | null) => void
  displayMode: 'coords' | 'address'
  geocodingLoading: Map<string, boolean>
  updateNode: (id: string, updates: Partial<FlightNode>) => void
  removeNode: (id: string) => void
  addressSearchInputs: Map<string, string>
  onAddressSearchInputChange: (nodeId: string, value: string) => void
  onAddressSearch: (nodeId: string) => void
}

const TYPE_COLORS: Record<string, string> = {
  depot: '#3b82f6',
  station: '#f97316',
  hazard: '#ef4444',
  waypoint: '#8b5cf6',
}

const FlightNodesEditableTable: FC<Props> = ({
  nodes, selectedNodeId, onSelectNode, displayMode, geocodingLoading,
  updateNode, removeNode, addressSearchInputs, onAddressSearchInputChange, onAddressSearch,
}) => {
  // Compute per-type numbering
  const typeNumberMap = useMemo(() => {
    const map = new Map<string, number>()
    const counters: Record<string, number> = {}
    for (const node of nodes) {
      counters[node.type] = (counters[node.type] || 0) + 1
      map.set(node.id, counters[node.type])
    }
    return map
  }, [nodes])

  if (nodes.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px', color: '#6b7280', fontSize: '13px' }}>
        No flight nodes added yet. Click &quot;Add Node&quot; or click on the map.
      </div>
    )
  }

  return (
    <ScrollArea style={{ height: '100%' }}>
      <table className="data-table" style={{ tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th className="col-id">#</th>
            <th className="col-type">Type</th>
            {displayMode === 'coords' ? (
              <>
                <th className="col-flex">Latitude</th>
                <th className="col-flex">Longitude</th>
              </>
            ) : (
              <th className="col-flex">Address</th>
            )}
            <th className="col-action"></th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((node) => {
            const isSelected = selectedNodeId === node.id
            const isLoading = geocodingLoading.get(node.id) || false
            const typeNum = typeNumberMap.get(node.id) || ''
            const typeColor = TYPE_COLORS[node.type] || '#8b5cf6'

            return (
              <tr key={node.id} className={isSelected ? 'selected' : ''} onClick={() => onSelectNode?.(isSelected ? null : node.id)} style={{ cursor: 'pointer' }}>
                <td>
                  <span style={{ fontWeight: 700 }}>{node.flightNodeId || '?'}</span>
                  <span style={{ color: typeColor, fontWeight: 500, fontSize: '11px', display: 'block' }}>
                    {node.type.charAt(0).toUpperCase() + node.type.slice(1)} {typeNum}
                  </span>
                </td>
                <td>
                  <Select.Root
                    value={node.type}
                    onValueChange={(v: string) =>
                      updateNode(node.id, { type: v as FlightNode['type'] })
                    }
                    size="1"
                  >
                    <Select.Trigger style={{ width: '100%' }} />
                    <Select.Content>
                      <Select.Item value="depot">Depot</Select.Item>
                      <Select.Item value="station">Station</Select.Item>
                      <Select.Item value="waypoint">Waypoint</Select.Item>
                      <Select.Item value="hazard">Hazard</Select.Item>
                    </Select.Content>
                  </Select.Root>
                </td>
                {displayMode === 'coords' ? (
                  <>
                    <td>
                      <TextField.Root
                        value={node.lat}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateNode(node.id, { lat: parseFloat(e.target.value) || 0, address: undefined })
                        }
                        placeholder="Latitude"
                        size="1"
                        type="number"
                        step="0.0001"
                        style={{ width: '100%' }}
                      />
                    </td>
                    <td>
                      <TextField.Root
                        value={node.lng}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateNode(node.id, { lng: parseFloat(e.target.value) || 0, address: undefined })
                        }
                        placeholder="Longitude"
                        size="1"
                        type="number"
                        step="0.0001"
                        style={{ width: '100%' }}
                      />
                    </td>
                  </>
                ) : (
                  <td>
                    <Flex gap="2" align="center">
                      <TextField.Root
                        value={addressSearchInputs.get(node.id) ?? node.address ?? ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          onAddressSearchInputChange(node.id, e.target.value)
                        }
                        placeholder={isLoading ? 'Looking up...' : 'Enter address'}
                        size="1"
                        style={{ flex: 1, minWidth: 0 }}
                        onKeyDown={(e: React.KeyboardEvent) => {
                          if (e.key === 'Enter') onAddressSearch(node.id)
                        }}
                      />
                      <Button size="1" variant="soft" onClick={() => onAddressSearch(node.id)} disabled={isLoading} style={{ flexShrink: 0 }}>
                        <Search size={10} />
                      </Button>
                    </Flex>
                  </td>
                )}
                <td style={{ textAlign: 'center' }}>
                  <IconButton size="1" variant="ghost" color="red" onClick={() => removeNode(node.id)}>
                    <Trash2 size={12} />
                  </IconButton>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </ScrollArea>
  )
}

export default FlightNodesEditableTable
