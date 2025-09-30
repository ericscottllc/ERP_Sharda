import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, FileText, History, Calendar, Building, User, Truck, RotateCcw, Receipt } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useSalesOrderInvoices } from '../../hooks/useInvoiceData'
import { CommercialHeader, CommercialLine, DocType } from '../../types/database'
import { CommercialLinesList } from './CommercialLinesList'
import { DocumentStatusBadge } from './DocumentStatusBadge'
import { TagsManager } from './TagsManager'

interface DocumentTabsProps {
  document: CommercialHeader
  lines: CommercialLine[]
  docType: DocType
  activeTab: 'lines' | 'related' | 'history' | 'invoices'
  onTabChange: (tab: 'lines' | 'related' | 'history' | 'invoices') => void
  onLinesUpdate: () => void
}

interface RelatedRecord {
  id: string
  doc_type: string
  status: string
  effective_date?: string
  created_at: string
  note?: string
  carrier_name?: string
  tracking_number?: string
  packages_count?: number
  shipped_weight?: number
}

interface HistoryRecord {
  id: string
  table_name: string
  action: string
  changed_at: string
  changed_by?: string
  diff?: any
  old_row?: any
  new_row?: any
}

export function DocumentTabs({ 
  document, 
  lines, 
  docType, 
  activeTab, 
  onTabChange, 
  onLinesUpdate 
}: DocumentTabsProps) {
  const navigate = useNavigate()
  const [relatedRecords, setRelatedRecords] = useState<RelatedRecord[]>([])
  const [historyRecords, setHistoryRecords] = useState<HistoryRecord[]>([])
  const [loadingRelated, setLoadingRelated] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  
  // Only fetch invoices for Sales Orders
  const { invoices, loading: loadingInvoices } = useSalesOrderInvoices(
    docType === 'SO' ? document.id : null
  )

  useEffect(() => {
    if (activeTab === 'related') {
      fetchRelatedRecords()
    } else if (activeTab === 'history') {
      fetchHistoryRecords()
    }
  }, [activeTab, document.id])

  const fetchRelatedRecords = async () => {
    try {
      setLoadingRelated(true)
      
      // Get unique movement records related to this commercial document through fulfillment links
      const { data: movementData, error: movementError } = await supabase
        .from('movement_hdr')
        .select(`
          id,
          doc_type,
          status,
          physical_status,
          effective_date,
          created_at,
          note,
          movement_ext:movement_ext (
            carrier_name,
            tracking_number,
            packages_count,
            shipped_weight
          ),
          movement_line!inner (
            fulfillment_link!inner (
              commercial_line!inner (
                hdr_id
              )
            )
          )
        `)
        .eq('movement_line.fulfillment_link.commercial_line.hdr_id', document.id)
        .order('created_at', { ascending: false })

      if (movementError) throw movementError

      // Process the data to get unique movement records
      const processedRecords: any[] = (movementData || []).map((movement: any) => ({
        id: movement.id,
        doc_type: movement.doc_type,
        status: movement.status,
        physical_status: movement.physical_status,
        effective_date: movement.effective_date,
        created_at: movement.created_at,
        note: movement.note,
        carrier_name: movement.movement_ext?.carrier_name,
        tracking_number: movement.movement_ext?.tracking_number,
        packages_count: movement.movement_ext?.packages_count,
        shipped_weight: movement.movement_ext?.shipped_weight
      }))

      setRelatedRecords(processedRecords)
    } catch (err) {
      console.error('Error fetching related records:', err)
    } finally {
      setLoadingRelated(false)
    }
  }

  const fetchHistoryRecords = async () => {
    try {
      setLoadingHistory(true)
      
      // Get system notes for this document and its lines
      const lineIds = lines.map(line => line.id)
      const allIds = [document.id, ...lineIds]

      const { data: historyData, error: historyError } = await supabase
        .from('system_note')
        .select('*')
        .or(`pk->>id.in.(${allIds.join(',')}),pk->>hdr_id.eq.${document.id}`)
        .order('changed_at', { ascending: false })
        .limit(50)

      if (historyError) throw historyError

      setHistoryRecords(historyData || [])
    } catch (err) {
      console.error('Error fetching history records:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getMovementIcon = (docType: string) => {
    switch (docType) {
      case 'Shipment': return Truck
      case 'Receipt': return Package
      case 'Transfer': return FileText
      case 'Return_In':
      case 'Return_Out': return RotateCcw
      default: return FileText
    }
  }

  const getMovementColor = (docType: string) => {
    switch (docType) {
      case 'Shipment': return 'text-blue-600'
      case 'Receipt': return 'text-green-600'
      case 'Transfer': return 'text-purple-600'
      case 'Return_In':
      case 'Return_Out': return 'text-red-600'
      default: return 'text-gray-600'
    }
  }

  const navigateToMovementRecord = (record: RelatedRecord) => {
    const movementTypeMap: Record<string, string> = {
      'Shipment': 'shipments',
      'Receipt': 'receipts',
      'Transfer': 'transfers',
      'Adjustment': 'adjustments',
      'Return_In': 'returns',
      'Return_Out': 'returns'
    }
    
    const basePath = movementTypeMap[record.doc_type]
    if (basePath) {
      navigate(`/${basePath}/${record.id}`)
    }
  }

  const tabs = [
    { id: 'lines' as const, label: 'Line Items', icon: Package, count: lines.length },
    { id: 'related' as const, label: 'Related Records', icon: FileText, count: relatedRecords.length },
    { id: 'history' as const, label: 'History', icon: History, count: historyRecords.length },
    ...(docType === 'SO' ? [{ id: 'invoices' as const, label: 'Invoices', icon: Receipt, count: invoices.length }] : [])
  ]

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  isActive
                    ? 'border-sharda-primary text-sharda-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.count > 0 && (
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    isActive ? 'bg-sharda-100 text-sharda-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'lines' && (
          <CommercialLinesList 
            lines={lines} 
            docType={docType}
            onLinesUpdate={onLinesUpdate}
          />
        )}

        {activeTab === 'related' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Related Records</h3>
            {loadingRelated ? (
              <div className="animate-pulse space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-200 rounded"></div>
                ))}
              </div>
            ) : relatedRecords.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No related records</h3>
                <p className="text-gray-600">No shipments, receipts, or other related records found.</p>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Transaction
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Effective Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Carrier Details
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {relatedRecords.map((record, index) => {
                        const Icon = getMovementIcon(record.doc_type)
                        const colorClass = getMovementColor(record.doc_type)
                        
                        return (
                          <tr 
                            key={`${record.id}-${index}`}
                            className="hover:bg-gray-50 cursor-pointer transition-colors"
                            onClick={() => navigateToMovementRecord(record)}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <Icon className={`h-5 w-5 mr-3 ${colorClass}`} />
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {record.doc_type}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {record.id.substring(0, 8)}...
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {formatDate(record.effective_date)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <DocumentStatusBadge 
                                status={record.status} 
                                physicalStatus={record.physical_status}
                                isMovement={true} 
                              />
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-600">
                                {record.carrier_name && (
                                  <div>Carrier: {record.carrier_name}</div>
                                )}
                                {record.tracking_number && (
                                  <div>Tracking: {record.tracking_number}</div>
                                )}
                                {record.packages_count && (
                                  <div>{record.packages_count} packages</div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Document History</h3>
            {loadingHistory ? (
              <div className="animate-pulse space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-200 rounded"></div>
                ))}
              </div>
            ) : historyRecords.length === 0 ? (
              <div className="text-center py-8">
                <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No history records</h3>
                <p className="text-gray-600">No change history found for this document.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {historyRecords.map((record) => (
                  <div key={record.id} className="border-l-4 border-gray-200 pl-4 py-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${
                          record.action === 'INSERT' ? 'bg-green-100 text-green-800' :
                          record.action === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {record.action}
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {record.table_name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {formatDateTime(record.changed_at)}
                      </span>
                    </div>
                    {record.diff && Object.keys(record.diff).length > 0 && (
                      <div className="mt-2 text-xs text-gray-600">
                        <details className="cursor-pointer">
                          <summary className="hover:text-gray-800">View changes</summary>
                          <div className="mt-2 bg-gray-50 rounded p-2 font-mono text-xs">
                            {Object.entries(record.diff).map(([key, value]: [string, any]) => (
                              <div key={key} className="flex justify-between">
                                <span className="font-medium">{key}:</span>
                                <span>{JSON.stringify(value)}</span>
                              </div>
                            ))}
                          </div>
                        </details>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'invoices' && docType === 'SO' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Invoices</h3>
              <button
                onClick={() => navigate(`/invoices/new?so_hdr_id=${document.id}`)}
                className="inline-flex items-center px-3 py-2 bg-sharda-primary text-white rounded-md hover:bg-sharda-secondary transition-colors"
              >
                <Receipt className="h-4 w-4 mr-2" />
                Create Invoice
              </button>
            </div>
            
            {loadingInvoices ? (
              <div className="animate-pulse space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-200 rounded"></div>
                ))}
              </div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-8">
                <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices found</h3>
                <p className="text-gray-600 mb-4">No invoices have been created for this sales order.</p>
                <button
                  onClick={() => navigate(`/invoices/new?so_hdr_id=${document.id}`)}
                  className="inline-flex items-center px-4 py-2 bg-sharda-primary text-white rounded-lg hover:bg-sharda-secondary transition-colors"
                >
                  <Receipt className="h-4 w-4 mr-2" />
                  Create First Invoice
                </button>
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Invoice #
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Invoice Date
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Terms
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          PDF
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {invoices.map((invoice) => {
                        const invoiceTotal = invoice.invoice_line?.reduce((sum, line) => {
                          return sum + (line.price ? line.qty_invoiced * line.price : 0)
                        }, 0) || 0

                        return (
                          <tr 
                            key={invoice.id}
                            className="hover:bg-gray-50 cursor-pointer transition-colors"
                            onClick={() => navigate(`/invoices/${invoice.id}`)}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {invoice.invoice_no}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                invoice.status === 'Paid' ? 'bg-green-100 text-green-800' :
                                invoice.status === 'Issued' ? 'bg-blue-100 text-blue-800' :
                                invoice.status === 'Canceled' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {invoice.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {formatDate(invoice.invoice_date)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {invoice.terms?.name || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              ${invoiceTotal.toFixed(2)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {invoice.pdf_url ? (
                                <a
                                  href={invoice.pdf_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sharda-primary hover:text-sharda-secondary"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  View PDF
                                </a>
                              ) : (
                                'No PDF'
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}