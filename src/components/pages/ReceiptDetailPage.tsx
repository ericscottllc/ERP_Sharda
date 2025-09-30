import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Calendar, Building, Package, Truck, User, FileText, AlertCircle, Clock, CheckCircle, CreditCard as Edit } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { DocumentStatusBadge } from '../commercial/DocumentStatusBadge'
import { formatQuantityDisplay, formatDate, formatDateTime } from '../../utils/formatters'

interface MovementRecord {
  id: string
  doc_type: string
  status: string
  effective_date: string
  posted_at?: string
  created_at: string
  note?: string
  primary_warehouse?: {
    id: string
    code: string
    name: string
  }
  secondary_warehouse?: {
    id: string
    code: string
    name: string
  }
  movement_ext?: {
    carrier_name?: string
    tracking_number?: string
    packages_count?: number
    shipped_weight?: number
  }
  movement_line: Array<{
    id: string
    line_no: number
    item_name: string
    warehouse_id: string
    inventory_state: string
    qty_base: number
    lot_number?: string
    effective_date: string
    warehouse?: {
      id: string
      code: string
      name: string
    }
    item?: {
      pack_size_details?: {
        pack_size: string
        units_per_each?: number
        volume_per_unit?: number
        units_of_units?: string
        package_type?: string
        uom_per_each?: number
        eaches_per_pallet?: number
        pallets_per_tl?: number
        eaches_per_tl?: number
      }
    }
  }>
}

export function ReceiptDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [receipt, setReceipt] = useState<MovementRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)

  useEffect(() => {
    if (id) {
      fetchReceipt(id)
    }
  }, [id])

  const fetchReceipt = async (receiptId: string) => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('movement_hdr')
        .select(`
          id,
          doc_type,
          status,
          physical_status,
          physical_status,
          effective_date,
          posted_at,
          created_at,
          note,
          primary_warehouse:primary_warehouse_id (
            id,
            code,
            name
          ),
          secondary_warehouse:secondary_warehouse_id (
            id,
            code,
            name
          ),
          movement_ext (
            carrier_name,
            tracking_number,
            packages_count,
            shipped_weight
          ),
          movement_line (
            id,
            line_no,
            item_name,
            warehouse_id,
            inventory_state,
            qty_base,
            lot_number,
            effective_date,
            item:item_name (
              pack_size_details:pack_size (
                pack_size,
                units_per_each,
                volume_per_unit,
                units_of_units,
                package_type,
                uom_per_each,
                eaches_per_pallet,
                pallets_per_tl,
                eaches_per_tl
              )
            ),
            warehouse:warehouse_id (
              id,
              code,
              name
            )
          )
        `)
        .eq('id', receiptId)
        .eq('doc_type', 'Receipt')
        .single()

      if (error) throw error
      if (!data) throw new Error('Receipt not found')

      setReceipt(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handlePhysicalStatusUpdate = async (newPhysicalStatus: string) => {
    if (!receipt) return

    setUpdating(true)
    setUpdateError(null)

    try {
      const updateData: any = {
        physical_status: newPhysicalStatus,
        updated_at: new Date().toISOString()
      }

      // If setting to 'Pending Delivery', also set status to 'Draft'
      if (newPhysicalStatus === 'Pending Delivery') {
        updateData.status = 'Draft'
      } else if (receipt.status === 'Draft' && newPhysicalStatus !== 'Pending Delivery') {
        // If moving away from 'Pending Delivery', set status back to 'Posted'
        updateData.status = 'Posted'
      }

      const { error } = await supabase
        .from('movement_hdr')
        .update(updateData)
        .eq('id', receipt.id)

      if (error) throw error

      // Refresh the page to show updated status
      window.location.reload()
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : 'Failed to update physical status')
    } finally {
      setUpdating(false)
    }
  }

  const getPhysicalStatusButtons = () => {
    if (!receipt) return []

    const buttons = []
    const currentPhysicalStatus = receipt.physical_status

    // Pending Delivery -> In Transit
    if (currentPhysicalStatus === 'Pending Delivery') {
      buttons.push({
        label: 'Mark In Transit',
        status: 'In Transit',
        icon: Truck,
        color: 'bg-blue-600 hover:bg-blue-700'
      })
      buttons.push({
        label: 'Mark Received',
        status: 'Received',
        icon: CheckCircle,
        color: 'bg-green-600 hover:bg-green-700'
      })
    }

    // In Transit -> Received
    else if (currentPhysicalStatus === 'In Transit') {
      buttons.push({
        label: 'Mark Received',
        status: 'Received',
        icon: CheckCircle,
        color: 'bg-green-600 hover:bg-green-700'
      })
    }

    // Any status -> Pending Delivery (rare case)
    else if (currentPhysicalStatus !== 'Pending Delivery') {
      buttons.push({
        label: 'Set Pending Delivery',
        status: 'Pending Delivery',
        icon: Clock,
        color: 'bg-yellow-600 hover:bg-yellow-700'
      })
    }

    return buttons
  }


  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !receipt) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error || 'Receipt not found'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const totalItems = receipt.movement_line.reduce((sum, line) => sum + Math.abs(line.qty_base), 0)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/receipts')}
            className="inline-flex items-center text-gray-600 hover:text-sharda-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Receipts
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              Receipt {receipt.id.substring(0, 8)}...
              <DocumentStatusBadge 
                status={receipt.status} 
                physicalStatus={receipt.physical_status}
                isMovement={true} 
                className="ml-3" 
              />
            </h1>
            <p className="text-gray-600 mt-1">
              Created on {formatDate(receipt.created_at)}
              {receipt.posted_at && ` • Posted on ${formatDateTime(receipt.posted_at)}`}
            </p>
          </div>
        </div>
      </div>

      {/* Physical Status Update Error */}
      {updateError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Status Update Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{updateError}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Details */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Package className="h-5 w-5 mr-2" />
              Receipt Details
            </h3>
            {getPhysicalStatusButtons().length > 0 && (
              <div className="flex items-center space-x-3">
                {getPhysicalStatusButtons().map((button) => {
                  const Icon = button.icon
                  return (
                    <button
                      key={button.status}
                      onClick={() => handlePhysicalStatusUpdate(button.status)}
                      disabled={updating}
                      className={`inline-flex items-center px-3 py-2 text-white rounded-lg transition-colors disabled:opacity-50 ${button.color}`}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {button.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Basic Information</h4>
              
              <div>
                <label className="block text-sm font-medium text-gray-500">Receipt ID</label>
                <p className="mt-1 text-sm text-gray-900">{receipt.id}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-500">Status</label>
                <div className="mt-1">
                  <DocumentStatusBadge status={receipt.status} isMovement={true} />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-500">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  Receipt Date
                </label>
                <p className="mt-1 text-sm text-gray-900">{formatDate(receipt.effective_date)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500">Total Items</label>
                <p className="mt-1 text-sm text-gray-900">{totalItems} EA received</p>
              </div>
            </div>

            {/* Warehouse Information */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Warehouse Information</h4>
              
              <div>
                <label className="block text-sm font-medium text-gray-500">
                  <Building className="h-4 w-4 inline mr-1" />
                  Receive Into Warehouse
                </label>
                <p className="mt-1 text-sm text-gray-900">
                  <Link
                    to={`/warehouses/${receipt.primary_warehouse?.id}`}
                    className="text-sharda-primary hover:text-sharda-secondary"
                  >
                    {receipt.primary_warehouse?.name} ({receipt.primary_warehouse?.code})
                  </Link>
                </p>
              </div>
            </div>

            {/* Carrier Information */}
            {receipt.movement_ext && (
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Carrier Information</h4>
                
                {receipt.movement_ext.carrier_name && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">
                      <Truck className="h-4 w-4 inline mr-1" />
                      Carrier
                    </label>
                    <p className="mt-1 text-sm text-gray-900">{receipt.movement_ext.carrier_name}</p>
                  </div>
                )}
                
                {receipt.movement_ext.tracking_number && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Tracking Number</label>
                    <p className="mt-1 text-sm text-gray-900">{receipt.movement_ext.tracking_number}</p>
                  </div>
                )}
                
                {receipt.movement_ext.packages_count && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Packages</label>
                    <p className="mt-1 text-sm text-gray-900">{receipt.movement_ext.packages_count} packages</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          {receipt.note && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
              <p className="text-sm text-gray-700">{receipt.note}</p>
            </div>
          )}
        </div>
      </div>

      {/* Receipt Lines */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Package className="h-5 w-5 mr-2" />
            Receipt Lines ({receipt.movement_line.length})
          </h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Line #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Inventory State
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Warehouse
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Lot Number
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {receipt.movement_line.map((line) => (
                <tr key={line.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {line.line_no}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">
                      {line.item_name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatQuantityDisplay(Math.abs(line.qty_base), line.item?.pack_size_details)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {line.inventory_state}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {line.warehouse ? (
                      <div className="flex items-center">
                        <Building className="h-4 w-4 mr-1 text-gray-400" />
                        {line.warehouse.name}
                      </div>
                    ) : (
                      <span className="text-gray-500">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {line.lot_number || 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}