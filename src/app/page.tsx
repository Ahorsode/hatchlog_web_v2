import React from 'react';
import Link from 'next/link';
import { ArrowRight, Activity, Calculator, Bell, ShieldCheck, TrendingUp } from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-5 h-20 flex items-center justify-between">
          <div className="text-2xl font-bold text-green-900 tracking-normal flex items-center">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-amber-400 to-amber-600 mr-2 flex justify-center items-center">
              <span className="text-white font-bold text-lg">A</span>
            </div>
            AgriTech
          </div>
          <div className="space-x-7 hidden md:flex font-medium text-gray-600">
            <a href="#features" className="hover:text-green-800 transition-colors">Features</a>
            <a href="#markets" className="hover:text-green-800 transition-colors">Markets</a>
            <a href="#testimonials" className="hover:text-green-800 transition-colors">Testimonials</a>
          </div>
          <div>
            <Link href="/dashboard" className="bg-green-800 hover:bg-green-700 text-white px-5 py-2.5 rounded-full font-medium transition-all shadow-md hover:shadow-lg flex items-center group">
              Dashboard Login
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden flex-1 flex items-center">
        {/* Background Decorative Blobs */}
        <div className="absolute top-0 right-0 -translate-y-12 translate-x-1/3 w-96 h-96 bg-green-200/50 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 translate-y-1/3 -translate-x-1/4 w-[500px] h-[500px] bg-amber-100/50 rounded-full blur-3xl pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-5 grid lg:grid-cols-2 gap-11 items-center relative z-10">
          <div className="max-w-2xl">
            <div className="inline-flex items-center space-x-2 bg-amber-100 text-amber-800 px-3 py-2 rounded-full text-sm font-semibold mb-5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-600"></span>
              </span>
              <span>Next-Gen Poultry Management</span>
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 leading-tight mb-5 tracking-normal">
              Precision Poultry Management: <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-800 to-green-600 drop-shadow-sm">
                From Day-Old Chicks to Market.
              </span>
            </h1>
            <p className="text-xl text-gray-600 mb-9 leading-relaxed max-w-lg">
              Elevate your farm&apos;s productivity with intelligent tracking, real-time analytics, and automated health monitoring designed by farmers, for farmers.
            </p>
            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4">
              <Link href="/dashboard" className="bg-amber-500 hover:bg-amber-400 text-white px-7 py-3 rounded-full font-bold text-lg transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 text-center border-b-4 border-amber-600 active:border-b-0 active:translate-y-0">
                Start Your First Batch
              </Link>
              <button className="bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 px-7 py-3 rounded-full font-bold text-lg transition-all shadow-sm hover:shadow text-center flex items-center justify-center">
                Watch Demo
              </button>
            </div>
          </div>
          
          <div className="relative mx-auto w-full max-w-lg lg:max-w-none">
            {/* Abstract Dashboard Graphic Presentation */}
            <div className="relative rounded-md shadow-2xl overflow-hidden bg-white border border-gray-100 transform rotate-2 hover:rotate-0 transition-transform duration-500 z-10">
              <div className="bg-gray-50 border-b border-gray-100 px-3 py-2 flex items-center space-x-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="p-5 relative bg-white h-72">
                 <div className="absolute top-0 right-0 p-5 opacity-5">
                   <TrendingUp className="w-48 h-48 text-green-800" />
                 </div>
                 <div className="space-y-3 relative z-10">
                   <div className="h-6 w-32 bg-gray-200 rounded-md" />
                   <div className="grid grid-cols-2 gap-3">
                     <div className="h-28 bg-green-50 rounded-md border border-green-100 p-3 transition-transform hover:scale-105">
                        <div className="h-4 w-16 bg-green-200 rounded mb-2" />
                        <div className="h-8 w-12 bg-green-300 rounded" />
                     </div>
                     <div className="h-28 bg-amber-50 rounded-md border border-amber-100 p-3 transition-transform hover:scale-105">
                        <div className="h-4 w-16 bg-amber-200 rounded mb-2" />
                        <div className="h-8 w-12 bg-amber-300 rounded" />
                     </div>
                   </div>
                   <div className="h-16 bg-gray-50 rounded-md border border-gray-100 mt-3 flex items-center px-3">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-green-600 h-2 rounded-full w-2/3"></div>
                      </div>
                   </div>
                 </div>
              </div>
            </div>
            
            {/* Floating Badge */}
            <div className="absolute -bottom-6 -left-6 bg-white p-3 rounded-md shadow-xl border border-gray-100 flex items-center space-x-3 animate-bounce hover:animate-none transition-all duration-300 z-20" style={{ animationDuration: '3s' }}>
              <div className="bg-green-100 p-2 rounded-full text-green-800">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">99.8% Livability</p>
                <p className="text-xs text-gray-500">Top Performing Setup</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Features */}
      <section id="features" className="py-20 bg-white relative border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-5">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3 tracking-normal">Core Management Features</h2>
            <p className="text-lg text-gray-600">Everything you need to run a highly profitable poultry operation without the guesswork.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-7">
            {/* Feature 1 */}
            <div className="bg-gray-50 rounded-lg p-7 border border-gray-100 hover:border-green-800/50 hover:shadow-xl transition-all duration-300 group hover:-translate-y-1">
              <div className="bg-white w-14 h-14 rounded-md shadow-sm flex items-center justify-center text-green-800 mb-5 group-hover:scale-110 group-hover:bg-green-800 group-hover:text-white transition-all duration-300 group-hover:rotate-3 shadow-green-900/5">
                <Activity className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Real-time Flock Tracking</h3>
              <p className="text-gray-600 leading-relaxed font-medium">
                Monitor birds&apos; health, daily mortality, and environmental conditions instantly across multiple houses seamlessly.
              </p>
            </div>
            
            {/* Feature 2 */}
            <div className="bg-gray-50 rounded-lg p-7 border border-gray-100 hover:border-amber-500/50 hover:shadow-xl transition-all duration-300 group hover:-translate-y-1">
              <div className="bg-white w-14 h-14 rounded-md shadow-sm flex items-center justify-center text-amber-500 mb-5 group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-white transition-all duration-300 group-hover:-rotate-3 shadow-amber-500/5">
                <Calculator className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Automated FCR Calculations</h3>
              <p className="text-gray-600 leading-relaxed font-medium">
                Automatically calculate your Feed Conversion Ratio daily to optimize feed spend and growth rates on the fly.
              </p>
            </div>
            
            {/* Feature 3 */}
            <div className="bg-gray-50 rounded-lg p-7 border border-gray-100 hover:border-green-800/50 hover:shadow-xl transition-all duration-300 group hover:-translate-y-1">
              <div className="bg-white w-14 h-14 rounded-md shadow-sm flex items-center justify-center text-green-800 mb-5 group-hover:scale-110 group-hover:bg-green-800 group-hover:text-white transition-all duration-300 group-hover:rotate-3 shadow-green-900/5">
                <Bell className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Vaccination Reminders</h3>
              <p className="text-gray-600 leading-relaxed font-medium">
                Stay compliant and secure with automated pushes for upcoming vaccinations and critical health scheduling.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Market Focus Section */}
      <section id="markets" className="py-20 bg-green-950 text-white relative overflow-hidden">
        {/* Decorative pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#ffffff 2px, transparent 2px)', backgroundSize: '40px 40px' }}></div>
        
        <div className="max-w-7xl mx-auto px-5 relative z-10">
          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-5xl font-bold mb-3 tracking-normal">Tailored for Your Market Focus</h2>
            <p className="text-green-200 text-lg max-w-2xl mx-auto font-medium">From poultry to path-breaking cattle management, AgriTech adapts to your specific production cycles dynamically.</p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-7">
            <div className="bg-green-900/50 backdrop-blur-sm p-9 rounded-lg border border-green-800 hover:bg-green-900 transition-colors group hover:border-amber-500/30">
              <div className="flex items-center space-x-3 mb-7">
                <div className="p-3 bg-white/10 rounded-md text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                  <TrendingUp className="w-8 h-8" />
                </div>
                <h3 className="text-3xl font-bold tracking-normal text-white group-hover:text-amber-400 transition-colors">Specialized Fattening</h3>
              </div>
              <ul className="space-y-4 text-green-100 font-medium">
                <li className="flex items-start"><ArrowRight className="w-5 h-5 mr-3 text-amber-400 mt-0.5" /> Rapid cycle tracking with daily weight gain predictions.</li>
                <li className="flex items-start"><ArrowRight className="w-5 h-5 mr-3 text-amber-400 mt-0.5" /> Advanced lighting and climate control integration for optimal feed conversion.</li>
                <li className="flex items-start"><ArrowRight className="w-5 h-5 mr-3 text-amber-400 mt-0.5" /> Market readiness and harvest scheduling analytics.</li>
              </ul>
            </div>
            
            <div className="bg-green-900/50 backdrop-blur-sm p-9 rounded-lg border border-green-800 hover:bg-green-900 transition-colors group hover:border-white/30">
              <div className="flex items-center space-x-3 mb-7">
                <div className="p-3 bg-white/10 rounded-md text-white group-hover:bg-white group-hover:text-green-900 transition-colors">
                  <Activity className="w-8 h-8" />
                </div>
                <h3 className="text-3xl font-bold tracking-normal text-white">Production Cycles</h3>
              </div>
              <ul className="space-y-4 text-green-100 font-medium">
                <li className="flex items-start"><ArrowRight className="w-5 h-5 mr-3 text-white mt-0.5" /> Long-term lifecycle tracking across breeding and rearing phases.</li>
                <li className="flex items-start"><ArrowRight className="w-5 h-5 mr-3 text-white mt-0.5" /> Daily production counting, grading percentages, and yield metrics.</li>
                <li className="flex items-start"><ArrowRight className="w-5 h-5 mr-3 text-white mt-0.5" /> Critical event scheduling and age-productivity drop-off alerts.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA final section */}
      <section className="py-16 bg-amber-500 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] animate-pulse"></div>
        <div className="max-w-4xl mx-auto px-5 text-center relative z-10">
          <h2 className="text-4xl font-extrabold text-white mb-5 drop-shadow-sm">Ready to Optimize Your Lifestyle?</h2>
          <p className="text-amber-100 text-xl font-medium mb-9">Join thousands of farmers streamlining their workflow from birth to harvest.</p>
          <Link href="/dashboard" className="bg-white text-amber-600 px-9 py-3 rounded-full font-extrabold text-xl shadow-xl hover:shadow-2xl hover:bg-gray-50 transition-all hover:-translate-y-1 inline-block">
            Start Your First Batch Today
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0a0a0a] py-14 border-t border-gray-800 font-medium relative z-50 relative">
        <div className="max-w-7xl mx-auto px-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-y-12 gap-x-8">
          <div className="sm:col-span-2 space-y-5">
            <div className="text-2xl font-bold text-white flex items-center">
               <div className="w-6 h-6 rounded bg-gradient-to-br from-amber-400 to-amber-600 mr-2 flex justify-center items-center">
                  <span className="text-white font-bold text-sm">A</span>
               </div>
               AgriTech
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-slate-200">Empowering modern farming with intelligent precision tools. Building the future of agriculture, from farm to fork.</p>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-5 text-lg tracking-normal">Platform</h4>
            <ul className="space-y-3 text-sm flex flex-col items-start">
              <li><button className="text-slate-300 hover:text-amber-400 transition-colors">Features</button></li>
              <li><button className="text-slate-300 hover:text-amber-400 transition-colors">Pricing</button></li>
              <li><button className="text-slate-300 hover:text-amber-400 transition-colors">Integrations</button></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-semibold mb-5 text-lg tracking-normal">Company</h4>
            <ul className="space-y-3 text-sm flex flex-col items-start">
              <li><button className="text-slate-300 hover:text-amber-400 transition-colors">About Us</button></li>
              <li><button className="text-slate-300 hover:text-amber-400 transition-colors">Contact Support</button></li>
              <li><button className="text-slate-300 hover:text-amber-400 transition-colors">Careers</button></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-5 mt-14 pt-7 border-t border-gray-800 text-sm text-center md:text-left flex flex-col md:flex-row justify-between items-center text-slate-300">
          <p>© {new Date().getFullYear()} AgriTech Solutions Inc. All rights reserved.</p>
          <div className="space-x-5 mt-5 md:mt-0 flex items-center justify-center">
            <button className="hover:text-white transition-colors">Privacy Policy</button>
            <button className="hover:text-white transition-colors">Terms of Service</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
