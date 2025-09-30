import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Save, X, Calendar, Building, Package, Truck, ArrowLeft, AlertCircle, Plus, Trash2 } from 'lucide-react'
import { SearchableDropdown } from '../common/SearchableDropdown'
import { supabase } from '../../lib/supabase'
import { useWarehouses, useItems } from '../../hooks/useCommercialData'
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
    scac?: string
    service_level?: string
    pro_number?: string
    packages_count?: number
    shipped_weight?: number
  }
}

interface ShipmentLine {
  id?: string
  line_no: number
  item_name: string
  warehouse_id: string
  inventory_state: 'Stock' | 'Consignment' | 'Hold'
  qty_base: number
  qty_volume: number
  lot_number?: string
  pack_size_details?: any
}

export function EditShipmentPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { warehouses } = useWarehouses()
  const { items } = useItems()
  
  const [shipment, setShipment] = useState<MovementRecord | null>(null)
  const [shipmentLines, setShipmentLines] = useState<ShipmentLine[]>([])
  const [formData, setFormData] = useState({
    effective_date: '',
    primary_warehouse_id: '',
    note: '',
    // Shipment details
    carrier_name: '',
    tracking_number: '',
    scac: '',
    service_level: '',
    pro_number: '',
    packages_count: '',
    shipped_weight: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
          movement_line (
            id,
            line_no,
            item_name,
            warehouse_id,
            inventory_state,
            qty_base,
            lot_number,
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
            )
          ),
          movement_ext (
            carrier_name,
            tracking_number,
            scac,
            service_level,
            pro_number,
            packages_count,
            shipped_weight
          )
        `)
        .eq('id', shipmentId)
        .eq('doc_type', 'Shipment')
        .single()

      if (error) throw error
      if (!data) throw new Error('Shipment not found')

      setShipment(data)
      
      // Convert movement lines to editable format
      const editableLines: ShipmentLine[] = (data.movement_line || []).map(line => ({
        id: line.id,
        line_no: line.line_no,
        item_name: line.item_name,
        warehouse_id: line.warehouse_id || data.primary_warehouse_id,
        inventory_state: line.inventory_state,
        qty_base: Math.abs(line.qty_base), // Convert to positive for display
        qty_volume: line.item?.pack_size_details?.uom_per_each 
          ? Math.abs(line.qty_base) * line.item.pack_size_details.uom_per_each
          : Math.abs(line.qty_base),
        lot_number: line.lot_number || '',
        pack_size_details: line.item?.pack_size_details
      }))
      
      setShipmentLines(editableLines)
      setFormData({
        effective_date: data.effective_date,
        primary_warehouse_id: data.primary_warehouse_id,
        note: data.note || '',
        carrier_name: data.movement_ext?.carrier_name || '',
        tracking_number: data.movement_ext?.tracking_number || '',
        scac: data.movement_ext?.scac || '',
        service_level: data.movement_ext?.service_level || '',
        pro_number: data.movement_ext?.pro_number || '',
        packages_count: data.movement_ext?.packages_count?.toString() || '',
        shipped_weight: data.movement_ext?.shipped_weight?.toString() || ''
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleAddLine = () => {
    const newLine: ShipmentLine = {
      line_no: shipmentLines.length + 1,
      item_name: '',
      warehouse_id: formData.primary_warehouse_id,
      inventory_state: 'Stock',
      qty_base: 1,
      qty_volume: 1,
      lot_number: '',
      pack_size_details: undefined
    }
    setShipmentLines([...shipmentLines, newLine])
  }

  const handleLineChange = (index: number, field: keyof ShipmentLine, value: string | number) => {
    const updatedLines = [...shipmentLines]
    
    if (field === 'item_name') {
      // Find the selected item with pack size details
      const selectedItem = items.find(item => item.item_name === value)
      updatedLines[index] = {
        ...updatedLines[index],
        item_name: value as string,
        pack_size_details: selectedItem?.pack_size_details
      }
    } else if (field === 'qty_volume') {
      const qtyVolume = value as number
      const packSizeDetails = updatedLines[index].pack_size_details
      
      updatedLines[index] = {
        ...updatedLines[index],
        qty_volume: qtyVolume
      }
      
      if (packSizeDetails?.uom_per_each) {
        const qtyEaches = qtyVolume / packSizeDetails.uom_per_each
        updatedLines[index].qty_base = qtyEaches
      } else {
        updatedLines[index].qty_base = qtyVolume
      }
    } else {
      updatedLines[index] = {
        ...updatedLines[index],
        [field]: value
      }
    }
    
    setShipmentLines(updatedLines)
  }

  const handleDeleteLine = (index: number) => {
    if (shipmentLines.length === 1) {
      // Reset the line instead of deleting
      setShipmentLines([{
        line_no: 1,
        item_name: '',
        warehouse_id: formData.primary_warehouse_id,
        inventory_state: 'Stock',
        qty_base: 1,
        qty_volume: 1,
        lot_number: '',
        pack_size_details: undefined
      }])
    } else {
      const updatedLines = shipmentLines.filter((_, i) => i !== index)
      // Renumber lines
      const renumberedLines = updatedLines.map((line, i) => ({
        ...line,
        line_no: i + 1
      }))
      setShipmentLines(renumberedLines)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!shipment) return

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
        .eq('id', shipment.id)

      if (headerError) throw headerError

      // Update movement lines
      const validLines = shipmentLines.filter(line => line.item_name && line.qty_base > 0)
      
      // Delete existing lines that are not in the current list
      const existingLineIds = shipment.movement_line?.map(line => line.id) || []
      const currentLineIds = validLines.map(line => line.id).filter(Boolean)
      const linesToDelete = existingLineIds.filter(id => !currentLineIds.includes(id))
      
      if (linesToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('movement_line')
          .delete()
          .in('id', linesToDelete)
        
        if (deleteError) throw deleteError
      }
      
      // Update or insert line items
      for (const line of validLines) {
        const lineData = {
          hdr_id: shipment.id,
          line_no: line.line_no,
          item_name: line.item_name,
          warehouse_id: line.warehouse_id,
          inventory_state: line.inventory_state,
          qty_base: -line.qty_base, // Negative for shipments
          lot_number: line.lot_number || null,
          effective_date: formData.effective_date,
          updated_at: new Date().toISOString()
        }
        
        if (line.id) {
          // Update existing line
          const { error: lineError } = await supabase
            .from('movement_line')
            .update(lineData)
            .eq('id', line.id)
          
          if (lineError) throw lineError
        } else {
          // Insert new line
          const { error: lineError } = await supabase
            .from('movement_line')
            .insert([lineData])
          
          if (lineError) throw lineError
        }
      }

      // Update or create movement_ext record
      const extData: any = {
        movement_hdr_id: shipment.id
      }
      
      if (formData.carrier_name) extData.carrier_name = formData.carrier_name
      if (formData.tracking_number) extData.tracking_number = formData.tracking_number
      if (formData.scac) extData.scac = formData.scac
      if (formData.service_level) extData.service_level = formData.service_level
      if (formData.pro_number) extData.pro_number = formData.pro_number
      if (formData.packages_count) extData.packages_count = parseInt(formData.packages_count)
      if (formData.shipped_weight) extData.shipped_weight = parseFloat(formData.shipped_weight)

      // Check if movement_ext record exists
      if (shipment.movement_ext) {
        // Update existing record
        const { error: extError } = await supabase
          .from('movement_ext')
          .update(extData)
          .eq('movement_hdr_id', shipment.id)

        if (extError) throw extError
      } else {
        // Create new record
        const { error: extError } = await supabase
          .from('movement_ext')
          .insert([extData])

        if (extError) throw extError
      }

      // Navigate back to shipment detail
      navigate(`/shipments/${shipment.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while updating the shipment')
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

  if (error && !shipment) {
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

  if (!shipment) {
    return null
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(`/shipments/${shipment.id}`)}
              className="inline-flex items-center text-gray-600 hover:text-sharda-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Shipment
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Edit Shipment</h1>
              <p className="text-gray-600 mt-1">
                {shipment.id.substring(0, 8)}... • Created on {formatDate(shipment.created_at)}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(`/shipments/${shipment.id}`)}
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
            <Truck className="h-5 w-5 mr-2" />
            Shipment Details
          </h3>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="h-4 w-4 inline mr-1" />
                Ship Date *
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
                Ship From Warehouse *
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
                  status={shipment.status} 
                  physicalStatus={shipment.physical_status}
                  isMovement={true} 
                />
              </div>
            </div>
          </div>

          {/* Shipment Details */}
          <div className="border-t border-gray-200 pt-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Carrier & Shipping Details</h4>
            
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
                  placeholder="e.g., FedEx, UPS, DHL"
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
                  SCAC Code
                </label>
                <input
                  type="text"
                  value={formData.scac}
                  onChange={(e) => setFormData(prev => ({ ...prev, scac: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                  placeholder="Standard Carrier Alpha Code"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Service Level
                </label>
                <input
                  type="text"
                  value={formData.service_level}
                  onChange={(e) => setFormData(prev => ({ ...prev, service_level: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                  placeholder="e.g., Ground, Express, Overnight"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  PRO Number
                </label>
                <input
                  type="text"
                  value={formData.pro_number}
                  onChange={(e) => setFormData(prev => ({ ...prev, pro_number: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                  placeholder="Progressive number"
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
                  placeholder="Number of packages"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Shipped Weight (lbs)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={formData.shipped_weight}
                  onChange={(e) => setFormData(prev => ({ ...prev, shipped_weight: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                  placeholder="Total weight"
                />
              </div>
            </div>
          </div>

          {/* Shipment Lines */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Shipment Lines</h4>
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
              {shipmentLines.map((line, index) => (
                <div key={line.id || index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="font-medium text-gray-900">Line {line.line_no}</h5>
                    <button
                      type="button"
                      onClick={() => handleDeleteLine(index)}
                      className="text-red-600 hover:text-red-800"
                      disabled={shipmentLines.length === 1}
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
                        Volume {line.pack_size_details?.units_of_units ? `(${line.pack_size_details.units_of_units})` : '(EA)'} *
                      </label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={line.qty_volume}
                        onChange={(e) => handleLineChange(index, 'qty_volume', parseFloat(e.target.value) || 0)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                      />
                      
                      {/* Show calculated quantity in eaches */}
                      {line.pack_size_details?.uom_per_each && (
                        <div className="text-xs text-gray-600 mt-1">
                          = {line.qty_base} EA
                        </div>
                      )}
                      
                      {/* Volume divisibility warning */}
                      {line.pack_size_details?.uom_per_each && line.qty_volume > 0 && (
                        (() => {
                          const isNotDivisible = line.qty_volume % line.pack_size_details.uom_per_each !== 0
                          return isNotDivisible && (
                            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-1 mt-1">
                              ⚠️ Volume not divisible by pack size ({line.pack_size_details.uom_per_each} {line.pack_size_details.units_of_units}/EA)
                            </div>
                          )
                        })()
                      )}
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
                        Warehouse *
                      </label>
                      <SearchableDropdown
                        options={warehouses.map(wh => ({ id: wh.id, name: `${wh.name} (${wh.code})` }))}
                        value={line.warehouse_id}
                        onChange={(value) => handleLineChange(index, 'warehouse_id', value)}
                        placeholder="Search for warehouse..."
                        required
                      />
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
                  </div>
                </div>
              ))}
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
            onClick={() => navigate(`/shipments/${shipment.id}`)}
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