import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Calendar, Building, Package, Truck, User, FileText, AlertCircle, Clock, CheckCircle, CreditCard as Edit, Mail, X } from 'lucide-react'
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
  sales_order?: {
    id: string
    doc_no: string
    customer_ref?: string
    party?: {
      display_name: string
      phone?: string
    }
    ship_to_address?: {
      line1: string
      line2?: string
      city: string
      region?: string
      postal_code?: string
      country: string
    }
  }
  movement_ext?: {
    carrier_name?: string
    tracking_number?: string
    scac?: string
    service_level?: string
    pro_number?: string
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
    fulfillment_link?: Array<{
      commercial_line: {
        commercial_hdr: {
          id: string
          doc_no: string
          customer_ref?: string
          party?: {
            display_name: string
            phone?: string
          }
          ship_to_address?: {
            line1: string
            line2?: string
            city: string
            region?: string
            postal_code?: string
            country: string
          }
        }
      }
    }>
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

export function ShipmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [shipment, setShipment] = useState<MovementRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailText, setEmailText] = useState('')
  const [copySuccess, setCopySuccess] = useState(false)

  useEffect(() => {
    if (id) {
      fetchShipment(id)
    }
  }, [id])

  const fetchShipment = async (shipmentId: string) => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('movement_hdr')
        .select(`
          id,
          doc_type,
          status,
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
            scac,
            service_level,
            pro_number,
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
            fulfillment_link (
              commercial_line (
                commercial_hdr (
                  id,
                  doc_no,
                  customer_ref,
                  party:party_id (
                    display_name,
                    phone
                  ),
                  ship_to_address:ship_to_address_id (
                    line1,
                    line2,
                    city,
                    region,
                    postal_code,
                    country
                  )
                )
              )
            ),
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
        .eq('id', shipmentId)
        .eq('doc_type', 'Shipment')
        .single()

      if (error) throw error
      if (!data) throw new Error('Shipment not found')

      // Extract sales order information from the first movement line's fulfillment link
      const salesOrderInfo = data.movement_line?.[0]?.fulfillment_link?.[0]?.commercial_line?.commercial_hdr
      
      const shipmentWithSalesOrder = {
        ...data,
        sales_order: salesOrderInfo ? {
          id: salesOrderInfo.id,
          doc_no: salesOrderInfo.doc_no,
          customer_ref: salesOrderInfo.customer_ref,
          party: salesOrderInfo.party,
          ship_to_address: salesOrderInfo.ship_to_address
        } : undefined
      }

      setShipment(shipmentWithSalesOrder)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handlePhysicalStatusUpdate = async (newPhysicalStatus: string) => {
    if (!shipment) return

    setUpdating(true)
    setUpdateError(null)

    try {
      const updateData: any = {
        physical_status: newPhysicalStatus,
        updated_at: new Date().toISOString()
      }

      // If setting to 'Pending Pickup', also set status to 'Draft'
      if (newPhysicalStatus === 'Pending Pickup') {
        updateData.status = 'Draft'
      } else if (shipment.status === 'Draft' && newPhysicalStatus !== 'Pending Pickup') {
        // If moving away from 'Pending Pickup', set status back to 'Posted'
        updateData.status = 'Posted'
      }

      const { error } = await supabase
        .from('movement_hdr')
        .update(updateData)
        .eq('id', shipment.id)

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
    if (!shipment) return []

    const buttons = []
    const currentPhysicalStatus = shipment.physical_status

    // Pending Pickup -> In Transit
    if (currentPhysicalStatus === 'Pending Pickup') {
      buttons.push({
        label: 'Mark In Transit',
        status: 'In Transit',
        icon: Truck,
        color: 'bg-blue-600 hover:bg-blue-700'
      })
      buttons.push({
        label: 'Mark Delivered',
        status: 'Delivered',
        icon: CheckCircle,
        color: 'bg-green-600 hover:bg-green-700'
      })
    }

    // In Transit -> Delivered
    else if (currentPhysicalStatus === 'In Transit') {
      buttons.push({
        label: 'Mark Delivered',
        status: 'Delivered',
        icon: CheckCircle,
        color: 'bg-green-600 hover:bg-green-700'
      })
    }

    // Any status -> Pending Pickup (rare case)
    else if (currentPhysicalStatus !== 'Pending Pickup') {
      buttons.push({
        label: 'Set Pending Pickup',
        status: 'Pending Pickup',
        icon: Clock,
        color: 'bg-yellow-600 hover:bg-yellow-700'
      })
    }

    return buttons
  }

  const handleEmailGeneration = () => {
    if (!shipment) return

    let emailBody = "Hi,\n\n"
    
    // Add customer reference if available
    if (shipment.sales_order?.customer_ref) {
      emailBody += `Please release the following on ${shipment.sales_order.customer_ref}\n`
    } else {
      emailBody += "Please release the following:\n"
    }
    
    // Add line items
    shipment.movement_line.forEach(line => {
      const packSizeDetails = line.item?.pack_size_details
      const qtyEaches = Math.abs(line.qty_base)
      
      if (packSizeDetails?.uom_per_each && packSizeDetails?.units_of_units && packSizeDetails?.package_type) {
        const volume = qtyEaches * packSizeDetails.uom_per_each
        const packageCount = qtyEaches / (packSizeDetails.units_per_each || 1)
        const packageTypeDisplay = packageCount === 1 ? packSizeDetails.package_type : `${packSizeDetails.package_type}s`
        
        emailBody += `${volume} ${packSizeDetails.units_of_units} / ${packageCount} ${packageTypeDisplay} ${line.item_name}\n`
      } else {
        emailBody += `${qtyEaches} EA ${line.item_name}\n`
      }
    })
    
    emailBody += "\nHi eShipping,\n\n"
    
    // Add pickup information
    emailBody += "Pick Up:\n"
    if (shipment.primary_warehouse) {
      emailBody += `${shipment.primary_warehouse.name}\n`
    }
    
    emailBody += "\nShip to:\n"
    
    // Add ship to address and phone
    if (shipment.sales_order?.ship_to_address) {
      const addr = shipment.sales_order.ship_to_address
      emailBody += `${shipment.sales_order.party?.display_name || 'Customer'}\n`
      emailBody += `${addr.line1}\n`
      if (addr.line2) emailBody += `${addr.line2}\n`
      emailBody += `${addr.city}`
      if (addr.region) emailBody += ` ${addr.region}`
      if (addr.postal_code) emailBody += ` ${addr.postal_code}`
      emailBody += `\n`
      
      if (shipment.sales_order.party?.phone) {
        emailBody += `${shipment.sales_order.party.phone}\n`
      }
    } else {
      emailBody += "Ship to address not available\n"
    }
    
    emailBody += "\nThank you!"
    
    setEmailText(emailBody)
    setShowEmailModal(true)
    setCopySuccess(false)
  }

  const handleCopyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(emailText)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
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

  if (error || !shipment) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error || 'Shipment not found'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const totalItems = shipment.movement_line.reduce((sum, line) => sum + Math.abs(line.qty_base), 0)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/shipments')}
            className="inline-flex items-center text-gray-600 hover:text-sharda-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Shipments
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              Shipment {shipment.id.substring(0, 8)}...
              <DocumentStatusBadge 
                status={shipment.status} 
                physicalStatus={shipment.physical_status}
                isMovement={true} 
                className="ml-3" 
              />
            </h1>
            <p className="text-gray-600 mt-1">
              Created on {formatDate(shipment.created_at)}
              {shipment.posted_at && ` • Posted on ${formatDateTime(shipment.posted_at)}`}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={handleEmailGeneration}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FileText className="h-4 w-4 mr-2" />
            Generate Email
          </button>
          <button
            onClick={() => navigate(`/shipments/${shipment.id}/edit`)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </button>
        </div>
      </div>

      {/* Physical Status Update Error */}
      {updateError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
          <button
            onClick={() => navigate(`/shipments/${shipment.id}/edit`)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </button>
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

      {/* Shipment Details */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Truck className="h-5 w-5 mr-2" />
              Shipment Details
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
                <label className="block text-sm font-medium text-gray-500">Shipment ID</label>
                <p className="mt-1 text-sm text-gray-900">{shipment.id}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-500">Status</label>
                <div className="mt-1">
                  <DocumentStatusBadge status={shipment.status} isMovement={true} />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-500">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  Ship Date
                </label>
                <p className="mt-1 text-sm text-gray-900">{formatDate(shipment.effective_date)}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-500">Total Items</label>
               <p className="mt-1 text-sm text-gray-900">{totalItems} EA shipped</p>
              </div>
            </div>

            {/* Warehouse Information */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Warehouse Information</h4>
              
              <div>
                <label className="block text-sm font-medium text-gray-500">
                  <Building className="h-4 w-4 inline mr-1" />
                  Ship From Warehouse
                </label>
                <p className="mt-1 text-sm text-gray-900">
                  <Link
                    to={`/warehouses/${shipment.primary_warehouse?.id}`}
                    className="text-sharda-primary hover:text-sharda-secondary"
                  >
                    {shipment.primary_warehouse?.name} ({shipment.primary_warehouse?.code})
                  </Link>
                </p>
              </div>
            </div>

            {/* Carrier Information */}
            {shipment.movement_ext && (
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Carrier Information</h4>
                
                {shipment.movement_ext.carrier_name && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">
                      <Truck className="h-4 w-4 inline mr-1" />
                      Carrier
                    </label>
                    <p className="mt-1 text-sm text-gray-900">{shipment.movement_ext.carrier_name}</p>
                  </div>
                )}
                
                {shipment.movement_ext.tracking_number && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Tracking Number</label>
                    <p className="mt-1 text-sm text-gray-900">{shipment.movement_ext.tracking_number}</p>
                  </div>
                )}
                
                {shipment.movement_ext.service_level && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Service Level</label>
                    <p className="mt-1 text-sm text-gray-900">{shipment.movement_ext.service_level}</p>
                  </div>
                )}
                
                {shipment.movement_ext.scac && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">SCAC Code</label>
                    <p className="mt-1 text-sm text-gray-900">{shipment.movement_ext.scac}</p>
                  </div>
                )}
                
                {shipment.movement_ext.pro_number && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">PRO Number</label>
                    <p className="mt-1 text-sm text-gray-900">{shipment.movement_ext.pro_number}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  {shipment.movement_ext.packages_count && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Packages</label>
                      <p className="mt-1 text-sm text-gray-900">{shipment.movement_ext.packages_count}</p>
                    </div>
                  )}
                  
                  {shipment.movement_ext.shipped_weight && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500">Weight (lbs)</label>
                      <p className="mt-1 text-sm text-gray-900">{shipment.movement_ext.shipped_weight}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          {shipment.note && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
              <p className="text-sm text-gray-700">{shipment.note}</p>
            </div>
          )}
        </div>
      </div>

      {/* Shipment Lines */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Package className="h-5 w-5 mr-2" />
            Shipment Lines ({shipment.movement_line.length})
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
              {shipment.movement_line.map((line) => (
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

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Shipment Release Email</h3>
              <button
                onClick={() => setShowEmailModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Email Content</label>
              <textarea
                value={emailText}
                readOnly
                rows={20}
                className="w-full border border-gray-300 rounded-md px-3 py-2 bg-gray-50 font-mono text-sm"
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowEmailModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={handleCopyToClipboard}
                className={`inline-flex items-center px-4 py-2 rounded-md transition-colors ${
                  copySuccess 
                    ? 'bg-green-600 text-white' 
                    : 'bg-sharda-primary text-white hover:bg-sharda-secondary'
                }`}
              >
                {copySuccess ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Copied!
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Copy to Clipboard
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}