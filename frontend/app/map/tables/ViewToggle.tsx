'use client'

import React, { FC } from 'react'
import { IconButton } from '@radix-ui/themes'
import { LayoutGrid, Table2 } from 'lucide-react'

interface Props {
  viewMode: 'grid' | 'table'
  onToggle: () => void
}

const ViewToggle: FC<Props> = ({ viewMode, onToggle }) => (
  <IconButton
    size="1"
    variant="ghost"
    color="gray"
    onClick={onToggle}
    title={viewMode === 'grid' ? 'Switch to table view' : 'Switch to grid view'}
    style={{ cursor: 'pointer' }}
  >
    {viewMode === 'grid' ? <Table2 size={14} /> : <LayoutGrid size={14} />}
  </IconButton>
)

export default ViewToggle
