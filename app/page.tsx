import HowItWorks from "@/components/HowItWorks";
import Navbar from "@/components/Navbar/Navbar";
import Header from "@/components/Navbar/TopNav";
import Footer from "@/components/Footer";
import TestimonialsSection from "@/components/testimonial";
import ExploreFeatures from "@/components/ExploreFeatures";
import Hero from "@/components/Hero";
import FastSecure from "@/components/FastSecure";


export default function Home() {
  return (
    <div className="">
        {/* <Navbar/> */}
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <ExploreFeatures />
        <FastSecure />
        <TestimonialsSection />
      </main>
      <Footer />
    </div>
  );
}
