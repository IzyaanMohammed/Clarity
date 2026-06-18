import { Check, Zap, Award, Sparkles, ArrowLeft, X, ShieldCheck, CreditCard, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Navbar } from '../components/layout/Navbar';
import { Button } from '../components/ui/Button';
import { getUser, updateUser } from '../utils/storage';
import { startBillingTrial } from '../api';
import toast from 'react-hot-toast';

export const Subscription = () => {
  const navigate = useNavigate();
  const user = getUser();
  const currentTier = user?.subscriptionTier || 'free';

  const [checkoutPlan, setCheckoutPlan] = useState<any | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [paypalStep, setPaypalStep] = useState<'summary' | 'login' | 'payment_method' | 'processing' | 'success'>('summary');
  const [paypalEmail, setPaypalEmail] = useState('');
  const [paypalPassword, setPaypalPassword] = useState('');

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: '0 AED',
      period: 'Forever',
      desc: 'Perfect for getting started with AI tutoring',
      icon: <Zap className="text-stone-400" size={32} />,
      features: [
        'Dashboard & Textbook Hub access',
        'Core Ask AI & Chapter Summaries',
        'Study Plan & Mindmap generation',
        'Materials & progress dashboards',
        'Exam Simulator (Free for up to 3 papers)',
        'OCR Scanner (Free for up to 20 scans)'
      ],
      buttonText: 'Current Plan',
      buttonVariant: 'outline' as const,
      highlight: false
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '50 AED',
      period: '/ month (7-Day Trial)',
      desc: 'Advanced tools for serious board preparation',
      icon: <Award className="text-[#8C5A35]" size={32} />,
      features: [
        'Everything in Free',
        'Unlimited Mock Exam Papers',
        'Unlimited OCR scans & handwriting scans',
        'Full Flashcards database access',
        'Priority AI response time',
        'Vision AI descriptions'
      ],
      buttonText: 'Start 7-Day Trial',
      buttonVariant: 'primary' as const,
      highlight: true
    },
    {
      id: 'pro_max',
      name: 'Pro Max',
      price: '99 AED',
      period: '/ month (3-Day Trial)',
      desc: 'The ultimate Study OS for families',
      icon: <Sparkles className="text-yellow-500" size={32} />,
      features: [
        'Everything in Pro',
        'Parent Portal + Real-time WhatsApp/Email reports',
        'Custom 1-on-1 AI strategy recommendations',
        'Early access to new features',
        'Dedicated account support'
      ],
      buttonText: 'Start 3-Day Trial',
      buttonVariant: 'primary' as const,
      highlight: false
    }
  ];

  const handleUpgrade = (plan: any) => {
    if (plan.id === currentTier) return;
    
    // Open PayPal Checkout Flow for paid tiers
    setCheckoutPlan(plan);
    setPaypalStep('summary');
    setPaypalEmail('');
    setPaypalPassword('');
    setCheckoutOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] transition-colors duration-300">
      <Navbar />
      <main className="max-w-7xl mx-auto px-6 py-12">
        <button
          onClick={() => navigate(-1)}
          className="mb-8 flex items-center gap-2 text-stone-600 hover:text-[#8C5A35] transition-colors font-bold"
        >
          <ArrowLeft size={20} />
          Back
        </button>

        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-black text-[#2C241B] mb-4">Choose Your <span className="text-[#8C5A35]">Clarity Plan</span></h1>
          <p className="text-stone-600 text-lg font-medium max-w-2xl mx-auto">
            Upgrade to unlock powerful AI features and board exam tools designed to help you score higher with less stress.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative p-8 rounded-[40px] shadow-2xl border transition-all duration-300 hover:scale-[1.02] hover:-transtone-y-0.5 flex flex-col justify-between ${
                plan.highlight
                  ? 'bg-stone-950 text-white border-stone-900 '
                  : 'bg-[#FCFAF8] text-[#2C241B] border-stone-250/80 '
              }`}
            >
              {plan.highlight && (
                <div className="absolute top-0 right-10 -transtone-y-1/2 bg-yellow-400 text-[#2C241B] text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-xl">
                  Most Popular
                </div>
              )}

              <div>
                <div className="flex items-center gap-4 mb-6">
                  <div className={`p-4 rounded-2xl ${plan.highlight ? 'bg-[#FCFAF8]/10' : 'bg-[#F2EFE9] '}`}>
                    {plan.icon}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black">{plan.name}</h3>
                    <p className={`text-sm ${plan.highlight ? 'text-white/80' : 'text-stone-500'}`}>{plan.desc}</p>
                  </div>
                </div>

                <div className="mb-8">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black">{plan.price}</span>
                    <span className={`text-sm font-bold ${plan.highlight ? 'text-white/70' : 'text-stone-400'}`}>{plan.period}</span>
                  </div>
                </div>

                <div className="space-y-4 mb-10">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3">
                      <div className={`mt-1 p-0.5 rounded-full ${plan.highlight ? 'bg-[#FCFAF8]/20' : 'bg-[#8C5A35]/10'}`}>
                        <Check size={14} className={plan.highlight ? 'text-white' : 'text-[#8C5A35]'} />
                      </div>
                      <span className="text-sm font-bold">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={() => handleUpgrade(plan)}
                disabled={plan.id === currentTier}
                variant={plan.buttonVariant}
                className={`w-full py-6 rounded-2xl font-black text-lg transition-all ${
                  plan.highlight
                    ? 'bg-[#8C5A35] text-white hover:bg-[#70482B]'
                    : plan.id === currentTier
                    ? 'opacity-50 cursor-default'
                    : 'bg-[#8C5A35] text-white hover:bg-[#70482B]'
                }`}
              >
                {plan.id === currentTier ? 'Current Plan' : plan.buttonText}
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-20 text-center p-12 rounded-[40px] bg-[#F2EFE9] border-2 border-dashed border-stone-200 ">
          <p className="text-stone-500 font-bold mb-4 uppercase tracking-widest text-xs">Trusted by students across CBSE & ICSE boards</p>
          <div className="flex flex-wrap justify-center gap-12 opacity-50 grayscale">
            <span className="text-xl font-black">CBSE</span>
            <span className="text-xl font-black">ICSE</span>
            <span className="text-xl font-black">IB</span>
            <span className="text-xl font-black">IGCSE</span>
          </div>
        </div>
      </main>

      {/* PayPal Checkout Modal */}
      {checkoutOpen && checkoutPlan && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fadeIn">
          <div className="bg-[#fcfcfc] w-full max-w-md rounded-[32px] overflow-hidden shadow-2xl border border-stone-200 flex flex-col relative animate-scaleIn">
            
            {/* PayPal Header */}
            <div className="px-6 py-4 bg-[#003087] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-serif italic text-xl font-bold tracking-tight text-white flex items-center select-none">
                  <span className="text-[#0079C1] font-black">Pay</span>Pal
                </span>
                <span className="text-[10px] uppercase font-black tracking-wider bg-[#FCFAF8]/10 px-2 py-0.5 rounded-md select-none">
                  Checkout
                </span>
              </div>
              <button 
                onClick={() => {
                  setCheckoutOpen(false);
                  setCheckoutPlan(null);
                }}
                className="p-1 rounded-full hover:bg-[#FCFAF8]/10 text-white/80 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 flex-grow flex flex-col justify-between min-h-[380px]">
              
              {/* Step 1: Summary */}
              {paypalStep === 'summary' && (
                <div className="space-y-6 flex-grow flex flex-col justify-between">
                  <div className="space-y-4">
                    <h3 className="text-lg font-black text-[#2C241B] ">Review your subscription</h3>
                    <div className="p-5 bg-[#FCFAF8] border border-stone-100 rounded-2xl">
                      <p className="text-xs font-black uppercase text-stone-400">Order Summary</p>
                      <p className="font-black text-[#2C241B] text-md mt-1">Clarity {checkoutPlan.name} Plan</p>
                      <p className="text-xs text-[#8C5A35] font-bold mt-1">
                        {checkoutPlan.id === 'pro' ? '7-Day Free Trial (then 50 AED/month)' : '3-Day Free Trial (then 99 AED/month)'}
                      </p>
                      <div className="border-t border-dashed border-stone-200 my-3 pt-3 flex justify-between items-baseline">
                        <span className="text-xs font-bold text-stone-505">Due today:</span>
                        <span className="text-2xl font-black text-[#2C241B] ">0.00 AED</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <button
                      onClick={() => setPaypalStep('login')}
                      className="w-full py-3.5 rounded-full bg-[#FFC439] hover:bg-[#F2B522] text-[#003087] font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      <span className="font-serif italic font-bold">PayPal</span>
                      <span>Pay with PayPal</span>
                    </button>
                    <button
                      onClick={() => setPaypalStep('login')}
                      className="w-full py-3.5 rounded-full bg-[#0079C1] hover:bg-[#005EA6] text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      <CreditCard size={16} />
                      <span>Debit or Credit Card</span>
                    </button>
                    <p className="text-[10px] text-stone-400 text-center font-medium">
                      🔒 Secure transactions processed via PayPal SDK.
                    </p>
                  </div>
                </div>
              )}

              {/* Step 2: Login */}
              {paypalStep === 'login' && (
                <div className="space-y-6 flex-grow flex flex-col justify-between">
                  <div className="space-y-4">
                    <div className="text-center py-2">
                      <span className="font-serif italic text-3xl font-black tracking-tight text-[#003087] ">
                        <span className="text-[#0079C1]">Pay</span>Pal
                      </span>
                    </div>
                    
                    <div className="space-y-3">
                      <input 
                        type="email"
                        value={paypalEmail}
                        onChange={(e) => setPaypalEmail(e.target.value)}
                        placeholder="Email or mobile number"
                        className="w-full px-4 py-3 rounded-lg border border-stone-300 bg-[#FCFAF8] text-[#2C241B] text-sm focus:ring-1 focus:ring-[#0079C1] focus:border-[#0079C1] outline-none"
                      />
                      <input 
                        type="password"
                        value={paypalPassword}
                        onChange={(e) => setPaypalPassword(e.target.value)}
                        placeholder="Password"
                        className="w-full px-4 py-3 rounded-lg border border-stone-300 bg-[#FCFAF8] text-[#2C241B] text-sm focus:ring-1 focus:ring-[#0079C1] focus:border-[#0079C1] outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={() => setPaypalStep('payment_method')}
                      disabled={!paypalEmail || !paypalPassword}
                      className="w-full py-3.5 rounded-full bg-[#0079C1] hover:bg-[#005EA6] disabled:opacity-60 text-white font-bold text-sm transition-all"
                    >
                      Log In
                    </button>
                    <button
                      onClick={() => setPaypalStep('summary')}
                      className="w-full text-center text-xs font-bold text-[#0079C1] hover:underline"
                    >
                      Cancel and return to summary
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3: Payment Method */}
              {paypalStep === 'payment_method' && (
                <div className="space-y-6 flex-grow flex flex-col justify-between">
                  <div className="space-y-4">
                    <h3 className="text-lg font-black text-[#2C241B] ">Choose a way to pay</h3>
                    <div className="space-y-2">
                      <label className="flex items-center justify-between p-4 bg-[#FCFAF8] border border-indigo-500/30 rounded-xl cursor-pointer">
                        <div className="flex items-center gap-3">
                          <input type="radio" defaultChecked className="accent-[#0079C1]" />
                          <div>
                            <p className="text-sm font-bold text-[#2C241B] ">PayPal Balance</p>
                            <p className="text-xs text-stone-500">AED 1,420.50 available</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-[#0079C1]">Preferred</span>
                      </label>
                      <label className="flex items-center justify-between p-4 bg-[#FCFAF8] border border-stone-200 rounded-xl cursor-pointer opacity-70">
                        <div className="flex items-center gap-3">
                          <input type="radio" disabled className="accent-[#0079C1]" />
                          <div>
                            <p className="text-sm font-bold text-[#2C241B] ">Visa Card (•••• 4321)</p>
                            <p className="text-xs text-stone-500">Linked card</p>
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <button
                      onClick={async () => {
                        setPaypalStep('processing');
                        try {
                          const res = await startBillingTrial(checkoutPlan.id);
                          setPaypalStep('success');
                          updateUser({
                            subscriptionTier: res.subscriptionTier,
                            subscriptionStatus: res.subscriptionStatus,
                            trialStart: res.trialStart,
                            trialEnd: res.trialEnd,
                            subscriptionEnd: res.subscriptionEnd,
                          });
                        } catch (error: any) {
                          console.error("Failed to start trial on backend", error);
                          toast.error(error?.response?.data?.detail || "Could not activate subscription on backend.");
                          setPaypalStep('summary');
                        }
                      }}
                      className="w-full py-3.5 rounded-full bg-[#0079C1] hover:bg-[#005EA6] text-white font-bold text-sm transition-all"
                    >
                      Complete Purchase
                    </button>
                    <button
                      onClick={() => setPaypalStep('summary')}
                      className="w-full text-center text-xs font-bold text-[#0079C1] hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4: Processing */}
              {paypalStep === 'processing' && (
                <div className="flex-grow flex flex-col items-center justify-center py-10 space-y-4">
                  <Loader2 className="animate-spin text-[#0079C1]" size={40} />
                  <div className="text-center">
                    <p className="font-black text-[#2C241B] text-md">Processing secure payment...</p>
                    <p className="text-xs text-stone-500 mt-1">Please do not refresh or close this window.</p>
                  </div>
                </div>
              )}

              {/* Step 5: Success */}
              {paypalStep === 'success' && (
                <div className="flex-grow flex flex-col justify-between py-2 space-y-6">
                  <div className="text-center py-6 space-y-4">
                    <div className="w-16 h-16 rounded-full bg-amber-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-amber-500/25 animate-scaleIn">
                      <ShieldCheck size={36} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-[#2C241B] ">Subscription Active!</h3>
                      <p className="text-xs text-stone-550 mt-2 leading-relaxed px-4">
                        Thank you! Your PayPal payment was verified. Your Clarity <strong>{checkoutPlan.name}</strong> subscription is now active with your free trial.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setCheckoutOpen(false);
                      setCheckoutPlan(null);
                      toast.success(`Success! Plan updated to ${checkoutPlan.name}`);
                      navigate('/dashboard');
                    }}
                    className="w-full py-3.5 rounded-full bg-[#0079C1] hover:bg-[#005EA6] text-white font-bold text-sm transition-all shadow-md"
                  >
                    Go to Dashboard
                  </button>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
};
