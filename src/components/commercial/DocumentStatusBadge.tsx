interface DocumentStatusBadgeProps {
  status: string
  className?: string
  isMovement?: boolean
  physicalStatus?: string
}

export function DocumentStatusBadge({ status, className = '', isMovement = false, physicalStatus }: DocumentStatusBadgeProps) {
  const getStatusColor = (status: string) => {
    // For movement documents (shipments, receipts, adjustments)
    if (isMovement) {
      switch (status.toLowerCase()) {
        case 'posted':
          return 'bg-green-100 text-green-800 border-green-200'
        case 'canceled':
          return 'bg-red-100 text-red-800 border-red-200'
        case 'draft':
          return 'bg-gray-100 text-gray-800 border-gray-200'
        default:
          return 'bg-blue-100 text-blue-800 border-blue-200'
      }
    }
    
    // For commercial documents (SO, PO, TO)
    switch (status.toLowerCase()) {
      case 'pending shipment':
      case 'pending receipt':
      case 'open':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'shipped':
      case 'received':
      case 'closed':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'partially shipped':
      case 'partially received':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'canceled':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'draft':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getPhysicalStatusColor = (physicalStatus: string) => {
    switch (physicalStatus.toLowerCase()) {
      case 'pending pickup':
      case 'pending delivery':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'in transit':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'delivered':
      case 'received':
        return 'bg-green-100 text-green-800 border-green-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <div className={`inline-flex items-center space-x-2 ${className}`}>
      <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full border ${getStatusColor(status)}`}>
        {status}
      </span>
      {physicalStatus && (
        <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full border ${getPhysicalStatusColor(physicalStatus)}`}>
          {physicalStatus}
        </span>
      )}
    </div>
  )
}