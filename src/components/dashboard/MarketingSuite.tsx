'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Share2, Copy, Check, Sparkles } from 'lucide-react'
import { generateSocialPost } from '@/lib/actions/marketing-actions'

export function MarketingSuite() {
  const [post, setPost] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    if (loading) return
    setLoading(true)
    try {
      const res = await generateSocialPost()
      if (res.success) {
        setPost(res.postText)
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = () => {
    if (post) {
      navigator.clipboard.writeText(post)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <Card className="md:col-span-2 lg:col-span-2 bg-emerald-950 border-emerald-500/20 relative overflow-hidden h-[380px] flex flex-col group">
      <CardHeader className="flex flex-row items-center justify-between pb-2 shrink-0">
        <CardTitle className="text-emerald-400 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          Marketing Assistant
        </CardTitle>
        <Share2 className="w-5 h-5 text-emerald-400/50" />
      </CardHeader>
      <CardContent className="flex-1 flex flex-col pt-2 relative z-10 overflow-hidden">
        {post ? (
          <div className="flex-1 flex flex-col gap-3 overflow-hidden">
            <div className="flex-1 bg-black/60 p-3 rounded-lg border border-emerald-500/10 overflow-y-auto custom-scrollbar text-sm text-emerald-100/90 whitespace-pre-wrap leading-relaxed italic">
              {post}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleGenerate} variant="outline" isLoading={loading} loadingText="Regenerating..." className="flex-1 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10">
                Regenerate
              </Button>
              <Button onClick={handleCopy} disabled={loading} className={`flex-1 transition-all duration-300 ${copied ? 'bg-emerald-500' : 'bg-emerald-600'}`}>
                {copied ? <Check size={16} className="mr-2" /> : <Copy size={16} className="mr-2" />}
                {copied ? 'Copied!' : 'Copy Post'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center space-y-5">
            <div className="p-5 bg-emerald-500/10 rounded-full border border-emerald-500/20 animate-pulse">
               <Sparkles size={48} className="text-emerald-400" />
            </div>
            <div>
               <p className="text-white font-bold text-lg">Generate Weekly Update</p>
               <p className="text-emerald-400/60 text-xs font-medium max-w-[200px] mx-auto mt-2 italic">
                 Translate your production stats into shareable social media posts in one click.
               </p>
            </div>
            <Button 
             onClick={handleGenerate} 
             isLoading={loading}
             loadingText="Analyzing data..."
             className="bg-emerald-500 text-[#064e3b] font-bold uppercase tracking-widest text-[11px] px-7 rounded-md shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:scale-105 transition-transform"
            >
              Generate Post
            </Button>
          </div>
        )}

        <div className="absolute -bottom-10 -left-10 opacity-5 -z-10 group-hover:rotate-12 transition-transform duration-1000">
           <Share2 size={160} />
        </div>
      </CardContent>
    </Card>
  )
}
