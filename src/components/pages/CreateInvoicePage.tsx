import { useSearchParams } from 'react-router-dom'
import { InvoiceForm } from '../invoice/InvoiceForm'

export function CreateInvoicePage() {
  const [searchParams] = useSearchParams()
  const soHdrId = searchParams.get('so_hdr_id')
  const shipmentHdrId = searchParams.get('shipment_hdr_id')

  return (
    <InvoiceForm
      mode="create"
      soHdrId={soHdrId}
      shipmentHdrId={shipmentHdrId}
    />
  )
}
