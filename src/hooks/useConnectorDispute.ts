import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export function useConnectorDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      connector_id: string;
      reason: string;
      evidence?: Record<string, unknown>;
    }) => {
      const { data, error } = await supabase.functions.invoke("connector-dispute", {
        body: { action: "raise", ...input },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast({ title: "Đã gửi báo cáo", description: "Cám ơn bạn. Admin sẽ xem xét trong vòng 7 ngày." });
      qc.invalidateQueries({ queryKey: ["connector-stats"] });
    },
    onError: (err: any) => {
      toast({
        title: "Không gửi được",
        description: err?.message ?? "Lỗi không xác định",
        variant: "destructive",
      });
    },
  });
}
