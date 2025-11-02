import React, { useState } from 'react';
import { Scan, BookUser, MapPin, Rocket, Sparkles, MoveRight, MoveLeft } from 'lucide-react';

interface OnboardingProps {
    onComplete: () => void;
}

const slides = [
    {
        icon: Sparkles,
        title: "أهلاً بك في زاد",
        description: "رفيقك الذكي في السفر. دعنا نأخذك في جولة سريعة لاكتشاف أهم الميزات.",
        color: 'text-yellow-500'
    },
    {
        icon: Scan,
        title: "حلّل كل شيء بلمسة زر",
        description: "صوّر منتجاً، قائمة طعام، أو حتى إيصالاً لتحليله فوراً.",
        color: 'text-teal-500'
    },
    {
        icon: BookUser,
        title: "دوّن قصصك، ليس فقط ملاحظاتك",
        description: "أضف الصور والفيديوهات، وسيحولها الذكاء الاصطناعي إلى قصة سفر ملهمة.",
        color: 'text-green-500'
    },
    {
        icon: MapPin,
        title: "اكتشف العالم من حولك",
        description: "ابحث عن أماكن، أنشطة، وحتى محطات توقف مناسبة على طريق رحلتك.",
        color: 'text-blue-500'
    },
    {
        icon: Rocket,
        title: "أنت الآن جاهز للانطلاق!",
        description: "استكشف كل الأدوات واستمتع برحلتك مع زاد.",
        color: 'text-purple-500'
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
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center justify-between p-6 text-center animate-fade-in">
            <div className="w-full text-left pt-2">
                 <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
                    <span className="font-sans">ZAD</span> | زاد
                </h1>
            </div>

            <main className="flex-grow flex flex-col items-center justify-center w-full max-w-sm">
                 <div className={`p-6 bg-primary-light/20 dark:bg-primary-dark/30 rounded-full mb-8 ${slides[currentSlide].color}`}>
                    <SlideIcon size={64} strokeWidth={1.5} />
                </div>
                <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-4">{slides[currentSlide].title}</h2>
                <p className="text-lg text-gray-600 dark:text-gray-400">{slides[currentSlide].description}</p>
            </main>

            <footer className="w-full max-w-sm">
                <div className="flex justify-center items-center gap-2 mb-8">
                    {slides.map((_, index) => (
                        <div
                            key={index}
                            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                                currentSlide === index ? 'bg-primary w-6' : 'bg-gray-300 dark:bg-gray-600'
                            }`}
                        />
                    ))}
                </div>
                
                {currentSlide === slides.length - 1 ? (
                    <button
                        onClick={onComplete}
                        className="w-full flex items-center justify-center gap-2 p-4 bg-primary text-white rounded-xl font-bold text-lg shadow-lg hover:bg-primary-dark transition-transform transform hover:scale-105"
                    >
                        <span>هيا بنا!</span>
                        <MoveLeft />
                    </button>
                ) : (
                    <div className="flex items-center justify-between gap-4">
                         <button
                            onClick={prevSlide}
                            disabled={currentSlide === 0}
                            className="p-4 text-gray-500 dark:text-gray-400 font-semibold rounded-xl hover:bg-gray-200 dark:hover:bg-gray-800 disabled:opacity-50"
                        >
                            <MoveRight />
                        </button>
                        <button
                            onClick={nextSlide}
                            className="flex-grow flex items-center justify-center gap-2 p-4 bg-primary text-white rounded-xl font-bold text-lg shadow-lg hover:bg-primary-dark transition-colors"
                        >
                             <span>التالي</span>
                        </button>
                    </div>
                )}
            </footer>
        </div>
    );
};

export default Onboarding;