'use client';
import { useState } from 'react';
import { Twitter, Github, Linkedin, Mail } from 'lucide-react';

export default function Footer() {
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
    
    const footerLinks = {
      product: [
        { name: 'Features', href: '/features' },
        { name: 'How It Works', href: '#how-it-works' },
        { name: 'Pricing', href: '/pricing' },
        { name: 'Security', href: '/security' },
      ],
      company: [
        { name: 'About Us', href: '/about' },
        { name: 'Blog', href: '/blog' },
        { name: 'Careers', href: '/careers' },
        { name: 'Contact', href: '/contact' },
      ],
      resources: [
        { name: 'Documentation', href: '/docs' },
        { name: 'API Reference', href: '/api-docs' },
        { name: 'Audits', href: '/audits' },
        { name: 'FAQ', href: '/faq' },
      ],
      legal: [
        { name: 'Terms of Service', href: '/terms' },
        { name: 'Privacy Policy', href: '/privacy' },
        { name: 'Cookie Policy', href: '/cookies' },
        { name: 'Disclaimer', href: '/disclaimer' },
      ]
    };

    const socialLinks = [
      { icon: Twitter, href: 'https://twitter.com/stellarlend', label: 'Twitter' },
      { icon: Github, href: 'https://github.com/stellarlend', label: 'GitHub' },
      { icon: Linkedin, href: 'https://linkedin.com/company/stellarlend', label: 'LinkedIn' },
      { icon: Mail, href: 'mailto:contact@stellarlend.com', label: 'Email' },
    ];
  
  return (
    <footer className="bg-[#0D0D0D] text-white">
      {/* Newsletter Section */}
      <div className="border-b border-[#1D2025]">
        <div className="max-w-6xl mx-auto px-4 py-16">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">Stay Updated with Stellarlend</h2>
            <p className="text-[#AAABAB] text-lg mb-8 max-w-2xl mx-auto">
              Get the latest updates on new features, market insights, and exclusive opportunities delivered to your inbox.
            </p>
            
            {!isSubscribed ? (
              <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
                <div className="flex-1">
                  <input
                    type="email"
                    placeholder="Enter your email address"
                    className={`w-full px-4 py-3 bg-transparent border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15A350] transition-all
                      ${!isValidEmail ? 'border-red-500' : 'border-[#1D2025] hover:border-[#15A350]'}`}
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setIsValidEmail(true);
                      setError('');
                    }}
                    disabled={isLoading}
                  />
                  {!isValidEmail && (
                    <p className="text-red-500 text-sm mt-2">Please enter a valid email address</p>
                  )}
                  {error && (
                    <p className="text-red-500 text-sm mt-2">{error}</p>
                  )}
                </div>
                <button 
                  type="submit" 
                  className="bg-[#15A350] hover:bg-[#128F42] text-white font-semibold px-6 py-3 rounded-lg transition-colors duration-200 disabled:bg-gray-600 disabled:cursor-not-allowed whitespace-nowrap"
                  disabled={isLoading}
                >
                  {isLoading ? 'Subscribing...' : 'Subscribe'}
                </button>
              </form>
            ) : (
              <div className="bg-green-900/20 border border-green-500/30 text-[#15A350] p-4 rounded-lg max-w-md mx-auto">
                <p className="font-medium">Thanks for subscribing! Check your inbox for confirmation.</p>
              </div>
            )}
            
            <p className="text-[#AAABAB] text-sm mt-4">
              By subscribing you agree to our{' '}
              <a href="/privacy" className="text-[#15A350] hover:underline">Privacy Policy</a>
              {' '}and{' '}
              <a href="/terms" className="text-[#15A350] hover:underline">Terms of Service</a>
            </p>
          </div>
        </div>
      </div>

      {/* Main Footer Content */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          {/* Brand Section */}
          <div className="lg:col-span-2">
            <h3 className="text-2xl font-bold text-white mb-4">Stellarlend</h3>
            <p className="text-[#AAABAB] mb-6 max-w-sm">
              The future of DeFi lending on Stellar. Fast, secure, and accessible to everyone.
            </p>
            
            {/* Social Links */}
            <div className="flex space-x-4">
              {socialLinks.map((social, index) => {
                const Icon = social.icon;
                return (
                  <a
                    key={index}
                    href={social.href}
                    aria-label={social.label}
                    className="w-10 h-10 bg-[#1D2025] hover:bg-[#15A350] rounded-lg flex items-center justify-center transition-colors duration-200"
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Footer Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-white font-semibold mb-4 capitalize">{category}</h4>
              <ul className="space-y-2">
                {links.map((link, index) => (
                  <li key={index}>
                    <a
                      href={link.href}
                      className="text-[#AAABAB] hover:text-[#15A350] transition-colors duration-200"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-[#1D2025]">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-[#AAABAB] text-sm">
              &copy; {currentYear} Stellarlend. All rights reserved.
            </div>
            
            <div className="flex items-center space-x-6 text-sm">
              <span className="text-[#AAABAB]">Built on</span>
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-[#15A350] rounded-full"></div>
                <span className="text-white font-medium">Stellar</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}