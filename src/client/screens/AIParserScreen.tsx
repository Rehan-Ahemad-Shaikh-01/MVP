import React, { useState } from 'react';
import {
  Sparkles,
  Check,
  CheckCircle2,
  AlertCircle,
  Plus,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { useTrip } from '../context/TripContext.js';
import { Avatar } from '../components/Avatar.js';
import { formatCurrency } from '../utils/formatters.js';
import { DraftBookingSuggestion } from '../../core/types.js';
import { api } from '../utils/api.js';

const SAMPLE_CHAT = `ok so
flights are booked finally! paid ₹24500 for the whole group.
bob's covering the villa deposit, he said it was about 16000?
also activity on day 2 is optional for whoever wants to do the scuba trek... i think maybe just me, charlie, and dave? it's ₹3500 per person paid to 'goa dive center'.
wait, forgot about the airport van transfer. it's 3600 total.
lunch on friday was seafood fiesta at fisherman's wharf, everyone was there. alice paid ₹10000.`;

export const AIParserScreen: React.FC = () => {
  const { trip, members, tripId, createCostItem, refreshAll, navigateTo } = useTrip();

  const [chatText, setChatText] = useState<string>(SAMPLE_CHAT);
  const [parsing, setParsing] = useState<boolean>(false);
  const [suggestions, setSuggestions] = useState<DraftBookingSuggestion[]>([]);
  const [selectedDraftIds, setSelectedDraftIds] = useState<string[]>([]);
  const [confirming, setConfirming] = useState<boolean>(false);

  const handleParse = async () => {
    if (!chatText.trim()) return;
    setParsing(true);
    try {
      const res = await api.parseChatItinerary(tripId, chatText);
      setSuggestions(res.suggestions);
      setSelectedDraftIds(res.suggestions.map((s) => s.id));
    } catch (err: any) {
      alert(err.message || 'Failed to parse chat itinerary');
    } finally {
      setParsing(false);
    }
  };

  // Run initial parse on mount
  React.useEffect(() => {
    handleParse();
  }, [tripId]);

  const toggleDraft = (id: string) => {
    if (selectedDraftIds.includes(id)) {
      setSelectedDraftIds(selectedDraftIds.filter((dId) => dId !== id));
    } else {
      setSelectedDraftIds([...selectedDraftIds, id]);
    }
  };

  const handleConfirmSelected = async () => {
    const selected = suggestions.filter((s) => selectedDraftIds.includes(s.id));
    if (selected.length === 0) return;

    setConfirming(true);
    try {
      for (const draft of selected) {
        // Map suggested participant names to member IDs
        const matchedMemberIds = members
          .filter((m) =>
            draft.suggestedParticipantNames.some((name) =>
              m.displayName.toLowerCase().includes(name.toLowerCase())
            )
          )
          .map((m) => m.id);

        const finalParticipants =
          matchedMemberIds.length > 0 ? matchedMemberIds : members.map((m) => m.id);

        await createCostItem({
          title: draft.title,
          category: draft.category,
          totalAmount: draft.estimatedAmount,
          currency: draft.currency,
          startDatetime: new Date().toISOString(),
          endDatetime: new Date().toISOString(),
          splitRule: {
            type: draft.suggestedSplitType,
          },
          participants: finalParticipants.map((mid) => ({ memberId: mid })),
        });
      }

      await refreshAll();
      navigateTo('dashboard');
    } catch (err: any) {
      alert(err.message || 'Failed to commit AI bookings');
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="max-w-[1320px] mx-auto px-6 py-8 pb-32">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Source Chat Log */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              SOURCE CHAT LOG
            </span>
            <span className="text-[11px] text-slate-400">Editable source text</span>
          </div>

          <div className="card p-4 bg-white border border-slate-200">
            <textarea
              rows={16}
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder="Paste unstructured trip chat messages here..."
              className="w-full bg-transparent text-xs font-mono text-slate-800 leading-relaxed focus:outline-none resize-none"
            />

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={handleParse}
                disabled={parsing}
                className="btn btn-indigo btn-sm flex items-center gap-1.5 text-xs shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {parsing ? 'Parsing...' : 'Re-extract Bookings'}
              </button>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-900 leading-relaxed">
            💡 <strong>AI Guardrail (PROJECT_BRIEF Section 9)</strong>: Parsed output is strictly generated
            as <em>draft suggestions</em>. Nothing is committed to the ledger until the organizer reviews
            and clicks <strong>Confirm</strong>.
          </div>
        </div>

        {/* Right Column: Review Suggestions */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-extrabold text-slate-900">Review Suggestions</h2>
              <p className="text-xs text-slate-500">
                Found {suggestions.length} booking suggestions. Select which ones to commit to the ledger.
              </p>
            </div>

            <span className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg">
              <Sparkles className="w-3.5 h-3.5" />
              AI-Powered Extraction
            </span>
          </div>

          <div className="space-y-3.5">
            {suggestions.length === 0 ? (
              <div className="card p-12 text-center text-slate-400 text-xs">
                No bookings found. Paste travel messages on the left and click "Re-extract".
              </div>
            ) : (
              suggestions.map((draft) => {
                const isSelected = selectedDraftIds.includes(draft.id);

                return (
                  <div
                    key={draft.id}
                    onClick={() => toggleDraft(draft.id)}
                    className={`card p-5 cursor-pointer border transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-white shadow-xs ring-1 ring-indigo-600/20'
                        : 'border-slate-200 bg-white opacity-60 hover:opacity-90'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-5 h-5 rounded-lg flex items-center justify-center text-white text-[10px] transition-colors ${
                            isSelected ? 'bg-indigo-600' : 'border border-slate-300'
                          }`}
                        >
                          {isSelected && '✓'}
                        </div>

                        <span className="pill pill-active text-[10px] py-0.5">AI SUGGESTED</span>
                        <span className="pill pill-settled text-[10px] py-0.5">HIGH CONFIDENCE</span>
                      </div>

                      <div className="text-right">
                        <span className="text-base font-extrabold text-slate-900 num-font block">
                          {formatCurrency(draft.estimatedAmount, draft.currency)}
                        </span>
                        <span className="text-[10px] text-slate-400">Total Amount</span>
                      </div>
                    </div>

                    <h3 className="font-extrabold text-base text-slate-900 mb-2">
                      {draft.title}
                    </h3>

                    <div className="grid grid-cols-2 gap-4 text-xs text-slate-500 mb-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Category / Split
                        </span>
                        <span className="font-semibold text-slate-700 capitalize">
                          {draft.category} • {draft.suggestedSplitType.replace('_', ' ')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">
                          Raw Mention
                        </span>
                        <span className="text-slate-600 truncate block font-mono text-[11px]">
                          "{draft.rawSnippet}"
                        </span>
                      </div>
                    </div>

                    {/* Participants stack */}
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                        Suggested Participants ({draft.suggestedParticipantNames.length})
                      </span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {draft.suggestedParticipantNames.map((name, nIdx) => (
                          <span
                            key={nIdx}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium"
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200 py-3.5 px-6 z-30 shadow-lg">
        <div className="max-w-[1320px] mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-indigo-600 text-white font-extrabold text-xs flex items-center justify-center">
              {selectedDraftIds.length}
            </div>
            <div>
              <span className="font-bold text-xs text-slate-900 block">
                {selectedDraftIds.length} of {suggestions.length} bookings selected
              </span>
              <span className="text-[11px] text-slate-400">
                Only selected & reviewed items will be added to the ledger.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedDraftIds([])}
              className="text-xs font-bold text-slate-500 hover:text-slate-800"
            >
              Discard All
            </button>

            <button
              onClick={handleConfirmSelected}
              disabled={confirming || selectedDraftIds.length === 0}
              className="btn btn-primary btn-sm px-6 py-2.5 rounded-xl shadow-md text-xs"
            >
              {confirming
                ? 'Adding to ledger...'
                : `Confirm ${selectedDraftIds.length} Booking${selectedDraftIds.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
