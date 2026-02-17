'use client';

import Image from 'next/image';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const quotes = [
  {
    text: "Be An Example By Contributing In Someone’s Life & Let Others Follow You.",
    author: "Mr. Vasant Dinkar Mestry"
  },
  {
    text: "Thousands Of Minds & Thousands Of Brains May Work Together & Create An History In The Engineering Industry.",
    author: "Mr. Vasant Dinkar Mestry"
  }
];
const departments = [
  'Career Building Department',
  'Corporate Training',
  'Training and Development',
  'Accounts',
];
export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [department, setDepartment] = useState('');
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentQuoteIndex((prevIndex) => (prevIndex + 1) % quotes.length);
    }, 5000); // Change quote every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, department }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccess(`Welcome, ${data.user.firstName} ${data.user.lastName}!`);
        setTimeout(() => router.push('/dashboard'), 1000);
      } else {
        setError(data.message);
      }
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex overflow-hidden">
      {/* Left Side - Decorative Colored Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#2E3093] via-[#2A6BB5] to-[#2E3093]">
        {/* Animated Background Shapes */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-[#FAE452]/20 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#2A6BB5]/30 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-white/5 rounded-full blur-2xl"></div>
        </div>
        
        {/* Decorative Grid Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }}></div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full p-12">
          <div className="text-white/80 text-lg text-center max-w-md leading-relaxed min-h-[16rem] flex items-center justify-center">
            <div key={currentQuoteIndex} className="animate-fade-in-out">
              <p className="text-3xl font-bold" style={{color: '#FAE452'}}>"{quotes[currentQuoteIndex].text}"</p>
              <p className="text-right text-lg mt-4 text-white/70">- {quotes[currentQuoteIndex].author}</p>
            </div>
          </div>
          
          {/* Feature Pills */}

        </div>

        {/* Bottom Wave */}
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z" fill="white" fillOpacity="0.05"/>
          </svg>
        </div>
      </div>

      {/* Right Side - White with Logo & Form */}
      <div className="w-full lg:w-1/2 h-full flex items-center justify-center p-4 sm:p-6 md:p-8 bg-white overflow-hidden">
        <div className="w-full max-w-md max-h-full overflow-y-auto">
          {/* Form Card */}
          <div className="bg-gray-10 rounded-3xl shadow-lg border border-gray-100 p-6 pt-2 sm:p-8 sm:pt-2">
            {/* Logo inside container */}
            <div className="flex flex-col items-center">
              <div className="w-52 h-52 relative flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/sit.png"
                  alt="SIT Logo"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            </div>

            <div className="mb-2 -mt-2">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Sign In</h2>
              <p className="text-gray-500 text-sm">Enter your credentials to continue</p>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}
            {success && (
              <div className="p-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm">
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Email Field */}
              <div className="group">
                <label 
                  htmlFor="email" 
                  className="block text-sm font-semibold text-gray-700 mb-0"
                >
                  Email Address
                </label>
                <div className="relative mt-1">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400 group-focus-within:text-[#2A6BB5] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                    </svg>
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full pl-12 pr-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-[#2A6BB5] focus:outline-none focus:ring-4 focus:ring-[#2A6BB5]/10 transition-all text-gray-800 placeholder-gray-400"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="group">
                <label 
                  htmlFor="password" 
                  className="block text-sm font-semibold text-gray-700 mb-0"
                >
                  Password
                </label>
                <div className="relative mt-1">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400 group-focus-within:text-[#2A6BB5] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-12 pr-12 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-[#2A6BB5] focus:outline-none focus:ring-4 focus:ring-[#2A6BB5]/10 transition-all text-gray-800 placeholder-gray-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Department Field */}
              <div className="group">
                <label 
                  htmlFor="department" 
                  className="block text-sm font-semibold text-gray-700 mb-0"
                >
                  Department
                </label>
                <div className="relative mt-1">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400 group-focus-within:text-[#2A6BB5] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <select
                    id="department"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    required
                    style={{backgroundColor: '#ffffff'}}
                    className="w-full pl-12 pr-10 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-[#2A6BB5] focus:outline-none focus:ring-4 focus:ring-[#2A6BB5]/10 transition-all text-gray-800 appearance-none cursor-pointer"
                  >
                    <option value="" disabled>Select your department</option>
                    {departments.map((dept) => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Remember & Forgot */}
              <div className="flex items-center justify-between">
                <label className="flex items-center cursor-pointer group">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 text-[#2A6BB5] bg-gray-50 border-2 border-gray-100 rounded-md focus:ring-[#2A6BB5] focus:ring-offset-0 cursor-pointer transition-colors"
                  />
                  <span className="ml-3 text-sm text-gray-600 group-hover:text-gray-800 transition-colors">Remember me</span>
                </label>
                <a 
                  href="#" 
                  className="text-sm font-semibold text-[#2A6BB5] hover:text-[#2E3093] transition-colors"
                >
                  Forgot password?
                </a>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="relative w-full py-3 px-6 bg-gradient-to-r from-[#2E3093] to-[#2A6BB5] text-white font-bold rounded-xl transition-all duration-300 transform hover:scale-[1.02] hover:shadow-lg hover:shadow-[#2A6BB5]/25 disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none overflow-hidden group"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign In
                      <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-[#FAE452] to-[#FAE452] opacity-0 group-hover:opacity-20 transition-opacity"></div>
              </button>


            </form>
          </div>

          {/* Footer */}
          <p className="text-center text-sm text-gray-400 mt-4">
            © 2026 Suvidya Institute of Technology
          </p>
        </div>
      </div>

      {/* Custom Styles */}
      <style jsx>{`
        select {
          -webkit-appearance: none;
          -moz-appearance: none;
          appearance: none;
          background-color: #ffffff !important;
        }
        input, select {
          background-color: #ffffff !important;
          border-color: #e5e7eb !important;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        .delay-1000 {
          animation-delay: 1s;
        }
        @keyframes fade-in-out {
          0% { opacity: 0; transform: translateY(20px); }
          15% { opacity: 1; transform: translateY(0); }
          85% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-20px); }
        }
        .animate-fade-in-out {
          animation: fade-in-out 5s ease-in-out;
        }
      `}</style>
    </div>
  );
}
