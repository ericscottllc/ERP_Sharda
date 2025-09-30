import { CommercialDocumentEdit } from '../commercial/CommercialDocumentEdit'

export function EditSalesOrderPage() {
  return (
    <CommercialDocumentEdit
      docType="SO"
      title="Sales Orders"
      listPath="/sales-orders"
    />
  )
}