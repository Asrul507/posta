-- Migration 0001: tambah kolom shift_name pada tabel shifts.
-- Jalankan file ini SEKALI SAJA jika database D1 Anda sudah ada sebelumnya
-- (schema.sql pakai CREATE TABLE IF NOT EXISTS sehingga tidak akan menambah
-- kolom baru pada tabel yang sudah terlanjur dibuat).
--
-- Cara jalankan (contoh):
--   wrangler d1 execute posta --remote --file=./database/migration_0001_add_shift_name.sql
--
-- Jika kolom shift_name sudah ada (misalnya baru deploy dari schema.sql versi
-- terbaru), skip saja migrasi ini.

ALTER TABLE shifts ADD COLUMN shift_name TEXT NOT NULL DEFAULT 'Pagi';
