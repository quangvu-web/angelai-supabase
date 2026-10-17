import { useState, useEffect } from "react";
import { smartBack } from "@/lib/smartBack";
import { useIsMobile } from "@/hooks/use-mobile";
import { GiftCoinDialog } from "@/components/gifts/GiftCoinDialog";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getProfilePath } from "@/lib/profileUrl";
import { useAuth } from "@/hooks/useAuth";
import { useCoordinatorRole } from "@/hooks/useCoordinatorRole";
import { Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { 
  LogIn, LogOut, User, MessageCircle, Search,
  Home, Info, BookOpen, Users, PenLine, ArrowRightLeft, 
  Star, Wallet, ChevronRight, ChevronDown, ArrowLeft, Settings, Gift,

} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCamlyCoin } from "@/hooks/useCamlyCoin";
import { useLanguage } from "@/contexts/LanguageContext";
import { useDirectMessages } from "@/hooks/useDirectMessages";
import { Web3WalletButton } from "@/components/Web3WalletButton";
import { LanguageSelector } from "@/components/LanguageSelector";
import { GlobalSearch } from "@/components/GlobalSearch";
import { useWeb3WalletContext } from "@/contexts/Web3WalletContext";
import { isGovAttester } from "@/lib/govGroups";
import { useAttesterPendingCount } from "@/hooks/useAttesterPendingCount";
import { useSavedWalletAddress } from "@/hooks/useSavedWalletAddress";

import { NotificationDropdown } from "@/components/layout/NotificationDropdown";
import angelAvatar from "@/assets/angel-avatar.png";

import camlyCoinLogo from "@/assets/camly-coin-logo.png";

interface UserProfile {
  display_name: string | null;
  avatar_url: string | null;
}

// Gift Button component for header
const GiftButton = () => {
  const [giftOpen, setGiftOpen] = useState(false);
  const { t } = useLanguage();
  return (
    <>
      <button
        onClick={() => setGiftOpen(true)}
        className="flex items-center gap-1 px-2 lg:px-2.5 py-1 lg:py-1.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-500 hover:to-yellow-600 transition-all shadow-sm hover:shadow-md"
        title={t("common.reward")}
      >
        <Gift className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-black" />
        <span className="hidden xl:inline text-xs font-bold text-black">{t("common.reward")}</span>
      </button>
      <GiftCoinDialog open={giftOpen} onOpenChange={setGiftOpen} />
    </>
  );
};

export const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, isLoading, isAdmin } = useAuth();
  const { balance } = useCamlyCoin();
  const { unreadCount } = useDirectMessages();
  const { t } = useLanguage();
  const { hasAccess: isCoordinator } = useCoordinatorRole();
  const isMobile = useIsMobile();
  const { address } = useWeb3WalletContext();
  const { savedAddress } = useSavedWalletAddress();
  const attesterAddress = address && isGovAttester(address) ? address : savedAddress;
  const showAttesterPanel = !!attesterAddress && isGovAttester(attesterAddress);
  const { pendingCount: attesterPendingCount } = useAttesterPendingCount(savedAddress);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Fetch user profile for avatar and display name - use user.id to prevent unnecessary re-fetches
  useEffect(() => {
    if (!user?.id) {
      setUserProfile(null);
      return;
    }

    let cancelled = false;
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (!cancelled && data) {
        setUserProfile(data);
      }
    };

    fetchProfile();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Get display name to show (priority: display_name > email username)
  const getDisplayName = () => {
    if (userProfile?.display_name) {
      return userProfile.display_name;
    }
    if (user?.email) {
      return user.email.split("@")[0];
    }
    return t("common.profile");
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  type NavTheme = {
    cardBg: string;
    cardBorder: string;
    iconBg: string;
    iconText: string;
    countBg: string;
    countText: string;
  };
  const THEME = {
    amber:   { cardBg: "bg-amber-50/70 dark:bg-amber-950/20",   cardBorder: "border-amber-200/70 dark:border-amber-800/40",   iconBg: "bg-amber-100 dark:bg-amber-900/40",   iconText: "text-amber-600 dark:text-amber-300",   countBg: "bg-amber-100 dark:bg-amber-900/40",   countText: "text-amber-700 dark:text-amber-300" },
    sky:     { cardBg: "bg-sky-50/70 dark:bg-sky-950/20",       cardBorder: "border-sky-200/70 dark:border-sky-800/40",       iconBg: "bg-sky-100 dark:bg-sky-900/40",       iconText: "text-sky-600 dark:text-sky-300",       countBg: "bg-sky-100 dark:bg-sky-900/40",       countText: "text-sky-700 dark:text-sky-300" },
    indigo:  { cardBg: "bg-indigo-50/70 dark:bg-indigo-950/20", cardBorder: "border-indigo-200/70 dark:border-indigo-800/40", iconBg: "bg-indigo-100 dark:bg-indigo-900/40", iconText: "text-indigo-600 dark:text-indigo-300", countBg: "bg-indigo-100 dark:bg-indigo-900/40", countText: "text-indigo-700 dark:text-indigo-300" },
    emerald: { cardBg: "bg-emerald-50/70 dark:bg-emerald-950/20", cardBorder: "border-emerald-200/70 dark:border-emerald-800/40", iconBg: "bg-emerald-100 dark:bg-emerald-900/40", iconText: "text-emerald-600 dark:text-emerald-300", countBg: "bg-emerald-100 dark:bg-emerald-900/40", countText: "text-emerald-700 dark:text-emerald-300" },
  } satisfies Record<string, NavTheme>;

  const navGroups: { key: string; label: string; theme: NavTheme; items: { label: string; href: string; icon: typeof Home }[] }[] = [
    { key: "main", label: t("header.main"), theme: THEME.amber, items: [
      { label: t("nav.home"), href: "/", icon: Home },
      { label: t("nav.about"), href: "/about", icon: Info },
    ]},
    { key: "create", label: t("header.learnCreate"), theme: THEME.sky, items: [
      { label: t("nav.knowledge"), href: "/knowledge", icon: BookOpen },
      { label: t("sidebar.chatAngel"), href: "/chat", icon: MessageCircle },
      { label: t("nav.contentWriter"), href: "/content-writer", icon: PenLine },
    ]},
    { key: "social", label: t("header.community"), theme: THEME.indigo, items: [
      { label: t("nav.community"), href: "/community", icon: Users },
    ]},
    { key: "finance", label: t("header.finance"), theme: THEME.emerald, items: [
      { label: t("nav.swap"), href: "/swap", icon: ArrowRightLeft },
      { label: t("common.reward"), href: "/earn", icon: Gift },
    ]},
  ];

  return (
    <>
    <header 
      className={`sticky top-0 z-40 transition-all duration-500 ${
        isScrolled 
          ? 'bg-background-pure/90 backdrop-blur-lg shadow-soft' 
          : 'bg-background-pure/80 backdrop-blur-sm'
      }`}
    >
      <div className="max-w-full mx-auto px-2 sm:px-4 lg:px-4 xl:px-6 overflow-hidden">
        <div className="flex items-center justify-between h-14 sm:h-16 lg:h-16 gap-1">
          {/* Back Button - Show on all pages except home - Go back to previous page */}
          {location.pathname !== "/" && (
            <button
              onClick={() => smartBack(navigate)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-colors shrink-0 min-w-[44px] min-h-[44px] justify-center"
              title={t("common.back")}
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">{t("common.back")}</span>
            </button>
          )}
          {/* Logo - Hidden on desktop since MainSidebar has it, show only on mobile */}
          <Link to="/" className={`flex lg:hidden items-center gap-2 shrink-0 group min-w-0 transition-transform duration-500 ${isScrolled ? 'scale-90' : 'scale-100'}`}>
            <img src={angelAvatar} alt="Angel AI" className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover drop-shadow-[0_2px_4px_rgba(0,0,0,0.2)]" />
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-brand-golden text-2xl sm:text-3xl">Angel A.I.</span>
              <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-foreground-muted truncate">
                {t("header.tagline")}
              </span>
            </div>
          </Link>

          {/* Search Bar - Desktop - centered */}
          <div className="hidden lg:flex flex-1 justify-center items-center gap-2">
            {isCoordinator && (
              <Link
                to="/coordinator-gate"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all duration-300 hover:scale-105 shrink-0"
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Coordinator</span>
              </Link>
            )}
            <div className="w-64 xl:w-80 2xl:w-96">
              <GlobalSearch 
                variant="header" 
              />
            </div>
          </div>

          {/* Navigation removed - now in MainSidebar */}

          {/* Auth Buttons - More compact design */}
          <div className="hidden lg:flex items-center gap-0.5 lg:gap-1 xl:gap-1.5 shrink-0">

            {/* Language Selector - Compact on lg */}
            <LanguageSelector compact />

            {/* Gift Button */}
            <GiftButton />
            
            {/* Web3 Wallet Button - Always visible */}
            <Web3WalletButton compact />
            
            {!isLoading && (
              <>
                {user ? (
                  <div className="flex items-center gap-0.5 lg:gap-1 xl:gap-1.5">
                    
                    {/* Messages Button */}
                    <Link 
                      to="/messages"
                      className="relative p-1 lg:p-1.5 xl:p-2 rounded-full hover:bg-primary-pale transition-colors"
                      title="Tin nhắn"
                    >
                      <MessageCircle className="w-3.5 h-3.5 lg:w-4 lg:h-4 xl:w-5 xl:h-5 text-foreground-muted" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] lg:text-[10px] font-bold w-3.5 h-3.5 lg:w-4 lg:h-4 rounded-full flex items-center justify-center">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                      )}
                    </Link>

                    {/* Notification Bell */}
                    <NotificationDropdown variant="header" />
                    
                    {/* Camly Coin Balance */}
                    <Link 
                      to="/earn"
                      className="flex items-center gap-0.5 lg:gap-1 px-1.5 lg:px-2 py-1 lg:py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                    >
                      <img src={camlyCoinLogo} alt="Camly Coin" className="w-3.5 h-3.5 lg:w-4 lg:h-4 rounded-full" />
                      <span className="text-[10px] lg:text-xs font-semibold text-amber-700 dark:text-amber-400">
                        {Math.floor(balance).toLocaleString()}
                      </span>
                    </Link>
                    
                    {/* User Profile Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button 
                          className="flex items-center gap-0.5 lg:gap-1 px-1 lg:px-1.5 xl:px-2 py-1 rounded-full bg-primary-pale/50 hover:bg-primary-pale transition-colors"
                        >
                          {userProfile?.avatar_url ? (
                            <img 
                              src={userProfile.avatar_url} 
                              alt="Avatar" 
                              className="w-5 h-5 lg:w-5 lg:h-5 xl:w-6 xl:h-6 rounded-full object-cover"
                            />
                          ) : (
                            <User className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-primary" />
                          )}
                          {/* Only show name on xl+ screens */}
                          <span className="hidden xl:inline text-xs font-semibold text-foreground max-w-[70px] truncate">
                            {getDisplayName()}
                          </span>
                          <ChevronDown className="w-3 h-3 text-muted-foreground hidden xl:block" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        {/* User Info Header - clickable to go to profile */}
                        <Link to={getProfilePath(user.id)} className="block px-3 py-2 border-b border-border hover:bg-accent rounded-t-md transition-colors">
                          <p className="font-semibold text-sm text-foreground truncate">{getDisplayName()}</p>
                          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                        </Link>
                        
                        {isAdmin && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem asChild className="cursor-pointer">
                              <Link to="/admin/dashboard" className="flex items-center gap-2">
                                <Shield className="w-4 h-4 text-purple-600" />
                                <span className="font-medium">Admin Dashboard</span>
                              </Link>
                            </DropdownMenuItem>
                          </>
                        )}
                        
                        {showAttesterPanel && (
                          <DropdownMenuItem asChild className="cursor-pointer">
                            <Link to="/attester-panel" className="flex items-center gap-2">
                              <Shield className="w-4 h-4 text-emerald-600" />
                              <span className="font-medium">Attester Panel</span>
                              {attesterPendingCount > 0 && (
                                <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-xs font-bold animate-pulse">
                                  {attesterPendingCount}
                                </span>
                              )}
                            </Link>
                          </DropdownMenuItem>
                        )}
                        
                        <DropdownMenuSeparator />
                        
                        {/* Logout */}
                        <DropdownMenuItem 
                          onClick={handleSignOut}
                          className="cursor-pointer text-destructive focus:text-destructive"
                        >
                          <LogOut className="w-4 h-4 mr-2" />
                          <span>{t("nav.logout")}</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ) : (
                  <Link
                    to="/auth"
                    className={`inline-flex items-center gap-1 px-2 lg:px-3 xl:px-4 py-1 lg:py-1.5 rounded-full font-medium text-[11px] lg:text-xs xl:text-sm transition-all duration-300 ${
                      isScrolled 
                        ? 'bg-sapphire-gradient text-primary-foreground shadow-sacred hover:shadow-divine' 
                        : 'bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground'
                    }`}
                  >
                    <LogIn className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
                    <span className="hidden xl:inline">{t("nav.login")}</span>
                  </Link>
                )}
              </>
            )}
          </div>

          {/* Mobile Actions - Always visible on mobile */}
          <div className="flex lg:hidden items-center gap-2 shrink-0">
            
            {/* Mobile Language Selector */}
            <LanguageSelector />
            
            {/* Mobile Menu Button */}
            <button 
              className="p-2 text-primary"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isMobileMenuOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Menu - Redesigned */}
        {isMobileMenuOpen && (
          <div className="lg:hidden py-4 border-t border-primary-pale/30 bg-background-pure/95 backdrop-blur-xl animate-in slide-in-from-top-2 duration-200 max-h-[85vh] overflow-y-auto">
            <nav className="flex flex-col gap-4">
              <div className="px-4 space-y-5">
                {isCoordinator && (
                  <Link
                    to="/coordinator-gate"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex items-center justify-center gap-2 p-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 border border-purple-400/50 shadow-lg text-white font-bold transition-all active:scale-95"
                  >
                    <Shield className="w-5 h-5" />
                    <span>{t("header.coordinatorGate")}</span>
                  </Link>
                )}

                {navGroups.slice(0, 3).map((group) => (
                  <section key={group.key} className="space-y-2">
                    <div className="flex items-center px-1">
                      <h3 className="text-sm font-bold text-foreground">{group.label}</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3 [&>a:last-child:nth-child(odd)]:col-span-2">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const active = location.pathname === item.href;
                        return (
                          <Link
                            key={item.href}
                            to={item.href}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={`flex items-center gap-3 p-3 rounded-2xl border transition-all active:scale-[0.97] min-h-[64px] ${group.theme.cardBg} ${active ? "border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.25)]" : group.theme.cardBorder}`}
                          >
                            <div className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${group.theme.iconBg} ${group.theme.iconText}`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <span className="text-sm font-semibold text-foreground leading-tight">
                              {item.label}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                ))}

                {/* Mini Games block tạm ẩn — đang chuyển sang fun.rich */}

                {navGroups.slice(3).map((group) => (
                  <section key={group.key} className="space-y-2">
                    <div className="flex items-center px-1">
                      <h3 className="text-sm font-bold text-foreground">{group.label}</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-3 [&>a:last-child:nth-child(odd)]:col-span-2">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const active = location.pathname === item.href;
                        return (
                          <Link
                            key={item.href}
                            to={item.href}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className={`flex items-center gap-3 p-3 rounded-2xl border transition-all active:scale-[0.97] min-h-[64px] ${group.theme.cardBg} ${active ? "border-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.25)]" : group.theme.cardBorder}`}
                          >
                            <div className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center ${group.theme.iconBg} ${group.theme.iconText}`}>
                              <Icon className="w-5 h-5" />
                            </div>
                            <span className="text-sm font-semibold text-foreground leading-tight">
                              {item.label}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>

              {/* User Section */}
              {!isLoading && (
                <>
                  {user ? (
                    <div className="space-y-3 mt-2">
                      {/* Web3 Wallet - Collapsible */}
                      <Collapsible className="mx-4">
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-4 rounded-xl 
                          bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 
                          border border-blue-200/50 dark:border-blue-800/50 transition-all hover:shadow-md">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
                              <Wallet className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <span className="font-semibold text-foreground">{t("header.web3Wallet")}</span>
                          </div>
                          <ChevronDown className="w-5 h-5 text-muted-foreground transition-transform duration-200 
                            [[data-state=open]>&]:rotate-180" />
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3 px-2">
                          <Web3WalletButton />
                        </CollapsibleContent>
                      </Collapsible>
                      
                      {/* Premium User Profile Card */}
                      <div className="mx-4 rounded-2xl overflow-hidden 
                        bg-gradient-to-r from-amber-100/50 via-white to-amber-100/50 
                        dark:from-amber-950/30 dark:via-gray-900 dark:to-amber-950/30
                        border border-amber-300/50 dark:border-amber-700/50 shadow-lg">
                        
                        {/* Profile row */}
                        <Link 
                          to={getProfilePath(user.id)} 
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex items-center gap-4 p-4 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-colors"
                        >
                          <div className="relative">
                            <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 opacity-50 blur-sm" />
                            {userProfile?.avatar_url ? (
                              <img 
                                src={userProfile.avatar_url} 
                                alt="Avatar" 
                                className="relative w-14 h-14 rounded-full border-2 border-white object-cover shadow-md"
                              />
                            ) : (
                              <div className="relative w-14 h-14 rounded-full bg-primary-pale border-2 border-white flex items-center justify-center shadow-md">
                                <User className="w-7 h-7 text-primary" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-lg text-foreground truncate">{getDisplayName()}</p>
                            <p className="text-sm text-muted-foreground">{t("header.viewProfile")}</p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                        </Link>
                        
                        {/* Camly Coin row */}
                        <Link 
                          to="/earn"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="flex items-center justify-between px-4 py-3 border-t border-amber-200/50 dark:border-amber-800/50
                            hover:bg-amber-50/50 dark:hover:bg-amber-950/20 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <img src={camlyCoinLogo} alt="Camly Coin" className="w-8 h-8 rounded-full" />
                            <span className="font-semibold text-foreground">{t("header.camlyCoin")}</span>
                          </div>
                          <span className="text-xl font-bold text-amber-600 dark:text-amber-400">
                            {Math.floor(balance).toLocaleString()}
                          </span>
                        </Link>
                      </div>

                      {/* Messages Button */}
                      <Link 
                        to="/messages"
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="mx-4 flex items-center justify-between p-4 rounded-xl 
                          bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30
                          border border-purple-200/50 dark:border-purple-800/50 transition-all hover:shadow-md"
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
                            <MessageCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                            {unreadCount > 0 && (
                              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                                {unreadCount > 9 ? "9+" : unreadCount}
                              </span>
                            )}
                          </div>
                          <span className="font-semibold text-foreground">{t("nav.messages") || "Tin nhắn"}</span>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground" />
                      </Link>
                      
                      {/* Admin Dashboard - Only for admins */}
                      {isAdmin && (
                        <Link 
                          to="/admin/dashboard"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="mx-4 flex items-center justify-between p-4 rounded-xl 
                            bg-gradient-to-r from-purple-100 to-violet-100 dark:from-purple-950/40 dark:to-violet-950/40
                            border border-purple-300/50 dark:border-purple-700/50 transition-all hover:shadow-md"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-purple-200 dark:bg-purple-900/50 flex items-center justify-center">
                              <Shield className="w-5 h-5 text-purple-700 dark:text-purple-400" />
                            </div>
                          <span className="font-semibold text-foreground">{t("header.adminDashboard")}</span>
                          </div>
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        </Link>
                      )}

                      {/* Attester Panel - Only for GOV Attesters */}
                      {showAttesterPanel && (
                        <Link 
                          to="/attester-panel"
                          onClick={() => setIsMobileMenuOpen(false)}
                          className="mx-4 flex items-center justify-between p-4 rounded-xl 
                            bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-950/40 dark:to-teal-950/40
                            border border-emerald-300/50 dark:border-emerald-700/50 transition-all hover:shadow-md"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-emerald-200 dark:bg-emerald-900/50 flex items-center justify-center relative">
                              <Shield className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                              {attesterPendingCount > 0 && (
                                <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold animate-pulse">
                                  {attesterPendingCount}
                                </span>
                              )}
                            </div>
                            <div>
                              <span className="font-semibold text-foreground">{t("header.attesterPanel")}</span>
                              {attesterPendingCount > 0 && (
                                <p className="text-xs text-red-600 dark:text-red-400">{t("header.pendingSignatures", { count: attesterPendingCount })}</p>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        </Link>
                      )}

                      <button
                        onClick={() => {
                          handleSignOut();
                          setIsMobileMenuOpen(false);
                        }}
                        className="mx-4 flex items-center justify-center gap-3 p-4 rounded-xl
                          bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-950/30 dark:to-rose-950/30
                          border border-red-200/50 dark:border-red-800/50 text-destructive font-semibold
                          transition-all hover:shadow-md active:scale-95"
                      >
                        <LogOut className="w-5 h-5" />
                        {t("nav.logout")}
                      </button>
                    </div>
                  ) : (
                    <Link
                      to="/auth"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="mx-4 flex items-center justify-center gap-3 p-4 text-lg font-bold 
                        text-primary-foreground bg-sapphire-gradient rounded-xl shadow-sacred 
                        hover:shadow-divine transition-all active:scale-95"
                    >
                      <LogIn className="w-6 h-6" />
                      {t("nav.login")}
                    </Link>
                  )}
                </>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
    </>
  );
};
