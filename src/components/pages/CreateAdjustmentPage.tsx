import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save, X, Calendar, Building, Package, Plus, Trash2 } from 'lucide-react'
import { SearchableDropdown } from '../common/SearchableDropdown'
import { supabase } from '../../lib/supabase'
import { useWarehouses, useItems } from '../../hooks/useCommercialData'

interface AdjustmentLine {
  line_no: number
  item_name: string
  inventory_state: 'Stock' | 'Consignment' | 'Hold'
  qty_adjustment: number
  reason: string
  lot_number?: string
}

export function CreateAdjustmentPage() {
  const navigate = useNavigate()
  const { warehouses } = useWarehouses()
  const { items } = useItems()
  
  const [formData, setFormData] = useState({
    effective_date: new Date().toISOString().split('T')[0],
    primary_warehouse_id: '',
    note: ''
  })

  const [adjustmentLines, setAdjustmentLines] = useState<AdjustmentLine[]>([
    {
      line_no: 1,
      item_name: '',
      inventory_state: 'Stock',
      qty_adjustment: 0,
      reason: '',
      lot_number: ''
    }
  ])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAddLine = () => {
    const newLine: AdjustmentLine = {
      line_no: adjustmentLines.length + 1,
      item_name: '',
      inventory_state: 'Stock',
      qty_adjustment: 0,
      reason: '',
      lot_number: ''
    }
    setAdjustmentLines([...adjustmentLines, newLine])
  }

  const handleLineChange = (index: number, field: keyof AdjustmentLine, value: string | number) => {
    const updatedLines = [...adjustmentLines]
    updatedLines[index] = {
      ...updatedLines[index],
      [field]: value
    }
    setAdjustmentLines(updatedLines)
  }

  const handleDeleteLine = (index: number) => {
    if (adjustmentLines.length === 1) {
      // Reset the line instead of deleting
      setAdjustmentLines([{
        line_no: 1,
        item_name: '',
        inventory_state: 'Stock',
        qty_adjustment: 0,
        reason: '',
        lot_number: ''
      }])
    } else {
      const updatedLines = adjustmentLines.filter((_, i) => i !== index)
      // Renumber lines
      const renumberedLines = updatedLines.map((line, i) => ({
        ...line,
        line_no: i + 1
      }))
      setAdjustmentLines(renumberedLines)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Validate that we have at least one valid line
      const validLines = adjustmentLines.filter(line => 
        line.item_name && line.qty_adjustment !== 0
      )

      if (validLines.length === 0) {
        throw new Error('Please add at least one adjustment line with a non-zero quantity')
      }

      // Create movement header
      const movementHeaderData = {
        doc_type: 'Adjustment',
        status: 'Posted',
        effective_date: formData.effective_date,
        primary_warehouse_id: formData.primary_warehouse_id,
        note: formData.note || null
      }

      const { data: headerData, error: headerError } = await supabase
        .from('movement_hdr')
        .insert([movementHeaderData])
        .select()
        .single()

      if (headerError) throw headerError
      if (!headerData) throw new Error('Failed to create adjustment header')

      // Create movement lines
      const movementLinesData = validLines.map((line, index) => ({
        hdr_id: headerData.id,
        line_no: index + 1,
        item_name: line.item_name,
        warehouse_id: formData.primary_warehouse_id,
        inventory_state: line.inventory_state,
        qty_base: line.qty_adjustment,
        lot_number: line.lot_number || null,
        effective_date: formData.effective_date
      }))

      const { error: linesError } = await supabase
        .from('movement_line')
        .insert(movementLinesData)

      if (linesError) throw linesError

      // Navigate back to adjustments list
      navigate('/adjustments')
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while creating the adjustment')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create Inventory Adjustment</h1>
            <p className="text-gray-600 mt-1">
              Adjust inventory quantities for cycle counts, damage, or other corrections
            </p>
          </div>
          <button
            onClick={() => navigate('/adjustments')}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <div className="w-full border border-gray-200 rounded-md px-3 py-2 bg-gray-50">
                <span className="text-sm text-gray-900 font-medium">Posted</span>
                <p className="mt-1 text-xs text-gray-500">
                  Adjustment will be immediately effective and update inventory
                </p>
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

          {/* Adjustment Lines */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Adjustment Lines</h4>
              <button
                type="button"
                onClick={handleAddLine}
                className="inline-flex items-center px-3 py-2 bg-sharda-primary text-white rounded-md hover:bg-sharda-secondary transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Line
              </button>
            </div>

            <div className="space-y-4">
              {adjustmentLines.map((line, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="font-medium text-gray-900">Line {line.line_no}</h5>
                    <button
                      type="button"
                      onClick={() => handleDeleteLine(index)}
                      className="text-red-600 hover:text-red-800"
                      disabled={adjustmentLines.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Item *
                      </label>
                      <SearchableDropdown
                        options={items.map(item => ({ id: item.item_name, name: item.item_name }))}
                        value={line.item_name}
                        onChange={(value) => handleLineChange(index, 'item_name', value)}
                        placeholder="Search for item..."
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Inventory State *
                      </label>
                      <select
                        value={line.inventory_state}
                        onChange={(e) => handleLineChange(index, 'inventory_state', e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                      >
                        <option value="Stock">Stock</option>
                        <option value="Consignment">Consignment</option>
                        <option value="Hold">Hold</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Adjustment Qty *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={line.qty_adjustment}
                        onChange={(e) => handleLineChange(index, 'qty_adjustment', parseFloat(e.target.value) || 0)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                        placeholder="+ or - quantity"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Positive = increase, Negative = decrease
                      </p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Lot Number
                      </label>
                      <input
                        type="text"
                        value={line.lot_number}
                        onChange={(e) => handleLineChange(index, 'lot_number', e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                        placeholder="Optional"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Reason *
                      </label>
                      <select
                        value={line.reason}
                        onChange={(e) => handleLineChange(index, 'reason', e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                        required
                      >
                        <option value="">Select reason...</option>
                        <option value="Cycle Count">Cycle Count</option>
                        <option value="Physical Count">Physical Count</option>
                        <option value="Damage">Damage</option>
                        <option value="Shrinkage">Shrinkage</option>
                        <option value="Found Inventory">Found Inventory</option>
                        <option value="System Error">System Error</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate('/adjustments')}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center px-4 py-2 bg-sharda-primary text-white rounded-lg hover:bg-sharda-secondary transition-colors disabled:opacity-50"
          >
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Creating...' : 'Create Adjustment'}
          </button>
        </div>
      </form>
    </div>
  )
}