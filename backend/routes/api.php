<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\ConsentController;
use App\Http\Controllers\Api\BranchController;
use App\Http\Controllers\Api\CourtController;
use App\Http\Controllers\Api\MembershipController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PackageController;
use App\Http\Controllers\Api\PromotionController;
use App\Http\Controllers\Api\RentalController;
use App\Http\Controllers\Api\ReviewController;
use App\Http\Controllers\Api\WalletController;
use App\Http\Controllers\Api\Admin\AnnouncementController as AdminAnnouncementController;
use App\Http\Controllers\Api\Admin\AuditLogController as AdminAuditLogController;
use App\Http\Controllers\Api\Admin\BackupController as AdminBackupController;
use App\Http\Controllers\Api\Admin\DashboardController as AdminDashboardController;
use App\Http\Controllers\Api\Admin\FeatureController as AdminFeatureController;
use App\Http\Controllers\Api\Admin\InvoiceController as AdminInvoiceController;
use App\Http\Controllers\Api\Admin\OrganizationController as AdminOrganizationController;
use App\Http\Controllers\Api\Admin\PaymentController as AdminPaymentController;
use App\Http\Controllers\Api\Admin\PlanController as AdminPlanController;
use App\Http\Controllers\Api\Admin\RoleController as AdminRoleController;
use App\Http\Controllers\Api\Admin\SettingController as AdminSettingController;
use App\Http\Controllers\Api\Admin\SubscriptionController as AdminSubscriptionController;
use App\Http\Controllers\Api\Admin\SupportTicketController as AdminSupportTicketController;
use App\Http\Controllers\Api\Admin\TransactionController as AdminTransactionController;
use App\Http\Controllers\Api\Admin\UserController as AdminUserController;
use App\Http\Controllers\Api\Owner\BookingController as OwnerBookingController;
use App\Http\Controllers\Api\Owner\BranchController as OwnerBranchController;
use App\Http\Controllers\Api\Owner\AnnouncementController as OwnerAnnouncementController;
use App\Http\Controllers\Api\Owner\BillingController as OwnerBillingController;
use App\Http\Controllers\Api\Owner\BroadcastController as OwnerBroadcastController;
use App\Http\Controllers\Api\Owner\CheckinController as OwnerCheckinController;
use App\Http\Controllers\Api\Owner\CourtBlockController as OwnerCourtBlockController;
use App\Http\Controllers\Api\Owner\ReportController as OwnerReportController;
use App\Http\Controllers\Api\Owner\CourtController as OwnerCourtController;
use App\Http\Controllers\Api\Owner\CrmController as OwnerCrmController;
use App\Http\Controllers\Api\Owner\CustomerController as OwnerCustomerController;
use App\Http\Controllers\Api\Owner\DashboardController as OwnerDashboardController;
use App\Http\Controllers\Api\Owner\MembershipController as OwnerMembershipController;
use App\Http\Controllers\Api\Owner\PackagePurchaseController as OwnerPackagePurchaseController;
use App\Http\Controllers\Api\Owner\SegmentController as OwnerSegmentController;
use App\Http\Controllers\Api\Owner\TimelineController as OwnerTimelineController;
use App\Http\Controllers\Api\Owner\PaymentController as OwnerPaymentController;
use App\Http\Controllers\Api\Owner\ProductController as OwnerProductController;
use App\Http\Controllers\Api\Owner\PromotionController as OwnerPromotionController;
use App\Http\Controllers\Api\Owner\RentalItemController as OwnerRentalItemController;
use App\Http\Controllers\Api\Owner\SaleController as OwnerSaleController;
use App\Http\Controllers\Api\Owner\WelcomeBannerController as OwnerWelcomeBannerController;
use App\Http\Controllers\Api\Owner\SettingController as OwnerSettingController;
use App\Http\Controllers\Api\Owner\StaffController as OwnerStaffController;
use App\Http\Controllers\Api\Owner\SubscriptionController as OwnerSubscriptionController;
use App\Http\Controllers\Api\Owner\UploadController as OwnerUploadController;
use App\Http\Controllers\Api\Owner\WalletController as OwnerWalletController;
use App\Http\Controllers\Api\OrganizationPublicController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\RefundController;
use App\Http\Controllers\Api\Owner\RefundController as OwnerRefundController;
use App\Http\Controllers\Api\Admin\RefundController as AdminRefundController;
use Illuminate\Support\Facades\Route;

// All routes here are mounted under the /api/v1 prefix (bootstrap/app.php).

// --- Public auth ---
Route::post('/auth/line/login', [AuthController::class, 'lineLogin']);
// Rate limiting for admin login lives inside the controller (keyed by
// email+IP, counting only FAILED attempts) rather than route `throttle`
// middleware: the middleware resolves $request->user() to key the limiter,
// which re-caches a leftover bearer identity on the guard and breaks the
// multi-actor test flow. See AuthController::adminLogin.
Route::post('/auth/admin/login', [AuthController::class, 'adminLogin']);
// Per-venue LINE LIFF id for the frontend (resolved from ?venueId / ?organizationSlug / default org).
Route::get('/line-config', [AuthController::class, 'lineConfig']);
// Public per-venue branding for the multi-tenant login page (/v/{slug}).
Route::get('/orgs/{slug}/public', [OrganizationPublicController::class, 'show']);

// --- Public venue/court browsing (customer-facing reads) ---
Route::get('/branches', [BranchController::class, 'index']);
Route::get('/branches/{id}', [BranchController::class, 'show']);
Route::get('/branches/{id}/courts', [CourtController::class, 'index']);

Route::get('/courts', [CourtController::class, 'index']);
Route::get('/courts/{id}', [CourtController::class, 'show']);
Route::get('/courts/{id}/schedules', [CourtController::class, 'schedules']);

// --- Public catalogue reads (org resolved from authed customer / ?venueId / default) ---
Route::get('/reviews', [ReviewController::class, 'index']);
Route::get('/packages', [PackageController::class, 'index']);
Route::get('/promotions', [PromotionController::class, 'index']);
// What a customer can rent for the slot they are about to book. Availability
// only means something for a specific window, so date+start+end are required.
Route::get('/rentals', [RentalController::class, 'index']);

// --- Protected ---
Route::middleware('auth:sanctum')->group(function () {
    // --- Marketing consent / opt-out (PDPA). Always the authed customer. ---
    Route::get('/me/consent', [ConsentController::class, 'show']);
    Route::post('/me/consent', [ConsentController::class, 'update']);
    Route::post('/me/unsubscribe', [ConsentController::class, 'unsubscribe']);
    Route::post('/me/resubscribe', [ConsentController::class, 'resubscribe']);

    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::put('/auth/me', [AuthController::class, 'updateMe']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    // --- Customer account (scoped to the authenticated Customer) ---
    Route::get('/membership', [MembershipController::class, 'show']);
    Route::get('/wallet', [WalletController::class, 'show']);
    Route::post('/wallet/topup', [WalletController::class, 'topup']);
    Route::post('/wallet/topup/{id}/slip', [WalletController::class, 'topupSlip']);
    Route::post('/reviews', [ReviewController::class, 'store']);

    // --- Packages: browse already public; purchase + redeem here ---
    Route::get('/my-packages', [PackageController::class, 'myPackages']);
    Route::post('/packages/{id}/purchase', [PackageController::class, 'purchase']);
    Route::post('/packages/purchases/{id}/slip', [PackageController::class, 'purchaseSlip']);
    Route::post('/bookings/{id}/pay-with-package', [BookingController::class, 'payWithPackage']);
    Route::get('/notifications', [NotificationController::class, 'index']);

    // --- Bookings (scoped to the authenticated Customer) ---
    Route::get('/bookings', [BookingController::class, 'index']);
    Route::post('/bookings', [BookingController::class, 'store']);
    Route::get('/bookings/{id}', [BookingController::class, 'show']);
    Route::post('/bookings/{id}/cancel', [BookingController::class, 'cancel']);
    // No customer-side check-in: marking your own booking as attended is not a
    // check-in. Staff scan the QR at the counter (owner/checkin below).

    // --- Refunds (customer-initiated request + own list) ---
    Route::post('/bookings/{id}/refund', [RefundController::class, 'store']);
    Route::get('/refunds', [RefundController::class, 'index']);

    // --- Payments ---
    Route::post('/payments', [PaymentController::class, 'store']);
    Route::get('/payments/{id}', [PaymentController::class, 'show']);
    Route::get('/payments/{id}/instructions', [PaymentController::class, 'instructions']);
    Route::post('/payments/{id}/upload-slip', [PaymentController::class, 'uploadSlip']);
    // No customer-side verify/reject. Approving your own slip is not a payment,
    // and these once sat here unscoped: any signed-in customer could confirm
    // their booking without transferring a baht, or reject a stranger's slip by
    // id. Staff approve at owner/payments, behind permission:payment.verify.

    // --- Owner Portal (staff/admin, org-scoped via owner.org middleware) ---
    // owner.subscribed locks the portal once the venue's plan lapses; the
    // billing routes below are exempt so an expired venue can still renew.
    Route::prefix('owner')->middleware(['owner.org', 'owner.subscribed'])->group(function () {
        // --- Billing / ต่ออายุ (reachable even when expired) ---
        Route::get('/billing', [OwnerBillingController::class, 'show']);
        Route::get('/billing/invoices', [OwnerBillingController::class, 'invoices']);
        Route::post('/billing/renew', [OwnerBillingController::class, 'renew']);
        Route::get('/billing/invoices/{id}/instructions', [OwnerBillingController::class, 'instructions']);
        Route::get('/billing/invoices/{id}/document', [OwnerBillingController::class, 'document']);
        Route::get('/billing/invoices/{id}/document.pdf', [OwnerBillingController::class, 'documentPdf']);
        Route::post('/billing/invoices/{id}/slip', [OwnerBillingController::class, 'uploadSlip']);

        Route::get('/dashboard', [OwnerDashboardController::class, 'index']);
        Route::get('/subscription', [OwnerSubscriptionController::class, 'show']);
        Route::get('/announcements', [OwnerAnnouncementController::class, 'index']);
        Route::get('/reports/bookings.csv', [OwnerReportController::class, 'exportBookings'])->middleware('permission:report.view');

        Route::get('/court-blocks', [OwnerCourtBlockController::class, 'index']);
        Route::post('/court-blocks', [OwnerCourtBlockController::class, 'store'])->middleware('permission:court.manage');
        Route::delete('/court-blocks/{id}', [OwnerCourtBlockController::class, 'destroy'])->middleware('permission:court.manage');

        Route::get('/bookings', [OwnerBookingController::class, 'index']);
        Route::post('/bookings', [OwnerBookingController::class, 'store'])->middleware('permission:booking.create');
        Route::get('/bookings/{id}', [OwnerBookingController::class, 'show']);
        Route::put('/bookings/{id}', [OwnerBookingController::class, 'update'])->middleware('permission:booking.create');
        Route::post('/bookings/{id}/cancel', [OwnerBookingController::class, 'cancel'])->middleware('permission:booking.cancel');
        Route::delete('/bookings/{id}', [OwnerBookingController::class, 'destroy'])->middleware('permission:booking.cancel');

        Route::get('/payments', [OwnerPaymentController::class, 'index']);
        Route::post('/payments/{id}/verify', [OwnerPaymentController::class, 'verify'])->middleware('permission:payment.verify');
        Route::post('/payments/{id}/reject', [OwnerPaymentController::class, 'reject'])->middleware('permission:payment.verify');

        // --- Refunds (review customer requests; approve credits the wallet) ---
        Route::get('/refunds', [OwnerRefundController::class, 'index']);
        Route::post('/refunds/{id}/approve', [OwnerRefundController::class, 'approve'])->middleware('permission:refund.manage');
        Route::post('/refunds/{id}/reject', [OwnerRefundController::class, 'reject'])->middleware('permission:refund.manage');

        // --- Rental equipment (rackets, shoes) ---
        Route::get('/rental-items', [OwnerRentalItemController::class, 'index'])->middleware('permission:pos.sell');
        Route::get('/rental-items/out', [OwnerRentalItemController::class, 'out'])->middleware('permission:pos.sell');
        Route::post('/rental-items', [OwnerRentalItemController::class, 'store'])->middleware('permission:rental.manage');
        Route::put('/rental-items/{id}', [OwnerRentalItemController::class, 'update'])->middleware('permission:rental.manage');
        Route::delete('/rental-items/{id}', [OwnerRentalItemController::class, 'destroy'])->middleware('permission:rental.manage');

        // --- POS: the counter's till and the things it sells ---
        Route::get('/products', [OwnerProductController::class, 'index'])->middleware('permission:pos.sell');
        Route::post('/products', [OwnerProductController::class, 'store'])->middleware('permission:product.manage');
        Route::put('/products/{id}', [OwnerProductController::class, 'update'])->middleware('permission:product.manage');
        Route::post('/products/{id}/stock', [OwnerProductController::class, 'adjustStock'])->middleware('permission:product.manage');
        Route::delete('/products/{id}', [OwnerProductController::class, 'destroy'])->middleware('permission:product.manage');

        // `summary` before `{id}` so the word is not read as an id.
        Route::get('/sales/summary', [OwnerSaleController::class, 'summary'])->middleware('permission:pos.sell');
        Route::get('/sales', [OwnerSaleController::class, 'index'])->middleware('permission:pos.sell');
        Route::post('/sales', [OwnerSaleController::class, 'store'])->middleware('permission:pos.sell');
        Route::get('/sales/{id}', [OwnerSaleController::class, 'show'])->middleware('permission:pos.sell');
        Route::get('/sales/{id}/promptpay', [OwnerSaleController::class, 'promptpay'])->middleware('permission:pos.sell');
        Route::post('/sales/{id}/void', [OwnerSaleController::class, 'void'])->middleware('permission:pos.void');

        // --- Image upload (venue cover / gallery / floor-plan) ---
        Route::post('/uploads', [OwnerUploadController::class, 'store']);

        // --- Branches (สนาม/สาขา) management CRUD ---
        Route::get('/branches', [OwnerBranchController::class, 'index']);
        Route::post('/branches', [OwnerBranchController::class, 'store'])->middleware('permission:court.manage');
        Route::put('/branches/{id}', [OwnerBranchController::class, 'update'])->middleware('permission:court.manage');
        Route::post('/branches/{id}/toggle', [OwnerBranchController::class, 'toggle'])->middleware('permission:court.manage');
        Route::delete('/branches/{id}', [OwnerBranchController::class, 'destroy'])->middleware('permission:court.manage');

        // --- Courts (คอร์ท) management CRUD ---
        Route::get('/courts', [OwnerCourtController::class, 'index']);
        Route::post('/courts', [OwnerCourtController::class, 'store'])->middleware('permission:court.manage');
        Route::put('/courts/{id}', [OwnerCourtController::class, 'update'])->middleware('permission:court.manage');
        Route::post('/courts/{id}/toggle', [OwnerCourtController::class, 'toggle'])->middleware('permission:court.manage');
        Route::delete('/courts/{id}', [OwnerCourtController::class, 'destroy'])->middleware('permission:court.manage');

        // --- QR check-in (the counter scans; the customer shows) ---
        Route::post('/checkin', [OwnerCheckinController::class, 'store'])->middleware('permission:booking.checkin');
        Route::get('/checkin/recent', [OwnerCheckinController::class, 'recent'])->middleware('permission:booking.checkin');

        Route::get('/customers', [OwnerCustomerController::class, 'index'])->middleware('permission:customer.view');
        Route::get('/customers/{id}', [OwnerCustomerController::class, 'show'])->middleware('permission:customer.view');

        // --- Settings (org settings + org name) ---
        Route::get('/settings', [OwnerSettingController::class, 'show']);
        Route::put('/settings', [OwnerSettingController::class, 'update'])->middleware('permission:settings.manage');

        // --- Promotions (management CRUD, org-scoped) ---
        Route::get('/promotions', [OwnerPromotionController::class, 'index']);
        Route::post('/promotions', [OwnerPromotionController::class, 'store'])->middleware('permission:promotion.manage');
        Route::put('/promotions/{id}', [OwnerPromotionController::class, 'update'])->middleware('permission:promotion.manage');
        Route::delete('/promotions/{id}', [OwnerPromotionController::class, 'destroy'])->middleware('permission:promotion.manage');

        // --- Welcome banners (ข้อความต้อนรับ) shown on the customer home ---
        // reorder is declared before /{id} so "reorder" is not read as an id.
        Route::get('/welcome-banners', [OwnerWelcomeBannerController::class, 'index']);
        Route::post('/welcome-banners', [OwnerWelcomeBannerController::class, 'store'])->middleware('permission:promotion.manage');
        Route::post('/welcome-banners/reorder', [OwnerWelcomeBannerController::class, 'reorder'])->middleware('permission:promotion.manage');
        Route::put('/welcome-banners/{id}', [OwnerWelcomeBannerController::class, 'update'])->middleware('permission:promotion.manage');
        Route::post('/welcome-banners/{id}/toggle', [OwnerWelcomeBannerController::class, 'toggle'])->middleware('permission:promotion.manage');
        Route::delete('/welcome-banners/{id}', [OwnerWelcomeBannerController::class, 'destroy'])->middleware('permission:promotion.manage');

        // --- Staff & roles (read + invite) ---
        Route::get('/staff', [OwnerStaffController::class, 'index']);
        Route::post('/staff', [OwnerStaffController::class, 'store'])->middleware('permission:staff.manage');
        Route::put('/staff/{userId}', [OwnerStaffController::class, 'update'])->middleware('permission:staff.manage');
        Route::delete('/staff/{userId}', [OwnerStaffController::class, 'destroy'])->middleware('permission:staff.manage');
        Route::get('/roles', [OwnerStaffController::class, 'roles']);

        // --- Memberships (read list + points adjust) ---
        Route::get('/memberships', [OwnerMembershipController::class, 'index'])->middleware('permission:crm.view');
        Route::post('/memberships/{id}/points', [OwnerMembershipController::class, 'adjustPoints'])->middleware('permission:crm.manage');

        // --- Wallets (read list + topup) ---
        Route::get('/wallets', [OwnerWalletController::class, 'index']);
        Route::post('/wallets/{id}/topup', [OwnerWalletController::class, 'topup']);
        Route::get('/wallet-topups', [OwnerWalletController::class, 'topupRequests']);
        Route::post('/wallet-topups/{id}/approve', [OwnerWalletController::class, 'approveTopup']);
        Route::post('/wallet-topups/{id}/reject', [OwnerWalletController::class, 'rejectTopup']);

        Route::get('/package-purchases', [OwnerPackagePurchaseController::class, 'index']);
        Route::post('/package-purchases/{id}/approve', [OwnerPackagePurchaseController::class, 'approve']);
        Route::post('/package-purchases/{id}/reject', [OwnerPackagePurchaseController::class, 'reject']);

        // --- CRM (overview + segments + timeline + broadcasts) ---
        Route::get('/crm/overview', [OwnerCrmController::class, 'overview'])->middleware('permission:crm.view');

        Route::get('/segments', [OwnerSegmentController::class, 'index'])->middleware('permission:crm.view');
        Route::post('/segments', [OwnerSegmentController::class, 'store'])->middleware('permission:segment.manage');
        Route::delete('/segments/{id}', [OwnerSegmentController::class, 'destroy'])->middleware('permission:segment.manage');

        Route::get('/timeline/{customerId}', [OwnerTimelineController::class, 'show'])->middleware('permission:crm.view');

        Route::get('/broadcasts', [OwnerBroadcastController::class, 'index'])->middleware('permission:crm.view');
        Route::get('/broadcasts/audience-preview', [OwnerBroadcastController::class, 'audiencePreview'])->middleware('permission:crm.view');
        Route::post('/broadcasts', [OwnerBroadcastController::class, 'store'])->middleware('permission:broadcast.send');
        Route::put('/broadcasts/{id}', [OwnerBroadcastController::class, 'update'])->middleware('permission:broadcast.send');
        Route::delete('/broadcasts/{id}', [OwnerBroadcastController::class, 'destroy'])->middleware('permission:broadcast.send');
        Route::post('/broadcasts/{id}/send', [OwnerBroadcastController::class, 'send'])->middleware('permission:broadcast.send');
    });

    // --- Super Admin / Platform (super.admin middleware, NOT org-scoped) ---
    Route::prefix('admin')->middleware('super.admin')->group(function () {
        Route::get('/dashboard', [AdminDashboardController::class, 'index']);

        Route::get('/organizations', [AdminOrganizationController::class, 'index']);
        Route::post('/organizations', [AdminOrganizationController::class, 'store']);
        Route::get('/organizations/{id}', [AdminOrganizationController::class, 'show']);
        Route::post('/organizations/{id}/suspend', [AdminOrganizationController::class, 'suspend']);
        Route::post('/organizations/{id}/activate', [AdminOrganizationController::class, 'activate']);
        Route::post('/organizations/{id}/impersonate', [AdminOrganizationController::class, 'impersonate']);
        Route::put('/organizations/{id}/plan', [AdminOrganizationController::class, 'changePlan']);
        Route::put('/organizations/{id}/settings', [AdminOrganizationController::class, 'updateSettings']);
        Route::delete('/organizations/{id}', [AdminOrganizationController::class, 'destroy']);

        Route::get('/subscriptions', [AdminSubscriptionController::class, 'index']);
        // Cancel = stop at the end of the paid period; suspend = end it now.
        Route::post('/subscriptions/{id}/cancel', [AdminSubscriptionController::class, 'cancel']);
        Route::post('/subscriptions/{id}/suspend', [AdminSubscriptionController::class, 'suspend']);
        Route::post('/subscriptions/{id}/resume', [AdminSubscriptionController::class, 'resume']);

        Route::get('/plans', [AdminPlanController::class, 'index']);
        Route::post('/plans', [AdminPlanController::class, 'store']);
        Route::put('/plans/{id}', [AdminPlanController::class, 'update']);
        Route::put('/plans/{id}/features', [AdminPlanController::class, 'updateFeatures']);

        Route::get('/features', [AdminFeatureController::class, 'index']);

        Route::get('/payments', [AdminPaymentController::class, 'index']);
        // --- Refunds (platform oversight across all orgs; approve/reject override) ---
        Route::get('/refunds', [AdminRefundController::class, 'index']);
        Route::post('/refunds/{id}/approve', [AdminRefundController::class, 'approve']);
        Route::post('/refunds/{id}/reject', [AdminRefundController::class, 'reject']);
        Route::get('/users', [AdminUserController::class, 'index']);
        Route::post('/users', [AdminUserController::class, 'store']);
        Route::put('/users/{id}', [AdminUserController::class, 'update']);
        Route::post('/users/{id}/suspend', [AdminUserController::class, 'suspend']);
        Route::post('/users/{id}/activate', [AdminUserController::class, 'activate']);
        Route::get('/roles', [AdminRoleController::class, 'index']);
        Route::get('/permissions', [AdminRoleController::class, 'permissions']);
        Route::put('/roles/{id}/permissions', [AdminRoleController::class, 'updatePermissions']);

        Route::get('/invoices', [AdminInvoiceController::class, 'index']);
        Route::post('/invoices', [AdminInvoiceController::class, 'store']);
        Route::get('/invoices/{id}/document', [AdminInvoiceController::class, 'document']);
        Route::get('/invoices/{id}/document.pdf', [AdminInvoiceController::class, 'documentPdf']);
        Route::post('/invoices/{id}/pay', [AdminInvoiceController::class, 'pay']);
        Route::post('/invoices/{id}/reject', [AdminInvoiceController::class, 'reject']);
        Route::post('/invoices/{id}/send', [AdminInvoiceController::class, 'send']);
        Route::get('/transactions', [AdminTransactionController::class, 'index']);
        Route::get('/support-tickets', [AdminSupportTicketController::class, 'index']);
        Route::get('/support-tickets/{id}', [AdminSupportTicketController::class, 'show']);
        Route::post('/support-tickets/{id}/replies', [AdminSupportTicketController::class, 'reply']);
        Route::put('/support-tickets/{id}/status', [AdminSupportTicketController::class, 'updateStatus']);
        Route::get('/announcements', [AdminAnnouncementController::class, 'index']);
        Route::post('/announcements', [AdminAnnouncementController::class, 'store']);
        Route::put('/announcements/{id}', [AdminAnnouncementController::class, 'update']);
        Route::post('/announcements/{id}/toggle', [AdminAnnouncementController::class, 'toggle']);
        Route::delete('/announcements/{id}', [AdminAnnouncementController::class, 'destroy']);
        Route::get('/audit-logs', [AdminAuditLogController::class, 'index']);
        Route::get('/settings', [AdminSettingController::class, 'show']);
        Route::put('/settings', [AdminSettingController::class, 'update']);

        Route::get('/backups', [AdminBackupController::class, 'index']);
        Route::post('/backups', [AdminBackupController::class, 'store']);
        Route::get('/backups/{name}/download', [AdminBackupController::class, 'download']);
    });
});
