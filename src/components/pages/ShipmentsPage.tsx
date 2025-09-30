import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Calendar, Building, Package, Truck, User, FileText } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { DocumentStatusBadge } from '../commercial/DocumentStatusBadge'

interface MovementRecord {
  id: string
  doc_type: string
  status: string
  effective_date: string
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
  line_count: number
  total_items: number
}

export function ShipmentsPage() {
  const navigate = useNavigate()
  const [shipments, setShipments] = useState<MovementRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchShipments()
  }, [])

  const fetchShipments = async () => {
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
            qty_base
          )
        `)
        .eq('doc_type', 'Shipment')
        .order('created_at', { ascending: false })

      if (error) throw error

      const processedData = (data || []).map(record => ({
        ...record,
        line_count: record.movement_line?.length || 0,
        total_items: record.movement_line?.reduce((sum, line) => sum + Math.abs(parseFloat(line.qty_base)), 0) || 0
      }))

      setShipments(processedData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString()
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

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading shipments</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Shipments</h1>
          <p className="text-gray-600 mt-1">
            Track and manage all outbound shipments
          </p>
        </div>
        <Link
          to="/shipments/new"
          className="inline-flex items-center px-4 py-2 bg-sharda-primary text-white rounded-lg hover:bg-sharda-secondary transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Shipment
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <Truck className="h-8 w-8 text-blue-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total Shipments</p>
              <p className="text-2xl font-bold text-gray-900">{shipments.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <Package className="h-8 w-8 text-yellow-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Draft</p>
              <p className="text-2xl font-bold text-gray-900">
                {shipments.filter(s => s.status === 'Draft').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-green-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Posted</p>
              <p className="text-2xl font-bold text-gray-900">
                {shipments.filter(s => s.status === 'Posted').length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <Building className="h-8 w-8 text-purple-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">This Month</p>
              <p className="text-2xl font-bold text-gray-900">
                {shipments.filter(s => {
                  const shipDate = new Date(s.effective_date)
                  const now = new Date()
                  return shipDate.getMonth() === now.getMonth() && 
                         shipDate.getFullYear() === now.getFullYear()
                }).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Shipments Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Shipments</h3>
        </div>
        
        {shipments.length === 0 ? (
          <div className="p-12 text-center">
            <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No shipments found</h3>
            <p className="text-gray-600 mb-6">Get started by creating your first shipment.</p>
            <Link
              to="/shipments/new"
              className="inline-flex items-center px-4 py-2 bg-sharda-primary text-white rounded-lg hover:bg-sharda-secondary transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Shipment
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shipment ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ship Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Warehouse
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Carrier
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Items
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {shipments.map((shipment) => (
                  <tr 
                    key={shipment.id} 
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/shipments/${shipment.id}`)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {shipment.id.substring(0, 8)}...
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full border ${
                        (shipment as any).physical_status === 'Pending Pickup' ? 'bg-yellow-100 text-yellow-800 border-yellow-200' :
                        (shipment as any).physical_status === 'In Transit' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                        (shipment as any).physical_status === 'Delivered' ? 'bg-green-100 text-green-800 border-green-200' :
                        'bg-gray-100 text-gray-800 border-gray-200'
                      }`}>
                        {(shipment as any).physical_status || 'In Transit'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(shipment.effective_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {shipment.primary_warehouse?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        {shipment.movement_ext?.carrier_name || 'N/A'}
                        {shipment.movement_ext?.tracking_number && (
                          <div className="text-xs text-gray-500">
                            {shipment.movement_ext.tracking_number}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div>
                        {shipment.line_count} lines
                        <div className="text-xs text-gray-500">
                          {shipment.total_items} total items
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDateTime(shipment.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}