import { AdminLayout } from "@/components/layouts/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { lazy, Suspense } from "react";

const OverviewPanel = lazy(() => import("@/components/admin/founder/OverviewPanel"));
const UserInsightsPanel = lazy(() => import("@/components/admin/founder/UserInsightsPanel"));
const PPLPAnalyticsPanel = lazy(() => import("@/components/admin/founder/PPLPAnalyticsPanel"));
const AntiFakeMonitorPanel = lazy(() => import("@/components/admin/founder/AntiFakeMonitorPanel"));
const EventLoveHousePanel = lazy(() => import("@/components/admin/founder/EventLoveHousePanel"));
const EconomyFlowPanel = lazy(() => import("@/components/admin/founder/EconomyFlowPanel"));
const RealTimeAlertsPanel = lazy(() => import("@/components/admin/founder/RealTimeAlertsPanel"));
const MonetaryHealthPanel = lazy(() => import("@/components/admin/founder/MonetaryHealthPanel"));
const OperationalHealthPanel = lazy(() => import("@/components/admin/founder/OperationalHealthPanel"));
const ConnectorHealthPanel = lazy(() => import("@/components/admin/founder/ConnectorHealthPanel"));

const Loading = () => <div className="text-center py-8 text-muted-foreground">Đang tải panel...</div>;

const FounderDashboard = () => {
  return (
    <AdminLayout>
      <div className="container mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-4">🌟 Founder Dashboard</h1>
        <p className="text-sm text-muted-foreground mb-6">Tổng quan hệ thống FUN — Light Score, PLP, Economy & Real-time Monitoring</p>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="users" className="text-xs">User Insights</TabsTrigger>
            <TabsTrigger value="pplp" className="text-xs">PLP Analytics</TabsTrigger>
            <TabsTrigger value="antifake" className="text-xs">Anti-Fake</TabsTrigger>
            <TabsTrigger value="events" className="text-xs">Events & Love House</TabsTrigger>
            <TabsTrigger value="economy" className="text-xs">Economy Flow</TabsTrigger>
            <TabsTrigger value="health" className="text-xs">💰 Monetary Health</TabsTrigger>
            <TabsTrigger value="ops" className="text-xs">⚙️ Operational</TabsTrigger>
            <TabsTrigger value="connector" className="text-xs">✨ Connector</TabsTrigger>
            <TabsTrigger value="alerts" className="text-xs">Real-Time Alerts</TabsTrigger>
          </TabsList>

          <TabsContent value="overview"><Suspense fallback={<Loading />}><OverviewPanel /></Suspense></TabsContent>
          <TabsContent value="users"><Suspense fallback={<Loading />}><UserInsightsPanel /></Suspense></TabsContent>
          <TabsContent value="pplp"><Suspense fallback={<Loading />}><PPLPAnalyticsPanel /></Suspense></TabsContent>
          <TabsContent value="antifake"><Suspense fallback={<Loading />}><AntiFakeMonitorPanel /></Suspense></TabsContent>
          <TabsContent value="events"><Suspense fallback={<Loading />}><EventLoveHousePanel /></Suspense></TabsContent>
          <TabsContent value="economy"><Suspense fallback={<Loading />}><EconomyFlowPanel /></Suspense></TabsContent>
          <TabsContent value="health"><Suspense fallback={<Loading />}><MonetaryHealthPanel /></Suspense></TabsContent>
          <TabsContent value="ops"><Suspense fallback={<Loading />}><OperationalHealthPanel /></Suspense></TabsContent>
          <TabsContent value="connector"><Suspense fallback={<Loading />}><ConnectorHealthPanel /></Suspense></TabsContent>
          <TabsContent value="alerts"><Suspense fallback={<Loading />}><RealTimeAlertsPanel /></Suspense></TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default FounderDashboard;
