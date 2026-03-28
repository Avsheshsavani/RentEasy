import { useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { Button, Input, Card } from '@/components/ui';
import { Building2, Phone, Mail, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

type LoginMethod = 'phone' | 'email';

export function LoginPage() {
  const { signInWithPhone, verifyOtp, signInWithEmail, isLoading } = useAuthStore();
  const [method, setMethod] = useState<LoginMethod>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showOtpInput, setShowOtpInput] = useState(false);

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone) return;

    const formattedPhone = phone.startsWith('+91') ? phone : `+91${phone}`;
    const { error } = await signInWithPhone(formattedPhone);
    
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('OTP sent successfully!');
      setShowOtpInput(true);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) return;

    const formattedPhone = phone.startsWith('+91') ? phone : `+91${phone}`;
    const { error } = await verifyOtp(formattedPhone, otp);
    
    if (error) {
      toast.error(error.message);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    const { error } = await signInWithEmail(email, password);
    
    if (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-primary-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-600 rounded-2xl mb-4">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">RentEase</h1>
          <p className="text-gray-500 mt-1">Property Management Made Simple</p>
          <p className="text-xs text-gray-400 mt-3 max-w-sm mx-auto leading-relaxed">
            <strong className="text-gray-500">Tenants:</strong> use <strong>Email</strong> if your owner gave you an email and password, or <strong>Phone</strong> to receive an SMS code (requires SMS to be set up in Supabase).
          </p>
        </div>

        <Card className="p-6">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setMethod('phone')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                method === 'phone'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Phone className="h-4 w-4 inline mr-2" />
              Phone
            </button>
            <button
              onClick={() => setMethod('email')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-colors ${
                method === 'email'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <Mail className="h-4 w-4 inline mr-2" />
              Email
            </button>
          </div>

          {method === 'phone' ? (
            !showOtpInput ? (
              <form onSubmit={handlePhoneSubmit} className="space-y-4">
                <Input
                  label="Phone Number"
                  type="tel"
                  placeholder="9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  helperText="We'll send you a verification code"
                />
                <Button type="submit" className="w-full" isLoading={isLoading}>
                  Send OTP
                </Button>
              </form>
            ) : (
              <form onSubmit={handleOtpSubmit} className="space-y-4">
                <Input
                  label="Enter OTP"
                  type="text"
                  placeholder="123456"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  helperText={`OTP sent to +91${phone}`}
                />
                <Button type="submit" className="w-full" isLoading={isLoading}>
                  Verify OTP
                </Button>
                <button
                  type="button"
                  onClick={() => setShowOtpInput(false)}
                  className="w-full text-sm text-gray-500 hover:text-gray-700"
                >
                  Change phone number
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <div className="relative">
                <Input
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Lock className="absolute right-3 top-9 h-4 w-4 text-gray-400" />
              </div>
              <Button type="submit" className="w-full" isLoading={isLoading}>
                Sign In
              </Button>
            </form>
          )}
        </Card>

        <p className="text-center text-xs text-gray-500 mt-6">
          By continuing, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}
