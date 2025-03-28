"use client"
import React, { useState, useEffect } from 'react';
import { Star } from 'lucide-react';
import Image from 'next/image';

const TestimonialsSection = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [cardsPerView, setCardsPerView] = useState(3);

  const testimonials = [
    {
      rating: 5,
      feedback: 'StellarLend made it easy for me to borrow funds instantly at low interest. No hidden fees, just seamless DeFi!',
      name: "Name",
      surname:"Surname",
      company: "Company Name",
      position: "Position",
      avatar: "/avatar.svg"
    },
    {
      rating: 5,
      feedback: 'I love how simple and secure the platform is. Finally, a DeFi lending service that works for everyone.',
      name: "Name",
      surname:"Surname",
      company: "Company Name",
      position: "Position",
      avatar: "/avatar.svg"
    },
    {
      rating: 5,
      feedback: 'Fast transactions, low fees, and a smooth experience—StellarLend is a game-changer!',
      name: "Name",
      surname:"Surname",
      company: "Company Name",
      position: "Position",
      avatar: "/avatar.svg"
    },
    {
      rating: 5,
      feedback: 'I love how simple and secure the platform is. Finally, a DeFi lending service that works for everyone.',
      name: "Name",
      surname:"Surname",
      company: "Company Name",
      position: "Position",
      avatar: "/avatar.svg"
    },
    {
      rating: 5,
      feedback: 'I love how simple and secure the platform is. Finally, a DeFi lending service that works for everyone.',
      name: "Name",
      surname:"Surname",
      company: "Company Name",
      position: "Position",
      avatar: "/avatar.svg"
    },
    {
      rating: 5,
      feedback: 'Fast transactions, low fees, and a smooth experience—StellarLend is a game-changer!',
      name: "Name",
      surname:"Surname",
      company: "Company Name",
      position: "Position",
      avatar: "/avatar.svg"
    },
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
    <div className="bg-black py-20 overflow-hidden">
      <div className="container mx-auto px-4 my-auto">
        <h2 className="text-5xl font-bold text-[#18BA5B] text-center mb-12">
            Testimonials
        </h2>
        <div className="flex justify-center space-x-8 transition-transform duration-500 ease-in-out">
          {getCardsToShow().map((testimonial, index) => (
            <div 
              key={index} 
              className="bg-[#0D0D0D] border border-[#1D2025] rounded-lg p-6 text-white 
              w-[350px] flex-shrink-0"
            >
              <div className="flex mb-4">
                {renderStars(testimonial.rating)}
              </div>
              <p className="my-6">
                {testimonial.feedback}
              </p>
              <div className="flex items-center mt-20">
                <div className="w-fit h-fit rounded-full mr-3">
                    <Image src={testimonial.avatar} alt="avatar" className="!relative" fill/>
                </div>
                <div className=''>
                    <p className="font-semibold text-[#F8F8F8]">{ `${testimonial.name} ${testimonial.surname}`}</p>
                    <p className="text-sm text-[#AAABAB]">{ `${testimonial.position}, ${testimonial.company}`}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TestimonialsSection;