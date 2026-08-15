<?php

use App\Http\Middleware\EnsurePermission;
use App\Http\Middleware\EnsurePlanFeature;
use App\Http\Middleware\EnsurePlanLimit;
use App\Http\Middleware\EnsureStorageLimit;
use App\Http\Middleware\EnsureSubscriptionActive;
use App\Http\Middleware\EnsureSuperAdmin;
use App\Http\Middleware\ResolveOwnerOrganization;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'api/v1',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'owner.org' => ResolveOwnerOrganization::class,
            // Runs after owner.org — needs the resolved organization.
            'owner.subscribed' => EnsureSubscriptionActive::class,
            // permission:court.manage — the staff member's role must carry it.
            'permission' => EnsurePermission::class,
            // feature:pos — the venue's PLAN must include it. Separate from
            // permission on purpose: one is about the person, one about the bill.
            'feature' => EnsurePlanFeature::class,
            // limit:court — the venue's plan must allow ANOTHER one. Only on
            // create routes; editing what already exists stays open.
            'limit' => EnsurePlanLimit::class,
            // limit.storage:file — the venue's plan storage_gb must have room.
            // Only on owner content uploads, never on customer/bill slips.
            'limit.storage' => EnsureStorageLimit::class,
            'super.admin' => EnsureSuperAdmin::class,
        ]);

        // A baseline ceiling on the whole API.
        //
        // Individual endpoints that deserve a tighter limit already carry one
        // (login by IP in the controller, register/reset/topup/reviews on the
        // route). Everything ELSE had none at all: a single client could hammer
        // any read endpoint as fast as the network allowed, and the venue whose
        // database it was reading would be the one to notice.
        //
        // The ceiling is deliberately generous — see the limiter in
        // AppServiceProvider for why, and for what it is keyed by.
        $middleware->api(prepend: ['throttle:api']);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*'),
        );
    })->create();
