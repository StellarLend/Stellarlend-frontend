import HowItWorks from "@/components/marketing/HowItWorks";
import Navbar from "@/components/shared/layout/Navbar";
import Header from "@/components/shared/layout/TopNav";
import Footer from "@/components/marketing/Footer";
import TestimonialsSection from "@/components/marketing/testimonial";
import ExploreFeatures from "@/components/marketing/ExploreFeatures";
import Hero from "@/components/marketing/Hero";
import FastSecure from "@/components/marketing/FastSecure";


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
