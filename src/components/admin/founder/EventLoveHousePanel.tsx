import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Calendar, Users, Home, Activity } from "lucide-react";

export default function EventLoveHousePanel() {
  const { data, isLoading } = useQuery({
    queryKey: ["founder-events"],
    queryFn: async () => {
      const [eventsRes, groupsRes, attendanceRes] = await Promise.all([
        supabase.from("attendance_events").select("id, title, event_type, status, event_date, duration_minutes").order("event_date", { ascending: false }).limit(200),
        supabase.from("pplp_groups").select("id, group_name, participant_estimate, group_confidence, event_id").limit(200),
        supabase.from("pplp_attendance").select("id, event_id, participation_factor, light_score_earned, host_confirmed, reflection_submitted").limit(500),
      ]);

      const events = eventsRes.data || [];
      const groups = groupsRes.data || [];
      const attendance = attendanceRes.data || [];

      const activeEvents = events.filter(e => e.status === "active" || e.status === "open").length;
      const totalAttendance = attendance.length;
      const avgParticipation = totalAttendance > 0
        ? Number((attendance.reduce((s, a) => s + Number(a.participation_factor || 0), 0) / totalAttendance).toFixed(2))
        : 0;
      const reflectionRate = totalAttendance > 0
        ? Math.round((attendance.filter(a => a.reflection_submitted).length / totalAttendance) * 100)
        : 0;

      // Event type distribution
      const typeMap: Record<string, number> = {};
      events.forEach(e => { typeMap[e.event_type] = (typeMap[e.event_type] || 0) + 1; });
      const eventTypes = Object.entries(typeMap).map(([name, count]) => ({ name, count }));

      // Group activity
      const groupActivity = groups.slice(0, 10).map(g => ({
        name: (g.group_name || "").slice(0, 15),
        participants: g.participant_estimate || 0,
        confidence: Number(g.group_confidence || 0),
      }));

      return { activeEvents, totalGroups: groups.length, totalAttendance, avgParticipation, reflectionRate, eventTypes, groupActivity };
    },
    staleTime: 60_000,
  });

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">Đang tải...</div>;

  const kpis = [
    { label: "Active Events", value: data?.activeEvents || 0, icon: Calendar, color: "text-blue-500" },
    { label: "Love House Groups", value: data?.totalGroups || 0, icon: Home, color: "text-pink-500" },
    { label: "Avg Participation", value: data?.avgParticipation || 0, icon: Activity, color: "text-emerald-500" },
    { label: "Reflection Rate", value: `${data?.reflectionRate || 0}%`, icon: Users, color: "text-purple-500" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map(k => (
          <Card key={k.label}><CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1"><k.icon className={`w-4 h-4 ${k.color}`} /><span className="text-xs text-muted-foreground">{k.label}</span></div>
            <p className="text-lg font-bold">{k.value}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Event Types</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data?.eventTypes || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Group Activity (Top 10)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data?.groupActivity || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={100} />
                <Tooltip />
                <Bar dataKey="participants" fill="hsl(330,80%,60%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
