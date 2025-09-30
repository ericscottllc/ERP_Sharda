import { useParams } from 'react-router-dom'
import { InvoiceForm } from '../invoice/InvoiceForm'

export function EditInvoicePage() {
  const { id } = useParams<{ id: string }>()

  return (
    <InvoiceForm
      mode="edit"
      invoiceId={id || null}
    />
  )
}