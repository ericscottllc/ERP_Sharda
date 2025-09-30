import { CommercialDocumentEdit } from '../commercial/CommercialDocumentEdit'

export function EditPurchaseOrderPage() {
  return (
    <CommercialDocumentEdit
      docType="PO"
      title="Purchase Orders"
      listPath="/purchase-orders"
    />
  )
}