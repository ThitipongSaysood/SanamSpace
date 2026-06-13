<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\BranchController;
use App\Http\Controllers\Api\CourtController;
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

// --- Protected ---
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/auth/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);

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
});
