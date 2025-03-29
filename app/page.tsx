import HowItWorks from "@/components/HowItWorks";
import Header from "@/components/Navbar/Navbar";
import TestimonialsSection from "@/components/testimonial";
import Image from "next/image";

export default function Home() {
  return (
    <div className="">
      <Header />
      <main>
        <HowItWorks/>
        <TestimonialsSection />
      </main>
      <footer >
        
      </footer>
    </div>
  );
}
