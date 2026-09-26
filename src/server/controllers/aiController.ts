import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { CostItemCategory, DraftBookingSuggestion, SplitType } from '../../core/types.js';
import { db } from '../db/store.js';

const getParam = (param: string | string[] | undefined): string => {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
};

export const parseChatItinerary = (req: Request, res: Response) => {
  const tripId = getParam(req.params.tripId);
  const { chatText } = req.body;

  if (!chatText || typeof chatText !== 'string') {
    return res.status(400).json({ success: false, error: 'chatText is required' });
  }

  const trip = db.getTripById(tripId);
  const existingMembers = db.getMembers(tripId);

  // Split into lines or distinct messages
  const lines = chatText
    .split(/\n+/)
    .map(l => l.trim())
    .filter(l => l.length > 5);

  const suggestions: DraftBookingSuggestion[] = [];

  for (const line of lines) {
    const lower = line.toLowerCase();

    // 1. Detect Category & Title
    let category: CostItemCategory = 'activity';
    let title = 'Group Booking';

    if (lower.includes('flight') || lower.includes('indigo') || lower.includes('air india') || lower.includes('ticket')) {
      category = 'flight';
      title = 'Flight Booking';
    } else if (lower.includes('hotel') || lower.includes('villa') || lower.includes('resort') || lower.includes('stay') || lower.includes('airbnb')) {
      category = 'stay';
      title = 'Accommodation Stay';
    } else if (lower.includes('cab') || lower.includes('taxi') || lower.includes('car') || lower.includes('bus') || lower.includes('transfer') || lower.includes('van')) {
      category = 'transport';
      title = 'Transport / Transfer';
    } else if (lower.includes('dinner') || lower.includes('lunch') || lower.includes('drinks') || lower.includes('bar') || lower.includes('food') || lower.includes('cafe')) {
      category = 'food';
      title = 'Group Meal / Dining';
    } else if (lower.includes('dive') || lower.includes('trek') || lower.includes('cruise') || lower.includes('tour') || lower.includes('safari') || lower.includes('museum')) {
      category = 'activity';
      title = 'Tour / Activity';
    }

    // Refine title from line
    const matchQuote = line.match(/"([^"]+)"|'([^']+)'/);
    if (matchQuote) {
      title = matchQuote[1] || matchQuote[2];
    } else {
      const matchBooking = line.match(/(?:booked|reserved|paid for|got)\s+([^,.:\n]+)/i);
      if (matchBooking) {
        title = matchBooking[1].trim();
      }
    }

    // 2. Extract Amount
    let estimatedAmount = 0; // minor units
    const amountMatch = line.match(/(?:₹|rs\.?|inr|\$|€)\s*([\d,]+(?:\.\d+)?)/i) || line.match(/([\d,]+(?:\.\d+)?)\s*(?:₹|rs\.?|inr|\$|€|bucks|rupees)/i) || line.match(/\b(\d{3,7})\b/);
    if (amountMatch) {
      const numStr = amountMatch[1].replace(/,/g, '');
      const parsedNum = parseFloat(numStr);
      if (!isNaN(parsedNum)) {
        estimatedAmount = Math.round(parsedNum * 100);
      }
    }

    // 3. Extract Suggested Participants
    const suggestedParticipantNames: string[] = [];
    for (const m of existingMembers) {
      const firstWord = m.displayName.split(' ')[0].toLowerCase();
      if (lower.includes(firstWord)) {
        suggestedParticipantNames.push(m.displayName);
      }
    }

    if (suggestedParticipantNames.length === 0) {
      for (const m of existingMembers) {
        suggestedParticipantNames.push(m.displayName);
      }
    }

    // 4. Extract Suggested Split Type
    let suggestedSplitType: SplitType = 'equal';
    if (category === 'stay' && (lower.includes('room') || lower.includes('suite') || lower.includes('bed'))) {
      suggestedSplitType = 'shared_room';
    } else if (category === 'activity' && suggestedParticipantNames.length < existingMembers.length) {
      suggestedSplitType = 'activity_based';
    } else if (lower.includes('weight') || lower.includes('ratio') || lower.includes('share')) {
      suggestedSplitType = 'participant_weighted';
    } else if (lower.includes('my treat') || lower.includes('on me') || lower.includes('sponsored') || lower.includes('host pays')) {
      suggestedSplitType = 'organizer_paid';
    }

    if (estimatedAmount > 0 || title !== 'Group Booking') {
      suggestions.push({
        id: `draft-${uuidv4().slice(0, 8)}`,
        title,
        category,
        estimatedAmount: estimatedAmount > 0 ? estimatedAmount : 500000,
        currency: trip?.baseCurrency || 'INR',
        suggestedSplitType,
        suggestedParticipantNames,
        rawSnippet: line,
      });
    }
  }

  res.json({
    success: true,
    data: {
      tripId,
      parsedCount: suggestions.length,
      suggestions,
    },
  });
};
