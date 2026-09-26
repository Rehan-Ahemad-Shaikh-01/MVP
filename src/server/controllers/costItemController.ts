import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { CostItem, Payment } from '../../core/types.js';
import { db } from '../db/store.js';

const getParam = (param: string | string[] | undefined): string => {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
};

export const getCostItems = (req: Request, res: Response) => {
  const tripId = getParam(req.params.tripId);
  const items = db.getCostItems(tripId);
  res.json({ success: true, data: items });
};

export const createCostItem = (req: Request, res: Response) => {
  const tripId = getParam(req.params.tripId);
  const {
    title,
    category = 'activity',
    totalAmount,
    currency = 'INR',
    vendorId,
    startDatetime,
    endDatetime,
    paidByMemberId,
    splitRule,
    participants = [],
    cancellationPolicy,
    actorMemberId = 'system',
  } = req.body;

  if (!title || totalAmount === undefined || !splitRule || !splitRule.type) {
    return res.status(400).json({
      success: false,
      error: 'title, totalAmount, and splitRule (with type) are required',
    });
  }

  const itemId = `item-${uuidv4().slice(0, 8)}`;
  const now = new Date().toISOString();

  const formattedParticipants = participants.map((p: any) => ({
    bookingId: itemId,
    memberId: typeof p === 'string' ? p : p.memberId,
    overrideShare: p.overrideShare ?? null,
    roomUnitId: p.roomUnitId ?? null,
  }));

  const item: CostItem = {
    id: itemId,
    tripId,
    vendorId: vendorId || null,
    title,
    category,
    totalAmount: Math.round(Number(totalAmount)),
    currency,
    startDatetime: startDatetime || now,
    endDatetime: endDatetime || now,
    status: 'confirmed',
    cancellationPolicy: cancellationPolicy || null,
    paidByMemberId: paidByMemberId || null,
    splitRule: {
      id: splitRule.id || `rule-${uuidv4().slice(0, 8)}`,
      type: splitRule.type,
      config: splitRule.config || null,
    },
    participants: formattedParticipants,
    createdAt: now,
    updatedAt: now,
  };

  db.insertCostItem(item);

  db.logAction({
    tripId,
    actorMemberId: String(actorMemberId),
    actionType: 'CREATE_COST_ITEM',
    entityType: 'cost_item',
    entityId: itemId,
    afterState: item,
    description: `Created cost item "${title}" (${(item.totalAmount / 100).toFixed(2)} ${currency}, split: ${item.splitRule.type})`,
  });

  res.status(201).json({ success: true, data: item });
};

export const updateCostItem = (req: Request, res: Response) => {
  const tripId = getParam(req.params.tripId);
  const itemId = getParam(req.params.itemId);
  const existing = db.getCostItemById(itemId);

  if (!existing || existing.tripId !== tripId) {
    return res.status(404).json({ success: false, error: 'Cost item not found' });
  }

  const before = { ...existing };
  const {
    title,
    category,
    totalAmount,
    vendorId,
    startDatetime,
    endDatetime,
    status,
    paidByMemberId,
    splitRule,
    participants,
    cancellationPolicy,
    actorMemberId = 'system',
  } = req.body;

  const patch: Partial<CostItem> = {};
  if (title !== undefined) patch.title = title;
  if (category !== undefined) patch.category = category;
  if (totalAmount !== undefined) patch.totalAmount = Math.round(Number(totalAmount));
  if (vendorId !== undefined) patch.vendorId = vendorId;
  if (startDatetime !== undefined) patch.startDatetime = startDatetime;
  if (endDatetime !== undefined) patch.endDatetime = endDatetime;
  if (status !== undefined) patch.status = status;
  if (paidByMemberId !== undefined) patch.paidByMemberId = paidByMemberId;
  if (cancellationPolicy !== undefined) patch.cancellationPolicy = cancellationPolicy;
  if (splitRule !== undefined) {
    patch.splitRule = {
      ...existing.splitRule,
      ...splitRule,
    };
  }
  if (participants !== undefined) {
    patch.participants = participants.map((p: any) => ({
      bookingId: itemId,
      memberId: typeof p === 'string' ? p : p.memberId,
      overrideShare: p.overrideShare ?? null,
      roomUnitId: p.roomUnitId ?? null,
    }));
  }

  const updated = db.updateCostItem(itemId, patch);

  db.logAction({
    tripId,
    actorMemberId: String(actorMemberId),
    actionType: 'UPDATE_COST_ITEM',
    entityType: 'cost_item',
    entityId: itemId,
    beforeState: before,
    afterState: updated,
    description: `Updated cost item "${updated?.title}"`,
  });

  res.json({ success: true, data: updated });
};

export const cancelCostItem = (req: Request, res: Response) => {
  const tripId = getParam(req.params.tripId);
  const itemId = getParam(req.params.itemId);
  const { actorMemberId = 'system', refundAmount = 0, reason = 'Cancelled by user' } = req.body;

  const existing = db.getCostItemById(itemId);
  if (!existing || existing.tripId !== tripId) {
    return res.status(404).json({ success: false, error: 'Cost item not found' });
  }

  const before = { ...existing };
  const updated = db.updateCostItem(itemId, { status: 'cancelled' });

  let refundPayment: Payment | null = null;
  if (refundAmount > 0) {
    refundPayment = {
      id: `pay-refund-${uuidv4().slice(0, 8)}`,
      tripId,
      fromMemberId: existing.paidByMemberId || 'system',
      toPool: true,
      amount: Math.round(Number(refundAmount)),
      currency: existing.currency,
      method: 'bank_transfer',
      appliesToCostItemId: itemId,
      status: 'confirmed',
      notes: `Vendor refund for cancelled booking "${existing.title}": ${reason}`,
      createdAt: new Date().toISOString(),
    };
    db.insertPayment(refundPayment);
  }

  db.logAction({
    tripId,
    actorMemberId: String(actorMemberId),
    actionType: 'CANCEL_COST_ITEM',
    entityType: 'cost_item',
    entityId: itemId,
    beforeState: before,
    afterState: updated,
    description: `Cancelled booking "${existing.title}". ${
      refundAmount > 0 ? `Refund recorded: ${(refundAmount / 100).toFixed(2)} ${existing.currency}.` : 'No refund issued.'
    } Reason: ${reason}`,
  });

  res.json({
    success: true,
    data: {
      costItem: updated,
      refundPayment,
    },
  });
};
