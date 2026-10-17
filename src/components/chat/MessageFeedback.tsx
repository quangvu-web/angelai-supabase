import { useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MessageFeedbackProps {
  messageIndex: number;
  questionText: string;
  answerText: string;
}

type FeedbackType = "like" | "dislike" | null;

const FEEDBACK_OPTIONS: Array<{
  type: Exclude<FeedbackType, null>;
  label: string;
  success: string;
  icon: typeof ThumbsUp;
  activeClass: string;
  idleClass: string;
}> = [
  {
    type: "like",
    label: "Dung",
    success: "Cam on ban! Angel se tiep tuc hoc hoi.",
    icon: ThumbsUp,
    activeClass: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
    idleClass: "text-muted-foreground hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20",
  },
  {
    type: "dislike",
    label: "Chua dung",
    success: "Cam on phan hoi! Angel se cai thien.",
    icon: ThumbsDown,
    activeClass: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    idleClass: "text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20",
  },
];


export function MessageFeedback({ messageIndex, questionText, answerText }: MessageFeedbackProps) {
  const { user } = useAuth();
  const [feedback, setFeedback] = useState<FeedbackType>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFeedback = async (type: Exclude<FeedbackType, null>) => {
    if (!user) {
      toast.error("Vui long dang nhap de danh gia");
      return;
    }
    if (isSubmitting) return;

    if (feedback === type) {
      setFeedback(null);
      return;
    }

    setIsSubmitting(true);
    const previousFeedback = feedback;
    setFeedback(type);

    try {
      const { error } = await (supabase as any)
        .from("chat_feedback")
        .upsert({
          user_id: user.id,
          question_text: questionText.slice(0, 500),
          answer_text: answerText.slice(0, 2000),
          feedback_type: type,
          feedback_reason: type,
          status: "open",
        }, {
          onConflict: "user_id,question_text",
        });

      if (error) {
        console.log("Feedback save skipped:", error.message);
      }

      const option = FEEDBACK_OPTIONS.find((item) => item.type === type);
      toast.success(option?.success ?? "Cam on phan hoi cua ban", { duration: 2000 });
    } catch (error) {
      console.error("Feedback error:", error);
      setFeedback(previousFeedback);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center gap-1">
      {FEEDBACK_OPTIONS.map((option) => {
        const Icon = option.icon;
        const isActive = feedback === option.type;

        return (
          <Tooltip key={option.type}>
            <TooltipTrigger asChild>
              <motion.button
                onClick={() => handleFeedback(option.type)}
                disabled={isSubmitting}
                className={cn(
                  "p-1.5 rounded-md transition-all duration-200",
                  isActive ? option.activeClass : option.idleClass
                )}
                whileTap={{ scale: 0.9 }}
                aria-label={option.label}
                title={option.label}
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={isActive ? `${option.type}-active` : option.type}
                    initial={isActive ? { scale: 0 } : undefined}
                    animate={isActive ? { scale: 1 } : undefined}
                    exit={isActive ? { scale: 0 } : undefined}
                  >
                    <Icon className={cn("w-4 h-4", isActive && "fill-current")} />
                  </motion.div>
                </AnimatePresence>
              </motion.button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              <p>{option.label}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
