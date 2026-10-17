import { Plus } from "lucide-react";
import { toast } from "sonner";
import { getActiveProvider } from "@/lib/walletProviders";

const CONTRACT_ADDRESS = "0x39A1b047D5d143f8874888cfa1d30Fb2AE6F0CD6";

export function AddFUNToWalletButton() {
  const addTokenToWallet = async () => {
    const provider = getActiveProvider();
    if (!provider) {
      toast.error("Vui lòng cài MetaMask hoặc ví Web3 trước!");
      window.open("https://metamask.io/download/", "_blank");
      return;
    }

    try {
      const wasAdded = await provider.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {
            address: CONTRACT_ADDRESS,
            symbol: "FUN",
            decimals: 18,
            image: "https://angel999.lovable.app/favicon.png",
          },
        },
      });

      if (wasAdded) {
        toast.success("🎉 Đã thêm FUN Money vào ví thành công!");
      } else {
        toast.info("Bạn đã huỷ thêm token.");
      }
    } catch (error: any) {
      console.error("Add token failed:", error);
      toast.error("Không thể thêm token. Vui lòng thử lại.");
    }
  };

  return (
    <button
      onClick={addTokenToWallet}
      className="group relative inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-bold text-base
        bg-gradient-to-r from-[#b8860b] via-[#daa520] to-[#ffd700] 
        hover:from-[#daa520] hover:via-[#ffd700] hover:to-[#ffec8b]
        text-black shadow-lg hover:shadow-xl
        transition-all duration-300 hover:scale-105 active:scale-95
        before:absolute before:inset-0 before:rounded-full before:bg-gradient-to-t before:from-transparent before:to-white/25 before:pointer-events-none
        after:absolute after:inset-0 after:rounded-full after:shadow-[inset_0_1px_2px_rgba(255,255,255,0.4)] after:pointer-events-none"
    >
      <Plus className="h-5 w-5" strokeWidth={3} />
      <span className="relative z-10">Thêm Contract FUN Money vào ví</span>
    </button>
  );
}
