import { CommercialDocumentList } from '../commercial/CommercialDocumentList'

export function SalesOrdersPage() {
  return (
    <CommercialDocumentList
      docType="SO"
      title="Sales Orders"
      createPath="/sales-orders/new"
    />
  )
}