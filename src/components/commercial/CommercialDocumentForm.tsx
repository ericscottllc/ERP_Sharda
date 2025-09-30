import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save, X, Calendar, Building, User, FileText, Trash2, CreditCard as Edit, Package } from 'lucide-react'
import { SearchableDropdown } from '../common/SearchableDropdown'
import { supabase } from '../../lib/supabase'
import { 
  useParties, 
  useWarehouses, 
  usePartyAddresses, 
  useItems,
  useTerms,
  createAddressAndPartyLink 
} from '../../hooks/useCommercialData'
import { 
  DocType, 
  CreateCommercialHeaderRequest, 
  CreateCommercialLineRequest,
  CreateAddressRequest 
} from '../../types/database'

// Helper function to get date string (YYYY-MM-DD format)
const getDateString = (daysFromNow: number = 0): string => {
  const date = new Date()
  date.setDate(date.getDate() + daysFromNow)
  return date.toISOString().split('T')[0]
}

interface CommercialDocumentFormProps {
  docType: DocType
  title: string
  backPath: string
}

export function CommercialDocumentForm({ docType, title, backPath }: CommercialDocumentFormProps) {
  const navigate = useNavigate()
  
  // Get filtered parties based on document type
  const partyFilter = docType === 'SO' ? { isCustomer: true } : 
                     docType === 'PO' ? { isVendor: true } : 
                     undefined
  const { parties } = useParties(partyFilter)
  const { warehouses } = useWarehouses()
  const { items } = useItems()
  const { terms } = useTerms()
  
  const [formData, setFormData] = useState<CreateCommercialHeaderRequest>({
    doc_type: docType,
    doc_no: '',
    default_inventory_state: 'Stock',
    terms_id: '',
    customer_ref: '',
    party_id: docType === 'TO' ? undefined : '',
    bill_to_address_id: '',
    ship_to_address_id: '',
    primary_warehouse_id: '',
    secondary_warehouse_id: '',
    order_date: new Date().toISOString().split('T')[0],
    requested_date: getDateString(2), // Default to today + 2
    note: ''
  })

  const [lineItems, setLineItems] = useState<CreateCommercialLineRequest[]>([
    {
      line_no: 1,
      item_name: '',
      inventory_state: 'Stock',
      qty_ordered: 1,
      qty_ordered_uom: 1,
      requested_date: getDateString(2), // Default to today + 2
      promise_date: getDateString(2), // Default to today + 2
      cancel_after: '',
      lot_number: '',
      warehouse_id: '',
      secondary_warehouse_id: '',
      pack_size_details: undefined,
      warning: undefined
    }
  ])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [newAddress, setNewAddress] = useState<CreateAddressRequest>({
    line1: '',
    line2: '',
    city: '',
    region: '',
    postal_code: '',
    country: 'US'
  })
  const [shipToAddress, setShipToAddress] = useState<CreateAddressRequest>({
    line1: '',
    line2: '',
    city: '',
    region: '',
    postal_code: '',
    country: 'US'
  })

  const { addresses: partyAddresses } = usePartyAddresses(
    (docType !== 'TO' && formData.party_id) ? formData.party_id : null
  )

  // Auto-populate line item dates when header requested date changes
  useEffect(() => {
    if (formData.requested_date) {
      const requestedDate = new Date(formData.requested_date)
      const promiseDate = new Date(requestedDate)
      promiseDate.setDate(promiseDate.getDate() + 2)
      
      setLineItems(prevItems => 
        prevItems.map(item => ({
          ...item,
          requested_date: formData.requested_date,
          promise_date: promiseDate.toISOString().split('T')[0]
        }))
      )
    }
  }, [formData.requested_date])

  // Auto-populate line item inventory state when header default changes
  useEffect(() => {
    setLineItems(prevItems => 
      prevItems.map(item => ({
        ...item,
        inventory_state: formData.default_inventory_state
      }))
    )
  }, [formData.default_inventory_state])

  // Update ship-to address form when selection changes
  useEffect(() => {
    if (formData.ship_to_address_id && partyAddresses.length > 0) {
      const selectedAddress = partyAddresses.find(pa => pa.address_id === formData.ship_to_address_id)
      if (selectedAddress) {
        setShipToAddress({
          line1: selectedAddress.address.line1,
          line2: selectedAddress.address.line2 || '',
          city: selectedAddress.address.city,
          region: selectedAddress.address.region || '',
          postal_code: selectedAddress.address.postal_code || '',
          country: selectedAddress.address.country
        })
      }
    } else {
      // Clear form if no address selected
      setShipToAddress({
        line1: '',
        line2: '',
        city: '',
        region: '',
        postal_code: '',
        country: 'US'
      })
    }
  }, [formData.ship_to_address_id, partyAddresses])

  const handleInputChange = (field: keyof CreateCommercialHeaderRequest, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value || undefined
    }))
  }

  const handleAddLineItem = () => {
    const requestedDate = formData.requested_date || getDateString(2)
    const promiseDate = formData.requested_date ? 
      (() => {
        const date = new Date(formData.requested_date)
        date.setDate(date.getDate() + 2)
        return date.toISOString().split('T')[0]
      })() : 
      getDateString(2)

    const newItem: CreateCommercialLineRequest = {
      line_no: lineItems.length + 1,
      item_name: '',
      inventory_state: formData.default_inventory_state,
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
        warning: undefined // Clear any previous warnings
      }
    } else if (field === 'qty_ordered_uom') {
      const qtyUom = value as number
      const packSizeDetails = updatedLineItems[index].pack_size_details
      
      updatedLineItems[index] = {
        ...updatedLineItems[index],
        qty_ordered_uom: qtyUom
      }
      
      if (packSizeDetails?.uom_per_each) {
        // Calculate qty_ordered in eaches
        const qtyEaches = qtyUom / packSizeDetails.uom_per_each
        updatedLineItems[index].qty_ordered = qtyEaches
        
        // Check if quantity is divisible by uom_per_each
        if (qtyUom % packSizeDetails.uom_per_each !== 0) {
          updatedLineItems[index].warning = `Warning: ${qtyUom} ${packSizeDetails.units_of_units || 'units'} (Volume) is not divisible by ${packSizeDetails.uom_per_each} ${packSizeDetails.units_of_units || 'units'} per EA. Consider using ${Math.ceil(qtyEaches) * packSizeDetails.uom_per_each} ${packSizeDetails.units_of_units || 'units'} instead.`
        } else {
          updatedLineItems[index].warning = undefined
        }
      } else {
        // Fallback if no pack size details
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

  const handleQuickQuantity = (index: number, quantity: number) => {
    handleLineItemChange(index, 'qty_ordered_uom', quantity)
  }

  const handleIncrementQuantity = (index: number, increment: number) => {
    const currentQuantity = lineItems[index].qty_ordered_uom || 0
    const newQuantity = Math.max(0, currentQuantity + increment) // Prevent negative quantities
    handleLineItemChange(index, 'qty_ordered_uom', newQuantity)
  }

  const handleDeleteLineItem = (index: number) => {
    if (lineItems.length === 1) {
      // Don't allow deleting the last line item, just reset it
      setLineItems([{
        line_no: 1,
        item_name: '',
        inventory_state: formData.default_inventory_state,
        qty_ordered: 1,
        qty_ordered_uom: 1,
        requested_date: formData.requested_date || getDateString(2),
        promise_date: formData.requested_date ? 
          (() => {
            const date = new Date(formData.requested_date)
            date.setDate(date.getDate() + 2)
            return date.toISOString().split('T')[0]
          })() : 
          getDateString(2),
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

  const handleShipToAddressChange = (field: keyof CreateAddressRequest, value: string) => {
    setShipToAddress(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleCreateAddress = async () => {
    if (!formData.party_id || !shipToAddress.line1.trim() || !shipToAddress.city.trim() || !shipToAddress.country) {
      return
    }

    try {
      setLoading(true)
      const addressId = await createAddressAndPartyLink(
        formData.party_id,
        shipToAddress,
        'ship_to',
        false
      )
      
      // Update form data with new address
      setFormData(prev => ({
        ...prev,
        ship_to_address_id: addressId
      }))

      setShowAddressModal(false)
      
      // Reset the new address form
      setNewAddress({
        line1: '',
        line2: '',
        city: '',
        region: '',
        postal_code: '',
        country: 'US'
      })
    } catch (err) {
      console.error('Error creating address:', err)
      setError('Failed to create address. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      // Handle ship-to address creation for SO if address data is provided
      let shipToAddressId = formData.ship_to_address_id
      if (docType === 'SO' && formData.party_id && !shipToAddressId && 
          shipToAddress.line1.trim() && shipToAddress.city.trim() && shipToAddress.country) {
        try {
          shipToAddressId = await createAddressAndPartyLink(
            formData.party_id,
            shipToAddress,
            'ship_to',
            false
          )
        } catch (addressError) {
          console.error('Error creating ship-to address:', addressError)
          throw new Error('Failed to create ship-to address. Please try again.')
        }
      }

      // Prepare the data for insertion
      const insertData: any = {
        doc_type: formData.doc_type,
        primary_warehouse_id: formData.primary_warehouse_id,
        order_date: formData.order_date,
        status: getInitialStatus(docType)
      }

      // Only include non-empty optional fields
      if (formData.doc_no?.trim()) insertData.doc_no = formData.doc_no.trim()
      insertData.default_inventory_state = formData.default_inventory_state
      if (formData.terms_id) insertData.terms_id = formData.terms_id
      if (formData.customer_ref?.trim()) insertData.customer_ref = formData.customer_ref.trim()
      if (docType !== 'TO' && formData.party_id) insertData.party_id = formData.party_id
      if (formData.bill_to_address_id) insertData.bill_to_address_id = formData.bill_to_address_id
      if (shipToAddressId) insertData.ship_to_address_id = shipToAddressId
      if (formData.secondary_warehouse_id) insertData.secondary_warehouse_id = formData.secondary_warehouse_id
      if (formData.requested_date) insertData.requested_date = formData.requested_date
      if (formData.note?.trim()) insertData.note = formData.note.trim()

      // Insert header
      const { data: headerData, error: headerError } = await supabase
        .from('commercial_hdr')
        .insert([insertData])
        .select()
        .single()

      if (headerError) throw headerError
      if (!headerData) throw new Error('Failed to create header')

      // Insert line items if any
      if (lineItems.length > 0 && lineItems.some(item => item.item_name)) {
        const validLineItems = lineItems.filter(item => item.item_name && item.qty_ordered > 0)
        const lineItemsData = validLineItems.map(item => ({
          hdr_id: headerData.id,
          line_no: item.line_no,
          item_name: item.item_name,
          qty_ordered: item.qty_ordered,
          requested_date: item.requested_date || null,
          promise_date: item.promise_date || null,
          cancel_after: item.cancel_after || null,
          lot_number: item.lot_number || null,
          inventory_state: item.inventory_state,
          inventory_state: item.inventory_state,
          status: getInitialLineStatus(docType),
          warehouse_id: item.warehouse_id || formData.primary_warehouse_id,
          secondary_warehouse_id: item.secondary_warehouse_id || null
        }))

        const { error: linesError } = await supabase
          .from('commercial_line')
          .insert(lineItemsData)

        if (linesError) throw linesError
      }
      // Navigate to the detail page or back to list
      navigate(backPath)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while creating the document')
    } finally {
      setLoading(false)
    }
  }

  const getInitialLineStatus = (docType: DocType): string => {
    switch (docType) {
      case 'SO': return 'Open'
      case 'PO': return 'Open'
      case 'TO': return 'Open'
      default: return 'Open'
    }
  }

  const getInitialStatus = (docType: DocType): string => {
    switch (docType) {
      case 'SO': return 'Pending Shipment'
      case 'PO': return 'Pending Receipt'
      case 'TO': return 'Open'
      default: return 'Draft'
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

  const billToAddresses = partyAddresses.filter(pa => pa.use === 'bill_to')
  const shipToAddresses = partyAddresses.filter(pa => pa.use === 'ship_to')

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create New {title.slice(0, -1)}</h1>
            <p className="text-gray-600 mt-1">
              Fill in the details below to create a new {getDocumentTypeLabel(docType).toLowerCase()}
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
            {/* Document Number - now available for all document types */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Document Number
              </label>
              <input
                type="text"
                value={formData.doc_no}
                onChange={(e) => handleInputChange('doc_no', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                placeholder={`Enter ${getDocumentTypeLabel(docType).toLowerCase()} number (optional - system will assign if blank)`}
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

            {/* Default Inventory State */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Package className="h-4 w-4 inline mr-1" />
                Default Inventory State *
              </label>
              <select
                value={formData.default_inventory_state}
                onChange={(e) => handleInputChange('default_inventory_state', e.target.value)}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
              >
                <option value="Stock">Stock - Regular inventory owned by company</option>
                <option value="Consignment">Consignment - Inventory owned by vendor/customer</option>
                <option value="Hold">Hold - Inventory on hold, not available for use</option>
              </select>
              <p className="mt-1 text-sm text-gray-500">
                This will be applied to all line items by default
              </p>
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

            {/* Customer Reference - only for SO */}
            {docType === 'SO' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Reference
                </label>
                <input
                  type="text"
                  value={formData.customer_ref}
                  onChange={(e) => handleInputChange('customer_ref', e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                  placeholder="Customer PO number or reference"
                />
              </div>
            )}
          </div>

          {/* Ship To Address Section - only for SO */}
          {docType === 'SO' && formData.party_id && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-gray-900">Ship To Address</h4>
                <div className="flex space-x-2">
                  <select
                    value={formData.ship_to_address_id}
                    onChange={(e) => handleInputChange('ship_to_address_id', e.target.value)}
                    className="border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                  >
                    <option value="">Select existing address</option>
                    {partyAddresses.filter(pa => pa.use === 'ship_to').map((pa) => (
                      <option key={pa.address_id} value={pa.address_id}>
                        {pa.address.line1}, {pa.address.city}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowAddressModal(true)}
                    className="px-3 py-2 bg-sharda-primary text-white rounded-md hover:bg-sharda-secondary transition-colors"
                  >
                    + New Address
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address Line 1 *
                  </label>
                  <input
                    type="text"
                    value={shipToAddress.line1}
                    onChange={(e) => handleShipToAddressChange('line1', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                    placeholder="Street address"
                    required={docType === 'SO'}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address Line 2
                  </label>
                  <input
                    type="text"
                    value={shipToAddress.line2}
                    onChange={(e) => handleShipToAddressChange('line2', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                    placeholder="Apartment, suite, etc."
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    value={shipToAddress.city}
                    onChange={(e) => handleShipToAddressChange('city', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                    required={docType === 'SO'}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State/Region
                  </label>
                  <input
                    type="text"
                    value={shipToAddress.region}
                    onChange={(e) => handleShipToAddressChange('region', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Postal Code
                  </label>
                  <input
                    type="text"
                    value={shipToAddress.postal_code}
                    onChange={(e) => handleShipToAddressChange('postal_code', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country *
                  </label>
                  <select
                    value={shipToAddress.country}
                    onChange={(e) => handleShipToAddressChange('country', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                    required={docType === 'SO'}
                  >
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="MX">Mexico</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Bill To Address - only for SO and optional */}
          {docType === 'SO' && formData.party_id && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bill To Address (Optional)
              </label>
              <select
                value={formData.bill_to_address_id}
                onChange={(e) => handleInputChange('bill_to_address_id', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
              >
                <option value="">Select billing address</option>
                {partyAddresses.filter(pa => pa.use === 'bill_to').map((pa) => (
                  <option key={pa.address_id} value={pa.address_id}>
                    {pa.address.line1}, {pa.address.city}
                  </option>
                ))}
              </select>
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
                + Add Line Item
              </button>
            </div>

            <div className="space-y-4">
              {lineItems.map((item, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
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
                      <div className="space-y-2">
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
                        
                        {/* Quick Quantity Buttons */}
                        {item.pack_size_details && (
                          <div className="space-y-2">
                            <div className="text-xs font-medium text-gray-600">Quick Volume Add/Subtract:</div>
                            <div className="flex flex-wrap gap-1">
                            {item.pack_size_details.uom_per_each && (
                              <div className="flex items-center space-x-1">
                                <button
                                  type="button"
                                  onClick={() => handleIncrementQuantity(index, -item.pack_size_details!.uom_per_each!)}
                                  className="px-1 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                                  title={`Subtract ${item.pack_size_details.uom_per_each} ${item.pack_size_details.units_of_units}`}
                                >
                                  -
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleQuickQuantity(index, item.pack_size_details!.uom_per_each!)}
                                  className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                                >
                                  1 EA ({item.pack_size_details.uom_per_each} {item.pack_size_details.units_of_units})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleIncrementQuantity(index, item.pack_size_details!.uom_per_each!)}
                                  className="px-1 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                                  title={`Add ${item.pack_size_details.uom_per_each} ${item.pack_size_details.units_of_units}`}
                                >
                                  +
                                </button>
                              </div>
                            )}
                            {item.pack_size_details.eaches_per_pallet && item.pack_size_details.uom_per_each && (
                              <div className="flex items-center space-x-1">
                                <button
                                  type="button"
                                  onClick={() => handleIncrementQuantity(index, -(item.pack_size_details!.eaches_per_pallet! * item.pack_size_details!.uom_per_each!))}
                                  className="px-1 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                                  title={`Subtract ${item.pack_size_details.eaches_per_pallet * item.pack_size_details.uom_per_each} ${item.pack_size_details.units_of_units}`}
                                >
                                  -
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleQuickQuantity(index, item.pack_size_details!.eaches_per_pallet! * item.pack_size_details!.uom_per_each!)}
                                  className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                                >
                                  1 Pallet ({item.pack_size_details.eaches_per_pallet} EA = {item.pack_size_details.eaches_per_pallet * item.pack_size_details.uom_per_each} {item.pack_size_details.units_of_units})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleIncrementQuantity(index, item.pack_size_details!.eaches_per_pallet! * item.pack_size_details!.uom_per_each!)}
                                  className="px-1 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                                  title={`Add ${item.pack_size_details.eaches_per_pallet * item.pack_size_details.uom_per_each} ${item.pack_size_details.units_of_units}`}
                                >
                                  +
                                </button>
                              </div>
                            )}
                            {item.pack_size_details.eaches_per_tl && item.pack_size_details.uom_per_each && (
                              <div className="flex items-center space-x-1">
                                <button
                                  type="button"
                                  onClick={() => handleIncrementQuantity(index, -(item.pack_size_details!.eaches_per_tl! * item.pack_size_details!.uom_per_each!))}
                                  className="px-1 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                                  title={`Subtract ${item.pack_size_details.eaches_per_tl * item.pack_size_details.uom_per_each} ${item.pack_size_details.units_of_units}`}
                                >
                                  -
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleQuickQuantity(index, item.pack_size_details!.eaches_per_tl! * item.pack_size_details!.uom_per_each!)}
                                  className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200 transition-colors"
                                >
                                  1 TL ({item.pack_size_details.eaches_per_tl} EA = {item.pack_size_details.eaches_per_tl * item.pack_size_details.uom_per_each} {item.pack_size_details.units_of_units})
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleIncrementQuantity(index, item.pack_size_details!.eaches_per_tl! * item.pack_size_details!.uom_per_each!)}
                                  className="px-1 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                                  title={`Add ${item.pack_size_details.eaches_per_tl * item.pack_size_details.uom_per_each} ${item.pack_size_details.units_of_units}`}
                                >
                                  +
                                </button>
                              </div>
                            )}
                            </div>
                          </div>
                        )}
                        
                        {/* Warning Message */}
                        {item.warning && (
                          <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
                            {item.warning}
                          </div>
                        )}
                      </div>
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
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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
            onClick={() => navigate(backPath)}
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
            {loading ? 'Creating...' : `Create ${getDocumentTypeLabel(docType)}`}
          </button>
        </div>
      </form>

      {/* Add Address Modal */}
      {showAddressModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Ship To Address</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address Line 1 *
                </label>
                <input
                  type="text"
                  value={newAddress.line1}
                  onChange={(e) => setNewAddress(prev => ({ ...prev, line1: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                  placeholder="Street address"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address Line 2
                </label>
                <input
                  type="text"
                  value={newAddress.line2}
                  onChange={(e) => setNewAddress(prev => ({ ...prev, line2: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                  placeholder="Apartment, suite, etc."
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    value={newAddress.city}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, city: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    State/Region
                  </label>
                  <input
                    type="text"
                    value={newAddress.region}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, region: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Postal Code
                  </label>
                  <input
                    type="text"
                    value={newAddress.postal_code}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, postal_code: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Country *
                  </label>
                  <select
                    value={newAddress.country}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, country: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                  >
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                    <option value="MX">Mexico</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                onClick={() => setShowAddressModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateAddress}
                disabled={loading || !newAddress.line1.trim() || !newAddress.city.trim() || !newAddress.country}
                className="px-4 py-2 bg-sharda-primary text-white rounded-md hover:bg-sharda-secondary transition-colors disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Address'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}