export interface Party {
  id: string
  type: 'company' | 'person'
  display_name: string
  initials: string
  is_active: boolean
  is_customer?: boolean
  is_vendor?: boolean
  email?: string
  phone?: string
  created_at: string
  updated_at: string
}

export interface Address {
  id: string
  line1: string
  line2?: string
  city: string
  region?: string
  postal_code?: string
  country: string
  created_at: string
  updated_at: string
}

export interface PartyAddress {
  party_id: string
  address_id: string
  use: 'ship_to' | 'bill_to' | 'remit_to' | 'other'
  is_default: boolean
  valid_from?: string
  valid_to?: string
  address: Address
}

export interface Warehouse {
  id: string
  code: string
  name: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CommercialHeader {
  id: string
  doc_type: 'SO' | 'PO' | 'TO'
  doc_no: string
  status: string
  party_id?: string
  bill_to_address_id?: string
  ship_to_address_id?: string
  primary_warehouse_id: string
  secondary_warehouse_id?: string
  order_date: string
  requested_date?: string
  note?: string
  created_by?: string
  created_at: string
  updated_by?: string
  updated_at: string
  terms_id?: string
  customer_ref?: string
  party?: Party
  primary_warehouse?: Warehouse
  secondary_warehouse?: Warehouse
  terms?: Term
}

export interface Item {
  item_name: string
  product_name?: string
  pack_size?: string
  pack_size_details?: PackSize
}

export interface PackSize {
  pack_size: string
  id?: number
  units_per_each?: number
  volume_per_unit?: number
  units_of_units?: string
  package_type?: string
  uom_per_each?: number
  eaches_per_pallet?: number
  pallets_per_tl?: number
  eaches_per_tl?: number
}

export interface Tag {
  id: string
  name: string
  description?: string
  color: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface CommercialLineTag {
  commercial_line_id: string
  tag_id: string
  created_at: string
  created_by?: string
  tag?: Tag
}

export interface CommercialLine {
  id: string
  hdr_id: string
  line_no: number
  item_name: string
  qty_ordered: number
  requested_date?: string
  promise_date?: string
  cancel_after?: string
  lot_number?: string
  status: string
  warehouse_id?: string
  secondary_warehouse_id?: string
  created_at: string
  updated_at: string
  tags?: CommercialLineTag[]
}

export interface CreateCommercialLineRequest {
  id?: string
  line_no: number
  item_name: string
  qty_ordered: number
  qty_ordered_uom?: number
  requested_date?: string
  promise_date?: string
  cancel_after?: string
  lot_number?: string
  warehouse_id?: string
  secondary_warehouse_id?: string
  pack_size_details?: PackSize
  warning?: string
  pack_size_details?: PackSize
}

export type DocType = 'SO' | 'PO' | 'TO'

export interface CreateCommercialHeaderRequest {
  doc_type: DocType
  doc_no?: string
  default_inventory_state: 'Stock' | 'Consignment' | 'Hold'
  terms_id?: string
  party_id?: string
  bill_to_address_id?: string
  ship_to_address_id?: string
  primary_warehouse_id: string
  secondary_warehouse_id?: string
  order_date: string
  requested_date?: string
  note?: string
  pack_size_details?: PackSize
}

export interface CreateAddressRequest {
  line1: string
  line2?: string
  city: string
  region?: string
  postal_code?: string
  country: string
}

export interface Term {
  id: string
  name: string
  description?: string
  created_at: string
  updated_at: string
}

export interface InvoiceHeader {
  id: string
  so_hdr_id: string
  shipment_hdr_id?: string
  invoice_no: string
  invoice_date: string
  due_date?: string
  terms_id?: string
  status: 'Draft' | 'Issued' | 'Paid' | 'Canceled'
  note?: string
  pdf_url?: string
  created_at: string
  updated_at: string
  sales_order?: CommercialHeader
  shipment?: any
  terms?: Term
}

export interface InvoiceLine {
  id: string
  invoice_hdr_id: string
  so_line_id: string
  line_no: number
  item_name: string
  qty_invoiced: number
  uom?: string
  price?: number
  created_at: string
  updated_at: string
  sales_order_line?: CommercialLine
  item?: Item
}

export interface MovementHeader {
  id: string
  doc_type: 'Shipment' | 'Receipt' | 'Adjustment' | 'Return_In' | 'Return_Out' | 'Transfer'
  status: 'Draft' | 'Posted' | 'Canceled'
  physical_status?: 'Pending Pickup' | 'In Transit' | 'Delivered' | 'Pending Delivery' | 'Received'
  effective_date: string
  posted_at?: string
  primary_warehouse_id: string
}