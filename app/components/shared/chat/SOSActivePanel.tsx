import React from 'react'
import { Phone, AlertCircle } from 'lucide-react'
import { Button } from '~/components/ui/button'
import { useTranslation } from '~/hooks/useTranslation'

export interface SOSActivePanelProps {
  groupId: string
  onCallOwner: () => void
  onDispatchResponse: () => void
}

export function SOSActivePanel({
  groupId,
  onCallOwner,
  onDispatchResponse,
}: SOSActivePanelProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col h-full p-4 space-y-4">
      <div className="flex items-center gap-2 text-status-critical">
        <AlertCircle className="size-5 animate-pulse" />
        <h3 className="text-sm font-semibold">SOS Active</h3>
      </div>

      <div className="text-sm text-text-secondary space-y-1">
        <p>Emergency response required</p>
        <p className="text-xs text-text-tertiary">Group: {groupId}</p>
      </div>

      <div className="space-y-2">
        <Button
          variant="default"
          size="sm"
          className="w-full gap-2 bg-status-critical hover:bg-status-critical/90"
          onClick={onCallOwner}
        >
          <Phone className="size-4" />
          Call Owner
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onDispatchResponse}
        >
          Dispatch Response
        </Button>
      </div>
    </div>
  )
}

SOSActivePanel.displayName = 'SOSActivePanel'
