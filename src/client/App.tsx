import React from 'react';
import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/react';
import { TripProvider, useTrip } from './context/TripContext.js';
import { Header } from './components/Header.js';
import { TripDashboard } from './screens/TripDashboard.js';
import { CostItemEditor } from './screens/CostItemEditor.js';
import { PersonalView } from './screens/PersonalView.js';
import { SettleUpScreen } from './screens/SettleUpScreen.js';
import { AIParserScreen } from './screens/AIParserScreen.js';
import { AuditTrailModal } from './components/AuditTrailModal.js';
import { RecordPaymentModal } from './components/RecordPaymentModal.js';
import { MemberManagementModal } from './components/MemberManagementModal.js';

// Landing page shown to unauthenticated users
const LandingPage: React.FC = () => (
  <div className="min-h-screen bg-[#F0F4EF] flex flex-col items-center justify-center px-4" style={{ fontFamily: 'Urbanist, sans-serif' }}>
    <div className="max-w-md w-full text-center space-y-8">
      {/* Logo & Brand */}
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-xl"
          style={{ background: 'linear-gradient(180deg, #65A98A 0%, #21584B 100%)' }}
        >
          <svg className="w-11 h-11" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="32" r="26" stroke="rgba(255,255,255,0.85)" strokeWidth="3" />
            <path d="M21 32.5L28.5 40L43 24.5" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight text-[#123D38]">TripSync</h1>
        <p className="text-gray-500 text-base leading-relaxed">
          Everyone's trip, in sync. Split expenses, track balances, and settle up — together.
        </p>
      </div>

      {/* Feature pills */}
      <div className="flex flex-wrap justify-center gap-2 text-xs font-semibold text-[#123D38]">
        {['Smart expense splitting', 'Real-time balances', 'Easy settle-up', 'AI itinerary parser'].map(f => (
          <span key={f} className="bg-white border border-gray-200 px-3 py-1.5 rounded-full shadow-sm">{f}</span>
        ))}
      </div>

      {/* Auth CTAs */}
      <div className="flex flex-col gap-3">
        <SignUpButton mode="modal">
          <button
            id="landing-get-started-btn"
            className="w-full py-4 rounded-2xl text-white font-bold text-base shadow-lg transition-all hover:brightness-110 active:scale-95"
            style={{ background: 'linear-gradient(180deg, #FF9580 0%, #E75D4F 100%)' }}
          >
            Start your trip free
          </button>
        </SignUpButton>
        <SignInButton mode="modal">
          <button
            id="landing-login-btn"
            className="w-full py-3.5 rounded-2xl text-[#123D38] font-semibold text-sm bg-white border border-gray-200 hover:bg-gray-50 transition shadow-sm"
          >
            Log in to your account
          </button>
        </SignInButton>
      </div>

      <p className="text-xs text-gray-400">No credit card needed · Your first trip is free</p>
    </div>
  </div>
);

const MainLayout: React.FC = () => {
  const { activeScreen, loading, error } = useTrip();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-500">Deriving ledger state & calculating shares...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="card p-8 max-w-md text-center bg-white border border-slate-200">
          <h2 className="text-base font-bold text-rose-600 mb-2">Connection Error</h2>
          <p className="text-xs text-slate-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn btn-primary btn-sm"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-indigo-500 selection:text-white">
      <Header />

      <main className="flex-1">
        {activeScreen === 'dashboard' && <TripDashboard key="dashboard" />}
        {activeScreen === 'item_editor' && <CostItemEditor key="item_editor" />}
        {activeScreen === 'personal' && <PersonalView key="personal" />}
        {activeScreen === 'settle' && <SettleUpScreen key="settle" />}
        {activeScreen === 'ai_parser' && <AIParserScreen key="ai_parser" />}
      </main>

      {/* Global Modals */}
      <AuditTrailModal />
      <RecordPaymentModal />
      <MemberManagementModal />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <>
      <SignedOut>
        <LandingPage />
      </SignedOut>
      <SignedIn>
        <TripProvider>
          <MainLayout />
        </TripProvider>
      </SignedIn>
    </>
  );
};

export default App;
