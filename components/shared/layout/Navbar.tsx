"use client";

import { X, Menu } from "lucide-react";
import React, { useState } from "react";
import Image from "next/image";
import NavLink from "./NavLink";

const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <nav className="bg-black text-white w-full font-medium text-sm flex justify-center transition-colors border-b border-gray-800">
      {/* Border Wrapper */}
      <div className="flex flex-col w-[90%] p-4">
        <div className="flex items-center justify-between w-full">
          <div className="h-10 w-36">
            <Image src="/logo.svg" className="!relative" alt="logo" fill />
          </div>

          {/* Navigation Links - Desktop */}
          <div className="hidden md:flex space-x-6 items-center justify-between px-2">
            <NavLink className="" href="#how-it-works">
              How It Works
            </NavLink>
            <NavLink className="" href="#features">
              {" "}
              Features
            </NavLink>
            <NavLink className="" href="#testimonials">
              Testimonials
            </NavLink>
          </div>
          <div className="hidden md:flex text-white space-x-4">
            <button className="px-3 py-2 rounded-sm hover:border hover:border-[#15A350]">
              Launch app
            </button>
            <button className="bg-[#15A350] text-white px-3 py-2 rounded-sm hover:opacity-80">
              Sign Up
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden p-2 ml-auto" onClick={toggleMenu}>
            {isMenuOpen ? (
              <X className="w-6 h-6" />
            ) : (
              <Menu className="w-6 h-6" />
            )}
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden mt-4 flex flex-col space-y-4">
            <NavLink className="" href="#how-it-works">
              How It Works
            </NavLink>
            <NavLink className="" href="#features">
              {" "}
              Features
            </NavLink>
            <NavLink className="" href="#testimonials">
              Testimonials
            </NavLink>
            <div className="flex flex-col md:hidden w-fit text-white space-y-4">
              <button className="px-3 py-2 rounded-sm hover:border hover:border-[#15A350]">
                Launch app
              </button>
              <button className="bg-[#15A350] text-white px-3 py-2 rounded-sm hover:opacity-80">
                Sign Up
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Header;
