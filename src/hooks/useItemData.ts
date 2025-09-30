import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export interface ItemDetail {
  item_name: string
  product_name?: string
  pack_size?: string
  product?: {
    product_name: string
    registrant?: string
    product_type?: string
  }
  pack_size_details?: {
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
}

export interface InventoryBalance {
  item_name: string
  warehouse_id: string
  inventory_state: 'Stock' | 'Consignment' | 'Hold'
  qty_on_hand_base: number
  warehouse?: {
    id: string
    code: string
    name: string
  }
}

export interface ItemTransaction {
  id: string
  transaction_type: 'movement' | 'commercial'
  doc_type: string
  doc_no?: string
  line_no: number
  qty_base?: number
  qty_ordered?: number
  effective_date?: string
  order_date?: string
  status: string
  warehouse_id?: string
  inventory_state?: string
  lot_number?: string
  created_at: string
  warehouse?: {
    id: string
    code: string
    name: string
  }
  commercial_hdr?: {
    id: string
    doc_no: string
    doc_type: string
    status: string
    order_date: string
    party?: {
      display_name: string
    }
  }
  movement_hdr?: {
    id: string
    doc_type: string
    status: string
    effective_date: string
  }
}

export interface RelatedDocument {
  id: string
  doc_type: string
  doc_no: string
  status: string
  order_date: string
  party_display_name?: string
  line_count: number
  total_quantity: number
  warehouse_name?: string
}

export function useItems() {
  const [items, setItems] = useState<ItemDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchItems()
  }, [])

  const fetchItems = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('item')
        .select(`
          item_name,
          product_name,
          pack_size,
          product:product_name (
            product_name,
            registrant,
            product_type
          ),
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
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return { items, loading, error, refetch: fetchItems }
}

export function useItemDetail(itemName: string | null) {
  const [item, setItem] = useState<ItemDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (itemName) {
      fetchItemDetail(itemName)
    }
  }, [itemName])

  const fetchItemDetail = async (itemName: string) => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('item')
        .select(`
          item_name,
          product_name,
          pack_size,
          product:product_name (
            product_name,
            registrant,
            product_type
          ),
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
        .eq('item_name', itemName)
        .single()

      if (error) throw error
      setItem(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return { item, loading, error, refetch: () => itemName && fetchItemDetail(itemName) }
}

export function useItemInventory(itemName: string | null) {
  const [inventory, setInventory] = useState<InventoryBalance[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (itemName) {
      fetchInventory(itemName)
    }
  }, [itemName])

  const fetchInventory = async (itemName: string) => {
    try {
      setLoading(true)
      
      // Query movement_line directly to calculate current inventory
      const { data: movementData, error: movementError } = await supabase
        .from('movement_line')
        .select(`
          item_name,
          warehouse_id,
          inventory_state,
          qty_base,
          movement_hdr!inner(status, effective_date)
        `)
        .eq('item_name', itemName)
        .eq('movement_hdr.status', 'Posted')
        .order('warehouse_id', { ascending: true })

      if (movementError) throw movementError

      if (!movementData || movementData.length === 0) {
        setInventory([])
        return
      }

      // Calculate current inventory by summing movement quantities
      const inventoryMap = new Map<string, number>()
      const warehouseStateMap = new Map<string, { warehouse_id: string; inventory_state: string }>()

      movementData.forEach((movement) => {
        const key = `${movement.warehouse_id}-${movement.inventory_state}`
        const currentQty = inventoryMap.get(key) || 0
        inventoryMap.set(key, currentQty + Number(movement.qty_base))
        warehouseStateMap.set(key, {
          warehouse_id: movement.warehouse_id,
          inventory_state: movement.inventory_state
        })
      })

      // Filter out zero or negative quantities and convert to array
      const inventoryData = Array.from(inventoryMap.entries())
        .filter(([_, qty]) => qty > 0)
        .map(([key, qty]) => {
          const { warehouse_id, inventory_state } = warehouseStateMap.get(key)!
          return {
            item_name: itemName,
            warehouse_id,
            inventory_state,
            qty_on_hand_base: qty
          }
        })

      if (inventoryData.length === 0) {
        setInventory([])
        return
      }

      // Extract unique warehouse IDs
      const warehouseIds = [...new Set(inventoryData.map(item => item.warehouse_id))]

      // Fetch warehouse details separately
      const { data: warehouseData, error: warehouseError } = await supabase
        .from('warehouse')
        .select('id, code, name')
        .in('id', warehouseIds)

      if (warehouseError) throw warehouseError

      // Fetch pack size details for the item
      const { data: itemData, error: itemError } = await supabase
        .from('item')
        .select(`
          pack_size_details:pack_size (
            pack_size,
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
        .eq('item_name', itemName)
        .single()

      if (itemError) throw itemError

      // Create a warehouse lookup map
      const warehouseMap = new Map(
        (warehouseData || []).map(wh => [wh.id, wh])
      )

      // Merge inventory data with warehouse details
      const mergedInventory = inventoryData.map(item => ({
        ...item,
        warehouse: warehouseMap.get(item.warehouse_id) || null,
        pack_size_details: itemData?.pack_size_details || null
      }))

      setInventory(mergedInventory)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return { inventory, loading, error, refetch: () => itemName && fetchInventory(itemName) }
}

export function useItemTransactions(itemName: string | null) {
  const [transactions, setTransactions] = useState<ItemTransaction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (itemName) {
      fetchTransactions(itemName)
    }
  }, [itemName])

  const fetchTransactions = async (itemName: string) => {
    try {
      setLoading(true)
      
      // Fetch movement transactions
      const { data: movementData, error: movementError } = await supabase
        .from('movement_line')
        .select(`
          id,
          line_no,
          qty_base,
          effective_date,
          inventory_state,
          lot_number,
          warehouse_id,
          created_at,
          item:item_name (
            pack_size_details:pack_size (
              pack_size,
              units_per_each,
              volume_per_unit,
              units_of_units,
              package_type,
              uom_per_each,
              eaches_per_pallet,
              pallets_per_tl,
              eaches_per_tl
            )
          ),
          warehouse:warehouse_id (
            id,
            code,
            name
          ),
          movement_hdr:hdr_id (
            id,
            doc_type,
            status,
            effective_date
          )
        `)
        .eq('item_name', itemName)
        .order('effective_date', { ascending: false })
        .limit(100)

      if (movementError) throw movementError

      // Fetch commercial transactions
      const { data: commercialData, error: commercialError } = await supabase
        .from('commercial_line')
        .select(`
          id,
          line_no,
          qty_ordered,
          status,
          warehouse_id,
          inventory_state,
          lot_number,
          created_at,
          item:item_name (
            pack_size_details:pack_size (
              pack_size,
              units_per_each,
              volume_per_unit,
              units_of_units,
              package_type,
              uom_per_each,
              eaches_per_pallet,
              pallets_per_tl,
              eaches_per_tl
            )
          ),
          warehouse:warehouse_id (
            id,
            code,
            name
          ),
          commercial_hdr:hdr_id (
            id,
            doc_no,
            doc_type,
            status,
            order_date,
            party:party_id (
              display_name
            )
          )
        `)
        .eq('item_name', itemName)
        .order('created_at', { ascending: false })
        .limit(100)

      if (commercialError) throw commercialError

      // Combine and format transactions
      const movementTransactions: ItemTransaction[] = (movementData || []).map(item => ({
        id: item.id,
        transaction_type: 'movement' as const,
        doc_type: item.movement_hdr?.doc_type || 'Unknown',
        line_no: item.line_no,
        qty_base: item.qty_base,
        effective_date: item.effective_date,
        status: item.movement_hdr?.status || 'Unknown',
        warehouse_id: item.warehouse_id,
        inventory_state: item.inventory_state,
        lot_number: item.lot_number,
        created_at: item.created_at,
        warehouse: item.warehouse,
        movement_hdr: item.movement_hdr,
        pack_size_details: item.item?.pack_size_details
      }))

      const commercialTransactions: ItemTransaction[] = (commercialData || []).map(item => ({
        id: item.id,
        transaction_type: 'commercial' as const,
        doc_type: item.commercial_hdr?.doc_type || 'Unknown',
        doc_no: item.commercial_hdr?.doc_no,
        line_no: item.line_no,
        qty_ordered: item.qty_ordered,
        order_date: item.commercial_hdr?.order_date,
        status: item.status,
        warehouse_id: item.warehouse_id,
        inventory_state: item.inventory_state,
        lot_number: item.lot_number,
        created_at: item.created_at,
        warehouse: item.warehouse,
        commercial_hdr: item.commercial_hdr,
        pack_size_details: item.item?.pack_size_details
      }))

      // Combine and sort by date
      const allTransactions = [...movementTransactions, ...commercialTransactions]
      allTransactions.sort((a, b) => {
        const dateA = new Date(a.effective_date || a.order_date || a.created_at)
        const dateB = new Date(b.effective_date || b.order_date || b.created_at)
        return dateB.getTime() - dateA.getTime()
      })

      setTransactions(allTransactions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return { transactions, loading, error, refetch: () => itemName && fetchTransactions(itemName) }
}

export function useItemRelatedDocuments(itemName: string | null) {
  const [documents, setDocuments] = useState<RelatedDocument[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (itemName) {
      fetchRelatedDocuments(itemName)
    }
  }, [itemName])

  const fetchRelatedDocuments = async (itemName: string) => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('commercial_hdr')
        .select(`
          id,
          doc_type,
          doc_no,
          status,
          order_date,
          party:party_id (
            display_name
          ),
          primary_warehouse:primary_warehouse_id (
            name
          ),
          commercial_line!inner (
            id,
            item_name,
            qty_ordered,
            item:item_name (
              pack_size_details:pack_size (
                pack_size,
                units_per_each,
                volume_per_unit,
                units_of_units,
                package_type,
                uom_per_each,
                eaches_per_pallet,
                pallets_per_tl,
                eaches_per_tl
              )
            )
          )
        `)
        .eq('commercial_line.item_name', itemName)
        .order('order_date', { ascending: false })

      if (error) throw error

      // Process the data to aggregate line information
      const processedDocuments: RelatedDocument[] = (data || []).map(doc => ({
        id: doc.id,
        doc_type: doc.doc_type,
        doc_no: doc.doc_no,
        status: doc.status,
        order_date: doc.order_date,
        party_display_name: doc.party?.display_name,
        line_count: doc.commercial_line?.length || 0,
        total_quantity: doc.commercial_line?.reduce((sum, line) => sum + parseFloat(line.qty_ordered), 0) || 0,
        warehouse_name: doc.primary_warehouse?.name,
        pack_size_details: doc.commercial_line?.[0]?.item?.pack_size_details
      }))

      setDocuments(processedDocuments)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return { documents, loading, error, refetch: () => itemName && fetchRelatedDocuments(itemName) }
}