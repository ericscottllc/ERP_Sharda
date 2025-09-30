import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { InvoiceHeader, InvoiceLine } from '../types/database'

export function useInvoices() {
  const [invoices, setInvoices] = useState<InvoiceHeader[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchInvoices()
  }, [])

  const fetchInvoices = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('invoice_hdr')
        .select(`
          *,
          sales_order:so_hdr_id (
            id,
            doc_no,
            doc_type,
            status,
            order_date,
            party:party_id (
              display_name
            )
          ),
          shipment:shipment_hdr_id (
            id,
            doc_type,
            status,
            effective_date
          ),
          terms:terms_id (
            id,
            name,
            description
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setInvoices(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return { invoices, loading, error, refetch: fetchInvoices }
}

export function useInvoiceDetail(invoiceId: string | null) {
  const [invoice, setInvoice] = useState<InvoiceHeader | null>(null)
  const [lines, setLines] = useState<InvoiceLine[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (invoiceId) {
      fetchInvoiceDetail(invoiceId)
    }
  }, [invoiceId])

  const fetchInvoiceDetail = async (invoiceId: string) => {
    try {
      setLoading(true)
      
      // Fetch invoice header
      const { data: headerData, error: headerError } = await supabase
        .from('invoice_hdr')
        .select(`
          *,
          sales_order:so_hdr_id (
            id,
            doc_no,
            doc_type,
            status,
            order_date,
            party:party_id (
              display_name,
              email,
              phone
            ),
            primary_warehouse:primary_warehouse_id (
              name,
              code
            )
          ),
          shipment:shipment_hdr_id (
            id,
            doc_type,
            status,
            effective_date,
            movement_ext (
              carrier_name,
              tracking_number
            )
          ),
          terms:terms_id (
            id,
            name,
            description
          )
        `)
        .eq('id', invoiceId)
        .single()

      if (headerError) throw headerError
      if (!headerData) throw new Error('Invoice not found')

      // Fetch invoice lines
      const { data: linesData, error: linesError } = await supabase
        .from('invoice_line')
        .select(`
          *,
          sales_order_line:so_line_id (
            id,
            line_no,
            item_name,
            qty_ordered,
            status,
            requested_date,
            promise_date
          ),
          item:item_name (
            item_name,
            product_name,
            pack_size_details:pack_size (
              pack_size,
              units_per_each,
              volume_per_unit,
              units_of_units,
              package_type,
              uom_per_each
            )
          )
        `)
        .eq('invoice_hdr_id', invoiceId)
        .order('line_no')

      if (linesError) throw linesError

      setInvoice(headerData)
      setLines(linesData || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return { invoice, lines, loading, error, refetch: () => invoiceId && fetchInvoiceDetail(invoiceId) }
}

export function useSalesOrderInvoices(soHdrId: string | null) {
  const [invoices, setInvoices] = useState<InvoiceHeader[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (soHdrId) {
      fetchSalesOrderInvoices(soHdrId)
    }
  }, [soHdrId])

  const fetchSalesOrderInvoices = async (soHdrId: string) => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('invoice_hdr')
        .select(`
          *,
          shipment:shipment_hdr_id (
            id,
            doc_type,
            status,
            effective_date,
            movement_ext (
              carrier_name,
              tracking_number
            )
          ),
          terms:terms_id (
            id,
            name,
            description
          ),
          invoice_line (
            id,
            qty_invoiced,
            price
          )
        `)
        .eq('so_hdr_id', soHdrId)
        .order('created_at', { ascending: false })

      if (error) throw error
      setInvoices(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return { invoices, loading, error, refetch: () => soHdrId && fetchSalesOrderInvoices(soHdrId) }
}