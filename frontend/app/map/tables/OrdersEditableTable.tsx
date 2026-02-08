'use client'

import React, { FC } from 'react'
import { Badge, Flex, IconButton, TextField, Button, ScrollArea } from '@radix-ui/themes'
import { Trash2, Search } from 'lucide-react'
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
}

const OrdersEditableTable: FC<Props> = ({
  orders, selectedNodeId, onSelectNode, displayMode, geocodingLoading,
  updateNode, removeNode, addressSearchInputs, onAddressSearchInputChange, onAddressSearch,
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
          {orders.map((order) => {
            const isSelected = selectedNodeId === order.id
            const isLoading = geocodingLoading.get(order.id) || false

            return (
              <tr key={order.id} className={isSelected ? 'selected' : ''} onClick={() => onSelectNode?.(isSelected ? null : order.id)} style={{ cursor: 'pointer' }}>
                <td>
                  <Badge color="green" size="1" style={{ fontWeight: 'bold' }}>
                    {order.orderId || '?'}
                  </Badge>
                </td>
                {displayMode === 'coords' ? (
                  <>
                    <td>
                      <TextField.Root
                        value={order.lat}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateNode(order.id, { lat: parseFloat(e.target.value) || 0, address: undefined })
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
                        value={order.lng}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateNode(order.id, { lng: parseFloat(e.target.value) || 0, address: undefined })
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
