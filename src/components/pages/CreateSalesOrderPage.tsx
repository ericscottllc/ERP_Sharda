import { CommercialDocumentForm } from '../commercial/CommercialDocumentForm'

export function CreateSalesOrderPage() {
  return (
    <CommercialDocumentForm
      docType="SO"
      title="Sales Orders"
      backPath="/sales-orders"
    />
  )
}