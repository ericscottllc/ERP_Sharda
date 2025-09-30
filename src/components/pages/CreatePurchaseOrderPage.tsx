import { CommercialDocumentForm } from '../commercial/CommercialDocumentForm'

export function CreatePurchaseOrderPage() {
  return (
    <CommercialDocumentForm
      docType="PO"
      title="Purchase Orders"
      backPath="/purchase-orders"
    />
  )
}