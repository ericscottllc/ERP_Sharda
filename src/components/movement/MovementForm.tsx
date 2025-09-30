import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Save, X, Calendar, Building, Package, AlertCircle } from 'lucide-react'
import { SearchableDropdown } from '../common/SearchableDropdown'
import { supabase } from '../../lib/supabase'
import { useWarehouses } from '../../hooks/useCommercialData'
import { CommercialHeader, CommercialLine, DocType } from '../../types/database'
import { formatQuantityDisplay } from '../../utils/formatters'

interface MovementFormProps {
  movementType: 'Receipt' | 'Shipment' | 'Transfer'
  title: string
  backPath: string
}

interface MovementLineData {
  commercial_line_id: string
  line_no: number
  item_name: string
  inventory_state: 'Stock' | 'Consignment' | 'Hold'
  qty_ordered: number
  qty_fulfilled: number
  qty_remaining: number
  qty_to_process: number
  pack_size_details?: any
  warehouse_id?: string
}

export function MovementForm({ movementType, title, backPath }: MovementFormProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { warehouses } = useWarehouses()
  
  const [sourceDocument, setSourceDocument] = useState<CommercialHeader | null>(null)
  const [availableLines, setAvailableLines] = useState<MovementLineData[]>([])
  const [selectedLines, setSelectedLines] = useState<Set<string>>(new Set())
  const [formData, setFormData] = useState({
    effective_date: new Date().toISOString().split('T')[0],
    primary_warehouse_id: '',
    secondary_warehouse_id: '',
    inventory_state: 'Stock' as 'Stock' | 'Consignment' | 'Hold',
    note: '',
    physical_status: '',
    // Shipment details
    carrier_name: '',
    tracking_number: '',
    scac: '',
    service_level: '',
    pro_number: '',
    packages_count: '',
    shipped_weight: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fromParam = searchParams.get('from_po') || searchParams.get('from_so') || searchParams.get('from_to')
    if (fromParam) {
      fetchSourceDocument(fromParam)
    }
  }, [searchParams])

  const fetchSourceDocument = async (documentId: string) => {
    try {
      setLoading(true)
      
      // Fetch the source commercial document
      const { data: headerData, error: headerError } = await supabase
        .from('commercial_hdr')
        .select(`
          *,
          party:party_id (display_name),
          primary_warehouse:primary_warehouse_id (id, code, name),
          secondary_warehouse:secondary_warehouse_id (id, code, name)
        `)
        .eq('id', documentId)
        .single()

      if (headerError) throw headerError
      if (!headerData) throw new Error('Source document not found')

      // Fetch lines with fulfillment data
      const { data: linesData, error: linesError } = await supabase
        .from('commercial_line')
        .select(`
          *,
          item:item_name (
            item_name,
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
          fulfillment_links:fulfillment_link (
            qty_linked_base
          )
        `)
        .eq('hdr_id', documentId)
        .order('line_no')

      if (linesError) throw linesError

      // Calculate remaining quantities for each line
      const processedLines: MovementLineData[] = (linesData || []).map((line: any) => {
        const totalFulfilled = line.fulfillment_links?.reduce((sum: number, link: any) => {
          return sum + parseFloat(link.qty_linked_base || 0)
        }, 0) || 0

        const qtyRemaining = parseFloat(line.qty_ordered) - totalFulfilled

        return {
          commercial_line_id: line.id,
          line_no: line.line_no,
          item_name: line.item_name,
          qty_ordered: parseFloat(line.qty_ordered),
          qty_fulfilled: totalFulfilled,
          qty_remaining: qtyRemaining,
          qty_to_process: qtyRemaining, // Default to remaining quantity
          pack_size_details: line.item?.pack_size_details,
          warehouse_id: line.warehouse_id
        }
      }).filter((line: MovementLineData) => line.qty_remaining > 0) // Only show lines with remaining quantity

      setSourceDocument(headerData)
      setAvailableLines(processedLines)
      
      // Pre-populate form data based on source document
      setFormData(prev => ({
        ...prev,
        primary_warehouse_id: movementType === 'Receipt' 
          ? headerData.primary_warehouse_id 
          : headerData.primary_warehouse_id,
        secondary_warehouse_id: movementType === 'Transfer' 
          ? headerData.secondary_warehouse_id || ''
          : '',
        physical_status: movementType === 'Shipment' ? 'In Transit' : 
                        movementType === 'Receipt' ? 'Received' : ''
      }))

      // Select all available lines by default
      setSelectedLines(new Set(processedLines.map(line => line.commercial_line_id)))
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleLineSelection = (lineId: string, selected: boolean) => {
    const newSelected = new Set(selectedLines)
    if (selected) {
      newSelected.add(lineId)
    } else {
      newSelected.delete(lineId)
    }
    setSelectedLines(newSelected)
  }

  const handleQuantityChange = (lineId: string, quantity: number) => {
    setAvailableLines(prev => prev.map(line => 
      line.commercial_line_id === lineId 
        ? { ...line, qty_to_process: Math.max(0, Math.min(quantity, line.qty_remaining)) }
        : line
    ))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sourceDocument) return

    setLoading(true)
    setError(null)

    try {
      const selectedLinesData = availableLines.filter(line => 
        selectedLines.has(line.commercial_line_id) && line.qty_to_process > 0
      )

      if (selectedLinesData.length === 0) {
        throw new Error('Please select at least one line item to process')
      }

      // Create movement header
      const movementHeaderData = {
        doc_type: movementType,
        status: 'Posted',
        physical_status: formData.physical_status || null,
        effective_date: formData.effective_date,
        primary_warehouse_id: formData.primary_warehouse_id,
        secondary_warehouse_id: formData.secondary_warehouse_id || null,
        note: formData.note || null
      }

      const { data: headerData, error: headerError } = await supabase
        .from('movement_hdr')
        .insert([movementHeaderData])
        .select()
        .single()

      if (headerError) throw headerError
      if (!headerData) throw new Error('Failed to create movement header')

      // Create movement_ext record if we have shipment details
      if (formData.carrier_name || formData.tracking_number || formData.packages_count || formData.shipped_weight) {
        const movementExtData: any = {
          movement_hdr_id: headerData.id
        }
        
        if (formData.carrier_name) movementExtData.carrier_name = formData.carrier_name
        if (formData.tracking_number) movementExtData.tracking_number = formData.tracking_number
        if (formData.scac) movementExtData.scac = formData.scac
        if (formData.service_level) movementExtData.service_level = formData.service_level
        if (formData.pro_number) movementExtData.pro_number = formData.pro_number
        if (formData.packages_count) movementExtData.packages_count = parseInt(formData.packages_count)
        if (formData.shipped_weight) movementExtData.shipped_weight = parseFloat(formData.shipped_weight)

        const { error: extError } = await supabase
          .from('movement_ext')
          .insert([movementExtData])

        if (extError) throw extError
      }

      // Create movement lines
      const movementLinesData = selectedLinesData.map((line, index) => ({
        hdr_id: headerData.id,
        line_no: index + 1,
        item_name: line.item_name,
        warehouse_id: line.warehouse_id || formData.primary_warehouse_id,
        inventory_state: formData.inventory_state,
        qty_base: movementType === 'Shipment' ? -line.qty_to_process : line.qty_to_process,
        effective_date: formData.effective_date
      }))

      const { data: linesData, error: linesError } = await supabase
        .from('movement_line')
        .insert(movementLinesData)
        .select()

      if (linesError) throw linesError
      if (!linesData) throw new Error('Failed to create movement lines')

      // Create fulfillment links
      const fulfillmentLinksData = selectedLinesData.map((line, index) => ({
        commercial_line_id: line.commercial_line_id,
        movement_line_id: linesData[index].id,
        qty_linked_base: line.qty_to_process
      }))

      const { error: linksError } = await supabase
        .from('fulfillment_link')
        .insert(fulfillmentLinksData)

      if (linksError) throw linksError

      // Navigate back to the source document
      const docTypeMap: Record<string, string> = {
        'SO': 'sales-orders',
        'PO': 'purchase-orders', 
        'TO': 'transfer-orders'
      }
      
      navigate(`/${docTypeMap[sourceDocument.doc_type]}/${sourceDocument.id}`)
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while creating the movement')
    } finally {
      setLoading(false)
    }
  }


  if (loading && !sourceDocument) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error && !sourceDocument) {
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

  if (!sourceDocument) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-yellow-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">No Source Document</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>Please navigate to this form from a commercial document.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create {title}</h1>
            <p className="text-gray-600 mt-1">
              From {sourceDocument.doc_type} {sourceDocument.doc_no}
              {sourceDocument.party && ` - ${sourceDocument.party.display_name}`}
            </p>
          </div>
          <button
            onClick={() => navigate(backPath)}
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
            {title} Details
          </h3>
        </div>

        <div className="p-6 space-y-6">
          {/* Movement Information */}
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
                {movementType === 'Receipt' ? 'Receive Into' : movementType === 'Shipment' ? 'Ship From' : 'From'} Warehouse *
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
                Physical Status *
              </label>
              {movementType === 'Shipment' ? (
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, physical_status: 'Pending Pickup' }))}
                    className={`px-4 py-2 text-sm font-medium rounded-md border transition-colors ${
                      formData.physical_status === 'Pending Pickup'
                        ? 'bg-yellow-100 border-yellow-300 text-yellow-800'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Pending Pickup
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, physical_status: 'In Transit' }))}
                    className={`px-4 py-2 text-sm font-medium rounded-md border transition-colors ${
                      formData.physical_status === 'In Transit'
                        ? 'bg-blue-100 border-blue-300 text-blue-800'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    In Transit
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, physical_status: 'Delivered' }))}
                    className={`px-4 py-2 text-sm font-medium rounded-md border transition-colors ${
                      formData.physical_status === 'Delivered'
                        ? 'bg-green-100 border-green-300 text-green-800'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Delivered
                  </button>
                </div>
              ) : (
                <select
                  value={formData.physical_status}
                  onChange={(e) => setFormData(prev => ({ ...prev, physical_status: e.target.value }))}
                  required
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                >
                  {movementType === 'Receipt' && (
                    <>
                      <option value="Pending Delivery">Pending Delivery</option>
                      <option value="In Transit">In Transit</option>
                      <option value="Received">Received</option>
                    </>
                  )}
                </select>
              )}
              <p className="mt-1 text-xs text-gray-500">
                {movementType === 'Shipment' && formData.physical_status === 'Pending Pickup' && 'Will set status to Draft - inventory not yet affected'}
                {movementType === 'Receipt' && formData.physical_status === 'Pending Delivery' && 'Will set status to Draft - inventory not yet affected'}
                {formData.physical_status === 'In Transit' && 'Items are in transit'}
                {(formData.physical_status === 'Delivered' || formData.physical_status === 'Received') && 'Items have been delivered/received'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <div className="w-full border border-gray-200 rounded-md px-3 py-2 bg-gray-50">
                <span className="text-sm text-gray-900 font-medium">
                  {formData.physical_status === 'Pending Pickup' || formData.physical_status === 'Pending Delivery' ? 'Draft' : 'Posted'}
                </span>
                <p className="mt-1 text-xs text-gray-500">
                  {formData.physical_status === 'Pending Pickup' || formData.physical_status === 'Pending Delivery' 
                    ? 'Inventory will not be affected until physical status changes'
                    : 'Movement will be immediately effective and update inventory'
                  }
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Package className="h-4 w-4 inline mr-1" />
                Inventory State *
              </label>
              <select
                value={formData.inventory_state}
                onChange={(e) => setFormData(prev => ({ ...prev, inventory_state: e.target.value as 'Stock' | 'Consignment' | 'Hold' }))}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
              >
                <option value="Stock">Stock</option>
                <option value="Consignment">Consignment</option>
                <option value="Hold">Hold</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {formData.inventory_state === 'Stock' && 'Regular inventory owned by the company'}
                {formData.inventory_state === 'Consignment' && 'Inventory owned by vendor/customer'}
                {formData.inventory_state === 'Hold' && 'Inventory on hold - not available for use'}
              </p>
            </div>

            {movementType === 'Transfer' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Building className="h-4 w-4 inline mr-1" />
                  To Warehouse
                </label>
                <SearchableDropdown
                  options={warehouses
                    .filter(w => w.id !== formData.primary_warehouse_id)
                    .map(wh => ({ id: wh.id, name: `${wh.name} (${wh.code})` }))}
                  value={formData.secondary_warehouse_id}
                  onChange={(value) => setFormData(prev => ({ ...prev, secondary_warehouse_id: value }))}
                  placeholder="Search for destination warehouse..."
                />
              </div>
            )}
          </div>

          {/* Shipment Details - only show for Shipments */}
          {movementType === 'Shipment' && (
            <div className="border-t border-gray-200 pt-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Shipment Details (Optional)</h4>
              
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
          )}

          {/* Receipt Details - only show for Receipts */}
          {movementType === 'Receipt' && (
            <div className="border-t border-gray-200 pt-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Receipt Details (Optional)</h4>
              
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
          )}

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

          {/* Line Items Selection */}
          <div className="border-t border-gray-200 pt-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">
              Select Items to {movementType === 'Receipt' ? 'Receive' : movementType === 'Shipment' ? 'Ship' : 'Transfer'}
            </h4>

            {availableLines.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No items available</h3>
                <p className="text-gray-600">All items from this document have already been processed.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {availableLines.map((line) => (
                  <div key={line.commercial_line_id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start space-x-4">
                      <input
                        type="checkbox"
                        checked={selectedLines.has(line.commercial_line_id)}
                        onChange={(e) => handleLineSelection(line.commercial_line_id, e.target.checked)}
                        className="mt-1 h-4 w-4 text-sharda-primary focus:ring-sharda-primary border-gray-300 rounded"
                      />
                      
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Item</label>
                          <p className="text-sm text-gray-900 font-medium">{line.item_name}</p>
                          <p className="text-xs text-gray-500">Line {line.line_no}</p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700">Available</label>
                          <p className="text-sm text-gray-900">{formatQuantityDisplay(line.qty_remaining, line.pack_size_details)}</p>
                          <p className="text-xs text-gray-500">
                            {formatQuantityDisplay(line.qty_fulfilled, line.pack_size_details)} of {formatQuantityDisplay(line.qty_ordered, line.pack_size_details)} fulfilled
                          </p>
                          <p className="text-xs text-gray-400">
                            State: {line.inventory_state}
                          </p>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700">
                            {movementType === 'Shipment' ? 'Volume' : 'Quantity'} to {movementType === 'Receipt' ? 'Receive' : movementType === 'Shipment' ? 'Ship' : 'Transfer'}
                            {movementType === 'Shipment' && line.pack_size_details?.units_of_units && (
                              <span className="text-xs text-gray-500 ml-1">
                                ({line.pack_size_details.units_of_units})
                              </span>
                            )}
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={movementType === 'Shipment' && line.pack_size_details?.uom_per_each 
                              ? line.qty_remaining * line.pack_size_details.uom_per_each 
                              : line.qty_remaining}
                            step="0.01"
                            value={movementType === 'Shipment' && line.pack_size_details?.uom_per_each 
                              ? line.qty_to_process * line.pack_size_details.uom_per_each 
                              : line.qty_to_process}
                            onChange={(e) => {
                              const inputValue = parseFloat(e.target.value) || 0
                              const qtyToProcess = movementType === 'Shipment' && line.pack_size_details?.uom_per_each
                                ? inputValue / line.pack_size_details.uom_per_each
                                : inputValue
                              handleQuantityChange(line.commercial_line_id, qtyToProcess)
                            }}
                            disabled={!selectedLines.has(line.commercial_line_id)}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent disabled:bg-gray-100"
                          />
                          
                          {/* Validation Messages for Shipments */}
                          {movementType === 'Shipment' && selectedLines.has(line.commercial_line_id) && (
                            <div className="mt-1 space-y-1">
                              {/* Partial shipment warning */}
                              {line.qty_to_process < line.qty_remaining && line.qty_to_process > 0 && (
                                <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-1">
                                  ⚠️ Partial shipment: {formatQuantityDisplay(line.qty_remaining - line.qty_to_process, line.pack_size_details)} will remain
                                </div>
                              )}
                              
                              {/* Volume divisibility warning */}
                              {line.pack_size_details?.uom_per_each && line.qty_to_process > 0 && (
                                (() => {
                                  const volumeToShip = line.qty_to_process * line.pack_size_details.uom_per_each
                                  const isNotDivisible = volumeToShip % line.pack_size_details.uom_per_each !== 0
                                  return isNotDivisible && (
                                    <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded p-1">
                                      ⚠️ Volume not divisible by pack size ({line.pack_size_details.uom_per_each} {line.pack_size_details.units_of_units}/EA)
                                    </div>
                                  )
                                })()
                              )}
                              
                              {/* Show EA equivalent for volume input */}
                              {line.pack_size_details?.uom_per_each && line.qty_to_process > 0 && (
                                <div className="text-xs text-gray-500">
                                  = {line.qty_to_process} EA
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() => {
                              handleLineSelection(line.commercial_line_id, true)
                              handleQuantityChange(line.commercial_line_id, line.qty_remaining)
                            }}
                            className="text-sm text-sharda-primary hover:text-sharda-secondary"
                          >
                            {movementType === 'Shipment' ? 'Ship All' : movementType === 'Receipt' ? 'Receive All' : 'Transfer All'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Form Actions */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate(backPath)}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || selectedLines.size === 0}
            className="inline-flex items-center px-4 py-2 bg-sharda-primary text-white rounded-lg hover:bg-sharda-secondary transition-colors disabled:opacity-50"
          >
            <Save className="h-4 w-4 mr-2" />
            {loading ? 'Creating...' : `Create ${title}`}
          </button>
        </div>
      </form>
    </div>
  )
}