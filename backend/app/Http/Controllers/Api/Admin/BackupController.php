<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\BackupService;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class BackupController extends Controller
{
    public function __construct(private readonly BackupService $backups) {}

    /** GET /admin/backups — list existing backups (newest first). */
    public function index(): JsonResponse
    {
        return response()->json(['data' => $this->backups->list()]);
    }

    /** POST /admin/backups — create a new backup now. */
    public function store(): JsonResponse
    {
        return response()->json(['data' => $this->backups->create()], 201);
    }

    /** GET /admin/backups/{name}/download — download a backup file. */
    public function download(string $name): BinaryFileResponse|JsonResponse
    {
        $path = $this->backups->path($name);
        if (! $path) {
            return response()->json(['message' => 'ไม่พบไฟล์สำรองข้อมูล'], 404);
        }

        return response()->download($path, $name, ['Content-Type' => 'application/json']);
    }
}
