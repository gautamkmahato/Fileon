import FeaturesSection from "./_components/FeaturesSection";
import HeroSection from "./_components/HeroSection";
import HowItWorksSection from "./_components/HowItWorksSection";
import StickyShowcaseSection from "./_components/StickyShowcaseSection";
import HomeFooter from "./_components/HomeFooter";
import PricingSection from "./_components/PricingSection";
import TestimonialsSection from "./_components/TestimonialsSection";

export default function Home() {
  return (
    <div>
      <HeroSection />
      <FeaturesSection />
      <StickyShowcaseSection />
      <HowItWorksSection />
      <TestimonialsSection />
      <PricingSection />
      <HomeFooter />
    </div>
  );
}