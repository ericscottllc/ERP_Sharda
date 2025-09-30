import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Save, X, Calendar, Building, Package, ArrowLeft, AlertCircle } from 'lucide-react'
import { SearchableDropdown } from '../common/SearchableDropdown'
import { supabase } from '../../lib/supabase'
import { useWarehouses } from '../../hooks/useCommercialData'
import { DocumentStatusBadge } from '../commercial/DocumentStatusBadge'
import { formatDate } from '../../utils/formatters'

interface MovementRecord {
  id: string
  doc_type: string
  status: string
  effective_date: string
  posted_at?: string
  created_at: string
  note?: string
  primary_warehouse_id: string
  primary_warehouse?: {
    id: string
    code: string
    name: string
  }
}

export function EditAdjustmentPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { warehouses } = useWarehouses()
  
  const [adjustment, setAdjustment] = useState<MovementRecord | null>(null)
  const [formData, setFormData] = useState({
    effective_date: '',
    primary_warehouse_id: '',
    note: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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
          primary_warehouse_id,
          primary_warehouse:primary_warehouse_id (
            id,
            code,
            name
          )
        `)
        .eq('id', adjustmentId)
        .eq('doc_type', 'Adjustment')
        .single()

      if (error) throw error
      if (!data) throw new Error('Adjustment not found')

      setAdjustment(data)
      setFormData({
        effective_date: data.effective_date,
        primary_warehouse_id: data.primary_warehouse_id,
        note: data.note || ''
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adjustment) return

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
        .eq('id', adjustment.id)

      if (headerError) throw headerError

      // Navigate back to adjustment detail
      navigate(`/adjustments/${adjustment.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while updating the adjustment')
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

  if (error && !adjustment) {
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

  if (!adjustment) {
    return null
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(`/adjustments/${adjustment.id}`)}
              className="inline-flex items-center text-gray-600 hover:text-sharda-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Adjustment
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Edit Adjustment</h1>
              <p className="text-gray-600 mt-1">
                {adjustment.id.substring(0, 8)}... • Created on {formatDate(adjustment.created_at)}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/adjustments/${adjustment.id}`)}
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
            Adjustment Details
          </h3>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="h-4 w-4 inline mr-1" />
                Effective Date *
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
                Warehouse *
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
                <DocumentStatusBadge status={adjustment.status} isMovement={true} />
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
              placeholder="Reason for adjustment, cycle count reference, etc."
            />
          </div>

          {/* Note about line items */}
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex">
              <Package className="h-5 w-5 text-blue-400" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">Line Items</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>Line item quantities and details cannot be modified after posting. Only header information can be updated.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate(`/adjustments/${adjustment.id}`)}
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