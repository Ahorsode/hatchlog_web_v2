import React from 'react';
import { getCustomerStatement } from '@/lib/actions/statement-actions';
import { Card, CardContent } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeft, User, Calendar, ShoppingCart, Receipt, MapPin, Phone, Mail, Download, Tag } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function CustomerStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customerId = id;
  
  if (!customerId) {
    redirect('/dashboard/sales/customers');
  }

  const statement = await getCustomerStatement(customerId);

  if (!statement) {
    redirect('/dashboard/sales/customers');
  }

  const transactions = statement.orders.sort((a, b) => new Date(b.orderDate || b.createdAt).getTime() - new Date(a.orderDate || a.createdAt).getTime());

  return (
    <div className="max-w-[1200px] mx-auto space-y-7 px-0 md:px-5 pt-2 pb-9 md:py-9 relative">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/sales/customers" className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-colors border border-white/10 shrink-0 hover:scale-105">
            <ArrowLeft className="w-6 h-6 text-blue-400" />
          </Link>
          <div>
            <h1 className="text-3xl font-black text-white tracking-normal">Transaction <span className="text-blue-400 italic">Statement</span></h1>
            <p className="text-white/60 font-black uppercase tracking-[0.2em] text-[10px] mt-1">Customer: {statement.name}</p>
          </div>
        </div>
        <button className="bg-white text-black px-6 py-3 rounded-md font-bold uppercase tracking-widest text-[10px] hover:scale-105 transition-all flex items-center gap-2 cursor-not-allowed opacity-50">
           <Download className="w-4 h-4" />
           Download PDF (Soon)
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* Sidebar Stats */}
         <div className="space-y-6">
            <Card className="bg-white/10 border-white/10 backdrop-blur-xl h-fit">
               <CardContent className="p-6 space-y-6">
                  <div className="flex items-center gap-4 pb-6 border-b border-white/5">
                     <div className="w-14 h-14 rounded-lg bg-blue-500/20 flex items-center justify-center text-xl font-bold text-blue-400">
                        {statement.name.charAt(0)}
                     </div>
                     <div className="overflow-hidden">
                        <h3 className="text-lg font-bold text-white truncate">{statement.name}</h3>
                        <p className="text-blue-400/60 text-[9px] font-black uppercase tracking-widest">Customer Account</p>
                     </div>
                  </div>

                  <div className="space-y-4">
                     <div className="flex items-center gap-3 text-white/70">
                        <Phone className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-bold">{statement.phone || 'N/A'}</span>
                     </div>
                     <div className="flex items-center gap-3 text-white/70">
                        <Mail className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-bold truncate">{statement.email || 'N/A'}</span>
                     </div>
                     <div className="flex items-center gap-3 text-white/70">
                        <MapPin className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-bold line-clamp-2">{statement.address || 'N/A'}</span>
                     </div>
                  </div>

                  <div className="pt-6 border-t border-white/5 space-y-4">
                     <div className="p-4 rounded-md bg-red-500/10 border border-red-500/20">
                        <p className="text-[10px] font-black uppercase text-red-400/60 mb-1 tracking-widest">Balance Owed (By Customer)</p>
                        <p className="text-2xl font-black text-red-400">{formatCurrency(statement.balanceOwed)}</p>
                     </div>
                  </div>
               </CardContent>
            </Card>
         </div>

         {/* Transaction Timeline */}
         <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-black text-white uppercase tracking-widest px-2 mb-4">Order History</h2>
            {transactions.length === 0 ? (
               <div className="flex flex-col items-center justify-center py-20 bg-white/5 border border-dashed border-white/10 rounded-lg text-white/30 italic">
                  No orders recorded yet.
               </div>
            ) : (
               transactions.map((order, index) => (
                  <div key={order.id} className="group relative bg-white/5 border border-white/10 p-5 rounded-lg hover:bg-white/[0.08] transition-all">
                     <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-white/5">
                        <div className="flex items-center gap-5">
                           <div className={`p-3 rounded-md bg-blue-500/10 group-hover:scale-110 transition-transform shrink-0`}>
                              <ShoppingCart className="w-5 h-5 text-blue-400" />
                           </div>
                           <div>
                              <p className="text-white font-bold text-lg leading-tight">Order {index + 1}</p>
                              <div className="flex items-center gap-3 mt-1">
                                 <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${order.status === 'PAID' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                    {order.status}
                                 </span>
                                 <div className="flex items-center gap-1.5 text-white/30 text-[10px] font-bold">
                                    <Calendar className="w-3 h-3" />
                                    {new Date(order.orderDate || order.createdAt).toLocaleDateString()}
                                 </div>
                              </div>
                           </div>
                        </div>
                        <div className="sm:text-right shrink-0">
                           <p className="text-xl font-black text-white">{formatCurrency(order.totalAmount)}</p>
                           {Number(order.discountAmount) > 0 && (
                             <p className="text-[10px] font-black uppercase text-emerald-400 tracking-widest flex items-center justify-end gap-1">
                                <Tag className="w-3 h-3" />
                                -{formatCurrency(order.discountAmount)} Off
                             </p>
                           )}
                        </div>
                     </div>
                     
                     <div className="space-y-2">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-[11px] font-bold">
                             <span className="text-white/60 uppercase tracking-widest truncate max-w-[70%]">
                               {item.description} <span className="text-white/20 italic font-normal">x{item.quantity}</span>
                             </span>
                             <span className="text-white shrink-0">{formatCurrency(item.totalPrice)}</span>
                          </div>
                        ))}
                     </div>
                  </div>
               ))
            )}
         </div>
      </div>
    </div>
  );
}
