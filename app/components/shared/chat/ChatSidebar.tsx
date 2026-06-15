import React, { useState } from 'react'
import { ScrollArea } from '~/components/ui/scroll-area'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import { useTranslation } from '~/hooks/useTranslation'
import { Search, Plus } from 'lucide-react'
import { ChatGroupListItem } from './ChatGroupListItem'
import { ChatLabelFilter } from './ChatLabelFilter'
import { cn } from '~/lib/utils'

export interface ChatGroup {
  id: string
  name: string
  streamChannelId: string
  groupType: 'LOCAL_MSME' | 'LRDB_COORDINATION' | 'DIRECT_MESSAGE' | 'SOS_EMERGENCY'
  memberCount?: number
  unreadCount?: number
  isSOSActive?: boolean
  labels?: Array<{ id: string; name: string }>
  members?: Array<{ id: string; name: string; image?: string }>
}

export interface ChatSidebarProps {
  role: 'msme' | 'lrdb'
  userId: string
  activeGroupId?: string
  groups: ChatGroup[]
  showLabelFilter?: boolean
  showSOSTab?: boolean
  onGroupSelect: (groupId: string) => void
  onCreateGroup?: () => void
  onGroupDelete?: (groupId: string) => void
}

/**
 * ChatSidebar
 * 
 * Left sidebar displaying list of chat groups.
 * Features: search, label filtering (LRDB), SOS active tab, unread indicators.
 */
export function ChatSidebar({
  role,
  userId,
  activeGroupId,
  groups,
  showLabelFilter = false,
  showSOSTab = false,
  onGroupSelect,
  onCreateGroup,
  onGroupDelete,
}: ChatSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLabels, setSelectedLabels] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<'all' | 'sos'>('all')
  const { t } = useTranslation()

  // Extract all unique labels from groups
  const allLabels = React.useMemo(() => {
    const labelMap = new Map<string, { id: string; name: string }>()
    groups.forEach((group) => {
      group.labels?.forEach((label) => {
        labelMap.set(label.id, label)
      })
    })
    return Array.from(labelMap.values())
  }, [groups])

  // Filter groups based on search, labels, and tab
  const filteredGroups = React.useMemo(() => {
    let filtered = groups

    // Filter by tab
    if (activeTab === 'sos') {
      filtered = filtered.filter((g) => g.isSOSActive)
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter((g) =>
        g.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Filter by selected labels (LRDB only)
    if (selectedLabels.length > 0 && role === 'lrdb') {
      filtered = filtered.filter((g) =>
        selectedLabels.every((labelId) =>
          g.labels?.some((l) => l.id === labelId)
        )
      )
    }

    return filtered
  }, [groups, searchQuery, selectedLabels, activeTab, role])

  return (
    <div className="flex flex-col h-full bg-surface-secondary">
      {/* Header */}
      <div className="p-4 border-b border-border-default space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-h2 font-semibold">{t('chat.title')}</h2>
          {role === 'lrdb' && onCreateGroup && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onCreateGroup}
              title={t('chat.new-group')}
            >
              <Plus className="size-5" />
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-text-tertiary" />
          <Input
            placeholder={t('common.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        {/* SOS Tab for LRDB */}
        {showSOSTab && role === 'lrdb' && (
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('all')}
              className={cn(
                'flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors',
                activeTab === 'all'
                  ? 'bg-brand-primary text-white'
                  : 'bg-surface-primary text-text-secondary hover:bg-surface-primary/50'
              )}
            >
              {t('chat.all-groups')}
            </button>
            <button
              onClick={() => setActiveTab('sos')}
              className={cn(
                'flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors',
                activeTab === 'sos'
                  ? 'bg-status-critical text-white'
                  : 'bg-surface-primary text-text-secondary hover:bg-surface-primary/50'
              )}
            >
              🚨 {t('chat.sos-active')}
            </button>
          </div>
        )}
      </div>

      {/* Label Filter for LRDB */}
      {showLabelFilter && role === 'lrdb' && allLabels.length > 0 && (
        <ChatLabelFilter
          labels={allLabels}
          selectedLabels={selectedLabels}
          onLabelsChange={setSelectedLabels}
        />
      )}

      {/* Groups List */}
      <ScrollArea className="flex-1">
        {filteredGroups.length === 0 ? (
          <div className="flex items-center justify-center h-full p-4 text-center">
            <p className="text-text-secondary text-sm">
              {searchQuery || selectedLabels.length > 0
                ? t('chat.no-groups-found')
                : t('chat.no-groups')}
            </p>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {filteredGroups.map((group) => (
              <ChatGroupListItem
                key={group.id}
                group={group}
                isActive={group.id === activeGroupId}
                onClick={() => onGroupSelect(group.id)}
                onDelete={() => onGroupDelete?.(group.id)}
                role={role}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}

ChatSidebar.displayName = 'ChatSidebar'
