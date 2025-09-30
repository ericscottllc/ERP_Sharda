import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useAuth } from './components/auth/useAuth'
import { LoginForm } from './components/auth/LoginForm'
import { Layout } from './components/layout/Layout'
import { DashboardPage } from './components/pages/DashboardPage'
import { NotFoundPage } from './components/pages/NotFoundPage'
import { SalesOrdersPage } from './components/pages/SalesOrdersPage'
import { PurchaseOrdersPage } from './components/pages/PurchaseOrdersPage'
import { TransferOrdersPage } from './components/pages/TransferOrdersPage'
import { CreateSalesOrderPage } from './components/pages/CreateSalesOrderPage'
import { CreatePurchaseOrderPage } from './components/pages/CreatePurchaseOrderPage'
import { CreateTransferOrderPage } from './components/pages/CreateTransferOrderPage'
import { SalesOrderDetailPage } from './components/pages/SalesOrderDetailPage'
import { PurchaseOrderDetailPage } from './components/pages/PurchaseOrderDetailPage'
import { TransferOrderDetailPage } from './components/pages/TransferOrderDetailPage'
import { CreateReceiptPage } from './components/pages/CreateReceiptPage'
import { CreateShipmentPage } from './components/pages/CreateShipmentPage'
import { CreateTransferPage } from './components/pages/CreateTransferPage'
import { EditSalesOrderPage } from './components/pages/EditSalesOrderPage'
import { EditPurchaseOrderPage } from './components/pages/EditPurchaseOrderPage'
import { EditTransferOrderPage } from './components/pages/EditTransferOrderPage'
import { EditShipmentPage } from './components/pages/EditShipmentPage'
import { EditReceiptPage } from './components/pages/EditReceiptPage'
import { EditAdjustmentPage } from './components/pages/EditAdjustmentPage'
import { ItemsPage } from './components/pages/ItemsPage'
import { ItemDetailPage } from './components/pages/ItemDetailPage'
import { ShipmentsPage } from './components/pages/ShipmentsPage'
import { ReceiptsPage } from './components/pages/ReceiptsPage'
import { AdjustmentsPage } from './components/pages/AdjustmentsPage'
import { CreateAdjustmentPage } from './components/pages/CreateAdjustmentPage'
import { ShipmentDetailPage } from './components/pages/ShipmentDetailPage'
import { ReceiptDetailPage } from './components/pages/ReceiptDetailPage'
import { AdjustmentDetailPage } from './components/pages/AdjustmentDetailPage'
import { InvoicesPage } from './components/pages/InvoicesPage'
import { CreateInvoicePage } from './components/pages/CreateInvoicePage'
import { InvoiceDetailPage } from './components/pages/InvoiceDetailPage'
import { EditInvoicePage } from './components/pages/EditInvoicePage'

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sharda-primary mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginForm />
  }

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/sales-orders" element={<SalesOrdersPage />} />
          <Route path="/sales-orders/new" element={<CreateSalesOrderPage />} />
          <Route path="/sales-orders/:id" element={<SalesOrderDetailPage />} />
          <Route path="/sales-orders/:id/edit" element={<EditSalesOrderPage />} />
          <Route path="/purchase-orders" element={<PurchaseOrdersPage />} />
          <Route path="/purchase-orders/new" element={<CreatePurchaseOrderPage />} />
          <Route path="/purchase-orders/:id" element={<PurchaseOrderDetailPage />} />
          <Route path="/purchase-orders/:id/edit" element={<EditPurchaseOrderPage />} />
          <Route path="/transfer-orders" element={<TransferOrdersPage />} />
          <Route path="/transfer-orders/new" element={<CreateTransferOrderPage />} />
          <Route path="/transfer-orders/:id" element={<TransferOrderDetailPage />} />
          <Route path="/transfer-orders/:id/edit" element={<EditTransferOrderPage />} />
          <Route path="/items" element={<ItemsPage />} />
          <Route path="/items/:itemName" element={<ItemDetailPage />} />
          <Route path="/shipments" element={<ShipmentsPage />} />
          <Route path="/shipments/new" element={<CreateShipmentPage />} />
          <Route path="/shipments/:id" element={<ShipmentDetailPage />} />
          <Route path="/shipments/:id/edit" element={<EditShipmentPage />} />
          <Route path="/receipts" element={<ReceiptsPage />} />
          <Route path="/receipts/new" element={<CreateReceiptPage />} />
          <Route path="/receipts/:id" element={<ReceiptDetailPage />} />
          <Route path="/receipts/:id/edit" element={<EditReceiptPage />} />
          <Route path="/adjustments" element={<AdjustmentsPage />} />
          <Route path="/adjustments/new" element={<CreateAdjustmentPage />} />
          <Route path="/adjustments/:id" element={<AdjustmentDetailPage />} />
          <Route path="/adjustments/:id/edit" element={<EditAdjustmentPage />} />
          <Route path="/invoices" element={<InvoicesPage />} />
          <Route path="/invoices/new" element={<CreateInvoicePage />} />
          <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
          <Route path="/invoices/:id/edit" element={<EditInvoicePage />} />
          <Route path="/transfers" element={<div className="p-6">Transfers List - Coming Soon</div>} />
          <Route path="/transfers/new" element={<CreateTransferPage />} />
          <Route path="/returns/new" element={<div className="p-6">Returns Form - Coming Soon</div>} />
          <Route path="/parties" element={<div className="p-6">Parties List - Coming Soon</div>} />
          <Route path="/parties/:id" element={<div className="p-6">Party Detail - Coming Soon</div>} />
          <Route path="/warehouses" element={<div className="p-6">Warehouses List - Coming Soon</div>} />
          <Route path="/warehouses/:id" element={<div className="p-6">Warehouse Detail - Coming Soon</div>} />
          <Route path="/reports" element={<div className="p-6">Reports - Coming Soon</div>} />
          <Route path="/settings" element={<div className="p-6">Settings - Coming Soon</div>} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Layout>
    </Router>
  )
}

export default App