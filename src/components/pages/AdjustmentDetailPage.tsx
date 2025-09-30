import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Calendar, Building, Package, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'
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

export function AdjustmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [adjustment, setAdjustment] = useState<MovementRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (id) {
      fetchAdjustment(id)
    }
  }, [id])

  const fetchAdjustment = async (adjustmentId: string) => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('movement_hdr')
        .select(`
          id,
          doc_type,
          status,
          effective_date,
          posted_at,
          created_at,
          note,
          primary_warehouse:primary_warehouse_id (
            id,
            code,
            name
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
        .eq('id', adjustmentId)
        .eq('doc_type', 'Adjustment')
        .single()

      if (error) throw error
      if (!data) throw new Error('Adjustment not found')

      setAdjustment(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
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

  if (error || !adjustment) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error || 'Adjustment not found'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const totalPositive = adjustment.movement_line.reduce((sum, line) => {
    return sum + (line.qty_base > 0 ? line.qty_base : 0)
  }, 0)

  const totalNegative = adjustment.movement_line.reduce((sum, line) => {
    return sum + (line.qty_base < 0 ? Math.abs(line.qty_base) : 0)
  }, 0)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/adjustments')}
            className="inline-flex items-center text-gray-600 hover:text-sharda-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Adjustments
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              Adjustment {adjustment.id.substring(0, 8)}...
              <DocumentStatusBadge status={adjustment.status} className="ml-3" />
            </h1>
            <p className="text-gray-600 mt-1">
              Created on {formatDate(adjustment.created_at)}
              {adjustment.posted_at && ` • Posted on ${formatDateTime(adjustment.posted_at)}`}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => navigate(`/adjustments/${adjustment.id}/edit`)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </button>
        </div>
      </div>

      {/* Adjustment Details */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Package className="h-5 w-5 mr-2" />
            Adjustment Details
          </h3>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Basic Information</h4>
              
              <div>
                <label className="block text-sm font-medium text-gray-500">Adjustment ID</label>
                <p className="mt-1 text-sm text-gray-900">{adjustment.id}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-500">Status</label>
                <div className="mt-1">
                  <DocumentStatusBadge status={adjustment.status} isMovement={true} />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-500">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  Effective Date
                </label>
                <p className="mt-1 text-sm text-gray-900">{formatDate(adjustment.effective_date)}</p>
              </div>
            </div>

            {/* Warehouse Information */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Warehouse Information</h4>
              
              <div>
                <label className="block text-sm font-medium text-gray-500">
                  <Building className="h-4 w-4 inline mr-1" />
                  Warehouse
                </label>
                <p className="mt-1 text-sm text-gray-900">
                  <Link
                    to={`/warehouses/${adjustment.primary_warehouse?.id}`}
                    className="text-sharda-primary hover:text-sharda-secondary"
                  >
                    {adjustment.primary_warehouse?.name} ({adjustment.primary_warehouse?.code})
                  </Link>
                </p>
              </div>
            </div>

            {/* Adjustment Summary */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Adjustment Summary</h4>
              
              {totalPositive > 0 && (
                <div className="flex items-center text-green-600">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  <div>
                    <p className="text-sm font-medium">Increases</p>
                    <p className="text-lg font-bold">+{totalPositive} EA</p>
                  </div>
                </div>
              )}
              
              {totalNegative > 0 && (
                <div className="flex items-center text-red-600">
                  <TrendingDown className="h-4 w-4 mr-2" />
                  <div>
                    <p className="text-sm font-medium">Decreases</p>
                    <p className="text-lg font-bold">-{totalNegative} EA</p>
                  </div>
                </div>
              )}
              
              <div>
                <p className="text-sm font-medium text-gray-500">Net Change</p>
                <p className={`text-lg font-bold ${
                  (totalPositive - totalNegative) > 0 ? 'text-green-600' : 
                  (totalPositive - totalNegative) < 0 ? 'text-red-600' : 'text-gray-900'
                }`}>
                  {totalPositive - totalNegative > 0 ? '+' : ''}{totalPositive - totalNegative} EA
                </p>
              </div>
            </div>
          </div>

          {/* Notes */}
          {adjustment.note && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
              <p className="text-sm text-gray-700">{adjustment.note}</p>
            </div>
          )}
        </div>
      </div>

      {/* Adjustment Lines */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Package className="h-5 w-5 mr-2" />
            Adjustment Lines ({adjustment.movement_line.length})
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
                  Adjustment
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
              {adjustment.movement_line.map((line) => (
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
                    <div className={`text-sm font-medium flex items-center ${
                      line.qty_base > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {line.qty_base > 0 ? (
                        <TrendingUp className="h-4 w-4 mr-1" />
                      ) : (
                        <TrendingDown className="h-4 w-4 mr-1" />
                      )}
                      {line.qty_base > 0 ? '+' : ''}{formatQuantityDisplay(Math.abs(line.qty_base), line.item?.pack_size_details)}
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