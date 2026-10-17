import { useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { ChevronLeft, Users2, Sparkles, Crown, Shield, LogOut, Copy, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useLightCircle } from "@/hooks/useLightCircle";
import { useAuth } from "@/hooks/useAuth";
import { LightCircleChat } from "@/components/circle/LightCircleChat";
import { CircleLampPanel } from "@/components/circle/CircleLampPanel";
import { LampKeepersPanel } from "@/components/circle/LampKeepersPanel";
import { toast } from "sonner";
import { smartBack } from "@/lib/smartBack";

const EMOJIS = ["✨","🌟","💫","🔥","🌞","🌙","🌈","🪷","🕯️","💎","🌸","🍀"];
const initials = (n?: string) => (n || "?").trim().slice(0, 2).toUpperCase();

export default function LightCircle() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { my, isLoading, openCircles, create, joinByCode, joinOpen, leave, sendMessage, createInvite } = useLightCircle();
  const [tab, setTab] = useState("lamp");

  // Create form
  const [name, setName] = useState("");
  const [motto, setMotto] = useState("");
  const [emoji, setEmoji] = useState("✨");
  const [isOpen, setIsOpen] = useState(true);
  const [code, setCode] = useState("");

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="p-6 text-center max-w-sm">
          <Users2 className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
          <p className="font-bold mb-2">Hãy đăng nhập</p>
          <Button onClick={() => navigate("/auth")}>Đăng nhập</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <Button variant="ghost" size="sm" onClick={() => smartBack(navigate)} className="min-h-11">
          <ChevronLeft className="h-4 w-4 mr-1" /> Quay lại
        </Button>

        <div>
          <h1 className="text-2xl font-extrabold">Vòng Sáng</h1>
          <p className="text-xs text-muted-foreground">Nhóm 2–20 người cùng thắp sáng. Không cạnh tranh — chỉ cùng nhau toả sáng.</p>
        </div>

        {isLoading && <p className="text-center text-sm text-muted-foreground">Đang tải…</p>}

        {/* Chưa ở vòng nào */}
        {!isLoading && my && !my.in_circle && (
          <Tabs defaultValue="join" className="space-y-4">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="join">Tham gia vòng</TabsTrigger>
              <TabsTrigger value="create">Tạo vòng mới</TabsTrigger>
            </TabsList>

            <TabsContent value="join" className="space-y-4">
              <Card className="p-4 space-y-2">
                <Label className="text-sm font-bold">Có mã mời?</Label>
                <div className="flex gap-2">
                  <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="VD: AB12CDEF" maxLength={12} />
                  <Button onClick={() => joinByCode.mutate(code)} disabled={!code || joinByCode.isPending}
                    className="bg-gradient-to-br from-[#b8860b] via-[#daa520] to-[#ffd700] !text-black font-extrabold">
                    Vào vòng
                  </Button>
                </div>
              </Card>

              <Card className="p-4 space-y-3">
                <p className="text-sm font-bold">Hoặc chọn một vòng mở</p>
                {openCircles.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic text-center py-3">
                    Chưa có vòng mở nào — hãy là người đầu tiên tạo vòng!
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {openCircles.map((c) => (
                      <div key={c.id} className="flex items-center gap-3 p-2 rounded-lg border hover:bg-amber-500/5">
                        <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center text-xl">{c.emoji}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold truncate">{c.name}</p>
                          {c.motto && <p className="text-[11px] text-muted-foreground truncate italic">"{c.motto}"</p>}
                          <p className="text-[10px] text-muted-foreground">{c.member_count}/{c.max_members} thành viên</p>
                        </div>
                        <Button size="sm" variant="outline" onClick={() => joinOpen.mutate(c.id)} disabled={joinOpen.isPending}>
                          Vào
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="create">
              <Card className="p-4 space-y-3">
                <div>
                  <Label className="text-sm">Tên vòng</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} placeholder="VD: Ánh sáng buổi sớm" maxLength={40} />
                </div>
                <div>
                  <Label className="text-sm">Câu phương châm (tuỳ chọn)</Label>
                  <Textarea value={motto} onChange={(e) => setMotto(e.target.value.slice(0, 140))} placeholder="Cùng nhau thắp sáng mỗi ngày…" rows={2} maxLength={140} />
                </div>
                <div>
                  <Label className="text-sm">Biểu tượng</Label>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {EMOJIS.map((e) => (
                      <button key={e} type="button" onClick={() => setEmoji(e)}
                        className={`h-9 w-9 rounded-lg flex items-center justify-center text-xl transition ${emoji===e ? "bg-amber-500/30 ring-2 ring-amber-500" : "bg-muted hover:bg-amber-500/10"}`}>
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <Label className="text-sm font-bold">Vòng mở</Label>
                    <p className="text-[11px] text-muted-foreground">Cho phép ai cũng tham gia mà không cần mã mời</p>
                  </div>
                  <Switch checked={isOpen} onCheckedChange={setIsOpen} />
                </div>
                <Button onClick={() => create.mutate({ name, motto, emoji, is_open: isOpen })}
                  disabled={!name || name.length < 2 || create.isPending}
                  className="w-full bg-gradient-to-br from-[#b8860b] via-[#daa520] to-[#ffd700] !text-black font-extrabold">
                  <Plus className="h-4 w-4 mr-1" /> Tạo Vòng Sáng
                </Button>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Đang ở vòng */}
        {!isLoading && my?.in_circle && my.circle && (
          <>
            <Card className="p-5 border-amber-400/40 bg-gradient-to-br from-amber-500/5 via-yellow-500/5 to-amber-500/10">
              <div className="flex items-start gap-3">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-[#b8860b] via-[#daa520] to-[#ffd700] flex items-center justify-center text-3xl shrink-0">
                  {my.circle.avatar_emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-extrabold leading-tight truncate">{my.circle.name}</h2>
                  {my.circle.motto && <p className="text-xs text-muted-foreground italic">"{my.circle.motto}"</p>}
                  <div className="flex flex-wrap gap-2 mt-2 text-xs">
                    <Badge variant="outline" className="gap-1"><Users2 className="h-3 w-3" />{my.circle.member_count}/{my.circle.max_members}</Badge>
                    <Badge variant="outline" className="gap-1"><Sparkles className="h-3 w-3 text-amber-500" />{my.circle.light_pool.toLocaleString()} ánh sáng</Badge>
                    {my.circle.is_open && <Badge variant="outline">Vòng mở</Badge>}
                    {my.my_role === "founder" && <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-300 gap-1"><Crown className="h-3 w-3" />Founder</Badge>}
                    {my.my_role === "steward" && <Badge variant="secondary" className="gap-1"><Shield className="h-3 w-3" />Steward</Badge>}
                  </div>
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground mt-3 italic">
                Mỗi điểm Season XP của bạn tự động cộng ×5 ánh sáng vào vòng. Cùng nhau thắp sáng — không xếp hạng.
              </p>
            </Card>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid grid-cols-5 w-full">
                <TabsTrigger value="lamp" className="text-[11px] sm:text-sm">Ngọn đèn</TabsTrigger>
                <TabsTrigger value="keepers" className="text-[11px] sm:text-sm">NFT</TabsTrigger>
                <TabsTrigger value="members" className="text-[11px] sm:text-sm">Thành viên</TabsTrigger>
                <TabsTrigger value="chat" className="text-[11px] sm:text-sm">Chat</TabsTrigger>
                <TabsTrigger value="invite" className="text-[11px] sm:text-sm">Mời</TabsTrigger>
              </TabsList>

              <TabsContent value="lamp">
                <CircleLampPanel circleId={my.circle.id} myRole={my.my_role} />
              </TabsContent>

              <TabsContent value="keepers">
                <LampKeepersPanel circleId={my.circle.id} />
              </TabsContent>

              <TabsContent value="members" className="space-y-2">
                <Card className="p-3 space-y-2">
                  {(my.members ?? []).map((m) => (
                    <div key={m.user_id} className="flex items-center gap-2 text-sm">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={m.avatar_url ?? undefined} />
                        <AvatarFallback className="text-[10px]">{initials(m.display_name)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate flex items-center gap-1">
                          {m.display_name}
                          {m.role === "founder" && <Crown className="h-3 w-3 text-amber-500" />}
                          {m.role === "steward" && <Shield className="h-3 w-3 text-blue-500" />}
                        </p>
                        <p className="text-[10px] text-muted-foreground">Tham gia {new Date(m.joined_at).toLocaleDateString("vi-VN")}</p>
                      </div>
                      <span className="text-xs font-bold text-amber-600 tabular-nums">
                        {m.contributed_light.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </Card>
                <p className="text-[10px] text-center text-muted-foreground italic">
                  Sắp xếp theo ngày tham gia — không xếp hạng theo đóng góp.
                </p>
              </TabsContent>

              <TabsContent value="chat">
                <LightCircleChat
                  messages={my.messages ?? []}
                  onSend={(b) => sendMessage.mutate(b)}
                  isSending={sendMessage.isPending}
                />
              </TabsContent>

              <TabsContent value="invite" className="space-y-3">
                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold">Mã mời đang hoạt động</p>
                    {(my.my_role === "founder" || my.my_role === "steward") && (
                      <Button size="sm" onClick={() => createInvite.mutate()} disabled={createInvite.isPending}
                        className="bg-gradient-to-br from-[#b8860b] via-[#daa520] to-[#ffd700] !text-black font-extrabold">
                        <Plus className="h-3.5 w-3.5 mr-1" /> Tạo mã mới
                      </Button>
                    )}
                  </div>
                  {(my.invites ?? []).length === 0 ? (
                    <p className="text-xs text-muted-foreground italic text-center py-3">
                      Chưa có mã mời nào.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {(my.invites ?? []).map((i) => (
                        <div key={i.code} className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30">
                          <code className="font-mono font-bold text-sm flex-1">{i.code}</code>
                          <span className="text-[10px] text-muted-foreground">còn {i.uses_left} lượt</span>
                          <Button size="sm" variant="ghost" onClick={() => {
                            navigator.clipboard.writeText(i.code);
                            toast.success("Đã copy mã mời");
                          }}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground italic">
                    Mỗi mã mời hết hạn sau 7 ngày, tối đa 5 lượt dùng.
                  </p>
                </Card>
              </TabsContent>
            </Tabs>

            <Button variant="outline" className="w-full text-destructive border-destructive/30"
              onClick={() => {
                if (confirm("Bạn muốn rời Vòng Sáng này?")) leave.mutate();
              }}
              disabled={leave.isPending}>
              <LogOut className="h-4 w-4 mr-1" /> Rời vòng
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
