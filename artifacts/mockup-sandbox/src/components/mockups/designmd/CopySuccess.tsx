import { Check, Copy } from "lucide-react";
import { Header } from "./Shared";
import "./_group.css";

export function CopySuccess() {
  return (
    <div className="designmd-root bg-white">
      <Header />
      
      <main className="flex-1 flex flex-col items-center justify-center max-w-3xl mx-auto px-6 py-20 w-full text-center">
        <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-green-50 border border-green-200">
          <Check className="h-10 w-10 text-green-600" />
        </div>
        
        <h1 className="designmd-serif text-4xl font-bold text-[#111110] mb-3">Stripe bundle copied</h1>
        <p className="text-[#6B6A66] text-lg mb-12">1,847 tokens ready for your clipboard.</p>

        <div className="w-full text-left rounded-xl border border-[#E8E6DF] bg-white shadow-sm overflow-hidden">
          <div className="flex border-b border-[#E8E6DF] bg-[#FDFCF8]">
            <button className="flex-1 py-3 text-sm font-medium border-b-2 border-[#111110] text-[#111110]">Claude</button>
            <button className="flex-1 py-3 text-sm font-medium text-[#6B6A66] hover:text-[#111110]">Cursor</button>
            <button className="flex-1 py-3 text-sm font-medium text-[#6B6A66] hover:text-[#111110]">Lovable</button>
            <button className="flex-1 py-3 text-sm font-medium text-[#6B6A66] hover:text-[#111110]">Figma Make</button>
          </div>
          
          <div className="p-8">
            <h3 className="font-semibold text-[#111110] mb-6">How to apply this in Claude Projects</h3>
            
            <div className="space-y-8">
              <div className="flex gap-4">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#111110] text-xs text-white">1</div>
                <div>
                  <p className="text-sm font-medium text-[#111110] mb-2">Create a new Project in Claude and open Project Instructions</p>
                  <div className="rounded-lg border border-[#E8E6DF] bg-[#FAFAFA] p-4 text-[#6B6A66] text-xs designmd-mono flex items-center justify-center h-20">
                    [ Claude UI representation ]
                  </div>
                </div>
              </div>
              
              <div className="flex gap-4">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#111110] text-xs text-white">2</div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#111110] mb-2">Paste the copied bundle</p>
                  <div className="rounded-lg border border-[#2563EB] bg-[#F0F5FF] p-4">
                    <p className="text-xs text-[#2563EB] font-medium flex items-center gap-2">
                      <Copy className="h-3 w-3" /> Cmd + V
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-12 bg-[#FDFCF8] rounded-xl border border-[#E8E6DF] p-8 w-full">
          <h3 className="font-semibold text-[#111110] mb-3">Try a test prompt</h3>
          <p className="text-[#6B6A66] text-sm mb-4">Paste this into Claude to verify the system is working:</p>
          <div className="relative group">
            <div className="rounded-lg bg-white border border-[#E8E6DF] p-4 text-left font-mono text-sm text-[#111110]">
              "Build a pricing card component following our design system. Include a primary CTA and 3 feature bullet points."
            </div>
            <button className="absolute right-3 top-3 rounded-md bg-[#F4F3EE] p-1.5 text-[#6B6A66] opacity-0 transition-opacity group-hover:opacity-100">
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}