import React, { useState } from 'react';
import { Scan, BookUser, MapPin, Rocket, Sparkles, MoveRight, MoveLeft, ArrowRight } from 'lucide-react';

interface OnboardingProps {
    onComplete: () => void;
}

const slides = [
    {
        icon: Sparkles,
        title: "أهلاً بك في زاد",
        description: "رفيقك الذكي في السفر. دعنا نأخذك في جولة سريعة لاكتشاف أهم الميزات.",
        color: 'text-yellow-400'
    },
    {
        icon: Scan,
        title: "حلّل كل شيء بلمسة زر",
        description: "صوّر منتجاً، قائمة طعام، أو حتى إيصالاً لتحليله فوراً.",
        color: 'text-teal-400'
    },
    {
        icon: BookUser,
        title: "دوّن قصصك، ليس فقط ملاحظاتك",
        description: "أضف الصور والفيديوهات، وسيحولها الذكاء الاصطناعي إلى قصة سفر ملهمة.",
        color: 'text-green-400'
    },
    {
        icon: MapPin,
        title: "اكتشف العالم من حولك",
        description: "ابحث عن أماكن، أنشطة، وحتى محطات توقف مناسبة على طريق رحلتك.",
        color: 'text-blue-400'
    },
    {
        icon: Rocket,
        title: "أنت الآن جاهز للانطلاق!",
        description: "استكشف كل الأدوات واستمتع برحلتك مع زاد.",
        color: 'text-purple-400'
    }
];

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
    const [currentSlide, setCurrentSlide] = useState(0);

    const nextSlide = () => {
        if (currentSlide < slides.length - 1) {
            setCurrentSlide(currentSlide + 1);
        }
    };

    const prevSlide = () => {
        if (currentSlide > 0) {
            setCurrentSlide(currentSlide - 1);
        }
    };

    const SlideIcon = slides[currentSlide].icon;

    return (
        <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center p-4 animate-fade-in">
            <header className="absolute top-6 left-6 text-2xl font-bold">
                 <h1 className="font-sans">ZAD | زاد</h1>
            </header>

            <div className="w-full max-w-sm aspect-[9/16] bg-gray-800/30 border-2 border-blue-400/30 rounded-3xl shadow-2xl flex flex-col p-6 text-center">
                <main className="flex-grow flex flex-col items-center justify-center">
                    <div className="p-6 bg-teal-900/50 rounded-full mb-8">
                        <SlideIcon size={64} strokeWidth={1.5} className={slides[currentSlide].color} />
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-4">{slides[currentSlide].title}</h2>
                    <p className="text-lg text-gray-300">{slides[currentSlide].description}</p>
                </main>

                <footer className="w-full flex-shrink-0">
                    <div className="flex justify-center items-center gap-2 mb-6">
                        {slides.map((_, index) => (
                            <div
                                key={index}
                                className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                                    currentSlide === index ? 'bg-primary w-6' : 'bg-gray-500'
                                }`}
                            />
                        ))}
                    </div>
                    
                    {currentSlide === slides.length - 1 ? (
                        <button
                            onClick={onComplete}
                            className="w-full flex items-center justify-center gap-2 p-4 bg-primary text-white rounded-full font-bold text-lg shadow-lg hover:bg-primary-dark transition-transform transform hover:scale-105"
                        >
                            <span>هيا بنا!</span>
                            <MoveLeft />
                        </button>
                    ) : (
                        <div className="flex items-center justify-between">
                            <button
                                onClick={prevSlide}
                                disabled={currentSlide === 0}
                                className="p-3 rounded-full hover:bg-white/10 transition-opacity disabled:opacity-0"
                            >
                                <MoveRight />
                            </button>
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={nextSlide}
                                    className="px-8 py-3 bg-primary text-white rounded-full font-bold shadow-lg hover:bg-primary-dark transition-colors"
                                >
                                    التالي
                                </button>
                                {/* This is a decorative arrow to match the screenshot style */}
                                <ArrowRight className="text-gray-500 -rotate-180" />
                            </div>
                        </div>
                    )}
                </footer>
            </div>
        </div>
    );
};

export default Onboarding;