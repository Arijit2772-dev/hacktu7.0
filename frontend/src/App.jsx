import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/auth/ProtectedRoute'
import LoadingSpinner from './components/common/LoadingSpinner'
import { useAuth } from './contexts/AuthContext'

const LandingPage = lazy(() => import('./pages/LandingPage'))
const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const RegisterPage = lazy(() => import('./pages/auth/RegisterPage'))

const AdminLayout = lazy(() => import('./layouts/AdminLayout'))
const DealerLayout = lazy(() => import('./layouts/DealerLayout'))
const CustomerLayout = lazy(() => import('./layouts/CustomerLayout'))

const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'))
const DemandForecast = lazy(() => import('./pages/admin/DemandForecast'))
const DeadStock = lazy(() => import('./pages/admin/DeadStock'))
const Transfers = lazy(() => import('./pages/admin/Transfers'))
const DealerPerformance = lazy(() => import('./pages/admin/DealerPerformance'))
const ProductManagement = lazy(() => import('./pages/admin/ProductManagement'))
const WarehouseManagement = lazy(() => import('./pages/admin/WarehouseManagement'))
const AuditLogs = lazy(() => import('./pages/admin/AuditLogs'))

const DealerDashboard = lazy(() => import('./pages/dealer/Dashboard'))
const SmartOrders = lazy(() => import('./pages/dealer/SmartOrders'))
const OrderTracking = lazy(() => import('./pages/dealer/OrderTracking'))
const PlaceOrder = lazy(() => import('./pages/dealer/PlaceOrder'))
const OrderDetail = lazy(() => import('./pages/dealer/OrderDetail'))
const DealerProfile = lazy(() => import('./pages/dealer/Profile'))
const CustomerRequests = lazy(() => import('./pages/dealer/CustomerRequests'))

const ShadeCatalog = lazy(() => import('./pages/customer/ShadeCatalog'))
const ShadeDetail = lazy(() => import('./pages/customer/ShadeDetail'))
const FindNearMe = lazy(() => import('./pages/customer/FindNearMe'))
const SnapAndFind = lazy(() => import('./pages/customer/SnapAndFind'))
const Cart = lazy(() => import('./pages/customer/Cart'))
const Wishlist = lazy(() => import('./pages/customer/Wishlist'))
const MyOrders = lazy(() => import('./pages/customer/MyOrders'))

const NotificationsPage = lazy(() => import('./pages/common/NotificationsPage'))

function roleHome(role) {
  if (role === 'admin') return '/admin'
  if (role === 'dealer') return '/dealer'
  return '/customer'
}

function RootRedirect() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={roleHome(user.role)} replace />
}

export default function App() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    }>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/app" element={<RootRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/admin" element={
          <ProtectedRoute role="admin"><AdminLayout /></ProtectedRoute>
        }>
          <Route index element={<AdminDashboard />} />
          <Route path="forecast" element={<DemandForecast />} />
          <Route path="dead-stock" element={<DeadStock />} />
          <Route path="transfers" element={<Transfers />} />
          <Route path="dealers" element={<DealerPerformance />} />
          <Route path="products" element={<ProductManagement />} />
          <Route path="warehouses" element={<WarehouseManagement />} />
          <Route path="audit" element={<AuditLogs />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>
        <Route path="/dealer" element={
          <ProtectedRoute role="dealer"><DealerLayout /></ProtectedRoute>
        }>
          <Route index element={<DealerDashboard />} />
          <Route path="smart-orders" element={<SmartOrders />} />
          <Route path="orders" element={<OrderTracking />} />
          <Route path="orders/:orderId" element={<OrderDetail />} />
          <Route path="customer-requests" element={<CustomerRequests />} />
          <Route path="place-order" element={<PlaceOrder />} />
          <Route path="profile" element={<DealerProfile />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>
        <Route path="/customer" element={
          <ProtectedRoute role="customer"><CustomerLayout /></ProtectedRoute>
        }>
          <Route index element={<ShadeCatalog />} />
          <Route path="shade/:shadeId" element={<ShadeDetail />} />
          <Route path="find-near-me" element={<FindNearMe />} />
          <Route path="snap-find" element={<SnapAndFind />} />
          <Route path="cart" element={<Cart />} />
          <Route path="wishlist" element={<Wishlist />} />
          <Route path="orders" element={<MyOrders />} />
          <Route path="notifications" element={<NotificationsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
