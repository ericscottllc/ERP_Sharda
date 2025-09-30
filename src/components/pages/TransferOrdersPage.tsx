import { CommercialDocumentList } from '../commercial/CommercialDocumentList'

export function TransferOrdersPage() {
  return (
    <CommercialDocumentList
      docType="TO"
      title="Transfer Orders"
      createPath="/transfer-orders/new"
    />
  )
}