'use client';

import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { useAuthContext } from '@/components/auth-provider';
import { useAuth } from '@/firebase';
import { signOut } from 'firebase/auth';
import { useRouter, usePathname } from 'next/navigation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { User, Settings, LogOut, ChevronDown } from 'lucide-react';
import { MasterDataProvider } from '@/components/master-data-provider';
import { RouteGuard } from '@/components/layout/route-guard';
import { SeasonSelector } from '@/components/layout/season-selector';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuthContext();
  const auth = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const hideSeasonSelector = pathname.startsWith('/hr') || pathname.startsWith('/settings');

  const fullName = `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || user?.email || 'User';
  const initials = `${profile?.firstName?.[0] || ''}${profile?.lastName?.[0] || ''}`.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U';

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.replace('/login');
    } catch (error) {
      console.error('Logout error:', error);
      router.replace('/login');
    }
  };

  if (loading || !user || !profile) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#193A7B] border-t-transparent" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background selection:bg-primary/10 selection:text-primary">
        <AppSidebar />
        <SidebarInset className="flex flex-col flex-1 min-w-0 w-full overflow-hidden">
          <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-4 border-b bg-white/80 backdrop-blur-md px-6 shadow-sm">
            <SidebarTrigger className="-ml-1 text-primary hover:bg-primary/5 transition-colors" />
            <Separator orientation="vertical" className="h-6 mx-2" />
            <div className="flex-1" />
            
            {!hideSeasonSelector && <SeasonSelector />}

            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 px-3 py-2 rounded-2xl hover:bg-primary/5 transition-all group outline-none">
                  {/* Name + Role */}
                  <div className="flex flex-col items-end hidden sm:flex">
                    <span className="text-xs font-black text-primary uppercase leading-tight">{fullName}</span>
                    <Badge
                      variant="secondary"
                      className="text-[9px] py-0 h-4 uppercase tracking-tighter bg-[#0284C7]/10 text-[#0284C7] border-[#0284C7]/20 mt-0.5"
                    >
                      {profile?.role || 'Guest'}
                    </Badge>
                  </div>

                  {/* Avatar */}
                  <Avatar className="h-9 w-9 border-2 border-primary/20 group-hover:border-primary/40 transition-colors shadow-sm">
                    <AvatarImage src={profile?.avatar_url || `https://picsum.photos/seed/${user?.uid}/100/100`} />
                    <AvatarFallback className="bg-primary text-primary-foreground font-black text-sm">
                      {initials}
                    </AvatarFallback>
                  </Avatar>

                  <ChevronDown className="size-3.5 text-primary/30 group-hover:text-primary transition-colors group-data-[state=open]:rotate-180 duration-200" />
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="w-52 rounded-2xl border-primary/5 shadow-2xl shadow-primary/10 p-2 animate-in fade-in slide-in-from-top-2 duration-150"
              >
                {/* User info header */}
                <div className="px-3 py-2 mb-1">
                  <p className="text-xs font-black text-primary uppercase truncate">{fullName}</p>
                  <p className="text-[10px] text-muted-foreground/50 font-bold truncate">{user?.email}</p>
                </div>
                <DropdownMenuSeparator className="bg-primary/5 my-1" />

                <DropdownMenuItem
                  onClick={() => router.push('/profile')}
                  className="rounded-xl font-bold py-2.5 px-3 flex items-center gap-2.5 text-[11px] uppercase tracking-widest cursor-pointer hover:bg-primary/5 hover:text-primary focus:bg-primary/5 focus:text-primary transition-colors"
                >
                  <User className="size-4 text-emerald-500" />
                  Profile
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => router.push('/profile/change-password')}
                  className="rounded-xl font-bold py-2.5 px-3 flex items-center gap-2.5 text-[11px] uppercase tracking-widest cursor-pointer hover:bg-primary/5 hover:text-primary focus:bg-primary/5 focus:text-primary transition-colors"
                >
                  <Settings className="size-4 text-blue-500" />
                  Settings
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-primary/5 my-1" />

                <DropdownMenuItem
                  onClick={handleLogout}
                  className="rounded-xl font-bold py-2.5 px-3 flex items-center gap-2.5 text-[11px] uppercase tracking-widest cursor-pointer text-rose-500 hover:bg-rose-50 focus:bg-rose-50 focus:text-rose-500 transition-colors"
                >
                  <LogOut className="size-4" />
                  Log Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </header>

          <main className="flex-1 p-0 overflow-x-hidden min-w-0 w-full">
            <RouteGuard>
              {children}
            </RouteGuard>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
