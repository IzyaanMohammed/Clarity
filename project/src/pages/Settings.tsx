import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Crown, Zap, Sparkles, Check, X, Flame, TrendingUp } from 'lucide-react';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export const Settings = () => {
    const navigate = useNavigate();
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

    const plans = [
        {
            name: 'Free Trial',
            icon: Sparkles,
            price: '$0',
            period: '/forever',
            description: 'The perfect starter pack',
            color: 'from-blue-500 to-cyan-500',
            textColor: 'text-blue-600 dark:text-blue-400',
            bgColor: 'bg-blue-50 dark:bg-blue-900/20',
            borderColor: 'border-blue-200 dark:border-blue-800',
            features: [
                { name: '5 AI Tutor questions/day', included: true },
                { name: '3 Practice sessions/week', included: true },
                { name: 'Basic NCERT Textbook Hub', included: true },
                { name: '1 Flashcard set/month', included: true },
                { name: 'Ad-supported', included: true },
                { name: 'Community only (no priority support)', included: true },
                { name: 'Standard model (Dolphin-Mistral)', included: true },
            ],
            cta: 'Current Plan',
            disabled: true,
        },
        {
            name: 'Pro Scholar',
            icon: Flame,
            price: billingCycle === 'monthly' ? '$4.99' : '$49.99',
            period: billingCycle === 'monthly' ? '/month' : '/year',
            description: 'For serious board prep',
            color: 'from-orange-500 to-red-500',
            textColor: 'text-orange-600 dark:text-orange-400',
            bgColor: 'bg-orange-50 dark:bg-orange-900/20',
            borderColor: 'border-orange-200 dark:border-orange-800',
            features: [
                { name: '50 AI Tutor questions/day', included: true },
                { name: 'Unlimited Practice sessions', included: true },
                { name: 'Full NCERT Textbook Hub + Download', included: true },
                { name: 'Unlimited Flashcards', included: true },
                { name: 'Ad-free experience', included: true },
                { name: 'Priority email support (24h response)', included: true },
                { name: 'Smart model (GPT-OSS turbo)', included: true },
                { name: 'AI Study Plans + Progress tracking', included: true },
                { name: 'Unlimited uploads/vision scans', included: false },
            ],
            cta: 'Upgrade Now',
            popular: true,
        },
        {
            name: 'Pro Max',
            icon: Crown,
            price: billingCycle === 'monthly' ? '$9.99' : '$99.99',
            period: billingCycle === 'monthly' ? '/month' : '/year',
            description: 'The ultimate study superpower',
            color: 'from-amber-500 to-yellow-500',
            textColor: 'text-amber-600 dark:text-amber-400',
            bgColor: 'bg-amber-50 dark:bg-amber-900/20',
            borderColor: 'border-amber-200 dark:border-amber-800',
            features: [
                { name: '∞ Unlimited everything', included: true },
                { name: '24/7 Live chat support', included: true },
                { name: 'Vision AI + Code scanning', included: true },
                { name: 'Custom study plans by expert tutors', included: true },
                { name: 'AI Doubt clearing (chat)', included: true },
                { name: 'Past paper solutions + full archives', included: true },
                { name: 'Advanced model (Qwen 32B Vision)', included: true },
                { name: 'Priority API access', included: true },
                { name: 'Offline downloads for all content', included: true },
            ],
            cta: 'Upgrade Now',
        },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-[#020617] dark:to-slate-900">
            <Navbar />
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">
                {/* Header */}
                <div className="mb-16">
                    <button
                        onClick={() => navigate(-1)}
                        className="mb-8 flex items-center gap-2 text-slate-600 dark:text-slate-400 hover:text-[#1D9E75] transition-colors"
                    >
                        <ArrowLeft size={20} />
                        <span className="font-bold">Back</span>
                    </button>
                    <div>
                        <h1 className="text-5xl font-black text-slate-900 dark:text-white mb-4 flex items-center gap-4">
                            <div className="p-4 bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl">
                                <Crown className="text-white" size={40} />
                            </div>
                            Upgrade Your Study Game
                        </h1>
                        <p className="text-xl text-slate-600 dark:text-slate-400 font-medium max-w-2xl">
                            Choose the plan that matches your board exam ambitions. All plans include access to our complete NCERT curriculum.
                        </p>
                    </div>
                </div>

                {/* Billing Cycle Toggle */}
                <div className="mb-12 flex items-center justify-center gap-6">
                    <span className={`text-lg font-bold ${billingCycle === 'monthly' ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>
                        Monthly
                    </span>
                    <button
                        onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
                        className="relative inline-flex h-10 w-20 items-center rounded-full bg-slate-300 dark:bg-slate-700 transition-colors"
                        style={{
                            backgroundColor: billingCycle === 'yearly' ? '#1D9E75' : '#cbd5e1',
                        }}
                    >
                        <span
                            className={`inline-block h-8 w-8 transform rounded-full bg-white shadow-lg transition-transform ${billingCycle === 'yearly' ? 'translate-x-10' : 'translate-x-1'
                                }`}
                        />
                    </button>
                    <span className={`text-lg font-bold ${billingCycle === 'yearly' ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>
                        Yearly
                        <span className="ml-2 inline-block px-3 py-1 bg-[#1D9E75]/20 text-[#1D9E75] text-sm font-bold rounded-full">
                            Save 17%
                        </span>
                    </span>
                </div>

                {/* Plans Grid */}
                <div className="grid md:grid-cols-3 gap-8 mb-16">
                    {plans.map((plan) => {
                        const Icon = plan.icon;
                        return (
                            <div key={plan.name} className="relative group">
                                {plan.popular && (
                                    <div className="absolute -top-5 left-1/2 -translate-x-1/2 z-10">
                                        <div className="px-6 py-2 bg-gradient-to-r from-[#1D9E75] to-emerald-500 text-white font-black text-sm rounded-full shadow-lg flex items-center gap-2">
                                            <TrendingUp size={16} />
                                            MOST POPULAR
                                        </div>
                                    </div>
                                )}
                                <Card
                                    className={`relative h-full flex flex-col rounded-[40px] border-2 overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 ${plan.popular
                                        ? `border-[#1D9E75] bg-gradient-to-br from-white/95 to-emerald-50/50 dark:from-slate-900 dark:to-emerald-900/20`
                                        : `border-slate-200 dark:border-slate-700 ${plan.bgColor}`
                                        }`}
                                >
                                    {/* Background glow */}
                                    <div
                                        className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-gradient-to-br ${plan.color}`}
                                    />

                                    {/* Content */}
                                    <div className="relative z-10 p-8 flex-1 flex flex-col">
                                        {/* Icon and title */}
                                        <div className="mb-6">
                                            <div
                                                className={`w-16 h-16 rounded-3xl flex items-center justify-center mb-4 ${plan.bgColor} ${plan.borderColor} border-2`}
                                            >
                                                <Icon className={`${plan.textColor}`} size={32} />
                                            </div>
                                            <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2 flex items-center gap-2">
                                                {plan.name}
                                                {plan.popular && <Sparkles size={20} className="text-[#1D9E75]" />}
                                            </h3>
                                            <p className="text-slate-600 dark:text-slate-400 font-medium">{plan.description}</p>
                                        </div>

                                        {/* Price */}
                                        <div className="mb-8 py-6 border-y border-slate-100 dark:border-slate-800">
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-5xl font-black text-slate-900 dark:text-white">{plan.price}</span>
                                                <span className="text-slate-600 dark:text-slate-400 font-bold">{plan.period}</span>
                                            </div>
                                        </div>

                                        {/* Features list */}
                                        <div className="space-y-4 flex-1 mb-8">
                                            {plan.features.map((feature, idx) => (
                                                <div key={idx} className="flex items-start gap-3 group/feature">
                                                    {feature.included ? (
                                                        <div className="mt-1 p-1 bg-[#1D9E75]/20 rounded-full flex-shrink-0">
                                                            <Check size={16} className="text-[#1D9E75]" />
                                                        </div>
                                                    ) : (
                                                        <div className="mt-1 p-1 bg-slate-200 dark:bg-slate-700 rounded-full flex-shrink-0">
                                                            <X size={16} className="text-slate-400" />
                                                        </div>
                                                    )}
                                                    <span
                                                        className={`text-sm font-medium leading-relaxed ${feature.included
                                                            ? 'text-slate-700 dark:text-slate-300'
                                                            : 'text-slate-500 dark:text-slate-500 line-through'
                                                            }`}
                                                    >
                                                        {feature.name}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* CTA Button */}
                                        <Button
                                            disabled={plan.disabled}
                                            className={`w-full py-4 font-bold text-lg rounded-2xl transition-all ${plan.popular || !plan.disabled
                                                ? 'bg-[#1D9E75] hover:bg-[#16805d] text-white shadow-lg shadow-[#1D9E75]/30'
                                                : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-default'
                                                }`}
                                        >
                                            {plan.cta}
                                        </Button>
                                    </div>
                                </Card>
                            </div>
                        );
                    })}
                </div>

                {/* FAQ Section */}
                <Card className="p-12 bg-white dark:bg-slate-800 rounded-[40px] border-2 border-slate-100 dark:border-slate-700">
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-8">Frequently Asked Questions</h2>
                    <div className="grid md:grid-cols-2 gap-8">
                        {[
                            {
                                q: 'Can I cancel anytime?',
                                a: 'Yes! You can cancel your subscription anytime. No hidden fees or long-term contracts.',
                            },
                            {
                                q: 'Do you offer refunds?',
                                a: '30-day money-back guarantee if you\'re not satisfied with your plan.',
                            },
                            {
                                q: 'Which payment methods do you accept?',
                                a: 'We accept all major credit/debit cards, UPI, and digital wallets like Google Pay and PhonePe.',
                            },
                            {
                                q: "What's the difference between models?",
                                a: 'Standard (fast), Smart (accurate), Vision (image/handwriting). Pro Scholar gets Smart; Pro Max gets all.',
                            },
                            {
                                q: 'Can I upgrade or downgrade?',
                                a: "Yes! Change your plan anytime. We'll adjust your billing proportionally.",
                            },
                            {
                                q: 'Is there a student discount?',
                                a: 'Use code STUDENT2025 for 25% off any plan! Valid with proper ID proof.',
                            },
                        ].map((faq, idx) => (
                            <div key={idx} className="space-y-2">
                                <h4 className="font-black text-slate-900 dark:text-white text-lg flex items-center gap-2">
                                    <Zap size={20} className="text-[#1D9E75]" />
                                    {faq.q}
                                </h4>
                                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">{faq.a}</p>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Bottom CTA */}
                <div className="mt-16 text-center py-12 px-8 bg-gradient-to-r from-[#1D9E75]/10 to-emerald-500/10 dark:from-[#1D9E75]/20 dark:to-emerald-500/20 rounded-[40px] border-2 border-[#1D9E75]/20">
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-3">Ready to ace your boards?</h3>
                    <p className="text-slate-600 dark:text-slate-400 font-medium mb-6 max-w-2xl mx-auto">
                        Join 50,000+ students who are using NCERT AI to score higher. Your first 7 days are completely free!
                    </p>
                    <Button className="px-8 py-4 bg-[#1D9E75] hover:bg-[#16805d] text-white font-bold text-lg rounded-2xl shadow-lg">
                        Start Free Trial
                    </Button>
                </div>
            </div>
        </div>
    );
};
