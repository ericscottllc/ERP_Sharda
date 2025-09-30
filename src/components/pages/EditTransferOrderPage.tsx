import { CommercialDocumentEdit } from '../commercial/CommercialDocumentEdit'

export function EditTransferOrderPage() {
  return (
    <CommercialDocumentEdit
      docType="TO"
      title="Transfer Orders"
      listPath="/transfer-orders"
    />
  )
}