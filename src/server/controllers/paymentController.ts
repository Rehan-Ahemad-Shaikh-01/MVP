import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Payment } from '../../core/types.js';
import { db } from '../db/store.js';

const getParam = (param: string | string[] | undefined): string => {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
};

export const getPayments = (req: Request, res: Response) => {
  const tripId = getParam(req.params.tripId);
  const payments = db.getPayments(tripId);
  res.json({ success: true, data: payments });
};

export const recordPayment = (req: Request, res: Response) => {
  const tripId = getParam(req.params.tripId);
  const {
    fromMemberId,
    toPool,
    toVendorId,
    toMemberId,
    amount,
    currency = 'INR',
    method = 'upi',
    appliesToCostItemId,
    notes,
    actorMemberId = fromMemberId,
  } = req.body;

  if (!fromMemberId || amount === undefined || amount <= 0) {
    return res.status(400).json({ success: false, error: 'fromMemberId and positive amount are required' });
  }

  const trip = db.getTripById(tripId);
  if (!trip) {
    return res.status(404).json({ success: false, error: 'Trip not found' });
  }

  const fromMember = db.getMemberById(fromMemberId);
  const paymentId = `pay-${uuidv4().slice(0, 8)}`;
  const now = new Date().toISOString();

  const payment: Payment = {
    id: paymentId,
    tripId,
    fromMemberId,
    toPool: !!toPool,
    toVendorId: toVendorId || null,
    toMemberId: toMemberId || null,
    amount: Math.round(Number(amount)),
    currency,
    method,
    appliesToCostItemId: appliesToCostItemId || null,
    status: 'confirmed',
    notes: notes || null,
    createdAt: now,
  };

  db.insertPayment(payment);

  const formattedAmount = `${(payment.amount / 100).toFixed(2)} ${currency}`;
  const targetDesc = toPool
    ? 'Trip Pool'
    : toMemberId
    ? `Member ${db.getMemberById(toMemberId)?.displayName || toMemberId}`
    : toVendorId
    ? `Vendor`
    : 'Trip';

  db.logAction({
    tripId,
    actorMemberId: String(actorMemberId),
    actorName: fromMember?.displayName,
    actionType: 'RECORD_PAYMENT',
    entityType: 'payment',
    entityId: paymentId,
    afterState: payment,
    description: `Recorded payment of ${formattedAmount} via ${method.toUpperCase()} from ${
      fromMember?.displayName || fromMemberId
    } to ${targetDesc}`,
  });

  res.status(201).json({ success: true, data: payment });
};
