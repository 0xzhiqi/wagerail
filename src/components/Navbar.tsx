import Image from "next/image";
import { Button } from "@/components/ui/button";

interface NavbarProps {
  onRegisterClick?: () => void;
}

export default function Navbar({ onRegisterClick }: NavbarProps) {
  return (
    <nav className="flex items-center justify-between pl-0 pr-6 pt-4 bg-slate-50 backdrop-blur-sm">
      <a href="/" className="flex items-center">
        <Image 
          src="/logo.png" 
          alt="Logo" 
          width={80} 
          height={80} 
          className="cursor-pointer object-contain max-h-6"
          priority
        />
      </a>
      
      <Button 
        variant="outline" 
        size="lg" 
        className="border-purple-200 text-purple-600 hover:bg-purple-50 hover:text-purple-700 px-8 py-3 text-base font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
        onClick={onRegisterClick}
      >
        Register
      </Button>
    </nav>
  );
}