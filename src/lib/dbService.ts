// Barrel file to maintain compatibility
export {
  createUserProfile,
  getUserProfile,
  getUserProfileByPhone,
  updateUserProfile,
  issueStressCoupon
} from './../features/users/userService';
export {
  streamUserOrders,
  getUserOrders,
  updateOrderStatus,
  deductIngredientsForOrder,
  refundPayment,
  bulkDispatchOrders,
  markOrderAsDelivered
} from './../features/orders/orderService';
export {
  streamUIConfig,
  saveUIConfig,
  streamCalendarEvents,
  saveCalendarEvent,
  deleteCalendarEvent,
  streamSliderItems,
  saveSliderItem,
  deleteSliderItem
} from './../features/config/configService';
export {
  fetchMenuItems,
  deleteMenuItem,
  saveMenuItem
} from './../features/menu/menuService';
export {
  fetchStocks,
  fetchStockMovements,
  addWastageRecord,
  fetchWastageList,
  saveStockItem,
  deleteStockItem,
  fetchConversionRecipes,
  streamActiveBatches,
  streamBatchLogs,
  streamAllBatches
} from './../features/inventory/stockService';
export {
  fetchOffers,
  deleteOffer,
  saveOffer
} from './../features/offers/offerService';
export {
  fetchStaffList,
  logAttendance,
  clockOutAttendance,
  fetchAttendanceLogs,
  addShiftRecord,
  fetchShiftsForDate,
  saveStaff,
  deleteStaff
} from './../features/staff/staffService';
export {
  fetchOutlets,
  getOutletCoordinates
} from './../features/outlets/outletService';
export {
  calculateHistoricalUsage,
  streamTelemetryData,
  createCashRegisterSession,
  closeCashRegisterSession,
  fetchCashRegisterSessions,
  addExpenseRecord,
  fetchExpensesList
} from './../features/telemetry/telemetryService';
export {
  fetchReviewsList,
  fetchComplaintsList,
  resolveComplaintTicket,
  logSecurityAlert,
  submitOrderFeedback,
  streamApprovals,
  updateApprovalStatus,
  submitApprovalRequest
} from './../features/crm/crmService';
