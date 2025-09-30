import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Save, X, Calendar, Building, Package, Truck, ArrowLeft, AlertCircle } from 'lucide-react'
import { SearchableDropdown } from '../common/SearchableDropdown'
import { supabase } from '../../lib/supabase'
import { useWarehouses } from '../../hooks/useCommercialData'
import { DocumentStatusBadge } from '../commercial/DocumentStatusBadge'
import { formatDate } from '../../utils/formatters'

interface MovementRecord {
  id: string
  doc_type: string
  status: string
  physical_status?: string
  effective_date: string
  posted_at?: string
  created_at: string
  note?: string
  primary_warehouse_id: string
  secondary_warehouse_id?: string
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
}

export function EditReceiptPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { warehouses } = useWarehouses()
  
  const [receipt, setReceipt] = useState<MovementRecord | null>(null)
  const [formData, setFormData] = useState({
    effective_date: '',
    primary_warehouse_id: '',
    note: '',
    // Receipt details
    carrier_name: '',
    tracking_number: '',
    packages_count: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
          effective_date,
          posted_at,
          created_at,
          note,
          primary_warehouse_id,
          secondary_warehouse_id,
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
          )
        `)
        .eq('id', receiptId)
        .eq('doc_type', 'Receipt')
        .single()

      if (error) throw error
      if (!data) throw new Error('Receipt not found')

      setReceipt(data)
      setFormData({
        effective_date: data.effective_date,
        primary_warehouse_id: data.primary_warehouse_id,
        note: data.note || '',
        carrier_name: data.movement_ext?.carrier_name || '',
        tracking_number: data.movement_ext?.tracking_number || '',
        packages_count: data.movement_ext?.packages_count?.toString() || ''
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!receipt) return

    setSaving(true)
    setError(null)

    try {
      // Update movement header
      const { error: headerError } = await supabase
        .from('movement_hdr')
        .update({
          effective_date: formData.effective_date,
          primary_warehouse_id: formData.primary_warehouse_id,
          note: formData.note || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', receipt.id)

      if (headerError) throw headerError

      // Update or create movement_ext record
      const extData: any = {
        movement_hdr_id: receipt.id
      }
      
      if (formData.carrier_name) extData.carrier_name = formData.carrier_name
      if (formData.tracking_number) extData.tracking_number = formData.tracking_number
      if (formData.packages_count) extData.packages_count = parseInt(formData.packages_count)

      // Check if movement_ext record exists
      if (receipt.movement_ext) {
        // Update existing record
        const { error: extError } = await supabase
          .from('movement_ext')
          .update(extData)
          .eq('movement_hdr_id', receipt.id)

        if (extError) throw extError
      } else {
        // Create new record
        const { error: extError } = await supabase
          .from('movement_ext')
          .insert([extData])

        if (extError) throw extError
      }

      // Navigate back to receipt detail
      navigate(`/receipts/${receipt.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while updating the receipt')
    } finally {
      setSaving(false)
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

  if (error && !receipt) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!receipt) {
    return null
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(`/receipts/${receipt.id}`)}
              className="inline-flex items-center text-gray-600 hover:text-sharda-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Receipt
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Edit Receipt</h1>
              <p className="text-gray-600 mt-1">
                {receipt.id.substring(0, 8)}... • Created on {formatDate(receipt.created_at)}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/receipts/${receipt.id}`)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Package className="h-5 w-5 mr-2" />
            Receipt Details
          </h3>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="h-4 w-4 inline mr-1" />
                Receipt Date *
              </label>
              <input
                type="date"
                value={formData.effective_date}
                onChange={(e) => setFormData(prev => ({ ...prev, effective_date: e.target.value }))}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Building className="h-4 w-4 inline mr-1" />
                Receive Into Warehouse *
              </label>
              <SearchableDropdown
                options={warehouses.map(wh => ({ id: wh.id, name: `${wh.name} (${wh.code})` }))}
                value={formData.primary_warehouse_id}
                onChange={(value) => setFormData(prev => ({ ...prev, primary_warehouse_id: value }))}
                placeholder="Search for warehouse..."
                required
              />
            </div>
          </div>

          {/* Status Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <div className="w-full border border-gray-200 rounded-md px-3 py-2 bg-gray-50">
                <DocumentStatusBadge 
                  status={receipt.status} 
                  physicalStatus={receipt.physical_status}
                  isMovement={true} 
                />
              </div>
            </div>
          </div>

          {/* Receipt Details */}
          <div className="border-t border-gray-200 pt-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Carrier & Delivery Details</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Carrier Name
                </label>
                <input
                  type="text"
                  value={formData.carrier_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, carrier_name: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                  placeholder="Delivering carrier"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tracking Number
                </label>
                <input
                  type="text"
                  value={formData.tracking_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, tracking_number: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                  placeholder="Tracking number"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Package Count
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.packages_count}
                  onChange={(e) => setFormData(prev => ({ ...prev, packages_count: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                  placeholder="Number of packages received"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.note}
              onChange={(e) => setFormData(prev => ({ ...prev, note: e.target.value }))}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
              placeholder="Add any additional notes..."
            />
          </div>
        </div>

        {/* Form Actions */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate(`/receipts/${receipt.id}`)}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center px-4 py-2 bg-sharda-primary text-white rounded-lg hover:bg-sharda-secondary transition-colors disabled:opacity-50"
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}