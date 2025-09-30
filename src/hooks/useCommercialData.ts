import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { 
  CommercialHeader, 
  Party, 
  Warehouse, 
  PartyAddress, 
  DocType, 
  Item,
  CreateAddressRequest,
  Term
} from '../types/database'

export function useCommercialDocuments(docType: DocType) {
  const [documents, setDocuments] = useState<CommercialHeader[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDocuments()
  }, [docType])

  const fetchDocuments = async () => {
    try {
      setLoading(true)
      
      // First fetch the commercial headers
      const { data: headers, error: headersError } = await supabase
        .from('commercial_hdr')
        .select(`
          *,
          commercial_line (
            id
          ),
          terms:terms_id (
            id,
            name,
            description
          )
        `)
        .eq('doc_type', docType)
        .order('created_at', { ascending: false })

      if (headersError) throw headersError
      if (!headers || headers.length === 0) {
        setDocuments([])
        return
      }

      // Get unique party and warehouse IDs
      const partyIds = [...new Set(headers.map(h => h.party_id).filter(Boolean))]
      const warehouseIds = [...new Set([
        ...headers.map(h => h.primary_warehouse_id),
        ...headers.map(h => h.secondary_warehouse_id).filter(Boolean)
      ])]

      // Fetch related data in parallel
      const [partiesResult, warehousesResult] = await Promise.all([
        partyIds.length > 0 
          ? supabase.from('party').select('id, display_name, initials').in('id', partyIds)
          : { data: [], error: null },
        warehouseIds.length > 0
          ? supabase.from('warehouse').select('id, code, name').in('id', warehouseIds)
          : { data: [], error: null }
      ])

      if (partiesResult.error) throw partiesResult.error
      if (warehousesResult.error) throw warehousesResult.error

      // Create lookup maps
      const partiesMap = new Map(partiesResult.data?.map(p => [p.id, p]) || [])
      const warehousesMap = new Map(warehousesResult.data?.map(w => [w.id, w]) || [])

      // Combine the data
      const documentsWithRelations = headers.map(header => ({
        ...header,
        party: header.party_id ? partiesMap.get(header.party_id) : null,
        primary_warehouse: warehousesMap.get(header.primary_warehouse_id) || null,
        secondary_warehouse: header.secondary_warehouse_id ? warehousesMap.get(header.secondary_warehouse_id) : null,
        terms: header.terms || null,
        line_count: header.commercial_line?.length || 0
      }))

      setDocuments(documentsWithRelations)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return { documents, loading, error, refetch: fetchDocuments }
}

interface PartyFilter {
  isCustomer?: boolean
  isVendor?: boolean
}

export function useParties(filter?: PartyFilter) {
  const [parties, setParties] = useState<Party[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchParties(filter)
  }, [filter?.isCustomer, filter?.isVendor])

  const fetchParties = async (filter?: PartyFilter) => {
    try {
      let query = supabase
        .from('party')
        .select('*')
        .eq('is_active', true)
        .order('display_name')

      // Apply filters if provided
      if (filter?.isCustomer !== undefined) {
        query = query.eq('is_customer', filter.isCustomer)
      }
      if (filter?.isVendor !== undefined) {
        query = query.eq('is_vendor', filter.isVendor)
      }

      const { data, error } = await query

      if (error) throw error
      setParties(data || [])
    } catch (err) {
      console.error('Error fetching parties:', err)
    } finally {
      setLoading(false)
    }
  }

  return { parties, loading }
}

export function useWarehouses() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchWarehouses()
  }, [])

  const fetchWarehouses = async () => {
    try {
      const { data, error } = await supabase
        .from('warehouse')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setWarehouses(data || [])
    } catch (err) {
      console.error('Error fetching warehouses:', err)
    } finally {
      setLoading(false)
    }
  }

  return { warehouses, loading }
}

export function useItems() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('item')
        .select(`
          item_name, 
          product_name, 
          pack_size,
          pack_size_details:pack_size (
            pack_size,
            id,
            units_per_each,
            volume_per_unit,
            units_of_units,
            package_type,
            uom_per_each,
            eaches_per_pallet,
            pallets_per_tl,
            eaches_per_tl
          )
        `)
        .order('item_name')

      if (error) throw error
      setItems(data || [])
    } catch (err) {
      console.error('Error fetching items:', err)
    } finally {
      setLoading(false)
    }
  }

  return { items, loading }
}

export function useTerms() {
  const [terms, setTerms] = useState<Term[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTerms()
  }, [])

  const fetchTerms = async () => {
    try {
      const { data, error } = await supabase
        .from('terms')
        .select('*')
        .order('name')

      if (error) throw error
      setTerms(data || [])
    } catch (err) {
      console.error('Error fetching terms:', err)
    } finally {
      setLoading(false)
    }
  }

  return { terms, loading }
}

export function usePartyAddresses(partyId: string | null) {
  const [addresses, setAddresses] = useState<PartyAddress[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (partyId) {
      fetchPartyAddresses(partyId)
    } else {
      setAddresses([])
    }
  }, [partyId])

  const fetchPartyAddresses = async (partyId: string) => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('party_address')
        .select(`
          *,
          address:address_id (
            id,
            line1,
            line2,
            city,
            region,
            postal_code,
            country
          )
        `)
        .eq('party_id', partyId)

      if (error) throw error
      setAddresses(data || [])
    } catch (err) {
      console.error('Error fetching party addresses:', err)
    } finally {
      setLoading(false)
    }
  }

  return { addresses, loading }
}

export async function createAddressAndPartyLink(
  partyId: string,
  addressData: CreateAddressRequest,
  use: 'ship_to' | 'bill_to' | 'remit_to' | 'other' = 'ship_to',
  isDefault: boolean = false
): Promise<string> {
  try {
    // First, create the address
    const { data: address, error: addressError } = await supabase
      .from('address')
      .insert([addressData])
      .select('id')
      .single()

    if (addressError) throw addressError
    if (!address) throw new Error('Failed to create address')

    // Then, link it to the party
    const { error: linkError } = await supabase
      .from('party_address')
      .insert([{
        party_id: partyId,
        address_id: address.id,
        use: use,
        is_default: isDefault
      }])

    if (linkError) throw linkError

    return address.id
  } catch (error) {
    console.error('Error creating address and party link:', error)
    throw error
  }
}