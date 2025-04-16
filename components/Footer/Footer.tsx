"use client";
// components/Footer.tsx
import { useState } from 'react';
import Link from 'next/link';

const Footer = () => {
  const [email, setEmail] = useState('');
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle newsletter subscription logic here
    console.log('Email submitted:', email);
    setEmail('');
  };
  
  return (
    <footer className="bg-[#0D0D0D] text-white py-8 px-4 md:py-16 lg:py-20 md:px-8 lg:px-12 xl:px-20">
      {/* Mobile version - Only visible on small screens */}
      <div className="md:hidden max-w-md mx-auto">
        <div className="text-center">
          <h3 className="text-[22px] font-medium mb-0">Join our newsletter</h3>
          <p className="text-gray-400 text-sm mt-1">
            Lorem ipsum dolor sit amet, consectetur adipiscing elit.
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="mt-6 mb-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className="w-full h-[42px] rounded border border-gray-700 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none mb-3"
          />
          <button 
            type="submit" 
            className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded transition-colors"
          >
            Join Now
          </button>
        </form>
        
        <p className="text-[12px] text-gray-400 text-center mb-8">
          By subscribing you agree to with our <Link href="/privacy" className="text-gray-200 hover:text-white underline">Privacy Policy</Link>
        </p>
        
        <nav className="mb-8">
          <ul className="flex justify-center gap-6">
            <li><Link href="/how-it-works" className="text-gray-300 hover:text-white">How It Works</Link></li>
            <li><Link href="/features" className="text-gray-300 hover:text-white">Features</Link></li>
            <li><Link href="/testimonials" className="text-gray-300 hover:text-white">Testimonials</Link></li>
          </ul>
        </nav>
        
        {/* Horizontal divider for mobile */}
        <div className="border-t border-[#1D2025] my-8"></div>
        
        <div className="text-center">
          <div className="text-xl font-bold mb-2">Stellarlend</div>
          <div className="text-sm text-gray-400">© 2025 Stellarlend. All rights reserved.</div>
        </div>
      </div>
      
      {/* Desktop version - Only visible on medium screens and up */}
      <div className="hidden md:block max-w-7xl mx-auto">
        {/* Top section */}
        <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
          {/* Newsletter section - Left side */}
          <div className="w-full md:w-[375px]">
            <h3 className="text-[18px] font-medium text-left mb-0">Join our newsletter</h3>
            <p className="text-gray-400 text-left text-sm mt-1">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit.
            </p>
          </div>
          
          {/* Email form - Right side */}
          <div className="w-full lg:w-[400px]">
            <div className="flex flex-col sm:flex-row justify-end">
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 w-full">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full sm:w-[274px] h-[42px] rounded-md border border-gray-700 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-600"
                />
                <button 
                  type="submit" 
                  className="bg-green-500 hover:bg-green-600 text-white px-6 py-2 rounded transition-colors whitespace-nowrap"
                >
                  Join Now
                </button>
              </form>
            </div>
            
            <div className="flex justify-start mt-2">
              <p className="text-[12px] text-gray-400">
                By subscribing you agree to with our <Link href="/privacy" className="text-gray-200 hover:text-white underline">Privacy Policy</Link>
              </p>
            </div>
          </div>
        </div>
        
        {/* Navigation links - Center */}
        <div className="flex justify-center mt-12">
          <nav>
            <ul className="flex gap-8">
              <li><Link href="/how-it-works" className="text-gray-300 hover:text-white">How It Works</Link></li>
              <li><Link href="/features" className="text-gray-300 hover:text-white">Features</Link></li>
              <li><Link href="/testimonials" className="text-gray-300 hover:text-white">Testimonials</Link></li>
            </ul>
          </nav>
        </div>
        
        {/* Divider for desktop */}
        <div className="border-t border-[#1D2025] my-8"></div>
        
        {/* Bottom section with logo and copyright */}
        <div className="flex flex-col sm:flex-row justify-between items-center">
          <div className="text-xl font-bold mb-4 sm:mb-0">Stellarlend</div>
          <div className="text-sm text-gray-400">© 2025 Stellarlend. All rights reserved.</div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;