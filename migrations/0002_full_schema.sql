-- Full production schema (Phase 1). Phase 0 spike tables are dropped and the
-- minimal phase-0 content tables (articles, media) are recreated with their
-- final shape — no production data exists yet.

DROP TABLE IF EXISTS `spike_children`;
--> statement-breakpoint
DROP TABLE IF EXISTS `spike_parents`;
--> statement-breakpoint
DROP TABLE IF EXISTS `article_i18n`;
--> statement-breakpoint
DROP TABLE IF EXISTS `articles`;
--> statement-breakpoint
DROP TABLE IF EXISTS `media`;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `totp_verified` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE `reset_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` text NOT NULL,
	`used_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text,
	`action` text NOT NULL,
	`entity_type` text,
	`entity_id` text,
	`reason` text,
	`detail_json` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `audit_log_created_idx` ON `audit_log` (`created_at`);
--> statement-breakpoint
CREATE TABLE `content_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`locale` text NOT NULL,
	`version` integer NOT NULL,
	`title` text NOT NULL,
	`body_json` text,
	`derived_hash` text,
	`status_at_save` text,
	`actor_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `content_revisions_entity_idx` ON `content_revisions` (`entity_type`, `entity_id`, `locale`);
--> statement-breakpoint
CREATE TABLE `media` (
	`id` text PRIMARY KEY NOT NULL,
	`r2_key` text NOT NULL,
	`kind` text NOT NULL,
	`declared_mime` text NOT NULL,
	`detected_mime` text,
	`size` integer NOT NULL,
	`width` integer,
	`height` integer,
	`original_filename` text NOT NULL,
	`checksum` text NOT NULL,
	`focal_x` real,
	`focal_y` real,
	`placeholder_color` text,
	`status` text NOT NULL,
	`created_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_r2_key_unique` ON `media` (`r2_key`);
--> statement-breakpoint
CREATE TABLE `media_i18n` (
	`media_id` text NOT NULL,
	`locale` text NOT NULL,
	`alt` text,
	`caption` text,
	`credit` text,
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `media_i18n_unique` ON `media_i18n` (`media_id`, `locale`);
--> statement-breakpoint
CREATE TABLE `pages` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`section` text DEFAULT 'about' NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` text,
	`legacy_id` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text,
	`updated_by` text,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pages_slug_unique` ON `pages` (`slug`);
--> statement-breakpoint
CREATE INDEX `pages_status_idx` ON `pages` (`status`, `sort`);
--> statement-breakpoint
CREATE TABLE `page_i18n` (
	`page_id` text NOT NULL,
	`locale` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`seo_title` text,
	`seo_description` text,
	`body_json` text,
	`body_html` text,
	`body_text` text,
	`content_schema_version` integer DEFAULT 1 NOT NULL,
	`review_status` text DEFAULT 'missing' NOT NULL,
	`stale_source` integer DEFAULT 0 NOT NULL,
	`translation_model` text,
	`translation_provider` text,
	`source_hash` text,
	`prompt_version` text,
	`translated_at` text,
	`reviewed_at` text,
	`reviewed_by` text,
	FOREIGN KEY (`page_id`) REFERENCES `pages`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `page_i18n_unique` ON `page_i18n` (`page_id`, `locale`);
--> statement-breakpoint
CREATE TABLE `articles` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`category` text NOT NULL,
	`cover_media_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` text,
	`legacy_id` integer,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text,
	`updated_by` text,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `articles_slug_unique` ON `articles` (`slug`);
--> statement-breakpoint
CREATE INDEX `articles_status_published_idx` ON `articles` (`status`, `published_at`);
--> statement-breakpoint
CREATE INDEX `articles_category_idx` ON `articles` (`category`, `status`, `published_at`);
--> statement-breakpoint
CREATE TABLE `article_i18n` (
	`article_id` text NOT NULL,
	`locale` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`excerpt` text,
	`seo_description` text,
	`body_json` text,
	`body_html` text,
	`body_text` text,
	`content_schema_version` integer DEFAULT 1 NOT NULL,
	`review_status` text DEFAULT 'missing' NOT NULL,
	`stale_source` integer DEFAULT 0 NOT NULL,
	`translation_model` text,
	`translation_provider` text,
	`source_hash` text,
	`prompt_version` text,
	`translated_at` text,
	`reviewed_at` text,
	`reviewed_by` text,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `article_i18n_unique` ON `article_i18n` (`article_id`, `locale`);
--> statement-breakpoint
CREATE TABLE `article_media` (
	`article_id` text NOT NULL,
	`media_id` text NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`),
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`cover_media_id` text,
	`sort` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`facts_json` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text,
	`updated_by` text,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_slug_unique` ON `projects` (`slug`);
--> statement-breakpoint
CREATE TABLE `project_i18n` (
	`project_id` text NOT NULL,
	`locale` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`summary` text,
	`body_json` text,
	`body_html` text,
	`body_text` text,
	`content_schema_version` integer DEFAULT 1 NOT NULL,
	`review_status` text DEFAULT 'missing' NOT NULL,
	`stale_source` integer DEFAULT 0 NOT NULL,
	`translation_model` text,
	`translation_provider` text,
	`source_hash` text,
	`prompt_version` text,
	`translated_at` text,
	`reviewed_at` text,
	`reviewed_by` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_i18n_unique` ON `project_i18n` (`project_id`, `locale`);
--> statement-breakpoint
CREATE TABLE `procurements` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`kind` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` text,
	`deadline_at` text,
	`previous_deadline_at` text,
	`amends_id` text,
	`legacy_id` integer,
	`migration_confidence` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text,
	`updated_by` text,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `procurements_slug_unique` ON `procurements` (`slug`);
--> statement-breakpoint
CREATE INDEX `procurements_kind_status_idx` ON `procurements` (`kind`, `status`, `deadline_at`);
--> statement-breakpoint
CREATE TABLE `procurement_status_history` (
	`id` text PRIMARY KEY NOT NULL,
	`procurement_id` text NOT NULL,
	`from_status` text,
	`to_status` text NOT NULL,
	`actor_id` text,
	`reason` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`procurement_id`) REFERENCES `procurements`(`id`)
);
--> statement-breakpoint
CREATE TABLE `procurement_i18n` (
	`procurement_id` text NOT NULL,
	`locale` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`amendment_summary` text,
	`body_json` text,
	`body_html` text,
	`body_text` text,
	`content_schema_version` integer DEFAULT 1 NOT NULL,
	`review_status` text DEFAULT 'missing' NOT NULL,
	`stale_source` integer DEFAULT 0 NOT NULL,
	`translation_model` text,
	`translation_provider` text,
	`source_hash` text,
	`prompt_version` text,
	`translated_at` text,
	`reviewed_at` text,
	`reviewed_by` text,
	FOREIGN KEY (`procurement_id`) REFERENCES `procurements`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `procurement_i18n_unique` ON `procurement_i18n` (`procurement_id`, `locale`);
--> statement-breakpoint
CREATE TABLE `procurement_docs` (
	`id` text PRIMARY KEY NOT NULL,
	`procurement_id` text NOT NULL,
	`media_id` text NOT NULL,
	`locale` text,
	`sort` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`procurement_id`) REFERENCES `procurements`(`id`),
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`)
);
--> statement-breakpoint
CREATE TABLE `procurement_docs_i18n` (
	`doc_id` text NOT NULL,
	`locale` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`doc_id`) REFERENCES `procurement_docs`(`id`)
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`category` text NOT NULL,
	`year` integer,
	`sort` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text,
	`updated_by` text,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `documents_slug_unique` ON `documents` (`slug`);
--> statement-breakpoint
CREATE INDEX `documents_year_category_idx` ON `documents` (`year`, `category`);
--> statement-breakpoint
CREATE TABLE `document_i18n` (
	`document_id` text NOT NULL,
	`locale` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`description` text,
	`review_status` text DEFAULT 'missing' NOT NULL,
	`stale_source` integer DEFAULT 0 NOT NULL,
	`translation_model` text,
	`translation_provider` text,
	`source_hash` text,
	`prompt_version` text,
	`translated_at` text,
	`reviewed_at` text,
	`reviewed_by` text,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_i18n_unique` ON `document_i18n` (`document_id`, `locale`);
--> statement-breakpoint
CREATE TABLE `document_files` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`locale` text NOT NULL,
	`media_id` text NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`),
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`)
);
--> statement-breakpoint
CREATE TABLE `albums` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`cover_media_id` text,
	`sort` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text,
	`updated_by` text,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `albums_slug_unique` ON `albums` (`slug`);
--> statement-breakpoint
CREATE TABLE `album_i18n` (
	`album_id` text NOT NULL,
	`locale` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`description` text,
	`review_status` text DEFAULT 'missing' NOT NULL,
	`stale_source` integer DEFAULT 0 NOT NULL,
	`translation_model` text,
	`translation_provider` text,
	`source_hash` text,
	`prompt_version` text,
	`translated_at` text,
	`reviewed_at` text,
	`reviewed_by` text,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `album_i18n_unique` ON `album_i18n` (`album_id`, `locale`);
--> statement-breakpoint
CREATE TABLE `album_items` (
	`album_id` text NOT NULL,
	`media_id` text NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`),
	FOREIGN KEY (`media_id`) REFERENCES `media`(`id`)
);
--> statement-breakpoint
CREATE TABLE `videos` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`media_id` text,
	`youtube_id` text,
	`thumb_media_id` text,
	`sort` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text,
	`updated_by` text,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `videos_slug_unique` ON `videos` (`slug`);
--> statement-breakpoint
CREATE TABLE `video_i18n` (
	`video_id` text NOT NULL,
	`locale` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`description` text,
	`review_status` text DEFAULT 'missing' NOT NULL,
	`stale_source` integer DEFAULT 0 NOT NULL,
	`translation_model` text,
	`translation_provider` text,
	`source_hash` text,
	`prompt_version` text,
	`translated_at` text,
	`reviewed_at` text,
	`reviewed_by` text,
	FOREIGN KEY (`video_id`) REFERENCES `videos`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `video_i18n_unique` ON `video_i18n` (`video_id`, `locale`);
--> statement-breakpoint
CREATE TABLE `partners` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text,
	`logo_media_id` text,
	`sort` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text,
	`updated_by` text,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `partner_i18n` (
	`partner_id` text NOT NULL,
	`locale` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`partner_id`) REFERENCES `partners`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `partner_i18n_unique` ON `partner_i18n` (`partner_id`, `locale`);
--> statement-breakpoint
CREATE TABLE `org_units` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text,
	`sort` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text,
	`updated_by` text,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `org_unit_i18n` (
	`org_unit_id` text NOT NULL,
	`locale` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`person_name` text,
	FOREIGN KEY (`org_unit_id`) REFERENCES `org_units`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `org_unit_i18n_unique` ON `org_unit_i18n` (`org_unit_id`, `locale`);
--> statement-breakpoint
CREATE TABLE `stats` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`unit` text,
	`sort` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`created_by` text,
	`updated_by` text,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stats_key_unique` ON `stats` (`key`);
--> statement-breakpoint
CREATE TABLE `stat_i18n` (
	`stat_id` text NOT NULL,
	`locale` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`stat_id`) REFERENCES `stats`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `stat_i18n_unique` ON `stat_i18n` (`stat_id`, `locale`);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `glossary` (
	`id` text PRIMARY KEY NOT NULL,
	`term_ka` text NOT NULL,
	`term_en` text NOT NULL,
	`term_ru` text NOT NULL,
	`note` text,
	`version` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `submissions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`subject` text NOT NULL,
	`message` text NOT NULL,
	`ip_hash` text,
	`ua_hash` text,
	`created_at` text NOT NULL,
	`handled` integer DEFAULT 0 NOT NULL,
	`purge_after` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `redirects` (
	`old_path` text PRIMARY KEY NOT NULL,
	`new_path` text NOT NULL,
	`status_code` integer DEFAULT 301 NOT NULL,
	`locale` text,
	`note` text
);
