import { CommercialDocumentList } from '../commercial/CommercialDocumentList'

export function PurchaseOrdersPage() {
  return (
    <CommercialDocumentList
      docType="PO"
      title="Purchase Orders"
      createPath="/purchase-orders/new"
    />
  )
}