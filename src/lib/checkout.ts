import { db } from './firebase';
import { doc, getDoc, collection, query, where, getDocs, writeBatch, limit } from 'firebase/firestore';
import { 
  KICKBACK_TIERS, 
  REFERRER_KICKBACK_PERCENTAGE, 
  REFERRAL_MILESTONES, 
  POINT_LEDGER_EXPIRY_DAYS 
} from './constants';

export async function apply_wallet_points(user_id: string, order_total: number, points_to_use: number) {
  // 1. Calculate 20% cap limit
  const maxAllowedPoints = Math.floor(order_total * 0.20);
  
  // 3. Restrict point usage if breached
  if (points_to_use > maxAllowedPoints) {
    throw new Error(`You can only use up to 20% of your order total (${maxAllowedPoints} points).`);
  }

  // 2. Validate active unexpired point balance from Firestore ledger
  let activePoints: { id: string; amount: number; expires_at: string; ref: any }[] = [];
  try {
    const q = query(
      collection(db, 'point_ledger'),
      where('user_id', '==', user_id),
      limit(50)
    );
    const snap = await getDocs(q);
    const now = new Date().toISOString();
    snap.forEach(docSnap => {
      const d = docSnap.data();
      if (d.amount > 0 && d.expires_at > now && !d.is_expired) {
        activePoints.push({
          id: docSnap.id,
          amount: d.amount,
          expires_at: d.expires_at,
          ref: docSnap.ref
        });
      }
    });
    // Sort ascending (FIFO) by expires_at
    activePoints.sort((a, b) => a.expires_at.localeCompare(b.expires_at));
  } catch (e) {
    throw new Error("Failed to validate point ledger");
  }

  const totalAvailable = activePoints.reduce((sum, entry) => sum + entry.amount, 0);

  if (points_to_use > totalAvailable) {
    throw new Error("Insufficient active points.");
  }

  // Instantiate atomic Firestore batch
  const batch = writeBatch(db);

  // 4. Deduct points from ledger (FIFO)
  if (points_to_use > 0) {
    let remainingToDeduct = points_to_use;
    
    for (const entry of activePoints) {
      if (remainingToDeduct <= 0) break;

      const deductAmount = Math.min(entry.amount, remainingToDeduct);
      const newBalance = entry.amount - deductAmount;

      // Update ledger document in batch
      batch.update(entry.ref, { amount: newBalance });

      remainingToDeduct -= deductAmount;
    }

    // Record the negative transaction in Firestore in batch
    const negativeLedgerRef = doc(collection(db, 'point_ledger'));
    batch.set(negativeLedgerRef, {
      user_id,
      amount: -points_to_use,
      original_amount: -points_to_use,
      source: 'order',
      is_expired: false,
      created_at: Date.now()
    });
  }

  // 5. Check total user order history for kickbacks
  const userRef = doc(db, 'users', user_id);
  const userSnap = await getDoc(userRef);
  
  if (userSnap.exists()) {
    const userData = userSnap.data();
    let totalOrders = (userData.total_completed_orders || 0) + 1; // including this one
    
    // Increment total completed orders in batch
    batch.update(userRef, {
      total_completed_orders: totalOrders
    });

    // Calculate new kickback points
    let kickbackPercentage = KICKBACK_TIERS.LIFETIME.percentage;
    let referrerKickback = 0;

    if (totalOrders <= KICKBACK_TIERS.TIER_1.maxOrders) {
      kickbackPercentage = KICKBACK_TIERS.TIER_1.percentage;
      
      // Check if they were referred and give referrer reward
      if (userData.referred_by) {
        referrerKickback = REFERRER_KICKBACK_PERCENTAGE;
        
        const q = query(collection(db, 'users'), where('referral_code', '==', userData.referred_by));
        const qSnap = await getDocs(q);
        
        if (!qSnap.empty) {
          const referrerDoc = qSnap.docs[0];
          const referrerId = referrerDoc.id;
          const referrerData = referrerDoc.data();
          
          // Grant kickback to referrer in batch
          const referrerEarned = Math.floor(order_total * referrerKickback);
          if (referrerEarned > 0) {
            const exp = new Date();
            exp.setDate(exp.getDate() + POINT_LEDGER_EXPIRY_DAYS);
            
            const referrerLedgerRef = doc(collection(db, 'point_ledger'));
            batch.set(referrerLedgerRef, {
              user_id: referrerId,
              amount: referrerEarned,
              original_amount: referrerEarned,
              source: 'referral',
              expires_at: exp.toISOString(),
              is_expired: false,
              created_at: Date.now()
            });
          }

          // If this is the NEW user's VERY FIRST order, trigger Gamified Voucher Milestones
          if (totalOrders === 1) {
            const newCount = (referrerData.successful_referrals || 0) + 1;
            batch.update(referrerDoc.ref, { successful_referrals: newCount });
            
            const itemTypeToUnlock = REFERRAL_MILESTONES[newCount];
            if (itemTypeToUnlock) {
              const voucherRef = doc(collection(db, 'vouchers'));
              batch.set(voucherRef, {
                user_id: referrerId,
                item_type: itemTypeToUnlock,
                created_at: Date.now()
              });
            }
          }
        }
      }
    } else if (totalOrders <= KICKBACK_TIERS.TIER_2.maxOrders) {
      kickbackPercentage = KICKBACK_TIERS.TIER_2.percentage;
    }

    const pointsEarned = Math.floor(order_total * kickbackPercentage);

    // Grant new points with strict 45-day expiration in batch
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + POINT_LEDGER_EXPIRY_DAYS);

    const earnedLedgerRef = doc(collection(db, 'point_ledger'));
    batch.set(earnedLedgerRef, {
      user_id,
      amount: pointsEarned,
      original_amount: pointsEarned,
      source: 'order',
      expires_at: expiresAt.toISOString(),
      is_expired: false,
      created_at: Date.now()
    });
  }

  // Commit all writes atomically in a single batch
  await batch.commit();

  return { success: true, pointsUsed: points_to_use };
}
