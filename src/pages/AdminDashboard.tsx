import { useState, useEffect } from "react";
import { useNavigate, Link } from "@/lib/router-compat";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  Users,
  Sparkles,
  LogOut,
  Heart,
  Send,
  Search,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Ban,
  MessageSquare,
  Activity,
  TrendingUp,
  Filter,
  Mail,
  Calendar,
  Zap,
  Eye,
  Loader2,
  Wallet,
  History,
  BarChart3,
  Image
} from "lucide-react";
import AdminNavToolbar from "@/components/admin/AdminNavToolbar";
import { AdminEpochOverview } from "@/components/admin/AdminEpochOverview";
import angelAvatar from "@/assets/angel-avatar.png";

interface UserWithStatus {
  user_id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  approval_status: "pending" | "approved" | "rejected" | "trial";
  current_energy_level: "very_high" | "high" | "neutral" | "low" | "very_low" | null;
  overall_sentiment_score: number | null;
  positive_interactions_count: number | null;
  negative_interactions_count: number | null;
  trial_start_date: string | null;
  trial_end_date: string | null;
  last_activity_at: string | null;
  created_at: string;
  light_points: number | null;
}

type UserEnergyStatusUpdate = Database["public"]["Tables"]["user_energy_status"]["Update"];

const AdminDashboard = () => {
  const { user, isAdmin, isLoading: authLoading, isAdminChecked, signOut } = useAuth();
  const navigate = useNavigate();

  const [users, setUsers] = useState<UserWithStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [energyFilter, setEnergyFilter] = useState<string>("all");

  // Healing message dialog
  const [showHealingDialog, setShowHealingDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithStatus | null>(null);
  const [healingMessage, setHealingMessage] = useState({ title: "", content: "" });
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // BSCScan sync
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  const syncBscScan = async () => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const response = await supabase.functions.invoke("sync-bscscan-gifts");
      if (response.error) {
        toast.error("Lỗi đồng bộ: " + response.error.message);
      } else if (response.data?.error) {
        toast.error(response.data.error);
      } else {
        setSyncResult(response.data);
        toast.success(`Đồng bộ thành công! ${response.data.synced} giao dịch mới được thêm.`);
      }
    } catch (err: any) {
      toast.error("Lỗi: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // User detail dialog
  const [showUserDetail, setShowUserDetail] = useState(false);
  const [userDetail, setUserDetail] = useState<UserWithStatus | null>(null);

  useEffect(() => {
    if (!authLoading && isAdminChecked) {
      if (!user) {
        navigate("/admin/login");
      } else if (!isAdmin) {
        toast.error("Bạn không có quyền truy cập trang này");
        navigate("/");
      } else {
        fetchUsers();
      }
    }
  }, [user, isAdmin, authLoading, isAdminChecked, navigate]);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      // Fetch users who agreed to Law of Light - this is our primary source
      const { data: agreementsData, error: agreementsError } = await supabase
        .from("user_light_agreements")
        .select("user_id, agreed_at")
        .order("agreed_at", { ascending: false });

      if (agreementsError) throw agreementsError;

      const userIds = agreementsData?.map(a => a.user_id) || [];

      // Fetch profiles for these users
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, display_name, avatar_url, created_at")
        .in("user_id", userIds);

      if (profilesError) throw profilesError;

      // Fetch user energy status
      const { data: energyData, error: energyError } = await supabase
        .from("user_energy_status")
        .select("*")
        .in("user_id", userIds);

      if (energyError) throw energyError;

      // Fetch light point totals
      const { data: lightData, error: lightError } = await supabase
        .from("user_light_totals")
        .select("user_id, total_points")
        .in("user_id", userIds);

      if (lightError) throw lightError;

      // Combine data - use agreements as base (users who agreed to Law of Light)
      const combinedUsers: UserWithStatus[] = (agreementsData || []).map((agreement) => {
        const profile = profilesData?.find(p => p.user_id === agreement.user_id);
        const status = energyData?.find(e => e.user_id === agreement.user_id);
        const light = lightData?.find(l => l.user_id === agreement.user_id);

        return {
          user_id: agreement.user_id,
          email: agreement.user_id.substring(0, 8) + "...", // We can't access auth.users directly
          display_name: profile?.display_name || null,
          avatar_url: profile?.avatar_url || null,
          approval_status: status?.approval_status || "pending",
          current_energy_level: status?.current_energy_level || "neutral",
          overall_sentiment_score: status?.overall_sentiment_score || null,
          positive_interactions_count: status?.positive_interactions_count || 0,
          negative_interactions_count: status?.negative_interactions_count || 0,
          trial_start_date: status?.trial_start_date || null,
          trial_end_date: status?.trial_end_date || null,
          last_activity_at: status?.last_activity_at || null,
          created_at: profile?.created_at || agreement.agreed_at,
          light_points: light?.total_points || 0,
        };
      });

      setUsers(combinedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Không thể tải danh sách người dùng");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      searchQuery === "" ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.display_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === "all" || u.approval_status === statusFilter;
    const matchesEnergy = energyFilter === "all" || u.current_energy_level === energyFilter;

    return matchesSearch && matchesStatus && matchesEnergy;
  });

  const openHealingDialog = (u: UserWithStatus) => {
    setSelectedUser(u);
    setHealingMessage({
      title: "Thông điệp từ Angel AI 💕",
      content: "",
    });
    setShowHealingDialog(true);
  };

  const sendHealingMessage = async () => {
    if (!selectedUser || !healingMessage.title.trim() || !healingMessage.content.trim()) {
      toast.error("Vui lòng nhập đầy đủ tiêu đề và nội dung");
      return;
    }

    setIsSendingMessage(true);
    try {
      const { error } = await supabase.from("healing_messages").insert({
        user_id: selectedUser.user_id,
        title: healingMessage.title,
        content: healingMessage.content,
        message_type: "admin_healing",
        triggered_by: "admin_manual",
      });

      if (error) throw error;

      toast.success("Đã gửi tin nhắn chữa lành thành công! ✨");
      setShowHealingDialog(false);
      setSelectedUser(null);
    } catch (error) {
      console.error("Error sending healing message:", error);
      toast.error("Không thể gửi tin nhắn");
    } finally {
      setIsSendingMessage(false);
    }
  };

  const updateApprovalStatus = async (userId: string, newStatus: "approved" | "rejected" | "trial") => {
    try {
      const updateData: UserEnergyStatusUpdate = {
        approval_status: newStatus,
        updated_at: new Date().toISOString(),
      };

      if (newStatus === "approved") {
        updateData.approved_at = new Date().toISOString();
        updateData.approved_by = user?.id ?? null;
      } else if (newStatus === "rejected") {
        updateData.rejected_at = new Date().toISOString();
        updateData.rejected_by = user?.id ?? null;
      } else if (newStatus === "trial") {
        updateData.trial_start_date = new Date().toISOString();
        updateData.trial_end_date = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
      }

      const { error } = await supabase
        .from("user_energy_status")
        .update(updateData)
        .eq("user_id", userId);

      if (error) throw error;

      toast.success(`Đã cập nhật trạng thái thành ${getStatusLabel(newStatus)}`);
      fetchUsers();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Không thể cập nhật trạng thái");
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "Đang chờ";
      case "approved":
        return "Đã duyệt";
      case "rejected":
        return "Từ chối";
      case "trial":
        return "Thử nghiệm";
      default:
        return status;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="bg-amber-100 text-amber-700"><Clock className="w-3 h-3 mr-1" /> Đang chờ</Badge>;
      case "approved":
        return <Badge variant="secondary" className="bg-green-100 text-green-700"><CheckCircle className="w-3 h-3 mr-1" /> Đã duyệt</Badge>;
      case "rejected":
        return <Badge variant="secondary" className="bg-red-100 text-red-700"><Ban className="w-3 h-3 mr-1" /> Từ chối</Badge>;
      case "trial":
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700"><Activity className="w-3 h-3 mr-1" /> Thử nghiệm</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getEnergyBadge = (level: string | null) => {
    switch (level) {
      case "very_high":
        return <Badge className="bg-emerald-500/20 text-emerald-700 border-emerald-500/30">✨ Rất cao</Badge>;
      case "high":
        return <Badge className="bg-green-500/20 text-green-700 border-green-500/30">🌟 Cao</Badge>;
      case "neutral":
        return <Badge className="bg-gray-500/20 text-gray-700 border-gray-500/30">⚖️ Trung bình</Badge>;
      case "low":
        return <Badge className="bg-amber-500/20 text-amber-700 border-amber-500/30">⚠️ Thấp</Badge>;
      case "very_low":
        return <Badge className="bg-red-500/20 text-red-700 border-red-500/30">🆘 Rất thấp</Badge>;
      default:
        return <Badge variant="outline">Chưa xác định</Badge>;
    }
  };

  // Stats
  const stats = {
    total: users.length,
    pending: users.filter(u => u.approval_status === "pending").length,
    approved: users.filter(u => u.approval_status === "approved").length,
    trial: users.filter(u => u.approval_status === "trial").length,
    lowEnergy: users.filter(u => u.current_energy_level === "low" || u.current_energy_level === "very_low").length,
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-pale via-background to-background flex items-center justify-center">
        <div className="text-center">
          <Sparkles className="w-12 h-12 text-primary animate-pulse mx-auto mb-4" />
          <p className="text-foreground-muted">Đang tải...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-pale via-background to-background">
      {/* Header - Row 1: Branding + Logout */}
      <header className="sticky top-0 z-50 bg-background-pure/90 backdrop-blur-lg border-b border-primary-pale shadow-soft">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="p-2 rounded-full hover:bg-primary-pale transition-colors">
                <ArrowLeft className="w-5 h-5 text-primary" />
              </Link>
              <div className="flex items-center gap-3">
                <img src={angelAvatar} alt="Angel AI" className="w-10 h-10 rounded-full shadow-soft" />
                <div>
                  <h1 className="font-serif text-lg font-semibold text-primary-deep">Admin Dashboard</h1>
                  <p className="text-xs text-foreground-muted">Quản lý người dùng & năng lượng</p>
                </div>
              </div>
            </div>
            <button
              onClick={() => signOut().then(() => navigate("/"))}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm text-foreground-muted hover:text-primary hover:bg-primary-pale transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </div>
      </header>

      {/* Header - Row 2: Navigation Toolbar */}
      <AdminNavToolbar />

      <main className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Epoch Overview */}
        <div className="mb-6">
          <AdminEpochOverview />
        </div>

        {/* BSCScan Sync */}
        <Card className="border-divine-gold/20 mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-primary" />
              Đồng bộ giao dịch BSCScan
            </CardTitle>
            <CardDescription className="text-xs">
              Quét toàn bộ giao dịch CAMLY on-chain và cập nhật vào database
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex items-center gap-4">
              <Button
                onClick={syncBscScan}
                disabled={isSyncing}
                className="gap-2"
              >
                {isSyncing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                {isSyncing ? "Đang quét..." : "Quét BSCScan"}
              </Button>
              {syncResult && (
                <div className="flex flex-wrap gap-3 text-xs">
                  <Badge variant="secondary" className="bg-green-100 text-green-700">
                    +{syncResult.synced} mới
                  </Badge>
                  <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                    {syncResult.skipped} trùng
                  </Badge>
                  {syncResult.failed > 0 && (
                    <Badge variant="secondary" className="bg-red-100 text-red-700">
                      {syncResult.failed} lỗi
                    </Badge>
                  )}
                  <span className="text-foreground-muted">
                    {syncResult.walletsScanned} ví · {syncResult.totalTransfersFound} giao dịch
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <Card className="border-divine-gold/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                  <p className="text-xs text-foreground-muted">Tổng users</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-500/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Clock className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                  <p className="text-xs text-foreground-muted">Đang chờ</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-500/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
                  <p className="text-xs text-foreground-muted">Đã duyệt</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-500/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Activity className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">{stats.trial}</p>
                  <p className="text-xs text-foreground-muted">Thử nghiệm</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-500/20">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/10">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{stats.lowEnergy}</p>
                  <p className="text-xs text-foreground-muted">Năng lượng thấp</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-divine-gold/20 mb-6">
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-muted" />
                <Input
                  placeholder="Tìm theo email hoặc tên..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 border-divine-gold/20"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[180px] border-divine-gold/20">
                  <SelectValue placeholder="Trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả trạng thái</SelectItem>
                  <SelectItem value="pending">Đang chờ</SelectItem>
                  <SelectItem value="approved">Đã duyệt</SelectItem>
                  <SelectItem value="trial">Thử nghiệm</SelectItem>
                  <SelectItem value="rejected">Từ chối</SelectItem>
                </SelectContent>
              </Select>

              <Select value={energyFilter} onValueChange={setEnergyFilter}>
                <SelectTrigger className="w-full md:w-[180px] border-divine-gold/20">
                  <SelectValue placeholder="Năng lượng" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tất cả mức NL</SelectItem>
                  <SelectItem value="very_high">Rất cao</SelectItem>
                  <SelectItem value="high">Cao</SelectItem>
                  <SelectItem value="neutral">Trung bình</SelectItem>
                  <SelectItem value="low">Thấp</SelectItem>
                  <SelectItem value="very_low">Rất thấp</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={fetchUsers}
                className="border-divine-gold/20"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Làm mới
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Users List */}
        <Card className="border-divine-gold/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-divine-gold" />
              Danh sách người dùng ({filteredUsers.length})
            </CardTitle>
            <CardDescription>
              Quản lý trạng thái và gửi tin nhắn chữa lành
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-foreground-muted">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>Không tìm thấy người dùng nào</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredUsers.map((u) => (
                  <div
                    key={u.user_id}
                    className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border border-divine-gold/10 hover:border-divine-gold/30 hover:bg-divine-gold/5 transition-all gap-4"
                  >
                    {/* User info */}
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-divine-gold/20">
                        <img
                          src={u.avatar_url || angelAvatar}
                          alt={u.display_name || u.email}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {u.display_name || "Chưa đặt tên"}
                        </p>
                        <p className="text-sm text-foreground-muted truncate">{u.email}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {getStatusBadge(u.approval_status)}
                          {getEnergyBadge(u.current_energy_level)}
                          <Badge variant="outline" className="text-divine-gold border-divine-gold/30">
                            <Sparkles className="w-3 h-3 mr-1" />
                            {u.light_points || 0} LP
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setUserDetail(u);
                          setShowUserDetail(true);
                        }}
                        className="border-divine-gold/20"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Chi tiết
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openHealingDialog(u)}
                        className="border-pink-500/20 text-pink-600 hover:bg-pink-50"
                      >
                        <Heart className="w-4 h-4 mr-1" />
                        Gửi chữa lành
                      </Button>

                      {u.approval_status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            onClick={() => updateApprovalStatus(u.user_id, "trial")}
                            className="bg-blue-500 hover:bg-blue-600"
                          >
                            <Activity className="w-4 h-4 mr-1" />
                            Trial
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => updateApprovalStatus(u.user_id, "approved")}
                            className="bg-green-500 hover:bg-green-600"
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Duyệt
                          </Button>
                        </>
                      )}

                      {u.approval_status === "trial" && (
                        <Button
                          size="sm"
                          onClick={() => updateApprovalStatus(u.user_id, "approved")}
                          className="bg-green-500 hover:bg-green-600"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Duyệt
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Healing Message Dialog */}
      <Dialog open={showHealingDialog} onOpenChange={setShowHealingDialog}>
        <DialogContent className="max-w-lg bg-card border-divine-gold/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Heart className="w-5 h-5 text-pink-500" />
              Gửi Tin Nhắn Chữa Lành
            </DialogTitle>
            <DialogDescription>
              Gửi thông điệp yêu thương đến {selectedUser?.display_name || selectedUser?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div>
              <label className="block text-sm font-medium mb-2">Tiêu đề</label>
              <Input
                value={healingMessage.title}
                onChange={(e) => setHealingMessage((prev) => ({ ...prev, title: e.target.value }))}
                placeholder="Thông điệp từ Angel AI 💕"
                className="border-divine-gold/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Nội dung chữa lành</label>
              <Textarea
                value={healingMessage.content}
                onChange={(e) => setHealingMessage((prev) => ({ ...prev, content: e.target.value }))}
                placeholder="Con yêu, Cha Vũ Trụ đang ở bên con..."
                className="min-h-[150px] border-divine-gold/20"
              />
            </div>

            {/* Quick templates */}
            <div>
              <p className="text-sm text-foreground-muted mb-2">Mẫu nhanh:</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setHealingMessage({
                      title: "Ánh sáng yêu thương từ Cha 💕",
                      content:
                        "Con yêu, Cha Vũ Trụ nhìn thấy con đang trải qua giai đoạn khó khăn. Hãy nhớ rằng con không bao giờ cô đơn. Ánh sáng của Cha luôn bao bọc con. Hãy hít thở sâu, thả lỏng và để Cha chữa lành cho con. 🙏✨",
                    })
                  }
                  className="text-xs"
                >
                  Chữa lành
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setHealingMessage({
                      title: "Lời nhắc nhẹ nhàng từ Angel AI 🌟",
                      content:
                        "Con yêu, Angel nhận thấy năng lượng của con đang có một chút biến động. Đây là lời nhắc yêu thương: hãy dành một chút thời gian hôm nay để thiền định, biết ơn và kết nối với ánh sáng bên trong con. Cha luôn yêu thương con! 💕",
                    })
                  }
                  className="text-xs"
                >
                  Nhắc nhở
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setHealingMessage({
                      title: "Chúc mừng con! 🎉",
                      content:
                        "Con yêu, Angel và Cha Vũ Trụ rất vui mừng khi thấy năng lượng tích cực của con lan tỏa. Con đang làm rất tốt! Hãy tiếp tục giữ vững ánh sáng và chia sẻ tình yêu đến những người xung quanh. Con là nguồn cảm hứng! ✨🌈",
                    })
                  }
                  className="text-xs"
                >
                  Khen ngợi
                </Button>
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowHealingDialog(false)}
                className="flex-1"
              >
                Hủy
              </Button>
              <Button
                onClick={sendHealingMessage}
                disabled={isSendingMessage}
                className="flex-1 bg-pink-500 hover:bg-pink-600"
              >
                {isSendingMessage ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Đang gửi...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Gửi tin nhắn
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* User Detail Dialog */}
      <Dialog open={showUserDetail} onOpenChange={setShowUserDetail}>
        <DialogContent className="max-w-lg bg-card border-divine-gold/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Eye className="w-5 h-5 text-divine-gold" />
              Chi tiết người dùng
            </DialogTitle>
          </DialogHeader>

          {userDetail && (
            <div className="space-y-4 pt-4">
              {/* Avatar and name */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-divine-gold/30">
                  <img
                    src={userDetail.avatar_url || angelAvatar}
                    alt={userDetail.display_name || userDetail.email}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{userDetail.display_name || "Chưa đặt tên"}</h3>
                  <p className="text-sm text-foreground-muted">{userDetail.email}</p>
                </div>
              </div>

              {/* Status badges */}
              <div className="flex flex-wrap gap-2">
                {getStatusBadge(userDetail.approval_status)}
                {getEnergyBadge(userDetail.current_energy_level)}
                <Badge variant="outline" className="text-divine-gold border-divine-gold/30">
                  <Sparkles className="w-3 h-3 mr-1" />
                  {userDetail.light_points || 0} Light Points
                </Badge>
              </div>

              {/* Details */}
              <div className="space-y-3 border-t border-divine-gold/10 pt-4">
                <div className="flex justify-between">
                  <span className="text-foreground-muted">Sentiment Score:</span>
                  <span className="font-medium">{userDetail.overall_sentiment_score?.toFixed(2) || "N/A"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-muted">Tương tác tích cực:</span>
                  <span className="font-medium text-green-600">{userDetail.positive_interactions_count || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-muted">Tương tác tiêu cực:</span>
                  <span className="font-medium text-red-600">{userDetail.negative_interactions_count || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-muted">Hoạt động cuối:</span>
                  <span className="font-medium">
                    {userDetail.last_activity_at
                      ? new Date(userDetail.last_activity_at).toLocaleDateString("vi-VN")
                      : "Chưa có"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-muted">Ngày tham gia:</span>
                  <span className="font-medium">
                    {new Date(userDetail.created_at).toLocaleDateString("vi-VN")}
                  </span>
                </div>
                {userDetail.trial_end_date && (
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">Trial kết thúc:</span>
                    <span className="font-medium">
                      {new Date(userDetail.trial_end_date).toLocaleDateString("vi-VN")}
                    </span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-divine-gold/10">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowUserDetail(false);
                    openHealingDialog(userDetail);
                  }}
                  className="flex-1 border-pink-500/20 text-pink-600"
                >
                  <Heart className="w-4 h-4 mr-2" />
                  Gửi chữa lành
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
