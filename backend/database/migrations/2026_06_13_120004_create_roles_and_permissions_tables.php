<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id')->nullable();
            $table->string('code', 100);
            $table->string('name');
            $table->text('description')->nullable();
            $table->boolean('is_system_role')->default(false);
            $table->timestamps();
        });

        Schema::create('permissions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('code', 150)->unique();
            $table->string('name');
            $table->string('module', 100)->nullable();
            $table->text('description')->nullable();
            $table->timestamps();
        });

        Schema::create('role_permissions', function (Blueprint $table) {
            $table->id();
            $table->uuid('role_id');
            $table->uuid('permission_id');
            $table->timestamps();

            $table->foreign('role_id')->references('id')->on('roles')->cascadeOnDelete();
            $table->foreign('permission_id')->references('id')->on('permissions')->cascadeOnDelete();
            $table->unique(['role_id', 'permission_id']);
        });

        // Links a user to an organization, carrying their role within it.
        Schema::create('organization_users', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('organization_id');
            $table->unsignedBigInteger('user_id');
            $table->uuid('role_id')->nullable();
            $table->string('display_name')->nullable();
            $table->string('status', 50)->default('active');
            $table->timestamp('joined_at')->nullable();
            $table->timestamps();

            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('role_id')->references('id')->on('roles')->nullOnDelete();
            $table->unique(['organization_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('organization_users');
        Schema::dropIfExists('role_permissions');
        Schema::dropIfExists('permissions');
        Schema::dropIfExists('roles');
    }
};
