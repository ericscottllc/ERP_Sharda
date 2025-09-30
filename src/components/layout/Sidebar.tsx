import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { 
  BarChart3, 
  Package, 
  Users, 
  ShoppingCart, 
  FileText, 
  Truck, 
  Warehouse, 
  Settings,
  ChevronLeft,
  ChevronRight,
  Home,
  ClipboardList,
  ArrowUpDown
} from 'lucide-react'

const navigationItems = [
  { name: 'Dashboard', href: '/', icon: Home },
  { 
    name: 'Commercial', 
    icon: ClipboardList,
    children: [
      { name: 'Sales Orders', href: '/sales-orders', icon: ShoppingCart },
      { name: 'Purchase Orders', href: '/purchase-orders', icon: FileText },
      { name: 'Transfer Orders', href: '/transfer-orders', icon: ArrowUpDown },
      { name: 'Invoices', href: '/invoices', icon: FileText },
    ]
  },
  { 
    name: 'Inventory', 
    icon: Package,
    children: [
      { name: 'Items', href: '/items', icon: Package },
      { name: 'Shipments', href: '/shipments', icon: Truck },
      { name: 'Receipts', href: '/receipts', icon: Package },
      { name: 'Adjustments', href: '/adjustments', icon: Package },
      { name: 'Transfers', href: '/transfers', icon: ArrowUpDown },
    ]
  },
  { name: 'Parties', href: '/parties', icon: Users },
  { name: 'Warehouses', href: '/warehouses', icon: Warehouse },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [expandedItems, setExpandedItems] = useState<string[]>(['Commercial', 'Inventory'])
  const location = useLocation()

  const toggleExpanded = (itemName: string) => {
    setExpandedItems(prev => 
      prev.includes(itemName) 
        ? prev.filter(name => name !== itemName)
        : [...prev, itemName]
    )
  }

  const isActive = (href: string) => {
    if (href === '/') {
      return location.pathname === '/'
    }
    return location.pathname.startsWith(href)
  }

  return (
    <div className={`bg-white shadow-lg transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-64'
    } flex flex-col`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        {!isCollapsed && (
          <div className="flex items-center">
            <div className="h-8 w-8 bg-sharda-primary rounded-lg flex items-center justify-center mr-3">
              <BarChart3 className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-lg font-bold text-gray-900">Sharda ERP</h1>
          </div>
        )}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1 rounded-md hover:bg-gray-100 transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4 text-gray-600" />
          ) : (
            <ChevronLeft className="h-4 w-4 text-gray-600" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigationItems.map((item) => {
          const Icon = item.icon
          const hasChildren = 'children' in item
          const isExpanded = expandedItems.includes(item.name)

          if (hasChildren) {
            return (
              <div key={item.name}>
                <button
                  onClick={() => !isCollapsed && toggleExpanded(item.name)}
                  className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    isCollapsed 
                      ? 'justify-center' 
                      : 'justify-between'
                  } hover:bg-gray-100 text-gray-700`}
                  title={isCollapsed ? item.name : undefined}
                >
                  <div className="flex items-center">
                    <Icon className="h-5 w-5 mr-3" />
                    {!isCollapsed && <span>{item.name}</span>}
                  </div>
                  {!isCollapsed && (
                    <ChevronRight className={`h-4 w-4 transition-transform ${
                      isExpanded ? 'rotate-90' : ''
                    }`} />
                  )}
                </button>
                
                {!isCollapsed && isExpanded && (
                  <div className="ml-6 mt-1 space-y-1">
                    {item.children.map((child) => {
                      const ChildIcon = child.icon
                      return (
                        <Link
                          key={child.name}
                          to={child.href}
                          className={`flex items-center px-3 py-2 text-sm rounded-md transition-colors ${
                            isActive(child.href)
                              ? 'bg-sharda-primary text-white'
                              : 'text-gray-600 hover:bg-gray-100'
                          }`}
                        >
                          <ChildIcon className="h-4 w-4 mr-3" />
                          <span>{child.name}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          return (
            <Link
              key={item.name}
              to={item.href}
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                isCollapsed ? 'justify-center' : ''
              } ${
                isActive(item.href)
                  ? 'bg-sharda-primary text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              title={isCollapsed ? item.name : undefined}
            >
              <Icon className="h-5 w-5 mr-3" />
              {!isCollapsed && <span>{item.name}</span>}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}