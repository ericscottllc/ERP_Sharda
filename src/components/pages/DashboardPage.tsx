import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { 
  ShoppingCart, 
  FileText,
  Truck,
  Receipt,
  AlertTriangle,
  ChevronRight,
  Package,
  Clock,
  Send
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

interface DashboardStats {
  unshippedSalesOrders: number
  unreceivedPurchaseOrders: number
  shipmentsInTransit: number
  salesOrdersWithoutInvoices: number
  draftInvoices: number
}

export function DashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats>({
    unshippedSalesOrders: 0,
    unreceivedPurchaseOrders: 0,
    shipmentsInTransit: 0,
    salesOrdersWithoutInvoices: 0,
    draftInvoices: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      setLoading(true)

      // Fetch unshipped sales orders
      const { data: unshippedSO, error: soError } = await supabase
        .from('commercial_hdr')
        .select('id')
        .eq('doc_type', 'SO')
        .in('status', ['Open', 'Pending Shipment'])

      if (soError) throw soError

      // Fetch unreceived purchase orders
      const { data: unreceivedPO, error: poError } = await supabase
        .from('commercial_hdr')
        .select('id')
        .eq('doc_type', 'PO')
        .in('status', ['Open', 'Pending Receipt'])

      if (poError) throw poError

      // Fetch shipments in transit
      const { data: shipmentsInTransit, error: shipmentsError } = await supabase
        .from('movement_hdr')
        .select('id')
        .eq('doc_type', 'Shipment')
        .eq('physical_status', 'In Transit')

      if (shipmentsError) throw shipmentsError

      // Fetch sales orders without invoices
      const { data: allSalesOrders, error: allSOError } = await supabase
        .from('commercial_hdr')
        .select('id')
        .eq('doc_type', 'SO')
        .neq('status', 'Canceled')

      if (allSOError) throw allSOError

      const { data: invoicedSOs, error: invoicedSOError } = await supabase
        .from('invoice_hdr')
        .select('so_hdr_id')

      if (invoicedSOError) throw invoicedSOError

      const invoicedSOIds = new Set(invoicedSOs?.map(inv => inv.so_hdr_id) || [])
      const salesOrdersWithoutInvoices = (allSalesOrders || []).filter(so => !invoicedSOIds.has(so.id)).length

      // Fetch draft invoices
      const { data: draftInvoices, error: draftError } = await supabase
        .from('invoice_hdr')
        .select('id')
        .eq('status', 'Draft')

      if (draftError) throw draftError

      setStats({
        unshippedSalesOrders: unshippedSO?.length || 0,
        unreceivedPurchaseOrders: unreceivedPO?.length || 0,
        shipmentsInTransit: shipmentsInTransit?.length || 0,
        salesOrdersWithoutInvoices,
        draftInvoices: draftInvoices?.length || 0
      })
    } catch (err) {
      console.error('Error fetching dashboard stats:', err)
    } finally {
      setLoading(false)
    }
  }

  const quickAccessTiles = [
    {
      title: 'Un-Shipped Sales Orders',
      count: stats.unshippedSalesOrders,
      description: 'Sales orders ready for shipment',
      icon: ShoppingCart,
      color: 'bg-blue-500',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      textColor: 'text-blue-700',
      href: '/sales-orders?filter=unshipped',
      urgency: stats.unshippedSalesOrders > 0 ? 'medium' : 'none'
    },
    {
      title: 'Un-Received Purchase Orders',
      count: stats.unreceivedPurchaseOrders,
      description: 'Purchase orders awaiting receipt',
      icon: FileText,
      color: 'bg-green-500',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      textColor: 'text-green-700',
      href: '/purchase-orders?filter=unreceived',
      urgency: stats.unreceivedPurchaseOrders > 0 ? 'medium' : 'none'
    },
    {
      title: 'Shipments in Transit',
      count: stats.shipmentsInTransit,
      description: 'Shipments currently being delivered',
      icon: Truck,
      color: 'bg-purple-500',
      bgColor: 'bg-purple-50',
      borderColor: 'border-purple-200',
      textColor: 'text-purple-700',
      href: '/shipments?filter=in-transit',
      urgency: stats.shipmentsInTransit > 0 ? 'low' : 'none'
    },
    {
      title: 'Sales Orders without Invoices',
      count: stats.salesOrdersWithoutInvoices,
      description: 'Orders that need invoicing',
      icon: Receipt,
      color: 'bg-orange-500',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      textColor: 'text-orange-700',
      href: '/sales-orders?filter=uninvoiced',
      urgency: stats.salesOrdersWithoutInvoices > 0 ? 'high' : 'none'
    },
    {
      title: 'Draft Invoices',
      count: stats.draftInvoices,
      description: 'Invoices not yet sent to customers',
      icon: Send,
      color: 'bg-red-500',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      textColor: 'text-red-700',
      href: '/invoices?filter=draft',
      urgency: stats.draftInvoices > 0 ? 'high' : 'none'
    }
  ]

  const getUrgencyIndicator = (urgency: string) => {
    switch (urgency) {
      case 'high':
        return <div className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
      case 'medium':
        return <div className="absolute top-2 right-2 w-3 h-3 bg-yellow-500 rounded-full"></div>
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Section */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-1">
          Quick access to items that need your attention
        </p>
      </div>

      {/* Quick Access Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {quickAccessTiles.map((tile) => {
          const Icon = tile.icon
          return (
            <Link
              key={tile.title}
              to={tile.href}
              className={`relative block p-6 rounded-lg border-2 transition-all duration-200 hover:shadow-lg hover:scale-105 ${tile.bgColor} ${tile.borderColor} hover:border-opacity-60`}
            >
              {getUrgencyIndicator(tile.urgency)}
              
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center mb-3">
                    <div className={`p-2 rounded-lg ${tile.color}`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="ml-3">
                      <div className={`text-3xl font-bold ${tile.textColor}`}>
                        {tile.count}
                      </div>
                    </div>
                  </div>
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {tile.title}
                  </h3>
                  
                  <p className="text-sm text-gray-600 mb-3">
                    {tile.description}
                  </p>
                  
                  {tile.count > 0 && (
                    <div className="flex items-center text-sm font-medium text-gray-700">
                      <span>View all</span>
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </div>
                  )}
                </div>
              </div>
              
              {tile.urgency === 'high' && tile.count > 0 && (
                <div className="absolute bottom-2 left-2">
                  <div className="flex items-center text-xs font-medium text-red-600">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Needs attention
                  </div>
                </div>
              )}
            </Link>
          )
        })}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
        </div>
        <div className="p-6">
          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Activity tracking coming soon</h3>
            <p className="text-gray-600">Recent system activity will be displayed here.</p>
          </div>
        </div>
      </div>
    </div>
  )
}