import { CommercialDocumentDetail } from '../commercial/CommercialDocumentDetail'

export function PurchaseOrderDetailPage() {
  return (
    <CommercialDocumentDetail
      docType="PO"
      title="Purchase Orders"
      listPath="/purchase-orders"
    />
  )
}