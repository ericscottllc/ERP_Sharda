import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Save, X, Calendar, Building, User, FileText, ArrowLeft, Package, Plus, Trash2 } from 'lucide-react'
import { SearchableDropdown } from '../common/SearchableDropdown'
import { supabase } from '../../lib/supabase'
import { 
  useParties, 
  useWarehouses, 
  usePartyAddresses,
  useItems,
  useTerms
} from '../../hooks/useCommercialData'
import { 
  DocType, 
  CommercialHeader,
  CommercialLine,
  CreateCommercialLineRequest,
  CreateAddressRequest 
} from '../../types/database'

interface CommercialDocumentEditProps {
  docType: DocType
  title: string
  listPath: string
}

export function CommercialDocumentEdit({ docType, title, listPath }: CommercialDocumentEditProps) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  
  // Get filtered parties based on document type
  const partyFilter = docType === 'SO' ? { isCustomer: true } : 
                     docType === 'PO' ? { isVendor: true } : 
                     undefined
  const { parties } = useParties(partyFilter)
  const { warehouses } = useWarehouses()
  const { items } = useItems()
  const { terms } = useTerms()
  
  const [document, setDocument] = useState<CommercialHeader | null>(null)
  const [lines, setLines] = useState<CommercialLine[]>([])
  const [lineItems, setLineItems] = useState<CreateCommercialLineRequest[]>([])
  const [formData, setFormData] = useState({
    doc_no: '',
    terms_id: '',
    party_id: '',
    bill_to_address_id: '',
    ship_to_address_id: '',
    primary_warehouse_id: '',
    secondary_warehouse_id: '',
    order_date: '',
    requested_date: '',
    note: ''
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { addresses: partyAddresses } = usePartyAddresses(
    (docType !== 'TO' && formData.party_id) ? formData.party_id : null
  )

  useEffect(() => {
    if (id) {
      fetchDocument(id)
    }
  }, [id])

  const fetchDocument = async (documentId: string) => {
    try {
      setLoading(true)
      
      // Fetch document header
      const { data: headerData, error: headerError } = await supabase
        .from('commercial_hdr')
        .select('*')
        .eq('id', documentId)
        .eq('doc_type', docType)
        .single()

      if (headerError) throw headerError
      if (!headerData) throw new Error('Document not found')

      // Fetch document lines
      const { data: linesData, error: linesError } = await supabase
        .from('commercial_line')
        .select(`
          *,
          item:item_name (
            item_name,
            product_name,
            pack_size,
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
        `)
        .eq('hdr_id', documentId)
        .order('line_no')

      if (linesError) throw linesError

      setDocument(headerData)
      setLines(linesData || [])
      
      // Convert lines to editable format
      const editableLines: CreateCommercialLineRequest[] = (linesData || []).map(line => ({
        id: line.id,
        line_no: line.line_no,
        item_name: line.item_name,
        inventory_state: line.inventory_state,
        qty_ordered: parseFloat(line.qty_ordered),
        qty_ordered_uom: line.item?.pack_size_details?.uom_per_each 
          ? parseFloat(line.qty_ordered) * line.item.pack_size_details.uom_per_each
          : parseFloat(line.qty_ordered),
        requested_date: line.requested_date || '',
        promise_date: line.promise_date || '',
        cancel_after: line.cancel_after || '',
        lot_number: line.lot_number || '',
        warehouse_id: line.warehouse_id || '',
        secondary_warehouse_id: line.secondary_warehouse_id || '',
        pack_size_details: line.item?.pack_size_details
      }))
      
      setLineItems(editableLines)
      
      setFormData({
        doc_no: headerData.doc_no || '',
        terms_id: headerData.terms_id || '',
        party_id: headerData.party_id || '',
        bill_to_address_id: headerData.bill_to_address_id || '',
        ship_to_address_id: headerData.ship_to_address_id || '',
        primary_warehouse_id: headerData.primary_warehouse_id || '',
        secondary_warehouse_id: headerData.secondary_warehouse_id || '',
        order_date: headerData.order_date || '',
        requested_date: headerData.requested_date || '',
        note: headerData.note || ''
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value || ''
    }))
    
    // Update line items when primary warehouse changes
    if (field === 'primary_warehouse_id') {
      setLineItems(prev => prev.map(line => ({
        ...line,
        warehouse_id: value || line.warehouse_id
      })))
    }
    
    // Update line item dates when requested date changes
    if (field === 'requested_date') {
      const requestedDate = value
      const promiseDate = value ? (() => {
        const date = new Date(value)
        date.setDate(date.getDate() + 2)
        return date.toISOString().split('T')[0]
      })() : ''
      
      setLineItems(prev => prev.map(line => ({
        ...line,
        requested_date: requestedDate,
        promise_date: promiseDate
      })))
    }
  }

  const handleAddLineItem = () => {
    const requestedDate = formData.requested_date || new Date().toISOString().split('T')[0]
    const promiseDate = formData.requested_date ? 
      (() => {
        const date = new Date(formData.requested_date)
        date.setDate(date.getDate() + 2)
        return date.toISOString().split('T')[0]
      })() : 
      new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const newItem: CreateCommercialLineRequest = {
      line_no: lineItems.length + 1,
      item_name: '',
      inventory_state: 'Stock',
      qty_ordered: 1,
      qty_ordered_uom: 1,
      requested_date: requestedDate,
      promise_date: promiseDate,
      cancel_after: '',
      lot_number: '',
      warehouse_id: formData.primary_warehouse_id,
      secondary_warehouse_id: '',
      pack_size_details: undefined,
      warning: undefined
    }
    setLineItems([...lineItems, newItem])
  }

  const handleLineItemChange = (index: number, field: keyof CreateCommercialLineRequest, value: string | number) => {
    const updatedLineItems = [...lineItems]
    
    if (field === 'item_name') {
      // Find the selected item with pack size details
      const selectedItem = items.find(item => item.item_name === value)
      updatedLineItems[index] = {
        ...updatedLineItems[index],
        item_name: value as string,
        pack_size_details: selectedItem?.pack_size_details,
        warning: undefined
      }
    } else if (field === 'qty_ordered_uom') {
      const qtyUom = value as number
      const packSizeDetails = updatedLineItems[index].pack_size_details
      
      updatedLineItems[index] = {
        ...updatedLineItems[index],
        qty_ordered_uom: qtyUom
      }
      
      if (packSizeDetails?.uom_per_each) {
        const qtyEaches = qtyUom / packSizeDetails.uom_per_each
        updatedLineItems[index].qty_ordered = qtyEaches
        
        if (qtyUom % packSizeDetails.uom_per_each !== 0) {
          updatedLineItems[index].warning = `Warning: ${qtyUom} ${packSizeDetails.units_of_units || 'units'} is not divisible by ${packSizeDetails.uom_per_each}.`
        } else {
          updatedLineItems[index].warning = undefined
        }
      } else {
        updatedLineItems[index].qty_ordered = qtyUom
        updatedLineItems[index].warning = undefined
      }
    } else {
      updatedLineItems[index] = {
        ...updatedLineItems[index],
        [field]: value
      }
    }
    
    setLineItems(updatedLineItems)
  }

  const handleDeleteLineItem = (index: number) => {
    if (lineItems.length === 1) {
      // Reset the line instead of deleting
      setLineItems([{
        line_no: 1,
        item_name: '',
        inventory_state: 'Stock',
        qty_ordered: 1,
        qty_ordered_uom: 1,
        requested_date: formData.requested_date || new Date().toISOString().split('T')[0],
        promise_date: formData.requested_date ? 
          (() => {
            const date = new Date(formData.requested_date)
            date.setDate(date.getDate() + 2)
            return date.toISOString().split('T')[0]
          })() : 
          new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        cancel_after: '',
        lot_number: '',
        warehouse_id: formData.primary_warehouse_id,
        secondary_warehouse_id: '',
        pack_size_details: undefined,
        warning: undefined
      }])
    } else {
      const updatedLineItems = lineItems.filter((_, i) => i !== index)
      // Renumber line items
      const renumberedItems = updatedLineItems.map((item, i) => ({
        ...item,
        line_no: i + 1
      }))
      setLineItems(renumberedItems)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!document) return

    setSaving(true)
    setError(null)

    try {
      // Prepare the data for update
      const updateData: any = {
        doc_no: formData.doc_no.trim() || null,
        terms_id: formData.terms_id || null,
        customer_ref: formData.customer_ref.trim() || null,
        party_id: (docType !== 'TO' && formData.party_id) ? formData.party_id : null,
        bill_to_address_id: formData.bill_to_address_id || null,
        ship_to_address_id: formData.ship_to_address_id || null,
        primary_warehouse_id: formData.primary_warehouse_id,
        secondary_warehouse_id: formData.secondary_warehouse_id || null,
        order_date: formData.order_date,
        requested_date: formData.requested_date || null,
        note: formData.note.trim() || null,
        updated_at: new Date().toISOString()
      }

      const { error: updateError } = await supabase
        .from('commercial_hdr')
        .update(updateData)
        .eq('id', document.id)

      if (updateError) throw updateError

      // Update line items
      const validLineItems = lineItems.filter(item => item.item_name && item.qty_ordered > 0)
      
      // Delete existing lines that are not in the current list
      const existingLineIds = lines.map(line => line.id)
      const currentLineIds = validLineItems.map(item => item.id).filter(Boolean)
      const linesToDelete = existingLineIds.filter(id => !currentLineIds.includes(id))
      
      if (linesToDelete.length > 0) {
        const { error: deleteError } = await supabase
          .from('commercial_line')
          .delete()
          .in('id', linesToDelete)
        
        if (deleteError) throw deleteError
      }
      
      // Update or insert line items
      for (const item of validLineItems) {
        const lineData = {
          hdr_id: document.id,
          line_no: item.line_no,
          item_name: item.item_name,
          qty_ordered: item.qty_ordered,
          requested_date: item.requested_date || null,
          promise_date: item.promise_date || null,
          cancel_after: item.cancel_after || null,
          lot_number: item.lot_number || null,
          inventory_state: item.inventory_state,
          status: 'Open',
          warehouse_id: item.warehouse_id || formData.primary_warehouse_id,
          secondary_warehouse_id: item.secondary_warehouse_id || null,
          updated_at: new Date().toISOString()
        }
        
        if (item.id) {
          // Update existing line
          const { error: lineError } = await supabase
            .from('commercial_line')
            .update(lineData)
            .eq('id', item.id)
          
          if (lineError) throw lineError
        } else {
          // Insert new line
          const { error: lineError } = await supabase
            .from('commercial_line')
            .insert([lineData])
          
          if (lineError) throw lineError
        }
      }

      // Navigate back to the detail page
      navigate(`${listPath}/${document.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while updating the document')
    } finally {
      setSaving(false)
    }
  }

  const getDocumentTypeLabel = (docType: DocType): string => {
    switch (docType) {
      case 'SO': return 'Sales Order'
      case 'PO': return 'Purchase Order'
      case 'TO': return 'Transfer Order'
      default: return 'Document'
    }
  }

  const getPartyLabel = (docType: DocType): string => {
    switch (docType) {
      case 'SO': return 'Customer'
      case 'PO': return 'Vendor'
      case 'TO': return 'Party (Optional)'
      default: return 'Party'
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

  if (error && !document) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
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

  if (!document) {
    return null
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate(`${listPath}/${document.id}`)}
              className="inline-flex items-center text-gray-600 hover:text-sharda-primary transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Document
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Edit {getDocumentTypeLabel(docType)}</h1>
              <p className="text-gray-600 mt-1">
                {document.doc_no}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(`${listPath}/${document.id}`)}
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
            <FileText className="h-5 w-5 mr-2" />
            Document Details
          </h3>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Document Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Document Number
              </label>
              <input
                type="text"
                value={formData.doc_no}
                onChange={(e) => handleInputChange('doc_no', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                placeholder={`Enter ${getDocumentTypeLabel(docType).toLowerCase()} number`}
              />
            </div>

            {/* Party Selection - only for SO and PO */}
            {docType !== 'TO' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {getPartyLabel(docType)} *
                </label>
                <SearchableDropdown
                  options={parties.map(party => ({ id: party.id, name: party.display_name }))}
                  value={formData.party_id}
                  onChange={(value) => handleInputChange('party_id', value)}
                  placeholder={`Search for ${getPartyLabel(docType).toLowerCase()}...`}
                  required
                />
              </div>
            )}

            {/* Order Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="h-4 w-4 inline mr-1" />
                Order Date *
              </label>
              <input
                type="date"
                value={formData.order_date}
                onChange={(e) => handleInputChange('order_date', e.target.value)}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
              />
            </div>

            {/* Requested Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="h-4 w-4 inline mr-1" />
                Requested Date
              </label>
              <input
                type="date"
                value={formData.requested_date}
                onChange={(e) => handleInputChange('requested_date', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
              />
            </div>

            {/* Payment Terms */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Terms
              </label>
              <SearchableDropdown
                options={terms.map(term => ({ id: term.id, name: term.name }))}
                value={formData.terms_id}
                onChange={(value) => handleInputChange('terms_id', value)}
                placeholder="Search for payment terms..."
              />
            </div>
          </div>

          {/* Addresses - only for SO */}
          {docType === 'SO' && formData.party_id && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ship To Address
                </label>
                <select
                  value={formData.ship_to_address_id}
                  onChange={(e) => handleInputChange('ship_to_address_id', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                >
                  <option value="">Select ship to address</option>
                  {partyAddresses.filter(pa => pa.use === 'ship_to').map((pa) => (
                    <option key={pa.address_id} value={pa.address_id}>
                      {pa.address.line1}, {pa.address.city}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bill To Address
                </label>
                <select
                  value={formData.bill_to_address_id}
                  onChange={(e) => handleInputChange('bill_to_address_id', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                >
                  <option value="">Select bill to address</option>
                  {partyAddresses.filter(pa => pa.use === 'bill_to').map((pa) => (
                    <option key={pa.address_id} value={pa.address_id}>
                      {pa.address.line1}, {pa.address.city}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Warehouse Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Primary Warehouse */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Building className="h-4 w-4 inline mr-1" />
                {docType === 'SO' ? 'Ship From Warehouse' : docType === 'PO' ? 'Receive Into Warehouse' : 'From Warehouse'} *
              </label>
              <SearchableDropdown
                options={warehouses.map(wh => ({ id: wh.id, name: `${wh.name} (${wh.code})` }))}
                value={formData.primary_warehouse_id}
                onChange={(value) => handleInputChange('primary_warehouse_id', value)}
                placeholder="Search for warehouse..."
                required
              />
            </div>

            {/* Secondary Warehouse - only for TO */}
            {docType === 'TO' && (
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
                  onChange={(value) => handleInputChange('secondary_warehouse_id', value)}
                  placeholder="Search for destination warehouse..."
                />
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.note}
              onChange={(e) => handleInputChange('note', e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
              placeholder="Add any additional notes or comments..."
            />
          </div>

          {/* Line Items Section */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-lg font-semibold text-gray-900">Line Items</h4>
              <button
                type="button"
                onClick={handleAddLineItem}
                className="inline-flex items-center px-3 py-2 bg-sharda-primary text-white rounded-md hover:bg-sharda-secondary transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Line Item
              </button>
            </div>

            <div className="space-y-4">
              {lineItems.map((item, index) => (
                <div key={item.id || index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h5 className="font-medium text-gray-900">Line {item.line_no}</h5>
                    <button
                      type="button"
                      onClick={() => handleDeleteLineItem(index)}
                      className="text-red-600 hover:text-red-800"
                      disabled={lineItems.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Item *
                      </label>
                      <SearchableDropdown
                        options={items.map(item => ({ id: item.item_name, name: item.item_name }))}
                        value={item.item_name}
                        onChange={(value) => handleLineItemChange(index, 'item_name', value)}
                        placeholder="Search for item..."
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Volume {item.pack_size_details?.units_of_units ? `(${item.pack_size_details.units_of_units})` : '(EA)'} *
                      </label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={item.qty_ordered_uom || 1}
                        onChange={(e) => handleLineItemChange(index, 'qty_ordered_uom', parseFloat(e.target.value) || 0)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                      />
                      
                      {/* Show calculated quantity in eaches */}
                      {item.pack_size_details?.uom_per_each && (
                        <div className="text-xs text-gray-600">
                          = {item.qty_ordered} EA (Quantity)
                        </div>
                      )}
                      
                      {/* Warning Message */}
                      {item.warning && (
                        <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded p-2 mt-1">
                          {item.warning}
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Inventory State *
                      </label>
                      <select
                        value={item.inventory_state}
                        onChange={(e) => handleLineItemChange(index, 'inventory_state', e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                      >
                        <option value="Stock">Stock</option>
                        <option value="Consignment">Consignment</option>
                        <option value="Hold">Hold</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Requested Date
                      </label>
                      <input
                        type="date"
                        value={item.requested_date}
                        onChange={(e) => handleLineItemChange(index, 'requested_date', e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Promise Date
                      </label>
                      <input
                        type="date"
                        value={item.promise_date}
                        onChange={(e) => handleLineItemChange(index, 'promise_date', e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cancel After
                      </label>
                      <input
                        type="date"
                        value={item.cancel_after}
                        onChange={(e) => handleLineItemChange(index, 'cancel_after', e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Lot Number
                      </label>
                      <input
                        type="text"
                        value={item.lot_number}
                        onChange={(e) => handleLineItemChange(index, 'lot_number', e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                        placeholder="Optional lot number"
                      />
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
            onClick={() => navigate(`${listPath}/${document.id}`)}
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