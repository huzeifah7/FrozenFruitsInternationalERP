'use client';

import * as React from 'react';
import Image from 'next/image';
import {
  Users,
  Settings,
  ShoppingCart,
  ShieldCheck,
  Truck,
  TrendingDown,
  CircleDollarSign,
  ChevronRight,
  LayoutDashboard,
  Factory,
  Package,
} from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarRail,
} from '@/components/ui/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useAuthContext } from '@/components/auth-provider';
import { canList } from '@/lib/permissions';

const sidebarData = [
  {
    title: 'HR',
    icon: Users,
    items: [
      { title: 'Employees', url: '/hr/employees', moduleKey: 'hr.employees' },
      { title: 'Work Time Tracking', url: '/hr/time-tracking', moduleKey: 'hr.time-tracking' },
      { title: 'Pay Slips', url: '/hr/pay-slips', moduleKey: 'hr.pay-slips' },
      { title: 'CNSS', url: '/hr/cnss', moduleKey: 'hr.cnss' },
      { title: 'Settings', url: '/hr/settings', moduleKey: 'hr.settings' },
      { title: 'Pay Slip Audit', url: '/hr/pay-slip-audit', moduleKey: 'hr.pay-slip-audit' },
    ],
  },
  {
    title: 'Sales',
    icon: ShoppingCart,
    items: [
      { title: 'Customers', url: '/sales/customers', moduleKey: 'sales.customers' },
      { title: 'Products', url: '/sales/products', moduleKey: 'sales.products' },
      { title: 'Orders', url: '/sales/orders', moduleKey: 'sales.orders' },
    ],
  },
  {
    title: 'Quality',
    icon: ShieldCheck,
    items: [
      { title: 'Main Farms', url: '/quality/main-farms', moduleKey: 'quality.main-farms' },
      { title: 'Processing Lines', url: '/quality/lines', moduleKey: 'quality.lines' },
      { title: 'Small Farms', url: '/quality/small-farms', moduleKey: 'quality.small-farms' },
      { title: 'Lab Analysis', url: '/quality/lab', moduleKey: 'quality.lab' },
      { title: 'Quality Reports', url: '/quality/reports', moduleKey: 'quality.reports' },
      { title: 'Quality Consumable', url: '/quality/consumables', moduleKey: 'quality.consumables' },
      { title: 'Quality Stock Situations', url: '/quality/stock', moduleKey: 'quality.stock' },
    ],
  },
  {
    title: 'Production',
    icon: Factory,
    items: [
      { title: 'Dashboard', url: '/production/dashboard', moduleKey: 'production.dashboard' },
      { title: 'Orders', url: '/production/orders', moduleKey: 'production.orders' },
      { title: 'Raw Materials', url: '/production/raw-materials', moduleKey: 'production.raw-materials' },
      { title: 'Products Output', url: '/production/output', moduleKey: 'production.output' },
      { title: 'Production Daily Report', url: '/production/daily-reports', moduleKey: 'production.daily-reports' },
      { title: 'Production Feeds', url: '/production/feeds', moduleKey: 'production.feeds' },
      { title: 'Inventories', url: '/production/inventories', moduleKey: 'production.inventories' },
      { title: 'Crates Follow Up', url: '/production/crates', moduleKey: 'production.crates' },
    ],
  },
  {
    title: 'Procurement',
    icon: Truck,
    items: [
      { title: 'Raw Materials Pricing', url: '/procurement/prices', moduleKey: 'procurement.prices' },
      { title: 'Cabranes List', url: '/procurement/cabranes', moduleKey: 'procurement.cabranes' },
      { title: 'Transports List', url: '/procurement/transports', moduleKey: 'procurement.transports' },
      { title: 'Cabranes Situation', url: '/procurement/cabranes-situation', moduleKey: 'procurement.cabranes-situation' },
      { title: 'Transport Situation', url: '/procurement/transport-situation', moduleKey: 'procurement.transport-situation' },
      { title: 'Suppliers', url: '/procurement/suppliers', moduleKey: 'procurement.suppliers' },
      { title: 'Suppliers Balances', url: '/procurement/suppliers-balance', moduleKey: 'procurement.suppliers-balance' },
    ],
  },
  {
    title: 'Supply Chain',
    icon: Package,
    items: [
      { title: 'Consumables', url: '/supply-chain/consumables', moduleKey: 'supply-chain.consumables' },
      { title: 'Suppliers', url: '/supply-chain/suppliers', moduleKey: 'supply-chain.suppliers' },
      { title: 'Loadings', url: '/supply-chain/loadings', moduleKey: 'supply-chain.loadings' },
      { title: 'Orders', url: '/supply-chain/orders', moduleKey: 'supply-chain.orders' },
      { title: 'Packing Lists', url: '/supply-chain/packing-lists', moduleKey: 'supply-chain.packing-lists' },
      { title: 'Stock Situation', url: '/supply-chain/stock-situation', moduleKey: 'supply-chain.stock-situation' },
      { title: 'Inventories', url: '/supply-chain/stock-inventories', moduleKey: 'supply-chain.stock-inventories' },
    ],
  },
  {
    title: 'Decay',
    icon: TrendingDown,
    items: [
      { title: 'Decay Loading', url: '/decay/loading', moduleKey: 'decay.loading' },
      { title: 'Local Customers', url: '/decay/local-customers', moduleKey: 'decay.local-customers' },
      { title: 'Decay Sales', url: '/decay/sales', moduleKey: 'decay.sales' },
      { title: 'Decay Stock Follow Up', url: '/decay/stock-follow-up', moduleKey: 'decay.stock-follow-up' },
    ],
  },
  {
    title: 'Finance',
    icon: CircleDollarSign,
    items: [
      { title: 'Cheque FollowUp', url: '/finance/cheque-follow-ups', moduleKey: 'finance.chequeFollowUp' },
      { title: 'Caisse Espece', url: '/finance/cash', moduleKey: 'finance.cash' },
      { title: 'Caisse Bank', url: '/finance/bank', moduleKey: 'finance.bank' },
      { title: 'Bank Account Transactions', url: '/finance/bank-account-transactions', moduleKey: 'finance.bank-account-transactions' },
      { title: 'Sales Invoices', url: '/finance/invoices', moduleKey: 'finance.invoices' },
      { title: 'Customer Balances', url: '/finance/customer-balances', moduleKey: 'finance.customer-balances' },
      { title: 'Expenses', url: '/finance/expenses', moduleKey: 'finance.expenses' },
      { title: 'Suppliers', url: '/finance/suppliers', moduleKey: 'finance.suppliers' },
      { title: 'Suppliers Situation', url: '/finance/suppliers-situation', moduleKey: 'finance.suppliersSituation' },
    ],
  },
  {
    title: 'Settings',
    icon: Settings,
    items: [
      { title: 'Users', url: '/settings/users', moduleKey: 'settings.users' },
      { title: 'Payment Terms', url: '/settings/payment-terms', moduleKey: 'settings.payment-terms' },
      { title: 'Contact', url: '/settings/contact', moduleKey: 'settings.contact' },
      { title: 'Seasons', url: '/settings/seasons', moduleKey: 'settings.seasons' },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { profile } = useAuthContext();

  // Filter groups and items based on permissions
  const filteredSidebarData = React.useMemo(() => {
    return sidebarData.map(group => {
      const visibleItems = group.items.filter(item => canList(profile, item.moduleKey));
      return { ...group, items: visibleItems };
    }).filter(group => group.items.length > 0);
  }, [profile]);

  return (
    <Sidebar variant="sidebar" collapsible="icon" className="bg-sidebar text-sidebar-foreground border-r border-sidebar-border shadow-2xl transition-all duration-300">
      {/* Header */}
      <SidebarHeader className="h-16 flex items-center justify-center border-b border-white/10 px-3 group-data-[collapsible=icon]:px-0 overflow-hidden">
        <div className="flex items-center gap-3 w-full group-data-[collapsible=icon]:justify-center transition-all duration-300">
          <div className="relative h-9 w-9 shrink-0 bg-white rounded-xl flex items-center justify-center p-1 shadow-sm border border-white/20">
            <Image 
              src="/FFI_main.png" 
              alt="Export OPtimum" 
              width={28}
              height={28}
              className="object-contain"
              priority
            />
          </div>
          <div className="flex flex-col truncate group-data-[collapsible=icon]:hidden opacity-100 transition-opacity duration-300">
            <span className="font-extrabold text-sm tracking-tight text-white uppercase leading-none">
              EXPORT OPTIMUM
            </span>
            <span className="text-[9px] font-semibold text-white/60 uppercase tracking-widest mt-1">
              ENTERPRISE ERP
            </span>
          </div>
        </div>
      </SidebarHeader>
      
      {/* Content */}
      <SidebarContent className="sidebar-scrollbar py-3 px-2 group-data-[collapsible=icon]:px-1 space-y-1">
        {canList(profile, 'dashboard') && (
          <SidebarGroup className="px-2 group-data-[collapsible=icon]:px-0 mb-1">
            <SidebarGroupLabel className="text-white/40 px-2 py-1.5 font-bold uppercase text-[9px] tracking-[0.2em] group-data-[collapsible=icon]:hidden">
              MAIN
            </SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  asChild 
                  tooltip="Dashboard" 
                  isActive={pathname === '/overview'}
                  className={cn(
                    "h-10 rounded-xl px-3 transition-all duration-200 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    pathname === '/overview' && "bg-sidebar-primary text-sidebar-primary-foreground font-bold shadow-md"
                  )}
                >
                  <Link href="/overview" className="flex items-center gap-3">
                    <LayoutDashboard className="size-4.5 shrink-0" />
                    <span className="font-bold text-sm tracking-wide group-data-[collapsible=icon]:hidden">Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}

        <SidebarGroup className="px-2 group-data-[collapsible=icon]:px-0">
          <SidebarGroupLabel className="text-white/40 px-2 py-1.5 font-bold uppercase text-[9px] tracking-[0.2em] group-data-[collapsible=icon]:hidden">
            MODULES
          </SidebarGroupLabel>
          <SidebarMenu className="space-y-1">
            {filteredSidebarData.map((group) => {
              const isGroupActive = Boolean(pathname && group.items.some(item => pathname === item.url || pathname.startsWith(item.url + '/')));
              
              return (
                <Collapsible 
                  key={group.title} 
                  asChild 
                  className="group/collapsible"
                  defaultOpen={isGroupActive}
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton 
                        tooltip={group.title} 
                        className={cn(
                          "h-10 rounded-xl px-3 transition-all duration-200 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0",
                          "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                          isGroupActive && "bg-white/20 text-white font-bold"
                        )}
                      >
                        <group.icon className="size-4.5 shrink-0 opacity-90" />
                        <span className="font-bold text-sm flex-1 tracking-wide group-data-[collapsible=icon]:hidden">{group.title}</span>
                        <ChevronRight className="size-4 opacity-60 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 group-data-[collapsible=icon]:hidden" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
                      <SidebarMenuSub className="ml-3.5 border-l border-white/20 pl-3 my-1 space-y-1">
                        {group.items.map((subItem) => {
                          const isSubActive = Boolean(pathname && (pathname === subItem.url || pathname.startsWith(subItem.url + '/')));

                          return (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton 
                                asChild 
                                isActive={isSubActive}
                                className={cn(
                                  "text-xs font-semibold py-2 px-2.5 h-8 rounded-lg transition-all duration-200",
                                  "text-white/80 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent",
                                  isSubActive && "bg-sidebar-primary text-sidebar-primary-foreground font-bold shadow-sm"
                                )}
                              >
                                <Link href={subItem.url}>
                                  <span className="truncate">{subItem.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          );
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
