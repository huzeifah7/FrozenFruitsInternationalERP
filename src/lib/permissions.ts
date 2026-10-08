import { User } from 'firebase/auth';

export interface AppModule {
  moduleKey: string;
  label: string;
  sidebarParent: string;
  basePath: string; // the root path of the module
}

export const permissionsRegistry: AppModule[] = [
  // General
  { moduleKey: 'dashboard', label: 'Dashboard', sidebarParent: 'General', basePath: '/overview' },

  // HR
  { moduleKey: 'hr.employees', label: 'Employees', sidebarParent: 'HR', basePath: '/hr/employees' },
  { moduleKey: 'hr.time-tracking', label: 'Work Time Tracking', sidebarParent: 'HR', basePath: '/hr/time-tracking' },
  { moduleKey: 'hr.pay-slips', label: 'Pay Slips', sidebarParent: 'HR', basePath: '/hr/pay-slips' },
  { moduleKey: 'hr.cnss', label: 'CNSS', sidebarParent: 'HR', basePath: '/hr/cnss' },
  { moduleKey: 'hr.settings', label: 'Settings', sidebarParent: 'HR', basePath: '/hr/settings' },
  { moduleKey: 'hr.pay-slip-audit', label: 'Pay Slip Audit', sidebarParent: 'HR', basePath: '/hr/pay-slip-audit' },

  // Sales
  { moduleKey: 'sales.customers', label: 'Customers', sidebarParent: 'Sales', basePath: '/sales/customers' },
  { moduleKey: 'sales.products', label: 'Products', sidebarParent: 'Sales', basePath: '/sales/products' },
  { moduleKey: 'sales.orders', label: 'Orders', sidebarParent: 'Sales', basePath: '/sales/orders' },

  // Quality
  { moduleKey: 'quality.main-farms', label: 'Main Farms', sidebarParent: 'Quality', basePath: '/quality/main-farms' },
  { moduleKey: 'quality.lines', label: 'Processing Lines', sidebarParent: 'Quality', basePath: '/quality/lines' },
  { moduleKey: 'quality.small-farms', label: 'Small Farms', sidebarParent: 'Quality', basePath: '/quality/small-farms' },
  { moduleKey: 'quality.lab', label: 'Lab Analysis', sidebarParent: 'Quality', basePath: '/quality/lab' },
  { moduleKey: 'quality.reports', label: 'Quality Reports', sidebarParent: 'Quality', basePath: '/quality/reports' },
  { moduleKey: 'quality.consumables', label: 'Quality Consumable', sidebarParent: 'Quality', basePath: '/quality/consumables' },
  { moduleKey: 'quality.stock', label: 'Quality Stock Situations', sidebarParent: 'Quality', basePath: '/quality/stock' },

  // Production
  { moduleKey: 'production.dashboard', label: 'Dashboard', sidebarParent: 'Production', basePath: '/production/dashboard' },
  { moduleKey: 'production.orders', label: 'Orders', sidebarParent: 'Production', basePath: '/production/orders' },
  { moduleKey: 'production.raw-materials', label: 'Raw Materials', sidebarParent: 'Production', basePath: '/production/raw-materials' },
  { moduleKey: 'production.output', label: 'Products Output', sidebarParent: 'Production', basePath: '/production/output' },
  { moduleKey: 'production.daily-reports', label: 'Production Daily Report', sidebarParent: 'Production', basePath: '/production/daily-reports' },
  { moduleKey: 'production.feeds', label: 'Production Feeds', sidebarParent: 'Production', basePath: '/production/feeds' },
  { moduleKey: 'production.inventories', label: 'Inventories', sidebarParent: 'Production', basePath: '/production/inventories' },
  { moduleKey: 'production.crates', label: 'Crates Follow Up', sidebarParent: 'Production', basePath: '/production/crates' },

  // Procurement
  { moduleKey: 'procurement.prices', label: 'Raw Materials Pricing', sidebarParent: 'Procurement', basePath: '/procurement/prices' },
  { moduleKey: 'procurement.cabranes', label: 'Cabranes List', sidebarParent: 'Procurement', basePath: '/procurement/cabranes' },
  { moduleKey: 'procurement.transports', label: 'Transports List', sidebarParent: 'Procurement', basePath: '/procurement/transports' },
  { moduleKey: 'procurement.cabranes-situation', label: 'Cabranes Situation', sidebarParent: 'Procurement', basePath: '/procurement/cabranes-situation' },
  { moduleKey: 'procurement.transport-situation', label: 'Transport Situation', sidebarParent: 'Procurement', basePath: '/procurement/transport-situation' },
  { moduleKey: 'procurement.suppliers', label: 'Suppliers', sidebarParent: 'Procurement', basePath: '/procurement/suppliers' },
  { moduleKey: 'procurement.suppliers-balance', label: 'Suppliers Balances', sidebarParent: 'Procurement', basePath: '/procurement/suppliers-balance' },

  // Supply Chain
  { moduleKey: 'supply-chain.consumables', label: 'Consumables', sidebarParent: 'Supply Chain', basePath: '/supply-chain/consumables' },
  { moduleKey: 'supply-chain.suppliers', label: 'Suppliers', sidebarParent: 'Supply Chain', basePath: '/supply-chain/suppliers' },
  { moduleKey: 'supply-chain.loadings', label: 'Loadings', sidebarParent: 'Supply Chain', basePath: '/supply-chain/loadings' },
  { moduleKey: 'supply-chain.orders', label: 'Orders', sidebarParent: 'Supply Chain', basePath: '/supply-chain/orders' },
  { moduleKey: 'supply-chain.packing-lists', label: 'Packing Lists', sidebarParent: 'Supply Chain', basePath: '/supply-chain/packing-lists' },
  { moduleKey: 'supply-chain.stock-situation', label: 'Stock Situation', sidebarParent: 'Supply Chain', basePath: '/supply-chain/stock-situation' },
  { moduleKey: 'supply-chain.stock-inventories', label: 'Inventories', sidebarParent: 'Supply Chain', basePath: '/supply-chain/stock-inventories' },

  // Decay
  { moduleKey: 'decay.loading', label: 'Decay Loading', sidebarParent: 'Decay', basePath: '/decay/loading' },
  { moduleKey: 'decay.local-customers', label: 'Local Customers', sidebarParent: 'Decay', basePath: '/decay/local-customers' },
  { moduleKey: 'decay.sales', label: 'Decay Sales', sidebarParent: 'Decay', basePath: '/decay/sales' },
  { moduleKey: 'decay.stock-follow-up', label: 'Decay Stock Follow Up', sidebarParent: 'Decay', basePath: '/decay/stock-follow-up' },

  // Finance
  { moduleKey: 'finance.chequeFollowUp', label: 'Cheque FollowUp', sidebarParent: 'Finance', basePath: '/finance/cheque-follow-ups' },
  { moduleKey: 'finance.suppliersSituation', label: 'Suppliers Situation', sidebarParent: 'Finance', basePath: '/finance/suppliers-situation' },
  { moduleKey: 'finance.cash', label: 'Caisse Espece', sidebarParent: 'Finance', basePath: '/finance/cash' },
  { moduleKey: 'finance.bank', label: 'Caisse Bank', sidebarParent: 'Finance', basePath: '/finance/bank' },
  { moduleKey: 'finance.bank-account-transactions', label: 'Bank Account Transactions', sidebarParent: 'Finance', basePath: '/finance/bank-account-transactions' },
  { moduleKey: 'finance.salesInvoice', label: 'Sales Invoice', sidebarParent: 'Finance', basePath: '/finance/invoices' },
  { moduleKey: 'finance.customer-balances', label: 'Customer Balances', sidebarParent: 'Finance', basePath: '/finance/customer-balances' },
  { moduleKey: 'finance.expenses', label: 'Expenses', sidebarParent: 'Finance', basePath: '/finance/expenses' },
  { moduleKey: 'finance.suppliers', label: 'Suppliers', sidebarParent: 'Finance', basePath: '/finance/suppliers' },

  // Settings
  { moduleKey: 'settings.users', label: 'Users', sidebarParent: 'Settings', basePath: '/settings/users' },
  { moduleKey: 'settings.payment-terms', label: 'Payment Terms', sidebarParent: 'Settings', basePath: '/settings/payment-terms' },
  { moduleKey: 'settings.contact', label: 'Contact', sidebarParent: 'Settings', basePath: '/settings/contact' },
  { moduleKey: 'settings.seasons', label: 'Seasons', sidebarParent: 'Settings', basePath: '/settings/seasons' },
];

export interface UserAccessRight {
  moduleKey: string;
  moduleLabel: string;
  list: boolean;
  add: boolean;
  update: boolean;
  delete: boolean;
}

export function isAdmin(userProfile: any): boolean {
  return true;
}

export function hasPermission(userProfile: any, moduleKey: string, action: 'list' | 'add' | 'update' | 'delete'): boolean {
  if (!userProfile) return false;
  return true;
}

export function canList(userProfile: any, moduleKey: string): boolean {
  if (!userProfile) return false;
  return true;
}

export function canAdd(userProfile: any, moduleKey: string): boolean {
  return hasPermission(userProfile, moduleKey, 'add');
}

export function canUpdate(userProfile: any, moduleKey: string): boolean {
  return hasPermission(userProfile, moduleKey, 'update');
}

export function canDelete(userProfile: any, moduleKey: string): boolean {
  return hasPermission(userProfile, moduleKey, 'delete');
}
