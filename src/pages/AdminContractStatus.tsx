import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "@/lib/router-compat";
import { useAuth } from "@/hooks/useAuth";
import { ethers } from "ethers";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  ArrowLeft, RefreshCw, Shield, Key, Zap, Clock, CheckCircle, XCircle,
  AlertTriangle, Globe, Lock
} from "lucide-react";
import AdminNavToolbar from "@/components/admin/AdminNavToolbar";
import {
  FUN_MONEY_ABI,
  FUN_MONEY_ADDRESSES,
  LEGACY_CONTRACT_ADDRESS,
} from "@/lib/funMoneyABI";

const BSC_TESTNET_RPC = "https://data-seed-prebsc-1-s1.binance.org:8545/";
const CONTRACT_ADDRESS = FUN_MONEY_ADDRESSES[97] || LEGACY_CONTRACT_ADDRESS;

interface ContractState {
  owner: string;
  platformTreasury: string;
  funToken: string;
  userBps: number;
  platformBps: number;
}

interface MinterInfo {
  address: string;
  isAuthorized: boolean;
  label: string;
}

const AdminContractStatus = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [contractState, setContractState] = useState<ContractState | null>(null);
  const [minters, setMinters] = useState<MinterInfo[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Known minter addresses to check (update after deployment)
  const KNOWN_MINTERS: string[] = [];

  const fetchContractState = useCallback(async () => {
    if (!CONTRACT_ADDRESS) {
      toast.error("Contract chưa được deploy. Cập nhật FUN_MONEY_ADDRESSES trước.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const provider = new ethers.JsonRpcProvider(BSC_TESTNET_RPC);
      const contract = new ethers.Contract(CONTRACT_ADDRESS, FUN_MONEY_ABI, provider);

      const [owner, platformTreasury, funToken, userBps, platformBps] = await Promise.all([
        contract.owner(),
        contract.platformTreasury(),
        contract.funToken(),
        contract.USER_BPS(),
        contract.PLATFORM_BPS(),
      ]);

      setContractState({
        owner,
        platformTreasury,
        funToken,
        userBps: Number(userBps),
        platformBps: Number(platformBps),
      });

      // Check known minters
      if (KNOWN_MINTERS.length > 0) {
        const minterResults = await Promise.all(
          KNOWN_MINTERS.map(async (addr, i) => {
            const isAuthorized = await contract.authorizedMinters(addr);
            return { address: addr, isAuthorized, label: `Minter #${i + 1}` };
          })
        );
        setMinters(minterResults);
      }

      setLastUpdated(new Date());
      toast.success("Đã cập nhật trạng thái contract");
    } catch (err: any) {
      console.error("Failed to fetch contract state:", err);
      toast.error("Không thể kết nối contract: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContractState();
  }, [fetchContractState]);

  const shortenAddress = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-foreground">⛓️ Contract Status</h1>
            <p className="text-sm text-muted-foreground">
              FUNMoneyMinter — BSC Testnet • {CONTRACT_ADDRESS || "Not deployed"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchContractState} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <AdminNavToolbar />

        {lastUpdated && (
          <p className="text-xs text-muted-foreground mb-4">
            <Clock className="h-3 w-3 inline mr-1" />
            Cập nhật lúc: {lastUpdated.toLocaleTimeString("vi-VN")}
          </p>
        )}

        {loading && !contractState ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(i => (
              <Card key={i}><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))}
          </div>
        ) : contractState ? (
          <>
            {/* Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Globe className="h-4 w-4" />
                    Contract
                  </div>
                  <p className="text-lg font-bold">FUNMoneyMinter</p>
                  <p className="text-sm text-muted-foreground">Authorized Minter Model</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Zap className="h-4 w-4" />
                    Split (On-Chain)
                  </div>
                  <p className="text-lg font-bold">{contractState.userBps / 100}% / {contractState.platformBps / 100}%</p>
                  <p className="text-sm text-muted-foreground">User / Platform</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Shield className="h-4 w-4" />
                    Owner
                  </div>
                  <a
                    href={`https://testnet.bscscan.com/address/${contractState.owner}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-mono text-primary hover:underline"
                  >
                    {shortenAddress(contractState.owner)}
                  </a>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Key className="h-4 w-4" />
                    Platform Treasury
                  </div>
                  <a
                    href={`https://testnet.bscscan.com/address/${contractState.platformTreasury}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-mono text-primary hover:underline"
                  >
                    {shortenAddress(contractState.platformTreasury)}
                  </a>
                </CardContent>
              </Card>
            </div>

            {/* FUN Token Info */}
            <Card className="mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  FUN Token
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Token Contract</span>
                  <a
                    href={`https://testnet.bscscan.com/address/${contractState.funToken}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-mono text-primary hover:underline"
                  >
                    {shortenAddress(contractState.funToken)}
                  </a>
                </div>
              </CardContent>
            </Card>

            {/* Authorized Minters */}
            {minters.length > 0 && (
              <Card className="mb-6">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Authorized Minters
                    <Badge variant="secondary" className="ml-auto">
                      {minters.filter(m => m.isAuthorized).length} active / {minters.length} total
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Address</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {minters.map((m, i) => (
                        <TableRow key={m.address}>
                          <TableCell>{i + 1}</TableCell>
                          <TableCell>
                            <a
                              href={`https://testnet.bscscan.com/address/${m.address}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-mono text-sm text-primary hover:underline"
                            >
                              {m.address}
                            </a>
                          </TableCell>
                          <TableCell>
                            {m.isAuthorized ? (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                                <CheckCircle className="h-3 w-3 mr-1" /> Authorized
                              </Badge>
                            ) : (
                              <Badge variant="destructive">
                                <XCircle className="h-3 w-3 mr-1" /> Not Authorized
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Legacy Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Legacy Contract (v1.2.1)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  Previous contract: <a
                    href={`https://testnet.bscscan.com/address/${LEGACY_CONTRACT_ADDRESS}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-primary hover:underline"
                  >
                    {shortenAddress(LEGACY_CONTRACT_ADDRESS)}
                  </a>
                  <p className="mt-1 text-xs">EIP-712 multisig model — deprecated. New contract uses authorized minter model.</p>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="h-8 w-8 mx-auto text-amber-500 mb-3" />
              <p className="text-muted-foreground">Không thể kết nối đến contract. Kiểm tra RPC endpoint.</p>
              <Button variant="outline" className="mt-4" onClick={fetchContractState}>
                Thử lại
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminContractStatus;
