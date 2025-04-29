'use client';
import { useState } from 'react';

export default function NewsletterAndFooter() {
    const [email, setEmail] = useState('');
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isValidEmail, setIsValidEmail] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    
    const validateEmail = (email: string) => {
      const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      return re.test(email);
    };
    
    const handleSubscribe = async (e: React.FormEvent) => {
      e.preventDefault();
      
      if (!email) {
        return;
      }
      
      const isValid = validateEmail(email);
      setIsValidEmail(isValid);
      
      if (isValid) {
        setIsLoading(true);
        setError('');
        
        try {
          
          const response = await fetch('/api/subscribe', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email }),
          });
          
          if (!response.ok) {
            throw new Error('Subscription failed');
          }
          
         
          setIsSubscribed(true);
          setEmail('');
        } catch (error) {
          console.error('Error subscribing:', error);
          setError('Failed to subscribe. Please try again later.');
        } finally {
          setIsLoading(false);
        }
      }
    };
  const currentYear = new Date().getFullYear();
  
  return (
    <div className="bg-[#0d0d0d] py-20 overflow-hidden text-white">

    {/* Newsletter Section */}

    <div className="container lg:text-left text-center mx-auto px-4 my-auto">
      <div className="p-8 mx-8 lg:flex lg:flex-row flex-col justify-between items-center">
        <div className="">
            <div>
                <h2 className="text-2xl font-bold mb-2">Join our newsletter</h2>
                <p className="text-[#AAABAB] mb-6">Lorem ipsum dolor sit amet, consectetur adipiscing elit.</p>
           </div>
        </div>
        <div>
          {!isSubscribed ? (
            <form onSubmit={handleSubscribe} className="flex flex-col md:flex-row gap-3">
              <div className="flex-grow">
                <input
                  type="email"
                  placeholder="Enter your email"
                  className={`w-full px-4 py-3 bg-transparent border ${!isValidEmail ? 'border-red-500' : 'border-[#1D2025]'} rounded-md focus:outline-none focus:ring-2 focus:ring-green-500`}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setIsValidEmail(true);
                    setError('');
                  }}
                  disabled={isLoading}
                />
                {!isValidEmail && (
                  <p className="text-red-500 text-sm mt-1">Please enter a valid email address</p>
                )}
                {error && (
                  <p className="text-red-500 text-sm mt-1">{error}</p>
                )}
              </div>
              <button 
                type="submit" 
                className="hover:bg-green-700 bg-[#15A350] text-white font-semibold px-6 py-3 rounded-md transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed"
                disabled={isLoading}
              >
                {isLoading ? 'Subscribing...' : 'Join Now'}
              </button>
            </form>
          ) : (
            <div className="bg-green-900 bg-opacity-50 text-[#15A350] p-4 rounded-md">
              <p className="font-medium">Thanks for subscribing! You'll receive our next newsletter soon.</p>
            </div>
          )}
          
          <p className="text-white text-xs mt-4">
            By subscribing you agree to with our <a href="/privacy" className="text-white hover:text-[#15A350] underline">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
    
    {/* Footer Section */}

    <footer>
      <div className="max-w-6xl mx-auto px-4 py-12">
        
        <div className="flex flex-wrap justify-center gap-8 mb-8">
          <a href="#how-it-works" className="text-gray-400 hover:text-white transition-colors">
            How It Works
          </a>
          <a href="/features" className="text-gray-400 hover:text-white transition-colors">
            Features
          </a>
          <a href="#testimonials" className="text-gray-400 hover:text-white transition-colors">
            Testimonials
          </a>
        </div>
        
        
        <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-[#1D2025]">
         
          <div className="mb-4 md:mb-0">
            <h2 className="text-xl font-bold">Stellarfriend</h2>
          </div>
          
          
          <div className="text-white text-sm">
            © {currentYear} Stellarfriend. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  </div>
  );
} 