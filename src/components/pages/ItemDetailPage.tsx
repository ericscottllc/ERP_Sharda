import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Package, Building, Tag, Info, BarChart3, FileText, History, TrendingUp, TrendingDown, Calendar, User, Truck } from 'lucide-react'
import { useItemDetail, useItemInventory, useItemTransactions, useItemRelatedDocuments } from '../../hooks/useItemData'
import { DocumentStatusBadge } from '../commercial/DocumentStatusBadge'
import { formatQuantityDisplay, formatPackSizeDisplay, formatDate, formatDateTime } from '../../utils/formatters'

export function ItemDetailPage() {
  const { itemName } = useParams<{ itemName: string }>()
  const navigate = useNavigate()
  const decodedItemName = itemName ? decodeURIComponent(itemName) : null
  
  const { item, loading: itemLoading, error: itemError } = useItemDetail(decodedItemName)
  const { inventory, loading: inventoryLoading } = useItemInventory(decodedItemName)
  const { transactions, loading: transactionsLoading } = useItemTransactions(decodedItemName)
  const { documents, loading: documentsLoading } = useItemRelatedDocuments(decodedItemName)
  
  const [activeTab, setActiveTab] = useState<'inventory' | 'transactions' | 'documents'>('inventory')


  const getTransactionIcon = (transaction: any) => {
    if (transaction.transaction_type === 'movement') {
      switch (transaction.doc_type) {
        case 'Shipment': return Truck
        case 'Receipt': return Package
        case 'Adjustment': return transaction.qty_base > 0 ? TrendingUp : TrendingDown
        default: return FileText
      }
    } else {
      switch (transaction.doc_type) {
        case 'SO': return FileText
        case 'PO': return FileText
        case 'TO': return FileText
        default: return FileText
      }
    }
  }

  const getTransactionColor = (transaction: any) => {
    if (transaction.transaction_type === 'movement') {
      switch (transaction.doc_type) {
        case 'Shipment': return 'text-blue-600'
        case 'Receipt': return 'text-green-600'
        case 'Adjustment': return transaction.qty_base > 0 ? 'text-green-600' : 'text-red-600'
        default: return 'text-gray-600'
      }
    } else {
      return 'text-purple-600'
    }
  }

  const navigateToDocument = (transaction: any) => {
    if (transaction.transaction_type === 'movement') {
      const movementTypeMap: Record<string, string> = {
        'Shipment': 'shipments',
        'Receipt': 'receipts',
        'Transfer': 'transfers',
        'Adjustment': 'adjustments'
      }
      const basePath = movementTypeMap[transaction.doc_type]
      if (basePath) {
        navigate(`/${basePath}/${transaction.movement_hdr?.id}`)
      }
    } else {
      const docTypeMap: Record<string, string> = {
        'SO': 'sales-orders',
        'PO': 'purchase-orders',
        'TO': 'transfer-orders'
      }
      const basePath = docTypeMap[transaction.doc_type]
      if (basePath && transaction.commercial_hdr?.id) {
        navigate(`/${basePath}/${transaction.commercial_hdr.id}`)
      }
    }
  }

  const navigateToRelatedDocument = (document: any) => {
    const docTypeMap: Record<string, string> = {
      'SO': 'sales-orders',
      'PO': 'purchase-orders',
      'TO': 'transfer-orders'
    }
    const basePath = docTypeMap[document.doc_type]
    if (basePath) {
      navigate(`/${basePath}/${document.id}`)
    }
  }

  if (itemLoading) {
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

  if (itemError || !item) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{itemError || 'Item not found'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const totalInventory = inventory.reduce((sum, inv) => sum + inv.qty_on_hand_base, 0)
  const warehouseCount = new Set(inventory.map(inv => inv.warehouse_id)).size

  const tabs = [
    { id: 'inventory' as const, label: 'Current Inventory', icon: BarChart3, count: warehouseCount },
    { id: 'transactions' as const, label: 'Transaction History', icon: History, count: transactions.length },
    { id: 'documents' as const, label: 'Related Documents', icon: FileText, count: documents.length }
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/items')}
            className="inline-flex items-center text-gray-600 hover:text-sharda-primary transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Items
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Package className="h-6 w-6 mr-3 text-sharda-primary" />
              {item.item_name}
            </h1>
            <p className="text-gray-600 mt-1">
              {item.product_name && `Product: ${item.product_name}`}
              {item.product?.registrant && ` • Registrant: ${item.product.registrant}`}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="text-right">
            <div className="text-sm text-gray-500">Total Inventory</div>
            <div className="text-2xl font-bold text-gray-900">{totalInventory} EA</div>
          </div>
        </div>
      </div>

      {/* Item Details */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Info className="h-5 w-5 mr-2" />
            Item Details
          </h3>
        </div>
        
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Basic Information</h4>
              
              <div>
                <label className="block text-sm font-medium text-gray-500">Item Name</label>
                <p className="mt-1 text-sm text-gray-900 font-medium">{item.item_name}</p>
              </div>
              
              {item.product_name && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">Product</label>
                  <p className="mt-1 text-sm text-gray-900">{item.product_name}</p>
                </div>
              )}
            </div>

            {/* Pack Size Information */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-900">Pack Size Details</h4>
              
              <div>
                <label className="block text-sm font-medium text-gray-500">Pack Size</label>
                <p className="mt-1 text-sm text-gray-900">{formatPackSizeDisplay(item.pack_size_details) || item.pack_size || 'N/A'}</p>
              </div>
              
              {item.pack_size_details?.package_type && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">Package Type</label>
                  <p className="mt-1 text-sm text-gray-900">{item.pack_size_details.package_type}</p>
                </div>
              )}
              
              {item.pack_size_details?.units_of_units && (
                <div>
                  <label className="block text-sm font-medium text-gray-500">Units</label>
                  <p className="mt-1 text-sm text-gray-900">{item.pack_size_details.units_of_units}</p>
                </div>
              )}
            </div>

            {/* Product Information */}
            {item.product && (
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Product Information</h4>
                
                {item.product.registrant && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">
                      <Building className="h-4 w-4 inline mr-1" />
                      Registrant
                    </label>
                    <p className="mt-1 text-sm text-gray-900">{item.product.registrant}</p>
                  </div>
                )}
                
                {item.product.product_type && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">
                      <Tag className="h-4 w-4 inline mr-1" />
                      Product Type
                    </label>
                    <p className="mt-1 text-sm text-gray-900">{item.product.product_type}</p>
                  </div>
                )}
              </div>
            )}

            {/* Packaging Details */}
            {item.pack_size_details && (
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Packaging Details</h4>
                
                {item.pack_size_details.eaches_per_pallet && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Eaches per Pallet</label>
                    <p className="mt-1 text-sm text-gray-900">{item.pack_size_details.eaches_per_pallet}</p>
                  </div>
                )}
                
                {item.pack_size_details.pallets_per_tl && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Pallets per TL</label>
                    <p className="mt-1 text-sm text-gray-900">{item.pack_size_details.pallets_per_tl}</p>
                  </div>
                )}
                
                {item.pack_size_details.eaches_per_tl && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">Eaches per TL</label>
                    <p className="mt-1 text-sm text-gray-900">{item.pack_size_details.eaches_per_tl}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
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
                  onClick={() => setActiveTab(tab.id)}
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
          {activeTab === 'inventory' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Inventory by Warehouse</h3>
              {inventoryLoading ? (
                <div className="animate-pulse space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-gray-200 rounded"></div>
                  ))}
                </div>
              ) : inventory.length === 0 ? (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No inventory found</h3>
                  <p className="text-gray-600">This item has no current inventory on hand.</p>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Warehouse
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Inventory State
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Quantity on Hand
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {inventory.map((inv, index) => (
                          <tr key={`${inv.warehouse_id}-${inv.inventory_state}-${index}`} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <Building className="h-4 w-4 mr-3 text-gray-400" />
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {inv.warehouse?.name || 'Unknown Warehouse'}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {inv.warehouse?.code}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                inv.inventory_state === 'Stock' ? 'bg-green-100 text-green-800' :
                                inv.inventory_state === 'Consignment' ? 'bg-blue-100 text-blue-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {inv.inventory_state}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <div className="text-sm font-medium text-gray-900">
                                {formatQuantityDisplay(inv.qty_on_hand_base, inv.pack_size_details)}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'transactions' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Transaction History</h3>
              {transactionsLoading ? (
                <div className="animate-pulse space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-12 bg-gray-200 rounded"></div>
                  ))}
                </div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-8">
                  <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No transactions found</h3>
                  <p className="text-gray-600">No transaction history found for this item.</p>
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
                            Document
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Quantity
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Warehouse
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {transactions.map((transaction, index) => {
                          const Icon = getTransactionIcon(transaction)
                          const colorClass = getTransactionColor(transaction)
                          
                          return (
                            <tr 
                              key={`${transaction.id}-${index}`}
                              className="hover:bg-gray-50 cursor-pointer transition-colors"
                              onClick={() => navigateToDocument(transaction)}
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <Icon className={`h-5 w-5 mr-3 ${colorClass}`} />
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">
                                      {transaction.doc_type}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      Line {transaction.line_no}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {transaction.doc_no || `${transaction.doc_type} ${transaction.id.substring(0, 8)}...`}
                                </div>
                                {transaction.commercial_hdr?.party?.display_name && (
                                  <div className="text-sm text-gray-500">
                                    {transaction.commercial_hdr.party.display_name}
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className={`text-sm font-medium ${
                                  transaction.transaction_type === 'movement' && transaction.qty_base !== undefined
                                    ? transaction.qty_base > 0 ? 'text-green-600' : 'text-red-600'
                                    : 'text-gray-900'
                                }`}>
                                  {transaction.transaction_type === 'movement' && transaction.qty_base !== undefined
                                    ? `${transaction.qty_base > 0 ? '+' : ''}${transaction.qty_base} EA`
                                    : transaction.qty_ordered ? `${transaction.qty_ordered} EA` : 'N/A'
                                  }
                                </div>
                                {transaction.lot_number && (
                                  <div className="text-xs text-gray-500">
                                    Lot: {transaction.lot_number}
                                  </div>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {formatDate(transaction.effective_date || transaction.order_date || transaction.created_at)}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <DocumentStatusBadge 
                                  status={transaction.status} 
                                  isMovement={transaction.transaction_type === 'movement'} 
                                />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">
                                  {transaction.warehouse?.name || 'N/A'}
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

          {activeTab === 'documents' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Related Documents</h3>
              {documentsLoading ? (
                <div className="animate-pulse space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-16 bg-gray-200 rounded"></div>
                  ))}
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No related documents</h3>
                  <p className="text-gray-600">No sales orders, purchase orders, or transfer orders found for this item.</p>
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Document
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Party
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Quantity
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Order Date
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Status
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Warehouse
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {documents.map((document) => (
                          <tr 
                            key={document.id}
                            className="hover:bg-gray-50 cursor-pointer transition-colors"
                            onClick={() => navigateToRelatedDocument(document)}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <FileText className="h-5 w-5 mr-3 text-purple-600" />
                                <div>
                                  <div className="text-sm font-medium text-gray-900">
                                    {document.doc_no}
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    {document.doc_type} • {document.line_count} lines
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {document.party_display_name || 'N/A'}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {formatQuantityDisplay(document.total_quantity, document.pack_size_details)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {formatDate(document.order_date)}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <DocumentStatusBadge status={document.status} />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-900">
                                {document.warehouse_name || 'N/A'}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}