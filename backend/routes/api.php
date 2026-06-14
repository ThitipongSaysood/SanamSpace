<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\BranchController;
use App\Http\Controllers\Api\CourtController;
use App\Http\Controllers\Api\MembershipController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PackageController;
use App\Http\Controllers\Api\PromotionController;
use App\Http\Controllers\Api\ReviewController;
use App\Http\Controllers\Api\WalletController;
use App\Http\Controllers\Api\Admin\DashboardController as AdminDashboardController;
use App\Http\Controllers\Api\Admin\FeatureController as AdminFeatureController;
use App\Http\Controllers\Api\Admin\OrganizationController as AdminOrganizationController;
use App\Http\Controllers\Api\Admin\PlanController as AdminPlanController;
use App\Http\Controllers\Api\Admin\SubscriptionController as AdminSubscriptionController;
use App\Http\Controllers\Api\Owner\BookingController as OwnerBookingController;
use App\Http\Controllers\Api\Owner\BranchController as OwnerBranchController;
use App\Http\Controllers\Api\Owner\BroadcastController as OwnerBroadcastController;
use App\Http\Controllers\Api\Owner\CourtController as OwnerCourtController;
use App\Http\Controllers\Api\Owner\CrmController as OwnerCrmController;
use App\Http\Controllers\Api\Owner\CustomerController as OwnerCustomerController;
use App\Http\Controllers\Api\Owner\DashboardController as OwnerDashboardController;
use App\Http\Controllers\Api\Owner\MembershipController as OwnerMembershipController;
use App\Http\Controllers\Api\Owner\SegmentController as OwnerSegmentController;
use App\Http\Controllers\Api\Owner\TimelineController as OwnerTimelineController;
use App\Http\Controllers\Api\Owner\PaymentController as OwnerPaymentController;
use App\Http\Controllers\Api\Owner\PromotionController as OwnerPromotionController;
use App\Http\Controllers\Api\Owner\SettingController as OwnerSettingController;
use App\Http\Controllers\Api\Owner\StaffController as OwnerStaffController;
use App\Http\Controllers\Api\Owner\UploadController as OwnerUploadController;
use App\Http\Controllers\Api\Owner\WalletController as OwnerWalletController;
use App\Http\Controllers\Api\PaymentController;
use Illuminate\Support\Facades\Route;

// All routes here are mounted under the /api/v1 prefix (bootstrap/app.php).

// --- Public auth ---
Route::post('/auth/line/login', [AuthController::class, 'lineLogin']);
Route::post('/auth/admin/login', [AuthController::class, 'adminLogin']);

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

// --- Protected ---
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::put('/auth/me', [AuthController::class, 'updateMe']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

    // --- Customer account (scoped to the authenticated Customer) ---
    Route::get('/membership', [MembershipController::class, 'show']);
    Route::get('/wallet', [WalletController::class, 'show']);
    Route::get('/notifications', [NotificationController::class, 'index']);

    // --- Bookings (scoped to the authenticated Customer) ---
    Route::get('/bookings', [BookingController::class, 'index']);
    Route::post('/bookings', [BookingController::class, 'store']);
    Route::get('/bookings/{id}', [BookingController::class, 'show']);
    Route::post('/bookings/{id}/cancel', [BookingController::class, 'cancel']);
    Route::post('/bookings/{id}/checkin', [BookingController::class, 'checkin']);
    Route::post('/bookings/{id}/checkout', [BookingController::class, 'checkout']);

    // --- Payments ---
    Route::post('/payments', [PaymentController::class, 'store']);
    Route::get('/payments/{id}', [PaymentController::class, 'show']);
    Route::post('/payments/{id}/upload-slip', [PaymentController::class, 'uploadSlip']);
    Route::post('/payments/{id}/verify', [PaymentController::class, 'verify']);
    Route::post('/payments/{id}/reject', [PaymentController::class, 'reject']);

    // --- Owner Portal (staff/admin, org-scoped via owner.org middleware) ---
    Route::prefix('owner')->middleware('owner.org')->group(function () {
        Route::get('/dashboard', [OwnerDashboardController::class, 'index']);

        Route::get('/bookings', [OwnerBookingController::class, 'index']);
        Route::post('/bookings', [OwnerBookingController::class, 'store']);
        Route::get('/bookings/{id}', [OwnerBookingController::class, 'show']);
        Route::put('/bookings/{id}', [OwnerBookingController::class, 'update']);
        Route::post('/bookings/{id}/cancel', [OwnerBookingController::class, 'cancel']);

        Route::get('/payments', [OwnerPaymentController::class, 'index']);
        Route::post('/payments/{id}/verify', [OwnerPaymentController::class, 'verify']);
        Route::post('/payments/{id}/reject', [OwnerPaymentController::class, 'reject']);

        // --- Image upload (venue cover / gallery / floor-plan) ---
        Route::post('/uploads', [OwnerUploadController::class, 'store']);

        // --- Branches (สนาม/สาขา) management CRUD ---
        Route::get('/branches', [OwnerBranchController::class, 'index']);
        Route::post('/branches', [OwnerBranchController::class, 'store']);
        Route::put('/branches/{id}', [OwnerBranchController::class, 'update']);
        Route::post('/branches/{id}/toggle', [OwnerBranchController::class, 'toggle']);
        Route::delete('/branches/{id}', [OwnerBranchController::class, 'destroy']);

        // --- Courts (คอร์ท) management CRUD ---
        Route::get('/courts', [OwnerCourtController::class, 'index']);
        Route::post('/courts', [OwnerCourtController::class, 'store']);
        Route::put('/courts/{id}', [OwnerCourtController::class, 'update']);
        Route::post('/courts/{id}/toggle', [OwnerCourtController::class, 'toggle']);
        Route::delete('/courts/{id}', [OwnerCourtController::class, 'destroy']);

        Route::get('/customers', [OwnerCustomerController::class, 'index']);

        // --- Settings (org settings + org name) ---
        Route::get('/settings', [OwnerSettingController::class, 'show']);
        Route::put('/settings', [OwnerSettingController::class, 'update']);

        // --- Promotions (management CRUD, org-scoped) ---
        Route::get('/promotions', [OwnerPromotionController::class, 'index']);
        Route::post('/promotions', [OwnerPromotionController::class, 'store']);
        Route::put('/promotions/{id}', [OwnerPromotionController::class, 'update']);
        Route::delete('/promotions/{id}', [OwnerPromotionController::class, 'destroy']);

        // --- Staff & roles (read + invite) ---
        Route::get('/staff', [OwnerStaffController::class, 'index']);
        Route::post('/staff', [OwnerStaffController::class, 'store']);
        Route::get('/roles', [OwnerStaffController::class, 'roles']);

        // --- Memberships (read list + points adjust) ---
        Route::get('/memberships', [OwnerMembershipController::class, 'index']);
        Route::post('/memberships/{id}/points', [OwnerMembershipController::class, 'adjustPoints']);

        // --- Wallets (read list + topup) ---
        Route::get('/wallets', [OwnerWalletController::class, 'index']);
        Route::post('/wallets/{id}/topup', [OwnerWalletController::class, 'topup']);

        // --- CRM (overview + segments + timeline + broadcasts) ---
        Route::get('/crm/overview', [OwnerCrmController::class, 'overview']);

        Route::get('/segments', [OwnerSegmentController::class, 'index']);
        Route::post('/segments', [OwnerSegmentController::class, 'store']);
        Route::delete('/segments/{id}', [OwnerSegmentController::class, 'destroy']);

        Route::get('/timeline/{customerId}', [OwnerTimelineController::class, 'show']);

        Route::get('/broadcasts', [OwnerBroadcastController::class, 'index']);
        Route::post('/broadcasts', [OwnerBroadcastController::class, 'store']);
        Route::post('/broadcasts/{id}/send', [OwnerBroadcastController::class, 'send']);
    });

    // --- Super Admin / Platform (super.admin middleware, NOT org-scoped) ---
    Route::prefix('admin')->middleware('super.admin')->group(function () {
        Route::get('/dashboard', [AdminDashboardController::class, 'index']);

        Route::get('/organizations', [AdminOrganizationController::class, 'index']);
        Route::get('/organizations/{id}', [AdminOrganizationController::class, 'show']);

        Route::get('/subscriptions', [AdminSubscriptionController::class, 'index']);

        Route::get('/plans', [AdminPlanController::class, 'index']);
        Route::post('/plans', [AdminPlanController::class, 'store']);
        Route::put('/plans/{id}', [AdminPlanController::class, 'update']);

        Route::get('/features', [AdminFeatureController::class, 'index']);
    });
});
