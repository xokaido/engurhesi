-- FK-alter fixture: add optional note column with deferred FK check
PRAGMA defer_foreign_keys = true;
--> statement-breakpoint
ALTER TABLE `spike_children` ADD COLUMN `note` text;
