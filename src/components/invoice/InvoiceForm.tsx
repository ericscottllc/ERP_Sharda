import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Save, X, Calendar, FileText, Upload, DollarSign, AlertCircle, ArrowLeft } from 'lucide-react'
import { SearchableDropdown } from '../common/SearchableDropdown'
import { supabase } from '../../lib/supabase'
import { useTerms } from '../../hooks/useCommercialData'
import { CommercialHeader, CommercialLine } from '../../types/database'

interface InvoiceLineData {
  id?: string
  so_line_id: string
  line_no: number
  item_name: string
  qty_invoiced: number
  uom: string
  price: number | null
  pack_size_details?: any
}

interface InvoiceFormProps {
  mode: 'create' | 'edit'
  invoiceId?: string | null
  soHdrId?: string | null
  shipmentHdrId?: string | null
}

export function InvoiceForm({ mode, invoiceId, soHdrId, shipmentHdrId }: InvoiceFormProps) {
  const navigate = useNavigate()
  const { terms } = useTerms()

  const [salesOrder, setSalesOrder] = useState<CommercialHeader | null>(null)
  const [formData, setFormData] = useState({
    invoice_no: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    terms_id: '',
    status: 'Draft' as 'Draft' | 'Issued' | 'Paid' | 'Canceled',
    note: '',
    shipment_hdr_id: shipmentHdrId || ''
  })
  const [invoiceLines, setInvoiceLines] = useState<InvoiceLineData[]>([])
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [existingPdfUrl, setExistingPdfUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (mode === 'create' && soHdrId) {
      fetchSalesOrder(soHdrId)
    } else if (mode === 'edit' && invoiceId) {
      fetchInvoice(invoiceId)
    }
  }, [mode, soHdrId, invoiceId])

  const fetchSalesOrder = async (soHdrId: string) => {
    try {
      setLoading(true)

      const { data: headerData, error: headerError } = await supabase
        .from('commercial_hdr')
        .select(`
          *,
          party:party_id (
            display_name,
            email,
            phone
          ),
          primary_warehouse:primary_warehouse_id (
            name,
            code
          ),
          terms:terms_id (
            id,
            name,
            description
          )
        `)
        .eq('id', soHdrId)
        .eq('doc_type', 'SO')
        .maybeSingle()

      if (headerError) throw headerError
      if (!headerData) throw new Error('Sales order not found')

      const { data: linesData, error: linesError } = await supabase
        .from('commercial_line')
        .select(`
          *,
          item:item_name (
            item_name,
            product_name,
            pack_size_details:pack_size (
              pack_size,
              units_per_each,
              volume_per_unit,
              units_of_units,
              package_type,
              uom_per_each
            )
          )
        `)
        .eq('hdr_id', soHdrId)
        .order('line_no')

      if (linesError) throw linesError

      setSalesOrder(headerData)

      setFormData(prev => ({
        ...prev,
        terms_id: headerData.terms_id || '',
        due_date: headerData.terms_id ? calculateDueDate(headerData.terms?.name) : ''
      }))

      const initialInvoiceLines: InvoiceLineData[] = (linesData || []).map(line => ({
        so_line_id: line.id,
        line_no: line.line_no,
        item_name: line.item_name,
        qty_invoiced: parseFloat(line.qty_ordered),
        uom: 'EA',
        price: null,
        pack_size_details: line.item?.pack_size_details
      }))

      setInvoiceLines(initialInvoiceLines)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const fetchInvoice = async (invoiceId: string) => {
    try {
      setLoading(true)

      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoice_hdr')
        .select(`
          *,
          sales_order:so_hdr_id (
            id,
            doc_no,
            party:party_id (
              display_name,
              email,
              phone
            ),
            primary_warehouse:primary_warehouse_id (
              name,
              code
            ),
            terms:terms_id (
              id,
              name,
              description
            )
          )
        `)
        .eq('id', invoiceId)
        .maybeSingle()

      if (invoiceError) throw invoiceError
      if (!invoiceData) throw new Error('Invoice not found')

      const { data: linesData, error: linesError } = await supabase
        .from('invoice_line')
        .select(`
          *,
          item:item_name (
            item_name,
            product_name,
            pack_size_details:pack_size (
              pack_size,
              units_per_each,
              volume_per_unit,
              units_of_units,
              package_type,
              uom_per_each
            )
          )
        `)
        .eq('invoice_hdr_id', invoiceId)
        .order('line_no')

      if (linesError) throw linesError

      setSalesOrder(invoiceData.sales_order as any)
      setExistingPdfUrl(invoiceData.pdf_url)

      setFormData({
        invoice_no: invoiceData.invoice_no,
        invoice_date: invoiceData.invoice_date,
        due_date: invoiceData.due_date || '',
        terms_id: invoiceData.terms_id || '',
        status: invoiceData.status,
        note: invoiceData.note || '',
        shipment_hdr_id: invoiceData.shipment_hdr_id || ''
      })

      setInvoiceLines(linesData.map(line => ({
        id: line.id,
        so_line_id: line.so_line_id,
        line_no: line.line_no,
        item_name: line.item_name,
        qty_invoiced: line.qty_invoiced,
        uom: line.uom || 'EA',
        price: line.price,
        pack_size_details: line.item?.pack_size_details
      })))

    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const calculateDueDate = (termsName?: string): string => {
    if (!termsName) return ''

    const invoiceDate = new Date(formData.invoice_date)
    const netMatch = termsName.match(/Net (\d+)/)
    if (netMatch) {
      const days = parseInt(netMatch[1])
      const dueDate = new Date(invoiceDate)
      dueDate.setDate(dueDate.getDate() + days)
      return dueDate.toISOString().split('T')[0]
    }

    return ''
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))

    if (field === 'terms_id' || field === 'invoice_date') {
      const selectedTerm = terms.find(t => t.id === (field === 'terms_id' ? value : formData.terms_id))
      if (selectedTerm) {
        const dueDate = calculateDueDate(selectedTerm.name)
        setFormData(prev => ({ ...prev, due_date: dueDate }))
      }
    }
  }

  const handleLineChange = (index: number, field: keyof InvoiceLineData, value: string | number) => {
    const updatedLines = [...invoiceLines]
    updatedLines[index] = {
      ...updatedLines[index],
      [field]: value
    }
    setInvoiceLines(updatedLines)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      setPdfFile(file)
    } else {
      setPdfFile(null)
      if (file) {
        setError('Please select a PDF file')
      }
    }
  }

  const uploadPdf = async (invoiceIdForUpload: string): Promise<string | null> => {
    if (!pdfFile) return null

    try {
      const fileExt = 'pdf'
      const fileName = `${invoiceIdForUpload}.${fileExt}`
      const filePath = `invoices/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('invoice-pdfs')
        .upload(filePath, pdfFile, { upsert: true })

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('invoice-pdfs')
        .getPublicUrl(filePath)

      return data.publicUrl
    } catch (err) {
      console.error('Error uploading PDF:', err)
      return null
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!salesOrder) return

    setLoading(true)
    setError(null)

    try {
      if (!formData.invoice_no.trim()) {
        throw new Error('Invoice number is required')
      }

      if (mode === 'create') {
        const invoiceHeaderData = {
          so_hdr_id: salesOrder.id,
          shipment_hdr_id: formData.shipment_hdr_id || null,
          invoice_no: formData.invoice_no.trim(),
          invoice_date: formData.invoice_date,
          due_date: formData.due_date || null,
          terms_id: formData.terms_id || null,
          status: formData.status,
          note: formData.note.trim() || null
        }

        const { data: headerData, error: headerError } = await supabase
          .from('invoice_hdr')
          .insert([invoiceHeaderData])
          .select()
          .single()

        if (headerError) throw headerError
        if (!headerData) throw new Error('Failed to create invoice header')

        let pdfUrl = null
        if (pdfFile) {
          pdfUrl = await uploadPdf(headerData.id)
          if (pdfUrl) {
            const { error: updateError } = await supabase
              .from('invoice_hdr')
              .update({ pdf_url: pdfUrl })
              .eq('id', headerData.id)

            if (updateError) throw updateError
          }
        }

        const validLines = invoiceLines.filter(line => line.qty_invoiced > 0)
        if (validLines.length > 0) {
          const { error: linesError } = await supabase
            .from('invoice_line')
            .update(validLines.map(line => ({
              uom: line.uom,
              price: line.price
            })))
            .eq('invoice_hdr_id', headerData.id)

          if (linesError) throw linesError
        }

        navigate(`/invoices/${headerData.id}`)
      } else {
        let pdfUrl = existingPdfUrl
        if (pdfFile) {
          const newPdfUrl = await uploadPdf(invoiceId!)
          if (newPdfUrl) {
            pdfUrl = newPdfUrl
          }
        }

        const invoiceHeaderData = {
          invoice_no: formData.invoice_no.trim(),
          invoice_date: formData.invoice_date,
          due_date: formData.due_date || null,
          terms_id: formData.terms_id || null,
          status: formData.status,
          note: formData.note.trim() || null,
          pdf_url: pdfUrl,
          updated_at: new Date().toISOString()
        }

        const { error: headerError } = await supabase
          .from('invoice_hdr')
          .update(invoiceHeaderData)
          .eq('id', invoiceId!)

        if (headerError) throw headerError

        for (const line of invoiceLines) {
          const { error: lineError } = await supabase
            .from('invoice_line')
            .update({
              qty_invoiced: line.qty_invoiced,
              uom: line.uom,
              price: line.price,
              updated_at: new Date().toISOString()
            })
            .eq('id', line.id!)

          if (lineError) throw lineError
        }

        navigate(`/invoices/${invoiceId}`)
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : `An error occurred while ${mode === 'create' ? 'creating' : 'updating'} the invoice`)
    } finally {
      setLoading(false)
    }
  }

  if (loading && !salesOrder) {
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

  if (error && !salesOrder) {
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

  if (!salesOrder) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-yellow-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">No Sales Order</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>Please navigate to this form from a sales order or provide a valid invoice ID.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const backPath = mode === 'edit' ? `/invoices/${invoiceId}` : `/sales-orders/${salesOrder.id}`

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {mode === 'edit' && (
              <button
                onClick={() => navigate(backPath)}
                className="inline-flex items-center text-gray-600 hover:text-sharda-primary transition-colors"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Invoice
              </button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {mode === 'create' ? 'Create Invoice' : 'Edit Invoice'}
              </h1>
              <p className="text-gray-600 mt-1">
                {mode === 'create'
                  ? `From Sales Order ${salesOrder.doc_no}${salesOrder.party ? ` - ${salesOrder.party.display_name}` : ''}`
                  : `Invoice ${formData.invoice_no} - Sales Order ${(salesOrder as any).doc_no}`
                }
              </p>
            </div>
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

      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            Invoice Details
          </h3>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Invoice Number *
              </label>
              <input
                type="text"
                value={formData.invoice_no}
                onChange={(e) => handleInputChange('invoice_no', e.target.value)}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                placeholder="Enter invoice number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="h-4 w-4 inline mr-1" />
                Invoice Date *
              </label>
              <input
                type="date"
                value={formData.invoice_date}
                onChange={(e) => handleInputChange('invoice_date', e.target.value)}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status *
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                required
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
              >
                <option value="Draft">Draft</option>
                <option value="Issued">Issued</option>
                <option value="Paid">Paid</option>
                <option value="Canceled">Canceled</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              {salesOrder.terms && mode === 'create' && (
                <p className="mt-1 text-xs text-gray-500">
                  Inherited from SO: {salesOrder.terms.name}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="h-4 w-4 inline mr-1" />
                Due Date
              </label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => handleInputChange('due_date', e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Upload className="h-4 w-4 inline mr-1" />
              Invoice PDF {mode === 'create' && '(Optional)'}
            </label>
            <input
              type="file"
              accept=".pdf"
              onChange={handleFileChange}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
            />
            {pdfFile && (
              <p className="mt-1 text-sm text-green-600">
                {mode === 'edit' ? 'New file selected: ' : 'Selected: '}{pdfFile.name}
              </p>
            )}
            {existingPdfUrl && !pdfFile && mode === 'edit' && (
              <p className="mt-1 text-sm text-blue-600">
                Current PDF: <a href={existingPdfUrl} target="_blank" rel="noopener noreferrer" className="underline">View existing PDF</a>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.note}
              onChange={(e) => handleInputChange('note', e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
              placeholder="Add any additional notes..."
            />
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h4 className="text-lg font-semibold text-gray-900 mb-4">Invoice Line Items</h4>

            <div className="space-y-4">
              {invoiceLines.map((line, index) => (
                <div key={line.id || line.so_line_id} className="border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Line {line.line_no}
                      </label>
                      <p className="text-sm font-medium text-gray-900">{line.item_name}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quantity *
                      </label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={line.qty_invoiced}
                        onChange={(e) => handleLineChange(index, 'qty_invoiced', parseFloat(e.target.value) || 0)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        UOM
                      </label>
                      <input
                        type="text"
                        value={line.uom}
                        onChange={(e) => handleLineChange(index, 'uom', e.target.value)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                        placeholder="EA"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        <DollarSign className="h-4 w-4 inline mr-1" />
                        Unit Price
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.price || ''}
                        onChange={(e) => handleLineChange(index, 'price', parseFloat(e.target.value) || null)}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                        placeholder="0.00"
                      />
                    </div>

                    <div className="flex items-end">
                      <div className="text-sm text-gray-600">
                        <div className="font-medium">Line Total</div>
                        <div className="text-lg font-bold text-gray-900">
                          {line.price ? `$${(line.qty_invoiced * line.price).toFixed(2)}` : 'No price'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex justify-end">
                <div className="text-right">
                  <div className="text-sm text-gray-500">Invoice Total</div>
                  <div className="text-2xl font-bold text-gray-900">
                    ${invoiceLines.reduce((sum, line) => {
                      return sum + (line.price ? line.qty_invoiced * line.price : 0)
                    }, 0).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

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
            {loading ? (mode === 'create' ? 'Creating...' : 'Saving...') : (mode === 'create' ? 'Create Invoice' : 'Save Changes')}
          </button>
        </div>
      </form>
    </div>
  )
}
