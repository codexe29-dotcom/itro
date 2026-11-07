import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";

import PublicLayout from "@/components/layouts/PublicLayout";
import ProtectedRoute from "@/components/layouts/ProtectedRoute";

const Landing = lazy(() => import("@/pages/public/Landing"));
const Exchange = lazy(() => import("@/pages/public/Exchange"));
const SearchResults = lazy(() => import("@/pages/public/SearchResults"));
const Industry = lazy(() => import("@/pages/public/Industry"));
const Technology = lazy(() => import("@/pages/public/Technology"));
const TestDetail = lazy(() => import("@/pages/public/TestDetail"));
const PackageDetail = lazy(() => import("@/pages/public/PackageDetail"));
const BundleDetail = lazy(() => import("@/pages/public/BundleDetail"));
const Packages = lazy(() => import("@/pages/public/Packages"));
const ServiceDetail = lazy(() => import("@/pages/public/ServiceDetail"));
const Equipment = lazy(() => import("@/pages/public/Equipment"));
const InstrumentProfile = lazy(() => import("@/pages/public/InstrumentProfile"));
const InstitutionProfile = lazy(() => import("@/pages/public/InstitutionProfile"));
const FacilityDetail = lazy(() => import("@/pages/public/FacilityDetail"));
const Events = lazy(() => import("@/pages/public/Events"));
const EventDetail = lazy(() => import("@/pages/public/EventDetail"));
const Providers = lazy(() => import("@/pages/public/Providers"));
const Experts = lazy(() => import("@/pages/public/Experts"));
const ExpertProfile = lazy(() => import("@/pages/public/ExpertProfile"));

const Login = lazy(() => import("@/pages/auth/Login"));
const Register = lazy(() => import("@/pages/auth/Register"));
const RegisterProvider = lazy(() => import("@/pages/auth/RegisterProvider"));
const ForgotPassword = lazy(() => import("@/pages/auth/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/auth/ResetPassword"));

const AppLayout = lazy(() => import("@/components/layouts/AppLayout"));
const BuyerDashboard = lazy(() => import("@/pages/buyer/Dashboard"));
const BuyerOrders = lazy(() => import("@/pages/buyer/Orders"));
const BuyerOrderDetail = lazy(() => import("@/pages/buyer/OrderDetail"));
const RequestQuote = lazy(() => import("@/pages/buyer/RequestQuote"));
const BuyerInvoices = lazy(() => import("@/pages/buyer/Invoices"));
const BuyerCart = lazy(() => import("@/pages/buyer/Cart"));

const AdminLayout = lazy(() => import("@/components/layouts/AdminLayout"));
const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const AdminAnalytics = lazy(() => import("@/pages/admin/Analytics"));
const AdminFacilities = lazy(() => import("@/pages/admin/Facilities"));
const AdminInstruments = lazy(() => import("@/pages/admin/Instruments"));
const AdminInstrumentDetail = lazy(() => import("@/pages/admin/InstrumentDetail"));
const AdminServices = lazy(() => import("@/pages/admin/Services"));
const AdminServiceDetail = lazy(() => import("@/pages/admin/ServiceDetail"));
const AdminExperts = lazy(() => import("@/pages/admin/Experts"));
const AdminCatalog = lazy(() => import("@/pages/admin/Catalog"));
const AdminOrders = lazy(() => import("@/pages/admin/Orders"));
const AdminOrderDetail = lazy(() => import("@/pages/admin/OrderDetail"));
const AdminBookings = lazy(() => import("@/pages/admin/Bookings"));
const AdminInvoices = lazy(() => import("@/pages/admin/Invoices"));
const AdminUsers = lazy(() => import("@/pages/admin/Users"));
const AdminSettings = lazy(() => import("@/pages/admin/Settings"));
const AdminQueue = lazy(() => import("@/pages/operator/Queue"));
const Discounts = lazy(() => import("@/pages/Discounts"));
const AdminBundles = lazy(() => import("@/pages/admin/Bundles"));
const AdminEvents = lazy(() => import("@/pages/admin/Events"));

const OperatorLayout = lazy(() => import("@/components/layouts/OperatorLayout"));
const OperatorQueue = lazy(() => import("@/pages/operator/Queue"));

const PlatformLayout = lazy(() => import("@/components/layouts/PlatformLayout"));
const PlatformDashboard = lazy(() => import("@/pages/platform/Dashboard"));
const PlatformProviders = lazy(() => import("@/pages/platform/Providers"));
const PlatformProviderDetail = lazy(() => import("@/pages/platform/ProviderDetail"));
const PlatformBuyers = lazy(() => import("@/pages/platform/Buyers"));
const PlatformBuyerDetail = lazy(() => import("@/pages/platform/BuyerDetail"));
const PlatformOrders = lazy(() => import("@/pages/platform/Orders"));
const PlatformOrderDetail = lazy(() => import("@/pages/platform/OrderDetail"));
const PlatformSettlements = lazy(() => import("@/pages/platform/Settlements"));
const PlatformFeeSettings = lazy(() => import("@/pages/platform/FeeSettings"));
const PlatformCatalog = lazy(() => import("@/pages/platform/Catalog"));
const PlatformTestDetail = lazy(() => import("@/pages/platform/TestDetail"));
const PlatformPackageDetail = lazy(() => import("@/pages/platform/PackageDetail"));
const PlatformIntegrations = lazy(() => import("@/pages/platform/Integrations"));

function RouteLoadingFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
      <span className="text-sm text-slate-500">Loading...</span>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteLoadingFallback />}>
      <Routes>
      {/* ---------- Public ---------- */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/exchange" element={<Exchange />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/industries/:slug" element={<Industry />} />
        <Route path="/technologies/:slug" element={<Technology />} />
        <Route path="/packages" element={<Packages />} />
        <Route path="/tests/:slug" element={<TestDetail />} />
        <Route path="/packages/:slug" element={<PackageDetail />} />
        <Route path="/bundles/:slug" element={<BundleDetail />} />
        <Route path="/providers" element={<Providers />} />
        <Route path="/experts" element={<Experts />} />
        <Route path="/experts/:id" element={<ExpertProfile />} />
        <Route path="/services/:id" element={<ServiceDetail />} />
        <Route path="/equipment" element={<Equipment />} />
        <Route path="/instruments/:id" element={<InstrumentProfile />} />
        <Route path="/institutions/:slug" element={<InstitutionProfile />} />
        <Route path="/facilities/:id" element={<FacilityDetail />} />
        <Route path="/events" element={<Events />} />
        <Route path="/events/:slug" element={<EventDetail />} />
        {/* Cart lives in the public shell — one continuous shopping flow. Requires
            login to hold items (the page prompts sign-in); checkout stays protected. */}
        <Route path="/cart" element={<BuyerCart />} />
      </Route>

      {/* ---------- Auth ---------- */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/register-provider" element={<RegisterProvider />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* ---------- Buyer ---------- */}
      <Route
        path="/app"
        element={
          <ProtectedRoute roles={["INDUSTRY_BUYER"]}>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<BuyerDashboard />} />
        {/* Catalog + cart are unified into the public shell. Keep redirects so old links work. */}
        <Route path="exchange" element={<Navigate to="/exchange" replace />} />
        <Route path="cart" element={<Navigate to="/cart" replace />} />
        <Route path="orders" element={<BuyerOrders />} />
        <Route path="orders/:id" element={<BuyerOrderDetail />} />
        <Route path="request/:serviceId" element={<RequestQuote />} />
        <Route path="invoices" element={<BuyerInvoices />} />
      </Route>

      {/* ---------- Admin ---------- */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={["INSTITUTION_ADMIN", "LAB_MANAGER", "SUPER_ADMIN"]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="orders/:id" element={<AdminOrderDetail />} />
        <Route path="bookings" element={<AdminBookings />} />
        <Route path="queue" element={<AdminQueue />} />
        <Route path="facilities" element={<AdminFacilities />} />
        <Route path="instruments" element={<AdminInstruments />} />
        <Route path="instruments/:id" element={<AdminInstrumentDetail />} />
        <Route path="services" element={<AdminServices />} />
        <Route path="services/:id" element={<AdminServiceDetail />} />
        <Route path="experts" element={<AdminExperts />} />
        <Route path="catalog" element={<AdminCatalog />} />
        <Route path="bundles" element={<AdminBundles />} />
        <Route path="events" element={<AdminEvents />} />
        <Route path="discounts" element={<Discounts />} />
        <Route path="invoices" element={<AdminInvoices />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      {/* ---------- Operator ---------- */}
      <Route
        path="/operator"
        element={
          <ProtectedRoute roles={["OPERATOR", "LAB_MANAGER", "SUPER_ADMIN"]}>
            <OperatorLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<OperatorQueue />} />
      </Route>

      {/* ---------- Platform ---------- */}
      <Route
        path="/platform"
        element={
          <ProtectedRoute roles={["SUPER_ADMIN"]}>
            <PlatformLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<PlatformDashboard />} />
        <Route path="providers" element={<PlatformProviders />} />
        <Route path="providers/:id" element={<PlatformProviderDetail />} />
        <Route path="buyers" element={<PlatformBuyers />} />
        <Route path="buyers/:id" element={<PlatformBuyerDetail />} />
        <Route path="orders" element={<PlatformOrders />} />
        <Route path="orders/:id" element={<PlatformOrderDetail />} />
        <Route path="institutions" element={<Navigate to="/platform/providers" replace />} />
        <Route path="settlements" element={<PlatformSettlements />} />
        <Route path="catalog" element={<PlatformCatalog />} />
        <Route path="catalog/tests/:id" element={<PlatformTestDetail />} />
        <Route path="catalog/packages/:id" element={<PlatformPackageDetail />} />
        <Route path="fee-config" element={<PlatformFeeSettings />} />
        <Route path="discounts" element={<Discounts />} />
        <Route path="integrations" element={<PlatformIntegrations />} />
      </Route>

      {/* ---------- Fallback ---------- */}
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
