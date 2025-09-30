import { CommercialDocumentDetail } from '../commercial/CommercialDocumentDetail'

export function SalesOrderDetailPage() {
  return (
    <CommercialDocumentDetail
      docType="SO"
      title="Sales Orders"
      listPath="/sales-orders"
    />
  )
}