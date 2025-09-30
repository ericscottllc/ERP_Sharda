import { useState, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Eye, Calendar, Building, User, FileText, Search, Filter, X, Package } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useCommercialDocuments } from '../../hooks/useCommercialData'
import { DocType } from '../../types/database'

interface CommercialDocumentListProps {
  docType: DocType
  title: string
  createPath: string
}

export function CommercialDocumentList({ docType, title, createPath }: CommercialDocumentListProps) {
  const { documents, loading, error } = useCommercialDocuments(docType)
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [showFilters, setShowFilters] = useState(false)
  const [uninvoicedSalesOrders, setUninvoicedSalesOrders] = useState<Set<string>>(new Set())
  const [loadingUninvoiced, setLoadingUninvoiced] = useState(false)

  // Initialize filters from URL params
  useEffect(() => {
    const filter = searchParams.get('filter')
    const search = searchParams.get('search')
    
    if (search) setSearchTerm(search)
    
    if (filter) {
      switch (filter) {
        case 'unshipped':
          setStatusFilter('Pending Shipment')
          setShowFilters(true)
          break
        case 'unreceived':
          setStatusFilter('Pending Receipt')
          setShowFilters(true)
          break
        case 'uninvoiced':
          setStatusFilter('uninvoiced')
          setShowFilters(true)
          break
        default:
          setStatusFilter(filter)
          setShowFilters(true)
      }
    }
  }, [searchParams])

  // Fetch uninvoiced sales orders when needed
  useEffect(() => {
    if (docType === 'SO' && (statusFilter === 'uninvoiced' || searchParams.get('filter') === 'uninvoiced')) {
      fetchUninvoicedSalesOrders()
    }
  }, [docType, statusFilter, searchParams, documents])

  const fetchUninvoicedSalesOrders = async () => {
    try {
      setLoadingUninvoiced(true)
      
      // Get all sales orders that have shipped lines
      const { data: shippedLines, error: shippedError } = await supabase
        .from('commercial_line')
        .select(`
          hdr_id,
          id,
          commercial_hdr:hdr_id (doc_type),
          fulfillment_link (
            movement_line (
              movement_hdr (
                doc_type,
                status
              )
            )
          )
        `)
        .eq('commercial_hdr.doc_type', 'SO')
        .not('fulfillment_link', 'is', null)

      if (shippedError) throw shippedError

      // Filter to only lines that have been shipped (have fulfillment links to posted shipments)
      const shippedSalesOrderLines = (shippedLines || []).filter(line => 
        line.fulfillment_link?.some((link: any) => 
          link.movement_line?.movement_hdr?.doc_type === 'Shipment' &&
          link.movement_line?.movement_hdr?.status === 'Posted'
        )
      )

      const shippedLineIds = shippedSalesOrderLines.map(line => line.id)
      
      if (shippedLineIds.length === 0) {
        setUninvoicedSalesOrders(new Set())
        return
      }

      // Get all invoice lines to see which SO lines have been invoiced
      const { data: invoiceLines, error: invoiceError } = await supabase
        .from('invoice_line')
        .select('so_line_id')
        .in('so_line_id', shippedLineIds)

      if (invoiceError) throw invoiceError

      // Create set of invoiced line IDs
      const invoicedLineIds = new Set((invoiceLines || []).map(line => line.so_line_id))

      // Find shipped lines that haven't been invoiced
      const uninvoicedLines = shippedSalesOrderLines.filter(line => 
        !invoicedLineIds.has(line.id)
      )

      // Get unique sales order IDs that have uninvoiced shipped lines
      const uninvoicedSOIds = new Set(uninvoicedLines.map(line => line.hdr_id))
      
      setUninvoicedSalesOrders(uninvoicedSOIds)
    } catch (err) {
      console.error('Error fetching uninvoiced sales orders:', err)
      setUninvoicedSalesOrders(new Set())
    } finally {
      setLoadingUninvoiced(false)
    }
  }

  // Filter documents based on search and status
  const filteredDocuments = documents.filter(doc => {
    // Search filter
    const matchesSearch = !searchTerm || 
      doc.doc_no.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.party?.display_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.primary_warehouse?.name || '').toLowerCase().includes(searchTerm.toLowerCase())

    // Status filter
    let matchesStatus = true
    if (statusFilter) {
      if (statusFilter === 'uninvoiced') {
        // Special case for sales orders without invoices
        matchesStatus = uninvoicedSalesOrders.has(doc.id)
      } else {
        matchesStatus = doc.status === statusFilter
      }
    }

    return matchesSearch && matchesStatus
  })

  const clearFilters = () => {
    setSearchTerm('')
    setStatusFilter('')
    setShowFilters(false)
    setSearchParams({})
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending shipment':
      case 'pending receipt':
      case 'open':
        return 'bg-yellow-100 text-yellow-800'
      case 'shipped':
      case 'received':
      case 'closed':
        return 'bg-green-100 text-green-800'
      case 'partially shipped':
      case 'partially received':
        return 'bg-blue-100 text-blue-800'
      case 'canceled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const getUniqueStatuses = () => {
    const statuses = [...new Set(documents.map(doc => doc.status))]
    return statuses.sort()
  }

  const getFilterTitle = () => {
    const filter = searchParams.get('filter')
    switch (filter) {
      case 'unshipped':
        return 'Un-Shipped Sales Orders'
      case 'unreceived':
        return 'Un-Received Purchase Orders'
      case 'uninvoiced':
        return 'Sales Orders with Shipped but Uninvoiced Lines'
      default:
        return title
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

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error loading {title.toLowerCase()}</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{getFilterTitle()}</h1>
          <p className="text-gray-600 mt-1">
            {searchParams.get('filter') ? 
              `Filtered view of ${title.toLowerCase()} that need attention` :
              `Manage your ${title.toLowerCase()} and track their progress`
            }
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </button>
          <Link
            to={createPath}
            className="inline-flex items-center px-4 py-2 bg-sharda-primary text-white rounded-lg hover:bg-sharda-secondary transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create New
          </Link>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
            {(searchTerm || statusFilter) && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center text-sm text-gray-600 hover:text-gray-800"
              >
                <X className="h-4 w-4 mr-1" />
                Clear all filters
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by document #, customer, warehouse..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sharda-primary focus:border-transparent"
              >
                <option value="">All statuses</option>
                {getUniqueStatuses().map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
                {docType === 'SO' && (
                  <option value="uninvoiced">Shipped but Uninvoiced</option>
                )}
              </select>
            </div>
          </div>

          {/* Active Filters Display */}
          {(searchTerm || statusFilter) && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium text-gray-700">Active filters:</span>
                {searchTerm && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800">
                    Search: "{searchTerm}"
                    <button
                      onClick={() => setSearchTerm('')}
                      className="ml-2 hover:text-blue-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {statusFilter && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800">
                    Status: {statusFilter === 'uninvoiced' ? 'Shipped but Uninvoiced' : statusFilter}
                    <button
                      onClick={() => setStatusFilter('')}
                      className="ml-2 hover:text-green-600"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Results Summary */}
      {(searchTerm || statusFilter) && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex items-center">
            <FileText className="h-5 w-5 text-blue-600 mr-2" />
            <span className="text-sm text-blue-800">
              Showing {filteredDocuments.length} of {documents.length} {title.toLowerCase()}
              {searchTerm && ` matching "${searchTerm}"`}
              {statusFilter && ` with status "${statusFilter === 'uninvoiced' ? 'Shipped but Uninvoiced' : statusFilter}"`}
            </span>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <FileText className="h-8 w-8 text-blue-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{documents.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-yellow-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-900">
                {documents.filter(doc => 
                  doc.status.toLowerCase().includes('pending') || 
                  doc.status.toLowerCase() === 'open'
                ).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <Building className="h-8 w-8 text-green-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900">
                {documents.filter(doc => 
                  doc.status.toLowerCase().includes('shipped') || 
                  doc.status.toLowerCase().includes('received') ||
                  doc.status.toLowerCase() === 'closed'
                ).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center">
            <User className="h-8 w-8 text-purple-500" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600">This Month</p>
              <p className="text-2xl font-bold text-gray-900">
                {documents.filter(doc => {
                  const docDate = new Date(doc.order_date)
                  const now = new Date()
                  return docDate.getMonth() === now.getMonth() && 
                         docDate.getFullYear() === now.getFullYear()
                }).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              {filteredDocuments.length === documents.length ? 'All' : 'Filtered'} {title}
            </h3>
            <div className="text-sm text-gray-500">
              {filteredDocuments.length} {filteredDocuments.length === 1 ? 'record' : 'records'}
            </div>
          </div>
        </div>
        
        {filteredDocuments.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {documents.length === 0 ? `No ${title.toLowerCase()} found` : 'No matching records'}
            </h3>
            <p className="text-gray-600 mb-6">
              {documents.length === 0 
                ? `Get started by creating your first ${title.toLowerCase().slice(0, -1)}.`
                : 'Try adjusting your search or filter criteria.'
              }
            </p>
            {documents.length === 0 ? (
              <Link
                to={createPath}
                className="inline-flex items-center px-4 py-2 bg-sharda-primary text-white rounded-lg hover:bg-sharda-secondary transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create New
              </Link>
            ) : (
              <button
                onClick={clearFilters}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <X className="h-4 w-4 mr-2" />
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Document #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {docType === 'SO' ? 'Customer' : docType === 'PO' ? 'Vendor' : 'Transfer'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Requested Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Primary Warehouse
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lines
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredDocuments.map((document) => (
                  <tr key={document.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        <Link
                          to={`${createPath.replace('/new', '')}/${document.id}`}
                          className="text-sharda-primary hover:text-sharda-secondary font-medium"
                        >
                          {document.doc_no}
                        </Link>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(document.status)}`}>
                        {document.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {document.party ? (
                          <Link
                            to={`/parties/${document.party_id}`}
                            className="text-sharda-primary hover:text-sharda-secondary"
                          >
                            {document.party.display_name}
                          </Link>
                        ) : (
                          docType === 'TO' ? 'Transfer' : 'N/A'
                        )}
                      </div>
                      {document.party?.email && (
                        <div className="text-xs text-gray-500">{document.party.email}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(document.order_date)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {document.requested_date ? formatDate(document.requested_date) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {document.primary_warehouse ? (
                        <Link
                          to={`/warehouses/${document.primary_warehouse_id}`}
                          className="text-sharda-primary hover:text-sharda-secondary"
                        >
                          {document.primary_warehouse.name}
                        </Link>
                      ) : (
                        'Unknown'
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <Package className="h-4 w-4 mr-1 text-gray-400" />
                        {document.line_count || 0} lines
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        to={`${createPath.replace('/new', '')}/${document.id}`}
                        className="inline-flex items-center text-sharda-primary hover:text-sharda-secondary"
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}