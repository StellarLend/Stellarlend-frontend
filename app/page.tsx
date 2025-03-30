
import HowItWorks from "@/components/HowItWorks";
import Header from "@/components/Navbar/Navbar";
import TestimonialsSection from "@/components/testimonial";

export default function Home() {
  return (
    <div className="">
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <TestimonialsSection />
      </main>
    </div>
  );
}
