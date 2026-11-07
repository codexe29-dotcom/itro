import { Routes, Route, Navigate } from "react-router-dom";

import PublicLayout from "@/components/layouts/PublicLayout";
import AppLayout from "@/components/layouts/AppLayout";
import AdminLayout from "@/components/layouts/AdminLayout";
import OperatorLayout from "@/components/layouts/OperatorLayout";
import PlatformLayout from "@/components/layouts/PlatformLayout";
import ProtectedRoute from "@/components/layouts/ProtectedRoute";

// Public
import Landing from "@/pages/public/Landing";
import Exchange from "@/pages/public/Exchange";
import SearchResults from "@/pages/public/SearchResults";
import Industry from "@/pages/public/Industry";
import Technology from "@/pages/public/Technology";
import TestDetail from "@/pages/public/TestDetail";
import PackageDetail from "@/pages/public/PackageDetail";
import BundleDetail from "@/pages/public/BundleDetail";
import Packages from "@/pages/public/Packages";
import ServiceDetail from "@/pages/public/ServiceDetail";
import Equipment from "@/pages/public/Equipment";
import InstrumentProfile from "@/pages/public/InstrumentProfile";
import InstitutionProfile from "@/pages/public/InstitutionProfile";
import FacilityDetail from "@/pages/public/FacilityDetail";
import Events from "@/pages/public/Events";
import EventDetail from "@/pages/public/EventDetail";
import Providers from "@/pages/public/Providers";
import Experts from "@/pages/public/Experts";
import ExpertProfile from "@/pages/public/ExpertProfile";

// Auth
import Login from "@/pages/auth/Login";
import Register from "@/pages/auth/Register";
import RegisterProvider from "@/pages/auth/RegisterProvider";

// Buyer
import BuyerDashboard from "@/pages/buyer/Dashboard";
import BuyerOrders from "@/pages/buyer/Orders";
import BuyerOrderDetail from "@/pages/buyer/OrderDetail";
import RequestQuote from "@/pages/buyer/RequestQuote";
import BuyerInvoices from "@/pages/buyer/Invoices";
import BuyerExchange from "@/pages/buyer/BrowseExchange";
import BuyerCart from "@/pages/buyer/Cart";

// Admin
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminAnalytics from "@/pages/admin/Analytics";
import AdminFacilities from "@/pages/admin/Facilities";
import AdminInstruments from "@/pages/admin/Instruments";
import AdminInstrumentDetail from "@/pages/admin/InstrumentDetail";
import AdminServices from "@/pages/admin/Services";
import AdminServiceDetail from "@/pages/admin/ServiceDetail";
import AdminExperts from "@/pages/admin/Experts";
import AdminCatalog from "@/pages/admin/Catalog";
import AdminOrders from "@/pages/admin/Orders";
import AdminOrderDetail from "@/pages/admin/OrderDetail";
import AdminBookings from "@/pages/admin/Bookings";
import AdminInvoices from "@/pages/admin/Invoices";
import AdminUsers from "@/pages/admin/Users";
import AdminSettings from "@/pages/admin/Settings";
import AdminQueue from "@/pages/operator/Queue";

// Operator
import OperatorQueue from "@/pages/operator/Queue";

// Platform
import PlatformDashboard from "@/pages/platform/Dashboard";
import PlatformProviders from "@/pages/platform/Providers";
import PlatformProviderDetail from "@/pages/platform/ProviderDetail";
import PlatformBuyers from "@/pages/platform/Buyers";
import PlatformBuyerDetail from "@/pages/platform/BuyerDetail";
import PlatformOrders from "@/pages/platform/Orders";
import PlatformOrderDetail from "@/pages/platform/OrderDetail";
import PlatformSettlements from "@/pages/platform/Settlements";
import PlatformFeeSettings from "@/pages/platform/FeeSettings";
import PlatformCatalog from "@/pages/platform/Catalog";
import PlatformTestDetail from "@/pages/platform/TestDetail";
import PlatformPackageDetail from "@/pages/platform/PackageDetail";
import PlatformIntegrations from "@/pages/platform/Integrations";
import Discounts from "@/pages/Discounts";
import AdminBundles from "@/pages/admin/Bundles";
import AdminEvents from "@/pages/admin/Events";

export default function App() {
  return (
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
  );
}
