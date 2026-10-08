'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useAuth } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react';
import { Inter } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();

  // Prefetch dashboard route for instant post-login transition
  useEffect(() => {
    router.prefetch('/');
  }, [router]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        variant: 'destructive',
        title: 'Required Fields Missing',
        description: 'Please enter both your email address and password.',
      });
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      router.replace('/overview');
    } catch (error: any) {
      console.warn('Authentication failed:', error?.code || error?.message);
      let errorMsg = 'Invalid email address or password. Please check your credentials.';
      if (error.code === 'auth/too-many-requests') {
        errorMsg = 'Too many failed login attempts. Please try again later.';
      } else if (error.code === 'auth/user-disabled') {
        errorMsg = 'This user account has been disabled.';
      } else if (error.code === 'auth/network-request-failed') {
        errorMsg = 'Network connection failed. Please check your internet connection.';
      }
      
      toast({
        variant: 'destructive',
        title: 'Sign In Failed',
        description: errorMsg,
      });
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen w-full bg-slate-50 flex flex-col justify-between p-4 sm:p-6 ${inter.className}`}>
      {/* Spacer for vertical balance */}
      <div className="w-full max-w-7xl mx-auto py-2" />

      {/* Main Login Card */}
      <div className="w-full max-w-[400px] mx-auto my-auto">
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xl shadow-slate-200/40 p-8 sm:p-9 space-y-6">
          
          {/* Logo & Heading */}
          <div className="space-y-4">
            <div className="relative w-44 h-14">
              <Image 
                src="/FFI_main.png" 
                alt="Export OPtimum" 
                fill
                className="object-contain object-left"
                priority
              />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Sign in to your account
              </h1>
              <p className="text-xs text-slate-500 font-normal">
                Enter your work credentials to access the workspace.
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleAuth} className="space-y-4">
            
            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-slate-700">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="name@exportoptimum.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-11 px-3.5 bg-white border-slate-300 focus:border-[#193A7B] focus:ring-2 focus:ring-[#193A7B]/20 text-[#0F172A] placeholder:text-[#64748B] rounded-lg text-sm transition-all"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                  Password
                </Label>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-11 pl-3.5 pr-10 bg-white border-slate-300 focus:border-[#193A7B] focus:ring-2 focus:ring-[#193A7B]/20 text-[#0F172A] placeholder:text-[#64748B] rounded-lg text-sm transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Options */}
            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600 select-none">
                <input 
                  type="checkbox" 
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-[#193A7B] focus:ring-[#193A7B]"
                />
                <span>Remember this device</span>
              </label>
            </div>

            {/* Modern Animated Submit Button */}
            <Button 
              type="submit" 
              disabled={loading}
              className="relative group w-full h-11 bg-gradient-to-r from-[#193A7B] via-[#0284C7] to-[#0F2552] hover:from-[#0F2552] hover:to-[#193A7B] text-white font-semibold text-sm rounded-lg shadow-md shadow-[#193A7B]/20 hover:shadow-lg hover:shadow-[#193A7B]/30 transition-all duration-300 transform active:scale-[0.98] overflow-hidden flex items-center justify-center gap-2 mt-2"
            >
              {/* Shine sweep overlay */}
              <span className="absolute top-0 left-0 w-12 h-full bg-white/20 blur-sm animate-btn-shine pointer-events-none" />

              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign in</span>
                  <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
                </>
              )}
            </Button>
          </form>

        </div>
      </div>

      {/* Footer */}
      <div className="w-full max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 py-2 px-2 gap-2">
        <p>© {new Date().getFullYear()} Export Optimum. All rights reserved.</p>
        <p className="text-[11px]">Protected by enterprise security authentication</p>
      </div>
    </div>
  );
}