'use client'

import React, { FC } from 'react'
import { Badge, Flex, IconButton, TextField, Button, ScrollArea } from '@radix-ui/themes'
import { Trash2, Search, ChevronUp, ChevronDown, MapPinned, Hash } from 'lucide-react'
import { MissionSite } from '@/lib/types'

interface Props {
  orders: MissionSite[]
  selectedNodeId: string | null
  onSelectNode?: (id: string | null) => void
  displayMode: 'coords' | 'address'
  geocodingLoading: Map<string, boolean>
  updateNode: (id: string, updates: Partial<MissionSite>) => void
  removeNode: (id: string) => void
  addressSearchInputs: Map<string, string>
  onAddressSearchInputChange: (nodeId: string, value: string) => void
  onAddressSearch: (nodeId: string) => void
  getDisplayMode?: (id: string) => 'coords' | 'address'
  onToggleDisplayMode?: (id: string, node: MissionSite) => void
}

const OrdersEditableTable: FC<Props> = ({
  orders, selectedNodeId, onSelectNode, displayMode, geocodingLoading,
  updateNode, removeNode, addressSearchInputs, onAddressSearchInputChange, onAddressSearch,
  getDisplayMode, onToggleDisplayMode,
}) => {
  if (orders.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '24px', color: '#6b7280', fontSize: '13px' }}>
        No orders added yet. Click &quot;Add Order&quot; or click on the map.
      </div>
    )
  }

  return (
    <ScrollArea style={{ height: '100%' }}>
      <table className="data-table" style={{ tableLayout: 'fixed' }}>
        <thead>
          <tr>
            <th className="col-id">#</th>
            <th className="col-flex">Latitude</th>
            <th className="col-flex">Longitude</th>
            <th className="col-action"></th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const isSelected = selectedNodeId === order.id
            const isLoading = geocodingLoading.get(order.id) || false
            const rowDisplayMode = getDisplayMode ? getDisplayMode(order.id) : displayMode

            return (
              <tr key={order.id} data-node-id={order.id} className={isSelected ? 'selected' : ''} onClick={() => onSelectNode?.(isSelected ? null : order.id)} style={{ cursor: 'pointer' }}>
                <td>
                  <Flex align="center" gap="1">
                    <Badge color="green" size="1" style={{ fontWeight: 'bold' }}>
                      {order.orderId || '?'}
                    </Badge>
                    {onToggleDisplayMode && (
                      <IconButton size="1" variant="ghost" color={rowDisplayMode === 'address' ? 'blue' : 'gray'} onClick={(e) => { e.stopPropagation(); onToggleDisplayMode(order.id, order) }} title={rowDisplayMode === 'coords' ? 'Show address' : 'Show coordinates'} style={{ minWidth: '16px', minHeight: '16px', padding: '1px' }}>
                        {rowDisplayMode === 'coords' ? <MapPinned size={10} /> : <Hash size={10} />}
                      </IconButton>
                    )}
                  </Flex>
                </td>
                {rowDisplayMode === 'coords' ? (
                  <>
                    <td>
                      <Flex align="center" gap="1">
                        <TextField.Root
                          value={order.lat}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            updateNode(order.id, { lat: parseFloat(e.target.value) || 0, address: undefined })
                          }
                          placeholder="Latitude"
                          size="1"
                          type="number"
                          step="0.0001"
                          style={{ flex: 1, minWidth: 0 }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                          <button
                            type="button"
                            className="coord-spinner"
                            onClick={(e: React.MouseEvent) => { e.stopPropagation(); updateNode(order.id, { lat: Math.round((order.lat + 0.0001) * 10000) / 10000, address: undefined }) }}
                          >
                            <ChevronUp size={12} />
                          </button>
                          <button
                            type="button"
                            className="coord-spinner"
                            onClick={(e: React.MouseEvent) => { e.stopPropagation(); updateNode(order.id, { lat: Math.round((order.lat - 0.0001) * 10000) / 10000, address: undefined }) }}
                          >
                            <ChevronDown size={12} />
                          </button>
                        </div>
                      </Flex>
                    </td>
                    <td>
                      <Flex align="center" gap="1">
                        <TextField.Root
                          value={order.lng}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            updateNode(order.id, { lng: parseFloat(e.target.value) || 0, address: undefined })
                          }
                          placeholder="Longitude"
                          size="1"
                          type="number"
                          step="0.0001"
                          style={{ flex: 1, minWidth: 0 }}
                        />
                        <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                          <button
                            type="button"
                            className="coord-spinner"
                            onClick={(e: React.MouseEvent) => { e.stopPropagation(); updateNode(order.id, { lng: Math.round((order.lng + 0.0001) * 10000) / 10000, address: undefined }) }}
                          >
                            <ChevronUp size={12} />
                          </button>
                          <button
                            type="button"
                            className="coord-spinner"
                            onClick={(e: React.MouseEvent) => { e.stopPropagation(); updateNode(order.id, { lng: Math.round((order.lng - 0.0001) * 10000) / 10000, address: undefined }) }}
                          >
                            <ChevronDown size={12} />
                          </button>
                        </div>
                      </Flex>
                    </td>
                  </>
                ) : (
                  <td colSpan={2}>
                    <Flex gap="2" align="center">
                      <TextField.Root
                        value={addressSearchInputs.get(order.id) ?? order.address ?? ''}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          onAddressSearchInputChange(order.id, e.target.value)
                        }
                        placeholder={isLoading ? 'Looking up...' : 'Enter address'}
                        size="1"
                        style={{ flex: 1, minWidth: 0 }}
                        onKeyDown={(e: React.KeyboardEvent) => {
                          if (e.key === 'Enter') onAddressSearch(order.id)
                        }}
                      />
                      <Button size="1" variant="soft" onClick={() => onAddressSearch(order.id)} disabled={isLoading} style={{ flexShrink: 0 }}>
                        <Search size={10} />
                      </Button>
                    </Flex>
                  </td>
                )}
                <td style={{ textAlign: 'center' }}>
                  <IconButton size="1" variant="ghost" color="red" onClick={() => removeNode(order.id)}>
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

export default OrdersEditableTable
