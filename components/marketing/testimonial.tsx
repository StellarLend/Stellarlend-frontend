"use client"
import React, { useState, useEffect } from 'react';
import { Star, ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';

const TestimonialsSection = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [cardsPerView, setCardsPerView] = useState(3);

  const testimonials = [
    {
      rating: 5,
      feedback: 'StellarLend made it easy for me to borrow funds instantly at low interest. The 3-second settlement time is a game-changer for my trading strategy.',
      name: "Alex",
      surname: "Chen",
      company: "DeFi Trader",
      position: "Professional Trader",
      avatar: "/avatars/alex-chen.jpg"
    },
    {
      rating: 5,
      feedback: 'I love how simple and secure the platform is. Finally, a DeFi lending service that works for everyone without complex KYC requirements.',
      name: "Sarah",
      surname: "Johnson",
      company: "Crypto Enthusiast",
      position: "Retail Investor",
      avatar: "/avatars/sarah-johnson.jpg"
    },
    {
      rating: 5,
      feedback: 'Fast transactions, low fees, and a smooth experience—StellarLend has become my go-to platform for earning yield on my stablecoins.',
      name: "Marcus",
      surname: "Williams",
      company: "Yield Farmer",
      position: "DeFi Power User",
      avatar: "/avatars/marcus-williams.jpg"
    },
    {
      rating: 5,
      feedback: 'The non-custodial nature gives me peace of mind. I maintain full control of my assets while earning competitive APYs.',
      name: "Elena",
      surname: "Rodriguez",
      company: "Security Expert",
      position: "Blockchain Developer",
      avatar: "/avatars/elena-rodriguez.jpg"
    },
    {
      rating: 5,
      feedback: 'As someone new to DeFi, StellarLend\'s intuitive interface made it incredibly easy to start lending and borrowing.',
      name: "James",
      surname: "Park",
      company: "DeFi Newcomer",
      position: "Software Engineer",
      avatar: "/avatars/james-park.jpg"
    },
    {
      rating: 5,
      feedback: 'The audit reports and transparent smart contracts gave me the confidence to deposit significant amounts. Excellent platform!',
      name: "Nina",
      surname: "Patel",
      company: "Institutional User",
      position: "Fund Manager",
      avatar: "/avatars/nina-patel.jpg"
    }
  ];

  // Responsive cards per view
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setCardsPerView(width >= 1024 ? 3 : width >= 768 ? 2 : 1);
    };

    // Set initial view
    handleResize();

    // Add event listener
    window.addEventListener('resize', handleResize);

    // Clean up
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Auto-scroll effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => {
        const maxSlides = Math.ceil(testimonials.length / cardsPerView);
        return (prev + 1) % maxSlides;
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [cardsPerView, testimonials.length]);

  const renderStars = (count: number) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Star 
        key={index} 
        className={`w-5 h-5 ${index < count ? 'text-yellow-500' : 'text-gray-500'}`}
        fill={index < count ? 'currentColor' : 'none'}
      />
    ));
  };

  // Get cards to show based on current slide and cards per view
  const getCardsToShow = () => {
    const startIndex = currentSlide * cardsPerView;
    return testimonials.slice(startIndex, startIndex + cardsPerView);
  };

  return (
    <div className="bg-black py-20 overflow-hidden" id='testimonials'>
      <div className="container max-w-6xl mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            Trusted by <span className="text-[#15A350]">1000+ Users</span>
          </h2>
          <p className="text-lg text-[#AAABAB] max-w-2xl mx-auto">
            See what our community is saying about their experience with Stellarlend
          </p>
        </div>

        {/* Navigation controls */}
        <div className="flex justify-between items-center mb-8">
          <button
            onClick={() => setCurrentSlide((prev) => Math.max(0, prev - 1))}
            className="p-2 rounded-full bg-[#1D2025] hover:bg-[#15A350] transition-colors"
            disabled={currentSlide === 0}
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
          
          <div className="flex space-x-2">
            {Array.from({ length: Math.ceil(testimonials.length / cardsPerView) }, (_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  currentSlide === index ? 'bg-[#15A350]' : 'bg-[#1D2025]'
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => setCurrentSlide((prev) => Math.min(Math.ceil(testimonials.length / cardsPerView) - 1, prev + 1))}
            className="p-2 rounded-full bg-[#1D2025] hover:bg-[#15A350] transition-colors"
            disabled={currentSlide >= Math.ceil(testimonials.length / cardsPerView) - 1}
          >
            <ChevronRight className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Testimonials carousel */}
        <div className="flex justify-center space-x-8 transition-transform duration-500 ease-in-out">
          {getCardsToShow().map((testimonial, index) => (
            <div 
              key={`${currentSlide}-${index}`} 
              className="bg-[#0D0D0D] border border-[#1D2025] rounded-xl p-6 text-white 
              w-[350px] flex-shrink-0 hover:border-[#15A350] transition-all duration-300"
            >
              <div className="flex mb-4">
                {renderStars(testimonial.rating)}
              </div>
              <p className="text-[#AAABAB] mb-6 leading-relaxed">
                "{testimonial.feedback}"
              </p>
              <div className="flex items-center">
                <div className="w-12 h-12 rounded-full bg-[#15A350]/20 flex items-center justify-center mr-4">
                  <span className="text-lg font-semibold text-[#15A350]">
                    {testimonial.name[0]}{testimonial.surname[0]}
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-white">{`${testimonial.name} ${testimonial.surname}`}</p>
                  <p className="text-sm text-[#AAABAB]">{testimonial.position}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Call to action */}
        <div className="text-center mt-16">
          <p className="text-[#AAABAB] mb-6">Join thousands of users earning competitive yields</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-[#15A350] text-white px-8 py-3 rounded-lg hover:bg-[#128F42] transition-colors font-medium">
              Start Earning Now
            </button>
            <button className="border border-[#15A350] text-[#15A350] px-8 py-3 rounded-lg hover:bg-[#15A350] hover:text-white transition-all font-medium">
              Read More Reviews
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestimonialsSection;