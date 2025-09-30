import { CommercialDocumentForm } from '../commercial/CommercialDocumentForm'

export function CreateTransferOrderPage() {
  return (
    <CommercialDocumentForm
      docType="TO"
      title="Transfer Orders"
      backPath="/transfer-orders"
    />
  )
}