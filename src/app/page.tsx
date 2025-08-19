import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-purple-50">
      {/* Navigation */}
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
        >
          Register
        </Button>
      </nav>

      {/* Hero Section */}
      <section className="px-6 py-10 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
                Salary payments to {" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
                 anyone anywhere 
                </span>{" "}
                around the world
              </h1>
              <p className="text-lg text-gray-600 leading-relaxed">
                <span className="">Email-enabled USD payments</span> to your remote team members and even AI workers
              </p>
            </div>
            
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-8 py-6 text-lg font-semibold rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
            >
              Get Started
            </Button>
          </div>

          {/* Hero Image */}
          <div className="relative">
            <div className="relative rounded-3xl overflow-hidden">
              <Image 
                src="/hero-image.jpeg" 
                alt="Hero Image" 
                width={600} 
                height={400} 
                className="w-full h-auto object-cover rounded-3xl shadow-lg"
                priority
              />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="bg-gradient-to-br from-slate-50 via-white to-purple-50/30 px-6 py-20">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16">
            {/* <p className="text-purple-600 text-sm font-medium tracking-wider uppercase mb-4">Process</p> */}
            <p className="text-purple-600 text-2xl font-medium tracking-wider uppercase mb-4">How it works</p>

            {/* <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">How It Works</h2> */}
            <p className="text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Simple steps to get your global payments flowing seamlessly
            </p>
          </div>

          {/* Three Steps */}
          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {/* Step 1 */}
            <div className="group">
              <div className="relative bg-gradient-to-br from-purple-50 to-indigo-50 rounded-2xl p-8 mb-6 transition-all duration-300 hover:shadow-lg hover:shadow-purple-100/50">
                <div className="absolute top-4 right-4 w-8 h-8 bg-purple-200/60 rounded-full"></div>
                <div className="absolute bottom-4 left-4 w-4 h-4 bg-indigo-200/60 rounded-full"></div>
                
                <div className="flex items-center justify-center h-32">
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                    <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-8 h-8 bg-purple-100 text-purple-600 rounded-full text-sm font-bold mb-2">
                  1
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Create Payment Group</h3>
                <p className="text-gray-600 leading-relaxed">
                  Add workers via email and how much to pay them monthly
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="group">
              <div className="relative bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-8 mb-6 transition-all duration-300 hover:shadow-lg hover:shadow-indigo-100/50">
                <div className="absolute top-4 right-4 w-6 h-6 bg-indigo-200/60 rounded-full"></div>
                <div className="absolute bottom-4 left-4 w-5 h-5 bg-blue-200/60 rounded-full"></div>
                
                <div className="flex items-center justify-center h-32">
                  <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                    <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-8 h-8 bg-indigo-100 text-indigo-600 rounded-full text-sm font-bold mb-2">
                  2
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Add Funds</h3>
                <p className="text-gray-600 leading-relaxed">
                  Transfer USDC into your account with the option to earn yields up to 45% APY
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="group">
              <div className="relative bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-8 mb-6 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-100/50">
                <div className="absolute top-4 right-4 w-7 h-7 bg-emerald-200/60 rounded-full"></div>
                <div className="absolute bottom-4 left-4 w-3 h-3 bg-teal-200/60 rounded-full"></div>
                
                <div className="flex items-center justify-center h-32">
                  <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                    <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-8 h-8 bg-emerald-100 text-emerald-600 rounded-full text-sm font-bold mb-2">
                  3
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Workers Withdraw</h3>
                <p className="text-gray-600 leading-relaxed">
                  Workers can withdraw their salary themselves when it reaches the date you set saving time and effort
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose WageRail Section */}
      <section className="bg-gradient-to-br from-purple-50 via-violet-50/50 to-white px-6 py-20">
        <div className="max-w-7xl mx-auto">
          {/* Section Header */}
          <div className="text-center mb-16">
            <p className="text-purple-600 text-2xl font-medium tracking-wider uppercase mb-4">Why Choose WageRail
</p>
            {/* <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-6">Why Choose WageRail</h2> */}
            <p className="text-lg text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Experience the future of global payments
            </p>
          </div>

          {/* Three Value Props */}
          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {/* Simple */}
            <div className="group">
              <div className="relative bg-gradient-to-br from-purple-50 to-violet-100/80 rounded-2xl p-8 mb-6 transition-all duration-300 hover:shadow-lg hover:shadow-purple-100/50 border border-purple-100/50">
                <div className="absolute top-4 right-4 w-6 h-6 bg-purple-200/40 rounded-full"></div>
                <div className="absolute bottom-4 left-4 w-4 h-4 bg-violet-200/40 rounded-full"></div>
                
                <div className="flex items-center justify-center h-32">
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-400 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                    <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="text-center space-y-4">
                <h3 className="text-xl font-semibold text-gray-900">Simple & Intuitive</h3>
                <p className="text-gray-600 leading-relaxed">
                  No complex setup or technical knowledge required. Send payments with just an email address in minutes.
                </p>
              </div>
            </div>

            {/* Fast */}
            <div className="group">
              <div className="relative bg-gradient-to-br from-violet-50 to-purple-100/80 rounded-2xl p-8 mb-6 transition-all duration-300 hover:shadow-lg hover:shadow-violet-100/50 border border-violet-100/50">
                <div className="absolute top-4 right-4 w-5 h-5 bg-violet-200/40 rounded-full"></div>
                <div className="absolute bottom-4 left-4 w-7 h-7 bg-purple-200/40 rounded-full"></div>
                
                <div className="flex items-center justify-center h-32">
                  <div className="w-20 h-20 bg-gradient-to-br from-violet-400 to-violet-500 rounded-xl flex items-center justify-center shadow-lg">
                    <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="text-center space-y-4">
                <h3 className="text-xl font-semibold text-gray-900">Lightning Fast</h3>
                <p className="text-gray-600 leading-relaxed">
                  Instant processing and real-time notifications. Your team gets paid when they need it most.
                </p>
              </div>
            </div>

            {/* Earn Yields */}
            <div className="group">
              <div className="relative bg-gradient-to-br from-purple-100/80 to-violet-50 rounded-2xl p-8 mb-6 transition-all duration-300 hover:shadow-lg hover:shadow-purple-100/50 border border-purple-100/50">
                <div className="absolute top-4 right-4 w-8 h-8 bg-purple-200/40 rounded-full"></div>
                <div className="absolute bottom-4 left-4 w-3 h-3 bg-violet-200/40 rounded-full"></div>
                
                <div className="flex items-center justify-center h-32">
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg">
                    <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
              
              <div className="text-center space-y-4">
                <h3 className="text-xl font-semibold text-gray-900">Earn Yields</h3>
                <p className="text-gray-600 leading-relaxed">
                  Maximize your treasury with competitive yields while maintaining full liquidity for payments.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 px-6 py-12">
        <div className="max-w-7xl mx-auto text-center space-y-2">
          <a href="/" className="flex items-center justify-center space-x-2">
            <Image 
              src="/logo.png" 
              alt="Logo" 
              width={30} 
              height={30} 
              className="cursor-pointer"
            />
          </a>
          
          {/* <div className="flex items-center justify-center space-x-2">
            <span className="text-2xl font-bold text-purple-900">wage</span>
            <span className="text-2xl font-bold text-purple-400">rail</span>
          </div> */}
          
          <div className="flex justify-center space-x-8 text-sm text-gray-600">
            {/* <a href="#" className="hover:text-purple-600 transition-colors flex items-center space-x-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2v1a1 1 0 001 1h6a1 1 0 001-1V3a2 2 0 012 2v6a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
              </svg>
              <span>Learn</span>
            </a>
            <a href="#" className="hover:text-purple-600 transition-colors flex items-center space-x-2">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
              </svg>
              <span>Examples</span>
            </a> */}
            {/* <a href="#" className="hover:text-purple-600 transition-colors flex items-center space-x-2"> */}
              {/* <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
              </svg> */}
              {/* <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
              </svg>
              <span>Start Now →</span> */}
            {/* </a> */}
          </div>
          
          <p className="text-xs text-gray-500">
            © 2025 WageRail
          </p>
        </div>
      </footer>
    </div>
  );
}