import { useState, useEffect } from 'react'
import { Package, Calendar, Building, AlertTriangle, CheckCircle } from 'lucide-react'
import { CommercialLine, DocType } from '../../types/database'
import { formatQuantityDisplay, formatDate, formatNumber } from '../../utils/formatters'
import { supabase } from '../../lib/supabase'

interface CommercialLinesListProps {
  lines: CommercialLine[]
  docType: DocType
  onLinesUpdate?: () => void
}

export function CommercialLinesList({ lines, docType, onLinesUpdate }: CommercialLinesListProps) {
  const [invoicedData, setInvoicedData] = useState<Map<string, number>>(new Map())
  const [loadingInvoiced, setLoadingInvoiced] = useState(false)

  useEffect(() => {
    if (docType === 'SO' && lines.length > 0) {
      fetchInvoicedQuantities()
    }
  }, [lines, docType])

  const fetchInvoicedQuantities = async () => {
    try {
      setLoadingInvoiced(true)
      
      const lineIds = lines.map(line => line.id)
      
      const { data: invoiceLines, error } = await supabase
        .from('invoice_line')
        .select('so_line_id, qty_invoiced')
        .in('so_line_id', lineIds)

      if (error) throw error

      // Sum up invoiced quantities by line ID
      const invoicedMap = new Map<string, number>()
      invoiceLines?.forEach(invLine => {
        const currentQty = invoicedMap.get(invLine.so_line_id) || 0
        invoicedMap.set(invLine.so_line_id, currentQty + invLine.qty_invoiced)
      })

      setInvoicedData(invoicedMap)
    } catch (err) {
      console.error('Error fetching invoiced quantities:', err)
    } finally {
      setLoadingInvoiced(false)
    }
  }

  const calculateFulfillment = (line: any) => {
    if (!line.fulfillment_links || line.fulfillment_links.length === 0) {
      return { fulfilled: 0, percentage: 0 }
    }

    const totalFulfilled = line.fulfillment_links.reduce((sum: number, link: any) => {
      return sum + parseFloat(link.qty_linked_base || 0)
    }, 0)

    const percentage = Math.round((totalFulfilled / parseFloat(line.qty_ordered)) * 100)
    
    return { fulfilled: totalFulfilled, percentage }
  }

  const calculateInvoiced = (line: any) => {
    const invoicedQty = invoicedData.get(line.id) || 0
    const percentage = Math.round((invoicedQty / parseFloat(line.qty_ordered)) * 100)
    return { invoiced: invoicedQty, percentage }
  }
  const getFulfillmentStatus = (percentage: number) => {
    if (percentage === 0) return { color: 'text-gray-500', icon: AlertTriangle, label: 'Not Started' }
    if (percentage < 100) return { color: 'text-yellow-600', icon: Package, label: 'Partial' }
    return { color: 'text-green-600', icon: CheckCircle, label: 'Complete' }
  }

  const getInvoicedStatus = (percentage: number) => {
    if (percentage === 0) return { color: 'text-gray-500', icon: AlertTriangle, label: 'Not Invoiced' }
    if (percentage < 100) return { color: 'text-yellow-600', icon: Package, label: 'Partial' }
    return { color: 'text-green-600', icon: CheckCircle, label: 'Complete' }
  }

  if (lines.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Package className="h-5 w-5 mr-2" />
            Line Items
          </h3>
        </div>
        <div className="p-12 text-center">
          <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No line items found</h3>
          <p className="text-gray-600">This document doesn't have any line items yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
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
                Tags
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quantity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Fulfillment
              </th>
              {docType === 'SO' && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoiced
                </th>
              )}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Dates
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Warehouse
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {lines.map((line: any) => {
              const fulfillment = calculateFulfillment(line)
              const fulfillmentStatus = getFulfillmentStatus(fulfillment.percentage)
              const invoiced = calculateInvoiced(line)
              const invoicedStatus = getInvoicedStatus(invoiced.percentage)
              const StatusIcon = fulfillmentStatus.icon
              const InvoicedIcon = invoicedStatus.icon

              return (
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
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {line.tags?.map((lineTag: any) => (
                        <span
                          key={lineTag.tag_id}
                          className="inline-flex px-2 py-1 text-xs font-medium rounded-full"
                          style={{
                            backgroundColor: `${lineTag.tag.color}20`,
                            color: lineTag.tag.color,
                            border: `1px solid ${lineTag.tag.color}40`
                          }}
                        >
                          {lineTag.tag.name}
                        </span>
                      )) || null}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatQuantityDisplay(parseFloat(line.qty_ordered), line.item?.pack_size_details, formatNumber)}
                    </div>
                    {line.lot_number && (
                      <div className="text-xs text-gray-500">
                        Lot: {line.lot_number}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {line.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <StatusIcon className={`h-4 w-4 mr-2 ${fulfillmentStatus.color}`} />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {line.item?.pack_size_details?.uom_per_each && line.item?.pack_size_details?.units_of_units
                            ? `${formatNumber(fulfillment.fulfilled * line.item.pack_size_details.uom_per_each)} ${line.item.pack_size_details.units_of_units} / ${formatNumber(parseFloat(line.qty_ordered) * line.item.pack_size_details.uom_per_each)} ${line.item.pack_size_details.units_of_units}`
                            : `${formatNumber(fulfillment.fulfilled)} EA / ${formatNumber(parseFloat(line.qty_ordered))} EA`
                          }
                        </div>
                        <div className="text-xs text-gray-500">
                          {fulfillment.percentage}% {fulfillmentStatus.label}
                        </div>
                      </div>
                    </div>
                    {fulfillment.percentage > 0 && fulfillment.percentage < 100 && (
                      <div className="mt-1 w-full bg-gray-200 rounded-full h-1">
                        <div 
                          className="bg-yellow-500 h-1 rounded-full" 
                          style={{ width: `${fulfillment.percentage}%` }}
                        ></div>
                      </div>
                    )}
                    {fulfillment.percentage === 100 && (
                      <div className="mt-1 w-full bg-gray-200 rounded-full h-1">
                        <div className="bg-green-500 h-1 rounded-full w-full"></div>
                      </div>
                    )}
                  </td>
                  {docType === 'SO' && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <InvoicedIcon className={`h-4 w-4 mr-2 ${invoicedStatus.color}`} />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {line.item?.pack_size_details?.uom_per_each && line.item?.pack_size_details?.units_of_units
                              ? `${formatNumber(invoiced.invoiced * line.item.pack_size_details.uom_per_each)} ${line.item.pack_size_details.units_of_units} / ${formatNumber(parseFloat(line.qty_ordered) * line.item.pack_size_details.uom_per_each)} ${line.item.pack_size_details.units_of_units}`
                              : `${formatNumber(invoiced.invoiced)} EA / ${formatNumber(parseFloat(line.qty_ordered))} EA`
                            }
                          </div>
                          <div className="text-xs text-gray-500">
                            {invoiced.percentage}% {invoicedStatus.label}
                          </div>
                        </div>
                      </div>
                      {invoiced.percentage > 0 && invoiced.percentage < 100 && (
                        <div className="mt-1 w-full bg-gray-200 rounded-full h-1">
                          <div 
                            className="bg-yellow-500 h-1 rounded-full" 
                            style={{ width: `${invoiced.percentage}%` }}
                          ></div>
                        </div>
                      )}
                      {invoiced.percentage === 100 && (
                        <div className="mt-1 w-full bg-gray-200 rounded-full h-1">
                          <div className="bg-green-500 h-1 rounded-full w-full"></div>
                        </div>
                      )}
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="space-y-1">
                      {line.requested_date && (
                        <div className="flex items-center text-xs">
                          <Calendar className="h-3 w-3 mr-1 text-gray-400" />
                          Req: {formatDate ? formatDate(line.requested_date) : new Date(line.requested_date).toLocaleDateString()}
                        </div>
                      )}
                      {line.promise_date && (
                        <div className="flex items-center text-xs">
                          <Calendar className="h-3 w-3 mr-1 text-gray-400" />
                          Promise: {formatDate ? formatDate(line.promise_date) : new Date(line.promise_date).toLocaleDateString()}
                        </div>
                      )}
                      {line.cancel_after && (
                        <div className="flex items-center text-xs text-red-600">
                          <Calendar className="h-3 w-3 mr-1" />
                          Cancel: {formatDate ? formatDate(line.cancel_after) : new Date(line.cancel_after).toLocaleDateString()}
                        </div>
                      )}
                    </div>
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
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}