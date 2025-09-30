import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Truck, Package, ArrowRightLeft, RotateCcw, FileText } from 'lucide-react'
import { CommercialHeader, CommercialLine, DocType } from '../../types/database'

interface SmartActionButtonsProps {
  document: CommercialHeader
  lines: CommercialLine[]
  onActionComplete?: () => void
}

export function SmartActionButtons({ document, lines, onActionComplete }: SmartActionButtonsProps) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const calculateFulfillment = (line: any) => {
    if (!line.fulfillment_links || line.fulfillment_links.length === 0) {
      return { fulfilled: 0, percentage: 0 }
    }

    const totalFulfilled = line.fulfillment_links.reduce((sum: number, link: any) => {
      return sum + parseFloat(link.qty_linked_base || 0)
    }, 0)

    const percentage = Math.round((totalFulfilled / parseFloat(line.qty_ordered)) * 100)
    
    return { fulfilled: totalFulfilled, percentage }
  }

  const hasUnfulfilledLines = () => {
    return lines.some(line => {
      const fulfillment = calculateFulfillment(line)
      return fulfillment.percentage < 100
    })
  }

  const getAvailableActions = () => {
    const actions = []
    
    switch (document.doc_type) {
      case 'PO':
        if (document.status === 'Pending Receipt') {
          actions.push({
            label: 'Receive',
            icon: Package,
            color: 'bg-green-600 hover:bg-green-700',
            action: () => handleReceive()
          })
        } else if (document.status === 'Partially Received') {
          actions.push({
            label: 'Receive Remaining',
            icon: Package,
            color: 'bg-green-600 hover:bg-green-700',
            action: () => handleReceive()
          })
        } else if (document.status === 'Received') {
          actions.push({
            label: 'Return',
            icon: RotateCcw,
            color: 'bg-red-600 hover:bg-red-700',
            action: () => handleReturn()
          })
        }
        break
        
      case 'SO':
        if (document.status === 'Pending Shipment' && hasUnfulfilledLines()) {
          actions.push({
            label: 'Ship',
            icon: Truck,
            color: 'bg-blue-600 hover:bg-blue-700',
            action: () => handleShip()
          })
        } else if (document.status === 'Partially Shipped' && hasUnfulfilledLines()) {
          actions.push({
            label: 'Ship Remaining',
            icon: Truck,
            color: 'bg-blue-600 hover:bg-blue-700',
            action: () => handleShip()
          })
        }
        
        // Add invoice action for SO (available for most statuses except canceled)
        if (document.status !== 'Canceled') {
          actions.push({
            label: 'Create Invoice',
            icon: FileText,
            color: 'bg-green-600 hover:bg-green-700',
            action: () => handleCreateInvoice()
          })
        }
        break
        
      case 'TO':
        if (document.status === 'Open') {
          actions.push({
            label: 'Transfer',
            icon: ArrowRightLeft,
            color: 'bg-purple-600 hover:bg-purple-700',
            action: () => handleTransfer()
          })
        }
        break
    }
    
    return actions
  }

  const handleReceive = () => {
    navigate(`/receipts/new?from_po=${document.id}`)
  }

  const handleShip = () => {
    navigate(`/shipments/new?from_so=${document.id}`)
  }

  const handleTransfer = () => {
    navigate(`/transfers/new?from_to=${document.id}`)
  }

  const handleReturn = () => {
    // For now, navigate to a return form (to be implemented)
    navigate(`/returns/new?from_po=${document.id}`)
  }

  const handleCreateInvoice = () => {
    navigate(`/invoices/new?so_hdr_id=${document.id}`)
  }

  const actions = getAvailableActions()

  if (actions.length === 0) {
    return null
  }

  return (
    <div className="flex items-center space-x-2">
      {actions.map((action, index) => {
        const Icon = action.icon
        return (
          <button
            key={index}
            onClick={action.action}
            disabled={loading}
            className={`inline-flex items-center px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 ${action.color}`}
          >
            <Icon className="h-4 w-4 mr-2" />
            {action.label}
          </button>
        )
      })}
    </div>
  )
}