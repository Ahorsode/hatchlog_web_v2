import React from 'react';
import { getAuthContext } from '@/lib/auth-utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { User, Mail, Shield, Building, Calendar } from 'lucide-react';
import { EditProfileButton } from '@/components/profile/EditProfileButton';
import { formatRoleLabel } from '@/lib/navigation-permissions';
import { hatchlogMe, getFarm } from '@/lib/hatchlog-api';

export default async function ProfilePage() {
  const { userId, activeFarmId, role } = await getAuthContext();

  const me = await hatchlogMe();
  const farm = activeFarmId ? await getFarm(activeFarmId).catch(() => null) as any : null;

  const displayName = [me.firstname, me.surname].filter(Boolean).join(' ') || 'Farm User';

  return (
    <div className="max-w-4xl mx-auto space-y-7 px-0 md:px-3 pt-2 pb-11 md:py-11">
      <div className="relative group">
         <div className="absolute -inset-1 bg-gradient-to-r from-emerald-600 to-amber-500 rounded-lg blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
         <div className="relative bg-black/60 backdrop-blur-3xl border border-white/10 p-7 rounded-lg flex flex-col md:flex-row items-center gap-7 shadow-2xl">
            <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 p-1 shadow-[0_0_40px_rgba(16,185,129,0.3)]">
               <div className="w-full h-full rounded-full bg-gray-900 flex items-center justify-center border-4 border-black">
                  <User className="w-16 h-16 text-emerald-500" />
               </div>
            </div>
            
            <div className="flex-1 text-center md:text-left space-y-2">
               <div className="flex flex-col md:flex-row md:items-center gap-2 justify-center md:justify-start">
                  <h1 className="text-4xl font-bold text-white tracking-normal">{displayName}</h1>
                  <span className="px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest rounded-full h-fit flex items-center gap-1.5 self-center">
                     <Shield className="w-3 h-3" /> {formatRoleLabel(role)}
                  </span>
               </div>
               <p className="text-white/80 font-medium flex items-center justify-center md:justify-start gap-2">
                  <Mail className="w-4 h-4" /> {me.email}
               </p>
            </div>

            <div className="flex flex-col gap-2 w-full md:w-auto">
               <EditProfileButton 
                 initialData={{
                   firstname: me.firstname || '',
                   middleName: '',
                   surname: me.surname || ''
                 }} 
               />
            </div>
         </div>
      </div>

      <Card className="bg-black/20 border-white/5 overflow-hidden">
         <CardHeader className="border-b border-white/5 bg-white/[0.02]">
            <CardTitle className="text-sm font-bold uppercase tracking-widest text-blue-400 flex items-center gap-2">
               <Building className="w-4 h-4" /> Farm Organization
            </CardTitle>
         </CardHeader>
         <CardContent className="pt-7 pb-9 space-y-5">
            <div className="space-y-3">
               <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                     <Building className="w-5 h-5 text-blue-400" />
                  </div>
                  <div>
                     <p className="text-xs font-bold text-white/70 uppercase tracking-widest">Entity Name</p>
                     <p className="text-lg font-bold text-white">{farm?.name}</p>
                  </div>
               </div>

               <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-md bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                     <Calendar className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                     <p className="text-xs font-bold text-white/70 uppercase tracking-widest">Location</p>
                     <p className="text-sm font-medium text-white/80">{farm?.location || 'Not Specified'}</p>
                  </div>
               </div>
            </div>
         </CardContent>
      </Card>
    </div>
  );
}
