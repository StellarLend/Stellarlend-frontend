import HowItWorks from "@/components/HowItWorks";
import Navbar from "@/components/Navbar/Navbar";
import Header from "@/components/Navbar/TopNav";
import Footer from "@/components/Footer";
import TestimonialsSection from "@/components/testimonial";
import ExploreFeatures from "@/components/ExploreFeatures";
import Hero from "@/components/Hero";


export default function Home() {
  return (
    <div className="">
        {/* <Navbar/> */}
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <ExploreFeatures />
        <TestimonialsSection />
      </main>
      <Footer />
    </div>
  );
}
