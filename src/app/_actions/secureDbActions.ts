'use server';

import { cookies } from 'next/headers';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';
import { authenticator } from 'otplib';
import { Staff, StockItem, Outlet, ConversionRecipe, DoughBatch } from '@/lib/types';
import nodemailer from 'nodemailer';

async function getAdminUid() {
  const session = cookies().get('__session')?.value || cookies().get('session')?.value;
  if (!session) throw new Error("Unauthorized: No session");
  
  const authInstance = adminAuth;
  const dbInstance = adminDb;
  if (!authInstance || !dbInstance) {
    throw new Error("Firebase Admin not configured");
  }
  
  const decodedToken = await authInstance.verifySessionCookie(session, true);
  let role = decodedToken.role;

  if (!role && decodedToken.email) {
    const configDoc = await dbInstance.collection('config').doc('initialized').get();
    if (configDoc.exists && configDoc.data()?.owner_email?.toLowerCase() === decodedToken.email.toLowerCase()) {
      role = 'owner';
    }
  }

  if (role !== 'admin' && role !== 'owner' && role !== 'manager') {
    throw new Error("Forbidden: Insufficient privileges");
  }
  return decodedToken.uid;
}

async function verifyTOTP(uid: string, totpCode: string) {
  if (!adminDb) throw new Error("Firebase Admin DB not configured");
  
  const secretDoc = await adminDb.collection('admin_secrets').doc(uid).get();
  if (!secretDoc.exists) {
    throw new Error("2FA setup required. Please re-login.");
  }

  if (totpCode === 'SESSION_BYPASS') {
    const sessionDoc = await adminDb.collection('admin_sessions').doc(uid).get();
    if (sessionDoc.exists) {
      const { last_totp_at } = sessionDoc.data()!;
      if (Date.now() - last_totp_at < 20 * 60 * 1000) {
        return; // Valid session bypass
      }
    }
    throw new Error("2FA session expired. Please enter OTP again.");
  }

  const { secret } = secretDoc.data()!;
  const isValid = authenticator.verify({ token: totpCode, secret });

  if (!isValid) {
    throw new Error("Invalid authenticator code.");
  }

  // Update session on successful verification for bypass
  await adminDb.collection('admin_sessions').doc(uid).set({
    last_totp_at: Date.now()
  });
}

// --- STAFF ACTIONS ---
export async function secureSaveStaff(staff: Staff, totpCode: string, password?: string) {
  const authInstance = adminAuth;
  const dbInstance = adminDb;
  if (!authInstance || !dbInstance) throw new Error("Firebase Admin not configured");

  const uid = await getAdminUid();
  await verifyTOTP(uid, totpCode);

  if (password && staff.email) {
    try {
      await authInstance.createUser({
        uid: staff.id,
        email: staff.email,
        password: password,
        displayName: staff.name
      });
      await authInstance.setCustomUserClaims(staff.id, {
        role: staff.role,
        outlet: staff.outlet
      });
    } catch (e: any) {
      if (e.code === 'auth/email-already-exists') {
        // Fallback: update claims if user already exists
        const userRec = await authInstance.getUserByEmail(staff.email);
        await authInstance.updateUser(userRec.uid, { password: password }); // Reset their password to the new one
        await authInstance.setCustomUserClaims(userRec.uid, {
          role: staff.role,
          outlet: staff.outlet
        });
        staff.id = userRec.uid;
      } else {
        throw e;
      }
    }
  }

  await dbInstance.collection('staff').doc(staff.id).set(staff);
  return { success: true };
}

export async function secureEditStaff(staff: Staff, totpCode: string) {
  const authInstance = adminAuth;
  const dbInstance = adminDb;
  if (!authInstance || !dbInstance) throw new Error("Firebase Admin not configured");

  const uid = await getAdminUid();
  await verifyTOTP(uid, totpCode);

  if (staff.email) {
    try {
      // Use the email to find the auth record, or the ID directly if it matches the UID
      // In our system, staff.id IS the Firebase Auth UID.
      await authInstance.updateUser(staff.id, { displayName: staff.name });
      await authInstance.setCustomUserClaims(staff.id, {
        role: staff.role,
        outlet: staff.outlet
      });
    } catch(e) {
      console.error("Auth user not found or update failed", e);
    }
  }

  await dbInstance.collection('staff').doc(staff.id).set(staff);
  return { success: true };
}

export async function secureDeleteStaff(id: string, totpCode: string) {
  const uid = await getAdminUid();
  await verifyTOTP(uid, totpCode);

  await adminDb!.collection('staff').doc(id).delete();
  return { success: true };
}

export async function secureUpdateStaffPassword(staffId: string, newPassword: string, totpCode: string) {
  const authInstance = adminAuth;
  if (!authInstance) throw new Error("Firebase Admin not configured");

  const uid = await getAdminUid();
  await verifyTOTP(uid, totpCode);

  await authInstance.updateUser(staffId, { password: newPassword });
  
  return { success: true };
}

export async function secureUpdateStaffSchedule(staffId: string, schedule: any[], totpCode: string) {
  const uid = await getAdminUid();
  await verifyTOTP(uid, totpCode);

  if (!adminDb) throw new Error("Firebase Admin DB not configured");

  await adminDb.collection('staff').doc(staffId).update({
    schedule: schedule
  });

  return { success: true };
}

// --- INVENTORY ACTIONS ---
export async function secureSaveStockItem(stockItem: StockItem, totpCode: string) {
  const uid = await getAdminUid();
  await verifyTOTP(uid, totpCode);

  await adminDb!.collection('stocks').doc(stockItem.stock_id).set(stockItem);
  return { success: true };
}

export async function secureSaveBulkStockItems(stockItems: StockItem[], totpCode: string) {
  const uid = await getAdminUid();
  await verifyTOTP(uid, totpCode);

  if (!adminDb) throw new Error("Firebase Admin DB not configured");

  const batch = adminDb.batch();
  for (const item of stockItems) {
    const docRef = adminDb.collection('stocks').doc(item.stock_id);
    batch.set(docRef, item);
  }
  await batch.commit();
  return { success: true };
}

export async function secureDeleteStockItem(stockId: string, totpCode: string) {
  const uid = await getAdminUid();
  await verifyTOTP(uid, totpCode);

  if (!adminDb) throw new Error("Firebase Admin DB not configured");
  await adminDb.collection('stocks').doc(stockId).delete();
  return { success: true };
}

// --- OUTLET ACTIONS ---
export async function secureSaveOutlet(outlet: Outlet, totpCode: string) {
  const session = cookies().get('__session')?.value || cookies().get('session')?.value;
  if (!session) throw new Error("Unauthorized: No session");
  if (!adminAuth) throw new Error("Firebase Admin not configured");
  
  const decodedToken = await adminAuth.verifySessionCookie(session, true);
  let role = decodedToken.role;
  let assignedOutlet = decodedToken.outlet;

  // Auto-heal missing claims (e.g. for the owner)
  if (!role && decodedToken.email) {
    const configDoc = await adminDb!.collection('config').doc('initialized').get();
    if (configDoc.exists && configDoc.data()?.owner_email?.toLowerCase() === decodedToken.email.toLowerCase()) {
      role = 'owner';
    } else {
      const staffDocs = await adminDb!.collection('staff').where('email', '==', decodedToken.email).get();
      if (!staffDocs.empty) {
        role = staffDocs.docs[0].data().role;
        assignedOutlet = staffDocs.docs[0].data().outlet;
      }
    }
  }

  if (role !== 'admin' && role !== 'owner') {
    if (role === 'manager') {
      if (assignedOutlet !== outlet.name) {
        throw new Error("Forbidden: Managers can only edit their assigned outlet");
      }
    } else {
      throw new Error("Forbidden: Insufficient privileges");
    }
  }

  await verifyTOTP(decodedToken.uid, totpCode);

  await adminDb!.collection('outlets').doc(outlet.id).set(outlet);
  return { success: true };
}

export async function secureDeleteOutlet(id: string, totpCode: string) {
  const uid = await getAdminUid();
  await verifyTOTP(uid, totpCode);

  await adminDb!.collection('outlets').doc(id).delete();
  return { success: true };
}

// --- BATCH CONVERSION & DOUGH BATCH SYSTEM ACTIONS ---

async function verifyStaffSession() {
  const session = cookies().get('__session')?.value || cookies().get('session')?.value;
  if (!session) throw new Error("Unauthorized: No session cookie");
  if (!adminAuth) throw new Error("Firebase Admin Auth not configured");

  const decodedToken = await adminAuth.verifySessionCookie(session, true);
  return decodedToken;
}

export async function secureSaveConversionRecipe(recipe: ConversionRecipe, totpCode: string) {
  const uid = await getAdminUid();
  await verifyTOTP(uid, totpCode);

  if (!adminDb) throw new Error("Firebase Admin DB not configured");

  await adminDb.collection('conversion_recipes').doc(recipe.stock_id).set(recipe);
  return { success: true };
}

export async function secureStartDoughBatch(stockId: string, rawQtyUsed: number, outletId: string) {
  const dbInstance = adminDb;
  if (!dbInstance) throw new Error("Firebase Admin DB not configured");

  const decodedToken = await verifyStaffSession();

  await dbInstance.runTransaction(async (transaction) => {
    // 1. One Active Batch Rule
    const batchesCol = dbInstance.collection('dough_batches');
    const activeQuery = batchesCol
      .where('outlet_id', '==', outletId)
      .where('stock_id', '==', stockId)
      .where('batch_status', '==', 'active');
    
    const activeSnap = await transaction.get(activeQuery);
    if (!activeSnap.empty) {
      throw new Error("One Active Batch Rule: An active batch is already in progress. Close the active batch before starting a new one.");
    }

    // 2. Fetch stock item and verify stock levels
    const stockRef = dbInstance.collection('stocks').doc(stockId);
    const stockSnap = await transaction.get(stockRef);
    if (!stockSnap.exists) throw new Error("Stock item not found.");
    
    const stockData = stockSnap.data() as StockItem;
    if (stockData.current_quantity < rawQtyUsed) {
      throw new Error(`Insufficient stock: Only ${stockData.current_quantity} ${stockData.unit} left.`);
    }

    // 3. Get expected yield range
    const recipeRef = dbInstance.collection('conversion_recipes').doc(stockId);
    const recipeSnap = await transaction.get(recipeRef);
    if (!recipeSnap.exists) throw new Error("No conversion yield recipe is set for this ingredient.");
    const recipeData = recipeSnap.data() as ConversionRecipe;

    const expectedMin = rawQtyUsed * recipeData.yield_min_per_unit;
    const expectedMax = rawQtyUsed * recipeData.yield_max_per_unit;

    // 4. Decrement raw stock quantity immediately
    const newQty = Math.max(0, stockData.current_quantity - rawQtyUsed);
    transaction.update(stockRef, {
      current_quantity: newQty,
      last_updated: Date.now()
    });

    // 5. Create new active batch document
    const batchId = `bt_${Date.now()}`;
    const batchRef = batchesCol.doc(batchId);
    const newBatch: DoughBatch = {
      batch_id: batchId,
      outlet_id: outletId,
      stock_id: stockId,
      raw_qty_used: rawQtyUsed,
      expected_min: expectedMin,
      expected_max: expectedMax,
      batch_start_time: Date.now(),
      batch_status: 'active',
      manager_uid: decodedToken.uid,
      created_at: Date.now()
    };

    transaction.set(batchRef, newBatch);
  });

  return { success: true };
}

export async function secureCompleteDoughBatch(batchId: string) {
  const dbInstance = adminDb;
  if (!dbInstance) throw new Error("Firebase Admin DB not configured");

  const decodedToken = await verifyStaffSession();

  // Run the transaction to fetch data, count sales, and update batch
  const result = await dbInstance.runTransaction(async (transaction) => {
    const batchRef = dbInstance.collection('dough_batches').doc(batchId);
    const batchSnap = await transaction.get(batchRef);
    if (!batchSnap.exists) throw new Error("Batch not found.");

    const batchData = batchSnap.data() as DoughBatch;
    if (batchData.batch_status !== 'active') {
      throw new Error("This batch has already been completed.");
    }

    // 1. Fetch recipe
    const recipeRef = dbInstance.collection('conversion_recipes').doc(batchData.stock_id);
    const recipeSnap = await transaction.get(recipeRef);
    if (!recipeSnap.exists) throw new Error("Conversion recipe not set for this dough.");
    const recipeData = recipeSnap.data() as ConversionRecipe;
    const linkedMenuItemId = recipeData.linked_menu_item_id;

    // 2. Fetch outlet
    const outletRef = dbInstance.collection('outlets').doc(batchData.outlet_id);
    const outletSnap = await transaction.get(outletRef);
    if (!outletSnap.exists) throw new Error("Outlet not found.");
    const outletName = outletSnap.data()!.name;

    // 3. Fetch sales from orders
    const ordersSnap = await transaction.get(
      dbInstance.collection('orders')
        .where('created_at', '>=', batchData.batch_start_time)
    );

    let wafflesSold = 0;
    ordersSnap.forEach((doc) => {
      const order = doc.data();
      // Count order as a sale if accepted, preparing, ready, out_for_delivery, or delivered
      if (!['accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered'].includes(order.status)) return;
      
      const orderOutlet = order.outlet || order.hatch;
      if (orderOutlet !== outletName) return;

      if (order.items) {
        order.items.forEach((item: any) => {
          if (item.menu_item_id === linkedMenuItemId) {
            wafflesSold += item.quantity || 0;
          }
        });
      }
    });

    const isInsideRange = wafflesSold >= batchData.expected_min && wafflesSold <= batchData.expected_max;
    const finalStatus = isInsideRange ? 'completed' : 'flagged';

    transaction.update(batchRef, {
      batch_status: finalStatus,
      batch_end_time: Date.now(),
      waffles_sold_auto: wafflesSold
    });

    return {
      flagged: !isInsideRange,
      wafflesSold,
      batchData,
      outletName,
      recipeData
    };
  });

  // If flagged, trigger owner alert email
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const targetEmail = process.env.OWNER_EMAIL;

  if (result.flagged && smtpUser && smtpPass && targetEmail) {
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: smtpUser, pass: smtpPass },
      });

      let managerName = 'Staff';
      try {
        const staffDoc = await dbInstance.collection('staff').doc(result.batchData.manager_uid).get();
        if (staffDoc.exists) managerName = staffDoc.data()!.name;
      } catch (e) {}

      await transporter.sendMail({
        from: `"Hau Hau Cafe Audit Monitor" <${smtpUser}>`,
        to: targetEmail,
        subject: `🚨 Dough Yield Discrepancy Alert @ ${result.outletName}`,
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #ef4444; background-color: #060403; border-radius: 16px; color: #f7dec4; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <div style="text-align: center; margin-bottom: 20px;">
              <span style="font-size: 40px;">🚨</span>
              <h2 style="color: #ef4444; font-family: serif; font-style: italic; margin-top: 10px; font-size: 24px;">Yield Discrepancy Audited</h2>
            </div>
            <p style="font-size: 14px; line-height: 1.5; color: #d4c4b0; text-align: center;">
              A finished dough batch has registered a sales count outside the owner-configured expected range.
            </p>
            <div style="background-color: #120a06; border: 1px solid #302117; border-radius: 12px; padding: 20px; margin: 25px 0;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #f8bc51; font-weight: bold;">📍 Location: ${result.outletName}</p>
              <p style="margin: 0 0 12px 0; font-size: 13px; color: #d4c4b0;">🧑‍💼 Manager in Charge: ${managerName}</p>
              <table style="width: 100%; border-collapse: collapse; margin-top: 10px; border-top: 1px dashed #302117; padding-top: 10px;">
                <tr>
                  <td style="padding: 8px 0; font-size: 13px; color: #d4c4b0;">Dough Quantity Used:</td>
                  <td style="padding: 8px 0; font-size: 14px; color: #ffffff; font-weight: bold; text-align: right;">${result.batchData.raw_qty_used} kg</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 13px; color: #d4c4b0;">Expected Sales Range:</td>
                  <td style="padding: 8px 0; font-size: 14px; color: #ffffff; font-weight: bold; text-align: right;">${result.batchData.expected_min} - ${result.batchData.expected_max} waffles</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 13px; color: #d4c4b0;">Actual Sales Counted:</td>
                  <td style="padding: 8px 0; font-size: 16px; color: #ef4444; font-weight: bold; text-align: right;">${result.wafflesSold} waffles</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-size: 13px; color: #d4c4b0;">Batch Window:</td>
                  <td style="padding: 8px 0; font-size: 12px; color: #d4c4b0; text-align: right;">
                    ${new Date(result.batchData.batch_start_time).toLocaleTimeString()} - ${new Date().toLocaleTimeString()}
                  </td>
                </tr>
              </table>
            </div>
            <p style="font-size: 11px; text-align: center; color: #d4c4b0; opacity: 0.5; margin: 0;">
              This audit report was automatically triggered by the POS Batch Audit.
            </p>
          </div>
        `
      });
      console.log(`🚨 Telemetry Flag Email successfully sent to ${targetEmail}`);
    } catch (e) {
      console.warn("Telemetry Flag Email delivery failed: ", e);
    }
  }

  return { success: true, flagged: result.flagged, wafflesSold: result.wafflesSold };
}

