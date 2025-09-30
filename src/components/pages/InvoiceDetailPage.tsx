import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Calendar, Building, User, FileText, Package, DollarSign, AlertCircle, ExternalLink, CheckCircle, Send, XCircle } from 'lucide-react'
import { CreditCard as Edit } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useInvoiceDetail } from '../../hooks/useInvoiceData'
import { DocumentStatusBadge } from '../commercial/DocumentStatusBadge'
import { formatQuantityDisplay, formatDate, formatDateTime } from '../../utils/formatters'

export function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { invoice, lines, loading, error } = useInvoiceDetail(id || null)
  const [updating, setUpdating] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)

  const formatAddress = (address: any) => {
    if (!address) return 'N/A'
    return `${address.line1}${address.line2 ? ', ' + address.line2 : ''}, ${address.city}${address.region ? ', ' + address.region : ''} ${address.postal_code || ''}, ${address.country}`
  }

  const getInvoiceStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'issued':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'canceled':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'draft':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const handleStatusUpdate = async (newStatus: 'Draft' | 'Issued' | 'Paid' | 'Canceled') => {
    if (!invoice) return

    setUpdating(true)
    setUpdateError(null)

    try {
      const { error } = await supabase
        .from('invoice_hdr')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', invoice.id)

      if (error) throw error

      // Refresh the page to show updated status
      window.location.reload()
    } catch (err) {
      setUpdateError(err instanceof Error ? err.message : 'Failed to update status')
    } finally {
      setUpdating(false)
    }
  }

  const getStatusButtons = () => {
    if (!invoice) return []

    const buttons = []
    const currentStatus = invoice.status

    // Draft -> Issued
    if (currentStatus === 'Draft') {
      buttons.push({
        label: 'Issue Invoice',
        status: 'Issued' as const,
        icon: Send,
        color: 'bg-blue-600 hover:bg-blue-700'
      })
    }

    // Issued -> Paid
    if (currentStatus === 'Issued') {
      buttons.push({
        label: 'Mark as Paid',
        status: 'Paid' as const,
        icon: CheckCircle,
        color: 'bg-green-600 hover:bg-green-700'
      })
    }

    // Any status except Canceled -> Canceled
    if (currentStatus !== 'Canceled') {
      buttons.push({
        label: 'Cancel Invoice',
        status: 'Canceled' as const,
        icon: XCircle,
        color: 'bg-red-600 hover:bg-red-700'
      })
    }

    // Paid/Canceled -> Draft (reopen)
    if (currentStatus === 'Paid' || currentStatus === 'Canceled') {
      buttons.push({
        label: 'Reopen as Draft',
        status: 'Draft' as const,
        icon: FileText,
        color: 'bg-gray-600 hover:bg-gray-700'
      })
    }

    return buttons
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

  if (error || !invoice) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error || 'Invoice not found'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const invoiceTotal = lines.reduce((sum, line) => {
    return sum + (line.price ? line.qty_invoiced * line.price : 0)
  }, 0)

  const statusButtons = getStatusButtons()
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/invoices')}
            className="inline-flex items-center text-gray-600 hover:text-sharda-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Invoices
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              Invoice {invoice.invoice_no}
              <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full border ml-3 ${getInvoiceStatusColor(invoice.status)}`}>
                {invoice.status}
              </span>
            </h1>
            <p className="text-gray-600 mt-1">
              Created on {formatDate(invoice.created_at)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {statusButtons.map((button) => {
            const Icon = button.icon
            return (
              <button
                key={button.status}
                onClick={() => handleStatusUpdate(button.status)}
                disabled={updating}
                className={`inline-flex items-center px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 ${button.color}`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {button.label}
              </button>
            )
          })}
          <button
            onClick={() => navigate(`/invoices/${invoice.id}/edit`)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </button>
          {invoice.pdf_url && (
            <a
              href={invoice.pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View PDF
            </a>
          )}
        </div>
      </div>

      {/* Status Update Error */}
      {updateError && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Status Update Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{updateError}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Details */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            Invoice Details
          </h3>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Basic Information</h4>
              
              <div>
                <label className="block text-sm font-medium text-gray-500">Invoice Number</label>
                <p className="mt-1 text-sm text-gray-900 font-medium">{invoice.invoice_no}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-500">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  Invoice Date
                </label>
                <p className="mt-1 text-sm text-gray-900">{formatDate(invoice.invoice_date)}</p>
              </div>
              
              {invoice.due_date && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    <Calendar className="h-4 w-4 inline mr-1" />
                    Due Date
                  </label>
                  <p className="mt-1 text-sm text-gray-900">{formatDate(invoice.due_date)}</p>
                </div>
              )}

              {invoice.terms && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">Payment Terms</label>
                  <p className="mt-1 text-sm text-gray-900">{invoice.terms.name}</p>
                  {invoice.terms.description && (
                    <p className="text-xs text-gray-500">{invoice.terms.description}</p>
                  )}
                </div>
              )}
            </div>

            {/* Sales Order Information */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Sales Order Information</h4>
              
              <div>
                <label className="block text-sm font-medium text-gray-500">Sales Order</label>
                <p className="mt-1 text-sm text-gray-900">
                  <Link
                    to={`/sales-orders/${invoice.so_hdr_id}`}
                    className="text-sharda-primary hover:text-sharda-secondary"
                  >
                    {invoice.sales_order?.doc_no}
                  </Link>
                </p>
              </div>
              
              {invoice.sales_order?.party && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    <User className="h-4 w-4 inline mr-1" />
                    Customer
                  </label>
                  <p className="mt-1 text-sm text-gray-900">{invoice.sales_order.party.display_name}</p>
                  {invoice.sales_order.party.email && (
                    <p className="text-xs text-gray-500">{invoice.sales_order.party.email}</p>
                  )}
                </div>
              )}

              {invoice.sales_order?.primary_warehouse && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    <Building className="h-4 w-4 inline mr-1" />
                    Warehouse
                  </label>
                  <p className="mt-1 text-sm text-gray-900">
                    {invoice.sales_order.primary_warehouse.name} ({invoice.sales_order.primary_warehouse.code})
                  </p>
                </div>
              )}
            </div>

            {/* Shipment Information */}
            {invoice.shipment && (
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Shipment Information</h4>
                
                <div>
                  <label className="block text-sm font-medium text-gray-500">Shipment</label>
                  <p className="mt-1 text-sm text-gray-900">
                    <Link
                      to={`/shipments/${invoice.shipment_hdr_id}`}
                      className="text-sharda-primary hover:text-sharda-secondary"
                    >
                      {invoice.shipment.id.substring(0, 8)}...
                    </Link>
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-500">Ship Date</label>
                  <p className="mt-1 text-sm text-gray-900">{formatDate(invoice.shipment.effective_date)}</p>
                </div>
                
                {invoice.shipment.movement_ext?.carrier_name && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Carrier</label>
                    <p className="mt-1 text-sm text-gray-900">{invoice.shipment.movement_ext.carrier_name}</p>
                    {invoice.shipment.movement_ext.tracking_number && (
                      <p className="text-xs text-gray-500">Tracking: {invoice.shipment.movement_ext.tracking_number}</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          {invoice.note && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
              <p className="text-sm text-gray-700">{invoice.note}</p>
            </div>
          )}
        </div>
      </div>

      {/* Invoice Lines */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Package className="h-5 w-5 mr-2" />
              Invoice Lines ({lines.length})
            </h3>
            <div className="text-right">
              <div className="text-sm text-gray-500">Total Amount</div>
              <div className="text-xl font-bold text-gray-900">${invoiceTotal.toFixed(2)}</div>
            </div>
          </div>
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
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Quantity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  UOM
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unit Price
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Line Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {lines.map((line) => (
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
                    {line.item?.product_name && (
                      <div className="text-xs text-gray-500">
                        Product: {line.item.product_name}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm text-gray-900">
                      {formatQuantityDisplay(line.qty_invoiced, line.item?.pack_size_details)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {line.uom || 'EA'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm text-gray-900">
                      {line.price ? `$${line.price.toFixed(2)}` : 'No price'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {line.price ? `$${(line.qty_invoiced * line.price).toFixed(2)}` : 'No price'}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan={5} className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                  Invoice Total:
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <div className="text-lg font-bold text-gray-900">
                    ${invoiceTotal.toFixed(2)}
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}