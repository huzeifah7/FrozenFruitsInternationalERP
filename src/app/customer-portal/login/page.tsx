'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useCustomerAuth } from '@/components/customer-auth-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ShieldCheck, Loader2 } from 'lucide-react';

export default function CustomerLoginPage() {
 const [email, setEmail] = useState('');
 const [password, setPassword] = useState('');
 const [rememberMe, setRememberMe] = useState(false);
 const [loading, setLoading] = useState(false);
 
 const router = useRouter();
 const { login } = useCustomerAuth();
 const { toast } = useToast();

 const handleLogin = async (e: React.FormEvent) => {
 e.preventDefault();
 setLoading(true);
 try {
 const success = await login(email, password);
 if (success) {
 toast({
 title: 'Welcome Back',
 description: 'Login successful! Redirecting to dashboard...',
 });
 router.push('/customer-portal/dashboard');
 } else {
 toast({
 variant: 'destructive',
 title: 'Authentication Failed',
 description: 'Invalid email, password, or inactive account status.',
 });
 }
 } catch (error: any) {
 toast({
 variant: 'destructive',
 title: 'Login Error',
 description: error.message || 'An unexpected error occurred.',
 });
 } finally {
 setLoading(false);
 }
 };

 const handleForgotPassword = () => {
 toast({
 title: 'Password Reset',
 description: 'Please contact your ERP administrator to reset your Customer Portal password.',
 });
 };

 return (
 <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-tr from-slate-100 via-[#FDFDF8] to-slate-200 p-4">
 <Card className="w-full max-w-md shadow-2xl border-t-8 border-t-[#7a9800] rounded-3xl bg-white p-2">
 <CardHeader className="space-y-4 text-center pb-2">
 <div className="flex justify-center mb-2">
 <div className="relative w-48 h-20">
 <Image 
 src="/FFI_main.png"alt="Export OPtimum Logo"fill
 className="object-contain"priority
 />
 </div>
 </div>
 <div className="space-y-1">
 <CardTitle className="text-2xl font-black tracking-tight text-[#2e1d52] uppercase flex items-center justify-center gap-2">
 <ShieldCheck className="text-[#7a9800]"size={24} />
 Customer Portal
 </CardTitle>
 <CardDescription className="text-muted-foreground/80 font-medium">
 Access your orders, deliveries, production, and invoice details
 </CardDescription>
 </div>
 </CardHeader>
 <form onSubmit={handleLogin}>
 <CardContent className="space-y-4 pt-4">
 <div className="space-y-2">
 <Label htmlFor="email"className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Portal Email</Label>
 <Input
 id="email"type="email"placeholder="name@company.com"value={email}
 onChange={(e) => setEmail(e.target.value)}
 required
 className="h-11 bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-[#7a9800] font-semibold text-sm"/>
 </div>
 <div className="space-y-2">
 <div className="flex justify-between items-center">
 <Label htmlFor="password"className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Password</Label>
 <button 
 type="button"onClick={handleForgotPassword}
 className="text-xs font-bold text-[#7a9800] hover:underline">
 Forgot Password?
 </button>
 </div>
 <Input
 id="password"type="password"placeholder="••••••••"value={password}
 onChange={(e) => setPassword(e.target.value)}
 required
 className="h-11 bg-slate-50 border-slate-200 rounded-xl focus-visible:ring-[#7a9800] font-semibold"/>
 </div>
 <div className="flex items-center space-x-2 pt-2">
 <Checkbox 
 id="remember"checked={rememberMe} 
 onCheckedChange={(checked) => setRememberMe(!!checked)}
 className="rounded border-slate-300 text-[#7a9800] focus:ring-[#7a9800]"/>
 <label 
 htmlFor="remember"className="text-xs font-semibold text-muted-foreground leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
 Remember Me
 </label>
 </div>
 </CardContent>
 <CardFooter className="flex flex-col space-y-4 pt-4">
 <Button 
 type="submit"className="w-full bg-[#7a9800] hover:bg-[#6c8500] text-white font-bold py-6 text-lg transition-all duration-200 rounded-2xl shadow-lg shadow-[#7a9800]/20"disabled={loading}
 >
 {loading ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : 'Login to Portal'}
 </Button>
 <div className="flex items-center gap-2 pt-2 justify-center w-full">
 <div className="h-px bg-border w-8"/>
 <p className="text-[10px] text-center text-muted-foreground uppercase tracking-widest font-bold">
 Customer Area
 </p>
 <div className="h-px bg-border w-8"/>
 </div>
 </CardFooter>
 </form>
 </Card>
 </div>
 );
}
