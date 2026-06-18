import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Crown, Zap, Sparkles, Check, X, Flame, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { Navbar } from '../components/layout/Navbar';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { createBillingCheckout, getBillingConfig, resendParentCredentials, startBillingTrial, type BillingConfigResponse } from '../api';
import { updateUser } from '../utils/storage';

export const Settings = () => {
    const navigate = useNavigate();
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
    const [billingConfig, setBillingConfig] = useState<BillingConfigResponse | null>(null);
    const [loadingCheckout, setLoadingCheckout] = useState<'pro' | 'pro_max' | null>(null);
    const [loadingParentResend, setLoadingParentResend] = useState(false);

    useEffect(() => {
        const loadBilling = async () => {
            try {
                const config = await getBillingConfig();
                setBillingConfig(config);
            } catch {
                setBillingConfig(null);
            }
        };

        loadBilling();
    }, []);

    const launchCheckout = async (plan: 'pro' | 'pro_max') => {
        if (!billingConfig?.enabled) {
            setLoadingCheckout(plan);
            try {
                const res = await startBillingTrial(plan);
                updateUser({
                    subscriptionTier: res.subscriptionTier,
                    subscriptionStatus: res.subscriptionStatus,
                    trialStart: res.trialStart,
                    trialEnd: res.trialEnd,
                    subscriptionEnd: res.subscriptionEnd,
                });
                toast.success(`Success! Activated trial for Clarity ${plan === 'pro' ? 'Pro' : 'Pro Max'}`);
                navigate('/dashboard');
            } catch (error: any) {
                console.error('Failed to start trial', error);
                toast.error(error?.response?.data?.detail || 'Could not start trial right now.');
            } finally {
                setLoadingCheckout(null);
            }
            return;
        }

        setLoadingCheckout(plan);
        try {
            const { checkout_url } = await createBillingCheckout(plan);
            window.location.href = checkout_url;
        } catch (error) {
            console.error('Failed to start checkout', error);
            toast.error('Could not start checkout right now.');
        } finally {
            setLoadingCheckout(null);
        }
    };

    const handleParentResend = async () => {
        setLoadingParentResend(true);
        try {
            const result = await resendParentCredentials();
            toast.success(result.message || 'Parent credentials sent again.');
        } catch (error: any) {
            toast.error(error?.response?.data?.detail || 'Could not resend parent credentials right now.');
        } finally {
            setLoadingParentResend(false);
        }
    };

    const plans = [
        {
            name: 'Free Trial',
            icon: Sparkles,
            price: '$0',
            period: '/forever',
            description: 'The plan for getting started now',
            planId: undefined,
            color: 'from-blue-500 to-cyan-500',
            textColor: 'text-blue-600 ',
            bgColor: 'bg-blue-50 ',
            borderColor: 'border-blue-200 ',
            features: [
                { name: 'Core study workspace', included: true },
                { name: 'Parent-linked progress view', included: true },
                { name: 'Diagnostic onboarding', included: true },
                { name: 'Basic practice and revision tools', included: true },
            ],
            cta: 'Current Plan',
            disabled: true,
        },
        {
            name: 'Pro Scholar',
            icon: Flame,
            price: billingConfig?.plans.pro ? (billingCycle === 'monthly' ? billingConfig.plans.pro.monthly : billingConfig.plans.pro.yearly) : (billingCycle === 'monthly' ? '50 AED' : '500 AED'),
            period: billingCycle === 'monthly' ? '/month' : '/year',
            description: 'For serious board prep',
            planId: 'pro' as const,
            color: 'from-orange-500 to-red-500',
            textColor: 'text-orange-600 ',
            bgColor: 'bg-orange-50 ',
            borderColor: 'border-orange-200 ',
            features: [
                { name: 'Unlimited questions and practice', included: true },
                { name: 'Full progress analytics', included: true },
                { name: 'OCR and file analysis tools', included: true },
                { name: 'Weekly parent report', included: true },
                { name: 'Priority support queue', included: true },
            ],
            cta: billingConfig?.enabled ? 'Start Checkout' : 'Start Free Trial',
            popular: true,
        },
        {
            name: 'Pro Max',
            icon: Crown,
            price: billingConfig?.plans.pro_max ? (billingCycle === 'monthly' ? billingConfig.plans.pro_max.monthly : billingConfig.plans.pro_max.yearly) : (billingCycle === 'monthly' ? '350 AED' : '3500 AED'),
            period: billingCycle === 'monthly' ? '/month' : '/year',
            description: 'The full board-prep workspace',
            planId: 'pro_max' as const,
            color: 'from-amber-500 to-yellow-500',
            textColor: 'text-amber-600 ',
            bgColor: 'bg-amber-50 ',
            borderColor: 'border-amber-200 ',
            features: [
                { name: 'Everything in Pro', included: true },
                { name: 'Board-style exam simulator', included: true },
                { name: 'Parent portal + readiness signals', included: true },
                { name: 'Advanced video and image study tools', included: true },
                { name: 'Highest priority support', included: true },
            ],
            cta: billingConfig?.enabled ? 'Start Checkout' : 'Start Free Trial',
        },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-stone-50 to-blue-50 ">
            <Navbar />
            <div className="max-w-7xl mx-auto px-4 md:px-8 py-12">
                {/* Header */}
                <div className="mb-16">
                    <button
                        onClick={() => navigate(-1)}
                        className="mb-8 flex items-center gap-2 text-stone-600 hover:text-[#8C5A35] transition-colors"
                    >
                        <ArrowLeft size={20} />
                        <span className="font-bold">Back</span>
                    </button>
                    <div>
                        <h1 className="text-5xl font-black text-[#2C241B] mb-4 flex items-center gap-4">
                            <div className="p-4 bg-gradient-to-br from-amber-400 to-orange-500 rounded-3xl">
                                <Crown className="text-white" size={40} />
                            </div>
                            Upgrade Your Study Game
                        </h1>
                        <p className="text-xl text-stone-600 font-medium max-w-2xl">
                            Choose the plan that matches your board exam ambitions. All plans include access to our complete NCERT curriculum.
                        </p>
                    </div>
                </div>

                <Card className="mb-10 p-6 rounded-[32px] bg-[#FCFAF8] border-2 border-stone-100 ">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div>
                            <p className="text-xs font-black uppercase tracking-wider text-[#8C5A35]">Parent access</p>
                            <h2 className="text-2xl font-black text-[#2C241B] ">Resend parent portal credentials</h2>
                            <p className="mt-2 text-sm text-stone-600 ">
                                Use this only when the parent loses access. It sends a fresh password once without changing your profile.
                            </p>
                        </div>
                        <Button
                            onClick={handleParentResend}
                            disabled={loadingParentResend}
                            className="px-5 py-3 rounded-2xl bg-stone-900 text-white font-black"
                        >
                            {loadingParentResend ? 'Sending...' : 'Resend Parent Credentials'}
                        </Button>
                    </div>
                </Card>

                {/* Billing Cycle Toggle */}
                <div className="mb-12 flex items-center justify-center gap-6">
                    <span className={`text-lg font-bold ${billingCycle === 'monthly' ? 'text-[#2C241B] ' : 'text-stone-500'}`}>
                        Monthly
                    </span>
                    <button
                        onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
                        className="relative inline-flex h-10 w-20 items-center rounded-full bg-stone-300 transition-colors"
                        style={{
                            backgroundColor: billingCycle === 'yearly' ? '#8C5A35' : '#cbd5e1',
                        }}
                    >
                        <span
                            className={`inline-block h-8 w-8 transform rounded-full bg-[#FCFAF8] shadow-lg transition-transform ${billingCycle === 'yearly' ? 'transtone-x-10' : 'transtone-x-1'
                                }`}
                        />
                    </button>
                    <span className={`text-lg font-bold ${billingCycle === 'yearly' ? 'text-[#2C241B] ' : 'text-stone-500'}`}>
                        Yearly
                        <span className="ml-2 inline-block px-3 py-1 bg-[#8C5A35]/20 text-[#8C5A35] text-sm font-bold rounded-full">
                            Save 17%
                        </span>
                    </span>
                </div>

                {!billingConfig?.enabled && (
                    <div className="mb-8 rounded-3xl border border-amber-200 bg-amber-50/80 p-5 text-amber-900 ">
                        <p className="text-sm font-black uppercase tracking-[0.18em]">Billing not connected</p>
                        <p className="mt-2 text-sm text-amber-800 ">
                            Stripe checkout is wired in, but you still need a Stripe secret key and price IDs before subscriptions can charge cards.
                        </p>
                    </div>
                )}

                {/* Plans Grid */}
                <div className="grid md:grid-cols-3 gap-8 mb-16">
                    {plans.map((plan) => {
                        const Icon = plan.icon;
                        const planId = plan.planId as 'pro' | 'pro_max' | undefined;
                        return (
                            <div key={plan.name} className="relative group">
                                {plan.popular && (
                                    <div className="absolute -top-5 left-1/2 -transtone-x-1/2 z-10">
                                        <div className="px-6 py-2 bg-gradient-to-r from-[#8C5A35] to-amber-500 text-white font-black text-sm rounded-full shadow-lg flex items-center gap-2">
                                            <TrendingUp size={16} />
                                            MOST POPULAR
                                        </div>
                                    </div>
                                )}
                                <Card
                                    className={`relative h-full flex flex-col rounded-[40px] border-2 overflow-hidden transition-all duration-300 hover:shadow-2xl hover:-transtone-y-2 ${plan.popular
                                        ? `border-[#8C5A35] bg-gradient-to-br from-white/95 to-amber-50/50 `
                                        : `border-stone-200 ${plan.bgColor}`
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
                                            <h3 className="text-2xl font-black text-[#2C241B] mb-2 flex items-center gap-2">
                                                {plan.name}
                                                {plan.popular && <Sparkles size={20} className="text-[#8C5A35]" />}
                                            </h3>
                                            <p className="text-stone-600 font-medium">{plan.description}</p>
                                        </div>

                                        {/* Price */}
                                        <div className="mb-8 py-6 border-y border-stone-100 ">
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-5xl font-black text-[#2C241B] ">{plan.price}</span>
                                                <span className="text-stone-600 font-bold">{plan.period}</span>
                                            </div>
                                        </div>

                                        {/* Features list */}
                                        <div className="space-y-4 flex-1 mb-8">
                                            {plan.features.map((feature, idx) => (
                                                <div key={idx} className="flex items-start gap-3 group/feature">
                                                    {feature.included ? (
                                                        <div className="mt-1 p-1 bg-[#8C5A35]/20 rounded-full flex-shrink-0">
                                                            <Check size={16} className="text-[#8C5A35]" />
                                                        </div>
                                                    ) : (
                                                        <div className="mt-1 p-1 bg-[#E8E4DB] rounded-full flex-shrink-0">
                                                            <X size={16} className="text-stone-400" />
                                                        </div>
                                                    )}
                                                    <span
                                                        className={`text-sm font-medium leading-relaxed ${feature.included
                                                            ? 'text-stone-700 '
                                                            : 'text-stone-500 line-through'
                                                            }`}
                                                    >
                                                        {feature.name}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* CTA Button */}
                                        <Button
                                            disabled={plan.disabled || loadingCheckout === planId}
                                            onClick={() => {
                                                if (planId) {
                                                    launchCheckout(planId);
                                                }
                                            }}
                                            className={`w-full py-4 font-bold text-lg rounded-2xl transition-all ${plan.popular || !plan.disabled
                                                ? 'bg-[#8C5A35] hover:bg-[#70482B] text-white shadow-lg shadow-[#8C5A35]/30'
                                                : 'bg-[#E8E4DB] text-stone-700 cursor-default'
                                                }`}
                                        >
                                            {loadingCheckout === planId ? 'Preparing checkout...' : plan.cta}
                                        </Button>
                                    </div>
                                </Card>
                            </div>
                        );
                    })}
                </div>

                {/* FAQ Section */}
                <Card className="p-12 bg-[#FCFAF8] rounded-[40px] border-2 border-stone-100 ">
                    <h2 className="text-3xl font-black text-[#2C241B] mb-8">Frequently Asked Questions</h2>
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
                                a: 'Subscriptions are handled through Stripe Checkout, so card payment support depends on the checkout account you connect.',
                            },
                            {
                                q: "What's the difference between models?",
                                a: 'Pro Scholar unlocks the heavier study tools. Pro Max adds the most advanced exam and parent-facing flows.',
                            },
                            {
                                q: 'Can I upgrade or downgrade?',
                                a: 'Yes. Once billing is live, plan changes can be handled from the same subscription screen.',
                            },
                            {
                                q: 'Is there a student discount?',
                                a: 'Discount codes can be added later through the billing provider if you want promo support.',
                            },
                        ].map((faq, idx) => (
                            <div key={idx} className="space-y-2">
                                <h4 className="font-black text-[#2C241B] text-lg flex items-center gap-2">
                                    <Zap size={20} className="text-[#8C5A35]" />
                                    {faq.q}
                                </h4>
                                <p className="text-stone-600 leading-relaxed">{faq.a}</p>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Bottom CTA */}
                <div className="mt-16 text-center py-12 px-8 bg-gradient-to-r from-[#8C5A35]/10 to-amber-500/10 rounded-[40px] border-2 border-[#8C5A35]/20">
                    <h3 className="text-2xl font-black text-[#2C241B] mb-3">Ready to ace your boards?</h3>
                    <p className="text-stone-600 font-medium mb-6 max-w-2xl mx-auto">
                        Join 50,000+ students who are using NCERT AI to score higher. Your first 7 days are completely free!
                    </p>
                    <Button className="px-8 py-4 bg-[#8C5A35] hover:bg-[#70482B] text-white font-bold text-lg rounded-2xl shadow-lg" onClick={() => navigate('/onboarding')}>
                        Start Free Trial
                    </Button>
                </div>
            </div>
        </div>
    );
};
