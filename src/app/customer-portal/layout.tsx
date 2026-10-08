'use client';

import React, { useEffect, useState, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CustomerAuthProvider, useCustomerAuth } from '@/components/customer-auth-provider';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Truck, 
  Package, 
  FileText, 
  User, 
  LogOut,
  Menu,
  X,
  Building,
  ChevronRight,
  ShieldCheck,
  Sparkles,
  Bell,
  ChevronDown,
  Key,
  Building2,
  Users,
  ClipboardCheck,
  Sprout,
  PanelLeftClose,
  PanelLeft,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { SeasonSelector } from '@/components/layout/season-selector';
import { useSeason } from '@/contexts/SeasonContext';

function CustomerPortalLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, customer, loading, logout } = useCustomerAuth();
  const { currentSeason } = useSeason();
  const pathname = usePathname();
  const router = useRouter();
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [hasNotifications, setHasNotifications] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const profileDropdownRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);

  const isLoginPage = pathname === '/customer-portal/login';

  // Handle click outside dropdowns
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setProfileDropdownOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!loading && !user && !isLoginPage) {
      router.push('/customer-portal/login');
    }
  }, [user, loading, isLoginPage, router]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4 p-8 bg-white rounded-3xl shadow-xl border border-slate-100">
          <div className="relative flex items-center justify-center">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-[#0284C7]/20 border-t-[#0284C7]" />
            <Sparkles className="absolute h-6 w-6 text-[#0284C7] animate-pulse" />
          </div>
          <p className="text-xs font-black text-slate-800 uppercase tracking-widest">Loading Portal...</p>
        </div>
      </div>
    );
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (!user) {
    return null;
  }

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', href: '/customer-portal/dashboard', icon: LayoutDashboard },
    { id: 'orders', label: 'Orders', href: '/customer-portal/orders', icon: ShoppingCart },
    { id: 'loadings', label: 'Loadings', href: '/customer-portal/loadings', icon: Truck },
    { id: 'invoices', label: 'Invoices & Payments', href: '/customer-portal/invoices', icon: FileText },
    { id: 'packing-sites', label: 'Packing Sites', href: '/customer-portal/packing-sites', icon: Package },
    { id: 'farms', label: 'Farms', href: '/customer-portal/farms', icon: Sprout },
    { id: 'reports', label: 'Quality Reports', href: '/customer-portal/reports', icon: ClipboardCheck },
    { id: 'contacts', label: 'Contacts', href: '/customer-portal/contacts', icon: Users },
  ];

  const currentNav = menuItems.find(item => pathname?.startsWith(item.href)) || menuItems[0];

  return (
    <div className="flex h-screen w-screen bg-slate-50 overflow-hidden text-slate-900 font-body antialiased">
      
      {/* Desktop Sidebar (Collapsible: 260px <-> 70px) */}
      <motion.aside 
        animate={{ width: sidebarCollapsed ? 76 : 260 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1.0] }}
        className="hidden lg:flex flex-col bg-white shrink-0 border-r border-slate-200/80 shadow-xs relative z-20 overflow-hidden"
      >
        {/* Sidebar Header / Branding */}
        <div className="h-20 flex items-center justify-between px-4 border-b border-slate-100/80 shrink-0">
          <Link href="/customer-portal/dashboard" className="flex items-center gap-3 min-w-0 overflow-hidden group">
            <div className="relative h-11 w-11 bg-white rounded-2xl p-1 flex items-center justify-center border border-slate-200/60 shrink-0 group-hover:scale-105 transition-transform shadow-xs">
              <img 
                src="/FFI_main.png" 
                alt="Export Optimum Logo" 
                className="object-contain max-h-full max-w-full"
              />
            </div>
            {!sidebarCollapsed && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col min-w-0"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black uppercase text-[#0284C7] tracking-widest leading-none">OPTIMUM PORTAL</span>
                  <ShieldCheck className="h-3.5 w-3.5 text-[#0284C7]" />
                </div>
                <span className="text-sm font-extrabold tracking-tight truncate text-slate-900 mt-0.5">
                  Export Optimum
                </span>
              </motion.div>
            )}
          </Link>

          {/* Toggle Sidebar Collapse */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="h-8 w-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0 transition-colors"
            title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {sidebarCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
          </Button>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto overflow-x-hidden scrollbar-none">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname ? pathname.startsWith(item.href) : false;
            return (
              <Link 
                key={item.id} 
                href={item.href}
                className={cn(
                  "relative flex items-center gap-3.5 px-3.5 py-3 rounded-2xl text-xs font-bold tracking-wide transition-all duration-200 group",
                  isActive 
                    ? "text-[#193A7B] font-black bg-[#193A7B]/10 shadow-2xs" 
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
                )}
                title={sidebarCollapsed ? item.label : undefined}
              >
                {isActive && (
                  <motion.div 
                    layoutId="sidebarActivePill"
                    className="absolute left-0 w-1.5 h-6 bg-[#193A7B] rounded-r-full"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
                <Icon size={19} className={cn(
                  "shrink-0 transition-transform duration-200 group-hover:scale-110",
                  isActive ? "text-[#193A7B]" : "text-slate-400 group-hover:text-slate-600"
                )} />
                {!sidebarCollapsed && (
                  <span className="truncate text-xs font-bold">{item.label}</span>
                )}
              </Link>
            );
          })}
        </nav>


      </motion.aside>

      {/* Mobile Drawer Backdrop & Sidebar Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs lg:hidden z-40"
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.aside 
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="fixed top-0 bottom-0 left-0 z-50 w-72 bg-white text-slate-900 flex flex-col lg:hidden border-r border-slate-200 shadow-2xl"
            >
              <div className="h-20 flex items-center justify-between px-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="relative h-9 w-9 bg-white rounded-xl p-1 flex items-center justify-center border border-slate-200 shadow-xs">
                    <img src="/FFI_main.png" alt="Export Optimum Logo" className="object-contain max-h-full max-w-full" />
                  </div>
                  <span className="text-sm font-extrabold tracking-tight truncate max-w-[140px]">Export Optimum</span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)} className="rounded-full h-8 w-8">
                  <X size={18} />
                </Button>
              </div>

              <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto">
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname ? pathname.startsWith(item.href) : false;
                  return (
                    <Link 
                      key={item.id} 
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-3.5 px-4 py-3 rounded-2xl text-xs font-bold tracking-wide transition-all",
                        isActive 
                          ? "bg-[#193A7B]/15 text-[#193A7B] font-black" 
                          : "text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      <Icon size={19} className={isActive ? "text-[#193A7B]" : "text-slate-400"} />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>

              <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                <Button 
                  onClick={logout} 
                  variant="ghost" 
                  className="w-full justify-start text-rose-600 hover:bg-rose-50 font-bold text-xs h-10 rounded-xl px-3"
                >
                  <LogOut size={16} className="mr-2" /> Sign Out
                </Button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Container Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        
        {/* Sticky Glass Top Header */}
        <header className="h-20 bg-white/85 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between px-4 sm:px-6 shrink-0 z-30 sticky top-0 shadow-2xs">
          
          {/* Header Left: Hamburger + Breadcrumbs */}
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Mobile Hamburger Button */}
            <button 
              type="button" 
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden h-10 w-10 flex items-center justify-center text-slate-700 hover:bg-slate-100 rounded-2xl transition-colors border border-slate-200/60"
            >
              <Menu size={20} />
            </button>

            {/* Breadcrumbs & Title */}
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Portal</span>
                <ChevronRight size={12} className="text-slate-300" />
                <span className="text-[#0284C7] font-black">{currentNav.label}</span>
              </div>
              <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-900 truncate mt-0.5">
                {currentNav.label}
              </h1>
            </div>
          </div>

          {/* Header Center: Season Selector */}
          <div className="hidden md:flex items-center justify-center mx-4 max-w-xs w-full">
            <div className="w-52">
              <SeasonSelector />
            </div>
          </div>

          {/* Header Right: Mobile Season + Notifications + Profile Dropdown */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            
            {/* Mobile Season Selector */}
            <div className="md:hidden w-36">
              <SeasonSelector />
            </div>

            {/* Profile Dropdown Container (Positioned immediately after Season Selector) */}
            <div className="relative" ref={profileDropdownRef}>
              <button
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-2.5 p-1.5 pl-2.5 pr-2 rounded-2xl bg-white hover:bg-slate-100/80 border border-slate-200/80 shadow-2xs transition-all duration-200 group focus:outline-none"
              >
                <Avatar className="h-8 w-8 border border-[#193A7B]/30 shrink-0">
                  <AvatarImage src={customer?.logoUrl || ''} />
                  <AvatarFallback className="bg-[#193A7B] text-white font-bold text-xs">
                    {(user.first_name?.[0] || 'U')}{(user.last_name?.[0] || '')}
                  </AvatarFallback>
                </Avatar>
                
                <div className="hidden sm:flex flex-col text-left min-w-0 max-w-[120px]">
                  <span className="text-xs font-extrabold text-slate-900 truncate group-hover:text-[#193A7B] transition-colors">
                    {user.first_name} {user.last_name}
                  </span>
                  <span className="text-[9px] font-black text-[#0284C7] uppercase tracking-wider leading-none mt-0.5 truncate">
                    {user.user_type || 'Customer'}
                  </span>
                </div>

                <ChevronDown size={14} className={cn("text-slate-400 transition-transform duration-200", profileDropdownOpen && "rotate-180")} />
              </button>

              {/* Animated Profile Dropdown Menu */}
              <AnimatePresence>
                {profileDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 12, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 12, scale: 0.95 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute right-0 mt-3 w-80 bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden z-50"
                  >
                    {/* Header Info Section inside Dropdown */}
                    <div className="p-5 bg-gradient-to-br from-[#193A7B]/10 via-slate-50 to-slate-100/50 border-b border-slate-100">
                      <div className="flex items-center gap-3.5">
                        <Avatar className="h-12 w-12 border-2 border-[#193A7B]/40 shadow-xs">
                          <AvatarImage src={customer?.logoUrl || ''} />
                          <AvatarFallback className="bg-[#193A7B] text-white font-bold text-sm">
                            {(user.first_name?.[0] || 'U')}{(user.last_name?.[0] || '')}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0 flex-1">
                          <h4 className="text-sm font-black text-slate-900 truncate">
                            {user.first_name} {user.last_name}
                          </h4>
                          <p className="text-xs text-slate-500 truncate font-medium">{user.email}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] font-black uppercase text-[#0284C7] bg-[#0284C7]/15 px-2 py-0.5 rounded-full border border-[#0284C7]/20">
                              {user.user_type || 'Customer'}
                            </span>
                            {customer?.companyName && (
                              <span className="text-[10px] font-bold text-slate-600 truncate max-w-[120px]">
                                {customer.companyName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Active Season Banner */}
                      {currentSeason && (
                        <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs font-bold text-slate-600">
                          <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">Active Season</span>
                          <span className="text-[#0284C7] font-extrabold bg-white px-2.5 py-0.5 rounded-lg border border-slate-200/80 shadow-2xs">
                            {currentSeason.name}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Menu Items */}
                    <div className="p-2 space-y-1">
                      <Link 
                        href="/customer-portal/profile" 
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100/80 transition-colors"
                      >
                        <User size={16} className="text-slate-400" />
                        <span>View Profile</span>
                      </Link>

                      <Link 
                        href="/customer-portal/profile" 
                        onClick={() => setProfileDropdownOpen(false)}
                        className="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-100/80 transition-colors"
                      >
                        <Key size={16} className="text-slate-400" />
                        <span>Change Password</span>
                      </Link>
                    </div>

                    {/* Logout Button */}
                    <div className="p-2 border-t border-slate-100 bg-slate-50/50">
                      <button
                        type="button"
                        onClick={() => {
                          setProfileDropdownOpen(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-2xl text-xs font-bold text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <LogOut size={16} />
                        <span>Logout</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          </div>
        </header>

        {/* Content Body with Page Transition */}
        <main className="flex-1 overflow-y-auto bg-slate-50/70 p-3 sm:p-4 lg:p-5 focus:outline-none">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="max-w-7xl mx-auto"
          >
            {children}
          </motion.div>
        </main>
      </div>

    </div>
  );
}

export default function CustomerPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <CustomerAuthProvider>
      <CustomerPortalLayoutContent>{children}</CustomerPortalLayoutContent>
    </CustomerAuthProvider>
  );
}
