import { useState, useEffect, useRef } from "react";
import { 
  Play, Pause, SkipForward, SkipBack, RotateCcw, 
  Volume2, VolumeX, Sparkles, Mic, CheckCircle2, 
  ShieldCheck, FileText, MapPin, 
  Check, Info, ChevronRight, Zap
} from "lucide-react";
import toast from "react-hot-toast";

interface StepConfig {
  id: number;
  title: string;
  subtitle: string;
  duration: number; // in seconds
  narrationText: string;
  icon: any;
  badgeColor: string;
}

const STEPS: StepConfig[] = [
  {
    id: 1,
    title: "1. Travel Date & Policy Limits Selection",
    subtitle: "Expense Date selection, IST Cutoff rules & Past Days policy verification",
    duration: 12,
    narrationText: "Welcome to Cyrix Field Connect Expense Management System. Pehle step me employee ko travel date select karni hoti hai. System monthly cutoff day aur maximum past days limit ko automatically enforce karta hai.",
    icon: FileText,
    badgeColor: "bg-blue-500/20 text-blue-400 border-blue-500/30"
  },
  {
    id: 2,
    title: "2. Adding Visits & Travel Legs (TA/DA Calculation)",
    subtitle: "In-District & Outdoor legs, Residence starting location check, KM rates",
    duration: 15,
    narrationText: "Step 2 me visits aur travel legs add kiye jaate hain. In-District travel ke liye Leg 1 ka starting location Home, Room, ya Hotel hona zaroori hai. Distance KM ke hisab se TA calculation automatically ho jati hai.",
    icon: MapPin,
    badgeColor: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
  },
  {
    id: 3,
    title: "3. Barcode Verification & PMS Work Metrics",
    subtitle: "8-Digit Barcode scanner, PMS 3/6/12 Month, Call breakdown & photo uploads",
    duration: 15,
    narrationText: "Step 3 me Barcode Verification hota hai. PMS aur Call Breakdown ke liye 8-digit barcode enter karke verify karna hota hai, aur Service Report photo attach karni compulsary hoti hai.",
    icon: CheckCircle2,
    badgeColor: "bg-amber-500/20 text-amber-400 border-amber-500/30"
  },
  {
    id: 4,
    title: "4. Groq Llama 3.1 8B AI Voice-to-Text Feature",
    subtitle: "Speak in Hindi/Hinglish to instantly fill visit purpose, mode, KM & notes",
    duration: 18,
    narrationText: "Step 4 me Groq Llama 3.1 8B AI Voice Input feature kaam karta hai. Mic button daba kar bolne par AI aapke bolne ko 0.5 second me structured expense details me convert kar deta hai.",
    icon: Sparkles,
    badgeColor: "bg-purple-500/20 text-purple-400 border-purple-500/30"
  },
  {
    id: 5,
    title: "5. Strict Backend Assertion & Manager Approval",
    subtitle: "0-Glitch KV Data Assertion check & Manager Approval Center view",
    duration: 14,
    narrationText: "Step 5 me Claim submit hone ke baad Cloudflare Worker backend Data Integrity Verification check karta hai, aur Manager Approval Center me instant review ke liye bhej deta hai.",
    icon: ShieldCheck,
    badgeColor: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
  }
];

export default function VideoWalkthroughPage() {
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [parsedAiResult, setParsedAiResult] = useState<any>(null);

  const currentStep = STEPS[currentStepIdx];
  const timerRef = useRef<any>(null);
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Speech Narration Handler
  const speakText = (text: string) => {
    if (!speechEnabled || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "hi-IN";
    utterance.rate = 1.0;
    speechSynthRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  // Play / Pause Toggle
  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    } else {
      setIsPlaying(true);
      speakText(currentStep.narrationText);
    }
  };

  // Handle Step Change
  const goToStep = (idx: number) => {
    if (idx < 0 || idx >= STEPS.length) return;
    setCurrentStepIdx(idx);
    setProgress(0);
    if (isPlaying) {
      speakText(STEPS[idx].narrationText);
    }
  };

  // Step Progress Timer Effect
  useEffect(() => {
    if (!isPlaying) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const intervalMs = 100;
    const totalMs = currentStep.duration * 1000;
    const stepIncrement = (intervalMs / totalMs) * 100;

    timerRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          if (currentStepIdx < STEPS.length - 1) {
            const nextIdx = currentStepIdx + 1;
            setCurrentStepIdx(nextIdx);
            speakText(STEPS[nextIdx].narrationText);
            return 0;
          } else {
            setIsPlaying(false);
            return 100;
          }
        }
        return prev + stepIncrement;
      });
    }, intervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, currentStepIdx, currentStep.duration]);

  // Clean speech synthesis on unmount
  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  // Simulate Groq Llama 3.1 8B AI Voice Parsing Sandbox
  const runLlama8BParser = (sampleText: string) => {
    setIsListening(true);
    setParsedAiResult(null);

    setTimeout(() => {
      setIsListening(false);
      if (sampleText.includes("Bhinay")) {
        setParsedAiResult({
          from: "Home (Ajmer)",
          to: "Bhinay CHC Ajmer",
          travel_mode: "Bike",
          km: 68,
          ta_amount: "₹340.00",
          da_amount: "₹150.00",
          activities: ["PMS"],
          pms_count: 15,
          ai_confidence: "99.8% (Groq Llama 3.1 8B)",
          processing_time: "0.28 seconds"
        });
      } else {
        setParsedAiResult({
          from: "Ajmer",
          to: "Kishangarh SDH",
          travel_mode: "Bike",
          km: 45,
          ta_amount: "₹225.00",
          da_amount: "₹150.00",
          local_purchase: "₹250.00",
          activities: ["Other", "Local Purchase"],
          ai_confidence: "99.5% (Groq Llama 3.1 8B)",
          processing_time: "0.31 seconds"
        });
      }
      toast.success("Parsed with Groq Llama 3.1 8B in 0.3s!");
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans selection:bg-purple-500 selection:text-white">
      {/* Top Banner & Groq Llama 3.1 8B Badge */}
      <div className="max-w-6xl mx-auto mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-purple-500/20 text-purple-400 border border-purple-500/30 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-purple-400 animate-pulse" />
              Powered by Groq Llama 3.1 8B (14,400 Free Requests/Day)
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white flex items-center gap-2">
            Cyrix Expense Software Interactive Video Guide
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Interactive visual walkthrough showing step-by-step expense creation, barcode scanning & Llama 3.1 AI integration.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setSpeechEnabled(!speechEnabled)}
            className={`px-3.5 py-2 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all border ${
              speechEnabled 
                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" 
                : "bg-slate-800 text-slate-400 border-slate-700"
            }`}
          >
            {speechEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span>{speechEnabled ? "Voice Narration ON" : "Voice Narration OFF"}</span>
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: SIMULATED VIDEO PLAYER SCREEN (8 Cols) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          
          {/* Main Video Frame Canvas */}
          <div className="relative aspect-video bg-slate-900 rounded-3xl border border-slate-800 shadow-2xl overflow-hidden flex flex-col justify-between p-6 group">
            
            {/* Background Grid Pattern & Subtle Glow */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:2rem_2rem]" />
            <div className="absolute -top-24 -right-24 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />

            {/* Video Header Overlay */}
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-2 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">
                  STEP {currentStep.id} OF 5
                </span>
              </div>
              <span className={`text-xs font-extrabold px-3 py-1 rounded-xl border ${currentStep.badgeColor}`}>
                {currentStep.title}
              </span>
            </div>

            {/* VIDEO CONTENT VISUAL DEMO CANVAS */}
            <div className="relative z-10 my-auto py-6">
              
              {/* STEP 1 VISUAL DEMO */}
              {currentStep.id === 1 && (
                <div className="bg-slate-950/90 rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4 max-w-md mx-auto animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="text-xs font-black uppercase text-blue-400 tracking-wider">📅 Travel Date & Policy Check</span>
                    <span className="text-[10px] font-bold text-slate-500">IST Policy Engine</span>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-extrabold text-slate-400 uppercase">Expense Date</label>
                    <div className="w-full bg-slate-900 border border-blue-500/40 text-white rounded-xl p-2.5 text-xs font-mono font-bold flex justify-between items-center">
                      <span>2026-08-13 (Today)</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                  </div>
                  <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl text-xs text-blue-300 space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-[11px]">
                      <Info className="w-3.5 h-3.5 shrink-0" />
                      <span>Monthly Cutoff Status: PASS</span>
                    </div>
                    <p className="text-[10px] text-blue-300/80">Monthly cutoff (Day 3) verified. Date is selectable & active.</p>
                  </div>
                </div>
              )}

              {/* STEP 2 VISUAL DEMO */}
              {currentStep.id === 2 && (
                <div className="bg-slate-950/90 rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4 max-w-lg mx-auto animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="text-xs font-black uppercase text-emerald-400 tracking-wider">🚘 Visit 1 (In-District Route)</span>
                    <span className="text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-md">Leg 1 of 2</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[9px] font-extrabold text-slate-500 uppercase block">From Location</span>
                      <span className="font-bold text-white">Home (Ajmer)</span>
                      <span className="text-[9px] text-emerald-400 block mt-0.5">✓ Mandatory Home Match</span>
                    </div>
                    <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-[9px] font-extrabold text-slate-500 uppercase block">To Location</span>
                      <span className="font-bold text-white">Bhinay CHC Ajmer</span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">District: Ajmer</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center bg-slate-900/80 p-3 rounded-xl border border-slate-800 text-xs">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Distance & Rate</span>
                      <span className="font-mono font-black text-emerald-400 text-sm">68 KM × ₹5/KM</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Calculated TA</span>
                      <span className="font-mono font-black text-white text-base">₹340.00</span>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3 VISUAL DEMO */}
              {currentStep.id === 3 && (
                <div className="bg-slate-950/90 rounded-2xl border border-slate-800 p-5 shadow-xl space-y-3 max-w-lg mx-auto animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <span className="text-xs font-black uppercase text-amber-400 tracking-wider">🔍 Barcode Verification & PMS</span>
                    <span className="text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-md">15 Equipment Scanned</span>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      readOnly 
                      value="30170187" 
                      className="bg-slate-900 border border-amber-500/40 text-amber-300 font-mono text-xs font-bold p-2.5 rounded-xl flex-1"
                    />
                    <button disabled className="bg-amber-500 text-slate-950 font-black text-xs px-4 rounded-xl flex items-center gap-1">
                      <Check className="w-4 h-4 stroke-[3]" /> VERIFIED
                    </button>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 text-xs space-y-1">
                    <div className="flex justify-between font-bold text-slate-200">
                      <span>Semi Automated Chemistry Analyzer</span>
                      <span className="text-amber-400 font-mono">Bhinay CHC</span>
                    </div>
                    <p className="text-[10px] text-slate-400">Inventory Status: Verified Inventory | Period: 3 Month</p>
                  </div>
                </div>
              )}

              {/* STEP 4 VISUAL DEMO */}
              {currentStep.id === 4 && (
                <div className="bg-slate-950/90 rounded-2xl border border-purple-500/30 p-5 shadow-2xl space-y-4 max-w-lg mx-auto animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-400 animate-spin" />
                      <span className="text-xs font-black uppercase text-purple-300 tracking-wider">Groq Llama 3.1 8B AI Speech Parsing</span>
                    </div>
                    <span className="text-[10px] font-mono text-purple-400 font-bold">Speed: 0.28s</span>
                  </div>
                  <div className="bg-purple-500/10 border border-purple-500/20 p-3 rounded-xl text-xs text-purple-200 italic font-medium">
                    "Bhinay CHC me 15 PMS complete kiye aur microscope calibrate kiya..."
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <span className="text-[9px] text-slate-500 block">AI DESTINATION</span>
                      <span className="text-emerald-400 font-bold">Bhinay CHC Ajmer</span>
                    </div>
                    <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                      <span className="text-[9px] text-slate-500 block">AI DISTANCE</span>
                      <span className="text-purple-400 font-bold">68 KM (₹340 TA)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 5 VISUAL DEMO */}
              {currentStep.id === 5 && (
                <div className="bg-slate-950/90 rounded-2xl border border-cyan-500/30 p-5 shadow-2xl space-y-4 max-w-lg mx-auto animate-in fade-in zoom-in-95 duration-300">
                  <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
                    <span className="text-xs font-black uppercase text-cyan-300 tracking-wider">🛡️ Data Integrity Check & Approval</span>
                    <span className="text-[10px] font-extrabold bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-md">Status: Approved</span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between items-center bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-slate-400">Cloudflare D1 Assert Check</span>
                      <span className="text-emerald-400 font-mono font-bold">0 Glitch Mismatch</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                      <span className="text-slate-400">Manager Review Audit</span>
                      <span className="text-cyan-400 font-mono font-bold">Approved by L1 Manager</span>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Video Subtitles & Progress Bar Overlay */}
            <div className="relative z-10 space-y-3">
              <div className="bg-slate-950/80 backdrop-blur-md p-3 rounded-2xl border border-slate-800 text-xs text-slate-300 font-medium leading-relaxed">
                <span className="font-bold text-white">Narration: </span>
                {currentStep.narrationText}
              </div>

              {/* Progress Slider */}
              <div className="space-y-1">
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-purple-500 via-blue-500 to-emerald-500 transition-all duration-100"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>{Math.round((progress / 100) * currentStep.duration)}s</span>
                  <span>{currentStep.duration}s</span>
                </div>
              </div>
            </div>

          </div>

          {/* PLAYER CONTROL BUTTONS */}
          <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => goToStep(currentStepIdx - 1)}
                disabled={currentStepIdx === 0}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-xl text-slate-300 transition-colors"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              
              <button
                onClick={togglePlay}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-extrabold text-xs flex items-center gap-2 shadow-lg shadow-purple-600/30 transition-all"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                <span>{isPlaying ? "Pause Video" : "Play Step Video"}</span>
              </button>

              <button
                onClick={() => goToStep(currentStepIdx + 1)}
                disabled={currentStepIdx === STEPS.length - 1}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 rounded-xl text-slate-300 transition-colors"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => { setCurrentStepIdx(0); setProgress(0); setIsPlaying(true); speakText(STEPS[0].narrationText); }}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Replay Full Walkthrough</span>
            </button>
          </div>

        </div>

        {/* RIGHT COLUMN: CHAPTER NAVIGATION & GROQ LLAMA 3.1 8B INTERACTIVE PLAYGROUND (4 Cols) */}
        <div className="lg:col-span-4 flex flex-col gap-5">
          
          {/* Chapter Timeline list */}
          <div className="bg-slate-900 p-5 rounded-3xl border border-slate-800 space-y-3">
            <h3 className="text-xs font-black uppercase text-slate-400 tracking-wider border-b border-slate-800 pb-2.5">
              Video Chapters ({STEPS.length})
            </h3>
            <div className="space-y-2">
              {STEPS.map((s, idx) => {
                const isActive = idx === currentStepIdx;
                const StepIcon = s.icon;
                return (
                  <button
                    key={s.id}
                    onClick={() => goToStep(idx)}
                    className={`w-full text-left p-3 rounded-2xl transition-all border flex items-center justify-between gap-3 ${
                      isActive 
                        ? "bg-slate-800 border-purple-500/50 shadow-lg shadow-purple-500/10" 
                        : "bg-slate-950/50 border-slate-800/80 hover:bg-slate-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 ${
                        isActive ? "bg-purple-500 text-white border-purple-400" : "bg-slate-900 text-slate-400 border-slate-800"
                      }`}>
                        <StepIcon className="w-4 h-4" />
                      </span>
                      <div>
                        <h4 className={`text-xs font-extrabold ${isActive ? "text-white" : "text-slate-300"}`}>
                          {s.title}
                        </h4>
                        <p className="text-[10px] text-slate-500 font-medium line-clamp-1">{s.subtitle}</p>
                      </div>
                    </div>
                    {isActive && <ChevronRight className="w-4 h-4 text-purple-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* GROQ LLAMA 3.1 8B AI VOICE PARSING SANDBOX */}
          <div className="bg-slate-900 p-5 rounded-3xl border border-purple-500/30 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <h3 className="text-xs font-black uppercase text-white tracking-wider">Test Groq Llama 3.1 8B Voice Parser</h3>
              </div>
              <span className="text-[9px] font-mono bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-md font-bold">14,400 RPD</span>
            </div>

            <p className="text-[11px] text-slate-400">
              Click a sample voice note below to see how Groq Llama 3.1 8B parses spoken Hindi/Hinglish into structured expense claims in 0.3s:
            </p>

            <div className="space-y-2">
              <button
                onClick={() => runLlama8BParser("Bhinay CHC me 15 PMS complete kiye aur centrifuge machine calibrate kiya.")}
                className="w-full text-left p-3 bg-slate-950 hover:bg-purple-950/40 border border-slate-800 hover:border-purple-500/40 rounded-2xl text-xs text-slate-300 transition-all flex items-center justify-between group"
              >
                <span className="italic font-medium text-[11px]">"Bhinay CHC me 15 PMS complete kiye..."</span>
                <Mic className="w-3.5 h-3.5 text-purple-400 group-hover:scale-110 transition-transform shrink-0" />
              </button>

              <button
                onClick={() => runLlama8BParser("Ajmer to Kishangarh bike se gaya 45 km travel allowance ke sath local purchase 250 rs ka bill.")}
                className="w-full text-left p-3 bg-slate-950 hover:bg-purple-950/40 border border-slate-800 hover:border-purple-500/40 rounded-2xl text-xs text-slate-300 transition-all flex items-center justify-between group"
              >
                <span className="italic font-medium text-[11px]">"Ajmer to Kishangarh bike se 45 km..."</span>
                <Mic className="w-3.5 h-3.5 text-purple-400 group-hover:scale-110 transition-transform shrink-0" />
              </button>
            </div>

            {/* AI Parsing Loading or Output Result */}
            {isListening && (
              <div className="p-4 bg-purple-950/30 border border-purple-500/40 rounded-2xl text-center space-y-2">
                <Sparkles className="w-5 h-5 text-purple-400 animate-spin mx-auto" />
                <p className="text-xs font-bold text-purple-200">Groq Llama 3.1 8B Processing Voice Note...</p>
              </div>
            )}

            {parsedAiResult && !isListening && (
              <div className="p-4 bg-slate-950 border border-emerald-500/40 rounded-2xl space-y-2 text-xs animate-in fade-in duration-300">
                <div className="flex justify-between items-center text-[10px] font-mono text-emerald-400 border-b border-slate-800 pb-1.5">
                  <span className="font-bold">✓ GROQ LLAMA 3.1 8B RESULT</span>
                  <span>{parsedAiResult.processing_time}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div><span className="text-slate-500 block text-[9px]">FROM</span><span className="font-bold text-white">{parsedAiResult.from}</span></div>
                  <div><span className="text-slate-500 block text-[9px]">TO</span><span className="font-bold text-white">{parsedAiResult.to}</span></div>
                  <div><span className="text-slate-500 block text-[9px]">MODE / KM</span><span className="font-bold text-emerald-400">{parsedAiResult.travel_mode} ({parsedAiResult.km} KM)</span></div>
                  <div><span className="text-slate-500 block text-[9px]">CALCULATED TA</span><span className="font-bold text-white font-mono">{parsedAiResult.ta_amount}</span></div>
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
