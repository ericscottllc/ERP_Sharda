import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface ParentRecord {
  id: string
  doc_type: string
  doc_no: string
}
export function Breadcrumbs() {
  const location = useLocation()
  const [parentRecord, setParentRecord] = useState<ParentRecord | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Check if we're on a movement detail page and fetch parent record
    const pathSegments = location.pathname.split('/').filter(Boolean)
    if (pathSegments.length === 2 && 
        ['shipments', 'receipts', 'adjustments'].includes(pathSegments[0]) &&
        pathSegments[1] !== 'new') {
      fetchParentRecord(pathSegments[0], pathSegments[1])
    } else {
      setParentRecord(null)
    }
  }, [location.pathname])

  const fetchParentRecord = async (movementType: string, movementId: string) => {
    try {
      setLoading(true)
      
      // Get the movement record and find its parent commercial document
      const { data: movementData, error: movementError } = await supabase
        .from('movement_hdr')
        .select(`
          id,
          movement_line (
            fulfillment_link (
              commercial_line (
                hdr_id,
                commercial_hdr:hdr_id (
                  id,
                  doc_type,
                  doc_no
                )
              )
            )
          )
        `)
        .eq('id', movementId)
        .single()

      if (movementError || !movementData) return

      // Extract the parent commercial document
      const fulfillmentLinks = movementData.movement_line?.[0]?.fulfillment_link
      if (fulfillmentLinks && fulfillmentLinks.length > 0) {
        const commercialHdr = fulfillmentLinks[0].commercial_line?.commercial_hdr
        if (commercialHdr) {
          setParentRecord({
            id: commercialHdr.id,
            doc_type: commercialHdr.doc_type,
            doc_no: commercialHdr.doc_no
          })
        }
      }
    } catch (err) {
      console.error('Error fetching parent record:', err)
    } finally {
      setLoading(false)
    }
  }
  
  const getBreadcrumbs = (): BreadcrumbItem[] => {
    const pathSegments = location.pathname.split('/').filter(Boolean)
    
    if (pathSegments.length === 0) {
      return [{ label: 'Dashboard' }]
    }

    const breadcrumbs: BreadcrumbItem[] = [
      { label: 'Dashboard', href: '/' }
    ]

    // Map path segments to readable labels
    const segmentLabels: Record<string, string> = {
      'sales-orders': 'Sales Orders',
      'purchase-orders': 'Purchase Orders',
      'transfer-orders': 'Transfer Orders',
      'items': 'Items',
      'shipments': 'Shipments',
      'receipts': 'Receipts',
      'adjustments': 'Adjustments',
      'transfers': 'Transfers',
      'parties': 'Parties',
      'warehouses': 'Warehouses',
      'reports': 'Reports',
      'settings': 'Settings',
      'edit': 'Edit'
    }

    // Add parent record breadcrumb for movement records
    if (parentRecord && pathSegments.length >= 2 && 
        ['shipments', 'receipts', 'adjustments'].includes(pathSegments[0])) {
      
      const parentPath = getParentPath(parentRecord.doc_type)
      if (parentPath) {
        breadcrumbs.push({
          label: `${parentRecord.doc_type} ${parentRecord.doc_no}`,
          href: `${parentPath}/${parentRecord.id}`
        })
      }
    }
    let currentPath = ''
    pathSegments.forEach((segment, index) => {
      currentPath += `/${segment}`
      const isLast = index === pathSegments.length - 1
      
      // Check if it's a UUID or ID (for detail pages)
      const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(segment) || 
                  /^\d+$/.test(segment) ||
                  segment.length > 20 // Assume long strings are item names or other IDs

      if (isId) {
        breadcrumbs.push({
          label: `Record ${segment.substring(0, 8)}...`,
          href: isLast ? undefined : currentPath
        })
      } else {
        breadcrumbs.push({
          label: segmentLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1),
          href: isLast ? undefined : currentPath
        })
      }
    })

    return breadcrumbs
  }

  const getParentPath = (docType: string): string | null => {
    switch (docType) {
      case 'SO': return '/sales-orders'
      case 'PO': return '/purchase-orders'
      case 'TO': return '/transfer-orders'
      default: return null
    }
  }

  const breadcrumbs = getBreadcrumbs()

  return (
    <nav className="flex items-center space-x-2 text-sm">
      <Home className="h-4 w-4 text-gray-400" />
      {breadcrumbs.map((breadcrumb, index) => (
        <div key={index} className="flex items-center space-x-2">
          {index > 0 && <ChevronRight className="h-4 w-4 text-gray-400" />}
          {breadcrumb.href ? (
            <Link
              to={breadcrumb.href}
              className="text-gray-600 hover:text-sharda-primary transition-colors"
            >
              {breadcrumb.label}
            </Link>
          ) : (
            <span className="text-gray-900 font-medium">{breadcrumb.label}</span>
          )}
        </div>
      ))}
    </nav>
  )
}