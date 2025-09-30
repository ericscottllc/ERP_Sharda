import { CommercialDocumentDetail } from '../commercial/CommercialDocumentDetail'

export function TransferOrderDetailPage() {
  return (
    <CommercialDocumentDetail
      docType="TO"
      title="Transfer Orders"
      listPath="/transfer-orders"
    />
  )
}