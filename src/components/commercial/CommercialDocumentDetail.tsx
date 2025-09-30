import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Calendar, Building, User, FileText, Package, Truck, CheckCircle, Clock, AlertCircle, CreditCard as Edit } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { CommercialHeader, CommercialLine, DocType } from '../../types/database'
import { SmartActionButtons } from './SmartActionButtons'
import { CommercialLinesList } from './CommercialLinesList'
import { DocumentStatusBadge } from './DocumentStatusBadge'
import { DocumentTabs } from './DocumentTabs'

interface CommercialDocumentDetailProps {
  docType: DocType
  title: string
  listPath: string
}

export function CommercialDocumentDetail({ docType, title, listPath }: CommercialDocumentDetailProps) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [document, setDocument] = useState<CommercialHeader | null>(null)
  const [lines, setLines] = useState<CommercialLine[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'lines' | 'related' | 'history' | 'invoices'>('lines')

  useEffect(() => {
    if (id) {
      fetchDocument(id)
    }
  }, [id])

  const fetchDocument = async (documentId: string) => {
    try {
      setLoading(true)
      
      // Fetch document header with related data
      const { data: headerData, error: headerError } = await supabase
        .from('commercial_hdr')
        .select(`
          *,
          party:party_id (
            id,
            display_name,
            initials,
            email,
            phone
          ),
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
          terms:terms_id (
            id,
            name,
            description
          ),
          bill_to_address:bill_to_address_id (
            id,
            line1,
            line2,
            city,
            region,
            postal_code,
            country
          ),
          ship_to_address:ship_to_address_id (
            id,
            line1,
            line2,
            city,
            region,
            postal_code,
            country
          )
        `)
        .eq('id', documentId)
        .eq('doc_type', docType)
        .single()

      if (headerError) throw headerError
      if (!headerData) throw new Error('Document not found')

      // Fetch document lines with fulfillment data
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
          ),
          tags:commercial_line_tag (
            tag_id,
            created_at,
            tag:tag_id (
              id,
              name,
              description,
              color
            )
          ),
          fulfillment_links:fulfillment_link (
            id,
            qty_linked_base,
            movement_line:movement_line_id (
              id,
              qty_base,
              movement_hdr:hdr_id (
                id,
                doc_type,
                status,
                effective_date
              )
            )
          )
        `)
        .eq('hdr_id', documentId)
        .order('line_no')

      if (linesError) throw linesError

      setDocument(headerData)
      setLines(linesData || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const formatAddress = (address: any) => {
    if (!address) return 'N/A'
    return `${address.line1}${address.line2 ? ', ' + address.line2 : ''}, ${address.city}${address.region ? ', ' + address.region : ''} ${address.postal_code || ''}, ${address.country}`
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
      case 'TO': return 'Party'
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

  if (error || !document) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error || 'Document not found'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate(listPath)}
            className="inline-flex items-center text-gray-600 hover:text-sharda-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to {title}
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              {getDocumentTypeLabel(docType)} {document.doc_no}
              <DocumentStatusBadge status={document.status} className="ml-3" />
            </h1>
            <p className="text-gray-600 mt-1">
              Created on {formatDate(document.created_at)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <SmartActionButtons 
            document={document} 
            lines={lines}
            onActionComplete={() => fetchDocument(id!)}
          />
          <button 
            onClick={() => navigate(`${listPath}/${id}/edit`)}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </button>
        </div>
      </div>

      {/* Document Details */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            Document Details
          </h3>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Column 1: Document Number, Customer, Warehouse */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Document Information</h4>
              
              <div>
                <label className="block text-sm font-medium text-gray-500">Document Number</label>
                <p className="mt-1 text-sm text-gray-900">{document.doc_no}</p>
              </div>
              
              {/* Customer/Party Information */}
              {document.party && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    <User className="h-4 w-4 inline mr-1" />
                    {getPartyLabel(docType)}
                  </label>
                  <p className="mt-1 text-sm text-gray-900">
                    <Link
                      to={`/parties/${document.party_id}`}
                      className="text-sharda-primary hover:text-sharda-secondary"
                    >
                      {document.party.display_name}
                    </Link>
                  </p>
                  {document.party.email && (
                    <p className="text-xs text-gray-500">{document.party.email}</p>
                  )}
                  {document.party.phone && (
                    <p className="text-xs text-gray-500">{document.party.phone}</p>
                  )}
                </div>
              )}
              
              {/* Primary Warehouse */}
              <div>
                <label className="block text-sm font-medium text-gray-500">
                  <Building className="h-4 w-4 inline mr-1" />
                  {docType === 'SO' ? 'Ship From' : docType === 'PO' ? 'Receive Into' : 'From'} Warehouse
                </label>
                <p className="mt-1 text-sm text-gray-900">
                  <Link
                    to={`/warehouses/${document.primary_warehouse_id}`}
                    className="text-sharda-primary hover:text-sharda-secondary"
                  >
                    {document.primary_warehouse?.name} ({document.primary_warehouse?.code})
                  </Link>
                </p>
              </div>
              
              {/* Secondary Warehouse */}
              {document.secondary_warehouse && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    <Building className="h-4 w-4 inline mr-1" />
                    {docType === 'TO' ? 'To' : 'Secondary'} Warehouse
                  </label>
                  <p className="mt-1 text-sm text-gray-900">
                    <Link
                      to={`/warehouses/${document.secondary_warehouse_id}`}
                      className="text-sharda-primary hover:text-sharda-secondary"
                    >
                      {document.secondary_warehouse.name} ({document.secondary_warehouse.code})
                    </Link>
                  </p>
                </div>
              )}
            </div>

            {/* Column 2: Dates */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Dates</h4>
              
              <div>
                <label className="block text-sm font-medium text-gray-500">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  Order Date
                </label>
                <p className="mt-1 text-sm text-gray-900">{formatDate(document.order_date)}</p>
              </div>
              
              {document.requested_date && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    <Calendar className="h-4 w-4 inline mr-1" />
                    Requested Date
                  </label>
                  <p className="mt-1 text-sm text-gray-900">{formatDate(document.requested_date)}</p>
                </div>
              )}
              
              {/* Ship To Address - only for SO */}
              {docType === 'SO' && document.ship_to_address && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">Ship To Address</label>
                  <p className="mt-1 text-sm text-gray-900">{formatAddress(document.ship_to_address)}</p>
                </div>
              )}
            </div>

            {/* Column 3: Status, Terms */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Status & Terms</h4>
              
              <div>
                <label className="block text-sm font-medium text-gray-500">Status</label>
                <div className="mt-1">
                  <DocumentStatusBadge status={document.status} />
                </div>
              </div>
              
              {/* Payment Terms */}
              {document.terms && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">Payment Terms</label>
                  <p className="mt-1 text-sm text-gray-900">{document.terms.name}</p>
                  {document.terms.description && (
                    <p className="text-xs text-gray-500">{document.terms.description}</p>
                  )}
                </div>
              )}

              {/* Customer Reference - only for SO */}
              {docType === 'SO' && document.customer_ref && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">Customer Reference</label>
                  <p className="mt-1 text-sm text-gray-900">{document.customer_ref}</p>
                </div>
              )}
            </div>
          </div>

          {/* Bill To Address */}
          {document.bill_to_address && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="font-medium text-gray-900 mb-4">Bill To Address</h4>
              <div>
                <p className="text-sm text-gray-900">{formatAddress(document.bill_to_address)}</p>
              </div>
            </div>
          )}

          {/* Notes */}
          {document.note && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <h4 className="font-medium text-gray-900 mb-2">Notes</h4>
              <p className="text-sm text-gray-700">{document.note}</p>
            </div>
          )}
        </div>
      </div>

      {/* Document Tabs */}
      <DocumentTabs
        document={document}
        lines={lines}
        docType={docType}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onLinesUpdate={() => fetchDocument(id!)}
      />
    </div>
  )
}