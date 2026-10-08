'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/components/auth-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Mail,
  Phone,
  MapPin,
  Edit,
  User,
  Briefcase,
  Shield,
} from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const { user, profile } = useAuthContext();

  const fullName = `${profile?.firstName || ''} ${profile?.lastName || ''}`.trim() || user?.email || 'Unknown User';
  const initials = `${profile?.firstName?.[0] || ''}${profile?.lastName?.[0] || ''}`.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U';

  const DetailRow = ({ icon: Icon, label, value }: { icon: any; label: string; value?: string }) => (
    <div className="flex items-center gap-5 py-5 border-b border-primary/5 last:border-0 group">
      <div className="w-10 h-10 rounded-2xl bg-primary/5 flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
        <Icon className="size-4 text-primary/40 group-hover:text-primary transition-colors" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground/40 mb-0.5">{label}</p>
        <p className="text-sm font-bold text-primary truncate">{value || <span className="opacity-30 italic">Not set</span>}</p>
      </div>
    </div>
  );

  return (
    <div className="p-6 max-w-[900px] mx-auto space-y-8 animate-in fade-in duration-700">
      {/* Header */}
      <div className="space-y-1">
        <nav className="flex text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground/40">
          <ol className="inline-flex items-center space-x-2">
            <li>Dashboard</li>
            <li className="flex items-center">
              <span className="mx-2 opacity-20">/</span>
              <span className="text-primary/60 font-black">Profile</span>
            </li>
          </ol>
        </nav>
        <h1 className="text-3xl font-black text-primary tracking-tight uppercase leading-none">My Profile</h1>
      </div>

      {/* Cover + Avatar Banner */}
      <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-primary/5 border border-primary/5 overflow-hidden">
        {/* Cover */}
        <div className="h-40 bg-gradient-to-br from-[#193A7B] via-[#0F2552] to-[#0284C7] relative overflow-hidden">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-white/10 to-transparent" />
        </div>

        {/* Avatar overlapping banner */}
        <div className="flex flex-col items-center -mt-14 pb-8 px-8">
          <div className="relative">
            <Avatar className="h-28 w-28 border-4 border-white shadow-2xl shadow-primary/20">
              <AvatarImage src={profile?.avatar_url || `https://picsum.photos/seed/${user?.uid}/200/200`} />
              <AvatarFallback className="bg-[#193A7B] text-white text-3xl font-black">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
          <h2 className="mt-4 text-2xl font-black text-primary uppercase tracking-tight">{fullName}</h2>
          <div className="flex items-center gap-2 mt-2">
            <Badge className="bg-[#0284C7]/10 text-[#0284C7] border-[#0284C7]/20 text-[10px] font-black uppercase tracking-widest px-3 py-1 flex items-center gap-1.5">
              <Shield className="size-3" /> {profile?.role || 'Guest'}
            </Badge>
            {profile?.position && (
              <Badge variant="outline" className="border-primary/10 text-primary/60 text-[10px] font-black uppercase tracking-widest px-3 py-1 flex items-center gap-1.5">
                <Briefcase className="size-3" /> {profile.position}
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-white rounded-[2.5rem] shadow-xl shadow-primary/5 border border-primary/5 overflow-hidden">
        <div className="bg-primary/[0.02] px-8 py-5 border-b border-primary/5 flex items-center justify-between">
          <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary/40 flex items-center gap-2">
            <User className="size-3.5" /> User Profile
          </h2>
          <Button
            onClick={() => router.push('/profile/edit')}
            className="h-9 px-5 bg-[#193A7B] hover:bg-[#0F2552] text-white font-black rounded-xl shadow-lg shadow-[#193A7B]/20 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2 text-[10px] uppercase tracking-widest"
          >
            <Edit className="size-3.5" /> Edit Profile
          </Button>
        </div>

        <div className="px-8 py-2">
          <DetailRow icon={Mail} label="Email Address" value={profile?.email || user?.email || undefined} />
          <DetailRow icon={Phone} label="Phone Number" value={profile?.phone} />
          <DetailRow icon={MapPin} label="Location / Address" value={profile?.location} />
          <DetailRow icon={Briefcase} label="Position" value={profile?.position} />
        </div>
      </div>
    </div>
  );
}
